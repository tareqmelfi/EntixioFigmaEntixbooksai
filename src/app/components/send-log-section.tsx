/**
 * SendLogSection · «سجل الإرسال»
 *
 * CEO 2026-09-08: «وشوف الايميل الي راحت عليه كيف اعرف ان الايميلات وصلت؟»
 * — every send attempt is listed with a real status chip. We never show
 * DELIVERED unless a provider webhook confirmed it (accuracy over optimism):
 * a successful provider call is SENT with its message id shown.
 */
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { StatusBadge } from "./product";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useLanguage } from "./LanguageContext";
import { api, DocumentSendEntityType, DocumentSendRecord, DocumentSendStatus } from "../lib/api";

const TONE: Record<DocumentSendStatus, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  QUEUED: "warning",
  SENT: "success",
  DELIVERED: "success",
  OPENED: "success",
  BOUNCED: "critical",
  FAILED: "critical",
};

const LABEL: Record<DocumentSendStatus, [string, string]> = {
  DRAFT: ["مسودة", "Draft"],
  QUEUED: ["جارٍ الإرسال", "Sending"],
  SENT: ["أُرسلت", "Sent"],
  DELIVERED: ["وصلت", "Delivered"],
  OPENED: ["فُتحت", "Opened"],
  BOUNCED: ["ارتدت", "Bounced"],
  FAILED: ["فشل الإرسال", "Failed"],
};

interface Props {
  entityType: DocumentSendEntityType;
  entityId: string;
  /** Bump this to force a refetch after a new send (e.g. compose-form onSent). */
  refreshKey?: number;
  onResend: (record: DocumentSendRecord) => void;
}

export function SendLogSection({ entityType, entityId, refreshKey, onResend }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<DocumentSendRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.documentSends.list(entityType, entityId)
      .then((r) => { if (!cancelled) setRows(r.items); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [entityType, entityId, refreshKey]);

  if (rows === null) return null;
  if (rows.length === 0) return null;

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(language === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" });
    } catch { return iso; }
  };

  return (
    <section className="mt-6" data-testid="send-log-section">
      <h2 className="text-section font-semibold text-foreground">{t("سجل الإرسال", "Send log")}</h2>
      <div className="ledger-table mt-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("التاريخ", "Date")}</TableHead>
              <TableHead>{t("المستلمون", "Recipients")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
              <TableHead>{t("رقم الرسالة", "Message ID")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} data-testid="send-log-row">
                <TableCell className="whitespace-nowrap text-content-secondary">{fmtDate(r.sentAt || r.createdAt)}</TableCell>
                <TableCell className="min-w-0 max-w-[240px] truncate" dir="ltr" title={r.to.join(", ")}>{r.to.join(", ") || "—"}</TableCell>
                <TableCell>
                  <StatusBadge tone={TONE[r.status]}>{t(LABEL[r.status][0], LABEL[r.status][1])}</StatusBadge>
                  {r.status === "FAILED" && r.error ? <div className="mt-1 max-w-[220px] truncate text-xs text-danger" title={r.error}>{r.error}</div> : null}
                </TableCell>
                <TableCell>
                  <span className="font-code text-xs text-content-secondary">{r.providerMessageId || "—"}</span>
                </TableCell>
                <TableCell className="text-end">
                  <button
                    type="button"
                    onClick={() => onResend(r)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:border-border-strong"
                    data-testid="send-log-resend"
                  >
                    <RotateCcw className="h-3 w-3" strokeWidth={1.75} />
                    {t("إعادة الإرسال", "Resend")}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
