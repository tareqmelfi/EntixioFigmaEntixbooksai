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
    const message = (data && typeof data === 'object' && (data as any).error) || res.statusText
    const detail = (data && typeof data === 'object' && (data as any).detail) || undefined
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
  },

  // Contacts
  contacts: {
    list: (params?: { type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'; q?: string; page?: number; limit?: number }) =>
      request<PaginatedResponse<Contact>>('/api/contacts', { query: params }),
    get: (id: string) => request<Contact>(`/api/contacts/${id}`),
    create: (data: ContactInput) =>
      request<Contact>('/api/contacts', { method: 'POST', body: data }),
    update: (id: string, data: Partial<ContactInput>) =>
      request<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
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

  // Invoices
  invoices: {
    list: (params?: { status?: string; contactId?: string; page?: number; limit?: number }) =>
      request<PaginatedResponse<Invoice>>('/api/invoices', { query: params }),
    get: (id: string) => request<Invoice>(`/api/invoices/${id}`),
    create: (data: InvoiceInput) =>
      request<Invoice>('/api/invoices', { method: 'POST', body: data }),
    update: (id: string, data: Partial<InvoiceInput>) =>
      request<Invoice>(`/api/invoices/${id}`, { method: 'PATCH', body: data }),
    remove: (id: string) =>
      request<void>(`/api/invoices/${id}`, { method: 'DELETE' }),
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
  vatNumber?: string | null
  crNumber?: string | null
  zatcaEnabled: boolean
  logoUrl?: string | null
}

export interface CreateOrgInput {
  slug: string
  name: string
  legalName?: string
  country?: string
  baseCurrency?: string
  vatNumber?: string
  crNumber?: string
}

export interface Contact {
  id: string
  orgId: string
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  displayName: string
  legalName?: string | null
  email?: string | null
  phone?: string | null
  vatNumber?: string | null
  crNumber?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  country: string
  postalCode?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ContactInput {
  type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  displayName: string
  legalName?: string | null
  email?: string | null
  phone?: string | null
  vatNumber?: string | null
  crNumber?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  country?: string
  postalCode?: string | null
  notes?: string | null
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
