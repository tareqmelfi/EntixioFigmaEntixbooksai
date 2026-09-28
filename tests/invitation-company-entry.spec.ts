import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const admin of [false, true]) for (const existing of [false, true]) test(`invitation opens its company: admin=${admin}, existing=${existing}`, async ({ page }) => {
  await prepareVisualApp(page);
  const user = { id: 'invite-user', name: 'Invited Support', email: 'invite@example.invalid', emailVerified: true };
  const oldOrg = { id: visualOrgId, name: 'Original Company', country: 'US', baseCurrency: 'USD' };
  const invitedOrg = { id: 'invited-org', name: 'Inviting Company', country: 'SA', baseCurrency: 'SAR' };
  let accepted = false;
  const memberships = () => [...(existing ? [{ role: 'OWNER', org: oldOrg }] : []), ...(accepted ? [{ role: 'VIEWER', org: invitedOrg }] : [])];
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user } }));
  await page.route('**/me', r => r.fulfill({ json: { ...user, isPlatformAdmin: admin, memberships: memberships() } }));
  await page.route('**/orgs', r => r.fulfill({ json: memberships().map(m => ({ ...m.org, role: m.role })) }));
  await page.route('**/api/invitations/test-invite', r => r.fulfill({ json: { org: invitedOrg, role: 'VIEWER', status: accepted ? 'ACCEPTED' : 'PENDING', expiresAt: '2099-01-01' } }));
  await page.route('**/api/invitations/test-invite/accept', r => {
    accepted = true;
    return r.fulfill({ json: { ok: true, org: invitedOrg, role: 'VIEWER' } });
  });
  await page.goto('/invite/test-invite');
  await page.getByRole('button', { name: 'Accept & join' }).click();
  await page.getByRole('button', { name: /Open (the app|company)/ }).click();
  await expect(page.getByRole('button', { name: /Inviting Company.*SA/ }).filter({ visible: true })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Inviting Company.*SA/ }).filter({ visible: true })).toBeVisible();
});

test('accepted invitation does not open a company after membership is removed', async ({ page }) => {
  await prepareVisualApp(page);
  await page.route('**/api/invitations/removed', r => r.fulfill({ json: { org: { id: 'removed-org', name: 'Former Company' }, role: 'VIEWER', status: 'ACCEPTED', expiresAt: '2099-01-01' } }));
  await page.goto('/invite/removed');
  await page.getByRole('button', { name: 'Open company' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not verify your company membership');
  await expect(page).toHaveURL(/\/invite\/removed$/);
});
