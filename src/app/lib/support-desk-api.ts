import { API_BASE_URL, ApiError, type AdminTicketDetail } from './api';
export type SupportDeskTicket = AdminTicketDetail & { meta?: { supportAgentMode?: 'auto' | 'human' } };
async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tickets${path}`, {
    method, credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.message || data.error || 'support_request_failed');
  return data as T;
}
export const supportDesk = {
  draft: (id: string) => request<{ draft: string; handoff: boolean }>(`/${id}/draft`, 'POST'),
  channels: async (): Promise<{whatsapp?: string | null; email?: string}> => { const response = await fetch(`${API_BASE_URL}/api/support/config`); if (!response.ok) throw new ApiError(response.status, 'support_config_unavailable'); return response.json(); },
  create: (body: { subject: string; message?: string; contactName?: string; contactEmail?: string; contactPhone?: string; priority: string; category: string; orgId?: string; userId?: string }) => request<{ ticket: SupportDeskTicket }>('', 'POST', body),
  update: (id: string, body: { subject?: string; status?: string; priority?: string; category?: string; assignedAgentEmail?: string | null; agentMode?: 'auto' | 'human' }) => request<{ ticket: SupportDeskTicket }>(`/${id}`, 'PATCH', body),
  message: (id: string, body: string, internal: boolean) => request<{ delivery: { sent: boolean; reason?: string } }>(`/${id}/messages`, 'POST', { body, internal }),
};
