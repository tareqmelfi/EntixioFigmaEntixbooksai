import { displayLocale } from "./number-display";
import qrcode from "qrcode-generator";
import type { DeviceProof } from "./use-zatca-status";
import { drawEntixWordmark, ENTIX_BRAND } from "./entix-brand-tokens";
import { deviceProofStages, isDeviceProofCurrent } from "./zatca-proof-presentation";

export const FATOORA_DEVICE_PORTAL = "https://fatoora.zatca.gov.sa/";

/** Entix reference only; never presented as an authority-issued certificate number. */
export function deviceProofReference(proof: DeviceProof) {
  return `ENTIX-Z2-${proof.orgId.slice(0, 8).toUpperCase()}-${(proof.certificate?.fingerprint || "").replace(/:/g, "").slice(0, 12).toUpperCase()}`;
}

/** Printable record using the client-approved sidebar layout and actual evidence. */
export async function renderDeviceProofDocument(proof: DeviceProof, t: (ar: string, en: string) => string) {
  if (!proof.certificate || !isDeviceProofCurrent(proof)) throw new Error("device_proof_unavailable");
  await Promise.all([document.fonts.load('700 72px "Noto Sans Arabic"', proof.companyName), document.fonts.load('400 30px "Noto Sans Arabic"', 'سجل الربط'), document.fonts.ready]);
  const cert = proof.certificate;
  const canvas = document.createElement("canvas");
  canvas.width = 2480; canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const rtl = t("ar", "en") === "ar";
  const navy = ENTIX_BRAND.navy, muted = "#68748b", green = "#187349", amber = "#956100";
  const text = (value: string, x: number, y: number, size: number, color: string = navy, bold = false, width = 1640, align: CanvasTextAlign = "right") => {
    ctx.direction = rtl ? "rtl" : "ltr"; ctx.textAlign = align;
    ctx.fillStyle = color; ctx.font = `${bold ? "700 " : "400 "}${size}px "Noto Sans Arabic", sans-serif`;
    ctx.fillText(value, x, y, width);
  };
  const box = (x: number, y: number, w: number, h: number, color: string, radius = 18) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  };
  const rule = (x: number, y: number, width: number, color = "#deded5") => { ctx.fillStyle = color; ctx.fillRect(x, y, width, 2); };
  const date = (value: string) => new Date(value).toLocaleDateString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" }).replace(/\//g, " / ");
  const qr = (payload: string, x: number, y: number, cell: number) => {
    const code = qrcode(0, "M"); code.addData(payload); code.make();
    const count = code.getModuleCount(), size = (count + 8) * cell;
    box(x, y, size, size, "#ffffff", 14);
    ctx.fillStyle = navy;
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (code.isDark(r, c)) ctx.fillRect(x + (c + 4) * cell, y + (r + 4) * cell, cell, cell);
    return size;
  };
  const check = (label: string, right: number, baseline: number, complete: boolean, width = 720) => {
    const color = complete ? green : amber;
    ctx.fillStyle = complete ? "#dff3e6" : "#fff0c7"; ctx.beginPath(); ctx.arc(right - 23, baseline - 13, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
    if (complete) { ctx.moveTo(right - 33, baseline - 14); ctx.lineTo(right - 26, baseline - 7); ctx.lineTo(right - 12, baseline - 24); }
    else { ctx.arc(right - 23, baseline - 13, 11, 0, Math.PI * 2); ctx.moveTo(right - 23, baseline - 20); ctx.lineTo(right - 23, baseline - 13); ctx.lineTo(right - 17, baseline - 10); }
    ctx.stroke(); text(label, right - 64, baseline, 29, navy, false, width);
  };
  const accepted = proof.lastAcceptedInvoice;
  const ready = proof.delivery?.ready === true;
  const review = !!proof.delivery?.needsReview;

  ctx.fillStyle = "#f4f2eb"; ctx.fillRect(0, 0, 2480, 1754);
  box(64, 64, 2352, 1626, "#fffefa");
  ctx.save(); ctx.beginPath(); ctx.roundRect(64, 64, 2352, 1626, 18); ctx.clip();
  ctx.fillStyle = navy; ctx.fillRect(1865, 64, 551, 1626); ctx.restore();
  ctx.strokeStyle = "#deded5"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(64, 64, 2352, 1626, 18); ctx.stroke();

  // The approved wordmark retains the same face and colors as the application.
  box(1975, 124, 340, 92, "#ffffff", 14);
  await drawEntixWordmark(ctx, 2286, 189, 54);
  text(t("سجل ربط جهاز", "E-invoicing device"), 2354, 295, 39, "#ffffff", true, 430);
  text(t("الفوترة الإلكترونية", "onboarding record"), 2354, 356, 39, "#ffffff", true, 430);
  text("ZATCA PHASE 2 · DEVICE", 1926, 414, 23, "#a8c4ee", false, 425, "left");
  text("ONBOARDING RECORD", 1926, 450, 23, "#a8c4ee", false, 425, "left");
  rule(1926, 504, 428, "#526285");
  text(t("مرجع السجل", "Record reference"), 2354, 568, 26, "#a8c4ee", true, 428);
  const reference = deviceProofReference(proof), cut = reference.lastIndexOf("-");
  ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = '25px monospace';
  ctx.fillText(reference.slice(0, cut + 1), 1926, 618, 428); ctx.fillText(reference.slice(cut + 1), 1926, 660, 428);
  qr(FATOORA_DEVICE_PORTAL, 2050, 1236, 8);
  text(t("بوابة فاتورة", "Fatoora portal"), 2354, 1565, 29, "#ffffff", true, 428);
  text(t("تسجيل الدخول لمراجعة الجهاز", "Sign in to review the device"), 2354, 1612, 23, "#cad6e9", false, 428);
  text(t("مرتبط · بيئة الإنتاج", "Onboarded · Production"), 2354, 1661, 25, "#a8c4ee", true, 428);

  text(t("المنشأة", "Organization"), 1790, 149, 25, muted, true);
  text(proof.companyName, 1790, 235, 65, navy, true, 1220);
  text(t("صادر من ENTIX.IO بناءً على شهادة الجهاز المحفوظة", "Issued by ENTIX.IO from the stored device certificate"), 1790, 294, 27, muted, false, 1370);
  box(140, 137, 420, 64, "#edf2ff", 32);
  text(t("تم الربط في بيئة الإنتاج", "Device onboarded in production"), 535, 181, 27, ENTIX_BRAND.blue, true, 370);
  rule(140, 337, 1650, navy);
  const field = (label: string, value: string, left: number, right: number, y: number, size = 46) => {
    text(label, right, y, 26, muted, true, right - left);
    ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = navy; ctx.font = `700 ${size}px "Noto Sans Arabic", sans-serif`; ctx.fillText(value, left, y + 65, right - left);
  };
  field(t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—", 1000, 1790, 395);
  field(t("معرّف الجهاز", "Device identifier"), cert.deviceName || "—", 140, 930, 395, 43);
  field(t("تاريخ إصدار شهادة الجهاز", "Device certificate issued"), date(cert.issuedAt), 1000, 1790, 533);
  field(t("صالحة حتى", "Valid until"), date(cert.expiresAt), 140, 930, 533);

  box(140, 653, 1650, 244, "#f4f2eb");
  deviceProofStages(proof, t).forEach((stage, index) => check(stage.label, index % 2 === 0 ? 1750 : 930, index < 2 ? 714 : 785, stage.complete));
  // Authority acceptance and daily delivery are separate evidence-based stages.
  check(t("قبول أول فاتورة إنتاجية", "First production invoice accepted"), 930, 856, !!accepted);
  check(t("الإرسال التلقائي للفواتير المدعومة", "Automatic delivery for supported invoices"), 1750, 856, ready && !review);
  text(accepted ? `${accepted.invoiceNumber} · ${accepted.status}` : t("بانتظار رد الهيئة على أول فاتورة", "Awaiting the first invoice authority response"), 1790, 960, 29, accepted ? green : amber, true, 1650);
  text(review ? t("توجد فواتير تحتاج مراجعة في حساب المنشأة", "Invoices need review in the organization account") : ready ? t("الإرسال التلقائي مفعّل · مبيعات محلية بالريال بضريبة 15٪", "Automatic delivery active · Domestic SAR sales at 15% VAT") : t("الإرسال التلقائي: بانتظار استكمال التفعيل", "Automatic delivery: awaiting activation"), 1790, 1018, 27, ready && !review ? green : amber, false, 1650);

  rule(140, 1424, 1650);
  const digest = cert.fingerprint.replace(/:/g, "").toUpperCase();
  qr(`SHA256:${digest}`, 140, 1444, 4);
  text("SHA-256 fingerprint", 385, 1680, 18, muted, false, 245);
  text(accepted ? t("سجل من Entix؛ قبول الفاتورة المذكورة موثق برد الهيئة. لا يعد اعتمادًا للبرنامج أو لجميع الفواتير.", "An Entix record; the named invoice has an authority response. Not software or blanket invoice accreditation.") : t("سجل ربط من Entix؛ لا يتضمن قبول فاتورة إنتاجية بعد، وليس اعتمادًا حكوميًا للبرنامج.", "An Entix onboarding record; no production invoice accepted yet. Not government software accreditation."), 1790, 1505, 22, muted, false, 1340);
  text(t("مراجعة إلغاء الجهاز في بوابة فاتورة. رمز البصمة للمطابقة؛ لا يفتح رابط تحقق رسمي.", "Review device revocation in Fatoora. The fingerprint code is for matching, not an official verification link."), 1790, 1550, 22, muted, false, 1340);
  text(`${t("وقت التحقق", "Checked at")}: ${new Date(proof.checkedAt).toLocaleString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" })} · ${t("بتوقيت الرياض", "Riyadh time")}`, 1790, 1614, 23, muted, false, 1340);
  ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = muted; ctx.font = "17px monospace";
  ctx.fillText(`SHA-256 ${cert.fingerprint}`, 440, 1663, 1350);
  return canvas;
}
