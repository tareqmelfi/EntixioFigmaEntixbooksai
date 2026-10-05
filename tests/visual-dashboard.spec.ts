import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

test('dashboard uses the shared page header and neutral AR/AP surfaces', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.goto('/app')

  const heading = page.getByRole('heading', { name: 'Dashboard' })
  await expect(heading).toBeVisible()
  await expect(heading.locator('xpath=ancestor::header')).toHaveCount(1)

  // Current figures preserve the approved ink-ruled ledger strip, without filled cards.
  const receivableRow = page.getByTestId('overview-receivables')
  const payableRow = page.getByTestId('overview-payables')
  await expect(receivableRow).toHaveClass(/\bborder-border\b/)
  await expect(payableRow).toHaveClass(/\bborder-border\b/)
  await expect(page.getByTestId('overview-receivables')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})
