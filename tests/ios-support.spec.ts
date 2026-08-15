import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const forbiddenClaims = [
  /ZATCA/i,
  /Plaid/i,
  /certified|compliant|compliance/i,
  /checkout|subscribe|pricing/i,
]

async function setLanguage(page: import('@playwright/test').Page, language: 'ar' | 'en') {
  await page.addInitScript((value) => localStorage.setItem('entix-language', value), language)
}

test.describe('/support/ios', () => {
  test('is a substantive public iOS support page without placeholders or unsupported claims', async ({ page }) => {
    await setLanguage(page, 'en')
    await page.goto('/support/ios')

    const main = page.locator('main[data-page="support-ios"]')
    await expect(main).toBeVisible()
    await expect(main).toContainText('ENTIX.IO for iOS Support')
    await expect(main).toContainText('iOS 17 or later')
    await expect(main).toContainText('iPhone and iPad')
    await expect(main).toContainText('support@entix.io')
    await expect(main.locator('[data-section]')).toHaveCount(6)
    expect((await main.innerText()).length).toBeGreaterThan(1200)

    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/coming soon|private QA|placeholder/i)
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
    expect(text).not.toMatch(/\+\d[\d\s().-]{6,}/)
    for (const claim of forbiddenClaims) expect(await main.innerText()).not.toMatch(claim)
    await expect(main.locator('a[href*="checkout"], a[href*="pricing"], a[href*="subscribe"]')).toHaveCount(0)
  })

  test('covers login recovery, permissions, AI/OCR, current-build deletion, and privacy help', async ({ page }) => {
    await setLanguage(page, 'en')
    await page.goto('/support/ios')
    const main = page.locator('main[data-page="support-ios"]')

    await expect(main).toContainText('Forgot password')
    await expect(main).toContainText('Settings > Privacy & Security')
    await expect(main).toContainText('Camera')
    await expect(main).toContainText('Photos')
    await expect(main).toContainText('Files')
    await expect(main).toContainText('AI and OCR')
    await expect(main).toContainText('review before saving')
    await expect(main).toContainText('iOS build 22 or later')
    await expect(main).toContainText('type the exact email address')
    await expect(main).toContainText('signed out on all devices')
    await expect(main).toContainText('30-day recovery period')
    await expect(main).toContainText('legal retention')
    await expect(main.locator('a[href="/privacy"]').first()).toBeVisible()
    await expect(main.locator('a[href="/app/system-status"], a[href="/status"]')).toHaveCount(0)
    await expect(main).not.toContainText('System status')
    await expect(main.locator('a[href="mailto:support@entix.io"]').first()).toBeVisible()
  })

  test('switches between complete English LTR and Arabic RTL content', async ({ page }) => {
    await setLanguage(page, 'en')
    await page.goto('/support/ios')
    const main = page.locator('main[data-page="support-ios"]')
    await expect(main).toHaveAttribute('dir', 'ltr')
    await expect(main).toContainText('Sign in and password help')

    await page.getByRole('button', { name: 'Switch language to Arabic' }).click()
    await expect(main).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(main).toContainText('دعم ENTIX.IO لنظام iOS')
    await expect(main).toContainText('تسجيل الدخول واستعادة كلمة المرور')
    await expect(main).toContainText('فترة استرداد مدتها 30 يوماً')
    await expect(main).toContainText('support@entix.io')
    expect((await main.innerText()).length).toBeGreaterThan(900)
  })

  test('does not overflow horizontally on an iPhone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setLanguage(page, 'ar')
    await page.goto('/support/ios')
    await expect(page.locator('main[data-page="support-ios"]')).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  })
})

test('privacy policy preserves ENSIDEX ownership and accurate iOS disclosures', async ({ page }) => {
  await setLanguage(page, 'en')
  await page.goto('/privacy')
  const main = page.locator('main[data-page="privacy"]')
  await expect(main).toBeVisible()
  await expect(main).toContainText('owned, operated, and powered by ENSIDEX LLC')
  await expect(main).toContainText('Wyoming, USA')
  await expect(main).not.toContainText('Spec Pros')
  await expect(main).not.toContainText('سبيك بروز')
  await expect(main).not.toContainText('3400010090')
  await expect(main).toContainText('iOS app')
  await expect(main).toContainText('camera')
  await expect(main).toContainText('photo library')
  await expect(main).toContainText('Files picker')
  await expect(main).toContainText('name, email address, and user ID')
  await expect(main).toContainText('organization financial records')
  await expect(main).toContainText('AI prompts')
  await expect(main).toContainText('OpenRouter and model providers')
  await expect(main).toContainText('iOS build 22 or later')
  await expect(main).toContainText('type the exact account email address')
  await expect(main).toContainText('30-day recovery period')
  await expect(main).toContainText('legal, tax, accounting, security, or dispute')
  await expect(main).toContainText('do not sell personal information')
  await expect(main).toContainText('do not use the iOS app for cross-app tracking')
  expect(await main.innerText()).not.toMatch(/private QA|Anthropic|Claude|OpenAI|GPT|Gemini/i)
})

test('route, footer, sitemap, prerender, and canonical metadata include iOS support', async ({ page }) => {
  await setLanguage(page, 'en')
  await page.goto('/privacy')
  await expect(page.locator('footer a[href="/support/ios"]').first()).toBeVisible()
  await expect(page.locator('footer a[href="/help"]')).toBeVisible()

  const routes = await readFile(path.join(projectRoot, 'src/app/routes.tsx'), 'utf8')
  const prerender = await readFile(path.join(projectRoot, 'scripts/prerender.mjs'), 'utf8')
  const audit = await readFile(path.join(projectRoot, 'scripts/qa-route-audit.mjs'), 'utf8')
  const sitemap = await readFile(path.join(projectRoot, 'public/sitemap.xml'), 'utf8')
  expect(routes).toContain('path: "/support/ios"')
  expect(prerender).toContain("'/support/ios'")
  expect(audit).toContain('route("/support/ios"')
  expect(sitemap).toContain('<loc>https://entix.io/support/ios</loc>')

  await page.goto('/support/ios')
  await expect(page).toHaveTitle(/iOS Support.*ENTIX\.IO/i)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://entix.io/support/ios')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /iPhone.*iPad.*iOS 17/i)
})
