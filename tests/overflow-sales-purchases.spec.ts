import { test, expect } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'

/**
 * Overflow audit · Sales + Purchases groups (CEO 2026-09-08 «راجع كل المربعات بلا استثناء»).
 * Every list / hub / document view renders with realistic LONG data (32-char gateway ids,
 * bilingual company names, 7-digit money, mixed currencies) at 1024 / 1280 / 1440 / 1920
 * in Arabic and English; a page passes only when nothing paints outside its box.
 * Run a subset with SP_PAGES=quotes,receipts …
 */

const NAMES = [
  'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة',
  'شركة سبيك بروز للتجارة والمقاولات وتجارة مواد البناء المحدودة',
  'ENSIDEX LLC · 30 N Gould St Ste R, Sheridan, WY 82801',
  'مؤسسة النخبة العالمية للتقنية الحديثة وخدمات الاتصالات',
  'Stripe Payments Europe Ltd.',
]
const contact = (i: number) => ({ id: `c-${i}`, displayName: NAMES[i % NAMES.length], taxId: '310123456700003' })

const quotes = Array.from({ length: 7 }, (_, i) => ({
  id: `q-${i}`, orgId: 'org', contactId: `c-${i}`, quoteNumber: i === 0 ? 'ENTIX-QT-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `QT-2026-${String(4180 + i).padStart(5, '0')}`,
  status: ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'][i],
  issueDate: '2026-08-2' + i, validUntil: '2026-09-1' + i, currency: i === 2 ? 'USD' : 'SAR',
  subtotal: '1880899.52', taxTotal: '282134.93', discountTotal: '0', total: i === 1 ? '2163034.454' : String(1234567.891 * (i + 1)),
  notes: 'شروط الدفع: 50% مقدم · 50% عند التسليم · مدة التنفيذ 45 يوم عمل',
  rejectReason: i === 4 ? 'السعر أعلى من المنافس بنسبة 12%' : null,
  contact: contact(i), title: i === 0 ? 'توريد وتركيب أنظمة الطاقة الشمسية لمشروع الرياض السكني المرحلة الثانية' : null,
  lines: [
    { id: 'l1', description: 'توريد وتركيب لوحات شمسية 550W أحادية البلورية مع الهياكل والتمديدات', quantity: 1200, unitPrice: '780.5', total: '936600' },
    { id: 'l2', description: 'Inverter Huawei SUN2000-100KTL-M1 with smart logger and commissioning', quantity: 8, unitPrice: '32500', total: '260000' },
  ],
}))

const vouchers = (type: 'RECEIPT' | 'PAYMENT') => Array.from({ length: 6 }, (_, i) => ({
  id: `v-${i}`, orgId: 'org', type, number: i === 0 ? `ENTIX-${type === 'RECEIPT' ? 'RCV' : 'PAY'}-txn_3U8oafB2CpMkgB7N1hKuhpUy` : `${type === 'RECEIPT' ? 'RV' : 'PV'}-2026-${String(900 + i).padStart(5, '0')}`,
  date: `2026-08-1${i}`, contactId: `c-${i}`, amount: i === 0 ? '2163034.454' : String(98765.4321 * (i + 1)), currency: i === 3 ? 'USD' : 'SAR',
  paymentMethod: ['BANK_TRANSFER', 'CASH', 'CARD', 'MADA', 'CHECK', 'STC_PAY'][i],
  reference: i % 2 ? 'TRX-9982374-ALRAJHI-2026-08-11-0987654321' : null,
  notes: i === 2 ? 'دفعة مقدمة عن عقد الصيانة السنوي للمرحلة الأولى · تشمل الضريبة' : null,
  invoiceId: i === 1 ? 'inv-xyz-12345678' : null, contact: contact(i),
}))

const creditNotes = Array.from({ length: 5 }, (_, i) => ({
  id: `cn-${i}`, noteNumber: i === 0 ? 'ENTIX-CN-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `CN-2026-${String(70 + i).padStart(5, '0')}`,
  status: ['DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED', 'ISSUED'][i], issueDate: `2026-08-0${i + 1}`,
  total: i === 0 ? '2163034.454' : String(4321.987 * (i + 1)), currency: i === 1 ? 'USD' : 'SAR', reason: ['RETURN', 'DISCOUNT', 'PRICING_ERROR', 'QUALITY_ISSUE', 'OTHER'][i],
  contactId: `c-${i}`, contact: contact(i),
}))

const bills = Array.from({ length: 6 }, (_, i) => ({
  id: `bill-${i}`, billNumber: i === 0 ? 'ENTIX-BILL-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `SP-INV-${48300 + i}`,
  status: ['DRAFT', 'RECEIVED', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'][i],
  issueDate: `2026-08-1${i}T00:00:00.000Z`, dueDate: `2026-09-1${i}T00:00:00.000Z`, currency: i === 2 ? 'EUR' : 'SAR',
  total: i === 0 ? 2163034.454 : 48300.5 * (i + 1), amountPaid: i === 3 ? 20000 : 0, contactId: `c-${i}`, contact: contact(i),
}))

const supplierCredits = Array.from({ length: 4 }, (_, i) => ({
  id: `sc-${i}`, creditNumber: i === 0 ? 'ENTIX-SC-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `SC-2026-${String(10 + i).padStart(5, '0')}`,
  status: ['DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED'][i], issueDate: `2026-08-0${i + 1}`, total: i === 0 ? '2163034.454' : String(7654.321 * (i + 1)),
  currency: 'SAR', reason: ['RETURN', 'DISCOUNT', 'PRICING_ERROR', 'OTHER'][i], contactId: `c-${i}`, contact: contact(i),
}))

const expenses = Array.from({ length: 5 }, (_, i) => ({
  id: `e-${i}`, number: i === 0 ? 'ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `EXP-2026-${String(300 + i).padStart(5, '0')}`,
  date: `2026-08-1${i}`, total: i === 0 ? '2163034.454' : String(1234.567 * (i + 1)), subtotal: '1880899.52', taxAmount: '282134.93', amount: '1880899.52',
  currency: i === 1 ? 'USD' : 'SAR', category: 'رسوم بوابات الدفع والعمولات البنكية', description: 'Stripe processing fees · August 2026 · invoice in_1PxYzAbCdEfGhIjKlMnOpQrS',
  documentNumber: 'in_1PxYzAbCdEfGhIjKlMnOpQrStUvWxYz', reference: null, paymentMethod: 'CARD', contactId: `c-${i}`, contact: contact(i), vendorName: null,
  externalId: i === 0 ? 'stripe:in_1PxYz' : null, attachmentCount: 1,
  lineItems: [{ description: 'Processing fee 2.9% + 1.00 SAR per successful card charge · August', quantity: 1, unitPrice: 1880899.52, taxRate: 0.15, lineTotal: 1880899.52, accountName: '6210 · رسوم بنكية' }],
  paymentSplits: [{ method: 'CARD', amount: 2163034.454, reference: 'card-4242', currency: 'SAR', accountName: 'Stripe balance' }],
}))

const salesDash = {
  org: { name: 'Visual Test Company', baseCurrency: 'SAR' },
  thisMonth: { total: 2163034.454, paid: 1200000.5, count: 12 }, ytd: { total: 8123456.789, paid: 6000000, count: 88 },
  allTime: { total: 21630344.54, paid: 18000000.123, count: 431, outstanding: 3630344.417 },
  byStatus: [{ status: 'PAID', count: 300, total: 18000000 }, { status: 'OVERDUE', count: 21, total: 1630344 }, { status: 'SENT', count: 60, total: 1500000 }, { status: 'DRAFT', count: 50, total: 500000 }],
  recentInvoices: Array.from({ length: 5 }, (_, i) => ({ id: `inv-${i}`, number: i === 0 ? 'ENTIX-INV-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `INV-2026-${4000 + i}`, contact: NAMES[i], status: ['PAID', 'OVERDUE', 'SENT', 'DRAFT', 'PARTIAL'][i], total: 2163034.454 / (i + 1), paid: 0, date: `2026-08-2${i}` })),
  topCustomers: NAMES.map((n, i) => ({ contactId: `c-${i}`, name: n, total: 5000000 / (i + 1) })),
  monthly: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((m, i) => ({ month: m, total: 1000000 + i * 250000 })),
}
const purchDash = {
  org: { name: 'Visual Test Company', baseCurrency: 'SAR' },
  thisMonth: { bills: 2163034.454, billCount: 9 },
  ytd: { bills: 7123456.78, billCount: 70, expenses: 1234567.89, expenseCount: 210, total: 8358024.67 },
  expensesByCategory: [{ category: 'رسوم بوابات الدفع والعمولات البنكية', total: 500000 }, { category: 'إيجارات', total: 300000 }, { category: 'Software subscriptions', total: 200000 }, { category: 'سفر وتنقلات', total: 100000 }],
  topSuppliers: NAMES.map((n, i) => ({ contactId: `c-${i}`, name: n, total: 3000000 / (i + 1) })),
  recentBills: bills.map((b) => ({ id: b.id, number: b.billNumber, contact: b.contact.displayName, status: b.status, total: b.total, date: b.issueDate.slice(0, 10) })),
  monthly: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((m, i) => ({ month: m, total: 800000 + i * 150000 })),
}

async function mocks(page: import('@playwright/test').Page) {
  await page.route(/googletagmanager|google-analytics|accounts\.google|content-autofill|www\.google\.com/, (r) => r.abort())
  await page.route('https://api.entix.io/api/quotes**', (r) => {
    const p = new URL(r.request().url()).pathname
    const m = p.match(/\/api\/quotes\/([^/]+)$/)
    if (m) return r.fulfill({ json: quotes.find((q) => q.id === m[1]) || quotes[0] })
    return r.fulfill({ json: { items: quotes, total: quotes.length } })
  })
  await page.route('https://api.entix.io/api/vouchers**', (r) => {
    const u = new URL(r.request().url())
    if (/\/attachments$/.test(u.pathname)) return r.fulfill({ json: { items: [{ id: 'a1', filename: 'bank-transfer-receipt-alrajhi-2026-08-11-very-long-filename.pdf', contentType: 'application/pdf', sizeBytes: 12345, url: '#', createdAt: '2026-08-11' }] } })
    const m = u.pathname.match(/\/api\/vouchers\/([^/]+)$/)
    const type = u.searchParams.get('type') === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT'
    const list = vouchers(m ? (u.pathname.includes('PAY') ? 'PAYMENT' : 'RECEIPT') : type)
    if (m) return r.fulfill({ json: list.find((v) => v.id === m[1]) || list[0] })
    return r.fulfill({ json: { items: list, total: list.length, summary: { sumAmount: '2163034.454', avgAmount: '360505.742', sumByCurrency: [{ currency: 'SAR', total: '2163034.454' }] } } })
  })
  await page.route('https://api.entix.io/api/credit-notes**', (r) => r.fulfill({ json: { items: creditNotes, total: creditNotes.length } }))
  await page.route('https://api.entix.io/api/supplier-credits**', (r) => {
    const m = new URL(r.request().url()).pathname.match(/\/api\/supplier-credits\/([^/]+)$/)
    if (m) return r.fulfill({ json: { ...(supplierCredits.find((x) => x.id === m[1]) || supplierCredits[0]), subtotal: '1880899.52', taxTotal: '282134.93', notes: 'مرتجع دفعة كاملة من اللوحات التالفة أثناء النقل · بانتظار اعتماد المورد', originalBillId: 'bill-1', originalBill: { billNumber: 'SP-INV-48301' }, lines: quotes[0].lines } })
    return r.fulfill({ json: { items: supplierCredits, total: supplierCredits.length } })
  })
  await page.route('https://api.entix.io/api/bills**', (r) => {
    const m = new URL(r.request().url()).pathname.match(/\/api\/bills\/([^/]+)$/)
    if (m) return r.fulfill({ json: { ...(bills.find((b) => b.id === m[1]) || bills[0]), lines: [], paymentSplits: [] } })
    return r.fulfill({ json: { items: bills, total: bills.length } })
  })
  await page.route('https://api.entix.io/api/expenses**', (r) => {
    const m = new URL(r.request().url()).pathname.match(/\/api\/expenses\/([^/]+)$/)
    if (m && /attachments/.test(r.request().url())) return r.fulfill({ json: { items: [] } })
    if (m) return r.fulfill({ json: expenses.find((e) => e.id === m[1]) || expenses[0] })
    return r.fulfill({ json: { items: expenses, total: expenses.length, page: 1, limit: 50, summary: { sumTotal: '2163034.454', avgTotal: '432606.89', sumByCurrency: [{ currency: 'SAR', total: '2163034.454' }, { currency: 'USD', total: '2469.13' }] } } })
  })
  await page.route('https://api.entix.io/api/pos/**', (r) => r.fulfill({ json: { items: [] } }))
  await page.route('https://api.entix.io/api/pos/catalog', (r) => r.fulfill({ json: { orgVatRate: 0.15, items: Array.from({ length: 14 }, (_, i) => ({ id: `p-${i}`, sku: i === 0 ? 'SKU-ENTIX-txn_3U8oafB2CpMkgB7N1hKuhpUy' : `SKU-${1000 + i}`, name: i % 2 ? 'Huawei SUN2000-100KTL-M1 Inverter with smart logger and commissioning kit' : 'لوح شمسي 550W أحادي البلورية مع هيكل التثبيت والتمديدات الكهربائية', nameAr: null, imageUrl: null, type: 'GOOD', unitPrice: i === 0 ? '2163034.454' : String(780.5 * (i + 1)), stockQty: '12', category: i % 3 ? 'إلكترونيات' : 'Solar equipment', taxRate: { rate: '0.15', type: 'STANDARD' } })) } }))
  await page.route('https://api.entix.io/api/pos/shift/current', (r) => r.fulfill({ json: { shift: { id: 's1', openedAt: '2026-09-08T06:00:00.000Z', openingFloat: '500', cashierId: 'c1', cashierName: 'عبدالرحمن بن محمد العتيبي' } } }))
  await page.route('https://api.entix.io/api/pos/cashiers**', (r) => r.fulfill({ json: { items: [] } }))
  await page.route('https://api.entix.io/api/bank-accounts**', (r) => r.fulfill({ json: { items: [], total: 0, totalBalance: 0 } }))
  await page.route('https://api.entix.io/api/dashboard/sales', (r) => r.fulfill({ json: salesDash }))
  await page.route('https://api.entix.io/api/dashboard/purchases', (r) => r.fulfill({ json: purchDash }))
}

const PAGES: Array<[string, string]> = [
  ['quotes', '/app/quotes'],
  ['quote-detail', '/app/quotes/q-0'],
  ['receipts', '/app/receipts'],
  ['receipt-detail', '/app/receipts/v-0'],
  ['credit-notes', '/app/credit-notes'],
  ['sales', '/app/sales'],
  ['bills', '/app/purchases/bills'],
  ['payments', '/app/payments'],
  ['payment-detail', '/app/payments/v-0'],
  ['supplier-credits', '/app/purchases/supplier-credits'],
  ['supplier-credit-detail', '/app/purchases/supplier-credits/sc-0'],
  ['purchases', '/app/purchases'],
  ['expenses', '/app/expenses'],
  ['expense-detail', '/app/expenses/e-0'],
  ['pos', '/app/pos'],
]

const only = process.env.SP_PAGES ? process.env.SP_PAGES.split(',') : null

for (const lang of ['ar', 'en'] as const) {
  for (const [name, path] of PAGES) {
    if (only && !only.includes(name)) continue
    test(`${name} · ${lang}`, async ({ page }) => {
      await prepareVisualApp(page, lang)
      await mocks(page)
      const failures: string[] = []
      for (const w of AUDIT_WIDTHS) {
        await page.setViewportSize({ width: w, height: 1000 })
        await page.goto(path)
        const root = name === 'pos' ? 'body' : 'main'
        await page.locator(name === 'pos' ? 'body h1, body h2, body button' : 'main h1, main h2').first().waitFor({ state: 'visible', timeout: 30000 })
        await page.locator(`${root} .animate-spin`).first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(700)
        const txt = await page.locator(root).innerText()
        if (txt.trim().length < 40) failures.push(`${w}: page did not render (${txt.trim().slice(0, 40)})`)
        const hits = await auditOverflow(page, root)
        if (hits.length) failures.push(`${w}: ` + hits.map((h) => `${h.kind} +${Math.round(h.by)} ${h.path} «${h.text}»`).join('\n   '))
        if (w === 1024 || w === 1440 || w === 1920) await page.screenshot({ path: `/tmp/claude-0/shots/sp/${name}-${lang}-${w}.png`, fullPage: true })
      }
      expect(failures, failures.join('\n')).toEqual([])
    })
  }
}
