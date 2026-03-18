import { useState } from "react";
import { Link } from "react-router";
import { Receipt, Plus, Search, Eye, X, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

interface Expense { id: string; category: string; date: string; amount: string; amountNum: number; method: string; account: string; }

const expensesData: Expense[] = [
  { id: "EXP-001", category: "إيجار المكتب", date: "2026-03-01", amount: "5,000", amountNum: 5000, method: "تحويل بنكي", account: "5003 الإيجار" },
  { id: "EXP-002", category: "كهرباء وماء", date: "2026-03-02", amount: "1,200", amountNum: 1200, method: "نقداً", account: "5004 المرافق" },
  { id: "EXP-003", category: "صيانة", date: "2026-03-03", amount: "800", amountNum: 800, method: "نقداً", account: "5005 الصيانة" },
];

export function Expenses() {
  const [selected, setSelected] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = expensesData.filter((e) => !searchQuery || e.category.includes(searchQuery) || e.id.includes(searchQuery));
  const total = expensesData.reduce((s, e) => s + e.amountNum, 0);

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelected(null)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
          <div>
            <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>مصروف <span className="font-english">{selected.id}</span></h1>
            <p className="text-[#6B7280] text-sm">{selected.category}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات المصروف</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{selected.id}</span></div>
              <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date}</span></div>
              <div><span className="text-[#6B7280]">التصنيف:</span> <span>{selected.category}</span></div>
              <div><span className="text-[#6B7280]">طريقة الدفع:</span> <span>{selected.method}</span></div>
              <div><span className="text-[#6B7280]">الحساب:</span> <Link to="/app/chart-of-accounts" className="text-[#1276E3] hover:underline">{selected.account}</Link></div>
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
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المصروفات النقدية</h1><p className="text-[#6B7280] mt-1">إدارة المصروفات اليومية</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />مصروف جديد</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()} SR</div><p className="text-xs text-[#6B7280] mt-1">هذا الشهر</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">عدد المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{expensesData.length}</div><p className="text-xs text-[#6B7280] mt-1">مصروف</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">متوسط المصروف</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(total / expensesData.length).toLocaleString()} SR</div><p className="text-xs text-[#6B7280] mt-1">لكل مصروف</p></CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة المصروفات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "600px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>رقم المصروف</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>التصنيف</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>التاريخ</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>المبلغ (SR)</th>
                  <th className="py-2.5 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "100px" }}>طريقة الدفع</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "80px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-4"><button onClick={() => setSelected(expense)} className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{expense.id}</button></td>
                    <td className="py-3.5 pe-4"><span className="text-sm text-[#374151]">{expense.category}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{expense.date}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{expense.amount}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm text-[#6B7280]">{expense.method}</span></td>
                    <td className="py-3.5"><button onClick={() => setSelected(expense)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button></td>
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