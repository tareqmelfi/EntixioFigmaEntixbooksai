import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import { prepareVisualApp } from './fixtures/visual-app'
import { mockRestApi } from './fixtures/rest-mocks'
import { auditOverflow, AUDIT_WIDTHS, type OverflowHit } from './fixtures/overflow-audit'

/**
 * Overflow audit · every /app page outside Sales & Purchases (CEO 2026-09-08 ·
 * «راجع كل المربعات بلا استثناء»). Each page is loaded with deliberately long
 * mock data (32-char ids, bilingual legal names, 7-digit amounts, mixed
 * currencies) in Arabic and English at 1024 / 1280 / 1440 / 1920 and must
 * produce ZERO overflow hits — no cell painting over its neighbour, no card
 * spilling its grid track, no horizontal page scroll.
 *
 * Filter while iterating: ROUTES=/app/contacts,/app/products npx playwright test tests/overflow-rest.spec.ts -c zz-pw.config.ts
 * Screenshots: SHOTS=1 writes /tmp/claude-0/shots/rest/<route>-<lang>-<w>.png
 */
export const REST_ROUTES = [
  '/app/dashboard', '/app/ai', '/app/scan-receipts', '/app/inbox', '/app/accounting', '/app/chart-of-accounts', '/app/journal-entries', '/app/taxes',
  '/app/bank-accounts', '/app/bank-accounts/new', '/app/bank-accounts/ba_ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy_0', '/app/bank-reconciliation', '/app/fiscal-periods',
  '/app/assets', '/app/assets/new', '/app/assets/fa_1', '/app/investments', '/app/investments/new', '/app/investments/iw_1', '/app/investments/iw_1/transactions/new',
  '/app/shareholders', '/app/shareholders/new', '/app/shareholders/sh_1', '/app/share-transactions/new',
  '/app/cost-centers', '/app/cost-centers/new', '/app/cost-centers/cc_1', '/app/projects', '/app/projects/new', '/app/projects/pr_1',
  '/app/contractors', '/app/contractors/new', '/app/contractors/ct_1', '/app/contractors/ct_1/pay', '/app/work-logs/new',
  '/app/branches', '/app/branches/new', '/app/branches/br_1', '/app/products', '/app/products/new', '/app/products/pd_1',
  '/app/inventory', '/app/warehouses', '/app/stock-movements', '/app/inventory/warehouses/new', '/app/inventory/counts', '/app/inventory/counts/sc_1', '/app/inventory/transfers', '/app/inventory/transfers/st_1', '/app/inventory/movements/new',
  '/app/payroll', '/app/payroll/pay_1', '/app/employees', '/app/employees/new', '/app/contacts', '/app/contacts/c_1',
  '/app/partners', '/app/integrations', '/app/integrations/plaid', '/app/templates', '/app/templates/new', '/app/templates/tp_1',
  '/app/reports', '/app/reports/balance-sheet', '/app/reports/profit-loss', '/app/settings', '/app/settings?tab=zatca', '/app/help', '/app/billing', '/app/onboarding', '/app/system-status', '/app/notifications', '/app/roadmap',
]

const only = (process.env.ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean)
const routes = only.length ? REST_ROUTES.filter((r) => only.includes(r)) : REST_ROUTES
const langs = (process.env.LANGS || 'ar,en').split(',') as Array<'ar' | 'en'>
const shots = !!process.env.SHOTS
const shotDir = '/tmp/claude-0/shots/rest'

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }, baseURL: process.env.BASE_URL || 'http://localhost:5182' })

for (const lang of langs) {
  test(`rest pages · zero overflow · ${lang}`, async ({ page }) => {
    test.setTimeout(routes.length * 4 * 6000 + 60_000)
    await page.route(/^(?!https?:\/\/(localhost|api\.entix\.io))/, (r) => r.abort())
    await prepareVisualApp(page, lang)
    await mockRestApi(page)
    if (shots) fs.mkdirSync(shotDir, { recursive: true })
    const report: Record<string, OverflowHit[]> = {}
    for (const route of routes) {
      for (const width of AUDIT_WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(route, { waitUntil: 'load', timeout: 20_000 }).catch(() => {})
        await page.waitForTimeout(900)
        const hits = await auditOverflow(page)
        if (hits.length) report[`${route} · ${lang} · ${width}`] = hits
        if (shots) await page.screenshot({ path: `${shotDir}/${route.replace(/[^a-z0-9]+/gi, '_')}-${lang}-${width}.png`, fullPage: true })
      }
    }
    const summary = Object.entries(report).map(([k, v]) => `${k}\n${v.map((h) => `   ${h.kind} +${Math.round(h.by)}px · ${h.path} · «${h.text}»`).join('\n')}`).join('\n')
    if (summary) console.log(summary)
    expect(summary, 'overflow hits').toBe('')
  })
}
