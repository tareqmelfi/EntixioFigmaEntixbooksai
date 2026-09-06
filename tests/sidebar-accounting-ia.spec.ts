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

test('المحاسبة is a money-flow group with the key ledgers one click away (Ledger IA 2026-09)', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.goto('/app')

  const nav = page.locator('nav').first()
  // Labelled groups collapse (Ledger pixel pass 2026-09): the group label is a
  // button, and «المحاسبة» is closed by default — open it, then its ledgers are
  // one click away.
  const accounting = nav.getByRole('button', { name: 'المحاسبة' })
  await expect(accounting).toBeVisible()
  await expect(accounting).toHaveAttribute('aria-expanded', 'false')
  await accounting.click()
  await expect(accounting).toHaveAttribute('aria-expanded', 'true')
  for (const target of ['دليل الحسابات', 'القيود اليومية', 'الفترات المالية', 'الأصول الثابتة']) {
    await expect(nav.getByRole('link', { name: target })).toBeVisible()
  }
  // Customers and suppliers are the same contacts model behind two doors —
  // «المشتريات» is one of the two groups that stay open by default.
  await nav.getByRole('link', { name: 'الموردون' }).click()
  await expect(page).toHaveURL(/\/app\/contacts\?role=supplier/)
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

  // التقارير renders AFTER the المحاسبة group in document order
  const accountingPos = await nav.getByRole('button', { name: 'المحاسبة' }).first().evaluate((el) => el.getBoundingClientRect().top)
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
