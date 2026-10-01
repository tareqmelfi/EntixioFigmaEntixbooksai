import { API_BASE_URL, ApiError, getOrgId, type Expense } from './api';

export type ReviewExpense = Expense & { updatedAt: string };
type ReviewInput = { expectedUpdatedAt: string; accountId?: string; category?: string; notes?: string; reason: string };

// Large selections share the API's rate limit. Retry only an explicit 429,
// never an uncertain network failure or a failed accounting transaction.
async function reviewRequest(id: string, orgId: string, data?: ReviewInput, onWait?: (seconds: number) => void): Promise<ReviewExpense> {
  for (let attempt = 0; ; attempt++) {
    if (getOrgId() !== orgId) throw new Error('Company changed; reopen the review.');
    const response = await fetch(`${API_BASE_URL}/api/expenses/${encodeURIComponent(id)}${data ? '/review' : ''}`, {
      method: data ? 'POST' : 'GET', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Org-Id': orgId }, ...(data ? { body: JSON.stringify(data) } : {}),
    });
    if (response.status === 429 && attempt < 2) {
      const header = response.headers.get('Retry-After');
      const seconds = header && /^\d+(\.\d+)?$/.test(header) ? Number(header) : header ? (Date.parse(header) - Date.now()) / 1000 : 61;
      const wait = Math.max(1, Math.min(120, Number.isFinite(seconds) ? seconds : 61));
      await response.body?.cancel(); onWait?.(Math.ceil(wait));
      await new Promise(resolve => setTimeout(resolve, wait * 1000)); onWait?.(0);
      continue;
    }
    const result = await response.json().catch(() => ({ error: 'expense_review_failed' }));
    if (!response.ok) throw new ApiError(response.status, result.message || result.error?.message || result.error?.code || result.error || 'Expense review failed', undefined, { code: result.error?.code || result.error, messageAr: result.messageAr || result.error?.messageAr });
    return result;
  }
}
export async function loadExpenseReviews(ids: string[], onWait?: (seconds: number) => void): Promise<ReviewExpense[]> {
  const orgId = getOrgId(); if (!orgId) throw new Error('Select a company before reviewing');
  const records: ReviewExpense[] = [];
  for (const id of ids) records.push(await reviewRequest(id, orgId, undefined, onWait));
  return records;
}
export async function saveExpenseReview(id: string, data: ReviewInput, onWait?: (seconds: number) => void): Promise<ReviewExpense> {
  const orgId = getOrgId(); if (!orgId) throw new Error('Select a company before saving');
  return reviewRequest(id, orgId, data, onWait);
}
