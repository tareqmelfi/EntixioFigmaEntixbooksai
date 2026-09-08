import { test, expect, type Page } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * REGRESSION · the wrong client-facing total (CEO screenshot 2026-09-08).
 *
 * The line grid offered «15% غير شامل» but sent nothing to the API, which
 * expected a `taxRateId` no endpoint could produce — so a 400 quote saved with
 * `taxTotal = 0` and the client was quoted 400 instead of 460.
 *
 * These tests fence the fix from the UI side: the dropdown is fed by
 * `/api/tax-rates`, the quote POST carries the rate, and the الضرائب page can
 * manage the catalogue.
 */

const taxRates = [
  { id: 'tr-vat-15', name: 'VAT 15%', nameAr: 'ضريبة القيمة المضافة 15%', rate: '0.15', type: 'STANDARD', isDefault: true, isInclusive: false, isActive: true },
  { id: 'tr-vat-15-inc', name: 'VAT 15% (inclusive)', nameAr: 'ضريبة القيمة المضافة 15% شامل', rate: '0.15', type: 'STANDARD', isDefault: false, isInclusive: true, isActive: true },
  { id: 'tr-zero', name: 'Zero-rated 0%', nameAr: 'خاضعة بنسبة صفر 0%', rate: '0', type: 'ZERO_RATED', isDefault: false, isInclusive: false, isActive: true },
  { id: 'tr-exempt', name: 'Exempt', nameAr: 'معفاة من الضريبة', rate: '0', type: 'EXEMPT', isDefault: false, isInclusive: false, isActive: true },
]

const contact = {
  id: 'contact-asasyah',
  displayName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة',
  email: 'ap@al-asasyah.example', type: 'CUSTOMER', isCustomer: true, entityKind: 'ORGANIZATION', country: 'SA',
}

async function mockTaxApi(page: Page) {
  await page.route('https://api.entix.io/api/tax-rates**', (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ json: taxRates[0] })
    return route.fulfill({ json: { items: taxRates, total: taxRates.length, defaultId: 'tr-vat-15' } })
  })
  await page.route('https://api.entix.io/api/contacts**', (route) =>
    route.fulfill({ json: { items: [contact], total: 1, page: 1, limit: 200 } }))
  await page.route('https://api.entix.io/api/quotes**', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
    return route.fulfill({ json: { id: 'quote-1', quoteNumber: 'QTE-2026-0001', lines: [] } })
  })
  await page.route('https://api.entix.io/api/document-templates**', (route) => route.fulfill({ json: { items: [], total: 0, QUOTE: null, INVOICE: null } }))
  await page.route('https://api.entix.io/api/branches**', (route) => route.fulfill({ json: { items: [], total: 0, defaultBranchId: null } }))
  await page.route('https://api.entix.io/api/payment-plans**', (route) => route.fulfill({ json: { items: [], total: 0 } }))
}

test.describe('tax rates · the dropdown is fed by the org catalogue', () => {
  test('the quote line grid offers the ORG rates, not a hard-coded list', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockTaxApi(page)
    await page.goto('/app/quotes')

    await page.getByRole('button', { name: /عرض سعر جديد|عرض جديد/ }).first().click()
    const select = page.getByTestId('line-tax-0')
    await expect(select).toBeVisible()
    // The catalogue's own labels, including the exempt row the old static list
    // could not represent (it shipped two options with the same value).
    // The grid cell is ~90px wide, so the option label leads with the PERCENTAGE
    // (the full catalogue name lives on the settings page).
    const options = await select.locator('option').allTextContents()
    expect(options).toContain('15% غير شامل')
    expect(options).toContain('15% شامل')
    expect(options).toContain('معفى')
    expect(new Set(await select.locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value))).size)
      .toBe(taxRates.length)
  })

  test('a 400 quote line is sent with its tax rate — the API can no longer store 0', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockTaxApi(page)

    let posted: any = null
    await page.route('https://api.entix.io/api/quotes', async (route) => {
      if (route.request().method() === 'POST') {
        posted = route.request().postDataJSON()
        return route.fulfill({ json: { id: 'quote-1', quoteNumber: 'QTE-2026-0001', subtotal: '400.00', taxTotal: '60.00', total: '460.00', lines: [] } })
      }
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/quotes')
    await page.getByRole('button', { name: /عرض سعر جديد|عرض جديد/ }).first().click()

    // Client · SearchableCombobox = a button that reveals its own search input
    await page.getByRole('button', { name: /ابحث عن عميل/ }).click()
    await page.getByPlaceholder('ابحث عن عميل...').fill('ASASYAH')
    await page.getByText('AL-ASASYAH', { exact: false }).first().click()

    // One 400 line at the standard rate
    const taxSelect = page.getByTestId('line-tax-0')
    await expect(taxSelect).toBeVisible()
    await page.getByPlaceholder('الوصف').first().fill('تصميم وتنفيذ واجهة معمارية')
    const numeric = page.locator('input[inputmode="decimal"]')
    await numeric.nth(1).fill('400')          // 0 = quantity · 1 = unit price
    await taxSelect.selectOption('tr-vat-15')

    // The grid itself must already show 460 — the figure the client sees.
    await expect(page.getByText('460.00').first()).toBeVisible()

    await page.getByRole('button', { name: 'حفظ كمسودة' }).click()
    await expect.poll(() => posted?.lines?.[0]?.taxRateId, { timeout: 10_000 }).toBe('tr-vat-15')
    expect(posted.lines[0].taxRate).toBe(0.15)
    expect(posted.lines[0].unitPrice).toBe(400)
    expect(posted.lines[0].taxInclusive).toBe(false)
  })
})

test.describe('tax rates · the settings surface', () => {
  test('«معدلات الضريبة» lists the catalogue and can add a rate', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockTaxApi(page)
    // The fixture org is a US company, so the page renders the sales-tax view.
    await page.route('https://api.entix.io/api/tax-return/**', (route) => route.fulfill({
      json: {
        type: 'us-sales-tax',
        org: { name: 'Visual Test Company', legalName: 'Visual Test Company LLC', state: 'WY', ein: null, usFilingClass: null },
        period: { from: '2026-09-01', to: '2026-09-30' },
        currency: 'USD',
        sales: { grossSales: 0, taxCollected: 0, exemptSales: 0, taxableSales: 0, byState: [], byRate: [] },
        irsGuide: null,
        hint: null,
      },
    }))

    await page.goto('/app/taxes')
    const section = page.getByTestId('tax-rates-section')
    await expect(section).toBeVisible()
    await expect(section.getByTestId('tax-rate-row-tr-vat-15')).toContainText('ضريبة القيمة المضافة 15%')
    await expect(section.getByTestId('tax-rate-row-tr-vat-15')).toContainText('افتراضي')

    await section.getByTestId('tax-rate-add').click()
    await expect(section.getByTestId('tax-rate-form')).toBeVisible()
    await section.getByTestId('tax-rate-value').fill('5')
    await expect(section.getByTestId('tax-rate-save')).toBeEnabled()
  })
})
