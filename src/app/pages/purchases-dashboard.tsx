/**
 * Purchases Dashboard · org-scoped · zero mock
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, ShoppingCart, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
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

export function PurchasesDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.dashboard.purchases()); }
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
      <div>
        <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>لوحة المشتريات</h1>
        <p className="text-[#6B7280] mt-1">{data.org.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm"><ShoppingCart className="h-4 w-4" /> فواتير هذا الشهر</CardDescription></CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.thisMonth.bills)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{data.thisMonth.billCount}</span> فاتورة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="text-[#6B7280] text-sm">فواتير المشتريات (السنة)</CardDescription></CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.ytd.bills)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{data.ytd.billCount}</span> فاتورة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="text-[#6B7280] text-sm">المصروفات النقدية (السنة)</CardDescription></CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.ytd.expenses)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{data.ytd.expenseCount}</span> مصروف</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm"><FileText className="h-4 w-4" /> إجمالي السنة</CardDescription></CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(data.ytd.total)}</div>
            <p className="text-xs text-[#6B7280] mt-1">فواتير + مصروفات</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>المصروفات حسب التصنيف</CardTitle></CardHeader>
          <CardContent>
            {data.expensesByCategory.length === 0 ? <p className="text-sm text-[#6B7280] py-8 text-center">لا توجد مصروفات بعد</p> : (
              <div className="space-y-2">
                {data.expensesByCategory.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between text-sm">
                    <span className="text-[#0B1B49]">{cat.category}</span>
                    <span className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{fmt(cat.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}><Building2 className="h-4 w-4 inline me-2" />أكبر الموردين (السنة)</CardTitle></CardHeader>
          <CardContent>
            {data.topSuppliers.length === 0 ? <p className="text-sm text-[#6B7280] py-8 text-center">لا توجد بيانات</p> : (
              <div className="space-y-2">
                {data.topSuppliers.map((s, i) => (
                  <div key={s.contactId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3"><span className="font-english text-[#9CA3AF] w-6">#{i + 1}</span><span className="text-[#0B1B49]">{s.name}</span></div>
                    <span className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>{fmt(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader><CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>آخر 10 فواتير مشتريات</CardTitle></CardHeader>
        <CardContent>
          {data.recentBills.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-8 text-center">لا توجد فواتير مشتريات بعد · أنشئ من <a href="/app/purchases/bills" className="text-[#1276E3] hover:underline">صفحة المشتريات</a></p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>الرقم</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>المورد</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-2 px-2 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
              </tr></thead>
              <tbody>
                {data.recentBills.map((b) => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-2 px-2 font-english text-[#1276E3] text-sm">{b.number}</td>
                    <td className="py-2 px-2 text-sm text-[#374151]">{b.contact}</td>
                    <td className="py-2 px-2 font-english text-xs text-[#6B7280]">{b.date}</td>
                    <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status] || b.status}</span></td>
                    <td className="py-2 px-2 font-english text-sm" style={{ fontWeight: 600 }}>{fmt(b.total)}</td>
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
