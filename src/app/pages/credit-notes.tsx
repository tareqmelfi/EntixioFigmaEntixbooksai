/**
 * Credit Notes (الإشعارات الدائنة) · UI-first build · backend wired via /api/credit-notes (when ready)
 * Falls back to filtered invoices with status=CANCELLED until dedicated API ships.
 *
 * Per طارق: build out from coming-soon · لا تخلي صفحة فاضية
 *
 * Pattern: same FullPageForm + ItemsTable + SearchableCombobox as invoices/quotes/bills.
 * Difference: links to original invoice (optional) · negative impact on receivables.
 */
import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Trash2, Loader2, ScrollText, ArrowDownLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode } from "../components/items-table";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Contact, Invoice } from "../lib/api";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", ISSUED: "صادر", APPLIED: "مطبَّق", CANCELLED: "ملغى",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ISSUED: "bg-amber-100 text-amber-700",
  APPLIED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const REASONS = [
  { value: "RETURN", label: "إرجاع بضاعة" },
  { value: "DISCOUNT", label: "خصم تجاري" },
  { value: "PRICING_ERROR", label: "تصحيح خطأ تسعير" },
  { value: "QUALITY_ISSUE", label: "مشكلة جودة" },
  { value: "OTHER", label: "أخرى" },
];

const EMPTY_FORM = {
  contactId: "",
  originalInvoiceId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  reason: "RETURN",
  notes: "",
};

interface CreditNote {
  id: string;
  noteNumber: string;
  status: string;
  issueDate: string;
  total: string | number;
  currency: string;
  reason: string;
  contactId: string;
  contact?: Contact;
  originalInvoiceId?: string | null;
  notes?: string | null;
}

export function CreditNotes() {
  const [items, setItems] = useState<CreditNote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Try the dedicated endpoint · fall back to empty list with helpful message
      const [contactsRes, invRes] = await Promise.all([
        api.contacts.list({ limit: 200 }),
        api.invoices.list({ limit: 200 }),
      ]);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
      setInvoices(invRes.items);
      // When /api/credit-notes ships, replace this:
      try {
        // @ts-ignore · API may not have this method yet
        if (api.creditNotes && typeof api.creditNotes.list === "function") {
          // @ts-ignore
          const cnRes = await api.creditNotes.list({ limit: 200 });
          setItems(cnRes.items);
        } else {
          setItems([]); // no backend yet · UI-only stage
        }
      } catch (_) { setItems([]); }
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(c =>
    !searchQuery || c.noteNumber.includes(searchQuery) ||
    (c.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, c) => s + Number(c.total), 0);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setCreateOpen(true);
  };
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); };

  const handleSubmit = async () => {
    setCreateError(null);
    if (!form.contactId) { setCreateError("اختر العميل"); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError("أضف بنداً واحداً على الأقل"); return; }
    setBusy(true);
    try {
      // @ts-ignore · API.creditNotes shipping with backend
      if (api.creditNotes && typeof api.creditNotes.create === "function") {
        // @ts-ignore
        const cn = await api.creditNotes.create({
          contactId: form.contactId,
          originalInvoiceId: form.originalInvoiceId || null,
          issueDate: form.issueDate,
          reason: form.reason,
          notes: form.notes || null,
          lines: validLines.map((l) => ({
            description: l.description,
            quantity: Number(normalizeDigits(l.quantity)) || 1,
            unitPrice: l.taxInclusive
              ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
              : Number(normalizeDigits(l.unitPrice)),
          })),
        });
        setItems((prev) => [cn, ...prev]);
        push("success", `تم إنشاء إشعار دائن ${cn.noteNumber}`);
      } else {
        push("warning", "API الإشعارات الدائنة لم يتم تفعيله بعد · النموذج جاهز");
      }
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      // @ts-ignore
      if (api.creditNotes && typeof api.creditNotes.remove === "function") {
        // @ts-ignore
        await api.creditNotes.remove(id);
      }
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم حذف الإشعار");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  // Customer-filtered invoices for the original-invoice combobox
  const customerInvoices = invoices.filter(i => !form.contactId || i.contactId === form.contactId);

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title="إشعار دائن جديد"
          subtitle="ربط الإشعار بفاتورة الأصلية اختياري · سيخصم القيمة من رصيد العميل"
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? "..." : "حفظ كمسودة"}
              </Button>
            </div>
          }
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
            <div className="space-y-2">
              <Label className="text-[#374151]">العميل *</Label>
              <SearchableCombobox
                value={form.contactId}
                onChange={(id) => setForm({ ...form, contactId: id, originalInvoiceId: "" })}
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
              <div className="space-y-2">
                <Label className="text-[#374151]">الفاتورة الأصلية (اختياري)</Label>
                <select
                  value={form.originalInvoiceId}
                  onChange={(e) => setForm({ ...form, originalInvoiceId: e.target.value })}
                  className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                >
                  <option value="">— بدون ربط —</option>
                  {customerInvoices.map(i => (
                    <option key={i.id} value={i.id}>{i.invoiceNumber} · {Number(i.total).toLocaleString()} {i.currency}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151]">تاريخ الإصدار *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#374151]">سبب الإصدار *</Label>
              <select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#374151]">البنود *</Label>
              <ItemsTable
                lines={lines}
                setLines={setLines}
                mode={taxMode}
                onModeChange={setTaxMode}
                defaultTaxRate={0.15}
                currency="SAR"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#374151]">ملاحظات</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="تفاصيل إضافية تظهر للعميل..."
                className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-[#6B7280]">💡 يمكنك لصق بنود من Excel · سيتم توزيعها تلقائياً.</p>
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الإشعارات الدائنة</h1>
          <p className="text-[#6B7280] mt-1">إدارة إشعارات الخصم والإرجاع للعملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />إشعار دائن جديد</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي الإشعارات</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي القيمة</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">مطبَّقة</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.filter(c => c.status === "APPLIED").length}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة الإشعارات الدائنة</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center">
              <ScrollText className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" />
              <p className="text-sm text-[#6B7280] mb-2">لا توجد إشعارات دائنة</p>
              <p className="text-xs text-[#9CA3AF]">اضغط "إشعار دائن جديد" لإنشاء أول إشعار</p>
            </div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرقم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>العميل</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>السبب</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>القيمة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{c.noteNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{c.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{c.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-xs text-[#6B7280]">{REASONS.find(r => r.value === c.reason)?.label || c.reason}</td>
                    <td className="py-3 px-4 font-english text-sm text-amber-600" style={{ fontWeight: 600 }}>
                      <span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{Number(c.total).toLocaleString()} {c.currency}</span>
                    </td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status] || c.status}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {pendingDelete === c.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(c.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={() => setPendingDelete(c.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
