import { expect, test } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'

for (const language of ['ar', 'en'] as const) test(`automatic dues lifecycle, filters and refresh failure (${language})`, async ({ page }) => {
  await prepareVisualApp(page, language)
  let paid = 25, fail = false
  await page.route('https://api.entix.io/api/reports/dues-settlements*', route => {
    if (fail) return route.fulfill({ status: 500, json: { error: 'test_failure' } })
    const row = (id: string, currency: string, amount: number) => ({ id, label: id, values: { label: id, currency, total: 100, paid: amount, remaining: 100 - amount }, link: { label: id, href: `/app/invoices/${id}`, type: 'invoice' } })
    const columns = [{ key: 'label', label: 'المستند␟Document' }, { key: 'currency', label: 'العملة␟Currency' }, { key: 'paid', label: 'مدفوع␟Paid', kind: 'number' }, { key: 'remaining', label: 'المتبقي␟Remaining', kind: 'number' }]
    return route.fulfill({ json: { id: 'dues-settlements', title: 'المستحقات', englishTitle: 'Dues', description: 'حالي␟Current', category: 'financial', status: 'live', generatedAt: new Date().toISOString(), period: { from: null, to: '2026-10-03', allTime: true }, currency: 'SAR', org: { id: visualOrgId, name: 'Test Company', paymentSettings: null }, summary: {}, notices: [], sections: [
      { id: 'receivable', title: 'مستحق لي␟Due to us', columns, rows: paid < 100 ? [row('OLD-SALE', 'SAR', paid), row('FOREIGN-SALE', 'USD', 0)] : [row('FOREIGN-SALE', 'USD', 0)] },
      { id: 'payable', title: 'مستحق عليّ␟Due by us', columns, rows: [row('BILL', 'SAR', 0)] },
      { id: 'settled-sales', title: 'مبيعات مسددة␟Settled sales', columns, rows: paid === 100 ? [row('OLD-SALE', 'SAR', paid)] : [] },
    ] } })
  })
  await page.goto('/app/reports/dues-settlements?view=receivable')
  await expect(page.getByRole('button', { name: 'OLD-SALE', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '75', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'BILL', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: language === 'ar' ? 'العملة' : 'Currency', exact: true }).selectOption('SAR')
  await expect(page.getByRole('button', { name: 'FOREIGN-SALE', exact: true })).toHaveCount(0)
  paid = 100
  await page.getByRole('button', { name: language === 'ar' ? 'تحديث' : 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'OLD-SALE', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: language === 'ar' ? 'مبيعات مسددة' : 'Settled sales', exact: true }).click()
  await expect(page.getByRole('button', { name: 'OLD-SALE', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '0', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: language === 'ar' ? 'طباعة التقرير الكامل' : 'Print full report' })).toBeEnabled()
  fail = true
  await page.getByRole('button', { name: language === 'ar' ? 'تحديث' : 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('report-data-table')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled()
  fail = false; paid = 0
  await page.getByRole('button', { name: language === 'ar' ? 'تحديث' : 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: language === 'ar' ? 'مستحق لي' : 'Due to us', exact: true }).click()
  await expect(page.getByRole('button', { name: 'OLD-SALE', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '100', exact: true })).toBeVisible()
})
