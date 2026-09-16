/**
 * EstimateIntakeZone · file-first estimate intake (CEO 2026-09-13)
 *
 * «أسقط ملف الدراسة هنا» — a wide dashed card that accepts a BOQ Excel, a
 * quotation PDF or an image. The zone itself is dumb: it validates the extension,
 * shows drag / busy states and hands the File to `onFile`. The page decides what
 * happens (no estimate yet → POST /api/estimates/import-file creates the DRAFT ·
 * estimate exists → append via /import-boq).
 *
 * Why not <DocumentDropZone>? That component is hard-wired to
 * /api/agent/extract-document (base64 · onExtracted) — a different pipeline.
 * This zone mirrors its look (dashed card · primary tint on drag) and nothing else.
 *
 * UX-1: errors come back through `error` (rendered by the page as an InlineAlert)
 * — no window.alert, no dialog.
 */
import { useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent } from "react";
import { FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "./LanguageContext";

export const ESTIMATE_INTAKE_ACCEPT = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp";
const ACCEPT_EXT = ESTIMATE_INTAKE_ACCEPT.split(",");
const MAX_MB = 10;

interface Props {
  /** Receives the dropped/picked file · the page owns the request + feedback */
  onFile: (file: File) => void | Promise<void>;
  /** Client-side rejection (wrong extension · too large) · rendered by the page as an InlineAlert */
  onReject?: (message: string) => void;
  /** Busy while the server reads the file → «جارٍ قراءة الملف…» */
  busy?: boolean;
  /** Frozen estimate (CONVERTED / ARCHIVED) · zone is inert */
  disabled?: boolean;
  /** Text under the headline · default explains the create-draft behaviour */
  hint?: string;
  /** Headline · default «أسقط ملف الدراسة هنا» */
  title?: string;
  className?: string;
  /** Larger paddings for the list empty state */
  size?: "default" | "hero";
}

export function EstimateIntakeZone({ onFile, onReject, busy = false, disabled = false, hint, title, className = "", size = "default" }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inert = busy || disabled;

  const take = (file: File | undefined | null) => {
    if (!file || inert) return;
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPT_EXT.includes(ext)) {
      onReject?.(t(`صيغة الملف غير مدعومة (${ext || "؟"}) — المقبول: Excel (.xlsx .xls .csv) · PDF · صور (.png .jpg .webp)`,
                   `Unsupported file type (${ext || "?"}) — accepted: Excel (.xlsx .xls .csv) · PDF · images (.png .jpg .webp)`));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      onReject?.(t(`الملف أكبر من ${MAX_MB} ميجابايت — صغّره أو قسّمه`, `The file exceeds ${MAX_MB} MB — shrink or split it`));
      return;
    }
    void onFile(file);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false);
    take(e.dataTransfer.files?.[0]);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    take(f);
  };

  const pad = size === "hero" ? "px-6 py-10" : "px-5 py-6";

  return (
    <div
      role="button"
      tabIndex={inert ? -1 : 0}
      aria-disabled={inert}
      aria-busy={busy}
      data-testid="estimate-intake-zone"
      onDragOver={(e) => { if (inert) return; e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => { if (!inert) inputRef.current?.click(); }}
      onKeyDown={(e) => { if (!inert && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); inputRef.current?.click(); } }}
      className={`w-full rounded-xl border-2 border-dashed text-center transition-colors ${pad} ${
        dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
      } ${inert ? "cursor-default opacity-70" : "cursor-pointer hover:border-primary/60"} ${className}`}
    >
      <input ref={inputRef} type="file" accept={ESTIMATE_INTAKE_ACCEPT} className="hidden" onChange={onChange} data-testid="estimate-intake-file" />
      {busy ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" strokeWidth={1.75} />
          <p className="text-sm font-medium text-foreground">{t("جارٍ قراءة الملف…", "Reading the file…")}</p>
          <p className="text-xs text-muted-foreground">{t("يُقرأ العنوان والعميل والبنود ثم تُنشأ مسودة تلقائيًا", "Title, client and lines are read, then a draft is created")}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-primary" aria-hidden="true">
            <FileSpreadsheet className="h-6 w-6" strokeWidth={1.75} />
            <FileText className="h-6 w-6" strokeWidth={1.75} />
            <ImageIcon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-semibold text-foreground">{title || t("أسقط ملف الدراسة هنا", "Drop the study file here")}</p>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            {hint || t("Excel (BOQ) أو PDF أو صورة · يُنشأ مسودة تلقائيًا ويُقرأ العنوان والعميل والبنود",
                       "Excel (BOQ), PDF or image · a draft is created automatically and the title, client and lines are read")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 border-border"
            disabled={inert}
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            data-testid="estimate-intake-pick"
          >
            <Upload className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("اختر ملفًا", "Choose a file")}
          </Button>
        </div>
      )}
    </div>
  );
}
