import qrcode from "qrcode-generator";
import type { DeviceProof } from "./use-zatca-status";
import { drawEntixWordmark, ENTIX_BRAND } from "./entix-brand-tokens";
import { deviceProofStages, isDeviceProofCurrent } from "./zatca-proof-presentation";

export const FATOORA_DEVICE_PORTAL = "https://fatoora.zatca.gov.sa/";

/** Entix reference only; never presented as an authority-issued certificate number. */
export function deviceProofReference(proof: DeviceProof) {
  return `ENTIX-Z2-${proof.orgId.slice(0, 8).toUpperCase()}-${(proof.certificate?.fingerprint || "").replace(/:/g, "").slice(0, 12).toUpperCase()}`;
}

/** A printable Entix record. The QR opens Fatoora, not a public verification endpoint. */
export async function renderDeviceProofDocument(proof: DeviceProof, t: (ar: string, en: string) => string) {
  if (!proof.certificate || !isDeviceProofCurrent(proof)) throw new Error("device_proof_unavailable");
  await Promise.all([document.fonts.load('700 72px "Noto Sans Arabic"', proof.companyName), document.fonts.load('400 30px "Noto Sans Arabic"', 'سجل الربط'), document.fonts.ready]);
  const cert = proof.certificate;
  const canvas = document.createElement("canvas");
  canvas.width = 2480; canvas.height = 1754; // A4 landscape at approximately 212 dpi.
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const rtl = t("ar", "en") === "ar";
  const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" });
  const text = (value: string, x: number, y: number, size: number, color: string = ENTIX_BRAND.navy, bold = false, width = 2150) => {
    ctx.direction = rtl ? "rtl" : "ltr"; ctx.textAlign = "right";
    ctx.fillStyle = color; ctx.font = `${bold ? "bold " : ""}${size}px "Noto Sans Arabic", sans-serif`;
    ctx.fillText(value, x, y, width);
  };
  const rule = (y: number) => { ctx.fillStyle = "#d7e2ed"; ctx.fillRect(155, y, 2170, 2); };
  const field = (label: string, value: string, x: number, y: number) => {
    text(label, x, y, 32, "#526077", false, 1010);
    text(value, x, y + 76, 52, ENTIX_BRAND.navy, true, 1010);
  };

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = ENTIX_BRAND.navy; ctx.lineWidth = 3; ctx.strokeRect(48, 48, 2384, 1658);
  ctx.strokeStyle = "#d7e2ed"; ctx.lineWidth = 1; ctx.strokeRect(66, 66, 2348, 1622);
  ctx.fillStyle = ENTIX_BRAND.cyan; ctx.fillRect(66, 66, 2348, 12);

  // Integer-sized QR modules and a four-module quiet zone remain sharp in print.
  const qr = qrcode(0, "M"); qr.addData(FATOORA_DEVICE_PORTAL); qr.make();
  const cell = 8, quiet = 4, count = qr.getModuleCount(), qrX = 155, qrY = 140;
  ctx.fillStyle = ENTIX_BRAND.navy;
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
    if (qr.isDark(row, col)) ctx.fillRect(qrX + (col + quiet) * cell, qrY + (row + quiet) * cell, cell, cell);
  }
  const qrRight = qrX + (count + quiet * 2) * cell;
  text(t("بوابة فاتورة", "Fatoora portal"), qrRight, 465, 31, ENTIX_BRAND.navy, true, 340);
  text(t("تسجيل الدخول لمراجعة الجهاز", "Sign in to review the device"), qrRight, 510, 24, "#526077", false, 340);

  await drawEntixWordmark(ctx, 2325, 208, 68);
  text(`${t("مرجع السجل", "Entix record reference")}: \u2066${deviceProofReference(proof)}\u2069`, 2325, 267, 26, "#526077", false, 1700);
  text(t("سجل ربط جهاز الفوترة الإلكترونية", "E-invoicing device onboarding record"), 2325, 350, 78, ENTIX_BRAND.navy, true, 1710);
  text(t("صادر من Entix بناءً على شهادة الجهاز المحفوظة", "Issued by Entix from the stored device certificate"), 2325, 418, 32, "#526077", false, 1710);
  ctx.fillStyle = "#eaf8f0"; ctx.fillRect(1375, 465, 950, 76);
  text(t("تم ربط جهاز المنشأة في بيئة الإنتاج", "Device onboarded in production"), 2295, 517, 34, "#17603b", true, 890);
  rule(584);

  text(t("المنشأة", "Organization"), 2325, 668, 32, "#526077");
  text(proof.companyName, 2325, 760, 72, ENTIX_BRAND.navy, true);
  field(t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—", 2325, 876);
  field(t("معرّف الجهاز", "Device identifier"), cert.deviceName || "—", 1140, 876);
  field(t("تاريخ إصدار شهادة الجهاز", "Device certificate issued"), date(cert.issuedAt), 2325, 1060);
  field(t("صالحة حتى", "Valid until"), date(cert.expiresAt), 1140, 1060);

  ctx.fillStyle = "#f4f8fb"; ctx.fillRect(155, 1185, 2170, 195);
  deviceProofStages(proof, t).forEach((stage, index) => {
    const right = index % 2 === 0 ? 2290 : 1190;
    const y = index < 2 ? 1247 : 1338;
    ctx.fillStyle = "#d5f5e6"; ctx.beginPath(); ctx.arc(right - 23, y - 13, 25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#17603b"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(right - 35, y - 14); ctx.lineTo(right - 26, y - 5); ctx.lineTo(right - 11, y - 24); ctx.stroke();
    text(stage.label, right - 67, y, 32, ENTIX_BRAND.navy, false, 965);
  });
  const accepted = proof.lastAcceptedInvoice;
  text(accepted ? `${t("قبول فاتورة إنتاجية", "Production invoice accepted")}: ${accepted.invoiceNumber} · ${accepted.status}` : t("إرسال الفواتير: غير مفعّل بعد", "Invoice submission: not active yet"), 2325, 1420, 28, accepted ? "#17603b" : "#854d0e");

  rule(1450);
  const digest = cert.fingerprint.replace(/:/g, "").toUpperCase();
  const fingerprintQr = qrcode(0, "M"); fingerprintQr.addData(`SHA256:${digest}`); fingerprintQr.make();
  const fpCell = 4, fpCount = fingerprintQr.getModuleCount();
  ctx.fillStyle = ENTIX_BRAND.navy;
  for (let row = 0; row < fpCount; row++) for (let col = 0; col < fpCount; col++) {
    if (fingerprintQr.isDark(row, col)) ctx.fillRect(155 + (col + 4) * fpCell, 1465 + (row + 4) * fpCell, fpCell, fpCell);
  }
  text(t("بصمة الشهادة · SHA-256", "Certificate fingerprint · SHA-256"), 430, 1680, 20, "#526077", false, 275);
  text(accepted ? t("سجل من Entix؛ قبول الفاتورة المذكورة موثق برد الهيئة. لا يعد اعتمادًا للبرنامج أو لجميع الفواتير.", "An Entix record; the named invoice has an authority acceptance response. Not software or blanket invoice accreditation.") : t("سجل ربط من Entix؛ ليس اعتمادًا حكوميًا للبرنامج أو إثباتًا لقبول الفواتير أو التسجيل الضريبي.", "An Entix record; not government software accreditation, invoice acceptance, or VAT registration proof."), 2325, 1510, 26, "#526077", false, 1810);
  text(t("مراجعة الإلغاء في بوابة فاتورة. رمز البصمة للمطابقة؛ لا يفتح رابط تحقق رسمي.", "Review revocation in Fatoora. The fingerprint QR is for matching; it is not an official verification link."), 2325, 1558, 26, "#526077", false, 1810);
  text(`${t("وقت التحقق", "Checked at")}: ${new Date(proof.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })} · ${t("بتوقيت الرياض", "Riyadh time")}`, 2325, 1606, 26, "#526077", false, 1810);
  ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = "#526077"; ctx.font = "18px monospace";
  ctx.fillText(`SHA-256  ${cert.fingerprint}`, 500, 1670, 1825);
  return canvas;
}
