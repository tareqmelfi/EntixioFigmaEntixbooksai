import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const orgId = 'org-onboarding-a'

const dashboardSummary = {
  org: { id: orgId, name: 'Onboarding Test Co', baseCurrency: 'SAR', country: 'US' },
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

type OnboardingStatus = {
  completed: boolean
  completedAt: string | null
  openingBalancesDone: boolean
  openingAt: string | null
  productsCount: number
  contactsCount: number
}

async function prepareApp(page: Page, status: OnboardingStatus) {
  await page.addInitScript(activeOrgId => {
    localStorage.setItem('entix-language', 'en')
    localStorage.setItem('entix_org_id', activeOrgId)
    localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
      v: 1, choice: 'essential', analytics: false, marketing: false,
      at: '2026-08-14T00:00:00.000Z',
    }))
  }, orgId)
  await page.route('https://api.entix.io/**', async route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') return route.fulfill({ json: { user: {
      id: 'user-onboarding', email: 'onboarding@example.com', name: 'Onboarding Tester',
      createdAt: '2026-08-14T00:00:00.000Z',
    } } })
    if (pathname === '/orgs') return route.fulfill({ json: [dashboardSummary.org] })
    if (pathname === '/me') return route.fulfill({ json: {
      selectedOrgId: orgId, defaultOrgId: orgId,
      memberships: [{ role: 'OWNER', createdAt: '2026-08-14T00:00:00.000Z', org: dashboardSummary.org }],
    } })
    if (pathname === '/api/notifications') return route.fulfill({ json: { items: [], count: 0 } })
    if (pathname === '/api/notifications/count') return route.fulfill({ json: { unread: 0 } })
    if (pathname === '/api/dashboard/summary') return route.fulfill({ json: dashboardSummary })
    if (pathname === '/api/onboarding/status') return route.fulfill({ json: status })
    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
}

async function skipToDone(page: Page) {
  await page.goto('/app/onboarding?__qa_auth=1')
  await page.getByRole('button', { name: 'Skip — starting fresh' }).click()
  await page.getByRole('button', { name: 'Skip — add items later' }).click()
  await page.getByRole('button', { name: 'Skip — add contacts later' }).click()
  await expect(page.getByRole('heading', { name: /Your company is ready/ })).toBeVisible()
}

test('onboarding API exposes durable completion status and complete()', async () => {
  const source = await readFile(path.join(root, 'src/app/lib/api.ts'), 'utf8')
  const onboarding = source.slice(source.indexOf('onboarding: {'), source.indexOf('\n  },', source.indexOf('onboarding: {')) + 5)

  expect(onboarding).toMatch(/status:\s*\(\)\s*=>\s*request<\{[^}]*completed:\s*boolean[^}]*completedAt:\s*string\s*\|\s*null/s)
  expect(onboarding).toMatch(/complete:\s*\(\)\s*=>\s*request<\{[^}]*completed:\s*boolean[^}]*completedAt:\s*string\s*\|\s*null[^}]*\}>\('\/api\/onboarding\/complete',\s*\{\s*method:\s*'POST'/s)
})

test('dashboard completion state follows its current organization', async () => {
  const source = await readFile(path.join(root, 'src/app/pages/dashboard.tsx'), 'utf8')

  expect(source).toContain('const orgId = data?.org.id')
  expect(source).toMatch(/setOnb\(null\)[\s\S]{0,500}api\.onboarding\.status\(\)[\s\S]{0,300}\[orgId\]/)
  expect(source).toContain('`entix_onb_dismissed:${orgId}`')
  expect(source).toMatch(/onb\s*&&\s*!onbDismissed\s*&&\s*!onb\.completed/)
  expect(source).not.toMatch(/!onb\.openingBalancesDone\s*\|\|\s*onb\.productsCount\s*===\s*0/)
})

test('completed legacy status hides the dashboard banner even with zero products', async ({ page }) => {
  await prepareApp(page, {
    completed: true, completedAt: '2026-08-14T00:00:00.000Z',
    openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
  })

  await page.goto('/app?__qa_auth=1')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Finish setting up your company')).toHaveCount(0)
})

test('Later dismissal is isolated to the current organization', async ({ page }) => {
  await prepareApp(page, {
    completed: false, completedAt: null,
    openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
  })
  await page.addInitScript(() => localStorage.setItem('entix_onb_dismissed', '1'))

  await page.goto('/app?__qa_auth=1')
  await expect(page.getByText('Finish setting up your company')).toBeVisible()
  await page.getByRole('button', { name: 'Later' }).click()

  expect(await page.evaluate(activeOrgId => ({
    scoped: localStorage.getItem(`entix_onb_dismissed:${activeOrgId}`),
    global: localStorage.getItem('entix_onb_dismissed'),
  }), orgId)).toEqual({ scoped: '1', global: '1' })
})

test('skipping setup still completes onboarding on Done', async ({ page }) => {
  const initialStatus: OnboardingStatus = {
    completed: false, completedAt: null,
    openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
  }
  await prepareApp(page, initialStatus)
  let completeCalls = 0
  await page.route('https://api.entix.io/api/onboarding/complete', async route => {
    completeCalls += 1
    await route.fulfill({ json: { completed: true, completedAt: '2026-08-14T00:00:00.000Z' } })
  })

  await skipToDone(page)
  await expect.poll(() => completeCalls).toBe(1)
})

test('Done disables both destinations while automatic completion is pending', async ({ page }) => {
  await prepareApp(page, {
    completed: false, completedAt: null,
    openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
  })
  let releaseCompletion!: () => void
  const completionReleased = new Promise<void>(resolve => { releaseCompletion = resolve })
  await page.route('https://api.entix.io/api/onboarding/complete', async route => {
    await completionReleased
    await route.fulfill({ json: { completed: true, completedAt: '2026-08-14T00:00:00.000Z' } })
  })

  await skipToDone(page)
  const main = page.getByRole('main')
  const dashboard = main.getByRole('button', { name: 'Dashboard' })
  const invoice = main.getByRole('button', { name: 'Create your first invoice' })
  await expect(dashboard).toBeDisabled()
  await expect(invoice).toBeDisabled()
  await expect(invoice.click({ timeout: 300 })).rejects.toThrow()
  await expect(page).toHaveURL(/\/app\/onboarding/)

  releaseCompletion()
  await expect(dashboard).toBeEnabled()
  await expect(invoice).toBeEnabled()
})

test('Done retry disables both destinations and honors only the first click', async ({ page }) => {
  await prepareApp(page, {
    completed: false, completedAt: null,
    openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
  })
  let completeCalls = 0
  let releaseRetry!: () => void
  const retryReleased = new Promise<void>(resolve => { releaseRetry = resolve })
  await page.route('https://api.entix.io/api/onboarding/complete', async route => {
    completeCalls += 1
    if (completeCalls === 1) {
      await route.fulfill({ status: 503, json: { message: 'Could not save onboarding completion' } })
      return
    }
    await retryReleased
    await route.fulfill({ json: { completed: true, completedAt: '2026-08-14T00:00:00.000Z' } })
  })

  await skipToDone(page)
  await expect(page.getByRole('alert')).toContainText('Could not save onboarding completion')
  const main = page.getByRole('main')
  const dashboard = main.getByRole('button', { name: 'Dashboard' })
  const invoice = main.getByRole('button', { name: 'Create your first invoice' })
  await expect(dashboard).toBeEnabled()
  await expect(invoice).toBeEnabled()

  await dashboard.click()
  await expect(dashboard).toBeDisabled()
  await expect(invoice).toBeDisabled()
  await expect(invoice.click({ timeout: 300 })).rejects.toThrow()
  expect(completeCalls).toBe(2)

  releaseRetry()
  await expect(page).toHaveURL(/\/app(?:\?|$)/)
})

test('Done surfaces completion failure and does not navigate', async ({ page }) => {
  await prepareApp(page, {
    completed: false, completedAt: null,
    openingBalancesDone: false, openingAt: null, productsCount: 0, contactsCount: 0,
  })
  await page.route('https://api.entix.io/api/onboarding/complete', route =>
    route.fulfill({ status: 503, json: { message: 'Could not save onboarding completion' } }),
  )

  await skipToDone(page)
  await expect(page.getByRole('alert')).toContainText('Could not save onboarding completion')
  await page.getByRole('main').getByRole('button', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/\/app\/onboarding/)
})
