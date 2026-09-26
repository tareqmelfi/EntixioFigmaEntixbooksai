import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Files, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { Button } from "./ui/button";
import { InlineAlert } from "./product";
import { AttachmentViewer } from "./attachment-viewer";
import { InlineConfirm } from "./side-panel";

type Document = { id: string; filename: string; contentType: string; sizeBytes: number; createdAt: string; url?: string };
const MAX_BYTES = 25 * 1024 * 1024;

// Recover bookmarks and older app links which previously opened a 404 page.
export function LegacyContactUpload() {
  const [params] = useSearchParams();
  const id = params.get("contactId");
  return <Navigate replace to={id ? `/app/contacts/${encodeURIComponent(id)}?tab=documents` : "/app/contacts"} />;
}

export function ContactDocuments({ contactId }: { contactId: string }) {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [items, setItems] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await api.contacts.attachments.list(contactId)).items); }
    catch { setError(t("تعذر تحميل المستندات. حاول مرة أخرى.", "Could not load documents. Please retry.")); }
    finally { setLoading(false); }
  }, [contactId, t]);
  useEffect(() => { void load(); return () => { selection.current++; }; }, [load]);
  const open = async (id: string) => {
    const request = ++selection.current;
    setPreviewBusy(true); setSelected(null); setError("");
    try {
      const file = await api.contacts.attachments.get(contactId, id);
      if (request === selection.current) setSelected(file);
    } catch { if (request === selection.current) setError(t("تعذر فتح المستند. أعد المحاولة.", "Could not open document. Please retry.")); }
    finally { if (request === selection.current) setPreviewBusy(false); }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true); setError("");
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.size || file.size > MAX_BYTES) { failures.push(`${file.name}: ${t("يجب أن يكون حجم الملف بين 1 بايت و25 ميجابايت", "File must be between 1 byte and 25 MB")}`); continue; }
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("read_failed"));
          reader.readAsDataURL(file);
        });
        const saved = await api.contacts.attachments.upload(contactId, { filename: file.name, contentType: file.type || "application/octet-stream", data });
        setItems(previous => [saved, ...previous]);
      } catch { failures.push(`${file.name}: ${t("تعذر الرفع، أعد المحاولة", "Upload failed, please retry")}`); }
    }
    setError(failures.join(" · ")); setBusy(false);
    if (input.current) input.current.value = "";
  };
  const remove = async (id: string) => {
    setPendingDelete(null); setBusy(true); setError("");
    try {
      await api.contacts.attachments.remove(contactId, id);
      setItems(previous => previous.filter(file => file.id !== id));
      selection.current++; setPreviewBusy(false); setSelected(null);
    } catch { setError(t("تعذر حذف المستند. أعد المحاولة.", "Could not delete document. Please retry.")); }
    finally { setBusy(false); }
  };
  return <section className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4" data-testid="contact-documents">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold">{t("مستندات جهة الاتصال", "Contact documents")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("العقود والسجلات وغيرها · حتى 25 ميجابايت للملف", "Contracts, registrations and other files · up to 25 MB each")}</p></div>
      <input ref={input} type="file" multiple className="hidden" aria-label={t("اختيار المستندات", "Choose documents")} onChange={event => void upload(event.target.files)} />
      <Button disabled={busy || loading} onClick={() => input.current?.click()} className="shrink-0 whitespace-nowrap">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t("رفع مستند", "Upload document")}
      </Button>
    </div>
    {error && <InlineAlert tone="critical"><span>{error}</span><button onClick={() => void load()} className="ms-2 underline">{t("تحديث القائمة", "Reload list")}</button></InlineAlert>}
    {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : !items.length ? <div className="py-8 text-center text-muted-foreground"><Files className="mx-auto mb-3 h-8 w-8" /><p className="text-sm">{t("لم يتم رفع أي مستندات لهذه الجهة", "No documents uploaded for this contact")}</p></div> :
      <ul className="divide-y divide-border">{items.map(file => <li key={file.id} className="flex flex-wrap items-center gap-3 py-3">
        <button disabled={busy} onClick={() => void open(file.id)} className="min-w-0 flex-1 text-start text-sm text-primary hover:underline"><bdi className="break-all">{file.filename}</bdi><span className="mt-1 block text-xs text-muted-foreground" dir="ltr">{(file.sizeBytes / 1024).toFixed(1)} KB · {file.createdAt.slice(0, 10)}</span></button>
        {pendingDelete === file.id ? <InlineConfirm onConfirm={() => void remove(file.id)} onCancel={() => setPendingDelete(null)} /> : <Button variant="ghost" size="icon" disabled={busy} aria-label={`${t("حذف", "Delete")} ${file.filename}`} onClick={() => setPendingDelete(file.id)}><Trash2 className="h-4 w-4" /></Button>}
      </li>)}</ul>}
    {previewBusy && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
    {selected?.url && <AttachmentViewer key={selected.id} attachment={{ name: selected.filename, type: selected.contentType, url: selected.url }} height="75vh" />}
  </section>;
}
