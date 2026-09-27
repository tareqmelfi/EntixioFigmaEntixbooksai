import { useEffect, useState } from "react";
import { api, type SignatureRequest } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { Button } from "./ui/button";

const ACTIVE = new Set(["SENDING", "UNKNOWN", "PENDING", "SENT", "VIEWED"]);
export function safeSignatureLink(value: string | null | undefined) {
  try { const url = new URL(value || ""); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function SignatureHistory({ docId, docType, revision, onBlocked }: {
  docId: string; docType: "QUOTE" | "INVOICE"; revision: number; onBlocked: (blocked: boolean) => void;
}) {
  const { t } = useLanguage();
  const [items, setItems] = useState<SignatureRequest[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(false); onBlocked(true);
    api.sign.listRequests({ docType, docId }).then(({ items }) => {
      if (!current) return;
      setItems(items); onBlocked(items.some(item => ACTIVE.has(item.status)));
    }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [docId, docType, revision, refresh, onBlocked]);
  const labels: Record<string, string> = {
    SENDING: t("جارٍ الإرسال", "Sending"), UNKNOWN: t("حالة التسليم تحتاج تحققًا", "Delivery needs verification"),
    PENDING: t("بانتظار التوقيع", "Pending signature"), SENT: t("أُرسل للتوقيع", "Sent for signing"),
    VIEWED: t("تمت المشاهدة", "Viewed"), SIGNED: t("موقّع", "Signed"), DECLINED: t("مرفوض", "Declined"),
    EXPIRED: t("منتهي", "Expired"), FAILED: t("تعذّر الإرسال", "Delivery failed"),
  };
  return <section aria-label={t("متابعة التوقيع", "Signature tracking")} className="rounded-lg border border-border p-4 space-y-3">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{t("متابعة التوقيع", "Signature tracking")}</h2>
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setRefresh(n => n + 1)}>{t("تحديث", "Refresh")}</Button></div>
    {loading ? <p role="status">{t("جارٍ تحميل الطلبات…", "Loading requests…")}</p> : error ? <p role="alert">{t("تعذّر تحميل حالة التوقيع. حدّث قبل إعادة الإرسال.", "Could not load signing status. Refresh before sending again.")}</p> : !items.length ? <p className="text-sm text-muted-foreground">{t("لم يُرسل هذا المستند للتوقيع بعد.", "This document has not been sent for signing yet.")}</p> : items.map(item => {
      const signing = ACTIVE.has(item.status) && safeSignatureLink(item.docusealEmbedUrl);
      const pdf = item.status === "SIGNED" && safeSignatureLink(item.signedPdfUrl);
      const audit = item.status === "SIGNED" && safeSignatureLink(item.auditTrailUrl);
      return <div key={item.id} className="border-t border-border pt-3 space-y-2">
        <p className="text-sm font-medium">{labels[item.status] || item.status} <span className="font-normal text-muted-foreground" dir="ltr">· {item.createdAt?.slice(0, 10)}</span></p>
        <div className="flex flex-wrap gap-3 text-sm text-primary">
          {signing && <a href={signing} target="_blank" rel="noopener noreferrer" className="underline">{t("فتح رابط التوقيع", "Open signing link")}</a>}
          {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" className="underline">{t("النسخة الموقعة PDF", "Signed PDF")}</a>}
          {audit && <a href={audit} target="_blank" rel="noopener noreferrer" className="underline">{t("سجل التوقيع", "Signing audit trail")}</a>}
        </div>
        {ACTIVE.has(item.status) && <p className="text-xs text-muted-foreground">{t("يوجد طلب قائم؛ استخدم رابطه. التوقيع مخصص للشخص المدعو.", "An active request exists; use its link. Signing is reserved for the invited person.")}</p>}
      </div>;
    })}
  </section>;
}
