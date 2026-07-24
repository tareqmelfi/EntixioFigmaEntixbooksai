/**
 * Purchase Bills · wired to /api/bills · org-scoped
 * UX-1: NO modal · NO slide-over.
 * UX pattern: FullPageForm (replaces content area on create · مطابق Wafeq) + ItemsTable + SearchableCombobox.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Plus, Search, Trash2, Loader2, ShoppingBag, Edit2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import { api, ApiError, Contact } from "../lib/api";
import type { ContactInput } from "../lib/api";

const CURRENCIES = [
  { value: "SAR", label: "ريال سعودي · SAR" },
  { value: "USD", label: "دولار أمريكي · USD" },
  { value: "EUR", label: "يورو · EUR" },
  { value: "AED", label: "درهم إماراتي · AED" },
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", RECEIVED: "مستلمة", DUE: "مستحقة", PAID: "مدفوعة", PARTIAL: "مدفوعة جزئياً",
  OVERDUE: "متأخرة", CANCELLED: "ملغاة",
};
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [showPaymentSplits, setShowPaymentSplits] = useState(false);
  const [duplicate, setDuplicate] = useState<{ open: boolean; matches: any[]; pendingSubmit: ("draft" | "approve") | null }>({ open: false, matches: [], pendingSubmit: null });

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
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
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
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
      currency: b.currency || "SAR",
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
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); setEditingId(null); };

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
    if (!form.contactId) { setCreateError("اختر المورد"); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError("أضف بنداً واحداً على الأقل (وصف + سعر)"); return; }
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
        lines: validLines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(normalizeDigits(l.quantity)) || 1,
          unitPrice: (() => { const v = Number(normalizeDigits(l.unitPrice)); return isNaN(v) ? 0 : v; })(),
          taxRate: l.taxRate ?? 0,
          taxRateId: (l as any).taxRateId || null,
          accountId: (l as any).accountId || null,
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
      setItems(prev => editingId ? prev.map(x => x.id === b.id ? b : x) : [b, ...prev]);
      const msg = editingId ? "تم تحديث الفاتورة" : (action === "draft" ? `تم حفظ ${b.billNumber || "الفاتورة"} كمسودة` : `تم اعتماد ${b.billNumber || "الفاتورة"}`);
      push("success", msg);
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const confirmMerge = async (targetBillId: string) => {
    setBusy(true);
    try {
      await api.bills.merge(targetBillId, { sourceDocumentId: editingId ? undefined : undefined });
      push("success", "تم دمج المستند مع الفاتورة المحددة");
      setDuplicate({ open: false, matches: [], pendingSubmit: null });
      closeCreate();
      refresh();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الدمج");
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
              <Button type="button" variant="outline" onClick={closeCreate} className="border-border">إلغاء</Button>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => handleSubmit("draft")} className="bg-primary hover:bg-primary/90">
                  {busy ? "..." : "حفظ كمسودة"}
                </Button>
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("approve")} className="border-primary text-primary hover:bg-primary/5" title="اعتماد + قفل التعديل">
                  {busy ? "..." : "اعتماد"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="w-full max-w-none mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</div>}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">المورد *</Label>
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
                    push("success", `تم إنشاء ${c.displayName}`);
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
                    push("success", `تم إنشاء ${c.displayName}`);
                    return { id: c.id, displayName: c.displayName };
                  }}
                  roleFilter="مورد"
                  placeholder="ابحث أو أنشئ مورد..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">تاريخ الفاتورة *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-border font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">تاريخ الاستحقاق *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required dir="ltr" className="border-border font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">رقم الفاتورة</Label>
                <Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} placeholder="# تلقائي" dir="ltr" className="border-border font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">رقم فاتورة المورد</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="من فاتورة المورد" className="border-border h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">المبالغ</Label>
                <Select value={taxMode} onValueChange={(v) => setTaxMode(v as TaxMode)}>
                  <SelectTrigger className="h-9 border-border text-sm"><SelectValue /></SelectTrigger>
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
                id: p.id, code: p.code, name: p.name, unitPrice: Number(p.unitPrice || 0),
                taxRate: p.taxRate ? Number(p.taxRate) : 0.15, taxInclusive: !!p.taxInclusive,
                accountId: p.expenseAccountId || p.revenueAccountId,
              }))}
              accounts={accounts.map((a: any) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
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
                  <h3 className="text-foreground" style={{ fontWeight: 600 }}>تفاصيل الدفع</h3>
                  <p className="text-muted-foreground text-xs">اختياري · اتركه فارغاً لترك الفاتورة مستحقة</p>
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
                  {showPaymentSplits ? "إخفاء الدفع" : "+ إضافة دفعة"}
                </Button>
              </div>

              {showPaymentSplits && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <span className="text-xs text-muted-foreground">قوالب تقسيط سريعة:</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyBnplSplit("tamara")} className="border-border text-foreground/80 hover:bg-primary/5 h-7 text-xs">
                      تمارا (Tamara)
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyBnplSplit("generic")} className="border-border text-foreground/80 hover:bg-primary/5 h-7 text-xs">
                      دفع لاحق (BNPL)
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
                            <SelectItem value="CASH">نقد</SelectItem>
                            <SelectItem value="BANK_TRANSFER">تحويل بنكي</SelectItem>
                            <SelectItem value="CARD">بطاقة</SelectItem>
                            <SelectItem value="STC_PAY">STC Pay</SelectItem>
                            <SelectItem value="MADA">مدى</SelectItem>
                            <SelectItem value="CHECK">شيك</SelectItem>
                            <SelectItem value="CLEARING">حساب تسوية</SelectItem>
                            <SelectItem value="OTHER">أخرى</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="المبلغ"
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
                          placeholder={split.method === "CLEARING" ? "حساب تسوية" : "حساب / بنك"}
                          className="border-0"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          placeholder="مرجع"
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
                          title="حذف"
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
                      + دفعة أخرى
                    </Button>
                    {(() => {
                      const totals = computeTotals(lines);
                      const paid = paymentSplits.reduce((s, sp) => s + (Number(normalizeDigits(sp.amount)) || 0), 0);
                      const remaining = Math.max(0, totals.total - paid);
                      return (
                        <div className="text-sm text-muted-foreground">
                          المجموع: <span className="font-english text-foreground" style={{ fontWeight: 600 }}>{paid.toFixed(2)}</span> · متبقي: <span className="font-english text-foreground" style={{ fontWeight: 600 }}>{remaining.toFixed(2)}</span> {form.currency}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <DocumentDropZone
              compact
              target="bill-lines"
              hint="استخرج بنود فاتورة المشتريات من فاتورة المورد"
              defaultTaxRate={0.15}
              currency={form.currency}
              onExtracted={(data: ExtractedDocument) => {
                if (!data.lines || data.lines.length === 0) {
                  push("error", "لم يتم استخراج بنود من المستند");
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
                <Label className="text-foreground/80 text-xs">ملاحظات داخلية</Label>
                <textarea
                  rows={3}
                  placeholder="ملاحظات داخلية لا تظهر للمورد..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">الإجمالي</Label>
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  {(() => {
                    const totals = computeTotals(lines);
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">المجموع الفرعي</span>
                          <span className="font-english">{form.currency} {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">الضريبة (15%)</span>
                          <span className="font-english">{form.currency} {totals.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-foreground" style={{ fontWeight: 600 }}>الإجمالي:</span>
                          <span className="font-english text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
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
                  <h3 className="text-lg font-semibold text-foreground">فاتورة محتملة مكررة</h3>
                  <p className="text-sm text-muted-foreground">وجدنا فواتير سابقة بنفس المورد والتاريخ/المبلغ تقريباً.</p>
                </div>
              </div>
              <div className="divide-y divide-[#E5E7EB] border border-border rounded-xl overflow-hidden">
                {duplicate.matches.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted">
                    <div>
                      <p className="text-sm text-foreground font-medium">{m.billNumber || "فاتورة بدون رقم"}</p>
                      <p className="text-xs text-muted-foreground">{m.contact?.displayName} · {Number(m.total).toFixed(2)} {m.currency} · {m.issueDate?.slice(0, 10)}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => confirmMerge(m.id)}>
                      دمج كمستند
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDuplicate({ open: false, matches: [], pendingSubmit: null })}>
                  مراجعة البيانات
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
                  إنشاء فاتورة جديدة
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default · list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>فواتير المشتريات</h1>
          <p className="text-muted-foreground mt-1">إدارة فواتير الموردين</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />فاتورة مشتريات جديدة</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">إجمالي المشتريات</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">عدد الفواتير</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">متأخرة</div>
          <div className="font-english text-destructive" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.filter(b => b.status === "OVERDUE").length}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">قائمة فواتير المشتريات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><Input placeholder="بحث..." className="w-64 ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">لا توجد فواتير مشتريات بعد</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
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
                  <tr key={b.id} onClick={() => openEdit(b)} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer">
                    <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{b.billNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground/80">{b.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{b.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground">{b.dueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status] || b.status}</span></td>
                    <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }}>{Number(b.total).toLocaleString()} {b.currency}</td>
                    <td className="py-3 px-4" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => openEdit(b)} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/5 hover:text-primary" title="تعديل"><Edit2 className="h-4 w-4" /></button>
                        {b.status === "DRAFT" && (
                          <button onClick={() => handleApprove(b)} className="rounded-md px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 flex items-center gap-1 border border-emerald-500/20" title="اعتماد الفاتورة">
                            ✓ اعتماد
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
