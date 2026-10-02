import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { humanizeError } from '../lib/error-messages';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export function PurchaseNotesPanel({ kind, id, onDone }: { kind: 'bills' | 'expenses'; id: string; onDone: () => Promise<void> }) {
  const { t, language } = useLanguage();
  const [record, setRecord] = useState<Awaited<ReturnType<typeof api.purchaseNotes.get>> | null>(null);
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true; setRecord(null); setOpen(false); setError(''); setSaved(false);
    api.purchaseNotes.get(kind, id).then(r => { if (live) setRecord(r); }).catch(e => {
      if (live) setError(humanizeError(e, language, { ar: 'تعذر تحميل الملاحظات.', en: 'Could not load notes.' }));
    });
    return () => { live = false; };
  }, [kind, id, retry]);
  const save = async () => {
    if (!record?.canEdit || busy) return;
    setBusy(true); setError('');
    try {
      await api.purchaseNotes.update(kind, id, { expectedUpdatedAt: record.updatedAt, notes: notes || null });
      const verified = await api.purchaseNotes.get(kind, id);
      if (verified.notes !== (notes || null)) throw new Error('notes_readback_mismatch');
      setRecord(verified); setOpen(false); setSaved(true); await onDone();
    } catch (e) { setError(humanizeError(e, language, { ar: 'تعذر حفظ الملاحظات والتحقق منها. أعد تحميلها للمراجعة.', en: 'Could not verify saved notes. Reload them to review.' })); }
    finally { setBusy(false); }
  };
  return <section aria-label={t('ملاحظات المستند', 'Document notes')} className="rounded-lg border border-border bg-card p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">{t('ملاحظات المستند', 'Document notes')}</h2><p className="text-xs text-muted-foreground">{t('قابلة للتعديل بعد الاعتماد والسداد، مع حفظ سجل التغييرات.', 'Editable after approval and payment, with change history.')}</p></div>
      {record?.canEdit && !open && <Button type="button" variant="outline" size="sm" onClick={() => { setNotes(record.notes || ''); setOpen(true); setError(''); setSaved(false); }}>{t('تعديل الملاحظات', 'Edit notes')}</Button>}
    </div>
    {!open && record?.notes && <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{record.notes}</p>}
    {open && <div className="space-y-2">
      <label className="block text-sm">{t('الملاحظات', 'Notes')}<Textarea value={notes} maxLength={20000} disabled={busy} onChange={e => setNotes(e.target.value)} /></label>
      <div className="flex gap-2"><Button type="button" disabled={busy} onClick={save}>{t('حفظ الملاحظات', 'Save notes')}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</Button></div>
    </div>}
    {saved && <p role="status" className="text-sm text-success">{t('حُفظت الملاحظات وتم التحقق منها.', 'Notes saved and verified.')}</p>}
    {error && <div role="alert" className="text-sm text-warning">{error} <Button type="button" variant="ghost" disabled={busy} onClick={() => setRetry(n => n + 1)}>{t('إعادة تحميل الملاحظات', 'Reload notes')}</Button></div>}
  </section>;
}
