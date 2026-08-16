import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

test('protected shell uses semantic canvas and neutral inactive navigation', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const shell = page.locator('[data-shell="app"]')
  await expect(shell).toHaveCSS('background-color', 'rgb(247, 249, 252)')
  const contactsIcon = page.getByRole('link', { name: /Contacts/ }).locator('svg')
  await expect(contactsIcon).toHaveCSS('color', 'rgb(95, 107, 122)')
})

test('protected shell remains overflow-free on phone and tablet in both directions', async ({ page }) => {
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    for (const language of ['en', 'ar'] as const) {
      await page.setViewportSize({ width, height })
      await prepareVisualApp(page, language)
      await page.goto('/app')
      await expect(page.getByRole('main')).toBeVisible()
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }))
      expect(dimensions.content, `${language} at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
    }
  }
})
