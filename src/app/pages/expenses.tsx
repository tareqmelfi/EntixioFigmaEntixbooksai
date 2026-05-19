/**
 * Expenses (المصروفات النقدية) · wired to /api/expenses
 * UX-1 compliant: NO Dialog · NO alert/confirm/prompt · NO SidePanel
 * UX pattern: FullPageForm · مطابق Wafeq
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { AlertTriangle, CheckCircle2, Receipt, Plus, Search, Eye, X, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { DocumentPreviewPane } from "../components/document-preview-pane";
import { normalizeDigits } from "../lib/digits";
import { api, Expense as ApiExpense, ExpenseInput, ApiError } from "../lib/api";

const PAYMENT_METHOD_LABELS: Record<ApiExpense["paymentMethod"], string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CARD: "بطاقة ائتمان",
  STC_PAY: "STC Pay",
  MADA: "مدى",
  CHECK: "شيك",
  OTHER: "أخرى",
};

const EMPTY_FORM = {
  category: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  paymentMethod: "CASH" as ApiExpense["paymentMethod"],
  description: "",
  vendorName: "",
};

type ExtractionSummary = {
  fileName: string;
  vendor?: string | null;
  total?: number | null;
  date?: string | null;
  confidence?: number | null;
  model?: string | null;
  warnings: string[];
};

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

function extractedTotal(data: any): number | null {
  const value = data?.totals?.total ?? data?.total ?? data?.lines?.[0]?.lineTotal ?? null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildExtractionWarnings(data: any, items: ApiExpense[], total: number | null): string[] {
  const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];
  const date = data?.issueDate || null;
  const vendor = data?.issuer?.name || "";
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
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
      setFormData(EMPTY_FORM);
      setExtractionSummary(null);
      setCreateError(null);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = items.filter((e) =>
    !searchQuery
      || e.category.includes(searchQuery)
      || e.number.includes(searchQuery)
      || (e.description || "").includes(searchQuery)
      || (e.vendorName || "").includes(searchQuery)
  );
  const total = Number(summary.sumTotal || 0);
  const avg = Number(summary.avgTotal || 0);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setExtractionSummary(null);
    setCreateError(null);
    setCreateOpen(true);
  };
  const closeCreate = () => { setCreateOpen(false); setCreateError(null); setExtractionSummary(null); };

  const handleSubmit = async () => {
    setCreateError(null);
    if (!formData.category.trim() || !formData.amount || Number(normalizeDigits(formData.amount)) <= 0) {
      setCreateError("الرجاء تعبئة التصنيف والمبلغ");
      return;
    }
    setBusy(true);
    try {
      const input: ExpenseInput = {
        date: formData.date,
        category: formData.category.trim(),
        amount: Number(normalizeDigits(formData.amount)),
        paymentMethod: formData.paymentMethod,
        description: formData.description || null,
        vendorName: formData.vendorName || null,
      };
      const created = await api.expenses.create(input);
      setItems(prev => [created, ...prev]);
      setSummary(s => ({
        sumTotal: String(Number(s.sumTotal) + Number(created.total)),
        avgTotal: String((Number(s.sumTotal) + Number(created.total)) / (items.length + 1)),
      }));
      push("success", `تم حفظ المصروف ${created.number}`);
      closeCreate();
    } catch (e: any) {
      setCreateError(e instanceof ApiError ? `${e.message}: ${e.detail || ""}` : "فشل حفظ المصروف");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.expenses.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", "تم حذف المصروف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    }
  };

  // Full-page Create form
  if (createOpen) {
    return (
      <>
        <FullPageForm
          title="مصروف جديد"
          subtitle="املأ البيانات الأساسية للمصروف النقدي"
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreate} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? "..." : "حفظ"}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 max-w-6xl mx-auto">
            {/* Left · Document preview pane (Wafeq pattern) */}
            <DocumentPreviewPane
              hint="اسحب صورة الإيصال أو ملف PDF هنا"
              onExtract={async (file) => {
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
                  const total = extractedTotal(data);
                  const warnings = buildExtractionWarnings(data, items, total);
                  setFormData((f) => ({
                    ...f,
                    category: f.category || data?.category || data?.lines?.[0]?.description || data?.notes || f.category,
                    amount: total ? String(total) : f.amount,
                    date: data?.issueDate || f.date,
                    vendorName: data?.issuer?.name || f.vendorName,
                    description: data?.notes || data?.documentNumber || f.description,
                  }));
                  setExtractionSummary({
                    fileName: file.name,
                    vendor: data?.issuer?.name || null,
                    total,
                    date: data?.issueDate || null,
                    confidence: data?.confidence ?? null,
                    model: data?._meta?.model || null,
                    warnings,
                  });
                  push("success", `تم استخراج البيانات بثقة ${Math.round((data?.confidence || 0) * 100)}%`);
                } catch (e: any) {
                  push("error", e instanceof ApiError ? `${e.message}: ${e.detail || ""}` : "فشل الاستخراج");
                }
              }}
            />

            {/* Right · Form */}
            <div className="space-y-4">
            {extractionSummary && (
              <div className="rounded-lg border border-[#D7F0FF] bg-[#F4FCFF] px-3 py-3 text-sm text-[#0B1B49]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold">تمت قراءة المرفق وتعبئة الحقول القابلة للتأكد</div>
                    <div className="mt-1 text-xs text-[#6B7280]">
                      <span className="font-english">{extractionSummary.fileName}</span>
                      {extractionSummary.vendor ? <> · {extractionSummary.vendor}</> : null}
                      {extractionSummary.total ? <> · <span className="font-english">{extractionSummary.total.toFixed(2)} SAR</span></> : null}
                      {extractionSummary.date ? <> · <span className="font-english">{extractionSummary.date}</span></> : null}
                      {extractionSummary.confidence != null ? <> · ثقة <span className="font-english">{Math.round(extractionSummary.confidence * 100)}%</span></> : null}
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
            <div className="space-y-2">
              <Label className="text-[#374151]">التصنيف *</Label>
              <Input placeholder="مثال: إيجار المكتب · رواتب · فواتير" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="border-[#E5E7EB]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[#374151]">التاريخ *</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required dir="ltr" className="border-[#E5E7EB] font-english" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#374151]">المبلغ (SR) *</Label>
                <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: normalizeDigits(e.target.value) })} required dir="ltr" className="border-[#E5E7EB] font-english" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label className="text-[#374151]">المورد / الجهة (اختياري)</Label>
                <Input placeholder="مثال: شركة الكهرباء" value={formData.vendorName} onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })} className="border-[#E5E7EB]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#374151]">ملاحظات (اختياري)</Label>
              <textarea rows={3} placeholder="تفاصيل إضافية..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
            </div>
            </div>{/* /right column */}
          </div>{/* /grid */}
        </FullPageForm>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelected(null)} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.15rem", fontWeight: 700 }}>مصروف <span className="font-english">{selected.number}</span></h1>
              <p className="text-[#6B7280] text-sm">{selected.category}</p>
            </div>
          </div>
          {pendingDelete === selected.id ? (
            <InlineConfirm onConfirm={() => handleDelete(selected.id)} onCancel={() => setPendingDelete(null)} />
          ) : (
            <Button variant="outline" onClick={() => setPendingDelete(selected.id)} className="border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 className="me-2 h-4 w-4" /> حذف
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>بيانات المصروف</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#6B7280]">رقم:</span> <span className="font-english">{selected.number}</span></div>
              <div><span className="text-[#6B7280]">التاريخ:</span> <span className="font-english">{selected.date.slice(0, 10)}</span></div>
              <div><span className="text-[#6B7280]">التصنيف:</span> <span>{selected.category}</span></div>
              <div><span className="text-[#6B7280]">طريقة الدفع:</span> <span>{PAYMENT_METHOD_LABELS[selected.paymentMethod]}</span></div>
              {selected.vendorName && <div><span className="text-[#6B7280]">المورد:</span> <span>{selected.vendorName}</span></div>}
              {selected.description && <div className="col-span-2"><span className="text-[#6B7280]">الوصف:</span> <span>{selected.description}</span></div>}
            </div>
          </CardContent></Card>
          <Card className="border-[#E5E7EB]"><CardContent className="p-5 space-y-3">
            <h3 className="text-[#0B1B49]" style={{ fontWeight: 600 }}>المبلغ</h3>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{Number(selected.total).toLocaleString()} {selected.currency}</div>
            {Number(selected.taxAmount) > 0 && (
              <p className="text-xs text-[#6B7280]">شامل ضريبة <span className="font-english">{Number(selected.taxAmount).toLocaleString()}</span></p>
            )}
          </CardContent></Card>
        </div>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المصروفات النقدية</h1><p className="text-[#6B7280] mt-1">إدارة المصروفات اليومية</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}><Plus className="me-2 h-4 w-4" />مصروف جديد</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">إجمالي المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{total.toLocaleString()} SR</div><p className="text-xs text-[#6B7280] mt-1">إجمالي</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">عدد المصروفات</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div><p className="text-xs text-[#6B7280] mt-1">مصروف</p></CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#6B7280]">متوسط المصروف</CardTitle></CardHeader>
          <CardContent><div className="text-[#0B1B49] font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length ? Math.round(avg).toLocaleString() : 0} SR</div><p className="text-xs text-[#6B7280] mt-1">لكل مصروف</p></CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة المصروفات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "13%" }} />
              <col />
              <col style={{ width: "13%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التصنيف</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الطريقة</th>
                <th className="py-3 px-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="py-8 text-center text-[#6B7280] text-sm">جارٍ التحميل...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center"><Receipt className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد مصروفات · اضغط "مصروف جديد" لإضافة أول مصروف</p></td></tr>
              )}
              {!loading && filtered.map((e) => (
                <tr key={e.id} onClick={() => setSelected(e)} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF] transition-colors cursor-pointer">
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{e.number}</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#374151]">{e.category}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#6B7280]">{e.date.slice(0, 10)}</span></td>
                  <td className="py-3 px-4"><span className="font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(e.total).toLocaleString()} SR</span></td>
                  <td className="py-3 px-4"><span className="text-sm text-[#6B7280]">{PAYMENT_METHOD_LABELS[e.paymentMethod]}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                      <button onClick={() => setSelected(e)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><Eye className="h-4 w-4" /></button>
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
        </CardContent>
      </Card>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
