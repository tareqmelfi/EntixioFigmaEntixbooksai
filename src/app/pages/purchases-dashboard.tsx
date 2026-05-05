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
import { api, ApiError, PurchasesDashboard as Data } from "../lib/api";

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
const STATUS_FILL: Record<string, string> = {
  DRAFT: "#9CA3AF",
  RECEIVED: "#1276E3",
  PAID: "#10B981",
  PARTIAL: "#F59E0B",
  OVERDUE: "#EF4444",
  CANCELLED: "#6B7280",
};

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const CATEGORY_COLORS = ["#0B1B49", "#1276E3", "#7DD3E4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export function PurchasesDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.dashboard.purchases()); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const monthlyData = useMemo(() => {
    if (!data?.monthly) return [];
    return data.monthly.map((m: any) => ({
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

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" /></div>;
  if (error || !data) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "تعذّر التحميل"}</div>;

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
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المشتريات</h1>
          <p className="text-[#6B7280] mt-1 text-sm">نظرة شاملة على مشترياتك ومصروفاتك</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/app/purchases/bills?new=1")} className="bg-[#1276E3] hover:bg-[#0B5FBF]">
            <Plus className="me-1 h-4 w-4" /> فاتورة مشتريات
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/expenses?new=1")} className="border-[#E5E7EB] text-[#1276E3]">
            <Plus className="me-1 h-4 w-4" /> مصروف
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/payments?new=1")} className="border-[#E5E7EB] text-[#1276E3]">
            <Plus className="me-1 h-4 w-4" /> سند صرف
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/reports?type=purchases")} className="border-[#E5E7EB] text-[#6B7280]">
            <Download className="me-1 h-4 w-4" /> تصدير
          </Button>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#6B7280]">عدد الفواتير</span>
              <FileText className="h-4 w-4 text-[#1276E3]" />
            </div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.ytd.billCount}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#6B7280]">إجمالي المشتريات</span>
              <ShoppingCart className="h-4 w-4 text-[#1276E3]" />
            </div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(totalAllTime)}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#6B7280]">المصروفات النقدية</span>
              <Receipt className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-amber-600 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(Number(data.ytd.expenses))}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#6B7280]">هذا الشهر</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-green-600 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(Number(data.thisMonth.bills))}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3 insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5"><Trophy className="h-3 w-3 text-amber-500" /> أكبر مورد</p>
                <p className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>{topSupplier?.name || "—"}</p>
              </div>
              <div className="font-english text-[#0B1B49] text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-[#9CA3AF]">SR</span> {topSupplier ? Number(topSupplier.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-red-500" /> أكثر تأخر</p>
                <p className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>{mostOverdueSupplier?.contact || "—"}</p>
              </div>
              <div className="font-english text-red-600 text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-[#9CA3AF]">SR</span> {mostOverdueSupplier ? Number(mostOverdueSupplier.total).toLocaleString() : "0"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] mb-1 flex items-center gap-1.5"><Building2 className="h-3 w-3 text-[#1276E3]" /> أكثر تصنيف</p>
                <p className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>{topCategory?.category || "—"}</p>
              </div>
              <div className="font-english text-[#0B1B49] text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-[#9CA3AF]">SR</span> {topCategory ? Number(topCategory.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent bills */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-[#F3F4F6]">
            <h2 className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>آخر فواتير المشتريات</h2>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                placeholder="البحث في الفواتير..."
                className="w-64 ps-9 h-9 border-[#E5E7EB] text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6B7280]">لا توجد فواتير مشتريات بعد</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] text-xs text-[#6B7280]">
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
                  <tr key={b.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF] cursor-pointer" onClick={() => navigate(`/app/purchases/bills`)}>
                    <td className="py-3 px-5 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{b.number}</td>
                    <td className="py-3 px-2 text-sm text-[#374151]">{b.contact}</td>
                    <td className="py-3 px-2 font-english text-xs text-[#6B7280]">{b.date}</td>
                    <td className="py-3 px-2 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(b.total).toLocaleString()}</td>
                    <td className="py-3 px-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status] || b.status}</span></td>
                    <td className="py-3 px-2"><MoreHorizontal className="h-4 w-4 text-[#9CA3AF]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-[#F3F4F6] text-center">
              <button
                onClick={() => navigate("/app/purchases/bills")}
                className="text-sm text-[#1276E3] hover:underline inline-flex items-center gap-1"
              >
                عرض جميع الفواتير <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>المشتريات الشهرية</h2>
              <span className="text-xs text-[#6B7280]">آخر 6 أشهر</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#6B7280]">لا توجد بيانات بعد</div>
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
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>المصروفات حسب التصنيف</h2>
              <span className="text-xs text-[#6B7280]">السنة حتى الآن</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#6B7280]">لا توجد بيانات بعد</div>
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
