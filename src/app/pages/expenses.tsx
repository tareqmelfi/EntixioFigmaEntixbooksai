/**
 * Expenses (المصروفات النقدية) · wired to /api/expenses
 * UX pattern: FullPageForm with document preview and receipt OCR.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CopyPlus,
  Edit3,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Link2,
  Paperclip,
  Plus,
  Upload,
  Receipt,
  Search,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { FullPageForm } from "../components/full-page-form";
import { DocumentPreviewPane } from "../components/document-preview-pane";
import { normalizeDigits } from "../lib/digits";
import { useReturnTo } from "../lib/use-return-to";
import { api, Expense as ApiExpense, ExpenseInput, ExpenseLine, ExpensePaymentSplit, ExpenseAttachment } from "../lib/api";
import { buildDuplicateDecision, getSimilarityReview, type SimilarityReview } from "../lib/similarity-review";
import { SimilarityReviewDialog } from "../components/similarity-review-dialog";
import { SearchableCombobox } from "../components/searchable-combobox";
import { AttachmentViewer, ViewerAttachment } from "../components/attachment-viewer";
import { useLanguage } from "../components/LanguageContext";
import { BranchField } from "../components/branch-field";
import { ProjectField } from "../components/project-field";
import { useOrgRegion } from "../lib/use-org-region";
import { humanizeError } from "../lib/error-messages";

type Translate = (ar: string, en?: string) => string;

function paymentMethodLabels(t: Translate): Record<ApiExpense["paymentMethod"], string> {
  return {
    CASH: t("نقداً", "Cash"),
    BANK_TRANSFER: t("تحويل بنكي", "Bank Transfer"),
    CARD: t("بطاقة ائتمان", "Credit Card"),
    STC_PAY: "STC Pay",
    MADA: t("مدى", "Mada"),
    CHECK: t("شيك", "Check"),
    OTHER: t("أخرى", "Other"),
  };
}

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
  sourceCurrency: string;
  baseCurrency: string;
  exchangeRate: string;
  actualPaidCurrency: string;
  actualPaidAmount: string;
  fxTreatment: FxTreatment;
  paymentMethod: ApiExpense["paymentMethod"];
  description: string;
  vendorName: string;
  supplierTaxId: string;
  documentNumber: string;
  notes: string;
  lineItems: ExpenseLine[];
  paymentSplits: ExpensePaymentSplit[];
  attachments: UploadedAttachment[];
  extractedJson: any;
  ocrConfidence: number | null;
  /** تسجيل المصروف كأصل ثابت تلقائياً عند الحفظ */
  registerAsAsset?: boolean;
  /** حساب الأصل من الشجرة — اختيار حساب داخل فرع الأصول يسجّله تلقائياً حتى بدون تفعيل العلم */
  assetAccountId?: string;
  /** Branch dimension (B1) · undefined = apply member default · null = none */
  branchId?: string | null;
  /** Project / job-costing dimension (C2) */
  projectId?: string | null;
};

type ExtractionSummary = {
  fileName: string | null;
  vendor?: string | null;
  vendorCr?: string | null;
  vendorUnn?: string | null;
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

type FxTreatment = "MERGE_INTO_EXPENSE" | "FX_LOSS" | "BANK_FEE";

type CurrencySettlement = {
  sourceCurrency: string;
  baseCurrency: string;
  actualPaidCurrency: string;
  sourceTotal: number;
  exchangeRate: number;
  bookBaseAmount: number;
  actualPaidAmount: number;
  actualRate: number;
  difference: number;
  treatment: FxTreatment;
  treatmentLabel: string;
  isCrossCurrency: boolean;
};

function currencies(t: Translate) {
  return [
    { value: "SAR", label: t("ريال سعودي · SAR", "Saudi Riyal · SAR") },
    { value: "USD", label: t("دولار أمريكي · USD", "US Dollar · USD") },
    { value: "EUR", label: t("يورو · EUR", "Euro · EUR") },
    { value: "AED", label: t("درهم إماراتي · AED", "UAE Dirham · AED") },
    { value: "GBP", label: t("جنيه إسترليني · GBP", "British Pound · GBP") },
  ];
}

const CURRENCY_VALUES = ["SAR", "USD", "EUR", "AED", "GBP"];

/**
 * Compact segmented control — the app standard for enums.
 * Popup/dropdown menus are forbidden in this product: enums render as
 * segmented buttons, entities use SearchableCombobox.
 */
function SegGroup({ value, onChange, options, compact }: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1 w-fit max-w-full">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md transition-colors ${compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"} ${value === o.value ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          style={{ fontWeight: value === o.value ? 700 : 500 }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function fxTreatmentLabels(t: Translate): Record<FxTreatment, string> {
  return {
    MERGE_INTO_EXPENSE: t("ادمج الفرق في تكلفة المصروف", "Merge the difference into the expense cost"),
    FX_LOSS: t("سجل الفرق كخسارة / ربح فرق عملة", "Record the difference as FX loss / gain"),
    BANK_FEE: t("سجل الفرق كتكلفة تحويل أو رسوم بنك", "Record the difference as transfer cost or bank fees"),
  };
}

const DEFAULT_RATES_TO_SAR: Record<string, number> = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.1,
  AED: 1.02,
  GBP: 4.8,
};

const EXPENSE_DRAFT_KEY = "entix.expenses.currentDraft.v2";

function emptyForm(): FormState {
  return {
    category: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    taxAmount: "",
    totalAmount: "",
    sourceCurrency: "SAR",
    baseCurrency: "SAR",
    exchangeRate: "1",
    actualPaidCurrency: "SAR",
    actualPaidAmount: "",
    fxTreatment: "FX_LOSS",
    paymentMethod: "CASH",
    description: "",
    vendorName: "",
    supplierTaxId: "",
    documentNumber: "",
    notes: "",
    lineItems: [],
    paymentSplits: [],
    attachments: [],
    extractedJson: null,
    ocrConfidence: null,
    registerAsAsset: false,
    assetAccountId: "",
    branchId: undefined,
    projectId: null,
  };
}

function hasDraftContent(form: FormState) {
  const empty = emptyForm();
  return Boolean(
    form.category.trim()
    || form.amount.trim()
    || form.taxAmount.trim()
    || form.totalAmount.trim()
    || form.sourceCurrency !== empty.sourceCurrency
    || form.baseCurrency !== empty.baseCurrency
    || form.exchangeRate !== empty.exchangeRate
    || form.actualPaidCurrency !== empty.actualPaidCurrency
    || form.actualPaidAmount.trim()
    || form.fxTreatment !== empty.fxTreatment
    || form.description.trim()
    || form.vendorName.trim()
    || form.supplierTaxId.trim()
    || form.documentNumber.trim()
    || form.notes.trim()
    || form.lineItems.length
    || form.paymentSplits.length
    || form.attachments.length
    || form.extractedJson
    || form.date !== empty.date
  );
}

function attachmentPreviewUrl(attachment: UploadedAttachment) {
  if (!attachment.base64) return "";
  const type = attachment.type || "application/octet-stream";
  if (/heic|heif/i.test(type) || /\.(heic|heif)$/i.test(attachment.name)) return "";
  if (type.startsWith("image/") || type === "application/pdf" || /\.pdf$/i.test(attachment.name)) {
    return `data:${type};base64,${attachment.base64}`;
  }
  return "";
}

function isBankStatementBlocked(data: any, fileName?: string): boolean {
  if (!data) return false;
  if (data.status === "needs_bank_statement_review" || data.documentType === "bank_statement") return true;
  const text = [
    fileName,
    data.message,
    data.notes,
    ...(Array.isArray(data.warnings) ? data.warnings : []),
  ].filter(Boolean).join("\n").toLowerCase();
  return /bank[\s_-]*statement|account[\s_-]*statement|statement of account|كشف\s+حساب|كشف\s*الحساب/.test(text);
}

function readExpenseDraft(): { formData: FormState; extractionSummary: ExtractionSummary | null; updatedAt: string } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(EXPENSE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.formData) return null;
    return {
      formData: {
        ...emptyForm(),
        ...parsed.formData,
        lineItems: Array.isArray(parsed.formData.lineItems) ? parsed.formData.lineItems : [],
        paymentSplits: Array.isArray(parsed.formData.paymentSplits) ? parsed.formData.paymentSplits : [],
        attachments: Array.isArray(parsed.formData.attachments)
          ? parsed.formData.attachments.filter((a: UploadedAttachment) => a?.base64)
          : [],
      },
      extractionSummary: parsed.extractionSummary || null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeExpenseDraft(formData: FormState, extractionSummary: ExtractionSummary | null) {
  if (typeof localStorage === "undefined") return;
  const payload = { formData, extractionSummary, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(EXPENSE_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    const slim = {
      ...payload,
      formData: {
        ...formData,
        attachments: [],
      },
    };
    try { localStorage.setItem(EXPENSE_DRAFT_KEY, JSON.stringify(slim)); } catch {}
  }
}

function clearExpenseDraft() {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(EXPENSE_DRAFT_KEY); } catch {}
}

function hasStoredExpenseDraft() {
  const draft = readExpenseDraft();
  return Boolean(draft && hasDraftContent(draft.formData));
}

function draftTimeLabel(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
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

function normalizeCurrency(value: any, fallback = "SAR"): string {
  const raw = String(value || "").trim().toUpperCase();
  const code = raw.match(/[A-Z]{3}/)?.[0];
  if (code && CURRENCY_VALUES.includes(code)) return code;
  return fallback;
}

function defaultExchangeRate(sourceCurrency: string, baseCurrency: string): number {
  if (sourceCurrency === baseCurrency) return 1;
  if (baseCurrency === "SAR") return DEFAULT_RATES_TO_SAR[sourceCurrency] || 1;
  if (sourceCurrency === "SAR" && DEFAULT_RATES_TO_SAR[baseCurrency]) {
    return Number((1 / DEFAULT_RATES_TO_SAR[baseCurrency]).toFixed(6));
  }
  const sourceToSar = DEFAULT_RATES_TO_SAR[sourceCurrency];
  const baseToSar = DEFAULT_RATES_TO_SAR[baseCurrency];
  if (sourceToSar && baseToSar) return Number((sourceToSar / baseToSar).toFixed(6));
  return 1;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function detectedDocumentCurrency(data: any, fallback = "SAR"): string {
  return normalizeCurrency(
    data?.currency
      || data?.documentCurrency
      || data?.sourceCurrency
      || data?.totals?.currency
      || data?.totals?.sourceCurrency
      || data?._meta?.currency
      || data?._meta?.sourceCurrency,
    fallback,
  );
}

function calculateCurrencySettlement(form: FormState, sourceTotal: number, t: Translate): CurrencySettlement {
  const sourceCurrency = normalizeCurrency(form.sourceCurrency);
  const baseCurrency = normalizeCurrency(form.baseCurrency, sourceCurrency);
  const actualPaidCurrency = normalizeCurrency(form.actualPaidCurrency, baseCurrency);
  const exchangeRate = Number(normalizeDigits(form.exchangeRate || "0")) || defaultExchangeRate(sourceCurrency, baseCurrency);
  const bookBaseAmount = roundMoney(sourceTotal * exchangeRate);
  const actualPaidAmountInput = Number(normalizeDigits(form.actualPaidAmount || "0"));
  const actualPaidAmount = roundMoney(
    actualPaidAmountInput > 0
      ? actualPaidAmountInput
      : (actualPaidCurrency === sourceCurrency ? sourceTotal : bookBaseAmount),
  );
  const actualRate = sourceTotal > 0 ? roundMoney(actualPaidAmount / sourceTotal) : exchangeRate;
  const difference = roundMoney(actualPaidAmount - bookBaseAmount);
  return {
    sourceCurrency,
    baseCurrency,
    actualPaidCurrency,
    sourceTotal: roundMoney(sourceTotal),
    exchangeRate,
    bookBaseAmount,
    actualPaidAmount,
    actualRate,
    difference,
    treatment: form.fxTreatment,
    treatmentLabel: fxTreatmentLabels(t)[form.fxTreatment],
    isCrossCurrency: sourceCurrency !== baseCurrency || sourceCurrency !== actualPaidCurrency,
  };
}

function enrichPaymentSplits(
  payments: ExpensePaymentSplit[],
  settlement: CurrencySettlement,
): ExpensePaymentSplit[] {
  return payments.map((payment) => {
    const currency = normalizeCurrency(payment.currency, settlement.actualPaidCurrency);
    const amount = Number(payment.amount || 0);
    const rate = currency === settlement.sourceCurrency
      ? settlement.exchangeRate
      : (currency === settlement.baseCurrency ? 1 : defaultExchangeRate(currency, settlement.baseCurrency));
    return {
      ...payment,
      currency,
      exchangeRate: rate,
      baseAmount: roundMoney(currency === settlement.baseCurrency ? amount : amount * rate),
      fxDifference: settlement.isCrossCurrency ? settlement.difference : 0,
      fxTreatment: settlement.treatment,
      notes: payment.notes || (settlement.isCrossCurrency ? settlement.treatmentLabel : null),
    };
  });
}

function cleanVendorName(value: any): string {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw
    .replace(/\s+-\s+/g, " · ")
    .replace(/^(store|branch|cashier|supplier)\s*[:#-]?\s*/i, "")
    .replace(/\b(customer service|simplified tax invoice|vat number)\b.*$/i, "")
    .trim();
}

function money(value: any, currency = "SAR") {
  const n = Number(value || 0);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${currency}`;
}

function extractionTotals(data: any) {
  // When lines exist, header derives from them deterministically — never trust the
  // extractor's header (it once treated an inclusive line as net and added VAT twice).
  if (Array.isArray(data?.lines) && data.lines.length > 0) {
    let net = 0, vat = 0, gross = 0, used = 0;
    for (const line of data.lines) {
      const qty = num(line?.quantity) || 1;
      const price = num(line?.unitPrice);
      if (price == null) continue;
      const rate = num(line?.taxRate) || 0;
      const base = Math.max(0, qty * price - (num(line?.discountAmount ?? line?.discount) || 0));
      if (line?.taxInclusive) {
        const g = num(line?.lineTotal) ?? base;
        const n = rate > 0 ? g / (1 + rate) : g;
        net += n; vat += g - n; gross += g;
      } else {
        net += base; vat += base * rate; gross += base * (1 + rate);
      }
      used++;
    }
    if (used > 0) {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      return { subtotal: r2(net), tax: r2(vat), total: r2(gross) };
    }
  }
  let total = num(data?.totals?.total ?? data?.total);
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

function normalizeLineItems(data: any, lang: "ar" | "en" = "ar"): ExpenseLine[] {
  if (!Array.isArray(data?.lines)) return [];
  return data.lines
    .map((line: any) => {
      const description = String(line?.description || "").trim();
      if (!description) return null;
      const quantity = num(line?.quantity) || 1;
      const lineTotal = num(line?.lineTotal);
      const unitPrice = num(line?.unitPrice) ?? (lineTotal != null ? lineTotal / quantity : 0);
      const discountAmount = num(line?.discountAmount ?? line?.discount) || 0;
      const subtotal = num(line?.subtotal) ?? Math.max(0, (quantity * unitPrice) - discountAmount);
      return {
        description,
        quantity,
        unitPrice,
        discountAmount,
        taxRate: num(line?.taxRate),
        taxInclusive: Boolean(line?.taxInclusive),
        lineTotal: lineTotal ?? subtotal,
        subtotal,
        category: line?.category || inferLineCategory(description, lang),
        accountName: line?.accountName || suggestLineAccount(description, lang),
        costCenter: line?.costCenter || null,
        projectCode: line?.projectCode || null,
        sku: line?.sku || null,
        sourceCurrency: detectedDocumentCurrency(data),
        notes: line?.notes || null,
      };
    })
    .filter(Boolean) as ExpenseLine[];
}

// Auto-suggested categories/accounts are saved as expense data, so they must
// follow the org's working language — never store Arabic for English UIs.
function inferLineCategory(text: string, lang: "ar" | "en" = "ar"): string {
  const value = text.toLowerCase();
  const en = lang === "en";
  if (/coffee|coffeemate|cereal|food|market|grocery|بقال|تموين|غذائ|قهوة|حبوب/.test(value)) return en ? "Groceries & food supplies" : "مواد غذائية";
  if (/restaurant|meal|chicken|وجبة|مطعم|دجاج/.test(value)) return en ? "Meals & hospitality" : "ضيافة ووجبات";
  if (/fuel|gas|بنزين|وقود/.test(value)) return en ? "Fuel" : "وقود";
  if (/software|subscription|app|برنامج|اشتراك/.test(value)) return en ? "Software & subscriptions" : "برامج واشتراكات";
  return en ? "General expense" : "مصروف عام";
}

function suggestLineAccount(text: string, lang: "ar" | "en" = "ar"): string {
  const value = text.toLowerCase();
  const en = lang === "en";
  if (/coffee|coffeemate|cereal|food|market|grocery|بقال|تموين|غذائ|قهوة|حبوب/.test(value)) return en ? "509-01 · Grocery & food purchases" : "509-01 · مشتريات البقالة والمواد الغذائية";
  if (/restaurant|meal|chicken|وجبة|مطعم|دجاج/.test(value)) return en ? "509-02 · Meals & hospitality" : "509-02 · ضيافة ووجبات";
  if (/fuel|gas|بنزين|وقود/.test(value)) return en ? "509-03 · Fuel & transport" : "509-03 · وقود وتنقل";
  if (/software|subscription|app|برنامج|اشتراك/.test(value)) return en ? "509-04 · Software & subscriptions" : "509-04 · برامج واشتراكات";
  return en ? "509-99 · General expenses" : "509-99 · مصروفات عامة";
}

function normalizePaymentMethod(value: any): ApiExpense["paymentMethod"] {
  const raw = String(value || "").toUpperCase();
  if (raw.includes("CASH") || raw.includes("نقد")) return "CASH";
  if (raw.includes("MADA") || raw.includes("مدى")) return "MADA";
  if (raw.includes("STC")) return "STC_PAY";
  if (raw.includes("BANK") || raw.includes("TRANSFER") || raw.includes("تحويل")) return "BANK_TRANSFER";
  if (raw.includes("CHECK") || raw.includes("شيك")) return "CHECK";
  if (raw.includes("CARD") || raw.includes("MASTER") || raw.includes("VISA") || raw.includes("EFT")) return "CARD";
  return "OTHER";
}

function normalizePayments(data: any, total: number, fallbackMethod: ApiExpense["paymentMethod"], currency = "SAR"): ExpensePaymentSplit[] {
  const fromModel = Array.isArray(data?.payments) ? data.payments : [];
  const payments = fromModel
    .map((payment: any) => {
      const amount = num(payment?.amount);
      if (!amount || amount <= 0) return null;
      return {
        method: normalizePaymentMethod(payment?.method || payment?.accountName || payment?.notes),
        amount,
        currency: normalizeCurrency(payment?.currency, currency),
        reference: payment?.reference || null,
        cardLast4: payment?.cardLast4 || String(payment?.reference || "").match(/\*{2,}(\d{4})/)?.[1] || null,
        accountName: payment?.accountName || null,
        notes: payment?.notes || null,
      };
    })
    .filter(Boolean) as ExpensePaymentSplit[];
  if (payments.length) return payments;
  return total > 0 ? [{ method: fallbackMethod, amount: total, currency, reference: null, cardLast4: null, accountName: null, notes: null }] : [];
}

function paymentTotal(payments: ExpensePaymentSplit[]): number {
  return payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

function inferCategory(data: any, lang: "ar" | "en" = "ar"): string {
  const explicit = String(data?.category || "").trim();
  if (explicit) return explicit;
  const text = JSON.stringify(data?.lines || []).toLowerCase();
  const en = lang === "en";
  if (/coffeemate|cereal|tamimi|markets|بقال|تموين|غذائ|حبوب/.test(text)) return en ? "Grocery & food purchases" : "مشتريات بقالة ومواد غذائية";
  if (/chicken|restaurant|meal|food|وجبة|دجاج|مطعم|قهوة|ضيافة/.test(text)) return en ? "Meals & hospitality" : "ضيافة ووجبات";
  if (/electric|water|utility|كهرباء|مياه|فاتورة/.test(text)) return en ? "Utility bills" : "فواتير خدمات";
  return en ? "Purchases & bills" : "مشتريات وفواتير";
}

function buildExtractionWarnings(t: Translate, data: any, items: ApiExpense[], total: number | null): string[] {
  const warnings = Array.isArray(data?.warnings) ? [...data.warnings] : [];
  const date = data?.issueDate || null;
  const vendor = data?.issuer?.name || "";
  if (!data?.issuer?.name) warnings.push(t("اسم المورد غير واضح؛ سيتم حفظه كنص ويمكن تعديله قبل الحفظ.", "Supplier name unclear; will be saved as text and can be edited before saving."));
  if (!date) warnings.push(t("لم يتم تحديد تاريخ واضح من الإيصال، راجع التاريخ قبل الحفظ.", "No clear date detected from receipt, check the date before saving."));
  if (date) {
    const parsed = new Date(`${date}T00:00:00`);
    const today = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    if (parsed.getTime() > today.getTime() + 86_400_000) warnings.push(t("تاريخ الإيصال في المستقبل، راجعه قبل الحفظ.", "Receipt date is in the future, check before saving."));
    if (parsed < twoYearsAgo) warnings.push(t("تاريخ الإيصال قديم جداً، تأكد أنه ليس قراءة خاطئة.", "Receipt date is very old, make sure it is not a misread."));
  }
  if (total && date) {
    const duplicate = items.find((item) => {
      const sameAmount = Math.abs(Number(item.total || 0) - total) < 0.01;
      const sameDate = String(item.date || "").slice(0, 10) === date;
      const sameVendor = !vendor || !item.vendorName || item.vendorName.toLowerCase().includes(vendor.toLowerCase()) || vendor.toLowerCase().includes(item.vendorName.toLowerCase());
      return sameAmount && sameDate && sameVendor;
    });
    if (duplicate) warnings.push(t("قد يكون مسجلاً مسبقاً: ", "May already be registered: ") + duplicate.number + t(" بنفس التاريخ والمبلغ.", " with same date and amount."));
  }
  return Array.from(new Set(warnings.filter(Boolean)));
}

function selectedAttachment(t: Translate, expense: ApiExpense) {
  const type = expense.attachmentType || "";
  const base64 = expense.attachmentBase64 || "";
  const name = expense.attachmentName || expense.receiptUrl || t("المرفق", "Attachment");
  if (base64) return { type, base64, name };
  if (expense.receiptUrl) return { type, url: expense.receiptUrl, name };
  return null;
}


export function Expenses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ApiExpense[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [summary, setSummary] = useState<{ sumTotal: string; avgTotal: string; sumByCurrency?: Array<{ currency: string; total: string }> }>({ sumTotal: "0", avgTotal: "0" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<ApiExpense | null>(null);
  const [detailAttachments, setDetailAttachments] = useState<Array<ViewerAttachment & { _id?: string }>>([]);
  const [activeAttIdx, setActiveAttIdx] = useState(0);
  const [attBusy, setAttBusy] = useState(false);
  const attFileRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { goBack: goBackToSource } = useReturnTo();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingSimilarity, setPendingSimilarity] = useState<{ review: SimilarityReview; input: ExpenseInput } | null>(null);
  const [formData, setFormData] = useState<FormState>(() => emptyForm());
  const [accounts, setAccounts] = useState<any[]>([]);
  const [extractionSummary, setExtractionSummary] = useState<ExtractionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(() => hasStoredExpenseDraft());
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const { language, t } = useLanguage();
  const { currency: orgCurrency } = useOrgRegion();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.expenses.list({ limit: 200 });
      setItems(data.items);
      setSummary(data.summary);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تحميل المصروفات", en: "Failed to load expenses" }));
    } finally {
      setLoading(false);
    }
  }, [push, language]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    api.accounts.list().then((d) => setAccounts((d as any).items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // Receipt Capture → "تعديل في النموذج" · prefill from the stashed OCR JSON.
    if (searchParams.get("fromOcr") === "1") {
      try {
        const raw = sessionStorage.getItem("entix_ocr_prefill");
        if (raw) {
          const ocr = JSON.parse(raw);
          setEditingId(null);
          if (ocr && !ocr.__error && (ocr.issuer || ocr.totals || Array.isArray(ocr.lines))) {
            // Raw extractor shape (issuer/totals/lines) — map it exactly like handleExtract
            // so amounts, line items, payments and the document's own currency survive.
            const totals = extractionTotals(ocr);
            const lineItems = normalizeLineItems(ocr, language);
            const sourceCurrency = detectedDocumentCurrency(ocr, "SAR");
            const baseCurrency = normalizeCurrency("SAR");
            const exchangeRate = String(defaultExchangeRate(sourceCurrency, baseCurrency));
            const payments = normalizePayments(ocr, totals.total, "CARD", sourceCurrency);
            const warnings = buildExtractionWarnings(t, ocr, items, totals.total || null);
            const vendorName = cleanVendorName(ocr?.issuer?.name);
            setFormData((f: any) => ({
              ...emptyForm(),
              ...f,
              category: inferCategory(ocr, language),
              amount: totals.subtotal ? String(totals.subtotal) : (totals.total ? String(totals.total) : f.amount),
              taxAmount: totals.tax ? String(totals.tax) : f.taxAmount,
              totalAmount: totals.total ? String(totals.total) : f.totalAmount,
              sourceCurrency,
              baseCurrency,
              exchangeRate,
              date: ocr?.issueDate ? String(ocr.issueDate).slice(0, 10) : f.date,
              vendorName: vendorName || f.vendorName,
              supplierTaxId: ocr?.issuer?.taxId || f.supplierTaxId,
              documentNumber: ocr?.documentNumber || f.documentNumber,
              description: ocr?.notes || ocr?.documentNumber || (lineItems.length ? t("بنود مُستخرجة", "extracted items") : "") || f.description,
              lineItems: lineItems.length ? lineItems.map((line) => ({ ...line, sourceCurrency })) : f.lineItems,
              paymentSplits: payments.length ? payments : f.paymentSplits,
              paymentMethod: payments[0]?.method || f.paymentMethod,
              extractedJson: ocr,
              ocrConfidence: ocr?.confidence ?? null,
            }));
            setExtractionSummary({
              fileName: null,
              vendor: vendorName || null,
              total: totals.total || null,
              tax: totals.tax || null,
              subtotal: totals.subtotal || null,
              date: ocr?.issueDate || null,
              documentNumber: ocr?.documentNumber || null,
              confidence: ocr?.confidence ?? null,
              model: ocr?._meta?.model || null,
              lineCount: lineItems.length,
              warnings,
            });
          } else {
            // Legacy flat shape / error envelope · keep the previous lenient mapping.
            setFormData((f: any) => ({
              ...emptyForm(),
              ...f,
              vendorName: ocr.vendor || f.vendorName || "",
              date: ocr.date ? String(ocr.date).slice(0, 10) : f.date,
              totalAmount: ocr.total != null ? String(ocr.total) : f.totalAmount,
              amount: ocr.subtotal != null ? String(ocr.subtotal) : (ocr.total != null ? String(ocr.total) : f.amount),
              documentNumber: ocr.invoiceNumber || ocr.documentNumber || f.documentNumber || "",
              supplierTaxId: ocr.vendorTaxId || ocr.taxId || f.supplierTaxId || "",
              description: ocr.description || (Array.isArray(ocr.lines) ? t("بنود مُستخرجة", "extracted items") : "") || f.description,
              sourceCurrency: ocr.currency || f.sourceCurrency || "SAR",
            }));
            setExtractionSummary(ocr.__error ? null : ocr);
          }
          setCreateOpen(true);
        }
      } catch { /* malformed stash · fall through to a blank form */ }
      sessionStorage.removeItem("entix_ocr_prefill");
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  // B1 · /app/expenses?branchId=<id|none> (deep-link from branch reports)
  const branchFilterId = searchParams.get("branchId") || "";
  const projectFilterId = searchParams.get("projectId") || "";
  const filtered = items.filter((e) =>
    (!branchFilterId || (branchFilterId === "none" ? !e.branchId : e.branchId === branchFilterId)) &&
    (!projectFilterId || (projectFilterId === "none" ? !e.projectId : e.projectId === projectFilterId)) && (
    !searchQuery
      || e.category.includes(searchQuery)
      || e.number.includes(searchQuery)
      || (e.documentNumber || "").includes(searchQuery)
      || (e.description || "").includes(searchQuery)
      || (e.vendorName || "").includes(searchQuery)
      || (e.contact?.displayName || "").includes(searchQuery))
  );
  const total = Number(summary.sumTotal || 0);
  const avg = Number(summary.avgTotal || 0);
  // Currency-honest totals (owner report 2026-08-21): single currency → label
  // it; mixed → per-currency lines, never a blended figure in a wrong unit.
  const expByCur = (summary.sumByCurrency || []).filter((r) => Number(r.total) !== 0);
  const expSingleCur = expByCur.length === 1 ? expByCur[0].currency : null;
  const totalMoney = expSingleCur
    ? money(expByCur[0].total, expSingleCur)
    : expByCur.length > 1
      ? expByCur.map((r) => money(r.total, r.currency)).join("  ·  ")
      : money(total, orgCurrency);
  const avgMoney = expSingleCur
    ? money(items.length ? avg : 0, expSingleCur)
    : expByCur.length > 1
      ? t("— مختلط العملات", "— mixed currencies")
      : money(items.length ? avg : 0, orgCurrency);

  function openCreate() {
    setEditingId(null);
    setFormData(emptyForm());
    const prefillContact = searchParams.get("contactId") || "";
    if (prefillContact) {
      api.contacts.get(prefillContact)
        .then((c: any) => c && setFormData((f: any) => ({ ...f, vendorName: f.vendorName || c.displayName })))
        .catch(() => {});
    }
    setExtractionSummary(null);
    setDraftSavedAt(null);
    setDraftNotice(null);
    setCreateError(null);
    setCreateOpen(true);
  }

  function openDraft() {
    const draft = readExpenseDraft();
    setEditingId(null);
    if (draft && hasDraftContent(draft.formData)) {
      setFormData(draft.formData);
      setExtractionSummary(draft.extractionSummary);
      setDraftSavedAt(draft.updatedAt);
      setDraftNotice(t("تم استرجاع مسودة مصروف محفوظة تلقائياً.", "Saved expense draft restored automatically."));
    } else {
      setFormData(emptyForm());
      setExtractionSummary(null);
      setDraftSavedAt(null);
      setDraftNotice(null);
    }
    setCreateError(null);
    setCreateOpen(true);
  }

  function closeCreate(preserveDraft = true) {
    goBackToSource();
    if (preserveDraft && !editingId && hasDraftContent(formData)) {
      writeExpenseDraft(formData, extractionSummary);
      const now = new Date().toISOString();
      setDraftSavedAt(now);
      setDraftAvailable(true);
    } else if (!preserveDraft && !editingId) {
      clearExpenseDraft();
      setDraftSavedAt(null);
      setDraftAvailable(false);
      setDraftNotice(null);
    }
    setCreateOpen(false);
    setEditingId(null);
    setCreateError(null);
    setExtractionSummary(null);
  }

  async function openExpense(item: ApiExpense) {
    setSelected(item);
    if (!location.pathname.endsWith(`/app/expenses/${item.id}`)) {
      navigate(`/app/expenses/${item.id}`);
    }
    try {
      const full = await api.expenses.get(item.id);
      setSelected(full);
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل تحميل تفاصيل المصروف", en: "Failed to load expense details" }));
    }
  }

  function openEdit(expense: ApiExpense) {
    const settlement = (expense.extractedJson as any)?.currencySettlement || {};
    const sourceCurrency = normalizeCurrency(settlement.sourceCurrency || expense.currency || "SAR");
    const baseCurrency = normalizeCurrency(settlement.baseCurrency || settlement.actualPaidCurrency || expense.currency || "SAR", sourceCurrency);
    setEditingId(expense.id);
    setCreateError(null);
    setExtractionSummary(null);
    setFormData({
      category: expense.category || "",
      date: expense.date.slice(0, 10),
      amount: String(Number(expense.subtotal ?? expense.amount ?? 0)),
      taxAmount: String(Number(expense.taxAmount || 0)),
      totalAmount: String(Number(expense.total || 0)),
      sourceCurrency,
      baseCurrency,
      exchangeRate: String(settlement.exchangeRate || defaultExchangeRate(sourceCurrency, baseCurrency)),
      actualPaidCurrency: normalizeCurrency(settlement.actualPaidCurrency || baseCurrency, baseCurrency),
      actualPaidAmount: settlement.actualPaidAmount ? String(settlement.actualPaidAmount) : "",
      fxTreatment: (settlement.treatment as FxTreatment) || "FX_LOSS",
      paymentMethod: expense.paymentMethod,
      description: expense.description || "",
      vendorName: expense.contact?.displayName || expense.vendorName || "",
      supplierTaxId: expense.contact?.taxId || expense.contact?.vatNumber || "",
      documentNumber: expense.documentNumber || expense.reference || "",
      notes: expense.notes || "",
      lineItems: Array.isArray(expense.lineItems) ? expense.lineItems : [],
      paymentSplits: Array.isArray(expense.paymentSplits)
        ? expense.paymentSplits
        : [{ method: expense.paymentMethod, amount: Number(expense.total || 0), reference: expense.reference || null }],
      attachments: expense.attachmentBase64 ? [{
        name: expense.attachmentName || "receipt",
        type: expense.attachmentType || "application/octet-stream",
        size: expense.attachmentSizeBytes || 0,
        base64: expense.attachmentBase64,
      }] : [],
      extractedJson: expense.extractedJson || null,
      ocrConfidence: expense.ocrConfidence ? Number(expense.ocrConfidence) : null,
      branchId: (expense as any).branchId ?? null,
      projectId: (expense as any).projectId ?? null,
    });
    setCreateOpen(true);
  }

  async function handleSubmit() {
    setCreateError(null);
    const subtotal = Number(normalizeDigits(formData.amount || "0"));
    const taxAmount = Number(normalizeDigits(formData.taxAmount || "0"));
    const totalAmount = Number(normalizeDigits(formData.totalAmount || String(subtotal + taxAmount)));
    const settlement = calculateCurrencySettlement(formData, totalAmount, t);
    const splits = formData.paymentSplits
      .map((payment) => ({
        ...payment,
        amount: Number(normalizeDigits(String(payment.amount || 0))),
        currency: normalizeCurrency(payment.currency, settlement.actualPaidCurrency),
      }))
      .filter((payment) => payment.amount > 0);
    const finalSplits = enrichPaymentSplits(
      splits.length
        ? splits
        : [{ method: formData.paymentMethod, amount: settlement.actualPaidAmount || totalAmount, currency: settlement.actualPaidCurrency, reference: null }],
      settlement,
    );
    const splitTotal = paymentTotal(finalSplits);
    const expectedPaymentTotal = settlement.isCrossCurrency ? settlement.actualPaidAmount : totalAmount;
    const expectedPaymentCurrency = settlement.isCrossCurrency ? settlement.actualPaidCurrency : settlement.sourceCurrency;
    if (!formData.category.trim() || totalAmount <= 0) {
      setCreateError(t("الرجاء تعبئة التصنيف والمبلغ", "Please fill in category and amount"));
      return;
    }
    if (Math.abs(splitTotal - expectedPaymentTotal) > 0.05) {
      setCreateError(t("مجموع المدفوعات ", "Payment total ") + money(splitTotal, expectedPaymentCurrency) + t(" لا يطابق المبلغ المتوقع ", " does not match expected ") + money(expectedPaymentTotal, expectedPaymentCurrency));
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
        currency: settlement.sourceCurrency,
        taxAmount,
        paymentMethod: formData.paymentMethod,
        description: formData.description || formData.notes || null,
        vendorName: formData.vendorName || null,
        supplierTaxId: formData.supplierTaxId || null,
        documentNumber: formData.documentNumber || null,
        reference: formData.documentNumber || null,
        lineItems: formData.lineItems.map((line) => ({ ...line, sourceCurrency: line.sourceCurrency || settlement.sourceCurrency })),
        paymentSplits: finalSplits,
        notes: formData.notes || null,
        attachmentName: primaryAttachment?.name || null,
        attachmentType: primaryAttachment?.type || null,
        attachmentSizeBytes: primaryAttachment?.size || null,
        attachmentBase64: primaryAttachment?.base64 || null,
        attachmentCount: formData.attachments.length,
        // ingestion-integrity: full file set + file hash for dedupe & attachment guarantee
        attachments: formData.attachments.map((a) => ({
          name: a.name,
          contentType: a.type,
          base64: a.base64,
          sizeBytes: a.size,
        })),
        sourceFileHash: (formData.extractedJson as any)?.sourceFileHash || null,
        extractedJson: {
          ...(formData.extractedJson || {}),
          sourceCurrency: settlement.sourceCurrency,
          baseCurrency: settlement.baseCurrency,
          currencySettlement: settlement,
          paymentSplits: finalSplits,
          attachments: formData.attachments.map(({ name, type, size }) => ({ name, type, size })),
          // backward-compat: full file set survives on APIs without the attachments endpoint
          attachmentsFull: formData.attachments.map(({ name, type, size, base64 }) => ({ name, type, size, base64 })),
        },
        ocrConfidence: formData.ocrConfidence,
        autoCreateSupplier: true,
        // تسجيل كأصل ثابت تلقائياً (يرتبط بالمصروف ويأخذ كوداً تلقائياً)
        registerAsAsset: formData.registerAsAsset === true,
        assetAccountId: formData.assetAccountId || null,
        branchId: formData.branchId ?? null,
        projectId: formData.projectId ?? null,
      };
      const saved = editingId ? await api.expenses.update(editingId, input) : await api.expenses.create(input);
      const review = editingId ? null : getSimilarityReview(saved);
      if (review) {
        // nothing written server-side — the dialog resubmits with a signed decision
        setPendingSimilarity({ review, input });
        return;
      }
      await finalizeSavedExpense(saved);
    } catch (e: any) {
      setCreateError(humanizeError(e, language, { ar: "فشل حفظ المصروف", en: "Failed to save expense" }));
    } finally {
      setBusy(false);
    }
  }

  // Shared success path after a real write (direct save or a signed similarity decision).
  const finalizeSavedExpense = async (saved: any) => {
    await refresh();
    const full = await api.expenses.get(saved.id);
    setSelected(full);
    push("success", editingId ? t("تم تحديث المصروف ", "Expense updated ") + saved.number : t("تم حفظ المصروف ", "Expense saved ") + saved.number);
    if ((saved as any).duplicateExpense) push("info", t("تنبيه: يوجد مصروف مشابه ", "Warning: similar expense ") + (saved as any).duplicateExpense.number, 7000);
    const ing = (saved as any).ingestion;
    if (!editingId && ing?.dedupeDecision === "UPDATED") {
      push("info", t("مصروف مطابق موجود — تم تحديثه بدل إنشاء نسخة مكررة", "Matching expense found — updated instead of creating duplicate"), 6000);
    } else if (!editingId && ing?.dedupeDecision === "SKIPPED_DUPLICATE") {
      push("info", t("المصروف موجود مسبقاً — لم يتم إنشاء نسخة مكررة", "Expense already exists — no duplicate created"), 6000);
    }
    if (!editingId && ing?.attachmentStatus?.attached > 0) {
      push("info", t("أُرفق ", "Attached ") + ing.attachmentStatus.attached + t(" ملف بالمصروف", " file(s) to expense"), 5000);
    }
    closeCreate(false);
  }

  // Deep link · /app/expenses/:id → open that expense directly (agent links, contact file, search)
  useEffect(() => {
    const m = location.pathname.match(/\/app\/expenses\/([^/]+)/);
    const id = m?.[1];
    if (!id || id === "new" || selected?.id === id) return;
    api.expenses.get(id).then((full) => setSelected(full)).catch(() => { /* unknown id → stay on list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Attachments for the detail viewer · endpoint rows → extractedJson fallback → legacy single
  useEffect(() => {
    if (!selected?.id) { setDetailAttachments([]); setActiveAttIdx(0); return; }
    let cancelled = false;
    setActiveAttIdx(0);
    (async () => {
      // Merge ALL sources so nothing disappears: endpoint rows (new API) +
      // extractedJson.attachmentsFull + legacy single field — deduped by filename.
      let endpointRows: Array<ViewerAttachment & { _id?: string }> = [];
      try {
        const r = await api.expenses.attachments.list(selected.id);
        endpointRows = (r.items || []).map((a: ExpenseAttachment) => ({ name: a.filename, type: a.contentType, url: a.url, _id: a.id }));
      } catch { /* old API without the endpoint → empty */ }
      if (cancelled) return;

      const seen = new Set(endpointRows.map((a) => a.name));
      const merged = [...endpointRows];

      const full = (selected.extractedJson as any)?.attachmentsFull;
      if (Array.isArray(full)) {
        for (const a of full) {
          if (!a?.name || seen.has(a.name)) continue;
          merged.push({ name: a.name, type: a.type, base64: a.base64 });
          seen.add(a.name);
        }
      }
      const legacy = selectedAttachment(t, selected);
      if (legacy && !seen.has(legacy.name)) merged.push(legacy as ViewerAttachment);

      setDetailAttachments(merged);
    })();
    return () => { cancelled = true; };
  }, [selected]);

  async function handleDetailUpload(files: FileList | File[]) {
    if (!selected?.id || !files.length) return;
    setAttBusy(true);
    let uploaded = 0;
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) { push("error", file.name + t(": الحد الأقصى 25 ميجا", ": Max 25MB")); continue; }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      }).catch(() => "");
      if (!dataUrl) { push("error", file.name + t(": تعذّر قراءة الملف", ": Could not read file")); continue; }
      try {
        await api.expenses.attachments.upload(selected.id, {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          data: dataUrl,
        });
        uploaded++;
      } catch {
        // old API → append into extractedJson.attachmentsFull instead
        try {
          const cur = (selected.extractedJson as any) || {};
          const arr = Array.isArray(cur.attachmentsFull) ? [...cur.attachmentsFull] : [];
          arr.push({ name: file.name, type: file.type || "application/octet-stream", size: file.size, base64: dataUrl.split(",")[1] || "" });
          await api.expenses.update(selected.id, { extractedJson: { ...cur, attachmentsFull: arr } } as any);
          uploaded++;
        } catch { push("error", file.name + t(": فشل الرفع", ": Upload failed")); }
      }
    }
    if (uploaded > 0) {
      push("success", uploaded === 1 ? t("تم رفع المرفق", "Attachment uploaded") : t("تم رفع ", "Uploaded ") + uploaded + t(" مرفقات", " attachments"));
      try { setSelected(await api.expenses.get(selected.id)); } catch { /* keep current */ }
    }
    setAttBusy(false);
  }

  async function handleAttachmentRemove(att: ViewerAttachment & { _id?: string }) {
    if (!selected?.id) return;
    try {
      if (att._id) {
        await api.expenses.attachments.remove(selected.id, att._id);
      } else {
        const cur = (selected.extractedJson as any) || {};
        const arr = (Array.isArray(cur.attachmentsFull) ? cur.attachmentsFull : []).filter((a: any) => a.name !== att.name);
        await api.expenses.update(selected.id, { extractedJson: { ...cur, attachmentsFull: arr } } as any);
      }
      setDetailAttachments((prev) => {
        const next = prev.filter((x) => x !== att);
        setActiveAttIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
        return next;
      });
      push("success", t("تم حذف المرفق", "Attachment deleted"));
    } catch { push("error", t("فشل حذف المرفق", "Failed to delete attachment")); }
  }

  async function handleDelete(id: string) {
    setPendingDelete(null);
    try {
      await api.expenses.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", t("تم حذف المصروف", "Expense deleted"));
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الحذف", en: "Delete failed" }));
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
        currency: formData.sourceCurrency || "SAR",
      });
      if (isBankStatementBlocked(data, file.name)) {
        setExtractionSummary({
          fileName: file.name,
          vendor: null,
          total: null,
          tax: null,
          subtotal: null,
          date: null,
          documentNumber: null,
          confidence: data?.confidence ?? null,
          model: data?._meta?.model || null,
          lineCount: 0,
          warnings: [data?.message || t("تم اكتشاف كشف حساب بنكي. لم يتم تحويله إلى مصروف.", "Bank statement detected. Not converted to expense.")],
        });
        push("error", t("تم اكتشاف كشف حساب بنكي. لم يتم تعبئة المصروف أو حفظه.", "Bank statement detected. Expense was not filled or saved."));
        return;
      }
      const totals = extractionTotals(data);
      const lineItems = normalizeLineItems(data, language);
      const sourceCurrency = detectedDocumentCurrency(data, formData.sourceCurrency || "SAR");
      const baseCurrency = normalizeCurrency(formData.baseCurrency, sourceCurrency === "SAR" ? "SAR" : formData.baseCurrency || "SAR");
      const exchangeRate = formData.exchangeRate && formData.exchangeRate !== "1"
        ? formData.exchangeRate
        : String(defaultExchangeRate(sourceCurrency, baseCurrency));
      const payments = normalizePayments(data, totals.total, formData.paymentMethod, sourceCurrency);
      const warnings = buildExtractionWarnings(t, data, items, totals.total || null);
      const supplierTaxId = data?.issuer?.vatNumber || data?.issuer?.taxId || "";
      const vendorName = cleanVendorName(data?.issuer?.name);
      const bookBaseAmount = roundMoney(totals.total * (Number(exchangeRate) || defaultExchangeRate(sourceCurrency, baseCurrency)));
      setFormData((f) => ({
        ...f,
        category: f.category || inferCategory(data, language),
        amount: totals.subtotal ? String(totals.subtotal) : f.amount,
        taxAmount: totals.tax ? String(totals.tax) : f.taxAmount,
        totalAmount: totals.total ? String(totals.total) : f.totalAmount,
        sourceCurrency,
        baseCurrency,
        exchangeRate,
        actualPaidCurrency: f.actualPaidCurrency || baseCurrency,
        actualPaidAmount: f.actualPaidAmount || (sourceCurrency !== baseCurrency ? String(bookBaseAmount) : ""),
        date: data?.issueDate || f.date,
        vendorName: vendorName || f.vendorName,
        supplierTaxId: supplierTaxId || f.supplierTaxId,
        documentNumber: data?.documentNumber || f.documentNumber,
        description: data?.notes || data?.documentNumber || f.description,
        notes: data?.notes || f.notes,
        lineItems: lineItems.length ? lineItems.map((line) => ({ ...line, sourceCurrency })) : f.lineItems,
        paymentSplits: payments.length ? payments : f.paymentSplits,
        paymentMethod: payments[0]?.method || f.paymentMethod,
        extractedJson: data,
        ocrConfidence: data?.confidence ?? null,
      }));
      setExtractionSummary({
        fileName: file.name,
        vendor: vendorName || null,
        vendorCr: data?.issuer?.crNumber || null,
        vendorUnn: data?.issuer?.unifiedNationalNumber || null,
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
      push("success", t("تم استخراج البيانات بثقة ", "Data extracted with ") + Math.round((data?.confidence || 0) * 100) + "%");
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل الاستخراج", en: "Extraction failed" }));
    }
  }

  const formTotal = Number(normalizeDigits(formData.totalAmount || "0")) || (Number(normalizeDigits(formData.amount || "0")) + Number(normalizeDigits(formData.taxAmount || "0")));
  const currencySettlement = calculateCurrencySettlement(formData, formTotal, t);
  const paymentRows = formData.paymentSplits.length
    ? formData.paymentSplits
    : [{ method: formData.paymentMethod, amount: currencySettlement.isCrossCurrency ? currencySettlement.actualPaidAmount : formTotal, currency: currencySettlement.actualPaidCurrency, reference: null } as ExpensePaymentSplit];
  const paymentRowsTotal = paymentTotal(paymentRows);
  const hasActiveDraft = !editingId && hasDraftContent(formData);
  const savedAtLabel = draftTimeLabel(draftSavedAt);
  const initialFiles = formData.attachments.length
    ? formData.attachments.map((a) => ({
        name: a.name,
        type: a.type,
        url: attachmentPreviewUrl(a),
      }))
    : [];

  useEffect(() => {
    if (!createOpen || editingId || !hasDraftContent(formData)) return;
    const handle = window.setTimeout(() => {
      writeExpenseDraft(formData, extractionSummary);
      const now = new Date().toISOString();
      setDraftSavedAt(now);
      setDraftAvailable(true);
    }, 650);
    return () => window.clearTimeout(handle);
  }, [createOpen, editingId, formData, extractionSummary]);

  useEffect(() => {
    if (!createOpen || editingId || !hasDraftContent(formData)) return;
    const handler = (event: BeforeUnloadEvent) => {
      writeExpenseDraft(formData, extractionSummary);
      setDraftAvailable(true);
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [createOpen, editingId, formData, extractionSummary]);

  if (createOpen) {
    return (
      <>
        <FullPageForm
          title={editingId ? t("تعديل مصروف", "Edit expense") : t("مصروف جديد", "New expense")}
          subtitle={t("ارفع الإيصال وسيتم استخراج المورد والضريبة والأصناف تلقائياً", "Upload the receipt and supplier, tax, and items will be extracted automatically")}
          onClose={closeCreate}
          disableEscape={busy}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => closeCreate()} className="border-border">{t("إلغاء", "Cancel")}</Button>
              <Button type="button" disabled={busy} onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                {busy ? "..." : editingId ? t("تحديث", "Update") : t("حفظ", "Save")}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)] max-w-7xl mx-auto items-start">
            <DocumentPreviewPane
              className="xl:sticky xl:top-4 min-h-[640px]"
              hint={t("ارفع إيصالاً أو فاتورة مصروف", "Upload a receipt or expense invoice")}
              onFilesAdded={handleFilesAdded}
              onExtract={handleExtract}
              autoExtract={!editingId}
              initialFiles={initialFiles}
            />

            <div className="space-y-4">
              {hasActiveDraft && (
                <div className="rounded-lg border border-primary/20 bg-white px-3 py-3 text-sm text-foreground">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>{t("مسودة محفوظة تلقائياً", "Auto-saved draft")}</span>
                        {savedAtLabel && <span className="font-english text-xs font-normal text-muted-foreground">{savedAtLabel}</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t("لو رجعت للقائمة أو قفلت الشاشة، ترجع تكمل نفس المصروف من زر المسودة.", "If you go back or close the screen, you can resume from the draft button.")}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-border text-xs"
                      onClick={() => {
                        clearExpenseDraft();
                        setFormData(emptyForm());
                        setExtractionSummary(null);
                        setDraftSavedAt(null);
                        setDraftAvailable(false);
                        setDraftNotice(null);
                      }}
                    >
                      {t("حذف المسودة وبدء جديد", "Delete draft and start fresh")}
                    </Button>
                  </div>
                  {draftNotice && <div className="mt-2 rounded-md bg-primary/5 px-2 py-1 text-xs text-primary">{draftNotice}</div>}
                </div>
              )}
              {extractionSummary && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold">{t("تمت قراءة المرفق وتعبئة بيانات المورد والضريبة والأصناف", "Attachment read and supplier, tax, items filled")}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-english">{extractionSummary.fileName}</span>
                        {extractionSummary.vendor ? <> · {extractionSummary.vendor}</> : null}
                        {extractionSummary.documentNumber ? <> · {t("رقم", "No.")} <span className="font-english">{extractionSummary.documentNumber}</span></> : null}
                        {extractionSummary.vendorCr ? <> · {t("س.ت:", "CR:")} <span className="font-english">{extractionSummary.vendorCr}</span></> : null}
                        {extractionSummary.vendorUnn ? <> · {t("موحد (700):", "UNN (700):")} <span className="font-english">{extractionSummary.vendorUnn}</span></> : null}
                        {extractionSummary.total ? <> · <span className="font-english">{extractionSummary.total.toFixed(2)} SAR</span></> : null}
                        {extractionSummary.confidence != null ? <> · {t("ثقة", "Confidence")} <span className="font-english">{Math.round(extractionSummary.confidence * 100)}%</span></> : null}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-white px-2 py-1">{t("قبل الضريبة ", "Before tax ")}<span className="font-english">{money(extractionSummary.subtotal || 0)}</span></div>
                        <div className="rounded bg-white px-2 py-1">{t("الضريبة ", "Tax ")}<span className="font-english">{money(extractionSummary.tax || 0)}</span></div>
                        <div className="rounded bg-white px-2 py-1">{t("الأصناف ", "Items ")}<span className="font-english">{extractionSummary.lineCount}</span></div>
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
                  <Label className="text-foreground/80">{t("المورد / الجهة", "Supplier / Entity")}</Label>
                  <Input placeholder={t("مثال: شركة الكهرباء", "e.g. Electric Company")} value={formData.vendorName} onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })} className="border-border" />
                  <p className="text-xs text-muted-foreground">{t("إذا لم يكن المورد مسجلاً سيتم إنشاؤه تلقائياً كجهة موردة.", "If the supplier is not registered, it will be created automatically.")}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("الرقم الضريبي للمورد", "Supplier Tax No.")}</Label>
                  <Input dir="ltr" placeholder="300000000000003" value={formData.supplierTaxId} onChange={(e) => setFormData({ ...formData, supplierTaxId: normalizeDigits(e.target.value) })} className="border-border font-english" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("التصنيف *", "Category *")}</Label>
                  <Input placeholder={t("مثال: ضيافة ووجبات · فواتير خدمات", "e.g. Entertainment & meals · Service invoices")} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="border-border" />
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={formData.registerAsAsset === true}
                    onClick={() => setFormData({ ...formData, registerAsAsset: !formData.registerAsAsset })}
                    className={`mt-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${formData.registerAsAsset ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span style={{ fontWeight: formData.registerAsAsset ? 700 : 500 }}>{t("تسجيل كأصل ثابت تلقائياً", "Auto-register as a fixed asset")}</span>
                    {formData.registerAsAsset && <span className="ms-auto text-[10px] opacity-80">{t("سيأخذ كوداً تلقائياً ويرتبط بالمصروف", "gets an auto code linked to this expense")}</span>}
                  </button>
                  <div className="space-y-1.5">
                    <SearchableCombobox
                      value={formData.assetAccountId || ""}
                      onChange={(assetAccountId) => setFormData({ ...formData, assetAccountId })}
                      items={accounts
                        .filter((a) => a.type === "ASSET")
                        .map((a) => ({
                          id: a.id,
                          label: `${a.code} · ${a.nameAr || a.name}`,
                          sublabel: /fixed|intangible/i.test(a.subtype || "") ? t("فرع الأصول الثابتة", "fixed-asset branch") : (a.subtype || undefined),
                        }))}
                      placeholder={t("حساب الأصل من الشجرة (اختياري)...", "Asset account from the chart (optional)...")}
                    />
                    {formData.assetAccountId && (() => {
                      const acct = accounts.find((a) => a.id === formData.assetAccountId);
                      const isFixed = acct?.type === "ASSET" && /fixed|intangible/i.test(acct.subtype || "");
                      return isFixed ? (
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                          {t("الحساب ضمن فرع الأصول · سيُسجَّل كأصل ثابت تلقائياً حتى بدون تفعيل الزر", "Account is inside the assets branch · registers as a fixed asset automatically even without the toggle")}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("رقم الفاتورة / الإيصال", "Invoice / Receipt No.")}</Label>
                  <Input dir="ltr" placeholder="429299" value={formData.documentNumber} onChange={(e) => setFormData({ ...formData, documentNumber: normalizeDigits(e.target.value) })} className="border-border font-english" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("التاريخ *", "Date *")}</Label>
                  <DateInput value={formData.date} onChange={(iso) => setFormData({ ...formData, date: iso })} required inputClassName="" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("طريقة الدفع *", "Payment Method *")}</Label>
                  <SegGroup
                    value={formData.paymentMethod}
                    onChange={(v) => setFormData({ ...formData, paymentMethod: v as ApiExpense["paymentMethod"] })}
                    options={Object.entries(paymentMethodLabels(t)).map(([value, label]) => ({ value, label }))}
                  />
                </div>
                <BranchField value={formData.branchId} onChange={(id) => setFormData((f) => ({ ...f, branchId: id }))} />
                <ProjectField value={formData.projectId} onChange={(id) => setFormData((f) => ({ ...f, projectId: id }))} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("قبل الضريبة *", "Before Tax *")}</Label>
                  <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={(e) => {
                    const amount = normalizeDigits(e.target.value);
                    const tax = Number(normalizeDigits(formData.taxAmount || "0"));
                    setFormData({ ...formData, amount, totalAmount: String((Number(amount || 0) + tax).toFixed(2)) });
                  }} required dir="ltr" className="border-border font-english" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("ضريبة VAT", "VAT")}</Label>
                  <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.taxAmount} onChange={(e) => {
                    const taxAmount = normalizeDigits(e.target.value);
                    const amount = Number(normalizeDigits(formData.amount || "0"));
                    setFormData({ ...formData, taxAmount, totalAmount: String((amount + Number(taxAmount || 0)).toFixed(2)) });
                  }} dir="ltr" className="border-border font-english" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">{t("الإجمالي", "Total")}</Label>
                  <Input type="text" inputMode="decimal" placeholder="0.00" value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: normalizeDigits(e.target.value) })} dir="ltr" className="border-border font-english" />
                </div>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t("تسوية العملة والدفع الفعلي", "Currency Settlement & Actual Payment")}</h3>
                    <p className="text-xs text-muted-foreground">{t("افصل عملة الفاتورة عن عملة البنك، وسجل فرق الصرف أو تكلفة التحويل بوضوح.", "Separate invoice currency from bank currency, and record FX difference or transfer cost clearly.")}</p>
                  </div>
                  {currencySettlement.isCrossCurrency && (
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${currencySettlement.difference > 0 ? "bg-amber-100 text-amber-800" : currencySettlement.difference < 0 ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                      {t("فرق", "Diff")} {money(Math.abs(currencySettlement.difference), currencySettlement.actualPaidCurrency)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("عملة الفاتورة", "Invoice currency")}</Label>
                    <SegGroup
                      compact
                      value={formData.sourceCurrency}
                      onChange={(sourceCurrency) => {
                        const exchangeRate = String(defaultExchangeRate(sourceCurrency, formData.baseCurrency));
                        const sourceTotal = Number(normalizeDigits(formData.totalAmount || "0"));
                        setFormData({
                          ...formData,
                          sourceCurrency,
                          exchangeRate,
                          actualPaidAmount: sourceCurrency === formData.baseCurrency ? "" : String(roundMoney(sourceTotal * Number(exchangeRate || 1))),
                        });
                      }}
                      options={currencies(t).map((currency) => ({ value: currency.value, label: currency.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("عملة الدفاتر", "Books currency")}</Label>
                    <SegGroup
                      compact
                      value={formData.baseCurrency}
                      onChange={(baseCurrency) => {
                        const exchangeRate = String(defaultExchangeRate(formData.sourceCurrency, baseCurrency));
                        const sourceTotal = Number(normalizeDigits(formData.totalAmount || "0"));
                        setFormData({
                          ...formData,
                          baseCurrency,
                          actualPaidCurrency: baseCurrency,
                          exchangeRate,
                          actualPaidAmount: formData.sourceCurrency === baseCurrency ? "" : String(roundMoney(sourceTotal * Number(exchangeRate || 1))),
                        });
                      }}
                      options={currencies(t).map((currency) => ({ value: currency.value, label: currency.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("سعر السوق / العادل", "Market / Fair rate")}</Label>
                    <Input dir="ltr" inputMode="decimal" value={formData.exchangeRate} onChange={(e) => setFormData({ ...formData, exchangeRate: normalizeDigits(e.target.value) })} className="h-9 border-border font-english text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("المسحوب فعلياً", "Actually paid")}</Label>
                    <Input dir="ltr" inputMode="decimal" placeholder={String(currencySettlement.bookBaseAmount || 0)} value={formData.actualPaidAmount} onChange={(e) => setFormData({ ...formData, actualPaidAmount: normalizeDigits(e.target.value) })} className="h-9 border-border font-english text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("عملة السحب", "Payment currency")}</Label>
                    <SegGroup
                      compact
                      value={formData.actualPaidCurrency}
                      onChange={(actualPaidCurrency) => setFormData({ ...formData, actualPaidCurrency })}
                      options={currencies(t).map((currency) => ({ value: currency.value, label: currency.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1.4fr]">
                  <div className="rounded-md border border-border bg-white p-2">
                    <p className="text-[11px] text-muted-foreground">{t("إجمالي الفاتورة", "Invoice total")}</p>
                    <p className="font-english text-sm font-semibold text-foreground">{money(currencySettlement.sourceTotal, currencySettlement.sourceCurrency)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-white p-2">
                    <p className="text-[11px] text-muted-foreground">{t("القيمة العادلة", "Fair value")}</p>
                    <p className="font-english text-sm font-semibold text-foreground">{money(currencySettlement.bookBaseAmount, currencySettlement.baseCurrency)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-white p-2">
                    <p className="text-[11px] text-muted-foreground">{t("السحب البنكي", "Bank withdrawal")}</p>
                    <p className="font-english text-sm font-semibold text-foreground">{money(currencySettlement.actualPaidAmount, currencySettlement.actualPaidCurrency)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">{t("معالجة الفرق", "Difference handling")}</Label>
                    <SegGroup
                      compact
                      value={formData.fxTreatment}
                      onChange={(fxTreatment) => setFormData({ ...formData, fxTreatment: fxTreatment as FxTreatment })}
                      options={Object.entries(fxTreatmentLabels(t)).map(([value, label]) => ({ value, label }))}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t("تقسيم البنود", "Line Items")}</h3>
                    <p className="text-xs text-muted-foreground">{t("راجع الأصناف المقروءة وعدل الحساب لكل بند قبل الحفظ.", "Review extracted items and adjust the account for each line before saving.")}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-border text-xs"
                    onClick={() => setFormData((f) => ({
                      ...f,
                      lineItems: [...f.lineItems, { description: "", quantity: 1, unitPrice: 0, discountAmount: 0, taxRate: 0.15, taxInclusive: true, lineTotal: 0, category: "مصروف عام", accountName: "509-99 · مصروفات عامة", costCenter: "", projectCode: "", sourceCurrency: f.sourceCurrency }],
                    }))}
                  >
                    <Plus className="me-1 h-3.5 w-3.5" /> {t("إضافة بند", "Add line")}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-start">{t("الوصف", "Description")}</th>
                        <th className="px-2 py-2 text-start">{t("التصنيف", "Category")}</th>
                        <th className="px-2 py-2 text-start">{t("الحساب", "Account")}</th>
                        <th className="px-2 py-2 text-start">{t("مشروع / مركز", "Project / Center")}</th>
                        <th className="px-2 py-2 text-start">{t("الكمية", "Qty")}</th>
                        <th className="px-2 py-2 text-start">{t("السعر", "Price")}</th>
                        <th className="px-2 py-2 text-start">{t("خصم", "Discount")}</th>
                        <th className="px-2 py-2 text-start">VAT</th>
                        <th className="px-2 py-2 text-start">{t("شامل؟", "Incl?")}</th>
                        <th className="px-2 py-2 text-start">{t("الإجمالي", "Total")}</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lineItems.length === 0 && (
                        <tr><td colSpan={11} className="px-3 py-4 text-center text-xs text-muted-foreground">{t("لم يتم استخراج أصناف بعد. يمكنك إضافة بند يدوي أو إعادة رفع الفاتورة.", "No items extracted yet. You can add a line manually or re-upload the invoice.")}</td></tr>
                      )}
                      {formData.lineItems.map((line, idx) => (
                        <tr key={idx} className="border-t border-border/50">
                          <td className="px-2 py-2">
                            <Input value={line.description || ""} onChange={(e) => {
                              const description = e.target.value;
                              setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, description, category: item.category || inferLineCategory(description, language), accountName: item.accountName || suggestLineAccount(description, language) } : item) }));
                            }} className="h-8 border-border" />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.category || ""} onChange={(e) => setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, category: e.target.value } : item) }))} className="h-8 border-border" />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.accountName || ""} onChange={(e) => setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, accountName: e.target.value } : item) }))} className="h-8 border-border" />
                          </td>
                          <td className="px-2 py-2">
                            <div className="grid grid-cols-2 gap-1">
                              <Input placeholder="Project" value={line.projectCode || ""} onChange={(e) => setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, projectCode: e.target.value } : item) }))} className="h-8 border-border font-english" />
                              <Input placeholder="Cost center" value={line.costCenter || ""} onChange={(e) => setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, costCenter: e.target.value } : item) }))} className="h-8 border-border" />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <Input dir="ltr" inputMode="decimal" value={String(line.quantity || 1)} onChange={(e) => {
                              const quantity = Number(normalizeDigits(e.target.value || "1"));
                              setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, quantity, lineTotal: Math.max(0, quantity * Number(item.unitPrice || 0) - Number(item.discountAmount || 0)) } : item) }));
                            }} className="h-8 w-20 border-border font-english" />
                          </td>
                          <td className="px-2 py-2">
                            <Input dir="ltr" inputMode="decimal" value={String(line.unitPrice || 0)} onChange={(e) => {
                              const unitPrice = Number(normalizeDigits(e.target.value || "0"));
                              setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, unitPrice, lineTotal: Math.max(0, Number(item.quantity || 1) * unitPrice - Number(item.discountAmount || 0)) } : item) }));
                            }} className="h-8 w-24 border-border font-english" />
                          </td>
                          <td className="px-2 py-2">
                            <Input dir="ltr" inputMode="decimal" value={String(line.discountAmount || 0)} onChange={(e) => {
                              const discountAmount = Number(normalizeDigits(e.target.value || "0"));
                              setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, discountAmount, lineTotal: Math.max(0, Number(item.quantity || 1) * Number(item.unitPrice || 0) - discountAmount) } : item) }));
                            }} className="h-8 w-20 border-border font-english" />
                          </td>
                          <td className="px-2 py-2">
                            <Input dir="ltr" inputMode="decimal" value={String(line.taxRate ?? 0.15)} onChange={(e) => {
                              const taxRate = Number(normalizeDigits(e.target.value || "0"));
                              setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, taxRate } : item) }));
                            }} className="h-8 w-20 border-border font-english" />
                          </td>
                          <td className="px-2 py-2">
                            <SegGroup
                              compact
                              value={line.taxInclusive ? "yes" : "no"}
                              onChange={(value) => setFormData((f) => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, taxInclusive: value === "yes" } : item) }))}
                              options={[{ value: "yes", label: t("شامل", "Incl.") }, { value: "no", label: t("غير شامل", "Excl.") }]}
                            />
                          </td>
                          <td className="px-2 py-2 font-english">{money(line.lineTotal ?? Math.max(0, ((line.quantity || 1) * (line.unitPrice || 0)) - Number(line.discountAmount || 0)), formData.sourceCurrency)}</td>
                          <td className="px-2 py-2 text-center">
                            <button type="button" onClick={() => setFormData((f) => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t("تقسيم المدفوعات", "Payment Splits")}</h3>
                    <p className="text-xs text-muted-foreground">{t("يدعم الدفع الجزئي: كاش + بطاقة + تحويل.", "Supports split payments: cash + card + transfer.")}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-border text-xs"
                    onClick={() => setFormData((f) => ({ ...f, paymentSplits: [...f.paymentSplits, { method: "CASH", amount: 0, currency: f.actualPaidCurrency, reference: null }] }))}
                  >
                    <Plus className="me-1 h-3.5 w-3.5" /> {t("إضافة دفعة", "Add payment")}
                  </Button>
                </div>
                <div className="space-y-2 p-3">
                  {paymentRows.map((payment, idx) => (
                    <div key={idx} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <SegGroup
                          compact
                          value={payment.method}
                          onChange={(method) => setFormData((f) => {
                            const splits = f.paymentSplits.length ? f.paymentSplits : paymentRows;
                            return { ...f, paymentMethod: method as ApiExpense["paymentMethod"], paymentSplits: splits.map((item, i) => i === idx ? { ...item, method: method as ApiExpense["paymentMethod"] } : item) };
                          })}
                          options={Object.entries(paymentMethodLabels(t)).map(([value, label]) => ({ value, label }))}
                        />
                        <SegGroup
                          compact
                          value={normalizeCurrency(payment.currency, formData.actualPaidCurrency)}
                          onChange={(currency) => setFormData((f) => {
                            const splits = f.paymentSplits.length ? f.paymentSplits : paymentRows;
                            return { ...f, paymentSplits: splits.map((item, i) => i === idx ? { ...item, currency } : item) };
                          })}
                          options={currencies(t).map((currency) => ({ value: currency.value, label: currency.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_150px_36px]">
                        <Input placeholder={t("مرجع / آخر 4 أرقام البطاقة", "Reference / last 4 digits")} value={payment.reference || payment.cardLast4 || ""} onChange={(e) => setFormData((f) => {
                          const splits = f.paymentSplits.length ? f.paymentSplits : paymentRows;
                          return { ...f, paymentSplits: splits.map((item, i) => i === idx ? { ...item, reference: e.target.value } : item) };
                        })} className="h-9 border-border" />
                        <Input dir="ltr" inputMode="decimal" value={String(payment.amount || "")} onChange={(e) => setFormData((f) => {
                          const amount = Number(normalizeDigits(e.target.value || "0"));
                          const splits = f.paymentSplits.length ? f.paymentSplits : paymentRows;
                          return { ...f, paymentSplits: splits.map((item, i) => i === idx ? { ...item, amount } : item) };
                        })} className="h-9 border-border font-english" />
                        <button type="button" onClick={() => setFormData((f) => ({ ...f, paymentSplits: f.paymentSplits.filter((_, i) => i !== idx) }))} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className={`text-xs ${Math.abs(paymentRowsTotal - (currencySettlement.isCrossCurrency ? currencySettlement.actualPaidAmount : formTotal)) > 0.05 ? "text-amber-700" : "text-emerald-700"}`}>
                    {t("مجموع المدفوعات:", "Payment total:")} <span className="font-english">{money(paymentRowsTotal, currencySettlement.actualPaidCurrency)}</span>
                    <span className="mx-1 text-muted-foreground/60">/</span>
                    {t("المتوقع:", "Expected:")} <span className="font-english">{money(currencySettlement.isCrossCurrency ? currencySettlement.actualPaidAmount : formTotal, currencySettlement.isCrossCurrency ? currencySettlement.actualPaidCurrency : currencySettlement.sourceCurrency)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground/80">{t("ملاحظات", "Notes")}</Label>
                <textarea rows={3} placeholder={t("تفاصيل إضافية...", "Additional details...")} value={formData.notes || formData.description} onChange={(e) => setFormData({ ...formData, notes: e.target.value, description: e.target.value })} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>

              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                {t("سيتم حفظ الفاتورة", "Will save invoice")} <span className="font-english font-semibold">{money(formTotal, currencySettlement.sourceCurrency)}</span>
                {currencySettlement.isCrossCurrency && (
                  <> · {t("السحب الفعلي", "Actual withdrawal")} <span className="font-english font-semibold">{money(currencySettlement.actualPaidAmount, currencySettlement.actualPaidCurrency)}</span></>
                )}
                {" "} {t("مع", "with")} {formData.attachments.length ? t(`${formData.attachments.length} مرفق`, `${formData.attachments.length} attachment(s)`) : t("بدون مرفق", "no attachment")}.
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
    const paymentSplits = Array.isArray(selected.paymentSplits) && selected.paymentSplits.length
      ? selected.paymentSplits
      : [{ method: selected.paymentMethod, amount: Number(selected.total || 0), reference: selected.reference || null }];
    const vendorName = selected.contact?.displayName || selected.vendorName || t("غير محدد", "Unspecified");
    const selectedSettlement = (selected.extractedJson as any)?.currencySettlement as CurrencySettlement | undefined;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { setSelected(null); if (/\/app\/expenses\/[^/]+/.test(location.pathname)) navigate("/app/expenses"); }} className="border-border">
              <ArrowRight className="me-2 h-4 w-4" /> {t("المصروفات", "Expenses")}
            </Button>
            <div>
              <h1 className="text-foreground" style={{ fontSize: "1.2rem", fontWeight: 700 }}>{t("مصروف ", "Expense ")}<span className="font-english">{selected.number}</span></h1>
              <p className="text-sm text-muted-foreground">{vendorName} · {selected.category}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => { setSearchQuery(vendorName); setSelected(null); if (/\/app\/expenses\/[^/]+/.test(location.pathname)) navigate("/app/expenses"); }} className="border-border">
              <Building2 className="me-2 h-4 w-4" /> {t("مصاريف الجهة", "Entity expenses")}
            </Button>
            <Button variant="outline" onClick={openCreate} className="border-border">
              <CopyPlus className="me-2 h-4 w-4" /> {t("مصروف جديد", "New expense")}
            </Button>
            <Button variant="outline" onClick={() => openEdit(selected)} className="border-border">
              <Edit3 className="me-2 h-4 w-4" /> {t("تعديل", "Edit")}
            </Button>
            <Button variant="outline" onClick={() => push("info", t("الإرسال بالبريد سيُربط لاحقاً بقوالب المصروفات", "Email sending will be linked to expense templates later"))} className="border-border">
              <Send className="me-2 h-4 w-4" /> {t("إرسال", "Send")}
            </Button>
            <Button variant="outline" onClick={() => push("info", t("ربط المصروف بالحساب البنكي/القيد سيكون من شاشة المطابقة البنكية", "Linking expense to bank account/entry will be from bank reconciliation screen"))} className="border-border">
              <Link2 className="me-2 h-4 w-4" /> {t("ربط حساب", "Link account")}
            </Button>
            {pendingDelete === selected.id ? (
              <InlineConfirm onConfirm={() => handleDelete(selected.id)} onCancel={() => setPendingDelete(null)} />
            ) : (
              <Button variant="outline" onClick={() => setPendingDelete(selected.id)} className="border-red-200 text-red-600 hover:bg-red-50">
                <Trash2 className="me-2 h-4 w-4" /> {t("حذف", "Delete")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("الإجمالي", "Total")}</p>
                    <p className="font-english text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{money(selected.total, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("قبل الضريبة", "Before tax")}</p>
                    <p className="font-english text-sm text-foreground">{money(selected.subtotal ?? selected.amount, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">VAT</p>
                    <p className="font-english text-sm text-foreground">{money(selected.taxAmount, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("طريقة الدفع", "Payment method")}</p>
                    <p className="text-sm text-foreground">{paymentSplits.length > 1 ? `${paymentSplits.length} ${t("دفعات", "payments")}` : paymentMethodLabels(t)[selected.paymentMethod]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedSettlement && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader><CardTitle className="text-foreground">{t("تسوية العملة", "Currency Settlement")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("عملة الفاتورة", "Invoice currency")}</p>
                      <p className="font-english text-sm font-semibold text-foreground">{money(selectedSettlement.sourceTotal, selectedSettlement.sourceCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("القيمة العادلة", "Fair value")}</p>
                      <p className="font-english text-sm font-semibold text-foreground">{money(selectedSettlement.bookBaseAmount, selectedSettlement.baseCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("السحب البنكي", "Bank withdrawal")}</p>
                      <p className="font-english text-sm font-semibold text-foreground">{money(selectedSettlement.actualPaidAmount, selectedSettlement.actualPaidCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("الفرق", "Difference")}</p>
                      <p className={`font-english text-sm font-semibold ${selectedSettlement.difference > 0 ? "text-amber-700" : selectedSettlement.difference < 0 ? "text-emerald-700" : "text-foreground"}`}>
                        {money(selectedSettlement.difference, selectedSettlement.actualPaidCurrency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{selectedSettlement.treatmentLabel}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border">
              <CardHeader><CardTitle className="text-foreground">{t("المدفوعات", "Payments")}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start">{t("الطريقة", "Method")}</th>
                        <th className="px-3 py-2 text-start">{t("المرجع", "Reference")}</th>
                        <th className="px-3 py-2 text-start">{t("الحساب", "Account")}</th>
                        <th className="px-3 py-2 text-start">{t("المبلغ", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSplits.map((payment, idx) => (
                        <tr key={idx} className="border-t border-border/50">
                          <td className="px-3 py-2">{paymentMethodLabels(t)[payment.method]}</td>
                          <td className="px-3 py-2 font-english">{payment.reference || payment.cardLast4 || "—"}</td>
                          <td className="px-3 py-2">{payment.accountName || "—"}</td>
                          <td className="px-3 py-2 font-english">{money(payment.amount, payment.currency || selected.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="text-foreground">{t("بيانات المصروف", "Expense Details")}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div><span className="text-muted-foreground">{t("رقم المصروف:", "Expense No.:")}</span> <span className="font-english">{selected.number}</span></div>
                <div><span className="text-muted-foreground">{t("رقم الفاتورة:", "Invoice No.:")}</span> <span className="font-english">{selected.documentNumber || selected.reference || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("التاريخ:", "Date:")}</span> <span className="font-english">{selected.date.slice(0, 10)}</span></div>
                <div><span className="text-muted-foreground">{t("التصنيف:", "Category:")}</span> <span>{selected.category}</span></div>
                <div><span className="text-muted-foreground">{t("المورد:", "Supplier:")}</span> <span>{vendorName}</span></div>
                <div><span className="text-muted-foreground">{t("الرقم الضريبي:", "Tax No.:")}</span> <span className="font-english">{selected.contact?.taxId || selected.contact?.vatNumber || "—"}</span></div>
                {selected.description && <div className="md:col-span-2"><span className="text-muted-foreground">{t("الوصف:", "Description:")}</span> <span>{selected.description}</span></div>}
                {selected.notes && <div className="md:col-span-2"><span className="text-muted-foreground">{t("ملاحظات:", "Notes:")}</span> <span>{selected.notes}</span></div>}
                {selected.duplicateOfId && <div className="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{t("يوجد مصروف مشابه وتم تعليمه للمراجعة.", "Similar expense found and flagged for review.")}</div>}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="text-foreground">{t("الأصناف والضريبة", "Items & Tax")}</CardTitle></CardHeader>
              <CardContent>
                {lineItems.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-start">{t("الوصف", "Description")}</th>
                          <th className="px-3 py-2 text-start">{t("الحساب", "Account")}</th>
                          <th className="px-3 py-2 text-start">{t("الكمية", "Qty")}</th>
                          <th className="px-3 py-2 text-start">{t("السعر", "Price")}</th>
                          <th className="px-3 py-2 text-start">VAT</th>
                          <th className="px-3 py-2 text-start">{t("الإجمالي", "Total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((line, idx) => (
                          <tr key={idx} className="border-t border-border/50">
                            <td className="px-3 py-2">{line.description}</td>
                            <td className="px-3 py-2">{line.accountName || line.category || "—"}</td>
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
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-3 py-4 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    {t("لا توجد أصناف محفوظة لهذا المصروف. ارفع الإيصال أو عدل المصروف لإضافتها.", "No items saved for this expense. Upload the receipt or edit the expense to add them.")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> {t("المرفقات", "Attachments")}
                  {detailAttachments.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal font-english">{activeAttIdx + 1} / {detailAttachments.length}</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <input
                    ref={attFileRef}
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,.docx,.xlsx,.csv"
                    onChange={(e) => { if (e.target.files?.length) handleDetailUpload(e.target.files); e.target.value = ""; }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={attBusy} onClick={() => attFileRef.current?.click()} className="border-border h-8 text-xs">
                    <Upload className="me-1.5 h-3.5 w-3.5" /> {attBusy ? t("جارٍ الرفع…", "Uploading…") : t("رفع مرفقات", "Upload attachments")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {detailAttachments.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted text-center">
                  <FileImage className="mb-3 h-10 w-10 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">{t("لا توجد مرفقات لهذا المصروف", "No attachments for this expense")}</p>
                  <button type="button" onClick={() => attFileRef.current?.click()} className="mt-2 text-xs text-primary hover:underline">{t("ارفع أول مرفق", "Upload first attachment")}</button>
                </div>
              ) : (
                <>
                  {/* carousel controls · navigate right/left between files */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={activeAttIdx <= 0}
                      onClick={() => setActiveAttIdx((i) => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted/60 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" /> {t("السابق", "Previous")}
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-english text-xs text-muted-foreground truncate max-w-[260px]" dir="ltr">{detailAttachments[activeAttIdx]?.name}</span>
                      <button
                        type="button"
                        onClick={() => handleAttachmentRemove(detailAttachments[activeAttIdx])}
                        className="text-red-500/70 hover:text-red-600 p-1"
                        title={t("حذف المرفق", "Delete attachment")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={activeAttIdx >= detailAttachments.length - 1}
                      onClick={() => setActiveAttIdx((i) => Math.min(detailAttachments.length - 1, i + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted/60 disabled:opacity-40"
                    >
                      {t("التالي", "Next")} <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                  {/* viewer · PDF native scroll / image free scroll */}
                  <AttachmentViewer attachment={detailAttachments[activeAttIdx]} height={620} />
                  {/* thumbnails strip */}
                  {detailAttachments.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {detailAttachments.map((att, i) => (
                        <button
                          key={`${att.name}-${i}`}
                          type="button"
                          onClick={() => setActiveAttIdx(i)}
                          className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-english max-w-[160px] truncate ${i === activeAttIdx ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                          dir="ltr"
                        >
                          {att.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
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
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المصروفات النقدية", "Cash Expenses")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة المصروفات اليومية مع قراءة الفواتير والمرفقات", "Manage daily expenses with receipt scanning and attachments")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("مصروف جديد", "New expense")}</Button>
      </div>

      {draftAvailable && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="font-semibold">{t("يوجد مصروف محفوظ كمسودة تلقائية", "Auto-saved draft found")}</div>
                <div className="text-xs text-muted-foreground">{t("لن تضيع البيانات لو خرجت من الشاشة قبل الحفظ النهائي.", "Data wont be lost if you leave before final save.")}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={openDraft} className="h-8 border-border text-xs">{t("إكمال المسودة", "Complete draft")}</Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 border-red-200 text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  clearExpenseDraft();
                  setDraftAvailable(false);
                  setDraftSavedAt(null);
                  setDraftNotice(null);
                }}
              >
                {t("حذف", "Delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("إجمالي المصروفات", "Total Expenses")}</CardTitle></CardHeader>
          <CardContent><div className="text-foreground font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{totalMoney}</div><p className="text-xs text-muted-foreground mt-1">{t("إجمالي", "Total")}</p></CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("عدد المصروفات", "Expense Count")}</CardTitle></CardHeader>
          <CardContent><div className="text-foreground font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{items.length}</div><p className="text-xs text-muted-foreground mt-1">{t("مصروف", "expense")}</p></CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("متوسط المصروف", "Average Expense")}</CardTitle></CardHeader>
          <CardContent><div className="text-foreground font-english" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{avgMoney}</div><p className="text-xs text-muted-foreground mt-1">{t("لكل مصروف", "per expense")}</p></CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-foreground">{t("قائمة المصروفات", "Expenses List")}</CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input placeholder={t("بحث بالمورد، رقم الفاتورة، التصنيف...", "Search by supplier, invoice no., category...")} className="w-full min-w-[260px] ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
                <tr className="border-b border-border bg-muted">
                  <th className="py-3 px-4 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("رقم", "No.")}</th>
                  <th className="py-3 px-4 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("المورد / التصنيف", "Supplier / Category")}</th>
                  <th className="py-3 px-4 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("رقم الفاتورة", "Invoice No.")}</th>
                  <th className="py-3 px-4 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("التاريخ", "Date")}</th>
                  <th className="py-3 px-4 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("المبلغ", "Amount")}</th>
                  <th className="py-3 px-4 text-start text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">{t("جارٍ التحميل...", "Loading...")}</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center"><Receipt className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد مصروفات · اضغط مصروف جديد لإضافة أول مصروف", "No expenses · Click New expense to add your first expense")}</p></td></tr>
                )}
                {!loading && filtered.map((e) => (
                  <tr key={e.id} onClick={() => openExpense(e)} className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer">
                    <td className="py-3 px-4"><span className="font-english text-sm text-primary" style={{ fontWeight: 600 }}>{e.number}</span></td>
                    <td className="py-3 px-4">
                      <div className="truncate text-sm text-foreground/80" dir="auto" title={e.contact?.displayName || e.vendorName || ""}>{e.contact?.displayName || e.vendorName || "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{e.category}</div>
                    </td>
                    <td className="py-3 px-4"><span dir="ltr" className="font-english text-sm text-muted-foreground whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{e.documentNumber || e.reference || "—"}</span></td>
                    <td className="py-3 px-4"><span dir="ltr" className="font-english text-sm text-muted-foreground whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{e.date.slice(0, 10)}</span></td>
                    <td className="py-3 px-4">
                      <span dir="ltr" className="font-english text-sm text-foreground whitespace-nowrap" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(e.total, e.currency)}</span>
                      {Number(e.taxAmount) > 0 && <div dir="ltr" className="font-english text-[11px] text-muted-foreground whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>VAT {money(e.taxAmount, e.currency)}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => openExpense(e)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50"><Eye className="h-4 w-4" /></button>
                        {e.attachmentCount ? <FileImage className="h-4 w-4 text-primary" /> : null}
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

      {pendingSimilarity && (
        <SimilarityReviewDialog
          review={pendingSimilarity.review}
          busy={busy}
          onCancel={() => setPendingSimilarity(null)}
          onChoose={async (action) => {
            const pending = pendingSimilarity;
            setBusy(true);
            try {
              const saved = await api.expenses.create({
                ...pending.input,
                duplicateDecision: buildDuplicateDecision(pending.review, action),
              });
              setPendingSimilarity(null);
              await finalizeSavedExpense(saved);
            } catch (e: any) {
              setCreateError(humanizeError(e, language, { ar: "فشل حفظ المصروف", en: "Failed to save expense" }));
              setPendingSimilarity(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
