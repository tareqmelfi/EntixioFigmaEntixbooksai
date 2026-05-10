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
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ItemsTable, InvoiceLine, newLine, TaxMode, computeTotals } from "../components/items-table";
import { DocumentDropZone, type ExtractedDocument } from "../components/document-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { normalizeDigits } from "../lib/digits";
import { api, ApiError, Quote, Contact } from "../lib/api";

const CURRENCIES = [
  { value: "SAR", label: "ريال سعودي · SAR" },
  { value: "USD", label: "دولار أمريكي · USD" },
  { value: "EUR", label: "يورو · EUR" },
  { value: "AED", label: "درهم إماراتي · AED" },
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", SENT: "مرسل", VIEWED: "مُشاهَد", ACCEPTED: "مقبول",
  REJECTED: "مرفوض", CONVERTED: "محوّل لفاتورة", EXPIRED: "منتهي",
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);
  const [taxMode, setTaxMode] = useState<TaxMode>("all-exclusive");

  const [signFor, setSignFor] = useState<Quote | null>(null);
  const [signForm, setSignForm] = useState({ name: "", email: "", message: "" });
  const [signError, setSignError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingConvert, setPendingConvert] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [quotesRes, contactsRes] = await Promise.all([
        api.quotes.list(),
        api.contacts.list({ limit: 200 }),
      ]);
      setItems(quotesRes.items);
      setCustomers(contactsRes.items.filter(c => c.type === "CUSTOMER" || c.type === "BOTH"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

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

  const filtered = items.filter(q =>
    !searchQuery || q.quoteNumber.includes(searchQuery) ||
    (q.contact?.displayName || "").includes(searchQuery)
  );

  const total = items.reduce((s, q) => s + Number(q.total), 0);
  const accepted = items.filter(q => q.status === "ACCEPTED").length;
  const pending = items.filter(q => q.status === "SENT" || q.status === "VIEWED").length;

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLines([newLine()]);
    setTaxMode("all-exclusive");
    setCreateError(null);
    setCreateOpen(true);
  };
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); };

  const handleSubmit = async (action: "draft" | "send" = "draft") => {
    setCreateError(null);
    if (!form.contactId) { setCreateError("اختر العميل"); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (validLines.length === 0) { setCreateError("أضف بنداً واحداً على الأقل (وصف + سعر)"); return; }
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
      const msg = action === "draft" ? `تم حفظ ${q.quoteNumber} كمسودة` : `تم إرسال ${q.quoteNumber}`;
      push("success", msg);
      if (action === "send" && q.id) {
        try { await (api as any).email?.sendQuote?.(q.id, { message: form.notes || undefined }); } catch (e) {}
      }
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.quotes.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم حذف العرض");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  const handleConvert = async (q: Quote) => {
    setPendingConvert(null);
    try {
      const r = await api.quotes.convertToInvoice(q.id);
      push("success", `تم إنشاء الفاتورة ${r.invoice.invoiceNumber}`);
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, status: "CONVERTED", convertedInvoiceId: r.invoice.id } : x));
    } catch (e: any) {
      push("error", e instanceof ApiError ? (e.message === "already_converted" ? "هذا العرض محوّل سابقاً" : e.message) : "فشل التحويل");
    }
  };

  const openSign = (q: Quote) => {
    const customer = customers.find((c) => c.id === q.contactId);
    setSignFor(q);
    setSignForm({
      name: customer?.displayName || "",
      email: customer?.email || "",
      message: `يرجى مراجعة وتوقيع عرض السعر رقم ${q.quoteNumber}`,
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
      const r = await api.sign.sendQuote(signFor.id, {
        signers: [{ name: signForm.name, email: signForm.email, role: "Customer" }],
        message: signForm.message,
        expiresInDays: 30,
      });
      if (r.error) {
        push("error", `حُفظ الطلب لكن DocuSeal لم يستجب: ${r.error}`);
      } else {
        push("success", `تم إرسال العرض للتوقيع إلى ${signForm.email}`);
        if (signFor.status === "DRAFT") {
          setItems(prev => prev.map(x => x.id === signFor.id ? { ...x, status: "SENT" } : x));
        }
      }
      closeSign();
    } catch (e: any) {
      setSignError(e instanceof ApiError ? (e.message === "already_pending" ? "يوجد طلب توقيع نشط لهذا العرض" : e.message) : "فشل الإرسال");
    } finally { setBusy(false); }
  };

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title="عرض سعر جديد"
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
                <Button type="button" disabled={busy} variant="outline" onClick={() => handleSubmit("send")} className="border-green-500 text-green-700 hover:bg-green-50" title="إرسال للعميل">
                  {busy ? "..." : "حفظ + إرسال"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="max-w-7xl mx-auto space-y-4">
            {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

            {/* Top fields row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">العميل *</Label>
                <SearchableCombobox
                  value={form.contactId}
                  onChange={(id) => setForm({ ...form, contactId: id })}
                  onCreate={async (name) => {
                    const c = await api.contacts.create({ displayName: name, type: "CUSTOMER" });
                    setCustomers((prev) => [c, ...prev]);
                    push("success", `تم إنشاء ${c.displayName}`);
                    return c.id;
                  }}
                  items={customers.map((c) => ({ id: c.id, label: c.displayName, sublabel: c.email || undefined }))}
                  placeholder="ابحث عن عميل..."
                  createLabel={(q) => `+ إنشاء "${q}"`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">تاريخ العرض *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">صالح حتى *</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">رقم العرض</Label>
                <Input value={form.quoteNumber} onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })} placeholder="# تلقائي" dir="ltr" className="border-[#E5E7EB] font-english h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">المرجع</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم مرجع داخلي" className="border-[#E5E7EB] h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
            />

            <DocumentDropZone
              compact
              target="quote-lines"
              hint="استخرج بنود عرض السعر من هذا المستند"
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
                }));
                setLines(newLines);
                if (data.notes) setForm((f) => ({ ...f, notes: data.notes || f.notes }));
                push("success", `تم استخراج ${newLines.length} بنداً`);
              }}
              onError={(msg) => push("error", msg)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#374151] text-xs">شروط ومدة التنفيذ</Label>
                <textarea
                  rows={3}
                  placeholder="شروط الدفع · مدة التنفيذ · ضمانات..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
                />
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
                          <span className="font-english">{form.currency} {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6B7280]">الضريبة (15%)</span>
                          <span className="font-english">{form.currency} {totals.tax.toFixed(2)}</span>
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
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // Full-page Sign form
  if (signFor) {
    return (
      <>
        <FullPageForm
          title={`إرسال ${signFor.quoteNumber} للتوقيع`}
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
            <p className="text-xs text-[#6B7280]">سيستلم الموقّع رابطاً عبر البريد لمراجعة العرض وتوقيعه · صلاحية الرابط 30 يوم.</p>
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
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>عروض الأسعار</h1>
          <p className="text-[#6B7280] mt-1">إدارة عروض الأسعار للعملاء</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />عرض سعر جديد</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي العروض</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">معلقة (في انتظار الرد)</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{pending}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">مقبولة</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{accepted}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">القيمة الإجمالية</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة العروض</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد عروض أسعار بعد</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>رقم العرض</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>العميل</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>صالح حتى</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الإجمالي</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{q.quoteNumber}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{q.contact?.displayName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{q.issueDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{q.validUntil?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(q.total).toLocaleString()} {q.currency}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status] || q.status}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {q.status !== "CONVERTED" && q.status !== "REJECTED" && (
                          <button onClick={() => openSign(q)} className="rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-blue-50 flex items-center gap-1" title="إرسال للتوقيع">
                            <FileSignature className="h-3.5 w-3.5" /> توقيع
                          </button>
                        )}
                        {q.status !== "CONVERTED" && (
                          pendingConvert === q.id ? (
                            <InlineConfirm onConfirm={() => handleConvert(q)} onCancel={() => setPendingConvert(null)} label="تحويل لفاتورة؟" />
                          ) : (
                            <button onClick={() => setPendingConvert(q.id)} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1" title="تحويل لفاتورة">
                              <ArrowLeftRight className="h-3.5 w-3.5" /> تحويل
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
