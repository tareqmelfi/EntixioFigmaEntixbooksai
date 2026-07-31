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
import { useNavigate } from "react-router";
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
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";

type StatusFilter = "ALL" | "RECEIVED" | "EXTRACTED" | "APPROVED" | "REJECTED";

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  RECEIVED:  { label: "وصل",       bg: "bg-blue-50",   text: "text-blue-700" },
  EXTRACTED: { label: "تم الاستخراج", bg: "bg-amber-50",  text: "text-amber-700" },
  APPROVED:  { label: "معتمد",     bg: "bg-green-50",  text: "text-green-700" },
  REJECTED:  { label: "مرفوض",     bg: "bg-gray-100",  text: "text-gray-600" },
  ERROR:     { label: "فشل",       bg: "bg-red-50",    text: "text-red-700" },
};

export function InboxPage() {
  const { toasts, push, dismiss } = useToasts();
  const { language } = useLanguage();
  const [items, setItems] = useState<InboxMessageRow[]>([]);
  const [detail, setDetail] = useState<InboxMessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [orgSlug, setOrgSlug] = useState<string>("YOUR-ORG");
  const [mailboxStatus, setMailboxStatus] = useState<any>(null);

  // Fetch list
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.inbox.list(filter === "ALL" ? undefined : filter);
      setItems(r.items);
      // Auto-select first unprocessed
      if (!detail && r.items.length > 0) {
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
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const active = (stored ? orgs.find((o) => o.id === stored) : null) || orgs[0];
      if (active?.slug) setOrgSlug(active.slug);
    }).catch(() => {});
    api.inbox.status().then(setMailboxStatus).catch(() => setMailboxStatus(null));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loadDetail = async (id: string) => {
    try {
      const d = await api.inbox.get(id);
      setDetail(d);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تحميل تفاصيل الرسالة", en: "Failed to load message details" }));
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.inbox.approve(detail.id) as any;
      const att = r.attachmentStatus?.attached > 0 ? ` · ${r.attachmentStatus.attached} مرفق` : "";
      if (r.dedupeDecision === "UPDATED") {
        push("success", `تم تحديث فاتورة الشراء الموجودة ${r.billNumber}${att}`);
      } else if (r.dedupeDecision === "SKIPPED_DUPLICATE") {
        push("info", `الفاتورة موجودة مسبقاً (${r.billNumber}) — لم تُنشأ نسخة مكررة${att}`, 6000);
      } else {
        push("success", `✓ أُنشئت فاتورة شراء ${r.billNumber}${att}`);
      }
      if (r.supplierResolvedTo?.displayName) {
        push("info", `المورّد: ${r.supplierResolvedTo.displayName}`, 4000);
      }
      await refresh();
      loadDetail(detail.id);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاعتماد", en: "Approve failed" }));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await api.inbox.reject(detail.id);
      push("success","تم الرفض");
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
      push("success",`تم استخراج ${r.lines} بنداً`);
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
        vendor: (detail.extractedJson as any)?.issuer?.name || detail.fromAddress,
        date: (detail.extractedJson as any)?.issueDate || null,
        total: (detail.extractedJson as any)?.totals?.total ?? null,
        currency: (detail.extractedJson as any)?.currency || null,
        invoiceNumber: (detail.extractedJson as any)?.documentNumber || null,
        lines: (detail.extractedJson as any)?.lines || [],
        __fromInbox: detail.id,
      }));
    } catch {}
    navigate("/app/expenses/new?fromOcr=1");
  };

  const forwardAddress = mailboxStatus?.address || `bills+${orgSlug}@entix.io`;

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            <InboxIcon className="h-6 w-6 text-primary" /> البريد الوارد
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            مرّر الفواتير من المورّدين إلى عنوانك المخصّص · والذكاء يستخرجها كمسودات جاهزة للاعتماد
          </p>
        </div>
      </div>

      {/* Forwarding address banner */}
      <Card className={mailboxStatus?.configured ? "border-blue-200 bg-gradient-to-l from-[#F4FCFF] to-white" : "border-amber-200 bg-amber-50"}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">عنوان البريد الخاص بمنشأتك</div>
              <code className="text-sm text-foreground font-english font-semibold">{forwardAddress}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(forwardAddress);
                push("success","تم نسخ العنوان");
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> نسخ
            </button>
          </div>
          <p className={`text-xs mt-2 ${mailboxStatus?.configured ? "text-muted-foreground" : "text-amber-800"}`}>
            {mailboxStatus?.configured
              ? "اطلب من مورّديك إرسال فواتيرهم لهذا العنوان · أو انسخ بريدك إلى هذا العنوان (CC) عند تلقّي الفواتير"
              : "العنوان غير جاهز للاستلام بعد. يلزم إعداد توجيه البريد و INBOX_WEBHOOK_TOKEN على الخادم قبل استخدامه مع الموردين."}
          </p>
        </CardContent>
      </Card>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", "RECEIVED", "EXTRACTED", "APPROVED", "REJECTED"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap ${
              filter === s
                ? "bg-primary text-white"
                : "bg-white border border-border text-muted-foreground hover:border-[#1276E3]/40"
            }`}
          >
            {s === "ALL" ? "الكل" : STATUS_LABEL[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left · list */}
        <Card className="lg:col-span-5 border-border max-h-[70vh] overflow-y-auto">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-6">
                <InboxIcon className="h-12 w-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">صندوق الوارد فارغ</p>
                <p className="text-xs text-muted-foreground/60 mt-1">حوّل أي فاتورة إلى <span className="font-english">{forwardAddress}</span> لترى الذكاء يستخرجها هنا</p>
              </div>
            ) : (
              <ul>
                {items.map((m) => {
                  const sl = STATUS_LABEL[m.status] || { label: m.status, bg: "bg-gray-100", text: "text-gray-600" };
                  const active = detail?.id === m.id;
                  return (
                    <li
                      key={m.id}
                      onClick={() => loadDetail(m.id)}
                      className={`px-4 py-3 cursor-pointer border-b border-border/50 last:border-0 transition ${
                        active ? "bg-primary/5 border-l-4 border-l-[#1276E3]" : "hover:bg-[#FAFBFC]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-foreground truncate font-english">{m.from}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{m.subject || "(بدون عنوان)"}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${sl.bg} ${sl.text}`}>
                              {sl.label}
                            </span>
                            {m.attachmentCount > 0 && (
                              <span className="text-xs text-muted-foreground/60 flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" /> <span className="font-english">{m.attachmentCount}</span>
                              </span>
                            )}
                            {m.extractedTotal != null && (
                              <span className="text-xs text-foreground font-english">
                                {m.extractedTotal.toLocaleString()} {m.extractedCurrency || "SAR"}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground/60 font-english shrink-0">
                          {new Date(m.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
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
        <Card className="lg:col-span-7 border-border">
          <CardContent className="p-0">
            {!detail ? (
              <div className="text-center py-20 px-6">
                <Mail className="h-12 w-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/60">اختر رسالة من القائمة</p>
              </div>
            ) : (
              <DetailPane
                detail={detail}
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
  detail, busy, onApprove, onReject, onReprocess, onManualEntry,
}: {
  detail: InboxMessageDetail;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReprocess: () => void;
  onManualEntry: () => void;
}) {
  const ex = detail.extractedJson || null;
  const lines: any[] = ex?.lines || [];
  const sl = STATUS_LABEL[detail.status] || { label: detail.status, bg: "bg-gray-100", text: "text-gray-600" };
  const isFinal = detail.status === "APPROVED" || detail.status === "REJECTED";

  // Proactive duplicate check · when a message is EXTRACTED, look for an existing
  // bill matching vendor + date + total so we can warn BEFORE the user approves.
  const [dupInfo, setDupInfo] = useState<{ possibleDuplicate: boolean; match?: any } | null>(null);
  useEffect(() => {
    setDupInfo(null);
    if (detail.status !== "EXTRACTED") return;
    api.inbox.duplicateCheck(detail.id).then((r) => setDupInfo(r)).catch(() => {});
  }, [detail.id, detail.status]);

  return (
    <div className="divide-y divide-[#F3F4F6]">
      {/* Email header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base text-foreground" style={{ fontWeight: 600 }}>{detail.subject || "(بدون عنوان)"}</div>
            <div className="text-sm text-muted-foreground mt-1 font-english">من: {detail.fromAddress}</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5 font-english">إلى: {detail.toAddress}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${sl.bg} ${sl.text}`}>{sl.label}</span>
        </div>
      </div>

      {/* Attachments */}
      {detail.attachments.length > 0 && (
        <div className="p-5">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> المرفقات
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-[#FAFBFC] text-xs">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-foreground/80 font-english">{a.filename}</span>
                <span className="text-muted-foreground/60 font-english">· {(a.sizeBytes / 1024).toFixed(0)}KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted preview */}
      {ex && (
        <div className="p-5 bg-[#FAFBFC]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> ما استخرجه الذكاء
            </div>
            {ex.confidence != null && (
              <span className="text-xs text-muted-foreground/60 font-english">ثقة: {(ex.confidence * 100).toFixed(0)}%</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="المورّد" value={ex.issuer?.name} />
            <Field label="رقم الفاتورة" value={ex.documentNumber} mono />
            <Field label="تاريخ الإصدار" value={ex.issueDate} mono />
            <Field label="تاريخ الاستحقاق" value={ex.dueDate} mono />
            <Field label="الإجمالي" value={ex.totals?.total != null ? `${Number(ex.totals.total).toLocaleString()} ${ex.currency || "SAR"}` : null} mono bold />
            <Field label="الضريبة" value={ex.totals?.tax != null ? `${Number(ex.totals.tax).toLocaleString()}` : null} mono />
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-start px-3 py-2 font-medium">الوصف</th>
                    <th className="text-end px-3 py-2 font-medium">الكمية</th>
                    <th className="text-end px-3 py-2 font-medium">السعر</th>
                    <th className="text-end px-3 py-2 font-medium">ضريبة</th>
                    <th className="text-end px-3 py-2 font-medium">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: any, i: number) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-3 py-1.5 text-foreground/80">{l.description || "—"}</td>
                      <td className="px-3 py-1.5 text-end font-english">{l.quantity}</td>
                      <td className="px-3 py-1.5 text-end font-english">{Number(l.unitPrice || 0).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-end font-english">{((l.taxRate || 0) * 100).toFixed(0)}%</td>
                      <td className="px-3 py-1.5 text-end font-english font-semibold">{Number(l.lineTotal || (l.quantity * l.unitPrice) || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ex.warnings && ex.warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
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
        <div className="p-4 bg-amber-50 border-t border-amber-200">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div style={{ fontWeight: 700 }}>⚠️ قد يكون مكرراً</div>
              {dupInfo.match && (
                <div className="text-xs text-amber-700">
                  يوجد فاتورة شراء مطابقة: <span className="font-english">{dupInfo.match.billNumber}</span>
                  {" · "}الإجمالي <span className="font-english">{Number(dupInfo.match.total).toLocaleString()}</span>
                  {" · "}المورّد {dupInfo.match.supplierName || "—"}
                  {" · "}بتاريخ <span className="font-english">{String(dupInfo.match.issueDate).slice(0, 10)}</span>
                </div>
              )}
              <div className="text-xs text-amber-700">راجع البيانات بعناية قبل الاعتماد · يمكنك الاعتماد (تجاوز التحذير) أو الرفض.</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isFinal && (
        <div className="p-5 flex flex-wrap items-center gap-2">
          {ex ? (
            <>
              <button
                onClick={onApprove}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                اعتماد · إنشاء فاتورة شراء
              </button>
              <button
                onClick={onReprocess}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> إعادة الاستخراج
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" /> رفض
              </button>
              <button
                onClick={onManualEntry}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5 disabled:opacity-50"
                title="إدخال يدوي للبنود في سجل مصروف/مشتريات"
              >
                <FileText className="h-3.5 w-3.5" /> إدخال يدوي
              </button>
            </>
          ) : (
            <button
              onClick={onReprocess}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-[#0F66C7] transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              استخراج بالذكاء
            </button>
          )}
          {/* Manual entry is always available (even before extraction) */}
          {!ex && (
            <button
              onClick={onManualEntry}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-primary/5 transition flex items-center gap-1.5 disabled:opacity-50"
              title="إدخال يدوي للبنود في سجل مصروف/مشتريات"
            >
              <FileText className="h-3.5 w-3.5" /> إدخال يدوي
            </button>
          )}
        </div>
      )}

      {detail.billId && (
        <div className="p-5 bg-green-50 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          تم إنشاء فاتورة شراء من هذه الرسالة · <a href={`/app/purchases/bills/${detail.billId}`} className="underline">عرض الفاتورة</a>
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
        {value || <span className="text-[#D1D5DB]">—</span>}
      </div>
    </div>
  );
}
