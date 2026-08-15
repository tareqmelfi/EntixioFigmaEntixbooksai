/**
 * Smoke tests · verify critical flows work end-to-end
 * Run: npx playwright test
 */
import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test('neutral chooser and explicit market landing load', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/entix/i)
    await expect(page.locator('main[data-page="market-locale-chooser"]')).toBeVisible()
    await expect(page.locator('a[href="/us/en"]')).toBeVisible()

    await page.goto('/us/en')
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('Cloud accounting for US businesses')).toBeVisible()
    await expect(page.locator('a[href="/login"], button:has-text("Sign in")').first()).toBeVisible()
  })

  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('register page renders', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing')
    // Vite dev compiles lazy routes on first hit · allow a generous budget.
    // Locale follows the browser default · match both AR and EN copy.
    await expect(page.getByText(/باقة|plan/i).first()).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Auth Flow', () => {
  test('invalid login shows error', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
        v: 1, choice: 'essential', analytics: false, marketing: false, at: new Date().toISOString(),
      }))
      ;(window as any).turnstile = {
        render(_element: HTMLElement, options: Record<string, (...args: unknown[]) => void>) {
          ;(window as any).__turnstileOptions = options
          return 'smoke-widget'
        },
        reset() {},
        remove() {},
      }
    })
    await page.route('https://api.entix.io/api/auth/sign-in/email', route =>
      route.fulfill({ status: 401, json: { message: 'Invalid credentials' } }),
    )
    await page.goto('/login')
    await page.evaluate(() => (window as any).__turnstileOptions.callback('smoke-token'))
    await page.fill('input[type="email"]', 'test@nonexistent.com')
    await page.fill('input[type="password"]', 'wrongpassword123')
    await page.press('input[type="password"]', 'Enter')
    await expect(page.locator('.text-red-700, .bg-red-50').first()).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Protected Routes · Redirect', () => {
  test('/app redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/app')
    await page.waitForURL(/\/login/, { timeout: 10000 })
  })

  test('/app/dashboard redirects to login', async ({ page }) => {
    await page.goto('/app/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10000 })
  })
})

test.describe('App Shell · Authenticated', () => {
  // NOTE: These tests require a valid session. They'll be skipped in CI
  // unless TEST_EMAIL and TEST_PASSWORD env vars are set.
  test('authenticated dashboard loads', async ({ page }) => {
    const email = process.env.TEST_EMAIL
    const password = process.env.TEST_PASSWORD
    if (!email || !password) {
      test.skip(true, 'TEST_EMAIL and TEST_PASSWORD not set')
      return
    }

    await page.goto('/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/app', { timeout: 15000 })
    await expect(page.locator('h1').first()).toBeVisible()
  })
})