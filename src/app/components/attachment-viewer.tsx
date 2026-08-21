import { useEffect, useMemo } from "react";
import { useLanguage } from "./LanguageContext";
import { FileImage, Download } from "lucide-react";

/**
 * AttachmentViewer · renders one stored attachment safely.
 *
 * Why blob URLs: Chrome blocks `data:` URLs in iframes (PDF preview showed a
 * broken-plugin icon). Converting base64 → Blob → object URL lets Chrome's
 * native PDF viewer render + scroll inside the iframe.
 *
 * Images render at natural size inside a scrollable box (up/down + sideways),
 * PDFs get the native viewer (scroll built in), anything else gets a download.
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

export function AttachmentViewer({ attachment, height = 620 }: { attachment: ViewerAttachment; height?: number }) {
  const { t } = useLanguage();
  const type = (attachment.type || "application/octet-stream").toLowerCase();
  const isHeic = type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(attachment.name);
  const isPdf = type.includes("pdf") || /\.pdf$/i.test(attachment.name);
  const isImage = type.startsWith("image/") && !isHeic;

  // Resolve to a display URL: prefer blob conversion for base64/data:, else the url as-is
  const src = useMemo(() => {
    if (attachment.base64) return base64ToBlobUrl(attachment.base64, attachment.type);
    if (attachment.url?.startsWith("data:")) {
      const comma = attachment.url.indexOf(",");
      const mime = attachment.url.slice(5, attachment.url.indexOf(";")) || attachment.type;
      return base64ToBlobUrl(attachment.url.slice(comma + 1), mime);
    }
    return attachment.url || null;
  }, [attachment.base64, attachment.url, attachment.type]);

  // Revoke blob URLs to avoid leaks
  useEffect(() => {
    return () => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted text-center" style={{ minHeight: height / 2 }}>
        <FileImage className="mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{t("تعذّر تجهيز المرفق للعرض", "Could not prepare the attachment for preview")}</p>
      </div>
    );
  }

  if (isPdf) {
    return (
      <iframe
        title={attachment.name}
        src={src}
        className="w-full rounded-lg bg-white border border-border/50"
        style={{ height }}
      />
    );
  }

  if (isImage) {
    // Natural-size image inside a scrollable box · scroll up/down + sideways freely
    return (
      <div className="w-full overflow-auto rounded-lg bg-white border border-border/50" style={{ maxHeight: height }}>
        <img src={src} alt={attachment.name} className="max-w-none w-full h-auto block" style={{ minWidth: "100%" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted text-center" style={{ minHeight: height / 2 }}>
      <FileImage className="mb-3 h-10 w-10 text-primary" />
      <p className="font-english text-sm text-foreground" dir="ltr">{attachment.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("هذه الصيغة لا تظهر مباشرة داخل المتصفح", "This format cannot be previewed in the browser")}</p>
      <a
        href={src}
        download={attachment.name}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90"
      >
        <Download className="h-3.5 w-3.5" /> تنزيل الملف
      </a>
    </div>
  );
}
