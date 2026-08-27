/**
 * Admin Console v3 · Command center (/admin) — 2026-08-27.
 *
 * CEO brief: every important indicator, performance, support, customer service
 * and communication in ONE modern screen (references: Savine / uhuyy style —
 * soft KPI tiles with deltas · one hero chart · plan mix · attention list ·
 * support & comms panel · system health · latest orgs · recent admin actions).
 *
 * Data: GET /api/admin/metrics (admin-metrics.ts) — one payload, live.
 * Design: Navy #0B1B49 · Blue #1276E3 · Cyan #179FC5 (brand) · red only for
 * genuine loss/blocked states · Noto Sans Arabic / Inter · RTL-first.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Users, Building2, CreditCard, Sparkles, LifeBuoy, TrendingUp, TrendingDown, RefreshCw, Loader2,
  AlertTriangle, Clock, ShieldCheck, Server, Handshake, Megaphone, Crown, Download, ArrowUpRight, Bot, Mail, Activity,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api, ApiError, type AdminMetrics } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const NAVY = "#0B1B49", BLUE = "#1276E3", CYAN = "#179FC5", SOFT = "#9CC9EA";
const TIER_COLORS: Record<string, string> = { enterprise: NAVY, professional: BLUE, advanced: BLUE, premium: NAVY, lite: CYAN, starter: SOFT };

const fmtInt = (n: number) => Number(n || 0).toLocaleString("en-US");
const fmtMoney = (minor: number, cur: string) => `${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${cur}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const rel = (d: string | null | undefined, lang: "ar" | "en") => {
  if (!d) return "";
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(Math.abs(diff) / 86400000);
  if (days === 0) return lang === "ar" ? "اليوم" : "today";
  return diff > 0 ? (lang === "ar" ? `بعد ${days} يوم` : `in ${days}d`) : (lang === "ar" ? `منذ ${days} يوم` : `${days}d ago`);
};

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return null;
  const pct = prev ? Math.round(((now - prev) / prev) * 100) : 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`} style={{ fontWeight: 600 }} dir="ltr">
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{up ? "+" : ""}{pct}%
    </span>
  );
}

function Tile({ icon: Icon, label, value, sub, delta, tone = "blue", to }: { icon: any; label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: React.ReactNode; tone?: "blue" | "navy" | "cyan" | "amber" | "emerald"; to?: string }) {
  const tones: Record<string, string> = { blue: "bg-blue-50 text-blue-700", navy: "bg-[#0B1B49]/10 text-[#0B1B49]", cyan: "bg-cyan-50 text-cyan-700", amber: "bg-amber-50 text-amber-700", emerald: "bg-emerald-50 text-emerald-700" };
  const body = (
    <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(11,27,73,0.04)] transition hover:shadow-[0_8px_24px_rgba(11,27,73,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" /></span>
        {delta}
      </div>
      <div className="mt-3">
        <div className="text-[26px] leading-none text-foreground font-english tabular-nums" style={{ fontWeight: 800 }} dir="ltr">{value}</div>
        <div className="mt-1.5 text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground/80">{sub}</div>}
      </div>
      {to && <ArrowUpRight className="absolute end-3 bottom-3 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

function Panel({ title, icon: Icon, action, children, className = "" }: { title: string; icon?: any; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(11,27,73,0.04)] ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}>{Icon && <Icon className="h-4 w-4 text-primary" />}{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const KIND: Record<string, { ar: string; en: string; tone: string }> = {
  past_due: { ar: "متأخر السداد", en: "Past due", tone: "bg-red-50 text-red-700" },
  incomplete_checkout: { ar: "دفع غير مكتمل", en: "Incomplete checkout", tone: "bg-red-50 text-red-700" },
  trial_ending: { ar: "تجربة تنتهي", en: "Trial ending", tone: "bg-amber-50 text-amber-800" },
  cancel_scheduled: { ar: "إلغاء مجدول", en: "Cancel scheduled", tone: "bg-amber-50 text-amber-800" },
  silent_paid: { ar: "مدفوع بلا نشاط", en: "Paid · no activity", tone: "bg-amber-50 text-amber-800" },
  new_paid_onboarding: { ar: "عميل جديد مدفوع", en: "New paid · onboarding", tone: "bg-blue-50 text-blue-700" },
  unverified_owner: { ar: "بريد غير موثّق", en: "Owner unverified", tone: "bg-muted text-muted-foreground" },
  zatca_in_progress: { ar: "ZATCA قيد الربط", en: "ZATCA linking", tone: "bg-cyan-50 text-cyan-800" },
};

export function AdminOverview() {
  const { t, language } = useLanguage();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await api.admin.metrics(days)); setErr(null); }
    catch (e) { setErr(e instanceof ApiError ? e.message : t("تعذّر تحميل المؤشرات", "Could not load metrics")); }
    finally { setBusy(false); }
  }, [days, t]);
  useEffect(() => { load(); }, [load]);

  const tierData = useMemo(() => Object.entries(data?.mix.tier || {}).map(([k, v]) => ({ name: k, value: v })), [data]);
  const mrrEntries = Object.entries(data?.kpis.mrr || {});
  const primaryMrr = mrrEntries.find(([c]) => c === "SAR") || mrrEntries[0];

  if (!data && !err) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{err}</div>;

  const k = data.kpis;
  const hi = data.attention.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-flex h-2 w-2 rounded-full ${data.system.db === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
          {t("محدّث", "Updated")} {new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          {hi > 0 && <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700" style={{ fontWeight: 600 }}><AlertTriangle className="h-3 w-3" />{hi} {t("يحتاج تدخّل", "need action")}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-white p-0.5 text-xs">
            {([7, 30, 90] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-md px-3 py-1.5 transition ${days === d ? "bg-[#0B1B49] text-white" : "text-muted-foreground hover:text-foreground"}`} style={{ fontWeight: 600 }}>{d} {t("يوم", "d")}</button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground" title={t("تحديث", "Refresh")}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile icon={CreditCard} tone="navy" label={t("الإيراد الشهري المتكرر (MRR)", "Monthly recurring (MRR)")}
          value={primaryMrr ? fmtMoney(primaryMrr[1], primaryMrr[0]) : "0"}
          sub={mrrEntries.filter(([c]) => c !== primaryMrr?.[0]).map(([c, v]) => fmtMoney(v, c)).join(" · ") || (primaryMrr ? `ARR ${fmtMoney(data.kpis.arr[primaryMrr[0]] || 0, primaryMrr[0])}` : undefined)}
          to="/admin/subscriptions" />
        <Tile icon={Crown} tone="emerald" label={t("عملاء يدفعون", "Paying customers")} value={fmtInt(k.paying)} sub={`+${k.newPaid} ${t("في الفترة", "this window")}`} to="/admin/subscriptions?status=ACTIVE" />
        <Tile icon={Sparkles} tone="blue" label={t("تسجيلات جديدة", "New signups")} value={`${fmtInt(k.newUsers)} / ${fmtInt(k.newOrgs)}`} sub={t("مستخدم / شركة", "users / companies")} delta={<Delta now={k.newOrgs} prev={k.newOrgsPrev} />} to="/admin/orgs" />
        <Tile icon={Clock} tone="amber" label={t("تجارب جارية", "Trials running")} value={fmtInt(k.trialing)} sub={`${data.attention.filter((a) => a.kind === "trial_ending").length} ${t("تنتهي خلال 7 أيام", "end within 7 days")}`} to="/admin/subscriptions?status=TRIALING" />
        <Tile icon={TrendingDown} tone={k.churnRate > 5 ? "amber" : "cyan"} label={t("معدل الانسحاب", "Churn rate")} value={`${k.churnRate}%`} sub={`${k.churned} ${t("ألغوا في الفترة", "churned this window")}`} to="/admin/subscriptions?status=CANCELED" />
        <Tile icon={LifeBuoy} tone={data.support.open > 0 ? "amber" : "cyan"} label={t("تذاكر مفتوحة", "Open tickets")} value={fmtInt(data.support.open + data.support.pending)} sub={data.support.oldestWaiting ? `${t("الأقدم ينتظر", "oldest waiting")} ${data.support.oldestWaiting.hours}h` : t("لا انتظار", "nothing waiting")} to="/admin/support" />
      </div>

      {/* Chart + mix */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={t("التسجيلات اليومية", "Daily signups")} icon={Activity} className="xl:col-span-2"
          action={<div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: BLUE }} />{t("مستخدمون", "Users")}</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: CYAN }} />{t("شركات", "Companies")}</span></div>}>
          <div dir="ltr" className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.25} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gOrgs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CYAN} stopOpacity={0.25} /><stop offset="100%" stopColor={CYAN} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 10, fill: "#8A94A6" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8A94A6" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5EAF2", boxShadow: "0 8px 24px rgba(11,27,73,0.08)", fontSize: 12 }} />
                <Area type="monotone" dataKey="users" name={t("مستخدمون", "Users")} stroke={BLUE} strokeWidth={2} fill="url(#gUsers)" />
                <Area type="monotone" dataKey="orgs" name={t("شركات", "Companies")} stroke={CYAN} strokeWidth={2} fill="url(#gOrgs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t("توزيع الباقات المدفوعة", "Paid plan mix")} icon={CreditCard} action={<Link to="/admin/plans" className="text-xs text-primary hover:underline">{t("الباقات", "Plans")}</Link>}>
          {tierData.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{t("لا اشتراكات مدفوعة بعد", "No paid subscriptions yet")}</p> : (
            <div className="flex items-center gap-4">
              <div dir="ltr" className="relative h-[150px] w-[150px] shrink-0">
                <PieChart width={150} height={150}><Pie data={tierData} dataKey="value" nameKey="name" cx={70} cy={70} innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive={false}>{tierData.map((d) => <Cell key={d.name} fill={TIER_COLORS[d.name] || SOFT} />)}</Pie></PieChart>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-english tabular-nums text-foreground" style={{ fontWeight: 800 }}>{k.paying}</span><span className="text-[10px] text-muted-foreground">{t("يدفعون", "paying")}</span></div>
              </div>
              <ul className="flex-1 space-y-2 text-sm">
                {tierData.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 capitalize text-foreground"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: TIER_COLORS[d.name] || SOFT }} />{d.name}</span><span className="font-english tabular-nums text-muted-foreground">{d.value}</span></li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs">
            {Object.entries(data.mix.country).map(([c, n]) => (
              <div key={c} className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5"><span className="text-muted-foreground">{c === "SA" ? "🇸🇦 " : c === "US" ? "🇺🇸 " : ""}{c}</span><span className="font-english tabular-nums text-foreground" style={{ fontWeight: 600 }}>{n}</span></div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Attention + support/comms + partners/system */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t("يحتاج انتباهك", "Needs attention")} icon={AlertTriangle} action={<span className="text-xs text-muted-foreground">{data.attention.length}</span>}>
          {data.attention.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">✅ {t("لا شيء عالق اليوم", "Nothing pending today")}</p> : (
            <ul className="divide-y divide-border/60">
              {data.attention.slice(0, 12).map((a, i) => {
                const kind = KIND[a.kind] || { ar: a.kind, en: a.kind, tone: "bg-muted text-muted-foreground" };
                return (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.severity === "high" ? "bg-red-500" : a.severity === "medium" ? "bg-amber-500" : "bg-slate-300"}`} />
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${kind.tone}`} style={{ fontWeight: 600 }}>{language === "ar" ? kind.ar : kind.en}</span>
                    <Link to={`/admin/orgs/${a.orgId}`} className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline" style={{ fontWeight: 600 }}>{a.orgName}<span className="ms-2 text-xs font-normal text-muted-foreground font-english">{a.detail}</span></Link>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{rel(a.at, language)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4">
          <Panel title={t("الدعم وخدمة العملاء", "Support & customer service")} icon={LifeBuoy} action={<Link to="/admin/support" className="text-xs text-primary hover:underline">{t("كل التذاكر", "All tickets")}</Link>}>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[[t("مفتوحة", "Open"), data.support.open, "text-amber-700 bg-amber-50"], [t("بانتظار العميل", "Pending"), data.support.pending, "text-blue-700 bg-blue-50"], [t("حُلّت في الفترة", "Resolved"), data.support.resolvedInWindow, "text-emerald-700 bg-emerald-50"]].map(([l, v, cls]) => (
                <div key={String(l)} className={`rounded-xl px-2 py-3 ${cls}`}><div className="text-xl font-english tabular-nums" style={{ fontWeight: 800 }}>{v as number}</div><div className="text-[11px]" style={{ fontWeight: 600 }}>{l as string}</div></div>
              ))}
            </div>
            {data.support.oldestWaiting ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
                <Clock className="h-4 w-4 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1"><div className="truncate text-foreground" style={{ fontWeight: 600 }}>{data.support.oldestWaiting.subject}</div><div className="text-muted-foreground">{data.support.oldestWaiting.orgName || "—"} · {data.support.oldestWaiting.priority} · {t("ينتظر", "waiting")} {data.support.oldestWaiting.hours}h</div></div>
                <Link to="/admin/support" className="shrink-0 text-primary hover:underline" style={{ fontWeight: 600 }}>{t("افتح", "Open")}</Link>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Link to="/admin/support" className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/40"><Bot className="h-3.5 w-3.5 text-primary" /><span>{data.support.aiConversations24h} {t("محادثة ذكاء · 24س", "AI chats · 24h")}</span></Link>
              <Link to="/admin/system" className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/40"><Mail className="h-3.5 w-3.5 text-primary" /><span>{t("صحة البريد", "Email health")}</span></Link>
              <span className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-muted-foreground" title={t("قريبًا · مواصفة v3 §6", "Soon · spec v3 §6")}><Megaphone className="h-3.5 w-3.5" /><span>{t("تعميم للعملاء", "Broadcast")}</span></span>
            </div>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel title={t("الشركاء والإحالات", "Partners & referrals")} icon={Handshake}>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t("شركاء نشطون", "Active partners")}</dt><dd className="font-english tabular-nums" style={{ fontWeight: 700 }}>{data.partners.active}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t("عمولات معلّقة", "Pending commissions")}</dt><dd className="font-english tabular-nums" style={{ fontWeight: 700 }}>{data.partners.commissionsPendingCount} · {fmtMoney(data.partners.commissionsPendingAmount, "SAR")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t("طلبات صرف", "Payout requests")}</dt><dd className="font-english tabular-nums" style={{ fontWeight: 700 }}>{data.partners.payoutsPendingCount} · {fmtMoney(data.partners.payoutsPendingAmount, "SAR")}</dd></div>
              </dl>
              <p className="mt-3 text-[11px] text-muted-foreground">{t("بوابة الشريك وإدارة الصرف: مواصفة v3 §7", "Partner portal + payouts: spec v3 §7")}</p>
            </Panel>
            <Panel title={t("صحة النظام", "System health")} icon={Server}>
              <ul className="space-y-2 text-sm">
                {[
                  [t("قاعدة البيانات", "Database"), data.system.db === "ok", data.system.db === "ok" ? "PG16 · OK" : "ERROR"],
                  [t("Stripe", "Stripe"), data.system.stripeConfigured, data.system.stripeConfigured ? t("مهيأ", "configured") : t("غير مهيأ", "missing")],
                  [t("ZATCA · ربط الأجهزة", "ZATCA · device linking"), data.system.zatcaOutbound, data.system.zatcaOutbound ? t("متاح", "enabled") : t("معطّل", "disabled")],
                  [t("ZATCA · إرسال الفواتير", "ZATCA · invoice submission"), false, t("مجمّد (Gate 0)", "frozen (Gate 0)")],
                  [t("API", "API"), true, `${data.system.version ? data.system.version + " · " : ""}${data.system.uptimeHours}h ${t("تشغيل", "up")}`],
                ].map(([l, ok, v]) => (
                  <li key={String(l)} className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-muted-foreground"><i className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />{l as string}</span><span className="font-english text-xs text-foreground" dir="ltr">{v as string}</span></li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>

      {/* Latest orgs + recent admin actions */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={t("أحدث الشركات", "Latest companies")} icon={Building2} className="xl:col-span-2" action={<Link to="/admin/orgs" className="text-xs text-primary hover:underline">{t("كل الشركات", "All companies")}</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] text-muted-foreground"><th className="pb-2 text-start font-medium">{t("الشركة", "Company")}</th><th className="pb-2 text-start font-medium">{t("المالك", "Owner")}</th><th className="pb-2 text-start font-medium">{t("الباقة", "Plan")}</th><th className="pb-2 text-start font-medium">{t("الحالة", "Status")}</th><th className="pb-2 text-end font-medium">{t("أُنشئت", "Created")}</th></tr></thead>
              <tbody>
                {data.latestOrgs.map((o) => (
                  <tr key={o.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="py-2.5"><Link to={`/admin/orgs/${o.id}`} className="text-foreground hover:underline" style={{ fontWeight: 600 }}>{o.name}</Link> <span className="text-[11px] text-muted-foreground">{o.country}</span></td>
                    <td className="py-2.5 font-english text-xs text-muted-foreground">{o.ownerEmail || "—"}</td>
                    <td className="py-2.5 text-xs text-foreground/80">{o.plan || "—"}</td>
                    <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] ${o.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : o.status === "TRIALING" ? "bg-blue-50 text-blue-700" : o.status === "PAST_DUE" ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`} style={{ fontWeight: 600 }}>{o.status}</span></td>
                    <td className="py-2.5 text-end text-xs text-muted-foreground font-english">{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={t("آخر إجراءات الأدمن", "Recent admin actions")} icon={ShieldCheck} action={<Link to="/admin/audit" className="text-xs text-primary hover:underline">{t("سجل الأثر", "Audit trail")}</Link>}>
          {data.recentAudit.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("لا إجراءات بعد", "No actions yet")}</p> : (
            <ul className="space-y-2.5 text-xs">
              {data.recentAudit.map((a) => (
                <li key={a.id} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" /><div className="min-w-0 flex-1"><div className="truncate text-foreground" style={{ fontWeight: 600 }}>{a.action} <span className="font-normal text-muted-foreground">· {a.targetLabel || a.targetType}</span></div><div className="text-[11px] text-muted-foreground font-english">{a.adminEmail} · {new Date(a.createdAt).toLocaleString("en-GB")}</div></div></li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs">
            <Link to="/admin/users" className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/40"><Users className="h-3.5 w-3.5 text-primary" />{t("إنشاء مستخدم", "Create user")}</Link>
            <Link to="/admin/subscriptions" className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/40"><Crown className="h-3.5 w-3.5 text-primary" />{t("منح Lifetime", "Grant lifetime")}</Link>
            <Link to="/admin/audit?format=csv" className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/40"><Download className="h-3.5 w-3.5 text-primary" />{t("تصدير CSV", "Export CSV")}</Link>
            <Link to="/admin/system" className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:bg-muted/40"><Server className="h-3.5 w-3.5 text-primary" />{t("النظام", "System")}</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
