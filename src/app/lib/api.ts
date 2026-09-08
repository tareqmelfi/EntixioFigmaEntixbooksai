/**
 * Entix Books · API client
 *
 * Wraps fetch with:
 *  - Base URL (api.entix.io · localhost:3000 in dev)
 *  - Cookie-based better-auth sessions
 *  - Active org id (X-Org-Id header)
 *  - JSON serialization
 *  - Error envelope normalization
 */
import { readTabOrgId, rememberTabOrgId } from './tab-org-selection'
import type { DuplicateDecision, SimilarityReview } from './similarity-review'

export type { DuplicateDecision, DuplicateDecisionAction, SimilarityReview } from './similarity-review'

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'https://api.entix.io'

export const API_BASE_URL = API_BASE

// ── Org state ────────────────────────────────────────────────────────────────
let orgId: string | null = null

/**
 * @deprecated Sessions are cookie-based via better-auth. Kept as a no-op
 * compatibility shim for older callers while removing legacy token storage.
 */
export function setAuthToken(token: string | null) {
  void token
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('entix_token')
  }
}

/** Active company id (in-memory · set by authStore after session validation). */
export function getOrgId(): string | null {
  return orgId
}

// S3 (2026-08-26): GET /orgs was fired ~40× per Settings load (every hook and
// page re-resolved the active org). One short-lived cache + in-flight dedupe;
// every org mutation and org switch invalidates it.
const ORGS_TTL_MS = 15_000
let orgsCache: { at: number; data: Org[] } | null = null
let orgsInflight: Promise<Org[]> | null = null
export function invalidateOrgsCache() { orgsCache = null }
function listOrgsCached(): Promise<Org[]> {
  if (orgsCache && Date.now() - orgsCache.at < ORGS_TTL_MS) return Promise.resolve(orgsCache.data)
  if (orgsInflight) return orgsInflight
  orgsInflight = request<Org[]>('/orgs', { skipOrg: true })
    .then((data) => { orgsCache = { at: Date.now(), data }; return data })
    .finally(() => { orgsInflight = null })
  return orgsInflight
}

export function setOrgId(id: string | null, persist = true) {
  if (id !== orgId) invalidateOrgsCache()
  orgId = id
  if (persist) rememberTabOrgId(id)
  if (!id && persist) {
    try { localStorage.removeItem('entix_org_id'); localStorage.removeItem('entix_org_explicit') } catch {}
  }
}

// SECURITY: Do NOT bootstrap orgId from localStorage at module load.
// The previous user's org id would be sent as X-Org-Id on the first
// API calls before the session is revalidated, leaking another user's
// data. orgId must be set only after authStore.refresh() confirms the
// current user's membership.
if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('entix_token')
  // Intentionally NOT reading entix_org_id here
}

/**
 * Print views ONLY (standalone /print/* routes outside AuthGuard, often in
 * iframes with a fresh JS context): explicitly adopt the stored org id.
 * Safe because the API's requireOrg middleware verifies membership on every
 * org-scoped call — a stale id can never leak another user's data, it just
 * 403s/404s. Callers should still retry across memberships on failure (the
 * stored org may not be the document's org).
 */
export function bootstrapOrgIdFromStorage(): string | null {
  const stored = readTabOrgId()
  if (stored) setOrgId(stored)
  return stored
}

// ── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number
  detail?: string
  /** machine-readable code from the typed backend payload (e.g. "database_unavailable") */
  code?: string
  /** Arabic server message when provided */
  messageAr?: string
  /** correlation id logged server-side · quote it to support */
  requestId?: string
  /** structured validation messages keyed by request field */
  fieldErrors?: Record<string, string[]>
  /** raw parsed JSON body — for payloads carrying extra machine fields (e.g. invitedEmail) */
  body?: unknown
  constructor(
    status: number,
    message: string,
    detail?: string,
    extras?: { code?: string; messageAr?: string; requestId?: string; fieldErrors?: Record<string, string[]>; body?: unknown },
  ) {
    super(message)
    this.status = status
    this.detail = detail
    this.code = extras?.code
    this.body = extras?.body
    this.messageAr = extras?.messageAr
    this.requestId = extras?.requestId
    this.fieldErrors = extras?.fieldErrors
  }
}


/** Client-side error reference — generated whenever the server didn't provide
 * one (old API versions, network failures). Displayed to the user and logged
 * with full context so support can correlate: "R-<time36>-<rand>". */
export function clientErrorRef(): string {
  return 'R-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase()
}

// ── Core fetch ────────────────────────────────────────────────────────────────
type FetchOpts = {
  method?: string
  body?: unknown
  query?: Record<string, string | number | undefined | null>
  skipOrg?: boolean
  signal?: AbortSignal
  headers?: Record<string, string>
}

/**
 * Multipart upload · the one place a File is POSTed. `request` always sends JSON,
 * and FormData must NOT carry a content-type header (the browser writes the
 * boundary), so this stays separate rather than growing a mode flag.
 */
async function uploadFile<T>(path: string, file: File, fields?: Record<string, string>): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(fields || {})) form.append(k, v)
  const headers: Record<string, string> = {}
  const oid = getOrgId()
  if (oid) headers['X-Org-Id'] = oid
  try {
    const raw = localStorage.getItem('entix_act_as')
    if (raw) { const v = JSON.parse(raw); if (v?.orgId === getOrgId() && v.until > Date.now()) { headers['X-Org-Id'] = v.orgId; headers['X-Admin-Org-Id'] = v.orgId } }
  } catch { /* ignore */ }
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form, credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as any)?.message || (data as any)?.error || 'upload_failed', undefined, { body: data })
  return data as T
}

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  }
  // Locale travels with every call — server-rendered content (emails, errors,
  // PDF) follows the user's chosen language instead of a backend default.
  if (!headers['Accept-Language']) {
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('entix-language')) || 'en'
    headers['Accept-Language'] = lang === 'ar' ? 'ar-SA,ar;q=0.9,en;q=0.8' : 'en-US,en;q=0.9,ar;q=0.8'
  }
  if (!opts.skipOrg && orgId) headers['X-Org-Id'] = orgId
  // Z2.3 · Open-as-admin: the grant in localStorage turns the active org into an
  // admin override (requireOrg accepts + audit-logs it · restricted paths 403).
  if (!opts.skipOrg && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('entix_act_as')
      if (raw) { const v = JSON.parse(raw); if (v?.orgId === getOrgId() && v.until > Date.now()) { headers['X-Org-Id'] = v.orgId; headers['X-Admin-Org-Id'] = v.orgId } }
    } catch { /* ignore */ }
  }

  let body: string | undefined
  if (opts.body !== undefined) body = JSON.stringify(opts.body)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      method: opts.method || 'GET',
      headers,
      body,
      signal: opts.signal,
      credentials: 'include',
    })
  } catch (e: any) {
    const ref = clientErrorRef()
    console.error(`[api] ${ref} NETWORK ${opts.method || 'GET'} ${path}`, e?.message || e)
    throw new ApiError(0, 'network_error', undefined, { code: 'network_error', requestId: ref })
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('json') ? await res.json().catch(() => null) : await res.text()

  if (!res.ok) {
    // Normalize error shape — backend may send { error: "string" } | { error: { message } } | { message } | Zod validation errors
    let message: string = res.statusText || `HTTP ${res.status}`
    let detail: string | undefined
    let code: string | undefined
    let messageAr: string | undefined
    let requestId: string | undefined
    let fieldErrors: Record<string, string[]> | undefined
    if (data && typeof data === 'object') {
      const d = data as any
      if (typeof d.error === 'string') { message = d.error; code = d.error }
      else if (d.error && typeof d.error === 'object') {
        message = d.error.message || d.error.code || JSON.stringify(d.error)
        if (typeof d.error.code === 'string') code = d.error.code
      } else if (typeof d.message === 'string') message = d.message
      // Human fallback for 404 / route-not-found so the UI never shows the raw
      // "not_found" machine code (e.g. a stale backend deploy missing a route).
      if (code === 'not_found' || res.status === 404) {
        message = 'تعذّر الوصول إلى الخدمة المطلوبة — تحقق أن النظام محدّث.'
      }
      // Zod validation: { success: false, error: { issues: [{path, message}, ...] } }
      if (Array.isArray(d?.error?.issues)) {
        message = d.error.issues.map((i: any) => `${(i.path || []).join('.')} ${i.message}`).join(' · ')
        code = 'validation_failed'
      }
      if (typeof d.messageAr === 'string') messageAr = d.messageAr
      if (typeof d.requestId === 'string') requestId = d.requestId
      if (d.fieldErrors && typeof d.fieldErrors === 'object') fieldErrors = d.fieldErrors
      detail = typeof d.detail === 'string' ? d.detail : (d.detail ? JSON.stringify(d.detail) : undefined)
    } else if (typeof data === 'string' && data.trim()) {
      message = data.slice(0, 500)
    }
    if (!requestId) {
      requestId = clientErrorRef()
      console.error(`[api] ${requestId} ${opts.method || 'GET'} ${path} → ${res.status}`, { code, message })
    }
    // Session expired mid-work (401) → the shell shows a non-blocking banner
    // («سجّل الدخول في تبويب جديد») — the form and its autosaved draft stay intact.
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth')) {
      try { window.dispatchEvent(new CustomEvent('entix:session-expired', { detail: { path } })) } catch {}
    }
    // Subscription gate (402) → the app shell renders a friendly upgrade page
    // instead of every screen printing a raw `subscription_required` error (CEO 2026-08-25).
    if (res.status === 402 && code === 'subscription_required' && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('entix:subscription-required', { detail: { status: (data as any)?.status ?? null, path } })) } catch {}
    }
    // Soft-deleted company (410) → switch away · the shell listens and reroutes.
    if (res.status === 410 && code === 'org_deleted' && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('entix:org-deleted', { detail: { path } })) } catch {}
    }
    // Suspended by the platform (423 · Admin Console Z2.2) → full-content gate, data untouched.
    if (res.status === 423 && code === 'org_suspended' && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('entix:org-suspended', { detail: { path, reason: (data as any)?.reason ?? null } })) } catch {}
    }
    throw new ApiError(res.status, message, detail, { code, messageAr, requestId, fieldErrors, body: data && typeof data === 'object' ? data : undefined })
  }

  return data as T
}

export type AdminDetailAvailability = 'available' | 'partial' | 'unavailable'

// Z2.2 · Admin Console records
export interface AdminOrgRecord { id: string; name: string; legalName: string | null; slug: string; country: string; baseCurrency: string; industry: string | null; deletedAt: string | null; suspendedAt: string | null; suspendedReason: string | null }
export interface AdminUserRecord { id: string; email: string; name: string | null; emailVerified: boolean; disabledAt: string | null; disabledReason: string | null; createdAt: string }
export interface AdminSubscriptionRow {
  id: string; orgId: string; orgName: string; country: string; currency: string; owner: string | null; suspended: boolean
  plan: { id: string; name: string; nameAr: string | null; tier: string; interval: string; price: number }
  status: string; lifetime: boolean; trialEndsAt: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean
  stripeSubscriptionId: string | null; stripeCustomerId: string | null; source: 'stripe' | 'lifetime' | 'manual' | 'sponsored' | 'free'; mrrCents: number; updatedAt: string
  sponsored?: boolean; note?: string | null; linkedToOrgId?: string | null; currentPeriodStart?: string | null; createdVia?: string | null; logoUrl?: string | null
}
export type AdminSubManageMode = 'sponsored' | 'lifetime' | 'manual' | 'trial' | 'renew' | 'cancel'
export interface AdminNoteRecord { id: string; orgId: string; adminUserId: string; adminEmail: string; body: string; pinned: boolean; createdAt: string; updatedAt: string }
export interface AdminOrgUsage {
  org: { id: string; name: string; createdAt: string; logoUrl: string | null; createdVia: string | null }
  counts: Record<'members' | 'invoices' | 'quotes' | 'receipts' | 'bills' | 'expenses' | 'journals' | 'contacts' | 'products' | 'branches' | 'warehouses' | 'posShifts' | 'posSales' | 'apiKeys' | 'aiConversations' | 'employees' | 'bankAccounts' | 'projects', number>
  activity: { events30: number; events7: number; activeDays30: number; lastActivityAt: string | null; lastAction: string | null; idleDays: number | null; health: 'active' | 'quiet' | 'idle' | 'new'; series: Array<{ date: string; events: number; activeUsers: number }> }
  footprint: { rows: number; attachmentCount: number; attachmentBytes: number; estimatedBytes: number; load: 'light' | 'normal' | 'heavy' }
}
export interface AdminUserDeletePreview { user: { id: string; email: string; name: string | null }; orgs: Array<{ id: string; name: string; country: string; role: string; deletedAt: string | null; members: number; invoices: number; soleOwner: boolean; plan: string | null; status: string | null }> }
export interface AdminSubscriptionsPayload { items: AdminSubscriptionRow[]; total: number; mrrCents: Record<string, number>; byStatus: Record<string, number>; lifetime: number }
/** Official platform (subscription) invoice · Billing → «الفواتير» */
export interface PlatformInvoice {
  id: string; number: string | null; stripeInvoiceId: string; status: string; currency: string
  totalMinor: number; paidMinor: number; remainingMinor: number
  issuedAt: string; paidAt: string | null; dueAt: string | null
  invoicePdfUrl: string | null; hostedInvoiceUrl: string | null
}
/** Company/VAT data shown beside the invoices — read from settings, never invented. */
export interface BillingParty {
  name: string | null; legalName: string | null; email: string | null
  vatNumber: string | null; crNumber: string | null; city: string | null; address: string | null
}
/** What /welcome needs after a pay-first checkout. */
export interface PublicCheckoutSession {
  paid: boolean; email: string | null; locale: 'ar' | 'en'; token: string | null
  planName: string; subscriptionActive: boolean; accountReady: boolean
  needsPassword: boolean; needsLogin: boolean
}

export interface AdminPlanRecord { id: string; stripePriceId: string; name: string; nameAr: string | null; description: string | null; price: number; currency: string; interval: string; tier: string; isActive: boolean; subscriptions: number }
export interface AdminAuditRow { id: string; adminUserId: string; adminEmail: string; action: string; targetType: string; targetId: string | null; targetLabel: string | null; before: any; after: any; reason: string | null; ipAddress: string | null; createdAt: string }

export interface AdminDetailCursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface AdminDetailSection<T> {
  source: string
  isAuthoritative: boolean
  asOf: string
  availability: AdminDetailAvailability
  unavailableReason: string | null
  data: T
}

export interface AdminOrganizationWorkspaceSummary {
  id: string
  name: string
  slug: string
  country: string
  baseCurrency: string
  industry: string | null
  legalName?: string | null
  deletedAt?: string | null
  suspendedAt?: string | null
  suspendedReason?: string | null
  createdAt: string
  updatedAt: string
  logoUrl?: string | null
  createdVia?: string | null
}

export interface AdminOrganizationWorkspaceMetrics {
  members: number
  invoices: number
  bills: number
  expenses: number
}

export interface AdminOrganizationWorkspaceMember {
  id: string
  role: string
  createdAt: string
  user: {
    id: string
    email: string
    name: string | null
    emailVerified: boolean
  }
}

export interface AdminOrganizationWorkspaceSubscription {
  id: string
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  maskedStripeSubscriptionId: string | null
  maskedStripeCustomerId: string | null
  sponsored?: boolean
  lifetime?: boolean
  note?: string | null
  linkedToOrgId?: string | null
  plan: {
    id: string
    name: string
    tier: string
    interval: string
    currency: string
    price: number
  } | null
}

export interface AdminOrganizationWorkspaceSupportThread {
  id: string
  title: string
  createdAt: string
  lastMessageAt: string
  messageCount: number
  user: {
    id: string
    email: string
    name: string | null
  }
}

export interface AdminOrganizationWorkspaceActivityRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  severity: string
  occurredAt: string
}

export interface AdminOrganizationWorkspace {
  kind: 'organization_workspace'
  summary: AdminDetailSection<AdminOrganizationWorkspaceSummary>
  metrics: AdminDetailSection<AdminOrganizationWorkspaceMetrics>
  people: AdminDetailSection<AdminDetailCursorPage<AdminOrganizationWorkspaceMember>>
  subscription: AdminDetailSection<AdminOrganizationWorkspaceSubscription | null>
  support: AdminDetailSection<AdminDetailCursorPage<AdminOrganizationWorkspaceSupportThread>>
  activity: AdminDetailSection<AdminDetailCursorPage<AdminOrganizationWorkspaceActivityRow>>
  referral: AdminDetailSection<null>
  outstandingPlatformBilling: AdminDetailSection<null>
}

export interface AdminUserWorkspaceSummary {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  disabledAt?: string | null
  disabledReason?: string | null
  createdAt: string
  locale: string
}

export interface AdminUserWorkspaceMembership {
  id: string
  role: string
  createdAt: string
  org: {
    id: string
    name: string
    slug: string
    country: string
  }
}

export interface AdminUserWorkspaceAuthProvider {
  providerId: string
  createdAt: string
}

export interface AdminUserWorkspace {
  kind: 'user_workspace'
  summary: AdminDetailSection<AdminUserWorkspaceSummary>
  memberships: AdminDetailSection<AdminDetailCursorPage<AdminUserWorkspaceMembership>>
  authProviders: AdminDetailSection<AdminDetailCursorPage<AdminUserWorkspaceAuthProvider>>
}

export interface AdminSubscriberWorkspaceSummary {
  id: string
  orgId: string
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  cancelAtPeriodEnd: boolean
  maskedStripeSubscriptionId: string | null
  maskedStripeCustomerId: string | null
  plan: {
    id: string
    name: string
    nameAr: string | null
    tier: string
    interval: string
    currency: string
    price: number
    isActive: boolean
  } | null
  org: {
    id: string
    name: string
    slug: string
    baseCurrency: string
  }
}

export interface AdminSubscriberWorkspacePlatformBilling {
  maskedStripeCustomerId: string
  maskedStripeSubscriptionId: string
  subscriptionStatus: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  billingEmail: string | null
  billingName: string | null
  paymentMethodBrand: string | null
  paymentMethodLast4: string | null
}

export interface AdminSubscriberWorkspace {
  kind: 'subscriber_workspace'
  summary: AdminDetailSection<AdminSubscriberWorkspaceSummary>
  platformBilling: AdminDetailSection<AdminSubscriberWorkspacePlatformBilling | null>
}

export interface AdminSupportWorkspaceSummary {
  id: string
  title: string
  createdAt: string
  lastMessageAt: string
  org: {
    id: string
    name: string
    slug: string
    country: string
  }
  user: {
    id: string
    email: string
    name: string | null
  }
}

export interface AdminSupportWorkspaceMessage {
  id: string
  role: string
  content: string
  createdAt: string
  metadata: unknown
  userId: string | null
}

export interface AdminSupportWorkspace {
  kind: 'support_workspace'
  summary: AdminDetailSection<AdminSupportWorkspaceSummary>
  messages: AdminDetailSection<AdminDetailCursorPage<AdminSupportWorkspaceMessage>>
  attachments: AdminDetailSection<null>
}


// ── Smart import (2026-09-08) ────────────────────────────────────────────────
// One deterministic engine behind /api/<entity>/import/analyze | /commit.
// The old path shipped .xlsx bytes to an LLM as UTF-8 text and silently
// returned zero rows — see api commit d4eb886.
export type ImportMsg = { ar: string; en: string }
export type ImportRowStatus = 'new' | 'update' | 'conflict' | 'skipped'
export interface ImportFieldMatch {
  field: string
  label: ImportMsg
  column: number | null
  header: string | null
  confidence: number
  alternatives: Array<{ column: number; header: string; confidence: number }>
}
export interface ImportAnalysis {
  ok: boolean
  entity: 'accounts' | 'contacts' | 'products'
  format: string
  fileName: string | null
  sheets: Array<{ name: string; score: number; headerRow: number; rowCount: number }>
  sheet: string
  headerRow: number
  headers: string[]
  mapping: Record<string, number>
  fields: ImportFieldMatch[]
  rows: any[]
  counts: Record<string, number>
  warnings: ImportMsg[]
  openingBalances?: {
    sheet: string
    headerRow: number
    lines: Array<{ row: number; code: string; debit: number; credit: number }>
    totalDebit: number
    totalCredit: number
    difference: number
    warnings: ImportMsg[]
  } | null
  source?: 'vision'
  model?: string
  error?: string
  message?: ImportMsg
}
export interface ImportReport {
  ok: boolean
  created: number
  updated: number
  skipped: number
  warnings: ImportMsg[]
  message: ImportMsg
  openingEntry?: { id: string; entryNumber: string; lines: number; difference: number } | null
  rejected?: Array<{ index: number; reason: string }>
  error?: string
}
export interface SmartImportAnalyzeInput {
  fileBase64?: string
  text?: string
  fileName?: string
  mimeType?: string
  /** re-analyse with the user's picks */
  sheet?: string
  headerRow?: number
  mapping?: Record<string, number>
}
function smartImportClient(entity: 'accounts' | 'contacts' | 'products') {
  return {
    fields: () => request<{ entity: string; fields: Array<{ key: string; label: ImportMsg; synonyms: string[] }> }>(`/api/${entity}/import/fields`),
    analyze: (data: SmartImportAnalyzeInput) =>
      request<ImportAnalysis>(`/api/${entity}/import/analyze`, { method: 'POST', body: data }),
    commit: (data: { rows: any[]; updateExisting?: boolean; openingBalances?: { lines: Array<{ code: string; debit: number; credit: number }>; date?: string | null } | null }) =>
      request<ImportReport>(`/api/${entity}/import/commit`, { method: 'POST', body: data }),
  }
}

// ── Resource clients ──────────────────────────────────────────────────────────
export const api = {
  // Identity
  me: () => request<MeResponse>('/me'),
  // Account deletion (30-day recovery window · web-only by design)
  meDeleteAccount: (confirm: string) =>
    request<{ ok: boolean; deletionRequestedAt: string; purgeAfter: string; graceDays: number; message: string }>(
      '/me/delete-account', { method: 'POST', body: { confirm }, skipOrg: true },
    ),
  meCancelDeletion: () =>
    request<{ ok: boolean; restored: boolean; message: string }>(
      '/me/cancel-deletion', { method: 'POST', body: {}, skipOrg: true },
    ),

  // Orgs
  orgs: {
    /** Cached 15 s + deduped in flight (S3) · pass { fresh: true } to bypass */
    list: (opts?: { fresh?: boolean }) => { if (opts?.fresh) invalidateOrgsCache(); return listOrgsCached() },
    create: (data: CreateOrgInput) =>
      request<Org>('/orgs', { method: 'POST', body: data, skipOrg: true }).then((r) => { invalidateOrgsCache(); return r }),
    get: (id: string) => request<Org>(`/orgs/${id}`, { skipOrg: true }),
    update: (id: string, data: Partial<Org>) =>
      request<Org>(`/orgs/${id}`, { method: 'PATCH', body: data, skipOrg: true }).then((r) => { invalidateOrgsCache(); return r }),
    remove: (id: string, data: { confirmName: string }) =>
      request<{ ok: true; deletedOrgId: string; deletedAt: string; restoreUntil: string; graceDays: number; nextOrgId: string | null }>(`/orgs/${id}`, { method: 'DELETE', body: data, skipOrg: true }).then((r) => { invalidateOrgsCache(); return r }),
    restore: (id: string) =>
      request<{ ok: true; org: Org }>(`/orgs/${id}/restore`, { method: 'POST', skipOrg: true }).then((r) => { invalidateOrgsCache(); return r }),
    listDeleted: () => request<Org[]>('/orgs', { query: { deleted: 1 }, skipOrg: true }),
    members: (id: string) =>
      request<{ members: Array<{ id: string; role: string; createdAt: string; user: { id: string; email: string; name?: string | null } }> }>(`/orgs/${id}/members`, { skipOrg: true }),
    inviteMember: (id: string, data: { email: string; role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' }) =>
      request<{ ok: true; pending?: boolean; email?: string; role?: string; resent?: boolean; emailSent?: boolean; message?: string }>(`/orgs/${id}/members/invite`, { method: 'POST', body: data, skipOrg: true }),
    invitations: (id: string) =>
      request<{ invitations: Array<{ id: string; email: string; role: string; status: 'PENDING' | 'DECLINED'; invitedByName?: string | null; createdAt: string; expiresAt: string }> }>(`/orgs/${id}/invitations`, { skipOrg: true }),
    revokeInvitation: (id: string, invitationId: string) =>
      request<{ ok: true; revoked: true }>(`/orgs/${id}/invitations/${invitationId}`, { method: 'DELETE', skipOrg: true }),
    updateMemberRole: (id: string, memberId: string, role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER') =>
      request<{ ok: true }>(`/orgs/${id}/members/${memberId}`, { method: 'PATCH', body: { role }, skipOrg: true }),
    removeMember: (id: string, memberId: string) =>
      request<void>(`/orgs/${id}/members/${memberId}`, { method: 'DELETE', skipOrg: true }),
    getNumbering: (id: string) =>
      request<NumberingSettings>(`/orgs/${id}/numbering`, { skipOrg: true }),
    saveNumbering: (id: string, data: NumberingSettings) =>
      request<NumberingSettings>(`/orgs/${id}/numbering`, { method: 'PATCH', body: data, skipOrg: true }),
    resetData: (id: string, data: { mode: 'blank' | 'clean_company'; confirmName: string }) =>
      request<{ ok: true; mode: string; counts?: Record<string, number>; org?: Org }>(`/orgs/${id}/reset-data`, { method: 'POST', body: data, skipOrg: true }),
    auditLog: (id: string, limit = 50) =>
      request<{ items: AuditLogItem[] }>(`/orgs/${id}/audit-log`, { query: { limit }, skipOrg: true }),
  },

  // API keys · programmatic access for agents/integrations (Settings → API keys)
  // The raw key is returned ONCE by create(); list() only ever shows `prefix`.
  apiKeys: {
    list: () => request<{ keys: ApiKeyItem[]; scopes: ApiKeyScope[] }>('/api/api-keys'),
    create: (data: { name: string; scopes: ApiKeyScope[]; expiresInDays?: number }) =>
      request<{ key: string; apiKey: ApiKeyItem }>('/api/api-keys', { method: 'POST', body: data }),
    revoke: (id: string) => request<{ apiKey: ApiKeyItem }>(`/api/api-keys/${id}`, { method: 'DELETE' }),
  },

  // Account-level invites (consent-first) — the invitee accepts/declines;
  // the membership exists only after accept.
  invites: {
    mine: () =>
      request<{ invites: Array<{ token: string; org: { id: string; name: string; slug: string }; role: string; invitedByName?: string | null; createdAt: string; expiresAt: string }> }>('/api/invitations/mine', { skipOrg: true }),
    get: (token: string) =>
      request<{ org: { id: string; name: string; slug: string }; role: string; invitedByName?: string | null; status: string; expiresAt: string }>(`/api/invitations/${token}`, { skipOrg: true }),
    accept: (token: string) =>
      request<{ ok: true; org: { id: string; name: string; slug: string }; role: string; alreadyMember?: boolean }>(`/api/invitations/${token}/accept`, { method: 'POST', skipOrg: true }),
    decline: (token: string) =>
      request<{ ok: true; declined: true }>(`/api/invitations/${token}/decline`, { method: 'POST', skipOrg: true }),
  },

  // Contacts
  contacts: {
    smartImport: smartImportClient('contacts'),
    list: (params?: {
      type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
      role?: 'customer' | 'supplier' | 'employee' | 'shareholder' | 'freelancer'
      q?: string
      page?: number
      limit?: number
    }) =>
      request<PaginatedResponse<Contact>>('/api/contacts', { query: params }),
    get: (id: string) => request<Contact>(`/api/contacts/${id}`),
    summary: (id: string) => request<ContactSummary>(`/api/contacts/${id}/summary`),
    nextCode: () => request<{ customCode: string }>('/api/contacts/_/next-code'),
    extractFromDocument: (data: { fileBase64: string; fileName?: string; mimeType?: string }) =>
      request<{
        displayName: string | null; legalName: string | null;
        entityKind: 'INDIVIDUAL' | 'COMPANY'; country: string;
        vatNumber: string | null; crNumber: string | null; nationalId: string | null;
        addressLine1: string | null; city: string | null; region: string | null; postalCode: string | null;
        phone: string | null; email: string | null;
        isCustomer: boolean; isSupplier: boolean;
        confidence: number; notes: string | null;
      }>('/api/contacts/_/extract-from-document', { method: 'POST', body: data }),
    create: (data: ContactInput) =>
      request<Contact>('/api/contacts', { method: 'POST', body: data }),
    update: (id: string, data: Partial<ContactInput>) =>
      request<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
  },

  // Journal Entries
  journals: {
    list: (status?: 'POSTED' | 'DRAFT', opts?: { limit?: number; offset?: number }) =>
      request<{ items: JournalEntryRow[]; total: number; limit: number; offset: number; hasMore: boolean }>('/api/journals', {
        query: {
          ...(status ? { status } : {}),
          ...(opts?.limit != null ? { limit: String(opts.limit) } : {}),
          ...(opts?.offset ? { offset: String(opts.offset) } : {}),
        },
      }),
    get: (id: string) => request<JournalEntryRow>(`/api/journals/${id}`),
    create: (data: JournalEntryInput) => request<JournalEntryRow>('/api/journals', { method: 'POST', body: data }),
    update: (id: string, data: Partial<JournalEntryInput>) =>
      request<JournalEntryRow>(`/api/journals/${id}`, { method: 'PATCH', body: data }),
    post: (id: string) => request<{ ok: true }>(`/api/journals/${id}/post`, { method: 'POST' }),
    unpost: (id: string) => request<{ ok: true }>(`/api/journals/${id}/unpost`, { method: 'POST' }),
    /** Ledger linkage probe — posted documents missing their auto journal entry, per source. */
    coverage: () =>
      request<{ unposted: { invoices: number; bills: number; expenses: number; receipts: number; payments: number }; linked: boolean }>('/api/journals/coverage'),
    remove: (id: string) => request<void>(`/api/journals/${id}`, { method: 'DELETE' }),
    attachments: {
      list: (id: string) => request<{ items: JournalAttachment[] }>(`/api/journals/${id}/attachments`),
      upload: (id: string, body: { filename: string; contentType: string; sizeBytes: number; data: string }) =>
        request<JournalAttachment>(`/api/journals/${id}/attachments`, { method: 'POST', body }),
      remove: (id: string, aid: string) =>
        request<void>(`/api/journals/${id}/attachments/${aid}`, { method: 'DELETE' }),
    },
  },

  // Inbox (email-to-invoice)
  inbox: {
    list: (status?: string) => request<{ items: InboxMessageRow[]; total: number }>('/api/inbox', { query: status ? { status } : undefined }),
    status: () => request<{ address: string; configured: boolean; webhookConfigured: boolean; addressConfigured: boolean; mode: string; provider: string | null }>('/api/inbox/status'),
    get: (id: string) => request<InboxMessageDetail>(`/api/inbox/${id}`),
    approve: (id: string, duplicateDecision?: DuplicateDecision) =>
      request<{ ok: true; billId: string; billNumber: string } & IngestionMeta>(
        `/api/inbox/${id}/approve`,
        { method: 'POST', body: duplicateDecision ? { duplicateDecision } : {} },
      ),
    reject: (id: string) => request<{ ok: true }>(`/api/inbox/${id}/reject`, { method: 'POST' }),
    reprocess: (id: string) => request<{ ok: true; kind: string; lines: number }>(`/api/inbox/${id}/reprocess`, { method: 'POST' }),
    duplicateCheck: (id: string) => request<{ possibleDuplicate: boolean; match?: { id: string; billNumber: string; total: number; issueDate: string; supplierName: string | null } | null }>(`/api/inbox/${id}/duplicate-check`),
  },

  // Accounts (chart of accounts)
  accounts: {
    ledgerMapping: () => request<{ roles: LedgerRoleRow[] }>('/api/accounts/ledger-mapping'),
    setLedgerMapping: (data: Record<string, string | null>) => request<{ ok: true; roles: LedgerRoleRow[] }>('/api/accounts/ledger-mapping', { method: 'PUT', body: data }),
    inactive: () => request<{ items: any[] }>('/api/accounts/inactive'),
    list: () => request<{ items: Account[]; total: number }>('/api/accounts'),
    get: (id: string) => request<Account>(`/api/accounts/${id}`),
    create: (data: AccountInput) =>
      request<Account>('/api/accounts', { method: 'POST', body: data }),
    update: (id: string, data: Partial<AccountInput>) =>
      request<Account>(`/api/accounts/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/accounts/${id}`, { method: 'DELETE' }),
    merge: (id: string, targetAccountId: string) =>
      request<{ ok: true; movedJournalLines: number; movedChildren: number; message: string }>(`/api/accounts/${id}/merge`, { method: 'POST', body: { targetAccountId } }),
    importBulk: (rows: Array<{ code: string; name: string; nameAr?: string | null; type?: string; parentCode?: string | null; description?: string | null }>, skipExisting = true) =>
      request<{ ok: true; created: number; skipped: number; linked: number; errors: any[]; message: string }>('/api/accounts/import', { method: 'POST', body: { rows, skipExisting } }),
    analyzeImport: (data: { fileBase64: string; fileName?: string; mimeType: string }) =>
      request<{ ok: true; rows: Array<{ code: string; name: string; nameAr?: string; type?: string | null; parentCode?: string | null; description?: string | null; confidence?: number | null }>; warnings?: string[]; model?: string }>('/api/accounts/import/analyze', { method: 'POST', body: data }),
    /** Smart import (2026-09-08) · deterministic xlsx/csv/tsv/json parsing · see smartImport below */
    smartImport: smartImportClient('accounts'),
    transactions: (id: string) => request<AccountTransactions>(`/api/accounts/${id}/transactions`),
    translate: (input: string, hint?: string) =>
      request<{ name: string; nameAr: string; type: 'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE'; category?: string; reasoning?: string; suggestedCode?: string }>(
        '/api/accounts/translate', { method: 'POST', body: { input, hint } },
      ),
    /** Account law (2026-09-08): closest GL account for a line / product · never null while the chart has an account of the type */
    suggest: (input: AccountSuggestInput) =>
      request<AccountSuggestResult>('/api/accounts/suggest', { method: 'POST', body: input }),
  },

  // Expenses
  expenses: {
    list: (params?: { category?: string; contactId?: string; from?: string; to?: string; page?: number; limit?: number }) =>
      request<PaginatedResponse<Expense> & { summary: { sumTotal: string; avgTotal: string } }>(
        '/api/expenses',
        { query: params },
      ),
    get: (id: string) => request<Expense>(`/api/expenses/${id}`),
    create: (data: ExpenseInput) =>
      request<Expense>('/api/expenses', { method: 'POST', body: data }),
    update: (id: string, data: Partial<ExpenseInput>) =>
      request<Expense>(`/api/expenses/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/expenses/${id}`, { method: 'DELETE' }),
    attachments: {
      list: (id: string) => request<{ items: ExpenseAttachment[] }>(`/api/expenses/${id}/attachments`),
      upload: (id: string, data: { filename: string; contentType: string; sizeBytes: number; data: string }) =>
        request<ExpenseAttachment>(`/api/expenses/${id}/attachments`, { method: 'POST', body: data }),
      remove: (id: string, aid: string) =>
        request<void>(`/api/expenses/${id}/attachments/${aid}`, { method: 'DELETE' }),
    },
  },

  // Quotes
  quotes: {
    list: (params?: { status?: string }) =>
      request<{ items: Quote[]; total: number }>('/api/quotes', { query: params }),
    get: (id: string) => request<Quote>(`/api/quotes/${id}`),
    create: (data: QuoteInput) =>
      request<Quote>('/api/quotes', { method: 'POST', body: data }),
    update: (id: string, data: Partial<QuoteInput>) =>
      request<Quote>(`/api/quotes/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/quotes/${id}`, { method: 'DELETE' }),
    convertToInvoice: (id: string) =>
      request<{ invoice: Invoice; quoteId: string }>(`/api/quotes/${id}/convert-to-invoice`, { method: 'POST' }),
    attachments: {
      list: (id: string) => request<{ items: ExpenseAttachment[] }>(`/api/quotes/${id}/attachments`),
      upload: (id: string, body: { filename: string; contentType: string; sizeBytes: number; data: string }) =>
        request<ExpenseAttachment>(`/api/quotes/${id}/attachments`, { method: 'POST', body }),
      remove: (id: string, aid: string) =>
        request<void>(`/api/quotes/${id}/attachments/${aid}`, { method: 'DELETE' }),
    },
    /** SPEC-04 · upload a BOQ workbook → parse preview (multipart · nothing written) */
    importBoq: async (file: File): Promise<BoqPreview> => {
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = {}
      const oid = getOrgId()
      if (oid) headers['X-Org-Id'] = oid
      try {
        const raw = localStorage.getItem('entix_act_as')
        if (raw) { const v = JSON.parse(raw); if (v?.orgId === getOrgId() && v.until > Date.now()) { headers['X-Org-Id'] = v.orgId; headers['X-Admin-Org-Id'] = v.orgId } }
      } catch { /* ignore */ }
      const res = await fetch(`${API_BASE}/api/quotes/import-boq`, { method: 'POST', headers, body: form, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError(res.status, (data as any)?.message || (data as any)?.error || 'import_failed', undefined, { body: data })
      return data as BoqPreview
    },
    /** SPEC-04 · generate public accept link (+ email the customer unless email:false) */
    send: (id: string, opts?: { email?: boolean }) =>
      request<{ token: string; url: string; emailed: boolean }>(`/api/quotes/${id}/send`, { method: 'POST', body: opts || {} }),
    /** SPEC-04 · manual accept (bank transfer / phone) or reject with a reason */
    decision: (id: string, body: { action: 'accept'; source?: string } | { action: 'reject'; reason: string }) =>
      request<{ quote?: Quote; projectId?: string; created?: boolean }>(`/api/quotes/${id}/decision`, { method: 'POST', body }),
    /** SPEC-04 · public accept page (token only · no auth) */
    publicGet: (token: string) => request<Quote & { org?: { name: string; logoUrl?: string | null } }>(`/api/q/${token}`, { skipOrg: true }),
    publicAccept: (token: string, name: string) => request<{ ok: boolean; projectCreated?: boolean }>(`/api/q/${token}/accept`, { method: 'POST', body: { name }, skipOrg: true }),
    publicReject: (token: string, reason: string) => request<{ ok: boolean }>(`/api/q/${token}/reject`, { method: 'POST', body: { reason }, skipOrg: true }),
    /** SPEC-05 L2 · attach an instalment schedule (template or custom rows · percents must sum to 100) */
    setPaymentPlan: (id: string, body: { templateId?: string | null; name?: string | null; items?: PaymentPlanItemInput[] }) =>
      request<PaymentPlan>(`/api/quotes/${id}/payment-plan`, { method: 'POST', body }),
    /** SPEC-05 L2 · drop the schedule from the quote (the proposal stops printing it) */
    removePaymentPlan: (id: string) =>
      request<void>(`/api/quotes/${id}/payment-plan`, { method: 'DELETE' }),
  },

  // SPEC-05 L1 · Estimates (الدراسة والتسعير) · cost/margin fields are ABSENT for non-financial roles
  estimates: {
    list: (params?: { status?: string; q?: string; contactId?: string; projectId?: string }) =>
      request<{ items: Estimate[]; total: number; confidentialHidden: boolean }>('/api/estimates', { query: params }),
    get: (id: string) => request<Estimate>(`/api/estimates/${id}`),
    create: (data: EstimateInput) => request<Estimate>('/api/estimates', { method: 'POST', body: data }),
    update: (id: string, data: Partial<EstimateInput>) =>
      request<Estimate>(`/api/estimates/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/estimates/${id}`, { method: 'DELETE' }),
    /** DRAFT → REVIEW */
    submit: (id: string) => request<Estimate>(`/api/estimates/${id}/submit`, { method: 'POST' }),
    /** REVIEW|DRAFT → APPROVED · OWNER / ADMIN only (403 owner_required otherwise) */
    approve: (id: string) => request<Estimate>(`/api/estimates/${id}/approve`, { method: 'POST' }),
    /** APPROVED → Quote · copies itemNo · البند والمواصفات · الكمية · سعر الوحدة · الإجمالي ONLY */
    convertToQuote: (id: string, body?: { contactId?: string | null; validUntil?: string | null; templateId?: string | null }) =>
      request<{ quote: Quote; estimateId: string }>(`/api/estimates/${id}/convert-to-quote`, { method: 'POST', body: body || {} }),
    /** multipart · appends BOQ lines (client price → locked unit price · costs to be filled) */
    importBoq: async (id: string, file: File, mode?: 'append' | 'replace') => {
      const form = new FormData()
      form.append('file', file)
      if (mode) form.append('mode', mode)
      const headers: Record<string, string> = {}
      const oid = getOrgId()
      if (oid) headers['X-Org-Id'] = oid
      try {
        const raw = localStorage.getItem('entix_act_as')
        if (raw) { const v = JSON.parse(raw); if (v?.orgId === getOrgId() && v.until > Date.now()) { headers['X-Org-Id'] = v.orgId; headers['X-Admin-Org-Id'] = v.orgId } }
      } catch { /* ignore */ }
      const res = await fetch(`${API_BASE}/api/estimates/${id}/import-boq`, { method: 'POST', headers, body: form, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError(res.status, (data as any)?.message || (data as any)?.error || 'import_failed', undefined, { body: data })
      return data as { estimate: Estimate; imported: number; fileName: string; warnings: string[] }
    },
    /** clone as V(n+1) DRAFT — the only way to change a converted estimate */
    newVersion: (id: string) => request<Estimate>(`/api/estimates/${id}/new-version`, { method: 'POST' }),
  },

  // SPEC-05 L2 · Payment plans (خطة الدفعات) · templates + standalone plans
  paymentPlans: {
    list: (params?: { template?: '1'; quoteId?: string; projectId?: string }) =>
      request<{ items: PaymentPlan[]; total: number }>('/api/payment-plans', { query: params }),
    templates: () => request<{ items: PaymentPlan[]; total: number }>('/api/payment-plans/templates'),
    get: (id: string) => request<PaymentPlan>(`/api/payment-plans/${id}`),
    create: (data: PaymentPlanInput) => request<PaymentPlan>('/api/payment-plans', { method: 'POST', body: data }),
    update: (id: string, data: Partial<PaymentPlanInput>) =>
      request<PaymentPlan>(`/api/payment-plans/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/payment-plans/${id}`, { method: 'DELETE' }),
  },

  // Dashboard — real org-scoped numbers
  dashboard: {
    summary: () => request<DashboardSummary>('/api/dashboard/summary'),
    sales: () => request<SalesDashboard>('/api/dashboard/sales'),
    purchases: () => request<PurchasesDashboard>('/api/dashboard/purchases'),
  },

  // Saudi VAT Return + Withholding
  taxReturn: {
    saVat: (params?: { from?: string; to?: string }) =>
      request<TaxReturnPayload>('/api/tax-return/sa-vat', { query: params }),
    usSalesTax: (params?: { from?: string; to?: string }) =>
      request<UsSalesTaxPayload>('/api/tax-return/us-sales-tax', { query: params }),
    vatSummary: (params?: { from?: string; to?: string }) =>
      request<VatSummaryPayload>('/api/tax-return/vat-summary', { query: params }),
    updateWithholding: (
      voucherId: string,
      data: { rate: number; transferType: 'SERVICE' | 'ROYALTY' | 'INTEREST' | 'OTHER'; note?: string | null },
    ) => request<{ ok: true; row: TaxReturnWithholdingRow }>(`/api/tax-return/withholding/${voucherId}`, { method: 'PATCH', body: data }),
  },

  // Reports · live report viewer + print designer payload
  reports: {
    get: (id: string, params?: { from?: string; to?: string; branchId?: string; projectId?: string; costCenterId?: string; contactId?: string; compareTo?: string; bilingual?: 1 }) =>
      request<ReportPayload>(`/api/reports/${id}`, { query: params }),
  },

  insights: {
    reviewQueue: () => request<InsightsReviewQueuePayload>('/api/insights/review-queue'),
    cashForecast: () => request<InsightsCashForecastPayload>('/api/insights/cash-forecast'),
    complianceTimeline: () => request<InsightsComplianceTimelinePayload>('/api/insights/compliance-timeline'),
  },

  // Bills (purchase invoices)
  bills: {
    list: (params?: { status?: string; contactId?: string }) =>
      request<{ items: any[]; total: number }>('/api/bills', { query: params }),
    get: (id: string) => request<any>(`/api/bills/${id}`),
    create: (data: any) => request<any>('/api/bills', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/bills/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/bills/${id}`, { method: 'DELETE' }),
    checkDuplicate: (data: { contactId: string; total: number; issueDate: string; excludeId?: string }) => request<any[]>('/api/bills/check-duplicate', { method: 'POST', body: data }),
    merge: (targetBillId: string, data: { sourceDocumentId?: string }) => request<any>(`/api/bills/${targetBillId}/merge`, { method: 'POST', body: data }),
  },

  // Branches (B1 · 2026-08-26): analytical dimension on every document
  branches: {
    list: (params?: { all?: 1 }) => request<{ items: Branch[]; total: number; defaultBranchId: string | null }>('/api/branches', { query: params }),
    get: (id: string) => request<Branch>(`/api/branches/${id}`),
    create: (data: BranchInput) => request<Branch>('/api/branches', { method: 'POST', body: data }),
    update: (id: string, data: Partial<BranchInput>) => request<Branch>(`/api/branches/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/branches/${id}`, { method: 'DELETE' }),
    /** Caller's default branch for new documents (per company membership) */
    setDefault: (branchId: string | null) => request<{ ok: true; defaultBranchId: string | null }>('/api/branches/default', { method: 'PUT', body: { branchId } }),
  },

  // Cost Centers
  costCenters: {
    list: () => request<{ items: any[]; total: number }>('/api/cost-centers'),
    get: (id: string) => request<any>(`/api/cost-centers/${id}`),
    create: (data: { code: string; name: string }) =>
      request<any>('/api/cost-centers', { method: 'POST', body: data }),
    update: (id: string, data: { code?: string; name?: string }) =>
      request<any>(`/api/cost-centers/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/cost-centers/${id}`, { method: 'DELETE' }),
  },

  // Projects
  projects: {
    list: () => request<{ items: any[]; total: number }>('/api/projects'),
    get: (id: string) => request<any>(`/api/projects/${id}`),
    create: (data: any) => request<any>('/api/projects', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/projects/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
    // PL2 · suggested project code from numberingSettings.project (never consumed)
    nextCode: (contactId?: string) =>
      request<{ code: string }>('/api/projects/next-code', { query: contactId ? { contactId } : undefined }),
    // PL1 · project ↔ document links · linking records the relation only
    links: (id: string) => request<{ items: ProjectLink[]; total: number }>(`/api/projects/${id}/links`),
    linkable: (id: string, params: { kind: ProjectLinkKind; q?: string; contactId?: string }) =>
      request<{ items: LinkedDocument[]; contactId: string | null }>(`/api/projects/${id}/linkable`, { query: params }),
    // …and the same feed before the project exists (new-project form stages its links)
    linkableForContact: (params: { kind: ProjectLinkKind; contactId: string; q?: string }) =>
      request<{ items: LinkedDocument[]; contactId: string | null }>('/api/projects/linkable', { query: params }),
    link: (id: string, data: { kind: ProjectLinkKind; documentId: string }) =>
      request<ProjectLink>(`/api/projects/${id}/links`, { method: 'POST', body: data }),
    unlink: (id: string, linkId: string) =>
      request<void>(`/api/projects/${id}/links/${linkId}`, { method: 'DELETE' }),
    // SPEC-05 L3 · the project's COST-ONLY budget (no sale price · no margin)
    budget: (id: string) => request<ProjectBudget | null>(`/api/projects/${id}/budget`),
    buildBudget: (id: string, data: { estimateId?: string | null } = {}) =>
      request<ProjectBudget>(`/api/projects/${id}/budget`, { method: 'POST', body: data }),
    approveBudget: (id: string) =>
      request<ProjectBudget>(`/api/projects/${id}/budget/approve`, { method: 'POST', body: {} }),
    // SPEC-05 §5 · tasks · the execution layer (cost + time · never a sale figure)
    tasks: (id: string) => request<ProjectTaskList>(`/api/projects/${id}/tasks`),
    createTask: (id: string, data: Partial<ProjectTask> & { title: string }) =>
      request<ProjectTask>(`/api/projects/${id}/tasks`, { method: 'POST', body: data }),
    reorderTasks: (id: string, ids: string[]) =>
      request<ProjectTaskList>(`/api/projects/${id}/tasks/reorder`, { method: 'PATCH', body: { ids } }),
    tasksFromBudget: (id: string, data: { replace?: boolean } = {}) =>
      request<ProjectTaskList>(`/api/projects/${id}/tasks/from-budget`, { method: 'POST', body: data }),
    tasksFromEstimate: (id: string, data: { replace?: boolean; estimateId?: string | null } = {}) =>
      request<ProjectTaskList>(`/api/projects/${id}/tasks/from-estimate`, { method: 'POST', body: data }),
    /** AI project intake · upload a proposal / BOQ → PREVIEW (writes nothing). */
    intake: (file: File) => uploadFile<ProjectIntakePreview>('/api/projects/intake', file),
    /** AI project intake · the CONFIRMED preview → project + contact + tasks. */
    intakeCommit: (body: {
      project: { name: string; code?: string | null; startDate?: string | null; endDate?: string | null; contractValue?: number | null; notes?: string | null }
      client?: { contactId?: string | null; createName?: string | null; taxId?: string | null }
      tasks: Array<{ itemNo?: string | null; title: string; unit?: string | null; quantity?: number | null; plannedCost?: number | null; plannedDays?: number | null }>
      createBudget?: boolean
      source?: { fileName?: string | null; mimeType?: string | null; fileHash?: string | null; extract?: unknown }
    }) => request<{ project: any; createdContact: { id: string; displayName: string } | null; budgetId: string | null; taskCount: number }>(
      '/api/projects/intake/commit', { method: 'POST', body },
    ),
  },

  // SPEC-05 §5 · one task, addressed directly (the row editor patches here)
  tasks: {
    get: (id: string) => request<ProjectTask>(`/api/tasks/${id}`),
    update: (id: string, data: Partial<ProjectTask>) =>
      request<ProjectTask>(`/api/tasks/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  },

  /**
   * The org's VAT catalogue. Without this the line grid had a tax dropdown but no
   * id to send, and every quote saved taxTotal = 0 (a 400 quote billed as 400).
   * The list seeds the standard KSA rates for an org that has none.
   */
  taxRates: {
    list: (params?: { all?: '1' }) =>
      request<{ items: TaxRate[]; total: number; defaultId: string | null }>('/api/tax-rates', { query: params }),
    create: (data: { name: string; nameAr?: string | null; rate: number | string; type?: TaxRate['type']; isDefault?: boolean; isInclusive?: boolean }) =>
      request<TaxRate>('/api/tax-rates', { method: 'POST', body: data }),
    update: (id: string, data: Partial<{ name: string; nameAr: string | null; rate: number | string; type: TaxRate['type']; isDefault: boolean; isInclusive: boolean; isActive: boolean }>) =>
      request<TaxRate>(`/api/tax-rates/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void | (TaxRate & { deactivated: true; usedBy: number })>(`/api/tax-rates/${id}`, { method: 'DELETE' }),
  },

  // SPEC-05 L3 · purchase orders issued from budget cost lines
  purchaseOrders: {
    list: (params?: { projectId?: string }) =>
      request<{ items: PurchaseOrder[]; total: number }>('/api/purchase-orders', { query: params }),
    fromBudget: (data: { projectId: string; supplierId?: string | null; lines: Array<{ budgetLineId: string; quantity?: number }>; notes?: string | null }) =>
      request<PurchaseOrder>('/api/purchase-orders/from-budget', { method: 'POST', body: data }),
  },

  // SPEC-05 L3 · an instalment becomes an invoice only on accountant approval
  paymentPlanItems: {
    invoice: (itemId: string, data: { dueInDays?: number } = {}) =>
      request<{ invoice: { id: string; invoiceNumber: string } }>(`/api/payment-plan-items/${itemId}/invoice`, { method: 'POST', body: data }),
  },

  // Fixed Assets
  // Document templates (print layouts for invoices / quotes / vouchers / notes)
  documentTemplates: {
    list: (params?: { type?: string; kind?: 'QUOTE' | 'INVOICE' }) =>
      request<{ items: any[]; total: number }>('/api/document-templates', { query: params }),
    /** Org default template per document kind (BOTH-kind templates count for both) */
    defaults: () => request<{ QUOTE: any | null; INVOICE: any | null }>('/api/document-templates/defaults'),
    /** Server-rendered print HTML (same engine as the web print views) */
    render: (kind: 'QUOTE' | 'INVOICE', docId: string, params?: { templateId?: string | null; lang?: 'ar' | 'en'; actions?: 0 | 1 }) =>
      request<string>(`/api/document-templates/render/${kind}/${docId}`, { query: params as any }),
    get: (id: string) => request<any>(`/api/document-templates/${id}`),
    create: (data: any) => request<any>('/api/document-templates', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/document-templates/${id}`, { method: 'PATCH', body: data }),
    setDefault: (id: string) => request<any>(`/api/document-templates/${id}/set-default`, { method: 'POST' }),
    duplicate: (id: string) => request<any>(`/api/document-templates/${id}/duplicate`, { method: 'POST' }),
    remove: (id: string) => request<void>(`/api/document-templates/${id}`, { method: 'DELETE' }),
  },

  fixedAssets: {
    list: () => request<{ items: any[]; total: number; totalCost: number; netBookValue: number; totalDepreciation: number }>('/api/fixed-assets'),
    get: (id: string) => request<any>(`/api/fixed-assets/${id}`),
    nextCode: () => request<{ code: string }>('/api/fixed-assets/next-code'),
    create: (data: any) => request<any>('/api/fixed-assets', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/fixed-assets/${id}`, { method: 'PATCH', body: data }),
    dispose: (id: string, data: { disposalDate: string; disposalAmount: number; disposalReason?: string | null }) =>
      request<any>(`/api/fixed-assets/${id}/dispose`, { method: 'POST', body: data }),
    restore: (id: string) => request<any>(`/api/fixed-assets/${id}/restore`, { method: 'POST' }),
    remove: (id: string) => request<void>(`/api/fixed-assets/${id}`, { method: 'DELETE' }),
  },

  // Investment wallets (trading + funded prop) · shareholders register
  investments: {
    listWallets: () => request<{ items: any[]; total: number }>('/api/investments/wallets'),
    nextWalletCode: () => request<{ code: string }>('/api/investments/wallets/next-code'),
    getWallet: (id: string) => request<any>(`/api/investments/wallets/${id}`),
    createWallet: (data: any) => request<any>('/api/investments/wallets', { method: 'POST', body: data }),
    updateWallet: (id: string, data: any) => request<any>(`/api/investments/wallets/${id}`, { method: 'PATCH', body: data }),
    closeWallet: (id: string) => request<any>(`/api/investments/wallets/${id}/close`, { method: 'POST' }),
    deleteWallet: (id: string) => request<void>(`/api/investments/wallets/${id}`, { method: 'DELETE' }),
    addWalletTransaction: (walletId: string, data: any) =>
      request<any>(`/api/investments/wallets/${walletId}/transactions`, { method: 'POST', body: data }),
    deleteWalletTransaction: (id: string) => request<void>(`/api/investments/wallet-transactions/${id}`, { method: 'DELETE' }),
    walletReport: (id: string) => request<any>(`/api/investments/wallets/${id}/report`),
    listShareholders: () => request<{ items: any[]; total: number; summary: any }>('/api/investments/shareholders'),
    nextShareholderCode: () => request<{ code: string }>('/api/investments/shareholders/next-code'),
    getShareholder: (id: string) => request<any>(`/api/investments/shareholders/${id}`),
    createShareholder: (data: any) => request<any>('/api/investments/shareholders', { method: 'POST', body: data }),
    updateShareholder: (id: string, data: any) => request<any>(`/api/investments/shareholders/${id}`, { method: 'PATCH', body: data }),
    deleteShareholder: (id: string) => request<void>(`/api/investments/shareholders/${id}`, { method: 'DELETE' }),
    listShareTransactions: () => request<{ items: any[]; total: number }>('/api/investments/share-transactions'),
    createShareTransaction: (data: any) => request<any>('/api/investments/share-transactions', { method: 'POST', body: data }),
    deleteShareTransaction: (id: string) => request<void>(`/api/investments/share-transactions/${id}`, { method: 'DELETE' }),
  },

  // Stripe billing · subscription plans + checkout + portal
  stripe: {
    plans: () => request<{ plans: any[] }>('/api/stripe/plans'),
    subscription: () => request<any>('/api/stripe/subscription'),
    createCheckoutSession: (priceId: string, successUrl?: string, cancelUrl?: string): Promise<{ url: string; multiOrgDiscount?: boolean }> =>
      request<{ url: string }>('/api/stripe/create-checkout-session', { method: 'POST', body: { priceId, successUrl, cancelUrl } }),
    customerPortal: () => request<{ url: string }>('/api/stripe/customer-portal', { method: 'POST', body: {} }),
    /** Official platform invoices for the active org (Billing → «الفواتير»). */
    invoices: () => request<{ invoices: PlatformInvoice[]; seller: BillingParty | null; buyer: BillingParty | null }>('/api/stripe/invoices'),
    /** Absolute URL of the brand-rendered platform tax invoice document. */
    invoiceDocumentUrl: (id: string, lang: 'ar' | 'en' = 'ar') => `${API_BASE}/api/stripe/invoices/${id}/document?lang=${lang}`,
  },

  // Buy-first funnel · PUBLIC — a visitor pays BEFORE any account exists.
  // These calls must never send an org header or require a session.
  public: {
    checkout: (body: { planId?: string; tier?: string; interval: 'month' | 'year'; locale: 'ar' | 'en'; market: 'sa' | 'us'; email?: string }) =>
      request<{ url: string; mode: 'checkout' | 'payment_link'; token: string }>('/api/public/checkout', { method: 'POST', body, skipOrg: true }),
    checkoutSession: (sessionId: string) =>
      request<PublicCheckoutSession>('/api/public/checkout/session', { query: { session_id: sessionId }, skipOrg: true }),
    activate: (sessionId: string, password: string) =>
      request<{ ok?: boolean; needsLogin?: boolean; email: string }>('/api/public/checkout/activate', { method: 'POST', body: { session_id: sessionId, password }, skipOrg: true }),
  },

  // Contractors (freelancers · مقاولون) · work logs · direct payments · project performance
  contractors: {
    list: () => request<{ items: any[]; total: number; peers: any }>('/api/contractors'),
    nextCode: () => request<{ code: string }>('/api/contractors/next-code'),
    get: (id: string) => request<any>(`/api/contractors/${id}`),
    create: (data: any) => request<any>('/api/contractors', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/contractors/${id}`, { method: 'PATCH', body: data }),
    deactivate: (id: string) => request<any>(`/api/contractors/${id}/deactivate`, { method: 'POST' }),
    remove: (id: string) => request<void>(`/api/contractors/${id}`, { method: 'DELETE' }),
    engage: (projectId: string, data: any) => request<any>(`/api/contractors/projects/${projectId}/engage`, { method: 'POST', body: data }),
    endEngagement: (projectId: string, engagementId: string) =>
      request<void>(`/api/contractors/projects/${projectId}/engage/${engagementId}`, { method: 'DELETE' }),
    logWork: (data: any) => request<any>('/api/contractors/work-logs', { method: 'POST', body: data }),
    listWorkLogs: (params?: { projectId?: string; contractorId?: string }) =>
      request<{ items: any[]; total: number }>('/api/contractors/work-logs', { query: params }),
    deleteWorkLog: (id: string) => request<void>(`/api/contractors/work-logs/${id}`, { method: 'DELETE' }),
    pay: (data: any) => request<any>('/api/contractors/payments', { method: 'POST', body: data }),
    deletePayment: (id: string) => request<void>(`/api/contractors/payments/${id}`, { method: 'DELETE' }),
    projectPerformance: (projectId: string) => request<any>(`/api/contractors/projects/${projectId}/performance`),
  },

  // Products
  products: {
    smartImport: smartImportClient('products'),
    list: (params?: { type?: string; category?: string }) =>
      request<{ items: any[]; total: number; categories: Array<{ category: string; count: number }> }>('/api/products', { query: params }),
    categories: () =>
      request<{ categories: Array<{ category: string; count: number; totalValue: number }> }>('/api/products/categories'),
    get: (id: string) => request<any>(`/api/products/${id}`),
    create: (data: any) => request<any>('/api/products', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/products/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),
    // B3.2 · alias barcodes (carton = 12 units …)
    barcodes: (id: string) => request<{ items: ProductBarcode[] }>(`/api/products/${id}/barcodes`),
    addBarcode: (id: string, data: { barcode: string; unitMultiplier?: number; label?: string | null }) => request<ProductBarcode>(`/api/products/${id}/barcodes`, { method: 'POST', body: data }),
    removeBarcode: (id: string, barcodeId: string) => request<void>(`/api/products/${id}/barcodes/${barcodeId}`, { method: 'DELETE' }),
    lookup: (code: string) => request<{ product: any; unitMultiplier: number; via: 'sku' | 'barcode'; label?: string | null }>('/api/products/_/lookup', { query: { code } }),
    importBulk: (rows: Array<{ sku?: string; name: string; nameAr?: string; description?: string; type?: string; category?: string; billingCycle?: string; unitPrice?: number; costPrice?: number }>, skipExisting = true) =>
      request<{ ok: true; created: number; skipped: number; errors: any[]; message: string }>(
        '/api/products/import',
        { method: 'POST', body: { rows, skipExisting } },
      ),
    seedEnsidexCatalog: () =>
      request<{ ok: true; created: number; skipped: number; message: string }>(
        '/api/products/seed-ensidex-catalog', { method: 'POST', body: {} },
      ),
    industryCatalogs: () =>
      request<{ items: Array<{ id: string; name: string; nameAr: string; description: string; icon: string; productCount: number }> }>(
        '/api/products/industry-catalogs',
      ),
    seedIndustry: (industryId: string) =>
      request<{ ok: true; created: number; skipped: number; message: string; catalog: { id: string; nameAr: string; icon: string } }>(
        `/api/products/seed-industry/${industryId}`, { method: 'POST', body: {} },
      ),
  },

  // Invoice operations helpers
  invoiceOps: {
    splitByCategory: (invoiceId: string) =>
      request<{ ok: true; originalInvoiceId: string; createdCount: number; groups: Array<{ key: string; labelAr: string; labelEn: string; lines: number; total: number }>; createdInvoices: Invoice[] }>(
        `/api/invoices/${invoiceId}/split-by-category`,
        { method: 'POST', body: {} },
      ),
  },

  // Notifications
  notifications: {
    list: (params?: { unread?: boolean; limit?: number }) =>
      request<{ items: NotificationItem[]; count: number }>('/api/notifications', {
        query: { unread: params?.unread ? '1' : undefined, limit: params?.limit?.toString() },
      }),
    count: () => request<{ unread: number }>('/api/notifications/count'),
    markRead: (id: string) => request<NotificationItem>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<{ updated: number }>('/api/notifications/mark-all-read', { method: 'POST' }),
    create: (data: { type: string; title: string; body?: string; link?: string; refType?: string; refId?: string }) =>
      request<NotificationItem>('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => request<{ ok: true }>(`/api/notifications/${id}`, { method: 'DELETE' }),
  },

  // AI Billing · BYOK + hosted credits
  aiBilling: {
    get: () => request<AiBillingConfig>('/api/ai-billing'),
    update: (data: AiBillingUpdate) => request<AiBillingConfig>('/api/ai-billing', { method: 'PATCH', body: data }),
    testKey: () => request<{
      ok: boolean; status?: number; provider?: string; error?: string; message?: string;
      elapsedMs?: number; keyLabel?: string; usage?: number; limit?: number; isFreeTier?: boolean;
    }>('/api/ai-billing/test-key', { method: 'POST' }),
    usage: (limit?: number) => request<{
      items: AiUsageLog[];
      byEndpoint: Record<string, { count: number; cost: number }>;
      byModel: Record<string, { count: number; cost: number }>;
    }>('/api/ai-billing/usage', { query: { limit: limit?.toString() } }),
    // Admin-only (returns 403 for non-admins)
    admin: {
      orgs: () => request<{ items: any[]; totalSpend: number; count: number }>('/api/ai-billing/admin/orgs'),
      topup: (data: { orgId: string; amountUsd: number; note?: string }) =>
        request<{ orgId: string; newBalance: string }>('/api/ai-billing/admin/topup', { method: 'POST', body: data }),
      disable: (data: { orgId: string; disabled: boolean; reason?: string }) =>
        request<{ orgId: string; disabled: boolean; disabledReason: string | null }>('/api/ai-billing/admin/disable', { method: 'POST', body: data }),
      usageSummary: () => request<{
        since: string; totalCost: number; totalRequests: number;
        byOrg: Record<string, { count: number; cost: number }>;
        byModel: Record<string, { count: number; cost: number }>;
      }>('/api/ai-billing/admin/usage-summary'),
    },
  },

  // E-signature (DocuSeal at sign.ensidex.com)
  sign: {
    sendQuote: (quoteId: string, data: SignSendInput) =>
      request<SignSendResult>(`/api/sign/quotes/${quoteId}/send`, { method: 'POST', body: data }),
    sendInvoice: (invoiceId: string, data: SignSendInput) =>
      request<SignSendResult>(`/api/sign/invoices/${invoiceId}/send`, { method: 'POST', body: data }),
    listRequests: (params?: { status?: string; docType?: 'QUOTE' | 'INVOICE' }) =>
      request<{ items: SignatureRequest[] }>('/api/sign/requests', { query: params }),
    getRequest: (id: string) => request<SignatureRequest>(`/api/sign/requests/${id}`),
    health: () => request<{ base: string; tokenSet: boolean; publicApiUrl: string }>('/api/sign/health'),
  },

  // Bank Accounts
  bankAccounts: {
    list: () => request<{ items: BankAccount[]; total: number; totalBalance: number }>('/api/bank-accounts'),
    create: (data: BankAccountInput) => request<BankAccount>('/api/bank-accounts', { method: 'POST', body: data }),
    update: (id: string, data: Partial<BankAccountInput>) => request<BankAccount>(`/api/bank-accounts/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/bank-accounts/${id}`, { method: 'DELETE' }),
  },

  // OCR — Claude Vision via OpenRouter · ANY file type · multi-file
  ocr: {
    extract: (data: { fileBase64: string; mimeType: string; fileName?: string; rawText?: string; docType?: string }) =>
      request<{ extracted: OcrResult; cost?: any; model?: string }>('/api/ocr/extract', { method: 'POST', body: data }),
    extractBatch: (data: { files: Array<{ fileBase64: string; mimeType: string; fileName?: string; rawText?: string }>; hint?: string }) =>
      request<{
        files: Array<{ fileName?: string; mimeType: string; ok: boolean; extracted?: OcrResult; error?: string; model?: string }>;
        summary: { totalFiles: number; successful: number; failed: number; totalAmount: number; currency: string | null };
        index: { byDocType: Record<string, number>; byVendor: Record<string, number>; byMonth: Record<string, number>; byTag: Record<string, number> };
      }>('/api/ocr/extract-batch', { method: 'POST', body: data }),
  },

  // Agent — Claude with tool calling + structured extractors
  agent: {
    conversations: {
      list: (params?: { limit?: number; status?: 'ACTIVE' | 'ARCHIVED' }) =>
        request<{ items: AgentConversation[] }>('/api/agent/conversations', { query: params }),
      create: (data?: { title?: string }) =>
        request<{ conversation: AgentConversation }>('/api/agent/conversations', { method: 'POST', body: data || {} }),
      messages: (id: string) =>
        request<{ conversation: AgentConversation; messages: AgentMessage[] }>(`/api/agent/conversations/${id}/messages`),
      appendMessage: (id: string, data: { role: 'user' | 'assistant'; content: string; toolResults?: any; metadata?: any }) =>
        request<{ conversation: AgentConversation; message: AgentMessage }>(`/api/agent/conversations/${id}/messages`, { method: 'POST', body: data }),
      update: (id: string, data: { title?: string; status?: 'ACTIVE' | 'ARCHIVED' }) =>
        request<{ conversation: AgentConversation }>(`/api/agent/conversations/${id}`, { method: 'PATCH', body: data }),
    },
    chat: (input: Array<{ role: 'user' | 'assistant'; content: string }> | { conversationId?: string; message?: string; messages?: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
      request<AgentChatResponse>(
        '/api/agent/chat',
        { method: 'POST', body: Array.isArray(input) ? { messages: input } : input },
      ),
    /** Universal document → structured rows · UX-65b */
    extractDocument: (data: {
      fileBase64: string;
      fileName?: string;
      mimeType: string;
      target?: 'invoice-lines' | 'quote-lines' | 'bill-lines' | 'expense' | 'contact' | 'auto';
      hint?: string;
      defaultTaxRate?: number;
      currency?: string;
    }) => request<any>('/api/agent/extract-document', { method: 'POST', body: data }),
    /** HR-5 · employee document (iqama/passport/CV) → contract fields */
    extractEmployeeDocument: (data: {
      fileBase64: string;
      fileName?: string;
      mimeType: string;
    }) => request<any>('/api/agent/employee-document', { method: 'POST', body: data }),
    normalizeImage: (data: {
      fileBase64: string;
      fileName?: string;
      mimeType: string;
      trimEdges?: boolean;
    }) => request<{
      ok: true;
      fileBase64: string;
      fileName: string;
      mimeType: string;
      warnings?: string[];
      converted?: boolean;
      originalMimeType?: string;
    }>('/api/agent/normalize-image', { method: 'POST', body: data }),
    /** Smart paste · text blob → structured rows */
    parsePaste: (data: { text: string; hint?: 'invoice' | 'expense' | 'bill' | 'voucher' | 'contact' | 'auto' }) =>
      request<any>('/api/agent/parse-paste', { method: 'POST', body: data }),
    /** Voice → transcript → optional intent */
    voice: (data: { audioBase64: string; mimeType: string; mode?: 'transcribe-only' | 'transcribe-and-act' }) =>
      request<{ transcript: string; source?: string; nextAction?: string }>(
        '/api/agent/voice',
        { method: 'POST', body: data },
      ),
    /** Anomaly detection · outliers + duplicates + overdue */
    anomaly: (data?: { period?: '7d' | '30d' | '90d'; scope?: 'all' | 'expenses' | 'invoices' | 'vouchers' }) =>
      request<{ flags: any[]; total: number; period: string; scope: string }>(
        '/api/agent/anomaly',
        { method: 'POST', body: data || {} },
      ),
    /** Cash flow forecast · 8 weeks default */
    cashFlowForecast: (data?: { weeks?: number; includeRecurring?: boolean }) =>
      request<{ weeks: any[]; startCash: number; endCash: number; concerns: any[] }>(
        '/api/agent/cash-flow-forecast',
        { method: 'POST', body: data || {} },
      ),
  },

  // Email · Resend wrapper · branded HTML templates
  email: {
    status: () =>
      request<{ configured: boolean; mode: string; from: string }>('/api/email/status'),
    sendInvoice: (id: string, data: { to?: string; message?: string; payLink?: string }) =>
      request<{ ok: boolean; emailId?: string; sentTo: string }>(
        `/api/email/invoices/${id}/send`,
        { method: 'POST', body: data },
      ),
    sendQuote: (id: string, data: { to?: string; message?: string; payLink?: string }) =>
      request<{ ok: boolean; emailId?: string; sentTo: string }>(
        `/api/email/quotes/${id}/send`,
        { method: 'POST', body: data },
      ),
  },

  // Loyalty points
  loyalty: {
    listAccounts: (params?: { tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' }) =>
      request<{ items: any[] }>('/api/loyalty/accounts', { query: params }),
    getAccount: (contactId: string) =>
      request<any>(`/api/loyalty/accounts/${contactId}`),
    enrol: (contactId: string) =>
      request<any>('/api/loyalty/accounts', { method: 'POST', body: { contactId } }),
    earn: (contactId: string, points: number, source?: string, description?: string) =>
      request<any>(`/api/loyalty/accounts/${contactId}/earn`, { method: 'POST', body: { points, source, description } }),
    redeem: (contactId: string, points: number, source?: string, description?: string) =>
      request<any>(`/api/loyalty/accounts/${contactId}/redeem`, { method: 'POST', body: { points, source, description } }),
  },

  // Bank statement import (CSV / MT940 / OFX / QIF / XLSX / XLS / PDF) + auto-match
  bankImport: {
    profiles: () => request<{ profiles: { id: string; label: string }[]; formats: Array<'csv' | 'mt940' | 'ofx' | 'qif' | 'xlsx' | 'xls' | 'pdf'> }>('/api/bank-import/profiles'),
    parse: (data: { bankAccountId: string; format: 'csv' | 'mt940' | 'ofx' | 'qif' | 'xlsx' | 'xls' | 'pdf'; profile?: string; text?: string; fileBase64?: string; fileName?: string; mimeType?: string }) =>
      request<{ rows: any[]; matched: number; unmatched: number; ai?: { model?: string; source?: string } }>(
        '/api/bank-import/parse',
        { method: 'POST', body: data },
      ),
    commit: (data: { bankAccountId: string; rows: any[] }) =>
      request<{ ok: boolean; created: number; linked: number; skipped: number }>(
        '/api/bank-import/commit',
        { method: 'POST', body: data },
      ),
  },

  // Portal · enable/disable per-contact + retrieve URL + public portal feed
  portal: {
    enable: (contactId: string) =>
      request<{ ok: true; url: string; token: string }>(`/api/portal-admin/contacts/${contactId}/enable`, { method: 'POST' }),
    disable: (contactId: string) =>
      request<{ ok: true }>(`/api/portal-admin/contacts/${contactId}/disable`, { method: 'POST' }),
    getUrl: (contactId: string) =>
      request<{ enabled: boolean; url?: string; token?: string }>(`/api/portal-admin/contacts/${contactId}/url`),
    me: (token: string) =>
      request<{ contact: any; org: { id: string; name: string; baseCurrency: string; country: string; logoUrl?: string | null }; summary: { outstanding: number; overdueAmount: number; overdueCount: number; totalInvoices: number; lastPayment: { date: string; amount: number } | null } }>(
        '/api/portal/me',
        { skipOrg: true, headers: { 'x-portal-token': token } },
      ),
    invoices: (token: string, params?: { status?: string }) =>
      request<{ items: Array<{ id: string; number: string; date: string; dueDate: string | null; currency: string; total: number; paid: number; remaining: number; status: string; paymentLinkUrl?: string | null }> }>(
        '/api/portal/invoices',
        { query: params, skipOrg: true, headers: { 'x-portal-token': token } },
      ),
    statement: (token: string) =>
      request<{ items: Array<{ date: string; description: string; ref: string; debit: number; credit: number; balance: number }>; finalBalance: number }>(
        '/api/portal/statement',
        { skipOrg: true, headers: { 'x-portal-token': token } },
      ),
    documents: (token: string) =>
      request<{ items: Array<{ id: string; name: string; type: string; date: string }> }>(
        '/api/portal/documents',
        { skipOrg: true, headers: { 'x-portal-token': token } },
      ),
    payInvoice: (token: string, invoiceId: string) =>
      request<{ url: string }>(`/api/portal/pay/${invoiceId}`, {
        method: 'POST',
        skipOrg: true,
        headers: { 'x-portal-token': token },
      }),
  },

  // Payment Links · Stripe + PayPal + Moyasar
  paymentLinks: {
    create: (invoiceId: string, provider: 'stripe' | 'paypal' | 'moyasar' | 'auto' = 'auto') =>
      request<{ url: string; id: string; provider: string }>(`/api/payment-links/invoice/${invoiceId}`, { method: 'POST', body: { provider } }),
    get: (invoiceId: string) =>
      request<{ url: string; provider: string; id: string }>(`/api/payment-links/invoice/${invoiceId}`),
  },

  // Currency · multi-currency rates + conversion
  currency: {
    listRates: (params?: { from?: string; to?: string }) =>
      request<{ items: Array<{ id: string; fromCurrency: string; toCurrency: string; rate: number; date: string; source: string }> }>(
        '/api/currency/rates', { query: params },
      ),
    latestRate: (from: string, to: string) =>
      request<{ rate: number; source: string; date: string }>('/api/currency/rates/latest', { query: { from, to } }),
    upsertRate: (data: { fromCurrency: string; toCurrency: string; rate: number; date?: string; source?: string }) =>
      request<any>('/api/currency/rates', { method: 'POST', body: data }),
    sync: () => request<{ ok: true; count: number; source: string }>('/api/currency/rates/sync', { method: 'POST' }),
    convert: (params: { amount: number; from: string; to: string; date?: string }) =>
      request<{ amount: number; converted: number; rate: number; source?: string }>('/api/currency/convert', { query: params }),
  },

  // Fiscal Periods · year close + locking
  fiscalPeriods: {
    list: (year?: number) =>
      request<{ items: Array<any> }>('/api/fiscal-periods', { query: year ? { year } : undefined }),
    init: (year: number, startMonth = 1) =>
      request<{ ok: true; count: number }>('/api/fiscal-periods/init', { method: 'POST', body: { year, startMonth } }),
    lock: (id: string) => request<{ ok: true }>(`/api/fiscal-periods/${id}/lock`, { method: 'POST' }),
    unlock: (id: string) => request<{ ok: true }>(`/api/fiscal-periods/${id}/unlock`, { method: 'POST' }),
    previewClose: (id: string) =>
      request<{ period: any; combinedRevenue: number; combinedExpense: number; netIncome: number }>(`/api/fiscal-periods/${id}/preview-close`),
    close: (id: string) =>
      request<{ ok: true; totalRevenue: number; totalExpense: number; netIncome: number }>(`/api/fiscal-periods/${id}/close`, { method: 'POST' }),
  },

  // Onboarding · first-run migration wizard (per-company)
  onboarding: {
    status: () => request<{ completed: boolean; completedAt: string | null; openingBalancesDone: boolean; openingAt: string | null; productsCount: number; contactsCount: number }>('/api/onboarding/status'),
    complete: () => request<{ completed: boolean; completedAt: string | null }>('/api/onboarding/complete', { method: 'POST' }),
    openingBalances: (data: { date?: string; cash?: number; bank?: number; inventory?: number; receivables?: number; payables?: number; notes?: string }) =>
      request<{ ok: true; entryId: string; entryNumber: string; lines: number; equityAmount: number }>('/api/onboarding/opening-balances', { method: 'POST', body: data }),
    importProducts: (data: { rows: Array<{ name: string; nameAr?: string; sku?: string; type?: 'GOOD' | 'SERVICE' | 'INVENTORY'; category?: string; unitPrice?: number; costPrice?: number; openingQty?: number }>; openingStock?: boolean }) =>
      request<{ ok: boolean; created: number; skipped: number; stockApplied: number; errors: Array<{ index: number; name: string; error: string }> }>('/api/onboarding/import-products', { method: 'POST', body: data }),
    importContacts: (data: { rows: Array<{ name: string; type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'; email?: string; phone?: string; taxId?: string; country?: string }> }) =>
      request<{ ok: boolean; created: number; skipped: number; errors: Array<{ index: number; name: string; error: string }> }>('/api/onboarding/import-contacts', { method: 'POST', body: data }),
  },

  // ZATCA Phase 2 · CSID + processing + status
  vatRegistration: {
    get: (orgId: string) => request<{ registration: Record<string, any> | null }>("/api/vat-registration", { skipOrg: true, headers: { "X-Org-Id": orgId } }),
    save: (orgId: string, data: Record<string, unknown>) => request<{ registration: { revision: number } }>("/api/vat-registration", { skipOrg: true, method: "PUT", headers: { "X-Org-Id": orgId }, body: data }),
  },
  zatca: {
    status: () => request<{
      enabled: boolean; mode: 'sandbox' | 'simulation' | 'production';
      vatNumber: string | null; crNumber: string | null;
      csidConfigured: boolean; icv: number; pihExists: boolean;
      invoicesProcessed: number; ready: boolean; nextActions: string;
    }>('/api/zatca/status'),
    onboard: (data: { csid: string; csidSecret: string; mode?: 'sandbox' | 'simulation' | 'production' }) =>
      request<{ ok: true }>('/api/zatca/onboard', { method: 'POST', body: data }),
    resetIcv: () => request<{ ok: true; message: string }>('/api/zatca/reset-icv', { method: 'POST' }),
    process: (invoiceId: string) =>
      request<{ ok: boolean; status: string; uuid: string; qr: string; warnings: string[]; errors: string[] }>(
        `/api/zatca/invoices/${invoiceId}/process`, { method: 'POST' },
      ),
    getQr: (invoiceId: string) => request<{ qr: string }>(`/api/zatca/invoices/${invoiceId}/qr`),
    // CSID onboarding wizard (prepare → compliance → production) · SA orgs only
    onboarding: {
      status: (orgId?: string) => request<{
        zatcaEnabled: boolean; mode: string; status: 'NONE' | 'CSR_READY' | 'COMPLIANCE' | 'PRODUCTION';
        hasCsr: boolean; hasCertificate: boolean; hasCsid: boolean; hasSigningMaterial: boolean;
        vatConfigured: boolean; environmentVerified?: boolean; productionReady?: boolean;
        complianceResult: { ok: boolean; passed: number; failed: number; ranAt: string; results: Array<{ docType: string; ok: boolean; status: string | null; errors: string[]; warnings: string[] }> } | null;
      }>('/api/zatca/onboarding/status', orgId ? { skipOrg: true, headers: { 'X-Org-Id': orgId } } : {}),
      prepare: (data: { deviceName?: string; branchName: string; location: string; industry: string; invoiceType: "1000" | "0100" | "1100"; mode: "sandbox" | "simulation" | "production" }) =>
        request<{ ok: true; csrBase64: string; deviceName: string; deviceId: string; status: string }>(
          '/api/zatca/onboarding/prepare', { method: 'POST', body: data || {} }),
      compliance: (otp: string) =>
        request<{ ok: true; status: string; requestId: string | null }>(
          '/api/zatca/onboarding/compliance', { method: 'POST', body: { otp } }),
      complianceCheck: () =>
        request<{ ok: boolean; passed: number; failed: number; ranAt: string; results: Array<{ docType: string; ok: boolean; status: string | null; errors: string[]; warnings: string[] }> }>(
          '/api/zatca/onboarding/compliance-check', { method: 'POST', body: {} }),
      production: () =>
        request<{ ok: true; status: string; requestId: string | null }>(
          '/api/zatca/onboarding/production', { method: 'POST', body: {} }),
    },
  },

  // Partners & Affiliates · برنامج الشركاء (عمولات + نقاط + سحب)
  partners: {
    register: (data: { name?: string; email?: string; phone?: string; type?: 'FREELANCER' | 'FIRM'; country?: string; commissionTier?: string }) =>
      request<any>('/api/partners/register', { method: 'POST', body: data }),
    me: () => request<{
      partner: any;
      dashboard: { activeClients: number; totalClients: number; totalEarned: number; totalPaid: number; pendingCommissions: number; clearedCommissions: number };
      clients: any[]; commissions: any[]; payouts: any[];
    }>('/api/partners/me'),
    addClient: (orgId: string) => request<any>('/api/partners/clients', { method: 'POST', body: { orgId } }),
    requestPayout: (data: { amount?: number; currency?: string; notes?: string }) =>
      request<any>('/api/partners/payouts', { method: 'POST', body: data }),
    leaderboard: () => request<{ partners: any[] }>('/api/partners/leaderboard'),
  },

  // Revenue Recognition · الاعتراف بالإيرادات / Deferred Revenue
  // catchUp is fire-and-forget on dashboard load (lazy, survives reboots).
  revenueRecognition: {
    catchUp: () => request<{ posted: number }>('/api/revenue-recognition/catch-up'),
    run: () => request<{ posted: number }>('/api/revenue-recognition/run', { method: 'POST' }),
    listSchedules: () => request<{ items: any[]; total: number }>('/api/revenue-recognition/schedules'),
  },

  // Inventory · multi-warehouse · WAC/FIFO/LIFO
  inventory: {
    listWarehouses: () => request<{ items: any[] }>('/api/inventory/warehouses'),
    // B2 · transfer documents between warehouses / branches
    transfers: {
      list: (params?: { status?: string }) => request<{ items: StockTransferSummary[]; total: number; inTransitValue: number }>('/api/inventory/transfers/docs', { query: params }),
      get: (id: string) => request<StockTransfer>(`/api/inventory/transfers/docs/${id}`),
      create: (data: StockTransferInput) => request<StockTransfer>('/api/inventory/transfers/docs', { method: 'POST', body: data }),
      update: (id: string, data: Partial<StockTransferInput>) => request<StockTransfer>(`/api/inventory/transfers/docs/${id}`, { method: 'PATCH', body: data }),
      send: (id: string) => request<StockTransfer>(`/api/inventory/transfers/docs/${id}/send`, { method: 'POST' }),
      receive: (id: string, data?: { lines?: Array<{ productId: string; receivedQty: number; reason?: string | null }>; receivedByName?: string | null }) =>
        request<{ ok: true; shortfallValue: number; journal: { journalId: string | null; skipped?: string }; transfer: StockTransfer }>(`/api/inventory/transfers/docs/${id}/receive`, { method: 'POST', body: data ?? {} }),
      cancel: (id: string) => request<StockTransfer>(`/api/inventory/transfers/docs/${id}/cancel`, { method: 'POST' }),
    },
    // B3.3 · products at/below their reorder point
    reorder: (params?: { warehouseId?: string }) => request<{ items: ReorderAlert[]; total: number }>('/api/inventory/reorder', { query: params }),
    createWarehouse: (data: { code: string; name: string; isPrimary?: boolean; address?: string }) =>
      request<any>('/api/inventory/warehouses', { method: 'POST', body: data }),
    listStock: (params?: { productId?: string; warehouseId?: string }) =>
      request<{ items: any[] }>('/api/inventory/stock', { query: params }),
    listMovements: (params?: { productId?: string; warehouseId?: string; from?: string; to?: string }) =>
      request<{ items: any[] }>('/api/inventory/movements', { query: params }),
    receipt: (data: { productId: string; warehouseId: string; quantity: number; unitCost: number; refType?: string; refId?: string }) =>
      request<any>('/api/inventory/receipts', { method: 'POST', body: data }),
    issue: (data: { productId: string; warehouseId: string; quantity: number; method?: 'WAC' | 'FIFO' | 'LIFO'; refType?: string; refId?: string }) =>
      request<{ cogs: number; shortfall: number }>('/api/inventory/issues', { method: 'POST', body: data }),
    transfer: (data: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; method?: 'WAC' | 'FIFO' | 'LIFO' }) =>
      request<any>('/api/inventory/transfers', { method: 'POST', body: data }),
    // Stocktake (B4 · 2026-08-26)
    counts: {
      list: (status?: string) => request<{ items: StockCountSummary[] }>('/api/inventory/counts', { query: status ? { status } : undefined }),
      get: (id: string) => request<StockCount>(`/api/inventory/counts/${id}`),
      create: (data: { warehouseId: string; scope?: 'FULL' | 'CATEGORY' | 'SELECTED'; category?: string | null; productIds?: string[]; branchId?: string | null; blind?: boolean; notes?: string | null }) =>
        request<StockCount>('/api/inventory/counts', { method: 'POST', body: data }),
      lines: (id: string, lines: Array<{ productId?: string; sku?: string; countedQty: number; mode?: 'set' | 'add'; reason?: string | null }>) =>
        request<{ ok: boolean; results: Array<{ productId: string | null; sku?: string; status: 'counted' | 'not_in_count' | 'unknown_sku'; countedQty?: number }> }>(`/api/inventory/counts/${id}/lines`, { method: 'POST', body: { lines } }),
      review: (id: string) => request<StockCount>(`/api/inventory/counts/${id}/review`, { method: 'POST', body: {} }),
      reopen: (id: string) => request<StockCount>(`/api/inventory/counts/${id}/reopen`, { method: 'POST', body: {} }),
      post: (id: string, uncounted: 'skip' | 'zero' = 'skip') => request<{ ok: boolean; adjustments: Array<{ productId: string; delta: number; ok: boolean; error?: string }>; failed: any[]; count: StockCount }>(`/api/inventory/counts/${id}/post`, { method: 'POST', body: { uncounted } }),
      cancel: (id: string) => request<StockCount>(`/api/inventory/counts/${id}/cancel`, { method: 'POST', body: {} }),
    },
  },

  // Payroll · GOSI + SIF (مدد)
  payroll: {
    calculate: (employees: any[]) =>
      request<{ results: any[]; totals: any }>('/api/payroll/calculate', { method: 'POST', body: { employees } }),
    sif: (data: { employerId: string; establishmentId: string; period: string; rows: any[] }) =>
      request<string>('/api/payroll/sif', { method: 'POST', body: data, raw: true } as any),
    settings: () => request<any>('/api/payroll/settings'),
    updateSettings: (data: any) => request<any>('/api/payroll/settings', { method: 'PATCH', body: data }),
    contracts: () => request<{ items: any[]; total: number }>('/api/payroll/contracts'),
    saveContract: (data: any) => request<any>('/api/payroll/contracts', { method: 'POST', body: data }),
    updateContract: (id: string, data: any) => request<any>(`/api/payroll/contracts/${id}`, { method: 'PATCH', body: data }),
    // Employee documents (HR-4): iqama/passport/contract/CV files per contract
    documents: (contractId: string) =>
      request<{ items: any[]; total: number }>(`/api/payroll/contracts/${contractId}/documents`),
    uploadDocument: (contractId: string, data: { documentKind: string; fileName: string; fileBase64: string; fileType?: string; expiresAt?: string | null }) =>
      request<any>(`/api/payroll/contracts/${contractId}/documents`, { method: 'POST', body: data }),
    downloadDocument: (id: string) =>
      request<{ id: string; fileName: string; fileType: string | null; fileBase64: string }>(`/api/payroll/documents/${id}/download`),
    removeDocument: (id: string) =>
      request<{ ok: boolean }>(`/api/payroll/documents/${id}`, { method: 'DELETE' }),
    runs: () => request<{ items: any[]; total: number }>('/api/payroll/runs'),
    getRun: (id: string) => request<any>(`/api/payroll/runs/${id}`),
    saveRun: (data: { period: string; runNumber?: string; notes?: string | null; employees?: any[] }) =>
      request<any>('/api/payroll/run', { method: 'POST', body: data }),
    updateRunStatus: (id: string, status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID' | 'CANCELLED') =>
      request<any>(`/api/payroll/runs/${id}/status`, { method: 'POST', body: { status } }),
    deleteRun: (id: string) => request<{ ok: true }>(`/api/payroll/runs/${id}`, { method: 'DELETE' }),
    runSifUrl: (id: string) => `${API_BASE}/api/payroll/runs/${id}/sif`,
  },

  // Credit notes (إشعارات دائنة)
  creditNotes: {
    list: (params?: { limit?: number }) => request<{ items: any[] }>('/api/credit-notes', { query: params }),
    get: (id: string) => request<any>(`/api/credit-notes/${id}`),
    create: (data: any) => request<any>('/api/credit-notes', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/credit-notes/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/credit-notes/${id}`, { method: 'DELETE' }),
    attachments: {
      list: (id: string) => request<{ items: ExpenseAttachment[] }>(`/api/credit-notes/${id}/attachments`),
      upload: (id: string, body: { filename: string; contentType: string; sizeBytes: number; data: string }) =>
        request<ExpenseAttachment>(`/api/credit-notes/${id}/attachments`, { method: 'POST', body }),
      remove: (id: string, aid: string) =>
        request<void>(`/api/credit-notes/${id}/attachments/${aid}`, { method: 'DELETE' }),
    },
  },

  // Supplier credits (إشعارات/مرتجعات الموردين)
  supplierCredits: {
    list: (params?: { limit?: number; contactId?: string; originalBillId?: string; status?: string }) =>
      request<{ items: any[]; total: number }>('/api/supplier-credits', { query: params }),
    get: (id: string) => request<any>(`/api/supplier-credits/${id}`),
    create: (data: any) => request<any>('/api/supplier-credits', { method: 'POST', body: data }),
    remove: (id: string) => request<void>(`/api/supplier-credits/${id}`, { method: 'DELETE' }),
  },

  // Vouchers (سند قبض / سند صرف)
  vouchers: {
    list: (params?: { type?: 'RECEIPT' | 'PAYMENT'; bankAccountId?: string; contactId?: string; invoiceId?: string; billId?: string }) =>
      request<{ items: Voucher[]; total: number; summary: { sumAmount: string; avgAmount: string } }>(
        '/api/vouchers',
        { query: params },
      ),
    get: (id: string) => request<Voucher>(`/api/vouchers/${id}`),
    create: (data: VoucherInput) =>
      request<Voucher>('/api/vouchers', { method: 'POST', body: data }),
    update: (id: string, data: Partial<VoucherInput>) =>
      request<Voucher>(`/api/vouchers/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/vouchers/${id}`, { method: 'DELETE' }),
    printUrl: (id: string) => `/print/voucher/${id}`,
    email: (id: string, body?: { to?: string; subject?: string; message?: string }) =>
      request<{ ok: true; to: string }>(`/api/vouchers/${id}/email`, { method: 'POST', body: body || {} }),
    attachments: {
      list: (id: string) => request<{ items: Array<{ id: string; filename: string; contentType: string; sizeBytes: number; url: string; createdAt: string }> }>(`/api/vouchers/${id}/attachments`),
      upload: (id: string, body: { filename: string; contentType: string; sizeBytes: number; data: string }) =>
        request<any>(`/api/vouchers/${id}/attachments`, { method: 'POST', body }),
      remove: (id: string, aid: string) =>
        request<void>(`/api/vouchers/${id}/attachments/${aid}`, { method: 'DELETE' }),
    },
  },

  // Invoices
  invoices: {
    attachments: {
      list: (id: string) => request<{ items: ExpenseAttachment[] }>(`/api/invoices/${id}/attachments`),
      add: (id: string, body: { filename: string; contentType: string; sizeBytes: number; data: string }) => request<ExpenseAttachment>(`/api/invoices/${id}/attachments`, { method: 'POST', body }),
      remove: (id: string, aid: string) =>
        request<void>(`/api/invoices/${id}/attachments/${aid}`, { method: 'DELETE' }),
    },
    list: (params?: { status?: string; contactId?: string; page?: number; limit?: number; branchId?: string; projectId?: string; source?: string }) =>
      request<PaginatedResponse<Invoice> & { totalsByCurrency?: Record<string, { total: number; paid: number; outstanding: number }> }>('/api/invoices', { query: params }),
    nextNumber: () => request<{ number: string }>('/api/invoices/_/next-number'),
    get: (id: string) => request<Invoice>(`/api/invoices/${id}`),
    create: (data: InvoiceInput) =>
      request<Invoice>('/api/invoices', { method: 'POST', body: data }),
    update: (id: string, data: Partial<InvoiceInput>) =>
      request<Invoice>(`/api/invoices/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/invoices/${id}`, { method: 'DELETE' }),
    printUrl: (id: string) => `/print/invoice/${id}`,
    email: (id: string, body?: { to?: string; subject?: string; message?: string }) =>
      request<{ ok: true; to: string }>(`/api/invoices/${id}/email`, { method: 'POST', body: body || {} }),
  },

  // W27 · single demo policy — one demo per user, auto-expires after 30 days.
  // 409 demo_exists unless replace=true (the server deletes the old demo first).
  // ── POS · cashier (W27-next) ──
  posCatalog: () =>
    request<{ items: Array<{ id: string; sku: string | null; name: string; nameAr: string | null; imageUrl: string | null; type: string; unitPrice: string; stockQty: string; category: string | null; taxRate: { rate: string; type: string } | null }>; orgVatRate: number }>(
      '/api/pos/catalog',
    ),
  posShiftCurrent: () =>
    request<{ shift: { id: string; openedAt: string; openingFloat: string; cashierId?: string | null; cashierName?: string | null } | null }>('/api/pos/shift/current'),
  // Named cashiers (2026-08-26)
  posCashiers: {
    list: (all?: boolean) => request<{ items: PosCashierRow[] }>('/api/pos/cashiers', { query: all ? { all: 1 } : undefined }),
    create: (data: { name: string; pin?: string | null }) => request<PosCashierRow>('/api/pos/cashiers', { method: 'POST', body: data }),
    update: (id: string, data: { name?: string; pin?: string | null; clearPin?: boolean; isActive?: boolean }) => request<PosCashierRow>(`/api/pos/cashiers/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/pos/cashiers/${id}`, { method: 'DELETE' }),
    verify: (id: string, pin: string) => request<{ ok: boolean }>(`/api/pos/cashiers/${id}/verify`, { method: 'POST', body: { pin } }),
  },
  posShiftOpen: (openingFloat: number, branchId?: string | null, cashier?: { cashierId: string; pin?: string | null } | null) =>
    request<{ shift: { id: string; branchId?: string | null; cashierName?: string | null } }>('/api/pos/shift/open', { method: 'POST', body: { openingFloat, branchId, cashierId: cashier?.cashierId ?? null, pin: cashier?.pin ?? null } }),
  posShiftClose: (closingCount: number, notes?: string) =>
    request<{ summary: { openingFloat: number; cashSales: number; expectedCash: number; closingCount: number; difference: number; salesTotal: number; salesCount: number } }>(
      '/api/pos/shift/close', { method: 'POST', body: { closingCount, notes } },
    ),
  posSale: (data: { lines: Array<{ productId: string; qty: number; unitPrice?: number }>; paymentMethod: 'CASH' | 'CARD' | 'MADA'; amountTendered?: number; shiftId?: string | null; customerId?: string | null; clientSaleId?: string; occurredAt?: string; branchId?: string | null; deviceId?: string; cashierName?: string; provisionalNumber?: string }) =>
    request<{ ok: true; duplicate?: boolean; invoice: { id: string; number: string; total: number; subtotal: number; taxTotal: number; issueDate?: string }; payment: { method: string; amount: number; tendered: number; change: number } }>(
      '/api/pos/sale', { method: 'POST', body: data },
    ),
  // POS v2 · offline queue upload (≤100 sales · per-item result · idempotent by clientSaleId)
  posSync: (data: { deviceId?: string; sales: Array<Record<string, unknown>> }) =>
    request<{ ok: boolean; total: number; created: number; duplicate: number; failed: number; results: Array<{ clientSaleId: string | null; status: 'created' | 'duplicate' | 'failed'; error?: string; invoice?: { id: string; number: string; total: number; issueDate: string } }> }>(
      '/api/pos/sync', { method: 'POST', body: data },
    ),

  seedDemo: (opts: { country?: 'SA' | 'US'; replace?: boolean } = {}) =>
    request<{ ok: true; seeded: Array<{ id: string; slug: string; name: string; country: string; currency: string }>; demoExpiresAt: string; expiresInDays: number }>(
      '/orgs/_/seed-demo', { method: 'POST', body: { country: opts.country ?? 'SA', replace: opts.replace === true }, skipOrg: true },
    ),
  industryTemplates: () =>
    request<Array<{ id: string; name: string; nameAr: string; description: string; icon: string | null; accountCount: number }>>(
      '/orgs/industry-templates', { skipOrg: true },
    ),
  transferOwnership: (orgId: string, email: string) =>
    request<{ ok: true; newOwnerEmail: string }>(
      `/orgs/${orgId}/transfer-ownership`, { method: 'POST', body: { email }, skipOrg: true },
    ),

  // ── Admin (W31 · session-gated by ADMIN_EMAILS — 403 for everyone else) ──
  admin: {
    overview: () => request<{ users: number; orgs: number; newUsers7d: number; newOrgs7d: number; subsByStatus: Record<string, number>; recentOrgs: Array<{ id: string; name: string; country: string; createdAt: string; ownerEmail: string | null; plan: string | null; tier: string | null; status: string }> }>('/api/admin/overview', { skipOrg: true }),
    orgs: (q?: string) => request<{ items: Array<{ id: string; name: string; slug: string; country: string; currency: string; industry: string | null; createdAt: string; members: number; invoices: number; owner: { id: string; email: string; name: string | null } | null; subscription: { status: string; currentPeriodEnd: string | null; plan?: { id: string; name: string; tier: string; price: number | null; currency: string; interval: string }; price: number | null } | null }> }>('/api/admin/orgs', { query: q ? { q } : undefined, skipOrg: true }),
    orgDetail: (orgId: string, query?: { limit?: number; cursor?: string }) => request<AdminOrganizationWorkspace>(`/api/admin/orgs/${orgId}`, { query, skipOrg: true }),
    userDetail: (userId: string, query?: { limit?: number; cursor?: string }) => request<AdminUserWorkspace>(`/api/admin/users/${userId}`, { query, skipOrg: true }),
    subscriberDetail: (orgId: string, query?: { limit?: number; cursor?: string }) => request<AdminSubscriberWorkspace>(`/api/admin/subscribers/${orgId}`, { query, skipOrg: true }),
    supportDetail: (threadId: string, query?: { limit?: number; cursor?: string }) => request<AdminSupportWorkspace>(`/api/admin/support/${threadId}`, { query, skipOrg: true }),
    users: (q?: string) => request<{ items: Array<{ id: string; email: string; name: string | null; emailVerified: boolean; createdAt: string; orgs: Array<{ id: string; name: string; country: string; role: string }> }> }>('/api/admin/users', { query: q ? { q } : undefined, skipOrg: true }),
    resetPassword: (email: string, newPassword: string) => request<{ ok: true }>('/api/admin/users/reset-password', { method: 'POST', body: { email, newPassword }, skipOrg: true }),
    verifyEmail: (email: string) => request<{ ok: true }>('/api/admin/users/verify-email', { method: 'POST', body: { email }, skipOrg: true }),
    billingLedger: () => request<any>('/api/admin/billing-ledger', { skipOrg: true }),
    syncBillingLedger: () => request<any>('/api/admin/billing-ledger/sync', { method: 'POST', skipOrg: true }),
    orgSubscription: (orgId: string, data: { action: 'comp' | 'trial' | 'cancel' | 'lifetime'; months?: number; planId?: string }) => request<{ ok: true; status?: string; planName?: string; planTier?: string; lifetime?: boolean }>(`/api/admin/orgs/${orgId}/subscription`, { method: 'POST', body: data, skipOrg: true }),
    createUser: (data: { email: string; name?: string; password?: string }) => request<{ ok: true; user: { id: string; email: string; name: string | null }; generatedPassword?: string }>('/api/admin/users/create', { method: 'POST', body: data, skipOrg: true }),
    deleteUser: (userId: string, orgIds?: string[]) => request<{ ok: true; deleted: string; deletedOrgs?: string[]; graceDays?: number }>(`/api/admin/users/${userId}`, { method: 'DELETE', skipOrg: true, query: orgIds && orgIds.length ? { orgIds: orgIds.join(',') } : undefined }),
    userDeletePreview: (userId: string) => request<AdminUserDeletePreview>(`/api/admin/users/${userId}/delete-preview`, { skipOrg: true }),
    // Admin v3 R1.5
    manageSubscription: (orgId: string, body: { mode: AdminSubManageMode; planId?: string; months?: number; periodEnd?: string; note?: string | null; linkedToOrgId?: string | null }) => request<{ ok: true; subscription: any }>(`/api/admin/subscriptions/${orgId}`, { method: 'PATCH', body, skipOrg: true }),
    notes: (orgId: string) => request<{ items: AdminNoteRecord[] }>(`/api/admin/orgs/${orgId}/notes`, { skipOrg: true }),
    addNote: (orgId: string, body: string, pinned = false) => request<AdminNoteRecord>(`/api/admin/orgs/${orgId}/notes`, { method: 'POST', body: { body, pinned }, skipOrg: true }),
    updateNote: (noteId: string, patch: { body?: string; pinned?: boolean }) => request<AdminNoteRecord>(`/api/admin/notes/${noteId}`, { method: 'PATCH', body: patch, skipOrg: true }),
    deleteNote: (noteId: string) => request<{ ok: true }>(`/api/admin/notes/${noteId}`, { method: 'DELETE', skipOrg: true }),
    orgUsage: (orgId: string) => request<AdminOrgUsage>(`/api/admin/orgs/${orgId}/usage`, { skipOrg: true }),
    // Z2.2 · Admin Console CRUD
    me: () => request<AdminMe>('/api/admin/me', { skipOrg: true }),
    // Admin v3 R2 · team / roles / invites
    roles: () => request<{ catalogue: string[]; items: AdminRoleRecord[] }>('/api/admin/roles', { skipOrg: true }),
    createRole: (body: { key: string; nameAr: string; nameEn: string; permissions: string[]; scopeAssigned?: boolean }) => request<AdminRoleRecord>('/api/admin/roles', { method: 'POST', body, skipOrg: true }),
    updateRole: (id: string, body: { nameAr?: string; nameEn?: string; permissions?: string[]; scopeAssigned?: boolean }) => request<AdminRoleRecord>(`/api/admin/roles/${id}`, { method: 'PATCH', body, skipOrg: true }),
    deleteRole: (id: string) => request<{ ok: true }>(`/api/admin/roles/${id}`, { method: 'DELETE', skipOrg: true }),
    team: () => request<{ items: AdminTeamMember[]; invites: AdminTeamInvite[] }>('/api/admin/team', { skipOrg: true }),
    inviteTeam: (body: { email: string; roleId: string; language?: 'ar' | 'en' }) => request<{ ok: true; inviteId: string; link: string; emailSent: boolean; expiresAt: string }>('/api/admin/team/invite', { method: 'POST', body, skipOrg: true }),
    revokeInvite: (id: string) => request<{ ok: true }>(`/api/admin/team/invites/${id}`, { method: 'DELETE', skipOrg: true }),
    updateTeamMember: (userId: string, body: { roleId?: string; disabled?: boolean; assignedOrgIds?: string[] }) => request<{ ok: true }>(`/api/admin/team/${userId}`, { method: 'PATCH', body, skipOrg: true }),
    removeTeamMember: (userId: string) => request<{ ok: true }>(`/api/admin/team/${userId}`, { method: 'DELETE', skipOrg: true }),
    inviteInfo: (token: string) => request<{ email: string; role: { key: string; nameAr: string; nameEn: string }; invitedBy: string; expiresAt: string; accepted: boolean; expired: boolean }>(`/api/admin/invites/${token}`, { skipOrg: true }),
    acceptInvite: (token: string) => request<{ ok: true; role: { key: string; nameAr: string; nameEn: string } }>(`/api/admin/invites/${token}/accept`, { method: 'POST', body: {}, skipOrg: true }),
    // tickets (existing API · W37) — used by the company inbox
    tickets: (params?: { status?: string; orgId?: string }) => request<{ tickets: AdminTicketRow[] }>('/api/admin/tickets', { query: params, skipOrg: true }),
    ticket: (id: string) => request<{ ticket: AdminTicketDetail }>(`/api/admin/tickets/${id}`, { skipOrg: true }),
    createTicket: (body: { orgId?: string; subject: string; priority?: string; message?: string }) => request<AdminTicketRow>('/api/admin/tickets', { method: 'POST', body, skipOrg: true }),
    updateTicket: (id: string, body: { status?: string; priority?: string; assignedAgentEmail?: string | null }) => request<AdminTicketRow>(`/api/admin/tickets/${id}`, { method: 'PATCH', body, skipOrg: true }),
    replyTicket: (id: string, body: string) => request<{ ok: true }>(`/api/admin/tickets/${id}/messages`, { method: 'POST', body: { body }, skipOrg: true }),
    updateOrg: (orgId: string, data: { name?: string; legalName?: string | null; country?: string; baseCurrency?: string; industry?: string | null; suspended?: boolean; reason?: string | null }) =>
      request<AdminOrgRecord>(`/api/admin/orgs/${orgId}`, { method: 'PATCH', body: data, skipOrg: true }),
    deleteOrg: (orgId: string, reason: string) => request<{ ok: true; deletedAt: string; restoreUntil: string; graceDays: number }>(`/api/admin/orgs/${orgId}`, { method: 'DELETE', body: { reason }, skipOrg: true }),
    restoreOrg: (orgId: string) => request<{ ok: true; org: AdminOrgRecord }>(`/api/admin/orgs/${orgId}/restore`, { method: 'POST', skipOrg: true }),
    updateUser: (userId: string, data: { name?: string | null; email?: string; disabled?: boolean; reason?: string | null }) =>
      request<AdminUserRecord>(`/api/admin/users/${userId}`, { method: 'PATCH', body: data, skipOrg: true }),
    subscriptions: (params?: { status?: string; country?: string; q?: string }) => request<AdminSubscriptionsPayload>('/api/admin/subscriptions', { query: params, skipOrg: true }),
    plans: () => request<{ items: AdminPlanRecord[] }>('/api/admin/plans', { skipOrg: true }),
    updatePlan: (planId: string, data: { name?: string; nameAr?: string | null; description?: string | null; isActive?: boolean; tier?: string; reason?: string | null }) =>
      request<AdminPlanRecord>(`/api/admin/plans/${planId}`, { method: 'PATCH', body: data, skipOrg: true }),
    audit: (params?: { targetType?: string; targetId?: string; adminUserId?: string; from?: string; to?: string; limit?: number }) => request<{ items: AdminAuditRow[]; total: number }>('/api/admin/audit', { query: params, skipOrg: true }),
    impersonate: (orgId: string, reason: string) => request<{ orgId: string; orgName: string; country: string; baseCurrency: string; suspended: boolean; reason: string; expiresAt: string; minutes: number }>('/api/admin/impersonate', { method: 'POST', body: { orgId, reason }, skipOrg: true }),
    metrics: (days: 7 | 30 | 90 = 30) => request<AdminMetrics>('/api/admin/metrics', { query: { days }, skipOrg: true }),
    impersonateStop: (orgId: string) => request<{ ok: true }>('/api/admin/impersonate/stop', { method: 'POST', body: { orgId }, skipOrg: true }),
    orgMembers: (orgId: string) => request<{ items: Array<{ id: string; role: string; createdAt: string; user: { id: string; email: string; name: string | null; emailVerified: boolean } }> }>(`/api/admin/orgs/${orgId}/members`, { skipOrg: true }),
    addOrgMember: (orgId: string, data: { email: string; role: string }) => request<{ ok: true }>(`/api/admin/orgs/${orgId}/members`, { method: 'POST', body: data, skipOrg: true }),
    removeOrgMember: (orgId: string, userId: string) => request<{ ok: true }>(`/api/admin/orgs/${orgId}/members/${userId}`, { method: 'DELETE', skipOrg: true }),
    backupStatus: () => request<{ enabled: boolean; status: any }>('/api/admin/backups/status', { skipOrg: true }),
    runBackup: () => request<{ ok: boolean; fileName?: string; size?: number; error?: string; status: any }>('/api/admin/backups/run', { method: 'POST', skipOrg: true }),
    agentChat: (message: string, history: Array<{ role: string; content: string }>) => request<{ ok?: boolean; reply?: string; toolsUsed?: Array<{ name: string; args: any }>; error?: string; detail?: string }>('/api/admin/agent', { method: 'POST', body: { message, history }, skipOrg: true }),
    emailHealth: () => request<{ configured: boolean; from?: string | null; suppressions: Array<{ email: string; origin: string; since: string }>; recent: Array<{ to: string[]; subject: string; event: string; at: string | null }> }>('/api/admin/email-health', { skipOrg: true }),
    unsuppressEmail: (email: string) => request<{ ok: true; email: string }>('/api/admin/email-health/unsuppress', { method: 'POST', body: { email }, skipOrg: true }),
    supportThreads: () => request<{ items: Array<{ id: string; title: string; lastMessageAt: string; org: { id: string; name: string; country: string }; user: { email: string; name: string | null }; messageCount: number; lastMessage: { role: string; content: string; createdAt: string; metadata: any } | null }> }>('/api/admin/support/threads', { skipOrg: true }),
    supportThread: (id: string) => request<{ id: string; title: string; org: { id: string; name: string }; user: { email: string }; messages: Array<{ id: string; role: string; content: string; createdAt: string; metadata: any }> }>(`/api/admin/support/threads/${id}`, { skipOrg: true }),
    supportReply: (id: string, message: string) => request<{ ok: true }>(`/api/admin/support/threads/${id}/reply`, { method: 'POST', body: { message }, skipOrg: true }),
  },

  // OAuth · payment provider connections (UX-137)
  oauth: {
    /** Returns the URL to navigate the merchant to for Stripe/PayPal Connect. */
    startUrl: (provider: 'stripe' | 'paypal', orgId: string) =>
      `${API_BASE}/api/oauth/${provider}/start?orgId=${encodeURIComponent(orgId)}`,
    /** Pull connection state for status badges in PaymentsTab */
    status: (orgId: string) =>
      request<{
        stripe: { configured: boolean; connectConfigured?: boolean; serverConfigured?: boolean; connected: boolean; accountId: string | null; mode: string | null; connectedAt: string | null; source?: string | null }
        paypal: { configured: boolean; connectConfigured?: boolean; serverConfigured?: boolean; connected: boolean; merchantId: string | null; mode: string | null; connectedAt: string | null; source?: string | null }
        moyasar: { configured: boolean; connected: boolean }
      }>('/api/oauth/status', { query: { orgId } }),
    /** Tell Stripe we no longer act on this account · clears stored tokens */
    disconnectStripe: (orgId: string) =>
      request<{ ok: true; disconnected: string | null }>('/api/oauth/stripe/disconnect', {
        method: 'POST',
        body: { orgId },
      }),
  },

  // Plaid · US bank linking (link-token → Plaid Link → exchange)
  plaid: {
    linkToken: () =>
      request<{ link_token?: string; linkToken?: string }>('/api/plaid/link-token'),
    exchange: (data: { publicToken: string; institutionId?: string; institutionName?: string }) =>
      request<{ ok: boolean; itemId: string; accountsCount: number; bankAccounts: string[]; institution: { name?: string } | null; message?: string }>(
        '/api/plaid/exchange', { method: 'POST', body: data },
      ),
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface User {
  id: string
  email: string
  name?: string | null
  locale: string
}

export interface AgentConversation {
  id: string
  title: string
  status: 'ACTIVE' | 'ARCHIVED'
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  messageCount?: number
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolResults?: Array<{ tool: string; args: any; result: any }> | null
  metadata?: any
  createdAt: string
}

export interface AgentChatResponse {
  message: string
  toolResults: Array<{ tool: string; args: any; result: any }>
  model?: string
  source?: string
  conversationId?: string
  conversation?: AgentConversation
}

export interface MeResponse extends User {
  memberships: Array<{
    id: string
    role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER'
    org: { id: string; slug: string; name: string; baseCurrency: string; country: string; demoExpiresAt?: string | null }
  }>
}

export interface Branch {
  id: string;
  orgId: string;
  name: string;
  nameAr?: string | null;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  vatBranchNo?: string | null;
  warehouseId?: string | null;
  isHQ: boolean;
  isActive: boolean;
  createdAt: string;
}
export interface BranchInput {
  name: string;
  nameAr?: string | null;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  vatBranchNo?: string | null;
  warehouseId?: string | null;
  isHQ?: boolean;
}

export interface OrgSubscriptionSummary {
  id: string
  status: string // TRIALING · ACTIVE · PAST_DUE · CANCELED · EXPIRED
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  plan?: { name: string; tier?: string | null } | null
  lifetime?: boolean // ACTIVE with no period/trial end — granted without expiry
}
export interface Org {
  role?: "OWNER" | "ADMIN" | "ACCOUNTANT" | "VIEWER";
  id: string
  slug: string
  createdAt?: string
  deletedAt?: string | null
  subscription?: OrgSubscriptionSummary | null
  inboundEmailLocal?: string | null // custom inbound alias · default bills+<slug>@in.entix.io
  name: string
  legalName?: string | null
  /** Legal form: 'JSC' (joint-stock → shareholders register) · anything else → owners registry */
  legalType?: string | null
  country: string
  baseCurrency: string
  fiscalYearStart: number
  fiscalYearEnd?: number | null
  vatNumber?: string | null
  crNumber?: string | null
  zatcaEnabled: boolean
  zatcaMode?: string | null
  zatcaCsid?: string | null
  zatcaCsidSecret?: string | null
  logoUrl?: string | null
  printLogoUrl?: string | null
  /** reverse (light) mark for dark document grounds · LOGO FRAME LAW */
  printLogoLightUrl?: string | null
  defaultInvoiceLanguage?: 'ar' | 'en' | null
  stampUrl?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  addressLine?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  district?: string | null
  buildingNumber?: string | null
  streetName?: string | null
  suiteUnit?: string | null
  state?: string | null
  industry?: string | null
  demoExpiresAt?: string | null
  taxRegistrationDate?: string | null
  firstVatPeriodStart?: string | null
  vatPeriod?: 'monthly' | 'quarterly' | null
  paymentSettings?: any
  numberingSettings?: any
}

export type ApiKeyScope = 'read' | 'write:accounts' | 'write:cost_centers' | 'write:products'
export interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  scopes: ApiKeyScope[]
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
  createdById: string
  status: 'active' | 'revoked' | 'expired'
}

export interface AuditLogItem {
  id: string
  orgId: string
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  severity: string
  metadata?: any
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface CreateOrgInput {
  name: string
  legalName?: string
  country?: string
  baseCurrency?: string
  fiscalYearStart?: number
  fiscalYearEnd?: number
  vatNumber?: string
  crNumber?: string
  logoUrl?: string
  printLogoUrl?: string
  printLogoLightUrl?: string | null
  defaultInvoiceLanguage?: 'ar' | 'en'
  stampUrl?: string
  email?: string
  phone?: string
  website?: string
  addressLine?: string
  city?: string
  region?: string
  postalCode?: string
  district?: string
  buildingNumber?: string
  streetName?: string
  suiteUnit?: string
  state?: string
  industry?: string
  /** N6 · chart of accounts at creation: industry (default) · simple · blank */
  coaMode?: 'industry' | 'simple' | 'blank'
  taxRegistrationDate?: string
  firstVatPeriodStart?: string
  vatPeriod?: string
}

export interface ReportColumn {
  key: string
  label: string
  align?: 'start' | 'end' | 'center'
  kind?: 'text' | 'money' | 'number' | 'date' | 'status'
}

export interface ReportRow {
  id: string
  label: string
  values: Record<string, string | number | null>
  note?: string | null
  status?: string | null
  link?: { label: string; href: string; type: string } | null
  /** Tree depth within its section (0 = section root) — up to 5 levels render indented (Wave-style hierarchy) */
  depth?: number
}

export interface ReportSection {
  id: string
  title: string
  description?: string | null
  columns: ReportColumn[]
  rows: ReportRow[]
}

export interface ReportPayload {
  id: string
  title: string
  englishTitle: string
  description: string
  category: string
  status: 'live' | 'empty'
  generatedAt: string
  period: { from: string; to: string }
  /** Prior-period window when ?compareTo= was passed (Apple-style compare) */
  comparePeriod?: { from: string; to: string } | null
  currency: string
  org: Org
  summary: Record<string, number>
  sections: ReportSection[]
  notices?: string[]
}

export interface LedgerRoleRow {
  role: 'cash' | 'bank' | 'ar' | 'inventory' | 'ap' | 'vat' | 'salesRevenue' | 'serviceRevenue' | 'cogs' | 'expenseFallback'
  ar: string
  en: string
  type: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE'
  explicit: string | null
  resolved: { id: string; code: string; name: string } | null
  via: 'explicit' | 'legacy_code' | 'heuristic' | 'none'
}
export interface StockCountLine {
  id: string
  productId: string
  product: { id: string; sku: string | null; name: string; nameAr: string | null; category: string | null; imageUrl: string | null } | null
  systemQty: number
  countedQty: number | null
  variance: number | null
  unitCost: number
  varianceValue: number | null
  reason: string | null
  countedAt: string | null
}
export interface StockCountSummary {
  id: string
  number: string
  status: 'COUNTING' | 'REVIEW' | 'POSTED' | 'CANCELLED'
  scope: string
  category: string | null
  blind: boolean
  snapshotAt: string
  postedAt: string | null
  notes: string | null
  createdAt: string
  warehouse: { id: string; code: string; name: string }
  lineCount?: number
}
export interface StockCount extends StockCountSummary {
  lines: StockCountLine[]
  summary: { lines: number; counted: number; variances: number; shortageValue: number; surplusValue: number }
  /** B4.2 · GL entry mirroring the posted variances (null until posted / when the company has no inventory account) */
  journal?: { id: string; entryNumber: string } | null
}
export interface StockTransferLine { id: string; productId: string; qty: number; unitCost: number; receivedQty: number | null; reason: string | null; value: number; shortfall: number | null; product: { id: string; sku: string | null; name: string; nameAr: string | null; imageUrl?: string | null } | null }
export interface StockTransferSummary { id: string; number: string; status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED'; notes: string | null; createdAt: string; sentAt: string | null; receivedAt: string | null; fromWarehouse: { id: string; code: string; name: string }; toWarehouse: { id: string; code: string; name: string }; lines: number; qty: number; value: number }
export interface StockTransfer extends Omit<StockTransferSummary, 'lines'> {
  fromWarehouseId: string; toWarehouseId: string; fromBranchId: string | null; toBranchId: string | null
  fromBranch: { id: string; name: string; nameAr: string | null; code: string | null } | null; toBranch: { id: string; name: string; nameAr: string | null; code: string | null } | null
  receivedByName: string | null; cancelledAt: string | null
  lines: StockTransferLine[]
  summary: { lines: number; qty: number; value: number; receivedQty: number; shortfallValue: number }
  journal: { id: string; entryNumber: string } | null
}
export interface StockTransferInput { fromWarehouseId: string; toWarehouseId: string; fromBranchId?: string | null; toBranchId?: string | null; notes?: string | null; lines: Array<{ productId: string; qty: number; reason?: string | null }>; send?: boolean }
export interface PosCashierRow { id: string; name: string; hasPin: boolean; isActive: boolean; createdAt?: string }
export interface ProductBarcode { id: string; productId: string; barcode: string; unitMultiplier: string | number; label?: string | null; createdAt: string }
export interface ReorderAlert { product: { id: string; sku: string | null; name: string; nameAr: string | null; category: string | null; imageUrl?: string | null }; onHand: number; reorderQty: number; shortBy: number; unitCost: number; suggestedQty: number }

export interface ReportPrintSettings {
  logoSource?: 'print' | 'main' | 'none'
  paper?: 'A4' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  language?: 'ar' | 'en'
  fontScale?: 'compact' | 'normal' | 'large'
  density?: 'comfortable' | 'standard' | 'compact'
  primaryColor?: string
  accentColor?: string
  showCompanyInfo?: boolean
  showTaxInfo?: boolean
  showFooter?: boolean
  showPreparedBy?: boolean
  /** Note columns («ملاحظة») are off by default — the print designer opts in. */
  showNotes?: boolean
  /** Print template · 'condensed' = professional bilingual sheet with a page-pinned footer (default since 2026-08-26) · 'classic' = legacy layout */
  template?: 'condensed' | 'classic'
  /** Condensed only · render «العربية · English» label pairs (needs the API's bilingual mode) */
  bilingual?: boolean
  /** Free text printed above the copyright line in the pinned footer (disclaimer, basis of preparation…) */
  footerNote?: string
  /** Optional «Prepared by» line */
  preparedBy?: string
}

export interface Contact {
  id: string
  orgId: string
  customCode?: string | null
  shortCode?: string | null
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  // Multi-role flags (UX-46)
  isCustomer?: boolean
  isSupplier?: boolean
  isEmployee?: boolean
  isShareholder?: boolean
  isFreelancer?: boolean
  // Entity classification (UX-47)
  entityKind?: 'INDIVIDUAL' | 'COMPANY'
  displayName: string
  legalName?: string | null
  email?: string | null
  phone?: string | null
  // Tax IDs
  taxId?: string | null
  vatNumber?: string | null
  crNumber?: string | null
  nationalId?: string | null
  leiCode?: string | null
  // Customer logo (data-URL or https URL) · shown on contact page & documents
  avatarUrl?: string | null
  // Foreign / withholding
  isForeign?: boolean
  withholdingTaxRate?: number | null
  defaultCurrency?: string | null
  // Address
  buildingNumber?: string | null
  district?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  country: string
  postalCode?: string | null
  // CRM-light
  tags?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface JournalEntryLine {
  id?: string
  accountId: string
  accountCode?: string
  accountName?: string
  accountType?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  debit: number
  credit: number
  description?: string | null
}

export interface ExpenseAttachment {
  id: string
  expenseId: string
  filename: string
  contentType: string
  sizeBytes: number
  url: string // data: URL (base64) · consistent with voucher attachments
  createdAt: string
}

export interface JournalAttachment {
  id: string
  filename: string
  contentType: string
  sizeBytes: number
  url: string
  createdAt: string
}

export interface JournalEntryRow {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  id: string
  number: string
  date: string
  description: string
  reference: string | null
  status: 'POSTED' | 'DRAFT'
  source: string | null
  postedAt?: string | null
  totalDebit: number
  totalCredit: number
  lineCount: number
  attachmentCount?: number
  lines: JournalEntryLine[]
  attachments?: JournalAttachment[]
}

export interface JournalEntryInput {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  date: string
  description: string
  reference?: string | null
  postOnSave?: boolean
  lines: Array<{
    accountId: string
    debit?: number
    credit?: number
    description?: string | null
  }>
}

export interface InboxMessageRow {
  id: string
  from: string
  subject: string
  status: 'RECEIVED' | 'EXTRACTED' | 'APPROVED' | 'REJECTED' | 'ERROR'
  attachmentCount: number
  extractedKind: string | null
  extractedTotal: number | null
  extractedCurrency: string | null
  createdAt: string
  processedAt: string | null
  billId: string | null
}

export interface InboxMessageDetail extends InboxMessageRow {
  fromAddress: string
  toAddress: string
  bodyText: string
  bodyHtml: string
  messageId: string | null
  extractedJson: any
  attachments: Array<{
    id: string
    filename: string
    contentType: string
    sizeBytes: number
  }>
}

export interface ContactSummary {
  contact: Contact
  totals: {
    invoices: { count: number; total: number; paid: number; outstanding: number }
    bills: { count: number; total: number; paid: number; outstanding: number }
    quotes: { count: number; total: number }
    receipts: { count: number; total: number }
    payments: { count: number; total: number }
    arOpen: number
    apOpen: number
    balance: number
  }
  invoices: Array<{ id: string; invoiceNumber: string; issueDate: string; dueDate: string | null; total: string; amountPaid: string; status: string; currency: string }>
  bills: Array<{ id: string; billNumber: string; issueDate: string; dueDate: string | null; total: string; amountPaid: string; status: string; currency: string }>
  quotes: Array<{ id: string; quoteNumber: string; issueDate: string; validUntil: string | null; total: string; status: string; currency: string }>
  vouchers: Array<{ id: string; number: string; type: string; date: string; amount: string; currency: string; paymentMethod: string | null; reference: string | null; notes: string | null }>
  expenses: Array<{ id: string; date: string; total: string; category: string | null; description: string | null; currency: string }>
}

export interface ContactInput {
  customCode?: string | null
  shortCode?: string | null
  type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  isCustomer?: boolean
  isSupplier?: boolean
  isEmployee?: boolean
  isShareholder?: boolean
  isFreelancer?: boolean
  entityKind?: 'INDIVIDUAL' | 'COMPANY'
  displayName: string
  legalName?: string | null
  email?: string | null
  phone?: string | null
  taxId?: string | null
  vatNumber?: string | null
  crNumber?: string | null
  nationalId?: string | null
  leiCode?: string | null
  isForeign?: boolean
  withholdingTaxRate?: number | null
  defaultCurrency?: string | null
  buildingNumber?: string | null
  district?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  country?: string
  postalCode?: string | null
  tags?: string | null
  notes?: string | null
  avatarUrl?: string | null
}

export type NumberingKind = 'contact' | 'invoice' | 'quote' | 'bill' | 'receipt' | 'payment' | 'estimate' | 'project'
export interface NumberingPerKind {
  prefix?: string
  padding?: number
  start?: number
  /** PL2 · full-control pattern, e.g. "{clientCode}-{prefix}{YYYY}-{seq}" */
  pattern?: string
  /** PL2 · «أدرج رمز العميل» → EDG-PRJ-0007 */
  includeClientCode?: boolean
  includeYear?: boolean
  includeMonth?: boolean
}
export type NumberingSettings = Partial<Record<NumberingKind, NumberingPerKind>> & { entityCode?: string }

/** PL1 · a document a project is linked to (quote · estimate · invoice · bill). */
export type ProjectLinkKind = 'QUOTE' | 'ESTIMATE' | 'INVOICE' | 'BILL'
export interface LinkedDocument {
  id: string
  number: string
  date: string | null
  total: string
  status: string
  currency: string
  contactId: string | null
  title?: string | null
}
/** SPEC-05 L3 · cost-only budget · deliberately has no sale/margin field. */
export interface ProjectBudgetLine {
  id: string
  sortOrder: number
  itemNo?: string | null
  section?: string | null
  description: string
  unit?: string | null
  quantity: string
  unitCost: string
  plannedCost: string
  durationDays?: number | null
  estimateLineId?: string | null
}
export interface ProjectBudget {
  id: string
  projectId: string
  estimateId?: string | null
  status: 'DRAFT' | 'APPROVED'
  costTotal: string
  approvedAt?: string | null
  notes?: string | null
  lines: ProjectBudgetLine[]
}
/** The org's VAT catalogue · the line grid picks its `taxRateId` from here. */
export interface TaxRate {
  id: string
  name: string
  nameAr?: string | null
  /** Stored as a FRACTION · 0.15 = 15% */
  rate: string
  type: 'STANDARD' | 'ZERO_RATED' | 'EXEMPT'
  isDefault: boolean
  isInclusive: boolean
  isActive: boolean
}

/** SPEC-05 §5 · a project task · cost + time only, never a sale price. */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
export type TaskHealth = 'GREEN' | 'AMBER' | 'RED'
export interface ProjectTask {
  id: string
  projectId: string
  itemNo?: string | null
  section?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  sortOrder: number
  plannedCost: string
  plannedDays?: number | null
  startDate?: string | null
  dueDate?: string | null
  progressPct: string
  assigneeContactId?: string | null
  assigneeContact?: { id: string; displayName: string } | null
  /** Derived · summed from the expenses / bill lines / POs tagged with the task. */
  actualCost: number
  remainingCost: number
  health: TaskHealth
  costRatio: number | null
  overBudget: boolean
  overdue: boolean
  daysRemaining: number | null
}
export interface ProjectTaskSummary {
  count: number
  plannedCost: number
  actualCost: number
  remainingCost: number
  progressPct: number
  byHealth: Record<TaskHealth, number>
}
export interface ProjectTaskList {
  items: ProjectTask[]
  total: number
  summary: ProjectTaskSummary
  /** true when the caller's role is not allowed to see sale/margin figures. */
  confidentialHidden?: boolean
  created?: number
}

/** AI project intake · the PREVIEW · nothing is written until commit. */
export interface ProjectIntakeTask {
  itemNo: string | null
  title: string
  unit: string | null
  quantity: number | null
  plannedCost: number | null
  plannedCostSource: 'cost-column' | 'line-amount' | null
  plannedDays: number | null
  sourceRow: number | null
}
export interface ProjectIntakePreview {
  source: { fileName: string | null; mimeType: string; fileHash: string; engine: 'spreadsheet' | 'ai'; sheet?: string | null }
  project: { name: string | null; code: string | null; documentNumber: string | null; startDate: string | null; endDate: string | null; contractValue: number | null; currency: string }
  client: { name: string | null; taxId: string | null; matchedContactId: string | null; matchedBy: 'vat' | 'name' | null; isNew: boolean }
  tasks: ProjectIntakeTask[]
  budget: { costTotal: number | null; lineCount: number }
  /** Keys the FILE did not contain · rendered as «غير موجود في الملف». */
  missing: string[]
  warnings: string[]
  confidence: number | null
}

export interface PurchaseOrderLine {
  id: string
  description: string
  unit?: string | null
  quantity: string
  unitCost: string
  lineTotal: string
  budgetLineId?: string | null
}
export interface PurchaseOrder {
  id: string
  number: string
  projectId?: string | null
  supplierId?: string | null
  status: 'DRAFT' | 'ISSUED' | 'RECEIVED' | 'CANCELLED'
  currency: string
  issueDate: string
  total: string
  lines: PurchaseOrderLine[]
}

export interface ProjectLink {
  id: string
  kind: ProjectLinkKind
  documentId: string
  createdAt?: string
  document: LinkedDocument | null
}

export interface AccountTransactions {
  account: { id: string; code: string; name: string; nameAr: string | null; type: string }
  transactions: Array<{
    id: string
    journalNumber: string
    date: string
    description: string
    lineDescription: string | null
    source: string | null
    reference: string | null
    debit: number
    credit: number
    runningBalance: number
  }>
  total: number
  finalBalance: number
}

export interface Account {
  id: string
  orgId: string
  code: string
  name: string
  nameAr?: string | null
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  subtype?: string | null
  parentId?: string | null
  description?: string | null
  balance?: number          // sum of journal lines (signed for normal balance)
  cashFlowType?: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH' | null
  allowPosting?: boolean
  allowPayment?: boolean
  allowExpenseClaim?: boolean
  isSystemAccount?: boolean
  isActive: boolean
}

export interface AccountInput {
  code: string
  name: string
  nameAr?: string | null
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  subtype?: string | null
  parentId?: string | null
  description?: string | null
  cashFlowType?: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH' | null
  allowPosting?: boolean
  allowPayment?: boolean
  allowExpenseClaim?: boolean
}

export interface Expense {
  externalId?: string | null
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  id: string
  orgId: string
  contactId?: string | null
  number: string
  date: string
  category: string
  description?: string | null
  amount: string
  subtotal?: string
  currency: string
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'STC_PAY' | 'MADA' | 'CHECK' | 'OTHER'
  vendorName?: string | null
  documentNumber?: string | null
  reference?: string | null
  taxRateId?: string | null
  taxAmount: string
  total: string
  receiptUrl?: string | null
  attachmentName?: string | null
  attachmentType?: string | null
  attachmentSizeBytes?: number | null
  attachmentBase64?: string | null
  attachmentCount?: number
  /** Auto-register a fixed asset from this expense (server links it back) */
  registerAsAsset?: boolean
  assetAccountId?: string | null
  lineItems?: ExpenseLine[] | null
  paymentSplits?: ExpensePaymentSplit[] | null
  extractedJson?: any
  ocrConfidence?: string | null
  duplicateOfId?: string | null
  duplicateReason?: string | null
  notes?: string | null
  status?: 'DRAFT' | 'APPROVED' | 'PAID'
  accountId?: string | null
  createdAt: string
  contact?: { id: string; displayName: string; taxId?: string | null; vatNumber?: string | null; isSupplier?: boolean } | null
  taxRate?: { id?: string; name: string; rate: string } | null
  duplicateExpense?: { id: string; number: string; total: string; date: string; vendorName?: string | null; reason: string } | null
}

export interface ExpenseLine {
  accountId?: string | null
  /** Client-only: the account was filled by the suggestion engine (stripped before save) */
  accountSuggested?: boolean
  description: string
  quantity?: number
  unitPrice?: number
  discountAmount?: number | null
  taxRate?: number | null
  taxInclusive?: boolean | null
  lineTotal?: number | null
  subtotal?: number | null
  category?: string | null
  accountName?: string | null
  costCenter?: string | null
  projectCode?: string | null
  sku?: string | null
  sourceCurrency?: string | null
  notes?: string | null
}

export interface ExpensePaymentSplit {
  method: Expense['paymentMethod']
  amount: number
  currency?: string | null
  exchangeRate?: number | null
  baseAmount?: number | null
  fxDifference?: number | null
  fxTreatment?: string | null
  reference?: string | null
  cardLast4?: string | null
  accountName?: string | null
  notes?: string | null
}

export interface AccountSuggestInput {
  kind: 'sales' | 'purchase' | 'expense' | 'product-income' | 'product-expense'
  text?: string | null
  productId?: string | null
  contactId?: string | null
  category?: string | null
  currency?: string | null
  productType?: string | null
}
export interface AccountSuggestResult {
  accountId: string | null
  code: string | null
  name: string | null
  nameAr?: string | null
  type?: string | null
  via: 'product' | 'history' | 'keyword' | 'category' | 'mapping' | 'first' | 'none'
  confidence: number
}

export interface ExpenseInput {
  /** DRAFT saves freely · APPROVED/PAID (default) need an account on every line or a header account */
  status?: 'DRAFT' | 'APPROVED' | 'PAID'
  /** Header-level expense account · fallback for lines without their own accountId */
  accountId?: string | null
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  number?: string
  date: string
  category: string
  description?: string | null
  amount: number
  subtotal?: number
  totalAmount?: number
  currency?: string
  paymentMethod: Expense['paymentMethod']
  contactId?: string | null
  vendorName?: string | null
  supplierTaxId?: string | null
  documentNumber?: string | null
  reference?: string | null
  taxRateId?: string | null
  taxAmount?: number
  receiptUrl?: string | null
  attachmentName?: string | null
  attachmentType?: string | null
  attachmentSizeBytes?: number | null
  attachmentBase64?: string | null
  attachmentCount?: number
  /** Auto-register a fixed asset from this expense (server links it back) */
  registerAsAsset?: boolean
  assetAccountId?: string | null
  lineItems?: ExpenseLine[] | null
  paymentSplits?: ExpensePaymentSplit[] | null
  extractedJson?: any
  ocrConfidence?: number | null
  autoCreateSupplier?: boolean
  notes?: string | null
  /** ingestion-integrity: full multi-file set (preferred over the single inline attachment fields) */
  attachments?: Array<{ name: string; contentType?: string | null; base64: string; sizeBytes?: number | null }>
  /** sha256 of the source file from the extraction response · drives idempotency/dedupe */
  sourceFileHash?: string | null
  /** explicit escape hatch for the "create anyway" manual flow */
  allowDuplicate?: boolean
  /** signed duplicate decision after a SIMILARITY_REVIEW_REQUIRED outcome */
  duplicateDecision?: DuplicateDecision
}

/** Ingestion contract block returned on bill/expense create paths (PR1 backend) */
export interface IngestionMeta {
  dedupeDecision: 'CREATED' | 'UPDATED' | 'SKIPPED_DUPLICATE'
  supplierResolvedTo: { id: string; displayName: string } | null
  attachmentStatus: { attached: number; names: string[] }
  linkedRecordId: string
  confidence: number
  reason: string
  fingerprint?: string
  version?: number
  /** when set, nothing was written — the user must choose a duplicate action */
  outcome?: 'SIMILARITY_REVIEW_REQUIRED'
  similarityReview?: SimilarityReview
  duplicateOf?: { id: string; number?: string; billNumber?: string } | null
  idempotency?: { replay: boolean }
  legacyAllowDuplicate?: boolean
}

export interface SalesDashboard {
  org: { name: string; baseCurrency: string }
  thisMonth: { total: number; paid: number; count: number }
  ytd: { total: number; paid: number; count: number }
  allTime: { total: number; paid: number; count: number; outstanding: number }
  byStatus: Array<{ status: string; count: number; total: number }>
  recentInvoices: Array<{ id: string; number: string; contact: string; status: string; total: number; paid: number; date: string }>
  topCustomers: Array<{ contactId: string; name: string; total: number }>
}

export interface PurchasesDashboard {
  org: { name: string; baseCurrency: string }
  thisMonth: { bills: number; billCount: number }
  ytd: { bills: number; billCount: number; expenses: number; expenseCount: number; total: number }
  expensesByCategory: Array<{ category: string; total: number }>
  topSuppliers: Array<{ contactId: string; name: string; total: number }>
  recentBills: Array<{ id: string; number: string; contact: string; status: string; total: number; date: string }>
}

export interface BankAccount {
  id: string
  orgId: string
  name: string
  bankName?: string | null
  country?: string | null     // SA · US · AE · ...
  accountNumber?: string | null
  iban?: string | null         // KSA · EU · UK
  swiftCode?: string | null    // KSA · international wires
  routingNumber?: string | null // US ABA routing (9 digits)
  currency: string
  balance: string
  isActive: boolean
}

export interface BankAccountInput {
  name: string
  bankName?: string | null
  country?: string | null
  accountNumber?: string | null
  iban?: string | null
  swiftCode?: string | null
  routingNumber?: string | null
  currency?: string
  balance?: number
}

export interface DashboardSummary {
  org: { id: string; name: string; baseCurrency: string; country: string }
  kpi: {
    revenue: number
    purchases: number
    expenses: number
    receipts: number
    payments: number
    vatOutput: number
    vatInput: number
    vatNet: number
    invoiceCount: number
    overdueCount: number
    contactCount: number
    accountsReceivable: number
    accountsPayable: number
    cashOnHand: number
    revenueFromInvoices?: number
    revenueFromJournal?: number
    expensesFromBills?: number
    expensesFromJournal?: number
  }
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number }>
  yearlyTrend?: Array<{ year: number; revenue: number; expenses: number; net: number }>
  cashFlowTrend: Array<{ month: string; in: number; out: number; net: number }>
  profitLoss: Array<{ month: string; revenue: number; expenses: number; net: number }>
  expenseBreakdown: Array<{ category: string; total: number }>
  incomeBreakdown: Array<{ category: string; code: string; total: number }>
  overdueInvoices: Array<{
    id: string
    number: string
    contact: string
    total: number
    remaining: number
    dueDate: string | null
    daysOverdue: number
  }>
  bankAccounts: Array<{
    id: string
    name: string
    bankName: string | null
    accountNumber: string | null
    currency: string
    balance: number
  }>
  periodCompare: {
    thisMonth: { revenue: number; expenses: number; net: number }
    lastMonth: { revenue: number; expenses: number; net: number }
    yearAgo?: { revenue: number; expenses: number; net: number }
  }
}

export interface TaxReturnWithholdingRow {
  voucherId: string
  number: string
  date: string
  reference: string
  beneficiary: string
  contactId: string | null
  transferType: 'SERVICE' | 'ROYALTY' | 'INTEREST' | 'OTHER'
  rate: number
  baseAmount: number
  withholdingAmount: number
  currency: string
  paymentMethod: string
  hasOverride: boolean
}


export interface UsSalesTaxPayload {
  type: 'us-sales-tax'
  org: { name: string; legalName: string | null; state: string | null; ein: string | null; usFilingClass: string | null }
  period: { from: string; to: string }
  currency: string
  sales: {
    grossSales: number; taxCollected: number; exemptSales: number; taxableSales: number
    byState: Array<{ state: string; base: number; tax: number }>
    byRate: Array<{ rate: number; base: number; tax: number }>
  }
  irsGuide: { form: string; title: string; titleAr: string; notes: string[] } | null
  hint: string | null
  formPreview?: {
    type: 'us-tax-package'
    jurisdiction: 'US'
    period: { from: string; to: string; label: string }
    identity: {
      companyName: string
      legalName: string | null
      state: string | null
      ein: string | null
      filingClass: string | null
    }
    summary: {
      grossSales: number
      taxableSales: number
      exemptSales: number
      taxCollected: number
    }
    filing: { form: string; title: string; titleAr: string; notes: string[] } | null
    schedules: {
      byState: Array<{ state: string; base: number; tax: number }>
      byRate: Array<{ rate: number; base: number; tax: number }>
    }
    print: { title: string; subtitle: string }
  }
}
export interface VatSummaryPayload {
  type: 'vat-summary'
  org: { name: string; country: string; vatNumber: string | null; vatPeriod: string | null }
  period: { from: string; to: string }
  currency: string
  standardRate: number | null
  sales: { standardBase: number; standardVat: number; zeroBase: number; exportsBase: number; exemptBase: number; nonTaxBase: number }
  purchases: { standardBase: number; standardVat: number; zeroExemptBase: number }
  net: { due: number }
  formPreview?: {
    type: 'vat-return-preview'
    jurisdiction: string
    period: { from: string; to: string; label: string }
    identity: {
      companyName: string
      country: string
      vatNumber: string | null
      vatPeriod: string | null
    }
    sales: { standardBase: number; standardVat: number; zeroBase: number; exportsBase: number; exemptBase: number; nonTaxBase: number }
    purchases: { standardBase: number; standardVat: number; zeroExemptBase: number }
    net: { due: number; direction: 'payable' | 'refundable' }
    print: { title: string; subtitle: string }
  }
}

export interface TaxReturnPayload {
  org: {
    id: string
    name: string
    legalName?: string | null
    country: string
    baseCurrency: string
    vatNumber?: string | null
    vatPeriod?: 'monthly' | 'quarterly' | null
  }
  period: { from: string; to: string }
  vatDeclaration: {
    sales: {
      standardRated: { base: number; vat: number }
      citizens: { base: number; vat: number }
      zeroDomestic: { base: number; vat: number }
      exports: { base: number; vat: number }
      zeroRated: { base: number; vat: number }
      exempt: { base: number; vat: number }
      nonTaxable: { base: number; vat: number }
      totalBase: number
      totalVat: number
    }
    purchases: {
      deductible: { base: number; vat: number }
      importCustoms: { base: number; vat: number }
      importRcm: { base: number; vat: number }
      zeroExempt: { base: number; vat: number }
      zeroRated: { base: number; vat: number }
      exempt: { base: number; vat: number }
      imports: { base: number; vat: number }
      totalBase: number
      totalVat: number
    }
    netVat: number
    payable: number
    refundable: number
  }
  breakdown: {
    grossRevenue: number
    taxAmount: number
    totalRevenueIncludingTax: number
    nonTaxRevenue: number
    expensesTotal: number
    expensesTax: number
  }
  withholding: {
    totalBase: number
    totalWithholding: number
    rows: TaxReturnWithholdingRow[]
  }
  /** Draft documents inside the period — review list only, never counted in the ZATCA buckets. */
  drafts?: {
    count: number
    invoices: Array<{ id: string; invoiceNumber: string; issueDate: string; total: number; taxTotal: number; contactName: string | null }>
    bills: Array<{ id: string; billNumber: string; issueDate: string; total: number; taxTotal: number; contactName: string | null }>
  }
}

export interface InsightsReviewQueuePayload {
  summary: { total: number; critical: number; warning: number; info: number }
  items: Array<{
    id: string
    kind: 'missing_document' | 'duplicate_risk' | 'overdue_invoice' | 'cash_pressure' | 'tax_readiness'
    title: string
    detail: string
    severity: 'info' | 'warning' | 'critical'
    confidence: number
    actionLabel: string
    href: string
    source: 'rule-engine'
    entityId?: string
  }>
}

export interface InsightsCashForecastPayload {
  summary: {
    currency: string
    cashOnHand: number
    forecastEndCash: number
    overdueInvoiceCount: number
    upcomingBillCount: number
  }
  points: Array<{ month: string; expectedIn: number; expectedOut: number; net: number }>
  overdueInvoices: Array<{ id: string; number: string; customer: string; dueDate: string; remaining: number; currency: string }>
  upcomingBills: Array<{ id: string; number: string; supplier: string; dueDate: string; remaining: number; currency: string }>
}

export interface InsightsComplianceTimelinePayload {
  jurisdiction: string
  window: { from: string; to: string }
  summary: { ready: number; attention: number; blocked: number }
  items: Array<{
    id: string
    label: string
    status: 'ready' | 'attention' | 'blocked'
    detail: string
    href: string
  }>
}

export interface OcrResult {
  docType?: 'RECEIPT' | 'INVOICE' | 'BILL' | 'QUOTE' | 'CONTRACT' | 'STATEMENT' | 'OTHER'
  status?: 'needs_bank_statement_review' | string
  documentType?: 'bank_statement' | string
  message?: string
  vendor: string | null
  vendorVat: string | null
  buyer: string | null
  documentNumber: string | null
  issueDate: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number | null
  taxRate: number | null
  taxAmount: number | null
  discount: number | null
  total: number
  paymentMethod: string | null
  payments?: Array<{ method?: string | null; amount?: number | null; reference?: string | null; cardLast4?: string | null }>
  category: string | null
  tags?: string[]
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number | null; subtotal: number }>
  summary?: string
  confidence: number
  language: 'ar' | 'en' | 'mixed'
  warnings: string[]
}

export interface Quote {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  id: string
  orgId: string
  contactId: string
  quoteNumber: string
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED'
  issueDate: string
  validUntil: string
  currency: string
  subtotal: string
  taxTotal: string
  discountTotal: string
  total: string
  notes?: string | null
  termsConditions?: string | null
  /** Internal / customer reference · own column (never inside termsConditions) */
  reference?: string | null
  /** Brand document template · null → org default for QUOTE */
  templateId?: string | null
  convertedInvoiceId?: string | null
  /** SPEC-04 · BOQ → Proposal → Award */
  title?: string | null
  acceptToken?: string | null
  sentAt?: string | null
  acceptedAt?: string | null
  acceptedBy?: string | null
  rejectedAt?: string | null
  rejectReason?: string | null
  sourceFileName?: string | null
  /** SPEC-05 L1 · the estimate this quote was converted from (GET /:id only) */
  estimateId?: string | null
  estimate?: { id: string; number: string; title?: string | null; version?: number } | null
  /** SPEC-05 L2 · instalment schedule printed on the proposal (GET /:id only) */
  paymentPlan?: PaymentPlan | null
  contact?: { id: string; displayName: string; email?: string | null }
  lines?: Array<{
    id?: string
    productId?: string | null
    description: string
    quantity: string | number
    unitPrice: string | number
    discount?: string | number
    taxRateId?: string | null
    subtotal?: string | number
    /** SPEC-04 · BOQ sections */
    sectionLabel?: string | null
    unit?: string | null
    isOptional?: boolean
    included?: boolean
    sortOrder?: number
  }>
}

/* ── SPEC-05 · Layer 1 «الدراسة والتسعير» (Estimate) + Layer 2 «خطة الدفعات» ──
   Visibility law (API · lib/estimates.ts): cost · margin · sale price are ABSENT
   from the payload for non-financial roles — every such field is optional here
   and the UI must hide the figure when it is undefined, never render 0. */
export interface EstimateLine {
  id?: string
  estimateId?: string
  sortOrder: number
  itemNo?: string | null
  section?: string | null
  description: string
  spec?: string | null
  unit?: string | null
  quantity: string | number
  /** confidential · absent for non-financial roles */
  materialCost?: string | number
  labourCost?: string | number
  otherCost?: string | number
  unitCost?: string | number
  marginPct?: string | number
  unitPrice?: string | number
  unitPriceLocked?: boolean
  lineTotal?: string | number
  accountId?: string | null
  /** always present */
  taxRate: string | number
  durationDays?: number | null
  ownerName?: string | null
  needsDept?: string | null
  productId?: string | null
}

export interface EstimateSectionMargin { section: string; cost: number; sale: number; marginPct: number }

export interface Estimate {
  id: string
  orgId: string
  number: string
  title: string
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'CONVERTED' | 'ARCHIVED'
  contactId?: string | null
  projectId?: string | null
  branchId?: string | null
  currency: string
  taxRate: string | number
  notes?: string | null
  version: number
  rootId?: string | null
  convertedQuoteId?: string | null
  approvedAt?: string | null
  approvedById?: string | null
  createdAt: string
  updatedAt?: string
  /** confidential · absent for non-financial roles */
  defaultMarginPct?: string | number
  costTotal?: string | number
  saleSubtotal?: string | number
  taxTotal?: string | number
  saleTotal?: string | number
  marginPct?: string | number
  /** true when the payload was stripped for this role */
  confidentialHidden?: boolean
  contact?: { id: string; displayName: string; email?: string | null }
  quote?: { id: string; quoteNumber: string; status?: string } | null
  lines?: EstimateLine[]
  sections?: EstimateSectionMargin[]
  _count?: { lines: number }
}

export interface EstimateLineInput {
  sortOrder?: number
  itemNo?: string | null
  section?: string | null
  description: string
  spec?: string | null
  unit?: string | null
  quantity?: number
  materialCost?: number
  labourCost?: number
  otherCost?: number
  marginPct?: number | null
  unitPrice?: number | null
  unitPriceLocked?: boolean
  taxRate?: number | null
  durationDays?: number | null
  ownerName?: string | null
  needsDept?: string | null
  productId?: string | null
  accountId?: string | null
}

export interface EstimateInput {
  title: string
  number?: string
  contactId?: string | null
  projectId?: string | null
  branchId?: string | null
  currency?: string
  defaultMarginPct?: number
  taxRate?: number
  notes?: string | null
  lines?: EstimateLineInput[]
}

export type PaymentCondition = 'SIGNATURE' | 'MILESTONE' | 'PROGRESS' | 'DELIVERY' | 'DATE'
export type PaymentBillingMethod = 'INVOICE' | 'PROGRESS_CLAIM'

export interface PaymentPlanItem {
  id?: string
  planId?: string
  sortOrder: number
  label: string
  percent: string | number
  amount: string | number
  condition: PaymentCondition
  conditionValue?: string | null
  billingMethod: PaymentBillingMethod
  dueDate?: string | null
  status?: string
}
export interface PaymentPlan {
  id: string
  orgId: string
  name: string
  isTemplate: boolean
  quoteId?: string | null
  createdAt?: string
  items: PaymentPlanItem[]
}
export interface PaymentPlanItemInput {
  label: string
  percent: number
  condition?: PaymentCondition
  conditionValue?: string | null
  billingMethod?: PaymentBillingMethod
  dueDate?: string | null
  sortOrder?: number
}
export interface PaymentPlanInput {
  name: string
  isTemplate?: boolean
  items: PaymentPlanItemInput[]
}

/** SPEC-04 · BOQ import preview (parse only · nothing written) */
export interface BoqPreviewLine {
  no: string
  description: string
  unit: string | null
  qty: number | null
  unitPrice: number | null
  subtotal: number | null
  isHeading: boolean
}
export interface BoqPreview {
  fileName: string
  sheets: Array<{ name: string; lineCount: number; total: number; lines: BoqPreviewLine[] }>
  warnings: string[]
}

export interface QuoteInput {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  contactId: string
  quoteNumber?: string
  status?: Quote['status']
  issueDate: string
  validUntil: string
  currency?: string
  exchangeRate?: number
  notes?: string | null
  termsConditions?: string | null
  reference?: string | null
  templateId?: string | null
  /** SPEC-04 */
  title?: string | null
  sourceFileName?: string | null
  lines: Array<{
    productId?: string | null
    description: string
    quantity: number
    unitPrice: number
    discount?: number
    taxRateId?: string | null
    /** SPEC-04 · BOQ sections */
    sectionLabel?: string | null
    unit?: string | null
    isOptional?: boolean
    included?: boolean
    sortOrder?: number
  }>
}

export interface Voucher {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  id: string
  orgId: string
  type: 'RECEIPT' | 'PAYMENT'
  number: string
  date: string
  contactId?: string | null
  amount: string
  currency: string
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'STC_PAY' | 'MADA' | 'CHECK' | 'OTHER'
  reference?: string | null
  notes?: string | null
  invoiceId?: string | null
  billId?: string | null
  contact?: { id: string; displayName: string }
}

export interface VoucherInput {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  type: 'RECEIPT' | 'PAYMENT'
  number?: string
  date: string
  contactId?: string | null
  amount: number
  currency?: string
  paymentMethod: Voucher['paymentMethod']
  bankAccountId?: string | null
  reference?: string | null
  notes?: string | null
  invoiceId?: string | null
  billId?: string | null
}

export interface Invoice {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  id: string
  orgId: string
  contactId: string
  invoiceNumber: string
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED'
  supplyDate?: string | null
  issueDate: string
  dueDate: string
  currency: string
  exchangeRate: string
  subtotal: string
  taxTotal: string
  discountTotal: string
  total: string
  amountPaid: string
  notes?: string | null
  termsConditions?: string | null
  /** Customer PO / external reference · own column (never inside termsConditions) */
  reference?: string | null
  /** Brand document template · null → org default for INVOICE */
  templateId?: string | null
  paymentLinkUrl?: string | null
  zatcaUuid?: string | null
  zatcaQr?: string | null
  zatcaDelivery?: { state: string | null; message: string | null; customerReleaseReady?: boolean; evidence?: { state: string; mode: string; kind: string; uuid: string; attempts: number; httpStatus: number | null; updatedAt: string; errors: string[] | null; warnings: string[] | null } | null } | null
  zatcaStatus?: string | null
  contact?: Contact
  lines?: InvoiceLine[]
}

export interface InvoiceLine {
  id?: string
  productId?: string | null
  description: string
  quantity: number | string
  unitPrice: number | string
  discount?: number | string
  taxRateId?: string | null
}

export interface InvoiceInput {
  /** Branch dimension (B1) · omitted → member default · null → none */
  branchId?: string | null
  /** Project / job-costing dimension (C2) */
  projectId?: string | null
  contactId: string
  invoiceNumber?: string
  status?: Invoice['status']
  supplyDate?: string | null
  issueDate: string
  dueDate: string
  currency?: string
  exchangeRate?: number
  notes?: string
  termsConditions?: string
  reference?: string | null
  templateId?: string | null
  lines: InvoiceLine[]
}

// ── Bootstrap helper · auto-create first org if none exist ───────────────────
export async function bootstrap() {
  try {
    const orgs = await api.orgs.list()
    if (orgs.length === 0) {
      // Jurisdiction chosen at registration survives email verification via
      // `entix_pending_org_country`; otherwise follow the stored market, then SA.
      let country: 'SA' | 'US' = 'SA'
      try {
        const pending = localStorage.getItem('entix_pending_org_country')
        const market = localStorage.getItem('entix-marketing-region')
        if (pending === 'SA' || pending === 'US') country = pending
        else if (market === 'US') country = 'US'
        localStorage.removeItem('entix_pending_org_country')
      } catch { /* private mode */ }
      const newOrg = await api.orgs.create({
        name: 'My Company',
        country,
        baseCurrency: country === 'US' ? 'USD' : 'SAR',
      })
      setOrgId(newOrg.id)
      return newOrg
    }
    if (!orgId) setOrgId(orgs[0].id)
    return orgs[0]
  } catch (e) {
    console.error('[api.bootstrap] failed', e)
    return null
  }
}

export const apiBaseUrl = API_BASE

// ── AI Billing types ────────────────────────────────────────────────────────

export type AiKeyMode = 'BYOK' | 'HOSTED_FREE' | 'HOSTED_PRO' | 'HOSTED_BUSINESS' | 'PAYG';

export interface AiBillingConfig {
  mode: AiKeyMode;
  byokProvider: 'openrouter' | 'anthropic' | null;
  byokKeyHint: string | null; // sk-...XXXX
  monthlyAllocation: string;  // decimal as string (Prisma)
  creditBalance: string;
  spentThisPeriod: string;
  periodResetAt: string;
  disabled: boolean;
  disabledReason: string | null;
  percentUsed: number;
}

export interface AiBillingUpdate {
  mode?: AiKeyMode;
  byokProvider?: 'openrouter' | 'anthropic';
  byokKey?: string;
  clearByok?: boolean;
}

export interface AiUsageLog {
  id: string;
  orgId: string;
  userId: string | null;
  endpoint: string;
  model: string;
  provider: string;
  source: 'BYOK' | 'HOSTED';
  promptTokens: number;
  completionTokens: number;
  costUsd: string;
  successful: boolean;
  errorCode: string | null;
  createdAt: string;
}

// ── Notification + Signature types ─────────────────────────────────────────
export interface NotificationItem {
  id: string
  orgId: string
  userId: string | null
  type: string // INVOICE_PAID | QUOTE_ACCEPTED | SIGN_REQUESTED | SIGN_COMPLETED | EXPENSE_CREATED | SYSTEM
  title: string
  body: string | null
  link: string | null
  refType: string | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

export interface SignSigner {
  name: string
  email: string
  role?: string
}

export interface SignSendInput {
  signers: SignSigner[]
  message?: string
  expiresInDays?: number
}

export interface SignatureRequest {
  id: string
  orgId: string
  docType: 'QUOTE' | 'INVOICE' | 'CONTRACT'
  docId: string
  docNumber: string
  status: 'PENDING' | 'SENT' | 'VIEWED' | 'SIGNED' | 'DECLINED' | 'EXPIRED'
  docusealSubmissionId: string | null
  docusealEmbedUrl: string | null
  signers: string // JSON-encoded array
  signedPdfUrl: string | null
  auditTrailUrl: string | null
  sentAt: string | null
  signedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SignSendResult {
  signatureRequest: SignatureRequest
  docuseal: { id: number | string; embed_src?: string } | null
  error: string | null
}

/** Admin Console v3 · command-center payload (GET /api/admin/metrics) */
export type AdminMetrics = {
  generatedAt: string
  windowDays: number
  kpis: { users: number; orgs: number; paying: number; trialing: number; pastDue: number; newUsers: number; newOrgs: number; newUsersPrev: number; newOrgsPrev: number; newPaid: number; churned: number; churnRate: number; mrr: Record<string, number>; arr: Record<string, number> }
  series: Array<{ date: string; users: number; orgs: number }>
  mix: { status: Record<string, number>; tier: Record<string, number>; country: Record<string, number> }
  attention: Array<{ kind: string; severity: 'high' | 'medium' | 'low'; orgId: string; orgName: string; detail: string; at?: string | null }>
  support: { open: number; pending: number; resolvedInWindow: number; oldestWaiting: { id: string; subject: string; priority: string; orgName: string | null; since: string; hours: number } | null; aiConversations24h: number }
  partners: { active: number; commissionsPendingCount: number; commissionsPendingAmount: number; payoutsPendingCount: number; payoutsPendingAmount: number }
  system: { db: 'ok' | 'error'; version: string | null; uptimeHours: number; stripeConfigured: boolean; zatcaOutbound: boolean }
  recentAudit: Array<{ id: string; action: string; targetType: string; targetLabel: string | null; adminEmail: string; createdAt: string }>
  latestOrgs: Array<{ id: string; name: string; country: string; createdAt: string; ownerEmail: string | null; plan: string | null; tier: string | null; status: string }>
}

/** Admin v3 R2 · team & roles */
export interface AdminMe { isInternal: boolean; internalRole: string; roleName?: { ar: string; en: string }; permissions: string[]; isSuper: boolean; scopeAssigned: boolean; assignedOrgIds: string[] | null; email: string; userId: string }
export interface AdminRoleRecord { id: string; key: string; nameAr: string; nameEn: string; permissions: string[]; scopeAssigned: boolean; isSystem: boolean; members?: number; pendingInvites?: number; createdAt: string }
export interface AdminTeamMember { id: string; email: string; name: string | null; disabledAt: string | null; createdAt: string; bootstrap: boolean; role: { id: string | null; key: string; nameAr: string; nameEn: string; scopeAssigned: boolean } | null; assignments: Array<{ orgId: string; orgName: string }> }
export interface AdminTeamInvite { id: string; email: string; role: { id: string; key: string; nameAr: string; nameEn: string }; invitedBy: string; expiresAt: string; createdAt: string }
export interface AdminTicketRow { id: string; orgId: string | null; orgName?: string | null; userId: string | null; subject: string; status: string; priority: string; assignedAgentEmail: string | null; createdByEmail: string | null; createdAt: string; updatedAt: string; closedAt: string | null; lastMessage?: { authorType: string; authorEmail: string | null; body: string; createdAt: string } | null }
export interface AdminTicketDetail extends AdminTicketRow { messages: Array<{ id: string; authorType: string; authorEmail: string | null; body: string; createdAt: string }> }
