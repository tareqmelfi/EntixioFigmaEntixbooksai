/**
 * ZatcaStatusBadge · one truthful label for the org's ZATCA Phase 2 link.
 *   connected      → «مربوط بالهيئة · شهادة الإنتاج فعّالة»
 *   in_progress    → «قيد الربط · الخطوة N من 4»
 *   not_connected  → «غير مربوط»
 * Sized for the header strip, the company tab row and the ZATCA tab title.
 */
import { Link } from "react-router";
import { useLanguage } from "./LanguageContext";
import type { ZatcaStatus } from "../lib/use-zatca-status";

export function zatcaStatusLabel(s: ZatcaStatus, t: (ar: string, en?: string) => string): string {
  if (s.loading) return t("جارٍ التحقق من حالة الربط…", "Checking link status…");
  if (!s.raw) return t("تعذر تحديث حالة الربط", "Unable to refresh link status");
  if (s.raw.deviceProof?.certificateState === "expired") return t("شهادة الجهاز منتهية · يلزم التجديد", "Device certificate expired · renew");
  if (s.connection === "connected") return t("تم ربط جهاز المنشأة · شهادة إنتاج سارية", "Organization device linked · production certificate valid");
  if (s.status === "PRODUCTION") return t("شهادة جهاز محفوظة · قيد التحقق", "Device certificate stored · under validation");
  if (s.connection === "in_progress") return t(`قيد الربط · الخطوة ${s.step} من 4`, `Linking · step ${s.step} of 4`);
  return t("غير مربوط بالهيئة", "Not linked to ZATCA");
}

export function ZatcaStatusBadge({ status, size = "sm", className = "" }: { status: ZatcaStatus; size?: "sm" | "xs"; className?: string }) {
  const { t } = useLanguage();
  /* Ledger status: a dot and a word. Blue when the production certificate is issued,
     copper while linking, muted (hollow dot) before it starts. Colour never alone. */
  const tone = status.loading
    ? "border-border bg-card text-muted-foreground"
    : status.connection === "connected"
      ? "border-success-border bg-success-subtle text-success"
      : status.connection === "in_progress"
        ? "border-warning-border bg-warning-subtle text-warning"
        : "border-border bg-card text-muted-foreground";
  const dot = status.loading || status.connection === "not_connected" ? "ledger-dot hollow" : "ledger-dot";
  const pad = size === "xs" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border font-semibold ${pad} ${tone} ${className}`} data-zatca-connection={status.connection}>
      <span className={dot} aria-hidden="true" />
      <span>{zatcaStatusLabel(status, t)}</span>
    </span>
  );
}

/** Company-tab row: badge + the right next action (start · continue · details). */
export function ZatcaStatusRow({ status }: { status: ZatcaStatus }) {
  const { t } = useLanguage();
  const action = status.connection === "connected"
    ? t("التفاصيل", "Details")
    : status.connection === "in_progress"
      ? t("إكمال الربط", "Continue linking")
      : t("ابدأ الربط", "Start linking");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-subtle p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <span className="text-sm font-semibold text-foreground">{t("الفوترة الإلكترونية · ZATCA Phase 2", "E-invoicing · ZATCA Phase 2")}</span>
        <ZatcaStatusBadge status={status} size="xs" />
      </div>
      <Link to="/app/settings?tab=zatca" className="text-xs font-semibold text-primary hover:underline">{action}</Link>
    </div>
  );
}
