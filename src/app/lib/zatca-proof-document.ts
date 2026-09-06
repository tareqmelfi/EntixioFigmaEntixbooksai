import qrcode from "qrcode-generator";
import type { DeviceProof } from "./use-zatca-status";

export const FATOORA_DEVICE_PORTAL = "https://fatoora.zatca.gov.sa/";

/** Entix reference only; never presented as an authority-issued certificate number. */
export function deviceProofReference(proof: DeviceProof) {
  return `ENTIX-Z2-${proof.orgId.slice(0, 8).toUpperCase()}-${(proof.certificate?.fingerprint || "").replace(/:/g, "").slice(0, 12).toUpperCase()}`;
}

/** A printable Entix record. The QR opens Fatoora, not a public verification endpoint. */
export async function renderDeviceProofDocument(proof: DeviceProof, t: (ar: string, en: string) => string) {
  if (!proof.certificate || !proof.deviceLinked || proof.certificateState !== "valid"
    || !(Date.parse(proof.certificate.issuedAt) <= Date.now() && Date.now() < Date.parse(proof.certificate.expiresAt))) throw new Error("device_proof_unavailable");
  await Promise.all([document.fonts.load('700 72px "Noto Sans Arabic"', proof.companyName), document.fonts.load('400 30px "Noto Sans Arabic"', 'سجل الربط'), document.fonts.ready]);
  const cert = proof.certificate;
  const canvas = document.createElement("canvas");
  canvas.width = 2480; canvas.height = 1754; // A4 landscape at approximately 212 dpi.
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const rtl = t("ar", "en") === "ar";
  const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" });
  const text = (value: string, x: number, y: number, size: number, color = "#001539", bold = false, width = 2150) => {
    ctx.direction = rtl ? "rtl" : "ltr"; ctx.textAlign = "right";
    ctx.fillStyle = color; ctx.font = `${bold ? "bold " : ""}${size}px "Noto Sans Arabic", sans-serif`;
    ctx.fillText(value, x, y, width);
  };
  const rule = (y: number) => { ctx.fillStyle = "#d7e2ed"; ctx.fillRect(155, y, 2170, 2); };
  const field = (label: string, value: string, x: number, y: number) => {
    text(label, x, y, 32, "#526077", false, 1010);
    text(value, x, y + 76, 52, "#001539", true, 1010);
  };

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#001539"; ctx.lineWidth = 3; ctx.strokeRect(48, 48, 2384, 1658);
  ctx.strokeStyle = "#d7e2ed"; ctx.lineWidth = 1; ctx.strokeRect(66, 66, 2348, 1622);
  ctx.fillStyle = "#05b6fa"; ctx.fillRect(66, 66, 2348, 12);

  // Integer-sized QR modules and a four-module quiet zone remain sharp in print.
  const qr = qrcode(0, "M"); qr.addData(FATOORA_DEVICE_PORTAL); qr.make();
  const cell = 8, quiet = 4, count = qr.getModuleCount(), qrX = 155, qrY = 140;
  ctx.fillStyle = "#001539";
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
    if (qr.isDark(row, col)) ctx.fillRect(qrX + (col + quiet) * cell, qrY + (row + quiet) * cell, cell, cell);
  }
  const qrRight = qrX + (count + quiet * 2) * cell;
  text(t("بوابة فاتورة", "Fatoora portal"), qrRight, 465, 31, "#001539", true, 340);
  text(t("تسجيل الدخول لمراجعة الجهاز", "Sign in to review the device"), qrRight, 510, 24, "#526077", false, 340);

  text("ENTIX.IO", 2325, 208, 68, "#001539", true, 1500);
  text(`${t("مرجع السجل", "Entix record reference")}: \u2066${deviceProofReference(proof)}\u2069`, 2325, 267, 26, "#526077", false, 1700);
  text(t("سجل ربط جهاز الفوترة الإلكترونية", "E-invoicing device onboarding record"), 2325, 350, 78, "#001539", true, 1710);
  text(t("صادر من Entix بناءً على شهادة الجهاز المحفوظة", "Issued by Entix from the stored device certificate"), 2325, 418, 32, "#526077", false, 1710);
  ctx.fillStyle = "#eaf8f0"; ctx.fillRect(1375, 465, 950, 76);
  text(t("تم ربط جهاز المنشأة في بيئة الإنتاج", "Device onboarded in production"), 2295, 517, 34, "#17603b", true, 890);
  rule(584);

  text(t("المنشأة", "Organization"), 2325, 668, 32, "#526077");
  text(proof.companyName, 2325, 760, 72, "#001539", true);
  field(t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—", 2325, 876);
  field(t("معرّف الجهاز", "Device identifier"), cert.deviceName || "—", 1140, 876);
  field(t("تاريخ إصدار شهادة الجهاز", "Device certificate issued"), date(cert.issuedAt), 2325, 1060);
  field(t("صالحة حتى", "Valid until"), date(cert.expiresAt), 1140, 1060);

  ctx.fillStyle = "#f4f8fb"; ctx.fillRect(155, 1195, 2170, 112);
  text(t("فحوصات قبول الجهاز", "Device compliance checks"), 2295, 1266, 34, "#526077", false, 760);
  text(`${proof.complianceChecksPassed} / 6`, 1640, 1266, 46, "#17603b", true, 230);
  text(t("إرسال الفواتير: غير مفعّل بعد", "Invoice submission: not active yet"), 1190, 1266, 32, "#854d0e", false, 1005);

  rule(1370);
  text(t("سجل ربط من Entix؛ ليس شهادة اعتماد حكومية للبرنامج، ولا إثباتًا لقبول الفواتير أو التسجيل الضريبي.", "An Entix onboarding record, not government software accreditation, invoice acceptance, or VAT registration proof."), 2325, 1430, 30, "#526077");
  text(t("الصلاحية حسب الشهادة المحفوظة؛ يُراجع إلغاء الشهادة في بوابة فاتورة. رمز QR يفتح البوابة ويتطلب تسجيل الدخول.", "Validity follows the stored certificate; review revocation in Fatoora. The QR opens the portal and requires sign-in."), 2325, 1482, 30, "#526077");
  text(`${t("وقت التحقق", "Checked at")}: ${new Date(proof.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })} · ${t("بتوقيت الرياض", "Riyadh time")}`, 2325, 1540, 28, "#526077");
  ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = "#526077"; ctx.font = "24px monospace";
  ctx.fillText(`SHA-256  ${cert.fingerprint}`, 155, 1625, 2170);
  return canvas;
}
