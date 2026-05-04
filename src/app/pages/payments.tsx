/**
 * سندات الدفع · Payment Vouchers (cash OUT to suppliers)
 * Wired to /api/vouchers?type=PAYMENT
 */
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Eye, X, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, Voucher, ApiError } from "../lib/api";

const METHOD_LABELS: Record<Voucher["paymentMethod"], string> = {
  CASH: "نقداً", BANK_TRANSFER: "تحويل بنكي", CARD: "بطاقة ائتمان",
  STC_PAY: "STC Pay", MADA: "مدى", CHECK: "شيك", OTHER: "أخرى",
};

export function Payments() {
  const [items, setItems] = useState<Voucher[]>([]);
  const [summary, setSummary] = useState({ sumAmount: "0", avgAmount: "0" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "BANK_TRANSFER" as Voucher["paymentMethod"],
    reference: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.vouchers.list({ type: "PAYMENT" });
      setItems(data.items);
      setSummary(data.summary);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(p =>
    !searchQuery || p.number.includes(searchQuery) ||
    (p.contact?.displayName || "").includes(searchQuery) ||
    (p.notes || "").includes(searchQuery)
  );
  const total = Number(summary.sumAmount || 0);
  const avg = Number(summary.avgAmount || 0);

  const resetForm = () => setForm({
    date: new Date().toISOString().slice(0, 10),
    amount: "", paymentMethod: "BANK_TRANSFER", reference: "", notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) { setError("الرجاء إدخال مبلغ صحيح"); return; }
    setBusy(true);
    try {
      const v = await api.vouchers.create({
        type: "PAYMENT", date: form.date, amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        reference: form.reference || null, notes: form.notes || null,
      });
      setItems(prev => [v, ...prev]);
      setOpen(false); resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف سند الدفع؟ سيتم تعديل رصيد الفاتورة المرتبطة.")) return;
    try {
      await api.vouchers.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e: any) { alert(e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelected(null)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>سند دفع <span className="font-english">{selected.number}</span></h1>
              {selected.contact && <p className="text-[#6B7280] text-sm">{selected.contact.displayName}</p>}
            </div>
          </div>
          <Button variant="outline" onClick={() => handleDelete(selected.id)} className="border-red-200 text-red-600 hover:bg-red-50">
            <Trash2 className="me-2 h-4 w-4" /> حذف
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات السند</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{selected.number}</span></div>
              <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date.slice(0, 10)}</span></div>
              <div><span className="text-[#6B7280]">طريقة الدفع:</span> <span>{METHOD_LABELS[selected.paymentMethod]}</span></div>
              {selected.reference && <div><span className="text-[#6B7280]">المرجع:</span> <span className="font-english">{selected.reference}</span></div>}
              {selected.notes && <div className="col-span-2"><span className="text-[#6B7280]">ملاحظات:</span> <span>{selected.notes}</span></div>}
            </div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المبلغ</h3>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{Number(selected.amount).toLocaleString()} {selected.currency}</div>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>سندات الدفع</h1><p className="text-[#6B7280] mt-1">إدارة سندات الدفع للموردين (سند صرف)</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />سند دفع جديد</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB]"><CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي المدفوعات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()} SR</div></CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">عدد السندات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div></CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">متوسط المدفوع</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length ? Math.round(avg).toLocaleString() : 0} SR</div></CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة سندات الدفع</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم السند</th>
              <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المورد</th>
              <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
              <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ (SR)</th>
              <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>طريقة الدفع</th>
              <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجراءات</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="py-8 text-center text-sm text-[#6B7280]">جارٍ التحميل...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-[#6B7280]">لا توجد سندات · اضغط "سند دفع جديد"</td></tr>}
              {!loading && filtered.map(p => (
                <tr key={p.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF] transition-colors">
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{p.number}</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#374151]">{p.contact?.displayName || "—"}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#6B7280]">{p.date.slice(0, 10)}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(p.amount).toLocaleString()}</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#6B7280]">{METHOD_LABELS[p.paymentMethod]}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelected(p)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-[#0B1B49]">سند دفع جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="space-y-2"><Label className="text-[#374151]">التاريخ *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">المبلغ (SR) *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">طريقة الدفع *</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as Voucher["paymentMethod"] })}>
                  <SelectTrigger className="border-[#E5E7EB]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">نقداً</SelectItem>
                    <SelectItem value="BANK_TRANSFER">تحويل بنكي</SelectItem>
                    <SelectItem value="CARD">بطاقة ائتمان</SelectItem>
                    <SelectItem value="MADA">مدى</SelectItem>
                    <SelectItem value="STC_PAY">STC Pay</SelectItem>
                    <SelectItem value="CHECK">شيك</SelectItem>
                    <SelectItem value="OTHER">أخرى</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label className="text-[#374151]">المرجع (اختياري)</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم تحويل / رقم شيك" className="border-[#E5E7EB] font-english" dir="ltr" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">ملاحظات (اختياري)</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-[#E5E7EB]" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
