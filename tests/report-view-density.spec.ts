import { expect, test } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'

/**
 * Report density toggle (user ask 2026-08-19 — Wave-style): the statement
 * opens on its main sections (ملخص); one button expands the full account tree
 * (تفصيل كامل) and the choice persists.
 */

const org = {
  id: visualOrgId, name: 'شركة ابداع بدون حدود', legalName: null, country: 'SA', baseCurrency: 'SAR',
  vatNumber: '314807604900003', crNumber: null, logoUrl: null, printLogoUrl: null, stampUrl: null,
  defaultInvoiceLanguage: 'ar', addressLine: null, city: null, region: null, postalCode: null,
  email: null, phone: null, website: null, paymentSettings: null,
}

const reportPayload = {
  id: 'income-statement',
  title: 'قائمة الدخل',
  englishTitle: 'Income Statement',
  description: 'إيرادات ومصاريف وصافي ربح الشركة خلال الفترة.',
  category: 'financial',
  status: 'live',
  generatedAt: '2026-08-19T10:00:00.000Z',
  period: { from: '2026-01-01', to: '2026-08-19' },
  currency: 'SAR',
  org,
  summary: {},
  sections: [
    {
      id: 'income-summary',
      title: 'ملخص قائمة الدخل',
      columns: [{ key: 'label', label: 'البند' }, { key: 'amount', label: 'القيمة', align: 'end', kind: 'money' }],
      rows: [
        { id: 'revenue', label: 'الإيرادات', values: { label: 'الإيرادات', amount: 12339.99 } },
        { id: 'expenses', label: 'المصروفات', values: { label: 'المصروفات', amount: 12273.31 } },
        { id: 'net-income', label: 'صافي الربح / الخسارة', values: { label: 'صافي الربح / الخسارة', amount: 66.68 } },
      ],
    },
    {
      id: 'income-ledger-detail',
      title: 'تفصيل قائمة الدخل حسب الحساب',
      columns: [{ key: 'label', label: 'البند' }, { key: 'amount', label: 'القيمة', align: 'end', kind: 'money' }],
      rows: [
        { id: 'rev-42000', label: '42000 · المبيعات', values: { label: '42000 · المبيعات', amount: 12339.99 } },
      ],
    },
  ],
}

test('income statement opens in summary mode with the equation strip; تفصيل كامل expands the account tree', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.route('https://api.entix.io/api/reports/income-statement*', (route) => route.fulfill({ json: reportPayload }))

  await page.goto('/app/reports/income-statement')

  // Wave-style equation visible immediately: revenue − expenses = net
  await expect(page.getByText('12,339.99 SAR').first()).toBeVisible()
  await expect(page.getByText('66.68 SAR').first()).toBeVisible()

  // Summary mode: per-account detail hidden, toggle offered
  await expect(page.getByText('تفصيل قائمة الدخل حسب الحساب')).toHaveCount(0)
  await page.getByRole('button', { name: /تفصيل كامل/ }).click()
  await expect(page.getByText('تفصيل قائمة الدخل حسب الحساب')).toBeVisible()
  await expect(page.getByText('42000 · المبيعات')).toBeVisible()

  // Choice persists across a reload
  await page.reload()
  await expect(page.getByText('تفصيل قائمة الدخل حسب الحساب')).toBeVisible()
})
