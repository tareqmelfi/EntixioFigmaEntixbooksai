/**
 * PL1/PL2 · project ↔ document linking + settings-driven numbering.
 *
 * Locks down the three behaviours the CEO asked for:
 *   1. the link picker only offers the chosen client's documents
 *   2. the numbering preview follows the pattern as it is edited
 *   3. the project code arrives prefilled and stays editable
 * plus the overflow audit at 1024/1280/1440/1920 in ar + en.
 */
import { test, expect, type Page } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  baseURL: 'http://localhost:5188',
})

const EDG = {
  id: 'con_3U8oafB2CpMkgB7N1hKuhpUy',
  displayName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة',
  shortCode: 'EDG',
  entityKind: 'COMPANY',
  email: 'accounts@al-asasyah.example',
  country: 'SA',
}
const OTHER = {
  id: 'con_9Zq1mVvT4RnLpXcW7bYd2eKs',
  displayName: 'NORTHERN GULF CONTRACTING EST. / مؤسسة شمال الخليج للمقاولات',
  shortCode: 'NGC',
  entityKind: 'COMPANY',
  email: 'ap@northern-gulf.example',
  country: 'SA',
}

const EDG_QUOTES = [
  { id: 'qte_1', number: 'EN-QTE-202609-0004', date: '2026-09-02T00:00:00.000Z', total: '2163034.4540', status: 'SENT', currency: 'SAR', contactId: EDG.id },
  { id: 'qte_2', number: 'EN-QTE-202608-0011', date: '2026-08-19T00:00:00.000Z', total: '48250.0000', status: 'ACCEPTED', currency: 'USD', contactId: EDG.id },
]
const EDG_ESTIMATES = [
  { id: 'est_1', number: 'EST-202609-0002', date: '2026-09-01T00:00:00.000Z', total: '1410000.00', status: 'APPROVED', currency: 'SAR', contactId: EDG.id, title: 'دراسة تكاليف المرحلة الأولى — أعمال الكهرباء والتيار الخفيف' },
]
const EDG_INVOICES = [
  { id: 'inv_1', number: 'EN-INV-202609-0009', date: '2026-09-05T00:00:00.000Z', total: '763120.9900', status: 'SENT', currency: 'SAR', contactId: EDG.id },
]
const OTHER_QUOTES = [
  { id: 'qte_other', number: 'EN-QTE-202609-0007', date: '2026-09-03T00:00:00.000Z', total: '99000.0000', status: 'DRAFT', currency: 'SAR', contactId: OTHER.id },
]

/** Routes for the project pages. Registered BEFORE prepareVisualApp's catch-all wins. */
async function mockProjectApi(page: Page) {
  await page.route('https://api.entix.io/api/contacts**', (route) =>
    route.fulfill({ json: { items: [EDG, OTHER], total: 2, page: 1, limit: 200 } }))

  // Playwright matches the LAST registered route first — the broad /api/projects**
  // handler goes in first so the two specific ones below still win.
  await page.route('https://api.entix.io/api/projects**', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }))

  await page.route('https://api.entix.io/api/projects/next-code**', (route) => {
    const contactId = new URL(route.request().url()).searchParams.get('contactId')
    return route.fulfill({ json: { code: contactId === EDG.id ? 'EDG-PRJ-0007' : 'PRJ-0007' } })
  })

  await page.route('https://api.entix.io/api/projects/linkable**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const kind = params.get('kind')
    const contactId = params.get('contactId')
    // The server scopes by contact; the mock does the same so the test proves the
    // FE actually sends the client it picked.
    const byKind: Record<string, any[]> = {
      QUOTE: contactId === EDG.id ? EDG_QUOTES : contactId === OTHER.id ? OTHER_QUOTES : [],
      ESTIMATE: contactId === EDG.id ? EDG_ESTIMATES : [],
      INVOICE: contactId === EDG.id ? EDG_INVOICES : [],
    }
    return route.fulfill({ json: { items: byKind[kind || ''] || [], contactId } })
  })
}

async function mockNumberingApi(page: Page) {
  let stored: any = { entityCode: 'EN', project: { prefix: 'PRJ-', padding: 4, start: 1 } }
  await page.route(`https://api.entix.io/orgs/${visualOrgId}/numbering`, async (route) => {
    if (route.request().method() === 'PATCH') {
      stored = route.request().postDataJSON()
      return route.fulfill({ json: stored })
    }
    return route.fulfill({ json: stored })
  })
  await page.route(`https://api.entix.io/orgs/${visualOrgId}`, (route) =>
    route.fulfill({ json: { id: visualOrgId, name: 'Visual Test Company', slug: 'visual-test-co', country: 'US', baseCurrency: 'USD' } }))
}

test.describe('project ↔ document linking', () => {
  test('the link picker only offers the chosen client documents', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockProjectApi(page)
    await page.goto('/app/projects/new')

    const section = page.getByTestId('project-link-section')
    await expect(section).toBeVisible()
    // No client yet → nothing to offer.
    await expect(section).toContainText('اختر العميل أولاً')

    await page.getByTestId('project-client-field').getByRole('textbox').first().fill('NORTHERN')
    await page.getByText(OTHER.displayName, { exact: false }).first().click()

    const quotePicker = page.getByTestId('project-link-picker-QUOTE')
    await expect(quotePicker).toBeVisible()
    await quotePicker.getByRole('button').first().click()
    // The other client's quote is offered; EDG's are not.
    await expect(page.getByText('EN-QTE-202609-0007')).toBeVisible()
    await expect(page.getByText('EN-QTE-202609-0004')).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  test('a picked document is staged with its own figures and can be removed', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockProjectApi(page)
    await page.goto('/app/projects/new')

    await page.getByTestId('project-client-field').getByRole('textbox').first().fill('ASASYAH')
    await page.getByText(EDG.displayName, { exact: false }).first().click()

    const quotePicker = page.getByTestId('project-link-picker-QUOTE')
    await quotePicker.getByRole('button').first().click()
    await page.getByText('EN-QTE-202609-0004').first().click()

    const list = page.getByTestId('project-links-list')
    await expect(list).toContainText('EN-QTE-202609-0004')
    // the document's own total, 2 decimals, number first
    await expect(list).toContainText('2,163,034.45')
    await expect(list).toContainText('يُربط عند الحفظ')

    await list.getByRole('button', { name: 'إزالة' }).click()
    await expect(page.getByTestId('project-links-list')).toHaveCount(0)
  })

  test('the project code is prefilled from numbering and stays editable', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockProjectApi(page)
    await page.goto('/app/projects/new')

    const code = page.getByTestId('project-code-input')
    await expect(code).toHaveValue('PRJ-0007')
    await expect(page.getByTestId('project-code-auto-chip')).toBeVisible()

    // Picking the client re-runs the suggestion → the client code leads.
    await page.getByTestId('project-client-field').getByRole('textbox').first().fill('ASASYAH')
    await page.getByText(EDG.displayName, { exact: false }).first().click()
    await expect(code).toHaveValue('EDG-PRJ-0007')

    // Typing a custom code is allowed and drops the «تلقائي» chip.
    await code.fill('CLIENT-OWN-CODE-2026')
    await expect(code).toHaveValue('CLIENT-OWN-CODE-2026')
    await expect(page.getByTestId('project-code-auto-chip')).toHaveCount(0)
  })
})

test.describe('contact code', () => {
  test('a new contact gets its code prefilled and can still type their own', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    // broad handler first — Playwright matches the LAST registered route first
    await page.route('https://api.entix.io/api/contacts**', (route) =>
      route.fulfill({ json: { items: [], total: 0, page: 1, limit: 200 } }))
    await page.route('https://api.entix.io/api/contacts/_/next-code', (route) =>
      route.fulfill({ json: { customCode: 'EN-CON-0042' } }))

    await page.goto('/app/contacts')
    await page.getByRole('button', { name: 'إضافة جهة' }).first().click()
    // step 1 (type) → step 2 (details) holds the code field
    await page.getByRole('button', { name: 'التالي' }).first().click()

    const code = page.getByTestId('contact-code-input')
    await expect(code).toHaveValue('EN-CON-0042')
    await expect(page.getByTestId('contact-code-auto-chip')).toBeVisible()

    await code.fill('EDG-CLI-001')
    await expect(code).toHaveValue('EDG-CLI-001')
    await expect(page.getByTestId('contact-code-auto-chip')).toHaveCount(0)
  })
})

test.describe('automatic numbering settings', () => {
  test('the preview follows the prefix, the client-code switch and a free pattern', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockNumberingApi(page)
    await page.goto('/app/settings?tab=numbering')

    const preview = page.getByTestId('numbering-preview-project')
    await expect(preview).toHaveText('PRJ-0001')

    await page.getByTestId('numbering-prefix-project').fill('PROJECT-')
    await expect(preview).toHaveText('PROJECT-0001')

    // «أدرج رمز العميل» → the client code leads, exactly as the CEO described.
    await page.getByTestId('numbering-client-code-project').click()
    await expect(preview).toHaveText('EDG-PROJECT-0001')

    await page.getByTestId('numbering-start-project').fill('7')
    await expect(preview).toHaveText('EDG-PROJECT-0007')

    // A free pattern wins over the switches.
    await page.getByTestId('numbering-pattern-project').fill('{clientCode}/{prefix}{YYYY}-{seq}')
    const year = String(new Date().getFullYear())
    await expect(preview).toHaveText(`EDG/PROJECT-${year}-0007`)
  })
})


// ── SPEC-05 L3 · post-award surface on a saved project ──────────────────────

const PROJECT = {
  id: 'prj_7HmQ2xNvKdLpR8sTwYbZ', code: 'EDG-PRJ-0007',
  name: 'توسعة مبنى العمليات — أعمال الكهرباء والتيار الخفيف / Operations Building Expansion',
  status: 'ACTIVE', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z',
  clientContactId: EDG.id, budget: '1850000.00', contractValue: '2163034.45',
  retentionPct: '10.00', percentComplete: '34.00',
}
const BUDGET_DRAFT = {
  id: 'bud_1', projectId: PROJECT.id, estimateId: 'est_1', status: 'DRAFT', costTotal: '84000.00',
  lines: [
    { id: 'bl_1', sortOrder: 0, itemNo: '1.1', description: 'كابل نحاس 4×16مم — مسار رئيسي من لوحة التوزيع حتى غرفة المعدات', unit: 'م', quantity: '1200.0000', unitCost: '50.0000', plannedCost: '60000.00' },
    { id: 'bl_2', sortOrder: 1, itemNo: '1.2', description: 'لوحة توزيع رئيسية', unit: 'عدد', quantity: '3.0000', unitCost: '8000.0000', plannedCost: '24000.00' },
  ],
}
const PLAN = {
  id: 'plan_1', name: '10 / 75 / 15', isTemplate: false, quoteId: 'qte_1',
  items: [
    { id: 'ppi_1', sortOrder: 0, label: 'دفعة أولى عند التوقيع', percent: '10.0000', amount: '216303.45', status: 'DUE', invoiceId: null },
    { id: 'ppi_2', sortOrder: 1, label: 'مستخلصات مرحلية حسب المنجز', percent: '75.0000', amount: '1622275.84', status: 'PENDING', invoiceId: null },
    { id: 'ppi_3', sortOrder: 2, label: 'الدفعة الأخيرة عند التسليم', percent: '15.0000', amount: '324455.16', status: 'PENDING', invoiceId: 'inv_paid' },
  ],
}

/** Mocks for a SAVED project: links, cost budget, payment plan, purchase orders. */
async function mockSavedProject(page: Page, opts: { budget?: any; orders?: any[] } = {}) {
  await mockProjectApi(page)
  await page.route(`https://api.entix.io/api/projects/${PROJECT.id}`, (r) => r.fulfill({ json: PROJECT }))
  await page.route(`https://api.entix.io/api/projects/${PROJECT.id}/links`, (r) => r.fulfill({
    json: { items: [{ id: 'lnk_1', kind: 'QUOTE', documentId: 'qte_1', document: EDG_QUOTES[0] }], total: 1 },
  }))
  await page.route(`https://api.entix.io/api/projects/${PROJECT.id}/budget`, (r) =>
    r.fulfill({ json: opts.budget === undefined ? BUDGET_DRAFT : opts.budget }))
  await page.route('https://api.entix.io/api/payment-plans**', (r) => r.fulfill({ json: { items: [PLAN], total: 1 } }))
  await page.route('https://api.entix.io/api/purchase-orders**', (r) => r.fulfill({ json: { items: opts.orders || [], total: (opts.orders || []).length } }))
  await page.route('https://api.entix.io/api/contractors**', (r) => r.fulfill({ json: { items: [], total: 0 } }))
}

test.describe('SPEC-05 L3 · after the award', () => {
  test('the cost budget shows cost only — no sale price, no margin', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockSavedProject(page)
    await page.goto(`/app/projects/${PROJECT.id}`)

    const card = page.getByTestId('project-cost-budget')
    await expect(card).toBeVisible()
    await expect(card).toContainText('بلا سعر بيع أو نسبة ربح')
    await expect(page.getByTestId('budget-cost-total')).toHaveText('84,000.00 SAR')
    // the estimate's sale figures (unitPrice 62.50 · lineTotal 75,000) must not appear
    await expect(card).not.toContainText('75,000.00')
    await expect(card).not.toContainText('62.50')
    // a DRAFT budget offers approval, not a purchase order
    await expect(page.getByTestId('approve-budget')).toBeVisible()
    await expect(page.getByTestId('issue-po')).toHaveCount(0)
  })

  test('an approved budget is the ceiling and unlocks the purchase order', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockSavedProject(page, { budget: { ...BUDGET_DRAFT, status: 'APPROVED' }, orders: [
      { id: 'po_1', number: 'PO-0004', status: 'ISSUED', currency: 'SAR', issueDate: '2026-09-08T00:00:00.000Z', total: '20000.00', lines: [] },
    ] })
    await page.goto(`/app/projects/${PROJECT.id}`)

    await expect(page.getByTestId('project-cost-budget')).toContainText('معتمدة · سقف الصرف')
    await expect(page.getByTestId('issue-po')).toBeVisible()
    await expect(page.getByTestId('approve-budget')).toHaveCount(0)
    await expect(page.getByTestId('project-purchase-orders')).toContainText('PO-0004')
  })

  test('an instalment offers accountant approval until it is invoiced', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockSavedProject(page)
    await page.goto(`/app/projects/${PROJECT.id}`)

    const plan = page.getByTestId('project-payment-plan')
    await expect(plan).toContainText('لا تصدر فاتورة الدفعة إلا باعتماد المحاسب')
    await expect(page.getByTestId('invoice-item-ppi_1')).toBeVisible()
    // the already-invoiced instalment shows its state instead of the action
    await expect(page.getByTestId('invoice-item-ppi_3')).toHaveCount(0)
    await expect(page.getByTestId('plan-item-ppi_3')).toContainText('مفوترة')
  })
})

test.describe('overflow audit', () => {
  for (const locale of ['ar', 'en'] as const) {
    test(`project form · new · ${locale}`, async ({ page }) => {
      await prepareVisualApp(page, locale)
      await mockProjectApi(page)
      await page.goto('/app/projects/new')
      await page.getByTestId('project-client-field').getByRole('textbox').first().fill('ASASYAH')
      await page.getByText(EDG.displayName, { exact: false }).first().click()
      await page.getByTestId('project-link-picker-QUOTE').getByRole('button').first().click()
      await page.getByText('EN-QTE-202609-0004').first().click()
      for (const width of AUDIT_WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(250)
        const hits = await auditOverflow(page)
        expect(hits, `${locale} @ ${width}: ${JSON.stringify(hits, null, 2)}`).toEqual([])
      }
    })

    test(`project page · saved · ${locale}`, async ({ page }) => {
      await prepareVisualApp(page, locale)
      await mockSavedProject(page, { budget: { ...BUDGET_DRAFT, status: 'APPROVED' }, orders: [
        { id: 'po_1', number: 'PO-0004', status: 'ISSUED', currency: 'SAR', issueDate: '2026-09-08T00:00:00.000Z', total: '20000.00', lines: [] },
      ] })
      await page.goto(`/app/projects/${PROJECT.id}`)
      await page.getByTestId('project-cost-budget').waitFor()
      for (const width of AUDIT_WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(250)
        const hits = await auditOverflow(page)
        expect(hits, `${locale} @ ${width}: ${JSON.stringify(hits, null, 2)}`).toEqual([])
      }
    })

    test(`numbering settings · ${locale}`, async ({ page }) => {
      await prepareVisualApp(page, locale)
      await mockNumberingApi(page)
      await page.goto('/app/settings?tab=numbering')
      await expect(page.getByTestId('numbering-kind-project')).toBeVisible()
      for (const width of AUDIT_WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(250)
        const hits = await auditOverflow(page)
        expect(hits, `${locale} @ ${width}: ${JSON.stringify(hits, null, 2)}`).toEqual([])
      }
    })
  }
})
