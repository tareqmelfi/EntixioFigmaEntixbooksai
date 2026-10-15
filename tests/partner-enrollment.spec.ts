import { test, expect, Page } from '@playwright/test';

async function mock(page: Page, signedIn: boolean, lang = 'en') {
  let registered = false;
  const submissions: unknown[] = [];
  await page.addInitScript(({ lang }) => localStorage.setItem('entix-language', lang), { lang });
  await page.route('https://api.entix.io/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const user = { id: 'partner-test', name: 'Test Partner', email: 'partner@example.test', emailVerified: true, createdAt: '2026-10-05T00:00:00Z' };
    if (path === '/api/auth/get-session') return route.fulfill({ json: signedIn ? { user } : {} });
    if (path === '/me') return route.fulfill({ json: { ...user, memberships: [] } });
    if (path === '/auth-providers') return route.fulfill({ json: { google: false, microsoft: false } });
    if (path === '/api/partners/register') {
      expect(route.request().headers()['x-org-id']).toBeUndefined();
      submissions.push(route.request().postDataJSON()); registered = true;
      return route.fulfill({ json: { id: 'partner-row' } });
    }
    if (path === '/api/partners/me') return route.fulfill(registered ? { json: {
      partner: { id: 'partner-row', name: 'Test Partner', isActive: false },
      enrollment: { reference: 'EB-partner-row', activationReady: false, payoutReady: false },
      dashboard: { activeClients: 0, totalClients: 0, balancesByCurrency: {} }, clients: [], commissions: [], payouts: [],
    } } : { status: 404, json: { error: 'not_registered' } });
    return route.fulfill({ json: {} });
  });
  return submissions;
}

for (const language of ['en', 'ar']) {
  test(`application persists and survives reload without an accounting company (${language})`, async ({ page }) => {
    const submissions = await mock(page, true, language);
    await page.goto('/partners');
    await page.getByRole('button', { name: language === 'en' ? 'Essential only' : 'الضرورية فقط', exact: true }).click();
    await page.locator('#partner-name').fill('Test Partner');
    await page.locator('#partner-country').fill(language === 'ar' ? 'مصر' : 'Egypt');
    await page.getByRole('button', { name: language === 'en' ? 'Save application' : 'حفظ طلب الانضمام' }).click();
    await expect(page.getByText('EB-partner-row')).toBeVisible();
    await expect(page.getByRole('button', { name: language === 'en' ? 'Request payout of cleared commissions' : 'طلب سحب العمولات الجاهزة' })).toBeDisabled();
    expect(submissions).toEqual([{ name: 'Test Partner', type: 'FREELANCER', country: 'EG' }]);
    await page.reload();
    await expect(page.getByText('EB-partner-row')).toBeVisible();
    expect(page.url()).toContain('/partners');
    await page.screenshot({ path: `/tmp/entix-partner-application-${language}.png`, fullPage: true });
    await expect(page.locator('input[placeholder*="Org ID"]')).toHaveCount(0);
  });
  test(`public program avoids fake codes and preserves partner sign-in intent (${language})`, async ({ page }) => {
    await mock(page, false, language);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/referrals');
    await page.getByRole('button', { name: language === 'en' ? 'Essential only' : 'الضرورية فقط', exact: true }).click();
    await expect(page.getByRole('link', { name: language === 'en' ? 'Register interest in paid referrals' : 'سجّل اهتمامك بالإحالات المدفوعة' })).toBeVisible();
    await page.screenshot({ path: `/tmp/entix-partner-public-${language}.png`, fullPage: true });
    await expect(page.getByText(/40%/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Generate code|أنشئ الكود/ })).toHaveCount(0);
    await page.getByRole('link', { name: language === 'en' ? 'Register interest in paid referrals' : 'سجّل اهتمامك بالإحالات المدفوعة' }).click();
    await expect(page).toHaveURL(/register\?flow=partner/);
    await expect(page.getByRole('heading', { name: language === 'en' ? 'Create your account.' : 'أنشئ حسابك.' })).toBeVisible();
    await page.getByRole('link', { name: language === 'en' ? 'Sign in' : 'تسجيل الدخول', exact: true }).click();
    await expect(page).toHaveURL(/login\?flow=partner/);
  });
}

test('signed-in person with no company returns from partner signup to partner portal', async ({ page }) => {
  await mock(page, true);
  await page.goto('/register?flow=partner');
  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.locator('#partner-name')).toBeVisible();
});

test('API failure shows retry instead of an empty registration or crashing dashboard', async ({ page }) => {
  await mock(page, true);
  await page.route('https://api.entix.io/api/partners/me', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/partners');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('#partner-name')).toHaveCount(0);
});

test('partner signup preserves its destination in the verification email callback', async ({ page }) => {
  await mock(page, false);
  await page.addInitScript(() => {
    (window as any).turnstile = {
      render(element: HTMLElement, options: any) { options.callback('synthetic-captcha'); return 'synthetic'; },
      reset() {}, remove() {},
    };
  });
  let submitted: any;
  await page.route('https://api.entix.io/api/auth/sign-up/email', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { token: null, user: { id: 'new-partner', emailVerified: false } } });
  });
  await page.goto('/register?flow=partner');
  await page.locator('input[type="text"]').nth(0).fill('Test');
  await page.locator('input[type="text"]').nth(1).fill('Partner');
  await page.locator('input[type="email"]').fill('partner@example.test');
  await page.locator('input[type="password"]').fill('Synthetic-password-123');
  await page.locator('#terms').check();
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText('Your account was created', { exact: true })).toBeVisible();
  expect(submitted.callbackURL).toBe('https://entix.io/login?flow=partner');
  await page.getByRole('button', { name: 'Go to sign in' }).click();
  await expect(page).toHaveURL(/login\?flow=partner/);
});

for (const language of ['en', 'ar']) {
  test(`public sharing works without registration and does not claim commission (${language})`, async ({ page }) => {
    let registrations = 0;
    await mock(page, false, language);
    await page.route('https://api.entix.io/api/partners/register', route => { registrations++; return route.abort(); });
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as any).__copiedLink = value; } } }));
    await page.goto('/referrals');
    await page.getByRole('button', { name: language === 'ar' ? 'الضرورية فقط' : 'Essential only', exact: true }).click();
    await page.getByRole('button', { name: language === 'ar' ? 'نسخ الرابط' : 'Copy link', exact: true }).click();
    expect(await page.evaluate(() => (window as any).__copiedLink)).toBe('https://entix.io/');
    await expect(page.getByRole('link', { name: language === 'ar' ? 'افتح الموقع' : 'Open website' })).toHaveAttribute('href', 'https://entix.io/');
    await expect(page.getByText(language === 'ar' ? /هذا رابط مشاركة عام/ : /This is a general sharing link/)).toBeVisible();
    expect(registrations).toBe(0);
  });
}

test('clipboard rejection leaves a selectable public link and honest feedback', async ({ page }) => {
  await mock(page, false);
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.goto('/referrals');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByText('Automatic copy failed. Select the link above and copy it manually.')).toBeVisible();
  await expect(page.getByLabel('Public website link')).toHaveValue('https://entix.io/');
  await expect(page.getByText('Website link copied.', { exact: true })).toHaveCount(0);
});

test('a failed submission keeps the form and never shows a saved reference', async ({ page }) => {
  await mock(page, true);
  await page.route('https://api.entix.io/api/partners/register', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/partners');
  await page.locator('#partner-country').fill('Saudi Arabia');
  await page.getByRole('button', { name: 'Save application', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#partner-name')).toHaveValue('Test Partner');
  await expect(page.getByText('EB-partner-row')).toHaveCount(0);
});

test('unverified email explains why the application is not saved', async ({ page }) => {
  await mock(page, true);
  await page.route('https://api.entix.io/api/partners/register', route => route.fulfill({ status: 403, json: { error: 'email_verification_required' } }));
  await page.goto('/partners');
  await page.locator('#partner-country').fill('EG');
  await page.getByRole('button', { name: 'Save application', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your application has not been saved yet.');
});

for (const status of [200, 404]) {
  test(`malformed profile response ${status} shows retry, not a new signup`, async ({ page }) => {
    await mock(page, true);
    await page.route('https://api.entix.io/api/partners/me', route => route.fulfill({ status, contentType: 'text/html', body: '<html>upstream unavailable</html>' }));
    await page.goto('/partners');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.locator('#partner-name')).toHaveCount(0);
  });
}

for (const consent of [false, true]) {
  test(`partner copy event respects analytics consent: ${consent}`, async ({ page }) => {
    await mock(page, false);
    await page.route('https://www.googletagmanager.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }));
    await page.goto('/referrals');
    await page.getByRole('button', { name: consent ? 'Accept all' : 'Essential only', exact: true }).click();
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    const events = await page.evaluate(() => ((window as any).dataLayer || []).map((event: any) => Array.from(event)).filter((event: any) => event[0] === 'event'));
    expect(events).toEqual(consent ? [['event', 'partner_link_copied']] : []);
  });
}
