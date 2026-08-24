import { expect, test, type Page } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

const ORG_ID = 'org_1'
const ORG_NAME = 'Acme Industries'

function stubAdminRoutes(page: Page) {
  return page.route('https://api.entix.io/api/admin/**', (route) => {
    const reqUrl = new URL(route.request().url())
    const { pathname, searchParams } = reqUrl

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
      const cursor = searchParams.get('cursor')
      void cursor
      return route.fulfill({
        json: {
          kind: 'organization_workspace',
          summary: {
            source: 'organizations',
            isAuthoritative: true,
            asOf: '2026-08-24T10:00:00.000Z',
            availability: 'available',
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
            data: { members: 2, invoices: 5, bills: 1, expenses: 3 },
          },
          people: {
            source: 'org_memberships',
            isAuthoritative: true,
            asOf: '2026-08-24T10:00:00.000Z',
            availability: 'available',
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
            },
          },
          subscription: {
            source: 'subscriptions',
            isAuthoritative: true,
            asOf: '2026-08-24T10:00:00.000Z',
            availability: 'available',
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
            },
          },
          activity: {
            source: 'audit_logs',
            isAuthoritative: true,
            asOf: '2026-08-24T10:00:00.000Z',
            availability: 'available',
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
        },
      })
    }

    return route.fulfill({ status: 404, json: { error: 'not_found' } })
  })
}

test.describe('admin organization workspace', () => {
  test('org representations are native links to workspace detail', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Orgs' }).click()

    const orgLink = page.getByRole('link', { name: ORG_NAME }).first()
    await expect(orgLink).toBeVisible()
    await expect(orgLink).toHaveAttribute('href', `/app/admin/orgs/${ORG_ID}`)

    await orgLink.click()
    await expect(page).toHaveURL(`/app/admin/orgs/${ORG_ID}`)
  })

  test('workspace tabs are query-addressable and browser history aware', async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await stubAdminRoutes(page)

    await page.goto(`/app/admin/orgs/${ORG_ID}?tab=support`)

    await expect(page.getByRole('heading', { name: 'Support threads' })).toBeVisible()

    await page.getByRole('link', { name: 'Activity' }).click()
    await expect(page).toHaveURL(`/app/admin/orgs/${ORG_ID}?tab=activity`)
    await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(`/app/admin/orgs/${ORG_ID}?tab=support`)
    await expect(page.getByRole('heading', { name: 'Support threads' })).toBeVisible()
  })
})
