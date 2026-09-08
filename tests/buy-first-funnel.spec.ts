/**
 * Buy-first funnel — the money path a visitor takes WITHOUT an account.
 *
 * CEO defect 2026-09-08: "الي يدخل الصفحة يبي يدخل يدفع اشتراك مباشرة — لا تجبره
 * يسجل". These assertions are the regression fence around that:
 *   1. every paid plan card offers BOTH «اشترك الآن» and «ابدأ مجانًا»
 *   2. the AR/EN toggle is reachable in one tap on a 390px phone and flips
 *      the document direction
 *   3. «اشترك الآن» calls POST /api/public/checkout with NO session
 *   4. /welcome?session_id=… renders the set-password panel with the paid
 *      email prefilled and READ-ONLY
 */
import { expect, test, type Page } from '@playwright/test'

// Honour a caller-supplied dev-server origin (parallel worktrees run their own
// port); otherwise the playwright config's baseURL applies unchanged.
if (process.env.PW_BASE_URL) test.use({ baseURL: process.env.PW_BASE_URL })

const PHONE = { width: 390, height: 844 }
const API = 'https://api.entix.io'

const PLANS = [
  { id: 'plan-pro-year-sar', stripePriceId: 'price_pro_year_sar', tier: 'professional', interval: 'year', currency: 'sar', price: 95000, name: 'Professional Yearly', nameAr: 'احترافي · سنوي', isActive: true, features: [] },
  { id: 'plan-pro-year-usd', stripePriceId: 'price_pro_year_usd', tier: 'professional', interval: 'year', currency: 'usd', price: 19000, name: 'Professional Yearly', nameAr: 'احترافي · سنوي', isActive: true, features: [] },
  { id: 'plan-ent-year-sar', stripePriceId: 'price_ent_year_sar', tier: 'enterprise', interval: 'year', currency: 'sar', price: 299000, name: 'Enterprise Yearly', nameAr: 'مؤسسي · سنوي', isActive: true, features: [] },
]

async function preparePublic(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.addInitScript((lang) => {
    localStorage.setItem('entix-language', lang)
    localStorage.setItem('entix-marketing-region', lang === 'ar' ? 'SA' : 'US')
    localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
      v: 1, choice: 'essential', analytics: false, marketing: false, at: '2026-08-15T00:00:00.000Z',
    }))
  }, locale)
  await page.route(`${API}/api/auth/get-session`, (route) => route.fulfill({ json: {} }))
  await page.route(`${API}/api/stripe/plans`, (route) => route.fulfill({ json: { plans: PLANS } }))
  await page.route(`${API}/api/stripe/public-plans`, (route) => route.fulfill({ json: { plans: PLANS } }))
}

test.describe('pricing · two actions per paid plan', () => {
  test('every paid plan offers BOTH «اشترك الآن» and «ابدأ مجانًا»', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.setViewportSize(PHONE)
    await page.goto('/pricing')
    for (const tier of ['professional', 'enterprise']) {
      await expect(page.getByTestId(`plan-subscribe-${tier}`)).toBeVisible()
      await expect(page.getByTestId(`plan-start-free-${tier}`)).toBeVisible()
    }
  })

  test('the free Starter plan keeps a single action — there is nothing to pay', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.goto('/pricing')
    await expect(page.getByTestId('plan-subscribe-starter')).toBeVisible()
    await expect(page.getByTestId('plan-start-free-starter')).toHaveCount(0)
  })

  test('«ابدأ مجانًا» goes to the existing free signup', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.goto('/pricing')
    await page.getByTestId('plan-start-free-professional').click()
    await expect(page).toHaveURL(/\/register/)
  })
})

test.describe('public checkout · no account required', () => {
  test('«اشترك الآن» calls POST /api/public/checkout with NO session', async ({ page }) => {
    await preparePublic(page, 'ar')
    const calls: Array<{ hasCookie: boolean; body: any }> = []
    await page.route(`${API}/api/public/checkout`, async (route) => {
      calls.push({
        hasCookie: Boolean(route.request().headers()['cookie']),
        body: route.request().postDataJSON(),
      })
      // Stop the redirect: assert the request, not Stripe's hosted page.
      await route.fulfill({ json: { url: 'about:blank#checkout', mode: 'checkout', token: 'psu_test' } })
    })
    await page.goto('/pricing')
    await page.getByTestId('plan-subscribe-professional').click()
    await expect.poll(() => calls.length).toBeGreaterThan(0)
    expect(calls[0].body.tier).toBe('professional')
    expect(calls[0].body.interval).toBe('year')
    expect(['sa', 'us']).toContain(calls[0].body.market)
    expect(calls[0].hasCookie).toBe(false)
  })

  test('a checkout failure is shown in place instead of bouncing to registration', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.route(`${API}/api/public/checkout`, (route) => route.fulfill({ status: 502, json: { error: 'checkout_session_failed' } }))
    await page.goto('/pricing')
    await page.getByTestId('plan-subscribe-professional').click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/pricing/)
  })
})

test.describe('language toggle · one tap on a phone', () => {
  for (const path of ['/', '/pricing', '/login', '/register']) {
    test(`is visible at 390px on ${path}`, async ({ page }) => {
      await preparePublic(page, 'ar')
      await page.setViewportSize(PHONE)
      await page.goto(path)
      await expect(page.getByTestId('public-language-toggle').first()).toBeVisible()
    })
  }

  test('switches the document direction without leaving the page', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.setViewportSize(PHONE)
    await page.goto('/pricing')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await page.getByTestId('public-language-en').first().click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page).toHaveURL(/\/pricing/)
    await page.getByTestId('public-language-ar').first().click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('persists the choice to the public-preferences store', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.setViewportSize(PHONE)
    await page.goto('/pricing')
    await page.getByTestId('public-language-en').first().click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('entix-language'))).toBe('en')
  })
})

test.describe('/welcome · account creation AFTER payment', () => {
  const session = {
    paid: true,
    email: 'buyer@company.sa',
    locale: 'ar',
    token: 'psu_test',
    planName: 'احترافي · سنوي',
    subscriptionActive: true,
    accountReady: true,
    needsPassword: true,
    needsLogin: false,
  }

  test('renders the paid panel with the email prefilled and READ-ONLY', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.route(`${API}/api/public/checkout/session**`, (route) => route.fulfill({ json: session }))
    await page.setViewportSize(PHONE)
    await page.goto('/welcome?session_id=cs_test_a1b2c3')
    await expect(page.getByTestId('welcome-paid')).toBeVisible()
    await expect(page.getByTestId('welcome-paid-title')).toContainText('تم الدفع')
    const email = page.getByTestId('welcome-paid-email')
    await expect(email).toHaveValue('buyer@company.sa')
    await expect(email).toHaveAttribute('readonly', '')
    await expect(page.getByTestId('welcome-paid-password')).toBeVisible()
  })

  test('never bounces the paying visitor to /login before they have a password', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.route(`${API}/api/public/checkout/session**`, (route) => route.fulfill({ json: session }))
    await page.goto('/welcome?session_id=cs_test_a1b2c3')
    await expect(page).toHaveURL(/\/welcome/)
  })

  test('asks a returning customer to sign in instead of setting a password', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.route(`${API}/api/public/checkout/session**`, (route) =>
      route.fulfill({ json: { ...session, needsPassword: false, needsLogin: true } }))
    await page.goto('/welcome?session_id=cs_test_a1b2c3')
    await expect(page.getByTestId('welcome-paid-login')).toBeVisible()
    await expect(page.getByTestId('welcome-paid-password')).toHaveCount(0)
  })

  test('waits while the webhook lands rather than showing a dead end', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.route(`${API}/api/public/checkout/session**`, (route) =>
      route.fulfill({ json: { ...session, accountReady: false } }))
    await page.goto('/welcome?session_id=cs_test_a1b2c3')
    await expect(page.getByTestId('welcome-paid-submit')).toBeDisabled()
    await expect(page.getByTestId('welcome-paid-email')).toHaveValue('buyer@company.sa')
  })
})
