import type { Invoice } from '../lib/api';
import { Link } from 'react-router';
import { invoiceZatcaState, INVOICE_ZATCA_LABELS } from '../lib/invoice-zatca-state';
import { useLanguage } from './LanguageContext';
import { StatusBadge } from './product';
const SHORT_LABELS = {
  accepted: ['مقبولة', 'Accepted'], rejected: ['مرفوضة', 'Rejected'],
  review: ['مراجعة', 'Review'], sending: ['جارٍ الإرسال', 'Sending'],
  pending: ['بالانتظار', 'Queued'], uncertain: ['غير مؤكدة', 'Unconfirmed'],
  not_sent: ['لم تُرسل', 'Not sent'], test: ['تجريبي', 'Test'], unverified: ['تحقق', 'Verify'],
} as const;

/** A quiet, read-only shortcut; opening a status never submits the invoice. */
export function InvoiceZatcaLink({ invoice }: { invoice: Pick<Invoice, 'id' | 'zatcaDelivery' | 'zatcaStatus'> }) {
  const { t } = useLanguage();
  const state = invoiceZatcaState(invoice);
  const label = t(INVOICE_ZATCA_LABELS[state][0], INVOICE_ZATCA_LABELS[state][1]);
  const tone = state === 'accepted' ? 'text-success' : state === 'rejected' ? 'text-danger' : ['not_sent', 'test'].includes(state) ? 'text-muted-foreground' : 'text-warning';
  return <Link to={`/app/invoices/${invoice.id}`} data-zatca-state={state}
    aria-label={`${t('عرض الفاتورة وحالة الهيئة', 'View invoice and ZATCA status')}: ${label}`}
    title={[label, invoice.zatcaDelivery?.message, t('اضغط لمتابعة الحالة', 'Open to review status')].filter(Boolean).join(' · ')}
    onClick={event => event.stopPropagation()}
    className={`inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded px-1 text-[10px] leading-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary ${tone}`}>
    <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-current" />{t(SHORT_LABELS[state][0], SHORT_LABELS[state][1])}
  </Link>;
}
export function InvoiceZatcaBadge({ invoice }: { invoice: Pick<Invoice, 'zatcaDelivery' | 'zatcaStatus'> }) {
  const { t } = useLanguage();
  const state = invoiceZatcaState(invoice);
  const labels = INVOICE_ZATCA_LABELS[state];
  return <StatusBadge data-zatca-state={state} tone={state === 'accepted' ? 'success' : state === 'rejected' ? 'critical' : ['not_sent', 'test'].includes(state) ? 'neutral' : 'warning'} title={invoice.zatcaDelivery?.message || undefined}>{t(labels[0], labels[1])}</StatusBadge>;
}
export function InvoiceZatcaSummary({ invoices }: { invoices: Invoice[] }) {
  const { t } = useLanguage();
  const counts = new Map<string, number>();
  for (const invoice of invoices) { const state = invoiceZatcaState(invoice); counts.set(state, (counts.get(state) || 0) + 1); }
  return <section aria-label={t('حالة فواتير المبيعات لدى الهيئة', 'Sales invoice ZATCA status')} className="space-y-2">
    <h2 className="text-sm font-semibold">{t('حالة الهيئة · الفواتير المعروضة', 'ZATCA status · displayed invoices')}</h2>
    <div className="flex flex-wrap gap-2">{Array.from(counts, ([state, count]) => <span key={state} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">{t(INVOICE_ZATCA_LABELS[state as keyof typeof INVOICE_ZATCA_LABELS][0], INVOICE_ZATCA_LABELS[state as keyof typeof INVOICE_ZATCA_LABELS][1])} <b>{count}</b></span>)}</div>
  </section>;
}
