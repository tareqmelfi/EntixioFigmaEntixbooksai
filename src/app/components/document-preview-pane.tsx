/**
 * DocumentPreviewPane · UX-143
 *
 * Wafeq-style left-side document preview when uploading invoice/bill files.
 * Renders next to a form. Shows:
 *  - Drop zone (drag/drop OR click to upload)
 *  - PDF/image preview using browser native rendering
 *  - "AI تعبئة تلقائية" button to extract structured data
 *  - Multi-file thumbnails strip
 *
 * Usage:
 *   <DocumentPreviewPane
 *     onFilesAdded={(files) => setUploadedFiles(files)}
 *     onExtract={async (file) => {
 *       const data = await api.agent.extractFromDocument(file);
 *       fillForm(data);
 *     }}
 *   />
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Images, Upload, Sparkles, X, FileText, Image as ImageIcon, Loader2, Eye } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageContext";

export interface DocumentPreviewProps {
  className?: string;
  onFilesAdded?: (files: File[]) => void | Promise<void>;
  onExtract?: (file: File) => Promise<any>;
  /** Show only the latest file in main preview · default true */
  showLatestOnly?: boolean;
  /** Accept attribute for input · default any */
  accept?: string;
  /** Max file size in MB · default 25 */
  maxSizeMb?: number;
  /** Initial files (e.g. from edit mode) */
  initialFiles?: Array<{ name: string; url: string; type: string }>;
  /** Hint text shown in empty state */
  hint?: string;
  /** Enable AI extract button · default true */
  enableExtract?: boolean;
  /** Start extraction immediately after upload · default false */
  autoExtract?: boolean;
}

interface FileItem {
  id: string;
  file: File | null; // null for initial files (already uploaded)
  extractFile: File | null;
  name: string;
  url: string;
  type: string;
  note?: string;
  extracted?: boolean;
  extracting?: boolean;
}

function toInitialFileItems(initialFiles: Array<{ name: string; url: string; type: string }>): FileItem[] {
  return initialFiles
    .filter((f) => f.url)
    .map((f, i) => ({ id: `init-${i}`, file: null, extractFile: null, name: f.name, url: f.url, type: f.type }));
}

type ProcessingState = {
  phase: "preparing" | "attaching" | "extracting" | "done";
  title: string;
  detail: string;
  fileName?: string;
  current?: number;
  total?: number;
};

function extractionMessageForFile(file: File | null, fallbackName: string, lang: "ar" | "en" = "ar") {
  const name = file?.name || fallbackName;
  const type = (file?.type || "").toLowerCase();
  const heicLike = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(name);
  const en = lang === "en";
  if (heicLike) return en ? "Converting HEIC and processing the image, then reading the data" : "تحويل HEIC ومعالجة الصورة ثم قراءة البيانات";
  if (type.includes("pdf") || /\.pdf$/i.test(name)) return en ? "Reading the PDF and extracting supplier, tax, and line items" : "قراءة PDF واستخراج المورد والضريبة والبنود";
  if (type.startsWith("image/")) return en ? "Trimming edges and enhancing the image, then reading the data" : "قص الزوائد وتحسين الصورة ثم قراءة البيانات";
  return en ? "Analyzing the file and extracting the expense data" : "تحليل الملف واستخراج بيانات المصروف";
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

function base64ToFile(base64: string, fileName: string, mimeType: string): File {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new File([bytes], fileName, { type: mimeType });
}

export function DocumentPreviewPane({
  className = "",
  onFilesAdded,
  onExtract,
  showLatestOnly = true,
  accept = ".pdf,.png,.jpg,.jpeg,.heic,.webp,.docx,.xlsx,.csv",
  maxSizeMb = 25,
  initialFiles = [],
  hint,
  enableExtract = true,
  autoExtract = false,
}: DocumentPreviewProps) {
  const { t, language } = useLanguage();
  const [files, setFiles] = useState<FileItem[]>(() => toInitialFileItems(initialFiles));
  const [activeId, setActiveId] = useState<string | null>(initialFiles[0] ? `init-0` : null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState | null>(null);
  const [archiveOriginal, setArchiveOriginal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileItem[]>(files);

  const active = useMemo(() => {
    if (files.length === 0) return undefined;
    if (showLatestOnly) return files[files.length - 1];
    return files.find((f) => f.id === activeId) || files[0];
  }, [files, activeId, showLatestOnly]);
  const initialFilesSignature = useMemo(
    () => initialFiles.map((f) => `${f.name}\u001f${f.type}\u001f${f.url}`).join("\u001e"),
    [initialFiles],
  );

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const next = toInitialFileItems(initialFiles);
    setFiles((current) => {
      current.forEach((f) => { if (f.file && f.url.startsWith("blob:")) URL.revokeObjectURL(f.url); });
      return next;
    });
    setActiveId(next[0]?.id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilesSignature]);

  const addFiles = async (incoming: FileList | File[]) => {
    setError(null);
    const arr = Array.from(incoming);
    const tooBig = arr.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooBig) {
      setError(t("{name} أكبر من {max} ميجا", "{name} is larger than {max} MB").replace("{name}", tooBig.name).replace("{max}", String(maxSizeMb)));
      return;
    }

    setProcessing({
      phase: "preparing",
      title: t("Entix AI يجهز المرفقات", "Entix AI is preparing attachments"),
      detail: arr.length > 1
        ? t("جاري تجهيز {n} ملفات للقراءة", "Preparing {n} files for reading").replace("{n}", String(arr.length))
        : t("جاري تجهيز الصورة للقراءة", "Preparing the image for reading"),
      current: 0,
      total: arr.length,
    });

    const newItems: FileItem[] = [];
    try {
      for (let index = 0; index < arr.length; index++) {
        const f = arr[index];
        setProcessing({
          phase: "preparing",
          title: t("Entix AI يجهز المرفقات", "Entix AI is preparing attachments"),
          detail: extractionMessageForFile(f, f.name, language),
          fileName: f.name,
          current: index + 1,
          total: arr.length,
        });
        const prepared = await prepareFileForPreviewAndUpload(f, language);
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          extractFile: prepared.file,
          name: f.name,
          url: prepared.url,
          type: prepared.type,
          note: archiveOriginal
            ? t("المعاينة تستخدم نسخة JPG منظفة، لكن الأرشفة ستحفظ الملف الكامل كما رفعته.", "The preview uses a cleaned JPG copy, but archiving keeps the full file exactly as uploaded.")
            : prepared.note,
        });
      }
    } catch (e: any) {
      setError(e?.message || t("فشل تجهيز المرفقات", "Failed to prepare attachments"));
      setProcessing(null);
      return;
    }

    setFiles((prev) => [...prev, ...newItems]);
    setActiveId(newItems[newItems.length - 1].id);
    if (onFilesAdded) {
      try {
        setProcessing({
          phase: "attaching",
          title: t("جاري تثبيت المرفقات", "Saving attachments"),
          detail: t("نحفظ نسخة جاهزة من الملف قبل الاستخراج", "Saving a ready copy of the file before extraction"),
          current: newItems.length,
          total: newItems.length,
        });
        await onFilesAdded(newItems.map((item) => archiveOriginal ? item.file : (item.extractFile || item.file)).filter(Boolean) as File[]);
      } catch (e: any) {
        setError(e?.message || t("فشل حفظ المرفقات", "Failed to save attachments"));
        setProcessing(null);
        return;
      }
    }
    if (autoExtract && enableExtract && onExtract) {
      for (let index = 0; index < newItems.length; index++) {
        const item = newItems[index];
        setActiveId(item.id);
        await runExtract(item, { current: index + 1, total: newItems.length, keepDoneVisible: index === newItems.length - 1 });
      }
    } else {
      setProcessing(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const runExtract = async (item: FileItem, progress?: { current?: number; total?: number; keepDoneVisible?: boolean }) => {
    const source = item.extractFile || item.file;
    if (!source || !onExtract) return;
    setProcessing({
      phase: "extracting",
      title: t("Entix AI يقرأ المستند", "Entix AI is reading the document"),
      detail: extractionMessageForFile(source, item.name, language),
      fileName: item.name,
      current: progress?.current,
      total: progress?.total,
    });
    setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, extracting: true } : f));
    try {
      await onExtract(source);
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, extracting: false, extracted: true } : f));
      setProcessing({
        phase: "done",
        title: t("تمت القراءة والتعبئة", "Reading and filling complete"),
        detail: t("راجع البيانات قبل الحفظ", "Review the data before saving"),
        fileName: item.name,
        current: progress?.current,
        total: progress?.total,
      });
      window.setTimeout(() => setProcessing((current) => current?.phase === "done" ? null : current), progress?.keepDoneVisible ? 1400 : 450);
    } catch (e: any) {
      setError(e?.message || t("فشل الاستخراج", "Extraction failed"));
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, extracting: false } : f));
      setProcessing(null);
    }
  };

  const handleExtract = async () => {
    if (!active) return;
    await runExtract(active, { keepDoneVisible: true });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.file && removed.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      const next = prev.filter((f) => f.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || null);
      return next;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => { if (f.file && f.url.startsWith("blob:")) URL.revokeObjectURL(f.url); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`flex flex-col bg-white border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Empty state */}
      {files.length === 0 ? (
        <div
          className={`flex-1 flex flex-col items-center justify-center min-h-[280px] m-3 rounded-lg border-2 border-dashed transition ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <Upload className="h-10 w-10 text-muted-foreground/60 mb-3" />
          <p className="text-sm text-foreground font-medium">{hint || t("اسحب ملف الفاتورة أو المستند هنا", "Drag the invoice or document file here")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t("PDF · JPG · PNG · HEIC · صور من الجوال · حتى {max}MB", "PDF · JPG · PNG · HEIC · phone photos · up to {max}MB").replace("{max}", String(maxSizeMb))}</p>
          <div className="mt-3 inline-flex rounded-lg border border-border bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setArchiveOriginal(false)}
              className={`rounded-md px-2.5 py-1.5 transition ${!archiveOriginal ? "bg-foreground text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {t("أرشفة ممسوحة", "Clean archive")}
            </button>
            <button
              type="button"
              onClick={() => setArchiveOriginal(true)}
              className={`rounded-md px-2.5 py-1.5 transition ${archiveOriginal ? "bg-foreground text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {t("حفظ كامل", "Keep original")}
            </button>
          </div>
          <input ref={fileRef} type="file" hidden multiple accept={accept}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <Button onClick={() => fileRef.current?.click()} variant="outline" className="mt-4 border-border">
            <Upload className="h-4 w-4 me-2" /> {t("اختر ملفاً", "Choose a file")}
          </Button>
          {processing && (
            <div className="mt-4 w-full max-w-sm px-3">
              <ProcessingBanner state={processing} compact />
            </div>
          )}
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between p-2 border-b border-border/50 bg-muted">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <Images className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">{active?.name || "—"}</span>
              {files.length > 1 && <span className="text-muted-foreground/60 font-english">({files.length})</span>}
              {active?.extracted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setArchiveOriginal((value) => !value)}
                className={`h-7 rounded-md border px-2 text-[11px] transition ${archiveOriginal ? "border-foreground bg-foreground text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}
                title={t("يؤثر على الملفات الجديدة التي ترفعها بعد تغيير الخيار", "Applies to new files you upload after changing this option")}
              >
                {archiveOriginal ? t("حفظ كامل", "Keep original") : t("أرشفة ممسوحة", "Clean archive")}
              </button>
              {enableExtract && active?.file && onExtract && (
                <Button onClick={handleExtract} disabled={active.extracting}
                  size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs h-7 px-2">
                  {active.extracting ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Sparkles className="h-3 w-3 me-1" />}
                  {active.extracting ? t("جاري الاستخراج", "Extracting") : active.extracted ? t("تم الاستخراج", "Extracted") : t("استخراج البيانات", "Extract data")}
                </Button>
              )}
              <input ref={fileRef} type="file" hidden multiple accept={accept}
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} className="p-1.5 text-primary hover:bg-blue-50 rounded" title={t("إضافة ملف", "Add file")}>
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </div>
          {processing && (
            <div className="border-b border-primary/20 bg-white px-2 py-2">
              <ProcessingBanner state={processing} />
            </div>
          )}

          {/* Main preview */}
          <div className="relative flex-1 min-h-[400px] bg-muted flex items-center justify-center p-2">
            {active && renderPreview(active, t)}
            {active?.extracting && (
              <div className="absolute inset-2 flex items-center justify-center rounded-lg bg-white/82 backdrop-blur-sm">
                <div className="w-full max-w-xs">
                  <ProcessingBanner state={processing || {
                    phase: "extracting",
                    title: t("Entix AI يقرأ المستند", "Entix AI is reading the document"),
                    detail: extractionMessageForFile(active.extractFile || active.file, active.name, language),
                    fileName: active.name,
                  }} />
                </div>
              </div>
            )}
          </div>
          {active?.note && (
            <div className="px-3 py-2 bg-primary/5 border-t border-primary/20 text-xs text-primary flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{active.note}</span>
            </div>
          )}

          {/* Thumbnails strip */}
          {!showLatestOnly && files.length > 1 && (
            <div className="flex gap-2 p-2 border-t border-border/50 overflow-x-auto bg-white">
              {files.map((f) => (
                <button key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`flex-shrink-0 relative group ${f.id === activeId ? "ring-2 ring-ring" : "ring-1 ring-border"} rounded p-2 hover:bg-muted`}
                >
                  <div className="w-12 h-14 flex items-center justify-center text-muted-foreground">
                    {f.extracted ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : f.type.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <div className="text-[10px] text-muted-foreground truncate w-12 mt-1">{f.name}</div>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">{error}</div>
          )}
        </>
      )}
    </div>
  );
}

function ProcessingBanner({ state, compact = false }: { state: ProcessingState; compact?: boolean }) {
  const { t } = useLanguage();
  const total = state.total || 0;
  const current = state.current || 0;
  const percent = total > 0 ? Math.max(8, Math.min(100, Math.round((current / total) * 100))) : 62;
  const done = state.phase === "done";
  return (
    <div className={`rounded-lg border ${done ? "border-emerald-200 bg-emerald-50" : "border-primary/20 bg-primary/5"} ${compact ? "px-3 py-2" : "px-3 py-3"} shadow-sm`}>
      <div className="flex items-start gap-2">
        <div className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100" : "bg-foreground"}`}>
          {done ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-white" />
              <span className="absolute inset-0 rounded-full border border-primary/40 animate-ping" />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${done ? "text-emerald-800" : "text-foreground"}`}>{state.title}</p>
            {!done && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{state.detail}</p>
          {state.fileName && <p className="mt-1 truncate font-english text-[11px] text-muted-foreground">{state.fileName}</p>}
          {!compact && !done && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
              </div>
              {total > 1 && <span className="font-english text-[11px] text-muted-foreground">{current}/{total}</span>}
            </div>
          )}
          {!compact && !done && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-primary">
              <span className="rounded bg-white px-2 py-1 text-center">{t("تهيئة", "Preparing")}</span>
              <span className="rounded bg-white px-2 py-1 text-center">OCR</span>
              <span className="rounded bg-white px-2 py-1 text-center">{t("تعبئة", "Filling")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderPreview(item: FileItem, t: (ar: string, en: string) => string) {
  const mime = item.type.toLowerCase();
  const heicLike = mime.includes("heic") || mime.includes("heif") || /\.(heic|heif)$/i.test(item.name);
  if (mime.includes("pdf")) {
    return (
      <iframe
        src={`${item.url}#toolbar=0&view=FitH`}
        className="w-full h-full bg-white rounded shadow-sm"
        style={{ minHeight: 400 }}
        title={item.name}
      />
    );
  }
  if (mime.startsWith("image/")) {
    if (heicLike) {
      return (
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <p className="text-sm text-foreground font-medium mb-2">{item.name}</p>
          <p className="text-xs text-muted-foreground leading-5">
            {t("صيغة HEIC من الآيفون لا تظهر دائماً داخل المتصفح، لكنها تُرسل للسيرفر للتحويل إلى JPG قبل الاستخراج.", "iPhone HEIC format does not always display in the browser, but it is sent to the server for conversion to JPG before extraction.")}
          </p>
        </div>
      );
    }
    return (
      <img
        src={item.url}
        alt={item.name}
        className="max-w-full max-h-[600px] object-contain rounded shadow-sm bg-white"
      />
    );
  }
  // Default: download link
  return (
    <div className="text-center p-8">
      <FileText className="h-16 w-16 text-muted-foreground/60 mx-auto mb-3" />
      <p className="text-sm text-foreground font-medium mb-2">{item.name}</p>
      <a href={item.url} download={item.name} className="text-primary text-sm hover:underline inline-flex items-center gap-1">
        <Eye className="h-3 w-3" /> {t("فتح", "Open")}
      </a>
    </div>
  );
}

function guessType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (["png", "webp", "heic", "heif", "gif"].includes(ext)) return `image/${ext}`;
  if (ext === "pdf") return "application/pdf";
  if (["docx", "doc"].includes(ext)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (["xlsx", "xls", "csv"].includes(ext)) return "application/vnd.ms-excel";
  return "application/octet-stream";
}

async function prepareFileForPreviewAndUpload(file: File, lang: "ar" | "en" = "ar"): Promise<{ file: File; url: string; type: string; note?: string }> {
  const en = lang === "en";
  const type = file.type || guessType(file.name);
  const heicLike = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(file.name);

  if (heicLike) {
    try {
      const normalized = await api.agent.normalizeImage({
        fileBase64: await fileToBase64(file),
        fileName: file.name,
        mimeType: type,
        trimEdges: true,
      });
      const converted = base64ToFile(normalized.fileBase64, normalized.fileName || toJpegName(file.name), normalized.mimeType || "image/jpeg");
      return {
        file: converted,
        url: URL.createObjectURL(converted),
        type: converted.type,
        note: en ? "HEIC converted to a cleaned JPG for preview and archiving." : "تم تحويل HEIC إلى JPG ممسوح ومنظف للمعاينة والأرشفة.",
      };
    } catch {
      return {
        file,
        url: URL.createObjectURL(file),
        type,
        note: en ? "Could not convert HEIC for preview now; the server will try to read it during extraction." : "تعذر تحويل HEIC للمعاينة الآن، وسيحاول السيرفر قراءته عند الاستخراج.",
      };
    }
  }

  if (!type.startsWith("image/") || type.includes("gif")) {
    return {
      file,
      url: URL.createObjectURL(file),
      type,
      note: undefined,
    };
  }

  try {
    const sourceUrl = URL.createObjectURL(file);
    const image = await loadImage(sourceUrl);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth || image.width;
    sourceCanvas.height = image.naturalHeight || image.height;
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) throw new Error("canvas_unavailable");
    sourceCtx.drawImage(image, 0, 0);

    const crop = detectContentBounds(sourceCtx, sourceCanvas.width, sourceCanvas.height);
    const croppedWidth = crop.right - crop.left + 1;
    const croppedHeight = crop.bottom - crop.top + 1;
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(croppedWidth, croppedHeight));
    const outCanvas = document.createElement("canvas");
    outCanvas.width = Math.max(1, Math.round(croppedWidth * scale));
    outCanvas.height = Math.max(1, Math.round(croppedHeight * scale));
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) throw new Error("canvas_unavailable");
    outCtx.fillStyle = "#fff";
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.drawImage(
      sourceCanvas,
      crop.left,
      crop.top,
      croppedWidth,
      croppedHeight,
      0,
      0,
      outCanvas.width,
      outCanvas.height,
    );
    URL.revokeObjectURL(sourceUrl);

    const blob = await canvasToBlob(outCanvas, "image/jpeg", 0.84);
    const converted = new File([blob], toJpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
    return {
      file: converted,
      url: URL.createObjectURL(converted),
      type: converted.type,
      note: en ? "Image prepared before extraction: trimmed visible edges, reduced size, converted to JPG." : "تم تجهيز الصورة قبل الاستخراج: قص الزوائد الواضحة، تصغير الحجم، وتحويلها إلى JPG.",
    };
  } catch {
    return {
      file,
      url: URL.createObjectURL(file),
      type,
      note: en ? "Could not prepare the image in the browser; the server will process it as-is." : "تعذر تجهيز الصورة في المتصفح، وسيحاول السيرفر معالجتها كما هي.",
    };
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas_blob_failed")), type, quality);
  });
}

function detectContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sample = ctx.getImageData(0, 0, width, height).data;
  const bg = [sample[0] || 255, sample[1] || 255, sample[2] || 255];
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 900));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const alpha = sample[idx + 3];
      const diff = Math.abs(sample[idx] - bg[0]) + Math.abs(sample[idx + 1] - bg[1]) + Math.abs(sample[idx + 2] - bg[2]);
      if (alpha > 20 && diff > 55) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (left >= right || top >= bottom) return { left: 0, top: 0, right: width - 1, bottom: height - 1 };

  const pad = Math.round(Math.min(width, height) * 0.015);
  const croppedArea = (right - left) * (bottom - top);
  const fullArea = width * height;
  if (croppedArea < fullArea * 0.2 || croppedArea > fullArea * 0.98) {
    return { left: 0, top: 0, right: width - 1, bottom: height - 1 };
  }
  return {
    left: Math.max(0, left - pad),
    top: Math.max(0, top - pad),
    right: Math.min(width - 1, right + pad),
    bottom: Math.min(height - 1, bottom + pad),
  };
}

function toJpegName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}
