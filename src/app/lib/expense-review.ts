import { API_BASE_URL, ApiError, getOrgId, type Expense } from './api';

export type ReviewExpense = Expense & { updatedAt: string };
export async function saveExpenseReview(id: string, data: { expectedUpdatedAt: string; accountId?: string; category?: string; notes?: string; reason: string }): Promise<ReviewExpense> {
  const orgId = getOrgId();
  if (!orgId) throw new Error('Select a company before saving');
  const response = await fetch(`${API_BASE_URL}/api/expenses/${encodeURIComponent(id)}/review`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Org-Id': orgId }, body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({ error: 'expense_review_failed' }));
  if (!response.ok) throw new ApiError(response.status, result.message || result.error?.message || result.error?.code || result.error || 'Expense review failed', undefined, { code: result.error?.code || result.error, messageAr: result.messageAr || result.error?.messageAr });
  return result;
}
