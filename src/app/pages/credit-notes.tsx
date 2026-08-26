/**
 * Credit Notes (الإشعارات الدائنة) · UI-first build · backend wired via /api/credit-notes (when ready)
 * Falls back to filtered invoices with status=CANCELLED until dedicated API ships.
 *
 * Product requirement: build out from coming-soon · لا تخلي صفحة فاضية
 *
 * Pattern: same FullPageForm + ItemsTable + SearchableCombobox as invoices/quotes/bills.
 * Difference: links to original invoice (optional) · negative impact on receivables.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Plus, Search, Trash2, Loader2, ScrollText, ArrowDownLeft, FileText, ScanLine } from "lucide-react";
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
import { api, ApiError, Contact, Invoice } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";
import { BranchField } from "../components/branch-field";

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
  { value: "RETURN", label: { ar: "إرجاع بضاعة", en: "Goods return" } },
  { value: "DISCOUNT", label: { ar: "خصم تجاري", en: "Trade discount" } },
  { value: "PRICING_ERROR", label: { ar: "تصحيح خطأ تسعير", en: "Pricing error correction" } },
  { value: "QUALITY_ISSUE", label: { ar: "مشكلة جودة", en: "Quality issue" } },
  { value: "OTHER", label: { ar: "أخرى", en: "Other" } },
];

const EMPTY_FORM = {
  contactId: "",
  originalInvoiceId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  reason: "RETURN",
  notes: "",
  // Branch dimension (B1) · undefined = apply member default · null = none
  branchId: undefined as string | null | undefined,
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
  const { t } = useLanguage();
  const params = useParams();
  const navigate = useNavigate();
  const editId = params.id;
  const isEditing = Boolean(editId);

  const [items, setItems] = useState<CreditNote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
  const draft = useFormDraft({ key: editId ? `credit-note:${editId}` : "credit-note:new", open: createOpen, snapshot: { form, lines, taxMode }, restore: (s) => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); } });

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Try the dedicated endpoint · fall back to empty list with helpful message
      const [contactsRes, invRes, productsRes] = await Promise.all([
        api.contacts.list({ limit: 200 }),
        api.invoices.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH" || (c as any).isCustomer));
      setInvoices(invRes.items);
      setProducts((productsRes as any).items || []);
      // When /api/credit-notes ships, replace this:
      try {
        const cnRes = await api.creditNotes.list({ limit: 200 });
        setItems(cnRes.items);
      } catch (_) { setItems([]); }
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // Load existing credit note for editing
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCreateOpen(true);
      try {
        const cn = await api.creditNotes.get(editId);
        if (cancelled) return;
        setForm({
          contactId: cn.contactId,
          originalInvoiceId: cn.originalInvoiceId || "",
          issueDate: (cn.issueDate || "").slice(0, 10),
          reason: cn.reason || "RETURN",
          notes: cn.notes || "",
          branchId: cn.branchId ?? null,
        });
        const mapped = (cn.lines || []).map((line: any) => ({
          ...newLine(line.taxRate ? Number(line.taxRate.rate) : 0.15, false),
          originalInvoiceLineId: line.originalInvoiceLineId || undefined,
          productId: line.productId || undefined,
          description: line.description,
          quantity: String(line.quantity || "1"),
          unitPrice: String(line.unitPrice || "0"),
          taxRate: line.taxRate ? Number(line.taxRate.rate) : 0.15,
          taxRateId: line.taxRateId || null,
        }));
        setLines(mapped.length > 0 ? mapped : [newLine()]);
      } catch (e: any) {
        if (!cancelled) {
          push("error", e instanceof ApiError ? e.message : t("تعذر تحميل الإشعار", "Could not load the credit note"));
          navigate("/app/credit-notes", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, navigate, push]);

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
  const closeCreate = () => {
    if (isEditing) { navigate("/app/credit-notes", { replace: true }); return; }
    setCreateOpen(false);
    setCreateError(null);
  };

  const loadInvoiceLines = async (invoiceId: string) => {
    if (!invoiceId) {
      setForm((prev) => ({ ...prev, originalInvoiceId: "" }));
      return;
    }
    setSourceLoading(true);
    setCreateError(null);
    try {
      const invoice = await api.invoices.get(invoiceId);
      setForm((prev) => ({
        ...prev,
        contactId: invoice.contactId,
        originalInvoiceId: invoice.id,
      }));
      const mapped = (invoice.lines || []).map((line: any) => ({
        ...newLine(line.taxRate ? Number(line.taxRate.rate) : 0.15, false),
        originalInvoiceLineId: line.id,
        productId: line.productId || undefined,
        description: line.description,
        quantity: String(line.quantity || "1"),
        unitPrice: String(line.unitPrice || "0"),
        taxRate: line.taxRate ? Number(line.taxRate.rate) : 0.15,
        taxRateId: line.taxRateId || null,
      }));
      setLines(mapped.length > 0 ? mapped : [newLine()]);
      push("success", t(`تم تحميل ${mapped.length} بند من الفاتورة ${invoice.invoiceNumber}`, `Loaded ${mapped.length} line(s) from invoice ${invoice.invoiceNumber}`));
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : t("تعذر تحميل بنود الفاتورة", "Could not load invoice lines"));
    } finally {
      setSourceLoading(false);
    }
  };

  const handleSubmit = async () => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل", "Add at least one line item")); return; }
    setBusy(true);
    try {
      const payload = {
        contactId: form.contactId,
        originalInvoiceId: form.originalInvoiceId || null,
        issueDate: form.issueDate,
        reason: form.reason,
        notes: form.notes || null,
        branchId: form.branchId ?? null,
        lines: validLines.map((l) => ({
          originalInvoiceLineId: (l as any).originalInvoiceLineId || null,
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: l.taxInclusive
            ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
            : Number(normalizeDigits(l.unitPrice)),
          taxRateId: (l as any).taxRateId || null,
        })),
      };
      if (isEditing && editId) {
        const cn = await api.creditNotes.update(editId, payload);
        push("success", t(`تم تحديث الإشعار ${cn.noteNumber}`, `Updated credit note ${cn.noteNumber}`));
        draft.clear();
        navigate("/app/credit-notes", { replace: true });
      } else {
        const cn = await api.creditNotes.create(payload);
        setItems((prev) => [cn, ...prev]);
        push("success", t(`تم إنشاء إشعار دائن ${cn.noteNumber}`, `Created credit note ${cn.noteNumber}`));
        draft.clear();
        closeCreate();
      }
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.creditNotes.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم حذف الإشعار", "Credit note deleted"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  // Customer-filtered invoices for the original-invoice combobox
  const customerInvoices = invoices.filter(i => !form.contactId || i.contactId === form.contactId);
  const selectedInvoice = invoices.find((i) => i.id === form.originalInvoiceId);

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={isEditing ? t("تعديل إشعار دائن", "Edit credit note") : t("إشعار دائن جديد", "New credit note")}
          subtitle={t("ربط الإشعار بفاتورة الأصلية اختياري · سيخصم القيمة من رصيد العميل", "Linking the note to the original invoice is optional · the value will be deducted from the customer's balance")}
          onClose={closeCreate}
          disableEscape={busy}
          draft={draft}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
              </Button>
            </div>
          }
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
            <div className="space-y-2">
              <Label className="text-foreground/80">{t("العميل", "Customer")} *</Label>
              <SearchableCombobox
                value={form.contactId}
                onChange={(id) => setForm({ ...form, contactId: id, originalInvoiceId: "" })}
                onCreate={async (name) => {
                  const c = await api.contacts.create({ displayName: name, type: "CUSTOMER", isCustomer: true } as any);
                  setCustomers((prev) => [c, ...prev]);
                  push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                  return c.id;
                }}
                items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                placeholder={t("اكتب اسم العميل أو ابحث...", "Type the customer name or search...")}
                createLabel={(q) => t(`+ إنشاء عميل جديد: "${q}"`, `+ Create new customer: "${q}"`)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground/80">{t("الفاتورة الأصلية", "Original invoice")}</Label>
                <SearchableCombobox
                  value={form.originalInvoiceId}
                  onChange={loadInvoiceLines}
                  items={customerInvoices.map((i) => ({
                    id: i.id,
                    label: i.invoiceNumber,
                    sublabel: [
                      i.contact?.displayName,
                      i.issueDate?.slice(0, 10),
                      `${Number(i.total).toLocaleString()} ${i.currency}`,
                    ].filter(Boolean).join(" · "),
                  }))}
                  placeholder={t("ابحث برقم الفاتورة، اسم العميل، أو التاريخ...", "Search by invoice number, customer name, or date...")}
                  disabled={sourceLoading}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">{t("تاريخ الإصدار", "Issue date")} *</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} required inputClassName="" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground/80">{t("سبب الإصدار", "Reason for issue")} *</Label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                >
                  {REASONS.map(r => <option key={r.value} value={r.value}>{t(r.label.ar, r.label.en)}</option>)}
                </select>
              </div>
              <BranchField value={form.branchId} onChange={(id) => setForm((f) => ({ ...f, branchId: id }))} />
            </div>
            {selectedInvoice && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>
                      {t("تم ربط الإشعار بالفاتورة", "Credit note linked to invoice")} <span className="font-english font-semibold" dir="ltr">{selectedInvoice.invoiceNumber}</span>
                      {" · "}{t("يمكنك تعديل الكميات أو حذف البنود قبل الحفظ.", "You can edit quantities or delete lines before saving.")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sourceLoading}
                    onClick={() => loadInvoiceLines(selectedInvoice.id)}
                    className="border-primary/20 bg-white"
                  >
                    {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <FileText className="h-4 w-4 me-2" />}
                    {t("إعادة تعبئة البنود", "Reload line items")}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-foreground/80">{t("البنود", "Line items")} *</Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ScanLine className="h-3.5 w-3.5 text-primary" />
                  {t("الليزر/الباركود يضيف الصنف مباشرة من كود المنتج", "Scanner/barcode adds the item directly from the product code")}
                </div>
              </div>
              <ItemsTable
                lines={lines}
                setLines={setLines}
                mode={taxMode}
                onModeChange={setTaxMode}
                defaultTaxRate={0.15}
                currency="SAR"
                products={products.map((p: any) => ({
                  id: p.id,
                  name: p.nameAr || p.name,
                  sku: p.sku,
                  unitPrice: Number(p.unitPrice) || 0,
                  taxRate: 0.15,
                  accountId: p.incomeAccountId,
                }))}
                onCreateProduct={async (name) => {
                  const p = await (api as any).products.create({ name, type: "GOOD", unitPrice: 0, isActive: true });
                  setProducts((prev) => [p, ...prev]);
                  push("success", t(`تم إنشاء الصنف ${displayName(p)}`, `Created item ${displayName(p)}`));
                  return { id: p.id, name: p.nameAr || p.name, sku: p.sku, unitPrice: Number(p.unitPrice) || 0, taxRate: 0.15, accountId: p.incomeAccountId };
                }}
                minRows={Math.max(5, lines.length)}
                direction="sales"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/80">{t("ملاحظات", "Notes")}</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder={t("تفاصيل إضافية تظهر للعميل...", "Additional details shown to the customer...")}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("💡 يمكنك لصق بنود من Excel · سيتم توزيعها تلقائياً.", "💡 You can paste line items from Excel · they will be distributed automatically.")}</p>
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
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الإشعارات الدائنة", "Credit Notes")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة إشعارات الخصم والإرجاع للعملاء", "Manage customer discount and return credit notes")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("إشعار دائن جديد", "New credit note")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي الإشعارات", "Total credit notes")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي القيمة", "Total value")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("مطبَّقة", "Applied")}</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.filter(c => c.status === "APPLIED").length}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">{t("قائمة الإشعارات الدائنة", "Credit note list")}</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder={t("بحث...", "Search...")} className="w-64 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center">
              <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground mb-2">{t("لا توجد إشعارات دائنة", "No credit notes")}</p>
              <p className="text-xs text-muted-foreground/60">{t("اضغط \"إشعار دائن جديد\" لإنشاء أول إشعار", "Click \"New credit note\" to create your first note")}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرقم", "Number")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("العميل", "Customer")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("السبب", "Reason")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("القيمة", "Value")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-primary/5">
                    <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{c.noteNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground/80">{c.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{c.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{(() => { const r = REASONS.find(r => r.value === c.reason); return r ? t(r.label.ar, r.label.en) : c.reason; })()}</td>
                    <td className="py-3 px-4 font-english text-sm text-amber-600" style={{ fontWeight: 600 }}>
                      <span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{Number(c.total).toLocaleString()} {c.currency}</span>
                    </td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status] ? t(STATUS_LABELS[c.status].ar, STATUS_LABELS[c.status].en) : c.status}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/app/credit-notes/${c.id}`)}
                          className="rounded-md p-1.5 text-primary hover:bg-primary/5"
                          title={t("تعديل", "Edit")}
                        >
                          <FileText className="h-4 w-4" />
                        </button>
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
