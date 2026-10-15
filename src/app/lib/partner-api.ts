import { API_BASE_URL } from './api';

// Partners belong to the authenticated person, independent of the active
// accounting company. Never send X-Org-Id or put credentials in URLs/storage.
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/partners${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.message || result.error || 'partner_request_failed'), { status: response.status, code: result.error });
  if (path === '/register' && typeof result.id !== 'string') throw new Error('invalid_partner_response');
  if (path === '/me' && (!result.partner || !result.dashboard || !Array.isArray(result.clients) || !Array.isArray(result.commissions) || !Array.isArray(result.payouts))) {
    throw new Error('invalid_partner_response');
  }
  return result;
}
export const partnerApi = {
  me: () => request<any>('/me'),
  register: (body: { name: string; phone?: string; country: string; type: 'FREELANCER' | 'FIRM' }) => request('/register', body),
  requestPayout: (body: { currency: string }) => request('/payouts', body),
};
