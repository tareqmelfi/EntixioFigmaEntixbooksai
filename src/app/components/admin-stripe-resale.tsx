import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';

/** Explicit per-invoice routing, never a rule based on the buyer's country. */
export function AdminStripeResale({ source, supplierName, onPrepared, onClose }: { source: any; supplierName: string; onPrepared: () => void; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [options, setOptions] = useState<any>({ organizations: [], invoices: [] });
  const [orgId, setOrgId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [wholesale, setWholesale] = useState('');
  const [feeBearer, setFeeBearer] = useState<'SUPPLIER' | 'RESELLER'>('SUPPLIER');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let alive = true; setLoading(true); setInvoiceId('');
    api.admin.resaleOptions(orgId).then(r => { if (alive) setOptions(r); }).catch(() => { if (alive) setError(t('تعذر تحميل فواتير الوكيل', 'Could not load reseller invoices')); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, t]);
  const selected = options.invoices.find((i: any) => i.id === invoiceId);
  const amount = Number(wholesale), valid = /^\d+(\.\d{1,2})?$/.test(wholesale) && amount > 0 && amount * 100 <= source.totalMinor;
  const prepare = async () => {
    if (!selected || !valid) return;
    setBusy(true); setError('');
    try { await api.admin.prepareResale({ stripeInvoiceId: source.stripeInvoiceId, resellerOrgId: orgId, finalInvoiceId: invoiceId, wholesaleMinor: Math.round(amount * 100), feeBearer }); onPrepared(); }
    catch (e) { setError(e instanceof ApiError ? (language === 'ar' ? e.messageAr || e.message : e.message) : t('تعذر تجهيز المستندات', 'Preparation failed')); }
    finally { setBusy(false); }
  };
  return <section className="border border-border rounded-xl p-4 bg-background space-y-4" aria-label={t('بيع عبر وكيل', 'Reseller sale')}>
    <div className="flex justify-between gap-3"><h3 className="font-semibold">{t('تجهيز بيع عبر وكيل', 'Prepare reseller sale')} · <bdi>{source.number}</bdi></h3><Button variant="ghost" disabled={busy} onClick={onClose}>{t('إغلاق', 'Close')}</Button></div>
    <p className="text-sm text-muted-foreground">{t('الافتراضي هو البيع المباشر من ENSIDEX. هذا الاختيار يخص هذه العملية فقط، ويربط فاتورة الوكيل الأصلية بتحصيل Stripe.', 'ENSIDEX direct sales are the default. This selection applies only to this sale and links the reseller’s original invoice to the Stripe collection.')}</p>
    <div className="grid md:grid-cols-2 gap-4">
      <label className="space-y-1 text-sm"><span>{t('الوكيل البائع للعميل', 'Reseller selling to the customer')}</span><select className="w-full border rounded-lg p-2 bg-card" value={orgId} disabled={busy} onChange={e => setOrgId(e.target.value)}><option value="">{t('اختر المنشأة', 'Select company')}</option>{options.organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name} · {o.country}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t('الفاتورة الأصلية للعميل', 'Original customer invoice')}</span><select className="w-full border rounded-lg p-2 bg-card" value={invoiceId} disabled={busy || loading || !orgId} onChange={e => setInvoiceId(e.target.value)}><option value="">{loading ? t('جارٍ التحميل', 'Loading') : t('اختر فاتورة مطابقة للمبلغ والعملة', 'Select a matching amount and currency')}</option>{options.invoices.filter((i: any) => i.currency === source.currency && Math.round(Number(i.total) * 100) === source.totalMinor).map((i: any) => <option key={i.id} value={i.id}>{i.invoiceNumber} · {i.contact.displayName}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t('سعر توريد ENSIDEX للوكيل قبل الضريبة', 'ENSIDEX wholesale price before tax')} · {source.currency}</span><input className="w-full border rounded-lg p-2 bg-card" inputMode="decimal" value={wholesale} disabled={busy} onChange={e => setWholesale(e.target.value)} /></label>
      <label className="space-y-1 text-sm"><span>{t('يتحمّل رسوم Stripe', 'Stripe fee bearer')}</span><select className="w-full border rounded-lg p-2 bg-card" value={feeBearer} disabled={busy} onChange={e => setFeeBearer(e.target.value as 'SUPPLIER' | 'RESELLER')}><option value="SUPPLIER">{supplierName} · {t('الافتراضي', 'Default')}</option><option value="RESELLER">{t('الوكيل', 'Reseller')}</option></select></label>
    </div>
    {selected && valid && <div className="text-sm bg-muted/40 rounded-lg p-3 space-y-1">
      <p>{t('تحصيل العميل', 'Customer collection')}: <bdi>{(source.totalMinor / 100).toFixed(2)} {source.currency}</bdi></p>
      <p>{t('ضريبة فاتورة الوكيل', 'Reseller invoice tax')}: <bdi>{Number(selected.taxTotal).toFixed(2)} {source.currency}</bdi></p>
      <p>{t('هامش الوكيل قبل الرسوم والضرائب الأخرى', 'Reseller margin before fees and other taxes')}: <bdi>{(source.totalMinor / 100 - Number(selected.taxTotal) - amount).toFixed(2)} {source.currency}</bdi></p>
      <p>{t('المستحق للوكيل قبل الرسوم وتسويات الضرائب الأخرى', 'Due to reseller before fees and other tax adjustments')}: <bdi>{(source.totalMinor / 100 - amount).toFixed(2)} {source.currency}</bdi></p>
    </div>}
    <p className="text-xs text-muted-foreground">{t('يُنشئ مسودة فاتورة توريد لدى ENSIDEX ومسودة مشتريات لدى الوكيل، مع الإبقاء على فاتورة العميل الأصلية. اعتماد الضريبة على التوريد والخدمات المستوردة مطلوب قبل الترحيل والتسوية. لن يرسل فواتير أو يخصم مبالغ من العميل.', 'Creates a wholesale invoice draft in ENSIDEX and a purchase draft in the reseller’s books, retaining the original customer invoice. Supply and imported-service tax must be reviewed before posting and settlement. No invoice is sent and no customer is charged.')}</p>
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
    <Button disabled={busy || loading || !selected || !valid} onClick={() => void prepare()}>{busy ? t('جارٍ التجهيز', 'Preparing') : t('تجهيز المستندات المرتبطة', 'Prepare linked documents')}</Button>
  </section>;
}
