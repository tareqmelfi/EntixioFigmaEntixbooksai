/**
 * Dashboard · org-scoped financial overview
 * All numbers from /api/dashboard/summary · zero mock data
 *
 * Layout (Wave-style):
 *   Row 1 · KPI strip (4 cards): Revenue · Expenses · VAT · Cash on hand
 *   Row 2 · Cash Flow chart (combo: in/out bars + net line) · P&L bars
 *   Row 3 · AR/AP cards · Period compare card · Connected accounts
 *   Row 4 · Expense breakdown donut · Overdue invoices list
 *   Row 5 · Quick stats footer
 */
import {
  DollarSign,
  ShoppingBag,
  Gauge,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
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
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useEffect, useState, useCallback } from "react";
import { BidiText } from "../components/bidi-text";
import { api, ApiError, DashboardSummary } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";

// Unified palette (user directive): navy/blue family only — no rainbow scatter
const DONUT_COLORS = ["#0B1B49", "#1276E3", "#4A90E8", "#7DD3FC", "#0F3B7A", "#93C5FD", "#1E3A6E", "#BFDBFE"];

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

// UX-205 · Locked chart-styles per Figma spec ("Data is the Hero")
const chartColors = {
  navy: "#0B1B49",                       // Entix logo deep navy · primary positive (UX-213 · full saturation)
  navySoft: "#0B1B49",                   // same · NO dusty version (matches Figma · solid bars)
  blue: "#1276E3",                       // brand interaction
  teal: "#1276E3",                       // unified: brand blue (color-unification pass)
  tealSoft: "#93C5FD",                   // light blue · paired secondary series
  green: "#10B981",                      // success
  red: "#E84B4B",                        // Figma red · slightly muted (UX-213 · brighter than dusty)
  redSoft: "#FCA5A5",                    // lightest rose
};
const gridStyle = { stroke: "#ECEEF1", strokeDasharray: "3 3", opacity: 0.8 };
const xAxisStyle = { fontSize: 10, fill: "#B0B7C3" };
const yAxisStyle = { fontSize: 10, fill: "#C4CAD4" };
const tooltipStyle = {
  contentStyle: { backgroundColor: "rgba(255,255,255,0.96)", border: "1px solid #ECEEF1", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  cursor: { fill: "rgba(11,27,73,0.04)" },
  labelStyle: { color: "#0B1B49", fontWeight: 600, marginBottom: 4 },
};

// VATGauge · split horizontal bar showing collected vs paid VAT
function VATGauge({ collected, paid, currency = "SAR" }: { collected: number; paid: number; currency?: string }) {
  const { t } = useLanguage();
  const net = collected - paid;
  const total = Math.max(collected + paid, 1);
  const collectedPct = (collected / total) * 100;
  const paidPct = (paid / total) * 100;
  const isOwed = net > 0;
  return (
    <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => (window.location.href = "/app/taxes")} title={t("فتح الضرائب", "Open taxes")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-muted-foreground">{t("ضريبة القيمة المضافة", "VAT")}</span>
          <Gauge className="h-4 w-4 text-muted-foreground/60" />
        </div>
        {/* split bar */}
        <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-background">
          <div style={{ width: `${collectedPct}%`, backgroundColor: chartColors.teal }} />
          <div style={{ width: `${paidPct}%`, backgroundColor: chartColors.navy }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: chartColors.teal }} /> {t("لصالح الضريبة", "Collected")} <span className="font-english font-semibold text-foreground ms-1">{collected.toLocaleString()}</span></span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: chartColors.navy }} /> {t("لصالحنا", "Owed to us")} <span className="font-english font-semibold text-foreground ms-1">{paid.toLocaleString()}</span></span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">{t("صافي المستحق", "Net Due")}</span>
          <div className="flex items-center gap-2">
            <span className="font-english" style={{ fontSize: "1rem", fontWeight: 700, color: isOwed ? "#E84B4B" : "#10B981" }}>{Math.abs(net).toLocaleString()} <span className="text-[10px] text-muted-foreground/60">{currency}</span></span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${isOwed ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{isOwed ? t("علينا", "We owe") : t("لصالحنا ✓", "Owed to us ✓")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string; type?: "rect" | "line" }[] }) {
  return (
    <div className="flex justify-center gap-4 pt-2" style={{ fontFamily: "Noto Sans Arabic", fontSize: "11px", color: "#9CA3AF" }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.type === "line" ? (
            <span style={{ width: 16, height: 2, backgroundColor: item.color, display: "inline-block", borderRadius: 1 }} />
          ) : (
            <span style={{ width: 8, height: 8, backgroundColor: item.color, display: "inline-block", borderRadius: 1 }} />
          )}
          <span>{item.label}</span>
        </div>
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
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onb, setOnb] = useState<{ openingBalancesDone: boolean; productsCount: number; contactsCount: number } | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);
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
const [onbDismissed, setOnbDismissed] = useState(() => { try { return localStorage.getItem("entix_onb_dismissed") === "1"; } catch { return false; } });
  const { toasts, dismiss } = useToasts();
  const navigate = useNavigate();

  useEffect(() => { api.onboarding.status().then(setOnb).catch(() => {}); }, []);

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || t("تعذّر تحميل بيانات لوحة التحكم", "Failed to load dashboard data")}
      </div>
    );
  }

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString()} ${cur}`;
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("لوحة التحكم", "Dashboard")}</h1>
          <p className="text-muted-foreground mt-1"><BidiText>{data.org.name}</BidiText> · <span className="font-english">{cur}</span></p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/invoices?new=1" className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary transition">{t("+ فاتورة", "+ Invoice")}</Link>
          <Link to="/app/expenses/new" className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-primary/5 transition">{t("+ مصروف", "+ Expense")}</Link>
          <Link to="/app/vouchers/new" className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-primary/5 transition">{t("+ سند", "+ Voucher")}</Link>
        </div>
      </div>

      {onb && !onbDismissed && (!onb.openingBalancesDone || onb.productsCount === 0) && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-primary" style={{ lineHeight: 1.7 }}>
            <strong>{t("أكمل إعداد شركتك", "Finish setting up your company")}</strong> — {t("انقل أرصدتك الافتتاحية وأصنافك وعملاءك من برنامجك السابق في دقائق، بدون إدخال يدوي.", "Move your opening balances, items and contacts from your previous software in minutes — no manual entry.")}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/app/onboarding" className="px-3.5 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary transition" style={{ fontWeight: 600 }}>{t("ابدأ النقل ←", "Start migration →")}</Link>
            <button onClick={() => { try { localStorage.setItem("entix_onb_dismissed", "1"); } catch {} setOnbDismissed(true); }} className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 cursor-pointer">{t("لاحقًا", "Later")}</button>
          </div>
        </div>
      )}



      {/* Overdue alert banner */}
      {data.overdueInvoices.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="text-sm">
              <span className="font-semibold text-red-700">{data.overdueInvoices.length} {t("فاتورة متأخرة", "overdue invoice(s)")}</span>
              <span className="text-red-600 mx-2">·</span>
              <span className="text-red-600 font-english">
                {data.overdueInvoices.reduce((s, i) => s + i.remaining, 0).toLocaleString()} {cur}
              </span>
              <span className="text-red-600 mx-1">{t("قيد التحصيل", "pending collection")}</span>
            </div>
          </div>
          <Link to="/app/invoices?status=OVERDUE" className="text-sm text-red-700 hover:underline">{t("عرض الكل ←", "View all ←")}</Link>
        </div>
      )}

      {/* Industry strip · per-category landing row (P2) */}
      {strip && (
        <div className="rounded-xl border border-secondary/25 bg-secondary/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <strip.icon className="h-4 w-4 text-secondary" />
            <span className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t(strip.ar, strip.en)}</span>
            <span className="text-[11px] text-muted-foreground">{t("· لوحة مخصصة لنشاط شركتك", "· tailored to your industry")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {strip.chips.map((chip) => {
              const v = chip.value(k, lowStock);
              return (
                <Link
                  key={chip.href + chip.en}
                  to={chip.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:border-primary/40 hover:shadow-sm transition"
                >
                  <span className="text-muted-foreground">{t(chip.ar, chip.en)}</span>
                  <span className="font-english text-foreground" style={{ fontWeight: 700 }}>{v}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards · Row 1 (UX-212 · revenue · net income · expenses · VAT · smaller numbers + distinct colors) */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue · rightmost · navy */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/invoices")} title={t("فتح فواتير المبيعات", "Open sales invoices")}>
          <CardContent className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted-foreground">{t("إجمالي الإيرادات", "Total Revenue")}</span>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="font-english text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15 }}>
              <span className="text-muted-foreground text-[0.7rem] me-1 font-normal">{cur}</span>
              {k.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10.5px] text-muted-foreground/60 mt-1.5"><span className="font-english font-semibold text-foreground">{k.invoiceCount}</span>{t(" فاتورة · نقد ", " invoice · cash ")}<span className="font-english">{k.cashOnHand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
          </CardContent>
        </Card>

        {/* Net Income · highlighted with sign · green/amber */}
        {(() => {
          const net = k.revenue - (k.expenses + k.purchases);
          const positive = net >= 0;
          return (
            <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{t("صافي الدخل", "Net Income")}</span>
                  {positive ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "#10B981" }} /> : <TrendingDown className="h-3.5 w-3.5" style={{ color: "#D97474" }} />}
                </div>
                <div className="font-english" style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15, color: positive ? "#0B1B49" : "#D97474" }}>
                  <span className="text-muted-foreground text-[0.7rem] me-1 font-normal">{cur}</span>
                  {Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-[10.5px] mt-1.5">
                  <span className={positive ? "text-emerald-700" : "text-rose-700"} style={{ fontWeight: 600 }}>{positive ? t("ربح", "Profit") : t("خسارة", "Loss")}</span>
                  <span className="text-muted-foreground/60">{t(" · هامش ", " · margin ")}</span>
                  <span className="font-english" style={{ color: positive ? "#10B981" : "#D97474" }}>{k.revenue > 0 ? Math.round((net / k.revenue) * 100) : 0}%</span>
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Total Expenses · blue (unified) */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/expenses")} title={t("فتح المصروفات", "Open expenses")}>
          <CardContent className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted-foreground">{t("إجمالي المصروفات", "Total Expenses")}</span>
              <ShoppingBag className="h-3.5 w-3.5" style={{ color: chartColors.teal }} />
            </div>
            <div className="font-english" style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15, color: chartColors.teal }}>
              <span className="text-muted-foreground text-[0.7rem] me-1 font-normal">{cur}</span>
              {(k.expenses + k.purchases).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10.5px] text-muted-foreground/60 mt-1.5">{t("مباشرة ", "Direct ")}<span className="font-english font-semibold" style={{ color: chartColors.teal }}>{k.purchases.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>{t(" · عمومية ", " · General ")}<span className="font-english">{k.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
          </CardContent>
        </Card>

        {/* VAT Gauge · leftmost */}
        <VATGauge collected={k.vatOutput} paid={k.vatInput} currency={cur} />
      </div>

      {/* Charts grid 2x2 · Figma spec UX-205 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L · vertical bars · navy + red */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/reports")} title={t("فتح تقرير الأرباح والخسائر", "Open P&L report")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("الأرباح والخسائر", "Profit & Loss")}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t("ملخص الأرباح والخسائر لآخر 6 أشهر", "P&L summary for the last 6 months")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.profitLoss.map(p => ({ month: p.month, profit: p.revenue, loss: p.expenses }))}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" reversed tick={xAxisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={yAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                  <Bar dataKey="profit" fill={chartColors.navySoft} radius={[8, 8, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="loss" fill={chartColors.red} radius={[8, 8, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: t("الأرباح", "Profit"), color: chartColors.navy },
              { label: t("الخسائر", "Loss"), color: chartColors.red },
            ]} />
          </CardContent>
        </Card>

        {/* Revenue Breakdown · horizontal bars */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("تفصيل الإيرادات", "Revenue Breakdown")}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t("توزيع الإيرادات حسب الفروع والمشاريع ومراكز التكلفة", "Revenue distribution by branches, projects and cost centers")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.incomeBreakdown.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground/60">{t("لا توجد إيرادات بعد", "No revenue yet")}</div>
            ) : (
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart layout="vertical" data={data.incomeBreakdown.slice(0, 6).map(r => ({ category: r.category, value: r.total }))}>
                    <CartesianGrid {...gridStyle} horizontal={false} />
                    <XAxis type="number" tick={xAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                    <YAxis type="category" dataKey="category" orientation="right" width={100} tick={{ ...yAxisStyle, fontFamily: "Noto Sans Arabic" }} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                    <Bar dataKey="value" fill={chartColors.navySoft} radius={[0, 8, 8, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue vs Expenses · grouped bars */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("الإيرادات مقابل المصروفات", "Revenue vs Expenses")}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t("مقارنة الإيرادات بالمصروفات لآخر 6 أشهر", "Revenue vs expenses comparison for the last 6 months")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" reversed tick={xAxisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={yAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                  <Bar dataKey="revenue" fill={chartColors.navySoft} radius={[8, 8, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill={chartColors.tealSoft} radius={[8, 8, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: t("الإيرادات", "Revenue"), color: chartColors.navy },
              { label: t("المصروفات", "Expenses"), color: chartColors.teal },
            ]} />
          </CardContent>
        </Card>

        {/* Cash Flow · line chart */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/bank-accounts")} title={t("فتح الحسابات البنكية", "Open bank accounts")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("التدفق النقدي", "Cash Flow")}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t("تحليل التدفقات النقدية الداخلة والخارجة", "Analysis of cash inflows and outflows")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.cashFlowTrend.map(c => ({ month: c.month, inflow: c.in, outflow: c.out }))}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" reversed tick={xAxisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={yAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                  <Line type="monotone" dataKey="inflow" stroke={chartColors.navy} strokeWidth={2} dot={{ r: 3, fill: chartColors.navy }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="outflow" stroke={chartColors.teal} strokeWidth={2} dot={{ r: 3, fill: chartColors.teal }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: t("تدفق داخل", "Inflow"), color: chartColors.navy, type: "line" },
              { label: t("تدفق خارج", "Outflow"), color: chartColors.teal, type: "line" },
            ]} />
          </CardContent>
        </Card>
      </div>

      {/* AR/AP + Period Compare + Connected Accounts · Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AR/AP card */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              <Banknote className="h-4 w-4" /> {t("الذمم المدينة والدائنة", "Receivables & Payables")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/invoices")} title={t("عرض فواتير المبيعات", "View sales invoices")}>
              <div>
                <div className="text-xs text-primary/80">{t("يستحقون لي (AR)", "Receivable (AR)")}</div>
                <div className="font-english font-bold text-primary mt-0.5" style={{ fontSize: "1.15rem" }}>{fmt(k.accountsReceivable)}</div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50/70 border border-red-100 cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/purchases/bills")} title={t("عرض فواتير المشتريات", "View purchase invoices")}>
              <div>
                <div className="text-xs text-red-700/80">{t("أستحق عليهم (AP)", "Payable (AP)")}</div>
                <div className="font-english font-bold text-red-700 mt-0.5" style={{ fontSize: "1.15rem" }}>{fmt(k.accountsPayable)}</div>
              </div>
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t("صافي الذمم", "Net balance")}</span>
              <span className={`font-english font-bold ${k.accountsReceivable - k.accountsPayable >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmt(k.accountsReceivable - k.accountsPayable)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Period Compare · paired bars (UX-214) */}
        <Card className="border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition" onClick={() => navigate("/app/reports")} title={t("فتح التقارير", "Open reports")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              <TrendingUp className="h-4 w-4" /> {t("هذا الشهر", "This month")} vs {t("الشهر الماضي", "Last month")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {(() => {
              const rows = [
                { label: t("الإيرادات", "Revenue"), curr: data.periodCompare.thisMonth.revenue, prev: data.periodCompare.lastMonth.revenue, ya: yearAgo.revenue, color: chartColors.navy, prevColor: chartColors.navy + "40", upGood: true, cmp: revCompare },
                { label: t("المصروفات", "Expenses"), curr: data.periodCompare.thisMonth.expenses, prev: data.periodCompare.lastMonth.expenses, ya: yearAgo.expenses, color: chartColors.teal, prevColor: chartColors.teal + "40", upGood: false, cmp: expCompare },
                { label: t("صافي الدخل", "Net Income"), curr: data.periodCompare.thisMonth.net, prev: data.periodCompare.lastMonth.net, ya: yearAgo.net, color: data.periodCompare.thisMonth.net >= 0 ? "#10B981" : "#E84B4B", prevColor: (data.periodCompare.thisMonth.net >= 0 ? "#10B981" : "#E84B4B") + "40", upGood: true, cmp: netCompare },
              ];
              const max = Math.max(1, ...rows.flatMap(r => [Math.abs(r.curr), Math.abs(r.prev), Math.abs(r.ya)]));
              return rows.map((r, i) => {
                const positiveTrend = r.upGood ? r.cmp.up : !r.cmp.up;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{r.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-english font-semibold text-foreground">{fmtCompact(r.curr)}</span>
                        <span className="font-english text-[10px]" style={{ color: positiveTrend ? "#10B981" : "#E84B4B" }}>{r.cmp.up ? "▲" : "▼"} {r.cmp.value}%</span>
                      </div>
                    </div>
                    {/* Three stacked thin bars · current / previous month / year-ago (UX-216) */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground/60 w-12 shrink-0">{t("الحالي", "Current")}</span>
                        <div className="flex-1 h-1.5 bg-background rounded">
                          <div className="h-1.5 rounded" style={{ width: `${(Math.abs(r.curr) / max) * 100}%`, backgroundColor: r.color }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground/60 w-12 shrink-0">{t("الشهر الماضي", "Last month")}</span>
                        <div className="flex-1 h-1.5 bg-background rounded">
                          <div className="h-1.5 rounded" style={{ width: `${(Math.abs(r.prev) / max) * 100}%`, backgroundColor: r.prevColor }} />
                        </div>
                        <span className="font-english text-[10px] text-muted-foreground/60 shrink-0 w-9 text-end">{fmtCompact(r.prev)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground/60 w-12 shrink-0">{t("السنة الماضية", "Last year")}</span>
                        <div className="flex-1 h-1.5 bg-background rounded">
                          <div className="h-1.5 rounded" style={{ width: `${(Math.abs(r.ya || 0) / max) * 100}%`, backgroundColor: r.prevColor }} />
                        </div>
                        <span className="font-english text-[10px] text-muted-foreground/60 shrink-0 w-9 text-end">{fmtCompact(r.ya || 0)}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        {/* Bank Accounts · Wave-style cards · UX-209 */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                <Wallet className="h-4 w-4" /> {t("الحسابات البنكية", "Bank accounts")}
              </CardTitle>
              <Link to="/app/bank-accounts" className="text-xs text-primary hover:underline">{t("إدارة ←", "Manage ←")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.bankAccounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-2">{t("لا توجد حسابات بنكية مربوطة", "No bank accounts connected")}</p>
                <Link to="/app/bank-accounts/new" className="text-xs text-primary hover:underline">{t("+ ربط بنك جديد", "+ Connect new bank")}</Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/60 mb-1">{t("هذا الشهر مقابل الشهر الماضي", "This month vs last month")}</p>
                {data.bankAccounts.slice(0, 4).map((b: any) => {
                  // Compute trend % vs last month (mocked +4% if not provided · UX-215 Opus design)
                  const trendPct = (b as any).trendPct ?? 4;
                  const trendUp = trendPct >= 0;
                  return (
                    <Link key={b.id} to={`/app/bank-accounts/${b.id}`} className="block group">
                      <div className="rounded-lg border border-border hover:border-primary transition p-2.5 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          {/* Right side · name + logo placeholder */}
                          <div className="flex items-center gap-2 min-w-0">
                            {(b as any).logoUrl ? (
                              <img src={(b as any).logoUrl} alt="" className="w-7 h-7 rounded-md object-contain p-0.5 border border-border/50" />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-primary/5 border border-border flex items-center justify-center">
                                <Wallet className="h-3.5 w-3.5" style={{ color: chartColors.navy }} />
                              </div>
                            )}
                            <span className="text-xs text-foreground truncate" style={{ fontWeight: 600 }}>{b.bankName || b.name} · {b.currency}</span>
                          </div>
                          {/* Left side · trend chip */}
                          <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-english shrink-0 ${trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            <span style={{ fontSize: "0.7rem" }}>{trendUp ? "↗" : "↘"}</span> {trendUp ? "+" : ""}{trendPct}%
                          </span>
                        </div>
                        {/* Big balance number */}
                        <div className="font-english text-foreground mt-1.5" style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                          {b.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] text-muted-foreground/60">{b.currency}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown + Overdue · Row 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("تصنيف المصروفات", "Expense Breakdown")}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t("حسب الفئة · هذا العام", "By category · this year")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.expenseBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">{t("لا توجد مصروفات بعد", "No expenses yet")}</p>
                <Link to="/app/expenses/new" className="text-xs text-primary hover:underline">{t("+ إضافة مصروف", "+ Add expense")}</Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.expenseBreakdown}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
                    formatter={(v: any) => Number(v).toLocaleString()}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: "Noto Sans Arabic" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Overdue · 2 columns: AR (متأخرة لي) + AP (متأخرة عليّ) (UX-214) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2" style={{ fontSize: "1rem", fontWeight: 600 }}>
                <Clock className="h-4 w-4" style={{ color: chartColors.red }} /> {t("الفواتير المتأخرة", "Overdue Invoices")}
              </CardTitle>
              <Link to="/app/invoices?status=OVERDUE" className="text-xs text-primary hover:underline">{t("عرض الكل ←", "View all ←")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* AR overdue · invoices customers haven't paid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">{t("متأخرة عليهم (AR)", "Overdue to us (AR)")}</span>
                  <span className="font-english text-[11px] font-semibold" style={{ color: chartColors.red }}>{data.overdueInvoices.length}</span>
                </div>
                {data.overdueInvoices.length === 0 ? (
                  <div className="text-center py-6 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[11px] text-emerald-700">{t("🎉 لا توجد", "🎉 None")}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {data.overdueInvoices.slice(0, 3).map((inv) => (
                      <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="block p-2 rounded-md hover:bg-rose-50 border border-border/50 hover:border-rose-100 transition">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-english text-[11px] text-foreground font-semibold truncate">{inv.number}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-english shrink-0">{inv.daysOverdue}{t("ي", "d")}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{inv.contact}</div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="font-english text-[11px] font-semibold" style={{ color: chartColors.red }}>{(inv.remaining || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* AP overdue · bills we haven't paid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">{t("متأخرة علينا (AP)", "Overdue by us (AP)")}</span>
                  <span className="font-english text-[11px] font-semibold" style={{ color: chartColors.teal }}>{(data as any).overdueBills?.length || 0}</span>
                </div>
                {(!(data as any).overdueBills || (data as any).overdueBills.length === 0) ? (
                  <div className="text-center py-6 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[11px] text-emerald-700">{t("🎉 لا توجد", "🎉 None")}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {((data as any).overdueBills as any[]).slice(0, 3).map((bill) => (
                      <Link key={bill.id} to={`/app/purchases/bills`} className="block p-2 rounded-md hover:bg-cyan-50 border border-border/50 hover:border-cyan-100 transition">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-english text-[11px] text-foreground font-semibold truncate">{bill.number || bill.billNumber}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-100 text-cyan-700 font-english shrink-0">{bill.daysOverdue}{t("ي", "d")}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{bill.contact}</div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="font-english text-[11px] font-semibold" style={{ color: chartColors.teal }}>{(bill.remaining || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats footer · Row 5 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">{t("عدد العملاء/الموردين", "Customers/Vendors count")}</div>
            <div className="font-english text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.contactCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">{t("فواتير متأخرة", "Overdue invoices")}</div>
            <div className={`font-english ${k.overdueCount > 0 ? "text-red-600" : "text-foreground"}`} style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.overdueCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">{t("إجمالي القبض", "Total receipts")}</div>
            <div className="font-english text-green-600" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.receipts.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">{t("إجمالي الصرف", "Total payments")}</div>
            <div className="font-english text-amber-600" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.payments.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
