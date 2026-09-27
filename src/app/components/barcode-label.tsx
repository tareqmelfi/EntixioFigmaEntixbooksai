import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { useLanguage } from "./LanguageContext";

/** Code 128 labels encode the saved code exactly; they do not claim a GS1 allocation. */
export function BarcodeLabel({ code }: { code: string }) {
  const { t } = useLanguage();
  const svg = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    try { JsBarcode(svg.current!, code, { format: "CODE128", width: 2, height: 64, margin: 16, fontSize: 16, background: "#ffffff", lineColor: "#000000" }); setError(false); }
    catch { setError(true); }
  }, [code]);
  const download = () => {
    if (!svg.current || error) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg.current)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `barcode-${code.replace(/[^a-z0-9-]/gi, "_")}.svg`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="min-w-0 space-y-2">
    <div className="overflow-x-auto" dir="ltr"><svg ref={svg} role="img" aria-label={t(`باركود ${code}`, `Barcode ${code}`)} className={error ? "hidden" : "max-w-none"} /></div>
    {error ? <p className="text-xs text-muted-foreground">{t("هذا الكود غير قابل للإخراج بصيغة Code 128. استخدم أحرفًا إنجليزية أو أرقامًا.", "This code cannot be rendered as Code 128. Use Latin letters or digits.")}</p> : <button type="button" onClick={download} className="text-sm text-primary underline">{t("تنزيل الباركود للطباعة (SVG)", "Download barcode for printing (SVG)")}</button>}
  </div>;
}
