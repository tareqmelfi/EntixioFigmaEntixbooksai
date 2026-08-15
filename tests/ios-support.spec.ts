import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
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
    await expect(main.locator('[data-section]')).toHaveCount(7)
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

  test('offers clearly labeled synthetic sample downloads in English and Arabic', async ({ page, request }) => {
    const samples = [
      {
        href: '/app-review-samples/entix-synthetic-app-review-receipt.png',
        english: 'Download synthetic receipt (PNG)',
        arabic: 'تنزيل الإيصال الاصطناعي (PNG)',
      },
      {
        href: '/app-review-samples/entix-synthetic-app-review-receipt.jpg',
        english: 'Download synthetic receipt (JPG)',
        arabic: 'تنزيل الإيصال الاصطناعي (JPG)',
      },
      {
        href: '/app-review-samples/entix-synthetic-app-review-receipt-searchable.pdf',
        english: 'Download searchable synthetic receipt (PDF)',
        arabic: 'تنزيل الإيصال الاصطناعي القابل للبحث (PDF)',
      },
    ]

    await setLanguage(page, 'en')
    await page.goto('/support/ios')
    const main = page.locator('main[data-page="support-ios"]')
    await expect(main.locator('[data-section="app-review-samples"]')).toContainText('SYNTHETIC APP REVIEW SAMPLE — NOT A REAL TRANSACTION')

    for (const sample of samples) {
      const link = main.locator(`a[href="${sample.href}"]`)
      await expect(link).toHaveAttribute('download', /entix-synthetic-app-review-receipt/)
      await expect(link).toHaveAttribute('aria-label', sample.english)
      const response = await request.get(sample.href)
      expect(response.status(), sample.href).toBe(200)
    }

    await page.getByRole('button', { name: 'Switch language to Arabic' }).click()
    await expect(main.locator('[data-section="app-review-samples"]')).toContainText('عينة اصطناعية لمراجعة التطبيق — ليست معاملة حقيقية')
    for (const sample of samples) {
      await expect(main.locator(`a[href="${sample.href}"]`)).toHaveAttribute('aria-label', sample.arabic)
    }
  })

  test('publishes valid deterministic synthetic assets, hashes, and searchable PDF text', async () => {
    const sampleDir = path.join(projectRoot, 'public/app-review-samples')
    const filenames = [
      'entix-synthetic-app-review-receipt.png',
      'entix-synthetic-app-review-receipt.jpg',
      'entix-synthetic-app-review-receipt-searchable.pdf',
    ]
    const expectedDimensions = Buffer.from([0, 0, 6, 64, 0, 0, 8, 152])
    const png = await readFile(path.join(sampleDir, filenames[0]))
    const jpg = await readFile(path.join(sampleDir, filenames[1]))
    const pdf = await readFile(path.join(sampleDir, filenames[2]))

    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(png.subarray(16, 24)).toEqual(expectedDimensions)
    expect(jpg.subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]))
    expect(jpegDimensions(jpg)).toEqual({ width: 1600, height: 2200 })
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pdf.includes(Buffer.from('/ToUnicode'))).toBe(true)
    expect(pdf.includes(Buffer.from('/Font'))).toBe(true)

    const manifest = await readFile(path.join(sampleDir, 'SHA256SUMS.txt'), 'utf8')
    const readme = await readFile(path.join(sampleDir, 'README.txt'), 'utf8')
    for (const filename of filenames) {
      const data = await readFile(path.join(sampleDir, filename))
      const hash = createHash('sha256').update(data).digest('hex')
      expect(manifest).toContain(`${hash}  ${filename}`)
    }
    expect(readme).toContain('SYNTHETIC APP REVIEW SAMPLE — NOT A REAL TRANSACTION')
    expect(readme).toContain('No real PII, account details, VAT/CR identifiers, or bank data')
    expect(readme).toContain('1600 × 2200')
    expect(readme).toContain('searchable text layer')

    const sitemap = await readFile(path.join(projectRoot, 'public/sitemap.xml'), 'utf8')
    const worker = await readFile(path.join(projectRoot, 'worker.js'), 'utf8')
    expect(sitemap).not.toContain('/app-review-samples/')
    expect(worker).toContain("pathname.startsWith('/app-review-samples/')")
    expect(worker).toContain("'content-disposition'")
    expect(worker).toContain("'x-robots-tag', 'noindex, nofollow, noarchive'")
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

function jpegDimensions(buffer: Buffer) {
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error('Invalid JPEG marker')
    const marker = buffer[offset + 1]
    offset += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    const length = buffer.readUInt16BE(offset)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) }
    }
    offset += length
  }
  throw new Error('JPEG dimensions not found')
}

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
  const worker = await readFile(path.join(projectRoot, 'worker.js'), 'utf8')
  expect(routes).toContain('path: "/support/ios"')
  expect(prerender).toContain("'/support/ios'")
  expect(audit).toContain('route("/support/ios"')
  expect(sitemap).toContain('<loc>https://entix.io/support/ios</loc>')
  expect(worker).toMatch(/MARKETING_ROUTES[\s\S]*['"]\/support\/ios['"]/)

  await page.goto('/support/ios')
  await expect(page).toHaveTitle(/iOS Support.*ENTIX\.IO/i)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://entix.io/support/ios')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /iPhone.*iPad.*iOS 17/i)
})
