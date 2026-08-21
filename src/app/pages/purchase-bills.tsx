/**
 * Purchase Bills · wired to /api/bills · org-scoped
 * UX-1: NO modal · NO slide-over.
 * UX pattern: FullPageForm (replaces content area on create · مطابق Wafeq) + ItemsTable + SearchableCombobox.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router";
import { Plus, Search, Trash2, Loader2, ShoppingBag, Edit2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { ContactSearchInput } from "../components/contact-search-input";
import { SearchableCombobox } from "../components/searchable-combobox";
import type { ContactInput } from "../lib/api";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { normalizeDigits } from "../lib/digits";
import { api, Contact } from "../lib/api";
import { buildDuplicateDecision, getSimilarityReview, type SimilarityReview } from "../lib/similarity-review";
import { SimilarityReviewDialog } from "../components/similarity-review-dialog";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";
import { humanizeError } from "../lib/error-messages";

const currencies = (t: (ar: string, en?: string) => string) => [
  { value: "SAR", label: `${t("ريال سعودي", "Saudi Riyal")} · SAR` },
  { value: "USD", label: `${t("دولار أمريكي", "US Dollar")} · USD` },
  { value: "EUR", label: `${t("يورو", "Euro")} · EUR` },
  { value: "AED", label: `${t("درهم إماراتي", "UAE Dirham")} · AED` },
];

const statusLabels = (t: (ar: string, en?: string) => string): Record<string, string> => ({
  DRAFT: t("مسودة", "Draft"), RECEIVED: t("مستلمة", "Received"), DUE: t("مستحقة", "Due"), PAID: t("مدفوعة", "Paid"), PARTIAL: t("مدفوعة جزئياً", "Partially paid"),
  OVERDUE: t("متأخرة", "Overdue"), CANCELLED: t("ملغاة", "Cancelled"),
});
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  RECEIVED: "bg-primary/10 text-primary",
  DUE: "bg-secondary/80 text-secondary-foreground",
  PAID: "bg-emerald-500/10 text-emerald-600",
  PARTIAL: "bg-amber-500/10 text-amber-600",
  OVERDUE: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

type PaymentSplit = {
  id: string;
  method: string;
  amount: string;
  accountId: string;
  reference: string;
  notes: string;
};

const CLEARING_ACCOUNT_KEYWORDS = ["tamara", "تسوية", "clearing", "pay later", "تمارا"];

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
  const { goBack: goBackToSource } = useReturnTo();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // A USD company must never open a SAR bill by default (owner report
  // 2026-08-21). Applies while the user hasn't picked a currency manually.
  const { currency: orgCurrency } = useOrgRegion();
  const currencyTouchedRef = useRef(false);

  useEffect(() => {
    if (currencyTouchedRef.current || editingId) return;
    if (orgCurrency && form.currency !== orgCurrency) setForm((f) => ({ ...f, currency: orgCurrency }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgCurrency, editingId]);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [showPaymentSplits, setShowPaymentSplits] = useState(false);
  const [duplicate, setDuplicate] = useState<{ open: boolean; matches: any[]; pendingSubmit: ("draft" | "approve") | null }>({ open: false, matches: [], pendingSubmit: null });
  const [pendingSimilarity, setPendingSimilarity] = useState<{ review: SimilarityReview; payload: any; action: "draft" | "approve" } | null>(null);

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const { language, t } = useLanguage();
  // Source file captured by the dropzone · forwarded to the create so the bill carries its attachment
  const [sourceFile, setSourceFile] = useState<{ name: string; contentType: string; base64: string } | null>(null);
  const [sourceFileHash, setSourceFileHash] = useState<string | null>(null);
  const [extractedDocNumber, setExtractedDocNumber] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [bills, contactsRes, productsRes, accountsRes, bankRes] = await Promise.all([
        api.bills.list(),
        api.contacts.list({ limit: 200 }),
        (api as any).products?.list?.({ limit: 200 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).accounts?.list?.({ limit: 500 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
        (api as any).bankAccounts?.list?.({ limit: 100 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
      ]);
      setItems(bills.items);
      setSuppliers(contactsRes.items.filter(c => c.type === "SUPPLIER" || c.type === "BOTH"));
      setProducts((productsRes as any).items || []);
      setAccounts((accountsRes as any).items || []);
      setBankAccounts((bankRes as any).items || []);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
    } finally { setLoading(false); }
  }, [push, language]);
  useEffect(() => { refresh(); }, [refresh]);

  // Global drag-and-drop: drop anywhere on the page to upload as attachment
  useEffect(() => {
    if (!createOpen) return;
    const handler = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        // Trigger the DocumentDropZone extraction flow
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (input) {
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    };
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', handler);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', handler);
    };
  }, [createOpen]);

  const location = useLocation();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const prefillContact = searchParams.get("contactId") || "";
      currencyTouchedRef.current = false;
      setForm({ ...EMPTY_FORM, currency: orgCurrency, ...(prefillContact ? { contactId: prefillContact } : {}) });
      setLines([newLine()]);
      setTaxMode("all-exclusive");
      setCreateError(null);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Deep link · /app/purchases/bills/:id → open that bill's edit view directly.
  // Without this, a statement deep-link shows the unfiltered list and the target
  // bill appears "missing" (the reported symptom).
  useEffect(() => {
    const m = location.pathname.match(/\/app\/purchases\/bills\/([^/]+)/);
    const id = m?.[1];
    if (!id || id === "new" || editingId === id || createOpen) return;
    api.bills.get(id).then((full: any) => openEdit(full)).catch(() => { /* unknown id → stay on list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const filtered = items.filter(b =>
    !searchQuery || b.billNumber.includes(searchQuery) ||
    (b.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, b) => s + Number(b.total), 0);

  const openCreate = () => {
    const prefillContact = searchParams.get("contactId") || "";
    currencyTouchedRef.current = false;
      setForm({ ...EMPTY_FORM, currency: orgCurrency, ...(prefillContact ? { contactId: prefillContact } : {}) });
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setPaymentSplits([]);
    setShowPaymentSplits(false);
    setCreateError(null);
    setEditingId(null);
    setCreateOpen(true);
  };

  const openEdit = (b: any) => {
    setForm({
      contactId: b.contactId || "",
      billNumber: b.billNumber || "",
      issueDate: b.issueDate?.slice(0, 10) || EMPTY_FORM.issueDate,
      dueDate: b.dueDate?.slice(0, 10) || EMPTY_FORM.dueDate,
      currency: b.currency || orgCurrency || "SAR",
      notes: b.notes || "",
    } as any);
    const linesData = (b.lines || []).map((l: any) => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), accountId: l.accountId || "", productId: l.productId || "" }));
    setLines(linesData.length > 0 ? linesData : [newLine()]);
    const storedSplits: PaymentSplit[] = Array.isArray(b.paymentSplits) ? b.paymentSplits.map((s: any, i: number) => ({
      id: s.id || `split-${i}-${Date.now()}`,
      method: s.method || "BANK_TRANSFER",
      amount: String(s.amount ?? ""),
      accountId: s.accountId || "",
      reference: s.reference || "",
      notes: s.notes || "",
    })) : [];
    setPaymentSplits(storedSplits);
    setShowPaymentSplits(storedSplits.length > 0);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setEditingId(b.id);
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    setEditingId(null);
    goBackToSource();
  };

  const clearingAccounts = accounts.filter((a: any) => a.subtype === "payment-clearing" || CLEARING_ACCOUNT_KEYWORDS.some(k => (a.name + " " + (a.nameAr || "")).toLowerCase().includes(k.toLowerCase())));
  const regularAccounts = accounts.filter((a: any) => !clearingAccounts.includes(a));
  const splitAccountOptions = (method: string) => {
    const regular = regularAccounts.map((a: any) => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.type }));
    if (method === "CLEARING") return clearingAccounts.map((a: any) => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.type }));
    return [...regular, ...bankAccounts.map((b: any) => ({ id: b.id, label: `${b.name} · ${b.accountNumber || ""}`, sublabel: "bank" }))];
  };

  const applyBnplSplit = (provider: "tamara" | "generic") => {
    const totals = computeTotals(lines);
    const remaining = totals.total;
    const clearingName = provider === "tamara" ? "Tamara Clearing" : "Buy Now Pay Later Clearing";
    const acc = clearingAccounts.find((a: any) => a.name.toLowerCase().includes(provider === "tamara" ? "tamara" : "pay later"));
    setShowPaymentSplits(true);
    setPaymentSplits([
      { id: `${Date.now()}-down`, method: "CARD", amount: "", accountId: "", reference: "Down payment", notes: "" },
      { id: `${Date.now()}-clearing`, method: "CLEARING", amount: String(remaining.toFixed(2)), accountId: acc?.id || "", reference: clearingName, notes: "" },
    ]);
  };

  const handleSubmit = async (action: "draft" | "approve" = "draft") => {
    setCreateError(null);
    if (!form.contactId) { setCreateError(t("اختر المورد", "Select supplier")); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError(t("أضف بنداً واحداً على الأقل (وصف + سعر)", "Add at least one line (description + price)")); return; }
    setBusy(true);
    try {
      const totals = computeTotals(lines);
      const splitTotal = showPaymentSplits
        ? paymentSplits.reduce((s, sp) => s + (Number(normalizeDigits(sp.amount)) || 0), 0)
        : 0;
      const hasSplits = showPaymentSplits && paymentSplits.length > 0 && splitTotal > 0;
      let status: string;
      if (action === "draft") {
        status = "DRAFT";
      } else if (hasSplits) {
        status = splitTotal >= totals.total - 0.01 ? "PAID" : "PARTIAL";
      } else {
        status = "DUE";
      }
      const payload: any = {
        contactId: form.contactId,
        billNumber: form.billNumber || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        currency: form.currency,
        status,
        notes: form.notes || null,
        termsConditions: form.reference ? `Supplier Ref: ${form.reference}` : undefined,
        // ingestion-integrity: supplier doc number + source file for dedupe & attachment guarantee
        supplierDocNumber: form.reference || extractedDocNumber || undefined,
        sourceFileHash: sourceFileHash || undefined,
        attachments: sourceFile ? [{ name: sourceFile.name, contentType: sourceFile.contentType, base64: sourceFile.base64 }] : undefined,
        lines: validLines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: (() => { const v = Number(normalizeDigits(l.unitPrice)); return isNaN(v) ? 0 : v; })(),
          taxRate: l.taxRate ?? 0,
          taxRateId: (l as any).taxRateId || null,
          accountId: (l as any).accountId || null,
          // خط الأصل: يُسجَّل تلقائياً في الأصول الثابتة مربوطاً بحساب السطر
          isAsset: l.isAsset === true,
          assetAccountId: l.isAsset ? ((l as any).accountId || null) : null,
        })),
        paymentSplits: hasSplits
          ? paymentSplits.map((sp) => ({
              method: sp.method || "BANK_TRANSFER",
              amount: Number(normalizeDigits(sp.amount)) || 0,
              accountId: sp.accountId || null,
              reference: sp.reference || null,
              notes: sp.notes || null,
            }))
          : [],
      };

      // Duplicate detection check before final submission
      if (action === "approve" && !editingId) {
        const dups = await api.bills.checkDuplicate({
          contactId: payload.contactId,
          total: totals.total,
          issueDate: payload.issueDate,
          excludeId: editingId || undefined,
        });
        if (dups && dups.length > 0) {
          setDuplicate({ open: true, matches: dups, pendingSubmit: action });
          setBusy(false);
          return;
        }
      }

      const b = editingId
        ? await api.bills.update(editingId, payload)
        : await api.bills.create(payload);
      const review = editingId ? null : getSimilarityReview(b);
      if (review) {
        // nothing written server-side — the dialog resubmits with a signed decision
        setPendingSimilarity({ review, payload, action });
        return;
      }
      finalizeSavedBill(b, action);
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" }));
    } finally { setBusy(false); }
  };

  // Shared success path after a real write (direct save or a signed similarity decision).
  const finalizeSavedBill = (b: any, action: "draft" | "approve") => {
    // upsert · a dedupe UPDATED/SKIPPED response points at an existing row
    setItems(prev => prev.some(x => x.id === b.id) ? prev.map(x => x.id === b.id ? b : x) : [b, ...prev]);
    const msg = editingId ? t("تم تحديث الفاتورة", "Invoice updated") : (action === "draft" ? t(`تم حفظ ${b.billNumber || "الفاتورة"} كمسودة`, `Saved ${b.billNumber || "the invoice"} as draft`) : t(`تم اعتماد ${b.billNumber || "الفاتورة"}`, `Approved ${b.billNumber || "the invoice"}`));
    push("success", msg);
    const ing = (b as any).ingestion;
    if (!editingId && ing && ing.dedupeDecision === "UPDATED") {
      push("info", t("فاتورة مطابقة موجودة — تم تحديثها بدل إنشاء نسخة مكررة", "A matching invoice exists — updated instead of creating a duplicate"), 6000);
    } else if (!editingId && ing && ing.dedupeDecision === "SKIPPED_DUPLICATE") {
      push("info", t("الفاتورة موجودة مسبقاً — لم يتم إنشاء نسخة مكررة", "The invoice already exists — no duplicate was created"), 6000);
    }
    if (ing?.attachmentStatus?.attached > 0) {
      push("info", t(`أُرفق ${ing.attachmentStatus.attached} ملف بالفاتورة`, `${ing.attachmentStatus.attached} file(s) attached to the invoice`), 5000);
    }
    closeCreate();
  };

  const confirmMerge = async (targetBillId: string) => {
    setBusy(true);
    try {
      await api.bills.merge(targetBillId, { sourceDocumentId: editingId || undefined });
      push("success", t("تم دمج المستند مع الفاتورة المحددة", "Document merged with the selected invoice"));
      setDuplicate({ open: false, matches: [], pendingSubmit: null });
      closeCreate();
      refresh();
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "فشل الدمج", en: "Merge failed" }));
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.bills.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم حذف الفاتورة", "Invoice deleted"));
    } catch (e: any) { push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" })); }
  };

  const handleApprove = async (b: any) => {
    try {
      await api.bills.update(b.id, { status: "RECEIVED" });
      setItems(prev => prev.map(x => x.id === b.id ? { ...x, status: "RECEIVED" } : x));
      push("success", t(`تم اعتماد ${b.billNumber || b.id}`, `Approved ${b.billNumber || b.id}`));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاعتماد", en: "Approve failed" }));
    }
  };

  // Full-page Create form (hides list view)
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={editingId
            ? `${t("فاتورة مشتريات", "Purchase invoice")} · ${form.billNumber || ""}`
            : t("فاتورة مشتريات جديدة", "New purchase invoice")}
          subtitle={editingId
            ? t("فاتورة مسجلة — أي تعديل هنا يحدّث نفس الفاتورة", "A recorded bill — edits here update this same bill")
            : t("املأ البيانات الأساسية · يمكنك التعديل لاحقاً", "Fill in the basic data · you can edit later")}
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-primary hover:bg-primary/90">
                  {busy ? "..." : t("حفظ كمسودة", "Save as draft")}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("approve")} className="border-primary text-primary hover:bg-primary/5" title={t("اعتماد + قفل التعديل", "Approve + lock editing")}>
                  {busy ? "..." : t("اعتماد", "Approve")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="w-full max-w-none mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</div>}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("المورد *", "Supplier *")}</Label>
                <ContactSearchInput
                  value={suppliers.find((c) => c.id === form.contactId)?.displayName || ""}
                  onChange={async (name, id) => {
                    if (id) {
                      setForm({ ...form, contactId: id });
                      return;
                    }
                    const c = await api.contacts.create({ displayName: name, type: "SUPPLIER" });
                    setSuppliers((prev) => [c, ...prev]);
                    setForm({ ...form, contactId: c.id });
                    push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                  }}
                  onCreate={async (name, data) => {
                    const payload: ContactInput = {
                      displayName: name,
                      type: "SUPPLIER",
                      entityKind: data.type === "organization" ? "COMPANY" : "INDIVIDUAL",
                      country: data.country,
                      defaultCurrency: data.currency,
                      vatNumber: data.taxNumber || null,
                      crNumber: data.commercialReg || null,
                      email: data.email || null,
                      phone: data.phone || null,
                    };
                    const c = await api.contacts.create(payload);
                    setSuppliers((prev) => [c, ...prev]);
                    setForm({ ...form, contactId: c.id });
                    push("success", t(`تم إنشاء ${c.displayName}`, `Created ${c.displayName}`));
                    return { id: c.id, displayName: c.displayName };
                  }}
                  roleFilter="مورد"
                  placeholder={t("ابحث أو أنشئ مورد...", "Search or create supplier...")}
                  options={suppliers.map((c) => ({
                    id: c.id,
                    name: c.displayName,
                    nameEn: (c as any).nameEn || undefined,
                    type: ((c as any).entityKind === "INDIVIDUAL" ? "person" : "organization") as "person" | "organization",
                    roles: ["مورد" as const],
                    email: c.email || "",
                    phone: c.phone || "",
                    taxNumber: (c as any).vatNumber || undefined,
                    netBalance: 0,
                    entityLocation: ((c as any).country && (c as any).country !== "SA" ? "foreign" : "local") as "local" | "foreign",
                    country: (c as any).country || undefined,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("تاريخ الفاتورة *", "Invoice date *")}</Label>
                <DateInput value={form.issueDate} onChange={(iso) => setForm({ ...form, issueDate: iso })} required inputClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("تاريخ الاستحقاق *", "Due date *")}</Label>
                <DateInput value={form.dueDate} onChange={(iso) => setForm({ ...form, dueDate: iso })} required inputClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("رقم الفاتورة", "Invoice number")}</Label>
                <Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} placeholder={t("# تلقائي", "Auto #")} dir="ltr" className="border-border font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("رقم فاتورة المورد", "Supplier invoice number")}</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("من فاتورة المورد", "From supplier invoice")} className="border-border h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("العملة", "Currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => { currencyTouchedRef.current = true; setForm({ ...form, currency: v }); }}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies(t).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("المبالغ", "Amounts")}</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-exclusive">{t("غير شاملة الضريبة", "Tax exclusive")}</SelectItem>
                    <SelectItem value="all-inclusive">{t("شاملة الضريبة", "Tax inclusive")}</SelectItem>
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
              direction="purchases"
              minRows={10}
              products={products.map((p: any) => ({
                id: p.id, code: p.code, name: p.name, unitPrice: Number(p.unitPrice || 0),
                taxRate: p.taxRate ? Number(p.taxRate) : 0.15, taxInclusive: !!p.taxInclusive,
                accountId: p.expenseAccountId || p.revenueAccountId,
              }))}
              accounts={accounts.map((a: any) => ({ id: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype }))}
              onCreateProduct={async (name) => {
                const p = await (api as any).products.create({ code: `P-${Date.now().toString(36).slice(-4).toUpperCase()}`, name, sellPrice: 0, kind: "GOOD", isActive: true });
                setProducts((prev) => [p, ...prev]);
                return { id: p.id, code: p.code, name: p.name, unitPrice: Number(p.unitPrice || 0), taxRate: 0.15, taxInclusive: false };
              }}
              onCreateAccount={async (name) => {
                const a = await (api as any).accounts.create({ code: `EXP-${Date.now().toString(36).slice(-4).toUpperCase()}`, name, type: "EXPENSE" });
                setAccounts((prev) => [a, ...prev]);
                return { id: a.id, code: a.code, name: a.name, type: a.type };
              }}
            />

            {/* Payment Splits · optional + BNPL clearing support */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-foreground" style={{ fontWeight: 600 }}>{t("تفاصيل الدفع", "Payment details")}</h3>
                  <p className="text-muted-foreground text-xs">{t("اختياري · اتركه فارغاً لترك الفاتورة مستحقة", "Optional · leave empty to keep invoice due")}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!showPaymentSplits) {
                      setShowPaymentSplits(true);
                      if (paymentSplits.length === 0) {
                        setPaymentSplits([{ id: `${Date.now()}`, method: "BANK_TRANSFER", amount: "", accountId: "", reference: "", notes: "" }]);
                      }
                    } else {
                      setShowPaymentSplits(false);
                    }
                  }}
                  className="border-border text-foreground/80 hover:bg-primary/5"
                >
                  {showPaymentSplits ? t("إخفاء الدفع", "Hide payment") : t("+ إضافة دفعة", "+ Add payment")}
                </Button>
              </div>

              {showPaymentSplits && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <span className="text-xs text-muted-foreground">{t("قوالب تقسيط سريعة:", "Quick installment templates:")}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyBnplSplit("tamara")} className="border-border text-foreground/80 hover:bg-primary/5 h-7 text-xs">
                      {t("تمارا (Tamara)", "Tamara")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyBnplSplit("generic")} className="border-border text-foreground/80 hover:bg-primary/5 h-7 text-xs">
                      {t("دفع لاحق (BNPL)", "Buy Now Pay Later (BNPL)")}
                    </Button>
                  </div>
                  {paymentSplits.map((split, idx) => (
                    <div key={split.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                      <div className="md:col-span-2">
                        <Select value={split.method} onValueChange={(v) => {
                          const next = [...paymentSplits];
                          next[idx].method = v;
                          setPaymentSplits(next);
                        }}>
                          <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">{t("نقد", "Cash")}</SelectItem>
                            <SelectItem value="BANK_TRANSFER">{t("تحويل بنكي", "Bank transfer")}</SelectItem>
                            <SelectItem value="CARD">{t("بطاقة", "Card")}</SelectItem>
                            <SelectItem value="STC_PAY">STC Pay</SelectItem>
                            <SelectItem value="MADA">{t("مدى", "Mada")}</SelectItem>
                            <SelectItem value="CHECK">{t("شيك", "Check")}</SelectItem>
                            <SelectItem value="CLEARING">{t("حساب تسوية", "Clearing account")}</SelectItem>
                            <SelectItem value="OTHER">{t("أخرى", "Other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={t("المبلغ", "Amount")}
                          value={split.amount}
                          dir="ltr"
                          className="h-9 border-border font-english text-sm"
                          onChange={(e) => {
                            const next = [...paymentSplits];
                            next[idx].amount = e.target.value;
                            setPaymentSplits(next);
                          }}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <SearchableCombobox
                          value={split.accountId}
                          onChange={(id: string) => {
                            const next = [...paymentSplits];
                            next[idx].accountId = id;
                            setPaymentSplits(next);
                          }}
                          items={splitAccountOptions(split.method)}
                          placeholder={split.method === "CLEARING" ? t("حساب تسوية", "Clearing account") : t("حساب / بنك", "Account / bank")}
                          className="border-0"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          placeholder={t("مرجع", "Reference")}
                          value={split.reference}
                          className="h-9 border-border text-sm"
                          onChange={(e) => {
                            const next = [...paymentSplits];
                            next[idx].reference = e.target.value;
                            setPaymentSplits(next);
                          }}
                        />
                      </div>
                      <div className="md:col-span-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                          title={t("حذف", "Delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentSplits([...paymentSplits, { id: `${Date.now()}-${paymentSplits.length}`, method: "BANK_TRANSFER", amount: "", accountId: "", reference: "", notes: "" }])}
                      className="border-border text-foreground/80 hover:bg-primary/5"
                    >
                      {t("+ دفعة أخرى", "+ Another payment")}
                    </Button>
                    {(() => {
                      const totals = computeTotals(lines);
                      const paid = paymentSplits.reduce((s, sp) => s + (Number(normalizeDigits(sp.amount)) || 0), 0);
                      const remaining = Math.max(0, totals.total - paid);
                      return (
                        <div className="text-sm text-muted-foreground">
                          {t("المجموع", "Total")}: <span className="font-english text-foreground" style={{ fontWeight: 600 }}>{paid.toFixed(2)}</span> · {t("متبقي", "Remaining")}: <span className="font-english text-foreground" style={{ fontWeight: 600 }}>{remaining.toFixed(2)}</span> {form.currency}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <DocumentDropZone
              target="bill-lines"
              hint={t("استخرج بنود فاتورة المشتريات من فاتورة المورد", "Extract purchase bill lines from the supplier invoice")}
              defaultTaxRate={0.15}
              currency={form.currency}
              onExtracted={(data: ExtractedDocument) => {
                if (!data.lines || data.lines.length === 0) {
                  push("error", t("لم يتم استخراج بنود من المستند", "No lines were extracted from the document"));
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
                setSourceFile(data.sourceFile || null);
                setSourceFileHash(data.sourceFileHash || null);
                setExtractedDocNumber(data.documentNumber || null);
                push("success", t(`تم استخراج ${newLines.length} بنداً من فاتورة المورد`, `Extracted ${newLines.length} line(s) from the supplier invoice`));
              }}
              onError={(msg) => push("error", msg)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("ملاحظات داخلية", "Internal notes")}</Label>
                <textarea
                  rows={3}
                  placeholder={t("ملاحظات داخلية لا تظهر للمورد...", "Internal notes not shown to supplier...")}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">{t("الإجمالي", "Total")}</Label>
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
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

        {/* Duplicate detection dialog */}
        {duplicate.open && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t("فاتورة محتملة مكررة", "Possible duplicate invoice")}</h3>
                  <p className="text-sm text-muted-foreground">{t("وجدنا فواتير سابقة بنفس المورد والتاريخ/المبلغ تقريباً.", "We found previous invoices with the same supplier and similar date/amount.")}</p>
                </div>
              </div>
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {duplicate.matches.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted">
                    <div>
                      <p className="text-sm text-foreground font-medium">{m.billNumber || t("فاتورة بدون رقم", "Invoice without number")}</p>
                      <p className="text-xs text-muted-foreground">{m.contact?.displayName} · {Number(m.total).toFixed(2)} {m.currency} · {m.issueDate?.slice(0, 10)}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => confirmMerge(m.id)}>
                      {t("دمج كمستند", "Merge as document")}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDuplicate({ open: false, matches: [], pendingSubmit: null })}>
                  {t("مراجعة البيانات", "Review data")}
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const action = duplicate.pendingSubmit;
                    setDuplicate({ open: false, matches: [], pendingSubmit: null });
                    if (action) await handleSubmit(action);
                  }}
                  className="bg-primary hover:bg-primary/80"
                >
                  {t("إنشاء فاتورة جديدة", "Create new invoice")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Signed similarity review (server-driven duplicate decision) */}
        {pendingSimilarity && (
          <SimilarityReviewDialog
            review={pendingSimilarity.review}
            busy={busy}
            onCancel={() => setPendingSimilarity(null)}
            onChoose={async (decisionAction) => {
              const pending = pendingSimilarity;
              setBusy(true);
              try {
                const b = await api.bills.create({
                  ...pending.payload,
                  duplicateDecision: buildDuplicateDecision(pending.review, decisionAction),
                });
                setPendingSimilarity(null);
                finalizeSavedBill(b, pending.action);
              } catch (e: any) {
                setCreateError(humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" }));
                setPendingSimilarity(null);
              } finally { setBusy(false); }
            }}
          />
        )}
      </>
    );
  }

  // Default · list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("فواتير المشتريات", "Purchase invoices")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة فواتير الموردين", "Manage supplier invoices")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("فاتورة مشتريات جديدة", "New purchase invoice")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي المشتريات", "Total purchases")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("عدد الفواتير", "Invoice count")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("متأخرة", "Overdue")}</div>
          <div className="font-english text-destructive" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.filter(b => b.status === "OVERDUE").length}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">{t("قائمة فواتير المشتريات", "Purchase invoices list")}</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder={t("بحث...", "Search...")} className="w-64 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد فواتير مشتريات بعد", "No purchase invoices yet")}</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرقم", "Number")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المورد", "Supplier")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاستحقاق", "Due date")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الإجمالي", "Total")}</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} onClick={() => navigate(`/app/purchases/bills/${b.id}`)} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer">
                    <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{b.billNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground/80">{b.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{b.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{b.dueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{statusLabels(t)[b.status] || b.status}</span></td>
                    <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }}>{Number(b.total).toLocaleString()} {b.currency}</td>
                    <td className="py-3 px-4" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => navigate(`/app/purchases/bills/${b.id}`)} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/5 hover:text-primary" title={t("تعديل", "Edit")}><Edit2 className="h-4 w-4" /></button>
                        {b.status === "DRAFT" && (
                          <button onClick={() => handleApprove(b)} className="rounded-md px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 flex items-center gap-1 border border-emerald-500/20" title={t("اعتماد الفاتورة", "Approve invoice")}>
                            {t("✓ اعتماد", "✓ Approve")}
                          </button>
                        )}
                        {pendingDelete === b.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(b.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={() => setPendingDelete(b.id)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
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
