/**
 * Scan Receipts · batch intake hub (rebuilt)
 * Upload many receipts → AI extracts each one → REVIEW table (vendor/buyer/date/
 * currency/lines/totals) → company-mismatch warning → "record ALL" in one click.
 * Currency is always the document's own (USD stays USD · SAR stays SAR) — no conversion.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Camera, Upload, Send, Copy, X, Inbox, Pencil, Check, RotateCcw, Loader2,
  Sparkles, ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Trash2,
  ExternalLink, CheckCircle2, ListChecks, Building2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { enhanceReceiptImage } from "../lib/receipt-enhance";
import { api } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const INBOUND_DOMAINS = ["in.entix.io", "bill.entix.io"] as const; // receive-only subdomains · apex mail stays on Google Workspace
const DEFAULT_INBOUND_DOMAIN = "in.entix.io";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // vision models struggle beyond this
const EXTRACT_CONCURRENCY = 2;

type JobStatus =
  | "analyzing"
  | "ready"
  | "error"
  | "recording"
  | "recorded"
  | "duplicate"
  | "failed";

type ReceiptJob = {
  id: string;
  fileName: string;
  mimeType: string;
  fileBase64: string;
  /** untouched original capture (kept when fileBase64 holds the AI-enhanced copy) */
  originalBase64?: string;
  originalMimeType?: string;
  sizeBytes: number;
  status: JobStatus;
  error?: string | null;
  result?: any; // raw extractor response (kept for create + manual form)
  // normalized review fields
  vendor?: string | null;
  buyer?: string | null;
  date?: string | null;
  currency: string;
  kind?: string;
  documentNumber?: string | null;
  lineCount: number;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  confidence: number | null;
  warnings: string[];
  excluded: boolean;
  expanded: boolean;
  recordedId?: string | null;
  recordedNumber?: string | null;
  duplicateNumber?: string | null;
};

let jobSeq = 0;
const nextJobId = () => `rj-${Date.now()}-${++jobSeq}`;

const fmtMoney = (n: number | null | undefined) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const numOrNull = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function normalizeCurrencyCode(value: any, fallback = "SAR"): string {
  const raw = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  if (raw.includes("$") || raw.includes("دولار")) return "USD";
  if (raw.includes("ر.س") || raw.includes("ريال")) return "SAR";
  if (raw.includes("€")) return "EUR";
  if (raw.includes("د.إ")) return "AED";
  return fallback;
}

const CURRENCY_BADGE: Record<string, string> = {
  SAR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  USD: "bg-blue-50 text-blue-700 border-blue-200",
  EUR: "bg-violet-50 text-violet-700 border-violet-200",
  GBP: "bg-rose-50 text-rose-700 border-rose-200",
  AED: "bg-amber-50 text-amber-700 border-amber-200",
};
const currencyBadgeClass = (cur: string) =>
  CURRENCY_BADGE[cur] || "bg-slate-50 text-slate-700 border-slate-200";

/** Totals derived lines-first (same rule as the expense form) — never trust header blindly. */
function totalsFromResult(data: any): { subtotal: number | null; tax: number | null; total: number | null } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const lines = Array.isArray(data?.lines) ? data.lines : [];
  if (lines.length) {
    let net = 0, vat = 0, gross = 0, used = 0;
    for (const line of lines) {
      const qty = numOrNull(line?.quantity) ?? 1;
      const price = numOrNull(line?.unitPrice);
      if (price == null) continue;
      const rate = numOrNull(line?.taxRate) ?? 0;
      const base = Math.max(0, qty * price - (numOrNull(line?.discountAmount ?? line?.discount) ?? 0));
      if (line?.taxInclusive) {
        const g = numOrNull(line?.lineTotal) ?? base;
        const n = rate > 0 ? g / (1 + rate) : g;
        net += n; vat += g - n; gross += g;
      } else {
        net += base; vat += base * rate; gross += base * (1 + rate);
      }
      used++;
    }
    if (used) return { subtotal: r2(net), tax: r2(vat), total: r2(gross) };
  }
  let total = numOrNull(data?.totals?.total ?? data?.total);
  let tax = numOrNull(data?.totals?.tax);
  let subtotal = numOrNull(data?.totals?.subtotal);
  if (subtotal == null && total != null && tax != null) subtotal = Math.max(0, total - tax);
  if (tax == null && total != null && subtotal != null) tax = Math.max(0, total - subtotal);
  if (subtotal == null && total != null) subtotal = Math.max(0, total - (tax ?? 0));
  if (total == null && subtotal != null) total = subtotal + (tax ?? 0);
  return { subtotal, tax, total };
}

/** Company-name normalization for the mismatch check — strips legal suffixes + punctuation. */
function normCompanyName(value: any): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[.,\-_/\\()«»"'،؛:]/g, " ")
    .replace(
      /\b(llc|ltd|limited|inc|co|company|corp|corporation|est|establishment|enterprise|enterprises|trading|trade|group|holding|holdings|intl|international|global|saudi|ksa|for|and|شركة|شركه|مؤسسة|مؤسسه|المؤسسة|تجارية|تجاريه|للتجارة|التجارية|المحدودة|المحدوده|مساهمة|السعودية|السعوديه|للتقنية|تقنية)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function companiesMatch(a: any, b: any): boolean {
  const x = normCompanyName(a);
  const y = normCompanyName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "STC_PAY", "MADA", "CHECK", "OTHER"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function inferPaymentMethod(result: any): PaymentMethod {
  const m = String(result?.payments?.[0]?.method || "").toUpperCase();
  if ((PAYMENT_METHODS as readonly string[]).includes(m)) return m as PaymentMethod;
  const kind = String(result?.kind || "").toLowerCase();
  return kind === "bill" || kind === "invoice" ? "BANK_TRANSFER" : "CARD";
}

function inferExpenseCategory(result: any): string {
  const text = `${JSON.stringify(result?.lines || [])} ${result?.issuer?.name || ""}`.toLowerCase();
  if (/grocery|market|coffee|cereal|tamimi|panda|carrefour|lulu|بقالة|تموين|غذائ|سوبرماركت/.test(text)) return "مشتريات بقالة ومواد غذائية";
  if (/restaurant|meal|chicken|cafe|مطعم|وجبة|ضيافة|كافيه|قهوة/.test(text)) return "ضيافة ووجبات";
  if (/fuel|petrol|gas station|بنزين|وقود/.test(text)) return "وقود وتنقل";
  if (/aws|azure|google cloud|software|subscription|hosting|openai|anthropic|برامج|اشتراك|استضافة/.test(text)) return "برامج واشتراكات";
  if (/electric|water|utility|telecom|mobily|stc|zain|كهرباء|مياه|اتصالات|انترنت/.test(text)) return "فواتير خدمات";
  return "مشتريات وفواتير";
}

const cleanVendor = (v: any): string | null => {
  const s = String(v || "").replace(/\s+/g, " ").trim();
  return s || null;
};

export function ScanReceipts() {
  const { toasts, push, dismiss } = useToasts();
  const { t } = useLanguage();
  const [orgId, setOrgId] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgLegalName, setOrgLegalName] = useState("");
  const [customLocal, setCustomLocal] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<ReceiptJob[]>([]);
  const [recordBusy, setRecordBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // async-safe mirror of jobs + extraction queue
  const jobsRef = useRef<Map<string, ReceiptJob>>(new Map());
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);

  const patchJob = (id: string, patch: Partial<ReceiptJob>) => {
    const cur = jobsRef.current.get(id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    jobsRef.current.set(id, next);
    setJobs(Array.from(jobsRef.current.values()));
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result || "");
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

  const runExtraction = async (id: string) => {
    const job = jobsRef.current.get(id);
    if (!job) return;
    try {
      const result = await api.agent.extractDocument({
        fileBase64: job.fileBase64,
        fileName: job.fileName,
        mimeType: job.mimeType,
        target: "expense",
        hint: "receipt",
      });
      const totals = totalsFromResult(result);
      const warnings: string[] = Array.isArray(result?.warnings) ? [...result.warnings] : [];
      if (result?.kind === "unknown" && !result?.lines?.length) {
        warnings.push(t("لم يتعرف الذكاء على نوع المستند بوضوح — راجعه قبل التسجيل", "AI could not clearly identify the document type — review before recording"));
      }
      if (!result?.issuer?.name) {
        warnings.push(t("اسم المورّد غير واضح", "Vendor name is unclear"));
      }
      if (totals.total == null || totals.total <= 0) {
        warnings.push(t("المبالغ غير مقروءة — راجع الإيصال يدوياً", "Amounts not readable — review the receipt manually"));
      }
      patchJob(id, {
        status: "ready",
        result,
        vendor: cleanVendor(result?.issuer?.name),
        buyer: cleanVendor(result?.buyer?.name),
        date: result?.issueDate || null,
        currency: normalizeCurrencyCode(result?.currency),
        kind: result?.kind || "unknown",
        documentNumber: result?.documentNumber || null,
        lineCount: Array.isArray(result?.lines) ? result.lines.length : 0,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        confidence: typeof result?.confidence === "number" ? result.confidence : null,
        warnings: Array.from(new Set(warnings.filter(Boolean))),
      });
    } catch (e: any) {
      patchJob(id, {
        status: "error",
        error: e?.message || t("فشل التحليل", "Analysis failed"),
      });
    }
  };

  const pumpQueue = () => {
    while (activeRef.current < EXTRACT_CONCURRENCY && queueRef.current.length > 0) {
      const id = queueRef.current.shift()!;
      activeRef.current += 1;
      runExtraction(id).finally(() => {
        activeRef.current -= 1;
        pumpQueue();
      });
    }
  };

  // Batch pick: every selected file becomes its own review row.
  const handleFilePick = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const newIds: string[] = [];
    for (const file of list) {
      const id = nextJobId();
      const mime = file.type || "application/octet-stream";
      if (file.size > MAX_FILE_BYTES) {
        const job: ReceiptJob = {
          id, fileName: file.name, mimeType: mime, fileBase64: "", sizeBytes: file.size,
          status: "error", error: t("الملف أكبر من 10MB", "File is larger than 10MB"),
          currency: "SAR", lineCount: 0, subtotal: null, tax: null, total: null,
          confidence: null, warnings: [], excluded: false, expanded: false,
        };
        jobsRef.current.set(id, job);
        continue;
      }
      const job: ReceiptJob = {
        id, fileName: file.name, mimeType: mime, fileBase64: "", sizeBytes: file.size,
        status: "analyzing", currency: "SAR", lineCount: 0,
        subtotal: null, tax: null, total: null, confidence: null,
        warnings: [], excluded: false, expanded: false,
      };
      jobsRef.current.set(id, job);
      newIds.push(id);
      // Enhance phone-captured photos (contrast stretch + downscale) before AI extraction;
      // the untouched original is kept alongside for the attachments bundle.
      (async () => {
        const original = await fileToBase64(file);
        const enhanced = await enhanceReceiptImage(file);
        if (enhanced) {
          patchJob(id, { fileBase64: enhanced.base64, mimeType: enhanced.mimeType, originalBase64: original, originalMimeType: mime });
        } else {
          patchJob(id, { fileBase64: original });
        }
      })()
        .then(() => {
          queueRef.current.push(id);
          pumpQueue();
        })
        .catch(() => patchJob(id, { status: "error", error: t("تعذّرت قراءة الملف", "Could not read the file") }));
    }
    setJobs(Array.from(jobsRef.current.values()));
    if (newIds.length) {
      push("success", t(
        `أُضيف ${newIds.length} ملف — التحليل جارٍ…`,
        `${newIds.length} file(s) added — analyzing…`,
      ));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeJob = (id: string) => {
    jobsRef.current.delete(id);
    setJobs(Array.from(jobsRef.current.values()));
  };

  const clearJobs = () => {
    jobsRef.current.clear();
    queueRef.current = [];
    setJobs([]);
  };

  // Manual edit path: stash the RAW extraction for the expense form, then navigate.
  const openInForm = (job: ReceiptJob) => {
    try {
      sessionStorage.setItem(
        "entix_ocr_prefill",
        JSON.stringify(job.result || { __error: true, file: { name: job.fileName, base64: job.fileBase64, mime: job.mimeType } }),
      );
    } catch { /* storage full · form opens blank */ }
    navigate("/app/expenses/new?fromOcr=1");
  };

  // Record ONE receipt as an expense in its own currency (no conversion).
  const recordJob = async (job: ReceiptJob, allowDuplicate = false): Promise<boolean> => {
    const result = job.result;
    if (!result) return false;
    if (job.total == null || job.total <= 0) {
      patchJob(job.id, { status: "failed", error: t("المبلغ غير مقروء — افتحه في النموذج اليدوي", "Amount not readable — open it in the manual form") });
      return false;
    }
    patchJob(job.id, { status: "recording" });
    const lines = Array.isArray(result?.lines) ? result.lines : [];
    const lineItems = lines
      .map((line: any) => {
        const description = String(line?.description || "").trim();
        if (!description) return null;
        return {
          description,
          quantity: numOrNull(line?.quantity) ?? 1,
          unitPrice: numOrNull(line?.unitPrice) ?? 0,
          taxRate: numOrNull(line?.taxRate),
          taxInclusive: Boolean(line?.taxInclusive),
          lineTotal: numOrNull(line?.lineTotal),
          category: line?.category || null,
          accountName: line?.accountName || null,
          sku: line?.sku || null,
          notes: line?.notes || null,
        };
      })
      .filter(Boolean);
    const payments = (Array.isArray(result?.payments) ? result.payments : [])
      .map((p: any) => {
        const amount = numOrNull(p?.amount);
        if (!amount || amount <= 0) return null;
        const method = String(p?.method || "").toUpperCase();
        return {
          method: (PAYMENT_METHODS as readonly string[]).includes(method) ? method : "OTHER",
          amount,
          reference: p?.reference || null,
          cardLast4: p?.cardLast4 || null,
          accountName: p?.accountName || null,
        };
      })
      .filter(Boolean);
    try {
      const created: any = await api.expenses.create({
        date: job.date || new Date().toISOString().slice(0, 10),
        category: inferExpenseCategory(result),
        description: result?.notes || (job.documentNumber ? `${t("مستند", "Doc")} ${job.documentNumber}` : job.vendor) || job.fileName,
        amount: job.subtotal != null && job.subtotal > 0 ? job.subtotal : job.total,
        subtotal: job.subtotal ?? undefined,
        taxAmount: job.tax ?? 0,
        totalAmount: job.total,
        currency: job.currency,
        paymentMethod: inferPaymentMethod(result),
        vendorName: job.vendor,
        supplierTaxId: result?.issuer?.taxId || null,
        documentNumber: job.documentNumber,
        lineItems: lineItems.length ? (lineItems as any) : null,
        paymentSplits: payments.length ? (payments as any) : null,
        attachments: [
          { name: job.fileName, contentType: job.mimeType, base64: job.fileBase64, sizeBytes: job.sizeBytes },
          ...(job.originalBase64
            ? [{ name: `original-${job.fileName}`, contentType: job.originalMimeType || job.mimeType, base64: job.originalBase64, sizeBytes: job.sizeBytes }]
            : []),
        ],
        sourceFileHash: result?.sourceFileHash || null,
        extractedJson: result,
        ocrConfidence: job.confidence,
        autoCreateSupplier: true,
        allowDuplicate,
      });
      if (created?.duplicateExpense) {
        patchJob(job.id, {
          status: "duplicate",
          duplicateNumber: created.duplicateExpense.number || null,
          recordedId: created?.id || null,
        });
        return false;
      }
      patchJob(job.id, {
        status: "recorded",
        recordedId: created?.id || null,
        recordedNumber: created?.number || null,
      });
      return true;
    } catch (e: any) {
      patchJob(job.id, { status: "failed", error: e?.message || t("فشل التسجيل", "Recording failed") });
      return false;
    }
  };

  // The headline action: record ALL checked receipts.
  const recordAll = async () => {
    const targets = jobs.filter((j) => j.status === "ready" && !j.excluded);
    if (!targets.length || recordBusy) return;
    setRecordBusy(true);
    let ok = 0, failed = 0, dup = 0;
    for (const job of targets) {
      const done = await recordJob(job);
      if (done) ok++;
      else {
        const after = jobsRef.current.get(job.id);
        if (after?.status === "duplicate") dup++;
        else failed++;
      }
    }
    setRecordBusy(false);
    if (ok) push("success", t(`تم تسجيل ${ok} مصروف بنجاح`, `${ok} expense(s) recorded`));
    if (dup) push("error", t(`${dup} مستند يبدو مكرراً — راجعه`, `${dup} document(s) look duplicated — review them`));
    if (failed) push("error", t(`تعذّر تسجيل ${failed} مستند`, `${failed} document(s) failed to record`));
  };

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api.orgs.list();
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
        const active = (stored ? orgs.find((org) => org.id === stored) : null) || orgs[0];
        setOrgId(active?.id || "");
        setOrgSlug(active?.slug || "");
        setOrgName((active as any)?.name || "");
        setOrgLegalName((active as any)?.legalName || "");
        setCustomLocal((active as any)?.inboundEmailLocal || null);
        setCustomDomain((active as any)?.inboundEmailDomain || null);
      } catch (e: any) {
        push("error", t("تعذّر تحميل إعدادات الإيميل — تأكد أن قاعدة البيانات محدّثة (inboundEmailLocal).", "Could not load email settings — make sure the database is up to date (inboundEmailLocal)."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMismatch = (job: ReceiptJob): boolean => {
    if (!job.buyer || !orgName) return false;
    if (companiesMatch(job.buyer, orgName)) return false;
    if (orgLegalName && companiesMatch(job.buyer, orgLegalName)) return false;
    return true;
  };

  const defaultLocal = orgSlug ? `bills-${orgSlug}` : "";
  const activeLocal = customLocal || defaultLocal;
  const activeDomain = (INBOUND_DOMAINS as readonly string[]).includes(customDomain || "") ? (customDomain as string) : DEFAULT_INBOUND_DOMAIN;
  const alias = activeLocal ? `${activeLocal}@${activeDomain}` : "—";

  const copyAlias = async () => {
    if (!activeLocal) return;
    try { await navigator.clipboard.writeText(alias); push("success", t("تم النسخ", "Copied")); }
    catch { push("error", t("فشل النسخ", "Copy failed")); }
  };

  const openEdit = () => {
    setEditValue(customLocal || "");
    setEditError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const v = editValue.trim().toLowerCase();
    if (v && !/^[a-z0-9][a-z0-9.+-]{0,62}[a-z0-9]$/.test(v)) {
      setEditError(t("أحرف إنجليزية صغيرة وأرقام و . + - فقط · يبدأ وينتهي بحرف أو رقم", "Lowercase letters, digits and . + - only · must start and end with a letter or digit"));
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await api.orgs.update(orgId, { inboundEmailLocal: v || null } as any);
      setCustomLocal(v || null);
      setEditOpen(false);
      push("success", v ? `${t("صار عنوانك", "Your address is now")} ${v}@${activeDomain}` : t("رجعنا للعنوان الافتراضي", "Reverted to the default address"));
    } catch (e: any) {
      const code = e?.code || "";
      setEditError(code === "inbound_local_taken" ? t("هذا العنوان مستخدم من شركة أخرى · اختر غيره", "This address is used by another company · choose a different one") : (e?.message || t("فشل الحفظ", "Save failed")));
    } finally { setEditBusy(false); }
  };

  const saveDomain = async (domain: string) => {
    if (domain === activeDomain || domainBusy || !orgId) return;
    setDomainBusy(true);
    try {
      await api.orgs.update(orgId, { inboundEmailDomain: domain } as any);
      setCustomDomain(domain);
      push("success", t(`صار عنوانك على ${domain}`, `Your address now lives on ${domain}`));
    } catch (e: any) {
      push("error", e?.message || t("فشل حفظ الدومين", "Could not save the domain"));
    } finally { setDomainBusy(false); }
  };

  const readyJobs = jobs.filter((j) => j.status === "ready" && !j.excluded);
  const mismatchCount = jobs.filter((j) => j.status === "ready" && !j.excluded && isMismatch(j)).length;
  const analyzingCount = jobs.filter((j) => j.status === "analyzing").length;

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto pt-4">
        <div className="text-xs text-primary uppercase tracking-wider mb-2 font-english">RECEIPTS</div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          {t("تتبّع المصروفات تلقائياً", "Track expenses automatically")} <span className="italic text-primary">{t("بالذكاء", "with AI")}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t("ارفع عدة إيصالات دفعة واحدة · راجعها · أكّدها — تُسجَّل كلها بعملاتها الأصلية", "Upload several receipts at once · review them · confirm — all recorded in their original currencies")}
        </p>
        <p className="text-sm text-muted-foreground/60 mt-3">{t("كيف تريد إدخال الإيصالات؟", "How do you want to enter receipts?")}</p>
      </div>

      {/* 3 options grid · Wave-style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {/* Phone scan */}
        <Card className="border-border hover:border-primary transition cursor-pointer group">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/5 flex items-center justify-center">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-foreground" style={{ fontWeight: 700 }}>{t("التقاط بالهاتف", "Capture with phone")}</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              {t("حمّل تطبيق ENTIX.IO للجوال والتقط الإيصالات بكاميرا الهاتف", "Download the ENTIX.IO mobile app and capture receipts with your phone camera")}
            </p>
            <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded bg-blue-50 text-primary font-semibold">{t("قريباً", "Coming soon")}</span>
          </CardContent>
        </Card>

        {/* File upload · batch · drag & drop */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,text/csv"
          multiple
          className="hidden"
          onChange={(e) => handleFilePick(e.target.files)}
        />
        <div
          className="block"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFilePick(e.dataTransfer?.files || null);
          }}
        >
          <Card className={`border-border transition cursor-pointer h-full ${dragOver ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-primary"}`}>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/5 flex items-center justify-center">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-foreground" style={{ fontWeight: 700 }}>{t("رفع من الكمبيوتر", "Upload from computer")}</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-5">
                {t("اختر عدة ملفات أو اسحبها هنا · PNG/JPG/WEBP · PDF · CSV", "Choose several files or drag them here · PNG/JPG/WEBP · PDF · CSV")}
              </p>
              <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">{t("موصى به · دفعات", "Recommended · batch")}</span>
            </CardContent>
          </Card>
        </div>

        {/* Email forward */}
        <Card className="border-border hover:border-primary transition">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary/5 flex items-center justify-center">
              <Send className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-foreground" style={{ fontWeight: 700 }}>{t("إعادة توجيه بالإيميل", "Forward by email")}</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              {t("أرسل الإيصالات الرقمية للإيميل التالي وسيقرأها AI تلقائياً", "Send digital receipts to the following email and AI will read them automatically")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* REVIEW · batch extraction results */}
      {jobs.length > 0 && (
        <Card className="border-border max-w-5xl mx-auto">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-foreground" style={{ fontWeight: 700 }}>
                <ListChecks className="h-4 w-4 text-primary" />
                {t("مراجعة الإيصالات", "Receipt review")}
                <span className="text-xs text-muted-foreground font-normal">({jobs.length})</span>
                {analyzingCount > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin" /> {t(`يُحلَّل ${analyzingCount}…`, `analyzing ${analyzingCount}…`)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearJobs}
                  className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted/50"
                >
                  {t("مسح الكل", "Clear all")}
                </button>
                <Button
                  onClick={recordAll}
                  disabled={!readyJobs.length || recordBusy}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {recordBusy
                    ? <Loader2 className="h-4 w-4 me-1 animate-spin" />
                    : <CheckCircle2 className="h-4 w-4 me-1" />}
                  {recordBusy
                    ? t("جارٍ التسجيل…", "Recording…")
                    : t(`تأكيد وتسجيل الكل (${readyJobs.length})`, `Confirm & record all (${readyJobs.length})`)}
                </Button>
              </div>
            </div>

            {/* company-mismatch banner */}
            {mismatchCount > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span style={{ fontWeight: 700 }}>
                    {t(`تنبيه: ${mismatchCount} مستند باسم شركة أخرى غير «${orgName}».`, `Warning: ${mismatchCount} document(s) are billed to a company other than "${orgName}".`)}
                  </span>{" "}
                  {t("راجع الصفوف المظللة — أكّد فقط إن كانت فعلاً مصروفات شركتك، أو أزلها من القائمة.", "Review the highlighted rows — confirm only if they really are your company's expenses, or remove them from the list.")}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {jobs.map((job) => {
                const mismatch = job.status === "ready" && isMismatch(job);
                const selfIssued = job.status === "ready" && job.vendor && orgName && companiesMatch(job.vendor, orgName);
                return (
                  <div
                    key={job.id}
                    className={`rounded-lg border ${
                      mismatch ? "border-amber-300 bg-amber-50/50" : "border-border bg-white"
                    } ${job.excluded ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                      {/* include checkbox */}
                      {(job.status === "ready" || job.status === "duplicate" || job.status === "failed") && (
                        <input
                          type="checkbox"
                          checked={!job.excluded}
                          onChange={() => patchJob(job.id, { excluded: !job.excluded })}
                          className="h-4 w-4 accent-[#1276E3] shrink-0"
                          title={t("تضمين في التسجيل الجماعي", "Include in batch recording")}
                        />
                      )}

                      {/* status icon */}
                      <span className="shrink-0">
                        {job.status === "analyzing" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {job.status === "ready" && (mismatch
                          ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                          : <Sparkles className="h-4 w-4 text-emerald-600" />)}
                        {job.status === "recording" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {job.status === "recorded" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        {job.status === "duplicate" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        {(job.status === "error" || job.status === "failed") && <X className="h-4 w-4 text-red-500" />}
                      </span>

                      {/* file + vendor/buyer */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground font-english truncate max-w-[180px]" dir="ltr">{job.fileName}</span>
                          {job.kind && job.kind !== "unknown" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{job.kind}</span>
                          )}
                        </div>
                        {job.status === "ready" && (
                          <div className="text-sm text-foreground mt-0.5" style={{ fontWeight: 600 }}>
                            {job.vendor || t("مورّد غير واضح", "Unclear vendor")}
                            {job.documentNumber && (
                              <span className="text-xs text-muted-foreground font-english font-normal ms-2" dir="ltr">#{job.documentNumber}</span>
                            )}
                          </div>
                        )}
                        {job.status === "ready" && job.buyer && (
                          <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${mismatch ? "text-amber-700" : "text-muted-foreground"}`}>
                            <Building2 className="h-3 w-3" />
                            {t("مُصدَرة إلى:", "Billed to:")} <span style={{ fontWeight: 600 }}>{job.buyer}</span>
                            {mismatch && <span style={{ fontWeight: 700 }}>· {t("ليست شركتك!", "not your company!")}</span>}
                          </div>
                        )}
                        {selfIssued && (
                          <div className="text-[11px] mt-0.5 text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t("هذا المستند صادر من شركتك — قد يكون إيراداً لا مصروفاً", "This document is issued BY your company — it may be revenue, not an expense")}
                          </div>
                        )}
                        {job.status === "error" && (
                          <div className="text-xs text-red-600 mt-0.5">{job.error || t("فشل التحليل", "Analysis failed")}</div>
                        )}
                        {job.status === "failed" && (
                          <div className="text-xs text-red-600 mt-0.5">{job.error || t("فشل التسجيل", "Recording failed")}</div>
                        )}
                        {job.status === "duplicate" && (
                          <div className="text-xs text-amber-700 mt-0.5">
                            {t("يبدو مسجلاً مسبقاً", "Looks already recorded")}{job.duplicateNumber ? ` · ${job.duplicateNumber}` : ""}
                          </div>
                        )}
                        {job.status === "recorded" && (
                          <div className="text-xs text-emerald-700 mt-0.5">
                            {t("سُجّل", "Recorded")}{job.recordedNumber ? ` · ${job.recordedNumber}` : ""}
                          </div>
                        )}
                      </div>

                      {/* review numbers */}
                      {job.status === "ready" && (
                        <div className="flex items-center gap-4 shrink-0 text-left" dir="ltr">
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">{t("التاريخ", "Date")}</div>
                            <div className="text-xs font-english text-foreground">{job.date || "—"}</div>
                          </div>
                          <div className="text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-english ${currencyBadgeClass(job.currency)}`} style={{ fontWeight: 700 }}>
                              {job.currency}
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">{t("البنود", "Items")}</div>
                            <div className="text-xs font-english text-foreground">{job.lineCount}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">{t("الضريبة", "VAT")}</div>
                            <div className="text-xs font-english text-foreground">{fmtMoney(job.tax)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">{t("الإجمالي", "Total")}</div>
                            <div className="text-sm font-english text-foreground" style={{ fontWeight: 700 }}>{fmtMoney(job.total)}</div>
                          </div>
                          {job.confidence != null && (
                            <div className="text-center">
                              <div className="text-[10px] text-muted-foreground">{t("الثقة", "Conf.")}</div>
                              <div className={`text-xs font-english ${job.confidence >= 0.8 ? "text-emerald-600" : job.confidence >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                                {Math.round(job.confidence * 100)}%
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {job.status === "ready" && (
                          <>
                            <button
                              onClick={() => recordJob(job)}
                              className="px-2.5 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                              title={t("تسجيل هذا الإيصال فوراً", "Record this receipt now")}
                            >
                              {t("تسجيل", "Record")}
                            </button>
                            <button
                              onClick={() => openInForm(job)}
                              className="px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-primary/5 hover:border-primary hover:text-primary flex items-center gap-1"
                              title={t("فتح في نموذج المصروف للتعديل", "Open in the expense form to edit")}
                            >
                              <ExternalLink className="h-3 w-3" /> {t("تعديل", "Edit")}
                            </button>
                            <button
                              onClick={() => patchJob(job.id, { expanded: !job.expanded })}
                              className="p-1.5 rounded-md border border-border text-xs hover:bg-muted/50"
                              title={t("استعراض البنود", "Review line items")}
                            >
                              {job.expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </>
                        )}
                        {job.status === "duplicate" && (
                          <button
                            onClick={() => recordJob(job, true)}
                            className="px-2.5 py-1.5 rounded-md border border-amber-300 text-amber-700 text-xs hover:bg-amber-50"
                            title={t("تسجيل رغم التكرار", "Record despite duplication")}
                          >
                            {t("تسجيل رغم التكرار", "Record anyway")}
                          </button>
                        )}
                        {(job.status === "error" || job.status === "failed") && job.fileBase64 && (
                          <button
                            onClick={() => openInForm(job)}
                            className="px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-primary/5 hover:border-primary hover:text-primary flex items-center gap-1"
                          >
                            <ArrowLeft className="h-3 w-3" /> {t("يدوياً", "Manually")}
                          </button>
                        )}
                        <button
                          onClick={() => removeJob(job.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          title={t("إزالة من القائمة", "Remove from list")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* expanded: line items + warnings */}
                    {job.expanded && job.status === "ready" && (
                      <div className="border-t border-border/60 px-3 py-2.5 space-y-2">
                        {Array.isArray(job.result?.lines) && job.result.lines.length > 0 ? (
                          <div className="space-y-1">
                            {job.result.lines.map((line: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-foreground truncate flex-1">{line?.description || "—"}</span>
                                <span className="font-english text-muted-foreground shrink-0" dir="ltr">
                                  {numOrNull(line?.quantity) ?? 1} × {fmtMoney(numOrNull(line?.unitPrice))}
                                </span>
                                <span className="font-english text-foreground shrink-0 w-24 text-end" dir="ltr" style={{ fontWeight: 600 }}>
                                  {fmtMoney(numOrNull(line?.lineTotal) ?? ((numOrNull(line?.quantity) ?? 1) * (numOrNull(line?.unitPrice) ?? 0)))} {job.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">{t("لا بنود تفصيلية — سيُسجَّل الإجمالي فقط.", "No detailed lines — only the total will be recorded.")}</div>
                        )}
                        {job.warnings.length > 0 && (
                          <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2 space-y-0.5">
                            {job.warnings.map((w, i) => (
                              <div key={i} className="text-[11px] text-amber-800 flex items-start gap-1.5">
                                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {w}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground/70 leading-5">
              {t(
                "كل إيصال يُسجَّل بعملته الأصلية كما قرأها الذكاء من المستند (USD يبقى USD · SAR يبقى SAR) — لا يوجد تحويل تلقائي بين العملات.",
                "Every receipt is recorded in its original currency as read from the document (USD stays USD · SAR stays SAR) — no automatic currency conversion.",
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email alias display */}
      <Card className="border-border max-w-3xl mx-auto">
        <CardContent className="p-5">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5" /> {t("إيميل إعادة التوجيه الخاص بشركتك", "Your company's forwarding email")}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="flex-1 min-w-0 font-english text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 truncate" dir="ltr">
              {alias}
            </code>
            <button
              onClick={copyAlias}
              disabled={!activeLocal}
              className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/5 hover:border-primary hover:text-primary transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> {t("نسخ", "Copy")}
            </button>
            <button
              onClick={openEdit}
              className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/5 hover:border-primary hover:text-primary transition flex items-center gap-1.5"
              title={t("غيّر عنوان الاستقبال", "Change the inbound address")}
            >
              <Pencil className="h-3.5 w-3.5" /> {t("تخصيص", "Customize")}
            </button>
          </div>
          {/* domain choice · segmented (no dropdowns) · both receive-only */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{t("الدومين:", "Domain:")}</span>
            <div className="inline-flex rounded-lg bg-muted p-0.5 border border-border" dir="ltr">
              {INBOUND_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  onClick={() => saveDomain(domain)}
                  disabled={domainBusy}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-english transition ${activeDomain === domain ? "bg-white text-primary shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  @{domain}
                </button>
              ))}
            </div>
            {domainBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground/80 leading-5 flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
            {t(
              "عنوان استقبال فقط — الدومينان مقفلان بالكامل (SPF + DMARC reject) فلا يقدر أحد يرسل «منه» أو ينتحل شركتك. بريد الموظفين الحقيقي يبقى على @entix.io ولا نخلطه أبداً.",
              "Receive-only address — both domains are fully locked (SPF + DMARC reject), so nobody can send FROM it or impersonate your company. Real employee mail stays on @entix.io and we never mix it.",
            )}
          </p>
          {customLocal && (
            <p className="mt-1.5 text-[11px] text-emerald-700">{t("عنوان مخصص · الافتراضي:", "Custom address · Default:")} <span className="font-english" dir="ltr">{defaultLocal}@{activeDomain}</span></p>
          )}

          {/* alias editor */}
          {editOpen && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs text-foreground" style={{ fontWeight: 600 }}>{t("عنوان الاستقبال الخاص بك", "Your inbound address")}</div>
              <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                <input
                  value={editValue}
                  onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                  placeholder={defaultLocal || "tareq"}
                  className="flex-1 min-w-[180px] font-english text-sm rounded-md border border-border bg-white px-3 py-2"
                  dir="ltr"
                  autoFocus
                />
                <span className="font-english text-sm text-muted-foreground">@{activeDomain}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-5">
                {t("مثال:", "Example:")} <span className="font-english" dir="ltr">bills.tareq</span> · {t("اتركه فاضيًا للرجوع للعنوان الافتراضي", "leave it empty to revert to the default address")} <span className="font-english" dir="ltr">{defaultLocal}</span>
              </p>
              {editError && <div className="text-xs text-red-600">{editError}</div>}
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEdit}
                  disabled={editBusy}
                  className="px-3 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                >
                  {editBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("حفظ العنوان", "Save address")}
                </button>
                {customLocal && (
                  <button
                    onClick={() => { setEditValue(""); }}
                    className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-white flex items-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> {t("رجوع للافتراضي", "Revert to default")}
                  </button>
                )}
                <button onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-white">{t("إلغاء", "Cancel")}</button>
              </div>
            </div>
          )}

          <button onClick={() => setShowFaq(true)} className="mt-3 text-xs text-primary hover:underline">
            {t("تعرف على كيفية فحص الإيصالات الرقمية ←", "Learn how digital receipt scanning works ←")}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground/60 leading-5">
            {t("أي إيميل يوصل لهذا العنوان يدخل", "Any email sent to this address enters")} <Link to="/app/inbox" className="text-primary hover:underline">{t("صندوق الوارد", "the Inbox")}</Link> {t("تلقائيًا مع مرفقاته ويقرأه الذكاء الاصطناعي.", "automatically with its attachments and AI reads it.")}
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/60 text-center">
        {t("الإيصالات تُحفظ في", "Receipts are saved in")} <Link to="/app/inbox" className="text-primary hover:underline">{t("صندوق الوارد", "the Inbox")}</Link>
        {" "}{t("ثم تُحوّل تلقائياً لمصروفات/فواتير شراء بعد المراجعة", "then automatically converted to expenses/purchase bills after review")}
      </p>

      {/* FAQ modal */}
      {showFaq && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowFaq(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-foreground" style={{ fontWeight: 700 }}>{t("فحص الإيصالات الرقمية", "Digital receipt scanning")}</h2>
              <button onClick={() => setShowFaq(false)} className="p-1 hover:bg-muted/50 rounded">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-foreground/80">
              {[
                { q: t("كيف يعمل؟", "How does it work?"), a: t("ارفع عدة إيصالات دفعة واحدة · يحلّلها الذكاء ويعرضها للمراجعة · وعند تأكيدك تُسجَّل كلها مصروفات بعملاتها الأصلية.", "Upload several receipts at once · AI analyzes them and shows them for review · on your confirmation they are all recorded as expenses in their original currencies.") },
                { q: t("ماذا لو الإيصال باسم شركة أخرى؟", "What if a receipt is billed to another company?"), a: t("ينبّهك النظام بشريط أصفر قبل التسجيل · راجع الصف وأكّده فقط إن كان فعلاً مصروف شركتك.", "The system warns you with an amber banner before recording · review the row and confirm only if it really is your company's expense.") },
                { q: t("أيش نوع الإيصالات؟", "What kind of receipts?"), a: t("فواتير الموردين · إيصالات المتاجر · فواتير AWS واشتراكات البرامج · بالدولار أو الريال أو أي عملة.", "Supplier invoices · store receipts · AWS and software subscription bills · in USD, SAR, or any currency.") },
                { q: t("كم تستغرق المعالجة؟", "How long does processing take?"), a: t("ثوانٍ لكل ملف داخل الصفحة · وبالإيميل 5-15 دقيقة ليظهر في صندوق الوارد.", "Seconds per file on this page · by email 5-15 minutes to appear in the Inbox.") },
                { q: t("صيغ الملفات المدعومة؟", "Supported file formats?"), a: t("PDF · JPG · PNG · WEBP · CSV · حد أقصى 10 ميجا لكل ملف.", "PDF · JPG · PNG · WEBP · CSV · 10MB maximum per file.") },
                { q: t("إيصالي ما اتقرى · إيش السبب؟", "My receipt was not read · why?"), a: t("تأكد إنه واضح وغير ملطّخ · والحجم تحت 10MB · أو افتحه في نموذج المصروف وسجّله يدوياً.", "Make sure it is clear and not smudged · and under 10MB · or open it in the expense form and record it manually.") },
              ].map((f, i) => (
                <div key={i} className="border-b border-border/50 pb-3 last:border-0">
                  <div className="text-foreground font-semibold mb-1">{f.q}</div>
                  <div className="text-muted-foreground text-xs leading-5">{f.a}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowFaq(false)} className="mt-4 w-full bg-primary hover:bg-primary">{t("حسناً", "Got it")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
