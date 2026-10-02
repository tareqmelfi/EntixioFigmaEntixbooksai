import { useEffect, useState } from 'react';
import { api, type Invoice } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { humanizeError } from '../lib/error-messages';

/** Nonfinancial notes are independently editable, including on paid invoices. */
export function InvoiceNotesPanel({ invoice, onDone }: { invoice: Invoice; onDone: () => Promise<void> }) {
  const { t, language } = useLanguage();
  const [record, setRecord] = useState<Awaited<ReturnType<typeof api.invoices.notes>> | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    let live = true;
    setRecord(null); setOpen(false);
    api.invoices.notes(invoice.id).then(value => { if (live) setRecord(value); }).catch(() => {
      if (live) setError(t('تعذر تحميل الملاحظات؛ أعد فتح الفاتورة للمحاولة.', 'Could not load notes. Reopen the invoice to retry.'));
    });
    return () => { live = false; };
  }, [invoice.id, invoice.updatedAt]);
  const start = () => {
    if (!record?.canEdit) return;
    setNotes(record.notes || ''); setTerms(record.termsConditions || ''); setReason(''); setError(''); setSaved(false); setOpen(true);
  };
  const save = async () => {
    if (!record?.canEdit) return;
    setBusy(true); setError('');
    try {
      await api.invoices.updateNotes(invoice.id, { expectedUpdatedAt: record.updatedAt, reason: reason.trim() || 'Update invoice notes and printed terms', notes: notes || null, termsConditions: terms || null });
      const verified = await api.invoices.notes(invoice.id);
      if (verified.notes !== (notes || null) || verified.termsConditions !== (terms || null)) throw new Error('notes_readback_mismatch');
      setRecord(verified); setOpen(false); setSaved(true); await onDone();
    } catch (e) { setError(humanizeError(e, language, { ar: 'تعذر التحقق من حفظ الملاحظات. أعد فتح الفاتورة وراجع النص.', en: 'Could not verify saved notes. Reopen the invoice and review the text.' })); }
    finally { setBusy(false); }
  };
  return <section className="rounded-lg border border-border bg-card p-4 space-y-3" aria-label={t('ملاحظات الفاتورة وشروطها', 'Invoice notes and terms')}>
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h2 className="font-semibold">{t('ملاحظات الفاتورة وشروطها', 'Invoice notes and terms')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('الملاحظات والشروط قابلة للتعديل بعد الاعتماد والسداد وحتى بعد الربط بالهيئة. تظهر في النسخ الجديدة مع حفظ سجل التغيير؛ النسخة الإلكترونية المرسلة والموقعة تبقى محفوظة دون تعديل.', 'Notes and printed terms remain editable after approval, payment and authority submission. New copies show the changes with audit history; the submitted signed electronic document is preserved.')}</p></div>
      {record?.canEdit && !open && <Button variant="outline" onClick={start}>{t('تعديل الملاحظات والشروط', 'Edit notes and terms')}</Button>}
    </div>
    {open && <div className="space-y-3">
      <label className="block text-sm">{t('ملاحظات الفاتورة', 'Invoice notes')}<Textarea value={notes} maxLength={20000} disabled={busy} onChange={e => setNotes(e.target.value)} /></label>
      <label className="block text-sm">{t('الشروط المطبوعة', 'Printed terms')}<Textarea value={terms} maxLength={20000} disabled={busy} onChange={e => setTerms(e.target.value)} /></label>
      <label className="block text-sm">{t('سبب التعديل — اختياري', 'Change reason — optional')}<Textarea value={reason} maxLength={1000} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={busy} onClick={save}>{busy ? t('جارٍ الحفظ والتحقق…', 'Saving and verifying…') : t('حفظ الملاحظات', 'Save notes')}</Button><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</Button></div>
    </div>}
    {saved && <p role="status" className="text-sm text-success">{t('حُفظت الملاحظات وتم التحقق منها. أعد تنزيل الفاتورة للحصول على النص المحدّث.', 'Notes saved and verified. Download the invoice again for the updated text.')}</p>}
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
  </section>;
}
