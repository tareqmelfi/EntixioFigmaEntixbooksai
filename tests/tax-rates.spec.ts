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


test('line basis changes the amount, VAT and total without reverting to the document default', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await mockTaxApi(page)
  await page.goto('/app/quotes?new=1')
  const select = page.getByTestId('line-tax-0')
  await page.getByPlaceholder('الوصف').first().fill('بند تجريبي')
  const row = select.locator('..').locator('..')
  await row.locator('input[inputmode="decimal"]').nth(1).fill('10000')
  await select.selectOption('tr-vat-15-inc')
  await expect(row.locator('.cell.font-display')).toHaveText('10000.00')
  await expect(row.locator('.cell.n.font-english.text-foreground')).toHaveText('8695.65')
  await select.selectOption('tr-vat-15')
  await expect(row.locator('.cell.font-display')).toHaveText('11500.00')
  await expect(row.locator('.cell.n.font-english.text-foreground')).toHaveText('10000.00')
})


for (const surface of [
  { path: '/app/invoices', button: 'New invoice' },
  { path: '/app/purchases/bills', button: 'New purchase invoice' },
  { path: '/app/credit-notes', button: 'New credit note' },
  { path: '/app/purchases/supplier-credits', button: 'New supplier credit' },
]) test(`${surface.button}: typed price and tax basis agree in every line column`, async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await mockTaxApi(page)
  await page.route('https://api.entix.io/api/bills**', r => r.fulfill({ json: { items: [], total: 0 } }))
  await page.route('https://api.entix.io/api/credit-notes**', r => r.fulfill({ json: { items: [], total: 0 } }))
  await page.route('https://api.entix.io/api/supplier-credits**', r => r.fulfill({ json: { items: [], total: 0 } }))
  await page.goto(surface.path)
  await page.getByRole('button', { name: surface.button, exact: true }).first().click()
  const select = page.getByTestId('line-tax-0')
  const row = select.locator('..').locator('..')
  await row.getByRole('textbox', { name: 'Line price', exact: true }).fill('10000')
  await select.selectOption('tr-vat-15-inc')
  await expect(row.locator('.cell.font-display')).toHaveText('10000.00')
  await expect(page.getByTestId('line-tax-amount-0')).toHaveText('1304.35')
  await select.selectOption('tr-vat-15')
  await expect(row.locator('.cell.n.font-english.text-foreground')).toHaveText('10000.00')
  await expect(page.getByTestId('line-tax-amount-0')).toHaveText('1500.00')
  await expect(row.locator('.cell.font-display')).toHaveText('11500.00')
  await row.getByRole('textbox', { name: 'Line quantity', exact: true }).fill('2')
  await row.getByRole('textbox', { name: 'Line price', exact: true }).fill('100.5')
  await row.getByRole('textbox', { name: 'Line discount', exact: true }).fill('1')
  await expect(row.locator('.cell.font-display')).toHaveText('230.00')
})

for (const singleBasis of [false, true]) test(`saved mixed quote retains explicit basis when catalogue only offers ${singleBasis ? 'inclusive' : 'exclusive'}`, async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await mockTaxApi(page)
  const rate = taxRates[singleBasis ? 1 : 0]
  await page.route('https://api.entix.io/api/tax-rates**', r => r.fulfill({ json: { items: [rate] } }))
  let saved: any = { id: 'saved-tax-quote', contactId: contact.id, contact, quoteNumber: 'TAX-TEST', status: 'DRAFT',
    issueDate: '2026-09-29', validUntil: '2026-10-29', currency: 'SAR', subtotal: 20000, taxTotal: 1500, total: 21500,
    lines: [true, false].map((basis, i) => ({ id: `line-${i}`, description: `Synthetic line ${i}`, quantity: 1, unitPrice: 10000, taxRateId: rate.id, taxRate: rate, taxInclusive: basis })) }
  let payload: any = null
  await page.route('https://api.entix.io/api/quotes**', r => {
    const req = r.request()
    if (req.method() === 'PATCH') {
      payload = req.postDataJSON()
      saved = { ...saved, ...payload, lines: payload.lines.map((l: any, i: number) => ({ ...l, id: `line-${i}`, taxRate: rate })) }
      return r.fulfill({ json: saved })
    }
    return r.fulfill({ json: new URL(req.url()).pathname.endsWith('/saved-tax-quote') ? saved : { items: [saved], total: 1 } })
  })
  const open = async () => {
    await page.goto('/app/quotes/saved-tax-quote')
    await page.getByRole('button', { name: 'تعديل', exact: true }).first().click()
  }
  await open()
  const row = page.getByTestId('line-tax-0').locator('..').locator('..')
  await expect(row.locator('.cell.font-display')).toHaveText('10000.00')
  await expect(page.getByTestId('line-tax-1').locator('..').locator('..').locator('.cell.font-display')).toHaveText('11500.00')
  await expect(page.getByTestId('line-tax-0').locator('option:checked')).toHaveText('15% شامل')
  await expect(page.getByTestId('line-tax-1').locator('option:checked')).toHaveText('15% غير شامل')
  const exclusiveOption = singleBasis ? 'rate:0.15:ex' : rate.id
  await page.getByTestId('line-tax-0').selectOption(exclusiveOption)
  await row.getByRole('textbox', { name: 'سعر السطر', exact: true }).fill('123.45')
  await row.getByRole('textbox', { name: 'كمية السطر', exact: true }).fill('2')
  await expect(row.locator('.cell.font-display')).toHaveText('283.94')
  await page.getByRole('button', { name: /حفظ التعديلات|حفظ كمسودة/ }).first().click()
  await expect.poll(() => payload?.lines?.[0]?.unitPrice).toBe(123.45)
  expect(payload.lines[0]).toMatchObject({ quantity: 2, taxInclusive: false, taxRateId: rate.id, taxRate: 0.15 })
  await open()
  await expect(page.getByTestId('line-tax-0').locator('..').locator('..').locator('.cell.font-display')).toHaveText('283.94')
  await expect(page.getByTestId('line-tax-0').locator('option:checked')).toHaveText('15% غير شامل')
})


test('invoice edit/save/reopen preserves typed inclusive price, discount and zero/nonzero rates', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await mockTaxApi(page)
  let invoice: any = { id: 'invoice-tax', invoiceNumber: 'INV-TAX', contactId: contact.id, contact, status: 'DRAFT', currency: 'USD', issueDate: '2026-09-29', dueDate: '2026-10-29', total: 10000, subtotal: 8695.65, taxTotal: 1304.35, amountPaid: 0,
    lines: [{ id: 'line-tax', description: 'Synthetic invoice line', quantity: 1, unitPrice: 10000, discount: 0, taxRateId: taxRates[0].id, taxRate: taxRates[0], taxInclusive: true }] }
  let payload: any = null
  await page.route('https://api.entix.io/api/invoices**', r => {
    if (r.request().method() === 'PATCH') {
      payload = r.request().postDataJSON()
      invoice = { ...invoice, ...payload, lines: payload.lines.map((l: any) => ({ ...l, id: 'line-tax', taxRate: taxRates.find(t => t.id === l.taxRateId) })) }
      return r.fulfill({ json: invoice })
    }
    return r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/invoice-tax') ? invoice : { items: [invoice], total: 1 } })
  })
  const open = async () => {
    await page.goto('/app/invoices')
    await page.getByText('INV-TAX', { exact: true }).first().click()
  }
  await open()
  const row = page.getByTestId('line-tax-0').locator('..').locator('..')
  await expect(row.getByRole('textbox', { name: 'Line price', exact: true })).toHaveValue('10000')
  await expect(row.locator('.cell.font-display')).toHaveText('10000.00')
  await row.getByRole('textbox', { name: 'Line price', exact: true }).fill('115')
  await row.getByRole('textbox', { name: 'Line discount', exact: true }).fill('15')
  await expect(row.locator('.cell.font-display')).toHaveText('100.00')
  await page.getByRole('button', { name: /Save draft|Save changes|Save as draft/ }).first().click()
  await expect.poll(() => payload?.lines?.[0]?.unitPrice).toBe(115)
  expect(payload.lines[0]).toMatchObject({ discount: 15, taxInclusive: true, taxRate: 0.15, taxRateId: taxRates[0].id })
  await open()
  await expect(row.locator('.cell.font-display')).toHaveText('100.00')
  await expect(row.getByRole('textbox', { name: 'Line discount', exact: true })).toHaveValue('15')
  await page.getByTestId('line-tax-0').selectOption('tr-zero')
  await expect(page.getByTestId('line-tax-amount-0')).toHaveText('0.00')
  await expect(row.locator('.cell.font-display')).toHaveText('100.00')
})

test('document basis applies to all lines and stays aligned after a per-line override', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await mockTaxApi(page)
  await page.goto('/app/quotes?new=1')
  const select = page.getByTestId('line-tax-0')
  const row = select.locator('..').locator('..')
  await row.getByRole('textbox', { name: 'Line price', exact: true }).fill('10000')
  await select.selectOption('tr-vat-15')
  const trigger = page.getByRole('combobox').filter({ hasText: 'Exclusive of tax' })
  await trigger.click()
  await page.getByRole('option', { name: 'Inclusive of tax', exact: true }).click()
  await expect(select.locator('option:checked')).toHaveText('15% incl.')
  await expect(row.locator('.cell.font-display')).toHaveText('10000.00')
  await select.selectOption('tr-vat-15')
  await expect(page.getByRole('combobox').filter({ hasText: 'Custom per line' })).toBeVisible()
  await expect(row.locator('.cell.font-display')).toHaveText('11500.00')
})


test('purchase bill saves an explicit net basis even with an inclusive catalogue row', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await mockTaxApi(page)
  const supplier = { ...contact, type: 'BOTH', isSupplier: true }
  await page.route('https://api.entix.io/api/contacts**', r => r.fulfill({ json: { items: [supplier], total: 1 } }))
  const bill: any = { id: 'bill-tax', contactId: contact.id, contact: supplier, billNumber: 'BILL-TAX', status: 'DRAFT', issueDate: '2026-09-29', dueDate: '2026-10-29', currency: 'USD', total: 11500, subtotal: 10000, taxTotal: 1500, amountPaid: 0, paymentSplits: [],
    lines: [{ id: 'bill-line', description: 'Synthetic bill', quantity: 1, unitPrice: 10000, subtotal: 11500, taxRateId: taxRates[1].id, taxRate: taxRates[1] }] }
  let payload: any = null
  await page.route('https://api.entix.io/api/bills**', r => {
    if (r.request().method() === 'PATCH') {
      payload = r.request().postDataJSON()
      return r.fulfill({ json: { ...bill, ...payload } })
    }
    return r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/bill-tax') ? bill : { items: [bill], total: 1 } })
  })
  await page.goto('/app/purchases/bills/bill-tax')
  const select = page.getByTestId('line-tax-0')
  const row = select.locator('..').locator('..')
  await select.selectOption('tr-vat-15-inc')
  await expect(row.locator('.cell.font-display')).toHaveText('10000.00')
  await page.getByRole('button', { name: /Save as draft|Save draft|Save changes/ }).first().click()
  await expect.poll(() => payload?.lines?.[0]?.taxInclusive).toBe(false)
  expect(payload.lines[0].unitPrice).toBeCloseTo(8695.6522, 4)
  expect(payload.lines[0].taxRateId).toBe('tr-vat-15-inc')
  expect(payload.lines[0].taxRate).toBe(0.15)
})


test('expense detail row total follows the tax basis and typed price', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.goto('/app/expenses/new')
  await page.getByRole('button', { name: 'Item, project and asset details', exact: true }).click()
  await page.getByRole('button', { name: 'Add line', exact: true }).click()
  const row = page.getByTestId('expense-line-account-0').locator('..')
  const numbers = row.locator('input[inputmode="decimal"]')
  await numbers.nth(1).fill('10000')
  await numbers.nth(3).fill('0.15')
  await row.getByRole('button', { name: 'Excl.', exact: true }).click()
  await expect(row).toContainText('11,500')
  await expect(page.getByTestId('expense-line-net-0')).toContainText('10,000')
  await expect(page.getByTestId('expense-line-tax-0')).toContainText('1,500')
  await row.getByRole('button', { name: 'Incl.', exact: true }).click()
  await expect(page.getByTestId('expense-line-total-0')).toContainText('10,000')
  await expect(page.getByTestId('expense-line-tax-0')).toContainText('1,304.35')
  await numbers.nth(1).fill('20000')
  await expect(page.getByTestId('expense-line-total-0')).toContainText('20,000')
  await expect(page.getByTestId('expense-line-tax-0')).toContainText('2,608.7')
})
