import { useEffect, useState } from "react";
import { Check, CircleAlert, Download, ExternalLink, FileDown, ShieldCheck } from "lucide-react";
import { deviceProofReviewReason, deviceProofStages, isDeviceProofCurrent } from "../lib/zatca-proof-presentation";
import { deviceProofReference, FATOORA_DEVICE_PORTAL, renderDeviceProofDocument } from "../lib/zatca-proof-document";
import { Button } from "./ui/button";
import { useLanguage } from "./LanguageContext";
import { invalidateZatcaStatus, type ZatcaStatus } from "../lib/use-zatca-status";

export function ZatcaDeviceProof({ status }: { status: ZatcaStatus }) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; pdfUrl: string; key: string } | null>(null);
  const proof = status.raw?.deviceProof;
  const previewKey = proof?.certificate ? `${proof.orgId}:${proof.certificate.fingerprint}:${proof.checkedAt}:${t("ar", "en")}` : "";
  useEffect(() => {
    if (status.loading || !proof || !isDeviceProofCurrent(proof)) return;
    let cancelled = false;
    let url: string | undefined;
    let pdfUrl: string | undefined;
    setError("");
    void renderDeviceProofDocument(proof, t).then(async canvas => {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("image_failed")), "image/png"));
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.setProperties({ title: `Entix | ${proof.companyName}`, subject: "Device onboarding record", creator: "Entix" });
      pdf.addImage(canvas, "PNG", 0, 0, 297, 210, undefined, "FAST");
      const pdfBlob = pdf.output("blob");
      if (cancelled) return;
      url = URL.createObjectURL(blob); pdfUrl = URL.createObjectURL(pdfBlob);
      setPreview({ url, pdfUrl, key: previewKey });
    }).catch(() => { if (!cancelled) setError(t("تعذر تجهيز معاينة السجل؛ حدّث الحالة للمحاولة مجددًا.", "Unable to prepare the record preview. Refresh the status to retry.")); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [proof, previewKey, status.loading, t]);
  if (!proof || !proof.certificate) return <p role="status" className="text-sm text-muted-foreground">{status.loading ? t("جارٍ التحقق من سجل شهادة الجهاز…", "Checking the device certificate record…") : t("لا تتوفر حاليًا أدلة شهادة قابلة للعرض؛ حدّث حالة الربط أو راجع إعداداته.", "No certificate evidence is currently available to display. Refresh the connection status or review its settings.")}</p>;
  const current = isDeviceProofCurrent(proof);
  const previewReady = !status.loading && current && preview?.key === previewKey;
  const cert = proof.certificate;
  const accepted = proof.lastAcceptedInvoice;
  const delivery = proof.delivery;
  const live = current && delivery?.ready === true;
  const filename = `Entix-ZATCA-${proof.vatNumber || proof.orgId}`;
  const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" });
  const title = current ? t("تم ربط جهاز المنشأة في بيئة الإنتاج", "Organization device onboarded in production") : t("سجل شهادة الجهاز · يحتاج مراجعة", "Device certificate record · review required");
  const rows = [
    [t("مرجع سجل Entix", "Entix record reference"), deviceProofReference(proof)],
    [t("المنشأة", "Organization"), proof.companyName],
    [t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—"],
    [t("الجهاز", "Device"), cert.deviceName || "—"],
    [t("تاريخ إصدار الشهادة", "Certificate issued"), date(cert.issuedAt)],
    [t("صالحة حتى", "Valid until"), date(cert.expiresAt)],
    [t("فحوصات قبول الجهاز", "Device compliance checks"), `${proof.complianceChecksPassed} / 6`],
  ];
  const note = t("سجل من Entix يستند إلى شهادة الجهاز ورد الهيئة على الفاتورة المذكورة إن وُجد. ليس شهادة اعتماد حكومية للبرنامج أو شهادة تسجيل VAT.", "An Entix record based on the device certificate and any named invoice authority response. Not government software accreditation or a VAT registration certificate.");
  return <section className={`space-y-4 rounded-xl border p-5 ${current ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50"}`} aria-label={t("سجل ربط جهاز المنشأة", "Organization device onboarding record")}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2" aria-live="polite">{current ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <CircleAlert className="h-5 w-5 shrink-0 text-amber-700" />}<h3 className="font-semibold">{title}</h3></div>
      <div className="flex flex-wrap items-center gap-2" aria-label={t("تنزيل سجل الربط", "Download onboarding record")}>
        {previewReady ? <Button asChild variant="outline" size="sm"><a href={preview.pdfUrl} download={`${filename}.pdf`}><FileDown className="me-2 h-4 w-4" />{t("تنزيل السجل · PDF", "Download record · PDF")}</a></Button> : <Button variant="outline" size="sm" disabled>{t("تجهيز التنزيل…", "Preparing download…")}</Button>}
      </div>
    </div>
    {!current && <p role="status" className="text-sm text-amber-900">{deviceProofReviewReason(proof, t)}</p>}
    {previewReady && <a href={preview.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-primary" aria-label={t("فتح سجل الربط بالحجم الكامل", "Open the full-size onboarding record")}><img src={preview.url} width={2480} height={1754} alt={t("سجل ربط جهاز المنشأة مع رمز QR ومرجع السجل وبصمة الشهادة", "Device onboarding record with QR, record reference and certificate fingerprint")} className="w-full rounded-lg border border-border bg-white shadow-sm" /></a>}
    {!previewReady && current && !error && <div role="status" className="flex aspect-[297/210] items-center justify-center rounded-lg border border-border bg-white text-sm text-muted-foreground">{t("جارٍ تجهيز سجل الربط…", "Preparing the onboarding record…")}</div>}
    <p className="text-xs text-muted-foreground">{t("آخر تحديث للحالة", "Status last updated")}: <bdi>{new Date(proof.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}</bdi> · {t("بتوقيت الرياض", "Riyadh time")}</p>
    <div role="status" className={`rounded-lg border p-3 text-sm ${live && !delivery?.needsReview ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="font-semibold">{live ? t("الإرسال التلقائي للفواتير مفعّل", "Automatic invoice submission is active") : delivery?.enabled ? t("الإرسال التلقائي يحتاج مراجعة", "Automatic submission needs review") : t("الإرسال التلقائي لم يُفعّل لهذه المنشأة", "Automatic submission is not enabled for this organization")}</p>

      {!!delivery?.pending && <p>{t(`بانتظار تأكيد الهيئة: ${delivery.pending}`, `Awaiting authority confirmation: ${delivery.pending}`)}</p>}
      {!!delivery?.needsReview && <p>{t(`فواتير تحتاج معالجة: ${delivery.needsReview}`, `Invoices needing attention: ${delivery.needsReview}`)}</p>}
      {delivery?.jobs?.map(job => <p key={job.invoiceId} className="mt-2 text-xs"><bdi>{job.invoiceNumber}</bdi> · {job.message || t("في طابور الإرسال", "Queued for submission")}</p>)}
    </div>
    <details open={!current || undefined} className="space-y-3 text-sm"><summary className="cursor-pointer font-medium">{t("بيانات الشهادة ومصدر التحقق", "Certificate details and verification source")}</summary>
    {accepted ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status"><p className="font-semibold">{t("تم قبول فاتورة فعلية في بيئة الإنتاج", "An actual production invoice was accepted")}</p><p><bdi>{accepted.invoiceNumber} · {accepted.status}</bdi> · <bdi>{new Date(accepted.acceptedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}</bdi></p><p className="break-all text-xs">UUID: <bdi>{accepted.uuid}</bdi></p><p className="mt-1 text-xs">{t("هذا القبول يخص الفاتورة المذكورة؛ تُعرض نتيجة الهيئة لكل فاتورة بصورة مستقلة.", "This acceptance applies to the named invoice; every invoice has its own authority result.")}</p></div> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("لم يُحفظ قبول لفاتورة إنتاجية بعد؛ يظهر هنا عند استلام رد الهيئة.", "No production invoice acceptance is stored yet; it appears here after the authority response.")}</p>}
      <p className="mt-1 text-xs">{t("النطاق الحالي: فواتير المبيعات المحلية بالريال بضريبة ١٥٪، القياسية والمبسطة، مع خصومات البنود. تُرسل الفواتير الجديدة بعد اعتمادها. الإشعارات الدائنة والمدينة والتصدير والمعفاة تحتاج مسارًا إضافيًا.", "Current scope: domestic SAR sales at 15% VAT, standard and simplified, including line discounts. New invoices are submitted after approval. Credit/debit notes, exports and exempt supplies require an additional workflow.")}</p>
    <ol className="grid gap-3 sm:grid-cols-2" aria-label={t("مراحل ربط الجهاز", "Device onboarding stages")}>{deviceProofStages(proof, t).map(stage => <li key={stage.label} className="flex items-center gap-2">{stage.complete ? <Check aria-label={t("مكتمل", "Complete")} className="h-5 w-5 rounded-full bg-emerald-100 p-0.5 text-emerald-700" /> : <CircleAlert aria-label={t("يحتاج تحقق", "Verification required")} className="h-5 w-5 text-amber-700" />}<span>{stage.label}</span></li>)}</ol>
    <dl className="grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold"><bdi>{value}</bdi></dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">{note}</p>
    <p className="text-xs text-muted-foreground">{t("يمكنك الدخول من جهاز آخر بالحساب المخوّل نفسه. مفاتيح الربط محفوظة على الخادم ولا تظهر في هذا الملخص.", "Use the same authorized account on another device. Linking keys remain on the server and are excluded from this record.")}</p>
    <p className="text-xs text-muted-foreground">{t("نتحقق من الشهادة المحفوظة كل دقيقة. إلغاء الشهادة يُراجع في بوابة فاتورة؛ هذا المؤشر لا يستعلم عن الإلغاء مباشرة من الهيئة.", "Stored certificate checks refresh every minute. Review revocation in Fatoora; this indicator does not query authority revocation status directly.")}</p>
    <p className="text-xs text-muted-foreground">{t("آخر تحقق", "Last checked")}: <bdi>{new Date(proof.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}</bdi> · {t("بتوقيت الرياض", "Riyadh time")}</p>
    <p className="break-all text-xs text-muted-foreground">SHA-256: <bdi>{cert.fingerprint}</bdi></p>
    <div className="flex flex-wrap gap-2">{previewReady && <Button asChild variant="ghost" size="sm"><a href={preview.url} download={`${filename}.png`}><Download className="me-2 h-4 w-4" />{t("تنزيل صورة", "Download image")}</a></Button>}<Button variant="outline" size="sm" onClick={invalidateZatcaStatus}>{t("تحديث الحالة", "Refresh status")}</Button><a className="inline-flex items-center gap-1 text-sm text-primary underline" href={FATOORA_DEVICE_PORTAL} target="_blank" rel="noopener noreferrer">{t("مراجعة الجهاز في بوابة فاتورة", "Review device in Fatoora")}<ExternalLink className="h-3 w-3" /></a></div>
    </details>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
