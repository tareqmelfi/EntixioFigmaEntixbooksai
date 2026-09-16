import { HistoricalReportSummary, useHistoricalReports } from "../components/historical-reports-access";
import { DashboardFinancialOverview } from "../components/dashboard-financial-overview";
import { HistoricalStatements } from "../components/historical-statements";
import { displayLocale } from "../lib/number-display";
/** Company dashboard: selected-period activity, all-year current balances, then saved historical reference. */
import {
  Loader2,
  ShoppingCart,
  FolderKanban,
  Building2,
  HardHat,
  Scale,
  Stethoscope,
  Clapperboard,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useEffect, useState, useCallback, useRef } from "react";
import { BidiText } from "../components/bidi-text";
import { api, ApiError, DashboardSummary, type DashboardPeriodKey } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { useSession } from "../lib/auth-client";
import { readActAs } from "../lib/act-as";

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
      { ar: "ذمم عملاء قائمة", en: "current receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
    ],
  },
  "law-firm": {
    icon: Scale, ar: "المحاماة والاستشارات", en: "Law firm & consulting",
    chips: [
      { ar: "ذمم عملاء قائمة", en: "current receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "تقادم الذمم", en: "AR aging", value: () => "›", href: "/app/reports/ar-aging" },
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
    ],
  },
  "production-studio": {
    icon: Clapperboard, ar: "استوديو الإنتاج", en: "Production studio",
    chips: [
      { ar: "المشاريع", en: "projects", value: () => "›", href: "/app/projects" },
      { ar: "ذمم عملاء قائمة", en: "current receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
    ],
  },
  clinic: {
    icon: Stethoscope, ar: "العيادات", en: "Clinics",
    chips: [
      { ar: "ذمم عملاء قائمة", en: "current receivables", value: (k) => fmtV(k.accountsReceivable), href: "/app/invoices" },
      { ar: "فواتير متأخرة", en: "overdue invoices", value: (k) => k.overdueCount, href: "/app/invoices?status=OVERDUE" },
      { ar: "تقادم الذمم", en: "AR aging", value: () => "›", href: "/app/reports/ar-aging" },
    ],
  },
};

export function Dashboard() {
  const { t, language } = useLanguage();
  const session = useSession();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicalView, setHistoricalView] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriodKey>("fiscal_ytd");
  const requestGeneration = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [onb, setOnb] = useState<{ completed: boolean; completedAt: string | null; openingBalancesDone: boolean; productsCount: number; contactsCount: number } | null>(null);
  const [onbDismissed, setOnbDismissed] = useState(false);
  const [lowStock, setLowStock] = useState<number | null>(null);
  const orgId = data?.org.id;
  const historical = useHistoricalReports(data?.org || null);
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
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const d = await api.dashboard.summary(period);
      if (generation === requestGeneration.current) setData(d);
    } catch (e: any) {
      if (generation === requestGeneration.current) setError(e instanceof ApiError ? e.message : t("فشل تحميل البيانات", "Failed to load data"));
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [period]);

  useEffect(() => { void refresh(); return () => { requestGeneration.current++; }; }, [refresh]);

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

  if (historicalView) return <HistoricalStatements key={data.org.id} org={data.org} access={historical} onClose={() => setHistoricalView(false)} />;

  const k = data.kpi;
  // Industry strip (per-category landing row) — driven by org.industry
  const industryId = (data.org as any).industry as string | undefined;
  const strip = industryId ? INDUSTRY_STRIP[industryId] : undefined;

  // ── Masthead · real date, fiscal year, time-of-day greeting ───────────────
  const now = new Date();
  const dateLocale = displayLocale(language === "ar" ? "ar-SA-u-ca-gregory" : "en-US");
  const todayLabel = now.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hour = now.getHours();
  const greetWord = hour < 12
    ? t("صباح الخير", "Good morning")
    : hour < 18
      ? t("مساء الخير", "Good afternoon")
      : t("مساء الخير", "Good evening");
  const sessionName = (session as any)?.data?.user?.name as string | undefined;
  const greetName = (sessionName && sessionName.trim().split(/\s+/)[0]) || data.org.name;
  return (
    <div className="space-y-4 md:space-y-[18px] xl:space-y-6">
      {/* Masthead · eyebrow date + greeting + primary actions */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1 xl:gap-1.5">
          {/* The page name stays the h1 (a11y + tests); the greeting is display copy under it. */}
          <h1 className="text-[12px] font-normal text-content-secondary xl:text-[13px]">
            {t("لوحة التحكم", "Dashboard")} · {todayLabel}

          </h1>
          <p className="text-[24px] font-bold leading-[1.15] tracking-[-0.01em] text-foreground xl:text-[30px]">
            {greetWord}{t("، ", ", ")}<BidiText>{greetName}</BidiText>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:gap-2.5">
          <Button asChild className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]"><Link to="/app/invoices?new=1">{t("+ فاتورة", "+ Invoice")}</Link></Button>
          <Button asChild variant="outline" className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]"><Link to="/app/expenses/new">{t("+ مصروف", "+ Expense")}</Link></Button>
          <Button asChild variant="secondary" className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
            <Link to="/app/vouchers/new" title={t("+ سند", "+ Voucher")}>{t("+ قيد", "+ Entry")}</Link>
          </Button>
        </div>
      </header>

      {onb && !onbDismissed && !onb.completed && (
        <Card className="border-s-[3px] border-s-primary">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 xl:px-6 xl:py-[22px]">
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

      {/* Industry strip · per-category landing row (P2) */}
      {strip && (
        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <strip.icon className="size-4 text-content-secondary" strokeWidth={1.75} />
            <span className="text-sm font-semibold text-foreground">{t(strip.ar, strip.en)}</span>
            <span className="text-xs text-content-secondary">{t("· أرصدة حالية وروابط النشاط", "· current balances and industry shortcuts")}</span>
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

      <DashboardFinancialOverview data={data} period={period} onPeriodChange={setPeriod} historicalRecord={historical.record} historicalLoading={historical.loading} historicalError={historical.error} onOpenHistorical={() => setHistoricalView(true)} />
      <HistoricalReportSummary access={historical} onOpen={() => setHistoricalView(true)} />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
