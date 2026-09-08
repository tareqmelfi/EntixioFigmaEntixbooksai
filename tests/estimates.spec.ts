import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'

/**
 * SPEC-05 · الدراسة والتسعير (estimates) + خطة الدفعات (payment plan on a quote)
 *
 *  · the estimate list renders numbers · titles · customers · cost/sale/margin
 *  · the editor computes the unit price from costs + margin (the API line law, live)
 *  · the conversion strip states the copy law (price only · never cost or margin)
 *  · the payment-plan guard blocks a plan whose percents do not add up to 100
 *  · overflow audit: zero hits at 1024/1280/1440/1920 in ar + en for the list,
 *    the new-estimate editor and the quote editor
 *
 * Run: npx playwright test tests/estimates.spec.ts -c zz-pw.config.ts
 */
if (process.env.ESTIMATE_BASE_URL) test.use({ baseURL: process.env.ESTIMATE_BASE_URL })
const SHOTS = process.env.ESTIMATE_SHOTS || 'test-results/estimates'
mkdirSync(SHOTS, { recursive: true })

const org = {
  id: visualOrgId, slug: 'specpros', name: 'شركة سبيك بروز للاستثمار قابضة', legalName: 'Spec Pros Investment Holding Inc',
  country: 'SA', baseCurrency: 'SAR', vatNumber: '311691775200003', crNumber: '1010889599', logoUrl: null, stampUrl: null,
  city: 'الرياض', phone: '800-111-0110', email: 'info@specpros.sa', defaultInvoiceLanguage: 'ar', role: 'OWNER',
}
const contact = {
  id: 'c1', orgId: visualOrgId, type: 'CUSTOMER',
  displayName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة',
  email: 'procurement@al-asasyah-basic-electronics.com.sa', vatNumber: '314976132800003', country: 'SA',
}

const line = (i: number, over: Record<string, unknown> = {}) => ({
  id: `el-${i}`, sortOrder: i - 1,
  itemNo: `BOQ-04-${String(i).padStart(3, '0')}`,
  section: i <= 4 ? 'أعمال التكييف والتهوية · HVAC' : 'أعمال الكهرباء والتيار الخفيف',
  description: 'توريد وتركيب وحدة مناولة هواء AHU سعة 20 طن تبريد مع لوحة تحكم ومرشحات HEPA',
  spec: 'مطابق للمواصفات السعودية SASO 2663 · ضمان 5 سنوات · تركيب على قواعد مانعة للاهتزاز',
  unit: 'وحدة', quantity: '12', materialCost: '184320.5', labourCost: '42150.25', otherCost: '9800',
  unitCost: '236270.75', marginPct: '18', unitPrice: '278799.485', unitPriceLocked: false,
  lineTotal: '3345593.82', taxRate: '15', durationDays: 45, ownerName: 'م. عبدالرحمن الشمري',
  needsDept: null, productId: null, accountId: null, ...over,
})

const estimateRow = {
  id: 'est-1', orgId: visualOrgId, number: 'EST-202609-0042', title: 'دراسة تكلفة مشروع مركز البيانات الإقليمي · المرحلة الثانية',
  status: 'APPROVED', contactId: 'c1', projectId: null, branchId: null, currency: 'SAR', taxRate: '15',
  notes: 'الأسعار مبنية على عروض موردين سارية 30 يومًا · نسبة الطوارئ 3% مضمّنة في التكاليف الأخرى.',
  version: 1, rootId: null, convertedQuoteId: null, approvedAt: '2026-09-07T09:00:00Z', approvedById: 'visual-user',
  createdAt: '2026-09-05T07:30:00Z', defaultMarginPct: '18',
  costTotal: '2163034.454', saleSubtotal: '2637846.03', taxTotal: '395676.9', saleTotal: '3033522.93', marginPct: '18.0000',
  contact: { id: 'c1', displayName: contact.displayName }, quote: null, _count: { lines: 8 },
}
const estimateRow2 = {
  ...estimateRow, id: 'est-2', number: 'EST-202609-0043-V02', title: 'دراسة توريد وتركيب أنظمة الإنذار المبكر',
  status: 'DRAFT', costTotal: '184320.5', saleSubtotal: '212102.6', taxTotal: '31815.39', saleTotal: '243917.99',
  marginPct: '13.1000', createdAt: '2026-09-06T11:15:00Z', _count: { lines: 3 },
}
const estimateFull = { ...estimateRow, lines: Array.from({ length: 8 }, (_, i) => line(i + 1)), sections: [
  { section: 'أعمال التكييف والتهوية · HVAC', cost: 1081517.23, sale: 1318923.02, marginPct: 18 },
  { section: 'أعمال الكهرباء والتيار الخفيف', cost: 1081517.22, sale: 1318923.01, marginPct: 18 },
] }

const planTemplate = {
  id: 'plan-tpl-1', orgId: visualOrgId, name: 'دفعة أولى · مستخلصات مرحلية · عند التسليم', isTemplate: true, quoteId: null,
  items: [
    { id: 'i1', sortOrder: 0, label: 'دفعة أولى عند التوقيع', percent: '10', amount: '0', condition: 'SIGNATURE', conditionValue: null, billingMethod: 'INVOICE', dueDate: null },
    { id: 'i2', sortOrder: 1, label: 'مستخلصات مرحلية حسب نسبة الإنجاز', percent: '75', amount: '0', condition: 'PROGRESS', conditionValue: '100', billingMethod: 'PROGRESS_CLAIM', dueDate: null },
    { id: 'i3', sortOrder: 2, label: 'عند التسليم النهائي', percent: '15', amount: '0', condition: 'DELIVERY', conditionValue: null, billingMethod: 'INVOICE', dueDate: null },
  ],
}
const quotePlan = {
  id: 'plan-1', orgId: visualOrgId, name: 'خطة الدفعات', isTemplate: false, quoteId: 'q1',
  items: planTemplate.items.map((i, idx) => ({ ...i, id: `qi${idx}`, amount: [303352.29, 2275142.2, 455028.44][idx].toString() })),
}
const quote = {
  id: 'q1', orgId: visualOrgId, contactId: 'c1', quoteNumber: 'SP-Q-202609-0042', status: 'DRAFT',
  issueDate: '2026-09-07', validUntil: '2026-10-07', currency: 'SAR', subtotal: '2637846.03', taxTotal: '395676.90',
  discountTotal: '0', total: '3033522.93', notes: null, termsConditions: null, reference: 'EST-202609-0042',
  templateId: null, title: 'مركز البيانات الإقليمي · المرحلة الثانية', estimateId: 'est-1',
  estimate: { id: 'est-1', number: 'EST-202609-0042', title: estimateRow.title, version: 1 },
  paymentPlan: quotePlan, contact: { id: 'c1', displayName: contact.displayName },
  lines: [{ id: 'l1', description: 'BOQ-04-001 · توريد وتركيب وحدة مناولة هواء AHU سعة 20 طن تبريد', quantity: '12', unitPrice: '278799.485', discount: '0', subtotal: '3845932.89', unit: 'وحدة', sectionLabel: 'أعمال التكييف والتهوية · HVAC', sortOrder: 0 }],
}

async function mocks(page: Page, lang: 'ar' | 'en') {
  await prepareVisualApp(page, lang)
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    const m = route.request().method()
    if (pathname === '/orgs') return route.fulfill({ json: [org] })
    if (pathname === '/api/estimates' && m === 'GET') return route.fulfill({ json: { items: [estimateRow, estimateRow2], total: 2, confidentialHidden: false } })
    if (pathname === '/api/estimates' && m === 'POST') return route.fulfill({ status: 201, json: { ...estimateFull, id: 'est-new', number: 'EST-202609-0044', status: 'DRAFT' } })
    if (pathname === '/api/estimates/est-1') return route.fulfill({ json: estimateFull })
    if (pathname === '/api/payment-plans/templates') return route.fulfill({ json: { items: [planTemplate], total: 1 } })
    if (pathname === '/api/quotes/q1') return route.fulfill({ json: quote })
    if (pathname === '/api/quotes' && m === 'GET') return route.fulfill({ json: { items: [quote], total: 1 } })
    if (pathname === '/api/contacts') return route.fulfill({ json: { items: [contact], total: 1, page: 1, limit: 200 } })
    if (pathname === '/api/document-templates/defaults') return route.fulfill({ json: { QUOTE: null, INVOICE: null } })
    if (pathname === '/api/document-templates') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/branches') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/projects') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/tax-rates') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/bank-accounts') return route.fulfill({ json: { items: [], total: 0, totalBalance: 0 } })
    return route.fallback()
  })
}

test('estimates list renders numbers · customer · cost · sale · margin', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/estimates')
  await expect(page.getByRole('heading', { name: 'الدراسة والتسعير' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'EST-202609-0042' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'EST-202609-0043-V02' })).toBeVisible()
  await expect(page.locator('td').filter({ hasText: 'AL-ASASYAH BASIC ELECTRONICS' }).first()).toBeVisible()
  // cost column is present for a financial role (OWNER)
  await expect(page.getByRole('columnheader', { name: 'التكلفة' })).toBeVisible()
  await expect(page.getByText('2,163,034.45').first()).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/estimates-list-ar.png`, fullPage: true })
})

test('editor computes the unit price from costs + margin', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/app/estimates/new')
  await page.getByTestId('estimate-title').fill('دراسة اختبار الحساب')
  await page.locator('[data-field="description"][data-row="0"]').fill('بند اختبار')
  await page.locator('[data-field="quantity"][data-row="0"]').fill('3')
  await page.locator('[data-field="materialCost"][data-row="0"]').fill('1000')
  await page.locator('[data-field="labourCost"][data-row="0"]').fill('500')
  await page.locator('[data-field="otherCost"][data-row="0"]').fill('100')
  await page.locator('[data-field="marginPct"][data-row="0"]').fill('20')
  // unit cost 1600.00 · +20% → 1920.00 · × 3 → 5760.00
  await expect(page.getByTestId('estimate-unit-cost-0')).toHaveText('1,600.00')
  await expect(page.getByTestId('estimate-unit-price-0')).toHaveText('1,920.00')
  await expect(page.getByTestId('estimate-line-total-0')).toHaveText('5,760.00')
  // locking the price freezes it against a margin change
  await page.getByTestId('estimate-lock-0').click()
  await page.getByTestId('estimate-unit-price-0').fill('2000')
  await expect(page.getByTestId('estimate-line-total-0')).toHaveText('6,000.00')
})

test('conversion strip states the copy law · price only', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/app/estimates/est-1')
  await expect(page.getByTestId('estimate-title')).toHaveValue(/مركز البيانات/)
  await page.getByTestId('estimate-convert').click()
  const strip = page.getByTestId('estimate-convert-confirm')
  await expect(strip).toContainText('سيُنسخ إلى العرض: رقم البند · البند والمواصفات · الكمية · سعر الوحدة · الإجمالي فقط — لا تُنسخ التكلفة ولا نسبة الربح')
  await page.screenshot({ path: `${SHOTS}/estimate-convert-confirm-ar.png`, fullPage: true })
})

test('estimate editor · 8 lines · ar and en', async ({ page }) => {
  for (const lang of ['ar', 'en'] as const) {
    await mocks(page, lang)
    await page.setViewportSize({ width: 1920, height: 1100 })
    await page.goto('/app/estimates/est-1')
    await expect(page.getByTestId('estimate-line-grid')).toBeVisible()
    await expect(page.locator('[data-field="description"]')).toHaveCount(8)
    await expect(page.getByTestId('estimate-summary')).toBeVisible()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/estimate-editor-8-lines-${lang}.png`, fullPage: true })
  }
})

test('payment plan · percent guard blocks the plan, not the quote', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1600, height: 1800 })
  await page.goto('/app/quotes?new=1')
  const section = page.getByTestId('quote-payment-plan')
  await expect(section).toBeVisible()
  await page.getByTestId('quote-plan-add').click()
  await page.getByTestId('quote-plan-add').click()
  await page.getByTestId('quote-plan-label-0').fill('دفعة أولى عند التوقيع')
  await page.getByTestId('quote-plan-percent-0').fill('40')
  await page.getByTestId('quote-plan-label-1').fill('الدفعة النهائية عند التسليم')
  await page.getByTestId('quote-plan-percent-1').fill('40')
  await expect(page.getByTestId('quote-plan-guard')).toBeVisible()
  await page.getByTestId('quote-plan-percent-1').fill('60')
  await expect(page.getByTestId('quote-plan-guard')).toHaveCount(0)
  await expect(page.getByTestId('quote-plan-sum')).toContainText('100.00%')
  await section.scrollIntoViewIfNeeded()
  await section.screenshot({ path: `${SHOTS}/quote-payment-plan-ar.png` })
})

test('quote page · payment plan from the stored schedule + estimate origin link', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1600, height: 1500 })
  await page.goto('/app/quotes/q1')
  await expect(page.getByTestId('quote-estimate-link')).toContainText('EST-202609-0042')
  await expect(page.getByTestId('quote-plan-label-1')).toHaveValue('مستخلصات مرحلية حسب نسبة الإنجاز')
  await expect(page.getByTestId('quote-plan-sum')).toContainText('100.00%')
  await page.getByTestId('quote-payment-plan').scrollIntoViewIfNeeded()
  await page.getByTestId('quote-payment-plan').screenshot({ path: `${SHOTS}/quote-detail-payment-plan-ar.png` })
})

test('printed proposal shows the stored payment schedule', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/print/proposal/q1?noprint=1')
  await page.waitForSelector('.edoc .sheet', { timeout: 20000 })
  await page.waitForTimeout(1000)
  await expect(page.locator('.edoc').getByText('جدول السداد').first()).toBeVisible()
  await expect(page.locator('.edoc table.plan')).toContainText('مستخلصات مرحلية حسب نسبة الإنجاز')
  const sheet = page.locator('.edoc .sheet').filter({ hasText: 'جدول السداد' }).first()
  await sheet.screenshot({ path: `${SHOTS}/quote-print-payment-plan-ar.png` })
})

test('overflow audit · estimates + quote editor · 1024/1280/1440/1920 · ar + en', async ({ page }) => {
  test.setTimeout(240_000)
  const routes = ['/app/estimates', '/app/estimates/new', '/app/quotes?new=1']
  for (const lang of ['ar', 'en'] as const) {
    await mocks(page, lang)
    for (const route of routes) {
      await page.goto(route)
      await page.waitForTimeout(400)
      for (const width of AUDIT_WIDTHS) {
        await page.setViewportSize({ width, height: 1000 })
        await page.waitForTimeout(250)
        const hits = await auditOverflow(page)
        if (hits.length) console.log(`${lang} ${route} @${width}`, JSON.stringify(hits, null, 1))
        expect(hits, `${lang} ${route} @${width}`).toEqual([])
      }
    }
  }
})
