import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * Regression · user report 2026-08-18: clicking bill SP-INV-48300 on
 * /app/purchases/bills opened a form titled «فاتورة مشتريات جديدة» — the
 * title was hardcoded and the row click passed the LIST row (no lines)
 * straight into the editor, so a saved "edit" could even wipe the lines.
 *
 * Contract: a row click deep-links to /app/purchases/bills/:id, fetches the
 * FULL bill, and the form identifies the opened bill by number.
 */

const BILL_ROW = {
  id: 'bill-1',
  billNumber: 'SP-INV-48300',
  status: 'RECEIVED',
  issueDate: '2026-08-10T00:00:00.000Z',
  dueDate: '2026-09-10T00:00:00.000Z',
  currency: 'SAR',
  total: 48300,
  amountPaid: 0,
  contactId: 'c-1',
  contact: { id: 'c-1', displayName: 'شركة سبيك بروز' },
  // List payload intentionally carries NO lines — mirroring production.
}

const BILL_FULL = {
  ...BILL_ROW,
  notes: 'PO 48300',
  paymentSplits: [],
  lines: [
    { id: 'l-1', description: 'أعمال إنتاج إعلاني — أغسطس', quantity: 1, unitPrice: 48300, accountId: '', productId: null },
  ],
}

test('clicking a bill row opens THAT bill (full fetch) — never a blank «new bill» form', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.route('https://api.entix.io/api/bills', (route) =>
    route.fulfill({ json: { items: [BILL_ROW], total: 1 } }),
  )
  await page.route('https://api.entix.io/api/bills/bill-1', (route) =>
    route.fulfill({ json: BILL_FULL }),
  )
  await page.route('https://api.entix.io/api/bank-accounts', (route) =>
    route.fulfill({ json: { items: [], total: 0, totalBalance: 0 } }),
  )

  await page.goto('/app/purchases/bills')
  await page.getByText('SP-INV-48300').click()

  // The form must identify the opened bill, not claim «new».
  await expect(page.getByRole('heading', { name: /SP-INV-48300/ })).toBeVisible()
  // The real line is present — proving the editor fetched the FULL bill.
  await expect(page.locator('textarea').filter({ hasText: '' }).first()).toHaveValue('أعمال إنتاج إعلاني — أغسطس')
  // The URL carries the deep link (shareable + correct back behavior).
  await expect(page).toHaveURL(/\/app\/purchases\/bills\/bill-1/)
})
