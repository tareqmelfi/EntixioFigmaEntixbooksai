import type { Page } from '@playwright/test'

export const visualOrgId = 'org-visual-system'

const org = {
  id: visualOrgId,
  slug: 'visual-test-co',
  name: 'Visual Test Company',
  legalName: 'Visual Test Company LLC',
  country: 'US',
  baseCurrency: 'USD',
  fiscalYearStart: 1,
  fiscalYearEnd: 12,
  zatcaEnabled: false,
  vatNumber: null,
  crNumber: null,
  logoUrl: null,
  stampUrl: null,
}

const dashboardSummary = {
  org,
  kpi: {
    revenue: 0, purchases: 0, expenses: 0, receipts: 0, payments: 0,
    vatOutput: 0, vatInput: 0, vatNet: 0, invoiceCount: 0, overdueCount: 0,
    contactCount: 0, accountsReceivable: 0, accountsPayable: 0, cashOnHand: 0,
  },
  monthlyTrend: [], cashFlowTrend: [], profitLoss: [], expenseBreakdown: [],
  incomeBreakdown: [], overdueInvoices: [], bankAccounts: [],
  periodCompare: {
    thisMonth: { revenue: 0, expenses: 0, net: 0 },
    lastMonth: { revenue: 0, expenses: 0, net: 0 },
    yearAgo: { revenue: 0, expenses: 0, net: 0 },
  },
}

export async function prepareVisualApp(page: Page, language: 'en' | 'ar' = 'en') {
  await page.addInitScript(({ activeOrgId, locale }) => {
    localStorage.setItem('entix-language', locale)
    localStorage.setItem('entix_org_id', activeOrgId)
    localStorage.setItem('entix-sidebar-mode', 'pinned')
    localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
      v: 1, choice: 'essential', analytics: false, marketing: false,
      at: '2026-08-15T00:00:00.000Z',
    }))
  }, { activeOrgId: visualOrgId, locale: language })

  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') return route.fulfill({ json: { user: {
      id: 'visual-user', email: 'visual@example.com', name: 'Visual Tester',
      createdAt: '2026-08-15T00:00:00.000Z',
    } } })
    if (pathname === '/me') return route.fulfill({ json: {
      locale: language, selectedOrgId: visualOrgId, defaultOrgId: visualOrgId,
      memberships: [{ role: 'OWNER', createdAt: '2026-08-15T00:00:00.000Z', org }],
    } })
    if (pathname === '/orgs') return route.fulfill({ json: [org] })
    if (pathname === '/api/notifications') return route.fulfill({ json: { items: [], count: 0 } })
    if (pathname === '/api/notifications/count') return route.fulfill({ json: { unread: 0 } })
    if (pathname === '/api/dashboard/summary') return route.fulfill({ json: dashboardSummary })
    if (pathname === '/api/onboarding/status') return route.fulfill({ json: {
      completed: true, completedAt: '2026-08-15T00:00:00.000Z',
      openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
    } })
    if (pathname === '/api/contacts') return route.fulfill({ json: { items: [], total: 0, page: 1, limit: 200 } })
    if (pathname === '/api/invoices') return route.fulfill({ json: { items: [], total: 0, page: 1, limit: 200 } })
    if (pathname === '/api/products') return route.fulfill({ json: { items: [], total: 0, categories: [] } })
    if (pathname === '/api/accounts') return route.fulfill({ json: { items: [], total: 0 } })
    if (pathname === `/orgs/${visualOrgId}/members`) return route.fulfill({ json: { members: [] } })
    if (pathname === '/api/email/status') return route.fulfill({ json: { configured: false, mode: 'disabled', from: '' } })
    if (pathname === '/api/inbox/status') return route.fulfill({ json: {
      address: '', configured: false, webhookConfigured: false,
      addressConfigured: false, mode: 'disabled', provider: null,
    } })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
}
