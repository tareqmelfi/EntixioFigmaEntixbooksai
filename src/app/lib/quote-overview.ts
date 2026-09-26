import { api, type Quote } from './api';

export type QuoteProject = { id: string; code: string; name: string; status: string; percentComplete: string | number | null; startDate: string | null; endDate: string | null };
export type QuoteOverview = Quote & { projects?: QuoteProject[]; convertedInvoice?: { id: string; invoiceNumber: string; status: string } | null };
export const QUOTE_STAGES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'CONVERTED', 'REJECTED', 'EXPIRED'] as const;
export type QuoteStage = typeof QUOTE_STAGES[number];
export function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function quoteStage(q: Quote, today: string): QuoteStage {
  if (q.convertedInvoiceId || q.status === 'CONVERTED') return 'CONVERTED';
  if (q.status === 'ACCEPTED' || q.status === 'REJECTED') return q.status;
  if (q.status === 'EXPIRED' || (!!q.validUntil && q.validUntil.slice(0,10) < today)) return 'EXPIRED';
  return q.status;
}
export function quoteDays(date: string, today: string) {
  return Math.max(0, Math.floor((Date.parse(today) - Date.parse(date.slice(0,10))) / 86400000) || 0);
}
export function summarizeQuotes(items: QuoteOverview[], today: string) {
  const counts = Object.fromEntries(QUOTE_STAGES.map(s => [s, 0])) as Record<QuoteStage, number>;
  const currencies: Record<string, number> = {};
  const clients = new Map<string, { id: string; name: string; accepted: number; rejected: number; overdue: number; oldestDays: number }>();
  const projects = new Set<string>();
  for (const q of items) {
    const stage = quoteStage(q, today); counts[stage]++;
    currencies[q.currency] = (currencies[q.currency] || 0) + Number(q.total || 0);
    for (const p of q.projects || []) projects.add(p.id);
    if (q.projectId) projects.add(q.projectId);
    const c = clients.get(q.contactId) || { id: q.contactId, name: q.contact?.displayName || '—', accepted: 0, rejected: 0, overdue: 0, oldestDays: 0 };
    if (stage === 'ACCEPTED' || stage === 'CONVERTED') c.accepted++;
    if (stage === 'REJECTED') c.rejected++;
    if (stage === 'EXPIRED' && q.status !== 'DRAFT') { c.overdue++; c.oldestDays = Math.max(c.oldestDays, quoteDays(q.validUntil, today)); }
    clients.set(c.id, c);
  }
  const ranked = (key: 'accepted' | 'rejected' | 'overdue') => [...clients.values()].filter(c => c[key] > 0).sort((a,b) => b[key]-a[key] || a.name.localeCompare(b.name)).slice(0,3);
  const won = counts.ACCEPTED + counts.CONVERTED;
  return { counts, currencies, projects: projects.size, acceptanceRate: won + counts.REJECTED ? Math.round(won / (won + counts.REJECTED) * 100) : null, accepted: ranked('accepted'), rejected: ranked('rejected'), overdue: ranked('overdue') };
}

// Never publish a dashboard from a silently truncated 200-row list.
export async function loadQuoteOverview(): Promise<QuoteOverview[]> {
  const items = new Map<string, QuoteOverview>();
  const cursors = new Set<string>();
  let after: string | undefined;
  do {
    const page = await api.quotes.overview(after);
    for (const item of page.items) items.set(item.id, item);
    after = page.nextCursor || undefined;
    if (after && cursors.has(after)) throw new Error('Quote pagination did not advance');
    if (after) cursors.add(after);
  } while (after);
  return [...items.values()].sort((a,b) => b.issueDate.localeCompare(a.issueDate) || a.quoteNumber.localeCompare(b.quoteNumber));
}
