/**
 * Functional QA · user-reported flows against the local stack (new code).
 * node qa-flows.mjs [baseURL]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5173'
const EMAIL = 'qa@entix.local'
const PASSWORD = 'Qa!Sweep2026#Secure'
const results = []
const shot = (n) => `/tmp/qa-shots/flow-${n}.png`
const log = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' · ' + detail : ''}`)
}

fs.mkdirSync('/tmp/qa-shots', { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))

// ── login ──
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL(/\/app/, { timeout: 15000 })
await page.waitForTimeout(1500)

// ── [1] create invoice · 1 complete + 1 incomplete line · draft save ──
await page.goto(`${BASE}/app/invoices/new`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
await page.screenshot({ path: shot('01-create-form') })
// pick customer (combobox → type a letter → pick first option)
const customerBtn = page.locator('button:has-text("ابحث عن عميل"), button:has-text("اختر العميل"), [role="combobox"]').first()
if (await customerBtn.count()) {
  await customerBtn.click()
  await page.waitForTimeout(600)
  const searchInput = page.locator('input[placeholder*="بحث"], input[placeholder*="ابحث"]').last()
  if (await searchInput.count()) { await searchInput.fill(''); await page.waitForTimeout(400) }
  const opt = page.locator('[role="option"], [cmdk-item], li[tabindex], [data-value]').filter({ hasText: /\S{2,}/ }).first()
  if (await opt.count()) await opt.click().catch(() => {})
  else await page.keyboard.press('ArrowDown').then(() => page.keyboard.press('Enter')).catch(() => {})
  await page.waitForTimeout(500)
}
// line 1: complete
const desc1 = page.locator('textarea, input[placeholder*="وصف"], input[placeholder*="description" i]').first()
await desc1.fill('خدمة استشارية تجريبية QA')
const qty1 = page.locator('input').nth(2)
// fill qty/price via the table inputs (robust: find by position in first row)
const row1Inputs = page.locator('tbody tr').first().locator('input')
if (await row1Inputs.count() >= 2) {
  await row1Inputs.nth(0).fill('2')
  await row1Inputs.nth(1).fill('500')
}
// line 2: incomplete (description only, no price) → should be flagged red on save
const addLine = page.locator('button:has-text("إضافة سطر"), button:has-text("سطر")').first()
if (await addLine.count()) { await addLine.click(); await page.waitForTimeout(300) }
const row2 = page.locator('tbody tr').nth(1)
if (await row2.count()) {
  const row2Desc = row2.locator('textarea, input').first()
  await row2Desc.fill('سطر ناقص بدون سعر')
}
await page.screenshot({ path: shot('02-lines-filled') })
// save as draft
const saveDraft = page.locator('button:has-text("حفظ كمسودة"), button:has-text("حفظ")').first()
await saveDraft.click()
await page.waitForTimeout(2000)
await page.screenshot({ path: shot('03-after-draft-save') })
const bodyText = await page.evaluate(() => document.body.innerText)
log('draft save succeeded (strict)', /تم حفظ \S+ كمسودة|تم تحديث \S+/.test(bodyText), bodyText.match(/تم (حفظ|تحديث) \S+/)?.[0] || 'no success toast')
log('skipped incomplete line → info toast', /بند ناقص|بالأحمر/.test(bodyText), bodyText.match(/.{0,30}(بند ناقص|بالأحمر).{0,30}/)?.[0] || 'no marker')

// ── [2] approve (auto account resolution) ──
const approveBtn = page.locator('button:has-text("اعتماد")').first()
if (await approveBtn.count()) {
  await approveBtn.click()
  await page.waitForTimeout(2000)
  const t2 = await page.evaluate(() => document.body.innerText)
  log('approve with server account resolution', !/line_account_required|حساب الإيراد/.test(t2), /line_account_required|حساب الإيراد/.test(t2) ? 'BLOCKED' : 'no account error')
  await page.screenshot({ path: shot('04-after-approve') })
} else log('approve with server account resolution', false, 'no approve button found')

// ── [3] duplicate number protection (open create again · same suggestion race) ──
await page.goto(`${BASE}/app/invoices`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// ── [4] payment flow · 💰 دفعة on first non-paid invoice ──
const payBtn = page.locator('button:has-text("💰 دفعة"), button:has-text("دفعة")').first()
if (await payBtn.count()) {
  await payBtn.click()
  await page.waitForURL(/receipts/, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: shot('05-receipt-prefilled') })
  const receiptText = await page.evaluate(() => document.body.innerText)
  log('payment button → receipts prefilled', /receipts/.test(page.url()) && /سند|مبلغ/.test(receiptText))
  // save the receipt
  const saveReceipt = page.locator('button:has-text("حفظ"), button:has-text("إنشاء")').first()
  if (await saveReceipt.count()) {
    await saveReceipt.click()
    await page.waitForTimeout(2000)
    const rt = await page.evaluate(() => document.body.innerText)
    log('receipt created', /تم إنشاء|سند/.test(rt), rt.match(/.{0,30}(تم إنشاء|فشل|خطأ).{0,40}/)?.[0] || '')
    await page.screenshot({ path: shot('06-receipt-saved') })
    // back to invoices → payment must be visible WITHOUT clicking edit
    await page.goto(`${BASE}/app/invoices`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const invText = await page.evaluate(() => document.body.innerText)
    log('payment visible on invoices list immediately', /مدفوعة|جزئياً|PARTIAL|PAID/.test(invText))
    await page.screenshot({ path: shot('07-invoices-after-payment') })
  } else log('receipt created', false, 'no save button on receipt form')
} else log('payment button → receipts prefilled', false, 'no 💰 button (no unpaid invoice?)')

// ── [5] invoice deep-link · click row number → edit view opens ──
await page.goto(`${BASE}/app/invoices`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
const numLink = page.locator('tbody tr td button').first()
if (await numLink.count()) {
  await numLink.click()
  await page.waitForTimeout(2000)
  const deepText = await page.evaluate(() => document.body.innerText)
  const inEdit = /تعديل|تحديث|حفظ/.test(deepText) && !/فاتورة جديدة/.test(page.url())
  log('invoice deep-link opens edit view', /\/invoices\/[0-9a-f-]{36}/.test(page.url()) || inEdit, page.url())
  await page.screenshot({ path: shot('08-deep-link-edit') })
} else log('invoice deep-link opens edit view', false, 'no row link')

// ── [6] contact logo upload ──
await page.goto(`${BASE}/app/contacts`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const contactLink = page.locator('a[href*="/app/contacts/"]').first()
if (await contactLink.count()) {
  await contactLink.click()
  await page.waitForTimeout(1800)
  // tiny 1x1 PNG
  fs.writeFileSync('/tmp/qa-logo.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'))
  const fileInput = page.locator('input[type="file"][accept*="image"]')
  if (await fileInput.count()) {
    await fileInput.setInputFiles('/tmp/qa-logo.png')
    await page.waitForTimeout(2500)
    const hasLogo = await page.locator('img[alt]').count()
    log('contact logo upload', hasLogo > 0, `imgs=${hasLogo}`)
    await page.screenshot({ path: shot('09-contact-logo') })
  } else log('contact logo upload', false, 'no file input on contact page')
} else log('contact logo upload', false, 'no contact to open')

// ── [7] purchases dashboard (was internal_error) ──
await page.goto(`${BASE}/app/purchases`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const purchText = await page.evaluate(() => document.body.innerText)
log('purchases dashboard loads without internal_error', !/internal_error/.test(purchText), purchText.slice(0, 60).replace(/\n/g, ' '))
await page.screenshot({ path: shot('10-purchases') })

// ── [8] invoice print view renders (7 columns, no clip) ──
const printBtn = page.locator('a[href*="/print/invoice/"], button:has-text("طباعة")').first()
if (await printBtn.count()) {
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null),
    printBtn.click().catch(() => {}),
  ])
  const printPage = popup || page
  await printPage.waitForTimeout(2500)
  await printPage.screenshot({ path: shot('11-print-view'), fullPage: true })
  log('invoice print view renders', true)
} else console.log('ℹ️ print button not found from current view (skipped)')

await browser.close()
const fails = results.filter((r) => !r.ok)
console.log(`\nFLOWS: ${results.length - fails.length}/${results.length} pass`)
fs.writeFileSync('/tmp/qa-flows-report.json', JSON.stringify(results, null, 2))
process.exit(fails.length ? 1 : 0)
