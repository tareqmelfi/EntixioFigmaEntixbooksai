/**
 * Purchase Bills · wired to /api/bills · org-scoped
 * UX-1: NO modal · NO slide-over.
 * UX pattern: FullPageForm (replaces content area on create · مطابق Wafeq) + ItemsTable + SearchableCombobox.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Plus, Search, Trash2, Loader2, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Contact } from "../lib/api";

const CURRENCIES = [
  { value: "SAR", label: "ريال سعودي · SAR" },
  { value: "USD", label: "دولار أمريكي · USD" },
  { value: "EUR", label: "يورو · EUR" },
  { value: "AED", label: "درهم إماراتي · AED" },
];

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

const EMPTY_FORM = {
  contactId: "",
  billNumber: "",
  reference: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  currency: "SAR",
  notes: "",
};

export function PurchaseBills() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [bills, contactsRes, productsRes, accountsRes] = await Promise.all([
        api.bills.list(),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(bills.items);
      setSuppliers(contactsRes.items.filter(c => c.type === "SUPPLIER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setForm(EMPTY_FORM);
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = items.filter(b =>
    !searchQuery || b.billNumber.includes(searchQuery) ||
    (b.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, b) => s + Number(b.total), 0);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setCreateOpen(true);
  };
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); };

  const handleSubmit = async (action: "draft" | "approve" = "draft") => {
    setCreateError(null);
    if (!form.contactId) { setCreateError("اختر المورد"); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError("أضف بنداً واحداً على الأقل (وصف + سعر)"); return; }
    setBusy(true);
    try {
      const status = action === "draft" ? "DRAFT" : "RECEIVED";
      const b = await api.bills.create({
        contactId: form.contactId,
        billNumber: form.billNumber || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        currency: form.currency,
        status,
        notes: form.notes || null,
        termsConditions: form.reference ? `Supplier Ref: ${form.reference}` : undefined,
        lines: validLines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: l.taxInclusive
            ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
            : Number(normalizeDigits(l.unitPrice)),
        })),
      } as any);
      setItems(prev => [b, ...prev]);
      const msg = action === "draft" ? `تم حفظ ${b.billNumber || "الفاتورة"} كمسودة` : `تم اعتماد ${b.billNumber || "الفاتورة"}`;
      push("success", msg);
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.bills.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم حذف الفاتورة");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  const handleApprove = async (b: any) => {
    try {
      await api.bills.update(b.id, { status: "RECEIVED" });
      setItems(prev => prev.map(x => x.id === b.id ? { ...x, status: "RECEIVED" } : x));
      push("success", `تم اعتماد ${b.billNumber || b.id}`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الاعتماد");
    }
  };

  // Full-page Create form (hides list view)
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title="فاتورة مشتريات جديدة"
          subtitle="املأ البيانات الأساسية · يمكنك التعديل لاحقاً"
          onClose={closeCreate}
          disableEscape={busy}
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
              </div>
            </div>
          }
        >
          <div className="max-w-7xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">المورد *</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => setForm({ ...form, contactId: id })}
                  onCreate={async (name) => {
                    const c = await api.contacts.create({ displayName: name, type: "SUPPLIER" });
                    setSuppliers((prev) => [c, ...prev]);
                    push("success", `تم إنشاء ${c.displayName}`);
                    return c.id;
                  }}
                  items={suppliers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                  placeholder="ابحث عن مورد..."
                  createLabel={(q) => `+ إنشاء "${q}"`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">تاريخ الفاتورة *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">تاريخ الاستحقاق *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">رقم الفاتورة</Label>
                <Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} placeholder="# تلقائي" dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">رقم فاتورة المورد</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="من فاتورة المورد" className="border-[#E5E7EB] h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-9 border-[#E5E7EB] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">المبالغ</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="h-9 border-[#E5E7EB] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-exclusive">غير شاملة الضريبة</SelectItem>
                    <SelectItem value="all-inclusive">شاملة الضريبة</SelectItem>
                    <SelectItem value="custom">مخصصة لكل بند</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ItemsTable
              lines={lines}
              setLines={setLines}
              mode={taxMode}
              onModeChange={setTaxMode}
              defaultTaxRate={0.15}
              currency={form.currency}
              direction="purchases"
              minRows={10}
              products={products.map((p: any) => ({
                id: p.id, code: p.code, name: p.name, sellPrice: Number(p.sellPrice || 0), costPrice: Number(p.costPrice || 0),
                taxRate: p.taxRate ? Number(p.taxRate) : 0.15, taxInclusive: !!p.taxInclusive,
                accountId: p.expenseAccountId || p.revenueAccountId,
              }))}
              accounts={accounts.map((a: any) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
              onCreateProduct={async (name) => {
                const p = await (api as any).products.create({ code: `P-${Date.now().toString(36).slice(-4).toUpperCase()}`, name, sellPrice: 0, kind: "GOOD", isActive: true });
                setProducts((prev) => [p, ...prev]);
                return { id: p.id, code: p.code, name: p.name, sellPrice: Number(p.sellPrice || 0), costPrice: Number(p.costPrice || 0), taxRate: 0.15, taxInclusive: false };
              }}
              onCreateAccount={async (name) => {
                const a = await (api as any).accounts.create({ code: `EXP-${Date.now().toString(36).slice(-4).toUpperCase()}`, name, type: "EXPENSE" });
                setAccounts((prev) => [a, ...prev]);
                return { id: a.id, code: a.code, name: a.name, type: a.type };
              }}
            />

            <DocumentDropZone
              compact
              target="bill-lines"
              hint="استخرج بنود فاتورة المشتريات من فاتورة المورد"
              defaultTaxRate={0.15}
              currency={form.currency}
              onExtracted={(data: ExtractedDocument) => {
                if (!data.lines || data.lines.length === 0) {
                  push("warning", "لم يتم استخراج بنود من المستند");
                  return;
                }
                const newLines: InvoiceLine[] = data.lines.map((l: any) => ({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  description: l.description || "",
                  quantity: String(l.quantity || 1),
                  unitPrice: String(l.unitPrice || 0),
                  taxRate: l.taxRate ?? 0.15,
                  taxInclusive: l.taxInclusive ?? false,
                }));
                setLines(newLines);
                if (data.documentNumber) setForm((f) => ({ ...f, reference: data.documentNumber || f.reference }));
                if (data.dueDate) setForm((f) => ({ ...f, dueDate: data.dueDate || f.dueDate }));
                push("success", `تم استخراج ${newLines.length} بنداً من فاتورة المورد`);
              }}
              onError={(msg) => push("error", msg)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">ملاحظات داخلية</Label>
                <textarea
                  rows={3}
                  placeholder="ملاحظات داخلية لا تظهر للمورد..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">الإجمالي</Label>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 space-y-2">
                  {(() => {
                    const totals = computeTotals(lines);
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6B7280]">المجموع الفرعي</span>
                          <span className="font-english">{form.currency} {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6B7280]">الضريبة (15%)</span>
                          <span className="font-english">{form.currency} {totals.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
                          <span className="text-[#0B1B49]" style={{ fontWeight: 600 }}>الإجمالي:</span>
                          <span className="font-english text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                            {form.currency} {totals.total.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // Default · list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المشتريات</h1>
          <p className="text-[#6B7280] mt-1">إدارة فواتير الموردين</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />فاتورة مشتريات جديدة</Button>
      </div>

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
                      <div className="flex items-center gap-1 flex-wrap">
                        {b.status === "DRAFT" && (
                          <button onClick={() => handleApprove(b)} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1 border border-green-200" title="اعتماد الفاتورة">
                            ✓ اعتماد
                          </button>
                        )}
                        {pendingDelete === b.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(b.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={() => setPendingDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
