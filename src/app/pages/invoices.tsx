/**
 * Sales Invoices · wired to /api/invoices · org-scoped
 * UX-1: NO modal · NO slide-over.
 * UX pattern: FullPageForm (replaces content area on create/sign · مطابق Wafeq) + InlineConfirm + Toasts.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Plus, Search, Trash2, Loader2, FileText, FileSignature } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { InvoicePreviewPane } from "../components/invoice-preview-pane";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { QuickCreateAccount, QuickCreateProduct } from "../components/quick-create-modals";
import { QuickContactDialog } from "../components/quick-contact-dialog";
import { normalizeDigits } from "../lib/digits";
import { useKeyboardShortcuts } from "../lib/use-keyboard-shortcuts";
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
  invoiceNumber: "", // auto-generated if empty
  reference: "",     // customer PO / external reference
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  currency: "SAR",
  paymentTerms: "net30", // net15 | net30 | net60 | due-on-receipt | custom
  brandTemplate: "default",
  notes: "",
};

const PAYMENT_TERMS = [
  { value: "due-on-receipt", label: "مستحق فور الاستلام", days: 0 },
  { value: "net15", label: "صافي 15 يوم", days: 15 },
  { value: "net30", label: "صافي 30 يوم", days: 30 },
  { value: "net60", label: "صافي 60 يوم", days: 60 },
  { value: "net90", label: "صافي 90 يوم", days: 90 },
];

const CURRENCIES = [
  { value: "SAR", label: "ريال سعودي · SAR" },
  { value: "USD", label: "دولار أمريكي · USD" },
  { value: "EUR", label: "يورو · EUR" },
  { value: "GBP", label: "جنيه إسترليني · GBP" },
  { value: "AED", label: "درهم إماراتي · AED" },
  { value: "KWD", label: "دينار كويتي · KWD" },
];

const BRAND_TEMPLATES = [
  { value: "default", label: "افتراضي" },
  { value: "minimal", label: "مينيمال" },
  { value: "classic", label: "كلاسيكي" },
];

export function Invoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Side-panel state for create + sign capture (NO Dialog)
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Multi-line items · UX-5 · Excel paste + bulk tax mode
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");

  // Quick-create modals (UX-77) · open promise-based · resolve when user saves
  const [quickProductReq, setQuickProductReq] = useState<{
    name: string;
    resolve: (p: any) => void;
    reject: () => void;
  } | null>(null);
  const [quickAccountReq, setQuickAccountReq] = useState<{
    name: string;
    resolve: (a: any) => void;
    reject: () => void;
  } | null>(null);

  const [signFor, setSignFor] = useState<Invoice | null>(null);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "BANK_TRANSFER" as any, date: new Date().toISOString().slice(0,10), notes: "" });
  const [payBusy, setPayBusy] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void editingInvoice;
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Quick-create contact dialog (full form, not just name)
  const [pendingContact, setPendingContact] = useState<{ name: string; resolve: (id: string) => void; reject: () => void } | null>(null);

  // Split-view preview · UX-7 · click row → preview pane on side (Wafeq pattern)
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Quick-create customer · UX-5 · nested SidePanel
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [quickCust, setQuickCust] = useState({ displayName: "", email: "", phone: "" });
  const [quickCustError, setQuickCustError] = useState<string | null>(null);

  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, contactsRes, productsRes, accountsRes] = await Promise.all([
        api.invoices.list({ limit: 200 }),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(invRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // Auto-open create form when ?new=1 (from Sales Dashboard quick-create)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setForm(EMPTY_FORM);
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setCreateOpen(true);
      // Clean the URL after opening
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setCreateOpen(true);
    // Auto-fetch next invoice number so user sees it immediately (editable)
    api.invoices.nextNumber().then(({ number }) => {
      setForm((f: any) => ({ ...f, invoiceNumber: number }));
    }).catch(() => { /* silent · falls back to placeholder */ });
  };
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); };

  // Keyboard shortcuts (UX-7) · skip when create form is open · those have own Esc handler
  useKeyboardShortcuts({
    n: () => { if (!createOpen && !signFor) openCreate(); },
    "/": () => {
      const search = document.querySelector<HTMLInputElement>('input[placeholder="بحث..."]');
      search?.focus();
    },
    escape: () => { if (previewId && !createOpen && !signFor) setPreviewId(null); },
  }, [createOpen, signFor, previewId]);

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
    // Validate lines · at least one row with description AND unitPrice
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError("أضف بنداً واحداً على الأقل (وصف + سعر)"); return; }
    setBusy(true);
    try {
      // For now: draft always saves as DRAFT · approve+send saves as SENT
      // TODO: when backend supports APPROVED state, map approve → APPROVED, send → SENT
      const status = action === "draft" ? "DRAFT" : "SENT";
      const inv = await api.invoices.create({
        contactId: form.contactId,
        invoiceNumber: form.invoiceNumber || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
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
      setItems(prev => [inv as Invoice, ...prev]);
      const msg = action === "draft" ? `تم حفظ ${inv.invoiceNumber} كمسودة`
                : action === "approve" ? `تم اعتماد ${inv.invoiceNumber}`
                : `تم إرسال ${inv.invoiceNumber} للعميل`;
      push("success", msg);
      // Auto-trigger email send after approve+send
      if (action === "send" && inv.id) {
        try {
          await (api as any).email?.sendInvoice?.(inv.id, { message: form.notes || undefined });
        } catch (e) { /* email might fail if no customer email · don't block */ }
      }
      // UX-177 · stay on the saved invoice instead of returning to list
      // Switch to edit mode of the freshly-saved invoice · preserve all form fields
      setEditingInvoice(inv as Invoice);
      setForm((prev) => ({ ...prev, invoiceNumber: inv.invoiceNumber }));
      // Keep createOpen true · just refresh state
      // closeCreate();   // ❌ removed · was bouncing user back to list and losing context
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

  // Approve a DRAFT invoice · transitions DRAFT → SENT (backend: status=APPROVED state coming · for now uses SENT)
  const handleApprove = async (inv: Invoice) => {
    try {
      const updated = await api.invoices.update(inv.id, { status: "SENT" });
      setItems(prev => prev.map(x => x.id === inv.id ? { ...x, status: "SENT" } as Invoice : x));
      push("success", `تم اعتماد ${inv.invoiceNumber}`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الاعتماد");
    }
  };

  const openRecordPayment = (inv: Invoice) => {
    const remaining = Number(inv.total) - Number(inv.amountPaid || 0);
    setPayFor(inv);
    setPayForm({
      amount: remaining > 0 ? String(remaining.toFixed(2)) : String(Number(inv.total).toFixed(2)),
      method: "BANK_TRANSFER",
      date: new Date().toISOString().slice(0, 10),
      notes: `دفعة على الفاتورة ${inv.invoiceNumber}`,
    });
  };
  const closeRecordPayment = () => { setPayFor(null); };
  const handleRecordPayment = async () => {
    if (!payFor) return;
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { push("error", "أدخل مبلغ صحيح"); return; }
    setPayBusy(true);
    try {
      // Create RECEIPT voucher linked to this invoice + customer
      await (api as any).vouchers.create({
        kind: "RECEIPT",
        date: payForm.date,
        contactId: payFor.contactId,
        invoiceId: payFor.id,
        amount: amt,
        currency: payFor.currency,
        paymentMethod: payForm.method,
        description: payForm.notes,
      });
      // Update invoice amountPaid
      const newPaid = Number(payFor.amountPaid || 0) + amt;
      const total = Number(payFor.total);
      const newStatus = newPaid >= total ? "PAID" : newPaid > 0 ? "PARTIAL" : payFor.status;
      await api.invoices.update(payFor.id, { status: newStatus as any, amountPaid: String(newPaid) } as any);
      setItems(prev => prev.map(x => x.id === payFor.id ? { ...x, amountPaid: String(newPaid), status: newStatus as any } : x));
      push("success", `تم تسجيل دفعة ${amt} ${payFor.currency}`);
      closeRecordPayment();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التسجيل");
    } finally { setPayBusy(false); }
  };

    const openEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setForm({
      ...EMPTY_FORM,
      contactId: inv.contactId,
      invoiceNumber: inv.invoiceNumber,
      issueDate: String(inv.issueDate).slice(0, 10),
      dueDate: inv.dueDate ? String(inv.dueDate).slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: inv.currency,
      notes: inv.notes || "",
      reference: (inv as any).reference || "",
    } as any);
    setLines(((inv.lines as any[]) || []).map((l: any) => ({
      id: l.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: l.description || "",
      quantity: String(l.quantity || 1),
      unitPrice: String(l.unitPrice || 0),
      taxRate: 0.15,
      taxInclusive: false,
      productId: l.productId || null,
      accountId: l.accountId || null,
    })));
    setCreateOpen(true);
    setCreateError(null);
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

  // Full-page Create form (hides list view) · Wafeq-style replace-content pattern
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title="فاتورة جديدة"
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
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-green-500 text-green-700 hover:bg-green-50" title="إرسال للعميل بالبريد">
                  {busy ? "..." : "اعتماد + إرسال"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="max-w-7xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

            {/* Top row · 6 fields per Wafeq screenshot · 2026-05-05 */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">جهة الاتصال *</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => {
                    setForm({ ...form, contactId: id });
                    // Auto-fill reference: contactCode + invoice sequence (editable)
                    const c = customers.find((x) => x.id === id);
                    if (c?.customCode) {
                      const seq = items.filter((iv: any) => iv.contactId === id).length + 1;
                      setForm((prev: any) => ({ ...prev, contactId: id, reference: prev.reference || `${c.customCode}-${String(seq).padStart(2, '0')}` }));
                    }
                  }}
                  onCreate={(name) => new Promise<string>((resolve, reject) => {
                    setPendingContact({ name, resolve, reject });
                  })}
                  items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                  placeholder="ابحث عن عميل..."
                  createLabel={(q) => `+ إنشاء "${q}"`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">تاريخ الإصدار *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">تاريخ الاستحقاق *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">رقم الفاتورة</Label>
                <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                  placeholder="# تلقائي" dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">المرجع</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم مرجع العميل" className="border-[#E5E7EB] h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">الدفع الإلكتروني</Label>
                <button
                  type="button"
                  className="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-xs flex items-center justify-between hover:border-[#1276E3]"
                >
                  <span className="flex items-center gap-1">
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1 rounded">MC</span>
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1 rounded">VISA</span>
                  </span>
                  <span className="text-[#1276E3]">إعداد الدفع</span>
                </button>
              </div>
            </div>

            {/* Second row · currency + tax mode + brand template + documents button */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">قالب العلامة التجارية</Label>
                <Select value={form.brandTemplate} onValueChange={(v) => setForm({ ...form, brandTemplate: v })}>
                  <SelectTrigger className="h-9 border-[#E5E7EB] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRAND_TEMPLATES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">شروط الدفع</Label>
                <Select value={form.paymentTerms} onValueChange={(v) => {
                  const t = PAYMENT_TERMS.find((p) => p.value === v);
                  if (t) {
                    const due = new Date(form.issueDate);
                    due.setDate(due.getDate() + t.days);
                    setForm({ ...form, paymentTerms: v, dueDate: due.toISOString().slice(0, 10) });
                  } else {
                    setForm({ ...form, paymentTerms: v });
                  }
                }}>
                  <SelectTrigger className="h-9 border-[#E5E7EB] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items table v2 · with product picker + account picker */}
            <ItemsTable
              lines={lines}
              setLines={setLines}
              mode={taxMode}
              onModeChange={setTaxMode}
              defaultTaxRate={0.15}
              currency={form.currency}
              direction="sales"
              products={products.map((p: any) => ({
                id: p.id,
                name: p.nameAr || p.name,
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                accountId: p.incomeAccountId,
              }))}
              accounts={accounts.map((a: any) => ({
                id: a.id,
                code: a.code,
                name: a.nameAr || a.name,
                type: a.type,
              }))}
              onCreateProduct={(name) => new Promise((resolve, reject) => {
                setQuickProductReq({ name, resolve, reject });
              })}
              onCreateAccount={(name) => new Promise((resolve, reject) => {
                setQuickAccountReq({ name, resolve, reject });
              })}
              minRows={10}
            />

            {/* Document drop zone · matches the screenshot's "اسحب ملفات هنا" bar */}
            <DocumentDropZone
              compact
              target="invoice-lines"
              hint="استخرج بنود الفاتورة من هذا المستند"
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
                  notes: l.notes || undefined,
                }));
                setLines(newLines);
                if (data.documentNumber && !form.invoiceNumber) {
                  setForm((f) => ({ ...f, reference: data.documentNumber || f.reference }));
                }
                if (data.dueDate) setForm((f) => ({ ...f, dueDate: data.dueDate || f.dueDate }));
                if (data.notes) setForm((f) => ({ ...f, notes: data.notes || f.notes }));
                push("success", `تم استخراج ${newLines.length} بنداً بثقة ${Math.round(data.confidence * 100)}%`);
              }}
              onError={(msg) => push("error", msg)}
            />

            {/* Totals + payment terms + notes · 2-column footer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[#374151] text-xs">شروط الدفع · ملاحظة للعميل</Label>
                  <textarea
                    rows={3}
                    placeholder="مثلاً: الدفع خلال 30 يوم من تاريخ الفاتورة عبر تحويل بنكي..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
                  />
                </div>
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
                          <span className="font-english text-[#0B1B49]">{form.currency} {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6B7280]">ضريبة القيمة المضافة (15%)</span>
                          <span className="font-english text-[#0B1B49]">{form.currency} {totals.tax.toFixed(2)}</span>
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
              {/* Record Payment dialog (UX-187) */}
      {payFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeRecordPayment}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#0B1B49]" style={{ fontWeight: 700, fontSize: "1.05rem" }}>💰 تسجيل دفعة على {payFor.invoiceNumber}</h3>
              <button onClick={closeRecordPayment} className="text-[#9CA3AF]">✕</button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                إجمالي الفاتورة: <span className="font-english">{Number(payFor.total).toFixed(2)} {payFor.currency}</span>
                {Number(payFor.amountPaid || 0) > 0 && <> · المدفوع: <span className="font-english">{Number(payFor.amountPaid).toFixed(2)}</span></>}
                {" · "}المتبقي: <span className="font-english font-semibold">{(Number(payFor.total) - Number(payFor.amountPaid || 0)).toFixed(2)}</span>
              </div>
              <div>
                <label className="text-xs text-[#374151]">المبلغ *</label>
                <input value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: normalizeDigits(e.target.value)})} dir="ltr" className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm font-english" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#374151]">طريقة الدفع</label>
                  <select value={payForm.method} onChange={(e) => setPayForm({...payForm, method: e.target.value})} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    <option value="BANK_TRANSFER">تحويل بنكي</option>
                    <option value="CASH">نقدي</option>
                    <option value="CARD">بطاقة</option>
                    <option value="MADA">مدى</option>
                    <option value="STC_PAY">STC Pay</option>
                    <option value="CHECK">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#374151]">التاريخ</label>
                  <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} dir="ltr" className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm font-english" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#374151]">ملاحظات</label>
                <input value={payForm.notes} onChange={(e) => setPayForm({...payForm, notes: e.target.value})} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeRecordPayment} className="px-4 py-2 rounded-md border border-[#E5E7EB] text-sm">إلغاء</button>
              <button onClick={handleRecordPayment} disabled={payBusy} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm" style={{fontWeight:600}}>
                {payBusy ? "..." : "حفظ الدفعة + إنشاء سند قبض"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />

        {/* Quick-create Product modal · opens when user types unknown item name */}
        {quickProductReq && (
          <QuickCreateProduct
            initialName={quickProductReq.name}
            accounts={accounts.map((a: any) => ({ id: a.id, name: a.nameAr || a.name, code: a.code, type: a.type }))}
            onCreate={async (input) => {
              const p = await (api as any).products.create(input);
              setProducts((prev) => [p, ...prev]);
              return {
                id: p.id,
                name: p.nameAr || p.name,
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                taxRate: Number(p.taxRate) || 0.15,
                incomeAccountId: p.incomeAccountId,
              };
            }}
            onClose={() => { quickProductReq.reject(); setQuickProductReq(null); }}
            onCreated={(p) => {
              quickProductReq.resolve({
                id: p.id,
                name: p.name,
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                taxRate: p.taxRate,
                accountId: p.incomeAccountId,
              });
              setQuickProductReq(null);
              push("success", `تم إنشاء المنتج · ${p.name}`);
            }}
          />
        )}

        {/* Quick-create Account modal · opens when user types unknown account name */}
        {quickAccountReq && (
          <QuickCreateAccount
            initialName={quickAccountReq.name}
            defaultType="EXPENSE"
            onCreate={async (input) => {
              const a = await (api as any).accounts.create({ ...input, type: input.type === 'INCOME' ? 'REVENUE' : input.type });
              setAccounts((prev) => [a, ...prev]);
              return { id: a.id, name: a.nameAr || a.name, code: a.code, type: a.type };
            }}
            onClose={() => { quickAccountReq.reject(); setQuickAccountReq(null); }}
            onCreated={(a) => {
              quickAccountReq.resolve(a);
              setQuickAccountReq(null);
              push("success", `تم إنشاء الحساب · ${a.name}`);
            }}
          />
        )}
      </>
    );
  }

  // Full-page Sign form (hides list view)
  if (signFor) {
    return (
      <>
        <FullPageForm
          title={`إرسال ${signFor.invoiceNumber} للتوقيع`}
          subtitle="DocuSeal · sign.ensidex.com · صلاحية الرابط 30 يوم"
          onClose={closeSign}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSign} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" disabled={busy} onClick={handleSignSubmit} className="bg-[#1276E3] hover:bg-[#1060C0]">
                <FileSignature className="me-2 h-4 w-4" />{busy ? "..." : "إرسال للتوقيع"}
              </Button>
            </div>
          }
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {signError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{signError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>اسم الموقّع *</Label>
                <Input value={signForm.name} onChange={(e) => setSignForm({ ...signForm, name: e.target.value })} placeholder="الاسم الكامل" /></div>
              <div className="space-y-2"><Label>البريد الإلكتروني *</Label>
                <Input type="email" value={signForm.email} onChange={(e) => setSignForm({ ...signForm, email: e.target.value })} dir="ltr" className="font-english" placeholder="signer@example.com" /></div>
            </div>
            <div className="space-y-2"><Label>الرسالة المرفقة</Label>
              <textarea value={signForm.message} onChange={(e) => setSignForm({ ...signForm, message: e.target.value })} rows={4} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" /></div>
            <p className="text-xs text-[#6B7280]">سيستلم الموقّع رابطاً عبر البريد لمراجعة الفاتورة وتوقيعها · صلاحية الرابط 30 يوم.</p>
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // Default · list view (with optional split-view preview pane)
  const previewInvoice = previewId ? items.find((x) => x.id === previewId) || null : null;
  const previewCustomer = previewInvoice ? customers.find((c) => c.id === previewInvoice.contactId) || null : null;
  const splitMode = !!previewInvoice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المبيعات</h1>
          <p className="text-[#6B7280] mt-1">إدارة فواتير العملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />فاتورة جديدة</Button>
      </div>

      <div className={`grid grid-cols-1 ${splitMode ? "md:grid-cols-2" : "md:grid-cols-4"} gap-4`}>
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

      <div className={`grid grid-cols-1 ${splitMode ? "lg:grid-cols-[1fr_1.2fr]" : ""} gap-4`}>
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
                {!splitMode && <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التاريخ</th>}
                {!splitMode && <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاستحقاق</th>}
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
                {!splitMode && <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>المتبقي</th>}
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(i => (
                  <tr
                    key={i.id}
                    onClick={() => setPreviewId(previewId === i.id ? null : i.id)}
                    className={`border-b border-[#F3F4F6] cursor-pointer transition-colors ${previewId === i.id ? "bg-[#E0F2FE] hover:bg-[#E0F2FE]" : "hover:bg-[#F4FCFF]"}`}
                  >
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{i.invoiceNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{i.contact?.displayName || "—"}</td>
                    {!splitMode && <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{i.issueDate?.slice(0, 10)}</td>}
                    {!splitMode && <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{i.dueDate?.slice(0, 10)}</td>}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[i.status]}`}>{STATUS_LABELS[i.status] || i.status}</span>
                        {i.status === "DRAFT" && (
                          <button onClick={(e) => { e.stopPropagation(); handleApprove(i); }} className="rounded-md px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-50 border border-green-200" title="اعتماد الفاتورة">
                            ✓
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(i.total).toLocaleString()} {i.currency}</td>
                    {!splitMode && <td className="py-3 px-4 font-english text-sm text-amber-600" style={{ fontWeight: 600 }}>{(Number(i.total) - Number(i.amountPaid || 0)).toLocaleString()}</td>}
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* SENT/APPROVED → Sign button */}
                        {i.status !== "PAID" && i.status !== "CANCELLED" && i.status !== "DRAFT" && (
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

      {/* Split-view preview pane · shows when a row is clicked */}
      {splitMode && previewInvoice && (
        <InvoicePreviewPane
          doc={{
            id: previewInvoice.id,
            number: previewInvoice.invoiceNumber,
            status: previewInvoice.status,
            issueDate: previewInvoice.issueDate,
            dueDate: previewInvoice.dueDate,
            total: previewInvoice.total,
            amountPaid: previewInvoice.amountPaid,
            currency: previewInvoice.currency,
            notes: (previewInvoice as any).notes,
            lines: (previewInvoice as any).lines,
          }}
          customer={previewCustomer}
          statusLabels={STATUS_LABELS}
          statusColors={STATUS_COLORS}
          docTypeLabel="فاتورة"
          onClose={() => setPreviewId(null)}
          onApprove={previewInvoice.status === "DRAFT" ? () => handleApprove(previewInvoice) : undefined}
          onRecordPayment={() => openRecordPayment(SOMEVAR)} onSign={() => openSign(previewInvoice)} onRecordPayment={() => openRecordPayment(previewInvoice)} onEdit={() => openEdit(previewInvoice)}
          onDelete={() => setPendingDelete(previewInvoice.id)}
        />
      )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {pendingContact && (
        <QuickContactDialog
          initialName={pendingContact.name}
          defaultRole="customer"
          onCancel={() => { pendingContact.reject(); setPendingContact(null); }}
          onCreated={(c) => {
            setCustomers((prev) => [c, ...prev]);
            push("success", `تم إنشاء ${c.displayName}`);
            pendingContact.resolve(c.id);
            setPendingContact(null);
          }}
        />
      )}
    </div>
  );
}
