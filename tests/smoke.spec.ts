/**
 * Smoke tests · verify critical flows work end-to-end
 * Run: npx playwright test
 */
import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/entix/i)
    // Landing nav uses buttons with navigate() (not <a href>) · accept either
    await expect(page.locator('a[href="/login"], button:has-text("تسجيل الدخول"), button:has-text("Sign in")').first()).toBeVisible()
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
    await expect(page.getByText(/باقة/i).first()).toBeVisible()
  })
})

test.describe('Auth Flow', () => {
  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@nonexistent.com')
    await page.fill('input[type="password"]', 'wrongpassword123')
    await page.click('button[type="submit"]')
    await expect(page.locator('.text-red-700, .bg-red-50').first()).toBeVisible({ timeout: 10000 })
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