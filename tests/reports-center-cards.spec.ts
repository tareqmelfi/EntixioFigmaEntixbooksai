import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * Reports center simplification (user direction 2026-08-19): simplified
 * numbers on top, and below it a grid of cards — each card carries the
 * report's representative icon and links straight into the report itself.
 * No preview pane, no duplicate operational charts.
 */

test('reports center renders simplified metrics on top and report cards below', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.goto('/app/reports')

  // Simplified numbers strip
  await expect(page.getByText('إجمالي التقارير')).toBeVisible()

  // Cards link straight into the report (icon + title + one-line purpose)
  const incomeCard = page.getByRole('link', { name: /قائمة الدخل/ }).first()
  await expect(incomeCard).toBeVisible()
  await expect(incomeCard).toHaveAttribute('href', '/app/reports/income-statement')
  const balanceCard = page.getByRole('link', { name: /قائمة المركز المالي/ }).first()
  await expect(balanceCard).toBeVisible()

  // The heavy preview pane and duplicate charts are gone
  await expect(page.getByText('معاينة التقرير')).toHaveCount(0)
  await expect(page.getByText(/آخر 6 أشهر/)).toHaveCount(0)

  // A card navigates to the report
  await incomeCard.click()
  await expect(page).toHaveURL(/\/app\/reports\/income-statement/)
})
