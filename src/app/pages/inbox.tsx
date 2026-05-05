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
import { api, ApiError, InboxMessageRow, InboxMessageDetail } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";

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
  const [items, setItems] = useState<InboxMessageRow[]>([]);
  const [detail, setDetail] = useState<InboxMessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [orgSlug, setOrgSlug] = useState<string>("YOUR-ORG");

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
      push("error",e instanceof ApiError ? e.message : "فشل تحميل البريد الوارد");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Fetch org slug for display
  useEffect(() => {
    api.me().then((s: any) => {
      const slug = s?.activeOrg?.slug || s?.org?.slug || s?.memberships?.[0]?.org?.slug;
      if (slug) setOrgSlug(slug);
    }).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loadDetail = async (id: string) => {
    try {
      const d = await api.inbox.get(id);
      setDetail(d);
    } catch (e: any) {
      push("error","فشل تحميل تفاصيل الرسالة");
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.inbox.approve(detail.id);
      push("success",`✓ أُنشئت فاتورة شراء ${r.billNumber}`);
      await refresh();
      loadDetail(detail.id);
    } catch (e: any) {
      push("error",e instanceof ApiError ? e.message : "فشل الاعتماد");
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
      push("error","فشل الرفض");
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
      push("error","فشل الاستخراج");
    } finally {
      setBusy(false);
    }
  };

  const forwardAddress = `bills+${orgSlug}@entix.io`;

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            <InboxIcon className="h-6 w-6 text-[#1276E3]" /> البريد الوارد
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            مرّر الفواتير من المورّدين إلى عنوانك المخصّص · والذكاء يستخرجها كمسودات جاهزة للاعتماد
          </p>
        </div>
      </div>

      {/* Forwarding address banner */}
      <Card className="border-blue-200 bg-gradient-to-l from-[#F4FCFF] to-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-[#1276E3] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#6B7280]">عنوان البريد الخاص بمنشأتك</div>
              <code className="text-sm text-[#0B1B49] font-english font-semibold">{forwardAddress}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(forwardAddress);
                push("success","تم نسخ العنوان");
              }}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> نسخ
            </button>
          </div>
          <p className="text-xs text-[#6B7280] mt-2">
            💡 اطلب من مورّديك إرسال فواتيرهم لهذا العنوان · أو انسخ بريدك إلى هذا العنوان (CC) عند تلقّي الفواتير
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
                ? "bg-[#1276E3] text-white"
                : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#1276E3]/40"
            }`}
          >
            {s === "ALL" ? "الكل" : STATUS_LABEL[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left · list */}
        <Card className="lg:col-span-5 border-[#E5E7EB] max-h-[70vh] overflow-y-auto">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[#1276E3]" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-6">
                <InboxIcon className="h-12 w-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">صندوق الوارد فارغ</p>
                <p className="text-xs text-[#9CA3AF] mt-1">حوّل أي فاتورة إلى <span className="font-english">{forwardAddress}</span> لترى الذكاء يستخرجها هنا</p>
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
                      className={`px-4 py-3 cursor-pointer border-b border-[#F3F4F6] last:border-0 transition ${
                        active ? "bg-[#F4FCFF] border-l-4 border-l-[#1276E3]" : "hover:bg-[#FAFBFC]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-[#0B1B49] truncate font-english">{m.from}</div>
                          <div className="text-xs text-[#6B7280] truncate mt-0.5">{m.subject || "(بدون عنوان)"}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${sl.bg} ${sl.text}`}>
                              {sl.label}
                            </span>
                            {m.attachmentCount > 0 && (
                              <span className="text-xs text-[#9CA3AF] flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" /> <span className="font-english">{m.attachmentCount}</span>
                              </span>
                            )}
                            {m.extractedTotal != null && (
                              <span className="text-xs text-[#0B1B49] font-english">
                                {m.extractedTotal.toLocaleString()} {m.extractedCurrency || "SAR"}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-[#9CA3AF] font-english shrink-0">
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
        <Card className="lg:col-span-7 border-[#E5E7EB]">
          <CardContent className="p-0">
            {!detail ? (
              <div className="text-center py-20 px-6">
                <Mail className="h-12 w-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-sm text-[#9CA3AF]">اختر رسالة من القائمة</p>
              </div>
            ) : (
              <DetailPane
                detail={detail}
                busy={busy}
                onApprove={handleApprove}
                onReject={handleReject}
                onReprocess={handleReprocess}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailPane({
  detail, busy, onApprove, onReject, onReprocess,
}: {
  detail: InboxMessageDetail;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReprocess: () => void;
}) {
  const ex = detail.extractedJson || null;
  const lines: any[] = ex?.lines || [];
  const sl = STATUS_LABEL[detail.status] || { label: detail.status, bg: "bg-gray-100", text: "text-gray-600" };
  const isFinal = detail.status === "APPROVED" || detail.status === "REJECTED";

  return (
    <div className="divide-y divide-[#F3F4F6]">
      {/* Email header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base text-[#0B1B49]" style={{ fontWeight: 600 }}>{detail.subject || "(بدون عنوان)"}</div>
            <div className="text-sm text-[#6B7280] mt-1 font-english">من: {detail.fromAddress}</div>
            <div className="text-xs text-[#9CA3AF] mt-0.5 font-english">إلى: {detail.toAddress}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${sl.bg} ${sl.text}`}>{sl.label}</span>
        </div>
      </div>

      {/* Attachments */}
      {detail.attachments.length > 0 && (
        <div className="p-5">
          <div className="text-xs text-[#6B7280] mb-2 flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> المرفقات
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] text-xs">
                <FileText className="h-3.5 w-3.5 text-[#1276E3]" />
                <span className="text-[#374151] font-english">{a.filename}</span>
                <span className="text-[#9CA3AF] font-english">· {(a.sizeBytes / 1024).toFixed(0)}KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted preview */}
      {ex && (
        <div className="p-5 bg-[#FAFBFC]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-[#6B7280] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#1276E3]" /> ما استخرجه الذكاء
            </div>
            {ex.confidence != null && (
              <span className="text-xs text-[#9CA3AF] font-english">ثقة: {(ex.confidence * 100).toFixed(0)}%</span>
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
            <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280]">
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
                    <tr key={i} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-1.5 text-[#374151]">{l.description || "—"}</td>
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
                className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition flex items-center gap-1.5 disabled:opacity-50"
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
            </>
          ) : (
            <button
              onClick={onReprocess}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-[#1276E3] text-white text-sm hover:bg-[#0F66C7] transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              استخراج بالذكاء
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
      <div className="text-xs text-[#9CA3AF]">{label}</div>
      <div className={`text-sm text-[#0B1B49] ${mono ? "font-english" : ""} ${bold ? "font-semibold" : ""}`}>
        {value || <span className="text-[#D1D5DB]">—</span>}
      </div>
    </div>
  );
}
