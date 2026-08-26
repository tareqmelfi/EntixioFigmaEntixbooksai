/**
 * ZatcaStatusBadge · one truthful label for the org's ZATCA Phase 2 link.
 *   🟢 connected      → «مربوط بالهيئة · شهادة الإنتاج فعّالة»
 *   🟡 in_progress    → «قيد الربط · الخطوة N من 4»
 *   ⚪ not_connected  → «غير مربوط»
 * Sized for the header strip, the company tab row and the ZATCA tab title.
 */
import { Link } from "react-router";
import { CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import type { ZatcaStatus } from "../lib/use-zatca-status";

export function zatcaStatusLabel(s: ZatcaStatus, t: (ar: string, en?: string) => string): string {
  if (s.loading) return t("جارٍ التحقق من حالة الربط…", "Checking link status…");
  if (s.connection === "connected") return t("مربوط بالهيئة · شهادة الإنتاج فعّالة", "Linked to ZATCA · production certificate active");
  if (s.connection === "in_progress") return t(`قيد الربط · الخطوة ${s.step} من 4`, `Linking · step ${s.step} of 4`);
  return t("غير مربوط بالهيئة", "Not linked to ZATCA");
}

export function ZatcaStatusBadge({ status, size = "sm", className = "" }: { status: ZatcaStatus; size?: "sm" | "xs"; className?: string }) {
  const { t } = useLanguage();
  const tone = status.loading
    ? "bg-muted text-muted-foreground border-border"
    : status.connection === "connected"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status.connection === "in_progress"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : "bg-muted text-muted-foreground border-border";
  const Icon = status.loading ? Loader2 : status.connection === "connected" ? CheckCircle2 : CircleDashed;
  const pad = size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${pad} ${tone} ${className}`} style={{ fontWeight: 600 }} data-zatca-connection={status.connection}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${status.loading ? "animate-spin" : ""}`} />
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
  const box = status.connection === "connected"
    ? "bg-emerald-50 border-emerald-200"
    : status.connection === "in_progress"
      ? "bg-amber-50 border-amber-200"
      : "bg-muted/40 border-border";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${box}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("الفوترة الإلكترونية · ZATCA Phase 2", "E-invoicing · ZATCA Phase 2")}</span>
        <ZatcaStatusBadge status={status} size="xs" />
      </div>
      <Link to="/app/settings?tab=zatca" className="text-xs text-primary hover:underline" style={{ fontWeight: 600 }}>{action}</Link>
    </div>
  );
}
