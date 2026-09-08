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
