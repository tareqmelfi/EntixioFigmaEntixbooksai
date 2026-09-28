import DOMPurify from "dompurify";
import { displayLocale, displayDigits } from "../lib/number-display";
import { getOrgId } from "../lib/api";
/**
 * Inbox · UX-81 · email-to-invoice review queue
 *
 * Layout:
 *   Left: list of inbound emails (RECEIVED · EXTRACTED · APPROVED · REJECTED)
 *   Right: detail view with extracted preview · attachments · approve / reject / reprocess
 *
 * Shows the org's forwarding address at the top so user can configure suppliers.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Inbox as InboxIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Paperclip,
  Copy,
  AlertCircle,
  Sparkles,
  Mail,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { api, InboxMessageRow, InboxMessageDetail } from "../lib/api";
import { buildDuplicateDecision, getSimilarityReview, type DuplicateDecision, type SimilarityReview } from "../lib/similarity-review";
import { SimilarityReviewDialog } from "../components/similarity-review-dialog";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { PageHeader } from "../components/product";
import { InboxReviewEditor } from "../components/inbox-review-editor";
import { AttachmentViewer } from "../components/attachment-viewer";
import { humanizeError } from "../lib/error-messages";

type StatusFilter = "ALL" | "RECEIVED" | "EXTRACTED" | "APPROVED" | "REJECTED";

const STATUS_LABEL: Record<string, { label: { ar: string; en: string }; bg: string; text: string }> = {
  RECEIVED:  { label: { ar: "وصل", en: "Received" },       bg: "bg-info-subtle",   text: "text-info" },
  EXTRACTED: { label: { ar: "تم الاستخراج", en: "Extracted" }, bg: "bg-warning-subtle",  text: "text-warning" },
  APPROVED:  { label: { ar: "معتمد", en: "Approved" },     bg: "bg-success-subtle",  text: "text-success" },
  REJECTED:  { label: { ar: "مرفوض", en: "Rejected" },     bg: "bg-surface-hover",  text: "text-muted-foreground" },
  ERROR:     { label: { ar: "فشل", en: "Failed" },       bg: "bg-danger-subtle",    text: "text-danger" },
};

export function InboxPage() {
  const { toasts, push, dismiss } = useToasts();
  const { language, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const messageId = searchParams.get("message");
  const [items, setItems] = useState<InboxMessageRow[]>([]);
  const [detail, setDetail] = useState<InboxMessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
const [pendingSimilarity, setPendingSimilarity] = useState<SimilarityReview | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [orgSlug, setOrgSlug] = useState<string>("YOUR-ORG");
  const [orgAlias, setOrgAlias] = useState<{ local: string; domain: string } | null>(null);
  const [mailboxStatus, setMailboxStatus] = useState<any>(null);
  const [approveAllBusy, setApproveAllBusy] = useState(false);

  // Fetch list
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.inbox.list(filter === "ALL" ? undefined : filter);
      setItems(r.items);
      // Auto-select first unprocessed
      if (!detail && !messageId && r.items.length > 0) {
        const firstReady = r.items.find((m) => m.status === "EXTRACTED") || r.items[0];
        loadDetail(firstReady.id);
      }
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تحميل البريد الوارد", en: "Failed to load inbox" }));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Fetch org slug for display · pull from orgs list using stored active org id
  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const stored = getOrgId();
      const active = (stored ? orgs.find((o) => o.id === stored) : null);
      if (active?.slug) setOrgSlug(active.slug);
      const local = (active as any)?.inboundEmailLocal || (active?.slug ? `bills-${active.slug}` : null);
      const domain = (active as any)?.inboundEmailDomain || "in.entix.io";
      if (local) setOrgAlias({ local, domain });
    }).catch(() => {});
    api.inbox.status().then(setMailboxStatus).catch(() => setMailboxStatus(null));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (messageId) void loadDetail(messageId); }, [messageId]);

  const loadDetail = async (id: string) => {
    try {
      const d = await api.inbox.get(id);
      setDetail(d);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تحميل تفاصيل الرسالة", en: "Failed to load message details" }));
    }
  };

  // Batch approve: every EXTRACTED message becomes a DRAFT bill — the email
  // twin of the scan-receipts "record all". Server dedupe keeps reruns safe.
  const handleApproveAll = async () => {
    const targets = items.filter((m) => m.status === "EXTRACTED");
    if (!targets.length || approveAllBusy) return;
    setApproveAllBusy(true);
    let ok = 0, dup = 0, failed = 0, reviewNeeded = 0;
    for (const m of targets) {
      try {
        const r = await api.inbox.approve(m.id) as any;
        if (getSimilarityReview(r)) reviewNeeded++;
        else if (r?.dedupeDecision === "SKIPPED_DUPLICATE") dup++;
        else ok++;
      } catch { failed++; }
    }
    setApproveAllBusy(false);
    if (ok) push("success", t(`✓ اعتُمد ${ok} مستند وأنشئت فواتير شرائه`, `✓ ${ok} document(s) approved and their bills created`));
    if (reviewNeeded) push("info", t(`${reviewNeeded} مستند يحتاج قرار مراجعة تشابه — افتحه واعتمد يدوياً`, `${reviewNeeded} document(s) need a similarity decision — open and approve individually`), 7000);
    if (dup) push("info", t(`${dup} مستند موجود مسبقاً — لم يُكرَّر`, `${dup} already existed — not duplicated`));
    if (failed) push("error", t(`تعذّر اعتماد ${failed} مستند — راجعها يدوياً`, `${failed} document(s) could not be approved — review them`));
    await refresh();
  };

  const announceApprove = (r: any) => {
    const att = r.attachmentStatus?.attached > 0 ? t(` · ${r.attachmentStatus.attached} مرفق`, ` · ${r.attachmentStatus.attached} attachment(s)`) : "";
    if (r.dedupeDecision === "UPDATED") {
      push("success", t(`تم تحديث فاتورة الشراء الموجودة ${r.billNumber}${att}`, `Updated existing purchase bill ${r.billNumber}${att}`));
    } else if (r.dedupeDecision === "SKIPPED_DUPLICATE") {
      push("info", t(`الفاتورة موجودة مسبقاً (${r.billNumber}) — لم تُنشأ نسخة مكررة${att}`, `Bill already exists (${r.billNumber}) — no duplicate was created${att}`), 6000);
    } else {
      push("success", t(`✓ أُنشئت فاتورة شراء ${r.billNumber}${att}`, `✓ Purchase bill ${r.billNumber} created${att}`));
    }
    if (r.supplierResolvedTo?.displayName) {
      push("info", t(`المورّد: ${r.supplierResolvedTo.displayName}`, `Supplier: ${r.supplierResolvedTo.displayName}`), 4000);
    }
  };

  const handleApprove = async (duplicateDecision?: DuplicateDecision) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.inbox.approve(detail.id, duplicateDecision) as any;
      if (!duplicateDecision) {
        const review = getSimilarityReview(r);
        if (review) {
          // nothing written server-side — the dialog resubmits with a signed decision
          setPendingSimilarity(review);
          return;
        }
      }
      announceApprove(r);
      await refresh();
      loadDetail(detail.id);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاعتماد", en: "Approve failed" }));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      await api.inbox.reject(detail.id, reason);
      push("success", t("تم الرفض", "Rejected"));
      await refresh();
      loadDetail(detail.id);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الرفض", en: "Reject failed" }));
    } finally {
      setBusy(false);
    }
  };

  const handleReprocess = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.inbox.reprocess(detail.id);
      push("success", t(`تم استخراج ${r.lines} بنداً`, `Extracted ${r.lines} line(s)`));
      await refresh();
      loadDetail(detail.id);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاستخراج", en: "Extraction failed" }));
    } finally {
      setBusy(false);
    }
  };

  // Manual entry · stash the email/extracted info for the expense form + navigate.
  const navigate = useNavigate();
  const handleManualEntry = () => {
    if (!detail) return;
    try {
      sessionStorage.setItem("entix_ocr_prefill", JSON.stringify({
        ...(detail.extractedJson || {}),
        issuer: detail.extractedJson?.issuer || { name: "" },
        notes: detail.reviewNotes || "",
        __fromInbox: detail.id,
      }));
    } catch {}
    navigate("/app/expenses/new?fromOcr=1");
  };

  const forwardAddress = orgAlias ? `${orgAlias.local}@${orgAlias.domain}` : (mailboxStatus?.address || `bills+${orgSlug}@entix.io`);

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {pendingSimilarity && (
        <SimilarityReviewDialog
          review={pendingSimilarity}
          busy={busy}
          onCancel={() => setPendingSimilarity(null)}
          onChoose={async (action) => {
            const decision = buildDuplicateDecision(pendingSimilarity, action);
            setPendingSimilarity(null);
            await handleApprove(decision);
          }}
        />
      )}
      {/* Header */}
      <PageHeader
        eyebrow={t("صندوق الوارد", "Inbox")}
        leading={<InboxIcon className="h-6 w-6 text-content-secondary" strokeWidth={1.75} />}
        title={t("البريد الوارد", "Inbox")}
        description={t("مرّر الفواتير من المورّدين إلى عنوانك المخصّص · والذكاء يستخرجها كمسودات جاهزة للاعتماد", "Forward invoices from your suppliers to your dedicated address · AI extracts them as drafts ready for approval")}
      />

      {/* Forwarding address banner */}
      <Card className={mailboxStatus?.configured ? "border-s-[3px] border-s-primary" : "border-s-[3px] border-s-warning"}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{t("عنوان البريد الخاص بمنشأتك", "Your organization's email address")}</div>
              <code className="text-sm text-foreground font-english font-semibold">{forwardAddress}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(forwardAddress);
                push("success", t("تم نسخ العنوان", "Address copied"));
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> {t("نسخ", "Copy")}
            </button>
          </div>
          <p className={`text-xs mt-2 ${mailboxStatus?.configured ? "text-muted-foreground" : "text-warning"}`}>
            {mailboxStatus?.configured
              ? t("اطلب من مورّديك إرسال فواتيرهم لهذا العنوان · أو انسخ بريدك إلى هذا العنوان (CC) عند تلقّي الفواتير", "Ask your suppliers to send their invoices to this address · or CC your email to this address when receiving invoices")
              : t("إعداد الاستقبال يحتاج تحققًا. الرسائل التي وصلت تبقى متاحة للمراجعة.", "Receiving setup needs verification. Messages already received remain available for review.")}
          </p>
        </CardContent>
      </Card>

      {/* Filter pills + batch approve */}
      <div className="flex gap-2 overflow-x-auto pb-1 items-center">
        <button
          onClick={handleApproveAll}
          disabled={approveAllBusy || !items.some((m) => m.status === "EXTRACTED")}
          className="px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap bg-success text-primary-foreground hover:bg-success disabled:opacity-40 flex items-center gap-1.5"
        >
          {approveAllBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {t("اعتماد الكل", "Approve all")} ({items.filter((m) => m.status === "EXTRACTED").length})
        </button>
        <span className="text-border">|</span>
        {(["ALL", "RECEIVED", "EXTRACTED", "APPROVED", "REJECTED"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {s === "ALL" ? t("الكل", "All") : STATUS_LABEL[s] ? t(STATUS_LABEL[s].label.ar, STATUS_LABEL[s].label.en) : s}
          </button>
        ))}
      </div>

      {messageId && <button className="text-sm text-primary" onClick={() => setSearchParams({})}>{t("العودة إلى البريد الوارد", "Back to inbox")}</button>}
      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left · list */}
        <Card className={`${messageId ? "hidden" : ""} lg:col-span-5 border-border max-h-[70vh] overflow-y-auto`}>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-6">
                <InboxIcon className="h-12 w-12 text-muted mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t("صندوق الوارد فارغ", "Inbox is empty")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("حوّل أي فاتورة إلى", "Forward any invoice to")} <span className="font-english">{forwardAddress}</span> {t("لترى الذكاء يستخرجها هنا", "to watch AI extract it here")}</p>
              </div>
            ) : (
              <ul>
                {items.map((m) => {
                  const sl = STATUS_LABEL[m.status] || { label: { ar: m.status, en: m.status }, bg: "bg-surface-hover", text: "text-muted-foreground" };
                  const active = detail?.id === m.id;
                  return (
                    <li
                      key={m.id}
                      onClick={() => { setSearchParams({ message: m.id }); }}
                      role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSearchParams({ message: m.id }); } }}
                      className={`px-4 py-3 cursor-pointer border-b border-border/50 last:border-0 transition ${
                        active ? "bg-surface-subtle border-s-[3px] border-s-primary" : "hover:bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-foreground truncate font-english">{m.from}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{m.subject || t("(بدون عنوان)", "(No subject)")}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${sl.bg} ${sl.text}`}>
                              {t(sl.label.ar, sl.label.en)}
                            </span>
                            {m.attachmentCount > 0 && (
                              <span className="text-xs text-muted-foreground/60 flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" /> <span className="font-english">{m.attachmentCount}</span>
                              </span>
                            )}
                            {m.extractedTotal != null && (
                              <span className="text-xs text-foreground font-english">
                                {m.extractedTotal.toLocaleString(displayLocale(), { maximumFractionDigits: 2 })} {m.extractedCurrency || "SAR"}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground/60 font-english shrink-0">
                          {new Date(m.createdAt).toLocaleDateString(displayLocale("ar-SA"), { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right · detail */}
        <Card className={`${messageId ? "lg:col-span-12" : "lg:col-span-7"} border-border`}>
          <CardContent className="p-0">
            {!detail ? (
              <div className="text-center py-20 px-6">
                <Mail className="h-12 w-12 text-muted mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/60">{t("اختر رسالة من القائمة", "Select a message from the list")}</p>
              </div>
            ) : (
              <DetailPane
                key={`${detail.id}-${detail.status}-${JSON.stringify(detail.extractedJson)}-${detail.reviewNotes}`}
                detail={detail}
                onSaved={() => { void loadDetail(detail.id); void refresh(); }}
                busy={busy}
                onApprove={handleApprove}
                onReject={handleReject}
                onReprocess={handleReprocess}
                onManualEntry={handleManualEntry}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailPane({
  detail, busy, onApprove, onReject, onReprocess, onManualEntry, onSaved,
}: {
  detail: InboxMessageDetail;
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onSaved: () => void;
  onReprocess: () => void;
  onManualEntry: () => void;
}) {
  const { t } = useLanguage();
  const ex = detail.extractedJson || null;
  const lines: any[] = ex?.lines || [];
  const sl = STATUS_LABEL[detail.status] || { label: { ar: detail.status, en: detail.status }, bg: "bg-surface-hover", text: "text-muted-foreground" };
  const isFinal = detail.status === "APPROVED";
  const [attachment,setAttachment] = useState<any>(null);
  const [attachmentError,setAttachmentError] = useState("");
  const [loadingAttachment, setLoadingAttachment] = useState<string | null>(null);
  const [reason,setReason] = useState("");
  const [reviewDirty,setReviewDirty] = useState(false);
  const [rejectOpen,setRejectOpen] = useState(false);
  const openAttachment = async (id: string) => {
    if (loadingAttachment) return;
    setLoadingAttachment(id); setAttachment(null); setAttachmentError("");
    try { setAttachment(await api.inbox.attachment(detail.id,id)); }
    catch { setAttachmentError(t("تعذر فتح المرفق. أعد المحاولة.","Could not open attachment. Please retry.")); }
    finally { setLoadingAttachment(null); }
  };

  // Proactive duplicate check · when a message is EXTRACTED, look for an existing
  // bill matching vendor + date + total so we can warn BEFORE the user approves.
  const [dupInfo, setDupInfo] = useState<{ possibleDuplicate: boolean; match?: any } | null>(null);
  useEffect(() => {
    setDupInfo(null);
    if (detail.status !== "EXTRACTED") return;
    api.inbox.duplicateCheck(detail.id).then((r) => setDupInfo(r)).catch(() => {});
  }, [detail.id, detail.status]);

  return (
    <div className="divide-y divide-border">
      {/* Email header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base text-foreground" style={{ fontWeight: 600 }}>{detail.subject || t("(بدون عنوان)", "(No subject)")}</div>
            <div className="text-sm text-muted-foreground mt-1 font-english">{t("من:", "From:")} {detail.fromAddress}</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5 font-english">{t("إلى:", "To:")} {detail.toAddress}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${sl.bg} ${sl.text}`}>{t(sl.label.ar, sl.label.en)}</span>
        </div>
      </div>

      {detail.status === "REJECTED" && <div className="p-5 space-y-2 bg-warning-subtle">
        <p>{t("سبب الرفض:", "Rejection reason:")} {detail.rejectionReason || t("لم يُسجّل سبب لهذه الرسالة القديمة؛ لا يعني ذلك رفضًا من الهيئة.", "No reason was recorded for this older message; this is not a tax authority rejection.")}</p>
        <button className="text-primary underline" disabled={busy || reviewDirty} onClick={async()=>{try {await api.inbox.reopen(detail.id);onSaved();} catch {setAttachmentError(t("تعذر إعادة فتح الرسالة. أعد المحاولة.","Could not reopen message. Please retry."));}}}>{t("إعادة فتح للمراجعة", "Reopen for review")}</button>
      </div>}
      {detail.processingError && <p className="p-5 text-warning">{t("تعذر الاستخراج التلقائي. يمكنك إعادة المحاولة أو إدخال البيانات يدويًا.", "Automatic extraction failed. Retry or enter details manually.")}</p>}
      <section className="p-5 space-y-2">
        <h3 className="text-sm font-semibold">{t("الرسالة الأصلية", "Original message")}</h3>
        {detail.bodyHtml ? <iframe title={t("محتوى البريد", "Email content")} sandbox="" referrerPolicy="no-referrer" className="w-full min-h-[420px] rounded border border-border bg-white" srcDoc={'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src https: data:; base-uri \'none\'; form-action \'none\';"><meta name="referrer" content="no-referrer"><style>body{margin:12px;overflow-wrap:anywhere}img{max-width:100%;object-fit:contain}</style>'+DOMPurify.sanitize(detail.bodyHtml, {USE_PROFILES:{html:true}, FORBID_TAGS:['meta','base','form','input','button','iframe','object','embed'], FORBID_ATTR:['href','srcset','target','action','formaction']})} /> : <pre className="whitespace-pre-wrap break-words text-sm font-inherit" dir="auto">{detail.bodyText || t("لم يصل محتوى نصي مع هذه الرسالة.", "No message body was received.")}</pre>}
      </section>
      {/* Attachments */}
      {detail.attachments.length > 0 && (
        <div className="p-5">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> {t("المرفقات", "Attachments")}
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.attachments.map((a) => (
              <button disabled={!!loadingAttachment} aria-busy={loadingAttachment === a.id} onClick={()=>void openAttachment(a.id)} key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs">
                <span>{loadingAttachment === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}</span>
                <span className="text-foreground/80 font-english">{a.filename}</span>
                <span className="text-muted-foreground/60 font-english">· {displayDigits((a.sizeBytes / 1024).toFixed(0))}KB</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {attachmentError && <p role="alert" className="p-5 text-destructive">{attachmentError}</p>}
      {attachment && <div className="p-5"><AttachmentViewer attachment={attachment} height="70vh" /></div>}
      {!isFinal && <InboxReviewEditor detail={detail} onSaved={onSaved} onDirty={setReviewDirty} />}
      {/* Extracted preview */}
      {ex && (
        <div className="p-5 bg-muted/40">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("ما استخرجه الذكاء", "What AI extracted")}
            </div>
            {ex.confidence != null && (
              <span className="text-xs text-muted-foreground/60 font-english">{t("ثقة:", "Confidence:")} {displayDigits((ex.confidence * 100).toFixed(0))}%</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label={t("المورّد", "Supplier")} value={ex.issuer?.name} />
            {ex.issuer?.vatNumber ? <Field label={t("الرقم الضريبي", "VAT number")} value={ex.issuer.vatNumber} mono /> : null}
            {ex.issuer?.crNumber ? <Field label={t("السجل التجاري", "CR number")} value={ex.issuer.crNumber} mono /> : null}
            {ex.issuer?.unifiedNationalNumber ? <Field label={t("الرقم الوطني الموحد (700)", "Unified National Number (700)")} value={ex.issuer.unifiedNationalNumber} mono /> : null}
            <Field label={t("رقم الفاتورة", "Invoice number")} value={ex.documentNumber} mono />
            <Field label={t("تاريخ الإصدار", "Issue date")} value={ex.issueDate} mono />
            <Field label={t("تاريخ الاستحقاق", "Due date")} value={ex.dueDate} mono />
            <Field label={t("الإجمالي", "Total")} value={ex.totals?.total != null ? `${Number(ex.totals.total).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })} ${ex.currency || "SAR"}` : null} mono bold />
            <Field label={t("الضريبة", "Tax")} value={ex.totals?.tax != null ? `${Number(ex.totals.tax).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })}` : null} mono />
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-start px-3 py-2 font-medium">{t("الوصف", "Description")}</th>
                    <th className="text-end px-3 py-2 font-medium">{t("الكمية", "Qty")}</th>
                    <th className="text-end px-3 py-2 font-medium">{t("السعر", "Price")}</th>
                    <th className="text-end px-3 py-2 font-medium">{t("ضريبة", "Tax")}</th>
                    <th className="text-end px-3 py-2 font-medium">{t("الإجمالي", "Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: any, i: number) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-3 py-1.5 text-foreground/80">{l.description || "—"}</td>
                      <td className="px-3 py-1.5 text-end font-english">{l.quantity}</td>
                      <td className="px-3 py-1.5 text-end font-english">{Number(l.unitPrice || 0).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-1.5 text-end font-english">{displayDigits(((l.taxRate || 0) * 100).toFixed(0))}%</td>
                      <td className="px-3 py-1.5 text-end font-english font-semibold">{Number(l.lineTotal || (l.quantity * l.unitPrice) || 0).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ex.warnings && ex.warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <ul className="space-y-0.5">
                {ex.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Possible Duplicate warning · proactive check before approve */}
      {dupInfo?.possibleDuplicate && !isFinal && (
        <div className="p-4 bg-warning-subtle border-t border-warning-border">
          <div className="flex items-start gap-2 text-sm text-warning">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div style={{ fontWeight: 700 }}>{t("⚠️ قد يكون مكرراً", "⚠️ Possible duplicate")}</div>
              {dupInfo.match && (
                <div className="text-xs text-warning">
                  {t("يوجد فاتورة شراء مطابقة:", "A matching purchase bill exists:")} <span className="font-english">{dupInfo.match.billNumber}</span>
                  {" · "}{t("الإجمالي", "Total")} <span className="font-english">{Number(dupInfo.match.total).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })}</span>
                  {" · "}{t("المورّد", "Supplier")} {dupInfo.match.supplierName || "—"}
                  {" · "}{t("بتاريخ", "dated")} <span className="font-english">{String(dupInfo.match.issueDate).slice(0, 10)}</span>
                </div>
              )}
              <div className="text-xs text-warning">{t("راجع البيانات بعناية قبل الاعتماد · يمكنك الاعتماد (تجاوز التحذير) أو الرفض.", "Review the data carefully before approving · you can approve (override the warning) or reject.")}</div>
            </div>
          </div>
        </div>
      )}

      {reviewDirty && <p className="p-5 text-warning">{t("احفظ المراجعة أولًا لتنتقل تعديلاتك وملاحظاتك إلى المستند.", "Save the review first to carry your changes and notes into the document.")}</p>}
      {/* Actions */}
      {!isFinal && detail.status !== "REJECTED" && (
        <div className="p-5 flex flex-wrap items-center gap-2">
          {ex ? (
            <>
              <button
                onClick={onApprove}
                disabled={busy || reviewDirty}
                className="px-4 py-2 rounded-lg bg-success text-primary-foreground text-sm hover:bg-success transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t("اعتماد · إنشاء فاتورة شراء", "Approve · create purchase bill")}
              </button>
              <button
                onClick={onReprocess}
                disabled={busy || reviewDirty}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {t("إعادة الاستخراج", "Re-extract")}
              </button>
              <button
                onClick={()=>setRejectOpen(!rejectOpen)}
                disabled={busy || reviewDirty}
                className="px-4 py-2 rounded-lg border border-danger-border text-danger text-sm hover:bg-danger-subtle transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" /> {t("رفض", "Reject")}
              </button>
              <button
                onClick={onManualEntry}
                disabled={busy || reviewDirty}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5 disabled:opacity-50"
                title={t("إدخال يدوي للبنود في سجل مصروف/مشتريات", "Manually enter lines into an expense/purchase record")}
              >
                <FileText className="h-3.5 w-3.5" /> {t("تحويل إلى مصروف", "Create expense")}
              </button>
            </>
          ) : (
            <button
              onClick={onReprocess}
              disabled={busy || reviewDirty}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {t("استخراج بالذكاء", "Extract with AI")}
            </button>
          )}
          {/* Manual entry is always available (even before extraction) */}
          {!ex && (
            <button
              onClick={onManualEntry}
              disabled={busy || reviewDirty}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5 disabled:opacity-50"
              title={t("إدخال يدوي للبنود في سجل مصروف/مشتريات", "Manually enter lines into an expense/purchase record")}
            >
              <FileText className="h-3.5 w-3.5" /> {t("تحويل إلى مصروف", "Create expense")}
            </button>
          )}
        </div>
      )}

      {rejectOpen && !isFinal && <div className="p-5 space-y-2"><label>{t("سبب الرفض", "Rejection reason")}<textarea value={reason} onChange={e=>setReason(e.target.value)} className="block w-full border border-border rounded p-2 bg-background" /></label><button disabled={busy || !reason.trim()} onClick={()=>onReject(reason)} className="text-primary disabled:opacity-50">{t("تأكيد الرفض", "Confirm rejection")}</button></div>}
      {detail.expenseId && <div className="p-5"><a className="text-primary underline" href={`/app/expenses/${detail.expenseId}`}>{t("عرض المصروف المرتبط", "View linked expense")}</a></div>}
      {detail.billId && (
        <div className="p-5 bg-success-subtle flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {t("تم إنشاء فاتورة شراء من هذه الرسالة ·", "A purchase bill was created from this message ·")} <a href={`/app/purchases/bills/${detail.billId}`} className="underline">{t("عرض الفاتورة", "View bill")}</a>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono, bold }: { label: string; value?: string | null; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground/60">{label}</div>
      <div className={`text-sm text-foreground ${mono ? "font-english" : ""} ${bold ? "font-semibold" : ""}`}>
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
