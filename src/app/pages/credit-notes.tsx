import { displayLocale } from "../lib/number-display";
import { correctionLineAmounts } from "../lib/invoice-correction";
/**
 * Credit Notes (الإشعارات الدائنة) · UI-first build · backend wired via /api/credit-notes (when ready)
 * Falls back to filtered invoices with status=CANCELLED until dedicated API ships.
 *
 * Product requirement: build out from coming-soon · لا تخلي صفحة فاضية
 *
 * Pattern: same FullPageForm + ItemsTable + SearchableCombobox as invoices/quotes/bills.
 * Difference: links to original invoice (optional) · negative impact on receivables.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import { Plus, Search, Trash2, Loader2, ScrollText, FileText, ScanLine, Mail } from "lucide-react";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, LedgerFigure, Metric, MetricStrip, PageHeader, PageToolbar, StatusBadge } from "../components/product";
import { useOrgRegion } from "../lib/use-org-region";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { useFormDraft } from "../lib/form-draft";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode } from "../components/items-table";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Contact, DocumentSendRecord, Invoice } from "../lib/api";
import { SendComposeForm } from "../components/send-compose-form";
import { SendLogSection } from "../components/send-log-section";
import { displayName } from "../lib/display-name";
import { useLanguage } from "../components/LanguageContext";
import { BranchField } from "../components/branch-field";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, ISSUED: { ar: "صادر", en: "Issued" }, APPLIED: { ar: "مطبَّق", en: "Applied" }, CANCELLED: { ar: "ملغى", en: "Cancelled" },
};
/* Ledger status tone · applied = blue (success) · issued = copper (waiting to be applied) · draft/cancelled = muted, hollow dot */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  ISSUED: "warning",
  APPLIED: "success",
  CANCELLED: "neutral",
};
const money2 = (n: number | string) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  currency: "SAR",
  exchangeRate: 1,
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
  const { t, language } = useLanguage();
  const { currency: orgCurrency } = useOrgRegion();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const correctInvoice = searchParams.get("correctInvoice");
  const correctionLoaded = useRef<string | null>(null);
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
  // Send compose page (W-SEND · 2026-09-08) · «إرسال» opens a page to review
  // the message before it goes out — it never fires an email silently.
  const [sendComposeFor, setSendComposeFor] = useState<{ note: CreditNote; prefill?: DocumentSendRecord } | null>(null);
  const [sendLogRefresh, setSendLogRefresh] = useState(0);

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
          currency: cn.currency || "SAR",
          exchangeRate: Number((cn as any).exchangeRate || 1),
          branchId: cn.branchId ?? null,
        });
        const mapped = (cn.lines || []).map((line: any) => ({
          ...newLine(line.taxRate ? Number(line.taxRate.rate) : 0, false),
          originalInvoiceLineId: line.originalInvoiceLineId || undefined,
          productId: line.productId || undefined,
          description: line.description,
          quantity: String(line.quantity || "1"),
          unitPrice: String(line.unitPrice || "0"),
          taxRate: line.taxRate ? Number(line.taxRate.rate) : 0,
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
  // Currency-honest total: one currency → label it · mixed → per-currency figures
  const totalByCur = Object.entries(items.reduce<Record<string, number>>((acc, c) => { acc[c.currency] = (acc[c.currency] || 0) + Number(c.total); return acc; }, {})).filter(([, v]) => v !== 0);
  const figureCurrency = totalByCur.length === 1 ? totalByCur[0][0] : (orgCurrency || "SAR");

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, currency: orgCurrency || "SAR" });
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
      if (invoice.status === "DRAFT" || invoice.status === "CANCELLED" || (invoice as any).paymentLinkProvider === "stripe-subscription") throw new Error(t("هذه الفاتورة غير متاحة للتصحيح بهذا المسار.", "This invoice cannot be corrected through this flow."));
      setForm((prev) => ({
        ...prev,
        contactId: invoice.contactId,
        originalInvoiceId: invoice.id,
        currency: invoice.currency,
        exchangeRate: Number(invoice.exchangeRate || 1),
      }));
      const mapped = (invoice.lines || []).map((line: any) => ({
        ...newLine(line.taxRate ? Number(line.taxRate.rate) : 0, false),
        originalInvoiceLineId: line.id,
        productId: line.productId || undefined,
        description: line.description,
        ...correctionLineAmounts(line),
        taxRateId: line.taxRateId || null,
      }));
      setLines(mapped.length > 0 ? mapped : [newLine()]);
      push("success", t(`تم تحميل ${mapped.length} بند من الفاتورة ${invoice.invoiceNumber}`, `Loaded ${mapped.length} line(s) from invoice ${invoice.invoiceNumber}`));
    } catch (e: any) {
      setForm((prev) => ({ ...prev, originalInvoiceId: "", contactId: "" }));
      setLines([]);
      setCreateError(e instanceof Error ? e.message : t("تعذر تحميل بنود الفاتورة", "Could not load invoice lines"));
    } finally {
      setSourceLoading(false);
    }
  };

  useEffect(() => {
    if (!correctInvoice || editId || correctionLoaded.current === correctInvoice) return;
    correctionLoaded.current = correctInvoice;
    setCreateOpen(true);
    setForm({ ...EMPTY_FORM, reason: "PRICING_ERROR", currency: orgCurrency || "SAR" });
    setLines([]);
    void loadInvoiceLines(correctInvoice);
  }, [correctInvoice, editId]);

  const handleSubmit = async () => {
    if (sourceLoading) return;
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل", "Add at least one line item")); return; }
    setBusy(true);
    try {
      const payload = {
        contactId: form.contactId,
        currency: form.currency,
        exchangeRate: form.exchangeRate,
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
          taxRate: l.taxRate,
          taxInclusive: false,
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

  // Send compose page (W-SEND · 2026-09-08) · takes over the whole page,
  // above every other view — «إرسال» always lands here, never fires silently.
  if (sendComposeFor) {
    const cn = sendComposeFor.note;
    const contact = cn.contact || customers.find((c) => c.id === cn.contactId);
    return <>
      <SendComposeForm
        entityType="creditNote"
        entityId={cn.id}
        documentNumber={cn.noteNumber}
        documentLabelAr="إشعار دائن" documentLabelEn="Credit note"
        defaultTo={contact?.email ? [contact.email] : []}
        defaultSubject={t(`إشعار دائن ${cn.noteNumber}`, `Credit note ${cn.noteNumber}`)}
        defaultBody={t(
          `مرحباً ${contact?.displayName || ""}،\n\nمرفق إشعار دائن رقم ${cn.noteNumber} بقيمة ${Number(cn.total).toFixed(2)} ${cn.currency}.\n\nشكراً لتعاملكم معنا.`,
          `Hi ${contact?.displayName || ""},\n\nPlease find attached credit note ${cn.noteNumber} for ${Number(cn.total).toFixed(2)} ${cn.currency}.\n\nThank you.`,
        )}
        prefill={sendComposeFor.prefill}
        onClose={() => { setSendComposeFor(null); navigate("/app/credit-notes"); }}
        onSent={() => setSendLogRefresh((n) => n + 1)}
        push={push}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>;
  }

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
              {isEditing && editId && (
                <Button type="button" variant="outline" className="border-border" disabled={busy} onClick={() => { const cn = items.find((x) => x.id === editId); if (cn) setSendComposeFor({ note: cn }); }} data-testid="credit-note-send">
                  <Mail className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إرسال", "Send")}
                </Button>
              )}
              <Button type="button" disabled={busy || sourceLoading} onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
              </Button>
            </div>
          }
        >
          <div className="w-full space-y-4">
            {createError && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{createError}</div>}
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
                      `${Number(i.total).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })} ${i.currency}`,
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
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
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
                    className="border-primary/20 bg-card"
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
                currency={form.currency}
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
            {isEditing && editId && (
              <SendLogSection
                entityType="creditNote"
                entityId={editId}
                refreshKey={sendLogRefresh}
                onResend={(record) => { const cn = items.find((x) => x.id === editId); if (cn) setSendComposeFor({ note: cn, prefill: record }); }}
              />
            )}
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  const statusPill = (status: string) => (
    <StatusBadge tone={STATUS_TONE[status] || "neutral"} icon={status === "DRAFT" || status === "CANCELLED" ? <span className="ledger-dot hollow" aria-hidden="true" /> : undefined}>
      {STATUS_LABELS[status] ? t(STATUS_LABELS[status].ar, STATUS_LABELS[status].en) : status}
    </StatusBadge>
  );
  const reasonWord = (reason: string) => { const r = REASONS.find((x) => x.value === reason); return r ? t(r.label.ar, r.label.en) : reason; };

  return (
    <div className="space-y-6">
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")}</span>}
        title={t("الإشعارات الدائنة", "Credit Notes")}
        description={t("إدارة إشعارات الخصم والإرجاع للعملاء", "Manage customer discount and return credit notes")}
        actions={<Button className="h-10 px-[18px] text-sm" onClick={openCreate}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إشعار دائن جديد", "New credit note")}</Button>}
      />

      {/* Ledger figures · ink rules, serif numerals */}
      <MetricStrip className="compact sm:grid-cols-3 xl:grid-cols-3">
        <Metric label={t("إجمالي الإشعارات", "Total credit notes")} value={items.length} hint={t("إشعار", "notes")} />
        <Metric
          label={t("إجمالي القيمة", "Total value")}
          value={totalByCur.length > 1
            ? <span className="flex flex-col gap-1 text-warning">{totalByCur.map(([cur, v]) => <span key={cur}><LedgerFigure value={v} currency={cur} /></span>)}</span>
            : <span className="text-warning"><LedgerFigure value={total} currency={figureCurrency} /></span>}
          hint={t("تُخصم من رصيد العميل", "Deducted from the customer balance")}
        />
        <Metric label={t("مطبَّقة", "Applied")} value={<span className="text-success">{items.filter(c => c.status === "APPLIED").length}</span>} hint={t("إشعار مطبَّق", "applied")} />
      </MetricStrip>

      <PageToolbar aria-label={t("مرشحات الإشعارات", "Credit note filters")} className="justify-between">
        <h2 className="text-section font-semibold text-foreground">{t("قائمة الإشعارات الدائنة", "Credit note list")}</h2>
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("بحث...", "Search...")} className="h-9 w-full ps-8 text-[13px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </PageToolbar>

      {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
       filtered.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" strokeWidth={1.75} />}
          title={t("لا توجد إشعارات دائنة", "No credit notes")}
          description={t("اضغط \"إشعار دائن جديد\" لإنشاء أول إشعار", "Click \"New credit note\" to create your first note")}
        />
      ) : (
        <>
        <ul className="md:hidden">
          {filtered.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => navigate(`/app/credit-notes/${c.id}`)} className="flex w-full min-h-11 items-center justify-between gap-3 border-b border-border py-3 text-start" title={t("فتح الإشعار", "Open credit note")}>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-sm font-semibold text-foreground"><bdi dir="auto">{c.contact?.displayName || "—"}</bdi></span>
                  <span dir="ltr" className="truncate font-code text-xs text-muted-foreground">{c.noteNumber} · {c.issueDate?.slice(0, 10)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-[3px]">
                  <span dir="ltr" className="font-display text-[18px] leading-5 text-warning tabular-nums">{money2(c.total)}</span>
                  {statusPill(c.status)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="ledger-table hidden md:block overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
          <Table className="table-fixed min-w-[980px]">
            <colgroup>
              <col style={{ width: "200px" }} />{/* الرقم · mono */}
              <col />{/* العميل · flexible */}
              <col style={{ width: "110px" }} />{/* التاريخ */}
              <col style={{ width: "150px" }} />{/* السبب */}
              <col style={{ width: "130px" }} />{/* القيمة */}
              <col style={{ width: "140px" }} />{/* الحالة */}
              <col style={{ width: "150px" }} />{/* إجراءات */}
            </colgroup>
            <TableHeader><TableRow className="hover:bg-transparent">
              <TableHead>{t("الرقم", "Number")}</TableHead>
              <TableHead>{t("العميل", "Customer")}</TableHead>
              <TableHead>{t("التاريخ", "Date")}</TableHead>
              <TableHead>{t("السبب", "Reason")}</TableHead>
              <TableHead className="text-end">{t("القيمة", "Value")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
              <TableHead>{t("إجراءات", "Actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} onClick={() => navigate(`/app/credit-notes/${c.id}`)} className="h-12 cursor-pointer" title={t("فتح الإشعار", "Open credit note")}>
                  <TableCell className="align-middle overflow-hidden">
                    <Link to={`/app/credit-notes/${c.id}`} onClick={(e) => e.stopPropagation()} title={c.noteNumber} className="block max-w-full hover:underline underline-offset-4">
                      <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{c.noteNumber}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="align-middle overflow-hidden text-foreground" title={c.contact?.displayName || ""}><span className="block truncate leading-5"><bdi dir="auto">{c.contact?.displayName || "—"}</bdi></span></TableCell>
                  <TableCell className="align-middle"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{c.issueDate?.slice(0, 10)}</span></TableCell>
                  <TableCell className="align-middle text-xs text-content-secondary"><span className="block truncate">{reasonWord(c.reason)}</span></TableCell>
                  <TableCell className="text-end align-middle">
                    <span dir="ltr" className="block font-display text-[18px] leading-6 text-warning tabular-nums">{money2(c.total)}{c.currency !== figureCurrency && <span className="font-english text-[10px] text-muted-foreground"> {c.currency}</span>}</span>
                  </TableCell>
                  <TableCell className="align-middle">{statusPill(c.status)}</TableCell>
                  <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/app/credit-notes/${c.id}`)}
                        className="rounded-full p-1.5 text-primary hover:bg-surface-hover"
                        title={t("تعديل", "Edit")}
                      >
                        <FileText className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      {pendingDelete === c.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(c.id)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <button onClick={() => setPendingDelete(c.id)} className="rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
