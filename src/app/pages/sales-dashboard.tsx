/**
 * Sales Dashboard · org-scoped · zero mock
 *
 * Layout (per screenshot 2026-05-05):
 *   1. Hero · title + quick-create buttons (فاتورة · عرض · سند قبض · تصدير)
 *   2. 4 KPI cards · إجمالي الفواتير · إجمالي المبالغ · المحصّل · المتأخر
 *   3. 3 insight cards · أكبر عميل · أكثر تأخر · أكثر كريديت
 *   4. Recent invoices table (5 rows) · عرض الجميع →
 *   5. Bottom charts · توزيع الحالات (donut) · المبيعات الشهرية (bar · last 6 months)
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Loader2, FileText, TrendingUp, AlertTriangle, DollarSign,
  Plus, Download, Trophy, Briefcase, ArrowLeft, Search, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api, ApiError, SalesDashboard as Data } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", SENT: "مرسلة", VIEWED: "مُشاهَدة", PAID: "مدفوعة",
  PARTIAL: "مدفوعة جزئياً", OVERDUE: "متأخرة", CANCELLED: "ملغاة",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-indigo-100 text-indigo-700",
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
const STATUS_FILL: Record<string, string> = {
  DRAFT: "#9CA3AF",
  SENT: "#1276E3",
  VIEWED: "#7DD3E4",
  PAID: "#10B981",
  PARTIAL: "#F59E0B",
  OVERDUE: "#EF4444",
  CANCELLED: "#6B7280",
};

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function SalesDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.dashboard.sales()); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const monthlyData = useMemo(() => {
    const monthly = (data as (Data & { monthly?: Array<{ month: string; total: number }> }) | null)?.monthly;
    if (!monthly) return [];
    return monthly.map((m) => ({
      month: typeof m.month === "string" && m.month.includes("-") ? AR_MONTHS[Number(m.month.split("-")[1]) - 1] : String(m.month),
      total: Number(m.total) || 0,
    }));
  }, [data]);

  const statusData = useMemo(() => {
    if (!data?.byStatus) return [];
    return data.byStatus.map((s) => ({
      name: `${STATUS_LABELS[s.status] || s.status} (${s.count})`,
      value: Number(s.total),
      status: s.status,
    })).filter((s) => s.value > 0);
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "تعذّر التحميل"}</div>;

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${cur} ${n.toLocaleString()}`;
  const filtered = data.recentInvoices.filter((i) => !searchQuery || i.number.includes(searchQuery) || i.contact.includes(searchQuery)).slice(0, 5);

  // Insight cards
  const topCustomer = data.topCustomers[0];
  const overdueInvoices = data.recentInvoices.filter((i) => i.status === "OVERDUE");
  const mostOverdueCustomer = overdueInvoices[0];
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.total), 0);
  const notificationsCount = (data as any).notifications?.unreadCount || 0;

  return (
    <div className="space-y-5">
      {/* Hero · title + actions */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المبيعات</h1>
          <p className="text-muted-foreground mt-1 text-sm">نظرة شاملة على مبيعاتك وفواتيرك</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/app/invoices?new=1")} className="bg-primary hover:bg-primary/80">
            <Plus className="me-1 h-4 w-4" /> فاتورة جديدة
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/quotes?new=1")} className="border-border text-primary">
            <Plus className="me-1 h-4 w-4" /> عرض سعر
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/receipts?new=1")} className="border-border text-primary">
            <Plus className="me-1 h-4 w-4" /> سند قبض
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/reports?type=sales")} className="border-border text-muted-foreground">
            <Download className="me-1 h-4 w-4" /> تصدير
          </Button>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">إجمالي الفواتير</span>
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="text-foreground font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.allTime.count}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">إجمالي المبالغ</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="text-foreground font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(data.allTime.total)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">المحصّل</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-green-600 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(data.allTime.paid)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">المتأخر</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-red-600 font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{fmt(totalOverdue || data.allTime.outstanding)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3 insight cards · top customer · most overdue · most credit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Trophy className="h-3 w-3 text-amber-500" /> أكبر عميل</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{topCustomer?.name || "—"}</p>
              </div>
              <div className="font-english text-foreground text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">SR</span> {topCustomer ? Number(topCustomer.total).toLocaleString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-red-500" /> أكثر تأخر</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{mostOverdueCustomer?.contact || "—"}</p>
              </div>
              <div className="font-english text-red-600 text-sm shrink-0" style={{ fontWeight: 700 }}>
                <span className="text-muted-foreground/60">SR</span> {mostOverdueCustomer ? Number(mostOverdueCustomer.total).toLocaleString() : "0"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Briefcase className="h-3 w-3 text-primary" /> أكثر كريديت</p>
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{data.topCustomers[1]?.name || "—"}</p>
              </div>
              <span className="text-xs text-primary bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                {notificationsCount} إشعارات
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices · 5 rows + view all */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border/50">
            <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>آخر الفواتير</h2>
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
            <div className="p-12 text-center text-sm text-muted-foreground">
              لا توجد فواتير بعد · أنشئ فاتورة من زر "فاتورة جديدة" أعلاه
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <colgroup>
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-muted text-xs text-muted-foreground">
                    <th className="py-2.5 px-5 text-start" style={{ fontWeight: 600 }}>رقم الفاتورة</th>
                    <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>العميل</th>
                    <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                    <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>المبلغ ({cur})</th>
                    <th className="py-2.5 px-2 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="border-t border-border/50 hover:bg-primary/5 cursor-pointer" onClick={() => navigate(`/app/invoices`)}>
                      <td className="py-3 px-5 text-sm text-primary" style={{ fontWeight: 600 }}>
                        <span dir="ltr" className="font-english inline-block" style={{ fontVariantNumeric: "tabular-nums" }}>{i.number}</span>
                      </td>
                      <td className="py-3 px-2 text-sm text-foreground/80">
                        <span className="block whitespace-normal break-words">{i.contact}</span>
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground">
                        <span dir="ltr" className="font-english inline-block" style={{ fontVariantNumeric: "tabular-nums" }}>{i.date}</span>
                      </td>
                      <td className="py-3 px-2 text-sm text-foreground" style={{ fontWeight: 600 }}>
                        <span dir="ltr" className="font-english inline-block" style={{ fontVariantNumeric: "tabular-nums" }}>{Number(i.total).toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[i.status]}`}>{STATUS_LABELS[i.status] || i.status}</span></td>
                      <td className="py-3 px-2"><MoreHorizontal className="h-4 w-4 text-muted-foreground/60" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border/50 text-center">
              <button
                onClick={() => navigate("/app/invoices")}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                عرض جميع الفواتير <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts · status distribution + monthly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>المبيعات الشهرية</h2>
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
                    <Bar dataKey="total" fill="#0B1B49" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>توزيع حالات الفواتير</h2>
              <span className="text-xs text-muted-foreground">حسب الحالة الحالية</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              {statusData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={(entry: any) => entry.name}
                      labelLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                    >
                      {statusData.map((s, i) => (
                        <Cell key={i} fill={STATUS_FILL[s.status] || "#9CA3AF"} />
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
