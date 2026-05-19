/**
 * Expenses (المصروفات النقدية) · wired to /api/expenses
 * UX pattern: FullPageForm with document preview and receipt OCR.
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CopyPlus,
  Edit3,
  Eye,
  FileImage,
  Link2,
  Plus,
  Receipt,
  Search,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { DocumentPreviewPane } from "../components/document-preview-pane";
import { normalizeDigits } from "../lib/digits";
import { api, Expense as ApiExpense, ExpenseInput, ExpenseLine, ApiError } from "../lib/api";

const PAYMENT_METHOD_LABELS: Record<ApiExpense["paymentMethod"], string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CARD: "بطاقة ائتمان",
  STC_PAY: "STC Pay",
  MADA: "مدى",
  CHECK: "شيك",
  OTHER: "أخرى",
};

type UploadedAttachment = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

type FormState = {
  category: string;
  date: string;
  amount: string;
  taxAmount: string;
  totalAmount: string;
  paymentMethod: ApiExpense["paymentMethod"];
  description: string;
  vendorName: string;
  supplierTaxId: string;
  documentNumber: string;
  notes: string;
  lineItems: ExpenseLine[];
  attachments: UploadedAttachment[];
  extractedJson: any;
  ocrConfidence: number | null;
};

type ExtractionSummary = {
  fileName: string;
  vendor?: string | null;
  total?: number | null;
  tax?: number | null;
  subtotal?: number | null;
  date?: string | null;
  documentNumber?: string | null;
  confidence?: number | null;
  model?: string | null;
  lineCount: number;
  warnings: string[];
};

function emptyForm(): FormState {
  return {
    category: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    taxAmount: "",
    totalAmount: "",
    paymentMethod: "CASH",
    description: "",
    vendorName: "",
    supplierTaxId: "",
    documentNumber: "",
    notes: "",
    lineItems: [],
    attachments: [],
    extractedJson: null,
    ocrConfidence: null,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

function mimeTypeForFile(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() || "";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  if (ext === "csv") return "text/csv";
  return "application/octet-stream";
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value: any, currency = "SAR") {
  const n = Number(value || 0);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${currency}`;
}

function extractionTotals(data: any) {
  const totalFromLines = Array.isArray(data?.lines)
    ? data.lines.reduce((sum: number, line: any) => sum + (num(line?.lineTotal) || 0), 0)
    : 0;
  let total = num(data?.totals?.total ?? data?.total) ?? (totalFromLines > 0 ? totalFromLines : null);
  let tax = num(data?.totals?.tax);
  let subtotal = num(data?.totals?.subtotal);
  if (subtotal == null && total != null && tax != null) subtotal = Math.max(0, total - tax);
  if (tax == null && total != null && subtotal != null) tax = Math.max(0, total - subtotal);
  if (subtotal == null && total != null) subtotal = Math.max(0, total - (tax || 0));
  if (total == null && subtotal != null) total = subtotal + (tax || 0);
  return {
    subtotal: subtotal ?? 0,
    tax: tax ?? 0,
    total: total ?? 0,
  };
}

function normalizeLineItems(data: any): ExpenseLine[] {
  if (!Array.isArray(data?.lines)) return [];
  return data.lines
    .map((line: any) => {
      const description = String(line?.description || "").trim();
      if (!description) return null;
      const quantity = num(line?.quantity) || 1;
      const lineTotal = num(line?.lineTotal);
      const unitPrice = num(line?.unitPrice) ?? (lineTotal != null ? lineTotal / quantity : 0);
      return {
        description,
        quantity,
        unitPrice,
        taxRate: num(line?.taxRate),
        taxInclusive: Boolean(line?.taxInclusive),
        lineTotal,
        subtotal: num(line?.subtotal),
        notes: line?.notes || null,
      };
    })
    .filter(Boolean) as ExpenseLine[];
}

function inferCategory(data: any): string {
  const explicit = String(data?.category || "").trim();
  if (explicit) return explicit;
  const text = JSON.stringify(data?.lines || []).toLowerCase();
  if (/chicken|restaurant|meal|food|وجبة|دجاج|مطعم|قهوة|ضيافة/.test(text)) return "ضيافة ووجبات";
  if (/electric|water|utility|كهرباء|مياه|فاتورة/.test(text)) return "فواتير خدمات";
  return "مشتريات وفواتير";
}

function buildExtractionWarnings(data: any, items: ApiExpense[], total: number | null): string[] {
  const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];
  const date = data?.issueDate || null;
  const vendor = data?.issuer?.name || "";
  if (!data?.issuer?.name) warnings.push("اسم المورد غير واضح؛ سيتم حفظه كنص ويمكن تعديله قبل الحفظ.");
  if (!date) warnings.push("لم يتم تحديد تاريخ واضح من الإيصال، راجع التاريخ قبل الحفظ.");
  if (date) {
    const parsed = new Date(`${date}T00:00:00`);
    const today = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    if (parsed.getTime() > today.getTime() + 86_400_000) warnings.push("تاريخ الإيصال في المستقبل، راجعه قبل الحفظ.");
    if (parsed < twoYearsAgo) warnings.push("تاريخ الإيصال قديم جداً، تأكد أنه ليس قراءة خاطئة.");
  }
  if (total && date) {
    const duplicate = items.find((item) => {
      const sameAmount = Math.abs(Number(item.total || 0) - total) < 0.01;
      const sameDate = String(item.date || "").slice(0, 10) === date;
      const sameVendor = !vendor || !item.vendorName || item.vendorName.toLowerCase().includes(vendor.toLowerCase()) || vendor.toLowerCase().includes(item.vendorName.toLowerCase());
      return sameAmount && sameDate && sameVendor;
    });
    if (duplicate) warnings.push(`قد يكون مسجلاً مسبقاً: ${duplicate.number} بنفس التاريخ والمبلغ.`);
  }
  return Array.from(new Set(warnings.filter(Boolean)));
}

function selectedAttachment(expense: ApiExpense) {
  const type = expense.attachmentType || "";
  const base64 = expense.attachmentBase64 || "";
  const name = expense.attachmentName || expense.receiptUrl || "المرفق";
  if (base64) return { type, base64, name };
  if (expense.receiptUrl) return { type, url: expense.receiptUrl, name };
  return null;
}

function renderStoredAttachment(expense: ApiExpense) {
  const attachment = selectedAttachment(expense);
  if (!attachment) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-[#F9FAFB] text-center">
        <FileImage className="mb-3 h-10 w-10 text-[#9CA3AF]" />
        <p className="text-sm text-[#6B7280]">لا يوجد مرفق محفوظ لهذا المصروف</p>
      </div>
    );
  }
  const type = attachment.type.toLowerCase();
  const isHeic = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(attachment.name);
  if ("base64" in attachment && type.startsWith("image/") && !isHeic) {
    return <img src={`data:${attachment.type};base64,${attachment.base64}`} alt={attachment.name} className="max-h-[620px] w-full rounded-lg bg-white object-contain shadow-sm" />;
  }
  if ("base64" in attachment && type.includes("pdf")) {
    return <iframe title={attachment.name} src={`data:${attachment.type};base64,${attachment.base64}`} className="h-[620px] w-full rounded-lg bg-white" />;
  }
  if ("url" in attachment) {
    return <iframe title={attachment.name} src={attachment.url} className="h-[620px] w-full rounded-lg bg-white" />;
  }
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-center">
      <FileImage className="mb-3 h-10 w-10 text-[#1276E3]" />
      <p className="font-english text-sm text-[#0B1B49]">{attachment.name}</p>
      <p className="mt-1 text-xs text-[#6B7280]">المرفق محفوظ، لكن هذه الصيغة لا تظهر مباشرة داخل المتصفح.</p>
    </div>
  );
}

export function Expenses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ApiExpense[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [summary, setSummary] = useState<{ sumTotal: string; avgTotal: string }>({ sumTotal: "0", avgTotal: "0" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<ApiExpense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(() => emptyForm());
  const [extractionSummary, setExtractionSummary] = useState<ExtractionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.expenses.list({ limit: 200 });
      setItems(data.items);
      setSummary(data.summary);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل تحميل المصروفات");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const filtered = items.filter((e) =>
    !searchQuery
      || e.category.includes(searchQuery)
      || e.number.includes(searchQuery)
      || (e.documentNumber || "").includes(searchQuery)
      || (e.description || "").includes(searchQuery)
      || (e.vendorName || "").includes(searchQuery)
      || (e.contact?.displayName || "").includes(searchQuery)
  );
  const total = Number(summary.sumTotal || 0);
  const avg = Number(summary.avgTotal || 0);

  function openCreate() {
    setEditingId(null);
    setFormData(emptyForm());
    setExtractionSummary(null);
    setCreateError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setEditingId(null);
    setCreateError(null);
    setExtractionSummary(null);
  }

  async function openExpense(item: ApiExpense) {
    setSelected(item);
    try {
      const full = await api.expenses.get(item.id);
      setSelected(full);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل تحميل تفاصيل المصروف");
    }
  }

  function openEdit(expense: ApiExpense) {
    setEditingId(expense.id);
    setCreateError(null);
    setExtractionSummary(null);
    setFormData({
      category: expense.category || "",
      date: expense.date.slice(0, 10),
      amount: String(Number(expense.subtotal ?? expense.amount ?? 0)),
      taxAmount: String(Number(expense.taxAmount || 0)),
      totalAmount: String(Number(expense.total || 0)),
      paymentMethod: expense.paymentMethod,
      description: expense.description || "",
      vendorName: expense.contact?.displayName || expense.vendorName || "",
      supplierTaxId: expense.contact?.taxId || expense.contact?.vatNumber || "",
      documentNumber: expense.documentNumber || expense.reference || "",
      notes: expense.notes || "",
      lineItems: Array.isArray(expense.lineItems) ? expense.lineItems : [],
      attachments: expense.attachmentBase64 ? [{
        name: expense.attachmentName || "receipt",
        type: expense.attachmentType || "application/octet-stream",
        size: expense.attachmentSizeBytes || 0,
        base64: expense.attachmentBase64,
      }] : [],
      extractedJson: expense.extractedJson || null,
      ocrConfidence: expense.ocrConfidence ? Number(expense.ocrConfidence) : null,
    });
    setCreateOpen(true);
  }

  async function handleSubmit() {
    setCreateError(null);
    const subtotal = Number(normalizeDigits(formData.amount || "0"));
    const taxAmount = Number(normalizeDigits(formData.taxAmount || "0"));
    const totalAmount = Number(normalizeDigits(formData.totalAmount || String(subtotal + taxAmount)));
    if (!formData.category.trim() || totalAmount <= 0) {
      setCreateError("الرجاء تعبئة التصنيف والمبلغ");
      return;
    }
    setBusy(true);
    try {
      const primaryAttachment = formData.attachments[formData.attachments.length - 1];
      const input: ExpenseInput = {
        date: formData.date,
        category: formData.category.trim(),
        amount: subtotal || Math.max(0, totalAmount - taxAmount),
        subtotal: subtotal || Math.max(0, totalAmount - taxAmount),
        totalAmount,
        taxAmount,
        paymentMethod: formData.paymentMethod,
        description: formData.description || formData.notes || null,
        vendorName: formData.vendorName || null,
        supplierTaxId: formData.supplierTaxId || null,
        documentNumber: formData.documentNumber || null,
        reference: formData.documentNumber || null,
        lineItems: formData.lineItems,
        notes: formData.notes || null,
        attachmentName: primaryAttachment?.name || null,
        attachmentType: primaryAttachment?.type || null,
        attachmentSizeBytes: primaryAttachment?.size || null,
        attachmentBase64: primaryAttachment?.base64 || null,
        attachmentCount: formData.attachments.length,
        extractedJson: formData.extractedJson ? { ...formData.extractedJson, attachments: formData.attachments.map(({ name, type, size }) => ({ name, type, size })) } : null,
        ocrConfidence: formData.ocrConfidence,
        autoCreateSupplier: true,
      };
      const saved = editingId ? await api.expenses.update(editingId, input) : await api.expenses.create(input);
      await refresh();
      const full = await api.expenses.get(saved.id);
      setSelected(full);
      push("success", editingId ? `تم تحديث المصروف ${saved.number}` : `تم حفظ المصروف ${saved.number}`);
      if ((saved as any).duplicateExpense) push("info", `تنبيه: يوجد مصروف مشابه ${(saved as any).duplicateExpense.number}`, 7000);
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? `${e.message}: ${e.detail || ""}` : "فشل حفظ المصروف");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setPendingDelete(null);
    try {
      await api.expenses.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", "تم حذف المصروف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    }
  }

  async function handleFilesAdded(files: File[]) {
    const added = await Promise.all(files.map(async (file) => ({
      name: file.name,
      type: mimeTypeForFile(file),
      size: file.size,
      base64: await fileToBase64(file),
    })));
    setFormData((f) => ({ ...f, attachments: [...f.attachments, ...added] }));
  }

  async function handleExtract(file: File) {
    try {
      const fileBase64 = await fileToBase64(file);
      const data: any = await api.agent.extractDocument({
        fileBase64,
        fileName: file.name,
        mimeType: mimeTypeForFile(file),
        target: "expense",
        defaultTaxRate: 0.15,
        currency: "SAR",
      });
      const totals = extractionTotals(data);
      const lineItems = normalizeLineItems(data);
      const warnings = buildExtractionWarnings(data, items, totals.total || null);
      const supplierTaxId = data?.issuer?.taxId || "";
      setFormData((f) => ({
        ...f,
        category: f.category || inferCategory(data),
        amount: totals.subtotal ? String(totals.subtotal) : f.amount,
        taxAmount: totals.tax ? String(totals.tax) : f.taxAmount,
        totalAmount: totals.total ? String(totals.total) : f.totalAmount,
        date: data?.issueDate || f.date,
        vendorName: data?.issuer?.name || f.vendorName,
        supplierTaxId: supplierTaxId || f.supplierTaxId,
        documentNumber: data?.documentNumber || f.documentNumber,
        description: data?.notes || data?.documentNumber || f.description,
        notes: data?.notes || f.notes,
        lineItems: lineItems.length ? lineItems : f.lineItems,
        extractedJson: data,
        ocrConfidence: data?.confidence ?? null,
      }));
      setExtractionSummary({
        fileName: file.name,
        vendor: data?.issuer?.name || null,
        total: totals.total || null,
        tax: totals.tax || null,
        subtotal: totals.subtotal || null,
        date: data?.issueDate || null,
        documentNumber: data?.documentNumber || null,
        confidence: data?.confidence ?? null,
        model: data?._meta?.model || null,
        lineCount: lineItems.length,
        warnings,
      });
      push("success", `تم استخراج البيانات بثقة ${Math.round((data?.confidence || 0) * 100)}%`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? `${e.message}: ${e.detail || ""}` : "فشل الاستخراج");
    }
  }

  const formTotal = Number(normalizeDigits(formData.totalAmount || "0")) || (Number(normalizeDigits(formData.amount || "0")) + Number(normalizeDigits(formData.taxAmount || "0")));
  const initialFiles = formData.attachments.length
    ? formData.attachments.map((a) => ({
        name: a.name,
        type: a.type,
        url: a.type.startsWith("image/") && !/heic|heif/i.test(a.type) ? `data:${a.type};base64,${a.base64}` : "",
      }))
    : [];

  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={editingId ? "تعديل مصروف" : "مصروف جديد"}
          subtitle="ارفع الإيصال وسيتم استخراج المورد والضريبة والأصناف تلقائياً"
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? "..." : editingId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,460px)_1fr] max-w-7xl mx-auto">
            <DocumentPreviewPane
              hint="ارفع إيصالاً أو فاتورة مصروف"
              onFilesAdded={handleFilesAdded}
              onExtract={handleExtract}
              autoExtract={!editingId}
              initialFiles={initialFiles}
            />

            <div className="space-y-4">
              {extractionSummary && (
                <div className="rounded-lg border border-[#D7F0FF] bg-[#F4FCFF] px-3 py-3 text-sm text-[#0B1B49]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold">تمت قراءة المرفق وتعبئة بيانات المورد والضريبة والأصناف</div>
                      <div className="mt-1 text-xs text-[#6B7280]">
                        <span className="font-english">{extractionSummary.fileName}</span>
                        {extractionSummary.vendor ? <> · {extractionSummary.vendor}</> : null}
                        {extractionSummary.documentNumber ? <> · رقم <span className="font-english">{extractionSummary.documentNumber}</span></> : null}
                        {extractionSummary.total ? <> · <span className="font-english">{extractionSummary.total.toFixed(2)} SAR</span></> : null}
                        {extractionSummary.confidence != null ? <> · ثقة <span className="font-english">{Math.round(extractionSummary.confidence * 100)}%</span></> : null}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-white px-2 py-1">قبل الضريبة <span className="font-english">{money(extractionSummary.subtotal || 0)}</span></div>
                        <div className="rounded bg-white px-2 py-1">الضريبة <span className="font-english">{money(extractionSummary.tax || 0)}</span></div>
                        <div className="rounded bg-white px-2 py-1">الأصناف <span className="font-english">{extractionSummary.lineCount}</span></div>
                      </div>
                      {extractionSummary.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {extractionSummary.warnings.map((warning, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              <span>{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[#374151]">المورد / الجهة</Label>
                  <Input placeholder="مثال: شركة الكهرباء" value={formData.vendorName} onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })} className="border-[#E5E7EB]" />
                  <p className="text-xs text-[#6B7280]">إذا لم يكن المورد مسجلاً سيتم إنشاؤه تلقائياً كجهة موردة.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151]">الرقم الضريبي للمورد</Label>
                  <Input dir="ltr" placeholder="300000000000003" value={formData.supplierTaxId} onChange={(e) => setFormData({ ...formData, supplierTaxId: normalizeDigits(e.target.value) })} className="border-[#E5E7EB] font-english" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[#374151]">التصنيف *</Label>
                  <Input placeholder="مثال: ضيافة ووجبات · فواتير خدمات" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="border-[#E5E7EB]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151]">رقم الفاتورة / الإيصال</Label>
                  <Input dir="ltr" placeholder="429299" value={formData.documentNumber} onChange={(e) => setFormData({ ...formData, documentNumber: normalizeDigits(e.target.value) })} className="border-[#E5E7EB] font-english" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[#374151]">التاريخ *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151]">طريقة الدفع *</Label>
                  <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v as ApiExpense["paymentMethod"] })}>
                    <SelectTrigger className="border-[#E5E7EB]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">نقداً</SelectItem>
                      <SelectItem value="BANK_TRANSFER">تحويل بنكي</SelectItem>
                      <SelectItem value="CARD">بطاقة ائتمان</SelectItem>
                      <SelectItem value="MADA">مدى</SelectItem>
                      <SelectItem value="STC_PAY">STC Pay</SelectItem>
                      <SelectItem value="CHECK">شيك</SelectItem>
                      <SelectItem value="OTHER">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-[#374151]">قبل الضريبة *</Label>
                  <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={(e) => {
                    const amount = normalizeDigits(e.target.value);
                    const tax = Number(normalizeDigits(formData.taxAmount || "0"));
                    setFormData({ ...formData, amount, totalAmount: String((Number(amount || 0) + tax).toFixed(2)) });
                  }} required dir="ltr" className="border-[#E5E7EB] font-english" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151]">ضريبة VAT</Label>
                  <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.taxAmount} onChange={(e) => {
                    const taxAmount = normalizeDigits(e.target.value);
                    const amount = Number(normalizeDigits(formData.amount || "0"));
                    setFormData({ ...formData, taxAmount, totalAmount: String((amount + Number(taxAmount || 0)).toFixed(2)) });
                  }} dir="ltr" className="border-[#E5E7EB] font-english" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#374151]">الإجمالي</Label>
                  <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: normalizeDigits(e.target.value) })} dir="ltr" className="border-[#E5E7EB] font-english" />
                </div>
              </div>

              {formData.lineItems.length > 0 && (
                <div className="rounded-lg border border-[#E5E7EB] bg-white">
                  <div className="flex items-center justify-between border-b border-[#F3F4F6] px-3 py-2">
                    <h3 className="text-sm font-semibold text-[#0B1B49]">الأصناف المقروءة</h3>
                    <span className="font-english text-xs text-[#6B7280]">{formData.lineItems.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2 text-start">الوصف</th>
                          <th className="px-3 py-2 text-start">الكمية</th>
                          <th className="px-3 py-2 text-start">السعر</th>
                          <th className="px-3 py-2 text-start">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.lineItems.map((line, idx) => (
                          <tr key={idx} className="border-t border-[#F3F4F6]">
                            <td className="px-3 py-2">{line.description}</td>
                            <td className="px-3 py-2 font-english">{line.quantity || 1}</td>
                            <td className="px-3 py-2 font-english">{money(line.unitPrice || 0)}</td>
                            <td className="px-3 py-2 font-english">{money(line.lineTotal ?? ((line.quantity || 1) * (line.unitPrice || 0)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[#374151]">ملاحظات</Label>
                <textarea rows={3} placeholder="تفاصيل إضافية..." value={formData.notes || formData.description} onChange={(e) => setFormData({ ...formData, notes: e.target.value, description: e.target.value })} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
              </div>

              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#0B1B49]">
                سيتم حفظ الإجمالي <span className="font-english font-semibold">{money(formTotal)}</span> مع {formData.attachments.length ? `${formData.attachments.length} مرفق` : "بدون مرفق"}.
              </div>
            </div>
          </div>
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  if (selected) {
    const lineItems = Array.isArray(selected.lineItems) ? selected.lineItems : [];
    const vendorName = selected.contact?.displayName || selected.vendorName || "غير محدد";
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setSelected(null)} className="border-[#E5E7EB]">
              <ArrowRight className="me-2 h-4 w-4" /> المصروفات
            </Button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.2rem", fontWeight: 700 }}>مصروف <span className="font-english">{selected.number}</span></h1>
              <p className="text-sm text-[#6B7280]">{vendorName} · {selected.category}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => { setSearchQuery(vendorName); setSelected(null); }} className="border-[#E5E7EB]">
              <Building2 className="me-2 h-4 w-4" /> مصاريف الجهة
            </Button>
            <Button variant="outline" onClick={openCreate} className="border-[#E5E7EB]">
              <CopyPlus className="me-2 h-4 w-4" /> مصروف جديد
            </Button>
            <Button variant="outline" onClick={() => openEdit(selected)} className="border-[#E5E7EB]">
              <Edit3 className="me-2 h-4 w-4" /> تعديل
            </Button>
            <Button variant="outline" onClick={() => push("info", "الإرسال بالبريد سيُربط لاحقاً بقوالب المصروفات")} className="border-[#E5E7EB]">
              <Send className="me-2 h-4 w-4" /> إرسال
            </Button>
            <Button variant="outline" onClick={() => push("info", "ربط المصروف بالحساب البنكي/القيد سيكون من شاشة المطابقة البنكية")} className="border-[#E5E7EB]">
              <Link2 className="me-2 h-4 w-4" /> ربط حساب
            </Button>
            {pendingDelete === selected.id ? (
              <InlineConfirm onConfirm={() => handleDelete(selected.id)} onCancel={() => setPendingDelete(null)} />
            ) : (
              <Button variant="outline" onClick={() => setPendingDelete(selected.id)} className="border-red-200 text-red-600 hover:bg-red-50">
                <Trash2 className="me-2 h-4 w-4" /> حذف
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-[#6B7280]">الإجمالي</p>
                    <p className="font-english text-[#0B1B49]" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{money(selected.total, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">قبل الضريبة</p>
                    <p className="font-english text-sm text-[#0B1B49]">{money(selected.subtotal ?? selected.amount, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">VAT</p>
                    <p className="font-english text-sm text-[#0B1B49]">{money(selected.taxAmount, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">طريقة الدفع</p>
                    <p className="text-sm text-[#0B1B49]">{PAYMENT_METHOD_LABELS[selected.paymentMethod]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5E7EB]">
              <CardHeader><CardTitle className="text-[#0B1B49]">بيانات المصروف</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div><span className="text-[#6B7280]">رقم المصروف:</span> <span className="font-english">{selected.number}</span></div>
                <div><span className="text-[#6B7280]">رقم الفاتورة:</span> <span className="font-english">{selected.documentNumber || selected.reference || "—"}</span></div>
                <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date.slice(0, 10)}</span></div>
                <div><span className="text-[#6B7280]">التصنيف:</span> <span>{selected.category}</span></div>
                <div><span className="text-[#6B7280]">المورد:</span> <span>{vendorName}</span></div>
                <div><span className="text-[#6B7280]">الرقم الضريبي:</span> <span className="font-english">{selected.contact?.taxId || selected.contact?.vatNumber || "—"}</span></div>
                {selected.description && <div className="md:col-span-2"><span className="text-[#6B7280]">الوصف:</span> <span>{selected.description}</span></div>}
                {selected.notes && <div className="md:col-span-2"><span className="text-[#6B7280]">ملاحظات:</span> <span>{selected.notes}</span></div>}
                {selected.duplicateOfId && <div className="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">يوجد مصروف مشابه وتم تعليمه للمراجعة.</div>}
              </CardContent>
            </Card>

            <Card className="border-[#E5E7EB]">
              <CardHeader><CardTitle className="text-[#0B1B49]">الأصناف والضريبة</CardTitle></CardHeader>
              <CardContent>
                {lineItems.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2 text-start">الوصف</th>
                          <th className="px-3 py-2 text-start">الكمية</th>
                          <th className="px-3 py-2 text-start">السعر</th>
                          <th className="px-3 py-2 text-start">VAT</th>
                          <th className="px-3 py-2 text-start">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((line, idx) => (
                          <tr key={idx} className="border-t border-[#F3F4F6]">
                            <td className="px-3 py-2">{line.description}</td>
                            <td className="px-3 py-2 font-english">{line.quantity || 1}</td>
                            <td className="px-3 py-2 font-english">{money(line.unitPrice || 0, selected.currency)}</td>
                            <td className="px-3 py-2 font-english">{line.taxRate != null ? `${Number(line.taxRate) * 100}%` : "—"}</td>
                            <td className="px-3 py-2 font-english">{money(line.lineTotal ?? ((line.quantity || 1) * (line.unitPrice || 0)), selected.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-3 py-4 text-sm text-[#6B7280]">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    لا توجد أصناف محفوظة لهذا المصروف. ارفع الإيصال أو عدل المصروف لإضافتها.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-[#0B1B49]">المرفق الأصلي</CardTitle>
                <span className="font-english text-xs text-[#6B7280]">{selected.attachmentName || selected.receiptUrl || "—"}</span>
              </div>
            </CardHeader>
            <CardContent>{renderStoredAttachment(selected)}</CardContent>
          </Card>
        </div>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المصروفات النقدية</h1>
          <p className="text-[#6B7280] mt-1">إدارة المصروفات اليومية مع قراءة الفواتير والمرفقات</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />مصروف جديد</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{money(total)}</div><p className="text-xs text-[#6B7280] mt-1">إجمالي</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">عدد المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div><p className="text-xs text-[#6B7280] mt-1">مصروف</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">متوسط المصروف</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{money(items.length ? avg : 0)}</div><p className="text-xs text-[#6B7280] mt-1">لكل مصروف</p></CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-[#0B1B49]">قائمة المصروفات</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث بالمورد، رقم الفاتورة، التصنيف..." className="w-full min-w-[260px] ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed">
              <colgroup>
                <col style={{ width: "13%" }} />
                <col />
                <col style={{ width: "16%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم</th>
                  <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المورد / التصنيف</th>
                  <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم الفاتورة</th>
                  <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                  <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ</th>
                  <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="py-8 text-center text-[#6B7280] text-sm">جارٍ التحميل...</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center"><Receipt className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد مصروفات · اضغط "مصروف جديد" لإضافة أول مصروف</p></td></tr>
                )}
                {!loading && filtered.map((e) => (
                  <tr key={e.id} onClick={() => openExpense(e)} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF] transition-colors cursor-pointer">
                    <td className="py-3 px-4"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{e.number}</span></td>
                    <td className="py-3 px-4">
                      <div className="truncate text-sm text-[#374151]">{e.contact?.displayName || e.vendorName || "—"}</div>
                      <div className="truncate text-xs text-[#6B7280]">{e.category}</div>
                    </td>
                    <td className="py-3 px-4"><span className="font-english text-sm text-[#6B7280]">{e.documentNumber || e.reference || "—"}</span></td>
                    <td className="py-3 px-4"><span className="font-english text-sm text-[#6B7280]">{e.date.slice(0, 10)}</span></td>
                    <td className="py-3 px-4">
                      <span className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{money(e.total, e.currency)}</span>
                      {Number(e.taxAmount) > 0 && <div className="font-english text-[11px] text-[#6B7280]">VAT {money(e.taxAmount, e.currency)}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => openExpense(e)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><Eye className="h-4 w-4" /></button>
                        {e.attachmentCount ? <FileImage className="h-4 w-4 text-[#1276E3]" /> : null}
                        {Number(e.taxAmount) > 0 ? <Wallet className="h-4 w-4 text-emerald-600" /> : null}
                        {pendingDelete === e.id ? (
                          <InlineConfirm onConfirm={() => handleDelete(e.id)} onCancel={() => setPendingDelete(null)} />
                        ) : (
                          <button onClick={() => setPendingDelete(e.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
