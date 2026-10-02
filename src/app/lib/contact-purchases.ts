import { API_BASE_URL, ApiError, getOrgId, type ContactSummary as BaseSummary } from './api';

export type PurchaseDocument = { id: string; kind: 'BILL' | 'EXPENSE'; number: string | null; documentNumber: string | null; date: string; total: string | number; status: string; currency: string; category: string | null; matchedBy: 'contactId' | 'legacyName' };
type DocumentTotals = { count: number; total: number; draftCount: number; draftTotal: number };
export type ContactSummary = BaseSummary & {
  currency?: string;
  baseCurrency?: string;
  currencyTotals?: Array<{ currency: string }>;
  totals: BaseSummary['totals'] & { purchases?: DocumentTotals; expenses?: DocumentTotals; documentTotal?: number };
  purchases?: { items: PurchaseDocument[]; nextCursor: string | null };
};
export async function loadContactSummary(id: string, currency?: string, cursor?: string): Promise<ContactSummary> {
  const orgId = getOrgId();
  if (!orgId) throw new Error('Select a company first');
  const params = new URLSearchParams();
  if (currency) params.set('currency', currency);
  if (cursor) params.set('purchaseCursor', cursor);
  const headers: Record<string, string> = { 'X-Org-Id': orgId };
  try {
    const grant = JSON.parse(localStorage.getItem('entix_act_as') || 'null');
    if (grant?.orgId === orgId && grant.until > Date.now()) headers['X-Admin-Org-Id'] = orgId;
  } catch { /* Regular membership validation still applies. */ }
  const response = await fetch(`${API_BASE_URL}/api/contacts/${encodeURIComponent(id)}/summary${params.size ? `?${params}` : ''}`, { credentials: 'include', headers });
  if (getOrgId() !== orgId) throw new Error('Company changed; reload the contact');
  if (!response.ok) throw new ApiError(response.status, 'Could not load contact transactions');
  const result = await response.json();
  if (getOrgId() !== orgId) throw new Error('Company changed; reload the contact');
  return result;
}
