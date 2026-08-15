import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const captchaToken = 'turnstile-test-token'

async function installTurnstileMock(page: Page) {
  await page.addInitScript(() => {
    const state = { options: {} as Record<string, (...args: unknown[]) => void>, resetCount: 0 }
    ;(window as any).__turnstileTest = state
    ;(window as any).turnstile = {
      render(element: HTMLElement, options: Record<string, (...args: unknown[]) => void>) {
        state.options = options
        element.dataset.testid = 'turnstile-host'
        element.textContent = 'Turnstile test widget'
        return 'test-widget'
      },
      reset() {
        state.resetCount += 1
      },
      remove() {},
    }
  })
}

async function mockPublicAuth(page: Page) {
  await page.route('https://api.entix.io/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth-providers') {
      await route.fulfill({ json: { emailPassword: true, google: false, microsoft: false } })
      return
    }
    if (url.pathname === '/api/auth/get-session') {
      await route.fulfill({ status: 401, json: { user: null } })
      return
    }
    await route.fallback()
  })
}

async function solveCaptcha(page: Page, token = captchaToken) {
  await page.evaluate(value => (window as any).__turnstileTest.options.callback(value), token)
}

async function triggerCaptcha(page: Page, callback: string) {
  await page.evaluate(name => (window as any).__turnstileTest.options[name](), callback)
}

test.describe('public auth CAPTCHA lifecycle', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('entix-language', 'en')
      localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
        v: 1,
        choice: 'essential',
        analytics: false,
        marketing: false,
        at: '2026-08-14T00:00:00.000Z',
      }))
    })
    if (!testInfo.title.includes('script load failure')) await installTurnstileMock(page)
    await mockPublicAuth(page)
  })

  test('login blocks submission until solved, sends the token header, and resets after failed auth', async ({ page }) => {
    let submittedHeader: string | undefined
    await page.route('https://api.entix.io/api/auth/sign-in/email', async route => {
      submittedHeader = route.request().headers()['x-captcha-response']
      await route.fulfill({ status: 401, json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid credentials' } })
    })

    await page.goto('/login')
    const submit = page.locator('button[type="submit"]')
    await expect(page.locator('[data-testid="turnstile-host"]')).toBeVisible()
    await expect(submit).toBeDisabled()

    await solveCaptcha(page)
    await expect(submit).toBeEnabled()
    await page.fill('input[type="email"]', 'person@example.com')
    await page.fill('input[type="password"]', 'wrong-password')
    await submit.click()

    await expect(page.locator('.text-red-700').first()).toBeVisible()
    expect(submittedHeader).toBe(captchaToken)
    await expect(submit).toBeDisabled()
    await expect.poll(() => page.evaluate(() => (window as any).__turnstileTest.resetCount)).toBe(1)
  })

  test('register and forgot-password block until solved and reset tokens after failed requests', async ({ page }) => {
    const headers: Array<string | undefined> = []
    await page.route('https://api.entix.io/api/auth/sign-up/email', async route => {
      headers.push(route.request().headers()['x-captcha-response'])
      await route.fulfill({ status: 400, json: { message: 'Registration failed' } })
    })
    await page.route('https://api.entix.io/api/auth/request-password-reset', async route => {
      headers.push(route.request().headers()['x-captcha-response'])
      await route.fulfill({ status: 500, json: { message: 'Reset failed' } })
    })

    await page.goto('/register')
    let submit = page.locator('button[type="submit"]')
    await expect(submit).toBeDisabled()
    await solveCaptcha(page)
    await expect(submit).toBeEnabled()
    await page.fill('input[type="text"]', 'Test')
    await page.locator('input[type="text"]').nth(1).fill('User')
    await page.fill('input[type="email"]', 'person@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.locator('#terms').check()
    await submit.click()
    await expect(submit).toBeDisabled()
    await expect.poll(() => page.evaluate(() => (window as any).__turnstileTest.resetCount)).toBe(1)

    await page.goto('/forgot-password')
    await page.evaluate(() => { (window as any).__turnstileTest.resetCount = 0 })
    submit = page.locator('button[type="submit"]')
    await expect(submit).toBeDisabled()
    await solveCaptcha(page)
    await page.fill('input[type="email"]', 'person@example.com')
    await submit.click()
    await expect(submit).toBeDisabled()
    await expect.poll(() => page.evaluate(() => (window as any).__turnstileTest.resetCount)).toBe(1)
    expect(headers).toEqual([captchaToken, captchaToken])
  })

  test('script load failure stays failed and Retry loads a fresh solvable widget', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as any).turnstile
      delete (window as any).__turnstileScriptPromise
    })
    let scriptRequests = 0
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async route => {
      scriptRequests += 1
      if (scriptRequests === 1) {
        await route.abort('failed')
        return
      }
      await route.fulfill({
        contentType: 'application/javascript',
        body: `window.turnstile = {
          render: function (element, options) {
            window.__retryTurnstileOptions = options;
            element.textContent = 'Retried Turnstile widget';
            return 'retry-widget';
          },
          reset: function () {},
          remove: function () {}
        };`,
      })
    })

    await page.goto('/login')
    await expect(page.locator('[data-testid="captcha-error"]')).toBeVisible()
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('Retried Turnstile widget')).toBeVisible()
    await page.evaluate(value => (window as any).__retryTurnstileOptions.callback(value), captchaToken)
    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('expired CAPTCHA immediately disables login submission', async ({ page }) => {
    await page.goto('/login')
    const submit = page.locator('button[type="submit"]')
    await solveCaptcha(page)
    await expect(submit).toBeEnabled()

    await triggerCaptcha(page, 'expired-callback')
    await expect(submit).toBeDisabled()
  })

  test('widget error, timeout, and unsupported callbacks stay visible with localized retry', async ({ page }) => {
    await page.goto('/login')

    for (const callback of ['error-callback', 'timeout-callback', 'unsupported-callback']) {
      await triggerCaptcha(page, callback)
      const failure = page.locator('[data-testid="captcha-error"]')
      await expect(failure).toBeVisible()
      await expect(failure).toContainText('Security verification failed. Please try again.')
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
      await page.getByRole('button', { name: 'Retry' }).click()
      await expect(failure).toBeHidden()
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    }

    await page.getByRole('button', { name: 'العربية' }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__turnstileTest.options.language)).toBe('ar')
    await triggerCaptcha(page, 'error-callback')
    await expect(page.locator('[data-testid="captcha-error"]')).toContainText('تعذر التحقق الأمني. يرجى المحاولة مرة أخرى.')
    await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible()
  })
})
