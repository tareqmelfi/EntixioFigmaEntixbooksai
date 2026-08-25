/**
 * Quotes (عروض الأسعار) · wired to /api/quotes · with convert-to-invoice + sign
 * UX-1 compliant: NO Dialog · NO alert/confirm/prompt
 * UX pattern: FullPageForm + ItemsTable + SearchableCombobox · مطابق Wafeq
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Plus, Search, Trash2, Loader2, FileText, ArrowLeftRight, FileSignature } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { useFormDraft } from "../lib/form-draft";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Quote, Contact } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";

const CURRENCIES = [
  { value: "SAR", label: { ar: "ريال سعودي · SAR", en: "Saudi Riyal · SAR" } },
  { value: "USD", label: { ar: "دولار أمريكي · USD", en: "US Dollar · USD" } },
  { value: "EUR", label: { ar: "يورو · EUR", en: "Euro · EUR" } },
  { value: "AED", label: { ar: "درهم إماراتي · AED", en: "UAE Dirham · AED" } },
];

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, SENT: { ar: "مرسل", en: "Sent" }, VIEWED: { ar: "مُشاهَد", en: "Viewed" }, ACCEPTED: { ar: "مقبول", en: "Accepted" },
  REJECTED: { ar: "مرفوض", en: "Rejected" }, CONVERTED: { ar: "محوّل لفاتورة", en: "Converted to invoice" }, EXPIRED: { ar: "منتهي", en: "Expired" },
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

const EMPTY_FORM = {
  contactId: "",
  quoteNumber: "",
  reference: "",
  issueDate: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  currency: "SAR",
  notes: "",
};

export function Quotes() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const { goBack: goBackToSource } = useReturnTo();
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");
  const draft = useFormDraft({ key: "quote:new", open: createOpen, snapshot: { form, lines, taxMode }, restore: (s) => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); } });

  const [signFor, setSignFor] = useState<Quote | null>(null);
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingConvert, setPendingConvert] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [quotesRes, contactsRes, productsRes, accountsRes] = await Promise.all([
        api.quotes.list(),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(quotesRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const prefillContact = searchParams.get("contactId") || "";
      setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = items.filter(q =>
    !searchQuery || q.quoteNumber.includes(searchQuery) ||
    (q.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, q) => s + Number(q.total), 0);
  const accepted = items.filter(q => q.status === "ACCEPTED").length;
  const pending = items.filter(q => q.status === "SENT" || q.status === "VIEWED").length;

  const openCreate = () => {
    const prefillContact = searchParams.get("contactId") || "";
    setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    goBackToSource();
  };

  const handleSubmit = async (action: "draft" | "send" = "draft") => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل (وصف + سعر)", "Add at least one line item (description + price)")); return; }
    setBusy(true);
    try {
      const status = action === "draft" ? "DRAFT" : "SENT";
      const q = await api.quotes.create({
        contactId: form.contactId,
        quoteNumber: form.quoteNumber || undefined,
        issueDate: form.issueDate,
        validUntil: form.validUntil,
        currency: form.currency,
        status,
        notes: form.notes || null,
        termsConditions: form.reference ? `Ref: ${form.reference}` : undefined,
        lines: validLines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: l.taxInclusive
            ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
            : Number(normalizeDigits(l.unitPrice)),
        })),
      } as any);
      setItems(prev => [q, ...prev]);
      const msg = action === "draft" ? t(`تم حفظ ${q.quoteNumber} كمسودة`, `Saved ${q.quoteNumber} as draft`) : t(`تم إرسال ${q.quoteNumber}`, `Sent ${q.quoteNumber}`);
      push("success", msg);
      draft.clear();
      if (action === "send" && q.id) {
        try { await (api as any).email?.sendQuote?.(q.id, { message: form.notes || undefined }); } catch (e) {}
      }
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.quotes.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم حذف العرض", "Quote deleted"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  const handleConvert = async (q: Quote) => {
    setPendingConvert(null);
    try {
      const r = await api.quotes.convertToInvoice(q.id);
      push("success", t(`تم إنشاء الفاتورة ${r.invoice.invoiceNumber}`, `Created invoice ${r.invoice.invoiceNumber}`));
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "CONVERTED", convertedInvoiceId: r.invoice.id } : x));
    } catch (e: any) {
      push("error", e instanceof ApiError ? (e.message === "already_converted" ? t("هذا العرض محوّل سابقاً", "This quote has already been converted") : e.message) : t("فشل التحويل", "Conversion failed"));
    }
  };

  const openSign = (q: Quote) => {
    const customer = customers.find((c) => c.id === q.contactId);
    setSignFor(q);
    setSignForm({
      name: customer?.displayName || "",
      email: customer?.email || "",
      message: t(`يرجى مراجعة وتوقيع عرض السعر رقم ${q.quoteNumber}`, `Please review and sign quote no. ${q.quoteNumber}`),
    });
    setSignError(null);
  };
  const closeSign = () => { setSignFor(null); setSignError(null); };

  const handleSignSubmit = async () => {
    if (!signFor) return;
    setSignError(null);
    if (!signForm.email.trim()) { setSignError(t("البريد الإلكتروني مطلوب", "Email is required")); return; }
    if (!signForm.name.trim()) { setSignError(t("اسم الموقّع مطلوب", "Signer name is required")); return; }
    setBusy(true);
    try {
      const r = await api.sign.sendQuote(signFor.id, {
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer" }],
        message: signForm.message,
        expiresInDays: 30,
      });
      if (r.error) {
        push("error", t(`حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`, `Request saved but DocuSeal did not respond: ${r.error}`));
      } else {
        push("success", t(`تم إرسال العرض للتوقيع إلى ${signForm.email}`, `Quote sent for signing to ${signForm.email}`));
        if (signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      closeSign();
    } catch (e: any) {
      setSignError(e instanceof ApiError ? (e.message === "already_pending" ? t("يوجد طلب توقيع نشط لهذا العرض", "There is an active signing request for this quote") : e.message) : t("فشل الإرسال", "Send failed"));
    } finally { setBusy(false); }
  };

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={t("عرض سعر جديد", "New quote")}
          subtitle={t("املأ البيانات الأساسية · يمكنك التعديل لاحقاً", "Fill in the basic details · you can edit later")}
          onClose={closeCreate}
          disableEscape={busy}
          draft={draft}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-primary hover:bg-primary/80">
                  {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-green-500 text-green-700 hover:bg-green-50" title={t("إرسال للعميل", "Send to customer")}>
                  {busy ? "..." : t("حفظ + إرسال", "Save + send")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="w-full max-w-none mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

            {/* Top fields row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("العميل", "Customer")} *</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => setForm({ ...form, contactId: id })}
                  onCreate={async (name) => {
                    const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                    setCustomers((prev) => [c, ...prev]);
                    push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                    return c.id;
                  }}
                  items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                  placeholder={t("ابحث عن عميل...", "Search for a customer...")}
                  createLabel={(q) => t(`+ إنشاء "${q}"`, `+ Create "${q}"`)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("تاريخ العرض", "Quote date")} *</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} required inputClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("صالح حتى", "Valid until")} *</Label>
                <DateInput value={form.validUntil} onChange={(iso) => setForm({ ...form, validUntil: iso })} required inputClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("رقم العرض", "Quote number")}</Label>
                <Input value={form.quoteNumber} onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })} placeholder={t("# تلقائي", "# Auto")} dir="ltr" className="border-border font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("المرجع", "Reference")}</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم مرجع داخلي", "Internal reference number")} className="border-border h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("العملة", "Currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.label.ar, c.label.en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("المبالغ", "Amounts")}</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-exclusive">{t("غير شاملة الضريبة", "Exclusive of tax")}</SelectItem>
                    <SelectItem value="all-inclusive">{t("شاملة الضريبة", "Inclusive of tax")}</SelectItem>
                    <SelectItem value="custom">{t("مخصصة لكل بند", "Custom per line")}</SelectItem>
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
              direction="sales"
              minRows={10}
              products={products.map((p: any) => ({ id: p.id, name: displayName(p), sku: p.sku, unitPrice: Number(p.unitPrice) || 0, defaultAccountId: p.incomeAccountId }))}
              accounts={accounts.map((a: any) => ({ id: a.id, code: a.code, name: displayName(a), type: a.type, subtype: a.subtype }))}
              onCreateProduct={async (name: string) => {
                const created = await (api as any).products.create({ name, type: "SERVICE", unitPrice: "0", isActive: true });
                setProducts((prev) => [created, ...prev]);
                return { id: created.id, name: created.name, sku: created.sku, unitPrice: 0 };
              }}
              onCreateAccount={async (name: string) => {
                const created = await (api as any).accounts.create({ name, type: "REVENUE", code: String(4000 + Math.floor(Math.random() * 100)) });
                setAccounts((prev) => [created, ...prev]);
                return { id: created.id, code: created.code, name: created.name, type: created.type };
              }}
            />

            <DocumentDropZone
              compact
              target="quote-lines"
              hint={t("استخرج بنود عرض السعر من هذا المستند", "Extract quote line items from this document")}
              defaultTaxRate={0.15}
              currency={form.currency}
              onExtracted={(data: ExtractedDocument) => {
                if (!data.lines || data.lines.length === 0) {
                  push("info", t("لم يتم استخراج بنود من المستند", "No line items were extracted from the document"));
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
                if (data.notes) setForm((f) => ({ ...f, notes: data.notes || f.notes }));
                push("success", t(`تم استخراج ${newLines.length} بنداً`, `Extracted ${newLines.length} line item(s)`));
              }}
              onError={(msg) => push("error", msg)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("شروط ومدة التنفيذ", "Terms and delivery period")}</Label>
                <textarea
                  rows={3}
                  placeholder={t("شروط الدفع · مدة التنفيذ · ضمانات...", "Payment terms · delivery period · warranties...")}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("الإجمالي", "Total")}</Label>
                <div className="rounded-lg border border-border bg-white p-4 space-y-2">
                  {(() => {
                    const totals = computeTotals(lines);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("المجموع الفرعي", "Subtotal")}</span>
                          <span className="font-english text-end whitespace-nowrap shrink-0">{form.currency} {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("الضريبة (15%)", "Tax (15%)")}</span>
                          <span className="font-english text-end whitespace-nowrap shrink-0">{form.currency} {totals.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                          <span className="text-foreground min-w-0 break-words" style={{ fontWeight: 600 }}>{t("الإجمالي:", "Total:")}</span>
                          <span className="font-english text-foreground text-end whitespace-nowrap shrink-0" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
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

  // Full-page Sign form
  if (signFor) {
    return (
      <>
        <FullPageForm
          title={t(`إرسال ${signFor.quoteNumber} للتوقيع`, `Send ${signFor.quoteNumber} for signing`)}
          subtitle={t("DocuSeal · sign.ensidex.com · صلاحية الرابط 30 يوم", "DocuSeal · sign.ensidex.com · link valid for 30 days")}
          onClose={closeSign}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSign} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" disabled={busy} onClick={handleSignSubmit} className="bg-primary hover:bg-primary/90">
                <FileSignature className="me-2 h-4 w-4" />{busy ? "..." : t("إرسال للتوقيع", "Send for signing")}
              </Button>
            </div>
          }
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {signError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{signError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("اسم الموقّع", "Signer name")} *</Label>
                <Input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder={t("الاسم الكامل", "Full name")} /></div>
              <div className="space-y-2"><Label>{t("البريد الإلكتروني", "Email")} *</Label>
                <Input type="email" value={signForm.email} onChange={(e) => setSignForm({ ...signForm, email: e.target.value })} dir="ltr" className="font-english" placeholder="signer@example.com" /></div>
            </div>
            <div className="space-y-2"><Label>{t("الرسالة المرفقة", "Attached message")}</Label>
              <textarea value={signForm.message} onChange={(e) => setSignForm({ ...signForm, message: e.target.value })} rows={4} className="w-full rounded-md border border-border px-3 py-2 text-sm" /></div>
            <p className="text-xs text-muted-foreground">{t("سيستلم الموقّع رابطاً عبر البريد لمراجعة العرض وتوقيعه · صلاحية الرابط 30 يوم.", "The signer will receive a link by email to review and sign the quote · link valid for 30 days.")}</p>
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
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("عروض الأسعار", "Quotes")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة عروض الأسعار للعملاء", "Manage customer quotes")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("عرض سعر جديد", "New quote")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي العروض", "Total quotes")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("معلقة (في انتظار الرد)", "Pending (awaiting response)")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{pending}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("مقبولة", "Accepted")}</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{accepted}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("القيمة الإجمالية", "Total value")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">{t("قائمة العروض", "Quote list")}</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder={t("بحث...", "Search...")} className="w-64 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد عروض أسعار بعد", "No quotes yet")}</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("رقم العرض", "Quote no.")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("العميل", "Customer")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("صالح حتى", "Valid until")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الإجمالي", "Total")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-border/50 hover:bg-primary/5">
                    <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{q.quoteNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground/80">{q.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{q.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{q.validUntil?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }}>{Number(q.total).toLocaleString()} {q.currency}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status] ? t(STATUS_LABELS[q.status].ar, STATUS_LABELS[q.status].en) : q.status}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {q.status !== "CONVERTED" && q.status !== "REJECTED" && (
                          <button onClick={() => openSign(q)} className="rounded-md px-2 py-1 text-xs text-primary hover:bg-blue-50 flex items-center gap-1" title={t("إرسال للتوقيع", "Send for signing")}>
                            <FileSignature className="h-3.5 w-3.5" /> {t("توقيع", "Sign")}
                          </button>
                        )}
                        {q.status !== "CONVERTED" && (
                          pendingConvert === q.id ? (
                            <InlineConfirm onConfirm={() => handleConvert(q)} onCancel={() => setPendingConvert(null)} label={t("تحويل لفاتورة؟", "Convert to invoice?")} />
                          ) : (
                            <button onClick={() => setPendingConvert(q.id)} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1" title={t("تحويل لفاتورة", "Convert to invoice")}>
                              <ArrowLeftRight className="h-3.5 w-3.5" /> {t("تحويل", "Convert")}
                            </button>
                          )
                        )}
                        {pendingDelete === q.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(q.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={() => setPendingDelete(q.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
