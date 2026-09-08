import { displayLocale } from "../lib/number-display";
/**
 * Sales Dashboard · org-scoped · zero mock
 *
 * Layout (Ledger · Direction A · reads like the main dashboard):
 *   1. Masthead · eyebrow (group · date) + title + quick-create pills (فاتورة · عرض · سند قبض · تصدير)
 *   2. Quick links · every page of the Sales group (quotes · invoices · receipts · credit notes · POS)
 *   3. Figures strip · إجمالي الفواتير · إجمالي المبالغ · المحصّل · المتأخر — each opens the list it summarises
 *   4. 3 insight cards · أكبر عميل · أكثر تأخر · أكثر كريديت
 *   5. Recent invoices ledger table (5 rows · every row opens its invoice) · عرض الجميع →
 *   6. Charts · المبيعات الشهرية (bars) · توزيع الحالات (donut) — CSS-variable colours, dot+word legends
 */
import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  Loader2, FileText, AlertTriangle,
  Plus, Download, Trophy, Briefcase, ArrowLeft, Search,
  FileSpreadsheet, Receipt, ScrollText, ShoppingCart,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, LedgerFigure, Metric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api, ApiError, SalesDashboard as Data } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, SENT: { ar: "مرسلة", en: "Sent" }, VIEWED: { ar: "مُشاهَدة", en: "Viewed" }, PAID: { ar: "مدفوعة", en: "Paid" },
  PARTIAL: { ar: "مدفوعة جزئياً", en: "Partially paid" }, OVERDUE: { ar: "متأخرة", en: "Overdue" }, CANCELLED: { ar: "ملغاة", en: "Cancelled" },
};
/* Ledger status tone · paid = blue (success) · partial/overdue = copper · sent/viewed = info · draft/cancelled = muted */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "info",
  PAID: "success",
  PARTIAL: "warning",
  OVERDUE: "warning",
  CANCELLED: "neutral",
};
/* Donut slices · every series colour is a CSS variable (never a literal hex) */
const STATUS_FILL: Record<string, string> = {
  DRAFT: "var(--chart-5)",
  SENT: "var(--chart-2)",
  VIEWED: "var(--chart-3)",
  PAID: "var(--chart-1)",
  PARTIAL: "var(--warning)",
  OVERDUE: "var(--chart-4)",
  CANCELLED: "var(--content-secondary)",
};
const gridStyle = { stroke: "var(--surface-hover)" };
const axisStyle = { fontSize: 11, fill: "var(--content-secondary)" };
const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
};
const CARD_BOX = "gap-2.5 p-4 md:gap-3 md:px-5 md:py-[18px] xl:gap-4 xl:px-6 xl:py-[22px]";
const CARD_TITLE = "text-[14px] font-semibold leading-snug text-foreground md:text-[15px] xl:text-[16px]";
const CARD_SUB = "text-[12px] leading-snug text-content-secondary";

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export function SalesDashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.dashboard.sales()); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const monthlyData = useMemo(() => {
    const monthly = (data as (Data & { monthly?: Array<{ month: string; total: number }> }) | null)?.monthly;
    if (!monthly) return [];
    return monthly.map((m) => ({
      month: typeof m.month === "string" && m.month.includes("-") ? (language === "ar" ? AR_MONTHS : EN_MONTHS)[Number(m.month.split("-")[1]) - 1] : String(m.month),
      total: Number(m.total) || 0,
    }));
  }, [data, language]);

  const statusData = useMemo(() => {
    if (!data?.byStatus) return [];
    return data.byStatus.map((s) => ({
      name: `${STATUS_LABELS[s.status] ? (language === "ar" ? STATUS_LABELS[s.status].ar : STATUS_LABELS[s.status].en) : s.status} (${s.count})`,
      value: Number(s.total),
      status: s.status,
    })).filter((s) => s.value > 0);
  }, [data, language]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={1.75} /></div>;
  if (error || !data) return (
    <div className="rounded-lg border border-border border-s-[3px] border-s-danger bg-card px-4 py-3 text-sm text-foreground" role="alert">{error || t("تعذّر التحميل", "Could not load")}</div>
  );

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };
  const filtered = data.recentInvoices.filter((i) => !searchQuery || i.number.includes(searchQuery) || i.contact.includes(searchQuery)).slice(0, 5);

  // Insight cards
  const topCustomer = data.topCustomers[0];
  const overdueInvoices = data.recentInvoices.filter((i) => i.status === "OVERDUE");
  const mostOverdueCustomer = overdueInvoices[0];
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.total), 0);
  const notificationsCount = (data as any).notifications?.unreadCount || 0;

  const dateLocale = displayLocale(language === "ar" ? "ar-SA-u-ca-gregory" : "en-US");
  const todayLabel = new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const quickLinks = [
    { to: "/app/quotes", icon: FileSpreadsheet, label: t("عروض الأسعار", "Quotes") },
    { to: "/app/invoices", icon: FileText, label: t("الفواتير", "Invoices") },
    { to: "/app/receipts", icon: Receipt, label: t("سندات القبض", "Receipts") },
    { to: "/app/credit-notes", icon: ScrollText, label: t("الإشعارات الدائنة", "Credit notes") },
    { to: "/app/pos", icon: ShoppingCart, label: t("كاشير POS", "Cashier POS") },
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
      {/* Masthead · eyebrow date + title + quick-create pills */}
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[30px] [&_h1]:leading-[1.15]"
        eyebrow={<span className="text-[12px] xl:text-[13px]">{t("المبيعات", "Sales")} · {todayLabel}</span>}
        title={t("المبيعات", "Sales")}
        description={t("نظرة شاملة على مبيعاتك وفواتيرك", "A complete view of your sales and invoices")}
        actions={
          <>
            <Button onClick={() => navigate("/app/invoices?new=1")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Plus className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("فاتورة جديدة", "New Invoice")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/app/quotes?new=1")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Plus className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("عرض سعر", "New Quote")}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/app/receipts?new=1")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Plus className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("سند قبض", "Receipt")}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/app/reports?type=sales")} className="h-10 px-3.5 text-[13px] xl:px-[18px] xl:text-[14px]">
              <Download className="me-1 h-4 w-4" strokeWidth={1.75} /> {t("تصدير", "Export")}
            </Button>
          </>
        }
      />

      {/* Quick links · every page of the Sales group */}
      <nav aria-label={t("صفحات المبيعات", "Sales pages")} className="flex flex-wrap gap-2">
        {quickLinks.map((l) => (
          <Link key={l.to} to={l.to} className="ledger-hoverable inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition">
            <l.icon className="size-4 text-content-secondary" strokeWidth={1.75} />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      {/* Figures strip — each opens the invoice list it summarises (2026-08-28) */}
      <MetricStrip className="compact">
        <FigureLink to="/app/invoices" title={t("افتح قائمة الفواتير", "Open the invoice list")} label={t("إجمالي الفواتير", "Total Invoices")} value={data.allTime.count} hint={t("فاتورة", "invoices")} />
        <FigureLink to="/app/invoices" title={t("افتح قائمة الفواتير", "Open the invoice list")} label={t("إجمالي المبالغ", "Total Amount")} value={<LedgerFigure value={data.allTime.total} currency={cur} />} />
        <FigureLink to="/app/invoices?status=PAID" title={t("افتح الفواتير المدفوعة", "Open paid invoices")} label={t("المحصّل", "Collected")} value={<span className="text-success"><LedgerFigure value={data.allTime.paid} currency={cur} /></span>} />
        <FigureLink to="/app/invoices?status=OVERDUE" title={t("افتح الفواتير المتأخرة", "Open overdue invoices")} label={t("المتأخر", "Overdue")} value={<span className="text-warning"><LedgerFigure value={totalOverdue || data.allTime.outstanding} currency={cur} /></span>} hint={overdueInvoices.length ? <><span className="tabular-nums">{overdueInvoices.length}</span> {t("فاتورة متأخرة", "overdue invoices")}</> : t("المستحق غير المسدد", "Outstanding balance")} />
      </MetricStrip>

      {/* 3 insight cards · top customer · most overdue · most credit */}
      <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 md:grid-cols-3">
        {insight(<Trophy className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />, t("أكبر عميل", "Top customer"), topCustomer?.name || "—", insightFigure(topCustomer ? Number(topCustomer.total) : null))}
        {insight(<AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />, t("أكثر تأخر", "Most overdue"), mostOverdueCustomer?.contact || "—", insightFigure(mostOverdueCustomer ? Number(mostOverdueCustomer.total) : 0, "text-warning"))}
        {insight(<Briefcase className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />, t("أكثر كريديت", "Most credit"), data.topCustomers[1]?.name || "—", (
          <StatusBadge tone="info"><span className="tabular-nums">{notificationsCount}</span> {t("إشعارات", "notifications")}</StatusBadge>
        ))}
      </div>

      {/* Recent invoices · 5 rows + view all · every row opens its invoice */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section font-semibold text-foreground">{t("آخر الفواتير", "Recent Invoices")}</h2>
          <div className="relative w-full sm:w-[260px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("البحث في الفواتير...", "Search invoices...")}
              className="h-9 w-full ps-8 text-[13px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" strokeWidth={1.75} />} title={t("لا توجد فواتير بعد · أنشئ فاتورة من زر فاتورة جديدة أعلاه", "No invoices yet · create one with the New Invoice button above")} />
        ) : (
          <div className="ledger-table overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
            <Table className="table-fixed min-w-[760px]">
              <colgroup>
                <col style={{ width: "200px" }} />{/* رقم الفاتورة · mono */}
                <col />{/* العميل · flexible */}
                <col style={{ width: "110px" }} />{/* التاريخ */}
                <col style={{ width: "130px" }} />{/* المبلغ */}
                <col style={{ width: "140px" }} />{/* الحالة */}
              </colgroup>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead>{t("رقم الفاتورة", "Invoice #")}</TableHead>
                <TableHead>{t("العميل", "Customer")}</TableHead>
                <TableHead>{t("التاريخ", "Date")}</TableHead>
                <TableHead className="text-end">{t("المبلغ", "Amount")} <span className="font-english">({cur})</span></TableHead>
                <TableHead>{t("الحالة", "Status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id} className="h-12 cursor-pointer" onClick={() => navigate(`/app/invoices/${i.id}`)} title={t("فتح الفاتورة", "Open invoice")}>
                    <TableCell className="align-middle overflow-hidden">
                      <Link to={`/app/invoices/${i.id}`} onClick={(e) => e.stopPropagation()} title={i.number} className="block max-w-full hover:underline underline-offset-4">
                        <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{i.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="align-middle overflow-hidden text-foreground" title={i.contact}><span className="block truncate leading-5"><bdi dir="auto">{i.contact}</bdi></span></TableCell>
                    <TableCell className="align-middle"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{i.date}</span></TableCell>
                    <TableCell className="text-end align-middle"><span dir="ltr" className="block font-display text-[18px] leading-6 text-foreground tabular-nums">{Number(i.total).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></TableCell>
                    <TableCell className="align-middle">
                      <StatusBadge tone={STATUS_TONE[i.status] || "neutral"} icon={i.status === "DRAFT" || i.status === "CANCELLED" ? <span className="ledger-dot hollow" aria-hidden="true" /> : undefined}>
                        {STATUS_LABELS[i.status] ? (language === "ar" ? STATUS_LABELS[i.status].ar : STATUS_LABELS[i.status].en) : i.status}
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
              onClick={() => navigate("/app/invoices")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {t("عرض جميع الفواتير", "View all invoices")} <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </section>

      {/* Charts · monthly + status distribution */}
      <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 lg:grid-cols-2">
        <Card className={CARD_BOX}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={CARD_TITLE}>{t("المبيعات الشهرية", "Monthly Sales")}</h2>
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
                  <Bar dataKey="total" name={t("المبيعات", "Sales")} radius={[4, 4, 0, 0]} maxBarSize={42}>
                    {monthlyData.map((_, i) => (
                      <Cell key={i} fill={i === monthlyData.length - 1 ? "var(--chart-2)" : "var(--chart-1)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <ChartLegend items={[
            { label: t("المبيعات", "Sales"), color: "var(--chart-1)" },
            { label: t("الشهر الحالي", "Current month"), color: "var(--chart-2)" },
          ]} />
        </Card>
        <Card className={CARD_BOX}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={CARD_TITLE}>{t("توزيع حالات الفواتير", "Invoice Status Distribution")}</h2>
            <span className={CARD_SUB}>{t("حسب الحالة الحالية", "By current status")}</span>
          </div>
          <div className="h-[220px] xl:h-[260px]">
            {statusData.length === 0 ? (
              <EmptyState className="h-full border-0 px-0 py-10" title={t("لا توجد بيانات بعد", "No data yet")} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--card)"
                  >
                    {statusData.map((s, i) => (
                      <Cell key={i} fill={STATUS_FILL[s.status] || "var(--chart-5)"} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: any) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {statusData.length > 0 && (
            <ChartLegend items={statusData.map((s) => ({ label: s.name, color: STATUS_FILL[s.status] || "var(--chart-5)" }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
