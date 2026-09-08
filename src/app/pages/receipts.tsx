import { displayLocale, displayDigits } from "../lib/number-display";
import { getOrgId } from "../lib/api";
/**
 * سندات القبض · Receipt Vouchers (cash IN from customers)
 * Wafeq-style: customer + invoice link + attachments + branded PDF + email send
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import {
  Plus, Search, X, Trash2, Loader2, Printer, Mail, Paperclip, Upload, Download,
  Receipt as ReceiptIcon, ArrowRight, Eye,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, LedgerFigure, Metric, MetricStrip, PageHeader, PageToolbar } from "../components/product";
import { useWideViewport } from "../lib/use-wide-viewport";
import { useOrgRegion } from "../lib/use-org-region";
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
  // Split view (list ⟷ document panel) · desktop ≥1536 only · below that the panel replaces the list
  const wideViewport = useWideViewport();
  const { currency: orgCurrency } = useOrgRegion();

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
        const stored = getOrgId();
        orgNameRef.current = ((stored ? orgs.find((o) => o.id === stored) : null))?.name || "";
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

  // ── Ledger list + document panel ──────────────────────────────────────────
  // Currency-honest totals: one currency → label it · mixed → per-currency figures
  const byCur = ((summary as any).sumByCurrency as Array<{ currency: string; total: string }> | undefined || []).filter((r) => Number(r.total) !== 0);
  const singleCur = byCur.length === 1 ? byCur[0].currency : null;
  const figureCurrency = singleCur || orgCurrency || items[0]?.currency || "SAR";
  const money2 = (n: number | string) => Number(n || 0).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const closeSelected = () => {
    setSelected(null);
    setEmailDialog(false);
    if (/\/app\/receipts\/[^/]+/.test(location.pathname)) navigate("/app/receipts", { replace: true });
  };

  const emailForm$ = selected && emailDialog && (
    <div className="space-y-3" data-testid="receipt-email-form">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("إرسال السند للعميل", "Send voucher to customer")}</h3>
        <button type="button" onClick={() => setEmailDialog(false)} className="rounded-full p-1 text-muted-foreground hover:bg-surface-hover" aria-label={t("إغلاق", "Close")}><X className="h-4 w-4" strokeWidth={1.75} /></button>
      </div>
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
          rows={4} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" placeholder={t("رسالة إضافية للعميل...", "Additional message to the customer...")} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEmailDialog(false)}>{t("إلغاء", "Cancel")}</Button>
        <Button type="button" size="sm" onClick={handleEmail}><Mail className="h-4 w-4 me-1" strokeWidth={1.75} /> {t("إرسال", "Send")}</Button>
      </div>
    </div>
  );

  // Document panel · the selected voucher (split view ≥1536 · full view below that)
  const panel = selected && (
    <div className="rounded-lg border border-border bg-card" aria-label={t("تفاصيل السند", "Voucher details")}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <span className="ledger-eyebrow">{t("سند قبض", "Receipt voucher")}</span>
          <div dir="ltr" className="mt-1 break-all font-code text-[15px] font-semibold text-foreground">{selected.number}</div>
          <div className="mt-0.5 truncate text-xs text-content-secondary"><bdi dir="auto">{selected.contact?.displayName || "—"}</bdi></div>
        </div>
        <button onClick={closeSelected} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-surface-hover" aria-label={t("إغلاق", "Close")}>
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="space-y-5 p-5">
        {emailForm$ || (
          <>
            <div className="border-y border-foreground py-4">
              <div className="text-xs text-content-secondary">{t("المبلغ المقبوض", "Amount received")}</div>
              <div className="ledger-figure-value mt-2 text-success" style={{ fontSize: "clamp(1.75rem, 2vw, 2.5rem)" }}>
                <LedgerFigure value={Number(selected.amount)} currency={selected.currency} />
              </div>
              <div className="mt-1 text-xs text-content-secondary">{METHOD_LABELS[selected.paymentMethod]}</div>
            </div>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-content-secondary">{t("التاريخ", "Date")}</dt>
              <dd className="text-end"><span dir="ltr" className="font-english tabular-nums text-foreground">{selected.date.slice(0, 10)}</span></dd>
              {selected.reference && <>
                <dt className="text-content-secondary">{t("المرجع", "Reference")}</dt>
                <dd className="min-w-0 text-end"><span dir="ltr" className="block break-all font-code text-xs text-foreground">{selected.reference}</span></dd>
              </>}
              {selected.invoiceId && <>
                <dt className="text-content-secondary">{t("فاتورة مرتبطة", "Linked invoice")}</dt>
                <dd className="min-w-0 text-end"><Link to={`/app/invoices/${selected.invoiceId}`} dir="ltr" className="font-code text-xs text-primary hover:underline">{selected.invoiceId.slice(-8)}</Link></dd>
              </>}
              {selected.notes && <dd className="col-span-2 border-t border-border pt-2 text-xs text-foreground"><bdi dir="auto">{selected.notes}</bdi></dd>}
            </dl>

            {/* Attachments */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-content-secondary">
                  <Paperclip className="h-3 w-3" strokeWidth={1.75} /> {t("المرفقات", "Attachments")} ({attachments.length})
                </div>
                <input ref={fileRef} type="file" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Upload className="h-3 w-3" strokeWidth={1.75} /> {t("رفع", "Upload")}
                </button>
              </div>
              {attachments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-strong py-2 text-center text-xs text-muted-foreground">{t("لا مرفقات", "No attachments")}</div>
              ) : (
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs">
                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <div dir="ltr" className="min-w-0 flex-1 truncate text-start font-code">{a.filename}</div>
                      <a href={a.url} download={a.filename} className="rounded-full p-1 text-primary hover:bg-surface-hover"><Download className="h-3 w-3" strokeWidth={1.75} /></a>
                      <button onClick={async () => {
                        try {
                          await api.vouchers.attachments.remove(selected.id, a.id);
                          setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                        } catch {}
                      }} className="rounded-full p-1 text-danger hover:bg-surface-hover"><Trash2 className="h-3 w-3" strokeWidth={1.75} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions · ink pill for print, quiet pills for the rest */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button size="sm" onClick={() => handlePrint(selected)}>
                <Printer className="h-4 w-4 me-1" strokeWidth={1.75} /> {t("طباعة / PDF", "Print / PDF")}
              </Button>
              <Button size="sm" onClick={() => openEdit(selected)} variant="outline">
                <ReceiptIcon className="h-4 w-4 me-1" strokeWidth={1.75} /> {t("تعديل", "Edit")}
              </Button>
              <Button size="sm" onClick={() => {
                openEmailDialog(selected);
              }} variant="outline">
                <Mail className="h-4 w-4 me-1" strokeWidth={1.75} /> {t("إرسال للعميل", "Send to customer")}
              </Button>
              {pendingDelete === selected.id ? (
                <span className="flex items-center gap-1">
                  <Button size="sm" onClick={() => handleDelete(selected.id)} variant="destructive">{t("تأكيد", "Confirm")}</Button>
                  <Button size="sm" onClick={() => setPendingDelete(null)} variant="outline">{t("إلغاء", "Cancel")}</Button>
                </span>
              ) : (
                <Button size="sm" onClick={() => setPendingDelete(selected.id)} variant="outline" className="text-danger">
                  <Trash2 className="h-4 w-4 me-1" strokeWidth={1.75} /> {t("حذف", "Delete")}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Below the split-view threshold the document replaces the list (never a dialog · UX-1)
  if (selected && !wideViewport && !open) {
    return (
      <div className="space-y-6">
        <ToastStack toasts={toasts} onDismiss={dismiss} />
        <PageHeader
          className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
          eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")} · <Link to="/app/receipts" className="hover:underline">{t("سندات القبض", "Receipt Vouchers")}</Link></span>}
          title={<span dir="ltr" className="font-code">{selected.number}</span>}
          actions={<Button variant="outline" className="h-10 px-[18px] text-sm" onClick={closeSelected}><ArrowRight className="me-2 h-4 w-4 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} />{t("سندات القبض", "Receipt Vouchers")}</Button>}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">{panel}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className={wideViewport && selected ? "grid grid-cols-[minmax(0,1fr)_minmax(380px,30%)] items-start gap-8" : ""}>
      <div className="min-w-0 space-y-6">
        <PageHeader
          className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
          eyebrow={<span className="text-[13px]">{t("المبيعات", "Sales")}</span>}
          title={t("سندات القبض", "Receipt Vouchers")}
          description={t("المبالغ المُستلمة من العملاء · ربط مباشر بالفاتورة وبالعميل", "Amounts received from customers · direct link to invoice and customer")}
          actions={
            <Button className="h-10 px-[18px] text-sm" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" strokeWidth={1.75} /> {t("سند قبض جديد", "New receipt voucher")}
            </Button>
          }
        />

        {/* Ledger figures · 2,163,034.45 SAR inside a LedgerFigure (never a raw 3-decimal string) */}
        <MetricStrip className="compact sm:grid-cols-3 xl:grid-cols-3">
          <Metric label={t("عدد السندات", "Voucher count")} value={items.length} hint={t("سند", "vouchers")} />
          <Metric
            label={t("إجمالي المقبوض", "Total received")}
            value={byCur.length > 1
              ? <span className="flex flex-col gap-1 text-success">{byCur.map((r) => <span key={r.currency}><LedgerFigure value={Number(r.total)} currency={r.currency} /></span>)}</span>
              : <span className="text-success"><LedgerFigure value={singleCur ? Number(byCur[0].total) : total} currency={figureCurrency} /></span>}
          />
          <Metric
            label={t("متوسط السند", "Average voucher")}
            value={byCur.length > 1
              ? <span className="font-sans text-base font-medium text-content-secondary">{t("مختلط العملات", "Mixed currencies")}</span>
              : <LedgerFigure value={avg} currency={figureCurrency} />}
          />
        </MetricStrip>

        <PageToolbar aria-label={t("مرشحات السندات", "Voucher filters")} className="justify-between">
          <h2 className="flex items-center gap-2 text-section font-semibold text-foreground"><ReceiptIcon className="h-4 w-4 text-content-secondary" strokeWidth={1.75} /> {t("سجل السندات", "Voucher log")}</h2>
          <div className="relative w-full sm:w-[260px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("بحث...", "Search...")} className="h-9 w-full ps-8 text-[13px]" />
          </div>
        </PageToolbar>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ReceiptIcon className="h-8 w-8" strokeWidth={1.75} />} title={searchQuery ? t("لا نتائج", "No results") : t("لا توجد سندات قبض بعد", "No receipt vouchers yet")} />
        ) : (
          <>
          <ul className="md:hidden">
            {filtered.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => navigate(`/app/receipts/${v.id}`)} className="flex w-full min-h-11 items-center justify-between gap-3 border-b border-border py-3 text-start" title={t("فتح السند", "Open voucher")}>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-sm font-semibold text-foreground"><bdi dir="auto">{v.contact?.displayName || "—"}</bdi></span>
                    <span dir="ltr" className="truncate font-code text-xs text-muted-foreground">{v.number} · {v.date.slice(0, 10)}</span>
                  </span>
                  <span dir="ltr" className="shrink-0 font-display text-[18px] leading-5 text-success tabular-nums">{money2(v.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="ledger-table hidden md:block overflow-x-auto [&_th]:text-[11px] [&_th]:tracking-[0.06em]">
            <Table className={`table-fixed ${wideViewport && selected ? "min-w-[700px]" : "min-w-[840px]"}`}>
              <colgroup>
                <col style={{ width: "200px" }} />{/* رقم · mono ids up to 32 chars */}
                <col style={{ width: "110px" }} />{/* التاريخ */}
                <col />{/* العميل · flexible */}
                <col style={{ width: "130px" }} />{/* المبلغ */}
                <col style={{ width: "140px" }} />{/* طريقة الدفع */}
                {!(wideViewport && selected) && <col style={{ width: "110px" }} />}{/* إجراءات */}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("رقم", "Number")}</TableHead>
                  <TableHead>{t("التاريخ", "Date")}</TableHead>
                  <TableHead>{t("العميل", "Customer")}</TableHead>
                  <TableHead className="text-end">{t("المبلغ", "Amount")} <span className="font-english">({figureCurrency})</span></TableHead>
                  <TableHead>{t("طريقة الدفع", "Payment method")}</TableHead>
                  {!(wideViewport && selected) && <TableHead>{t("إجراءات", "Actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id}
                    data-state={selected?.id === v.id ? "selected" : undefined}
                    className="h-12 cursor-pointer"
                    onClick={() => (wideViewport ? openSelected(v) : navigate(`/app/receipts/${v.id}`))}
                    onDoubleClick={() => navigate(`/app/receipts/${v.id}`)}
                    title={wideViewport ? t("عرض في اللوحة · نقرتان للفتح", "Show in the panel · double-click to open") : t("فتح السند", "Open voucher")}>
                    <TableCell className="align-middle overflow-hidden">
                      <Link to={`/app/receipts/${v.id}`} onClick={(e) => e.stopPropagation()} title={v.number} className="block max-w-full hover:underline underline-offset-4">
                        <span dir="ltr" className={`block truncate font-code text-sm font-semibold text-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{v.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="align-middle overflow-hidden"><span dir="ltr" className="font-english text-xs text-content-secondary tabular-nums">{v.date.slice(0, 10)}</span></TableCell>
                    <TableCell className="align-middle overflow-hidden text-foreground" title={v.contact?.displayName || ""}><span className="block truncate leading-5"><bdi dir="auto">{v.contact?.displayName || "—"}</bdi></span></TableCell>
                    <TableCell className="text-end align-middle">
                      <span dir="ltr" className="block font-display text-[18px] leading-6 text-success tabular-nums">{money2(v.amount)}{v.currency !== figureCurrency && <span className="font-english text-[10px] text-muted-foreground"> {v.currency}</span>}</span>
                    </TableCell>
                    <TableCell className="align-middle text-xs text-content-secondary"><span className="block truncate">{METHOD_LABELS[v.paymentMethod]}</span></TableCell>
                    {!(wideViewport && selected) && (
                    <TableCell className="align-middle" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <button onClick={() => navigate(`/app/receipts/${v.id}`)} className="rounded-full p-1.5 text-primary hover:bg-surface-hover" title={t("فتح السند", "Open voucher")}><Eye className="h-4 w-4" strokeWidth={1.75} /></button>
                        <button onClick={() => handlePrint(v)} className="rounded-full p-1.5 text-content-secondary hover:bg-surface-hover" title={t("طباعة", "Print")}>
                          <Printer className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </div>

      {/* Split view · the selected voucher beside the list (desktop ≥1536px) */}
      {wideViewport && selected && (
        <aside className="sticky top-4 min-w-0">{panel}</aside>
      )}
      </div>
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
                    className={previewOpen ? "border-primary text-primary bg-info-subtle/60" : "border-border"}
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
          <form onSubmit={handleSubmit} className="w-full space-y-4">
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
                  }} className="w-full text-sm rounded border border-border px-3 py-2 bg-card">
                    <option value="">{t("— غير مرتبط —", "— Not linked —")}</option>
                    {invoices.map((inv) => {
                      const remaining = Math.max(0, toNum(inv.total) - toNum(inv.amountPaid || 0));
                      const isPaid = remaining <= 0;
                      return (
                        <option key={inv.id} value={inv.id} disabled={isPaid}>
                          {inv.invoiceNumber} · {t("المتبقي", "Remaining")} {displayDigits(remaining.toFixed(2))} {inv.currency}{isPaid ? ` · ${t("مسددة", "Paid")}` : ""}
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
                              <span className="font-english">{displayDigits(remaining.toFixed(2))} {inv.currency}</span>
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
                  className="w-full text-sm rounded border border-border px-3 py-2 bg-card">
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
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
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
                  className="w-full bg-card"
                  style={{ height: "calc(100vh - 150px)", border: 0 }}
                />
              </div>
            </aside>
          )}
          </div>
        </FullPageForm>
      )}

    </div>
  );
}
