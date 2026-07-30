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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", RECEIVED: "مستلمة", PAID: "مدفوعة", PARTIAL: "مدفوعة جزئياً",
  OVERDUE: "متأخرة", CANCELLED: "ملغاة",
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

const CATEGORY_COLORS = ["#0B1B49", "#1276E3", "#7DD3E4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export function PurchasesDashboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.dashboard.purchases()); }
    catch (e: any) { setError(humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" })); }
    finally { setLoading(false); }
  }, [language]);
  useEffect(() => { refresh(); }, [refresh]);

  const monthlyData = useMemo(() => {
    const monthly = (data as (Data & { monthly?: Array<{ month: string; total: number }> }) | null)?.monthly;
    if (!monthly) return [];
    return monthly.map((m) => ({
      month: typeof m.month === "string" && m.month.includes("-") ? AR_MONTHS[Number(m.month.split("-")[1]) - 1] : String(m.month),
      total: Number(m.total) || 0,
    }));
  }, [data]);

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
      <span>{error || "تعذّر التحميل"}</span>
      <Button type="button" variant="outline" size="sm" onClick={refresh} className="border-red-300 text-red-700 hover:bg-red-100">
        {language === "en" ? "Retry" : "إعادة المحاولة"}
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المشتريات</h1>
          <p className="text-muted-foreground mt-1 text-sm">نظرة شاملة على مشترياتك ومصروفاتك</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/app/purchases/bills?new=1")} className="bg-primary hover:bg-primary/80">
            <Plus className="me-1 h-4 w-4" /> فاتورة مشتريات
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/expenses?new=1")} className="border-border text-primary">
            <Plus className="me-1 h-4 w-4" /> مصروف
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/payments?new=1")} className="border-border text-primary">
            <Plus className="me-1 h-4 w-4" /> سند صرف
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/reports?type=purchases")} className="border-border text-muted-foreground">
            <Download className="me-1 h-4 w-4" /> تصدير
          </Button>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">عدد الفواتير</span>
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="text-foreground font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.ytd.billCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">إجمالي المشتريات</span>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <div className="text-foreground font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(totalAllTime)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">المصروفات النقدية</span>
              <Receipt className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-amber-600 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(Number(data.ytd.expenses))}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">هذا الشهر</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-green-600 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(Number(data.thisMonth.bills))}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3 insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Trophy className="h-3 w-3 text-amber-500" /> أكبر مورد</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{topSupplier?.name || "—"}</p>
              </div>
              <div className="font-english text-foreground text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">SR</span> {topSupplier ? Number(topSupplier.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-red-500" /> أكثر تأخر</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{mostOverdueSupplier?.contact || "—"}</p>
              </div>
              <div className="font-english text-red-600 text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">SR</span> {mostOverdueSupplier ? Number(mostOverdueSupplier.total).toLocaleString() : "0"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Building2 className="h-3 w-3 text-primary" /> أكثر تصنيف</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{topCategory?.category || "—"}</p>
              </div>
              <div className="font-english text-foreground text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">SR</span> {topCategory ? Number(topCategory.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent bills */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border/50">
            <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>آخر فواتير المشتريات</h2>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="البحث في الفواتير..."
                className="w-64 ps-9 h-9 border-border text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">لا توجد فواتير مشتريات بعد</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs text-muted-foreground">
                  <th className="py-2.5 px-5 text-start" style={{ fontWeight: 600 }}>رقم الفاتورة</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>المورد</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>المبلغ ({cur})</th>
                  <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>الحالة</th>
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
                    <td className="py-3 px-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status] || b.status}</span></td>
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
                عرض جميع الفواتير <ArrowLeft className="h-3.5 w-3.5" />
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
              <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>المشتريات الشهرية</h2>
              <span className="text-xs text-muted-foreground">آخر 6 أشهر</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد</div>
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
              <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>المصروفات حسب التصنيف</h2>
              <span className="text-xs text-muted-foreground">السنة حتى الآن</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد</div>
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
