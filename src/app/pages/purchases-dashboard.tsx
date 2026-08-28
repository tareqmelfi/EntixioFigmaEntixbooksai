/**
 * Purchases Dashboard · org-scoped · matches sales dashboard structure (UX-65)
 *
 * Layout:
 *   1. Hero · title + quick-create (فاتورة مشتريات · مصروف · سند صرف · تصدير)
 *   2. 4 KPI cards · إجمالي · المسدّد · المتبقي · عدد الفواتير
 *   3. 3 insight cards · أكبر مورد · أكثر تأخر · أكثر إنفاق
 *   4. Recent purchase bills table (5 rows + view all)
 *   5. Charts · monthly bills · expenses by category
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { KpiCard } from "../components/kpi-card";
import {
  Loader2, FileText, ShoppingCart, TrendingUp, AlertTriangle,
  Plus, Download, Trophy, Building2, ArrowLeft, Search, MoreHorizontal, Receipt,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CATEGORY_COLORS = ["#0B1B49", "#1276E3", "#4A90E8", "#7DD3FC", "#0F3B7A", "#93C5FD", "#1E3A6E", "#BFDBFE"];

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

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
      <span>{error || t("تعذّر التحميل", "Could not load")}</span>
      <Button type="button" variant="outline" size="sm" onClick={refresh} className="border-red-300 text-red-700 hover:bg-red-100">
        {t("إعادة المحاولة", "Retry")}
      </Button>
    </div>
  );

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${cur} ${n.toLocaleString()}`;
  const filtered = data.recentBills.filter((b) => !searchQuery || b.number.includes(searchQuery) || b.contact.includes(searchQuery)).slice(0, 5);

  // Insights
  const topSupplier = data.topSuppliers[0];
  const overdueBills = data.recentBills.filter((b) => b.status === "OVERDUE");
  const mostOverdueSupplier = overdueBills[0];
  const topCategory = data.expensesByCategory[0];

  const totalAllTime = Number(data.ytd.bills) + Number(data.ytd.expenses);

  return (
    <div className="space-y-5">
      {degraded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {language === "en"
            ? "Simplified view — showing data composed from bills & expenses while the dashboard service recovers."
            : "عرض مبسّط — البيانات مركّبة من فواتير الشراء والمصروفات مؤقتًا حتى يتعافى ملخص لوحة المشتريات."}
        </div>
      )}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المشتريات", "Purchases")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("نظرة شاملة على مشترياتك ومصروفاتك", "A complete view of your purchases and expenses")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/app/purchases/bills?new=1")} className="bg-primary hover:bg-primary/80">
            <Plus className="me-1 h-4 w-4" /> {t("فاتورة مشتريات", "New Bill")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/expenses?new=1")} className="border-border text-primary">
            <Plus className="me-1 h-4 w-4" /> {t("مصروف", "Expense")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/payments?new=1")} className="border-border text-primary">
            <Plus className="me-1 h-4 w-4" /> {t("سند صرف", "Payment")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/reports?type=purchases")} className="border-border text-muted-foreground">
            <Download className="me-1 h-4 w-4" /> {t("تصدير", "Export")}
          </Button>
        </div>
      </div>

      {/* 4 KPI cards — each drills into the list that answers it (2026-08-28) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label={t("عدد الفواتير", "Bills Count")}
          value={data.ytd.billCount}
          icon={<FileText className="h-4 w-4 text-primary" />}
          to="/app/purchases/bills"
          title={t("افتح قائمة فواتير المشتريات", "Open the bills list")}
        />
        <KpiCard
          label={t("إجمالي المشتريات", "Total Purchases")}
          value={fmt(totalAllTime)}
          icon={<ShoppingCart className="h-4 w-4 text-primary" />}
          to="/app/purchases/bills"
          title={t("افتح قائمة فواتير المشتريات", "Open the bills list")}
        />
        <KpiCard
          label={t("المصروفات النقدية", "Cash Expenses")}
          value={fmt(Number(data.ytd.expenses))}
          tone="text-amber-600"
          icon={<Receipt className="h-4 w-4 text-amber-500" />}
          to="/app/expenses"
          title={t("افتح المصروفات النقدية", "Open cash expenses")}
        />
        <KpiCard
          label={t("هذا الشهر", "This Month")}
          value={fmt(Number(data.thisMonth.bills))}
          tone="text-green-600"
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          to="/app/purchases/bills"
          title={t("افتح فواتير هذا الشهر", "Open this month's bills")}
        />
      </div>

      {/* 3 insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Trophy className="h-3 w-3 text-amber-500" /> {t("أكبر مورد", "Top supplier")}</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{topSupplier?.name || "—"}</p>
              </div>
              <div className="font-english text-foreground text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">{cur}</span> {topSupplier ? Number(topSupplier.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-red-500" /> {t("أكثر تأخر", "Most overdue")}</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{mostOverdueSupplier?.contact || "—"}</p>
              </div>
              <div className="font-english text-red-600 text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">{cur}</span> {mostOverdueSupplier ? Number(mostOverdueSupplier.total).toLocaleString() : "0"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Building2 className="h-3 w-3 text-primary" /> {t("أكثر تصنيف", "Top category")}</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{topCategory?.category || "—"}</p>
              </div>
              <div className="font-english text-foreground text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">{cur}</span> {topCategory ? Number(topCategory.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent bills */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border/50">
            <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("آخر فواتير المشتريات", "Recent Bills")}</h2>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder={t("البحث في الفواتير...", "Search bills...")}
                className="w-64 ps-9 h-9 border-border text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">{t("لا توجد فواتير مشتريات بعد", "No purchase bills yet")}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs text-muted-foreground">
                  <th className="py-2.5 px-5 text-start" style={{ fontWeight: 600 }}>{t("رقم الفاتورة", "Bill #")}</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>{t("المورد", "Supplier")}</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>{t("المبلغ", "Amount")} ({cur})</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                  <th className="py-2.5 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-border/50 hover:bg-primary/5 cursor-pointer" onClick={() => navigate(`/app/purchases/bills`)}>
                    <td className="py-3 px-5 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{b.number}</td>
                    <td className="py-3 px-2 text-sm text-foreground/80">{b.contact}</td>
                    <td className="py-3 px-2 font-english text-xs text-muted-foreground">{b.date}</td>
                    <td className="py-3 px-2 font-english text-sm text-foreground" style={{ fontWeight: 600 }}>{Number(b.total).toLocaleString()}</td>
                    <td className="py-3 px-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status] ? (language === "ar" ? STATUS_LABELS[b.status].ar : STATUS_LABELS[b.status].en) : b.status}</span></td>
                    <td className="py-3 px-2"><MoreHorizontal className="h-4 w-4 text-muted-foreground/60" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border/50 text-center">
              <button
                onClick={() => navigate("/app/purchases/bills")}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                {t("عرض جميع الفواتير", "View all bills")} <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("المشتريات الشهرية", "Monthly Purchases")}</h2>
              <span className="text-xs text-muted-foreground">{t("آخر 6 أشهر", "Last 6 months")}</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t("لا توجد بيانات بعد", "No data yet")}</div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
                    <Bar dataKey="total" fill="#1276E3" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("المصروفات حسب التصنيف", "Expenses by Category")}</h2>
              <span className="text-xs text-muted-foreground">{t("السنة حتى الآن", "Year to date")}</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t("لا توجد بيانات بعد", "No data yet")}</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={(entry: any) => entry.name}
                      labelLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                    >
                      {categoryData.map((s, i) => (
                        <Cell key={i} fill={s.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
