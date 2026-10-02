import { useEffect, useState } from 'react';
import { api, type Invoice } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { DateInput } from './date-input';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { humanizeError } from '../lib/error-messages';
import { Link } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';

export type InvoiceAction = 'amend' | 'void';
type AmendmentPolicy = Awaited<ReturnType<typeof api.invoices.amendmentPolicy>> & { voidReason?: string | null; relatedCreditNote?: { id: string; noteNumber: string; status: string } | null };

function InvoiceRestriction({ policy }: { policy?: AmendmentPolicy }) {
  const { t } = useLanguage();
  const reason = policy?.reason || policy?.voidReason;
  const messages: Record<string, [string, string]> = {
    credit_note: ['للفاتورة إشعار دائن مرتبط؛ راجعه قبل أي تعديل أو إلغاء لتجنب تكرار التصحيح.', 'This invoice has a linked credit note. Review it before amending or voiding to avoid a duplicate correction.'],
    period_closed: ['الفترة المالية مقفلة؛ راجع الفترة قبل تعديل الفاتورة أو إلغائها.', 'The accounting period is closed. Review the period before amending or voiding this invoice.'],
    related_document: ['توجد مستندات أو جداول مرتبطة تحتاج مراجعة مشتركة مع الفاتورة.', 'Related documents or schedules need to be reviewed with this invoice.'],
    receipts_exist: ['الإلغاء غير متاح لوجود تحصيل أو حركة بنكية مرتبطة؛ راجع التسوية أولًا.', 'Voiding is unavailable because receipts or bank transactions are linked. Review their settlement first.'],
    payment_link: ['الإلغاء غير متاح مع رابط دفع نشط؛ يلزم إيقاف الرابط أولًا.', 'Voiding is unavailable while a payment link is active. Retire the payment link first.'],
    void_role_required: ['الإلغاء متاح لمالك الشركة أو مديرها.', 'Voiding requires the company owner or administrator.'],
    super_admin_required: ['الإلغاء الإداري متاح للسوبر أدمن فقط.', 'Administrative void requires a platform super admin.'],
    role_required: ['صلاحية التعديل متاحة للمالك أو المدير أو المحاسب.', 'Amendment access requires an owner, administrator or accountant.'],
    ledger_review: ['يلزم مراجعة قيد الفاتورة قبل الإلغاء.', 'The invoice ledger needs review before voiding.'],
  };
  const message = reason ? messages[reason] : null;
  if (!message) return null;
  return <p className="text-xs text-muted-foreground">{t(...message)}{policy?.relatedCreditNote && <> <Link className="text-primary underline" to={`/app/credit-notes/${encodeURIComponent(policy.relatedCreditNote.id)}`}>{t('فتح الإشعار', 'Open credit note')} · <bdi>{policy.relatedCreditNote.noteNumber}</bdi></Link></>}</p>;
}

function useAmendmentPolicy(invoice: Invoice) {
  const [result, setResult] = useState<{ key: string; policy?: AmendmentPolicy; failed?: boolean } | null>(null);
  const key = `${invoice.id}:${invoice.updatedAt}:${invoice.status}`;
  useEffect(() => {
    let live = true;
    api.invoices.amendmentPolicy(invoice.id)
      .then(policy => { if (live) setResult({ key, policy }); })
      .catch(() => { if (live) setResult({ key, failed: true }); });
    return () => { live = false; };
  }, [key]);
  return result?.key === key ? result : null;
}

/** Read-only entry points: mutation still requires review in the invoice record. */
export function InvoiceAmendmentActions({ invoice, onAction }: { invoice: Invoice; onAction: (action: InvoiceAction) => void }) {
  const { t } = useLanguage();
  const result = useAmendmentPolicy(invoice);
  if (!result) return <span className="text-xs text-muted-foreground" role="status">{t('جارٍ التحقق من الإجراءات…', 'Checking available actions…')}</span>;
  if (result.failed) return <span className="text-xs text-warning">{t('تعذر التحقق؛ افتح الفاتورة لإعادة المحاولة.', 'Could not check access. Open the invoice to retry.')}</span>;
  const { policy } = result;
  return <>
    {policy?.canAmend && <Button size="sm" variant="outline" onClick={() => onAction('amend')}><Pencil className="h-3.5 w-3.5 me-1" />{t('تعديل الفاتورة', 'Edit invoice')}</Button>}
    {policy?.canVoidAdmin && <Button size="sm" variant="outline" onClick={() => onAction('void')}><Trash2 className="h-3.5 w-3.5 me-1" />{t('إلغاء الفاتورة', 'Void invoice')}</Button>}
    <InvoiceRestriction policy={policy} />
  </>;
}

export function InvoiceAmendmentPanel({ invoice, onDone, initialAction }: { invoice: Invoice; onDone: () => Promise<void>; initialAction?: InvoiceAction }) {
  const { t, language } = useLanguage();
  const policyResult = useAmendmentPolicy(invoice);
  const policy = policyResult?.policy;
  const [voidOpen, setVoidOpen] = useState(initialAction === 'void');
  const [open, setOpen] = useState(initialAction === 'amend');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(invoice.notes || '');
  const [terms, setTerms] = useState(invoice.termsConditions || '');
  const [dateValidity, setDateValidity] = useState({ issueDate: true, supplyDate: true, dueDate: true });
  const [issueDate, setIssueDate] = useState(invoice.issueDate?.slice(0, 10) || '');
  const [supplyDate, setSupplyDate] = useState(invoice.supplyDate?.slice(0, 10) || '');
  const [dueDate, setDueDate] = useState(invoice.dueDate?.slice(0, 10) || '');
  const [lines, setLines] = useState((invoice.lines || []).map(l => ({ id: l.id!, description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })));

  const reasonText = policy?.reason === 'external_source'
    ? t('متزامنة من مصدر خارجي؛ التصحيح يبدأ من الأصل ثم المزامنة.', 'Synchronized from an external source; correct the source and synchronize.')
    : ['saudi_issued_invoice', 'zatca_record'].includes(policy?.reason || '')
      ? t('للفاتورة سجل فوترة إلكترونية أو للشركة ربط مرحلة ثانية متحقق؛ استخدم مسار التصحيح المرتبط بالأصل.', 'This invoice has an e-invoicing record or the company has a verified Phase 2 connection; use the linked correction flow.')
      : t('يمكن تسجيل التحصيل أو استخدام إشعار تصحيح حسب صلاحياتك وحالة الفاتورة.', 'Record receipts or use a correction note according to your permissions and the invoice state.');
  const save = async () => {
    setBusy(true); setError('');
    try {
      await api.invoices.amend(invoice.id, { expectedUpdatedAt: invoice.updatedAt!, reason, notes: notes || null, termsConditions: terms || null, issueDate, supplyDate: supplyDate || null, dueDate, lines: lines.map(l => ({ ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) });
      await onDone(); setOpen(false);
    } catch (e) { setError(humanizeError(e, language, { ar: 'تعذر حفظ التعديل', en: 'Could not save amendment' })); }
    finally { setBusy(false); }
  };
  return <section className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">{policy?.canAmend ? t('تعديل الفاتورة · سجل موثّق', 'Invoice · audited amendment') : t('ضوابط الفاتورة', 'Invoice controls')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{policy?.canAmend ? t('يمكن تعديل التواريخ والوصف والملاحظات والكميات والأسعار. تُحفظ النسخة السابقة والسبب، وتُسوّى الفروقات محاسبيًا مع بقاء التحصيل.', 'Edit dates, descriptions, notes, quantities and prices. The previous version and reason are retained; accounting differences are posted while receipts remain intact.') : reasonText}</p></div>
      {policy?.canAmend && !open && <Button variant="outline" onClick={() => { setVoidOpen(false); setReason(''); setOpen(true); }}>{t('تعديل الفاتورة', 'Edit invoice')}</Button>}
    </div>
    <InvoiceRestriction policy={policy} />
    {open && policy?.canAmend && <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('رقم الفاتورة والعميل والعملة والضريبة محفوظة. المبلغ الأقل من المحصّل أو المرتبط برابط دفع نشط يحتاج إجراء تصحيح منفصل.', 'Invoice number, customer, currency and tax settings are preserved. Reducing below receipts or changing an amount with an active payment link requires a separate correction.')}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[t('الوصف', 'Description'), t('الكمية', 'Quantity'), t('سعر الوحدة', 'Unit price')].map(x => <th key={x} className="text-start p-2">{x}</th>)}</tr></thead><tbody>{lines.map((l, index) => <tr key={l.id}>
        <td className="p-2 min-w-64"><Input aria-label={`${t('الوصف', 'Description')} ${index + 1}`} value={l.description} onChange={e => setLines(v => v.map((x, i) => i === index ? { ...x, description: e.target.value } : x))} /></td>
        {(['quantity', 'unitPrice'] as const).map(field => <td key={field} className="p-2 w-32"><Input type="number" min={field === 'quantity' ? 0.001 : 0} step="any" aria-label={`${field === 'quantity' ? t('الكمية', 'Quantity') : t('سعر الوحدة', 'Unit price')} ${index + 1}`} value={l[field]} onChange={e => setLines(v => v.map((x, i) => i === index ? { ...x, [field]: e.target.value } : x))} /></td>)}
      </tr>)}</tbody></table></div>
      <label className="block text-sm">{t('تاريخ الإصدار', 'Issue date')}<DateInput value={issueDate} onChange={setIssueDate} onValidityChange={valid => setDateValidity(v => ({ ...v, issueDate: valid }))} /></label>
      <label className="block text-sm">{t('تاريخ التوريد', 'Supply date')}<DateInput value={supplyDate} onChange={setSupplyDate} onValidityChange={valid => setDateValidity(v => ({ ...v, supplyDate: valid }))} /></label>
      <p className="text-xs text-muted-foreground">{t('تصحيح تاريخ الإصدار يصحح تاريخ قيد الفاتورة نفسه مع حفظ التاريخ السابق في السجل.', 'Correcting the issue date updates the original invoice journal date and retains the previous date in the audit log.')}</p>
      <label className="block text-sm">{t('تاريخ الاستحقاق', 'Due date')}<DateInput value={dueDate} onChange={setDueDate} onValidityChange={valid => setDateValidity(v => ({ ...v, dueDate: valid }))} /></label>
      <label className="block text-sm">{t('ملاحظات', 'Notes')}<Textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <label className="block text-sm">{t('الشروط', 'Terms')}<Textarea value={terms} onChange={e => setTerms(e.target.value)} /></label>
      <label className="block text-sm">{t('سبب التعديل — مطلوب', 'Reason for amendment — required')}<Textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={busy || !issueDate || !dueDate || !Object.values(dateValidity).every(Boolean) || reason.trim().length < 5} onClick={save}>{busy ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ التعديل', 'Save amendment')}</Button><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</Button></div>
    </div>}
    {policy?.canVoidAdmin && !open && <div className="border-t border-border pt-3 space-y-3">
      <Button variant="outline" onClick={() => { setReason(''); setVoidOpen(v => !v); }}>{t('إلغاء الفاتورة', 'Void invoice')}</Button>
      {voidOpen && <><p className="text-sm">{t('إلغاء فاتورة بلا تحصيل أو روابط نشطة، مع حفظ الأصل وقيد العكس وسجل السبب. لا تُمحى السجلات.', 'Void an invoice with no receipts or active links, retaining the original, reversal and reason. Records are not erased.')}</p>
        <label className="block text-sm">{t('سبب الإلغاء', 'Reason for void')}<Textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
        <Button disabled={busy || reason.trim().length < 5} onClick={async () => { setBusy(true); setError(''); try { await api.invoices.voidInvoiceAdmin(invoice.id, { reason, expectedUpdatedAt: invoice.updatedAt! }); await onDone(); } catch (e) { setError(humanizeError(e, language, { ar: 'تعذر الإلغاء', en: 'Could not void invoice' })); } finally { setBusy(false); } }}>{t('تأكيد الإلغاء مع حفظ السجل', 'Confirm void and retain history')}</Button><Button variant="outline" disabled={busy} onClick={() => setVoidOpen(false)}>{t('تراجع', 'Keep invoice')}</Button></>}
    </div>}
    {policyResult?.failed && <p role="alert" className="text-sm text-warning">{t('تعذر التحقق من صلاحية التعديل؛ أعد فتح الفاتورة.', 'Could not check amendment access. Reopen the invoice.')}</p>}
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
  </section>;
}
