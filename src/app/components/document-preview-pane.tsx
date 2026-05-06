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
import { Upload, Sparkles, X, FileText, Image as ImageIcon, Loader2, Eye } from "lucide-react";
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
}

interface FileItem {
  id: string;
  file: File | null; // null for initial files (already uploaded)
  name: string;
  url: string;
  type: string;
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
}: DocumentPreviewProps) {
  const [files, setFiles] = useState<FileItem[]>(
    initialFiles.map((f, i) => ({ id: `init-${i}`, file: null, name: f.name, url: f.url, type: f.type })),
  );
  const [activeId, setActiveId] = useState<string | null>(initialFiles[0] ? `init-0` : null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = files.find((f) => f.id === activeId);

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
        const url = URL.createObjectURL(f);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          name: f.name,
          url,
          type: f.type || guessType(f.name),
        };
      }),
    );
    setFiles((prev) => [...prev, ...newItems]);
    setActiveId(newItems[newItems.length - 1].id);
    if (onFilesAdded) onFilesAdded(arr);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleExtract = async () => {
    if (!active || !active.file || !onExtract) return;
    setFiles((prev) => prev.map((f) => f.id === active.id ? { ...f, extracting: true } : f));
    try {
      await onExtract(active.file);
      setFiles((prev) => prev.map((f) => f.id === active.id ? { ...f, extracting: false, extracted: true } : f));
    } catch (e: any) {
      setError(e?.message || "فشل الاستخراج");
      setFiles((prev) => prev.map((f) => f.id === active.id ? { ...f, extracting: false } : f));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.url);
      const next = prev.filter((f) => f.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || null);
      return next;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => { if (f.file) URL.revokeObjectURL(f.url); });
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
          <p className="text-xs text-[#9CA3AF] mt-1">PDF · صور · Excel · حتى {maxSizeMb}MB</p>
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
              <FileText className="h-4 w-4 text-[#1276E3] flex-shrink-0" />
              <span className="truncate">{active?.name || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {enableExtract && active?.file && onExtract && (
                <Button onClick={handleExtract} disabled={active.extracting}
                  size="sm" className="bg-[#1276E3] hover:bg-[#1060C0] text-white text-xs h-7 px-2">
                  {active.extracting ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Sparkles className="h-3 w-3 me-1" />}
                  {active.extracted ? "أُستخرج ✓" : "تعبئة بالذكاء"}
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

          {/* Thumbnails strip */}
          {files.length > 1 && (
            <div className="flex gap-2 p-2 border-t border-[#F3F4F6] overflow-x-auto bg-white">
              {files.map((f) => (
                <button key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`flex-shrink-0 relative group ${f.id === activeId ? "ring-2 ring-[#1276E3]" : "ring-1 ring-[#E5E7EB]"} rounded p-2 hover:bg-[#F9FAFB]`}
                >
                  <div className="w-12 h-14 flex items-center justify-center text-[#6B7280]">
                    {f.type.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
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
  if (["png", "jpg", "jpeg", "webp", "heic", "gif"].includes(ext)) return `image/${ext}`;
  if (ext === "pdf") return "application/pdf";
  if (["docx", "doc"].includes(ext)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (["xlsx", "xls", "csv"].includes(ext)) return "application/vnd.ms-excel";
  return "application/octet-stream";
}
