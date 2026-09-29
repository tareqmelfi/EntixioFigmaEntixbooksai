import type { Invoice } from '../lib/api';
import { invoiceZatcaState, INVOICE_ZATCA_LABELS } from '../lib/invoice-zatca-state';
import { useLanguage } from './LanguageContext';
import { StatusBadge } from './product';
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
