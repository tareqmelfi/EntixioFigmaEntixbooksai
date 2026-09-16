import { expect, test } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'

for (const language of ['en', 'ar'] as const) {
  test(`all levels load expanded; deep search survives collapse (${language})`, async ({ page }) => {
    await prepareVisualApp(page, language)
    const items = [
      ['a', '1', null, 'Assets', 'الأصول'],
      ['b', '10', 'a', 'Banks', 'البنوك'],
      ['c', '1010', 'b', 'Operating bank', 'بنك التشغيل'],
      ['d', '10101', 'c', 'Deep account', 'الحساب التفصيلي'],
      ['e', '10102', 'c', 'Other account', 'حساب آخر'],
    ].map(([id, code, parentId, name, nameAr]) => ({ id, code, parentId, name, nameAr, orgId: visualOrgId, type: 'ASSET', balance: 0, isActive: true }))
    let release!: () => void
    const ready = new Promise<void>(resolve => { release = resolve })
    await page.route('https://api.entix.io/api/accounts', async route => {
      await ready
      await route.fulfill({ json: { items, total: items.length } })
    })
    await page.goto('/app/chart-of-accounts?__qa_auth=1')
    release()
    const hide = language === 'ar' ? 'إخفاء التفاصيل' : 'Hide details'
    const show = language === 'ar' ? 'إظهار التفاصيل' : 'Show details'
    const shown = language === 'ar' ? 'حساب معروض' : 'accounts shown'
    const search = page.getByPlaceholder(language === 'ar' ? 'بحث بالاسم أو الرمز...' : 'Search by name or code...')
    await expect(page.getByRole('button', { name: '10101', exact: true })).toBeVisible()
    await expect(page.getByText(`5 ${shown}`, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: hide, exact: true }).click()
    await expect(page.getByRole('button', { name: '10101', exact: true })).toHaveCount(0)
    await expect(page.getByText(`1 ${shown}`, { exact: true })).toBeVisible()
    await search.fill(language === 'ar' ? 'الحساب التفصيلي' : 'Deep account')
    await expect(page.getByRole('button', { name: '10101', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '10102', exact: true })).toHaveCount(0)
    await expect(page.getByText(`4 ${shown}`, { exact: true })).toBeVisible()
    await search.fill('')
    await expect(page.getByRole('button', { name: '10101', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: show, exact: true }).click()
    await expect(page.getByRole('button', { name: '10102', exact: true })).toBeVisible()
    await page.getByRole('button', { name: `${hide} · 1010`, exact: true }).click()
    await expect(page.getByRole('button', { name: '10101', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: show, exact: true }).click()
    await expect(page.getByRole('button', { name: '10101', exact: true })).toBeVisible()
    await page.screenshot({ path: `test-results/coa-details-${language}.png`, fullPage: true })
  })
}
