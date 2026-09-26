import { AdminStripeResale } from './admin-stripe-resale';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { RefreshCw, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { rememberTabOrgId } from '../lib/tab-org-selection';
import { api, ApiError } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { displayLocale } from '../lib/number-display';
import { Button } from './ui/button';

export function AdminBillingLedger() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [resaleSource, setResaleSource] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await api.admin.billingLedger()); setError(''); }
    catch (e) { setError(e instanceof ApiError ? (language === 'ar' ? e.messageAr || e.message : e.message) : t('تعذر تحميل الفوترة', 'Billing could not be loaded')); }
  }, [language, t]);
  useEffect(() => { void load(); }, [load]);
  const sync = async () => {
    setBusy(true); setMessage('');
    try { const r = await api.admin.syncBillingLedger(); await load(); setMessage(r.ok ? t('اكتملت المزامنة مع Stripe. راجع حالة الترحيل لكل فاتورة أدناه.', 'Stripe sync completed. Accounting status is shown for each invoice below.') : t('اكتملت مراجعة السجلات المتاحة؛ توجد مراجع اشتراك تحتاج مراجعة.', 'Available records synced; some subscription references need review.')); }
    catch (e) { setError(e instanceof ApiError ? e.messageAr || e.message : t('تعذرت المزامنة', 'Sync failed')); }
    finally { setBusy(false); }
  };
  const openAccounting = (id: string, sellerId: string) => {
    if (!sellerId || !rememberTabOrgId(sellerId)) { setError(t('تعذر حفظ اختيار حساب ENSIDEX في التبويب.', 'Could not save the ENSIDEX company selection.')); return; }
    window.location.assign(`/app/invoices/${id}`);
  };
  const money = (n: number, currency: string) => `${(n / 100).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const date = (s: string) => s ? new Date(s).toLocaleString(displayLocale('en-GB')) : '—';
  return <section className="rounded-xl border border-border bg-card p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-foreground">{t('مبيعات ENSIDEX والوكلاء في Stripe', 'ENSIDEX & agent sales in Stripe')}</h2><p className="text-xs text-muted-foreground mt-1">{data?.seller?.name || 'ENSIDEX LLC'} · {t('الفواتير والدفعات الأصلية مع حالة الترحيل المحاسبي', 'Original invoices and payments with accounting status')}</p></div>
      {data?.canSync && <Button variant="outline" disabled={busy} onClick={() => void sync()}><RefreshCw className={`h-4 w-4 me-2 ${busy ? 'animate-spin' : ''}`} />{busy ? t('جارٍ التحقق', 'Checking') : t('مزامنة مع Stripe', 'Sync with Stripe')}</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
    {data && !data.configured && <p className="text-sm text-warning">{t('ربط حساب البائع يحتاج إعدادًا.', 'Seller account configuration is required.')}</p>}
    <div className="flex flex-wrap gap-3">{Object.entries(data?.totals || {}).map(([cur, value]: [string, any]) => <div key={cur} className="rounded-lg bg-muted/40 p-3 text-xs space-y-1"><div>{t('المبيعات', 'Invoiced')}: <bdi>{money(value.invoiced, cur)}</bdi></div><div>{t('التحصيل', 'Collected')}: <bdi>{money(value.paid, cur)}</bdi></div><div>{t('المتبقي', 'Outstanding')}: <bdi>{money(value.remaining, cur)}</bdi></div>{value.refunded > 0 && <div>{t('المسترد', 'Refunded')}: <bdi>{money(value.refunded, cur)}</bdi></div>}</div>)}</div>
    {resaleSource && <AdminStripeResale source={resaleSource} supplierName={data?.seller?.name || 'ENSIDEX LLC'} onClose={() => setResaleSource(null)} onPrepared={() => { setResaleSource(null); void load(); setMessage(t('تم تجهيز المستندات كمسودات مرتبطة؛ اعتماد المعالجة الضريبية والتسوية ما زال مطلوبًا.', 'Linked drafts prepared; tax approval and settlement are still required.')); }} />}
    {(data?.resales || []).map((r: any) => <div key={r.id} className="border rounded-lg p-3 text-xs space-y-2"><p>{t('بيع عبر وكيل · مسودات بانتظار اعتماد الضريبة والتسوية', 'Reseller sale · drafts awaiting tax approval and settlement')} · <bdi>{r.stripeInvoiceId}</bdi></p><p>{t('رسوم Stripe على', 'Stripe fees borne by')}: {r.feeBearer === 'SUPPLIER' ? data?.seller?.name : data.sellers?.find((s: any) => s.id === r.resellerOrgId)?.name}</p><div className="flex flex-wrap gap-4"><button className="text-primary" onClick={() => openAccounting(r.supplierInvoiceId, r.supplierOrgId)}>{t('فاتورة التوريد', 'Wholesale invoice')}</button><button className="text-primary" onClick={() => openAccounting(r.finalInvoiceId, r.resellerOrgId)}>{t('فاتورة العميل الأصلية', 'Original customer invoice')}</button><button className="text-primary" onClick={() => { if (rememberTabOrgId(r.resellerOrgId)) window.location.assign(`/app/purchases/bills/${r.purchaseBillId}`); }}>{t('فاتورة مشتريات الوكيل', 'Reseller purchase bill')}</button></div></div>)}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{[t('المنشأة والفاتورة', 'Company & invoice'), t('الدفع', 'Payment'), t('التجديد', 'Renewal'), t('المزامنة', 'Sync'), t('المستند', 'Document')].map(x => <th key={x} className="p-3 text-start">{x}</th>)}</tr></thead><tbody>
      {(data?.invoices || []).map((i: any) => { const customer = data.customers.find((x: any) => x.orgId === i.orgId); return <tr key={i.id} className="border-b border-border/60 align-top">
        <td className="p-3">{i.orgId ? <Link className="text-primary" to={`/admin/orgs/${i.orgId}?tab=subscription`}>{customer?.legalName || i.customerName}</Link> : <span>{i.customerName || '—'}</span>}<div className="mt-1 text-xs text-muted-foreground">{t('البائع', 'Seller')}: {i.ledgerError === 'seller_identity_required' ? t('يحتاج تحديدًا قبل الترحيل', 'Review before posting') : data.sellers?.find((s: any) => s.id === i.sellerOrgId)?.name || '—'}</div><div className="text-xs mt-1"><bdi>{i.number}</bdi> · <bdi>{money(i.totalMinor, i.currency)}</bdi></div>{i.customerName && i.customerName !== customer?.legalName && <div className="text-xs text-warning mt-1">{t('اسم الفاتورة الأصلية', 'Original invoice name')}: {i.customerName}</div>}</td>
        <td className="p-3"><span className={i.status === 'paid' ? 'text-success' : 'text-warning'}>{i.status === 'paid' ? t('مدفوعة', 'Paid') : i.status}</span><div className="text-xs mt-1">{t('المتبقي', 'Remaining')}: <bdi>{money(i.remainingMinor, i.currency)}</bdi></div></td>
        <td className="p-3 text-xs"><div>{!customer ? t('بيع خارج اشتراكات Entix', 'External sale') : customer?.subscriptionStatus === 'canceled' ? t('أُلغي', 'Canceled') : customer?.cancelAtPeriodEnd ? t('الإلغاء نهاية الفترة', 'Cancels at period end') : t('التجديد القادم', 'Next renewal')}</div><bdi>{date(customer?.currentPeriodEnd)}</bdi></td>
        <td className="p-3 text-xs"><div className={`flex gap-1 items-center ${['POSTED', 'LINKED'].includes(i.ledgerStatus) ? 'text-success' : 'text-warning'}`}>{['POSTED', 'LINKED'].includes(i.ledgerStatus) ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{['POSTED', 'LINKED'].includes(i.ledgerStatus) ? t('الفاتورة محفوظة ومطابقة', 'Invoice saved and matched') : i.ledgerStatus === 'INTERNAL' ? t('اشتراك داخلي للبائع · للمراجعة', 'Seller internal subscription · review') : t('الترحيل يحتاج مراجعة', 'Accounting needs review')}</div>{customer && customer.identityStatus !== 'MATCHED' && <div className="text-warning">{t('هوية الفوترة تحتاج مطابقة', 'Billing identity needs review')}</div>}{i.ledgerError && <div className="mt-1" dir="ltr">{i.ledgerError}</div>}<div className="mt-1 text-muted-foreground"><bdi>{date(i.syncedAt)}</bdi></div></td>
        <td className="p-3 text-xs space-y-2">{i.hostedInvoiceUrl && <a href={i.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="flex gap-1 text-primary"><FileText className="h-4 w-4" />{t('أصل Stripe', 'Stripe original')}</a>}{data?.canSync && i.status === 'paid' && !data?.resales?.some((r: any) => r.stripeInvoiceId === i.stripeInvoiceId) && !['POSTED', 'LINKED'].includes(i.ledgerStatus) && <button className="block text-primary" onClick={() => setResaleSource(i)}>{t('بيع محدد عبر وكيل', 'Assign this sale to a reseller')}</button>}{i.accountingInvoiceId && <button type="button" onClick={() => openAccounting(i.accountingInvoiceId, i.sellerOrgId)} className="block text-primary">{t('فتح فاتورة البائع', 'Open seller invoice')}</button>}</td>
      </tr>; })}
      {data && !data.invoices.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t('لا توجد فواتير مزامنة بعد.', 'No invoices synced yet.')}</td></tr>}
    </tbody></table></div>
    {!!data?.events?.length && <p className="text-xs text-warning">{t('أحداث Stripe بانتظار المعالجة أو إعادة المحاولة', 'Stripe events awaiting processing or retry')}: {data.events.length}</p>}
  </section>;
}
