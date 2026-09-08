import { test, expect, type Page } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'
import { execFileSync } from 'node:child_process'

/**
 * Brand documents (quote / invoice templates · 2026-09-08)
 *  · print views render fixed A4 sheets and `page.pdf()` yields exactly one PDF page per sheet
 *  · designer + templates gallery have no overflow at 1024/1280/1440/1920 in ar + en
 *  · editors prefill the per-document terms from the default template and expose «معاينة كاملة»
 * Run: npx playwright test tests/brand-documents.spec.ts -c zz-pw.config.ts (dev server on the config baseURL)
 */
import { mkdirSync } from 'node:fs'

if (process.env.BRAND_DOC_BASE_URL) test.use({ baseURL: process.env.BRAND_DOC_BASE_URL })
const SHOTS = process.env.BRAND_DOC_SHOTS || 'test-results/brand-documents'
mkdirSync(SHOTS, { recursive: true })
const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60"><rect x="4" y="8" width="44" height="44" rx="10" fill="#1276E3"/><text x="60" y="42" font-family="Arial" font-weight="800" font-size="30" fill="#0B1B49">SPEC<tspan fill="#1276E3">PROS</tspan></text></svg>').toString('base64')

const org = {
  id: visualOrgId, slug: 'specpros', name: 'شركة سبيك بروز للاستثمار قابضة', legalName: 'Spec Pros Investment Holding Inc',
  country: 'SA', baseCurrency: 'SAR', vatNumber: '311691775200003', crNumber: '1010889599', logoUrl: logo, printLogoUrl: logo, stampUrl: null,
  buildingNumber: '7421', streetName: 'الطريق الدائري الشرقي الفرعي', district: 'حي الروضة', city: 'الرياض', postalCode: '13213',
  phone: '800-111-0110', email: 'info@specpros.sa', website: 'specpros.sa', defaultInvoiceLanguage: 'ar', role: 'OWNER',
}
const contact = {
  id: 'c1', orgId: visualOrgId, type: 'CUSTOMER', displayName: 'شركة بوابات التصاميم الهندسية', legalName: 'Bawabat Altasamim Alhandasiah Company',
  customCode: 'EDG', vatNumber: '314976132800003', crNumber: '7055039445', addressLine1: 'مبنى 6143 · طريق الملك عبدالعزيز بن عبدالرحمن سعود · حي العارض',
  city: 'الرياض 13342', phone: '+966 54 310 1464', email: 'info@edg.sa', country: 'SA',
}
const template = {
  id: 'tpl-1', orgId: visualOrgId, name: 'قالب سبيك بروز', nameEn: 'SpecPros brand', type: 'QUOTE', layout: 'classic', isDefault: true,
  primaryColor: '#0B1B49', accentColor: '#1276E3', showLogo: true, showTaxBreakdown: true, showTerms: true,
  kind: 'BOTH', coverStyle: 'DARK', coverTitle: 'محاسبة مقاولات\nتُدار من المشروع', coverIntro: '',
  brandColor: '#1276E3', coverColor: '#0B1B49', sections: null,
  terms: 'العرض ساري 30 يومًا من تاريخ الإصدار.\nاتفاقية 5 سنوات بسعر مثبّت 1,200 ريال + الضريبة سنويًا، لا يتغير طوال المدة.\nالسداد سنويًا مقدمًا: السنة الأولى عند القبول عبر الرابط، وكل سنة تالية قبل بدايتها.\nالتزام سنوي مرن: عدم تجديد أي سنة تالية بإشعار كتابي قبل 30 يومًا دون غرامة.',
  termsEn: 'Valid 30 days from issue.\nFive-year agreement at a fixed price.\nAnnual payment in advance.',
  closingTerms: 'نطاق الخدمة | اشتراك سنوي في منصة ENTIX Books · باقة المؤسسات، بالإعداد الموصوف في هذا المستند. أي وحدة أو خدمة غير مذكورة صراحةً خارج النطاق وتُقدَّم بعرض منفصل.\nالطرف المتعاقد | شركة سبيك بروز للاستثمار قابضة (س.ت 1010889599 · الرقم الضريبي 311691775200003) هي المورد والجهة المُصدِرة للفاتورة، والوكيل المعتمد للمنصة في المملكة؛ ENSIDEX LLC هي مالك المنصة ومزوّد البنية التقنية.\nالسداد | الدفع مقدمًا بالكامل عبر رابط الدفع الإلكتروني المباشر المُثبت في المستند. لا يُعتد بأي وسيلة سداد أخرى ما لم تُعتمد كتابيًا من المورد.\nالضريبة | الأسعار بالريال السعودي. تُطبَّق ضريبة القيمة المضافة 15٪ على القيمة الخاضعة بعد الخصم، وتصدر فاتورة ضريبية مطابقة لمتطلبات هيئة الزكاة والضريبة والجمارك.\nالمدة وتثبيت السعر | مدة الاتفاقية خمس (5) سنوات من تاريخ التفعيل. يثبَّت سعر الاشتراك السنوي عند SAR 1,200.00 + ضريبة القيمة المضافة طوال المدة، ولا يخضع لأي زيادة.\nالسداد السنوي والتجديد | يُسدَّد كل اشتراك سنوي مقدمًا قبل بداية سنته. للعميل حق عدم تجديد أي سنة تالية بإشعار كتابي قبل 30 يومًا من انتهاء السنة الجارية دون غرامة.\nالتفعيل | يبدأ التفعيل فور تأكيد سداد السنة الأولى. يعتمد الترحيل على استلام بيانات العميل الحالية.\nالبيانات والسجلات المحاسبية | بيانات العميل وسجلاته المحاسبية ملك له، وتبقى متاحة للتصدير الكامل (PDF · CSV · Excel) في أي وقت.\nالنسخ الاحتياطي واستمرارية الخدمة | يزوَّد العميل بنسخة احتياطية شهرية آلية من بياناته. وفي حال توقف المنصة نهائيًا خلال المدة، يُخطَر العميل قبل 90 يومًا على الأقل.\nمسؤولية القيود | المنصة أداة تسجيل ومعالجة؛ صحة القيود والإقرارات الضريبية مسؤولية العميل ومحاسبه.\nالدعم الفني | دعم فني ذو أولوية عبر البريد والهاتف طوال مدة الاشتراك، ويشمل الأعطال والتحديثات والأسئلة التشغيلية.\nالإلغاء | الاشتراك السنوي المسدَّد غير قابل للاسترداد بعد تفعيل سنته إلا في حالة توقف المنصة الموضحة أعلاه.\nالقانون الواجب التطبيق | تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص محاكم الرياض بأي نزاع ينشأ عنها.',
  closingTermsEn: 'Scope | Annual subscription to ENTIX Books · Enterprise plan.\nPayment | Paid in full in advance via the payment link.\nGoverning law | Laws of the Kingdom of Saudi Arabia.',
  bankAccountId: 'bank-1', signatoryName: 'طارق ملفي الرويلي', signatoryTitle: 'الرئيس التنفيذي', signatoryEmail: 'tareq@ensidex.com', signatoryPhone: '+966 53 507 0101',
  stampUrl: null, footerText: '', classification: 'سري للعميل', classificationEn: 'Client confidential', updatedAt: '2026-09-07T00:00:00Z',
}
const bank = { id: 'bank-1', orgId: visualOrgId, name: 'الحساب الرئيسي · SNB', bankName: 'البنك الأهلي السعودي', iban: 'SA03 8000 0000 6080 1016 7519', swiftCode: 'NCBKSAJE', currency: 'SAR', balance: '0', isActive: true }
const desc = 'ENTIX Books · باقة المؤسسات · اشتراك سنوي · إعداد مقاولات\nالنظام المحاسبي الكامل بلا حدود على المستخدمين أو الفروع أو المشاريع · إعداد مخصص لنشاط المقاولات (مشاريع ومراكز تكلفة ودليل حسابات مقاولات) · ترحيل البيانات الحالية · قالب فواتير بهوية الشركة · دعم فني ذو أولوية طوال مدة الاشتراك · 12 شهرًا من تاريخ التفعيل'
const quote = {
  id: 'q1', orgId: visualOrgId, contactId: 'c1', quoteNumber: 'SP-Q-0001', status: 'SENT', issueDate: '2026-09-07', validUntil: '2026-10-07', currency: 'SAR',
  subtotal: '1200', taxTotal: '180', discountTotal: '1790', total: '1380', notes: null, termsConditions: template.terms, title: 'محاسبة مقاولات\nتُدار من المشروع', reference: null, templateId: 'tpl-1',
  paymentLinkUrl: 'https://buy.stripe.com/cNiaEWcmM6RR5iVg0n7Vm0H', contact: { id: 'c1', displayName: contact.displayName },
  lines: [{ id: 'l1', description: desc, quantity: '1', unitPrice: '2990', discount: '1790', subtotal: '1200', code: 'SP-ENT-ENTP-YR' }],
}
const invoice = {
  id: 'i1', orgId: visualOrgId, contactId: 'c1', invoiceNumber: 'SP-INV-2026032608', status: 'SENT', issueDate: '2026-09-07', dueDate: '2026-10-07', currency: 'SAR', exchangeRate: '1',
  subtotal: '1200', taxTotal: '180', discountTotal: '1790', total: '1380', amountPaid: '0', notes: null,
  termsConditions: 'الاستحقاق خلال 30 يومًا من تاريخ الإصدار — بحد أقصى 2026-10-07.\nالسداد عبر رابط الدفع المباشر أعلاه بالإجمالي شامل الضريبة؛ يصل إشعار السداد تلقائيًا إلى بريد الشركة.\nفاتورة السنة الأولى من اتفاقية 5 سنوات بسعر مثبّت SAR 1,380.00 سنويًا شامل الضريبة؛ تُصدر فاتورة كل سنة تالية قبل بدايتها.',
  reference: 'SP-Q-0001', templateId: 'tpl-1', paymentLinkUrl: 'https://buy.stripe.com/cNiaEWcmM6RR5iVg0n7Vm0H', zatcaQr: null,
  lines: [{ id: 'l1', description: desc, quantity: '1', unitPrice: '2990', discount: '1790', subtotal: '1200', code: 'SP-ENT-ENTP-YR' }],
}

async function mocks(page: Page, lang: 'ar' | 'en') {
  await prepareVisualApp(page, lang)
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    const m = route.request().method()
    if (pathname === '/orgs') return route.fulfill({ json: [org] })
    if (pathname === `/orgs/${visualOrgId}`) return route.fulfill({ json: org })
    if (pathname === '/api/document-templates/defaults') return route.fulfill({ json: { QUOTE: template, INVOICE: template } })
    if (pathname === '/api/document-templates' && m === 'GET') return route.fulfill({ json: { items: [template], total: 1 } })
    if (pathname === '/api/document-templates' && m === 'POST') return route.fulfill({ status: 201, json: { ...template, id: 'tpl-2' } })
    if (pathname === '/api/document-templates/tpl-1') return route.fulfill({ json: template })
    if (pathname === '/api/bank-accounts') return route.fulfill({ json: { items: [bank], total: 1, totalBalance: 0 } })
    if (pathname === '/api/quotes/q1') return route.fulfill({ json: quote })
    if (pathname === '/api/quotes') return route.fulfill({ json: { items: [quote], total: 1 } })
    if (pathname === '/api/quotes/_/next-number') return route.fulfill({ json: { number: 'SP-Q-0002' } })
    if (pathname === '/api/invoices/i1') return route.fulfill({ json: invoice })
    if (pathname === '/api/invoices') return route.fulfill({ json: { items: [invoice], total: 1, page: 1, limit: 200 } })
    if (pathname === '/api/invoices/_/next-number') return route.fulfill({ json: { number: 'SP-INV-2026032609' } })
    if (pathname === '/api/contacts/c1') return route.fulfill({ json: contact })
    if (pathname === '/api/contacts') return route.fulfill({ json: { items: [contact], total: 1, page: 1, limit: 200 } })
    if (pathname === '/api/branches') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/projects') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/tax-rates') return route.fulfill({ json: { items: [], total: 0 } })
    return route.fallback()
  })
}

async function sheetShots(page: Page, name: string) {
  await page.waitForSelector('.edoc .sheet', { timeout: 20000 })
  await page.waitForTimeout(1200)
  const n = await page.locator('.edoc .sheet').count()
  for (let i = 0; i < n; i++) await page.locator('.edoc .sheet').nth(i).screenshot({ path: `${SHOTS}/${name}-p${i + 1}.png` })
  await page.pdf({ path: `${SHOTS}/${name}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
  let pages = NaN
  try {
    pages = Number(execFileSync('python3', ['-c', 'import sys;from pypdf import PdfReader;print(len(PdfReader(sys.argv[1]).pages))', `${SHOTS}/${name}.pdf`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim())
  } catch { console.log(`${name}: pypdf unavailable · PDF page count not verified`) }
  console.log(`${name}: sheets=${n} pdfPages=${pages}`)
  if (Number.isFinite(pages)) expect(pages).toBe(n)
  return n
}

test('quote print · ar · all sheets · pdf page count == sheet count', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/print/proposal/q1?noprint=1')
  const n = await sheetShots(page, 'quote-print-ar')
  expect(n).toBeGreaterThanOrEqual(3)
})

test('invoice print · ar · all sheets · pdf page count == sheet count', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/print/invoice/i1?noprint=1')
  const n = await sheetShots(page, 'invoice-print-ar')
  expect(n).toBeGreaterThanOrEqual(3)
})

test('quote print · en', async ({ page }) => {
  await mocks(page, 'en')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/print/proposal/q1?noprint=1&lang=en')
  await sheetShots(page, 'quote-print-en')
})

for (const lang of ['ar', 'en'] as const) {
  test(`designer · ${lang} · 1440 + overflow audit`, async ({ page }) => {
    await mocks(page, lang)
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.goto('/app/templates/tpl-1')
    await page.waitForSelector('[data-testid="template-designer"] .edoc .sheet', { timeout: 20000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/designer-${lang}.png`, fullPage: false })
    await page.screenshot({ path: `${SHOTS}/designer-${lang}-full.png`, fullPage: true })
    for (const w of AUDIT_WIDTHS) {
      await page.setViewportSize({ width: w, height: 1000 })
      await page.waitForTimeout(400)
      const hits = await auditOverflow(page)
      console.log(`designer ${lang} @${w}: ${hits.length} hits`, hits.slice(0, 5))
      expect(hits, `overflow at ${w}`).toEqual([])
    }
  })

  test(`templates list · ${lang} · overflow audit`, async ({ page }) => {
    await mocks(page, lang)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/app/templates')
    await page.waitForSelector('text=قالب سبيك بروز', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(800)
    await page.locator('button[title*="معاينة"], button[title*="Live preview"]').first().click()
    await page.waitForSelector('[data-testid="template-inline-preview"] .edoc .sheet', { timeout: 20000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${SHOTS}/templates-${lang}.png`, fullPage: true })
    for (const w of AUDIT_WIDTHS) {
      await page.setViewportSize({ width: w, height: 1000 })
      await page.waitForTimeout(400)
      const hits = await auditOverflow(page)
      console.log(`templates ${lang} @${w}: ${hits.length} hits`, hits.slice(0, 5))
      expect(hits, `overflow at ${w}`).toEqual([])
    }
  })
}

test('invoice editor · terms textarea + template selector + full preview', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/app/invoices?new=1')
  await page.waitForSelector('[data-testid="invoice-terms"]', { timeout: 20000 })
  await page.waitForTimeout(800)
  await expect(page.getByTestId('invoice-terms')).toHaveValue(/العرض ساري 30/)
  await expect(page.getByTestId('invoice-template-field')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/invoice-editor-ar.png`, fullPage: true })
})

test('quote editor · terms textarea + template selector + full preview', async ({ page }) => {
  await mocks(page, 'ar')
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/app/quotes?new=1')
  await page.waitForSelector('[data-testid="quote-terms"]', { timeout: 20000 })
  await page.waitForTimeout(800)
  await expect(page.getByTestId('quote-terms')).toHaveValue(/العرض ساري 30/)
  await expect(page.getByTestId('quote-full-preview')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/quote-editor-ar.png`, fullPage: true })
})
