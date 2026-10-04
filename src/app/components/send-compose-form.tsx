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
import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Paperclip, Plus } from "lucide-react";
import { FullPageForm } from "./full-page-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useLanguage } from "./LanguageContext";
import { api, ApiError, getOrgId, DocumentSendEntityType, DocumentSendRecord } from "../lib/api";

import { prepareSendPdf, emailFile, EMAIL_ATTACHMENT_LIMIT, type EmailFile } from "../lib/send-attachments";
import { paymentUrl } from "../lib/document-render";

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

// The composer owns only its labelled payment line; other links and authored text stay intact.
const PAYMENT_LINE = /^(?:Payment link|رابط الدفع):[ \t]*(.*)$/m;
function messagePaymentLink(body: string) { return paymentUrl(body.match(PAYMENT_LINE)?.[1]); }
function withPaymentLink(body: string, url: string, label: string): string {
  const line = url ? `${label}: ${url}` : "";
  return PAYMENT_LINE.test(body) ? body.replace(PAYMENT_LINE, () => line) : line ? `${body.trimEnd()}\n\n${line}` : body;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendComposeForm({
  entityType, entityId, documentNumber, documentLabelAr, documentLabelEn,
  defaultTo, defaultSubject, defaultBody, prefill, onClose, onSent, push,
}: Props) {
  const { t } = useLanguage();
  const [to, setTo] = useState((prefill?.to?.length ? prefill.to : defaultTo).join(", "));
  const [ccOpen, setCcOpen] = useState(!!(prefill?.cc?.length));
  const [cc, setCc] = useState((prefill?.cc || []).join(", "));
  const [bcc, setBcc] = useState((prefill?.bcc || []).join(", "));
  const [subject, setSubject] = useState(prefill?.subject ?? defaultSubject);
  const [body, setBody] = useState(prefill?.body ?? defaultBody);
  const [busy, setBusy] = useState<"send" | "draft" | "payment" | null>(null);
  const canPay = entityType === "invoice" || entityType === "quote";
  const initialLink = messagePaymentLink(prefill?.body ?? defaultBody);
  const [paymentLink, setPaymentLink] = useState(initialLink);
  const [includePayment, setIncludePayment] = useState(!!initialLink);
  const [paymentDefault, setPaymentDefault] = useState(initialLink);
  const [paymentLoading, setPaymentLoading] = useState(canPay);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentRevision, setPaymentRevision] = useState(0);
  const paymentTouched = useRef(!!prefill);
  const mounted = useRef(true);
  const paymentLabel = /[\u0600-\u06ff]/.test(defaultBody) ? "رابط الدفع" : "Payment link";
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!canPay) return;
    let cancelled = false;
    const orgId = getOrgId();
    const current = () => !cancelled && getOrgId() === orgId;
    setPaymentLoading(true); setPaymentError(null);
    (async () => {
      try {
        const doc = entityType === "invoice" ? await api.invoices.get(entityId) : await api.quotes.get(entityId);
        if (!current()) return;
        let url = paymentUrl((doc as { paymentLinkUrl?: string }).paymentLinkUrl);
        if (!url) {
          const resolved = await api.documentTemplates.resolve(entityType === "invoice" ? "INVOICE" : "QUOTE", doc.lines || [], doc.templateId);
          if (!current()) return;
          if (resolved.templateId) url = paymentUrl((await api.documentTemplates.get(resolved.templateId)).paymentLinkUrl);
        }
        if (!current()) return;
        setPaymentDefault(url);
        if (!paymentTouched.current) {
          setPaymentLink(url); setIncludePayment(!!url);
          setBody(value => withPaymentLink(value, url, paymentLabel));
        }
      } catch {
        if (current()) setPaymentError(t("تعذر تحميل رابط الدفع الافتراضي. يمكنك إعادة المحاولة أو إدخال رابطك.", "Could not load the default payment link. Retry or enter your own link."));
      } finally { if (current()) setPaymentLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId, canPay, paymentRevision, paymentLabel, t]);
  const choosePayment = (url: string, include = true) => {
    paymentTouched.current = true;
    setPaymentLink(url); setIncludePayment(include);
    setBody(value => withPaymentLink(value, include ? url : "", paymentLabel));
  };
  const createPaymentLink = async () => {
    if (busy) return;
    paymentTouched.current = true;
    const orgId = getOrgId();
    setBusy("payment"); setPaymentError(null);
    try {
      const result = await api.paymentLinks.create(entityId, "auto");
      if (!mounted.current || getOrgId() !== orgId) return;
      const url = paymentUrl(result.url);
      if (!url) throw Error("Invalid payment URL");
      setPaymentDefault(url); choosePayment(url);
    } catch (e) {
      if (mounted.current && getOrgId() === orgId) setPaymentError(e instanceof ApiError ? e.message : t("تعذر تجهيز رابط الدفع", "Could not prepare the payment link"));
    } finally { if (mounted.current) setBusy(null); }
  };
  const [includePdf, setIncludePdf] = useState(canPay && !prefill?.attachments?.length);
  const [includePreviousAttachments, setIncludePreviousAttachments] = useState(!!prefill?.attachments?.length);
  const [includeReceipts, setIncludeReceipts] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<{id:string;filename:string;sizeBytes:number;available:boolean}[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [filesError, setFilesError] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [pdfSize, setPdfSize] = useState<number | null>(null);
  const attempt = useRef<{signature:string;id:string;files:EmailFile[]} | null>(null);
  useEffect(() => {
    let cancelled=false; const orgId=getOrgId();
    api.documentSends.attachmentOptions(entityType,entityId).then(r=>{
      if (!cancelled && getOrgId()===orgId) setAvailableFiles(r.items);
    }).catch(()=>{if (!cancelled) setFilesError(true);});
    return ()=>{cancelled=true;};
  },[entityType,entityId]);
  const [error, setError] = useState<string | null>(null);

  const toList = useMemo(() => parseEmailList(to), [to]);
  const ccList = useMemo(() => parseEmailList(cc), [cc]);
  const bccList = useMemo(() => parseEmailList(bcc), [bcc]);
  const invalidTo = toList.filter((e) => !EMAIL_RE.test(e));

  const submit = async (action: "send" | "draft") => {
    if (busy) return;
    setError(null);
    if (canPay && includePayment && !paymentUrl(paymentLink)) { setError(t("أدخل رابط دفع صالحًا أو ألغِ تضمين الرابط", "Enter a valid payment URL or turn off the payment link")); return; }
    if (action === "send") {
      if (toList.length === 0) { setError(t("أضف مستلماً واحداً على الأقل", "Add at least one recipient")); return; }
      if (invalidTo.length > 0) { setError(t(`بريد غير صالح: ${invalidTo.join(", ")}`, `Invalid email address: ${invalidTo.join(", ")}`)); return; }
      if (!subject.trim()) { setError(t("أضف عنواناً للرسالة", "Add a subject")); return; }
      if (!body.trim()) { setError(t("أضف نص الرسالة", "Add a message body")); return; }
    }
    paymentTouched.current = true; // Freeze the reviewed message while a default request is still pending.
    setBusy(action);
    const orgId = getOrgId();
    try {
      const signature=JSON.stringify([orgId,entityType,entityId,toList,ccList,bccList,subject,body,includePdf,includeReceipts,includePreviousAttachments,selectedFiles,localFiles.map(f=>[f.name,f.size,f.lastModified])]);
      if (attempt.current?.signature !== signature) {
        setPreparing(true);
        const files:EmailFile[]=[];
        if (includePdf) { const pdf=await prepareSendPdf(entityType,entityId,documentNumber,includeReceipts);files.push({filename:pdf.filename,content:pdf.content});setPdfSize(pdf.sizeBytes); }
        for (const file of localFiles) files.push(await emailFile(file,file.name));
        const total=files.reduce((sum,f)=>sum+Math.floor(f.content.length*3/4),0)+availableFiles.filter(f=>selectedFiles.includes(f.id)).reduce((sum,f)=>sum+f.sizeBytes,0);
        if (total>EMAIL_ATTACHMENT_LIMIT) throw Error('email_attachments_too_large');
        attempt.current={signature,id:crypto.randomUUID(),files};
      }
      if (!mounted.current || getOrgId() !== orgId) throw Error('organization_changed');
      setPreparing(false);
      const r = await api.documentSends.create({
        entityType, entityId,
        to: toList.length ? toList : defaultTo,
        cc: ccList, bcc: bccList,
        subject: subject.trim() || defaultSubject,
        body,
        action, requestId:attempt.current.id, reuseSendId:includePreviousAttachments ? prefill?.id : undefined, attachments:attempt.current.files, attachmentIds:selectedFiles,
      });
      if (!r.ok) {
        setError(r.message || t("تعذر إرسال البريد", "Could not send the email"));
        push("error", r.message || t("تعذر إرسال البريد", "Could not send the email"));
        onSent(r.send); // still surface the FAILED attempt in the log
        return;
      }
      if (r.send.status === "QUEUED") { setError(t("الإرسال قيد المعالجة. راجع سجل الإرسال قبل إعادة المحاولة.", "Sending is in progress. Check the delivery log before retrying.")); onSent(r.send); return; }
      push(
        "success",
        action === "draft"
          ? t("حُفظت المسودة", "Draft saved")
          : t(`تم إرسال الرسالة إلى ${toList.join(", ")}`, `Message sent to ${toList.join(", ")}`),
      );
      onSent(r.send);
      onClose();
    } catch (e: any) {
      const failure = e instanceof ApiError ? e.body as {message?:string;send?:DocumentSendRecord} | undefined : undefined;
      if (failure?.send) onSent(failure.send);
      const msg = e instanceof ApiError ? failure?.message || e.message : e?.message === 'email_attachments_too_large'
        ? t("مرفقات الرسالة تتجاوز 20 ميجابايت. قلل الملفات المختارة.", "Email attachments exceed 20 MB. Reduce the selected files.")
        : t("تعذر تجهيز المرفقات أو إرسال الرسالة. احتفظنا بمدخلاتك؛ لم تُحذف الملفات المختارة.", "Could not prepare attachments or send the message. Your message and selection are preserved.");
      setError(msg);
      push("error", msg);
    } finally {
      setBusy(null); setPreparing(false);
    }
  };

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
          {canPay && <fieldset className="space-y-2 rounded-lg border border-border p-3" disabled={busy !== null} data-testid="send-payment-options">
            <legend className="px-1 text-sm font-medium">{t("الدفع في الرسالة", "Payment in this message")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includePayment} onChange={e => choosePayment(paymentLink, e.target.checked)} data-testid="send-payment-include" />
              {t("تضمين رابط الدفع", "Include a payment link")}
            </label>
            {includePayment && <div className="space-y-1">
              <Label htmlFor="send-payment-url">{t("رابط الدفع", "Payment link")}</Label>
              <Input id="send-payment-url" dir="ltr" value={paymentLink} onChange={e => choosePayment(e.target.value)} placeholder="https://…" data-testid="send-payment-url" />
            </div>}
            <div className="flex flex-wrap gap-2">
              {paymentDefault && <Button type="button" variant="outline" size="sm" onClick={() => choosePayment(paymentDefault)} data-testid="send-payment-default">{t("استخدام الرابط الافتراضي", "Use default link")}</Button>}
              {entityType === "invoice" && <Button type="button" variant="outline" size="sm" onClick={createPaymentLink} data-testid="send-payment-online">{busy === "payment" ? "…" : t("تجهيز رابط دفع للفاتورة", "Prepare invoice payment link")}</Button>}
              {paymentError && <Button type="button" variant="outline" size="sm" onClick={() => setPaymentRevision(value => value + 1)}>{t("إعادة تحميل الافتراضي", "Reload default")}</Button>}
            </div>
            {paymentLoading && <p role="status" className="text-xs text-muted-foreground">{t("جاري تحميل الرابط الافتراضي…", "Loading the default link…")}</p>}
            {paymentError && <p role="alert" className="text-xs text-danger">{paymentError}</p>}
            <p className="text-xs text-muted-foreground">{t("التغيير هنا يخص هذه الرسالة. تجهيز رابط للفاتورة يحفظه عليها ولا يرسل الرسالة.", "Changes here apply to this message. Preparing an invoice link saves it on the invoice without sending the message.")}</p>
          </fieldset>}
          <Label htmlFor="send-body">{t("نص الرسالة", "Message")}</Label>
          <Textarea id="send-body" value={body} onChange={(e) => {
            paymentTouched.current = true; setBody(e.target.value);
            const url = messagePaymentLink(e.target.value); setPaymentLink(url); setIncludePayment(!!url);
          }} rows={10} data-testid="send-compose-body" />
        </div>

        <fieldset className="grid gap-2 rounded-lg border border-border p-3" disabled={busy !== null}>
          <legend className="px-1 text-sm font-medium">{t("المرفقات", "Attachments")}</legend>
          {!!prefill?.attachments?.length && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={includePreviousAttachments} onChange={e=>setIncludePreviousAttachments(e.target.checked)} /> <span>{t("إرفاق نفس ملفات الرسالة السابقة", "Attach the same files as the previous message")}<span className="block break-all text-xs">{prefill.attachments.map(f=>`${f.filename} (${fmtSize(f.sizeBytes)})`).join(" · ")}</span></span></label>}
          {canPay && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includePdf} onChange={e=>{setIncludePdf(e.target.checked);setPdfSize(null);}} data-testid="send-include-pdf" />{t("إرفاق PDF مطابق للمعاينة", "Attach the PDF shown in preview")}{pdfSize !== null && <span>{fmtSize(pdfSize)}</span>}</label>}
          {entityType === "invoice" && includePdf && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeReceipts} onChange={e=>{setIncludeReceipts(e.target.checked);setPdfSize(null);}} data-testid="send-include-receipts" />{t("تضمين سندات القبض المرتبطة داخل PDF", "Include linked receipts in the PDF")}</label>}
          {availableFiles.map(file=><label key={file.id} className="flex min-w-0 items-center gap-2 text-sm"><input type="checkbox" disabled={!file.available} checked={selectedFiles.includes(file.id)} onChange={e=>setSelectedFiles(ids=>e.target.checked ? [...ids,file.id] : ids.filter(id=>id!==file.id))} /><Paperclip className="h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{file.filename}</span><span>{fmtSize(file.sizeBytes)}</span>{!file.available && <span>{t("أعد رفع الملف لإرفاقه", "Upload the file again to attach it")}</span>}</label>)}
          {filesError && <p className="text-xs text-danger">{t("تعذر تحميل قائمة الملفات المحفوظة. يمكنك إضافة الملفات من جهازك.", "Could not load saved files. You can add files from your device.")}</p>}
          <Label htmlFor="send-files">{t("إضافة ملفات من الجهاز", "Add files from your device")}</Label>
          <Input id="send-files" type="file" multiple onChange={e=>{setLocalFiles(Array.from(e.target.files || []));attempt.current=null;}} />
          {localFiles.map((file,i)=><span key={i} className="break-all text-xs">{file.name} · {fmtSize(file.size)}</span>)}
          <p role="status" className="text-xs text-muted-foreground">{preparing ? t("جاري تجهيز PDF والمرفقات…", "Preparing PDF and attachments…") : t("تُجهّز الملفات المختارة تلقائيًا قبل الحفظ أو الإرسال. لن تُرسل الرسالة إذا تعذر تجهيز أحدها.", "Selected files are prepared automatically before saving or sending. A preparation failure stops the message.")}</p>
        </fieldset>
      </div>
    </FullPageForm>
  );
}
