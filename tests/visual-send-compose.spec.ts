import { test, expect } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  baseURL: 'http://localhost:5212',
})

const invoice = {
  id: 'inv-1',
  orgId: visualOrgId,
  contactId: 'contact-1',
  invoiceNumber: 'ENTIX-INV-2026-000481',
  status: 'APPROVED',
  issueDate: '2026-09-01T00:00:00.000Z',
  dueDate: '2026-09-30T00:00:00.000Z',
  supplyDate: null,
  currency: 'SAR',
  exchangeRate: '1',
  subtotal: '2163034.45',
  taxTotal: '324455.17',
  discountTotal: '0',
  total: '2487489.62',
  amountPaid: '0',
  notes: null,
  termsConditions: null,
  reference: null,
  templateId: null,
  paymentLinkUrl: null,
  zatcaUuid: null,
  zatcaQr: null,
  zatcaDelivery: null,
  zatcaStatus: null,
  contact: { id: 'contact-1', displayName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة', email: 'billing@al-asasyah.example.com', type: 'CUSTOMER' },
  lines: [
    { id: 'l1', description: 'خدمات استشارية · Consulting services', quantity: 3, unitPrice: 721011.483, subtotal: 2163034.45, account: { code: '4000', name: 'Revenue', nameAr: 'الإيرادات' } },
  ],
}

const sendRows = [
  { id: 's1', orgId: visualOrgId, entityType: 'invoice', entityId: 'inv-1', to: ['billing@al-asasyah.example.com'], cc: [], bcc: [], subject: 'Invoice ENTIX-INV-2026-000481', body: 'Please find attached…', status: 'SENT', providerMessageId: 'ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy', error: null, sentById: 'u1', sentAt: '2026-09-05T10:00:00.000Z', createdAt: '2026-09-05T10:00:00.000Z', updatedAt: '2026-09-05T10:00:00.000Z' },
  { id: 's2', orgId: visualOrgId, entityType: 'invoice', entityId: 'inv-1', to: ['old@al-asasyah.example.com'], cc: [], bcc: [], subject: 'Invoice ENTIX-INV-2026-000481', body: 'Please find attached…', status: 'BOUNCED', providerMessageId: 'ENTIX-FEE-txn_9zQaBanotherId2026', error: null, sentById: 'u1', sentAt: '2026-09-03T10:00:00.000Z', createdAt: '2026-09-03T10:00:00.000Z', updatedAt: '2026-09-03T10:00:00.000Z' },
  { id: 's3', orgId: visualOrgId, entityType: 'invoice', entityId: 'inv-1', to: ['wrong@'], cc: [], bcc: [], subject: 'Invoice ENTIX-INV-2026-000481', body: 'Please find attached…', status: 'FAILED', providerMessageId: null, error: 'domain not verified', sentById: 'u1', sentAt: null, createdAt: '2026-09-02T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z' },
]

async function mockInvoice(page: import('@playwright/test').Page) {
  await page.route('https://api.entix.io/api/invoices/inv-1', route => route.fulfill({ json: invoice }))
  await page.route('https://api.entix.io/api/document-sends?entityType=invoice&entityId=inv-1', route => route.fulfill({ json: { items: sendRows } }))
  await page.route('https://api.entix.io/api/document-sends', route => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { ok: true, send: sendRows[0] } })
    return route.continue()
  })
}

for (const lang of ['ar', 'en'] as const) {
  test(`invoice send log + compose (${lang})`, async ({ page }) => {
    await prepareVisualApp(page, lang)
    await mockInvoice(page)
    await page.goto(`/app/invoices/inv-1`)
    await expect(page.getByTestId('issued-invoice-send')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('send-log-section')).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 1400 })
    await page.screenshot({ path: `/tmp/claude-0/shots/send/issued-log-${lang}.png`, fullPage: true })
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.getByTestId('issued-invoice-send').click()
    await expect(page.getByTestId('send-compose-submit')).toBeVisible()
    await page.screenshot({ path: `/tmp/claude-0/shots/send/compose-${lang}.png`, fullPage: true })

    for (const width of AUDIT_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(150)
      const hits = await auditOverflow(page)
      if (hits.length) console.log(`OVERFLOW compose ${lang} @${width}`, JSON.stringify(hits))
      expect(hits, `compose overflow ${lang}@${width}`).toEqual([])
    }
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.screenshot({ path: `/tmp/claude-0/shots/send/compose-${lang}-1920.png`, fullPage: true })
    await page.setViewportSize({ width: 1024, height: 1000 })
    await page.screenshot({ path: `/tmp/claude-0/shots/send/compose-${lang}-1024.png`, fullPage: true })
  })
}
