import { useState } from "react";
import { Download, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "./LanguageContext";
import { invalidateZatcaStatus, type ZatcaStatus } from "../lib/use-zatca-status";

export function ZatcaDeviceProof({ status }: { status: ZatcaStatus }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const download = async () => {
    setBusy(true); setError("");
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 1600;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas_unavailable");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1600, 1600);
      ctx.fillStyle = "#071d3e"; ctx.fillRect(0, 0, 1600, 270);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "right"; ctx.direction = "rtl";
      ctx.font = 'bold 56px "Noto Sans Arabic", sans-serif'; ctx.fillText("Entix | سجل ربط جهاز الفوترة", 1480, 120, 1360);
      ctx.font = '32px "Noto Sans Arabic", sans-serif'; ctx.fillText(title, 1480, 205, 1360);
      let y = 360;
      for (const [label, value] of rows) {
        ctx.fillStyle = "#526077"; ctx.font = '28px "Noto Sans Arabic", sans-serif'; ctx.fillText(label, 1480, y, 1360);
        ctx.fillStyle = "#071d3e"; ctx.font = 'bold 36px "Noto Sans Arabic", sans-serif'; ctx.fillText(value, 1480, y + 55, 1360); y += 140;
      }
      ctx.fillStyle = "#854d0e"; ctx.font = '28px "Noto Sans Arabic", sans-serif';
      const lines = [t("إرسال الفواتير: غير مفعّل بعد", "Invoice submission: not active yet"),
        t("هذا سجل ربط للجهاز، وليس شهادة اعتماد للبرنامج أو إثبات قبول الفواتير.", "Device onboarding record, not software accreditation or invoice acceptance evidence."),
        t("الصلاحية حسب الشهادة المحفوظة؛ الإلغاء يُراجع في بوابة فاتورة.", "Validity is based on the stored certificate; check revocation in Fatoora."),
        `${t("وقت التحقق", "Checked at")}: ${new Date(proof.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })} (Riyadh)`];
      for (const line of lines) { ctx.fillText(line, 1480, y, 1360); y += 60; }
      ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = "#526077"; ctx.font = "19px monospace";
      ctx.fillText(`SHA-256: ${cert.fingerprint}`, 120, 1550, 1360);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("image_failed")), "image/png"));
      const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = `Entix-ZATCA-${proof.vatNumber || proof.orgId}.png`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
    <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy || status.loading || !proof.deviceLinked} onClick={download}><Download className="me-2 h-4 w-4" />{t("تنزيل ملخص الربط كصورة", "Download onboarding record")}</Button><Button variant="outline" size="sm" onClick={invalidateZatcaStatus}>{t("تحديث الحالة", "Refresh status")}</Button><a className="inline-flex items-center gap-1 text-sm text-primary underline" href="https://fatoora.zatca.gov.sa/" target="_blank" rel="noopener noreferrer">{t("مراجعة الجهاز في بوابة فاتورة", "Review device in Fatoora")}<ExternalLink className="h-3 w-3" /></a></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
