import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

test('dashboard uses the shared page header and neutral AR/AP surfaces', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.goto('/app')

  const heading = page.getByRole('heading', { name: 'Dashboard' })
  await expect(heading).toBeVisible()
  await expect(heading.locator('xpath=ancestor::header')).toHaveCount(1)

  // AR/AP links sit inside the shared neutral financial panel.
  const receivableRow = page.getByText('Receivable (AR)', { exact: true }).locator('xpath=..')
  const payableRow = page.getByText('Payable (AP)', { exact: true }).locator('xpath=..')
  await expect(receivableRow).toHaveClass(/\bborder-border\b/)
  await expect(payableRow).toHaveClass(/\bborder-border\b/)
  await expect(page.getByTestId('current-balances')).toHaveCSS('background-color', 'rgb(255, 253, 249)')
})
