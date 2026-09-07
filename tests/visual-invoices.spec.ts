import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

const invoice = {
  id: 'inv-visual-1',
  orgId: 'org-visual-system',
  contactId: 'contact-visual-1',
  invoiceNumber: 'INV-1001',
  status: 'PAID',
  issueDate: '2026-08-01',
  dueDate: '2026-08-31',
  currency: 'USD',
  exchangeRate: '1',
  subtotal: '1250',
  taxTotal: '0',
  discountTotal: '0',
  total: '1250',
  amountPaid: '1250',
  contact: { id: 'contact-visual-1', displayName: 'Northwind LLC' },
}

test('invoices use shared product contracts and semantic status tones', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.route('https://api.entix.io/api/invoices**', route => route.fulfill({
    json: { items: [invoice], total: 1, page: 1, limit: 200 },
  }))
  await page.goto('/app/invoices')

  const heading = page.getByRole('heading', { name: 'Sales Invoices' })
  await expect(heading).toBeVisible()
  await expect(heading.locator('xpath=ancestor::header')).toHaveCount(1)
  await expect(heading).toHaveClass(/\bfont-bold\b/) // Ledger page title
  await expect(heading).not.toHaveAttribute('style')

  // Ledger: three figures on the ink-rule strip (no boxed KPI cards).
  const metrics = ['Outstanding', 'Overdue', 'Collected this month']
  for (const label of metrics) {
    const figure = page.getByText(label, { exact: true }).locator('xpath=ancestor::*[contains(@class,"ledger-figure")][1]')
    await expect(figure).toHaveClass(/\bledger-figure\b/)
  }

  await expect(page.getByRole('toolbar', { name: 'Invoice filters' })).toBeVisible()
  // Status = dot + word; paid reads in the (blue) success tone, never green.
  await expect(page.getByText('Paid', { exact: true }).first().locator('xpath=ancestor-or-self::*[contains(@class,"text-success")][1]')).toHaveCount(1)
})
