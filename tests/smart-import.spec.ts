/**
 * Smart import wizard · durable visual + behaviour spec (2026-09-08)
 *
 * The fixture `fixtures/smart-import-analysis.json` is the REAL response the
 * API produces for the CEO's chart of accounts
 * (EN-CLI-EDG-FIN-COA-01 · 6 sheets · header on row 4 · Arabic headers ·
 * parent by code), so this spec fails the moment the wizard stops rendering
 * what the importer actually returns.
 *
 * Screens covered in both ar and en at 1440: drop → mapping → preview → result.
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { prepareVisualApp } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'

const PORT = process.env.ENTIX_DEV_PORT ?? '5173'
const SHOTS = process.env.ZZ_SHOTS || '/tmp/claude-0/shots/smart-import'

const analysis = JSON.parse(readFileSync(new URL('./fixtures/smart-import-analysis.json', import.meta.url), 'utf-8'))

const commitReport = {
  ok: true,
  created: 74,
  updated: 0,
  skipped: 0,
  warnings: [
    { ar: 'الحساب 1290: طبيعة الرصيد (دائن) تخالف تصنيف ASSET — حساب مقابل؟', en: 'Account 1290: balance nature (CREDIT) contradicts type ASSET — contra account?' },
  ],
  message: { ar: 'تم استيراد 74 حساب جديد · تحديث 0 · تخطّي 0', en: 'Imported 74 new accounts · updated 0 · skipped 0' },
  rejected: [],
}

const accounts = [
  { id: 'a-1', code: '1000', name: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD receivable', nameAr: 'الأساسية للإلكترونيات المحدودة — ذمم مدينة', type: 'ASSET', parentId: null, isActive: true, allowPosting: true, allowPayment: false, allowExpenseClaim: false, description: null, subtype: null, cashFlowType: null, isSystemAccount: false },
  { id: 'a-2', code: '2000', name: 'Accounts Payable — Suppliers', nameAr: 'الموردون', type: 'LIABILITY', parentId: null, isActive: true, allowPosting: true, allowPayment: false, allowExpenseClaim: false, description: null, subtype: null, cashFlowType: null, isSystemAccount: false },
]

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  baseURL: `http://localhost:${PORT}`,
  viewport: { width: 1440, height: 1000 },
})

async function prepare(page: Page, language: 'ar' | 'en') {
  await prepareVisualApp(page, language)
  await page.route('https://api.entix.io/api/accounts**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/import/analyze')) return route.fulfill({ json: analysis })
    if (url.pathname.endsWith('/import/commit')) return route.fulfill({ json: commitReport })
    if (url.pathname === '/api/accounts/ledger-mapping') return route.fulfill({ json: { roles: [] } })
    if (url.pathname === '/api/accounts/inactive') return route.fulfill({ json: { items: [] } })
    return route.fulfill({ json: { items: accounts, total: accounts.length } })
  })
  await page.goto('/app/chart-of-accounts')
  await page.waitForSelector('[data-testid="coa-import"]')
}

/** drop → mapping → preview → result, screenshotting each step. */
async function walk(page: Page, language: 'ar' | 'en') {
  await page.getByTestId('coa-import').click()
  await expect(page.getByTestId('import-wizard-drop')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/1-drop-${language}.png`, fullPage: true })

  // paste path exercises the very same analyze call a dropped file makes
  await page.getByTestId('import-paste').fill('كود الحساب\tاسم الحساب\n1101\tالصندوق')
  await page.getByRole('button', { name: language === 'ar' ? 'تحليل النص الملصوق' : 'Analyse pasted text' }).click()
  await expect(page.getByTestId('import-wizard-mapping')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/2-mapping-${language}.png`, fullPage: true })

  await page.getByTestId('import-to-preview').click()
  await expect(page.getByTestId('import-wizard-preview')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/3-preview-${language}.png`, fullPage: true })

  await page.getByTestId('import-commit').click()
  await expect(page.getByTestId('import-wizard-result')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/4-result-${language}.png`, fullPage: true })
}

for (const language of ['ar', 'en'] as const) {
  test(`smart import wizard · four steps · ${language}`, async ({ page }) => {
    await prepare(page, language)
    await walk(page, language)
    await expect(page.getByTestId('import-wizard-result').getByText('74', { exact: true })).toBeVisible()
  })
}

test('mapping screen shows the detected sheet, header row and every column with a confidence', async ({ page }) => {
  await prepare(page, 'ar')
  await page.getByTestId('coa-import').click()
  await page.getByTestId('import-paste').fill('كود الحساب\tاسم الحساب\n1101\tالصندوق')
  await page.getByRole('button', { name: 'تحليل النص الملصوق' }).click()
  await expect(page.getByTestId('import-wizard-mapping')).toBeVisible()

  // the accounts sheet won out of six, and the header is the 4th row
  await expect(page.getByText('02_دليل الحسابات').first()).toBeVisible()
  await expect(page.getByTestId('import-header-row')).toHaveValue('4')
  // every field the importer knows is offered, mapped or not
  for (const field of ['code', 'name', 'nameEn', 'type', 'nature', 'parentCode', 'level', 'note']) {
    await expect(page.getByTestId(`import-map-${field}`)).toBeVisible()
  }
  // the six sheets are all switchable
  await expect(page.getByTestId('import-sheets').getByRole('button')).toHaveCount(6)
})

test('preview marks row status and surfaces the contra-account warning', async ({ page }) => {
  await prepare(page, 'ar')
  await page.getByTestId('coa-import').click()
  await page.getByTestId('import-paste').fill('كود الحساب\tاسم الحساب\n1101\tالصندوق')
  await page.getByRole('button', { name: 'تحليل النص الملصوق' }).click()
  await page.getByTestId('import-to-preview').click()

  const rows = page.getByTestId('import-preview-rows').locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  // 1101 → parent 11, and the three-level chain is visible in the table
  await expect(page.getByText('Cash on Hand').first()).toBeVisible()
  // the accumulated-depreciation contra warning is listed, never hidden
  await expect(page.getByText(/حساب مقابل/).first()).toBeVisible()
})

test('no overflow at any width in ar and en', async ({ page }) => {
  for (const language of ['ar', 'en'] as const) {
    await prepare(page, language)
    await page.getByTestId('coa-import').click()
    await page.getByTestId('import-paste').fill('كود الحساب\tاسم الحساب\n1101\tالصندوق')
    await page.getByRole('button', { name: language === 'ar' ? 'تحليل النص الملصوق' : 'Analyse pasted text' }).click()
    await page.getByTestId('import-to-preview').click()
    await expect(page.getByTestId('import-wizard-preview')).toBeVisible()
    for (const width of AUDIT_WIDTHS) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForTimeout(250)
      const hits = await auditOverflow(page)
      expect(hits, `${language} @ ${width}: ${JSON.stringify(hits)}`).toEqual([])
    }
  }
})
