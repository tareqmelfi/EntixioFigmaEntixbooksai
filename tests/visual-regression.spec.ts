import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const routes = [
  { name: 'dashboard', path: '/app', heading: /Dashboard|لوحة التحكم/ },
  { name: 'contacts', path: '/app/contacts', heading: /Contacts|جهات الاتصال/ },
  { name: 'invoices', path: '/app/invoices', heading: /Sales Invoices|فواتير المبيعات/ },
] as const

const populatedInvoice = {
  id: 'inv-populated-1', orgId: 'org-visual-system', contactId: 'contact-populated-1',
  invoiceNumber: 'INV-2026-0042', status: 'OVERDUE', issueDate: '2026-07-01', dueDate: '2026-07-31',
  currency: 'USD', exchangeRate: '1', subtotal: '12850', taxTotal: '0', discountTotal: '0',
  total: '12850', amountPaid: '3500', contact: { id: 'contact-populated-1', displayName: 'مؤسسة الأفق للتجارة Horizon Trading' },
}

const contactSummary = {
  contact: {
    id: 'contact-populated-1', orgId: 'org-visual-system', shortCode: 'CUS-0042', type: 'BOTH',
    isCustomer: true, isSupplier: true, entityKind: 'COMPANY',
    displayName: 'مؤسسة الأفق للتجارة Horizon Trading', legalName: 'Horizon Trading LLC',
    email: 'accounts@horizon.example', phone: '+1 307 555 0142', vatNumber: '310123456700003',
    crNumber: '1010123456', defaultCurrency: 'USD', addressLine1: '100 Market Street', city: 'Cheyenne',
    region: 'WY', country: 'US', postalCode: '82001', isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z',
  },
  totals: {
    invoices: { count: 2, total: 25350, paid: 16000, outstanding: 9350 },
    bills: { count: 1, total: 4200, paid: 1200, outstanding: 3000 },
    quotes: { count: 1, total: 8000 }, receipts: { count: 2, total: 16000 },
    payments: { count: 1, total: 1200 }, arOpen: 9350, apOpen: 3000, balance: 6350,
  },
  invoices: [populatedInvoice], bills: [], quotes: [], vouchers: [], expenses: [],
}

for (const language of ['en', 'ar'] as const) {
  for (const viewport of viewports) {
    for (const route of routes) {
      test(`${route.name} ${language} ${viewport.name} visual contract`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await prepareVisualApp(page, language)
        await page.goto(route.path)
        await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible()
        await page.evaluate(() => document.fonts.ready)

        await expect(page).toHaveScreenshot(
          `${route.name}-${language}-${viewport.name}.png`,
          { animations: 'disabled', caret: 'hide', fullPage: false },
        )
      })
    }
  }

  test(`contact detail populated ${language} visual contract`, async ({ page }) => {
    await page.setViewportSize(language === 'ar' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    await prepareVisualApp(page, language)
    await page.route('https://api.entix.io/api/contacts/contact-populated-1/summary', route => route.fulfill({ json: contactSummary }))
    await page.goto('/app/contacts/contact-populated-1')
    await expect(page.getByRole('heading', { name: /Horizon Trading|مؤسسة الأفق/ })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot(`contact-detail-populated-${language}.png`, { animations: 'disabled', caret: 'hide' })
  })

  test(`invoice table populated ${language} visual contract`, async ({ page }) => {
    await page.setViewportSize(language === 'ar' ? { width: 768, height: 1024 } : { width: 1440, height: 900 })
    await prepareVisualApp(page, language)
    await page.route('https://api.entix.io/api/invoices**', route => route.fulfill({ json: { items: [populatedInvoice], total: 1, page: 1, limit: 200 } }))
    await page.goto('/app/invoices')
    await expect(page.getByText('INV-2026-0042')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot(`invoices-populated-${language}.png`, { animations: 'disabled', caret: 'hide' })
  })
}
