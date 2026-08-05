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

export function setOrgId(id: string | null) {
  orgId = id
  if (typeof localStorage !== 'undefined') {
    if (id) localStorage.setItem('entix_org_id', id)
    else localStorage.removeItem('entix_org_id')
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
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem('entix_org_id')
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
  constructor(
    status: number,
    message: string,
    detail?: string,
    extras?: { code?: string; messageAr?: string; requestId?: string },
  ) {
    super(message)
    this.status = status
    this.detail = detail
    this.code = extras?.code
    this.messageAr = extras?.messageAr
    this.requestId = extras?.requestId
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
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('entix-language')) || 'ar'
    headers['Accept-Language'] = lang === 'en' ? 'en-US,en;q=0.9,ar;q=0.8' : 'ar-SA,ar;q=0.9,en;q=0.8'
  }
  if (!opts.skipOrg && orgId) headers['X-Org-Id'] = orgId

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
      detail = typeof d.detail === 'string' ? d.detail : (d.detail ? JSON.stringify(d.detail) : undefined)
    } else if (typeof data === 'string' && data.trim()) {
      message = data.slice(0, 500)
    }
    if (!requestId) {
      requestId = clientErrorRef()
      console.error(`[api] ${requestId} ${opts.method || 'GET'} ${path} → ${res.status}`, { code, message })
    }
    throw new ApiError(res.status, message, detail, { code, messageAr, requestId })
  }

  return data as T
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
    list: () => request<Org[]>('/orgs', { skipOrg: true }),
    create: (data: CreateOrgInput) =>
      request<Org>('/orgs', { method: 'POST', body: data, skipOrg: true }),
    get: (id: string) => request<Org>(`/orgs/${id}`, { skipOrg: true }),
    update: (id: string, data: Partial<Org>) =>
      request<Org>(`/orgs/${id}`, { method: 'PATCH', body: data, skipOrg: true }),
    remove: (id: string, data: { confirmName: string }) =>
      request<{ ok: true; deletedOrgId: string; nextOrgId: string | null }>(`/orgs/${id}`, { method: 'DELETE', body: data, skipOrg: true }),
    members: (id: string) =>
      request<{ members: Array<{ id: string; role: string; createdAt: string; user: { id: string; email: string; name?: string | null } }> }>(`/orgs/${id}/members`, { skipOrg: true }),
    inviteMember: (id: string, data: { email: string; role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' }) =>
      request<{ ok: true; pending?: boolean; member?: any; inviteUrl?: string; message?: string }>(`/orgs/${id}/members/invite`, { method: 'POST', body: data, skipOrg: true }),
    updateMemberRole: (id: string, memberId: string, role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER') =>
      request<{ ok: true }>(`/orgs/${id}/members/${memberId}`, { method: 'PATCH', body: { role }, skipOrg: true }),
    removeMember: (id: string, memberId: string) =>
      request<void>(`/orgs/${id}/members/${memberId}`, { method: 'DELETE', skipOrg: true }),
    getNumbering: (id: string) =>
      request<NumberingSettings>(`/orgs/${id}/numbering`, { skipOrg: true }),
    saveNumbering: (id: string, data: NumberingSettings) =>
      request<NumberingSettings>(`/orgs/${id}/numbering`, { method: 'PATCH', body: data, skipOrg: true }),
    resetData: (id: string, data: { mode: 'blank' | 'demo' | 'clean_company'; confirmName: string }) =>
      request<{ ok: true; mode: string; counts?: Record<string, number>; org?: Org }>(`/orgs/${id}/reset-data`, { method: 'POST', body: data, skipOrg: true }),
    auditLog: (id: string, limit = 50) =>
      request<{ items: AuditLogItem[] }>(`/orgs/${id}/audit-log`, { query: { limit }, skipOrg: true }),
  },

  // Contacts
  contacts: {
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
    list: (status?: 'POSTED' | 'DRAFT') =>
      request<{ items: JournalEntryRow[]; total: number }>('/api/journals', { query: status ? { status } : undefined }),
    get: (id: string) => request<JournalEntryRow>(`/api/journals/${id}`),
    create: (data: JournalEntryInput) => request<JournalEntryRow>('/api/journals', { method: 'POST', body: data }),
    update: (id: string, data: Partial<JournalEntryInput>) =>
      request<JournalEntryRow>(`/api/journals/${id}`, { method: 'PATCH', body: data }),
    post: (id: string) => request<{ ok: true }>(`/api/journals/${id}/post`, { method: 'POST' }),
    unpost: (id: string) => request<{ ok: true }>(`/api/journals/${id}/unpost`, { method: 'POST' }),
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
    approve: (id: string) => request<{ ok: true; billId: string; billNumber: string }>(`/api/inbox/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => request<{ ok: true }>(`/api/inbox/${id}/reject`, { method: 'POST' }),
    reprocess: (id: string) => request<{ ok: true; kind: string; lines: number }>(`/api/inbox/${id}/reprocess`, { method: 'POST' }),
    duplicateCheck: (id: string) => request<{ possibleDuplicate: boolean; match?: { id: string; billNumber: string; total: number; issueDate: string; supplierName: string | null } | null }>(`/api/inbox/${id}/duplicate-check`),
  },

  // Accounts (chart of accounts)
  accounts: {
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
    transactions: (id: string) => request<AccountTransactions>(`/api/accounts/${id}/transactions`),
    translate: (input: string, hint?: string) =>
      request<{ name: string; nameAr: string; type: 'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE'; category?: string; reasoning?: string; suggestedCode?: string }>(
        '/api/accounts/translate', { method: 'POST', body: { input, hint } },
      ),
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
    updateWithholding: (
      voucherId: string,
      data: { rate: number; transferType: 'SERVICE' | 'ROYALTY' | 'INTEREST' | 'OTHER'; note?: string | null },
    ) => request<{ ok: true; row: TaxReturnWithholdingRow }>(`/api/tax-return/withholding/${voucherId}`, { method: 'PATCH', body: data }),
  },

  // Reports · live report viewer + print designer payload
  reports: {
    get: (id: string, params?: { from?: string; to?: string; branchId?: string; projectId?: string; costCenterId?: string; demo?: number }) =>
      request<ReportPayload>(`/api/reports/${id}`, { query: params }),
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

  // Branches
  branches: {
    list: () => request<{ items: any[]; total: number }>('/api/branches'),
    get: (id: string) => request<any>(`/api/branches/${id}`),
    create: (data: { name: string; code?: string; address?: string }) =>
      request<any>('/api/branches', { method: 'POST', body: data }),
    update: (id: string, data: { name?: string; code?: string; address?: string }) =>
      request<any>(`/api/branches/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/branches/${id}`, { method: 'DELETE' }),
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
  },

  // Fixed Assets
  // Document templates (print layouts for invoices / quotes / vouchers / notes)
  documentTemplates: {
    list: (params?: { type?: string }) =>
      request<{ items: any[]; total: number }>('/api/document-templates', { query: params }),
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

  // Products
  products: {
    list: (params?: { type?: string; category?: string }) =>
      request<{ items: any[]; total: number; categories: Array<{ category: string; count: number }> }>('/api/products', { query: params }),
    categories: () =>
      request<{ categories: Array<{ category: string; count: number; totalValue: number }> }>('/api/products/categories'),
    get: (id: string) => request<any>(`/api/products/${id}`),
    create: (data: any) => request<any>('/api/products', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/products/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),
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

  // ZATCA Phase 2 · CSID + processing + status
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
    list: (params?: { status?: string; contactId?: string; page?: number; limit?: number }) =>
      request<PaginatedResponse<Invoice>>('/api/invoices', { query: params }),
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

  // Demo data · seed two orgs (SA + US) for the current user · UX-179 + UX-199 fix
  seedDemoData: (orgId: string) =>
    request<{ ok: true; seeded: any }>(
      `/orgs/${orgId}/seed-demo-data`, { method: 'POST', body: {}, skipOrg: true },
    ),
  seedTwoDemos: () =>
    request<{ ok: true; seeded: Array<{ id: string; slug: string; name: string; country: string; currency: string }> }>(
      '/orgs/_/seed-two-demos', { method: 'POST', body: {}, skipOrg: true },
    ),

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
    org: { id: string; slug: string; name: string; baseCurrency: string; country: string }
  }>
}

export interface Org {
  id: string
  slug: string
  inboundEmailLocal?: string | null // custom inbound alias · default bills+<slug>@in.entix.io
  name: string
  legalName?: string | null
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
  taxRegistrationDate?: string | null
  firstVatPeriodStart?: string | null
  vatPeriod?: 'monthly' | 'quarterly' | null
  paymentSettings?: any
  numberingSettings?: any
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
  slug: string
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
  status: 'live' | 'demo' | 'empty'
  generatedAt: string
  period: { from: string; to: string }
  currency: string
  org: Org
  summary: Record<string, number>
  sections: ReportSection[]
  notices?: string[]
}

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

export type NumberingKind = 'contact' | 'invoice' | 'quote' | 'bill' | 'receipt' | 'payment'
export interface NumberingPerKind {
  prefix?: string
  padding?: number
  start?: number
}
export type NumberingSettings = Partial<Record<NumberingKind, NumberingPerKind>>

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
  createdAt: string
  contact?: { id: string; displayName: string; taxId?: string | null; vatNumber?: string | null; isSupplier?: boolean } | null
  taxRate?: { id?: string; name: string; rate: string } | null
  duplicateExpense?: { id: string; number: string; total: string; date: string; vendorName?: string | null; reason: string } | null
}

export interface ExpenseLine {
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

export interface ExpenseInput {
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
  convertedInvoiceId?: string | null
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
  }>
}

export interface QuoteInput {
  contactId: string
  quoteNumber?: string
  status?: Quote['status']
  issueDate: string
  validUntil: string
  currency?: string
  exchangeRate?: number
  notes?: string | null
  termsConditions?: string | null
  lines: Array<{
    productId?: string | null
    description: string
    quantity: number
    unitPrice: number
    discount?: number
    taxRateId?: string | null
  }>
}

export interface Voucher {
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
  id: string
  orgId: string
  contactId: string
  invoiceNumber: string
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED'
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
  zatcaUuid?: string | null
  zatcaQr?: string | null
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
  contactId: string
  invoiceNumber?: string
  status?: Invoice['status']
  issueDate: string
  dueDate: string
  currency?: string
  exchangeRate?: number
  notes?: string
  termsConditions?: string
  lines: InvoiceLine[]
}

// ── Bootstrap helper · auto-create demo org if none exist ────────────────────
export async function bootstrap() {
  try {
    const orgs = await api.orgs.list()
    if (orgs.length === 0) {
      const newOrg = await api.orgs.create({
        slug: `demo-${Math.random().toString(36).slice(2, 8)}`,
        name: 'My Company',
        country: 'SA',
        baseCurrency: 'SAR',
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
