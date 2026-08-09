/**
 * Sales Invoices · wired to /api/invoices · org-scoped
 * UX-1: NO modal · NO slide-over.
 * UX pattern: FullPageForm (replaces content area on create/sign · مطابق Wafeq) + InlineConfirm + Toasts.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Plus, Search, Trash2, Loader2, FileText, FileSignature, Split, Pencil, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { QuickCreateAccount, QuickCreateProduct } from "../components/quick-create-modals";
import { QuickContactDialog } from "../components/quick-contact-dialog";
import { normalizeDigits } from "../lib/digits";
import { useKeyboardShortcuts } from "../lib/use-keyboard-shortcuts";
import { api, Invoice, Contact } from "../lib/api";
import { displayName } from "../lib/display-name";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" }, APPROVED: { ar: "معتمدة", en: "Approved" }, SENT: { ar: "مرسلة", en: "Sent" }, VIEWED: { ar: "مُشاهَدة", en: "Viewed" }, PAID: { ar: "مدفوعة", en: "Paid" },
  PARTIAL: { ar: "مدفوعة جزئياً", en: "Partially paid" }, OVERDUE: { ar: "متأخرة", en: "Overdue" }, CANCELLED: { ar: "ملغاة", en: "Cancelled" },
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
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
  { value: "due-on-receipt", label: { ar: "مستحق فور الاستلام", en: "Due on receipt" }, days: 0 },
  { value: "net15", label: { ar: "صافي 15 يوم", en: "Net 15 days" }, days: 15 },
  { value: "net30", label: { ar: "صافي 30 يوم", en: "Net 30 days" }, days: 30 },
  { value: "net60", label: { ar: "صافي 60 يوم", en: "Net 60 days" }, days: 60 },
  { value: "net90", label: { ar: "صافي 90 يوم", en: "Net 90 days" }, days: 90 },
];

const CURRENCIES = [
  { value: "SAR", label: { ar: "ريال سعودي · SAR", en: "Saudi Riyal · SAR" } },
  { value: "USD", label: { ar: "دولار أمريكي · USD", en: "US Dollar · USD" } },
  { value: "EUR", label: { ar: "يورو · EUR", en: "Euro · EUR" } },
  { value: "GBP", label: { ar: "جنيه إسترليني · GBP", en: "British Pound · GBP" } },
  { value: "AED", label: { ar: "درهم إماراتي · AED", en: "UAE Dirham · AED" } },
  { value: "KWD", label: { ar: "دينار كويتي · KWD", en: "Kuwaiti Dinar · KWD" } },
];

const BRAND_TEMPLATES = [
  { value: "default", label: { ar: "افتراضي", en: "Default" } },
  { value: "minimal", label: { ar: "مينيمال", en: "Minimal" } },
  { value: "classic", label: { ar: "كلاسيكي", en: "Classic" } },
];

export function Invoices() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Side-panel state for create + sign capture (NO Dialog)
  const [createOpen, setCreateOpen] = useState(false);
  const { goBack: goBackToSource } = useReturnTo();
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Multi-line items · UX-5 · Excel paste + bulk tax mode
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");
  // PR5-B · prefilled invoice number is only sent when the USER edited it;
  // otherwise the server allocates a collision-proof number (kills duplicate_invoice_number)
  const [numberEdited, setNumberEdited] = useState(false);
  const numberRetryRef = useRef(false);
  // PR5-C · line ids that failed validation → rendered red in ItemsTable
  const [invalidLineIds, setInvalidLineIds] = useState<Set<string>>(new Set());

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
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingApprove, setPendingApprove] = useState<string | null>(null);

  // Quick-create contact dialog (full form, not just name)
  const [pendingContact, setPendingContact] = useState<{ name: string; resolve: (id: string) => void; reject: () => void } | null>(null);


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
      push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // PR5-D · a payment recorded on the receipts page must be visible as soon as
  // the user returns to this window/tab — no more "click edit to see it".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // PR5-C · clear the red line highlight as soon as the user edits any line
  useEffect(() => {
    setInvalidLineIds((prev) => (prev.size ? new Set() : prev));
  }, [lines]);

  // Auto-open create form when /new or ?new=1 (from Sales Dashboard quick-create)
  useEffect(() => {
    if (location.pathname.endsWith("/new") || searchParams.get("new") === "1") {
      const prefillContact = searchParams.get("contactId") || "";
      setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setNumberEdited(false);
      numberRetryRef.current = false;
      setEditingInvoice(null);
      setCreateOpen(true);
      // Clean the query URL after opening, but keep canonical /new routes stable.
      if (searchParams.get("new") === "1") setSearchParams({}, { replace: true });
    }
  }, [location.pathname, searchParams, setSearchParams]);

  // Deep link · /app/invoices/:id (from contact-detail, receipts, search) → open THAT
  // invoice in edit view instead of dumping the user back on the bare list.
  useEffect(() => {
    const m = location.pathname.match(/\/app\/(?:sales\/)?invoices\/([^/]+)/);
    const id = m?.[1];
    if (!id || editingInvoice?.id === id || createOpen) return;
    const row = items.find((x) => x.id === id);
    if (row) { openEdit(row); return; }
    api.invoices.get(id)
      .then((full) => openEdit(full as Invoice))
      .catch(() => { /* unknown/stale id → stay on the list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, items]);

  // Per-contact filter · /app/invoices?contactId=<id> shows only that contact's invoices
  const contactFilterId = searchParams.get("contactId") || "";
  const contactFilterName = contactFilterId ? (customers.find((c) => c.id === contactFilterId)?.displayName || "") : "";

  const filtered = items.filter(i => {
    if (contactFilterId && i.contactId !== contactFilterId) return false;
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
    const prefillContact = searchParams.get("contactId") || "";
    setForm(prefillContact ? { ...EMPTY_FORM, contactId: prefillContact } : EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setNumberEdited(false);
    numberRetryRef.current = false;
    setInvalidLineIds(new Set());
    setEditingInvoice(null);
    setCreateOpen(true);
    // Auto-fetch next invoice number so user sees it immediately (editable)
    api.invoices.nextNumber().then(({ number }) => {
      setForm((f: any) => ({ ...f, invoiceNumber: number }));
    }).catch(() => { /* silent · falls back to placeholder */ });
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    setEditingInvoice(null);
    // Opened from another page (contact file etc.) → go back there
    if (goBackToSource()) return;
    // If we were on a deep link (/app/invoices/:id), return to the canonical list
    if (/\/invoices\/[^/]+/.test(location.pathname)) {
      navigate("/app/invoices", { replace: true });
    }
  };

  // Keyboard shortcuts (UX-7) · skip when create form is open · those have own Esc handler
  useKeyboardShortcuts({
    n: () => { if (!createOpen && !signFor) openCreate(); },
    "/": () => {
      const search = document.querySelector<HTMLInputElement>('input[placeholder="بحث..."], input[placeholder="Search..."]');
      search?.focus();
    },
  }, [createOpen, signFor]);

  // 3-stage workflow: Draft → Approve → Send
  // 'draft' = حفظ كمسودة (always available · default)
  // 'approve' = اعتماد (final commit · enables send · backend will lock edits)
  // 'send' = إرسال (only after approval · triggers email)
  const handleSubmit = async (action: "draft" | "approve" | "send" = "draft") => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر العميل", "Select a customer")); return; }

    const activeLines = lines.filter((l) => {
      const qty = Number(normalizeDigits(l.quantity)) || 0;
      const price = Number(normalizeDigits(l.unitPrice)) || 0;
      return !!l.description.trim() || qty > 0 || price > 0 || !!l.productId || !!l.accountId;
    });
    if (activeLines.length === 0) {
      setCreateError(t("أضف بنداً واحداً على الأقل قبل الحفظ", "Add at least one line item before saving"));
      return;
    }

    const isLineComplete = (l: InvoiceLine) => {
      const qty = Number(normalizeDigits(l.quantity)) || 0;
      const price = Number(normalizeDigits(l.unitPrice)) || 0;
      return l.description.trim().length >= 3 && qty > 0 && price > 0;
    };
    const completeLines = activeLines.filter(isLineComplete);
    const incompleteActive = activeLines.filter((l) => !isLineComplete(l));

    // For approval/send: all active lines must be fully complete.
    // Revenue account is resolved server-side (fallback ladder · PR4) — no FE hard block.
    if (action !== "draft" && incompleteActive.length > 0) {
      setInvalidLineIds(new Set(incompleteActive.map((l) => l.id)));
      setCreateError(t(`لا يمكن الاعتماد: ${incompleteActive.length} بند ناقص (موضّح بالأحمر) · كل بند يحتاج وصفاً واضحاً + كمية أكبر من صفر + سعراً أكبر من صفر`, `Cannot approve: ${incompleteActive.length} incomplete line(s) (highlighted in red) · each line needs a clear description + quantity greater than zero + price greater than zero`));
      return;
    }

    // For draft we only persist completed lines to avoid إنشاء سطور ناقصة بالخطأ.
    const linesToPersist = action === "draft" ? completeLines : activeLines;
    if (linesToPersist.length === 0) {
      setInvalidLineIds(new Set(incompleteActive.map((l) => l.id)));
      setCreateError(t("لا يوجد بند مكتمل للحفظ · البند المكتمل = وصف + كمية + سعر (النواقص موضّحة بالأحمر)", "No complete line to save · a complete line = description + quantity + price (incomplete ones highlighted in red)"));
      return;
    }
    // PR5-C · surface skipped draft lines instead of dropping them silently
    const skippedCount = action === "draft" ? incompleteActive.length : 0;
    if (skippedCount > 0) setInvalidLineIds(new Set(incompleteActive.map((l) => l.id)));

    setBusy(true);
    try {
      // draft → DRAFT · approve → APPROVED · send → APPROVED first (SENT only after email succeeds)
      const status = action === "draft" ? "DRAFT" : "APPROVED";
      const buildPayload = (num?: string) => ({
        contactId: form.contactId,
        ...(num !== undefined ? { invoiceNumber: num } : {}),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        currency: form.currency,
        status,
        notes: form.notes || null,
        termsConditions: form.reference ? `Ref: ${form.reference}` : undefined,
        lines: linesToPersist.map((l) => ({
          productId: l.productId || null,
          accountId: l.accountId || null, // revenue account · server resolves fallback when null
          taxRate: typeof l.taxRate === "number" ? l.taxRate : 0.15, // send numeric rate · server recomputes (B1 fix)
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: l.taxInclusive
            ? Number(normalizeDigits(l.unitPrice)) / (1 + l.taxRate)
            : Number(normalizeDigits(l.unitPrice)),
          // Revenue recognition · only sent when the line has a real schedule
          recognitionStartDate: l.recognitionStartDate || null,
          recognitionMonths: l.recognitionMonths ?? null,
          deferredRevenueAccountId: l.deferredRevenueAccountId || null,
        })),
      });
      const isEdit = !!editingInvoice;
      let inv: any;
      if (isEdit) {
        // UPDATE the existing invoice · number only when it actually changed
        const changedNumber = form.invoiceNumber && form.invoiceNumber !== editingInvoice!.invoiceNumber
          ? form.invoiceNumber
          : undefined;
        inv = await api.invoices.update(editingInvoice!.id, buildPayload(changedNumber) as any);
      } else {
        // PR5-B · the prefilled suggestion is NOT sent unless the user edited it.
        // Server-side allocation is collision-proof → kills duplicate_invoice_number.
        try {
          inv = await api.invoices.create(buildPayload(numberEdited ? form.invoiceNumber || undefined : undefined) as any);
        } catch (e: any) {
          if (e?.code === "duplicate_invoice_number" && !numberRetryRef.current) {
            // Number was taken meanwhile → retry once with server allocation + tell the user
            numberRetryRef.current = true;
            inv = await api.invoices.create(buildPayload(undefined) as any);
            push("info", t(`الرقم السابق كان محجوزاً · تم الحفظ برقم جديد ${inv.invoiceNumber}`, `The previous number was taken · saved with a new number ${inv.invoiceNumber}`));
          } else {
            throw e;
          }
        }
      }
      setItems(prev => isEdit ? prev.map((x) => (x.id === inv.id ? (inv as Invoice) : x)) : [inv as Invoice, ...prev]);
      if (skippedCount > 0) {
        push("info", t(`تم حفظ الفاتورة بدون ${skippedCount} بند ناقص (موضّح بالأحمر) · أكملها من شاشة التعديل`, `Invoice saved without ${skippedCount} incomplete line(s) (highlighted in red) · complete them from the edit screen`));
      }
      setNumberEdited(false);
      setInvalidLineIds(new Set());
      const msg = isEdit ? t(`تم تحديث ${inv.invoiceNumber}`, `Updated ${inv.invoiceNumber}`)
                : action === "draft" ? t(`تم حفظ ${inv.invoiceNumber} كمسودة`, `Saved ${inv.invoiceNumber} as draft`)
                : action === "approve" ? t(`تم اعتماد ${inv.invoiceNumber}`, `Approved ${inv.invoiceNumber}`)
                : t(`تم إرسال ${inv.invoiceNumber} للعميل`, `Sent ${inv.invoiceNumber} to the customer`);
      push("success", msg);
      // Auto-trigger email send after approve+send
      if (action === "send" && inv.id) {
        let payLink: string | undefined;
        try {
          const link = await (api as any).paymentLinks?.create?.(inv.id, "auto");
          payLink = link?.url;
        } catch (e: any) {
          push("info", e?.message || t("لم يتم إنشاء رابط دفع، سيتم إرسال الفاتورة بدون رابط دفع", "No payment link was created; the invoice will be sent without a payment link"));
        }
        try {
          await (api as any).email?.sendInvoice?.(inv.id, { message: form.notes || undefined, payLink });
          push("success", payLink ? t("تم إرسال الفاتورة مع رابط الدفع", "Invoice sent with payment link") : t("تم إرسال الفاتورة بدون رابط دفع", "Invoice sent without payment link"));
          // Email succeeded → transition APPROVED → SENT
          try {
            await api.invoices.update(inv.id, { status: "SENT" });
            inv = { ...inv, status: "SENT" };
            setItems(prev => prev.map(x => x.id === inv.id ? { ...x, status: "SENT" } as Invoice : x));
          } catch {
            push("info", t("أُرسلت الفاتورة لكن تعذر تحديث حالتها إلى «مُرسلة»", "Invoice sent but its status could not be updated to SENT"));
          }
        } catch (e: any) {
          push("error", e?.message || t("تعذر إرسال الفاتورة بالبريد", "Could not send the invoice by email"));
        }
      }
      // UX-177 · stay on the saved invoice instead of returning to list
      // Switch to edit mode of the freshly-saved invoice · preserve all form fields
      setEditingInvoice(inv as Invoice);
      setForm((prev) => ({ ...prev, invoiceNumber: inv.invoiceNumber }));
      // Keep createOpen true · just refresh state
      // closeCreate();   // ❌ removed · was bouncing user back to list and losing context
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" }));
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.invoices.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم حذف الفاتورة", "Invoice deleted"));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
    }
  };

  // Approve a DRAFT invoice · transitions DRAFT → APPROVED
  const handleApprove = async (inv: Invoice) => {
    try {
      // Safety: fetch full invoice to validate lines before accidental approval.
      const full = await api.invoices.get(inv.id);
      const lineItems = (full.lines as any[]) || [];
      const hasIncomplete = lineItems.some((l: any) => {
        const descOk = String(l?.description || "").trim().length >= 3;
        const qtyOk = Number(l?.quantity || 0) > 0;
        const priceOk = Number(l?.unitPrice || 0) > 0;
        return !(descOk && qtyOk && priceOk);
      });
      if (hasIncomplete) {
        push("error", t("لا يمكن الاعتماد: يوجد بند ناقص (الوصف/الكمية/السعر)", "Cannot approve: there is an incomplete line (description/quantity/price)"));
        return;
      }
      // Revenue account is resolved server-side (fallback ladder · PR4) — no FE hard block.
      await api.invoices.update(inv.id, { status: "APPROVED" });
      setItems(prev => prev.map(x => x.id === inv.id ? { ...x, status: "APPROVED" } as Invoice : x));
      push("success", t(`تم اعتماد ${inv.invoiceNumber}`, `Approved ${inv.invoiceNumber}`));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاعتماد", en: "Approve failed" }));
    }
  };

  const handleUnapprove = async (inv: Invoice) => {
    try {
      await api.invoices.update(inv.id, { status: "DRAFT" });
      setItems(prev => prev.map(x => x.id === inv.id ? { ...x, status: "DRAFT" } as Invoice : x));
      push("success", t(`تم إلغاء اعتماد ${inv.invoiceNumber}`, `Unapproved ${inv.invoiceNumber}`));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل إلغاء الاعتماد", en: "Unapprove failed" }));
    }
  };

  const handleSplitByCategory = async (inv: Invoice) => {
    setSplittingId(inv.id);
    try {
      const result = await (api as any).invoiceOps.splitByCategory(inv.id);
      const groups = (result?.groups || []) as Array<{ labelAr: string; lines: number }>;
      const groupText = groups.map((g) => `${g.labelAr} (${g.lines})`).join(" · ");
      push("success", t(`تم تفكيك ${inv.invoiceNumber} إلى ${result?.createdCount || 0} فواتير: ${groupText}`, `Split ${inv.invoiceNumber} into ${result?.createdCount || 0} invoices: ${groupText}`));
      await refresh();
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تفكيك الفاتورة", en: "Split failed" }));
    } finally {
      setSplittingId(null);
    }
  };

  const openRecordPayment = (inv: Invoice) => {
    const remaining = Math.max(Number(inv.total) - Number(inv.amountPaid || 0), 0);
    const params = new URLSearchParams({
      new: "1",
      contactId: inv.contactId,
      invoiceId: inv.id,
      amount: (remaining > 0 ? remaining : Number(inv.total || 0)).toFixed(2),
      date: new Date().toISOString().slice(0, 10),
      reference: inv.invoiceNumber || "",
    });
    navigate(`/app/receipts?${params.toString()}`);
  };

    const openEdit = async (inv: Invoice) => {
    // List rows don't include lines · fetch the full invoice so edit never opens empty
    if (!inv.lines || !(inv.lines as any[]).length) {
      try { inv = await api.invoices.get(inv.id) as Invoice; } catch { /* fall back to row data */ }
    }
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
      // Revenue recognition · hydrate saved schedule back into the line
      recognitionStartDate: l.recognitionStartDate ? String(l.recognitionStartDate).slice(0, 10) : undefined,
      recognitionMonths: l.recognitionMonths ?? undefined,
      deferredRevenueAccountId: l.deferredRevenueAccountId || undefined,
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
      message: t(`يرجى مراجعة وتوقيع الفاتورة رقم ${inv.invoiceNumber}`, `Please review and sign invoice no. ${inv.invoiceNumber}`),
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
      const r = await api.sign.sendInvoice(signFor.id, {
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer" }],
        message: signForm.message,
        expiresInDays: 30,
      });
      if (r.error) {
        push("error", t(`حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`, `Request saved but DocuSeal did not respond: ${r.error}`));
      } else {
        push("success", t(`تم إرسال الفاتورة للتوقيع إلى ${signForm.email}`, `Invoice sent for signing to ${signForm.email}`));
        if (signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      closeSign();
    } catch (e: any) {
      setSignError(humanizeError(e, language, { ar: "فشل الإرسال", en: "Send failed" }));
    } finally { setBusy(false); }
  };

  // Full-page Create form (hides list view) · Wafeq-style replace-content pattern
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={editingInvoice ? t(`تعديل الفاتورة ${editingInvoice.invoiceNumber}`, `Edit invoice ${editingInvoice.invoiceNumber}`) : t("فاتورة جديدة", "New invoice")}
          subtitle={editingInvoice ? t(`الحالة: ${STATUS_LABELS[editingInvoice.status]?.ar || editingInvoice.status}`, `Status: ${STATUS_LABELS[editingInvoice.status]?.en || editingInvoice.status}`) : t("املأ البيانات الأساسية · يمكنك التعديل لاحقاً", "Fill in the basic details · you can edit later")}
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
                {editingInvoice && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPreviewOpen((v) => !v)}
                      className={previewOpen ? "border-primary text-primary bg-blue-50/60" : "border-border"}
                      title={t("معاينة الفاتورة كمستند (يسار)", "Preview invoice as document (left)")}
                    >
                      {t("معاينة", "Preview")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(`/print/invoice/${editingInvoice.id}`, "_blank", "noopener")}
                      className="border-border"
                      title={t("فتح نسخة الطباعة في تبويب جديد", "Open print version in a new tab")}
                    >
                      {t("طباعة", "Print")}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-primary hover:bg-primary/80">
                  {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("approve")} className="border-primary text-primary hover:bg-blue-50" title={t("اعتماد + قفل التعديل", "Approve + lock editing")}>
                  {busy ? "..." : t("اعتماد", "Approve")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-green-500 text-green-700 hover:bg-green-50" title={t("إرسال للعميل بالبريد", "Send to customer by email")}>
                  {busy ? "..." : t("اعتماد + إرسال", "Approve + send")}
                </Button>
              </div>
            </div>
          }
        >
          <div className={editingInvoice && previewOpen ? "grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_minmax(440px,38%)]" : ""}>
          <div className="w-full max-w-none mx-auto space-y-3">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

            {/* Top row · 6 fields per Wafeq screenshot · 2026-05-05 */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("جهة الاتصال", "Contact")} *</Label>
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
                  placeholder={t("ابحث عن عميل...", "Search for a customer...")}
                  createLabel={(q) => t(`+ إنشاء "${q}"`, `+ Create "${q}"`)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("تاريخ الإصدار", "Issue date")} *</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} required inputClassName="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("تاريخ الاستحقاق", "Due date")} *</Label>
                <DateInput value={form.dueDate} onChange={(iso) => setForm({ ...form, dueDate: iso })} required inputClassName="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("رقم الفاتورة", "Invoice number")}</Label>
                <Input value={form.invoiceNumber} onChange={(e) => { setForm({ ...form, invoiceNumber: e.target.value }); setNumberEdited(true); }}
                  placeholder={t("# تلقائي", "# Auto")} dir="ltr" className="border-border font-english h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("المرجع", "Reference")}</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم مرجع العميل", "Customer reference number")} className="border-border h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("الدفع الإلكتروني", "Online payment")}</Label>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/app/settings?tab=payments"; }}
                  className="w-full h-8 rounded-md border border-border bg-white px-2.5 text-xs flex items-center justify-between hover:border-primary"
                >
                  <span className="flex items-center gap-1">
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1 rounded">MC</span>
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1 rounded">VISA</span>
                  </span>
                  <span className="text-primary">{t("إعداد الدفع", "Set up payments")}</span>
                </button>
              </div>
            </div>

            {/* Second row · currency + tax mode + brand template + documents button */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("العملة", "Currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.label.ar, c.label.en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("المبالغ", "Amounts")}</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="h-8 border-border text-xs leading-tight"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-exclusive" className="text-xs">{t("غير شاملة الضريبة", "Exclusive of tax")}</SelectItem>
                    <SelectItem value="all-inclusive" className="text-xs">{t("شاملة الضريبة", "Inclusive of tax")}</SelectItem>
                    <SelectItem value="custom" className="text-xs">{t("مخصصة لكل بند", "Custom per line")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("قالب العلامة التجارية", "Brand template")}</Label>
                <Select value={form.brandTemplate} onValueChange={(v) => setForm({ ...form, brandTemplate: v })}>
                  <SelectTrigger className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRAND_TEMPLATES.map((bt) => <SelectItem key={bt.value} value={bt.value}>{t(bt.label.ar, bt.label.en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-foreground/80 text-xs">{t("شروط الدفع", "Payment terms")}</Label>
                <Select value={form.paymentTerms} onValueChange={(v) => {
                  const pt = PAYMENT_TERMS.find((p) => p.value === v);
                  if (pt) {
                    const due = new Date(form.issueDate);
                    due.setDate(due.getDate() + pt.days);
                    setForm({ ...form, paymentTerms: v, dueDate: due.toISOString().slice(0, 10) });
                  } else {
                    setForm({ ...form, paymentTerms: v });
                  }
                }}>
                  <SelectTrigger className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((pt) => <SelectItem key={pt.value} value={pt.value}>{t(pt.label.ar, pt.label.en)}</SelectItem>)}
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
              invalidIds={invalidLineIds}
              products={products.map((p: any) => ({
                id: p.id,
                name: displayName(p),
                sku: p.sku,
                unitPrice: Number(p.unitPrice) || 0,
                accountId: p.incomeAccountId,
              }))}
              accounts={accounts.map((a: any) => ({
                id: a.id,
                code: a.code,
                name: displayName(a),
                type: a.type,
                subtype: a.subtype,
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
              hint={t("استخرج بنود الفاتورة من هذا المستند", "Extract invoice line items from this document")}
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
                  notes: l.notes || undefined,
                }));
                setLines(newLines);
                if (data.documentNumber && !form.invoiceNumber) {
                  setForm((f) => ({ ...f, reference: data.documentNumber || f.reference }));
                }
                if (data.dueDate) setForm((f) => ({ ...f, dueDate: data.dueDate || f.dueDate }));
                if (data.notes) setForm((f) => ({ ...f, notes: data.notes || f.notes }));
                push("success", t(`تم استخراج ${newLines.length} بنداً بثقة ${Math.round(data.confidence * 100)}%`, `Extracted ${newLines.length} line item(s) with ${Math.round(data.confidence * 100)}% confidence`));
              }}
              onError={(msg) => push("error", msg)}
            />

            {/* Totals + payment terms + notes · 2-column footer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">{t("شروط الدفع · ملاحظة للعميل", "Payment terms · note to customer")}</Label>
                  <textarea
                    rows={3}
                    placeholder={t("مثلاً: الدفع خلال 30 يوم من تاريخ الفاتورة عبر تحويل بنكي...", "e.g.: Payment within 30 days of invoice date via bank transfer...")}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  />
                </div>
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
                          <span className="font-english text-foreground text-end whitespace-nowrap shrink-0">{form.currency} {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground min-w-0 break-words">{t("ضريبة القيمة المضافة (15%)", "VAT (15%)")}</span>
                          <span className="font-english text-foreground text-end whitespace-nowrap shrink-0">{form.currency} {totals.tax.toFixed(2)}</span>
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
          {editingInvoice && previewOpen && (
            <aside className="hidden xl:block sticky top-4">
              <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/40">
                  <span className="text-xs text-muted-foreground">{t("معاينة المستند · آخر نسخة محفوظة", "Document preview · last saved version")}</span>
                  <button
                    type="button"
                    onClick={() => window.open(`/print/invoice/${editingInvoice.id}`, "_blank", "noopener")}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {t("فتح في تبويب ←", "Open in tab ←")}
                  </button>
                </div>
                <iframe
                  title={t(`معاينة ${editingInvoice.invoiceNumber}`, `Preview ${editingInvoice.invoiceNumber}`)}
                  src={`/print/invoice/${editingInvoice.id}?embed=1&noprint=1`}
                  className="w-full bg-white"
                  style={{ height: "calc(100vh - 150px)", border: 0 }}
                />
              </div>
            </aside>
          )}
          </div>
        </FullPageForm>
      <ToastStack toasts={toasts} onDismiss={dismiss} />

        {/* Quick-create Product modal · opens when user types unknown item name */}
        {quickProductReq && (
          <QuickCreateProduct
            initialName={quickProductReq.name}
            accounts={accounts.map((a: any) => ({ id: a.id, name: displayName(a), code: a.code, type: a.type, subtype: a.subtype }))}
            onCreate={async (input) => {
              const p = await (api as any).products.create(input);
              setProducts((prev) => [p, ...prev]);
              return {
                id: p.id,
                name: displayName(p),
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
              push("success", t(`تم إنشاء المنتج · ${p.name}`, `Product created · ${p.name}`));
            }}
          />
        )}

        {/* Quick-create Account modal · opens when user types unknown account name */}
        {quickAccountReq && (
          <QuickCreateAccount
            initialName={quickAccountReq.name}
            defaultType="INCOME"
            onCreate={async (input) => {
              const a = await (api as any).accounts.create({ ...input, type: input.type === 'INCOME' ? 'REVENUE' : input.type });
              setAccounts((prev) => [a, ...prev]);
              return { id: a.id, name: displayName(a), code: a.code, type: a.type };
            }}
            onClose={() => { quickAccountReq.reject(); setQuickAccountReq(null); }}
            onCreated={(a) => {
              quickAccountReq.resolve(a);
              setQuickAccountReq(null);
              push("success", t(`تم إنشاء الحساب · ${a.name}`, `Account created · ${a.name}`));
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
          title={t(`إرسال ${signFor.invoiceNumber} للتوقيع`, `Send ${signFor.invoiceNumber} for signing`)}
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
            <p className="text-xs text-muted-foreground">{t("سيستلم الموقّع رابطاً عبر البريد لمراجعة الفاتورة وتوقيعها · صلاحية الرابط 30 يوم.", "The signer will receive a link by email to review and sign the invoice · link valid for 30 days.")}</p>
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
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("فواتير المبيعات", "Sales Invoices")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة فواتير العملاء", "Manage customer invoices")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("فاتورة جديدة", "New invoice")}</Button>
      </div>

      {contactFilterId && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>{t("عرض فواتير عميل واحد", "Showing invoices for one customer")}{contactFilterName ? `: ${contactFilterName}` : ""}</span>
          <button
            onClick={() => setSearchParams({}, { replace: true })}
            className="ms-auto rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10 border border-primary/30"
          >
            {t("إظهار الكل", "Show all")} ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي الفواتير", "Total invoiced")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("المُحصَّل", "Collected")}</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{paid.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("المستحق", "Outstanding")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{outstanding.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("عدد الفواتير", "Invoice count")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-foreground">{t("قائمة الفواتير", "Invoice list")}</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("الكل", "All")} · {items.length}</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([s, label]) => (
                    <SelectItem key={s} value={s}>{t(label.ar, label.en)} · {counts[s] || 0}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder={t("بحث...", "Search...")} className="w-56 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد فواتير", "No invoices")}</p></div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-auto">
              <colgroup>
                <col style={{ width: "12%" }} />{/* الرقم */}
                <col style={{ width: "auto" }} />{/* العميل */}
                <col style={{ width: "11%" }} />{/* التاريخ */}
                <col style={{ width: "11%" }} />{/* الاستحقاق */}
                <col style={{ width: "13%" }} />{/* الحالة */}
                <col style={{ width: "13%" }} />{/* الإجمالي */}
                <col style={{ width: "11%" }} />{/* المتبقي */}
                <col style={{ width: "12%" }} />{/* إجراءات */}
              </colgroup>
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرقم", "Number")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("العميل", "Customer")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاستحقاق", "Due")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الإجمالي", "Total")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المتبقي", "Remaining")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(i => (
                  <tr
                    key={i.id}
                    onClick={() => navigate(`/app/invoices/${i.id}`)}
                    className="border-b border-border/40 transition-colors hover:bg-primary/5 cursor-pointer"
                    title={t("فتح الفاتورة", "Open invoice")}
                  >
                    <td className="py-3 px-4 text-start whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/app/invoices/${i.id}`)}
                        title={t("فتح الفاتورة", "Open invoice")}
                        className="hover:underline underline-offset-4 decoration-primary/50 cursor-pointer"
                      >
                        <span dir="ltr" className="font-english text-sm text-primary inline-block" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{i.invoiceNumber}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground/80" title={i.contact?.displayName || ""}><span className="block whitespace-normal break-words">{i.contact?.displayName || "—"}</span></td>
                    <td className="py-3 px-4 text-start"><span dir="ltr" className="font-english text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{i.issueDate?.slice(0, 10)}</span></td>
                    <td className="py-3 px-4 text-start"><span dir="ltr" className="font-english text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{i.dueDate?.slice(0, 10)}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[i.status]}`}>{STATUS_LABELS[i.status] ? t(STATUS_LABELS[i.status].ar, STATUS_LABELS[i.status].en) : i.status}</span>
                        {i.status === "DRAFT" && (
                          pendingApprove === i.id ? (
                            <InlineConfirm
                              label={t("اعتماد الفاتورة؟", "Approve invoice?")}
                              onConfirm={() => { setPendingApprove(null); handleApprove(i); }}
                              onCancel={() => setPendingApprove(null)}
                            />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingApprove(i.id);
                              }}
                              className="rounded-md px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-50 border border-green-200"
                              title={t("اعتماد الفاتورة", "Approve invoice")}
                            >
                              ✓
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-start"><span dir="ltr" className="font-english text-sm text-foreground inline-flex items-baseline gap-1" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}><span>{Number(i.total).toLocaleString()}</span><span className="text-[10px] text-muted-foreground/60">{i.currency}</span></span></td>
                    <td className="py-3 px-4 text-start"><span dir="ltr" className="font-english text-sm text-amber-600" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{(Number(i.total) - Number(i.amountPaid || 0)).toLocaleString()}</span></td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {/* SENT/APPROVED → Sign button */}
                        {i.status === "DRAFT" && (
                          <button
                            onClick={() => handleSplitByCategory(i)}
                            disabled={splittingId === i.id}
                            className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted border border-border flex items-center gap-1"
                            title={t("تفكيك الفاتورة إلى فواتير حسب القسم", "Split the invoice into invoices by category")}
                          >
                            {splittingId === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Split className="h-3.5 w-3.5" />}
                            {t("تفكيك", "Split")}
                          </button>
                        )}
                        {i.status === "APPROVED" && (
                          <button
                            onClick={() => handleUnapprove(i)}
                            className="rounded-md px-1.5 py-0.5 text-[10px] text-amber-700 hover:bg-amber-50 border border-amber-200"
                            title={t("إلغاء الاعتماد وإرجاعها لمسودة", "Unapprove and return to draft")}
                          >
                            ↩ {t("إلغاء اعتماد", "Unapprove")}
                          </button>
                        )}
                        {i.status !== "PAID" && i.status !== "CANCELLED" && (
                          <button
                            onClick={() => openRecordPayment(i)}
                            className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1 border border-green-200"
                            title={t("تسجيل دفعة عبر صفحة سندات القبض", "Record a payment via the receipt vouchers page")}
                          >
                            💰 {t("دفعة", "Payment")}
                          </button>
                        )}
                        {i.status !== "PAID" && i.status !== "CANCELLED" && i.status !== "DRAFT" && (
                          <button onClick={() => openSign(i)} className="rounded-md px-2 py-1 text-xs text-primary hover:bg-blue-50 flex items-center gap-1" title={t("إرسال للتوقيع", "Send for signing")}>
                            <FileSignature className="h-3.5 w-3.5" /> {t("توقيع", "Sign")}
                          </button>
                        )}
                        {/* فتح/تعديل — always available; backend locks number + guards integrity */}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${i.id}`); }}
                          className="rounded-md p-1.5 text-primary hover:bg-blue-50"
                          title={i.status === "DRAFT" ? t("تعديل الفاتورة", "Edit invoice") : t("عرض/تعديل الفاتورة", "View/edit invoice")}
                        ><Pencil className="h-4 w-4" /></button>
                        {/* طباعة — always available */}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`/print/invoice/${i.id}`, "_blank"); }}
                          className="rounded-md p-1.5 text-foreground/70 hover:bg-gray-100"
                          title={t("طباعة الفاتورة", "Print invoice")}
                        ><Printer className="h-4 w-4" /></button>
                        {pendingDelete === i.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(i.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setPendingDelete(i.id); }} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {pendingContact && (
        <QuickContactDialog
          initialName={pendingContact.name}
          defaultRole="customer"
          onCancel={() => { pendingContact.reject(); setPendingContact(null); }}
          onCreated={(c) => {
            setCustomers((prev) => [c, ...prev]);
            push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
            pendingContact.resolve(c.id);
            setPendingContact(null);
          }}
        />
      )}
    </div>
  );
}
