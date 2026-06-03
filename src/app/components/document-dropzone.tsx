/**
 * DocumentDropZone · UX-65b · drag/drop or click to upload any document
 *
 * On drop:
 *   1. Read file → base64
 *   2. POST /api/agent/extract-document
 *   3. Auto-fill the parent's lines + form fields via onExtracted(result)
 *
 * Supports: image (jpg/png), PDF, CSV, XLSX, plain text.
 *
 * Bonus: pass `target="invoice-lines"` and the model will convert quote→invoice
 * intelligently.
 *
 * Usage:
 *   <DocumentDropZone
 *     target="invoice-lines"
 *     onExtracted={(data) => {
 *       setLines(data.lines.map(...))
 *       setForm({ ...form, contactId: ..., issueDate: data.issueDate })
 *     }}
 *   />
 */
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, FileText, Image, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { api } from "../lib/api";

export type ExtractTarget = "invoice-lines" | "quote-lines" | "bill-lines" | "expense" | "contact" | "auto";

export interface ExtractedDocument {
  kind: string;
  confidence: number;
  status?: string;
  documentType?: string;
  message?: string;
  issuer?: { name?: string; taxId?: string; country?: string };
  buyer?: { name?: string; taxId?: string };
  documentNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  lines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    taxInclusive?: boolean;
    lineTotal?: number;
    notes?: string | null;
  }>;
  totals?: { subtotal: number; discount: number; tax: number; total: number };
  paymentTerms?: string;
  notes?: string;
  warnings?: string[];
  _meta?: { model: string; cost: string };
}

interface Props {
  target?: ExtractTarget;
  /** Hint to the AI · e.g. "this is a quote, convert to invoice" */
  hint?: string;
  onExtracted: (data: ExtractedDocument) => void;
  onError?: (msg: string) => void;
  defaultTaxRate?: number;
  currency?: string;
  className?: string;
  /** Compact bar version (single-row, used inside form) */
  compact?: boolean;
}

const ACCEPT = "image/*,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BANK_STATEMENT_REVIEW_STATUS = "needs_bank_statement_review";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:mime/type;base64," prefix
      const idx = result.indexOf("base64,");
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function DocumentDropZone({
  target = "invoice-lines",
  hint,
  onExtracted,
  onError,
  defaultTaxRate = 0.15,
  currency = "SAR",
  className = "",
  compact = false,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setSuccess(null);
    setError(null);
    try {
      // 100MB limit · large PDFs are downscaled by the AI extractor
      if (file.size > 100 * 1024 * 1024) {
        throw new Error("الملف أكبر من 100MB · جرّب ملف أصغر أو قسّمه");
      }
      const base64 = await fileToBase64(file);
      const data: ExtractedDocument = await (api as any).agent.extractDocument({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        target,
        hint,
        defaultTaxRate,
        currency,
      });
      if (data?.status === BANK_STATEMENT_REVIEW_STATUS || data?.documentType === "bank_statement") {
        throw new Error(data.message || "تم اكتشاف كشف حساب بنكي. لم يتم تحويله إلى مستند مالي.");
      }
      if (!data || data.confidence === 0) {
        throw new Error("تعذّر استخراج بيانات من المستند · جرّب صورة أوضح");
      }
      onExtracted(data);
      setSuccess(`تم استخراج ${data.lines?.length || 0} بنداً من ${file.name}`);
    } catch (e: any) {
      const msg = e?.message || "فشل الرفع";
      setError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await handleFile(file);
          break;
        }
      }
    }
  };

  if (compact) {
    return (
      <div
        className={`rounded-lg border-2 border-dashed transition-colors px-4 py-3 flex items-center justify-between gap-3 ${
          dragOver ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] bg-white"
        } ${className}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" />
        <div className="flex items-center gap-3 text-sm text-[#6B7280] min-w-0">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#1276E3] shrink-0" />
          ) : success ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : error ? (
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          ) : (
            <Upload className="h-4 w-4 text-[#1276E3] shrink-0" />
          )}
          <span className="truncate">
            {busy ? "جارٍ الاستخراج بالذكاء الاصطناعي..." :
             success ? success :
             error ? error :
             "اسحب ملفاً هنا · تصفح PDF · صور · AI OCR ← Excel تلقائي"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-sm text-[#1276E3] hover:underline disabled:opacity-50 shrink-0"
        >
          تصفح الملفات
        </button>
      </div>
    );
  }

  // Full-size drop zone
  return (
    <div
      className={`rounded-xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
        dragOver ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] bg-white hover:border-[#1276E3]"
      } ${className}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
      onPaste={handlePaste}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" />
      {busy ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" />
          <p className="text-sm text-[#6B7280]">جارٍ تحليل المستند بالذكاء الاصطناعي...</p>
        </div>
      ) : success ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="text-sm text-[#374151]">{success}</p>
          <button onClick={(e) => { e.stopPropagation(); setSuccess(null); }} className="text-xs text-[#1276E3] hover:underline">
            رفع ملف آخر
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-2 text-[#1276E3]">
            <FileText className="h-6 w-6" />
            <Image className="h-6 w-6" />
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>
            اسحب أي مستند هنا أو اضغط للتصفح
          </p>
          <p className="text-xs text-[#6B7280]">
            PDF · صور · Excel · CSV · سيتم استخراج البنود تلقائياً بالذكاء الاصطناعي
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            💡 يمكنك حتى رفع عرض سعر · سنحوّله لفاتورة مبيعات بضغطة
          </p>
          {error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-md flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
              <button onClick={(e) => { e.stopPropagation(); setError(null); }} className="ms-1"><X className="h-3 w-3" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
