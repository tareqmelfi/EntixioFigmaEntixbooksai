import { useEffect, useState } from "react";
import { Download, ExternalLink, FileDown, ShieldCheck } from "lucide-react";
import { FATOORA_DEVICE_PORTAL, renderDeviceProofDocument } from "../lib/zatca-proof-document";
import { Button } from "./ui/button";
import { useLanguage } from "./LanguageContext";
import { invalidateZatcaStatus, type ZatcaStatus } from "../lib/use-zatca-status";

export function ZatcaDeviceProof({ status }: { status: ZatcaStatus }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; orgId: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const proof = status.raw?.deviceProof;
  if (!proof || !proof.certificate) return <p className="text-sm text-muted-foreground">{t("جارٍ التحقق من سجل شهادة الجهاز…", "Checking the device certificate record…")}</p>;
  const cert = proof.certificate;
  const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" });
  const title = proof.deviceLinked ? t("تم ربط جهاز المنشأة في بيئة الإنتاج", "Organization device onboarded in production") : t("سجل شهادة الجهاز · يحتاج مراجعة", "Device certificate record · review required");
  const rows = [
    [t("المنشأة", "Organization"), proof.companyName],
    [t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—"],
    [t("الجهاز", "Device"), cert.deviceName || "—"],
    [t("تاريخ إصدار الشهادة", "Certificate issued"), date(cert.issuedAt)],
    [t("صالحة حتى", "Valid until"), date(cert.expiresAt)],
    [t("فحوصات قبول الجهاز", "Device compliance checks"), `${proof.complianceChecksPassed} / 6`],
  ];
  const note = t("ملخص من Entix مستند إلى شهادة الجهاز المحفوظة. لا يُعد شهادة اعتماد للبرنامج أو إثباتًا لقبول الفواتير أو التسجيل الضريبي.", "An Entix summary based on the stored device certificate. It is not software accreditation, invoice acceptance evidence, or VAT registration proof.");
  const download = async (format: "png" | "pdf") => {
    setBusy(true); setError("");
    try {
      const canvas = await renderDeviceProofDocument(proof, t);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("image_failed")), "image/png"));
      const filename = `Entix-ZATCA-${proof.vatNumber || proof.orgId}`;
      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        pdf.setProperties({ title: `Entix | ${proof.companyName}`, subject: "Device onboarding record", creator: "Entix" });
        pdf.addImage(canvas, "PNG", 0, 0, 297, 210);
        pdf.save(`${filename}.pdf`);
      }
      const url = URL.createObjectURL(blob);
      if (format === "png") {
        const a = document.createElement("a"); a.href = url; a.download = `${filename}.png`; a.click();
      }
      setPreview({ url, orgId: proof.orgId });
    } catch { setError(t("تعذر تنزيل الملخص؛ أعد المحاولة.", "Unable to download the record. Please retry.")); }
    finally { setBusy(false); }
  };
  return <section className={`space-y-4 rounded-xl border p-5 ${proof.deviceLinked ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50"}`} aria-label={t("سجل ربط جهاز المنشأة", "Organization device onboarding record")}>
    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0" /><h3 className="font-semibold">{title}</h3></div>
    <dl className="grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold"><bdi>{value}</bdi></dd></div>)}</dl>
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("إرسال الفواتير غير مفعّل بعد. يظهر قبول الفاتورة عند استلام رد الهيئة على فاتورة فعلية.", "Invoice submission is not active yet. Invoice acceptance requires an authority response to an actual invoice.")}</p>
    <p className="text-xs text-muted-foreground">{note}</p>
    <p className="text-xs text-muted-foreground">{t("يمكنك الدخول من جهاز آخر بالحساب المخوّل نفسه. مفاتيح الربط محفوظة على الخادم ولا تظهر في هذا الملخص.", "Use the same authorized account on another device. Linking keys remain on the server and are excluded from this record.")}</p>
    <p className="text-xs text-muted-foreground">{t("نتحقق من الشهادة المحفوظة كل دقيقة. إلغاء الشهادة يُراجع في بوابة فاتورة؛ هذا المؤشر لا يستعلم عن الإلغاء مباشرة من الهيئة.", "Stored certificate checks refresh every minute. Review revocation in Fatoora; this indicator does not query authority revocation status directly.")}</p>
    <p className="text-xs text-muted-foreground">{t("آخر تحقق", "Last checked")}: <bdi>{new Date(proof.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}</bdi> · {t("بتوقيت الرياض", "Riyadh time")}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy || status.loading || !proof.deviceLinked} onClick={() => download("png")}><Download className="me-2 h-4 w-4" />{t("تنزيل ملخص الربط كصورة", "Download onboarding record")}</Button><Button variant="outline" size="sm" disabled={busy || status.loading || !proof.deviceLinked} onClick={() => download("pdf")}><FileDown className="me-2 h-4 w-4" />{t("تنزيل PDF · A4 أفقي", "Download PDF · A4 landscape")}</Button><Button variant="outline" size="sm" onClick={invalidateZatcaStatus}>{t("تحديث الحالة", "Refresh status")}</Button><a className="inline-flex items-center gap-1 text-sm text-primary underline" href={FATOORA_DEVICE_PORTAL} target="_blank" rel="noopener noreferrer">{t("مراجعة الجهاز في بوابة فاتورة", "Review device in Fatoora")}<ExternalLink className="h-3 w-3" /></a></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview?.orgId === proof.orgId && <img src={preview.url} alt={t("معاينة ملخص ربط جهاز المنشأة", "Organization device onboarding record preview")} className="w-full max-w-5xl rounded-lg border border-border" />}
  </section>;
}
