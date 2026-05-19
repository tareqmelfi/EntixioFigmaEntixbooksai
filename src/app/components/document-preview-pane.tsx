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
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Images, Upload, Sparkles, X, FileText, Image as ImageIcon, Loader2, Eye } from "lucide-react";
import { Button } from "./ui/button";

export interface DocumentPreviewProps {
  className?: string;
  onFilesAdded?: (files: File[]) => void;
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

export function DocumentPreviewPane({
  className = "",
  onFilesAdded,
  onExtract,
  showLatestOnly = true,
  accept = ".pdf,.png,.jpg,.jpeg,.heic,.webp,.docx,.xlsx,.csv",
  maxSizeMb = 25,
  initialFiles = [],
  hint = "اسحب ملف الفاتورة أو المستند هنا",
  enableExtract = true,
  autoExtract = false,
}: DocumentPreviewProps) {
  const [files, setFiles] = useState<FileItem[]>(
    initialFiles.map((f, i) => ({ id: `init-${i}`, file: null, extractFile: null, name: f.name, url: f.url, type: f.type })),
  );
  const [activeId, setActiveId] = useState<string | null>(initialFiles[0] ? `init-0` : null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileItem[]>(files);

  const active = files.find((f) => f.id === activeId);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const addFiles = async (incoming: FileList | File[]) => {
    setError(null);
    const arr = Array.from(incoming);
    const tooBig = arr.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} أكبر من ${maxSizeMb} ميجا`);
      return;
    }
    const newItems: FileItem[] = await Promise.all(
      arr.map(async (f) => {
        const prepared = await prepareFileForPreviewAndUpload(f);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          extractFile: prepared.file,
          name: f.name,
          url: prepared.url,
          type: prepared.type,
          note: prepared.note,
        };
      }),
    );
    setFiles((prev) => [...prev, ...newItems]);
    setActiveId(newItems[newItems.length - 1].id);
    if (onFilesAdded) onFilesAdded(newItems.map((item) => item.extractFile || item.file).filter(Boolean) as File[]);
    if (autoExtract && enableExtract && onExtract) {
      for (const item of newItems) {
        await runExtract(item);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const runExtract = async (item: FileItem) => {
    const source = item.extractFile || item.file;
    if (!source || !onExtract) return;
    setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, extracting: true } : f));
    try {
      await onExtract(source);
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, extracting: false, extracted: true } : f));
    } catch (e: any) {
      setError(e?.message || "فشل الاستخراج");
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, extracting: false } : f));
    }
  };

  const handleExtract = async () => {
    if (!active) return;
    await runExtract(active);
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
    <div className={`flex flex-col bg-white border border-[#E5E7EB] rounded-lg overflow-hidden ${className}`}>
      {/* Empty state */}
      {files.length === 0 ? (
        <div
          className={`flex-1 flex flex-col items-center justify-center min-h-[280px] m-3 rounded-lg border-2 border-dashed transition ${dragOver ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB]"}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <Upload className="h-10 w-10 text-[#9CA3AF] mb-3" />
          <p className="text-sm text-[#0B1B49] font-medium">{hint}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">PDF · JPG · PNG · HEIC · صور من الجوال · حتى {maxSizeMb}MB</p>
          <input ref={fileRef} type="file" hidden multiple accept={accept}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <Button onClick={() => fileRef.current?.click()} variant="outline" className="mt-4 border-[#E5E7EB]">
            <Upload className="h-4 w-4 me-2" /> اختر ملفاً
          </Button>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between p-2 border-b border-[#F3F4F6] bg-[#F9FAFB]">
            <div className="flex items-center gap-2 text-xs text-[#6B7280] truncate">
              <Images className="h-4 w-4 text-[#1276E3] flex-shrink-0" />
              <span className="truncate">{active?.name || "—"}</span>
              {files.length > 1 && <span className="text-[#9CA3AF] font-english">({files.length})</span>}
              {active?.extracted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5">
              {enableExtract && active?.file && onExtract && (
                <Button onClick={handleExtract} disabled={active.extracting}
                  size="sm" className="bg-[#1276E3] hover:bg-[#1060C0] text-white text-xs h-7 px-2">
                  {active.extracting ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Sparkles className="h-3 w-3 me-1" />}
                  {active.extracting ? "جاري الاستخراج" : active.extracted ? "تم الاستخراج" : "استخراج البيانات"}
                </Button>
              )}
              <input ref={fileRef} type="file" hidden multiple accept={accept}
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} className="p-1.5 text-[#1276E3] hover:bg-blue-50 rounded" title="إضافة ملف">
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Main preview */}
          <div className="flex-1 min-h-[400px] bg-[#F4F5F7] flex items-center justify-center p-2">
            {active && renderPreview(active)}
          </div>
          {active?.note && (
            <div className="px-3 py-2 bg-[#F4FCFF] border-t border-[#D7F0FF] text-xs text-[#0B5CAD] flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{active.note}</span>
            </div>
          )}

          {/* Thumbnails strip */}
          {files.length > 1 && (
            <div className="flex gap-2 p-2 border-t border-[#F3F4F6] overflow-x-auto bg-white">
              {files.map((f) => (
                <button key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`flex-shrink-0 relative group ${f.id === activeId ? "ring-2 ring-[#1276E3]" : "ring-1 ring-[#E5E7EB]"} rounded p-2 hover:bg-[#F9FAFB]`}
                >
                  <div className="w-12 h-14 flex items-center justify-center text-[#6B7280]">
                    {f.extracted ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : f.type.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <div className="text-[10px] text-[#6B7280] truncate w-12 mt-1">{f.name}</div>
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

function renderPreview(item: FileItem) {
  const t = item.type.toLowerCase();
  const heicLike = t.includes("heic") || t.includes("heif") || /\.(heic|heif)$/i.test(item.name);
  if (t.includes("pdf")) {
    return (
      <iframe
        src={`${item.url}#toolbar=0&view=FitH`}
        className="w-full h-full bg-white rounded shadow-sm"
        style={{ minHeight: 400 }}
        title={item.name}
      />
    );
  }
  if (t.startsWith("image/")) {
    if (heicLike) {
      return (
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <p className="text-sm text-[#0B1B49] font-medium mb-2">{item.name}</p>
          <p className="text-xs text-[#6B7280] leading-5">
            صيغة HEIC من الآيفون لا تظهر دائماً داخل المتصفح، لكنها تُرسل للسيرفر للتحويل إلى JPG قبل الاستخراج.
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
      <FileText className="h-16 w-16 text-[#9CA3AF] mx-auto mb-3" />
      <p className="text-sm text-[#0B1B49] font-medium mb-2">{item.name}</p>
      <a href={item.url} download={item.name} className="text-[#1276E3] text-sm hover:underline inline-flex items-center gap-1">
        <Eye className="h-3 w-3" /> فتح
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

async function prepareFileForPreviewAndUpload(file: File): Promise<{ file: File; url: string; type: string; note?: string }> {
  const type = file.type || guessType(file.name);
  const heicLike = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(file.name);

  if (!type.startsWith("image/") || heicLike || type.includes("gif")) {
    return {
      file,
      url: URL.createObjectURL(file),
      type,
      note: heicLike ? "سيتم تحويل HEIC في السيرفر قبل الاستخراج، لذلك لن تظهر المعاينة كاملة داخل المتصفح." : undefined,
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
      note: "تم تجهيز الصورة قبل الاستخراج: قص الزوائد الواضحة، تصغير الحجم، وتحويلها إلى JPG.",
    };
  } catch {
    return {
      file,
      url: URL.createObjectURL(file),
      type,
      note: "تعذر تجهيز الصورة في المتصفح، وسيحاول السيرفر معالجتها كما هي.",
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
