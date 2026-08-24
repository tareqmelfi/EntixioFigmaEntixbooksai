import { expect, test, type Page } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

const ORG_ID = 'org_1'
const ORG_NAME = 'Acme Industries'
const USER_ID = 'user_1'
const THREAD_ID = 'thread_1'

const ORG_DETAIL_PATH = `/app/admin/orgs/${ORG_ID}`
const USER_DETAIL_PATH = `/app/admin/users/${USER_ID}`
const SUBSCRIBER_DETAIL_PATH = `/app/admin/subscribers/${ORG_ID}`
const SUPPORT_DETAIL_PATH = `/app/admin/support/${THREAD_ID}`

interface WorkspaceStatusOptions {
  orgDetailStatus?: 200 | 401 | 403 | 404
  userDetailStatus?: 200 | 401 | 403 | 404
  subscriberDetailStatus?: 200 | 401 | 403 | 404
  supportDetailStatus?: 200 | 401 | 403 | 404
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
            user: { id: USER_ID, email: 'owner@acme.test', name: 'Owner', emailVerified: true },
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
            id: THREAD_ID,
            title: 'Billing issue',
            createdAt: '2026-08-24T10:00:00.000Z',
            lastMessageAt: '2026-08-24T11:00:00.000Z',
            messageCount: 4,
            user: { id: USER_ID, email: 'owner@acme.test', name: 'Owner' },
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

function userWorkspacePayload() {
  return {
    kind: 'user_workspace',
    summary: {
      source: 'users',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        id: USER_ID,
        email: 'owner@acme.test',
        name: 'Owner',
        emailVerified: true,
        createdAt: '2026-08-01T00:00:00.000Z',
        locale: 'en',
      },
    },
    memberships: {
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
            org: {
              id: ORG_ID,
              name: ORG_NAME,
              slug: 'acme-industries',
              country: 'US',
            },
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
    authProviders: {
      source: 'auth_accounts',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        items: [{ providerId: 'credential', createdAt: '2026-08-01T00:00:00.000Z' }],
        nextCursor: null,
        hasMore: false,
      },
    },
  }
}

function subscriberWorkspacePayload() {
  return {
    kind: 'subscriber_workspace',
    summary: {
      source: 'subscriptions',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        id: 'sub_1',
        orgId: ORG_ID,
        status: 'ACTIVE',
        currentPeriodStart: '2026-08-01T00:00:00.000Z',
        currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
        maskedStripeSubscriptionId: 'sub_…1234',
        maskedStripeCustomerId: 'cus_…5678',
        plan: {
          id: 'plan_1',
          name: 'Growth',
          nameAr: 'النمو',
          tier: 'pro',
          interval: 'month',
          currency: 'USD',
          price: 49,
          isActive: true,
        },
        org: {
          id: ORG_ID,
          name: ORG_NAME,
          slug: 'acme-industries',
          baseCurrency: 'USD',
        },
      },
    },
    platformBilling: {
      source: 'stripe_platform_account',
      isAuthoritative: false,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'unavailable',
      unavailableReason: 'stripe_not_configured',
      data: null,
    },
  }
}

function supportWorkspacePayload() {
  return {
    kind: 'support_workspace',
    summary: {
      source: 'ai_conversations',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        id: THREAD_ID,
        title: 'Billing issue',
        createdAt: '2026-08-01T00:00:00.000Z',
        lastMessageAt: '2026-08-24T11:00:00.000Z',
        org: {
          id: ORG_ID,
          name: ORG_NAME,
          slug: 'acme-industries',
          country: 'US',
        },
        user: {
          id: USER_ID,
          email: 'owner@acme.test',
          name: 'Owner',
        },
      },
    },
    messages: {
      source: 'ai_messages',
      isAuthoritative: true,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'available',
      unavailableReason: null,
      data: {
        items: [
          {
            id: 'msg_1',
            role: 'user',
            content: 'Need billing help',
            createdAt: '2026-08-24T10:30:00.000Z',
            metadata: {},
            userId: USER_ID,
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
    attachments: {
      source: 'support_attachments',
      isAuthoritative: false,
      asOf: '2026-08-24T10:00:00.000Z',
      availability: 'unavailable',
      unavailableReason: 'NOT_IMPLEMENTED',
      data: null,
    },
  }
}

function clickModifier(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control'
}

function stubAdminRoutes(page: Page, options: WorkspaceStatusOptions = {}) {
  const orgDetailStatus = options.orgDetailStatus ?? 200
  const userDetailStatus = options.userDetailStatus ?? 200
  const subscriberDetailStatus = options.subscriberDetailStatus ?? 200
  const supportDetailStatus = options.supportDetailStatus ?? 200

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
              owner: { id: USER_ID, email: 'owner@acme.test', name: 'Owner' },
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

    if (pathname === '/api/admin/users') {
      return route.fulfill({
        json: {
          items: [
            {
              id: USER_ID,
              email: 'owner@acme.test',
              name: 'Owner',
              emailVerified: true,
              createdAt: '2026-08-01T00:00:00.000Z',
              orgs: [{ id: ORG_ID, name: ORG_NAME, country: 'US', role: 'OWNER' }],
            },
          ],
        },
      })
    }

    if (pathname === '/api/admin/support/threads') {
      return route.fulfill({
        json: {
          items: [
            {
              id: THREAD_ID,
              title: 'Billing issue',
              lastMessageAt: '2026-08-24T11:00:00.000Z',
              org: { id: ORG_ID, name: ORG_NAME, country: 'US' },
              user: { email: 'owner@acme.test', name: 'Owner' },
              messageCount: 4,
              lastMessage: { role: 'user', content: 'Need billing help', createdAt: '2026-08-24T10:30:00.000Z', metadata: {} },
            },
          ],
        },
      })
    }

    if (pathname === `/api/admin/orgs/${ORG_ID}`) {
      if (orgDetailStatus === 401) return route.fulfill({ status: 401, json: { error: 'unauthorized' } })
      if (orgDetailStatus === 403) return route.fulfill({ status: 403, json: { error: 'forbidden' } })
      if (orgDetailStatus === 404) return route.fulfill({ status: 404, json: { error: 'not_found' } })
      return route.fulfill({ json: workspacePayload() })
    }

    if (pathname === `/api/admin/users/${USER_ID}`) {
      if (userDetailStatus === 401) return route.fulfill({ status: 401, json: { error: 'unauthorized' } })
      if (userDetailStatus === 403) return route.fulfill({ status: 403, json: { error: 'forbidden' } })
      if (userDetailStatus === 404) return route.fulfill({ status: 404, json: { error: 'not_found' } })
      return route.fulfill({ json: userWorkspacePayload() })
    }

    if (pathname === `/api/admin/subscribers/${ORG_ID}`) {
      if (subscriberDetailStatus === 401) return route.fulfill({ status: 401, json: { error: 'unauthorized' } })
      if (subscriberDetailStatus === 403) return route.fulfill({ status: 403, json: { error: 'forbidden' } })
      if (subscriberDetailStatus === 404) return route.fulfill({ status: 404, json: { error: 'not_found' } })
      return route.fulfill({ json: subscriberWorkspacePayload() })
    }

    if (pathname === `/api/admin/support/${THREAD_ID}`) {
      if (supportDetailStatus === 401) return route.fulfill({ status: 401, json: { error: 'unauthorized' } })
      if (supportDetailStatus === 403) return route.fulfill({ status: 403, json: { error: 'forbidden' } })
      if (supportDetailStatus === 404) return route.fulfill({ status: 404, json: { error: 'not_found' } })
      return route.fulfill({ json: supportWorkspacePayload() })
    }

    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
}

test.describe('admin entity workspaces', () => {
  test('org row is a primary native link target (pointer + keyboard + nested-control isolation)', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Orgs' }).click()

    const rowLink = page.getByTestId(`admin-org-row-link-${ORG_ID}`)
    await expect(rowLink).toBeVisible()
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)

    const ownerCell = page.locator(`tr:has([data-testid="admin-org-row-link-${ORG_ID}"]) td`).nth(1)
    await ownerCell.click()
    await expect(page).toHaveURL(ORG_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    await rowLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(ORG_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    await rowLink.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(ORG_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    await page.getByRole('button', { name: 'Members' }).click()
    await expect(page).toHaveURL('/app/admin')
    await expect(page.getByText('Org members')).toBeVisible()
  })

  test('user row is a primary native link target with nested actions isolated', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Users' }).click()

    const rowLink = page.getByTestId(`admin-user-row-link-${USER_ID}`)
    await expect(rowLink).toBeVisible()
    await expect(rowLink).toHaveAttribute('href', USER_DETAIL_PATH)

    const orgCell = page.locator(`tr:has([data-testid="admin-user-row-link-${USER_ID}"]) td`).nth(1)
    await orgCell.click()
    await expect(page).toHaveURL(USER_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    await rowLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(USER_DETAIL_PATH)

    await page.goBack()
    await expect(page).toHaveURL('/app/admin')

    await page.getByRole('button', { name: 'Password' }).click()
    await expect(page).toHaveURL('/app/admin')
    await expect(page.getByText('New password for')).toBeVisible()
  })

  test('native href/context/middle/meta click semantics are preserved on org row link', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Orgs' }).click()

    const rowLink = page.getByTestId(`admin-org-row-link-${ORG_ID}`)
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)

    await rowLink.click({ button: 'right' })
    await expect(page).toHaveURL('/app/admin')

    await rowLink.click({ modifiers: [clickModifier()] })
    await expect(page).toHaveURL('/app/admin')
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)

    await rowLink.click({ button: 'middle' })
    await expect(page).toHaveURL('/app/admin')
    await expect(rowLink).toHaveAttribute('href', ORG_DETAIL_PATH)
  })

  test('org workspace tabs are query-addressable and browser history aware', async ({ page }) => {
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

  test('cross-links connect org, user, subscriber, and support workspaces', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto(`${ORG_DETAIL_PATH}?tab=people`)
    await expect(page.getByTestId(`org-people-user-link-${USER_ID}`)).toHaveAttribute('href', USER_DETAIL_PATH)

    await page.getByTestId(`org-people-user-link-${USER_ID}`).click()
    await expect(page).toHaveURL(USER_DETAIL_PATH)

    await page.getByRole('link', { name: 'Memberships' }).click()
    await expect(page).toHaveURL(`${USER_DETAIL_PATH}?tab=memberships`)

    await expect(page.getByTestId(`user-membership-org-link-${ORG_ID}`)).toHaveAttribute('href', ORG_DETAIL_PATH)
    await expect(page.getByTestId(`user-membership-subscriber-link-${ORG_ID}`)).toHaveAttribute('href', SUBSCRIBER_DETAIL_PATH)

    await page.getByTestId(`user-membership-subscriber-link-${ORG_ID}`).click()
    await expect(page).toHaveURL(SUBSCRIBER_DETAIL_PATH)

    await expect(page.getByTestId(`subscriber-org-link-${ORG_ID}`)).toHaveAttribute('href', ORG_DETAIL_PATH)

    await page.goto(`${ORG_DETAIL_PATH}?tab=support`)
    await expect(page.getByTestId(`org-support-thread-link-${THREAD_ID}`)).toHaveAttribute('href', SUPPORT_DETAIL_PATH)

    await page.getByTestId(`org-support-thread-link-${THREAD_ID}`).click()
    await expect(page).toHaveURL(SUPPORT_DETAIL_PATH)

    await expect(page.getByTestId(`support-user-link-${USER_ID}`)).toHaveAttribute('href', USER_DETAIL_PATH)
    await expect(page.getByTestId(`support-org-link-${ORG_ID}`)).toHaveAttribute('href', ORG_DETAIL_PATH)
  })

  test('subscriber workspace renders stripe unavailable partial state with retry affordance', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto(SUBSCRIBER_DETAIL_PATH)

    await expect(page.getByRole('heading', { name: 'Subscriber workspace' })).toBeVisible()
    await expect(page.getByText('Stripe billing is currently unavailable')).toBeVisible()

    await page.getByRole('button', { name: 'Retry billing' }).click()
    await expect(page).toHaveURL(SUBSCRIBER_DETAIL_PATH)
  })

  test('workspace routes render distinct 401, 403, and 404 states for org/user/subscriber/support', async ({ page }) => {
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

    await stubAdminRoutes(page, { userDetailStatus: 401 })
    await page.goto(USER_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Session required' })).toBeVisible()

    await stubAdminRoutes(page, { userDetailStatus: 403 })
    await page.goto(USER_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()

    await stubAdminRoutes(page, { userDetailStatus: 404 })
    await page.goto(USER_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'User not found' })).toBeVisible()

    await stubAdminRoutes(page, { subscriberDetailStatus: 401 })
    await page.goto(SUBSCRIBER_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Session required' })).toBeVisible()

    await stubAdminRoutes(page, { subscriberDetailStatus: 403 })
    await page.goto(SUBSCRIBER_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()

    await stubAdminRoutes(page, { subscriberDetailStatus: 404 })
    await page.goto(SUBSCRIBER_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Subscriber not found' })).toBeVisible()

    await stubAdminRoutes(page, { supportDetailStatus: 401 })
    await page.goto(SUPPORT_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Session required' })).toBeVisible()

    await stubAdminRoutes(page, { supportDetailStatus: 403 })
    await page.goto(SUPPORT_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()

    await stubAdminRoutes(page, { supportDetailStatus: 404 })
    await page.goto(SUPPORT_DETAIL_PATH)
    await expect(page.getByRole('heading', { name: 'Support thread not found' })).toBeVisible()
  })
})
