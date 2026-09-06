import assert from 'node:assert/strict'
import { bindTabOrgUser, chooseMembership, readLegacyOrgId, readTabOrgId, rememberTabOrgId } from '../src/app/lib/tab-org-selection'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
}
const shared = new MemoryStorage(), tabA = new MemoryStorage(), tabB = new MemoryStorage()
Object.assign(globalThis, { localStorage: shared, sessionStorage: tabA })
const memberships = [
  { role: 'OWNER', org: { id: 'sa-company', name: 'Saudi fixture', country: 'SA', baseCurrency: 'SAR' } },
  { role: 'OWNER', org: { id: 'us-company', name: 'US fixture', country: 'US', baseCurrency: 'USD' } },
]
bindTabOrgUser('fixture-user'); assert.equal(rememberTabOrgId('sa-company'), true)
shared.setItem('entix_org_id', 'us-company')
shared.setItem('entix_org_explicit', String(Date.now() - 86_400_000))
assert.equal(readTabOrgId('fixture-user'), 'sa-company')
assert.equal(readTabOrgId('other-user'), null)
const choices = { tabId: readTabOrgId('fixture-user'), legacyId: 'us-company', defaultId: 'us-company', serverId: 'us-company' }
assert.equal(chooseMembership(memberships, choices)?.org?.id, 'sa-company')
assert.equal(chooseMembership(memberships.slice(1), choices), null)
assert.equal(chooseMembership(memberships, { ...choices, tabId: null, legacyId: null })?.org?.id, 'us-company')
shared.setItem('entix_user_cache', JSON.stringify({ user: { id: 'other-user' } }))
assert.equal(readLegacyOrgId('fixture-user'), null)
Object.assign(globalThis, { sessionStorage: tabB })
rememberTabOrgId('us-company')
assert.equal(readTabOrgId('fixture-user'), 'us-company')
Object.assign(globalThis, { sessionStorage: tabA })
assert.equal(readTabOrgId('fixture-user'), 'sa-company')

let unavailable = false, availableMemberships = memberships
const sent: Array<{ path: string; orgId: string | null; method: string }> = []
globalThis.fetch = async (input, init) => {
  const path = new URL(String(input)).pathname
  sent.push({ path, orgId: new Headers(init?.headers).get('X-Org-Id'), method: init?.method || 'GET' })
  if (path === '/api/auth/get-session') return Response.json({ user: { id: 'fixture-user', name: 'Fixture', email: 'fixture@example.invalid', createdAt: '2026-01-01' } })
  if (path === '/me') return unavailable ? Response.json({}, { status: 503 }) : Response.json({ selectedOrgId: 'us-company', defaultOrgId: 'us-company', memberships: availableMemberships })
  if (path === '/api/invoices') return Response.json({ items: [], total: 0 })
  throw new Error(`Unexpected request: ${path}`)
}
const { api, getOrgId, setOrgId, bootstrapOrgIdFromStorage } = await import('../src/app/lib/api')
assert.equal(getOrgId(), null, 'Storage is not trusted before authentication')
const { authStore } = await import('../src/app/components/auth-store')
for (let n = 0; authStore.getState().loading && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 1))
assert.equal(getOrgId(), 'sa-company')
assert.equal(authStore.getState().user?.company, 'Saudi fixture')
await api.invoices.list()
assert.equal(sent.at(-1)?.orgId, 'sa-company', 'Invoice reads use the displayed company, not shared localStorage')
shared.setItem('entix_act_as', JSON.stringify({ orgId: 'us-company', until: Date.now() + 60_000 }))
await api.invoices.list()
assert.equal(sent.at(-1)?.orgId, 'sa-company', 'An admin grant in another workspace must not overwrite this request context')
shared.removeItem('entix_act_as')
const now = Date.now
Date.now = () => now() + 86_400_000
try { await authStore.refresh() } finally { Date.now = now }
assert.equal(getOrgId(), 'sa-company', 'Refresh a day later must not select the pinned company')
assert.ok(!sent.some(row => row.method === 'PATCH'), 'Reload must not rewrite another device\'s preference')
unavailable = true; await authStore.refresh()
assert.equal(getOrgId(), null)
assert.equal(authStore.getState().organizationError, 'verification_failed')
assert.equal(readTabOrgId('fixture-user'), 'sa-company', 'Temporary outage preserves the tab choice')
unavailable = false; await authStore.refresh()
assert.equal(getOrgId(), 'sa-company')
availableMemberships = memberships.slice(1); await authStore.refresh()
assert.equal(getOrgId(), null)
assert.equal(authStore.getState().organizationError, 'selection_required')
assert.equal(authStore.getState().needsOnboarding, false)
availableMemberships = memberships
Object.assign(globalThis, { sessionStorage: tabB }); await authStore.refresh()
assert.equal(getOrgId(), 'us-company'); await api.invoices.list()
assert.equal(sent.at(-1)?.orgId, 'us-company')
Object.assign(globalThis, { sessionStorage: tabA }); await authStore.refresh()
assert.equal(getOrgId(), 'sa-company')
setOrgId(null, false); assert.equal(bootstrapOrgIdFromStorage(), 'sa-company', 'Print bootstrap follows this tab')
setOrgId(null); assert.equal(readTabOrgId(), null, 'Sign-out clears the tab selection')
console.log('Company context regressions passed: delayed reload, independent tabs, request headers, account ownership, membership removal, outage recovery, print and sign-out. No live requests.')
