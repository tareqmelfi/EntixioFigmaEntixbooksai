import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * Account law (CEO · 2026-09-08): every invoice / bill / expense line and every
 * product carries a GL account — suggested automatically («مقترح» chip) and never
 * left empty; approving with an empty account is refused with a clear message,
 * drafts save freely. Also pins the «15% شامل» NaN regression on OCR bills.
 */

const ACCOUNTS = [
  { id: 'acc-rev-sales', code: '41000', name: 'Sales Revenue', nameAr: 'إيراد المبيعات', type: 'REVENUE', isActive: true },
  { id: 'acc-rev-svc', code: '42000', name: 'Service Revenue — Consulting & Advisory', nameAr: 'إيراد الخدمات — الاستشارات', type: 'REVENUE', isActive: true },
  { id: 'acc-cogs', code: '51000', name: 'Cost of Goods Sold', nameAr: 'تكلفة البضاعة المباعة', type: 'EXPENSE', isActive: true },
  { id: 'acc-rent', code: '53000', name: 'Rent', nameAr: 'إيجار', type: 'EXPENSE', isActive: true },
  { id: 'acc-util', code: '54000', name: 'Utilities & Telecom', nameAr: 'خدمات عامة واتصالات', type: 'EXPENSE', isActive: true },
  { id: 'acc-mkt', code: '56000', name: 'Marketing & Advertising', nameAr: 'تسويق وإعلان', type: 'EXPENSE', isActive: true },
  { id: 'acc-travel', code: '61100', name: 'Travel & Accommodation', nameAr: 'سفر وإقامة', type: 'EXPENSE', isActive: true },
  { id: 'acc-fixed', code: '15100', name: 'Computer Equipment', nameAr: 'معدات حاسب', type: 'ASSET', subtype: 'fixed', isActive: true },
]

function suggestFor(body: any) {
  const text = String(body?.text || '') + ' ' + String(body?.category || '')
  const pick = (id: string, via = 'keyword') => { const a = ACCOUNTS.find((x) => x.id === id)!; return { accountId: a.id, code: a.code, name: a.name, nameAr: a.nameAr, type: a.type, via, confidence: 0.8 } }
  if (body?.kind === 'sales' || body?.kind === 'product-income') {
    if (/خدم|service|consult|استشار/i.test(text)) return pick('acc-rev-svc')
    return pick('acc-rev-sales', 'mapping')
  }
  if (/إيجار|rent/i.test(text)) return pick('acc-rent')
  if (/كهرب|stc|اتصال|internet/i.test(text)) return pick('acc-util')
  if (/تسويق|ads|إعلان/i.test(text)) return pick('acc-mkt')
  if (/طيران|سفر|فندق|flight/i.test(text)) return pick('acc-travel')
  if (body?.kind === 'product-expense') return pick('acc-cogs', 'mapping')
  return pick('acc-cogs', 'first')
}

async function commonRoutes(page: any) {
  await page.route('https://api.entix.io/api/accounts', (route: any) => route.fulfill({ json: { items: ACCOUNTS, total: ACCOUNTS.length } }))
  await page.route('https://api.entix.io/api/accounts/suggest', async (route: any) => {
    const body = route.request().postDataJSON()
    await new Promise((r) => setTimeout(r, 120))
    return route.fulfill({ json: suggestFor(body) })
  })
  await page.route('https://api.entix.io/api/bank-accounts', (route: any) => route.fulfill({ json: { items: [], total: 0, totalBalance: 0 } }))
  await page.route('https://api.entix.io/api/branches**', (route: any) => route.fulfill({ json: { items: [], total: 0, defaultBranchId: null } }))
  await page.route('https://api.entix.io/api/projects**', (route: any) => route.fulfill({ json: { items: [], total: 0 } }))
  await page.route('https://api.entix.io/api/tax-rates**', (route: any) => route.fulfill({ json: { items: [] } }))
}

const SUPPLIER = { id: 'c-1', displayName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة', type: 'SUPPLIER', email: '', phone: '' }

// OCR-created bill · "15% شامل" tax text that used to render NaN
const BILL_FULL = {
  id: 'bill-ocr-1', billNumber: 'BILL-2026-000417', status: 'DRAFT', issueDate: '2026-09-01T00:00:00.000Z', dueDate: '2026-10-01T00:00:00.000Z',
  currency: 'USD', total: 2163034.45, subtotal: 1880899.52, taxTotal: 282134.93, amountPaid: 0, contactId: 'c-1', contact: SUPPLIER, paymentSplits: [], notes: '',
  lines: [
    { id: 'l-1', description: 'إيجار المستودع الرئيسي — سبتمبر 2026 · Main warehouse rent', quantity: 1, unitPrice: 1520000, subtotal: 1748000, accountId: null, productId: null, taxRate: '15% شامل' },
    { id: 'l-2', description: 'فاتورة كهرباء وإنترنت STC · Utilities', quantity: 3, unitPrice: 120299.84, subtotal: 415034.45, accountId: null, productId: null, taxRate: { id: 'tr-1', name: 'VAT 15%', rate: '0.15' } },
    { id: 'l-3', description: 'تذاكر طيران فريق التركيب · Flynas', quantity: 4, unitPrice: 2150, subtotal: 8600, accountId: 'acc-travel', productId: null, taxRate: null },
  ],
}

for (const lang of ['ar', 'en'] as const) {
  test(`bill editor · suggested accounts + no NaN + approve gate (${lang})`, async ({ page }) => {
    await prepareVisualApp(page, lang)
    await commonRoutes(page)
    await page.route('https://api.entix.io/api/contacts**', (route: any) => route.fulfill({ json: { items: [SUPPLIER], total: 1, page: 1, limit: 200 } }))
    await page.route('https://api.entix.io/api/bills', (route: any) => route.fulfill({ json: { items: [{ ...BILL_FULL, lines: undefined }], total: 1 } }))
    await page.route('https://api.entix.io/api/bills/bill-ocr-1', (route: any) => route.fulfill({ json: BILL_FULL }))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/app/purchases/bills/bill-ocr-1')
    await expect(page.getByRole('heading', { name: /BILL-2026-000417/ })).toBeVisible()
    // No NaN anywhere on the editor
    await page.waitForTimeout(1200)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/NaN/)
    // Lines 1 + 2 got suggested accounts; line 3 keeps its stored account
    await expect(page.locator('[data-testid="line-account-0"][data-account-suggested="true"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="line-account-1"][data-account-suggested="true"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="line-account-2"]')).not.toHaveAttribute('data-account-suggested', 'true')
  })
}

test('bill editor · approve with an emptied account → red line + CEO message (ar)', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await commonRoutes(page)
  await page.route('https://api.entix.io/api/accounts/suggest', (route: any) => route.fulfill({ json: { accountId: null, code: null, name: null, via: 'none', confidence: 0 } }))
  await page.route('https://api.entix.io/api/contacts**', (route: any) => route.fulfill({ json: { items: [SUPPLIER], total: 1, page: 1, limit: 200 } }))
  await page.route('https://api.entix.io/api/bills', (route: any) => route.fulfill({ json: { items: [], total: 1 } }))
  await page.route('https://api.entix.io/api/bills/bill-ocr-1', (route: any) => route.fulfill({ json: BILL_FULL }))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/purchases/bills/bill-ocr-1')
  await expect(page.getByRole('heading', { name: /BILL-2026-000417/ })).toBeVisible()
  await page.getByRole('button', { name: 'اعتماد', exact: true }).click()
  await expect(page.getByTestId('items-table-error')).toContainText('لا يمكن اعتماد الفاتورة')
})

test('invoice editor · suggested revenue account (ar)', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await commonRoutes(page)
  await page.route('https://api.entix.io/api/contacts**', (route: any) => route.fulfill({ json: { items: [{ ...SUPPLIER, id: 'cust-1', type: 'CUSTOMER' }], total: 1, page: 1, limit: 200 } }))
  await page.route('https://api.entix.io/api/invoices**', (route: any) => route.fulfill({ json: { items: [], total: 0, page: 1, limit: 200 } }))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/invoices?new=1')
  const desc = page.locator('textarea').first()
  await desc.fill('خدمات استشارية محاسبية — إعداد القوائم المالية للربع الثالث 2026')
  await expect(page.locator('[data-testid="line-account-0"][data-account-suggested="true"]')).toHaveCount(1, { timeout: 5000 })
  await expect(page.locator('[data-testid="line-account-0"]')).toContainText('42000')
})

test('expense editor · line account combobox + suggestion + header fallback (ar)', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await commonRoutes(page)
  await page.route('https://api.entix.io/api/expenses**', (route: any) => route.fulfill({ json: { items: [], total: 0, page: 1, limit: 200, summary: { sumTotal: '0', avgTotal: '0', sumByCurrency: [] } } }))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/expenses?new=1')
  await page.getByPlaceholder(/ضيافة ووجبات/).fill('إيجار مكاتب الإدارة')
  await page.getByRole('button', { name: /إضافة بند/ }).click()
  const rows = page.locator('table tbody tr')
  await rows.first().locator('input').first().fill('فاتورة كهرباء وإنترنت STC — أغسطس')
  await expect(page.locator('[data-testid="expense-line-account-0"][data-account-suggested="true"]')).toHaveCount(1, { timeout: 5000 })
  await expect(page.locator('[data-testid="expense-line-account-0"]')).toContainText('54000')
  await expect(page.locator('[data-testid="expense-header-account"][data-account-suggested="true"]')).toHaveCount(1, { timeout: 5000 })
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/NaN/)
})

test('product form · both accounts suggested from type + name (ar)', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await commonRoutes(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/products/new')
  await page.locator('input[required].font-english').first().fill('Monthly accounting advisory · استشارات محاسبية شهرية')
  await expect(page.locator('[data-testid="product-income-account"][data-account-suggested="true"]')).toHaveCount(1, { timeout: 6000 })
  await expect(page.locator('[data-testid="product-expense-account"][data-account-suggested="true"]')).toHaveCount(1, { timeout: 6000 })
  // the name drives the suggestion (service text → service revenue), not just the type
  await expect(page.locator('[data-testid="product-income-account"]')).toContainText('42000', { timeout: 6000 })
})
