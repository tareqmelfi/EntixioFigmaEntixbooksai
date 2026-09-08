import { test } from '@playwright/test'
import * as fs from 'node:fs'
import { prepareVisualApp } from './fixtures/visual-app'
import { mockRestApi } from './fixtures/rest-mocks'

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }, baseURL: 'http://localhost:5182' })

const ROUTES = (process.env.ROUTES || '/app/dashboard,/app/journal-entries,/app/chart-of-accounts,/app/bank-accounts,/app/bank-accounts/ba_ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy_0,/app/fiscal-periods,/app/assets,/app/assets/fa_1,/app/taxes,/app/products,/app/inventory,/app/inventory/counts,/app/inventory/counts/sc_1,/app/inventory/transfers,/app/investments,/app/shareholders,/app/contractors,/app/employees,/app/payroll,/app/projects,/app/cost-centers,/app/branches,/app/templates,/app/contacts,/app/contacts/c_1,/app/roadmap,/app/integrations,/app/inbox,/app/ai').split(',')
const width = Number(process.env.W || 1440)
const lang = (process.env.LANG_ || 'ar') as 'ar' | 'en'

test('shots', async ({ page }) => {
  test.setTimeout(400_000)
  await page.route(/^(?!https?:\/\/(localhost|api\.entix\.io))/, (r) => r.abort())
  await prepareVisualApp(page, lang)
  await mockRestApi(page)
  fs.mkdirSync('/tmp/claude-0/shots/rest', { recursive: true })
  await page.setViewportSize({ width, height: 900 })
  for (const r of ROUTES) {
    await page.goto(r, { waitUntil: 'load', timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(900)
    await page.screenshot({ path: `/tmp/claude-0/shots/rest/${r.replace(/[^a-z0-9]+/gi, '_')}-${lang}-${width}.png`, fullPage: true })
  }
})
