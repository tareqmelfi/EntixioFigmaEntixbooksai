import { displayLocale } from "./number-display";
import qrcode from "qrcode-generator";
import type { DeviceProof } from "./use-zatca-status";
import { ENTIX_BRAND } from "./entix-brand-tokens";
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
  return {
    paper: read("--canvas", ""),
    paper2: read("--surface-subtle", ""),
    sheet: read("--card", ""),
    line: read("--border-subtle", ""),
    ink: read("--content", ""),
    muted: read("--content-secondary", ""),
    accent: read("--action-primary", ""),
    accentSubtle: read("--success-subtle", ""),
    warning: read("--warning", ""),
    warningMark: read("--chart-4", ""),
    onInk: read("--canvas", ""),
    onInkMuted: read("--brand-teal-600", ""),
    onInkSoft: read("--chart-5", ""),
    onInkLine: read("--neutral-600", ""),
  };
}

const SANS = '"IBM Plex Sans Arabic", "IBM Plex Sans", sans-serif';
const MONO = '"JetBrains Mono", "IBM Plex Sans", monospace';
const SERIF = '"Instrument Serif", "IBM Plex Sans", Georgia, serif';

/** A4 landscape: the artboard is authored at 1123 x 794 and printed at 2480 x 1754. */
const SHEET_W = 1123;
const SHEET_H = 794;
const SCALE = 2480 / SHEET_W;

/**
 * Printable binding record, laid out to the approved A4-landscape artboard:
 * a 250pt ink identity panel on the reading edge, the evidence facts on the
 * sheet, the stage strip, and a footer carrying the fingerprint and its QR.
 */
export async function renderDeviceProofDocument(proof: DeviceProof, t: (ar: string, en: string) => string) {
  if (!proof.certificate || !isDeviceProofCurrent(proof)) throw new Error("device_proof_unavailable");
  const brandFont = `${ENTIX_BRAND.fontWeight} 62px "${ENTIX_BRAND.fontFamily}"`;
  await Promise.all([
    document.fonts.load(`700 66px ${SANS}`, proof.companyName),
    document.fonts.load(`400 30px ${SANS}`, "سجل الربط"),
    document.fonts.load(`500 45px ${MONO}`, "0123456789"),
    document.fonts.load(`400 53px ${SERIF}`, "0123456789"),
    document.fonts.load(brandFont, "ENTIX.IO"),
    document.fonts.ready,
  ]);
  if (!document.fonts.check(brandFont, "ENTIX.IO")) throw new Error("brand_font_unavailable");
  const cert = proof.certificate;
  const canvas = document.createElement("canvas");
  canvas.width = 2480; canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const rtl = t("ar", "en") === "ar";
  const c = palette();

  // Everything below is authored in artboard units; one helper scales to print.
  const u = (value: number) => value * SCALE;
  const fill = (color: string, x: number, y: number, w: number, h: number, radius = 0) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(u(x), u(y), u(w), u(h), u(radius)); ctx.fill();
  };
  const stroke = (color: string, x: number, y: number, w: number, h: number, radius = 0) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, u(1)); ctx.beginPath(); ctx.roundRect(u(x), u(y), u(w), u(h), u(radius)); ctx.stroke();
  };
  const rule = (color: string, x: number, y: number, w: number) => { ctx.fillStyle = color; ctx.fillRect(u(x), u(y), u(w), Math.max(1, u(1))); };
  const dot = (color: string, cx: number, cy: number, r: number) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(u(cx), u(cy), u(r), 0, Math.PI * 2); ctx.fill();
  };
  /** Arabic and UI copy: follows the document direction, aligned to the given edge. */
  const text = (value: string, x: number, baseline: number, size: number, color: string, opts: { bold?: boolean; align?: CanvasTextAlign; max?: number; tracking?: number } = {}) => {
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = opts.align || (rtl ? "right" : "left");
    ctx.fillStyle = color;
    ctx.font = `${opts.bold ? "700 " : "400 "}${u(size)}px ${SANS}`;
    if (opts.tracking) ctx.letterSpacing = `${u(opts.tracking)}px`;
    ctx.fillText(value, u(x), u(baseline), opts.max ? u(opts.max) : undefined);
    if (opts.tracking) ctx.letterSpacing = "0px";
  };
  /** Codes, identifiers and digits: always left-to-right, never mirrored. */
  const code = (value: string, x: number, baseline: number, size: number, color: string, opts: { weight?: number; align?: CanvasTextAlign; max?: number; tracking?: number; serif?: boolean } = {}) => {
    ctx.direction = "ltr"; ctx.textAlign = opts.align || "left"; ctx.fillStyle = color;
    ctx.font = `${opts.weight || 500} ${u(size)}px ${opts.serif ? SERIF : MONO}`;
    if (opts.tracking) ctx.letterSpacing = `${u(opts.tracking)}px`;
    ctx.fillText(value, u(x), u(baseline), opts.max ? u(opts.max) : undefined);
    if (opts.tracking) ctx.letterSpacing = "0px";
  };
  const measure = (value: string, size: number, bold: boolean) => {
    ctx.direction = rtl ? "rtl" : "ltr"; ctx.font = `${bold ? "700 " : "400 "}${u(size)}px ${SANS}`;
    return ctx.measureText(value).width / SCALE;
  };
  /** The approved wordmark: the production face, paper-coloured on the ink panel. */
  const wordmark = (left: number, baseline: number, size: number) => {
    ctx.save(); ctx.direction = "ltr"; ctx.textAlign = "left";
    ctx.font = `${ENTIX_BRAND.fontWeight} ${u(size)}px "${ENTIX_BRAND.fontFamily}"`;
    const prefix = ctx.measureText("ENTIX").width, stop = ctx.measureText(".").width;
    ctx.fillStyle = ENTIX_BRAND.navyOnDark; ctx.fillText("ENTIX", u(left), u(baseline));
    ctx.fillStyle = ENTIX_BRAND.blueOnDark; ctx.fillText(".", u(left) + prefix, u(baseline));
    ctx.fillText("IO", u(left) + prefix + stop, u(baseline));
    ctx.restore();
  };
  const qr = (payload: string, x: number, y: number, box: number) => {
    const symbol = qrcode(0, "M"); symbol.addData(payload); symbol.make();
    const count = symbol.getModuleCount(), cell = box / count;
    ctx.fillStyle = c.ink;
    for (let r = 0; r < count; r++) for (let col = 0; col < count; col++) if (symbol.isDark(r, col)) ctx.fillRect(u(x + col * cell), u(y + r * cell), Math.ceil(u(cell)), Math.ceil(u(cell)));
  };
  const date = (value: string) => new Date(value).toLocaleDateString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" }).replace(/\//g, " / ");

  const accepted = proof.lastAcceptedInvoice;
  const ready = proof.delivery?.ready === true;
  const review = !!proof.delivery?.needsReview;

  // ── Frame ────────────────────────────────────────────────────────────────
  fill(c.paper, 0, 0, SHEET_W, SHEET_H);
  const cardX = 28, cardY = 28, cardW = 1067, cardH = 738, panelW = 250;
  fill(c.sheet, cardX, cardY, cardW, cardH, 8);
  const panelX = rtl ? cardX + cardW - panelW : cardX;
  ctx.save(); ctx.beginPath(); ctx.roundRect(u(cardX), u(cardY), u(cardW), u(cardH), u(8)); ctx.clip();
  fill(c.ink, panelX, cardY, panelW, cardH);
  ctx.restore();
  stroke(c.line, cardX, cardY, cardW, cardH, 8);

  // ── Ink identity panel ───────────────────────────────────────────────────
  const pLeft = panelX + 28, pRight = panelX + panelW - 28, pStart = rtl ? pRight : pLeft;
  wordmark(pLeft, 80, 24);
  text(t("سجل ربط جهاز", "E-invoicing device"), pStart, 121, 17, c.onInk, { bold: true, max: 194 });
  text(t("الفوترة الإلكترونية", "binding record"), pStart, 146, 17, c.onInk, { bold: true, max: 194 });
  code("ZATCA PHASE 2 · DEVICE", pLeft, 168, 10, c.onInkMuted, { weight: 400, tracking: 1.5, max: 194 });
  code("BINDING RECORD", pLeft, 181, 10, c.onInkMuted, { weight: 400, tracking: 1.5, max: 194 });
  rule(c.onInkLine, pLeft, 205, 194);
  text(t("مرجع السجل", "Record reference"), pStart, 231, 11, c.onInkMuted, { bold: true, tracking: 1.5, max: 194 });
  const reference = deviceProofReference(proof), cut = reference.lastIndexOf("-");
  code(reference.slice(0, cut + 1), pLeft, 252, 11, c.onInk, { max: 194 });
  code(reference.slice(cut + 1), pLeft, 270, 11, c.onInk, { max: 194 });

  const portalQrX = rtl ? pRight - 100 : pLeft;
  fill(c.sheet, portalQrX, 557, 100, 100, 8);
  qr(FATOORA_DEVICE_PORTAL, portalQrX + 8, 565, 84);
  text(t("بوابة فاتورة", "Fatoora portal"), pStart, 680, 12, c.onInk, { bold: true, max: 194 });
  text(t("تسجيل الدخول لمراجعة الجهاز", "Sign in to review the device"), pStart, 702, 11, c.onInkSoft, { max: 194 });
  // The state on the panel is a mark, an ASCII word and the phrase — never colour alone.
  dot(c.onInkMuted, rtl ? pRight - 4 : pLeft + 4, 727, 4);
  text(t("مرتبط · بيئة الإنتاج", "Bound · production"), rtl ? pRight - 15 : pLeft + 15, 731, 12, c.onInkMuted, { bold: true, max: 179 });

  // ── Sheet ────────────────────────────────────────────────────────────────
  const sheetX = rtl ? cardX : cardX + panelW, sheetW = cardW - panelW;
  const left = sheetX + 34, right = sheetX + sheetW - 34, start = rtl ? right : left, end = rtl ? left : right;
  const width = right - left;

  text(t("المنشأة", "Organization"), start, 63, 11, c.muted, { bold: true, tracking: 1.5 });
  text(proof.companyName, start, 97, 30, c.ink, { bold: true, max: width - 240 });
  text(t("صادر من ENTIX.IO بناءً على شهادة الجهاز المحفوظة", "Issued by ENTIX.IO from the stored device certificate"), start, 122, 12, c.muted, { max: width - 240 });

  const stateLabel = t("تم ربط جهاز المنشأة في بيئة الإنتاج", "Organization device bound in production");
  const pillW = measure(stateLabel, 12, true) + 42;
  const pillX = rtl ? left : right - pillW;
  fill(c.accentSubtle, pillX, 60, pillW, 28, 14);
  dot(c.accent, rtl ? pillX + pillW - 14 : pillX + 14, 74, 4);
  text(stateLabel, rtl ? pillX + pillW - 24 : pillX + 24, 78, 12, c.accent, { bold: true, align: rtl ? "right" : "left", max: pillW - 34 });

  // Facts: two columns, values as codes so identifiers and dates never mirror.
  rule(c.ink, left, 140, width);
  const colW = (width - 32) / 2;
  const colStart = (index: number) => rtl ? right - index * (colW + 32) : left + index * (colW + 32);
  const fact = (label: string, value: string, column: 0 | 1, labelY: number, valueY: number, size: number, serif = false) => {
    const anchor = colStart(column);
    text(label, anchor, labelY, 11, c.muted, { bold: true, tracking: 1.5, max: colW });
    code(value, rtl ? anchor : anchor, valueY, size, c.ink, { weight: 600, align: rtl ? "right" : "left", max: colW, serif });
  };
  fact(t("الرقم الضريبي", "VAT number"), proof.vatNumber || "—", 0, 163, 191, 20);
  fact(t("معرّف الجهاز", "Device identifier"), cert.deviceName || "—", 1, 163, 191, 20);
  fact(t("تاريخ إصدار شهادة الجهاز", "Device certificate issued"), date(cert.issuedAt), 0, 221, 252, 24, true);
  fact(t("صالحة حتى", "Valid until"), date(cert.expiresAt), 1, 221, 252, 24, true);

  // Stage strip: a ring with a tick, then the stage name — the word carries it.
  fill(c.paper, left, 276, width, 72, 8);
  const stage = (label: string, column: 0 | 1, baseline: number, complete: boolean) => {
    const anchor = column === 0 ? (rtl ? right - 18 : left + 18) : (rtl ? right - 18 - colW - 32 : left + 18 + colW + 32);
    const markX = rtl ? anchor - 10 : anchor + 10;
    fill(complete ? c.accentSubtle : c.paper2, markX - 10, baseline - 14, 20, 20, 10);
    ctx.strokeStyle = complete ? c.accent : c.warningMark; ctx.lineWidth = u(2); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (complete) { ctx.moveTo(u(markX - 5), u(baseline - 4.5)); ctx.lineTo(u(markX - 1.5), u(baseline - 1)); ctx.lineTo(u(markX + 5), u(baseline - 8)); }
    else { ctx.arc(u(markX), u(baseline - 4), u(5), 0, Math.PI * 2); }
    ctx.stroke();
    text(label, rtl ? anchor - 26 : anchor + 26, baseline, 13, complete ? c.ink : c.muted, { max: colW - 60 });
  };
  const stages = deviceProofStages(proof, t);
  stages.forEach((item, index) => stage(item.label, (index % 2) as 0 | 1, index < 2 ? 302 : 330, item.complete));

  // Authority acceptance and platform delivery are separate, evidence-based facts.
  if (accepted) {
    const lead = t("قبول فاتورة إنتاجية:", "Production invoice accepted:");
    text(lead, start, 375, 13, c.muted);
    const leadW = measure(lead, 13, false) + 8;
    const codeAnchor = rtl ? start - leadW : start + leadW;
    code(accepted.invoiceNumber, codeAnchor, 375, 13, c.ink, { align: rtl ? "right" : "left", max: 200 });
    const codeW = 150;
    const badgeX = rtl ? codeAnchor - codeW - 76 : codeAnchor + codeW;
    fill(c.accentSubtle, badgeX, 364, 76, 18, 9);
    code(accepted.status, badgeX + 38, 377, 10, c.accent, { align: "center", max: 68 });
  } else {
    text(t("بانتظار رد الهيئة على أول فاتورة إنتاجية", "Awaiting the authority response on the first production invoice"), start, 375, 13, c.warning, { max: width - 260 });
  }
  // The delivery state: a muted label, then the state word carrying the colour.
  const deliveryLabel = t("إرسال الفواتير من المنصة:", "Platform submission:");
  const deliveryState = review
    ? t("يحتاج مراجعة", "needs review")
    : ready ? t("مفعّل", "active") : t("غير مفعّل بعد", "not enabled yet");
  const stateW = measure(deliveryState, 12, true);
  text(deliveryState, end, 375, 12, ready && !review ? c.accent : c.warning, { bold: true, align: rtl ? "left" : "right", max: 160 });
  text(deliveryLabel, rtl ? end + stateW + 5 : end - stateW - 5, 375, 12, c.muted, { align: rtl ? "left" : "right", max: 200 });

  // ── Footer: the disclosure, the verification stamp and the fingerprint QR ──
  rule(c.line, left, 645, width);
  const noteLeft = rtl ? right : left + 116, noteWidth = width - 116;
  const disclosure = accepted
    ? t("سجل من ENTIX.IO؛ قبول الفاتورة المذكورة موثّق برد الهيئة. لا يُعد اعتمادًا للبرنامج أو لجميع الفواتير.", "An ENTIX.IO record; the named invoice carries an authority response. Not software accreditation and not blanket invoice acceptance.")
    : t("سجل ربط من ENTIX.IO؛ لا يتضمن قبول فاتورة إنتاجية بعد، وليس اعتمادًا حكوميًا للبرنامج.", "An ENTIX.IO onboarding record; no production invoice accepted yet, and not government software accreditation.");
  text(disclosure, noteLeft, 672, 11, c.muted, { max: noteWidth });
  text(t("مراجعة الإلغاء في بوابة فاتورة. رمز البصمة للمطابقة؛ لا يفتح رابط تحقق رسمي.", "Review revocation in the Fatoora portal. The fingerprint code is for matching, not an official verification link."), noteLeft, 692, 11, c.muted, { max: noteWidth });
  // The verification stamp and the fingerprint are Latin evidence: always read left to right.
  const stampX = rtl ? left + 116 : left + 116;
  code(`Verified ${new Date(proof.checkedAt).toLocaleString(displayLocale("en-GB"), { timeZone: "Asia/Riyadh" })} (Riyadh)`, stampX, 715, 11, c.muted, { weight: 400, align: "left", max: noteWidth });
  const digest = cert.fingerprint;
  code(`SHA-256 ${digest}`, stampX, 736, 9, c.muted, { weight: 400, align: "left", max: noteWidth });

  const qrX = rtl ? left : right - 84;
  qr(`SHA256:${digest.replace(/:/g, "").toUpperCase()}`, qrX, 653, 84);
  code("SHA-256 fingerprint", qrX, 748, 9, c.muted, { weight: 400, align: "left", max: 96 });
  return canvas;
}
