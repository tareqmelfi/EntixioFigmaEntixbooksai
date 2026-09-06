import { displayLocale } from "../lib/number-display";
import { useEffect, useState } from "react";
import { Check, CircleAlert, Download, ExternalLink, FileDown } from "lucide-react";
import { deviceProofReviewReason, deviceProofStages, isDeviceProofCurrent } from "../lib/zatca-proof-presentation";
import { deviceProofReference, FATOORA_DEVICE_PORTAL, renderDeviceProofDocument } from "../lib/zatca-proof-document";
import { Button } from "./ui/button";
import { EntixWordmark } from "./entix-brand";
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
  const date = (value: string) => new Date(value).toLocaleDateString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" });
  /** The record's own date style: wide, serif, slash-separated — same as the printable sheet. */
  const recordDate = (value: string) => date(value).replace(/\//g, " / ");
  const checkedAt = new Date(proof.checkedAt).toLocaleString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" });
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
  return <section className="flex flex-col gap-3.5" aria-label={t("سجل ربط جهاز المنشأة", "Organization device onboarding record")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="ledger-eyebrow">{t("سجل ربط الجهاز", "Device binding record")}</span>
      <div className="flex flex-wrap items-center gap-2" aria-label={t("تنزيل سجل الربط", "Download onboarding record")}>
        {previewReady
          ? <>
            <Button asChild className="h-9 px-3.5 text-[13px]"><a href={preview.url} download={`${filename}.png`}><Download className="me-1.5 size-3.5" strokeWidth={1.75} />{t("تنزيل سجل الربط كصورة", "Download record as an image")}</a></Button>
            <Button asChild variant="secondary" className="h-9 px-3.5 text-[13px]"><a href={preview.pdfUrl} download={`${filename}.pdf`}><FileDown className="me-1.5 size-3.5" strokeWidth={1.75} />PDF</a></Button>
          </>
          : <Button className="h-9 px-3.5 text-[13px]" disabled>{t("تجهيز التنزيل…", "Preparing download…")}</Button>}
      </div>
    </div>

    {!current && <p role="status" className="rounded-lg border border-border border-s-[3px] border-s-warning bg-card p-3 text-sm text-foreground">{deviceProofReviewReason(proof, t)}</p>}

    {current && (
      /* The record on screen is the same document the download prints: ink identity
         panel on the reading edge, evidence facts on the sheet. */
      <article className="grid w-full max-w-[900px] overflow-hidden rounded-lg border border-border bg-card shadow-popover md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-6 bg-foreground px-7 py-[30px] text-background">
          <div className="flex flex-col gap-4">
            <EntixWordmark size={20} light />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("سجل ربط جهاز الفوترة", "E-invoicing device binding record")}</span>
              <span className="font-code text-[10px] tracking-[1.5px] text-chart-3">ZATCA PHASE 2 · DEVICE BINDING RECORD</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-chart-3">
              <span className="ledger-dot" aria-hidden="true" />{t("مرتبط · بيئة الإنتاج", "Bound · production")}
            </span>
            <span className="text-[11px] leading-[1.7] text-chart-5">{t("هذا سجل ربط للجهاز، وليس شهادة اعتماد للبرنامج أو إثبات قبول الفواتير.", "This is a device binding record, not software accreditation or proof of invoice acceptance.")}</span>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-[22px] px-8 py-[30px]">
          <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
              <span className="ledger-eyebrow">{t("المنشأة", "Organization")}</span>
              <span className="text-2xl font-bold leading-tight text-foreground">{proof.companyName}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="ledger-eyebrow">{t("الرقم الضريبي", "VAT number")}</span>
              <span className="truncate text-lg text-foreground"><bdi className="font-code">{proof.vatNumber || "—"}</bdi></span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="ledger-eyebrow">{t("معرّف الجهاز", "Device identifier")}</span>
              <span className="truncate text-lg text-foreground"><bdi className="font-code">{cert.deviceName || "—"}</bdi></span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="ledger-eyebrow">{t("تاريخ الإصدار", "Issued")}</span>
              <span className="font-display text-2xl tabular-nums text-foreground" dir="ltr">{recordDate(cert.issuedAt)}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="ledger-eyebrow">{t("سارية حتى", "Valid until")}</span>
              <span className="font-display text-2xl tabular-nums text-foreground" dir="ltr">{recordDate(cert.expiresAt)}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="ledger-eyebrow">{t("فحوصات قبول الجهاز", "Device compliance checks")}</span>
              <span className="flex items-center gap-[5px]">
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index} className={`h-1.5 w-[22px] rounded-full ${index < proof.complianceChecksPassed ? "bg-primary" : "bg-surface-hover"}`} aria-hidden="true" />
                ))}
                <span className="ms-2 text-sm font-semibold tabular-nums text-foreground" dir="ltr">{proof.complianceChecksPassed} / 6</span>
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="ledger-eyebrow">{t("إرسال الفواتير", "Invoice submission")}</span>
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${live ? "text-success" : "text-warning"}`}>
                <span className={`ledger-dot${live ? "" : " text-chart-4"}`} aria-hidden="true" />
                {live ? t("مفعّل", "Active") : t("غير مفعّل بعد", "Not enabled yet")}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <span className="block break-all text-start font-code text-[9px] text-muted-foreground" dir="ltr">SHA-256 {cert.fingerprint}</span>
            <span className="block text-start font-code text-[10px] text-muted-foreground" dir="ltr">Verified {checkedAt} (Riyadh)</span>
            <span className="block text-[10px] leading-[1.7] text-muted-foreground">{t("الصلاحية بحسب الشهادة المحفوظة؛ الإلغاء يُراجع في بوابة فاتورة.", "Validity as per stored certificate; revocation is checked in the Fatoora portal.")}</span>
          </div>
        </div>
      </article>
    )}

    <div role="status" className={`max-w-[900px] rounded-lg border border-border bg-card p-3 text-sm text-foreground border-s-[3px] ${live && !delivery?.needsReview ? "border-s-success" : "border-s-warning"}`}>
      <p className="font-semibold">{live ? t("الإرسال التلقائي للفواتير مفعّل", "Automatic invoice submission is active") : delivery?.enabled ? t("الإرسال التلقائي يحتاج مراجعة", "Automatic submission needs review") : t("الإرسال التلقائي لم يُفعّل لهذه المنشأة", "Automatic submission is not enabled for this organization")}</p>

      {!!delivery?.pending && <p>{t(`بانتظار تأكيد الهيئة: ${delivery.pending}`, `Awaiting authority confirmation: ${delivery.pending}`)}</p>}
      {!!delivery?.needsReview && <p>{t(`فواتير تحتاج معالجة: ${delivery.needsReview}`, `Invoices needing attention: ${delivery.needsReview}`)}</p>}
      {delivery?.jobs?.map(job => <p key={job.invoiceId} className="mt-2 text-xs"><bdi className="font-code">{job.invoiceNumber}</bdi> · {job.message || t("في طابور الإرسال", "Queued for submission")}</p>)}
    </div>
    <details open={!current || undefined} className="max-w-[900px] space-y-4 text-sm"><summary className="cursor-pointer font-medium text-foreground">{t("بيانات الشهادة ومصدر التحقق", "Certificate details and verification source")}</summary>
    {accepted ? <div className="rounded-lg border border-border border-s-[3px] border-s-success bg-card p-3 text-sm text-foreground" role="status"><p className="font-semibold">{t("تم قبول فاتورة فعلية في بيئة الإنتاج", "An actual production invoice was accepted")}</p><p><bdi className="font-code">{accepted.invoiceNumber} · {accepted.status}</bdi> · <bdi className="font-code">{new Date(accepted.acceptedAt).toLocaleString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" })}</bdi></p><p className="break-all text-xs">UUID: <bdi className="font-code">{accepted.uuid}</bdi></p><p className="mt-1 text-xs text-muted-foreground">{t("هذا القبول يخص الفاتورة المذكورة؛ تُعرض نتيجة الهيئة لكل فاتورة بصورة مستقلة.", "This acceptance applies to the named invoice; every invoice has its own authority result.")}</p></div> : <p className="rounded-lg border border-border border-s-[3px] border-s-warning bg-card p-3 text-sm text-foreground">{t("لم يُحفظ قبول لفاتورة إنتاجية بعد؛ يظهر هنا عند استلام رد الهيئة.", "No production invoice acceptance is stored yet; it appears here after the authority response.")}</p>}
      <p className="mt-1 text-xs text-muted-foreground">{t("النطاق الحالي: فواتير المبيعات المحلية بالريال بضريبة 15٪، القياسية والمبسطة، مع خصومات البنود. تُرسل الفواتير الجديدة بعد اعتمادها. الإشعارات الدائنة والمدينة والتصدير والمعفاة تحتاج مسارًا إضافيًا.", "Current scope: domestic SAR sales at 15% VAT, standard and simplified, including line discounts. New invoices are submitted after approval. Credit/debit notes, exports and exempt supplies require an additional workflow.")}</p>
    <ol className="grid gap-2.5 sm:grid-cols-2" aria-label={t("مراحل ربط الجهاز", "Device onboarding stages")}>{deviceProofStages(proof, t).map(stage => <li key={stage.label} className="flex items-center gap-2.5 text-sm">{stage.complete ? <Check aria-label={t("مكتمل", "Complete")} className="size-5 shrink-0 rounded-full bg-success-subtle p-0.5 text-success" strokeWidth={1.75} /> : <CircleAlert aria-label={t("يحتاج تحقق", "Verification required")} className="size-5 shrink-0 text-warning" strokeWidth={1.75} />}<span className={stage.complete ? "text-foreground" : "text-muted-foreground"}>{stage.label}</span></li>)}</ol>
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 border-b border-border pb-2"><dt className="ledger-eyebrow shrink-0">{label}</dt><dd className="min-w-0 break-words text-sm font-semibold text-foreground"><bdi className="font-code">{value}</bdi></dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">{note}</p>
    <p className="text-xs text-muted-foreground">{t("يمكنك الدخول من جهاز آخر بالحساب المخوّل نفسه. مفاتيح الربط محفوظة على الخادم ولا تظهر في هذا الملخص.", "Use the same authorized account on another device. Linking keys remain on the server and are excluded from this record.")}</p>
    <p className="text-xs text-muted-foreground">{t("نتحقق من الشهادة المحفوظة كل دقيقة. إلغاء الشهادة يُراجع في بوابة فاتورة؛ هذا المؤشر لا يستعلم عن الإلغاء مباشرة من الهيئة.", "Stored certificate checks refresh every minute. Review revocation in Fatoora; this indicator does not query authority revocation status directly.")}</p>
    <p className="text-xs text-muted-foreground">{t("آخر تحقق", "Last checked")}: <bdi className="font-code">{checkedAt}</bdi> · {t("بتوقيت الرياض", "Riyadh time")}</p>
    <p className="break-all text-xs text-muted-foreground">SHA-256: <bdi className="font-code">{cert.fingerprint}</bdi></p>
    <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" onClick={invalidateZatcaStatus}>{t("تحديث الحالة", "Refresh status")}</Button><Button asChild variant="secondary" size="sm"><a href={FATOORA_DEVICE_PORTAL} target="_blank" rel="noopener noreferrer">{t("مراجعة الجهاز في بوابة فاتورة", "Review device in Fatoora")}<ExternalLink className="ms-2 size-3.5" strokeWidth={1.75} /></a></Button></div>
    </details>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>;
}
