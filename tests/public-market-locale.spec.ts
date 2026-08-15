import { expect, test } from '@playwright/test'
import {
  localizedPath,
  parsePublicPath,
  PUBLIC_LOCALES,
  PUBLIC_MARKETS,
  PUBLIC_PAGES,
} from '../src/app/public-site-manifest'

test('manifest produces the complete deterministic market and locale matrix', () => {
  expect(PUBLIC_MARKETS).toEqual(['sa', 'us'])
  expect(PUBLIC_LOCALES).toEqual(['ar', 'en'])
  expect(PUBLIC_PAGES.map((page) => page.path)).toEqual([''])
  expect(parsePublicPath('/us/en/pricing')).toBeNull()

  for (const market of PUBLIC_MARKETS) {
    for (const locale of PUBLIC_LOCALES) {
      for (const page of PUBLIC_PAGES) {
        const path = localizedPath(market, locale, page.path)
        expect(parsePublicPath(path)).toEqual({ market, locale, pagePath: page.path })
        expect(path.endsWith('/') && path !== '/').toBe(false)
      }
    }
  }
})

test('neutral root is a chooser and does not silently select stored preferences', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'ar')
    localStorage.setItem('entix-marketing-region', 'SA')
  })
  await page.goto('/')

  await expect(page.locator('main[data-page="market-locale-chooser"]')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('link', { name: /United States.*English/i })).toHaveAttribute('href', '/us/en')
})

test('explicit URL wins synchronously over localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'ar')
    localStorage.setItem('entix-marketing-region', 'SA')
  })
  await page.goto('/us/en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('button', { name: /select country/i })).toContainText('United States')
  await expect(page.getByRole('button', { name: /switch language to arabic/i })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('entix-language'))).toBe('en')
  expect(await page.evaluate(() => localStorage.getItem('entix-marketing-region'))).toBe('US')
})

test('navbar selectors preserve the current page and change one dimension', async ({ page }) => {
  await page.goto('/us/en?source=test')

  await page.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/us\/ar\?source=test$/)

  await page.getByRole('button', { name: /اختيار الدولة|select country/i }).click()
  await page.getByRole('button', { name: /السعودية|Saudi Arabia/i }).click()
  await expect(page).toHaveURL(/\/sa\/ar\?source=test$/)
})

test('browser back and forward keep URL, language, and market synchronized', async ({ page }) => {
  await page.goto('/us/en')
  await page.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/us\/ar$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

  await page.goBack()
  await expect(page).toHaveURL(/\/us\/en$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: /select country/i })).toContainText('United States')

  await page.getByRole('button', { name: /select country/i }).click()
  await page.getByRole('button', { name: /Saudi Arabia/i }).click()
  await expect(page).toHaveURL(/\/sa\/en$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/us\/en$/)
  await expect(page.getByRole('button', { name: /select country/i })).toContainText('United States')
})

test('US English rendered document contains no Arabic or Saudi-only concepts', async ({ page }) => {
  for (const publicPage of PUBLIC_PAGES) {
    const route = localizedPath('us', 'en', publicPage.path)
    await page.goto(route)
    const documentText = await page.locator('html').innerText()
    expect(documentText, route).not.toMatch(/[\u0600-\u06ff]/)
    expect(documentText, route).not.toMatch(/\b(?:ZATCA|SAR|Saudi VAT|GOSI|Mudad|Mada)\b/i)
    await expect(page.locator('body')).toContainText(/Plaid.*Beta|Beta.*Plaid/i)
  }
})
