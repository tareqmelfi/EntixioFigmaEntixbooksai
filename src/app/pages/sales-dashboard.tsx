/**
 * Sales Dashboard · org-scoped · zero mock
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, FileText, TrendingUp, Users, Plus, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, SalesDashboard as Data } from "../lib/api";

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

export function SalesDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.dashboard.sales()); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" /></div>;
  if (error || !data) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "تعذّر التحميل"}</div>;

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString()} ${cur}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>لوحة المبيعات</h1>
          <p className="text-[#6B7280] mt-1">نظرة شاملة على مبيعاتك وفواتيرك</p>
        </div>
        {/* Quick-create row · always visible */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/app/invoices?new=1")} className="bg-[#1276E3] hover:bg-[#0B5FBF]">
            <Plus className="me-1 h-4 w-4" /> فاتورة جديدة
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/quotes?new=1")} className="border-[#E5E7EB] text-[#1276E3]">
            <Plus className="me-1 h-4 w-4" /> عرض سعر
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/receipts?new=1")} className="border-[#E5E7EB] text-[#1276E3]">
            <Plus className="me-1 h-4 w-4" /> سند قبض
          </Button>
          <Button variant="outline" className="border-[#E5E7EB] text-[#6B7280]">
            <Download className="me-1 h-4 w-4" /> تصدير
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm"><TrendingUp className="h-4 w-4" /> هذا الشهر</CardDescription></CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.thisMonth.total)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{data.thisMonth.count}</span> فاتورة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="text-[#6B7280] text-sm">السنة حتى الآن</CardDescription></CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.ytd.total)}</div>
            <p className="text-xs text-[#6B7280] mt-1">مدفوع: <span className="font-english">{data.ytd.paid.toLocaleString()}</span></p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="text-[#6B7280] text-sm">المستحق غير المدفوع</CardDescription></CardHeader>
          <CardContent><div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.allTime.outstanding)}</div></CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm"><FileText className="h-4 w-4" /> إجمالي الفواتير</CardDescription></CardHeader>
          <CardContent><div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{data.allTime.count}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>توزيع الفواتير حسب الحالة</CardTitle></CardHeader>
          <CardContent>
            {data.byStatus.length === 0 ? <p className="text-sm text-[#6B7280] py-8 text-center">لا توجد فواتير بعد</p> : (
              <div className="space-y-2">
                {data.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[s.status] || "bg-gray-100"}`}>{STATUS_LABELS[s.status] || s.status}</span>
                      <span className="font-english text-[#6B7280]">{s.count}</span>
                    </div>
                    <span className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{fmt(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}><Users className="h-4 w-4 inline me-2" />أكبر العملاء (السنة)</CardTitle></CardHeader>
          <CardContent>
            {data.topCustomers.length === 0 ? <p className="text-sm text-[#6B7280] py-8 text-center">لا توجد بيانات بعد</p> : (
              <div className="space-y-2">
                {data.topCustomers.map((c, i) => (
                  <div key={c.contactId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3"><span className="font-english text-[#9CA3AF] w-6">#{i + 1}</span><span className="text-[#0B1B49]">{c.name}</span></div>
                    <span className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>آخر 10 فواتير</CardTitle></CardHeader>
        <CardContent>
          {data.recentInvoices.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-8 text-center">لا توجد فواتير بعد · أنشئ فاتورة من <a href="/app/invoices" className="text-[#1276E3] hover:underline">صفحة الفواتير</a></p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>الرقم</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>العميل</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
              </tr></thead>
              <tbody>
                {data.recentInvoices.map((i) => (
                  <tr key={i.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-2 px-2 font-english text-[#1276E3] text-sm">{i.number}</td>
                    <td className="py-2 px-2 text-sm text-[#374151]">{i.contact}</td>
                    <td className="py-2 px-2 font-english text-xs text-[#6B7280]">{i.date}</td>
                    <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[i.status]}`}>{STATUS_LABELS[i.status]}</span></td>
                    <td className="py-2 px-2 font-english text-sm" style={{ fontWeight: 600 }}>{fmt(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
