import { expect, test } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'

/**
 * VAT return UX contracts (user report 2026-08-18):
 *  1. quick quarter buttons (Q1–Q4) — Saudi filers are mostly quarterly;
 *  2. a quarterly org opens on the CURRENT QUARTER, not a bare month;
 *  3. draft documents in the period appear as a clickable review list
 *     (they never enter the ZATCA buckets).
 */

const saOrg = {
  id: visualOrgId,
  slug: 'ibdaa',
  name: 'شركة ابداع بدون حدود',
  legalName: 'شركة ابداع بدون حدود',
  country: 'SA',
  baseCurrency: 'SAR',
  fiscalYearStart: 1,
  fiscalYearEnd: 12,
  zatcaEnabled: true,
  vatNumber: '314807604900003',
  crNumber: null,
  logoUrl: null,
  stampUrl: null,
}

function saVatPayload() {
  const bucket = { base: 0, vat: 0 }
  return {
    org: { ...saOrg, vatPeriod: 'quarterly' },
    period: { from: '2026-07-01', to: '2026-09-30' },
    vatDeclaration: {
      sales: { standardRated: { base: 1000, vat: 150 }, citizens: bucket, zeroDomestic: bucket, exports: bucket, zeroRated: bucket, exempt: bucket, nonTaxable: bucket, totalBase: 1000, totalVat: 150 },
      purchases: { deductible: bucket, importCustoms: bucket, importRcm: bucket, zeroExempt: bucket, zeroRated: bucket, exempt: bucket, imports: bucket, totalBase: 0, totalVat: 0 },
      netVat: 150, payable: 150, refundable: 0,
    },
    breakdown: { grossRevenue: 1000, taxAmount: 150, totalRevenueIncludingTax: 1150, nonTaxRevenue: 0, expensesTotal: 0, expensesTax: 0 },
    withholding: { totalBase: 0, totalWithholding: 0, rows: [] },
    drafts: {
      count: 1,
      invoices: [],
      bills: [{ id: 'bill-9', billNumber: 'SP-INV-48300', issueDate: '2026-08-10', total: 48300, taxTotal: 6300, contactName: 'شركة سبيك بروز' }],
    },
  }
}

test('VAT return: quarter presets + quarterly default + draft review list', async ({ page }) => {
  await prepareVisualApp(page, 'ar')

  const requestedRanges: string[] = []
  await page.route('https://api.entix.io/api/tax-return/sa-vat*', (route) => {
    requestedRanges.push(new URL(route.request().url()).search)
    route.fulfill({ json: saVatPayload() })
  })
  // Region resolver: make the org Saudi
  await page.route('https://api.entix.io/orgs*', (route) => route.fulfill({ json: [saOrg] }))
  await page.route('https://api.entix.io/me*', (route) =>
    route.fulfill({ json: { locale: 'ar', selectedOrgId: visualOrgId, defaultOrgId: visualOrgId, memberships: [{ role: 'OWNER', createdAt: '2026-08-15T00:00:00.000Z', org: saOrg }] } }),
  )

  await page.goto('/app/taxes')

  // 1 · quarter preset buttons exist
  await expect(page.getByRole('button', { name: /الربع الأول/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /الربع الرابع/ })).toBeVisible()

  // 2 · quarterly org → the range snaps to the current quarter after first load
  const now = new Date()
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3
  const expectedFrom = new Date(Date.UTC(now.getFullYear(), qStartMonth, 1)).toISOString().slice(0, 10)
  await expect.poll(() => requestedRanges.join(' | ')).toContain(`from=${expectedFrom}`)

  // 3 · the draft bill appears as a review row and deep-links to itself
  const draftRow = page.getByRole('button', { name: /SP-INV-48300/ })
  await expect(draftRow).toBeVisible()
  await expect(page.getByText(/مسودات داخل هذه الفترة/)).toBeVisible()
  await draftRow.click()
  await expect(page).toHaveURL(/\/app\/purchases\/bills\/bill-9/)
})
