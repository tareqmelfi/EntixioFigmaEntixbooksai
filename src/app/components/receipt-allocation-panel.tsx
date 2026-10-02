import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type Voucher } from '../lib/api';
import { humanizeError } from '../lib/error-messages';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { DateInput } from './date-input';
import { Input } from './ui/input';

export function ReceiptAllocationPanel({ voucher, onDone }: { voucher: Voucher; onDone: () => void | Promise<void> }) {
  const { t, language } = useLanguage();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [cancelId, setCancelId] = useState('');
  const [reason, setReason] = useState('');
  const [snapshotText, setSnapshotText] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const lock = useRef(false);
  const keys = useRef(new Map<string, string>());
  const reload = async () => {
    setReady(false);
    setSnapshotText(''); setSnapshotUrl('');
    const [v, list] = await Promise.all([api.vouchers.get(voucher.id), api.invoices.list({ contactId: voucher.contactId!, limit: 200 })]);
    setSaved(v.receiptAllocations || []);
    setInvoices(list.items.filter(i => i.contactId === voucher.contactId && i.currency === voucher.currency && !['DRAFT', 'CANCELLED'].includes(i.status) && Number(i.total) > Number(i.amountPaid)));
    setReady(true);
  };
  useEffect(() => { void reload().catch(e => setError(humanizeError(e, language))); }, [voucher.id]);
  useEffect(() => { setSnapshotText(''); setSnapshotUrl(''); }, [invoiceId]);
  useEffect(() => () => { if (snapshotUrl) URL.revokeObjectURL(snapshotUrl); }, [snapshotUrl]);
  if (voucher.invoiceId || !voucher.contactId) return null;
  const available = Number(voucher.amount) - saved.filter(a => !a.cancelledAt).reduce((n, a) => n + Number(a.amount), 0);
  const selected = invoices.find(i => i.id === invoiceId);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try { await action(); }
    catch (e) { setError(humanizeError(e, language, { ar: 'تعذر حفظ المطابقة؛ المدخلات محفوظة هنا. أعد المحاولة بالمطابقة نفسها.', en: 'Could not save the allocation. Your input is retained; retry the same allocation.' })); }
    finally { lock.current = false; setBusy(false); }
  };
  const apply = () => run(async () => {
    const payload = { invoiceId, amount: Number(amount), appliedAt };
    const fingerprint = JSON.stringify(payload);
    if (!keys.current.has(fingerprint)) keys.current.set(fingerprint, crypto.randomUUID());
    const result = await api.vouchers.allocate(voucher.id, { ...payload, requestKey: keys.current.get(fingerprint)! });
    const reread = await api.vouchers.get(voucher.id);
    if (!(reread.receiptAllocations || []).some(a => a.id === result.allocation.id && !a.cancelledAt)) throw new Error(t('لم يثبت حفظ المطابقة. أعد القراءة قبل أي إجراء آخر.', 'Allocation could not be verified. Refresh before another action.'));
    await reload(); await onDone(); setAmount(''); setInvoiceId('');
    setSuccess(t('تم حفظ المطابقة والتحقق منها. لم يُنشأ قبض أو قيد إضافي.', 'Allocation saved and verified. No additional receipt or journal was created.'));
  });
  const snapshot = () => run(async () => {
    setSnapshotText(''); setSnapshotUrl('');
    const data = await api.vouchers.allocationPreview(voucher.id, invoiceId || saved.find(a => !a.cancelledAt)?.invoiceId || undefined);
    const text = JSON.stringify(data, null, 2);
    setSnapshotText(text);
    setSnapshotUrl(URL.createObjectURL(new Blob([text], { type: 'application/json' })));
  });
  return <section aria-label={t('مطابقة قبض موجود', 'Apply existing receipt')} className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">{t('مطابقة قبض موجود', 'Apply existing receipt')}</h3>
    <p className="text-xs text-muted-foreground">{t('يُطبّق رصيد السند على الفاتورة دون تغيير تاريخ الاستلام أو تسجيل قبض جديد.', 'Apply this receipt to an invoice without changing its receipt date or recording new cash.')}</p>
    <p className="text-sm">{t('تاريخ الاستلام', 'Receipt date')}: <bdi>{voucher.date.slice(0, 10)}</bdi> · {t('المتاح', 'Available')}: <bdi>{available.toFixed(2)} {voucher.currency}</bdi></p>
    {error && <p role="alert" className="text-sm text-danger">{error} {!ready && <Button variant="outline" size="sm" onClick={() => run(reload)}>{t('إعادة المحاولة', 'Retry')}</Button>}</p>}
    {success && <p role="status" className="text-sm text-success">{success}</p>}
    {available > 0 && <div className="space-y-2">
      <label className="block text-xs">{t('الفاتورة', 'Invoice')}
        <select aria-label={t('فاتورة المطابقة', 'Allocation invoice')} className="w-full rounded border border-border bg-card p-2" value={invoiceId} disabled={!ready || busy} onChange={e => {
          const invoice = invoices.find(i => i.id === e.target.value); setInvoiceId(e.target.value); setAmount(invoice ? Math.min(available, Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2) : '');
        }}><option value="">{t('اختر فاتورة للعميل', 'Choose a customer invoice')}</option>{invoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNumber} · {Number(i.total) - Number(i.amountPaid)} {i.currency}</option>)}</select>
      </label>
      {selected && <p className="text-xs">{t('تاريخ إصدار الفاتورة', 'Invoice issue date')}: <bdi>{selected.issueDate.slice(0, 10)}</bdi></p>}
      <div className="grid grid-cols-2 gap-2"><label className="text-xs">{t('مبلغ المطابقة', 'Allocation amount')}<Input aria-label={t('مبلغ المطابقة', 'Allocation amount')} disabled={busy} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label className="text-xs">{t('تاريخ المطابقة', 'Application date')}<DateInput disabled={busy} value={appliedAt} onChange={setAppliedAt} /></label></div>
      <Button size="sm" disabled={busy || !ready || !selected || Number(amount) <= 0} onClick={apply}>{t('تطبيق الرصيد الموجود', 'Apply existing balance')}</Button>
    </div>}
    <Button size="sm" variant="outline" disabled={busy} onClick={snapshot}>{t('تنزيل سجل المطابقة', 'Download allocation snapshot')}</Button>
    {snapshotText && <div className="space-y-2 text-xs">
      <p>{t('نسخة للقراءة فقط من السند والفاتورة والقيود في وقت جلب السجل.', 'Read-only snapshot of the receipt, invoice and journals at the time it was retrieved.')}</p>
      <a className="text-primary underline" href={snapshotUrl} download={`${voucher.number}-allocation-snapshot.json`}>{t('حفظ ملف سجل المطابقة', 'Save allocation snapshot file')}</a>
      <details><summary className="cursor-pointer">{t('عرض بيانات سجل المطابقة', 'View allocation snapshot data')}</summary>
        <textarea aria-label={t('بيانات سجل المطابقة', 'Allocation snapshot data')} readOnly value={snapshotText} dir="ltr" rows={8} className="w-full rounded border border-border bg-card p-2 font-mono text-xs" />
      </details>
    </div>}
    {saved.map(a => <div key={a.id} className="border-t border-border pt-2 text-xs space-y-2">
      <Link className="text-primary underline" to={`/app/invoices/${a.invoiceId}`}>{a.invoice?.invoiceNumber || a.invoiceId}</Link> · <bdi>{Number(a.amount).toFixed(2)} {voucher.currency}</bdi> · <bdi>{a.appliedAt.slice(0, 10)}</bdi>
      {a.cancelledAt ? <span>{t('أُلغيت المطابقة', 'Allocation cancelled')}</span> : cancelId !== a.id ? <Button variant="outline" size="sm" disabled={busy} onClick={() => { setCancelId(a.id); setReason(''); }}>{t('إلغاء المطابقة', 'Cancel allocation')}</Button> : <div className="space-y-2">
        <Input aria-label={t('سبب إلغاء المطابقة', 'Reason for cancelling allocation')} value={reason} onChange={e => setReason(e.target.value)} />
        <Button size="sm" disabled={busy || !reason.trim()} onClick={() => run(async () => { await api.vouchers.cancelAllocation(voucher.id, a.id, reason); await reload(); await onDone(); setCancelId(''); setSuccess(t('أُلغيت المطابقة فقط؛ السند والقيد محفوظان.', 'Only the allocation was cancelled; the receipt and journal remain.')); })}>{t('تأكيد إلغاء المطابقة', 'Confirm cancellation')}</Button>
        <Button size="sm" variant="outline" onClick={() => setCancelId('')}>{t('رجوع', 'Back')}</Button>
      </div>}
    </div>)}
  </section>;
}
