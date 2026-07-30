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
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, Voucher, Contact } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";

const METHOD_LABELS: Record<Voucher["paymentMethod"], string> = {
  CASH: "نقداً", BANK_TRANSFER: "تحويل بنكي", CARD: "بطاقة ائتمان",
  STC_PAY: "STC Pay", MADA: "مدى", CHECK: "شيك", OTHER: "أخرى",
};

const FAZAA_KEYWORDS = /فزعة|fazaa|faza3a|faz3a|faza/i;

function isFazaaContact(c: Contact): boolean {
  const hay = [
    c.displayName,
    c.legalName,
    c.customCode,
    c.shortCode,
    c.tags,
    c.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return FAZAA_KEYWORDS.test(hay) || /\bfaz\b|\bfza\b|\bfz\b/i.test(hay);
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function Receipts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [fazaaBusy, setFazaaBusy] = useState(false);
  const [fazaaPreview, setFazaaPreview] = useState<{ invoices: any[]; total: number }>({ invoices: [], total: 0 });

  const [form, setForm] = useState<any>({
    contactId: "",
    invoiceId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    reference: "",
    bankAccountId: "",
    notes: "",
    allocations: [] as Array<{ invoiceId: string; amount: string }>,
  });

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
    allocations: [],
  });

  const openCreate = () => {
    resetForm();
    setOpen(true);
    navigate("/app/receipts?new=1", { replace: true });
  };

  const closeCreate = () => {
    setOpen(false);
    resetForm();
    navigate("/app/receipts", { replace: true });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.contactId) { push("error", "اختر العميل"); return; }

    const allocs = (Array.isArray(form.allocations) ? form.allocations : [])
      .map((a: any) => ({ invoiceId: a.invoiceId, amount: toNum(a.amount) }))
      .filter((a: any) => a.invoiceId && a.amount > 0);

    const directAmount = toNum(form.amount);

    if (allocs.length === 0 && directAmount <= 0) {
      push("error", "أدخل مبلغاً صحيحاً أو وزّعه على الفواتير");
      return;
    }

    setBusy(true);
    try {
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
        });
        created.push(v);
      }

      if (created.length === 0) {
        push("info", "لم يتم إنشاء أي سند · تحقق من مبالغ التوزيع");
        return;
      }

      setItems(prev => [...created, ...prev]);
      push("success", created.length === 1 ? `تم إنشاء ${created[0].number}` : `تم إنشاء ${created.length} سند قبض`);
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
    if (file.size > 25 * 1024 * 1024) { push("error", "الحد الأقصى 25 ميجا"); return; }
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
      push("success", "تم الرفع");
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
      if (!to) { push("error", "العميل ليس له بريد"); return; }
      await api.vouchers.email(selected.id, {
        to,
        subject: emailForm.subject || undefined,
        message: emailForm.message || undefined,
      });
      push("success", `تم الإرسال إلى ${to}`);
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
      push("success", "تم الحذف");
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
    } finally { setPendingDelete(null); }
  };

  const handleGenerateFazaaReceipts = async () => {
    setFazaaBusy(true);
    try {
      const fazaaContact = contacts.find(isFazaaContact);
      if (!fazaaContact) {
        push("error", "لم يتم العثور على عميل فزعة في قائمة العملاء داخل الشركة الحالية.");
        return;
      }

      const invRes = await api.invoices.list({
        contactId: fazaaContact.id,
        status: "APPROVED,SENT,VIEWED,PARTIAL,OVERDUE",
        limit: 200,
      });

      const targetInvoices = (invRes.items || []).filter((inv: any) => {
        const remaining = Math.max(Number(inv.total || 0) - Number(inv.amountPaid || 0), 0);
        return remaining > 0.0001;
      });

      if (targetInvoices.length === 0) {
        setFazaaPreview({ invoices: [], total: 0 });
        push("info", "لا توجد فواتير فزعة مستحقة لإنشاء سندات قبض حالياً.");
        return;
      }

      const created: Voucher[] = [];
      let failed = 0;

      for (const inv of targetInvoices) {
        const remaining = Math.max(Number(inv.total || 0) - Number(inv.amountPaid || 0), 0);
        try {
          const v = await api.vouchers.create({
            type: "RECEIPT",
            contactId: fazaaContact.id,
            invoiceId: inv.id,
            date: new Date().toISOString().slice(0, 10),
            amount: Number(remaining.toFixed(2)),
            paymentMethod: "BANK_TRANSFER",
            reference: inv.invoiceNumber,
            notes: `سند قبض تلقائي لفزعة · مرتبط بالفاتورة ${inv.invoiceNumber}`,
          });
          created.push(v);
        } catch {
          failed += 1;
        }
      }

      if (created.length > 0) {
        setItems((prev) => [...created, ...prev]);
        const total = created.reduce((sum, v) => sum + Number(v.amount || 0), 0);
        setFazaaPreview({ invoices: targetInvoices, total });
        push("success", `تم إنشاء ${created.length} سند قبض لفزعة${failed ? ` · فشل ${failed}` : ""}`);
        refresh();
      } else {
        push("error", "تعذر إنشاء سندات قبض فزعة. تحقق من الفواتير والحالة.");
      }
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل إنشاء سندات قبض فزعة", en: "Fazaa receipts failed" }));
    } finally {
      setFazaaBusy(false);
    }
  };

  return (
    <div className="flex gap-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className={`space-y-6 transition-all ${selected ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>سندات القبض</h1>
            <p className="text-muted-foreground mt-1">المبالغ المُستلمة من العملاء · ربط مباشر بالفاتورة وبالعميل</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="border-border" onClick={handleGenerateFazaaReceipts} disabled={fazaaBusy}>
              {fazaaBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ReceiptIcon className="me-2 h-4 w-4" />}سندات فزعة
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" /> سند قبض جديد
            </Button>
          </div>
        </div>

        {fazaaPreview.invoices.length > 0 && (
          <Card className="border-border bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground">فزعة · آخر إنشاء تلقائي</div>
                  <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>
                    {`تم تجهيز ${fazaaPreview.invoices.length} سند قبض · بإجمالي ${fazaaPreview.total.toLocaleString()} SAR`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">عدد السندات</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{items.length}</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">إجمالي المقبوض</div>
            <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{total.toLocaleString()} SR</div>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">متوسط السند</div>
            <div className="font-english font-bold text-foreground mt-1" style={{ fontSize: "1.5rem" }} dir="ltr">{avg.toLocaleString()} SR</div>
          </CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2"><ReceiptIcon className="h-4 w-4" /> سجل السندات</CardTitle>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث..." className="pe-9 border-border" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <ReceiptIcon className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" />
                <p className="text-sm text-muted-foreground">{searchQuery ? "لا نتائج" : "لا توجد سندات قبض بعد"}</p>
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
                    <th className="text-start px-4 py-2.5 font-medium">رقم</th>
                    <th className="text-start px-4 py-2.5 font-medium">التاريخ</th>
                    <th className="text-start px-4 py-2.5 font-medium">العميل</th>
                    <th className="text-end px-4 py-2.5 font-medium">المبلغ</th>
                    <th className="text-center px-4 py-2.5 font-medium">طريقة الدفع</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id}
                      className={`border-t border-border/50 cursor-pointer hover:bg-primary/5 ${selected?.id === v.id ? "bg-[#EFF8FF]" : ""}`}
                      onClick={() => openSelected(v)}>
                      <td className="px-4 py-3 font-english font-semibold text-primary truncate" dir="ltr">{v.number}</td>
                      <td className="px-4 py-3 font-english text-foreground/80" dir="ltr">{v.date.slice(0, 10)}</td>
                      <td className="px-4 py-3 truncate text-foreground">{v.contact?.displayName || "—"}</td>
                      <td className="px-4 py-3 text-end font-english font-semibold text-green-700" dir="ltr">{Number(v.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{METHOD_LABELS[v.paymentMethod]}</td>
                      <td className="px-2 py-3 text-end" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => handlePrint(v)} className="p-1.5 text-primary hover:bg-blue-50 rounded" title="طباعة">
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
              <div className="text-xs text-green-700">المبلغ المقبوض</div>
              <div className="font-english font-bold text-green-700 mt-1" style={{ fontSize: "1.75rem" }} dir="ltr">
                {Number(selected.amount).toLocaleString()} {selected.currency}
              </div>
              <div className="text-xs text-green-600 mt-1">{METHOD_LABELS[selected.paymentMethod]}</div>
            </div>

            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">التاريخ</span><span className="font-english" dir="ltr">{selected.date.slice(0, 10)}</span></div>
              {selected.reference && <div className="flex justify-between"><span className="text-muted-foreground">المرجع</span><span className="font-english text-xs" dir="ltr">{selected.reference}</span></div>}
              {selected.invoiceId && <div className="flex justify-between"><span className="text-muted-foreground">فاتورة مرتبطة</span><span className="font-english text-xs text-primary" dir="ltr">{selected.invoiceId.slice(-8)}</span></div>}
              {selected.notes && <div className="pt-2 border-t border-border/50 text-xs text-foreground/80">{selected.notes}</div>}
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> المرفقات ({attachments.length})
                </div>
                <input ref={fileRef} type="file" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> رفع
                </button>
              </div>
              {attachments.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 text-center py-2 border border-dashed rounded">لا مرفقات</div>
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
                <Printer className="h-4 w-4 me-1" /> طباعة / PDF
              </Button>
              <Button onClick={() => {
                setEmailForm({ to: (selected.contact as any)?.email || "", subject: "", message: "" });
                setEmailDialog(true);
              }} variant="outline" className="border-border">
                <Mail className="h-4 w-4 me-1" /> إرسال للعميل
              </Button>
              {pendingDelete === selected.id ? (
                <span className="flex items-center gap-1">
                  <Button onClick={() => handleDelete(selected.id)} className="bg-red-600 hover:bg-red-700">تأكيد</Button>
                  <Button onClick={() => setPendingDelete(null)} variant="outline">إلغاء</Button>
                </span>
              ) : (
                <Button onClick={() => setPendingDelete(selected.id)} variant="outline" className="border-red-300 text-red-700">
                  <Trash2 className="h-4 w-4 me-1" /> حذف
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {open && (
        <FullPageForm
          title="سند قبض جديد"
          subtitle="إنشاء سند قبض مرتبط بالفواتير أو توزيع مبلغ على أكثر من فاتورة"
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-between gap-2 flex-wrap w-full">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-border">إلغاء</Button>
              <Button type="button" onClick={() => handleSubmit()} disabled={busy} className="bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto space-y-4">
            <div>
              <Label className="text-xs">العميل *</Label>
              <SearchableCombobox
                value={form.contactId}
                onChange={(id) => setForm({ ...form, contactId: id, invoiceId: "", amount: "", allocations: [] })}
                items={contacts.map((c) => ({ id: c.id, label: c.displayName, sublabel: [(c as any).legalName, c.email].filter(Boolean).join(" · ") || undefined }))}
                placeholder="ابحث عن عميل (عربي/English)..."
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
                createLabel={(q) => `+ إنشاء جديد "${q}"`}
              />
            </div>

            {form.contactId && (
              <>
                <div>
                  <Label className="text-xs">الفاتورة المرتبطة (اختياري)</Label>
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
                    <option value="">— غير مرتبط —</option>
                    {invoices.map((inv) => {
                      const remaining = Math.max(0, toNum(inv.total) - toNum(inv.amountPaid || 0));
                      const isPaid = remaining <= 0;
                      return (
                        <option key={inv.id} value={inv.id} disabled={isPaid}>
                          {inv.invoiceNumber} · المتبقي {remaining.toFixed(2)} {inv.currency}{isPaid ? " · مسددة" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    تظهر هنا فواتير هذا العميل فقط، والربط سيكون مباشرًا على نفس الحساب.
                  </p>
                </div>

                {invoices.some((inv) => Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0) > 0) && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>توزيع المبلغ على الفواتير (اختياري)</div>
                    {invoices
                      .filter((inv) => Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0) > 0)
                      .map((inv) => {
                        const remaining = Math.max(toNum(inv.total) - toNum(inv.amountPaid || 0), 0);
                        const allocation = (form.allocations || []).find((a: any) => a.invoiceId === inv.id);
                        return (
                          <div key={inv.id} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                            <div className="text-xs text-foreground/90">
                              <span className="font-english text-primary">{inv.invoiceNumber}</span>
                              <span className="text-muted-foreground"> · متبقي </span>
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
                              كامل المتبقي
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
                <Label className="text-xs">التاريخ *</Label>
                <DateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} required inputClassName="" />
              </div>
              <div>
                <Label className="text-xs">المبلغ *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required dir="ltr" className="font-english" />
              </div>
            </div>

            <div>
              <Label className="text-xs">طريقة الدفع *</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.paymentMethod !== "CASH" && bankAccounts.length > 0 && (
              <div>
                <Label className="text-xs">الحساب البنكي المُستلم فيه</Label>
                <select value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                  className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
                  <option value="">— اختر —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName || b.name} · {b.accountNumber || b.iban}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-xs">المرجع (رقم تحويل / شيك)</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم تحويل / رقم شيك" dir="ltr" className="font-english" />
            </div>

            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات اختيارية" />
            </div>
          </form>
        </FullPageForm>
      )}

      {/* EMAIL DIALOG */}
      {emailDialog && selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEmailDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="text-lg text-foreground font-bold">إرسال السند للعميل</h2>
              <button onClick={() => setEmailDialog(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <Label className="text-xs">إلى *</Label>
                <Input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} placeholder="customer@example.com" dir="ltr" className="font-english" />
              </div>
              <div>
                <Label className="text-xs">الموضوع</Label>
                <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder="اتركه فارغاً للقيمة الافتراضية" />
              </div>
              <div>
                <Label className="text-xs">رسالة (اختيارية)</Label>
                <textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  rows={4} className="w-full text-sm rounded border border-border px-3 py-2" placeholder="رسالة إضافية للعميل..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setEmailDialog(false)} className="border-border">إلغاء</Button>
              <Button type="button" onClick={handleEmail} className="bg-primary hover:bg-primary/90">
                <Mail className="h-4 w-4 me-1" /> إرسال
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
