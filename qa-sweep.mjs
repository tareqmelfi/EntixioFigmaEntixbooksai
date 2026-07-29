/**
 * QA route sweep · visits every app route against the local stack,
 * collects console errors + page exceptions + failed API calls + screenshots.
 * Usage: node qa-sweep.mjs [baseURL]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5173'
const EMAIL = 'qa@entix.local'
const PASSWORD = 'Qa!Sweep2026#Secure'

const ROUTES = [
  '/app', '/app/dashboard',
  '/app/sales', '/app/sales/invoices', '/app/sales/invoices/new', '/app/sales/quotes', '/app/sales/quotes/new',
  '/app/invoices', '/app/invoices/new', '/app/quotes', '/app/quotes/new',
  '/app/receipts', '/app/receipts/new', '/app/payments', '/app/payments/new', '/app/vouchers', '/app/vouchers/new',
  '/app/contacts', '/app/purchases', '/app/purchases/bills', '/app/purchases/bills/new',
  '/app/purchases/supplier-credits', '/app/purchases/supplier-credits/new',
  '/app/expenses', '/app/expenses/new', '/app/credit-notes', '/app/credit-notes/new',
  '/app/inbox', '/app/scan-receipts',
  '/app/products', '/app/projects', '/app/assets', '/app/warehouses', '/app/stock-movements',
  '/app/chart-of-accounts', '/app/journal-entries', '/app/journal-entries/new',
  '/app/bank-accounts', '/app/bank-accounts/new', '/app/bank-reconciliation',
  '/app/employees', '/app/payroll', '/app/branches', '/app/cost-centers', '/app/fiscal-periods',
  '/app/taxes', '/app/reports', '/app/reports/profit-loss', '/app/reports/cash-flow',
  '/app/ai', '/app/notifications', '/app/settings', '/app/templates',
  '/app/integrations', '/app/admin', '/app/system-status', '/app/roadmap',
  '/app/marketplace/accountants',
  // public pages
  '/', '/login', '/pricing', '/features', '/about', '/contact',
]

const out = { routes: [], summary: { ok: 0, consoleErrors: 0, pageErrors: 0, api5xx: 0 } }
fs.mkdirSync('/tmp/qa-shots', { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' })
const page = await ctx.newPage()

// ── Login ──
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {})
const loggedIn = page.url().includes('/app')
console.log('LOGIN:', loggedIn ? 'OK' : `FAILED (${page.url()})`)
if (!loggedIn) { await page.screenshot({ path: '/tmp/qa-shots/login-fail.png' }); }

// pick the seeded demo org if the org picker appears
await page.waitForTimeout(1500)

for (const route of ROUTES) {
  const rec = { route, status: 'ok', consoleErrors: [], pageErrors: [], api5xx: [] }
  const onConsole = (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 200)) }
  const onPageError = (e) => rec.pageErrors.push(String(e).slice(0, 200))
  const onResponse = (r) => { if (r.status() >= 500) rec.api5xx.push(`${r.status()} ${r.url().slice(0, 140)}`) }
  page.on('console', onConsole); page.on('pageerror', onPageError); page.on('response', onResponse)
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1800)
    // crude blank-page detector
    const text = await page.evaluate(() => document.body?.innerText?.trim().length || 0)
    if (text < 20) { rec.status = 'blank'; }
  } catch (e) {
    rec.status = 'nav-fail'
    rec.pageErrors.push(String(e).slice(0, 160))
  }
  const shot = `/tmp/qa-shots/${route.replace(/[^\w]+/g, '_')}.png`
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
  page.off('console', onConsole); page.off('pageerror', onPageError); page.off('response', onResponse)
  if (rec.consoleErrors.length) out.summary.consoleErrors++
  if (rec.pageErrors.length) out.summary.pageErrors++
  if (rec.api5xx.length) out.summary.api5xx++
  if (rec.status === 'ok' && !rec.pageErrors.length && !rec.api5xx.length) out.summary.ok++
  out.routes.push(rec)
  const flag = rec.status !== 'ok' ? rec.status.toUpperCase()
    : rec.pageErrors.length ? 'PAGE-ERR'
    : rec.api5xx.length ? 'API-5XX'
    : rec.consoleErrors.length ? 'CONSOLE' : 'OK'
  console.log(`${flag.padEnd(8)} ${route}`)
}

await browser.close()
fs.writeFileSync('/tmp/qa-sweep-report.json', JSON.stringify(out, null, 2))
console.log('\nSUMMARY:', JSON.stringify(out.summary))
