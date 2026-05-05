/**
 * Quotes (عروض الأسعار) · wired to /api/quotes · with convert-to-invoice
 */
import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Trash2, Loader2, FileText, ArrowLeftRight, FileSignature } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, ApiError, Quote, Contact } from "../lib/api";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", SENT: "مرسل", VIEWED: "مُشاهَد", ACCEPTED: "مقبول",
  REJECTED: "مرفوض", CONVERTED: "محوّل لفاتورة", EXPIRED: "منتهي",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-amber-100 text-amber-700",
  VIEWED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CONVERTED: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

export function Quotes() {
  const [items, setItems] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contactId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    description: "",
    quantity: "1",
    unitPrice: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [quotesRes, contactsRes] = await Promise.all([
        api.quotes.list(),
        api.contacts.list({ limit: 200 }),
      ]);
      setItems(quotesRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(q =>
    !searchQuery || q.quoteNumber.includes(searchQuery) ||
    (q.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, q) => s + Number(q.total), 0);
  const accepted = items.filter(q => q.status === "ACCEPTED").length;
  const pending = items.filter(q => q.status === "SENT" || q.status === "VIEWED").length;

  const resetForm = () => setForm({
    contactId: "", issueDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    description: "", quantity: "1", unitPrice: "", notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.contactId) { setError("اختر العميل"); return; }
    if (!form.description.trim() || !form.unitPrice) { setError("الوصف والسعر مطلوبان"); return; }
    setBusy(true);
    try {
      const q = await api.quotes.create({
        contactId: form.contactId,
        issueDate: form.issueDate,
        validUntil: form.validUntil,
        status: "DRAFT",
        notes: form.notes || null,
        lines: [{
          description: form.description,
          quantity: Number(form.quantity) || 1,
          unitPrice: Number(form.unitPrice),
        }],
      });
      setItems(prev => [q, ...prev]);
      setOpen(false); resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف عرض السعر؟")) return;
    try {
      await api.quotes.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { alert(e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  const handleConvert = async (q: Quote) => {
    if (!confirm(`تحويل ${q.quoteNumber} إلى فاتورة؟ سيتم إنشاء فاتورة جديدة بنفس البنود.`)) return;
    try {
      const r = await api.quotes.convertToInvoice(q.id);
      alert(`✅ تم إنشاء الفاتورة ${r.invoice.invoiceNumber}`);
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "CONVERTED", convertedInvoiceId: r.invoice.id } : x));
    } catch (e: any) {
      alert(e instanceof ApiError ? (e.message === "already_converted" ? "هذا العرض محوّل سابقاً" : e.message) : "فشل التحويل");
    }
  };

  const handleSendForSignature = async (q: Quote) => {
    const customer = customers.find((c) => c.id === q.contactId);
    const defaultEmail = customer?.email || "";
    const email = prompt(`إرسال عرض السعر ${q.quoteNumber} للتوقيع · أدخل بريد الموقّع:`, defaultEmail);
    if (!email) return;
    const name = prompt("اسم الموقّع:", customer?.displayName || "") || email;
    try {
      const r = await api.sign.sendQuote(q.id, {
        signers: [{ name, email, role: "Customer" }],
        message: `يرجى مراجعة وتوقيع عرض السعر رقم ${q.quoteNumber}`,
        expiresInDays: 30,
      });
      if (r.error) {
        alert(`⚠️ تم حفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`);
      } else {
        alert(`✅ تم إرسال عرض السعر للتوقيع إلى ${email}\n\nرابط متابعة: ${r.docuseal?.embed_src || "تم الإرسال بالبريد"}`);
        if (q.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "SENT" } : x));
        }
      }
    } catch (e: any) {
      alert(e instanceof ApiError ? (e.message === "already_pending" ? "يوجد طلب توقيع نشط لهذا العرض" : e.message) : "فشل الإرسال");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>عروض الأسعار</h1>
          <p className="text-[#6B7280] mt-1">إدارة عروض الأسعار للعملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />عرض سعر جديد</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي العروض</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">معلقة (في انتظار الرد)</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{pending}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">مقبولة</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{accepted}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">القيمة الإجمالية</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة العروض</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد عروض أسعار بعد</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>رقم العرض</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>العميل</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>صالح حتى</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{q.quoteNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{q.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{q.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{q.validUntil?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(q.total).toLocaleString()} {q.currency}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status] || q.status}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {q.status !== "CONVERTED" && q.status !== "REJECTED" && (
                          <button onClick={() => handleSendForSignature(q)} className="rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-blue-50 flex items-center gap-1" title="إرسال للتوقيع">
                            <FileSignature className="h-3.5 w-3.5" /> توقيع
                          </button>
                        )}
                        {q.status !== "CONVERTED" && (
                          <button onClick={() => handleConvert(q)} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1" title="تحويل لفاتورة">
                            <ArrowLeftRight className="h-3.5 w-3.5" /> تحويل
                          </button>
                        )}
                        <button onClick={() => handleDelete(q.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
          <DialogHeader><DialogTitle className="text-[#0B1B49]">عرض سعر جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit}>
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
                <div className="space-y-2"><Label className="text-[#374151]">تاريخ العرض *</Label>
                  <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">صالح حتى *</Label>
                  <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">الوصف *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="استشارة تقنية · تطوير برمجي ..." required className="border-[#E5E7EB]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الكمية *</Label>
                  <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">السعر *</Label>
                  <Input type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">ملاحظات</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-[#E5E7EB]" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ كمسودة"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
