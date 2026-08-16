import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

test('dashboard uses the shared page header and neutral AR/AP surfaces', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.goto('/app')

  const heading = page.getByRole('heading', { name: 'Dashboard' })
  await expect(heading).toBeVisible()
  await expect(heading.locator('xpath=ancestor::header')).toHaveCount(1)

  const receivableSurface = page.getByText('Receivable (AR)', { exact: true }).locator('xpath=../..')
  const payableSurface = page.getByText('Payable (AP)', { exact: true }).locator('xpath=../..')
  await expect(receivableSurface).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(payableSurface).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})
