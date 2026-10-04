import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, getOrgId, type Invoice } from '../lib/api';
import { humanizeError } from '../lib/error-messages';
import { useLanguage } from './LanguageContext';
import { FullPageForm } from './full-page-form';
import { InlineConfirm } from './side-panel';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

type Policy = Awaited<ReturnType<typeof api.invoices.amendmentPolicy>> & {
  canEditDraft?: boolean; voidReason?: string | null;
  relatedCreditNote?: { id: string; noteNumber: string } | null;
};
type Row = { id: string; invoice?: Invoice; policy?: Policy; deletion?: Awaited<ReturnType<typeof api.invoices.deletionPolicy>>; error?: string; done?: boolean };
const rowAction = (row: Row, mode: 'permanent' | 'void') => row.done ? null : mode === 'permanent' ? row.deletion?.canDeletePermanently ? 'permanent' : null : row.invoice?.status === 'DRAFT'
  ? row.policy?.canEditDraft ? 'delete' : null
  : row.policy?.canVoidAdmin ? 'void' : null;

/** Review only on entry. Existing tenant-scoped endpoints remain the authority. */
export function InvoiceRemovalReview({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<Row[]>(ids.map(id => ({ id })));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'permanent' | 'void'>('permanent');
  const action = (row: Row) => rowAction(row, mode);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const orgId = useRef(getOrgId());
  const messages: Record<string, [string, string]> = {
    credit_note: ['راجع الإشعار الدائن المرتبط قبل الحذف أو الإلغاء.', 'Review the linked credit note before deletion or voiding.'],
    receipts_exist: ['توجد دفعات أو تسويات مرتبطة؛ راجعها وفكّ تخصيصها قبل الحذف أو الإلغاء.', 'Linked payments or settlements must be reviewed and unapplied before deletion or voiding.'],
    payment_link: ['أوقف رابط الدفع النشط قبل الحذف أو الإلغاء.', 'Retire the active payment link before deletion or voiding.'],
    period_closed: ['الفترة مقفلة؛ راجع إعدادات الفترات المالية.', 'The period is closed; review fiscal period settings.'],
    external_source: ['المستند متزامن؛ صحّح مصدره ثم زامنه.', 'This document is synchronized; correct its source, then synchronize.'],
    saudi_issued_invoice: ['هذه المنشأة مرتبطة بالمرحلة الثانية؛ استخدم إشعارًا مرتبطًا للتصحيح.', 'This company is connected to Phase 2; use a linked correction note.'],
    zatca_record: ['للمستند سجل فوترة إلكترونية محمي؛ استخدم مسار التصحيح.', 'This document has a protected e-invoicing record; use the correction workflow.'],
    invoice_state: ['الفاتورة ملغاة أو حالتها لا تسمح بهذا الإجراء.', 'The invoice is cancelled or its state does not allow this action.'],
    related_document: ['توجد مستندات أو جداول مرتبطة؛ راجعها من الفاتورة.', 'Review related documents or schedules from the invoice.'],
    ledger_review: ['يلزم مراجعة قيد الفاتورة أولًا.', 'The invoice journal needs review first.'],
    void_role_required: ['إلغاء الصادرة متاح لمالك الشركة أو مديرها.', 'Voiding issued invoices requires the company owner or administrator.'],
    role_required: ['صلاحياتك لا تسمح بهذا الإجراء.', 'Your permissions do not allow this action.'],
  };
  const readRow = async (id: string): Promise<Row> => {
    try {
      const [invoice, policy, deletion] = await Promise.all([api.invoices.get(id), api.invoices.amendmentPolicy(id), api.invoices.deletionPolicy(id)]);
      return { id, invoice, policy, deletion };
    } catch (e) { return { id, error: humanizeError(e, language, { ar: 'تعذر التحقق؛ أعد المحاولة.', en: 'Could not verify; retry.' }) }; }
  };
  useEffect(() => {
    let alive = true;
    // Bound concurrent reads for a large selection.
    void (async () => {
      const loaded: Row[] = [];
      for (let offset = 0; offset < ids.length; offset += 10) loaded.push(...await Promise.all(ids.slice(offset, offset + 10).map(readRow)));
      if (alive) { setRows(loaded); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [ids]);
  const eligible = rows.filter(row => action(row));
  const needsReason = eligible.some(row => action(row) === 'void');
  const execute = async () => {
    if (running.current || !eligible.length || (needsReason && reason.trim().length < 5)) return;
    running.current = true; setBusy(true); setConfirming(false);
    try {
      for (const row of eligible) {
        if (!mounted.current) break;
        let result = row;
        try {
          if (getOrgId() !== orgId.current) { result = { ...row, error: t('تغيّرت الشركة؛ أعد فتح المراجعة.', 'Company changed; reopen this review.') }; setRows(current => current.map(item => item.id === row.id ? result : item)); break; }
          const fresh = await readRow(row.id);
          if (fresh.error) { setRows(current => current.map(item => item.id === row.id ? { ...row, error: fresh.error } : item)); continue; }
          if (!mounted.current) break;
          if (getOrgId() !== orgId.current) throw new Error(t('تغيّرت الشركة؛ أعد فتح المراجعة.', 'Company changed; reopen this review.'));
          // Do not silently turn a reviewed draft deletion into an issued void.
          if (action(fresh) !== action(row) || fresh.invoice?.updatedAt !== row.invoice?.updatedAt) {
            setRows(current => current.map(item => item.id === row.id ? { ...row, error: t('تغيّرت الفاتورة أو صلاحية الإجراء؛ أعد التحقق قبل التأكيد.', 'Invoice or action access changed; recheck before confirming.') } : item)); continue;
          }
          if (action(row) === 'permanent') {
            const deleted = await api.invoices.deletePermanently(row.id, { expectedUpdatedAt: row.invoice!.updatedAt!, confirmInvoiceNumber: row.invoice!.invoiceNumber, ...(reason.trim() ? { reason: reason.trim() } : {}) });
            if (!deleted.deleted || deleted.id !== row.id) throw new Error(t('لم يتأكد الحذف؛ أعد التحقق.', 'Deletion was not confirmed; recheck.'));
          } else if (action(row) === 'delete') await api.invoices.remove(row.id);
          else await api.invoices.voidInvoiceAdmin(row.id, { reason: reason.trim(), expectedUpdatedAt: row.invoice!.updatedAt! });
          result = { ...row, done: true, error: undefined };
        } catch (e) { result = { ...row, error: humanizeError(e, language, { ar: 'تعذر تنفيذ الإجراء', en: 'Action failed' }) }; }
        setRows(current => current.map(item => item.id === row.id ? result : item));
      }
    } finally { running.current = false; setBusy(false); }
  };
  return <FullPageForm title={t('مراجعة حذف / إلغاء الفواتير', 'Review invoice deletion / voiding')}
    onClose={onClose} disableEscape={busy}
    footer={<div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={busy} onClick={onClose}>{t('رجوع', 'Back')}</Button>
      {confirming ? <InlineConfirm label={mode === 'permanent' ? t(`حذف ${eligible.length} فاتورة نهائيًا؟ لا يمكن التراجع.`, `Permanently delete ${eligible.length} invoice(s)? This cannot be undone.`) : t(`تنفيذ الإجراء على ${eligible.length} فاتورة؟`, `Apply actions to ${eligible.length} invoice(s)?`)} onConfirm={execute} onCancel={() => setConfirming(false)} />
        : <Button disabled={loading || busy || !eligible.length || (needsReason && reason.trim().length < 5)} onClick={() => setConfirming(true)}>{busy ? t('جارٍ التنفيذ…', 'Applying…') : t(`تنفيذ المتاح (${eligible.length})`, `Apply available (${eligible.length})`)}</Button>}
    </div>}>
    <div className="space-y-4">
      <fieldset className="flex flex-wrap gap-4" disabled={busy || rows.some(row => row.done)}><legend className="mb-2 text-sm">{t('الإجراء', 'Action')}</legend>
        <label className="flex items-center gap-2"><input type="radio" name="removal-mode" checked={mode === 'permanent'} onChange={() => { setMode('permanent'); setConfirming(false); }} />{t('حذف نهائي', 'Permanent deletion')}</label>
        <label className="flex items-center gap-2"><input type="radio" name="removal-mode" checked={mode === 'void'} onChange={() => { setMode('void'); setConfirming(false); }} />{t('إلغاء مع الاحتفاظ بالفاتورة', 'Void and retain invoice')}</label>
      </fieldset>
      <p className="text-sm">{mode === 'permanent' ? t('تُحذف الفاتورة وبنودها ومرفقاتها من النظام، بما فيها الملغاة. يُعكس أثر الصادرة المؤهلة قبل الحذف؛ يبقى سجل التدقيق والقيود المحاسبية. لا تُحذف دفعات أو مستندات مرتبطة. المتعذر يبقى دون تغيير.', 'The invoice, its lines and attachments are permanently removed, including cancelled invoices. Eligible issued invoices are reversed before deletion; audit history and journals remain. Related payments and documents are not deleted. Blocked invoices remain unchanged.') : t('المسودة تُحذف. الفاتورة الصادرة تُلغى مع عكس أثرها وحفظ تاريخها.', 'Drafts are deleted. Issued invoices are voided with their accounting effect reversed and history retained.')}</p>
      {loading && <p role="status">{t('جارٍ التحقق من الفواتير والصلاحيات…', 'Checking invoices and permissions…')}</p>}
      {!loading && rows.map(row => {
        const code = (mode === 'permanent' ? row.deletion?.reason : row.policy?.voidReason || row.policy?.reason) || 'invoice_state';
        return <section key={row.id} data-testid={`removal-${row.id}`} className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2"><bdi className="font-semibold">{row.invoice?.invoiceNumber || row.id}</bdi>
            <span role="status">{row.done ? mode === 'permanent' ? t('تم الحذف النهائي', 'Permanently deleted') : t('تم التنفيذ', 'Completed') : action(row) === 'permanent' ? t('حذف نهائي', 'Permanent deletion') : action(row) === 'delete' ? t('حذف المسودة', 'Delete draft') : action(row) === 'void' ? t('إلغاء الفاتورة', 'Void invoice') : t('تحتاج مراجعة', 'Review required')}</span></div>
          {mode === 'permanent' && action(row) && row.deletion?.reversesLedger && <p className="text-sm">{t('سيُعكس القيد ثم تُحذف الفاتورة في عملية واحدة.', 'The journal will be reversed and the invoice deleted in one transaction.')}</p>}
          {row.invoice && <p className="text-sm"><bdi>{row.invoice.contact?.displayName} · {row.invoice.total} {row.invoice.currency}</bdi></p>}
          {!row.done && !action(row) && !row.error && <p className="text-sm">{t(...(messages[code] || [ 'راجع حالة الفاتورة والصلاحيات من صفحة الفاتورة.', 'Review invoice state and permissions from the invoice page.' ] as [string, string]))}</p>}
          {row.error && <p role="alert" className="text-sm text-danger">{row.error}</p>}
          {!row.done && <div className="flex flex-wrap gap-3 text-sm">
            {row.invoice && <Link className="text-primary underline" to={`/app/invoices/${row.id}`}>{t('فتح الفاتورة', 'Open invoice')}</Link>}
            {code === 'period_closed' && <Link className="text-primary underline" to="/app/fiscal-periods">{t('الفترات المالية', 'Fiscal periods')}</Link>}
            {code === 'receipts_exist' && row.invoice?.contactId && <Link className="text-primary underline" to={`/app/contacts/${row.invoice.contactId}`}>{t('كشف العميل والتسويات', 'Customer statement and settlements')}</Link>}
            {row.policy?.relatedCreditNote && <Link className="text-primary underline" to={`/app/credit-notes/${row.policy.relatedCreditNote.id}`}>{t('فتح الإشعار الدائن', 'Open credit note')} · {row.policy.relatedCreditNote.noteNumber}</Link>}
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { if (running.current) return; running.current = true; setBusy(true); setConfirming(false); try { const fresh = await readRow(row.id); setRows(current => current.map(item => item.id === row.id ? fresh : item)); } finally { running.current = false; setBusy(false); } }}>{t('إعادة التحقق', 'Recheck')}</Button>
          </div>}
        </section>;
      })}
      {needsReason && <label className="block text-sm space-y-2">{t('سبب إلغاء الفواتير الصادرة', 'Reason for voiding issued invoices')}<Textarea value={reason} disabled={busy} onChange={e => { setReason(e.target.value); setConfirming(false); }} /></label>}
    </div>
  </FullPageForm>;
}
