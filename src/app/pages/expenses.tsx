import { useState } from "react";
import { Link } from "react-router";
import { Receipt, Plus, Search, Eye, X, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

interface Expense { id: string; category: string; date: string; amount: string; amountNum: number; method: string; account: string; }

const expensesData: Expense[] = [
  { id: "EXP-001", category: "إيجار المكتب", date: "2026-03-01", amount: "5,000", amountNum: 5000, method: "تحويل بنكي", account: "5003 الإيجار" },
  { id: "EXP-002", category: "كهرباء وماء", date: "2026-03-02", amount: "1,200", amountNum: 1200, method: "نقداً", account: "5004 المرافق" },
  { id: "EXP-003", category: "صيانة", date: "2026-03-03", amount: "800", amountNum: 800, method: "نقداً", account: "5005 الصيانة" },
];

export function Expenses() {
  const [selected, setSelected] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    date: "",
    amount: "",
    method: "نقداً",
    account: "5006 مصاريف إدارية"
  });

  const filtered = expensesData.filter((e) => !searchQuery || e.category.includes(searchQuery) || e.id.includes(searchQuery));
  const total = expensesData.reduce((s, e) => s + e.amountNum, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Expense:", formData);
    setIsDialogOpen(false);
    setFormData({ category: "", date: "", amount: "", method: "نقداً", account: "5006 مصاريف إدارية" });
  };

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
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setIsDialogOpen(true)}><Plus className="me-2 h-4 w-4" />مصروف جديد</Button>
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التصنيف</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الطريقة</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF] transition-colors">
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{e.id}</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#374151]">{e.category}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#6B7280]">{e.date}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{e.amount} SR</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#6B7280]">{e.method}</span></td>
                  <td className="py-3 px-4">
                    <button onClick={() => setSelected(e)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><Eye className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Dialog for New Expense */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#0B1B49]">مصروف جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-[#374151]">التصنيف *</Label>
                <Input
                  id="category"
                  placeholder="مثال: إيجار المكتب"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-[#374151]">التاريخ *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="border-[#E5E7EB] font-english"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-[#374151]">المبلغ (SR) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="border-[#E5E7EB] font-english"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method" className="text-[#374151]">طريقة الدفع *</Label>
                <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                  <SelectTrigger className="border-[#E5E7EB]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نقداً">نقداً</SelectItem>
                    <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                    <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                    <SelectItem value="شيك">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account" className="text-[#374151]">حساب المصروف *</Label>
                <Select value={formData.account} onValueChange={(value) => setFormData({ ...formData, account: value })}>
                  <SelectTrigger className="border-[#E5E7EB]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5003 الإيجار">5003 - الإيجار</SelectItem>
                    <SelectItem value="5004 المرافق">5004 - المرافق</SelectItem>
                    <SelectItem value="5005 الصيانة">5005 - الصيانة</SelectItem>
                    <SelectItem value="5006 مصاريف إدارية">5006 - مصاريف إدارية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" className="bg-[#1276E3] hover:bg-[#1060C0]">
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}