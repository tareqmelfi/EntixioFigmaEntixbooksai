/**
 * Dashboard · org-scoped financial overview
 * All numbers from /api/dashboard/summary · zero mock data
 */
import { DollarSign, FileText, ShoppingBag, Gauge, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState, useCallback } from "react";
import { api, ApiError, DashboardSummary } from "../lib/api";

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

export function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.dashboard.summary();
      setData(d);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || "تعذّر تحميل بيانات لوحة التحكم"}
      </div>
    );
  }

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString()} ${cur}`;
  const k = data.kpi;
  const isEmpty = k.revenue === 0 && k.expenses === 0 && k.invoiceCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>لوحة التحكم</h1>
          <p className="text-[#6B7280] mt-1">{data.org.name} · <span className="font-english">{cur}</span></p>
        </div>
      </div>

      {isEmpty && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#1276E3]">
          مرحباً بك في {data.org.name}! · لا توجد بيانات بعد · ابدأ بإنشاء فاتورة أو مصروف · أو اضغط <strong>المساعد الذكي</strong> ليساعدك
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <DollarSign className="h-4 w-4" /> إجمالي الإيرادات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(k.revenue)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{k.invoiceCount}</span> فاتورة</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <ShoppingBag className="h-4 w-4" /> المشتريات + المصروفات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(k.purchases + k.expenses)}</div>
            <p className="text-xs text-[#6B7280] mt-1">مشتريات <span className="font-english">{k.purchases.toLocaleString()}</span> + مصروفات <span className="font-english">{k.expenses.toLocaleString()}</span></p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <Gauge className="h-4 w-4" /> ضريبة القيمة المضافة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(Math.abs(k.vatNet))}</div>
            <p className="text-xs mt-1">
              {k.vatNet >= 0 ? <span className="text-amber-600">علينا للهيئة</span> : <span className="text-green-600">لصالحنا (استرداد)</span>}
              {" · "}<span className="font-english">{k.vatOutput.toLocaleString()}</span> مخرجات / <span className="font-english">{k.vatInput.toLocaleString()}</span> مدخلات
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <FileText className="h-4 w-4" /> صافي التدفق النقدي
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(k.receipts - k.payments)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{k.receipts.toLocaleString()}</span> داخل · <span className="font-english">{k.payments.toLocaleString()}</span> خارج</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>الإيرادات مقابل المصروفات</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">آخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF1" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#1276E3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#0B1B49" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend items={[{ label: "إيرادات", color: "#1276E3" }, { label: "مصروفات", color: "#0B1B49" }]} />
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>التدفق النقدي</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">القبض والصرف · آخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.cashFlowTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF1" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }} />
                <Line type="monotone" dataKey="in" stroke="#179FC5" strokeWidth={2} />
                <Line type="monotone" dataKey="out" stroke="#0B1B49" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <ChartLegend items={[{ label: "تدفق داخل", color: "#179FC5", type: "line" }, { label: "تدفق خارج", color: "#0B1B49", type: "line" }]} />
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">عدد العملاء/الموردين</div>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.contactCount}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">فواتير متأخرة</div>
            <div className={`font-english ${k.overdueCount > 0 ? "text-red-600" : "text-[#0B1B49]"}`} style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.overdueCount}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">إجمالي القبض</div>
            <div className="font-english text-green-600" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.receipts.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">إجمالي الصرف</div>
            <div className="font-english text-amber-600" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.payments.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
