/**
 * Entix Books · API client
 *
 * Wraps fetch with:
 *  - Base URL (api.entix.io · localhost:3000 in dev)
 *  - Auth token (Logto JWT · or empty in DEMO mode)
 *  - Active org id (X-Org-Id header)
 *  - JSON serialization
 *  - Error envelope normalization
 */

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'https://api.entix.io'

// ── Token + Org state (replace with Logto store when wired) ───────────────────
let authToken: string | null = null
let orgId: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('entix_token', token)
    else localStorage.removeItem('entix_token')
  }
}

export function setOrgId(id: string | null) {
  orgId = id
  if (typeof localStorage !== 'undefined') {
    if (id) localStorage.setItem('entix_org_id', id)
    else localStorage.removeItem('entix_org_id')
  }
}

// Bootstrap from localStorage on load
if (typeof localStorage !== 'undefined') {
  authToken = localStorage.getItem('entix_token')
  orgId = localStorage.getItem('entix_org_id')
}

// ── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number
  detail?: string
  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────────
type FetchOpts = {
  method?: string
  body?: unknown
  query?: Record<string, string | number | undefined | null>
  skipOrg?: boolean
  signal?: AbortSignal
}

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  if (!opts.skipOrg && orgId) headers['X-Org-Id'] = orgId

  let body: string | undefined
  if (opts.body !== undefined) body = JSON.stringify(opts.body)

  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers,
    body,
    signal: opts.signal,
    credentials: 'include',
  })

  // 204 No Content
  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('json') ? await res.json().catch(() => null) : await res.text()

  if (!res.ok) {
    // Normalize error shape — backend may send { error: "string" } | { error: { message } } | { message } | Zod validation errors
    let message: string = res.statusText || `HTTP ${res.status}`
    let detail: string | undefined
    if (data && typeof data === 'object') {
      const d = data as any
      if (typeof d.error === 'string') message = d.error
      else if (d.error && typeof d.error === 'object') {
        message = d.error.message || d.error.code || JSON.stringify(d.error)
      } else if (typeof d.message === 'string') message = d.message
      // Zod validation: { success: false, error: { issues: [{path, message}, ...] } }
      if (Array.isArray(d?.error?.issues)) {
        message = d.error.issues.map((i: any) => `${(i.path || []).join('.')} ${i.message}`).join(' · ')
      }
      detail = typeof d.detail === 'string' ? d.detail : (d.detail ? JSON.stringify(d.detail) : undefined)
    } else if (typeof data === 'string' && data.trim()) {
      message = data.slice(0, 500)
    }
    throw new ApiError(res.status, message, detail)
  }

  return data as T
}

// ── Resource clients ──────────────────────────────────────────────────────────
export const api = {
  // Identity
  me: () => request<MeResponse>('/me'),

  // Orgs
  orgs: {
    list: () => request<Org[]>('/orgs', { skipOrg: true }),
    create: (data: CreateOrgInput) =>
      request<Org>('/orgs', { method: 'POST', body: data, skipOrg: true }),
    get: (id: string) => request<Org>(`/orgs/${id}`, { skipOrg: true }),
    update: (id: string, data: Partial<Org>) =>
      request<Org>(`/orgs/${id}`, { method: 'PATCH', body: data, skipOrg: true }),
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
  },

  // Contacts
  contacts: {
    list: (params?: { type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'; q?: string; page?: number; limit?: number }) =>
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
    get: (id: string) => request<InboxMessageDetail>(`/api/inbox/${id}`),
    approve: (id: string) => request<{ ok: true; billId: string; billNumber: string }>(`/api/inbox/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => request<{ ok: true }>(`/api/inbox/${id}/reject`, { method: 'POST' }),
    reprocess: (id: string) => request<{ ok: true; kind: string; lines: number }>(`/api/inbox/${id}/reprocess`, { method: 'POST' }),
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
    importBulk: (rows: Array<{ code: string; name: string; nameAr?: string | null; type?: string; parentCode?: string | null; description?: string | null }>, skipExisting = true) =>
      request<{ ok: true; created: number; skipped: number; linked: number; errors: any[]; message: string }>('/api/accounts/import', { method: 'POST', body: { rows, skipExisting } }),
    transactions: (id: string) => request<AccountTransactions>(`/api/accounts/${id}/transactions`),
    translate: (input: string, hint?: string) =>
      request<{ name: string; nameAr: string; type: 'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE'; category?: string; reasoning?: string; suggestedCode?: string }>(
        '/api/accounts/translate', { method: 'POST', body: { input, hint } },
      ),
  },

  // Expenses
  expenses: {
    list: (params?: { category?: string; from?: string; to?: string; page?: number; limit?: number }) =>
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

  // Bills (purchase invoices)
  bills: {
    list: (params?: { status?: string }) =>
      request<{ items: any[]; total: number }>('/api/bills', { query: params }),
    get: (id: string) => request<any>(`/api/bills/${id}`),
    create: (data: any) => request<any>('/api/bills', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/bills/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/bills/${id}`, { method: 'DELETE' }),
  },

  // Branches
  branches: {
    list: () => request<{ items: any[]; total: number }>('/api/branches'),
    create: (data: { name: string; code?: string; address?: string }) =>
      request<any>('/api/branches', { method: 'POST', body: data }),
    remove: (id: string) => request<void>(`/api/branches/${id}`, { method: 'DELETE' }),
  },

  // Cost Centers
  costCenters: {
    list: () => request<{ items: any[]; total: number }>('/api/cost-centers'),
    create: (data: { code: string; name: string }) =>
      request<any>('/api/cost-centers', { method: 'POST', body: data }),
    remove: (id: string) => request<void>(`/api/cost-centers/${id}`, { method: 'DELETE' }),
  },

  // Projects
  projects: {
    list: () => request<{ items: any[]; total: number }>('/api/projects'),
    create: (data: any) => request<any>('/api/projects', { method: 'POST', body: data }),
    remove: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  // Fixed Assets
  fixedAssets: {
    list: () => request<{ items: any[]; total: number; totalCost: number; netBookValue: number; totalDepreciation: number }>('/api/fixed-assets'),
    create: (data: any) => request<any>('/api/fixed-assets', { method: 'POST', body: data }),
    remove: (id: string) => request<void>(`/api/fixed-assets/${id}`, { method: 'DELETE' }),
  },

  // Products
  products: {
    list: (params?: { type?: string; category?: string }) =>
      request<{ items: any[]; total: number; categories: Array<{ category: string; count: number }> }>('/api/products', { query: params }),
    categories: () =>
      request<{ categories: Array<{ category: string; count: number; totalValue: number }> }>('/api/products/categories'),
    create: (data: any) => request<any>('/api/products', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/api/products/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),
    importBulk: (rows: Array<{ sku?: string; name: string; nameAr?: string; description?: string; type?: string; category?: string; billingCycle?: string; unitPrice?: number; costPrice?: number }>, skipExisting = true) =>
      request<{ ok: true; created: number; skipped: number; errors: any[]; message: string }>(
        '/api/products/import',
        { method: 'POST', body: { rows, skipExisting } },
      ),
    seedFcCatalog: () =>
      request<{ ok: true; created: number; skipped: number; message: string }>(
        '/api/products/seed-fc-catalog', { method: 'POST', body: {} },
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

  // Notifications
  notifications: {
    list: (params?: { unread?: boolean; limit?: number }) =>
      request<{ items: NotificationItem[]; count: number }>('/api/notifications', {
        query: { unread: params?.unread ? '1' : undefined, limit: params?.limit?.toString() },
      }),
    count: () => request<{ unread: number }>('/api/notifications/count'),
    markRead: (id: string) => request<NotificationItem>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<{ updated: number }>('/api/notifications/mark-all-read', { method: 'POST' }),
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
    chat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
      request<{ message: string; toolResults: Array<{ tool: string; args: any; result: any }> }>(
        '/api/agent/chat',
        { method: 'POST', body: { messages } },
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

  // ZATCA · process invoice → XML + QR + clearance
  zatca: {
    process: (id: string) =>
      request<{ ok: boolean; status: string; uuid: string; qr: string; warnings: string[] }>(
        `/api/zatca/invoices/${id}/process`,
        { method: 'POST' },
      ),
    getQr: (id: string) =>
      request<{ qr: string }>(`/api/zatca/invoices/${id}/qr`),
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

  // Bank statement import (CSV / MT940 / OFX) + auto-match
  bankImport: {
    profiles: () => request<{ profiles: { id: string; label: string }[]; formats: string[] }>('/api/bank-import/profiles'),
    parse: (data: { bankAccountId: string; format: 'csv' | 'mt940' | 'ofx'; profile?: string; text: string }) =>
      request<{ rows: any[]; matched: number; unmatched: number }>(
        '/api/bank-import/parse',
        { method: 'POST', body: data },
      ),
    commit: (data: { bankAccountId: string; rows: any[] }) =>
      request<{ ok: boolean; created: number; linked: number; skipped: number }>(
        '/api/bank-import/commit',
        { method: 'POST', body: data },
      ),
  },

  // Portal · enable/disable per-contact + retrieve URL
  portal: {
    enable: (contactId: string) =>
      request<{ ok: true; url: string; token: string }>(`/api/portal-admin/contacts/${contactId}/enable`, { method: 'POST' }),
    disable: (contactId: string) =>
      request<{ ok: true }>(`/api/portal-admin/contacts/${contactId}/disable`, { method: 'POST' }),
    getUrl: (contactId: string) =>
      request<{ enabled: boolean; url?: string; token?: string }>(`/api/portal-admin/contacts/${contactId}/url`),
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
  },

  // Credit notes (إشعارات دائنة)
  creditNotes: {
    list: (params?: { limit?: number }) => request<{ items: any[] }>('/api/credit-notes', { query: params }),
    create: (data: any) => request<any>('/api/credit-notes', { method: 'POST', body: data }),
    remove: (id: string) => request<void>(`/api/credit-notes/${id}`, { method: 'DELETE' }),
  },

  // Vouchers (سند قبض / سند صرف)
  vouchers: {
    list: (params?: { type?: 'RECEIPT' | 'PAYMENT' }) =>
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
    printUrl: (id: string) => `${API_BASE}/api/vouchers/${id}/print`,
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
    printUrl: (id: string) => `${API_BASE}/api/invoices/${id}/print`,
    email: (id: string, body?: { to?: string; subject?: string; message?: string }) =>
      request<{ ok: true; to: string }>(`/api/invoices/${id}/email`, { method: 'POST', body: body || {} }),
  },

  // OAuth · payment provider connections (UX-137)
  oauth: {
    /** Returns the URL to navigate the merchant to for Stripe/PayPal Connect. */
    startUrl: (provider: 'stripe' | 'paypal', orgId: string) =>
      `${API_BASE}/api/oauth/${provider}/start?orgId=${encodeURIComponent(orgId)}`,
    /** Pull connection state for status badges in PaymentsTab */
    status: (orgId: string) =>
      request<{
        stripe: { configured: boolean; connected: boolean; accountId: string | null; mode: string | null; connectedAt: string | null }
        paypal: { configured: boolean; connected: boolean; merchantId: string | null; mode: string | null; connectedAt: string | null }
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

export interface Contact {
  id: string
  orgId: string
  customCode?: string | null
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
  isActive: boolean
}

export interface AccountInput {
  code: string
  name: string
  nameAr?: string | null
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  subtype?: string | null
  parentId?: string | null
}

export interface Expense {
  id: string
  orgId: string
  number: string
  date: string
  category: string
  description?: string | null
  amount: string
  currency: string
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'STC_PAY' | 'MADA' | 'CHECK' | 'OTHER'
  vendorName?: string | null
  reference?: string | null
  taxRateId?: string | null
  taxAmount: string
  total: string
  receiptUrl?: string | null
  notes?: string | null
  createdAt: string
  taxRate?: { name: string; rate: string } | null
}

export interface ExpenseInput {
  number?: string
  date: string
  category: string
  description?: string | null
  amount: number
  currency?: string
  paymentMethod: Expense['paymentMethod']
  vendorName?: string | null
  reference?: string | null
  taxRateId?: string | null
  taxAmount?: number
  receiptUrl?: string | null
  notes?: string | null
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
  }
}

export interface OcrResult {
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
  category: string | null
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number | null; subtotal: number }>
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
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED'
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
