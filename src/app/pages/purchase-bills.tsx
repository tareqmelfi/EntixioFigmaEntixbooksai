/**
 * Purchase Bills · wired to /api/bills · org-scoped
 */
import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Eye, Trash2, Loader2, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, Contact } from "../lib/api";

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

export function PurchaseBills() {
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contactId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRateId: "",
    notes: "",
  });
  const [taxRates, setTaxRates] = useState<{ id: string; name: string; rate: string }[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [bills, contactsRes] = await Promise.all([
        api.bills.list(),
        api.contacts.list({ limit: 200 }),
      ]);
      setItems(bills.items);
      setSuppliers(contactsRes.items.filter(c => c.type === "SUPPLIER" || c.type === "BOTH"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(b =>
    !searchQuery || b.billNumber.includes(searchQuery) ||
    (b.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, b) => s + Number(b.total), 0);

  const resetForm = () => setForm({
    contactId: "", issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: "", quantity: "1", unitPrice: "", taxRateId: "", notes: "",
  });

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.contactId) { setError("اختر المورد"); return; }
    if (!form.description.trim() || !form.unitPrice) { setError("الوصف والسعر مطلوبان"); return; }
    setBusy(true);
    try {
      const b = await api.bills.create({
        contactId: form.contactId,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: "DRAFT",
        notes: form.notes || null,
        lines: [{
          description: form.description,
          quantity: Number(form.quantity) || 1,
          unitPrice: Number(form.unitPrice),
          taxRateId: form.taxRateId || null,
        }],
      });
      setItems(prev => [b, ...prev]);
      setOpen(false); resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("هل تريد حذف الفاتورة؟") — replace with InlineConfirm */ 
try {
      await api.bills.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المشتريات</h1>
          <p className="text-[#6B7280] mt-1">إدارة فواتير الموردين</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={handleOpen}><Plus className="me-2 h-4 w-4" />فاتورة مشتريات جديدة</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي المشتريات</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">عدد الفواتير</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">متأخرة</div>
          <div className="font-english text-red-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.filter(b => b.status === "OVERDUE").length}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة فواتير المشتريات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><ShoppingBag className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد فواتير مشتريات بعد</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرقم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>المورد</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاستحقاق</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{b.billNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{b.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{b.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{b.dueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status] || b.status}</span></td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(b.total).toLocaleString()} {b.currency}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-[#0B1B49] text-lg font-semibold">فاتورة مشتريات جديدة</h2></div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="space-y-2"><Label className="text-[#374151]">المورد *</Label>
                <Select value={form.contactId} onValueChange={(v) => setForm({ ...form, contactId: v })}>
                  <SelectTrigger className="border-[#E5E7EB]"><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 && <div className="px-3 py-2 text-xs text-[#6B7280]">لا يوجد موردين · أضف من صفحة العملاء/الموردين</div>}
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">تاريخ الفاتورة *</Label>
                  <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">تاريخ الاستحقاق *</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">الوصف *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مواد خام · لوازم مكتبية ..." required className="border-[#E5E7EB]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الكمية *</Label>
                  <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">السعر *</Label>
                  <Input type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">ملاحظات</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-[#E5E7EB]" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ كمسودة"}</Button>
            </div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
