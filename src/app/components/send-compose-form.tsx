/**
 * SendComposeForm · full-page email compose (UX-1 — a page, never a dialog).
 *
 * CEO 2026-09-08: «لما ضغط ارسال خليه يفتح لي صفحة افرض ابي اعدل شي بالارسال»
 * — pressing «إرسال» opens THIS page so the message can be edited before it
 * goes out. Everything here is editable: To / Cc / Bcc, subject, body, and
 * the attached document is shown (never silently sent, never hidden).
 *
 * Used from invoices.tsx / quotes.tsx / credit-notes.tsx — pass the entity
 * identity + sensible ar/en defaults, this component owns the rest.
 */
import { useMemo, useState } from "react";
import { Mail, Paperclip, Plus } from "lucide-react";
import { FullPageForm } from "./full-page-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useLanguage } from "./LanguageContext";
import { api, ApiError, DocumentSendEntityType, DocumentSendRecord } from "../lib/api";

export interface SendComposeAttachment {
  name: string;
  size: number; // bytes
}

interface Props {
  entityType: DocumentSendEntityType;
  entityId: string;
  /** Document number shown in the header, e.g. "INV-0001". */
  documentNumber: string;
  /** Human label of the document type, ar/en — e.g. ("فاتورة", "Invoice"). */
  documentLabelAr: string;
  documentLabelEn: string;
  defaultTo: string[];
  defaultSubject: string;
  defaultBody: string;
  /** The document itself + any file attachments already on it. */
  attachments?: SendComposeAttachment[];
  /** Set when reopening from «إعادة الإرسال» — prefills every field from a past attempt. */
  prefill?: DocumentSendRecord | null;
  onClose: () => void;
  /** Fires after a successful send OR a saved draft, with the new record. */
  onSent: (record: DocumentSendRecord) => void;
  push: (kind: "success" | "error" | "info", message: string) => void;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendComposeForm({
  entityType, entityId, documentNumber, documentLabelAr, documentLabelEn,
  defaultTo, defaultSubject, defaultBody, attachments, prefill, onClose, onSent, push,
}: Props) {
  const { t } = useLanguage();
  const [to, setTo] = useState((prefill?.to?.length ? prefill.to : defaultTo).join(", "));
  const [ccOpen, setCcOpen] = useState(!!(prefill?.cc?.length));
  const [cc, setCc] = useState((prefill?.cc || []).join(", "));
  const [bcc, setBcc] = useState((prefill?.bcc || []).join(", "));
  const [subject, setSubject] = useState(prefill?.subject ?? defaultSubject);
  const [body, setBody] = useState(prefill?.body ?? defaultBody);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toList = useMemo(() => parseEmailList(to), [to]);
  const ccList = useMemo(() => parseEmailList(cc), [cc]);
  const bccList = useMemo(() => parseEmailList(bcc), [bcc]);
  const invalidTo = toList.filter((e) => !EMAIL_RE.test(e));

  const submit = async (action: "send" | "draft") => {
    setError(null);
    if (action === "send") {
      if (toList.length === 0) { setError(t("أضف مستلماً واحداً على الأقل", "Add at least one recipient")); return; }
      if (invalidTo.length > 0) { setError(t(`بريد غير صالح: ${invalidTo.join(", ")}`, `Invalid email address: ${invalidTo.join(", ")}`)); return; }
      if (!subject.trim()) { setError(t("أضف عنواناً للرسالة", "Add a subject")); return; }
      if (!body.trim()) { setError(t("أضف نص الرسالة", "Add a message body")); return; }
    }
    setBusy(action);
    try {
      const r = await api.documentSends.create({
        entityType, entityId,
        to: toList.length ? toList : defaultTo,
        cc: ccList, bcc: bccList,
        subject: subject.trim() || defaultSubject,
        body,
        action,
      });
      if (!r.ok) {
        push("error", r.message || t("تعذر إرسال البريد", "Could not send the email"));
        onSent(r.send); // still surface the FAILED attempt in the log
        return;
      }
      push(
        "success",
        action === "draft"
          ? t("حُفظت المسودة", "Draft saved")
          : t(`تم إرسال الرسالة إلى ${toList.join(", ")}`, `Message sent to ${toList.join(", ")}`),
      );
      onSent(r.send);
      onClose();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : t("تعذر إرسال البريد", "Could not send the email");
      setError(msg);
      push("error", msg);
    } finally {
      setBusy(null);
    }
  };

  const docAttachment: SendComposeAttachment = {
    name: `${documentNumber}.pdf`,
    size: Math.max(6 * 1024, body.length * 3), // representative size until real PDF export exists
  };
  const allAttachments = [docAttachment, ...(attachments || [])];

  return (
    <FullPageForm
      title={t(`إرسال ${documentLabelAr} ${documentNumber}`, `Send ${documentLabelEn} ${documentNumber}`)}
      subtitle={t("عدّل الرسالة قبل الإرسال — لا شيء يُرسل بدون مراجعتك", "Edit the message before it goes out — nothing sends without your review")}
      onClose={onClose}
      disableEscape={busy !== null}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" className="border-border" onClick={onClose} disabled={busy !== null}>
            {t("إغلاق", "Close")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="border-border" disabled={busy !== null} onClick={() => submit("draft")} data-testid="send-compose-draft">
              {busy === "draft" ? "…" : t("حفظ كمسودة", "Save as draft")}
            </Button>
            <Button type="button" className="bg-primary hover:bg-primary/90" disabled={busy !== null} onClick={() => submit("send")} data-testid="send-compose-submit">
              <Mail className="me-2 h-4 w-4" strokeWidth={1.75} />
              {busy === "send" ? "…" : t("إرسال", "Send")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-1 py-2">
        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="send-to">{t("إلى", "To")}</Label>
          <Input id="send-to" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, name2@example.com" data-testid="send-compose-to" />
          {!ccOpen && (
            <button type="button" onClick={() => setCcOpen(true)} className="flex w-fit items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" strokeWidth={2} /> {t("إضافة نسخة / نسخة مخفية", "Add Cc / Bcc")}
            </button>
          )}
        </div>

        {ccOpen && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="send-cc">{t("نسخة (Cc)", "Cc")}</Label>
              <Input id="send-cc" dir="ltr" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="name@example.com" data-testid="send-compose-cc" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="send-bcc">{t("نسخة مخفية (Bcc)", "Bcc")}</Label>
              <Input id="send-bcc" dir="ltr" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="name@example.com" data-testid="send-compose-bcc" />
            </div>
          </>
        )}

        <div className="grid gap-2">
          <Label htmlFor="send-subject">{t("الموضوع", "Subject")}</Label>
          <Input id="send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="send-compose-subject" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="send-body">{t("نص الرسالة", "Message")}</Label>
          <Textarea id="send-body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} data-testid="send-compose-body" />
        </div>

        <div className="grid gap-2">
          <Label>{t("المرفقات", "Attachments")}</Label>
          <ul className="flex flex-col gap-1.5">
            {allAttachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-content-secondary" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate font-code">{a.name}</span>
                <span className="shrink-0 text-xs text-content-secondary">{fmtSize(a.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FullPageForm>
  );
}
