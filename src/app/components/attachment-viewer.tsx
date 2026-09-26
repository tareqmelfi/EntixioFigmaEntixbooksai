import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./LanguageContext";
import { FileImage, Download, ExternalLink, Maximize2, Minimize2, ScanLine } from "lucide-react";

/**
 * AttachmentViewer · renders one stored attachment safely.
 *
 * Why blob URLs: Chrome blocks `data:` URLs in iframes (PDF preview showed a
 * broken-plugin icon). Converting base64 → Blob → object URL lets Chrome's
 * native PDF viewer render + scroll inside the iframe.
 *
 * PDFs start with the whole page visible and no thumbnail sidebar.
 * The fullscreen view keeps the browser controls and Escape-to-exit behavior.
 */

export type ViewerAttachment = {
  name: string;
  type: string; // contentType / mime
  base64?: string; // raw base64 (no data: prefix) — legacy expense fields
  url?: string; // data: URL or remote URL — attachment rows / receiptUrl
};

function base64ToBlobUrl(base64: string, type: string): string | null {
  try {
    const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
  } catch {
    return null;
  }
}

export function AttachmentViewer({ attachment, height = 620 }: { attachment: ViewerAttachment; height?: number | string }) {
  const { t } = useLanguage();
  const viewerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [fitWidth, setFitWidth] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = async () => {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === viewerRef.current) await document.exitFullscreen();
      else if (viewerRef.current?.requestFullscreen) await viewerRef.current.requestFullscreen();
      else setFullscreenError(true);
    } catch {
      setFullscreenError(true);
    }
  };
  const type = (attachment.type || "application/octet-stream").toLowerCase();
  const isHeic = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(attachment.name);
  const isPdf = type.includes("pdf") || /\.pdf$/i.test(attachment.name);
  const isImage = type.startsWith("image/") && !isHeic;

  // Resolve to a display URL: prefer blob conversion for base64/data:, else the url as-is
  const src = useMemo(() => {
    if (attachment.base64) return base64ToBlobUrl(attachment.base64, isPdf ? "application/pdf" : attachment.type);
    if (attachment.url?.startsWith("data:")) {
      const comma = attachment.url.indexOf(",");
      const mime = attachment.url.slice(5, attachment.url.indexOf(";")) || attachment.type;
      return base64ToBlobUrl(attachment.url.slice(comma + 1), isPdf ? "application/pdf" : mime);
    }
    return attachment.url || null;
  }, [attachment.base64, attachment.url, attachment.type, isPdf]);

  // Revoke blob URLs to avoid leaks
  useEffect(() => {
    return () => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted text-center" style={{ minHeight: typeof height === "number" ? height / 2 : 240 }}>
        <FileImage className="mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{t("تعذّر تجهيز المرفق للعرض", "Could not prepare the attachment for preview")}</p>
      </div>
    );
  }

  if (isPdf || isImage) {
    const actionClass = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary";
    return (
      <div ref={viewerRef} data-testid="attachment-viewer" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/50 bg-card" style={{ height: fullscreen ? "100%" : height }}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 bg-card p-2">
          <button type="button" className={actionClass} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {fullscreen ? t("إنهاء ملء الشاشة", "Exit full screen") : t("ملء الشاشة", "Full screen")}
          </button>
          {isPdf && <button type="button" className={actionClass} onClick={() => setFitWidth(value => !value)}>
            <ScanLine className="h-4 w-4" />
            {fitWidth ? t("عرض الصفحة كاملة", "Show whole page") : t("تكبير لعرض المستند", "Fit document width")}
          </button>}
          <a href={src} target="_blank" rel="noopener noreferrer" className={actionClass}>
            <ExternalLink className="h-4 w-4" />{t("فتح في تبويب جديد", "Open in new tab")}
          </a>
          <a href={src} download={attachment.name} className={actionClass}>
            <Download className="h-4 w-4" />{t("تنزيل", "Download")}
          </a>
          {fullscreenError && <p role="status" className="w-full text-xs text-muted-foreground">{t("المتصفح لا يدعم ملء الشاشة هنا. افتح الملف في تبويب جديد لعرضه كاملاً.", "Full screen is unavailable here. Open the file in a new tab to view it in full.")}</p>}
        </div>
        {isPdf ? (
          <iframe
            title={attachment.name}
            src={`${src.split("#")[0]}#navpanes=0&view=${fitWidth ? "FitH" : "Fit"}`}
            className="min-h-0 w-full flex-1 border-0 bg-card"
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <img src={src} alt={attachment.name} className="mx-auto block h-auto w-full" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted text-center" style={{ minHeight: typeof height === "number" ? height / 2 : 240 }}>
      <FileImage className="mb-3 h-10 w-10 text-primary" />
      <p className="font-english text-sm text-foreground" dir="ltr">{attachment.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("هذه الصيغة لا تظهر مباشرة داخل المتصفح", "This format cannot be previewed in the browser")}</p>
      <a
        href={src}
        download={attachment.name}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
      >
        <Download className="h-3.5 w-3.5" /> تنزيل الملف
      </a>
    </div>
  );
}
