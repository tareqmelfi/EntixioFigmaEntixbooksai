/**
 * Sales Invoices · wired to /api/invoices · org-scoped · simple list+create
 * Note: complex 105KB editor replaced with simpler form for V0.3.
 * Full ZATCA-compliant invoice editor coming in Sprint 3 (with multi-line · VAT · QR).
 */
import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Trash2, Loader2, FileText, FileSignature } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, ApiError, Invoice, Contact } from "../lib/api";

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

export function Invoices() {
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contactId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: "",
    quantity: "1",
    unitPrice: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [invRes, contactsRes] = await Promise.all([
        api.invoices.list({ limit: 200 }),
        api.contacts.list({ limit: 200 }),
      ]);
      setItems(invRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(i => {
    if (filterStatus !== "ALL" && i.status !== filterStatus) return false;
    if (searchQuery) return i.invoiceNumber.includes(searchQuery) || (i.contact?.displayName || "").includes(searchQuery);
    return true;
  });

  const total = items.reduce((s, i) => s + Number(i.total), 0);
  const paid = items.reduce((s, i) => s + Number(i.amountPaid || 0), 0);
  const outstanding = total - paid;

  const counts = items.reduce((acc: Record<string, number>, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const resetForm = () => setForm({
    contactId: "", issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: "", quantity: "1", unitPrice: "", notes: "",
  });

  const handleSubmit = async (e: React.FormEvent, sendImmediately = false) => {
    e.preventDefault();
    setError(null);
    if (!form.contactId) { setError("اختر العميل"); return; }
    if (!form.description.trim() || !form.unitPrice) { setError("الوصف والسعر مطلوبان"); return; }
    setBusy(true);
    try {
      const inv = await api.invoices.create({
        contactId: form.contactId,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: sendImmediately ? "SENT" : "DRAFT",
        notes: form.notes || null,
        lines: [{
          description: form.description,
          quantity: Number(form.quantity) || 1,
          unitPrice: Number(form.unitPrice),
        }],
      });
      setItems(prev => [inv, ...prev]);
      setOpen(false); resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف الفاتورة؟")) return;
    try {
      await api.invoices.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { alert(e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  const handleSendForSignature = async (inv: Invoice) => {
    const customer = customers.find((c) => c.id === inv.contactId);
    const defaultEmail = customer?.email || "";
    const email = prompt(`إرسال الفاتورة ${inv.invoiceNumber} للتوقيع · أدخل بريد الموقّع:`, defaultEmail);
    if (!email) return;
    const name = prompt("اسم الموقّع:", customer?.displayName || "") || email;
    try {
      const r = await api.sign.sendInvoice(inv.id, {
        signers: [{ name, email, role: "Customer" }],
        message: `يرجى مراجعة وتوقيع الفاتورة رقم ${inv.invoiceNumber}`,
        expiresInDays: 30,
      });
      if (r.error) {
        alert(`⚠️ تم حفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`);
      } else {
        alert(`✅ تم إرسال الفاتورة للتوقيع إلى ${email}`);
        if (inv.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === inv.id ? { ...x, status: "SENT" } : x));
        }
      }
    } catch (e: any) {
      alert(e instanceof ApiError ? (e.message === "already_pending" ? "يوجد طلب توقيع نشط لهذه الفاتورة" : e.message) : "فشل الإرسال");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المبيعات</h1>
          <p className="text-[#6B7280] mt-1">إدارة فواتير العملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />فاتورة جديدة</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي الفواتير</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">المُحصَّل</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{paid.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">المستحق</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{outstanding.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">عدد الفواتير</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-[#0B1B49]">قائمة الفواتير</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 border-[#E5E7EB] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">الكل · {items.length}</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([s, label]) => (
                    <SelectItem key={s} value={s}>{label} · {counts[s] || 0}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-56 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد فواتير</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرقم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>العميل</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاستحقاق</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>المتبقي</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{i.invoiceNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{i.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{i.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{i.dueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[i.status]}`}>{STATUS_LABELS[i.status] || i.status}</span></td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(i.total).toLocaleString()} {i.currency}</td>
                    <td className="py-3 px-4 font-english text-sm text-amber-600" style={{ fontWeight: 600 }}>{(Number(i.total) - Number(i.amountPaid || 0)).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {i.status !== "PAID" && i.status !== "CANCELLED" && (
                          <button onClick={() => handleSendForSignature(i)} className="rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-blue-50 flex items-center gap-1" title="إرسال للتوقيع">
                            <FileSignature className="h-3.5 w-3.5" /> توقيع
                          </button>
                        )}
                        <button onClick={() => handleDelete(i.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle className="text-[#0B1B49]">فاتورة جديدة</DialogTitle></DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, false)}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="space-y-2"><Label className="text-[#374151]">العميل *</Label>
                <Select value={form.contactId} onValueChange={(v) => setForm({ ...form, contactId: v })}>
                  <SelectTrigger className="border-[#E5E7EB]"><SelectValue placeholder="اختر عميل..." /></SelectTrigger>
                  <SelectContent>
                    {customers.length === 0 && <div className="px-3 py-2 text-xs text-[#6B7280]">لا يوجد عملاء · أضف من صفحة العملاء/الموردين</div>}
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">تاريخ الإصدار *</Label>
                  <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">تاريخ الاستحقاق *</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">الوصف *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="استشارة · خدمة · بضاعة ..." required className="border-[#E5E7EB]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الكمية *</Label>
                  <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">السعر *</Label>
                  <Input type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">ملاحظات</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-[#E5E7EB]" /></div>
              <p className="text-xs text-[#6B7280]">💡 يمكنك حفظ كمسودة أولاً ثم تعديلها · وعند الجاهزية اضغط "حفظ وإرسال".</p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="submit" disabled={busy} variant="outline" className="border-[#E5E7EB]">{busy ? "..." : "حفظ كمسودة"}</Button>
              <Button type="button" disabled={busy} onClick={(e) => handleSubmit(e as any, true)} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "..." : "حفظ وإرسال"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
