import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Receipt, Plus, Search, Eye, X, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, Expense as ApiExpense, ExpenseInput, ApiError } from "../lib/api";

const PAYMENT_METHOD_LABELS: Record<ApiExpense["paymentMethod"], string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CARD: "بطاقة ائتمان",
  STC_PAY: "STC Pay",
  MADA: "مدى",
  CHECK: "شيك",
  OTHER: "أخرى",
};

export function Expenses() {
  const [items, setItems] = useState<ApiExpense[]>([]);
  const [summary, setSummary] = useState<{ sumTotal: string; avgTotal: string }>({ sumTotal: "0", avgTotal: "0" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<ApiExpense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "CASH" as ApiExpense["paymentMethod"],
    description: "",
    vendorName: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.expenses.list({ limit: 200 });
      setItems(data.items);
      setSummary(data.summary);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل تحميل المصروفات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter((e) =>
    !searchQuery
      || e.category.includes(searchQuery)
      || e.number.includes(searchQuery)
      || (e.description || "").includes(searchQuery)
      || (e.vendorName || "").includes(searchQuery)
  );
  const total = Number(summary.sumTotal || 0);
  const avg = Number(summary.avgTotal || 0);

  const resetForm = () => setFormData({
    category: "", date: new Date().toISOString().slice(0, 10),
    amount: "", paymentMethod: "CASH", description: "", vendorName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.category.trim() || !formData.amount || Number(formData.amount) <= 0) {
      setError("الرجاء تعبئة التصنيف والمبلغ");
      return;
    }
    setBusy(true);
    try {
      const input: ExpenseInput = {
        date: formData.date,
        category: formData.category.trim(),
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        description: formData.description || null,
        vendorName: formData.vendorName || null,
      };
      const created = await api.expenses.create(input);
      setItems(prev => [created, ...prev]);
      setSummary(s => ({
        sumTotal: String(Number(s.sumTotal) + Number(created.total)),
        avgTotal: String((Number(s.sumTotal) + Number(created.total)) / (items.length + 1)),
      }));
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? `${e.message}: ${e.detail || ""}` : "فشل حفظ المصروف");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("هل أنت متأكد من حذف هذا المصروف؟") — replace with InlineConfirm */ 
try {
      await api.expenses.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e: any) {
      console.warn("[toast]", e instanceof ApiError ? e.message : "فشل الحذف");
    }
  };

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelected(null)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>مصروف <span className="font-english">{selected.number}</span></h1>
              <p className="text-[#6B7280] text-sm">{selected.category}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => handleDelete(selected.id)} className="border-red-200 text-red-600 hover:bg-red-50">
            <Trash2 className="me-2 h-4 w-4" /> حذف
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات المصروف</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{selected.number}</span></div>
              <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date.slice(0, 10)}</span></div>
              <div><span className="text-[#6B7280]">التصنيف:</span> <span>{selected.category}</span></div>
              <div><span className="text-[#6B7280]">طريقة الدفع:</span> <span>{PAYMENT_METHOD_LABELS[selected.paymentMethod]}</span></div>
              {selected.vendorName && <div><span className="text-[#6B7280]">المورد:</span> <span>{selected.vendorName}</span></div>}
              {selected.description && <div className="col-span-2"><span className="text-[#6B7280]">الوصف:</span> <span>{selected.description}</span></div>}
            </div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المبلغ</h3>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{Number(selected.total).toLocaleString()} {selected.currency}</div>
            {Number(selected.taxAmount) > 0 && (
              <p className="text-xs text-[#6B7280]">شامل ضريبة <span className="font-english">{Number(selected.taxAmount).toLocaleString()}</span></p>
            )}
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
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()} SR</div><p className="text-xs text-[#6B7280] mt-1">إجمالي</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">عدد المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div><p className="text-xs text-[#6B7280] mt-1">مصروف</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">متوسط المصروف</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length ? Math.round(avg).toLocaleString() : 0} SR</div><p className="text-xs text-[#6B7280] mt-1">لكل مصروف</p></CardContent>
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
              {loading && <tr><td colSpan={6} className="py-8 text-center text-[#6B7280] text-sm">جارٍ التحميل...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-[#6B7280] text-sm">لا توجد مصروفات · اضغط "مصروف جديد" لإضافة أول مصروف</td></tr>
              )}
              {!loading && filtered.map((e) => (
                <tr key={e.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF] transition-colors">
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{e.number}</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#374151]">{e.category}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#6B7280]">{e.date.slice(0, 10)}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(e.total).toLocaleString()} SR</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#6B7280]">{PAYMENT_METHOD_LABELS[e.paymentMethod]}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelected(e)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(e.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top-level error banner */}
      {error && !isDialogOpen && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Dialog for New Expense */}
      <SidePanel open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <div className="mb-3">
            <h2 className="text-[#0B1B49] text-lg font-semibold">مصروف جديد</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
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
                  step="0.01"
                  min="0"
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
                <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v as ApiExpense["paymentMethod"] })}>
                  <SelectTrigger className="border-[#E5E7EB]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">نقداً</SelectItem>
                    <SelectItem value="BANK_TRANSFER">تحويل بنكي</SelectItem>
                    <SelectItem value="CARD">بطاقة ائتمان</SelectItem>
                    <SelectItem value="MADA">مدى</SelectItem>
                    <SelectItem value="STC_PAY">STC Pay</SelectItem>
                    <SelectItem value="CHECK">شيك</SelectItem>
                    <SelectItem value="OTHER">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorName" className="text-[#374151]">المورد / الجهة (اختياري)</Label>
                <Input
                  id="vendorName"
                  placeholder="مثال: شركة الكهرباء"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[#374151]">ملاحظات (اختياري)</Label>
                <Input
                  id="description"
                  placeholder=""
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="border-[#E5E7EB]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-[#E5E7EB]">
                إلغاء
              </Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </div>
          </form>
        </SidePanel>
    </div>
  );
}