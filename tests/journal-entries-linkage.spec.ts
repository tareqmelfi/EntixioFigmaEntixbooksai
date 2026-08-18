import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * Ledger linkage (user ask 2026-08-19 — «القيود يجب أن تكون واضحة كالمستندات
 * وكل شي مترابط»):
 *  1. a coverage banner proves every posted document carries its entry —
 *     or names the gaps;
 *  2. an auto entry's reference is a LINK to the source document.
 */

const ENTRY = {
  id: 'je-1',
  number: 'JE-00001',
  date: '2026-08-10T00:00:00.000Z',
  description: 'Invoice INV-2026-0041 · شركة سبيك بروز',
  reference: 'inv-41',
  source: 'invoice',
  status: 'POSTED',
  totalDebit: 1150,
  totalCredit: 1150,
  lines: [
    { accountCode: '11000', accountName: 'الذمم المدينة', debit: 1150, credit: 0, description: null },
    { accountCode: '42000', accountName: 'المبيعات', debit: 0, credit: 1000, description: null },
    { accountCode: '21000', accountName: 'ضريبة القيمة المضافة', debit: 0, credit: 150, description: null },
  ],
  attachments: [],
}

test('journal page proves linkage (coverage banner) and links an entry to its source document', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.route('https://api.entix.io/api/journals/coverage', (route) =>
    route.fulfill({ json: { unposted: { invoices: 0, bills: 2, expenses: 0, receipts: 0, payments: 0 }, linked: false } }),
  )
  await page.route('https://api.entix.io/api/journals', (route) => route.fulfill({ json: { items: [ENTRY], total: 1 } }))
  await page.route('https://api.entix.io/api/journals/je-1', (route) => route.fulfill({ json: { ...ENTRY, canEdit: false, canPost: false, canUnpost: false } }))
  await page.route('https://api.entix.io/api/journals/je-1/attachments', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('https://api.entix.io/api/accounts*', (route) => route.fulfill({ json: { items: [] } }))

  await page.goto('/app/journal-entries')

  // 1 · coverage banner names the gap
  await expect(page.getByText('مستندات معتمدة بلا قيد محاسبي')).toBeVisible()
  await expect(page.getByText(/فواتير مشتريات: 2/)).toBeVisible()

  // 2 · open the entry → the source reference is a link to the invoice
  await page.getByText('JE-00001').click()
  const sourceLink = page.getByRole('link', { name: /فاتورة المبيعات/ })
  await expect(sourceLink).toBeVisible()
  await expect(sourceLink).toHaveAttribute('href', '/app/invoices/inv-41')
})

test('fully-linked orgs see the green proof instead of a warning', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.route('https://api.entix.io/api/journals/coverage', (route) =>
    route.fulfill({ json: { unposted: { invoices: 0, bills: 0, expenses: 0, receipts: 0, payments: 0 }, linked: true } }),
  )
  await page.route('https://api.entix.io/api/journals', (route) => route.fulfill({ json: { items: [ENTRY], total: 1 } }))
  await page.route('https://api.entix.io/api/accounts*', (route) => route.fulfill({ json: { items: [] } }))

  await page.goto('/app/journal-entries')
  await expect(page.getByText(/كل المستندات المعتمدة مترابطة مع الدفتر/)).toBeVisible()
})
