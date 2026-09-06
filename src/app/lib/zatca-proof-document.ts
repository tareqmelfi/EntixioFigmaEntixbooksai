import { displayLocale } from "./number-display";
import qrcode from "qrcode-generator";
import type { DeviceProof } from "./use-zatca-status";
import { drawEntixWordmark } from "./entix-brand-tokens";
import { deviceProofStages, isDeviceProofCurrent } from "./zatca-proof-presentation";

export const FATOORA_DEVICE_PORTAL = "https://fatoora.zatca.gov.sa/";

/** Entix reference only; never presented as an authority-issued certificate number. */
export function deviceProofReference(proof: DeviceProof) {
  return `ENTIX-Z2-${proof.orgId.slice(0, 8).toUpperCase()}-${(proof.certificate?.fingerprint || "").replace(/:/g, "").slice(0, 12).toUpperCase()}`;
}

/** The record is drawn from the same design tokens as the app, so it re-themes with it. */
function palette() {
  const read = (name: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  };
  const ink = read("--content", "");
  return {
    paper: read("--canvas", ""),
    paper2: read("--surface-subtle", ""),
    sheet: read("--card", ""),
    line: read("--border-subtle", ""),
    ink,
    muted: read("--content-secondary", ""),
    accent: read("--action-primary", ""),
    accentSubtle: read("--success-subtle", ""),
    warning: read("--warning", ""),
    onInk: read("--neutral-0", ""),
    onInkMuted: read("--brand-teal-600", ""),
    onInkLine: read("--neutral-600", ""),
  };
}

const SANS = '"IBM Plex Sans Arabic", "IBM Plex Sans", sans-serif';
const MONO = '"JetBrains Mono", "IBM Plex Sans", monospace';

/** Printable record using the client-approved sidebar layout and actual evidence. */
export async function renderDeviceProofDocument(proof: DeviceProof, t: (ar: string, en: string) => string) {
  if (!proof.certificate || !isDeviceProofCurrent(proof)) throw new Error("device_proof_unavailable");
  await Promise.all([
    document.fonts.load(`700 72px ${SANS}`, proof.companyName),
    document.fonts.load(`400 30px ${SANS}`, "سجل الربط"),
    document.fonts.load(`500 25px ${MONO}`, "0123456789"),
    document.fonts.ready,
  ]);
  const cert = proof.certificate;
  const canvas = document.createElement("canvas");
  canvas.width = 2480; canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const rtl = t("ar", "en") === "ar";
  const c = palette();
  const text = (value: string, x: number, y: number, size: number, color: string = c.ink, bold = false, width = 1640, align: CanvasTextAlign = "right") => {
    ctx.direction = rtl ? "rtl" : "ltr"; ctx.textAlign = align;
    ctx.fillStyle = color; ctx.font = `${bold ? "700 " : "400 "}${size}px ${SANS}`;
    ctx.fillText(value, x, y, width);
  };
  const code = (value: string, x: number, y: number, size: number, color: string = c.ink, weight = 500, width = 800, align: CanvasTextAlign = "left") => {
    ctx.direction = "ltr"; ctx.textAlign = align;
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${MONO}`;
    ctx.fillText(value, x, y, width);
  };
  const box = (x: number, y: number, w: number, h: number, color: string, radius = 18) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  };
  const rule = (x: number, y: number, width: number, color = c.line) => { ctx.fillStyle = color; ctx.fillRect(x, y, width, 2); };
  const date = (value: string) => new Date(value).toLocaleDateString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" }).replace(/\//g, " / ");
  const qr = (payload: string, x: number, y: number, cell: number) => {
    const symbol = qrcode(0, "M"); symbol.addData(payload); symbol.make();
    const count = symbol.getModuleCount(), size = (count + 8) * cell;
    box(x, y, size, size, c.sheet, 14);
    ctx.fillStyle = c.ink;
    for (let r = 0; r < count; r++) for (let col = 0; col < count; col++) if (symbol.isDark(r, col)) ctx.fillRect(x + (col + 4) * cell, y + (r + 4) * cell, cell, cell);
    return size;
  };
  // A stage mark is a ring plus a word — the colour alone never carries the meaning.
  const check = (label: string, right: number, baseline: number, complete: boolean, width = 720) => {
    const color = complete ? c.accent : c.warning;
    ctx.fillStyle = complete ? c.accentSubtle : c.paper; ctx.beginPath(); ctx.arc(right - 23, baseline - 13, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
    if (complete) { ctx.moveTo(right - 33, baseline - 14); ctx.lineTo(right - 26, baseline - 7); ctx.lineTo(right - 12, baseline - 24); }
    else { ctx.arc(right - 23, baseline - 13, 11, 0, Math.PI * 2); ctx.moveTo(right - 23, baseline - 20); ctx.lineTo(right - 23, baseline - 13); ctx.lineTo(right - 17, baseline - 10); }
    ctx.stroke(); text(label, right - 64, baseline, 29, complete ? c.ink : c.muted, false, width);
  };
  const accepted = proof.lastAcceptedInvoice;
  const ready = proof.delivery?.ready === true;
  const review = !!proof.delivery?.needsReview;

  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, 2480, 1754);
  box(64, 64, 2352, 1626, c.sheet);
  ctx.save(); ctx.beginPath(); ctx.roundRect(64, 64, 2352, 1626, 18); ctx.clip();
  ctx.fillStyle = c.ink; ctx.fillRect(1865, 64, 551, 1626); ctx.restore();
  ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(64, 64, 2352, 1626, 18); ctx.stroke();

  // The approved wordmark retains the same face and colors as the application.
  box(1975, 124, 340, 92, c.sheet, 14);
  await drawEntixWordmark(ctx, 2286, 189, 54);
  text(t("سجل ربط جهاز", "E-invoicing device"), 2354, 295, 39, c.onInk, true, 430);
  text(t("الفوترة الإلكترونية", "binding record"), 2354, 356, 39, c.onInk, true, 430);
  code("ZATCA PHASE 2 · DEVICE", 1926, 414, 22, c.onInkMuted, 400, 425);
  code("BINDING RECORD", 1926, 450, 22, c.onInkMuted, 400, 425);
  rule(1926, 504, 428, c.onInkLine);
  text(t("مرجع السجل", "Record reference"), 2354, 568, 26, c.onInkMuted, true, 428);
  const reference = deviceProofReference(proof), cut = reference.lastIndexOf("-");
  code(reference.slice(0, cut + 1), 1926, 618, 25, c.onInk, 500, 428);
  code(reference.slice(cut + 1), 1926, 660, 25, c.onInk, 500, 428);
  qr(FATOORA_DEVICE_PORTAL, 2050, 1236, 8);
  text(t("بوابة فاتورة", "Fatoora portal"), 2354, 1565, 29, c.onInk, true, 428);
  text(t("تسجيل الدخول لمراجعة الجهاز", "Sign in to review the device"), 2354, 1612, 23, c.onInkMuted, false, 428);
  // Status word on the ink panel: a dot, an ASCII state word and the Arabic phrase.
  ctx.fillStyle = c.onInkMuted; ctx.beginPath(); ctx.arc(2346, 1655, 9, 0, Math.PI * 2); ctx.fill();
  code("BOUND", 1926, 1665, 24, c.onInkMuted, 500, 200);
  text(t("مرتبط · بيئة الإنتاج", "Bound · production"), 2325, 1663, 25, c.onInk, true, 330);

  text(t("المنشأة", "Organization"), 1790, 149, 25, c.muted, true);
  text(proof.companyName, 1790, 235, 65, c.ink, true, 1220);
  text(t("صادر من ENTIX.IO بناءً على شهادة الجهاز المحفوظة", "Issued by ENTIX.IO from the stored device certificate"), 1790, 294, 27, c.muted, false, 1370);
  box(140, 137, 470, 64, c.accentSubtle, 32);
  ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(583, 169, 9, 0, Math.PI * 2); ctx.fill();
  text(t("تم ربط جهاز المنشأة في بيئة الإنتاج", "Organization device bound in production"), 560, 181, 26, c.accent, true, 400);
  rule(140, 337, 1650, c.ink);
  const field = (label: string, value: string, left: number, right: number, y: number, size = 44) => {
    text(label, right, y, 26, c.muted, true, right - left);
    code(value, left, y + 62, size, c.ink, 500, right - left);
  };
  field(t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—", 1000, 1790, 395);
  field(t("معرّف الجهاز", "Device identifier"), cert.deviceName || "—", 140, 930, 395, 41);
  field(t("تاريخ إصدار شهادة الجهاز", "Device certificate issued"), date(cert.issuedAt), 1000, 1790, 533);
  field(t("صالحة حتى", "Valid until"), date(cert.expiresAt), 140, 930, 533);

  box(140, 653, 1650, 244, c.paper2);
  deviceProofStages(proof, t).forEach((stage, index) => check(stage.label, index % 2 === 0 ? 1750 : 930, index < 2 ? 714 : 785, stage.complete));
  // Authority acceptance and daily delivery are separate evidence-based stages.
  check(t("قبول أول فاتورة إنتاجية", "First production invoice accepted"), 930, 856, !!accepted);
  check(t("الإرسال التلقائي للفواتير المدعومة", "Automatic delivery for supported invoices"), 1750, 856, ready && !review);
  if (accepted) {
    text(t("قبول فاتورة إنتاجية", "Production invoice accepted"), 1790, 960, 29, c.accent, true, 400);
    code(`${accepted.invoiceNumber} · ${accepted.status}`, 1370, 960, 27, c.ink, 500, 600, "right");
  } else {
    text(t("بانتظار رد الهيئة على أول فاتورة", "Awaiting the first invoice authority response"), 1790, 960, 29, c.warning, true, 1650);
  }
  text(review ? t("توجد فواتير تحتاج مراجعة في حساب المنشأة", "Invoices need review in the organization account") : ready ? t("الإرسال التلقائي مفعّل · مبيعات محلية بالريال بضريبة 15٪", "Automatic delivery active · Domestic SAR sales at 15% VAT") : t("الإرسال التلقائي: بانتظار استكمال التفعيل", "Automatic delivery: awaiting activation"), 1790, 1018, 27, ready && !review ? c.accent : c.warning, false, 1650);

  rule(140, 1424, 1650);
  const digest = cert.fingerprint.replace(/:/g, "").toUpperCase();
  qr(`SHA256:${digest}`, 140, 1444, 4);
  code("SHA-256 fingerprint", 140, 1690, 18, c.muted, 400, 250);
  text(accepted ? t("سجل من Entix؛ قبول الفاتورة المذكورة موثق برد الهيئة. لا يعد اعتمادًا للبرنامج أو لجميع الفواتير.", "An Entix record; the named invoice has an authority response. Not software or blanket invoice accreditation.") : t("سجل ربط من Entix؛ لا يتضمن قبول فاتورة إنتاجية بعد، وليس اعتمادًا حكوميًا للبرنامج.", "An Entix onboarding record; no production invoice accepted yet. Not government software accreditation."), 1790, 1495, 22, c.muted, false, 1340);
  text(t("مراجعة إلغاء الجهاز في بوابة فاتورة. رمز البصمة للمطابقة؛ لا يفتح رابط تحقق رسمي.", "Review device revocation in Fatoora. The fingerprint code is for matching, not an official verification link."), 1790, 1538, 22, c.muted, false, 1340);
  text(`${t("وقت التحقق", "Checked at")}: ${new Date(proof.checkedAt).toLocaleString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" })}`, 1790, 1588, 22, c.muted, false, 1340);
  code(`SHA-256 ${cert.fingerprint}`, 450, 1630, 17, c.muted, 400, 1340);
  rule(450, 1660, 1340);
  code("© 2026 ENSIDEX LLC · Wyoming, USA · All rights reserved.", 450, 1700, 19, c.muted, 400, 900);
  code(reference, 1790, 1700, 19, c.muted, 400, 600, "right");
  return canvas;
}
