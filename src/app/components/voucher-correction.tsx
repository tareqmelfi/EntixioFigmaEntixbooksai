import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, getOrgId } from '../lib/api';
import { humanizeError } from '../lib/error-messages';
import { useLanguage } from './LanguageContext';
import { FullPageForm } from './full-page-form';
import { VoucherPaymentMethod, voucherMethodPayload } from './voucher-payment-method';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function VoucherCorrection({ id, initialAction = 'edit', onClose, onDone }: {
  id: string; initialAction?: 'edit' | 'delete'; onClose: () => void; onDone: (deleted: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [review, setReview] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [action, setAction] = useState(initialAction);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const orgId = getOrgId();
  useEffect(() => {
    let live = true;
    setReview(null); setError(''); setConfirm('');
    api.vouchers.correctionReview(id).then(result => {
      if (live && orgId === getOrgId()) { setReview(result); setForm({ ...result.voucher, date: result.voucher.date.slice(0,10) }); }
    }).catch(e => { if (live) setError(humanizeError(e, language, { ar: 'تعذر تحميل مراجعة السند', en: 'Could not load voucher review' })); });
    return () => { live = false; };
  }, [id, retry, orgId]);
  const blockers: Record<string, [string, string]> = {
    provider_managed: ['هذا السداد تديره بوابة الدفع؛ راجع العملية في البوابة قبل التصحيح.', 'The payment provider manages this settlement. Review the provider transaction first.'],
    bank_match: ['السند مطابق لحركة بنكية. فك المطابقة من التسوية البنكية أولًا.', 'This voucher matches a bank transaction. Remove the match in Bank reconciliation first.'],
    allocations: ['للسند سجل توزيع على فواتير. يحتاج تصحيحًا يشمل المطابقات؛ هذا الإجراء لا يدعم هذه الحالة حاليًا.', 'This voucher has invoice allocation history. A coordinated allocation correction is required; this action does not yet support that case.'],
    delivery_or_signature: ['للسند إرسال قيد التنفيذ أو طلب توقيع؛ راجعه قبل التصحيح.', 'This voucher has a queued delivery or signature request. Review it before correcting.'],
    period_locked: ['تاريخ السند في فترة مقفلة. أعد فتح الفترة بالصلاحية المناسبة قبل التصحيح.', 'The voucher date is in a closed period. Reopen the period with the appropriate permission first.'],
    ledger_review: ['القيد الحالي يحتاج مراجعة قبل التصحيح؛ افتح القيود المرتبطة بالسند.', 'The current journal needs review before correction. Open the voucher journals.'],
    linked_document: ['رصيد المستند المرتبط لا يطابق السند؛ راجعه أولًا.', 'The linked document balance does not match this voucher. Review it first.'],
    currency_review: ['تحتاج هذه العملة تسوية صرف قبل التصحيح.', 'This currency requires an exchange settlement review before correction.'],
  };
  const blocker = action === 'delete' ? (review?.deleteReason === undefined ? review?.reason : review.deleteReason) : review?.reason;
  const submit = async () => {
    if (lock.current || !review || blocker || orgId !== getOrgId()) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await api.vouchers.correct(id, { version: review.version, action, reason: reason.trim(), confirmNumber: confirm.trim(),
        ...(action === 'edit' ? { date: `${form.date}T00:00:00.000Z`, amount: Number(form.amount), ...voucherMethodPayload(form), paymentMethodConfigId: form.paymentMethodConfigId || null, reference: form.reference || null, notes: form.notes || null } : {}) });
      onDone(result.deleted);
    } catch (e) { setError(humanizeError(e, language, { ar: 'لم يطبق التصحيح. راجع البيانات أو أعد تحميل المراجعة.', en: 'Correction was not applied. Review the details or reload the review.' })); }
    finally { lock.current = false; setBusy(false); }
  };
  const linked = review?.linkedDocument;
  const projectedPaid = linked ? Number(linked.paid) - Number(review.voucher.amount) + (action === 'edit' ? Number(form.amount || 0) : 0) : null;
  return <FullPageForm title={t('تعديل السند أو حذفه', 'Edit or delete voucher')} subtitle={review?.voucher.number} onClose={onClose} disableEscape={busy}
    footer={<div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>{t('رجوع', 'Back')}</Button><Button disabled={busy || !review || !!blocker || reason.trim().length < 3 || confirm.trim() !== review.voucher.number || (action === 'edit' && (!form.date || !(Number(form.amount) > 0)))} variant={action === 'delete' ? 'destructive' : 'default'} onClick={submit}>{busy ? t('جار التطبيق…', 'Applying…') : action === 'delete' ? t('حذف نهائي وعكس السداد', 'Delete permanently and reverse settlement') : t('حفظ التصحيح', 'Save correction')}</Button></div>}>
    <div className="max-w-4xl space-y-5">
      {error && <p role="alert" className="text-danger">{error}</p>}
      <Button variant="outline" disabled={busy} onClick={() => setRetry(n => n + 1)}>{t('إعادة تحميل المراجعة', 'Reload review')}</Button>
      {!review ? <p>{t('جار تحميل السند…', 'Loading voucher…')}</p> : <>
        <p><bdi>{review.voucher.contact?.displayName}</bdi> · {review.voucher.amount} {review.voucher.currency}</p>
        {review.recordedAccount && <p className="text-sm">{t('الحساب المرحّل حاليًا', 'Currently posted account')}: {review.recordedAccount.code} · {language === 'ar' ? review.recordedAccount.nameAr || review.recordedAccount.name : review.recordedAccount.name}. {t('يبقى هذا الحساب إذا لم تغيّر طريقة الدفع أو حسابها.', 'This account is retained unless you change the payment method or account.')}</p>}
        <div className="flex gap-3"><Button variant={action === 'edit' ? 'default' : 'outline'} disabled={busy} onClick={() => { setAction('edit'); setConfirm(''); }}>{t('تعديل', 'Edit')}</Button><Button variant={action === 'delete' ? 'destructive' : 'outline'} disabled={busy} onClick={() => { setAction('delete'); setConfirm(''); }}>{t('حذف نهائي', 'Permanent deletion')}</Button></div>
        {blocker && <div role="alert" className="border border-border rounded-lg p-4 space-y-2"><p>{t(...(blockers[blocker] || blockers.ledger_review))}</p><Link className="text-primary underline" to={blocker === 'bank_match' ? '/app/bank-reconciliation' : '/app/journals'}>{t('فتح السجل المرتبط', 'Open related records')}</Link></div>}
        <p className="text-sm text-muted-foreground">{action === 'delete' ? t('يُحذف السند ومرفقاته ويُعكس السداد. تبقى القيود وسجل المراجعة، ولا يُعاد المال للعميل تلقائيًا.', 'The voucher and attachments are removed and settlement is reversed. Journals and audit history remain. This does not issue a refund.') : t('يُحفظ القيد السابق ويُعكس ثم يُسجل التصحيح مع تحديث رصيد الفاتورة والحساب.', 'The previous journal is retained and reversed, then the correction is posted and the document and account balances are updated.')}</p>
        {linked && <p>{t('المستند المرتبط', 'Linked document')}: <Link className="text-primary underline" to={linked.type === 'invoice' ? `/app/invoices/${linked.id}` : `/app/purchases/bills/${linked.id}`}>{linked.number}</Link> · {t('المسدّد بعد الإجراء', 'Paid after this action')}: {projectedPaid?.toFixed(2)} {review.voucher.currency}</p>}
        <fieldset disabled={busy || !!blocker} className="space-y-4">
          {action === 'edit' && <>
            <div className="grid sm:grid-cols-2 gap-4"><label>{t('تاريخ السداد', 'Payment date')}<Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label>{t('المبلغ', 'Amount')}<Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label></div>
            <VoucherPaymentMethod usage={review.voucher.type === 'RECEIPT' ? 'receipt' : 'payment'} currency={review.voucher.currency} value={form} onChange={selection => setForm((previous: any) => ({ ...previous, ...selection }))} />
            <label className="block">{t('المرجع', 'Reference')}<Input value={form.reference || ''} onChange={e => setForm({ ...form, reference: e.target.value })} /></label>
            <label className="block">{t('الملاحظات', 'Notes')}<Input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          </>}
          <label className="block">{t('سبب التصحيح أو الحذف', 'Reason for correction or deletion')}<Input value={reason} onChange={e => setReason(e.target.value)} /></label>
          <label className="block">{t('اكتب رقم السند للتأكيد', 'Type the voucher number to confirm')}<Input dir="ltr" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        </fieldset>
      </>}
    </div>
  </FullPageForm>;
}
