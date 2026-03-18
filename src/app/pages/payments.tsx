import { useState } from "react";
import { Link } from "react-router";
import { CreditCard, Plus, Search, Eye, X, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { contactLink } from "../components/contact-map";

interface Payment { id: string; supplier: string; date: string; amount: string; amountNum: number; method: string; ref: string; }

const paymentsData: Payment[] = [
  { id: "PAY-001", supplier: "شركة المواد الخام", date: "2026-03-01", amount: "15,000", amountNum: 15000, method: "تحويل بنكي", ref: "BILL-2026-001" },
  { id: "PAY-002", supplier: "مؤسسة التوريدات", date: "2026-03-02", amount: "8,500", amountNum: 8500, method: "شيك", ref: "BILL-2026-002" },
  { id: "PAY-003", supplier: "شركة الإمدادات", date: "2026-03-03", amount: "12,000", amountNum: 12000, method: "نقداً", ref: "BILL-2026-003" },
];

export function Payments() {
  const [selected, setSelected] = useState<Payment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = paymentsData.filter((p) => !searchQuery || p.supplier.includes(searchQuery) || p.id.includes(searchQuery));
  const total = paymentsData.reduce((s, p) => s + p.amountNum, 0);

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelected(null)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
          <div>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>سند دفع <span className="font-english">{selected.id}</span></h1>
            <Link to={contactLink(selected.supplier)} className="text-[#6B7280] text-sm hover:text-[#1276E3] hover:underline">{selected.supplier}</Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات السند</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{selected.id}</span></div>
              <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date}</span></div>
              <div><span className="text-[#6B7280]">طريقة الدفع:</span> <span>{selected.method}</span></div>
              <div><span className="text-[#6B7280]">المرجع:</span> <Link to="/purchases/bills" className="font-english text-[#1276E3] hover:underline">{selected.ref}</Link></div>
            </div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المبلغ</h3>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{selected.amount} SR</div>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>سندات الدفع</h1><p className="text-[#6B7280] mt-1">إدارة سندات الدفع للموردين</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />سند دفع جديد</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي المدفوعات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()} SR</div><p className="text-xs text-[#6B7280] mt-1">هذا الشهر</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">عدد السندات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{paymentsData.length}</div><p className="text-xs text-[#6B7280] mt-1">سند دفع</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">متوسط المدفوع</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(total / paymentsData.length).toLocaleString()} SR</div><p className="text-xs text-[#6B7280] mt-1">لكل سند</p></CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة سندات الدفع</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "650px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>رقم السند</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>المورد</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>المبلغ (SR)</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>طريقة الدفع</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "80px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-4"><button onClick={() => setSelected(p)} className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{p.id}</button></td>
                    <td className="py-3.5 pe-4"><Link to={contactLink(p.supplier)} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{p.supplier}</Link></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{p.date}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{p.amount}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm text-[#6B7280]">{p.method}</span></td>
                    <td className="py-3.5"><button onClick={() => setSelected(p)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}