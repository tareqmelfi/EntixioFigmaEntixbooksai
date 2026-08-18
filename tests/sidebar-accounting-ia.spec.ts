import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * Sidebar information architecture (user direction 2026-08-18):
 *  1. «المحاسبة» must NAVIGATE to an accounting home (it was a pathless
 *     parent — clicking it felt stuck on the item above).
 *  2. «التقارير» is the LAST main-list item; the «للمطورين» group leaves the
 *     sidebar; «برنامج الشركاء» leaves too (it's a settings-level tool, the
 *     client kept thinking it was part of their own books).
 *  3. Integrations/Templates/Partners live inside Settings → «الأدوات».
 */

test('المحاسبة navigates to the accounting home with the key ledgers one click away', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.goto('/app')

  await page.getByRole('button', { name: 'المحاسبة', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/accounting/)

  // Accounting home exposes the accountant's core destinations
  await expect(page.getByRole('heading', { name: 'المحاسبة' })).toBeVisible()
  for (const target of ['شجرة الحسابات', 'القيود اليدوية', 'الإقرار الضريبي', 'الفترات المالية', 'تسوية البنوك']) {
    await expect(page.getByRole('link', { name: new RegExp(target) }).first()).toBeVisible()
  }
})

test('التقارير is the last main item; للمطورين and برنامج الشركاء leave the sidebar', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.goto('/app')

  // The sidebar renders twice (pinned static + mobile overlay) — scope to the
  // visible pinned one.
  const nav = page.locator('nav').first()
  await expect(nav.getByRole('link', { name: 'التقارير' })).toBeVisible()
  await expect(nav.getByText('للمطورين')).toHaveCount(0)
  await expect(nav.getByText('برنامج الشركاء')).toHaveCount(0)
  await expect(nav.getByText('التكاملات')).toHaveCount(0)
  await expect(nav.getByText('القوالب')).toHaveCount(0)

  // التقارير renders AFTER المحاسبة section in document order
  const accountingPos = await nav.getByText('للمحاسب').first().evaluate((el) => el.getBoundingClientRect().top)
  const reportsPos = await nav.getByRole('link', { name: 'التقارير' }).first().evaluate((el) => el.getBoundingClientRect().top)
  expect(reportsPos).toBeGreaterThan(accountingPos)
})

test('settings «الأدوات» tab hosts integrations, templates, and the partners program', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.goto('/app/settings')

  await page.getByRole('button', { name: /الأدوات/ }).click()
  for (const name of ['التكاملات', 'القوالب', 'برنامج الشركاء']) {
    await expect(page.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible()
  }
})
