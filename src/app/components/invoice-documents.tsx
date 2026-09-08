import { useEffect, useRef, useState } from 'react';
import { api, type ExpenseAttachment } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { AttachmentViewer } from './attachment-viewer';
import { InlineConfirm } from './side-panel';
import { Button } from './ui/button';
import { Paperclip, Upload, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';

const MAX_FILE_MB = 25;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * InvoiceDocuments · attachments panel for an invoice/quote/bill/expense/
 * credit-note detail view (UX-65b multi-file).
 *
 * Accepts ANY number of files of ANY mime type in one go (drag or picker),
 * each uploaded independently so one failure never blocks the others.
 * Delete goes through InlineConfirm (UX-1 · never a browser confirm/dialog).
 */
export function InvoiceDocuments({ invoiceId }: { invoiceId: string }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<ExpenseAttachment[]>([]);
  const [selected, setSelected] = useState<ExpenseAttachment | null>(null);
  const [uploading, setUploading] = useState<Record<string, { name: string; error?: string }>>({});
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [listError, setListError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    setSelected(null);
    void api.invoices.attachments.list(invoiceId).then(r => { if (current) setFiles(r.items); }).catch(() => { if (current) setListError(t('تعذر تحميل المرفقات', 'Attachments could not be loaded')); });
    return () => { current = false; };
  }, [invoiceId, t]);

  const uploadOne = async (file: File) => {
    const key = `${file.name}-${file.size}-${Date.now()}`;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploading(prev => ({ ...prev, [key]: { name: file.name, error: t(`الحد الأقصى ${MAX_FILE_MB} ميجا للملف`, `Maximum ${MAX_FILE_MB} MB per file`) } }));
      return;
    }
    setUploading(prev => ({ ...prev, [key]: { name: file.name } }));
    try {
      const data = await fileToDataUrl(file);
      const added = await api.invoices.attachments.add(invoiceId, { filename: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size, data });
      setFiles(old => [...old, added]);
      setUploading(prev => { const next = { ...prev }; delete next[key]; return next; });
    } catch {
      setUploading(prev => ({ ...prev, [key]: { name: file.name, error: t('تعذر الرفع. أعد المحاولة.', 'Upload failed. Try again.') } }));
    }
  };

  const uploadMany = async (list: FileList | File[]) => {
    // Independent per-file uploads — one failure never blocks the rest.
    await Promise.all(Array.from(list).map(uploadOne));
    if (input.current) input.current.value = '';
  };

  const remove = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.invoices.attachments.remove(invoiceId, id);
      setFiles(old => old.filter(f => f.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {
      setListError(t('تعذر حذف المرفق. أعد المحاولة.', 'Could not delete the attachment. Try again.'));
    }
  };

  const pending = Object.entries(uploading);
  const busy = pending.some(([, v]) => !v.error);

  return <section className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h2 className="font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" />{t('مستندات الفاتورة', 'Invoice documents')}</h2>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <Upload className="h-4 w-4 me-2" />{busy ? t('جارٍ الرفع', 'Uploading') : t('إضافة مستندات', 'Add documents')}
      </Button>
      <input
        ref={input}
        className="hidden"
        type="file"
        multiple
        aria-label={t('مرفقات الفاتورة', 'Invoice attachments')}
        onChange={e => { if (e.target.files?.length) void uploadMany(e.target.files); }}
      />
    </div>
    <p className="text-xs text-muted-foreground">{t(`أي صيغة ملف · حتى ${MAX_FILE_MB} ميجا لكل ملف · يمكنك اختيار عدة ملفات معاً`, `Any file format · up to ${MAX_FILE_MB} MB per file · select multiple files at once`)}</p>
    {listError && <p role="alert" className="text-sm text-warning">{listError}</p>}

    {pending.length > 0 && (
      <div className="space-y-1">
        {pending.map(([key, v]) => (
          <div key={key} className="flex items-center gap-2 text-xs rounded-lg border border-border p-2">
            {v.error ? <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
            <span className="truncate flex-1">{v.name}</span>
            {v.error && <span className="text-danger shrink-0">{v.error}</span>}
          </div>
        ))}
      </div>
    )}

    {files.length ? (
      <div className="flex flex-wrap gap-2">
        {files.map(f => (
          <div key={f.id} className="inline-flex items-center gap-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setSelected(selected?.id === f.id ? null : f)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${selected?.id === f.id ? 'bg-surface-subtle' : 'hover:bg-surface-hover'}`}
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[14rem]">{f.filename}</span>
              <span className="text-xs text-muted-foreground/70 font-english" dir="ltr">{sizeLabel(f.sizeBytes)}</span>
            </button>
            <a href={f.url} download={f.filename} className="p-1.5 text-primary hover:bg-info-subtle rounded" title={t('تنزيل', 'Download')}>
              <Download className="h-3.5 w-3.5" />
            </a>
            {pendingDelete === f.id ? (
              <InlineConfirm onConfirm={() => remove(f.id)} onCancel={() => setPendingDelete(null)} />
            ) : (
              <button type="button" onClick={() => setPendingDelete(f.id)} className="p-1.5 text-danger hover:bg-danger-subtle rounded" title={t('حذف', 'Delete')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{t('أضف العقد أو المستندات الداعمة هنا.', 'Add the contract or supporting documents here.')}</p>
    )}

    {selected?.url.startsWith('https://') && <a href={selected.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary">{t('فتح / تنزيل المستند الأصلي', 'Open / download original document')}</a>}
    {selected && <AttachmentViewer attachment={{ name: selected.filename, type: selected.contentType, url: selected.url }} height={480} />}
  </section>;
}
