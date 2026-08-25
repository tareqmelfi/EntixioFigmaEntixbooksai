import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, FileText, Loader2, Plus, Search, ScrollText, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { useFormDraft } from "../lib/form-draft";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode } from "../components/items-table";
import { normalizeDigits } from "../lib/digits";
import { api, Contact } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, ISSUED: { ar: "صادر", en: "Issued" }, APPLIED: { ar: "مطبَّق", en: "Applied" }, CANCELLED: { ar: "ملغى", en: "Cancelled" },
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ISSUED: "bg-amber-100 text-amber-700",
  APPLIED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const REASONS = [
  { value: "RETURN", label: { ar: "إرجاع للمورد", en: "Return to supplier" } },
  { value: "DISCOUNT", label: { ar: "خصم من المورد", en: "Supplier discount" } },
  { value: "PRICING_ERROR", label: { ar: "تصحيح خطأ تسعير", en: "Pricing error correction" } },
  { value: "QUALITY_ISSUE", label: { ar: "مشكلة جودة", en: "Quality issue" } },
  { value: "OTHER", label: { ar: "أخرى", en: "Other" } },
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
  const draft = useFormDraft({ key: "supplier-credit:new", open: createOpen, snapshot: { form, lines, taxMode }, restore: (s) => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); } });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();
  const { language, t } = useLanguage();

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
      push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
    } finally {
      setLoading(false);
    }
  }, [push, language]);

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
      push("success", t(`تم تحميل ${mapped.length} بند من فاتورة المورد ${bill.billNumber}`, `Loaded ${mapped.length} line(s) from supplier bill ${bill.billNumber}`));
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "تعذر تحميل بنود فاتورة المورد", en: "Could not load bill lines" }));
    } finally {
      setSourceLoading(false);
    }
  };

  const handleSubmit = async () => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر المورد", "Select supplier")); return; }
    const validLines = lines.filter((line) => line.description.trim() && line.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل", "Add at least one line")); return; }
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
      push("success", t(`تم إنشاء إشعار مورد ${created.creditNumber}`, `Supplier credit ${created.creditNumber} created`));
      draft.clear();
      setCreateOpen(false);
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" }));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.supplierCredits.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      push("success", t("تم حذف إشعار المورد", "Supplier credit deleted"));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
    }
  };

  const supplierBills = bills.filter((bill) => !form.contactId || bill.contactId === form.contactId);
  const selectedBill = bills.find((bill) => bill.id === form.originalBillId);
  const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={t("إشعار مورد جديد", "New supplier credit")}
          subtitle={t("يربط المرتجع أو الخصم بفاتورة مشتريات أصلية ويخصم من رصيد المورد", "Links the return or discount to an original purchase bill and deducts from the supplier balance")}
          onClose={() => setCreateOpen(false)}
          disableEscape={busy}
          draft={draft}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
              </Button>
            </div>
          }
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("المورد *", "Supplier *")}</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => setForm({ ...form, contactId: id, originalBillId: "" })}
                  onCreate={async (name) => {
                    const supplier = await api.contacts.create({ displayName: name, type: "SUPPLIER", isSupplier: true } as any);
                    setSuppliers((prev) => [supplier, ...prev]);
                    return supplier.id;
                  }}
                  items={suppliers.map((supplier) => ({ id: supplier.id, label: supplier.displayName, sublabel: supplier.email || undefined }))}
                  placeholder={t("اكتب اسم المورد أو ابحث...", "Type supplier name or search...")}
                  createLabel={(q) => t(`+ إنشاء مورد: "${q}"`, `+ Create supplier: "${q}"`)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("تاريخ الإصدار *", "Issue date *")}</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} inputClassName="" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("فاتورة المشتريات الأصلية", "Original purchase bill")}</Label>
                <SearchableCombobox
                  value={form.originalBillId}
                  onChange={loadBillLines}
                  disabled={sourceLoading}
                  items={supplierBills.map((bill) => ({
                    id: bill.id,
                    label: bill.billNumber,
                    sublabel: [bill.contact?.displayName, bill.issueDate?.slice(0, 10), `${Number(bill.total).toLocaleString()} ${bill.currency}`].filter(Boolean).join(" · "),
                  }))}
                  placeholder={t("ابحث برقم الفاتورة أو المورد أو التاريخ...", "Search by bill number, supplier or date...")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("سبب الإشعار *", "Credit reason *")}</Label>
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{t(reason.label.ar, reason.label.en)}</option>)}
                </select>
              </div>
            </div>
            {selectedBill && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {t("مرتبط بفاتورة المورد", "Linked to supplier bill")} <span className="font-english font-semibold">{selectedBill.billNumber}</span>
                  </span>
                  <Button type="button" variant="outline" disabled={sourceLoading} onClick={() => loadBillLines(selectedBill.id)} className="border-primary/20 bg-white">
                    {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <FileText className="h-4 w-4 me-2" />}
                    {t("إعادة تعبئة البنود", "Reload lines")}
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
                name: displayName(product),
                sku: product.sku,
                unitPrice: Number(product.costPrice || product.unitPrice) || 0,
                taxRate: 0.15,
                accountId: product.expenseAccountId,
              }))}
            />
            <div className="space-y-2">
              <Label>{t("ملاحظات", "Notes")}</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder={t("تفاصيل الإرجاع أو الخصم...", "Return or discount details...")} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
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
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("إشعارات الموردين", "Supplier credits")}</h1>
          <p className="text-muted-foreground mt-1">{t("مرتجعات وخصومات الموردين المرتبطة بفواتير المشتريات", "Supplier returns and discounts linked to purchase bills")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("إشعار مورد جديد", "New supplier credit")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5"><div className="text-muted-foreground text-sm mb-1">{t("إجمالي الإشعارات", "Total credits")}</div><div className="font-english text-foreground text-xl font-semibold">{items.length}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-5"><div className="text-muted-foreground text-sm mb-1">{t("إجمالي القيمة", "Total value")}</div><div className="font-english text-amber-600 text-xl font-semibold">{total.toLocaleString()}</div></CardContent></Card>
        <Card className="border-border"><CardContent className="p-5"><div className="text-muted-foreground text-sm mb-1">{t("مطبَّقة", "Applied")}</div><div className="font-english text-green-600 text-xl font-semibold">{items.filter((item) => item.status === "APPLIED").length}</div></CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">{t("قائمة إشعارات الموردين", "Supplier credits list")}</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder={t("بحث...", "Search...")} className="w-64 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
          filtered.length === 0 ? (
            <div className="py-12 text-center"><ScrollText className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد إشعارات موردين", "No supplier credits")}</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-3 px-4 text-start">{t("الرقم", "Number")}</th>
                <th className="py-3 px-4 text-start">{t("المورد", "Supplier")}</th>
                <th className="py-3 px-4 text-start">{t("التاريخ", "Date")}</th>
                <th className="py-3 px-4 text-start">{t("السبب", "Reason")}</th>
                <th className="py-3 px-4 text-start">{t("القيمة", "Value")}</th>
                <th className="py-3 px-4 text-start">{t("الحالة", "Status")}</th>
                <th className="py-3 px-4 text-start">{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-primary/5">
                    <td className="py-3 px-4 font-english text-sm text-primary font-semibold">{item.creditNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground/80">{item.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{item.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{(() => { const r = REASONS.find((reason) => reason.value === item.reason); return r ? t(r.label.ar, r.label.en) : item.reason; })()}</td>
                    <td className="py-3 px-4 font-english text-sm text-amber-600 font-semibold"><span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{Number(item.total).toLocaleString()} {item.currency}</span></td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status] ? t(STATUS_LABELS[item.status].ar, STATUS_LABELS[item.status].en) : item.status}</span></td>
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
