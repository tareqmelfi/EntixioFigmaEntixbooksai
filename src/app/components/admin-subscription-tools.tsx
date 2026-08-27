/**
 * Admin v3 · R1.5 — subscription tools shared by /admin/subscriptions and the
 * company workspace (CEO 27/08):
 *   <SubscriptionProgress>  the «tube»: elapsed/remaining of the current period
 *   <OriginBadge>           who created the company (user · agent · admin · demo …)
 *   <SubscriptionManagePanel> inline (no dialog · UX-1) — sponsored / lifetime /
 *                           manual-with-end / trial / renew / cancel · plan · note
 */
import { useEffect, useMemo, useState } from "react";
import { Crown, HeartHandshake, CalendarClock, FlaskConical, RefreshCw, Ban, Loader2, Check } from "lucide-react";
import { api, ApiError, type AdminPlanRecord, type AdminSubManageMode } from "../lib/api";
import { useLanguage } from "./LanguageContext";

export function SubscriptionProgress({ start, end, status, lifetime, sponsored, compact = false }: { start?: string | null; end?: string | null; status: string; lifetime?: boolean; sponsored?: boolean; compact?: boolean }) {
  const { t } = useLanguage();
  if (lifetime || sponsored || (status === "ACTIVE" && !end)) {
    return (
      <div className={compact ? "min-w-[120px]" : ""}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full w-full rounded-full" style={{ background: "linear-gradient(90deg,#0B1B49,#1276E3)" }} /></div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sponsored ? t("مدعوم · بلا نهاية", "Sponsored · open-ended") : t("مدى الحياة · بلا نهاية", "Lifetime · open-ended")}</div>
      </div>
    );
  }
  if (!end) return <span className="text-[11px] text-muted-foreground">—</span>;
  const now = Date.now();
  const e = new Date(end).getTime();
  const s = start ? new Date(start).getTime() : e - 30 * 86400000;
  const total = Math.max(1, e - s);
  const pct = Math.min(100, Math.max(0, Math.round(((now - s) / total) * 100)));
  const daysLeft = Math.ceil((e - now) / 86400000);
  const tone = daysLeft < 0 ? "#E84B4B" : daysLeft <= 7 ? "#F59E0B" : "#1276E3";
  return (
    <div className={compact ? "min-w-[120px]" : ""}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} /></div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{daysLeft < 0 ? t(`منتهٍ منذ ${Math.abs(daysLeft)} يوم`, `expired ${Math.abs(daysLeft)}d ago`) : daysLeft === 0 ? t("ينتهي اليوم", "ends today") : t(`باقي ${daysLeft} يوم`, `${daysLeft}d left`)}</span>
        <span className="font-english">{pct}%</span>
      </div>
    </div>
  );
}

const ORIGIN: Record<string, { ar: string; en: string; cls: string }> = {
  user: { ar: "أنشأها مستخدم", en: "Created by user", cls: "bg-blue-50 text-blue-700" },
  signup: { ar: "تسجيل جديد", en: "Signup", cls: "bg-blue-50 text-blue-700" },
  public_checkout: { ar: "دفع ثم تسجيل", en: "Pay-first signup", cls: "bg-emerald-50 text-emerald-700" },
  agent: { ar: "وكيل الذكاء", en: "AI agent", cls: "bg-violet-50 text-violet-700" },
  admin: { ar: "الأدمن", en: "Admin", cls: "bg-[#0B1B49]/10 text-[#0B1B49]" },
  internal: { ar: "داخلي · اختبار", en: "Internal · test", cls: "bg-amber-50 text-amber-800" },
  demo: { ar: "ديمو", en: "Demo", cls: "bg-muted text-muted-foreground" },
  seed: { ar: "بيانات أولية", en: "Seed", cls: "bg-muted text-muted-foreground" },
  import: { ar: "استيراد", en: "Import", cls: "bg-cyan-50 text-cyan-800" },
};
export function OriginBadge({ via, size = "xs" }: { via?: string | null; size?: "xs" | "sm" }) {
  const { language } = useLanguage();
  if (!via) return null;
  const o = ORIGIN[via] || { ar: via, en: via, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded-full px-2 ${size === "xs" ? "py-0.5 text-[10px]" : "py-0.5 text-[11px]"} ${o.cls}`} style={{ fontWeight: 600 }}>{language === "ar" ? o.ar : o.en}</span>;
}

export function SubscriptionSourceBadge({ source, lifetime, sponsored }: { source?: string; lifetime?: boolean; sponsored?: boolean }) {
  const { t } = useLanguage();
  if (sponsored || source === "sponsored") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white" style={{ fontWeight: 700 }}><HeartHandshake className="h-3 w-3" />{t("مدعوم", "SPONSORED")}</span>;
  if (lifetime || source === "lifetime") return <span className="inline-flex items-center gap-1 rounded-full bg-[#0B1B49] px-2 py-0.5 text-[10px] text-white" style={{ fontWeight: 700 }}><Crown className="h-3 w-3" />LIFETIME</span>;
  if (source === "stripe") return <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700" style={{ fontWeight: 700 }}>STRIPE</span>;
  if (source === "manual") return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800" style={{ fontWeight: 700 }}>{t("يدوي", "MANUAL")}</span>;
  if (source === "free") return <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground" style={{ fontWeight: 700 }}>{t("مجاني", "FREE")}</span>;
  return null;
}

const MODES: Array<{ id: AdminSubManageMode; icon: any; ar: string; en: string; hintAr: string; hintEn: string; needsEnd?: boolean }> = [
  { id: "sponsored", icon: HeartHandshake, ar: "مدعوم منّي", en: "Sponsored", hintAr: "نفس مزايا الباقة · بلا دفع · بلا نهاية · Stripe لا يلمسه · تراقب استهلاكه", hintEn: "Full plan features · no payment · open-ended · immune to Stripe · you watch usage" },
  { id: "lifetime", icon: Crown, ar: "مدى الحياة", en: "Lifetime", hintAr: "منحة دائمة (دفع مرة واحدة أو شراكة)", hintEn: "Permanent grant (one-off payment or partnership)" },
  { id: "manual", icon: CalendarClock, ar: "يدوي حتى تاريخ", en: "Manual until date", hintAr: "«عليّ 3 أشهر ثم يدفع» — ينزل تلقائيًا للمجاني عند الانتهاء", hintEn: "“On me for N months, then he pays” — drops to free at the end", needsEnd: true },
  { id: "trial", icon: FlaskConical, ar: "تجربة", en: "Trial", hintAr: "تجربة بمدة تحددها", hintEn: "Trial for the period you set", needsEnd: true },
  { id: "renew", icon: RefreshCw, ar: "تجديد يدوي", en: "Renew manually", hintAr: "يمدّ نهاية الفترة الحالية", hintEn: "Pushes the current period end forward", needsEnd: true },
  { id: "cancel", icon: Ban, ar: "إلغاء", en: "Cancel", hintAr: "الشركة تبقى على المجاني · بياناتها محفوظة", hintEn: "Company stays on Free · data intact" },
];

export function SubscriptionManagePanel({ orgId, currency, currentPlanId, currentMode, currentNote, onDone, onCancel }: { orgId: string; currency?: string; currentPlanId?: string | null; currentMode?: string | null; currentNote?: string | null; onDone: (msg: string) => void; onCancel: () => void }) {
  const { t, language } = useLanguage();
  const [plans, setPlans] = useState<AdminPlanRecord[]>([]);
  const [mode, setMode] = useState<AdminSubManageMode>((currentMode as AdminSubManageMode) || "sponsored");
  const [planId, setPlanId] = useState<string>(currentPlanId || "");
  const [months, setMonths] = useState(3);
  const [periodEnd, setPeriodEnd] = useState("");
  const [note, setNote] = useState(currentNote || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.admin.plans().then((r) => setPlans(r.items.filter((p) => p.isActive && p.price > 0))).catch(() => {}); }, []);
  const cur = (currency || "SAR").toUpperCase();
  const visiblePlans = useMemo(() => {
    const same = plans.filter((p) => p.currency.toUpperCase() === cur);
    return same.length ? same : plans;
  }, [plans, cur]);
  const m = MODES.find((x) => x.id === mode)!;

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api.admin.manageSubscription(orgId, {
        mode,
        planId: mode === "cancel" ? undefined : planId || undefined,
        months: m.needsEnd && !periodEnd ? months : undefined,
        periodEnd: m.needsEnd && periodEnd ? new Date(periodEnd + "T23:59:59Z").toISOString() : undefined,
        note: note.trim() || null,
      });
      onDone(t(`تم: ${language === "ar" ? m.ar : m.en}`, `Done: ${m.en}`));
    } catch (e) { setErr(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-white p-4 shadow-[0_8px_24px_rgba(11,27,73,0.08)]">
      <div className="mb-3 text-sm text-foreground" style={{ fontWeight: 700 }}>{t("تغيير الاشتراك", "Change subscription")}</div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {MODES.map((x) => (
          <button key={x.id} type="button" onClick={() => setMode(x.id)} className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition ${mode === x.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground" style={{ fontWeight: 700 }}><x.icon className={`h-3.5 w-3.5 ${x.id === "cancel" ? "text-red-600" : "text-primary"}`} />{language === "ar" ? x.ar : x.en}</span>
            <span className="text-[10px] leading-snug text-muted-foreground">{language === "ar" ? x.hintAr : x.hintEn}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {mode !== "cancel" && (
          <label className="text-xs text-muted-foreground">
            {t("الباقة", "Plan")}
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-white px-2 py-2 text-sm text-foreground">
              <option value="">{t("— الحالية / الأعلى تلقائيًا —", "— current / highest automatically —")}</option>
              {visiblePlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.tier} · {p.interval} · {(p.price / 100).toLocaleString("en-US")} {p.currency.toUpperCase()}</option>)}
            </select>
          </label>
        )}
        {m.needsEnd && (
          <>
            <label className="text-xs text-muted-foreground">
              {t("عدد الأشهر", "Months")}
              <input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))} disabled={!!periodEnd} className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm font-english" dir="ltr" />
            </label>
            <label className="text-xs text-muted-foreground">
              {t("أو تاريخ نهاية محدد", "or an exact end date")}
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm font-english" dir="ltr" />
            </label>
          </>
        )}
        <label className={`text-xs text-muted-foreground ${m.needsEnd ? "md:col-span-3" : "md:col-span-2"}`}>
          {t("ملاحظة (تظهر في سجل الأثر وبطاقة الاشتراك)", "Note (shown in the audit trail and the subscription card)")}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("مثال: اتفاق شفوي — يشترك بالمؤسسي وأفتح له البقية", "e.g. verbal deal — pays Enterprise, I open the rest")} className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm" />
        </label>
      </div>
      {err && <div className="mt-2 text-xs text-red-700">{err}</div>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => void submit()} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-white ${mode === "cancel" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`} style={{ fontWeight: 600 }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("تطبيق", "Apply")}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{t("إغلاق", "Close")}</button>
      </div>
    </div>
  );
}
