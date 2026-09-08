/**
 * Annual-first pricing — the discount must be the default story.
 *
 * CEO defect 2026-09-08: «خلي العرض السنوي مع علامات تبين الخصم والتوفير ولونها
 * أخضر وواضحة … وإذا حوّل يدوي شهري يصير السعر بدون خصومات. وخليها سهلة الوصول
 * من الرئيسية لأن الكل مو عارف كيف يشترك».
 *
 * The fence:
 *   1. ANNUAL is the default billing interval on first visit
 *   2. the green savings chip is present on annual and ABSENT on monthly
 *   3. «اشترك الآن» is the primary action and calls the PUBLIC checkout
 *      (no account, no /register detour) with interval=year
 *   4. the landing page carries a pricing block with the same savings chip
 */
import { expect, test, type Page } from '@playwright/test'

if (process.env.PW_BASE_URL) test.use({ baseURL: process.env.PW_BASE_URL })

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
const API = 'https://api.entix.io'

async function preparePublic(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.addInitScript((lang) => {
    localStorage.setItem('entix-language', lang)
    localStorage.setItem('entix-marketing-region', lang === 'ar' ? 'SA' : 'US')
    localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
      v: 1, choice: 'essential', analytics: false, marketing: false, at: '2026-08-15T00:00:00.000Z',
    }))
  }, locale)
  // Keep the run offline — third-party tags add ~10s per navigation here.
  await page.route(/googletagmanager|google-analytics|www\.google\.com|gstatic|doubleclick|challenges\.cloudflare\.com/, (route) => route.abort())
  await page.route(`${API}/api/auth/get-session`, (route) => route.fulfill({ json: {} }))
  await page.route(`${API}/api/stripe/plans`, (route) => route.fulfill({ json: { plans: [] } }))
  await page.route(`${API}/api/stripe/public-plans`, (route) => route.fulfill({ json: { plans: [] } }))
}

test.describe('pricing · annual is the default', () => {
  for (const locale of ['ar', 'en'] as const) {
    test(`[${locale}] annual is selected on first visit and every paid plan shows a savings chip`, async ({ page }) => {
      await preparePublic(page, locale)
      await page.goto('/pricing')
      // Lite is annual-only: it renders only while the annual view is active,
      // which makes it the proof that annual is the default.
      await expect(page.getByTestId('plan-actions-lite')).toBeVisible()
      for (const tier of ['professional', 'enterprise']) {
        await expect(page.getByTestId(`plan-savings-${tier}`)).toBeVisible()
        await expect(page.getByTestId(`plan-billed-annually-${tier}`)).toBeVisible()
      }
    })
  }

  test('the savings percentage is computed from the plan prices, not invented', async ({ page }) => {
    await preparePublic(page, 'en')
    await page.goto('/pricing')
    // SAR market: 950/yr against 99/mo → 20%. USD: 190 against 19 → 17%.
    const chip = await page.getByTestId('plan-savings-professional').innerText()
    expect(chip).toMatch(/\b(20|17)%/)
  })

  test('switching to monthly removes every savings badge', async ({ page }) => {
    await preparePublic(page, 'en')
    await page.goto('/pricing')
    await expect(page.getByTestId('plan-savings-professional')).toBeVisible()
    await page.getByRole('button', { name: 'Monthly', exact: true }).click()
    await expect(page.getByTestId('plan-savings-professional')).toHaveCount(0)
    await expect(page.getByTestId('plan-savings-enterprise')).toHaveCount(0)
    await expect(page.getByTestId('plan-billed-annually-professional')).toHaveCount(0)
    // …and the annual-only tier disappears with it.
    await expect(page.getByTestId('plan-actions-lite')).toHaveCount(0)
  })
})

test.describe('pricing · the paid action is primary', () => {
  test('«اشترك الآن» is the first action in the card and pays without an account', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.setViewportSize(PHONE)
    const calls: Array<{ hasCookie: boolean; body: any }> = []
    await page.route(`${API}/api/public/checkout`, async (route) => {
      calls.push({ hasCookie: Boolean(route.request().headers()['cookie']), body: route.request().postDataJSON() })
      await route.fulfill({ json: { url: 'about:blank#checkout', mode: 'checkout', token: 'psu_test' } })
    })
    await page.goto('/pricing')

    const actions = page.getByTestId('plan-actions-professional')
    const buttons = actions.getByRole('button')
    await expect(buttons.first()).toHaveAttribute('data-testid', 'plan-subscribe-professional')
    await expect(buttons.nth(1)).toHaveAttribute('data-testid', 'plan-start-free-professional')

    await page.getByTestId('plan-subscribe-professional').click()
    await expect.poll(() => calls.length).toBeGreaterThan(0)
    expect(calls[0].body.tier).toBe('professional')
    expect(calls[0].body.interval).toBe('year')
    expect(calls[0].hasCookie).toBe(false)
    // No /register detour: the visitor leaves for Stripe, never for a form.
    expect(page.url()).not.toMatch(/\/register/)
  })

  test('the navbar primary leads to the plans, never straight to registration', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.setViewportSize(DESKTOP)
    await page.goto('/features')
    await page.getByTestId('nav-subscribe').click()
    await expect(page).toHaveURL(/\/pricing/)
  })

  test('the phone sticky bar offers BOTH paths, paid first', async ({ page }) => {
    await preparePublic(page, 'ar')
    await page.setViewportSize(PHONE)
    await page.goto('/features')
    await expect(page.getByTestId('sticky-subscribe')).toBeVisible()
    await expect(page.getByTestId('sticky-start-free')).toBeVisible()
    await page.getByTestId('sticky-subscribe').click()
    await expect(page).toHaveURL(/\/pricing/)
  })
})

test.describe('landing · subscribing is visible without hunting', () => {
  for (const [locale, path] of [['ar', '/sa/ar'], ['en', '/us/en']] as const) {
    test(`[${locale}] the pricing block shows a plan, a green savings chip and both actions`, async ({ page }) => {
      await preparePublic(page, locale)
      await page.goto(path)
      const block = page.getByTestId('landing-pricing-block')
      await expect(block).toBeVisible()
      await expect(page.getByTestId('landing-savings-professional')).toBeVisible()
      await expect(page.getByTestId('landing-plan-enterprise')).toBeVisible()
      await expect(page.getByTestId('landing-start-free-professional')).toBeVisible()
      await page.getByTestId('landing-subscribe-professional').click()
      await expect(page).toHaveURL(/\/pricing/)
    })
  }

  test('the savings chip is painted with the savings token, not a Ledger state colour', async ({ page }) => {
    await preparePublic(page, 'en')
    await page.goto('/us/en')
    const colour = await page.getByTestId('landing-savings-professional')
      .evaluate((el) => getComputedStyle(el).color)
    const [r, g, b] = colour.match(/\d+/g)!.map(Number)
    expect(g).toBeGreaterThan(r + 20)
    expect(g).toBeGreaterThan(b + 20)
  })
})
