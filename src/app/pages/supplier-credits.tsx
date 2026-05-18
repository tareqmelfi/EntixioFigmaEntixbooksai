import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, FileText, Loader2, Plus, Search, ScrollText, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode } from "../components/items-table";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Contact } from "../lib/api";

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
  { value: "RETURN", label: "إرجاع للمورد" },
  { value: "DISCOUNT", label: "خصم من المورد" },
  { value: "PRICING_ERROR", label: "تصحيح خطأ تسعير" },
  { value: "QUALITY_ISSUE", label: "مشكلة جودة" },
  { value: "OTHER", label: "أخرى" },
];

const EMPTY_FORM = {
  contactId: "",
  originalBillId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  reason: "RETURN",
  notes: "",
};

export function SupplierCredits() {
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
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
      const [contactsRes, billsRes, productsRes, creditsRes] = await Promise.all([
        api.contacts.list({ limit: 200 }),
        api.bills.list(),
        api.products.list({} as any).catch(() => ({ items: [] })),
        api.supplierCredits.list({ limit: 200 }).catch(() => ({ items: [] })),
      ]);
      setSuppliers(contactsRes.items.filter((c) => c.type === "SUPPLIER" || c.type === "BOTH" || (c as any).isSupplier));
      setBills(billsRes.items || []);
      setProducts((productsRes as any).items || []);
      setItems((creditsRes as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter((item) =>
    !searchQuery || item.creditNumber?.includes(searchQuery) || item.contact?.displayName?.includes(searchQuery),
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setCreateOpen(true);
  };

  const loadBillLines = async (billId: string) => {
    if (!billId) {
      setForm((prev) => ({ ...prev, originalBillId: "" }));
      return;
    }
    setSourceLoading(true);
    setCreateError(null);
    try {
      const bill = await api.bills.get(billId);
      setForm((prev) => ({ ...prev, contactId: bill.contactId, originalBillId: bill.id }));
      const mapped = (bill.lines || []).map((line: any) => ({
        ...newLine(line.taxRate ? Number(line.taxRate.rate) : 0.15, false),
        originalBillLineId: line.id,
        productId: line.productId || undefined,
        description: line.description,
        quantity: String(line.quantity || "1"),
        unitPrice: String(line.unitPrice || "0"),
        taxRate: line.taxRate ? Number(line.taxRate.rate) : 0.15,
        taxRateId: line.taxRateId || null,
      }));
      setLines(mapped.length > 0 ? mapped : [newLine()]);
      push("success", `تم تحميل ${mapped.length} بند من فاتورة المورد ${bill.billNumber}`);
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "تعذر تحميل بنود فاتورة المورد");
    } finally {
      setSourceLoading(false);
    }
  };

  const handleSubmit = async () => {
    setCreateError(null);
    if (!form.contactId) { setCreateError("اختر المورد"); return; }
    const validLines = lines.filter((line) => line.description.trim() && line.unitPrice);
    if (validLines.length === 0) { setCreateError("أضف بنداً واحداً على الأقل"); return; }
    setBusy(true);
    try {
      const created = await api.supplierCredits.create({
        contactId: form.contactId,
        originalBillId: form.originalBillId || null,
        issueDate: form.issueDate,
        reason: form.reason,
        notes: form.notes || null,
        lines: validLines.map((line) => ({
          originalBillLineId: (line as any).originalBillLineId || null,
          productId: line.productId || null,
          description: line.description,
          quantity: Number(normalizeDigits(line.quantity)) || 1,
          unitPrice: line.taxInclusive
            ? Number(normalizeDigits(line.unitPrice)) / (1 + line.taxRate)
            : Number(normalizeDigits(line.unitPrice)),
          taxRateId: (line as any).taxRateId || null,
        })),
      });
      setItems((prev) => [created, ...prev]);
      push("success", `تم إنشاء إشعار مورد ${created.creditNumber}`);
      setCreateOpen(false);
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.supplierCredits.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      push("success", "تم حذف إشعار المورد");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    }
  };

  const supplierBills = bills.filter((bill) => !form.contactId || bill.contactId === form.contactId);
  const selectedBill = bills.find((bill) => bill.id === form.originalBillId);
  const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

  if (createOpen) {
    return (
      <>
        <FullPageForm
          title="إشعار مورد جديد"
          subtitle="يربط المرتجع أو الخصم بفاتورة مشتريات أصلية ويخصم من رصيد المورد"
          onClose={() => setCreateOpen(false)}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? "..." : "حفظ كمسودة"}
              </Button>
            </div>
          }
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>المورد *</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => setForm({ ...form, contactId: id, originalBillId: "" })}
                  onCreate={async (name) => {
                    const supplier = await api.contacts.create({ displayName: name, type: "SUPPLIER", isSupplier: true } as any);
                    setSuppliers((prev) => [supplier, ...prev]);
                    return supplier.id;
                  }}
                  items={suppliers.map((supplier) => ({ id: supplier.id, label: supplier.displayName, sublabel: supplier.email || undefined }))}
                  placeholder="اكتب اسم المورد أو ابحث..."
                  createLabel={(q) => `+ إنشاء مورد: "${q}"`}
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الإصدار *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} dir="ltr" className="font-english" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>فاتورة المشتريات الأصلية</Label>
                <SearchableCombobox
                  value={form.originalBillId}
                  onChange={loadBillLines}
                  disabled={sourceLoading}
                  items={supplierBills.map((bill) => ({
                    id: bill.id,
                    label: bill.billNumber,
                    sublabel: [bill.contact?.displayName, bill.issueDate?.slice(0, 10), `${Number(bill.total).toLocaleString()} ${bill.currency}`].filter(Boolean).join(" · "),
                  }))}
                  placeholder="ابحث برقم الفاتورة أو المورد أو التاريخ..."
                />
              </div>
              <div className="space-y-2">
                <Label>سبب الإشعار *</Label>
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
                  {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                </select>
              </div>
            </div>
            {selectedBill && (
              <div className="rounded-lg border border-[#D7E9FF] bg-[#F4FCFF] px-3 py-3 text-sm text-[#0B1B49]">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#1276E3]" />
                    مرتبط بفاتورة المورد <span className="font-english font-semibold">{selectedBill.billNumber}</span>
                  </span>
                  <Button type="button" variant="outline" disabled={sourceLoading} onClick={() => loadBillLines(selectedBill.id)} className="border-[#BBD7F5] bg-white">
                    {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <FileText className="h-4 w-4 me-2" />}
                    إعادة تعبئة البنود
                  </Button>
                </div>
              </div>
            )}
            <ItemsTable
              lines={lines}
              setLines={setLines}
              mode={taxMode}
              onModeChange={setTaxMode}
              defaultTaxRate={0.15}
              currency="SAR"
              direction="purchases"
              minRows={Math.max(5, lines.length)}
              products={products.map((product: any) => ({
                id: product.id,
                name: product.nameAr || product.name,
                sku: product.sku,
                unitPrice: Number(product.costPrice || product.unitPrice) || 0,
                taxRate: 0.15,
                accountId: product.expenseAccountId,
              }))}
            />
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="تفاصيل الإرجاع أو الخصم..." className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
            </div>
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
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>إشعارات الموردين</h1>
          <p className="text-[#6B7280] mt-1">مرتجعات وخصومات الموردين المرتبطة بفواتير المشتريات</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />إشعار مورد جديد</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5"><div className="text-[#6B7280] text-sm mb-1">إجمالي الإشعارات</div><div className="font-english text-[#0B1B49] text-xl font-semibold">{items.length}</div></CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5"><div className="text-[#6B7280] text-sm mb-1">إجمالي القيمة</div><div className="font-english text-amber-600 text-xl font-semibold">{total.toLocaleString()}</div></CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5"><div className="text-[#6B7280] text-sm mb-1">مطبَّقة</div><div className="font-english text-green-600 text-xl font-semibold">{items.filter((item) => item.status === "APPLIED").length}</div></CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة إشعارات الموردين</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
          filtered.length === 0 ? (
            <div className="py-12 text-center"><ScrollText className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد إشعارات موردين</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start">الرقم</th>
                <th className="py-3 px-4 text-start">المورد</th>
                <th className="py-3 px-4 text-start">التاريخ</th>
                <th className="py-3 px-4 text-start">السبب</th>
                <th className="py-3 px-4 text-start">القيمة</th>
                <th className="py-3 px-4 text-start">الحالة</th>
                <th className="py-3 px-4 text-start">إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3] font-semibold">{item.creditNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{item.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{item.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-xs text-[#6B7280]">{REASONS.find((reason) => reason.value === item.reason)?.label || item.reason}</td>
                    <td className="py-3 px-4 font-english text-sm text-amber-600 font-semibold"><span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{Number(item.total).toLocaleString()} {item.currency}</span></td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status] || item.status}</span></td>
                    <td className="py-3 px-4">
                      {pendingDelete === item.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(item.id)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <button onClick={() => setPendingDelete(item.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      )}
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
