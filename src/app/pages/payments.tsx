/**
 * سندات الصرف · Payment Vouchers (cash OUT to suppliers)
 * Wafeq-style: supplier + bill link + attachments + branded PDF + email send
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, X, Trash2, Loader2, Printer, Mail, Paperclip, Upload, Download,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { voucherEmail } from "../lib/email-templates";
import { useNavigate, useSearchParams } from "react-router";
import { useReturnTo } from "../lib/use-return-to";
import { api, Voucher, Contact, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";

export function Payments() {
  const { t } = useLanguage();

  const METHOD_LABELS: Record<Voucher["paymentMethod"], string> = {
    CASH: t("نقداً", "Cash"), BANK_TRANSFER: t("تحويل بنكي", "Bank Transfer"), CARD: t("بطاقة ائتمان", "Credit Card"),
    STC_PAY: "STC Pay", MADA: t("مدى", "Mada"), CHECK: t("شيك", "Check"), OTHER: t("أخرى", "Other"),
  };

  const [items, setItems] = useState<Voucher[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const { currency: orgCurrency } = useOrgRegion();
  const [summary, setSummary] = useState<{ sumAmount: string; avgAmount: string; sumByCurrency?: Array<{ currency: string; total: string }> }>({ sumAmount: "0", avgAmount: "0" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Voucher | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const { goBack: goBackToSource } = useReturnTo();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const closeCreate = () => {
    setOpen(false);
    setEditingPayment(null);
    resetForm();
    if (goBackToSource()) return;
    // No returnTo → leave the /new route / ?new=1 URL so the panel doesn't re-open
    if (location.pathname.endsWith("/new") || searchParams.get("new") === "1" || location.pathname.match(/\/app\/payments\/([^/]+)/)) {
      navigate("/app/payments", { replace: true });
    }
  };

  // Edit an existing saved payment voucher · loads it into the full-page editor
  // so the user can revise it + see the live side preview (parity with invoices/receipts).
  const openEdit = async (v: Voucher) => {
    try {
      const full = await api.vouchers.get(v.id);
      setForm({
        contactId: full.contactId || "",
        billId: full.billId || "",
        date: full.date ? new Date(full.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        amount: String(full.amount ?? ""),
        paymentMethod: full.paymentMethod || "BANK_TRANSFER",
        reference: full.reference || "",
        bankAccountId: (full as any).bankAccountId || "",
        notes: full.notes || "",
        allocations: [],
      });
      setEditingPayment(full);
      setSelected(null);
      setOpen(true);
      setPreviewOpen(true);
      navigate(`/app/payments/${full.id}`, { replace: true });
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("تعذر تحميل السند للتعديل", "Failed to load voucher for editing"));
    }
  };

  // Auto-open create panel on /app/payments/new (route) or ?new=1 · contactId prefill
  useEffect(() => {
    const wantsCreate = location.pathname.endsWith("/new") || searchParams.get("new") === "1";
    if (!wantsCreate || open) return;
    const contactId = searchParams.get("contactId");
    resetForm();
    setEditingPayment(null);
    if (contactId) setForm((f: any) => ({ ...f, contactId }));
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, searchParams]);

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
    billId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    reference: "",
    bankAccountId: "",
    notes: "",
    allocations: [] as Array<{ billId: string; amount: string }>,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [v, s, b] = await Promise.all([
        api.vouchers.list({ type: "PAYMENT" }),
        api.contacts.list({ role: "supplier" }).catch(() => ({ items: [] })),
        api.bankAccounts.list().catch(() => ({ items: [] })),
      ]);
      setItems(v.items);
      setSummary(v.summary);
      setSuppliers((s as any).items || []);
      setBankAccounts((b as any).items || []);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // Deep link · /app/payments/:id → open that voucher's detail panel
  useEffect(() => {
    const m = location.pathname.match(/\/app\/payments\/([^/]+)/);
    const id = m?.[1];
    if (!id || id === "new" || selected?.id === id) return;
    (api as any).vouchers.get?.(id)
      ?.then((v: Voucher) => v && openSelected(v))
      .catch(() => { /* unknown id → stay on list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Load supplier bills for direct linking + allocation (mirrors receipts)
  useEffect(() => {
    if (!form.contactId) { setBills([]); return; }
    (api as any).bills?.list?.({ contactId: form.contactId, limit: 200 })
      ?.then((r: any) => {
        const items = r.items || [];
        setBills(items);
        setForm((prev: any) => ({
          ...prev,
          allocations: items
            .filter((b: any) => Math.max(Number(b.total) - Number(b.amountPaid || 0), 0) > 0)
            .map((b: any) => ({ billId: b.id, amount: "" })),
        }));
      })
      ?.catch(() => setBills([]));
  }, [form.contactId]);

  const filtered = items.filter(p =>
    !searchQuery || p.number.includes(searchQuery) ||
    (p.contact?.displayName || "").includes(searchQuery) ||
    (p.notes || "").includes(searchQuery)
  );
  const total = Number(summary.sumAmount || 0);
  const avg = Number(summary.avgAmount || 0);
  // Currency-honest totals: one currency → label it; mixed → per-currency
  // lines instead of a meaningless blended figure (owner report 2026-08-21).
  const byCur = (summary.sumByCurrency || []).filter((r) => Number(r.total) !== 0);
  const singleCur = byCur.length === 1 ? byCur[0].currency : null;
  const totalDisplay = singleCur
    ? `${Number(byCur[0].total).toLocaleString()} ${singleCur}`
    : byCur.length > 1
      ? byCur.map((r) => `${Number(r.total).toLocaleString()} ${r.currency}`).join("  ·  ")
      : `${total.toLocaleString()} ${orgCurrency}`;
  const avgDisplay = singleCur ? `${avg.toLocaleString()} ${singleCur}` : (byCur.length > 1 ? t("— مختلط العملات", "— mixed currencies") : `${avg.toLocaleString()} ${orgCurrency}`);

  const resetForm = () => setForm({
    contactId: "", billId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "", paymentMethod: "BANK_TRANSFER", reference: "", bankAccountId: "", notes: "",
    allocations: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactId) { push("error", t("اختر المورد", "Select supplier")); return; }

    const allocs = (Array.isArray(form.allocations) ? form.allocations : [])
      .map((a: any) => ({ billId: a.billId, amount: Number(a.amount) || 0 }))
      .filter((a: any) => a.billId && a.amount > 0);
    const directAmount = Number(form.amount) || 0;

    if (allocs.length === 0 && directAmount <= 0) {
      push("error", t("أدخل مبلغاً صحيحاً أو وزّعه على الفواتير", "Enter a valid amount or distribute it across invoices"));
      return;
    }

    setBusy(true);
    try {
      // Edit mode · update the single existing payment voucher.
      if (editingPayment) {
        const updated = await api.vouchers.update(editingPayment.id, {
          contactId: form.contactId,
          billId: form.billId || null,
          date: form.date,
          amount: Number(directAmount.toFixed(2)),
          paymentMethod: form.paymentMethod,
          bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
          reference: form.reference || null,
          notes: form.notes || null,
        });
        setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
        setEditingPayment(updated);
        push("success", t(`تم تحديث ${updated.number}`, `Updated ${updated.number}`));
        refresh();
        return;
      }

      const created: Voucher[] = [];

      if (allocs.length > 0) {
        for (const a of allocs) {
          const bill = bills.find((x: any) => x.id === a.billId);
          const maxRemaining = bill ? Math.max(Number(bill.total) - Number(bill.amountPaid || 0), 0) : a.amount;
          const amount = Math.min(a.amount, maxRemaining);
          if (amount <= 0) continue;

          const v = await api.vouchers.create({
            type: "PAYMENT",
            contactId: form.contactId,
            billId: a.billId,
            date: form.date,
            amount: Number(amount.toFixed(2)),
            paymentMethod: form.paymentMethod,
            bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
            reference: bill?.billNumber || form.reference || null,
            notes: form.notes || null,
          });
          created.push(v);
        }
      } else {
        const v = await api.vouchers.create({
          type: "PAYMENT",
          contactId: form.contactId,
          billId: form.billId || null,
          date: form.date,
          amount: Number(directAmount.toFixed(2)),
          paymentMethod: form.paymentMethod,
          bankAccountId: form.paymentMethod !== "CASH" ? (form.bankAccountId || null) : null,
          reference: form.reference || null,
          notes: form.notes || null,
        });
        created.push(v);
      }

      if (created.length === 0) {
        push("info", t("لم يتم إنشاء أي سند · تحقق من مبالغ التوزيع", "No voucher created · check distribution amounts"));
        return;
      }

      setItems(prev => [...created, ...prev]);
      push("success", created.length === 1 ? t(`تم إنشاء ${created[0].number}`, `Created ${created[0].number}`) : t(`تم إنشاء ${created.length} سند صرف`, `Created ${created.length} payment vouchers`));
      closeCreate();
      refresh();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
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
      push("error", e instanceof ApiError ? e.message : t("فشل الرفع", "Upload failed"));
    }
  };

  const handlePrint = (v: Voucher) => window.open(api.vouchers.printUrl(v.id), "_blank", "noopener,noreferrer");
  const handleEmail = async () => {
    if (!selected) return;
    try {
      const to = emailForm.to || (selected.contact as any)?.email;
      if (!to) { push("error", t("المورد ليس له بريد", "Supplier has no email")); return; }
      await api.vouchers.email(selected.id, { to, subject: emailForm.subject || undefined, message: emailForm.message || undefined });
      push("success", t(`تم الإرسال إلى ${to}`, `Sent to ${to}`));
      setEmailDialog(false);
      setEmailForm({ to: "", subject: "", message: "" });
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الإرسال", "Send failed"));
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await api.vouchers.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", t("تم الحذف", "Deleted"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed"));
    } finally { setPendingDelete(null); }
  };

  return (
    <div className="flex gap-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className={`space-y-6 transition-all ${selected ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("سندات الصرف", "Payment Vouchers")}</h1>
            <p className="text-muted-foreground mt-1">{t("المبالغ المدفوعة للموردين · ربط مباشر بفاتورة المشتريات", "Amounts paid to suppliers · direct link to purchase invoice")}</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => { resetForm(); setEditingPayment(null); setOpen(true); }}>
            <Plus className="me-2 h-4 w-4" /> {t("سند صرف جديد", "New payment voucher")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("عدد السندات", "Voucher count")}</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{items.length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("إجمالي المصروف", "Total spent")}</div>
            <div className="font-english font-bold text-red-700 mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{totalDisplay}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("متوسط السند", "Average voucher")}</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{avgDisplay}</div>
          </CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2"><Wallet className="h-4 w-4" /> {t("سجل السندات", "Voucher log")}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("بحث...", "Search...")} className="pe-9 border-border" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center"><Wallet className="h-12 w-12 mx-auto text-muted mb-3" /><p className="text-sm text-muted-foreground">{t("لا سندات", "No vouchers")}</p></div>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "120px" }} /><col style={{ width: "100px" }} /><col />
                  <col style={{ width: "120px" }} /><col style={{ width: "100px" }} /><col style={{ width: "120px" }} />
                </colgroup>
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium">{t("رقم", "Number")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("التاريخ", "Date")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("المورد", "Supplier")}</th>
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
                      <td className="px-4 py-3 text-end font-english font-semibold text-red-700" dir="ltr">{Number(v.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{METHOD_LABELS[v.paymentMethod]}</td>
                      <td className="px-2 py-3 text-end" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => handlePrint(v)} className="p-1.5 text-primary hover:bg-blue-50 rounded"><Printer className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card className="border-border w-[460px] flex-shrink-0 self-start sticky top-4">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
            <div>
              <div className="font-english font-bold text-primary" dir="ltr">{selected.number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{selected.contact?.displayName || "—"}</div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4 text-muted-foreground" /></button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="text-center bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs text-red-700">{t("المبلغ المصروف", "Amount spent")}</div>
              <div className="font-english font-bold text-red-700 mt-1" style={{ fontSize: "1.75rem" }} dir="ltr">
                {Number(selected.amount).toLocaleString()} {selected.currency}
              </div>
              <div className="text-xs text-red-600 mt-1">{METHOD_LABELS[selected.paymentMethod]}</div>
            </div>

            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("التاريخ", "Date")}</span><span className="font-english" dir="ltr">{selected.date.slice(0, 10)}</span></div>
              {selected.reference && <div className="flex justify-between"><span className="text-muted-foreground">{t("المرجع", "Reference")}</span><span className="font-english text-xs" dir="ltr">{selected.reference}</span></div>}
              {selected.notes && <div className="pt-2 border-t border-border/50 text-xs text-foreground/80">{selected.notes}</div>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" /> {t("المرفقات", "Attachments")} ({attachments.length})</div>
                <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1"><Upload className="h-3 w-3" /> {t("رفع", "Upload")}</button>
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
                        try { await api.vouchers.attachments.remove(selected.id, a.id); setAttachments((prev) => prev.filter((x) => x.id !== a.id)); } catch {}
                      }} className="text-red-600 p-1 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              <Button onClick={() => handlePrint(selected)} className="bg-primary hover:bg-primary/90 text-white">
                <Printer className="h-4 w-4 me-1" /> {t("طباعة / PDF", "Print / PDF")}
              </Button>
              <Button onClick={() => openEdit(selected)} variant="outline" className="border-border">
                <Wallet className="h-4 w-4 me-1" /> {t("تعديل", "Edit")}
              </Button>
              <Button onClick={() => { openEmailDialog(selected); }} variant="outline" className="border-border">
                <Mail className="h-4 w-4 me-1" /> {t("إرسال للمورد", "Send to supplier")}
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
          title={editingPayment ? t("تعديل سند صرف", "Edit payment voucher") : t("سند صرف جديد", "New payment voucher")}
          subtitle={editingPayment ? t(`مراجعة السند ${editingPayment.number} · المعاينة يسار`, `Review voucher ${editingPayment.number} · preview on left`) : t("إنشاء سند صرف مرتبط بفاتورة المشتريات أو توزيع مبلغ على أكثر من فاتورة", "Create a payment voucher linked to a purchase invoice or distribute an amount across multiple invoices")}
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap w-full">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={closeCreate} className="border-border">{t("إلغاء", "Cancel")}</Button>
                {editingPayment && (
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
              <Button type="button" onClick={() => handleSubmit({ preventDefault: () => {} } as any)} disabled={busy} className="bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ", "Save")}
              </Button>
            </div>
          }
        >
          <div className={editingPayment && previewOpen ? "grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_minmax(440px,38%)]" : ""}>
          <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto space-y-4">
            <div>
              <Label className="text-xs">{t("المورد", "Supplier")} *</Label>
                  <SearchableCombobox
                    value={form.contactId}
                    onChange={(id) => setForm({ ...form, contactId: id, billId: "", amount: "", allocations: [] })}
                    items={suppliers.map((c: any) => ({
                      id: c.id,
                      label: c.displayName,
                      sublabel: [c.legalName, c.email].filter(Boolean).join(" · ") || undefined,
                    }))}
                    placeholder={t("ابحث عن مورّد...", "Search supplier...")}
                    onCreate={async (name: string) => {
                      const created = await api.contacts.create({
                        displayName: name,
                        type: "SUPPLIER" as any,
                        isSupplier: true,
                        entityKind: "COMPANY" as any,
                        country: "SA",
                      } as any);
                      setSuppliers((prev: any) => [created, ...prev]);
                      setForm((f: any) => ({ ...f, contactId: created.id }));
                      return created.id;
                    }}
                    createLabel={(q: string) => t(`+ إنشاء مورّد جديد "${q}"`, `+ Create new supplier "${q}"`)}
                  />
                </div>

                {form.contactId && bills.length > 0 && (
                  <>
                    <div>
                      <Label className="text-xs">{t("فاتورة المشتريات (اختياري)", "Purchase invoice (optional)")}</Label>
                      <select value={form.billId} onChange={(e) => {
                        const bill = bills.find((b) => b.id === e.target.value);
                        setForm({ ...form, billId: e.target.value, amount: bill ? String(Number(bill.total) - Number(bill.amountPaid || 0)) : form.amount });
                      }} className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
                        <option value="">{t("— غير مرتبط —", "— Not linked —")}</option>
                        {bills.map((bill) => {
                          const remaining = Math.max(0, Number(bill.total) - Number(bill.amountPaid || 0));
                          const isPaid = remaining <= 0;
                          return (
                            <option key={bill.id} value={bill.id} disabled={isPaid}>
                              {bill.billNumber} · {t("المتبقي", "Remaining")} {remaining.toFixed(2)} {bill.currency}{isPaid ? ` · ${t("مسددة", "Paid")}` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("تظهر هنا فواتير هذا المورد فقط، والربط سيكون مباشرًا على نفس الحساب.", "Only this supplier's invoices appear here; the link is direct on the same account.")}
                      </p>
                    </div>

                    {bills.some((b: any) => Math.max(Number(b.total) - Number(b.amountPaid || 0), 0) > 0) && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                        <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("توزيع المبلغ على الفواتير (اختياري)", "Distribute amount across invoices (optional)")}</div>
                        {bills
                          .filter((b: any) => Math.max(Number(b.total) - Number(b.amountPaid || 0), 0) > 0)
                          .map((bill: any) => {
                            const remaining = Math.max(Number(bill.total) - Number(bill.amountPaid || 0), 0);
                            const allocation = (form.allocations || []).find((a: any) => a.billId === bill.id);
                            return (
                              <div key={bill.id} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                                <div className="text-xs text-foreground/90">
                                  <span className="font-english text-primary">{bill.billNumber}</span>
                                  <span className="text-muted-foreground"> · {t("متبقي", "remaining")} </span>
                                  <span className="font-english">{remaining.toFixed(2)} {bill.currency}</span>
                                </div>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={allocation?.amount || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setForm((prev: any) => {
                                      const cur = Array.isArray(prev.allocations) ? [...prev.allocations] : [];
                                      const idx = cur.findIndex((x: any) => x.billId === bill.id);
                                      if (idx >= 0) cur[idx] = { ...cur[idx], amount: val };
                                      else cur.push({ billId: bill.id, amount: val });
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
                                      const idx = cur.findIndex((x: any) => x.billId === bill.id);
                                      const full = remaining.toFixed(2);
                                      if (idx >= 0) cur[idx] = { ...cur[idx], amount: full };
                                      else cur.push({ billId: bill.id, amount: full });
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
                    <Label className="text-xs">{t("الحساب البنكي المسحوب منه", "Bank account debited")}</Label>
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
                  <Label className="text-xs">{t("المرجع", "Reference")}</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("رقم تحويل / رقم شيك", "Transfer no. / Check no.")} dir="ltr" className="font-english" />
                </div>

                <div>
                  <Label className="text-xs">{t("ملاحظات", "Notes")}</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("ملاحظات اختيارية", "Optional notes")} />
                </div>
          </form>

          {editingPayment && previewOpen && (
            <aside className="hidden xl:block sticky top-4">
              <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/40">
                  <span className="text-xs text-muted-foreground">{t("معاينة السند · آخر نسخة محفوظة", "Voucher preview · last saved version")}</span>
                  <button
                    type="button"
                    onClick={() => window.open(`/print/voucher/${editingPayment.id}`, "_blank", "noopener")}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {t("فتح في تبويب ←", "Open in tab ←")}
                  </button>
                </div>
                <iframe
                  title={t(`معاينة ${editingPayment.number}`, `Preview ${editingPayment.number}`)}
                  src={`/print/voucher/${editingPayment.id}?embed=1&noprint=1`}
                  className="w-full bg-white"
                  style={{ height: "calc(100vh - 150px)", border: 0 }}
                />
              </div>
            </aside>
          )}
          </div>
        </FullPageForm>
      )}

      {emailDialog && selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEmailDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="text-lg text-foreground font-bold">{t("إرسال السند للمورد", "Send voucher to supplier")}</h2>
              <button onClick={() => setEmailDialog(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><Label className="text-xs">{t("إلى", "To")} *</Label><Input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} dir="ltr" className="font-english" /></div>
              <div><Label className="text-xs">{t("الموضوع", "Subject")}</Label><Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} /></div>
              <div><Label className="text-xs">{t("رسالة", "Message")}</Label><textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} rows={4} className="w-full text-sm rounded border border-border px-3 py-2" /></div>
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
