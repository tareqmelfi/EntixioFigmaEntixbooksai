import { displayLocale } from "../lib/number-display";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Eye, FileText, Loader2, Plus, Search, ScrollText, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, LedgerFigure, Metric, MetricStrip, PageHeader, PageToolbar, StatusBadge } from "../components/product";
import { BidiText } from "../components/bidi-text";
import { InvoicePreviewPane } from "../components/invoice-preview-pane";
import { useOrgRegion } from "../lib/use-org-region";
import { getOrgId } from "../lib/api";
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
/* Ledger status tone · applied = blue (success) · issued = copper (waiting) · draft/cancelled = muted, hollow dot */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  ISSUED: "warning",
  APPLIED: "success",
  CANCELLED: "neutral",
};
const money2 = (n: number | string) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const navigate = useNavigate();
  const { currency: orgCurrency } = useOrgRegion();

  // Document view · /app/purchases/supplier-credits/:id (brief rule 8: every row opens its document)
  const params = useParams();
  const detailId = params.id && params.id !== "new" ? params.id : null;
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [seller, setSeller] = useState<{ name: string; vatNumber?: string | null } | null>(null);
  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    let alive = true;
    setDetailLoading(true);
    api.supplierCredits.get(detailId)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e: any) => {
        if (!alive) return;
        push("error", humanizeError(e, language, { ar: "تعذر تحميل الإشعار", en: "Could not load the credit" }));
        navigate("/app/purchases/supplier-credits", { replace: true });
      })
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId]);
  // "إلى" block of the paper document = the active organisation (the supplier credits us)
  useEffect(() => {
    let alive = true;
    api.orgs.list().then((orgs: any[]) => {
      if (!alive) return;
      const active = orgs.find((o) => o.id === getOrgId()) || orgs[0];
      if (active) setSeller({ name: active.legalName || active.name, vatNumber: active.vatNumber });
    }).catch(() => { /* preview simply shows no org block */ });
    return () => { alive = false; };
  }, []);

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
      if (detailId === id) navigate("/app/purchases/supplier-credits", { replace: true });
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
    }
  };

  const supplierBills = bills.filter((bill) => !form.contactId || bill.contactId === form.contactId);
  const selectedBill = bills.find((bill) => bill.id === form.originalBillId);
  const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  // Currency-honest total: one currency → label it · mixed → per-currency figures
  const totalByCur = Object.entries(items.reduce<Record<string, number>>((acc, c) => { const k = c.currency || "SAR"; acc[k] = (acc[k] || 0) + Number(c.total || 0); return acc; }, {})).filter(([, v]) => v !== 0);
  const figureCurrency = totalByCur.length === 1 ? totalByCur[0][0] : (orgCurrency || "SAR");

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
          <div className="max-w-7xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{createError}</div>}
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
                    sublabel: [bill.contact?.displayName, bill.issueDate?.slice(0, 10), `${Number(bill.total).toLocaleString(displayLocale(), { maximumFractionDigits: 2 })} ${bill.currency}`].filter(Boolean).join(" · "),
                  }))}
                  placeholder={t("ابحث برقم الفاتورة أو المورد أو التاريخ...", "Search by bill number, supplier or date...")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("سبب الإشعار *", "Credit reason *")}</Label>
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
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
                  <Button type="button" variant="outline" disabled={sourceLoading} onClick={() => loadBillLines(selectedBill.id)} className="border-primary/20 bg-card">
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

  const statusPill = (status: string) => (
    <StatusBadge tone={STATUS_TONE[status] || "neutral"} icon={status === "DRAFT" || status === "CANCELLED" ? <span className="ledger-dot hollow" aria-hidden="true" /> : undefined}>
      {STATUS_LABELS[status] ? t(STATUS_LABELS[status].ar, STATUS_LABELS[status].en) : status}
    </StatusBadge>
  );
  const reasonWord = (reason: string) => { const r = REASONS.find((x) => x.value === reason); return r ? t(r.label.ar, r.label.en) : reason; };
  const deleteControl = (id: string) => pendingDelete === id ? (
    <InlineConfirm onConfirm={() => handleDelete(id)} onCancel={() => setPendingDelete(null)} />
  ) : (
    <button onClick={() => setPendingDelete(id)} className="rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
  );

  // Document view · /app/purchases/supplier-credits/:id (read-only · the API has no update)
  if (detailId) {
    const d = detail;
    return (
      <div className="space-y-6">
        <PageHeader
          className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
          eyebrow={<span className="text-[13px]">{t("المشتريات", "Purchases")} · <Link to="/app/purchases/supplier-credits" className="hover:underline">{t("إشعارات الموردين", "Supplier credits")}</Link></span>}
          title={d ? <span dir="ltr" className="font-code">{d.creditNumber}</span> : t("إشعار مورد", "Supplier credit")}
          description={d ? <BidiText>{d.contact?.displayName || "—"}</BidiText> : undefined}
          actions={
            <Button variant="outline" className="h-10 px-[18px] text-sm" onClick={() => navigate("/app/purchases/supplier-credits")}>
              <ArrowRight className="me-2 h-4 w-4 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} />{t("إشعارات الموردين", "Supplier credits")}
            </Button>
          }
        />
        {detailLoading || !d ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
            <div className="min-w-0 rounded-lg bg-surface-subtle p-4">
              <InvoicePreviewPane
                doc={{
                  id: d.id,
                  number: d.creditNumber,
                  status: d.status,
                  issueDate: d.issueDate,
                  currency: d.currency,
                  subtotal: d.subtotal,
                  taxTotal: d.taxTotal,
                  total: d.total,
                  lines: (d.lines as any[])?.map((l: any) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total ?? l.lineTotal })),
                }}
                seller={d.contact ? { name: d.contact.displayName, vatNumber: (d.contact as any).taxId || (d.contact as any).vatNumber } : null}
                customer={seller}
                docTypeLabel={t("إشعار مورد", "Supplier credit")}
                statusLabel={STATUS_LABELS[d.status] ? t(STATUS_LABELS[d.status].ar, STATUS_LABELS[d.status].en) : d.status}
                statusMeta={String(d.issueDate || "").slice(0, 10)}
              />
            </div>
            <aside className="min-w-0 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-section font-semibold text-foreground">{t("الحالة", "Status")}</h2>
                {statusPill(d.status)}
              </div>
              <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-content-secondary">{t("المورد", "Supplier")}</dt>
                <dd className="min-w-0 truncate text-foreground">
                  {d.contactId ? <Link to={`/app/contacts/${d.contactId}`} className="hover:underline underline-offset-4"><BidiText>{d.contact?.displayName || "—"}</BidiText></Link> : <BidiText>{d.contact?.displayName || "—"}</BidiText>}
                </dd>
                <dt className="text-content-secondary">{t("تاريخ الإصدار", "Issue date")}</dt>
                <dd><span dir="ltr" className="font-english tabular-nums text-foreground">{String(d.issueDate || "").slice(0, 10) || "—"}</span></dd>
                <dt className="text-content-secondary">{t("السبب", "Reason")}</dt>
                <dd className="text-foreground">{reasonWord(d.reason)}</dd>
                {d.originalBillId && <>
                  <dt className="text-content-secondary">{t("فاتورة المشتريات الأصلية", "Original purchase bill")}</dt>
                  <dd className="min-w-0"><Link to={`/app/purchases/bills/${d.originalBillId}`} dir="ltr" className="block truncate font-code text-xs text-primary hover:underline">{d.originalBill?.billNumber || d.originalBillId}</Link></dd>
                </>}
                <dt className="text-content-secondary">{t("القيمة", "Value")}</dt>
                <dd><span dir="ltr" className="font-display text-[18px] leading-6 tabular-nums text-warning">{money2(d.total)} <span className="font-english text-xs text-muted-foreground">{d.currency}</span></span></dd>
                {d.notes && <>
                  <dt className="text-content-secondary">{t("ملاحظات", "Notes")}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground">{d.notes}</dd>
                </>}
              </dl>
              <div className="mt-4 flex items-center justify-end border-t border-border pt-4">{deleteControl(d.id)}</div>
            </aside>
          </div>
        )}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<span className="text-[13px]">{t("المشتريات", "Purchases")}</span>}
        title={t("إشعارات الموردين", "Supplier credits")}
        description={t("مرتجعات وخصومات الموردين المرتبطة بفواتير المشتريات", "Supplier returns and discounts linked to purchase bills")}
        actions={<Button className="h-10 px-[18px] text-sm" onClick={openCreate}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إشعار مورد جديد", "New supplier credit")}</Button>}
      />

      {/* Ledger figures · ink rules, serif numerals */}
      <MetricStrip className="compact sm:grid-cols-3 xl:grid-cols-3">
        <Metric label={t("إجمالي الإشعارات", "Total credits")} value={items.length} hint={t("إشعار", "credits")} />
        <Metric
          label={t("إجمالي القيمة", "Total value")}
          value={totalByCur.length > 1
            ? <span className="flex flex-col gap-1 text-warning">{totalByCur.map(([cur, v]) => <span key={cur}><LedgerFigure value={v} currency={cur} /></span>)}</span>
            : <span className="text-warning"><LedgerFigure value={total} currency={figureCurrency} /></span>}
          hint={t("تُخصم من رصيد المورد", "Deducted from the supplier balance")}
        />
        <Metric label={t("مطبَّقة", "Applied")} value={<span className="text-success">{items.filter((item) => item.status === "APPLIED").length}</span>} hint={t("إشعار مطبَّق", "applied")} />
      </MetricStrip>

      <PageToolbar aria-label={t("مرشحات الإشعارات", "Supplier credit filters")} className="justify-between">
        <h2 className="text-section font-semibold text-foreground">{t("قائمة إشعارات الموردين", "Supplier credits list")}</h2>
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("بحث...", "Search...")} className="h-9 w-full ps-8 text-[13px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </PageToolbar>

      {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
      filtered.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-8 w-8" strokeWidth={1.75} />} title={t("لا توجد إشعارات موردين", "No supplier credits")} />
      ) : (
        <>
        <ul className="md:hidden">
          {filtered.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => navigate(`/app/purchases/supplier-credits/${item.id}`)} className="flex w-full min-h-11 items-center justify-between gap-3 border-b border-border py-3 text-start" title={t("فتح الإشعار", "Open credit")}>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-sm font-semibold text-foreground"><bdi dir="auto">{item.contact?.displayName || "—"}</bdi></span>
                  <span dir="ltr" className="truncate font-code text-xs text-muted-foreground">{item.creditNumber} · {item.issueDate?.slice(0, 10)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-[3px]">
                  <span dir="ltr" className="font-display text-[18px] leading-5 text-warning tabular-nums">{money2(item.total)}</span>
                  {statusPill(item.status)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="ledger-table hidden md:block overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
          <Table className="table-fixed min-w-[980px]">
            <colgroup>
              <col style={{ width: "200px" }} />{/* الرقم · mono */}
              <col />{/* المورد · flexible */}
              <col style={{ width: "110px" }} />{/* التاريخ */}
              <col style={{ width: "150px" }} />{/* السبب */}
              <col style={{ width: "130px" }} />{/* القيمة */}
              <col style={{ width: "140px" }} />{/* الحالة */}
              <col style={{ width: "150px" }} />{/* إجراءات */}
            </colgroup>
            <TableHeader><TableRow className="hover:bg-transparent">
              <TableHead>{t("الرقم", "Number")}</TableHead>
              <TableHead>{t("المورد", "Supplier")}</TableHead>
              <TableHead>{t("التاريخ", "Date")}</TableHead>
              <TableHead>{t("السبب", "Reason")}</TableHead>
              <TableHead className="text-end">{t("القيمة", "Value")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
              <TableHead>{t("إجراءات", "Actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} onClick={() => navigate(`/app/purchases/supplier-credits/${item.id}`)} className="h-12 cursor-pointer" title={t("فتح الإشعار", "Open credit")}>
                  <TableCell className="align-middle overflow-hidden">
                    <Link to={`/app/purchases/supplier-credits/${item.id}`} onClick={(e) => e.stopPropagation()} title={item.creditNumber} className="block max-w-full hover:underline underline-offset-4">
                      <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{item.creditNumber}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="align-middle overflow-hidden text-foreground" title={item.contact?.displayName || ""}><span className="block truncate leading-5"><bdi dir="auto">{item.contact?.displayName || "—"}</bdi></span></TableCell>
                  <TableCell className="align-middle"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{item.issueDate?.slice(0, 10)}</span></TableCell>
                  <TableCell className="align-middle text-xs text-content-secondary"><span className="block truncate">{reasonWord(item.reason)}</span></TableCell>
                  <TableCell className="text-end align-middle">
                    <span dir="ltr" className="block font-display text-[18px] leading-6 text-warning tabular-nums">{money2(item.total)}{item.currency !== figureCurrency && <span className="font-english text-[10px] text-muted-foreground"> {item.currency}</span>}</span>
                  </TableCell>
                  <TableCell className="align-middle">{statusPill(item.status)}</TableCell>
                  <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button onClick={() => navigate(`/app/purchases/supplier-credits/${item.id}`)} className="rounded-full p-1.5 text-primary hover:bg-surface-hover" title={t("فتح الإشعار", "Open credit")}><Eye className="h-4 w-4" strokeWidth={1.75} /></button>
                      {deleteControl(item.id)}
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
