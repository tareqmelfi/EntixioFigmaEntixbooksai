import { test, expect, type Page } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'
import { mkdirSync } from 'node:fs'

const SHOTS = '/tmp/claude-0/shots/invoice-attach'
mkdirSync(SHOTS, { recursive: true })

const org = {
  id: visualOrgId, slug: 'al-asasyah', name: 'الأساسية للإلكترونيات المحدودة', legalName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD',
  country: 'SA', baseCurrency: 'SAR', vatNumber: '311691775200003', crNumber: '1010889599', logoUrl: null, printLogoUrl: null, stampUrl: null,
  defaultInvoiceLanguage: 'ar', role: 'OWNER',
}
const contact = {
  id: 'c1', orgId: visualOrgId, type: 'CUSTOMER', displayName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة',
  vatNumber: '314976132800003', email: 'billing@al-asasyah.example', country: 'SA',
}
const invoice = {
  id: 'ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy', orgId: visualOrgId, contactId: 'c1', invoiceNumber: 'ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy',
  status: 'PAID', issueDate: '2026-08-01', dueDate: '2026-08-31', currency: 'SAR', exchangeRate: '1',
  subtotal: '2163034.454', taxTotal: '324455.168', discountTotal: '0', total: '2487489.622', amountPaid: '2487489.622', notes: null,
  contact, zatcaQr: null,
  lines: [{ id: 'l1', description: 'اشتراك سنوي · منصة Entix Books · باقة المؤسسات', quantity: '1', unitPrice: '2163034.454', discount: '0', subtotal: '2163034.454' }],
}
const attachments = [
  { id: 'a1', filename: 'عقد التوريد الموقّع.pdf', contentType: 'application/pdf', sizeBytes: 482930, url: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXT4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTkwCiUlRU9G' },
  { id: 'a2', filename: 'شعار الشركة.png', contentType: 'image/png', sizeBytes: 15320, url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
  { id: 'a3', filename: 'كشف حساب بنكي سبتمبر.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 88400, url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' },
  { id: 'a4', filename: 'مراسلة العميل.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 24010, url: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' },
]

async function mocks(page: Page) {
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/orgs') return route.fulfill({ json: [org] })
    if (pathname === `/orgs/${visualOrgId}`) return route.fulfill({ json: org })
    if (pathname === '/api/document-templates/defaults') return route.fulfill({ json: { QUOTE: null, INVOICE: null } })
    if (pathname === '/api/bank-accounts') return route.fulfill({ json: { items: [], total: 0, totalBalance: 0 } })
    if (pathname === `/api/invoices/${invoice.id}`) return route.fulfill({ json: invoice })
    if (pathname === '/api/invoices') return route.fulfill({ json: { items: [invoice], total: 1, page: 1, limit: 200 } })
    if (pathname === `/api/invoices/${invoice.id}/attachments`) return route.fulfill({ json: { items: attachments } })
    if (pathname === '/api/contacts/c1') return route.fulfill({ json: contact })
    if (pathname === '/api/contacts') return route.fulfill({ json: { items: [contact], total: 1, page: 1, limit: 200 } })
    if (pathname === '/api/branches') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === '/api/projects') return route.fulfill({ json: { items: [], total: 0 } })
    return route.fallback()
  })
}

for (const lang of ['ar', 'en'] as const) {
  test(`invoice detail: document preview beside attachments — ${lang}`, async ({ page }) => {
    await prepareVisualApp(page, lang)
    await mocks(page)
    await page.goto(`/app/invoices/${invoice.id}`)
    const iframeEl = page.locator('iframe[title]').first()
    await expect(iframeEl).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)

    // REGRESSION (CEO 2026-09-08 · «مستند الفاتورة ليش مايبين؟»): the preview iframe
    // was visible-but-blank in production — an outer element with zero rendered
    // content still passes a plain `.toBeVisible()` check. Assert the document
    // engine actually painted real invoice content inside the frame, not just that
    // the <iframe> tag itself occupies space.
    const frame = page.frameLocator('iframe[title]').first()
    const host = frame.locator('[data-testid="brand-document"]')
    await expect(host).toBeVisible({ timeout: 15000 })
    await expect(host).not.toHaveAttribute('data-render-error', /.+/)
    const sheetCount = await host.getAttribute('data-sheets')
    expect(Number(sheetCount), 'brand-document must report at least one rendered A4 sheet').toBeGreaterThan(0)
    await expect(frame.locator('body')).toContainText(invoice.invoiceNumber)
    await expect(frame.locator('body')).toContainText('2,487,489.62')

    for (const width of AUDIT_WIDTHS) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForTimeout(400)
      const hits = await auditOverflow(page)
      if (hits.length) console.log(`OVERFLOW @ ${width} (${lang}):`, JSON.stringify(hits, null, 2))
      expect(hits, `overflow hits at ${width} (${lang})`).toEqual([])
      if (width === 1024 || width === 1920) {
        await page.screenshot({ path: `${SHOTS}/${lang}-${width}.png`, fullPage: true })
      }
    }
  })
}
