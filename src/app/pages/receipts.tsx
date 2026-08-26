/**
 * سندات القبض · Receipt Vouchers (cash IN from customers)
 * Wafeq-style: customer + invoice link + attachments + branded PDF + email send
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Plus, Search, X, Trash2, Loader2, Printer, Mail, Paperclip, Upload, Download,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { useFormDraft } from "../lib/form-draft";
import { SearchableCombobox } from "../components/searchable-combobox";
import { voucherEmail } from "../lib/email-templates";
import { api, Voucher, Contact } from "../lib/api";
import { useReturnTo } from "../lib/use-return-to";
import { useLanguage } from "../components/LanguageContext";
import { BranchField } from "../components/branch-field";
import { humanizeError } from "../lib/error-messages";

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function Receipts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const METHOD_LABELS: Record<Voucher["paymentMethod"], string> = {
    CASH: t("نقداً", "Cash"), BANK_TRANSFER: t("تحويل بنكي", "Bank Transfer"), CARD: t("بطاقة ائتمان", "Credit Card"),
    STC_PAY: "STC Pay", MADA: t("مدى", "Mada"), CHECK: t("شيك", "Check"), OTHER: t("أخرى", "Other"),
  };

  const [items, setItems] = useState<Voucher[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [summary, setSummary] = useState({ sumAmount: "0", avgAmount: "0" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Voucher | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const { goBack: goBackToSource } = useReturnTo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });

  // ── إرسال السند — prefill from template (client email + first-name greeting) ──
  const orgNameRef = useRef<string>("");
  const openEmailDialog = async (v: any) => {
    const contact = (v.contact as any) || null;
    let email = contact?.email || "";
    let contactName: string | null = contact?.displayName || null;
    if (!email && v.contactId) {
      const c = await api.contacts.get(v.contactId).catch(() => null);
      email = (c as any)?.email || "";
      contactName = contactName || (c as any)?.displayName || null;
    }
    if (!orgNameRef.current) {
      try {
        const orgs = await api.orgs.list();
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
        orgNameRef.current = ((stored ? orgs.find((o) => o.id === stored) : null) || orgs[0])?.name || "";
      } catch { orgNameRef.current = ""; }
    }
    const tpl = voucherEmail({
      type: v.type || "RECEIPT",
      number: v.number,
      date: String(v.date).slice(0, 10),
      amount: Number(v.amount) || 0,
      currency: v.currency || "SAR",
      contactName,
      orgName: orgNameRef.current,
    });
    setEmailForm({ to: email, subject: tpl.subject, message: tpl.message });
    setEmailDialog(true);
  };

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
    contactId: "",
    invoiceId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    reference: "",
    bankAccountId: "",
    notes: "",
    branchId: undefined as string | null | undefined, // B1 · undefined = apply member default
    allocations: [] as Array<{ invoiceId: string; amount: string }>,
  });
  const draft = useFormDraft({ key: editingReceipt ? `receipt:${editingReceipt.id}` : "receipt:new", open, snapshot: form, restore: (s) => setForm(s) });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [v, c, b] = await Promise.all([
        api.vouchers.list({ type: "RECEIPT" }),
        api.contacts.list({ role: "customer" }).catch(() => ({ items: [] })),
        api.bankAccounts.list().catch(() => ({ items: [] })),
      ]);
      setItems(v.items);
      setSummary(v.summary);
      setContacts((c as any).items || []);
      setBankAccounts((b as any).items || []);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // Deep link · /app/receipts/:id → open that voucher's detail panel
  useEffect(() => {
    const m = location.pathname.match(/\/app\/receipts\/([^/]+)/);
    const id = m?.[1];
    if (!id || id === "new" || selected?.id === id) return;
    (api as any).vouchers.get?.(id)
      ?.then((v: Voucher) => v && openSelected(v))
      .catch(() => { /* unknown id → stay on list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Load all customer invoices for selected contact (for direct linking from receipt)
  useEffect(() => {
    if (!form.contactId) { setInvoices([]); return; }
    api.invoices.list({ contactId: form.contactId, status: "DRAFT,APPROVED,SENT,VIEWED,PARTIAL,OVERDUE,PAID" as any, limit: 200 })
      .then((r) => {
        const items = r.items || [];
        setInvoices(items);
        setForm((prev: any) => ({
          ...prev,
          allocations: items
            .filter((inv: any) => Math.max(toNum(inv.total) - toNum(inv.amountPaid), 0) > 0)
            .map((inv: any) => ({ invoiceId: inv.id, amount: "" })),
        }));
      })
      .catch(() => setInvoices([]));
  }, [form.contactId]);

  // URL-driven create flow (from invoice "دفعة" action)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantsCreate = location.pathname.endsWith("/new") || params.get("new") === "1";
    if (!wantsCreate) return;

    setOpen(true);

    const contactId = params.get("contactId");
    const invoiceId = params.get("invoiceId");
    const amount = params.get("amount");
    const date = params.get("date");
    const reference = params.get("reference");

    setForm((prev: any) => ({
      ...prev,
      contactId: contactId || prev.contactId,
      invoiceId: invoiceId || prev.invoiceId,
      amount: amount || prev.amount,
      date: date || prev.date,
      reference: reference || prev.reference,
    }));
  }, [location.pathname, location.search]);

  const filtered = items.filter(p =>
    !searchQuery || p.number.includes(searchQuery) ||
    (p.contact?.displayName || "").includes(searchQuery) ||
    (p.notes || "").includes(searchQuery)
  );
  const total = Number(summary.sumAmount || 0);
  const avg = Number(summary.avgAmount || 0);

  const resetForm = () => setForm({
    contactId: "",
    invoiceId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "", paymentMethod: "BANK_TRANSFER", reference: "", bankAccountId: "", notes: "",
    branchId: undefined,
    allocations: [],
  });

  const openCreate = () => {
    resetForm();
    setEditingReceipt(null);
    setOpen(true);
    navigate("/app/receipts?new=1", { replace: true });
  };

  // Edit an existing saved receipt voucher · loads it into the form so the user
  // can revise + see the live side preview (mirrors the invoice editor pattern).
  const openEdit = async (v: Voucher) => {
    try {
      const full = await api.vouchers.get(v.id);
      setForm({
        contactId: full.contactId || "",
        invoiceId: full.invoiceId || "",
        date: full.date ? new Date(full.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        amount: String(full.amount ?? ""),
        paymentMethod: full.paymentMethod || "BANK_TRANSFER",
        reference: full.reference || "",
        bankAccountId: (full as any).bankAccountId || "",
        notes: full.notes || "",
        branchId: (full as any).branchId ?? null,
        allocations: [],
      });
      setEditingReceipt(full);
      setSelected(null);
      setOpen(true);
      setPreviewOpen(true);
      navigate(`/app/receipts/${full.id}`, { replace: true });
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "تعذر تحميل السند للتعديل", en: "Failed to load voucher" }));
    }
  };

  const closeCreate = () => {
    setOpen(false);
    setEditingReceipt(null);
    resetForm();
    if (goBackToSource()) return;
    navigate("/app/receipts", { replace: true });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.contactId) { push("error", t("اختر العميل", "Select customer")); return; }

    const allocs = (Array.isArray(form.allocations) ? form.allocations : [])
      .map((a: any) => ({ invoiceId: a.invoiceId, amount: toNum(a.amount) }))
      .filter((a: any) => a.invoiceId && a.amount > 0);

    const directAmount = toNum(form.amount);

    if (allocs.length === 0 && directAmount <= 0) {
      push("error", t("أدخل مبلغاً صحيحاً أو وزّعه على الفواتير", "Enter a valid amount or distribute it across invoices"));
      return;
    }

    setBusy(true);
    try {
      // Edit mode · update the single existing receipt voucher.
      if (editingReceipt) {
        const updated = await api.vouchers.update(editingReceipt.id, {
          contactId: form.contactId,
          invoiceId: form.invoiceId || null,
          date: form.date,
          amount: Number(directAmount.toFixed(2)),
          paymentMethod: form.paymentMethod,
          bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
          reference: form.reference || null,
          notes: form.notes || null,
          branchId: form.branchId ?? null,
        });
        setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
        setEditingReceipt(updated);
        push("success", t(`تم تحديث ${updated.number}`, `Updated ${updated.number}`));
        draft.clear();
        refresh();
        return;
      }

      const created: Voucher[] = [];

      if (allocs.length > 0) {
        for (const a of allocs) {
          const inv = invoices.find((x: any) => x.id === a.invoiceId);
          const maxRemaining = inv ? Math.max(toNum(inv.total) - toNum(inv.amountPaid), 0) : a.amount;
          const amount = Math.min(a.amount, maxRemaining);
          if (amount <= 0) continue;

          const v = await api.vouchers.create({
            type: "RECEIPT",
            contactId: form.contactId,
            invoiceId: a.invoiceId,
            date: form.date,
            amount: Number(amount.toFixed(2)),
            paymentMethod: form.paymentMethod,
            bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
            reference: inv?.invoiceNumber || form.reference || null,
            notes: form.notes || null,
            branchId: form.branchId ?? null,
          });
          created.push(v);
        }
      } else {
        const v = await api.vouchers.create({
          type: "RECEIPT",
          contactId: form.contactId,
          invoiceId: form.invoiceId || null,
          date: form.date,
          amount: Number(directAmount.toFixed(2)),
          paymentMethod: form.paymentMethod,
          bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
          reference: form.reference || null,
          notes: form.notes || null,
          branchId: form.branchId ?? null,
        });
        created.push(v);
      }

      if (created.length === 0) {
        push("info", t("لم يتم إنشاء أي سند · تحقق من مبالغ التوزيع", "No voucher created · check distribution amounts"));
        return;
      }

      setItems(prev => [...created, ...prev]);
      push("success", created.length === 1 ? t(`تم إنشاء ${created[0].number}`, `Created ${created[0].number}`) : t(`تم إنشاء ${created.length} سند قبض`, `Created ${created.length} receipt vouchers`));
      draft.clear();
      closeCreate();
      refresh();
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحفظ", en: "Save failed" }));
    } finally { setBusy(false); }
  };

  const openSelected = async (v: Voucher) => {
    setSelected(v);
    try {
      const r = await api.vouchers.attachments.list(v.id);
      setAttachments(r.items || []);
    } catch { setAttachments([]); }
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    if (file.size > 25 * 1024 * 1024) { push("error", t("الحد الأقصى 25 ميجا", "Max 25 MB")); return; }
    try {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const newAtt = await api.vouchers.attachments.upload(selected.id, {
        filename: file.name, contentType: file.type || "application/octet-stream",
        sizeBytes: file.size, data,
      });
      setAttachments(prev => [newAtt, ...prev]);
      push("success", t("تم الرفع", "Uploaded"));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الرفع", en: "Upload failed" }));
    }
  };

  const handlePrint = (v: Voucher) => {
    window.open(api.vouchers.printUrl(v.id), "_blank", "noopener,noreferrer");
  };

  const handleEmail = async () => {
    if (!selected) return;
    try {
      const to = emailForm.to || (selected.contact as any)?.email;
      if (!to) { push("error", t("العميل ليس له بريد", "Customer has no email")); return; }
      await api.vouchers.email(selected.id, {
        to,
        subject: emailForm.subject || undefined,
        message: emailForm.message || undefined,
      });
      push("success", t(`تم الإرسال إلى ${to}`, `Sent to ${to}`));
      setEmailDialog(false);
      setEmailForm({ to: "", subject: "", message: "" });
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الإرسال", en: "Send failed" }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.vouchers.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", t("تم الحذف", "Deleted"));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
    } finally { setPendingDelete(null); }
  };

  return (
    <div className="flex gap-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className={`space-y-6 transition-all ${selected ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("سندات القبض", "Receipt Vouchers")}</h1>
            <p className="text-muted-foreground mt-1">{t("المبالغ المُستلمة من العملاء · ربط مباشر بالفاتورة وبالعميل", "Amounts received from customers · direct link to invoice and customer")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" /> {t("سند قبض جديد", "New receipt voucher")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("عدد السندات", "Voucher count")}</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{items.length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("إجمالي المقبوض", "Total received")}</div>
            <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{total.toLocaleString()} SR</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("متوسط السند", "Average voucher")}</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{avg.toLocaleString()} SR</div>
          </CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2"><ReceiptIcon className="h-4 w-4" /> {t("سجل السندات", "Voucher log")}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("بحث...", "Search...")} className="pe-9 border-border" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <ReceiptIcon className="h-12 w-12 mx-auto text-muted mb-3" />
                <p className="text-sm text-muted-foreground">{searchQuery ? t("لا نتائج", "No results") : t("لا توجد سندات قبض بعد", "No receipt vouchers yet")}</p>
              </div>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "100px" }} />
                  <col />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "120px" }} />
                </colgroup>
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium">{t("رقم", "Number")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("العميل", "Customer")}</th>
                    <th className="text-end px-4 py-2.5 font-medium">{t("المبلغ", "Amount")}</th>
                    <th className="text-center px-4 py-2.5 font-medium">{t("طريقة الدفع", "Payment method")}</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id}
                      className={`border-t border-border/50 cursor-pointer hover:bg-primary/5 ${selected?.id === v.id ? "bg-primary/5" : ""}`}
                      onClick={() => openSelected(v)}>
                      <td className="px-4 py-3 font-english font-semibold text-primary truncate" dir="ltr">{v.number}</td>
                      <td className="px-4 py-3 font-english text-foreground/80" dir="ltr">{v.date.slice(0, 10)}</td>
                      <td className="px-4 py-3 truncate text-foreground">{v.contact?.displayName || "—"}</td>
                      <td className="px-4 py-3 text-end font-english font-semibold text-green-700" dir="ltr">{Number(v.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{METHOD_LABELS[v.paymentMethod]}</td>
                      <td className="px-2 py-3 text-end" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => handlePrint(v)} className="p-1.5 text-primary hover:bg-blue-50 rounded" title={t("طباعة", "Print")}>
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DETAIL PANEL */}
      {selected && (
        <Card className="border-border w-[460px] flex-shrink-0 self-start sticky top-4">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
            <div>
              <div className="font-english font-bold text-primary" dir="ltr">{selected.number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{selected.contact?.displayName || "—"}</div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="text-center bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs text-green-700">{t("المبلغ المقبوض", "Amount received")}</div>
              <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.75rem" }} dir="ltr">
                {Number(selected.amount).toLocaleString()} {selected.currency}
              </div>
              <div className="text-xs text-green-600 mt-1">{METHOD_LABELS[selected.paymentMethod]}</div>
            </div>

            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("التاريخ", "Date")}</span><span className="font-english" dir="ltr">{selected.date.slice(0, 10)}</span></div>
              {selected.reference && <div className="flex justify-between"><span className="text-muted-foreground">{t("المرجع", "Reference")}</span><span className="font-english text-xs" dir="ltr">{selected.reference}</span></div>}
              {selected.invoiceId && <div className="flex justify-between"><span className="text-muted-foreground">{t("فاتورة مرتبطة", "Linked invoice")}</span><span className="font-english text-xs text-primary" dir="ltr">{selected.invoiceId.slice(-8)}</span></div>}
              {selected.notes && <div className="pt-2 border-t border-border/50 text-xs text-foreground/80">{selected.notes}</div>}
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> {t("المرفقات", "Attachments")} ({attachments.length})
                </div>
                <input ref={fileRef} type="file" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> {t("رفع", "Upload")}
                </button>
              </div>
              {attachments.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 text-center py-2 border border-dashed rounded">{t("لا مرفقات", "No attachments")}</div>
              ) : (
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 truncate">{a.filename}</div>
                      <a href={a.url} download={a.filename} className="text-primary p-1 hover:bg-blue-50 rounded"><Download className="h-3 w-3" /></a>
                      <button onClick={async () => {
                        try {
                          await api.vouchers.attachments.remove(selected.id, a.id);
                          setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                        } catch {}
                      }} className="text-red-600 p-1 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              <Button onClick={() => handlePrint(selected)} className="bg-primary hover:bg-primary/90 text-white">
                <Printer className="h-4 w-4 me-1" /> {t("طباعة / PDF", "Print / PDF")}
              </Button>
              <Button onClick={() => openEdit(selected)} variant="outline" className="border-border">
                <ReceiptIcon className="h-4 w-4 me-1" /> {t("تعديل", "Edit")}
              </Button>
              <Button onClick={() => {
                openEmailDialog(selected);
              }} variant="outline" className="border-border">
                <Mail className="h-4 w-4 me-1" /> {t("إرسال للعميل", "Send to customer")}
              </Button>
              {pendingDelete === selected.id ? (
                <span className="flex items-center gap-1">
                  <Button onClick={() => handleDelete(selected.id)} className="bg-red-600 hover:bg-red-700">{t("تأكيد", "Confirm")}</Button>
                  <Button onClick={() => setPendingDelete(null)} variant="outline">{t("إلغاء", "Cancel")}</Button>
                </span>
              ) : (
                <Button onClick={() => setPendingDelete(selected.id)} variant="outline" className="border-red-300 text-red-700">
                  <Trash2 className="h-4 w-4 me-1" /> {t("حذف", "Delete")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {open && (
        <FullPageForm
          title={editingReceipt ? t("تعديل سند قبض", "Edit receipt voucher") : t("سند قبض جديد", "New receipt voucher")}
          subtitle={editingReceipt ? t(`مراجعة السند ${editingReceipt.number} · المعاينة يسار`, `Review voucher ${editingReceipt.number} · preview on left`) : t("إنشاء سند قبض مرتبط بالفواتير أو توزيع مبلغ على أكثر من فاتورة", "Create a receipt voucher linked to invoices or distribute an amount across multiple invoices")}
          onClose={closeCreate}
          disableEscape={busy}
          draft={draft}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap w-full">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
                {editingReceipt && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreviewOpen((v) => !v)}
                    className={previewOpen ? "border-primary text-primary bg-blue-50/60" : "border-border"}
                    title={t("معاينة السند كمستند (يسار)", "Preview voucher as document (left)")}
                  >
                    {t("معاينة", "Preview")}
                  </Button>
                )}
              </div>
              <Button type="button" onClick={() => handleSubmit()} disabled={busy} className="bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ", "Save")}
              </Button>
            </div>
          }
        >
          <div className={editingReceipt && previewOpen ? "grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_minmax(440px,38%)]" : ""}>
          <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto space-y-4">
            <div>
              <Label className="text-xs">{t("العميل", "Customer")} *</Label>
              <SearchableCombobox
                value={form.contactId}
                onChange={(id) => setForm({ ...form, contactId: id, invoiceId: "", amount: "", allocations: [] })}
                items={contacts.map((c) => ({ id: c.id, label: c.displayName, sublabel: [(c as any).legalName, c.email].filter(Boolean).join(" · ") || undefined }))}
                placeholder={t("ابحث عن عميل...", "Search customer...")}
                onCreate={async (name) => {
                  try {
                    const created = await api.contacts.create({ displayName: name, type: "CUSTOMER" as any, isCustomer: true, isSupplier: false, entityKind: "COMPANY" as any, country: "SA" } as any);
                    setContacts((prev) => [created, ...prev]);
                    return created.id;
                  } catch (e: any) {
                    push("error", humanizeError(e, language, { ar: "فشل الإنشاء", en: "Create failed" }));
                    return "";
                  }
                }}
                createLabel={(q) => t(`+ إنشاء جديد "${q}"`, `+ Create new "${q}"`)}
              />
            </div>

            {form.contactId && (
              <>
                <div>
                  <Label className="text-xs">{t("الفاتورة المرتبطة (اختياري)", "Linked invoice (optional)")}</Label>
                  <select value={form.invoiceId} onChange={(e) => {
                    const inv = invoices.find((i) => i.id === e.target.value);
                    const remaining = inv ? Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0) : 0;
                    setForm({
                      ...form,
                      invoiceId: e.target.value,
                      amount: inv ? String(remaining.toFixed(2)) : form.amount,
                      date: inv?.issueDate ? String(inv.issueDate).slice(0, 10) : form.date,
                      reference: inv?.invoiceNumber || form.reference,
                    });
                  }} className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
                    <option value="">{t("— غير مرتبط —", "— Not linked —")}</option>
                    {invoices.map((inv) => {
                      const remaining = Math.max(0, toNum(inv.total) - toNum(inv.amountPaid || 0));
                      const isPaid = remaining <= 0;
                      return (
                        <option key={inv.id} value={inv.id} disabled={isPaid}>
                          {inv.invoiceNumber} · {t("المتبقي", "Remaining")} {remaining.toFixed(2)} {inv.currency}{isPaid ? ` · ${t("مسددة", "Paid")}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("تظهر هنا فواتير هذا العميل فقط، والربط سيكون مباشرًا على نفس الحساب.", "Only this customer's invoices appear here; the link is direct on the same account.")}
                  </p>
                </div>

                {invoices.some((inv) => Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0) > 0) && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("توزيع المبلغ على الفواتير (اختياري)", "Distribute amount across invoices (optional)")}</div>
                    {invoices
                      .filter((inv) => Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0) > 0)
                      .map((inv) => {
                        const remaining = Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0);
                        const allocation = (form.allocations || []).find((a: any) => a.invoiceId === inv.id);
                        return (
                          <div key={inv.id} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                            <div className="text-xs text-foreground/90">
                              <span className="font-english text-primary">{inv.invoiceNumber}</span>
                              <span className="text-muted-foreground"> · {t("متبقي", "remaining")} </span>
                              <span className="font-english">{remaining.toFixed(2)} {inv.currency}</span>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              value={allocation?.amount || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm((prev: any) => {
                                  const cur = Array.isArray(prev.allocations) ? [...prev.allocations] : [];
                                  const idx = cur.findIndex((x: any) => x.invoiceId === inv.id);
                                  if (idx >= 0) cur[idx] = { ...cur[idx], amount: val };
                                  else cur.push({ invoiceId: inv.id, amount: val });
                                  return { ...prev, allocations: cur };
                                });
                              }}
                              dir="ltr"
                              className="font-english"
                              placeholder="0.00"
                            />
                            <button
                              type="button"
                              className="text-[11px] text-primary hover:underline"
                              onClick={() => {
                                setForm((prev: any) => {
                                  const cur = Array.isArray(prev.allocations) ? [...prev.allocations] : [];
                                  const idx = cur.findIndex((x: any) => x.invoiceId === inv.id);
                                  const full = remaining.toFixed(2);
                                  if (idx >= 0) cur[idx] = { ...cur[idx], amount: full };
                                  else cur.push({ invoiceId: inv.id, amount: full });
                                  return { ...prev, allocations: cur };
                                });
                              }}
                            >
                              {t("كامل المتبقي", "Full remaining")}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("التاريخ", "Date")} *</Label>
                <DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" />
              </div>
              <div>
                <Label className="text-xs">{t("المبلغ (أو وزّعه على الفواتير)", "Amount (or distribute across invoices)")}</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} dir="ltr" className="font-english" />
              </div>
            </div>

            <div>
              <Label className="text-xs">{t("طريقة الدفع", "Payment method")} *</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.paymentMethod !== "CASH" && bankAccounts.length > 0 && (
              <div>
                <Label className="text-xs">{t("الحساب البنكي المُستلم فيه", "Bank account received into")}</Label>
                <select value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                  className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
                  <option value="">{t("— اختر —", "— Select —")}</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName || b.name} · {b.accountNumber || b.iban}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-xs">{t("المرجع (رقم تحويل / شيك)", "Reference (transfer / check no.)")}</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم تحويل / رقم شيك", "Transfer no. / Check no.")} dir="ltr" className="font-english" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("ملاحظات", "Notes")}</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("ملاحظات اختيارية", "Optional notes")} />
              </div>
              <div>
                <Label className="text-xs">{t("الفرع", "Branch")}</Label>
                <BranchField compact value={form.branchId} onChange={(id) => setForm((f: any) => ({ ...f, branchId: id }))} />
              </div>
            </div>
          </form>

          {editingReceipt && previewOpen && (
            <aside className="hidden xl:block sticky top-4">
              <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/40">
                  <span className="text-xs text-muted-foreground">{t("معاينة السند · آخر نسخة محفوظة", "Voucher preview · last saved version")}</span>
                  <button
                    type="button"
                    onClick={() => window.open(`/print/voucher/${editingReceipt.id}`, "_blank", "noopener")}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {t("فتح في تبويب ←", "Open in tab ←")}
                  </button>
                </div>
                <iframe
                  title={t(`معاينة ${editingReceipt.number}`, `Preview ${editingReceipt.number}`)}
                  src={`/print/voucher/${editingReceipt.id}?embed=1&noprint=1`}
                  className="w-full bg-white"
                  style={{ height: "calc(100vh - 150px)", border: 0 }}
                />
              </div>
            </aside>
          )}
          </div>
        </FullPageForm>
      )}

      {/* EMAIL DIALOG */}
      {emailDialog && selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEmailDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="text-lg text-foreground font-bold">{t("إرسال السند للعميل", "Send voucher to customer")}</h2>
              <button onClick={() => setEmailDialog(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <Label className="text-xs">{t("إلى", "To")} *</Label>
                <Input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} placeholder="customer@example.com" dir="ltr" className="font-english" />
              </div>
              <div>
                <Label className="text-xs">{t("الموضوع", "Subject")}</Label>
                <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder={t("اتركه فارغاً للقيمة الافتراضية", "Leave empty for the default")} />
              </div>
              <div>
                <Label className="text-xs">{t("رسالة (اختيارية)", "Message (optional)")}</Label>
                <textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  rows={4} className="w-full text-sm rounded border border-border px-3 py-2" placeholder={t("رسالة إضافية للعميل...", "Additional message to the customer...")} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setEmailDialog(false)} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" onClick={handleEmail} className="bg-primary hover:bg-primary/90">
                <Mail className="h-4 w-4 me-1" /> {t("إرسال", "Send")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
