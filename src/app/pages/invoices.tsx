/**
 * Sales Invoices · wired to /api/invoices · org-scoped
 * UX-1: NO modal · NO slide-over. Uses InlinePanel (inline form) + InlineConfirm + Toasts.
 */
import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Trash2, Loader2, FileText, FileSignature } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { InlinePanel } from "../components/inline-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { normalizeDigits } from "../lib/digits";
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

const EMPTY_FORM = {
  contactId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  description: "",
  quantity: "1",
  unitPrice: "",
  notes: "",
};

export function Invoices() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Side-panel state for create + sign capture (NO Dialog)
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [signFor, setSignFor] = useState<Invoice | null>(null);
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Quick-create customer · UX-5 · nested SidePanel
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [quickCust, setQuickCust] = useState({ displayName: "", email: "", phone: "" });
  const [quickCustError, setQuickCustError] = useState<string | null>(null);

  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, contactsRes] = await Promise.all([
        api.invoices.list({ limit: 200 }),
        api.contacts.list({ limit: 200 }),
      ]);
      setItems(invRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
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

  const openCreate = () => { setForm(EMPTY_FORM); setCreateError(null); setCreateOpen(true); };
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); };

  const openQuickCust = () => { setQuickCust({ displayName: "", email: "", phone: "" }); setQuickCustError(null); setQuickCustOpen(true); };
  const closeQuickCust = () => { setQuickCustOpen(false); setQuickCustError(null); };
  const handleQuickCust = async () => {
    setQuickCustError(null);
    if (!quickCust.displayName.trim()) { setQuickCustError("اسم العميل مطلوب"); return; }
    setBusy(true);
    try {
      const c = await api.contacts.create({
        displayName: quickCust.displayName.trim(),
        type: "CUSTOMER",
        email: quickCust.email.trim() || undefined,
        phone: quickCust.phone.trim() || undefined,
      });
      setCustomers((prev) => [c, ...prev]);
      setForm((f) => ({ ...f, contactId: c.id })); // auto-select
      push("success", `تم إنشاء ${c.displayName}`);
      closeQuickCust();
    } catch (e: any) {
      setQuickCustError(e instanceof ApiError ? e.message : "فشل الإنشاء");
    } finally { setBusy(false); }
  };

  // 3-stage workflow: Draft → Approve → Send
  // 'draft' = حفظ كمسودة (always available · default)
  // 'approve' = اعتماد (final commit · enables send · backend will lock edits)
  // 'send' = إرسال (only after approval · triggers email)
  const handleSubmit = async (action: "draft" | "approve" | "send" = "draft") => {
    setCreateError(null);
    if (!form.contactId) { setCreateError("اختر العميل"); return; }
    if (!form.description.trim() || !form.unitPrice) { setCreateError("الوصف والسعر مطلوبان"); return; }
    setBusy(true);
    try {
      // For now: draft always saves as DRAFT · approve+send saves as SENT
      // TODO: when backend supports APPROVED state, map approve → APPROVED, send → SENT
      const status = action === "draft" ? "DRAFT" : "SENT";
      const inv = await api.invoices.create({
        contactId: form.contactId,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status,
        notes: form.notes || null,
        lines: [{
          description: form.description,
          quantity: Number(form.quantity) || 1,
          unitPrice: Number(form.unitPrice),
        }],
      });
      setItems(prev => [inv as Invoice, ...prev]);
      const msg = action === "draft" ? `تم حفظ ${inv.invoiceNumber} كمسودة`
                : action === "approve" ? `تم اعتماد ${inv.invoiceNumber}`
                : `تم إرسال ${inv.invoiceNumber} للعميل`;
      push("success", msg);
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.invoices.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم حذف الفاتورة");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    }
  };

  const openSign = (inv: Invoice) => {
    const customer = customers.find((c) => c.id === inv.contactId);
    setSignFor(inv);
    setSignForm({
      name: customer?.displayName || "",
      email: customer?.email || "",
      message: `يرجى مراجعة وتوقيع الفاتورة رقم ${inv.invoiceNumber}`,
    });
    setSignError(null);
  };
  const closeSign = () => { setSignFor(null); setSignError(null); };

  const handleSignSubmit = async () => {
    if (!signFor) return;
    setSignError(null);
    if (!signForm.email.trim()) { setSignError("البريد الإلكتروني مطلوب"); return; }
    if (!signForm.name.trim()) { setSignError("اسم الموقّع مطلوب"); return; }
    setBusy(true);
    try {
      const r = await api.sign.sendInvoice(signFor.id, {
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer" }],
        message: signForm.message,
        expiresInDays: 30,
      });
      if (r.error) {
        push("error", `حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`);
      } else {
        push("success", `تم إرسال الفاتورة للتوقيع إلى ${signForm.email}`);
        if (signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      closeSign();
    } catch (e: any) {
      setSignError(e instanceof ApiError ? (e.message === "already_pending" ? "يوجد طلب توقيع نشط لهذه الفاتورة" : e.message) : "فشل الإرسال");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المبيعات</h1>
          <p className="text-[#6B7280] mt-1">إدارة فواتير العملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />فاتورة جديدة</Button>
      </div>

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

      {/* Inline create panel · UX-1 inline form (NOT modal · NOT slide-over) */}
      {createOpen && (
        <InlinePanel
          title="فاتورة جديدة"
          description="املأ البيانات الأساسية · يمكنك التعديل لاحقاً"
          onClose={closeCreate}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-[#E5E7EB]">إلغاء</Button>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-[#1276E3] hover:bg-[#0B5FBF]">
                  {busy ? "..." : "حفظ كمسودة"}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("approve")} className="border-[#1276E3] text-[#1276E3] hover:bg-blue-50" title="اعتماد + قفل التعديل">
                  {busy ? "..." : "اعتماد"}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-green-500 text-green-700 hover:bg-green-50" title="إرسال للعميل بالبريد">
                  {busy ? "..." : "اعتماد + إرسال"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

            <div className="space-y-2">
              <Label className="text-[#374151]">العميل *</Label>
              <SearchableCombobox
                value={form.contactId}
                onChange={(id) => setForm({ ...form, contactId: id })}
                onCreate={async (name) => {
                  const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                  setCustomers((prev) => [c, ...prev]);
                  push("success", `تم إنشاء ${c.displayName}`);
                  return c.id;
                }}
                items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                placeholder="اكتب اسم العميل أو ابحث..."
                createLabel={(q) => `+ إنشاء عميل جديد: "${q}"`}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-[#374151]">تاريخ الإصدار *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">تاريخ الاستحقاق *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
            </div>
            <div className="space-y-2"><Label className="text-[#374151]">الوصف *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="استشارة · خدمة · بضاعة ..." className="border-[#E5E7EB]" /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2"><Label className="text-[#374151]">الكمية *</Label>
                <Input type="text" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: normalizeDigits(e.target.value) })} dir="ltr" className="border-[#E5E7EB] font-english" placeholder="1" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">السعر *</Label>
                <Input type="text" inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: normalizeDigits(e.target.value) })} dir="ltr" className="border-[#E5E7EB] font-english" placeholder="0.00" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">ملاحظات</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-[#E5E7EB]" /></div>
            </div>
            <p className="text-xs text-[#6B7280]">💡 احفظ كمسودة أولاً ثم عدّل · أو احفظ وأرسل مباشرة.</p>
          </div>
        </InlinePanel>
      )}

      {/* Inline sign-capture panel */}
      {signFor && (
        <InlinePanel
          title={`إرسال ${signFor.invoiceNumber} للتوقيع`}
          description="DocuSeal · sign.fc.sa"
          onClose={closeSign}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSign} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" disabled={busy} onClick={handleSignSubmit} className="bg-[#1276E3] hover:bg-[#1060C0]">
                <FileSignature className="me-2 h-4 w-4" />{busy ? "..." : "إرسال للتوقيع"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {signError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{signError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>اسم الموقّع *</Label>
                <Input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder="الاسم الكامل" /></div>
              <div className="space-y-2"><Label>البريد الإلكتروني *</Label>
                <Input type="email" value={signForm.email} onChange={(e) => setSignForm({ ...signForm, email: e.target.value })} dir="ltr" className="font-english" placeholder="signer@example.com" /></div>
            </div>
            <div className="space-y-2"><Label>الرسالة المرفقة</Label>
              <textarea value={signForm.message} onChange={(e) => setSignForm({ ...signForm, message: e.target.value })} rows={3} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" /></div>
            <p className="text-xs text-[#6B7280]">سيستلم الموقّع رابطاً عبر البريد لمراجعة الفاتورة وتوقيعها · صلاحية الرابط 30 يوم.</p>
          </div>
        </InlinePanel>
      )}

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
                          <button onClick={() => openSign(i)} className="rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-blue-50 flex items-center gap-1" title="إرسال للتوقيع">
                            <FileSignature className="h-3.5 w-3.5" /> توقيع
                          </button>
                        )}
                        {pendingDelete === i.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(i.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={() => setPendingDelete(i.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
