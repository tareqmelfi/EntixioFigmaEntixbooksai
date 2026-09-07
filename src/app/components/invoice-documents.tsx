import { useEffect, useRef, useState } from 'react';
import { api, type ExpenseAttachment } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { AttachmentViewer } from './attachment-viewer';
import { Button } from './ui/button';
import { Paperclip, Upload } from 'lucide-react';

export function InvoiceDocuments({ invoiceId }: { invoiceId: string }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<ExpenseAttachment[]>([]);
  const [selected, setSelected] = useState<ExpenseAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { let current = true; setSelected(null); void api.invoices.attachments.list(invoiceId).then(r => { if (current) setFiles(r.items); }).catch(() => { if (current) setError(t('تعذر تحميل المرفقات', 'Attachments could not be loaded')); }); return () => { current = false; }; }, [invoiceId, t]);
  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError(t('الحد الأقصى للملف 10 MB', 'Maximum file size is 10 MB')); return; }
    setBusy(true); setError('');
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const added = await api.invoices.attachments.add(invoiceId, { filename: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size, data });
      setFiles(old => [...old, added]); setSelected(added);
    } catch { setError(t('تعذر رفع المرفق. أعد المحاولة.', 'The attachment could not be uploaded. Please retry.')); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <section className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" />{t('مستندات الفاتورة', 'Invoice documents')}</h2><Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4 me-2" />{busy ? t('جارٍ الرفع', 'Uploading') : t('إضافة مستند', 'Add document')}</Button><input ref={input} className="hidden" type="file" aria-label={t('مرفق الفاتورة', 'Invoice attachment')} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} /></div>
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
    {files.length ? <div className="flex flex-wrap gap-2">{files.map(f => <Button key={f.id} variant="outline" size="sm" onClick={() => setSelected(selected?.id === f.id ? null : f)}>{f.filename}</Button>)}</div> : <p className="text-sm text-muted-foreground">{t('أضف العقد أو المستندات الداعمة هنا.', 'Add the contract or supporting documents here.')}</p>}
    {selected?.url.startsWith('https://') && <a href={selected.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary">{t('فتح / تنزيل المستند الأصلي', 'Open / download original document')}</a>}
    {selected && <AttachmentViewer attachment={{ name: selected.filename, type: selected.contentType, url: selected.url }} height={480} />}
  </section>;
}
