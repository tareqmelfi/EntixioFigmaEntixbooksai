import { expect, test, type Page } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

const ORG_ID = 'org_1'
const ORG_NAME = 'Acme Industries'
const ORG_DETAIL_PATH = `/app/admin/orgs/${ORG_ID}`

interface WorkspaceStatusOptions {
  orgDetailStatus?: 200 | 401 | 403 | 404
}

interface WorkspaceCursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

interface WorkspaceSection<T> {
  source: string
  isAuthoritative: boolean
  asOf: string
  availability: 'available' | 'partial' | 'unavailable'
  unavailableReason: string | null
  data: T
}

interface WorkspacePayload {
  kind: 'organization_workspace'
  summary: WorkspaceSection<{
    id: string
    name: string
    slug: string
    country: string
    baseCurrency: string
    industry: string | null
    createdAt: string
    updatedAt: string
  }>
  metrics: WorkspaceSection<{ members: number; invoices: number; bills: number; expenses: number }>
  people: WorkspaceSection<WorkspaceCursorPage<ArrayElement<WorkspaceMember[]>>>
  subscription: WorkspaceSection<{
    id: string
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    trialEndsAt: string | null
    maskedStripeSubscriptionId: string | null
    maskedStripeCustomerId: string | null
    plan: {
      id: string
      name: string
      tier: string
      interval: string
      currency: string
      price: number
    } | null
  } | null>
  support: WorkspaceSection<WorkspaceCursorPage<ArrayElement<WorkspaceSupportThread[]>>>
  activity: WorkspaceSection<WorkspaceCursorPage<ArrayElement<WorkspaceActivity[]>>>
  referral: WorkspaceSection<null>
  outstandingPlatformBilling: WorkspaceSection<null>
}

type WorkspaceMember = Array<{
  id: string
  role: string
  createdAt: string
  user: { id: string; email: string; name: string | null; emailVerified: boolean }
}>

type WorkspaceSupportThread = Array<{
  id: string
  title: string
  createdAt: string
  lastMessageAt: string
  messageCount: number
  user: { id: string; email: string; name: string | null }
}>

type WorkspaceActivity = Array<{
  id: string
  action: string
  entityType: string
  entityId: string | null
  severity: string
  occurredAt: string
}>

type ArrayElement<T extends readonly unknown[]> = T[number]

function workspacePayload(): WorkspacePayload {
  return {
    kind: 'organization_workspace',
    summary: {
      source: 'organizations',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        id: ORG_ID,
        name: ORG_NAME,
        slug: 'acme-industries',
        country: 'US',
        baseCurrency: 'USD',
        industry: 'Manufacturing',
        createdAt: '2026-08-24T10:00:00.000Z',
        updatedAt: '2026-08-24T10:00:00.000Z',
      },
    },
    metrics: {
      source: 'organizations',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: { members: 2, invoices: 5, bills: 1, expenses: 3 },
    },
    people: {
      source: 'org_memberships',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        items: [
          {
            id: 'm_1',
            role: 'OWNER',
            createdAt: '2026-08-24T10:00:00.000Z',
            user: { id: 'u_1', email: 'owner@acme.test', name: 'Owner', emailVerified: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
    subscription: {
      source: 'subscriptions',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        id: 'sub_1',
        status: 'ACTIVE',
        currentPeriodStart: '2026-08-01T00:00:00.000Z',
        currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
        maskedStripeSubscriptionId: 'sub_…1234',
        maskedStripeCustomerId: 'cus_…5678',
        plan: {
          id: 'plan_1',
          name: 'Growth',
          tier: 'pro',
          interval: 'month',
          currency: 'USD',
          price: 49,
        },
      },
    },
    support: {
      source: 'ai_conversations',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        items: [
          {
            id: 'thread_1',
            title: 'Billing issue',
            createdAt: '2026-08-24T10:00:00.000Z',
            lastMessageAt: '2026-08-24T11:00:00.000Z',
            messageCount: 4,
            user: { id: 'u_1', email: 'owner@acme.test', name: 'Owner' },
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
    activity: {
      source: 'audit_logs',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        items: [
          {
            id: 'audit_1',
            action: 'subscription.updated',
            entityType: 'subscription',
            entityId: 'sub_1',
            severity: 'INFO',
            occurredAt: '2026-08-24T12:00:00.000Z',
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
    referral: {
      source: 'partner_referrals',
      isAuthoritative: false,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'unavailable',
      unavailableReason: 'not_collected_in_phase_a',
      data: null,
    },
    outstandingPlatformBilling: {
      source: 'platform_billing_read_model',
      isAuthoritative: false,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'unavailable',
      unavailableReason: 'not_collected_in_phase_a',
      data: null,
    },
  }
}

function clickModifier(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control'
}

function stubAdminRoutes(page: Page, options: WorkspaceStatusOptions = {}) {
  const detailStatus = options.orgDetailStatus ?? 200

  return page.route('https://api.entix.io/api/admin/**', (route) => {
    const reqUrl = new URL(route.request().url())
    const { pathname } = reqUrl

    if (pathname === '/api/admin/overview') {
      return route.fulfill({
        json: {
          users: 3,
          orgs: 1,
          newUsers7d: 1,
          newOrgs7d: 1,
          subsByStatus: { ACTIVE: 1 },
          recentOrgs: [
            {
              id: ORG_ID,
              name: ORG_NAME,
              country: 'US',
              createdAt: '2026-08-24T10:00:00.000Z',
              ownerEmail: 'owner@acme.test',
              plan: 'Growth',
              tier: 'pro',
              status: 'ACTIVE',
            },
          ],
        },
      })
    }

    if (pathname === '/api/admin/orgs') {
      return route.fulfill({
        json: {
          items: [
            {
              id: ORG_ID,
              name: ORG_NAME,
              slug: 'acme-industries',
              country: 'US',
              currency: 'USD',
              industry: 'Manufacturing',
              createdAt: '2026-08-24T10:00:00.000Z',
              members: 2,
              invoices: 5,
              owner: { id: 'u_1', email: 'owner@acme.test', name: 'Owner' },
              subscription: {
                status: 'ACTIVE',
                currentPeriodEnd: '2026-12-01T00:00:00.000Z',
                plan: {
                  id: 'plan_1',
                  name: 'Growth',
                  tier: 'pro',
                  price: 49,
                  currency: 'USD',
                  interval: 'month',
                },
                price: 49,
              },
            },
          ],
        },
      })
    }

    if (pathname === `/api/admin/orgs/${ORG_ID}`) {
      if (detailStatus === 401) return route.fulfill({ status: 401, json: { error: 'unauthorized' } })
      if (detailStatus === 403) return route.fulfill({ status: 403, json: { error: 'forbidden' } })
      if (detailStatus === 404) return route.fulfill({ status: 404, json: { error: 'not_found' } })
      return route.fulfill({ json: workspacePayload() })
    }

    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
}

test.describe('admin organization workspace', () => {
  test('org row is a primary native link target (pointer + keyboard + nested-control isolation)', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Orgs' }).click()

    const rowLink = page.getByTestId(`admin-org-row-link-${ORG_ID}`)
    await expect(rowLink).toBeVisible()
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)

    // Row-area click (not just name text) navigates
    const ownerCell = page.locator(`tr:has([data-testid="admin-org-row-link-${ORG_ID}"]) td`).nth(1)
    await ownerCell.click()
    await expect(page).toHaveURL(ORG_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    // Enter on focused link navigates
    await rowLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(ORG_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    // Space on focused link navigates (explicit keyboard contract)
    await rowLink.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(ORG_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    // Nested interactive control does NOT navigate
    await page.getByRole('button', { name: 'Members' }).click()
    await expect(page).toHaveURL('/app/admin')
    await expect(page.getByText('Org members')).toBeVisible()
  })

  test('native href/context/middle/meta click semantics are preserved on row link', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Orgs' }).click()

    const rowLink = page.getByTestId(`admin-org-row-link-${ORG_ID}`)
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)

    // Context menu/right-click should not navigate current tab
    await rowLink.click({ button: 'right' })
    await expect(page).toHaveURL('/app/admin')

    // Modifier-click contract: current tab must not navigate; href target remains native.
    await rowLink.click({ modifiers: [clickModifier()] })
    await expect(page).toHaveURL('/app/admin')
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)

    // Middle-click contract: current tab must not navigate; href target remains native.
    await rowLink.click({ button: 'middle' })
    await expect(page).toHaveURL('/app/admin')
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)
  })

  test('workspace tabs are query-addressable and browser history aware', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto(`${ORG_DETAIL_PATH}?tab=support`)

    await expect(page.getByRole('heading', { name: 'Support threads' })).toBeVisible()

    await page.getByRole('link', { name: 'Activity' }).click()
    await expect(page).toHaveURL(`${ORG_DETAIL_PATH}?tab=activity`)
    await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(`${ORG_DETAIL_PATH}?tab=support`)
    await expect(page.getByRole('heading', { name: 'Support threads' })).toBeVisible()
  })

  test('workspace route renders distinct 401, 403, and 404 states', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page, { orgDetailStatus: 401 })
    await page.goto(ORG_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Session required' })).toBeVisible()

    await stubAdminRoutes(page, { orgDetailStatus: 403 })
    await page.goto(ORG_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()

    await stubAdminRoutes(page, { orgDetailStatus: 404 })
    await page.goto(ORG_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Organization not found' })).toBeVisible()
  })
})
