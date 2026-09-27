import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

async function prepare(page: Page, admin: boolean, language: 'en' | 'ar' = 'en') {
  await prepareVisualApp(page, language);
  const user = { id: 'account-test', name: 'Account Tester', email: 'account@example.invalid', isPlatformAdmin: admin, emailVerified: true };
  const orgs = [
    { id: visualOrgId, name: 'Invited Company', country: 'US', baseCurrency: 'USD', role: 'VIEWER' },
    { id: 'owned-company', name: 'Owned Company', country: 'US', baseCurrency: 'USD', role: 'OWNER' },
  ];
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user } }));
  await page.route('**/me', r => r.fulfill({ json: { ...user, locale: language, selectedOrgId: visualOrgId, memberships: orgs.map(org => ({ role: org.role, org })) } }));
  await page.route('**/orgs', async r => {
    if (r.request().method() === 'POST') {
      const created = { ...r.request().postDataJSON(), id: 'created-company', role: 'OWNER' };
      orgs.push(created);
      return r.fulfill({ json: created });
    }
    return r.fulfill({ json: orgs });
  });
  await page.route('**/orgs/*', r => r.fulfill({ json: orgs.find(o => r.request().url().endsWith(o.id)) || orgs[0] }));
  await page.route('**/me/preferences', r => r.fulfill({ json: { ok: true } }));
}

for (const admin of [false, true]) test(`company selection works for ${admin ? 'platform admin' : 'invited member'}`, async ({ page }) => {
  await prepare(page, admin);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app/settings?tab=account');
  const switcher = page.getByRole('button', { name: /Invited Company.*US/ }).filter({ visible: true });
  await expect(switcher).toBeVisible();
  await switcher.click();
  await expect(page.getByRole('button', { name: 'Create new company', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Owned Company/ }).click();
  await expect(page.getByRole('button', { name: /Owned Company.*US/ }).filter({ visible: true })).toBeVisible();
  await expect(page).toHaveURL(/settings\?tab=account/);
});

test('invited user can create a company and reach its subscription from their account', async ({ page }) => {
  await prepare(page, false);
  await page.goto('/app/settings?tab=account');
  await page.getByRole('button', { name: /Invited Company.*US/ }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Create new company', exact: true }).click();
  await page.getByPlaceholder('e.g. Horizon Trading Co.').fill('My New Company');
  await page.getByRole('button', { name: 'Create company', exact: true }).click();
  await expect(page.getByRole('button', { name: /My New Company/ }).filter({ visible: true })).toBeVisible();
  await page.locator('header').getByRole('button').filter({ has: page.locator('[data-slot="avatar"]') }).click();
  const billing = page.getByRole('link', { name: 'Manage subscriptions', exact: true });
  await expect(billing).toHaveAttribute('href', '/app/billing');
  await billing.click();
  await expect(page).toHaveURL(/\/app\/billing$/);
});

test('company remains available in the Arabic mobile navigation', async ({ page }) => {
  await prepare(page, true, 'ar');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/settings?tab=account');
  await page.locator('header').getByRole('button', { name: 'القائمة', exact: true }).click();
  await page.getByRole('button', { name: /Invited Company.*US/ }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: /Owned Company/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/entix-company-mobile.png' });
});

test('admin support context is identified and ended when selecting a membership', async ({ page }) => {
  await prepare(page, true);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('support-test-initialized')) {
      localStorage.setItem('entix_act_as', JSON.stringify({ orgId: 'support-company', orgName: 'Support Company', country: 'US', currency: 'USD', reason: 'Synthetic test', until: Date.now() + 600000 }));
      sessionStorage.setItem('support-test-initialized', '1');
    }
  });
  await page.route('**/api/admin/**', r => r.fulfill({ json: { ok: true } }));
  await page.goto('/app/settings?tab=account');
  await page.getByRole('button', { name: /Support Company.*US/ }).filter({ visible: true }).click();
  await page.getByRole('button', { name: /Owned Company/ }).click();
  await expect(page.getByRole('button', { name: /Owned Company.*US/ }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Acting on behalf of', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('entix_act_as'))).toBeNull();
});

for (const language of ['en', 'ar'] as const) test(`profile menu opens and reaches self service (${language})`, async ({ page }) => {
  await prepare(page, false, language);
  await page.setViewportSize({ width: language === 'ar' ? 390 : 1440, height: 1000 });
  await page.goto('/app');
  await page.locator('header').getByRole('button').filter({ has: page.locator('[data-slot="avatar"]') }).click();
  await page.getByRole('link', { name: language === 'ar' ? 'ملفي الشخصي وأمان الحساب' : 'Profile & account security' }).click();
  await expect(page.locator('#profile-name')).toHaveValue('Account Tester');
  await expect(page.locator('#profile-email')).toBeVisible();
  await expect(page.locator('#profile-current-password')).toBeVisible();
});
