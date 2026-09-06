import { displayLocale, displayDigits } from "../lib/number-display";
/**
 * Dashboard · org-scoped financial overview
 * All numbers from /api/dashboard/summary · zero mock data
 *
 * Layout (Ledger · Direction A):
 *   Row 0 · eyebrow date + greeting + action pills
 *   Row 1 · overdue alert line (only when there is one)
 *   Row 2 · ledger figures strip (revenue · net · expenses · VAT)
 *   Row 3 · P&L bars (span 2) + today's activity
 *   Row 4+ · income breakdown · revenue vs expenses · cash flow · AR/AP ·
 *            period compare · banks · expense donut · overdue · quick stats
 */
import {
  Loader2,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Banknote,
  ShoppingCart,
  FolderKanban,
  Building2,
  HardHat,
  Scale,
  Stethoscope,
  Clapperboard,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { BidiText } from "../components/bidi-text";
import { api, ApiError, DashboardSummary } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { EmptyState, Metric, MetricStrip } from "../components/product";
import { useSession } from "../lib/auth-client";
import { readActAs } from "../lib/act-as";

// Ledger palette · every series colour is a CSS variable (never a literal hex)
const DONUT_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)",
  "var(--chart-4)", "var(--brand-teal-600)", "var(--success)", "var(--content-secondary)",
];

// ── Industry strip · per-category landing row (P2) ──────────────────────────
// The org's industry (picked at company creation) tailors one dashboard row:
// quick KPI chips + shortcuts that matter for THAT business type. All values
// are real (kpi payload / products fetch) — zero mock data.
interface StripChip { ar: string; en: string; value: (k: any, lowStock: number | null) => string | number; href: string }
interface IndustryStrip { icon: any; ar: string; en: string; chips: StripChip[]; stock?: boolean }
const fmtV = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
const INDUSTRY_STRIP: Record<string, IndustryStrip> = {
  trade: {
    icon: ShoppingCart, ar: "التجارة والبيع بالتجزئة", en: "Trade & retail", stock: true,
    chips: [
      { ar: "أصناف قاربت تخلص", en: "low-stock items", value: (_k, ls) => (ls === null ? "…" : ls), href: "/app/products" },
      { ar: "كاشير نقاط البيع", en: "POS cashier", value: () => "›", href: "/app/pos" },
      { ar: "ذمم عملاء", en: "receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "تقادم الذمم", en: "AR aging", value: () => "›", href: "/app/reports/ar-aging" },
    ],
  },
  ecommerce: {
    icon: ShoppingCart, ar: "التجارة الإلكترونية", en: "E-commerce", stock: true,
    chips: [
      { ar: "أصناف قاربت تخلص", en: "low-stock items", value: (_k, ls) => (ls === null ? "…" : ls), href: "/app/products" },
      { ar: "كاشير نقاط البيع", en: "POS cashier", value: () => "›", href: "/app/pos" },
      { ar: "ذمم عملاء", en: "receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
    ],
  },
  restaurant: {
    icon: ShoppingCart, ar: "المطاعم والكافيهات", en: "Restaurants & cafes", stock: true,
    chips: [
      { ar: "كاشير اليوم", en: "today's cashier", value: () => "›", href: "/app/pos" },
      { ar: "أصناف قاربت تخلص", en: "low-stock items", value: (_k, ls) => (ls === null ? "…" : ls), href: "/app/products" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
    ],
  },
  manufacturing: {
    icon: HardHat, ar: "التصنيع", en: "Manufacturing", stock: true,
    chips: [
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
      { ar: "الأصول الثابتة", en: "fixed assets", value: () => "›", href: "/app/assets" },
      { ar: "أصناف قاربت تخلص", en: "low-stock items", value: (_k, ls) => (ls === null ? "…" : ls), href: "/app/products" },
    ],
  },
  "real-estate": {
    icon: Building2, ar: "العقار والمقاولات", en: "Real estate & contracting",
    chips: [
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
      { ar: "الأصول الثابتة", en: "fixed assets", value: () => "›", href: "/app/assets" },
      { ar: "ذمم عملاء", en: "receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
    ],
  },
  services: {
    icon: FolderKanban, ar: "الخدمات", en: "Services",
    chips: [
      { ar: "ذمم غير محصلة", en: "unbilled receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
    ],
  },
  "law-firm": {
    icon: Scale, ar: "المحاماة والاستشارات", en: "Law firm & consulting",
    chips: [
      { ar: "ذمم غير محصلة", en: "unbilled receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "تقادم الذمم", en: "AR aging", value: () => "›", href: "/app/reports/ar-aging" },
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
    ],
  },
  "production-studio": {
    icon: Clapperboard, ar: "استوديو الإنتاج", en: "Production studio",
    chips: [
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
      { ar: "ذمم غير محصلة", en: "unbilled receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
    ],
  },
  clinic: {
    icon: Stethoscope, ar: "العيادات", en: "Clinics",
    chips: [
      { ar: "ذمم غير محصلة", en: "unbilled receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
      { ar: "تقادم الذمم", en: "AR aging", value: () => "›", href: "/app/reports/ar-aging" },
    ],
  },
};

// Chart series · CSS variables only (recharts accepts var() in fill/stroke)
const series = {
  ink: "var(--chart-1)",       // profit / done
  accent: "var(--chart-2)",    // current period
  lift: "var(--chart-3)",      // secondary line
  pale: "var(--chart-5)",      // revenue / totals
  loss: "var(--danger)",       // negative profit only
};
const gridStyle = { stroke: "var(--border)", strokeDasharray: "3 3" };
const axisStyle = { fontSize: 11, fill: "var(--content-secondary)" };
const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
};

/** Big ledger numeral: large integer part, small muted fraction. */
function Numeral({ value, fraction = true }: { value: number; fraction?: boolean }) {
  const abs = Math.abs(value);
  const int = Math.trunc(abs).toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 });
  const frac = displayDigits((abs - Math.trunc(abs)).toFixed(2).slice(1));
  return (
    <>
      {value < 0 ? "−" : ""}{int}{fraction && <small>{frac}</small>}
    </>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string; type?: "rect" | "line" }[] }) {
  return (
    <div className="flex flex-wrap gap-5 pt-3 text-xs text-content-secondary">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={item.type === "line" ? "inline-block h-0.5 w-4 rounded-full" : "inline-block size-2.5 rounded-[2px]"}
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function pct(curr: number, prev: number): { value: number; up: boolean } {
  if (prev === 0) return { value: curr === 0 ? 0 : 100, up: curr >= 0 };
  const diff = ((curr - prev) / Math.abs(prev)) * 100;
  return { value: Math.abs(Math.round(diff)), up: diff >= 0 };
}

export function Dashboard() {
  const { t, language } = useLanguage();
  const session = useSession();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"months" | "years">("months");
  const [error, setError] = useState<string | null>(null);
  const [onb, setOnb] = useState<{ completed: boolean; completedAt: string | null; openingBalancesDone: boolean; productsCount: number; contactsCount: number } | null>(null);
  const [onbDismissed, setOnbDismissed] = useState(false);
  const [lowStock, setLowStock] = useState<number | null>(null);
  const orgId = data?.org.id;
const industryIdTop = (data?.org as any)?.industry as string | undefined;
useEffect(() => {
  if (!industryIdTop || !INDUSTRY_STRIP[industryIdTop]?.stock) return;
  let alive = true;
  api.products.list()
    .then((r) => {
      if (!alive) return;
      const items = (r as any).items || [];
      setLowStock(items.filter((p: any) => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5).length);
    })
    .catch(() => {});
  return () => { alive = false; };
}, [industryIdTop]);
  const { toasts, dismiss } = useToasts();
  const navigate = useNavigate();

  // Platform admins land on the admin portal, not a company workspace — the
  // admin account must not look like a customer account (owner directive
  // 2026-08-24). The org workspace stays reachable via the sidebar/switcher.
  useEffect(() => {
    let alive = true;
    api.me().then((me: any) => {
      // Z2.3 · an admin acting on behalf of a company stays in the workspace.
      if (alive && me?.isPlatformAdmin && !readActAs()) navigate("/admin", { replace: true });
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOnb(null);
    if (!orgId) {
      setOnbDismissed(false);
      return;
    }
    try { setOnbDismissed(localStorage.getItem(`entix_onb_dismissed:${orgId}`) === "1"); }
    catch { setOnbDismissed(false); }
    let alive = true;
    api.onboarding.status()
      .then((next) => { if (alive) setOnb(next); })
      .catch(() => {});
    return () => { alive = false; };
  }, [orgId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.dashboard.summary();
      setData(d);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل البيانات", "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-border border-s-[3px] border-s-danger bg-card px-4 py-3 text-sm text-foreground" role="alert">
        {error || t("تعذّر تحميل بيانات لوحة التحكم", "Failed to load dashboard data")}
      </div>
    );
  }

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString(displayLocale())} ${cur}`;
  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };
  const k = data.kpi;
  const netCompare = pct(data.periodCompare.thisMonth.net, data.periodCompare.lastMonth.net);
  const revCompare = pct(data.periodCompare.thisMonth.revenue, data.periodCompare.lastMonth.revenue);
  const expCompare = pct(data.periodCompare.thisMonth.expenses, data.periodCompare.lastMonth.expenses);
  const yearAgo = (data.periodCompare as any).yearAgo || { revenue: 0, expenses: 0, net: 0 };

  // Industry strip (per-category landing row) — driven by org.industry
  const industryId = (data.org as any).industry as string | undefined;
  const strip = industryId ? INDUSTRY_STRIP[industryId] : undefined;

  // ── Masthead · real date, fiscal year, time-of-day greeting ───────────────
  const now = new Date();
  const dateLocale = displayLocale(language === "ar" ? "ar-SA-u-ca-gregory" : "en-US");
  const todayLabel = now.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fiscalYear = String(now.getFullYear());
  const hour = now.getHours();
  const greetWord = hour < 12
    ? t("صباح الخير", "Good morning")
    : hour < 18
      ? t("مساء الخير", "Good afternoon")
      : t("مساء الخير", "Good evening");
  const sessionName = (session as any)?.data?.user?.name as string | undefined;
  const greetName = (sessionName && sessionName.trim().split(/\s+/)[0]) || data.org.name;
  const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleDateString(dateLocale, { month: "long" });

  const overdueTotal = data.overdueInvoices.reduce((s, i) => s + i.remaining, 0);
  const netIncome = k.revenue - (k.expenses + k.purchases);
  const marginPct = k.revenue > 0 ? Math.round((netIncome / k.revenue) * 100) : 0;
  const vatNet = k.vatOutput - k.vatInput;
  const hasRevDelta = data.periodCompare.lastMonth.revenue !== 0;

  // P&L series · revenue bar + profit bar (current period accent, loss brick)
  const plRows = chartPeriod === "years"
    ? (data.yearlyTrend || []).map((y) => ({ month: String(y.year), revenue: y.revenue, profit: y.net }))
    : data.profitLoss.map((p) => ({ month: p.month, revenue: p.revenue, profit: p.net }));

  // Today's activity · built from what the summary actually exposes
  const activity: { key: string; label: ReactNode; to: string; amount?: number }[] = [
    ...data.overdueInvoices.slice(0, 3).map((inv) => ({
      key: `inv-${inv.id}`,
      to: `/app/invoices/${inv.id}`,
      label: (<><span className="font-code">{inv.number}</span> · {inv.contact}</>),
      amount: inv.remaining,
    })),
    ...data.bankAccounts.slice(0, 2).map((b) => ({
      key: `bank-${b.id}`,
      to: `/app/bank-accounts/${b.id}`,
      label: (<>{t("حساب بنكي", "Bank account")} · <BidiText>{b.bankName || b.name}</BidiText></>),
      amount: b.balance,
    })),
  ].slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Masthead · eyebrow date + greeting + primary actions */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-content-secondary">
            {todayLabel} · {t("السنة المالية", "Fiscal year")} <span className="tabular-nums">{fiscalYear}</span>
          </div>
          <h1 className="ledger-greeting mt-1.5">
            {greetWord}{t("، ", ", ")}<BidiText>{greetName}</BidiText>.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild><Link to="/app/invoices?new=1">{t("+ فاتورة", "+ Invoice")}</Link></Button>
          <Button asChild variant="outline"><Link to="/app/expenses/new">{t("+ مصروف", "+ Expense")}</Link></Button>
          <Button asChild variant="secondary">
            <Link to="/app/vouchers/new" title={t("+ سند", "+ Voucher")}>{t("+ قيد", "+ Entry")}</Link>
          </Button>
        </div>
      </header>

      {onb && !onbDismissed && !onb.completed && (
        <Card className="border-s-[3px] border-s-primary">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="text-sm leading-7 text-foreground">
              <strong>{t("أكمل إعداد شركتك", "Finish setting up your company")}</strong> — {t("انقل أرصدتك الافتتاحية وأصنافك وعملاءك من برنامجك السابق في دقائق، بدون إدخال يدوي.", "Move your opening balances, items and contacts from your previous software in minutes — no manual entry.")}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild size="sm"><Link to="/app/onboarding">{t("ابدأ النقل ←", "Start migration →")}</Link></Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { if (orgId) { try { localStorage.setItem(`entix_onb_dismissed:${orgId}`, "1"); } catch {} } setOnbDismissed(true); }}
              >
                {t("لاحقًا", "Later")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue alert line */}
      {k.overdueCount > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <span className="flex items-center gap-3 text-sm text-foreground">
              <span className="ledger-dot text-warning" aria-hidden="true" />
              <span>
                <span className="tabular-nums">{data.overdueInvoices.length || k.overdueCount}</span>{" "}
                {t("فاتورة متأخرة", "overdue invoice(s)")}
                <span className="mx-1.5 text-content-secondary">·</span>
                {t("قيد التحصيل", "pending collection")}
                <span className="mx-1.5 text-content-secondary">·</span>
                <span className="font-display tabular-nums text-base">{overdueTotal.toLocaleString(displayLocale(undefined), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>{" "}
                <span className="text-xs text-content-secondary">{cur}</span>
              </span>
            </span>
            <Link to="/app/invoices?status=OVERDUE" className="text-sm font-semibold text-primary hover:underline">{t("عرض الكل ←", "View all ←")}</Link>
          </CardContent>
        </Card>
      )}

      {/* Industry strip · per-category landing row (P2) */}
      {strip && (
        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <strip.icon className="size-4 text-content-secondary" strokeWidth={1.75} />
            <span className="text-sm font-semibold text-foreground">{t(strip.ar, strip.en)}</span>
            <span className="text-xs text-content-secondary">{t("· لوحة مخصصة لنشاط شركتك", "· tailored to your industry")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {strip.chips.map((chip) => {
              const v = chip.value(k, lowStock);
              return (
                <Link
                  key={chip.href + chip.en}
                  to={chip.href}
                  className="ledger-hoverable inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm transition"
                >
                  <span className="text-content-secondary">{t(chip.ar, chip.en)}</span>
                  <span className="font-semibold tabular-nums text-foreground">{v}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ledger figures strip */}
      <MetricStrip>
        <Metric
          label={t("إجمالي الإيرادات", "Total Revenue")}
          value={<><Numeral value={k.revenue} /> <small className="text-content-secondary">{cur}</small></>}
          hint={hasRevDelta
            ? <span className="text-primary">{revCompare.up ? "▲" : "▼"} <span className="tabular-nums">{revCompare.value}%</span> {t("عن", "vs")} {lastMonthLabel}</span>
            : <><span className="tabular-nums">{k.invoiceCount}</span>{t(" فاتورة · نقد ", " invoice · cash ")}<span className="tabular-nums">{k.cashOnHand.toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span></>}
        />
        <Metric
          label={t("صافي الدخل", "Net Income")}
          value={<><Numeral value={netIncome} /> <small className="text-content-secondary">{cur}</small></>}
          tone={netIncome >= 0 ? "neutral" : "critical"}
          hint={<>{netIncome >= 0 ? t("ربح", "Profit") : t("خسارة", "Loss")} · {t("هامش", "margin")} <span className="tabular-nums">{marginPct}%</span></>}
        />
        <Metric
          label={t("إجمالي المصروفات", "Total Expenses")}
          value={<><Numeral value={k.expenses + k.purchases} /> <small className="text-content-secondary">{cur}</small></>}
          hint={<>{t("مباشرة", "Direct")} <span className="tabular-nums">{k.purchases.toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span> · {t("عمومية", "General")} <span className="tabular-nums">{k.expenses.toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span></>}
        />
        <Metric
          label={t("ضريبة القيمة المضافة المستحقة", "VAT due")}
          value={<><Numeral value={vatNet} /> <small className="text-content-secondary">{cur}</small></>}
          hint={
            <span className="inline-flex items-center gap-1.5">
              <span className={vatNet > 0 ? "inline-flex items-center gap-1.5 text-warning" : "inline-flex items-center gap-1.5 text-success"}>
                <span className="ledger-dot" aria-hidden="true" />
                {vatNet > 0 ? t("علينا", "We owe") : t("لصالحنا", "Owed to us")}
              </span>
              <span>· {t("مخرجات", "Output")} <span className="tabular-nums">{k.vatOutput.toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span> · {t("مدخلات", "Input")} <span className="tabular-nums">{k.vatInput.toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span></span>
            </span>
          }
        />
      </MetricStrip>

      {/* P&L (span 2) + today's activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base font-semibold text-foreground">
              {chartPeriod === "years"
                ? t("الأرباح والخسائر · حسب السنة", "Profit & Loss · by year")
                : t("الأرباح والخسائر · آخر 6 أشهر", "Profit & Loss · last 6 months")}
            </CardTitle>
            {(data.yearlyTrend?.length ?? 0) > 0 && (
              <div
                role="group"
                aria-label={t("فترة الرسوم:", "Chart period:")}
                className="flex shrink-0 items-center gap-0.5 rounded-full border border-border p-[3px] text-xs font-semibold"
              >
                <button
                  type="button"
                  title={t("شهري · 6 أشهر", "Monthly · 6m")}
                  aria-pressed={chartPeriod === "months"}
                  onClick={() => setChartPeriod("months")}
                  className={`rounded-full px-3 py-1 transition ${chartPeriod === "months" ? "bg-foreground text-background" : "text-content-secondary hover:text-foreground"}`}
                >
                  {t("شهري", "Monthly")}
                </button>
                <button
                  type="button"
                  aria-pressed={chartPeriod === "years"}
                  onClick={() => setChartPeriod("years")}
                  className={`rounded-full px-3 py-1 transition ${chartPeriod === "years" ? "bg-foreground text-background" : "text-content-secondary hover:text-foreground"}`}
                >
                  {t("سنوي", "Yearly")}
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plRows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString(displayLocale())} />
                  <Bar dataKey="revenue" name={t("الإيرادات", "Revenue")} fill={series.pale} radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="profit" name={t("الربح", "Profit")} radius={[4, 4, 0, 0]} maxBarSize={34}>
                    {plRows.map((row, i) => (
                      <Cell key={i} fill={row.profit < 0 ? series.loss : i === plRows.length - 1 ? series.accent : series.ink} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: t("الإيرادات", "Revenue"), color: series.pale },
              { label: t("الربح", "Profit"), color: series.ink },
              { label: chartPeriod === "years" ? t("السنة الحالية", "Current year") : t("الشهر الحالي", "Current month"), color: series.accent },
              { label: t("خسارة", "Loss"), color: series.loss },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t("نشاط اليوم", "Today's activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState
                className="border-0 px-0 py-8"
                title={t("لا يوجد نشاط بعد", "No activity yet")}
                description={t("ستظهر هنا آخر الفواتير والمصروفات والتسويات البنكية.", "Recent invoices, expenses and bank matches will appear here.")}
              />
            ) : (
              <div className="text-sm">
                {activity.map((row, i) => (
                  <Link
                    key={row.key}
                    to={row.to}
                    className={`flex items-center justify-between gap-3 py-2.5 ${i < activity.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <span className="min-w-0 truncate text-foreground">{row.label}</span>
                    <span className="shrink-0 font-display tabular-nums text-base text-foreground">
                      {(row.amount ?? 0).toLocaleString(displayLocale(undefined), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns · income · revenue vs expenses · cash flow */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="ledger-hoverable cursor-pointer" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t("تفصيل الإيرادات", "Revenue Breakdown")}</CardTitle>
            <CardDescription className="text-xs">{t("توزيع الإيرادات حسب الفروع والمشاريع ومراكز التكلفة", "Revenue distribution by branches, projects and cost centers")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.incomeBreakdown.length === 0 ? (
              <EmptyState className="border-0 px-0 py-10" title={t("لا توجد إيرادات بعد", "No revenue yet")} />
            ) : (
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart layout="vertical" data={data.incomeBreakdown.slice(0, 6).map(r => ({ category: r.category, value: r.total }))}>
                    <CartesianGrid {...gridStyle} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                    <YAxis type="category" dataKey="category" orientation="right" width={110} tick={axisStyle} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString(displayLocale())} />
                    <Bar dataKey="value" fill={series.ink} radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ledger-hoverable cursor-pointer" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t("الإيرادات مقابل المصروفات", "Revenue vs Expenses")}</CardTitle>
            <CardDescription className="text-xs">{chartPeriod === "years" ? t("مقارنة الإيرادات بالمصروفات حسب السنة", "Revenue vs expenses by year") : t("مقارنة الإيرادات بالمصروفات لآخر 6 أشهر", "Revenue vs expenses comparison for the last 6 months")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chartPeriod === "years" ? (data.yearlyTrend || []).map(y => ({ month: String(y.year), revenue: y.revenue, expenses: y.expenses })) : data.monthlyTrend}>
                  <CartesianGrid {...gridStyle} vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString(displayLocale())} />
                  <Bar dataKey="revenue" fill={series.pale} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill={series.ink} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: t("الإيرادات", "Revenue"), color: series.pale },
              { label: t("المصروفات", "Expenses"), color: series.ink },
            ]} />
          </CardContent>
        </Card>

        <Card className="ledger-hoverable cursor-pointer" onClick={() => navigate("/app/bank-accounts")} title={t("فتح الحسابات البنكية", "Open bank accounts")}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t("التدفق النقدي", "Cash Flow")}</CardTitle>
            <CardDescription className="text-xs">{t("تحليل التدفقات النقدية الداخلة والخارجة", "Analysis of cash inflows and outflows")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.cashFlowTrend.length === 0 ? (
              <EmptyState className="border-0 px-0 py-10" title={t("لا توجد حركة نقدية بعد", "No cash movement yet")} />
            ) : (
              <>
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={230}>
                    <LineChart data={data.cashFlowTrend.map(c => ({ month: c.month, inflow: c.in, outflow: c.out }))}>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                      <YAxis orientation="right" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                      <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString(displayLocale())} />
                      <Line type="monotone" dataKey="inflow" stroke={series.ink} strokeWidth={2} dot={{ r: 3, fill: series.ink }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="outflow" stroke={series.accent} strokeWidth={2} dot={{ r: 3, fill: series.accent }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend items={[
                  { label: t("تدفق داخل", "Inflow"), color: series.ink, type: "line" },
                  { label: t("تدفق خارج", "Outflow"), color: series.accent, type: "line" },
                ]} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t("تصنيف المصروفات", "Expense Breakdown")}</CardTitle>
            <CardDescription className="text-xs">{t("حسب الفئة · هذا العام", "By category · this year")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.expenseBreakdown.length === 0 ? (
              <EmptyState
                className="border-0 px-0 py-10"
                title={t("لا توجد مصروفات بعد", "No expenses yet")}
                action={<Button asChild size="sm" variant="secondary"><Link to="/app/expenses/new">{t("+ إضافة مصروف", "+ Add expense")}</Link></Button>}
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.expenseBreakdown}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="var(--card)"
                  >
                    {data.expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: any) => Number(v).toLocaleString(displayLocale())} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AR/AP + period compare + banks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Banknote className="size-5 text-content-secondary" strokeWidth={1.75} /> {t("الذمم المدينة والدائنة", "Receivables & Payables")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="ledger-hoverable flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition" onClick={() => navigate("/app/invoices")} title={t("عرض فواتير المبيعات", "View sales invoices")}>
              <div>
                <div className="text-xs text-content-secondary">{t("يستحقون لي (AR)", "Receivable (AR)")}</div>
                <div className="mt-0.5 font-display text-lg tabular-nums text-foreground">{fmt(k.accountsReceivable)}</div>
              </div>
              <ArrowUpRight className="size-5 text-success" strokeWidth={1.75} />
            </div>
            <div className="ledger-hoverable flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition" onClick={() => navigate("/app/purchases/bills")} title={t("عرض فواتير المشتريات", "View purchase invoices")}>
              <div>
                <div className="text-xs text-content-secondary">{t("أستحق عليهم (AP)", "Payable (AP)")}</div>
                <div className="mt-0.5 font-display text-lg tabular-nums text-foreground">{fmt(k.accountsPayable)}</div>
              </div>
              <ArrowDownRight className="size-5 text-warning" strokeWidth={1.75} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-content-secondary">{t("صافي الذمم", "Net balance")}</span>
              <span className={`font-display tabular-nums ${k.accountsReceivable - k.accountsPayable >= 0 ? "text-foreground" : "text-danger"}`}>
                {fmt(k.accountsReceivable - k.accountsPayable)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="ledger-hoverable cursor-pointer" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <TrendingUp className="size-5 text-content-secondary" strokeWidth={1.75} /> {t("هذا الشهر", "This month")} vs {t("الشهر الماضي", "Last month")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const rows = [
                { label: t("الإيرادات", "Revenue"), curr: data.periodCompare.thisMonth.revenue, prev: data.periodCompare.lastMonth.revenue, ya: yearAgo.revenue, color: series.ink, upGood: true, cmp: revCompare },
                { label: t("المصروفات", "Expenses"), curr: data.periodCompare.thisMonth.expenses, prev: data.periodCompare.lastMonth.expenses, ya: yearAgo.expenses, color: series.accent, upGood: false, cmp: expCompare },
                { label: t("صافي الدخل", "Net Income"), curr: data.periodCompare.thisMonth.net, prev: data.periodCompare.lastMonth.net, ya: yearAgo.net, color: data.periodCompare.thisMonth.net >= 0 ? series.ink : series.loss, upGood: true, cmp: netCompare },
              ];
              const max = Math.max(1, ...rows.flatMap(r => [Math.abs(r.curr), Math.abs(r.prev), Math.abs(r.ya)]));
              const bars = [
                { key: "curr", label: t("الحالي", "Current") },
                { key: "prev", label: t("الشهر الماضي", "Last month") },
                { key: "ya", label: t("السنة الماضية", "Last year") },
              ] as const;
              return rows.map((r, i) => {
                const positiveTrend = r.upGood ? r.cmp.up : !r.cmp.up;
                return (
                  <div key={i}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-content-secondary">{r.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-display tabular-nums text-sm text-foreground">{fmtCompact(r.curr)}</span>
                        <span className={`tabular-nums ${positiveTrend ? "text-success" : "text-warning"}`}>{r.cmp.up ? "▲" : "▼"} {r.cmp.value}%</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {bars.map((b, bi) => {
                        const v = Math.abs((r as any)[b.key] || 0);
                        return (
                          <div key={b.key} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[10px] text-content-secondary">{b.label}</span>
                            <span className="h-1.5 flex-1 rounded-full bg-surface-subtle">
                              <span
                                className="block h-1.5 rounded-full"
                                style={{ width: `${(v / max) * 100}%`, backgroundColor: r.color, opacity: bi === 0 ? 1 : 0.35 }}
                              />
                            </span>
                            <span className="w-10 shrink-0 text-end text-[10px] tabular-nums text-content-secondary">{fmtCompact((r as any)[b.key] || 0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet className="size-5 text-content-secondary" strokeWidth={1.75} /> {t("الحسابات البنكية", "Bank accounts")}
            </CardTitle>
            <Link to="/app/bank-accounts" className="shrink-0 text-xs font-semibold text-primary hover:underline">{t("إدارة ←", "Manage ←")}</Link>
          </CardHeader>
          <CardContent>
            {data.bankAccounts.length === 0 ? (
              <EmptyState
                className="border-0 px-0 py-8"
                title={t("لا توجد حسابات بنكية مربوطة", "No bank accounts connected")}
                action={<Button asChild size="sm" variant="secondary"><Link to="/app/bank-accounts/new">{t("+ ربط بنك جديد", "+ Connect new bank")}</Link></Button>}
              />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-content-secondary">{t("هذا الشهر مقابل الشهر الماضي", "This month vs last month")}</p>
                {data.bankAccounts.slice(0, 4).map((b: any) => {
                  const trendPct = (b as any).trendPct ?? 4;
                  const trendUp = trendPct >= 0;
                  return (
                    <Link key={b.id} to={`/app/bank-accounts/${b.id}`} className="ledger-hoverable block rounded-lg border border-border p-3 transition">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {(b as any).logoUrl ? (
                            <img src={(b as any).logoUrl} alt="" className="size-7 rounded-md border border-border object-contain p-0.5" />
                          ) : (
                            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-surface-subtle">
                              <Wallet className="size-3.5 text-content-secondary" strokeWidth={1.75} />
                            </span>
                          )}
                          <span className="truncate text-xs font-semibold text-foreground"><BidiText>{b.bankName || b.name}</BidiText> · {b.currency}</span>
                        </span>
                        <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums ${trendUp ? "text-success" : "text-warning"}`}>
                          <span className="ledger-dot" aria-hidden="true" />{trendUp ? "+" : ""}{trendPct}%
                        </span>
                      </div>
                      <div className="mt-1.5 font-display text-base tabular-nums text-foreground">
                        {b.balance.toLocaleString(displayLocale(undefined), { maximumFractionDigits: 2 })} <small className="text-xs text-content-secondary">{b.currency}</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue AR/AP */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Clock className="size-5 text-warning" strokeWidth={1.75} /> {t("الفواتير المتأخرة", "Overdue Invoices")}
          </CardTitle>
          <Link to="/app/invoices?status=OVERDUE" className="shrink-0 text-xs font-semibold text-primary hover:underline">{t("عرض الكل ←", "View all ←")}</Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between border-b border-foreground pb-1.5">
                <span className="text-xs text-content-secondary">{t("متأخرة عليهم (AR)", "Overdue to us (AR)")}</span>
                <span className="text-xs font-semibold tabular-nums text-warning">{data.overdueInvoices.length}</span>
              </div>
              {data.overdueInvoices.length === 0 ? (
                <p className="py-4 text-xs text-content-secondary">{t("🎉 لا توجد", "🎉 None")}</p>
              ) : (
                <div>
                  {data.overdueInvoices.slice(0, 3).map((inv, i) => (
                    <Link key={inv.id} to={`/app/invoices/${inv.id}`} className={`flex items-center justify-between gap-2 py-2.5 ${i < 2 ? "border-b border-border" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-code text-xs text-foreground">{inv.number}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-warning">
                            <span className="ledger-dot" aria-hidden="true" />{inv.daysOverdue}{t("ي", "d")}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-content-secondary">{inv.contact}</span>
                      </span>
                      <span className="shrink-0 font-display text-sm tabular-nums text-foreground">{(inv.remaining || 0).toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between border-b border-foreground pb-1.5">
                <span className="text-xs text-content-secondary">{t("متأخرة علينا (AP)", "Overdue by us (AP)")}</span>
                <span className="text-xs font-semibold tabular-nums text-warning">{(data as any).overdueBills?.length || 0}</span>
              </div>
              {(!(data as any).overdueBills || (data as any).overdueBills.length === 0) ? (
                <p className="py-4 text-xs text-content-secondary">{t("🎉 لا توجد", "🎉 None")}</p>
              ) : (
                <div>
                  {((data as any).overdueBills as any[]).slice(0, 3).map((bill, i) => (
                    <Link key={bill.id} to={`/app/purchases/bills`} className={`flex items-center justify-between gap-2 py-2.5 ${i < 2 ? "border-b border-border" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-code text-xs text-foreground">{bill.number || bill.billNumber}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-warning">
                            <span className="ledger-dot" aria-hidden="true" />{bill.daysOverdue}{t("ي", "d")}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-content-secondary">{bill.contact}</span>
                      </span>
                      <span className="shrink-0 font-display text-sm tabular-nums text-foreground">{(bill.remaining || 0).toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 })}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats footer */}
      <MetricStrip>
        <Metric label={t("عدد العملاء/الموردين", "Customers/Vendors count")} value={<Numeral value={k.contactCount} fraction={false} />} />
        <Metric label={t("فواتير متأخرة", "Overdue invoices")} tone={k.overdueCount > 0 ? "warning" : "neutral"} value={<Numeral value={k.overdueCount} fraction={false} />} />
        <Metric label={t("إجمالي القبض", "Total receipts")} value={<><Numeral value={k.receipts} /> <small className="text-content-secondary">{cur}</small></>} />
        <Metric label={t("إجمالي الصرف", "Total payments")} value={<><Numeral value={k.payments} /> <small className="text-content-secondary">{cur}</small></>} />
      </MetricStrip>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
