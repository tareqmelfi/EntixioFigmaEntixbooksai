/** A tab owns its company choice. Profile defaults are only initial preferences. */
const KEY = 'entix_tab_org_v1'
let verifiedUserId: string | null = null
type Selection = { userId: string; orgId: string }
type Membership = { org?: { id: string; demoExpiresAt?: string | null } | null; role?: string }

function storedSelection(): Selection | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    return typeof value?.userId === 'string' && typeof value?.orgId === 'string' ? value : null
  } catch { return null }
}

export function readTabOrgId(userId?: string): string | null {
  const value = storedSelection()
  return value && (!userId || value.userId === userId) ? value.orgId : null
}

/** Bind only after the server has authenticated the user and returned memberships. */
export function bindTabOrgUser(userId: string) { verifiedUserId = userId }

export function rememberTabOrgId(orgId: string | null) {
  try {
    if (!orgId) { sessionStorage.removeItem(KEY); verifiedUserId = null; return true }
    const userId = verifiedUserId || storedSelection()?.userId
    if (!userId) return false
    sessionStorage.setItem(KEY, JSON.stringify({ userId, orgId }))
    return true
  } catch { return false }
}

/** One-time migration of an old choice, only for its cached, now authenticated owner. */
export function readLegacyOrgId(userId: string): string | null {
  try {
    const cached = JSON.parse(localStorage.getItem('entix_user_cache') || 'null')
    return cached?.user?.id === userId ? localStorage.getItem('entix_org_id') : null
  } catch { return null }
}

export function chooseMembership<T extends Membership>(memberships: T[], choices: { tabId: string | null; legacyId: string | null; defaultId: string | null; serverId: string | null }): T | null {
  const match = (id: string | null) => id ? memberships.find(m => m.org?.id === id) : undefined
  // A removed membership requires an explicit new choice, never a silent switch.
  if (choices.tabId) return match(choices.tabId) || null
  return match(choices.legacyId) || match(choices.defaultId) || match(choices.serverId)
    || memberships.find(m => m.org && m.org.demoExpiresAt == null)
    || memberships.find(m => m.role === 'OWNER') || memberships[0] || null
}
