import { displayLocale } from "../lib/number-display";
/**
 * Purchases Dashboard · org-scoped · matches sales dashboard structure (UX-65)
 *
 * Layout (Ledger · Direction A · reads like the main dashboard):
 *   1. Masthead · eyebrow (group · date) + title + quick-create pills (فاتورة مشتريات · مصروف · سند صرف · تصدير)
 *   2. Quick links · every page of the Purchases group (bills · expenses · payments · supplier credits · capture receipts)
 *   3. Figures strip · عدد الفواتير · إجمالي المشتريات · المصروفات النقدية · هذا الشهر — each drills into its list
 *   4. 3 insight cards · أكبر مورد · أكثر تأخر · أكثر تصنيف
 *   5. Recent purchase bills ledger table (5 rows · every row opens its bill) · عرض الجميع →
 *   6. Charts · المشتريات الشهرية (bars) · المصروفات حسب التصنيف (donut) — CSS-variable colours, dot+word legends
 */
import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  Loader2, FileText, AlertTriangle,
  Plus, Download, Trophy, Building2, ArrowLeft, Search, Receipt,
  CreditCard, ScrollText, Camera,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api, PurchasesDashboard as Data } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, RECEIVED: { ar: "مستلمة", en: "Received" }, PAID: { ar: "مدفوعة", en: "Paid" }, PARTIAL: { ar: "مدفوعة جزئياً", en: "Partially paid" },
  OVERDUE: { ar: "متأخرة", en: "Overdue" }, CANCELLED: { ar: "ملغاة", en: "Cancelled" },
};
/* Ledger status tone · paid = blue (success) · partial/overdue = copper · received = info · draft/cancelled = muted */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  RECEIVED: "info",
  PAID: "success",
  PARTIAL: "warning",
  OVERDUE: "warning",
  CANCELLED: "neutral",
};

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Donut slices · every series colour is a CSS variable (never a literal hex) */
const CATEGORY_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)",
  "var(--chart-4)", "var(--brand-teal-600)", "var(--success)", "var(--content-secondary)",
];
const gridStyle = { stroke: "var(--surface-hover)" };
const axisStyle = { fontSize: 11, fill: "var(--content-secondary)" };
const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
};
const CARD_BOX = "gap-2.5 p-4 md:gap-3 md:px-5 md:py-[18px] xl:gap-4 xl:px-6 xl:py-[22px]";
const CARD_TITLE = "text-[14px] font-semibold leading-snug text-foreground md:text-[15px] xl:text-[16px]";
const CARD_SUB = "text-[12px] leading-snug text-content-secondary";

function ChartLegend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-content-secondary ${className ?? ""}`}>
      {items.map((item) => (
        <span key={item.label} className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="truncate">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

/** A figure that goes somewhere — the dashboard-number contract from KpiCard (2026-08-28), on the ledger strip. */
function FigureLink({ to, title, ...rest }: { to: string; title: string; label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <Metric
      {...rest}
      role="link"
      tabIndex={0}
      title={title}
      className="cursor-pointer transition-colors hover:[&_.ledger-figure-value]:text-primary focus-visible:outline-none focus-visible:[&_.ledger-figure-value]:text-primary"
      onClick={() => navigate(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(to); } }}
    />
  );
}

export function PurchasesDashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null); setDegraded(false);
    try {
      setData(await api.dashboard.purchases());
      return;
    } catch (e: any) {
      // Resilience: compose a best-effort dashboard from list endpoints when the
      // aggregate 500s (pre-PR5 production API crashes on null-contact bills).
      // Each sub-fetch degrades independently; only if NOTHING loads do we show
      // the error card (which always carries a support reference now).
      try {
        const [billsRes, expensesRes, me]: any[] = await Promise.all([
          api.bills.list({}).catch(() => null),
          api.expenses.list({ limit: 200 }).catch(() => null),
          api.me().catch(() => null),
        ]);
        if (!billsRes && !expensesRes) {
          setError(humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
          return;
        }
        const billItems: any[] = billsRes?.items || [];
        const expItems: any[] = expensesRes?.items || [];
        const num = (v: any) => Number(v) || 0;
        const now = new Date();
        const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const yKey = String(now.getFullYear());
        const inMonth = (d?: string) => (d || "").startsWith(mKey);
        const inYear = (d?: string) => (d || "").startsWith(yKey);
        const supplierAgg: Record<string, { contactId: string; name: string; total: number }> = {};
        for (const b of billItems) {
          const id = b.contactId || b.contact?.id || b.vendorName || "—";
          supplierAgg[id] = supplierAgg[id] || { contactId: id, name: b.contact?.displayName || b.vendorName || "—", total: 0 };
          supplierAgg[id].total += num(b.total);
        }
        const catAgg: Record<string, number> = {};
        for (const x of expItems) {
          const c = x.category || "أخرى";
          catAgg[c] = (catAgg[c] || 0) + num(x.total);
        }
        const monthBills = billItems.filter((b) => inMonth(b.issueDate || b.date));
        const yearBills = billItems.filter((b) => inYear(b.issueDate || b.date));
        const yearExp = expItems.filter((x) => inYear(x.date));
        const ytdBills = yearBills.reduce((s, b) => s + num(b.total), 0);
        const ytdExp = yearExp.reduce((s, x) => s + num(x.total), 0);
        setData({
          org: { name: me?.org?.name || "", baseCurrency: me?.org?.baseCurrency || "SAR" },
          thisMonth: { bills: monthBills.reduce((s, b) => s + num(b.total), 0), billCount: monthBills.length },
          ytd: { bills: ytdBills, billCount: yearBills.length, expenses: ytdExp, expenseCount: yearExp.length, total: ytdBills + ytdExp },
          expensesByCategory: Object.entries(catAgg).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
          topSuppliers: Object.values(supplierAgg).sort((a, b) => b.total - a.total),
          recentBills: billItems.map((b) => ({
            id: b.id,
            number: b.billNumber || b.number || "—",
            contact: b.contact?.displayName || b.vendorName || "—",
            status: b.status || "DRAFT",
            total: num(b.total),
            date: b.issueDate || b.date || "",
          })),
        } as Data);
        setDegraded(true);
      } catch {
        setError(humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
      }
    } finally { setLoading(false); }
  }, [language]);
  useEffect(() => { refresh(); }, [refresh]);

  const monthlyData = useMemo(() => {
    const monthly = (data as (Data & { monthly?: Array<{ month: string; total: number }> }) | null)?.monthly;
    if (!monthly) return [];
    return monthly.map((m) => ({
      month: typeof m.month === "string" && m.month.includes("-") ? (language === "ar" ? AR_MONTHS : EN_MONTHS)[Number(m.month.split("-")[1]) - 1] : String(m.month),
      total: Number(m.total) || 0,
    }));
  }, [data, language]);

  const categoryData = useMemo(() => {
    if (!data?.expensesByCategory) return [];
    return data.expensesByCategory.slice(0, 8).map((c, i) => ({
      name: c.category,
      value: Number(c.total),
      fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={1.75} /></div>;
  if (error || !data) return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border border-s-[3px] border-s-danger bg-card px-4 py-3 text-sm text-foreground" role="alert">
      <span>{error || t("تعذّر التحميل", "Could not load")}</span>
      <Button type="button" variant="outline" size="sm" onClick={refresh}>
        {t("إعادة المحاولة", "Retry")}
      </Button>
    </div>
  );

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };
  const filtered = data.recentBills.filter((b) => !searchQuery || b.number.includes(searchQuery) || b.contact.includes(searchQuery)).slice(0, 5);

  // Insights
  const topSupplier = data.topSuppliers[0];
  const overdueBills = data.recentBills.filter((b) => b.status === "OVERDUE");
  const mostOverdueSupplier = overdueBills[0];
  const topCategory = data.expensesByCategory[0];

  const totalAllTime = Number(data.ytd.bills) + Number(data.ytd.expenses);

  const dateLocale = displayLocale(language === "ar" ? "ar-SA-u-ca-gregory" : "en-US");
  const todayLabel = new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const quickLinks = [
    { to: "/app/purchases/bills", icon: FileText, label: t("فواتير المشتريات", "Purchase bills") },
    { to: "/app/expenses", icon: Receipt, label: t("المصروفات", "Expenses") },
    { to: "/app/payments", icon: CreditCard, label: t("سندات الصرف", "Payment vouchers") },
    { to: "/app/purchases/supplier-credits", icon: ScrollText, label: t("إشعارات الموردين", "Supplier credits") },
    { to: "/app/scan-receipts", icon: Camera, label: t("التقاط الإيصالات", "Capture receipts") },
  ];

  const insight = (icon: ReactNode, label: string, name: string, figure: ReactNode) => (
    <Card className={CARD_BOX}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`mb-1 flex items-center gap-1.5 ${CARD_SUB}`}>{icon} {label}</p>
          <p className="truncate text-sm font-semibold text-foreground" title={name}><bdi dir="auto">{name}</bdi></p>
        </div>
        <div className="shrink-0">{figure}</div>
      </div>
    </Card>
  );
  const insightFigure = (value: number | null, tone = "text-foreground") => (
    <span dir="ltr" className={`font-display text-[18px] leading-6 tabular-nums ${tone}`}>
      {value == null ? "—" : value.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {value != null && <span className="font-english text-[10px] text-muted-foreground"> {cur}</span>}
    </span>
  );

  return (
    <div className="space-y-4 md:space-y-[18px] xl:space-y-6">
      {degraded && (
        <InlineAlert tone="warning">
          {language === "en"
            ? "Simplified view — showing data composed from bills & expenses while the dashboard service recovers."
            : "عرض مبسّط — البيانات مركّبة من فواتير الشراء والمصروفات مؤقتًا حتى يتعافى ملخص لوحة المشتريات."}
        </InlineAlert>
      )}

      {/* Masthead · eyebrow date + title + quick-create pills */}
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[30px] [&_h1]:leading-[1.15]"
        eyebrow={<span className="text-[12px] xl:text-[13px]">{t("المشتريات", "Purchases")} · {todayLabel}</span>}
        title={t("المشتريات", "Purchases")}
        description={t("نظرة شاملة على مشترياتك ومصروفاتك", "A complete view of your purchases and expenses")}
        actions={
          <>
            <Button onClick={() => navigate("/app/purchases/bills?new=1")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Plus className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("فاتورة مشتريات", "New Bill")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/app/expenses?new=1")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Plus className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("مصروف", "Expense")}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/app/payments?new=1")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Plus className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("سند صرف", "Payment")}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/app/reports?type=purchases")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Download className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("تصدير", "Export")}
            </Button>
          </>
        }
      />

      {/* Quick links · every page of the Purchases group */}
      <nav aria-label={t("صفحات المشتريات", "Purchases pages")} className="flex flex-wrap gap-2">
        {quickLinks.map((l) => (
          <Link key={l.to} to={l.to} className="ledger-hoverable inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition">
            <l.icon className="size-4 text-content-secondary" strokeWidth={1.75} />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      {/* Figures strip — each drills into the list that answers it (2026-08-28) */}
      <MetricStrip className="compact">
        <FigureLink to="/app/purchases/bills" title={t("افتح قائمة فواتير المشتريات", "Open the bills list")} label={t("عدد الفواتير", "Bills Count")} value={data.ytd.billCount} hint={t("فاتورة هذه السنة", "bills this year")} />
        <FigureLink to="/app/purchases/bills" title={t("افتح قائمة فواتير المشتريات", "Open the bills list")} label={t("إجمالي المشتريات", "Total Purchases")} value={<LedgerFigure value={totalAllTime} currency={cur} />} hint={t("فواتير + مصروفات · السنة حتى الآن", "Bills + expenses · year to date")} />
        <FigureLink to="/app/expenses" title={t("افتح المصروفات النقدية", "Open cash expenses")} label={t("المصروفات النقدية", "Cash Expenses")} value={<span className="text-warning"><LedgerFigure value={Number(data.ytd.expenses)} currency={cur} /></span>} hint={<><span className="tabular-nums">{data.ytd.expenseCount}</span> {t("مصروف", "expenses")}</>} />
        <FigureLink to="/app/purchases/bills" title={t("افتح فواتير هذا الشهر", "Open this month's bills")} label={t("هذا الشهر", "This Month")} value={<span className="text-success"><LedgerFigure value={Number(data.thisMonth.bills)} currency={cur} /></span>} hint={<><span className="tabular-nums">{data.thisMonth.billCount}</span> {t("فاتورة", "bills")}</>} />
      </MetricStrip>

      {/* 3 insight cards */}
      <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 md:grid-cols-3">
        {insight(<Trophy className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />, t("أكبر مورد", "Top supplier"), topSupplier?.name || "—", insightFigure(topSupplier ? Number(topSupplier.total) : null))}
        {insight(<AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />, t("أكثر تأخر", "Most overdue"), mostOverdueSupplier?.contact || "—", insightFigure(mostOverdueSupplier ? Number(mostOverdueSupplier.total) : 0, "text-warning"))}
        {insight(<Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />, t("أكثر تصنيف", "Top category"), topCategory?.category || "—", insightFigure(topCategory ? Number(topCategory.total) : null))}
      </div>

      {/* Recent bills · every row opens its bill */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section font-semibold text-foreground">{t("آخر فواتير المشتريات", "Recent Bills")}</h2>
          <div className="relative w-full sm:w-[260px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("البحث في الفواتير...", "Search bills...")}
              className="h-9 w-full ps-8 text-[13px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" strokeWidth={1.75} />} title={t("لا توجد فواتير مشتريات بعد", "No purchase bills yet")} />
        ) : (
          <div className="ledger-table overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
            <Table className="table-fixed min-w-[760px]">
              <colgroup>
                <col style={{ width: "200px" }} />{/* رقم الفاتورة · mono */}
                <col />{/* المورد · flexible */}
                <col style={{ width: "110px" }} />{/* التاريخ */}
                <col style={{ width: "130px" }} />{/* المبلغ */}
                <col style={{ width: "140px" }} />{/* الحالة */}
              </colgroup>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead>{t("رقم الفاتورة", "Bill #")}</TableHead>
                <TableHead>{t("المورد", "Supplier")}</TableHead>
                <TableHead>{t("التاريخ", "Date")}</TableHead>
                <TableHead className="text-end">{t("المبلغ", "Amount")} <span className="font-english">({cur})</span></TableHead>
                <TableHead>{t("الحالة", "Status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id} className="h-12 cursor-pointer" onClick={() => navigate(`/app/purchases/bills/${b.id}`)} title={t("فتح الفاتورة", "Open bill")}>
                    <TableCell className="align-middle overflow-hidden">
                      <Link to={`/app/purchases/bills/${b.id}`} onClick={(e) => e.stopPropagation()} title={b.number} className="block max-w-full hover:underline underline-offset-4">
                        <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{b.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="align-middle overflow-hidden text-foreground" title={b.contact}><span className="block truncate leading-5"><bdi dir="auto">{b.contact}</bdi></span></TableCell>
                    <TableCell className="align-middle"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{String(b.date || "").slice(0, 10)}</span></TableCell>
                    <TableCell className="text-end align-middle"><span dir="ltr" className="block font-display text-[18px] leading-6 text-foreground tabular-nums">{Number(b.total).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></TableCell>
                    <TableCell className="align-middle">
                      <StatusBadge tone={STATUS_TONE[b.status] || "neutral"} icon={b.status === "DRAFT" || b.status === "CANCELLED" ? <span className="ledger-dot hollow" aria-hidden="true" /> : undefined}>
                        {STATUS_LABELS[b.status] ? (language === "ar" ? STATUS_LABELS[b.status].ar : STATUS_LABELS[b.status].en) : b.status}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="text-center">
            <button
              onClick={() => navigate("/app/purchases/bills")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {t("عرض جميع الفواتير", "View all bills")} <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 lg:grid-cols-2">
        <Card className={CARD_BOX}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={CARD_TITLE}>{t("المشتريات الشهرية", "Monthly Purchases")}</h2>
            <span className={CARD_SUB}>{t("آخر 6 أشهر", "Last 6 months")}</span>
          </div>
          <div dir="ltr" className="h-[220px] xl:h-[260px]">
            {monthlyData.length === 0 ? (
              <EmptyState className="h-full border-0 px-0 py-10" title={t("لا توجد بيانات بعد", "No data yet")} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barCategoryGap="26%">
                  <CartesianGrid {...gridStyle} vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickMargin={6} />
                  <YAxis orientation="right" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={52} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="total" name={t("المشتريات", "Purchases")} radius={[4, 4, 0, 0]} maxBarSize={42}>
                    {monthlyData.map((_, i) => (
                      <Cell key={i} fill={i === monthlyData.length - 1 ? "var(--chart-2)" : "var(--chart-1)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <ChartLegend items={[
            { label: t("المشتريات", "Purchases"), color: "var(--chart-1)" },
            { label: t("الشهر الحالي", "Current month"), color: "var(--chart-2)" },
          ]} />
        </Card>
        <Card className={CARD_BOX}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={CARD_TITLE}>{t("المصروفات حسب التصنيف", "Expenses by Category")}</h2>
            <span className={CARD_SUB}>{t("السنة حتى الآن", "Year to date")}</span>
          </div>
          <div className="h-[220px] xl:h-[260px]">
            {categoryData.length === 0 ? (
              <EmptyState className="h-full border-0 px-0 py-10" title={t("لا توجد بيانات بعد", "No data yet")} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--card)"
                  >
                    {categoryData.map((s, i) => (
                      <Cell key={i} fill={s.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: any) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {categoryData.length > 0 && (
            <ChartLegend items={categoryData.map((s) => ({ label: s.name, color: s.fill }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
