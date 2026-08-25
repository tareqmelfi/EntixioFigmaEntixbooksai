/**
 * POS v2 · thermal receipt (58 mm / 80 mm) · prints through a hidden iframe so the
 * cashier screen never re-renders for print. Works fully offline (store block is
 * cached with the catalog). Simplified tax invoice QR = ZATCA phase-1 TLV
 * (seller · VAT no · timestamp · total · VAT) — only when the store has a VAT number.
 */
import qrcode from "qrcode-generator";
import type { PosStore, QueuedSale } from "./pos-store";
import { money } from "./pos-store";

export type ReceiptOptions = {
  paper: "58" | "80";
  lang: "ar" | "en";
  footerText?: string;
  showLogo?: boolean;
  branchName?: string | null;
  currency: string;
};

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function tlvBase64(fields: Array<[number, string]>): string {
  const enc = new TextEncoder();
  const bytes: number[] = [];
  for (const [tag, value] of fields) {
    const v = enc.encode(value);
    bytes.push(tag, v.length, ...Array.from(v));
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function receiptQrSvg(sale: QueuedSale, store: PosStore | null, size = 120): string | null {
  const vat = store?.vatNumber?.trim();
  // ZATCA TLV QR is a Saudi requirement · a US EIN in vatNumber must not produce one.
  if (!vat || store?.country !== "SA") return null;
  const seller = store?.name || store?.legalName || "";
  const payload = tlvBase64([[1, seller], [2, vat], [3, new Date(sale.occurredAt).toISOString()], [4, sale.totals.grand.toFixed(2)], [5, sale.totals.vat.toFixed(2)]]);
  try {
    const qr = qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true }).replace("<svg ", `<svg width="${size}" height="${size}" `);
  } catch { return null; }
}

export function receiptHtml(sale: QueuedSale, store: PosStore | null, opts: ReceiptOptions): string {
  const ar = opts.lang === "ar";
  const w = opts.paper === "58" ? 48 : 72; // printable mm
  const t = (a: string, e: string) => (ar ? a : e);
  const dt = new Date(sale.occurredAt);
  const date = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const number = sale.invoiceNumber || sale.provisionalNumber;
  const provisional = !sale.invoiceNumber;
  const qr = receiptQrSvg(sale, store, opts.paper === "58" ? 96 : 120);
  const logo = opts.showLogo !== false ? (store?.printLogoUrl || store?.logoUrl) : null;
  const method = sale.paymentMethod === "CASH" ? t("نقدًا", "Cash") : sale.paymentMethod === "MADA" ? t("مدى", "Mada") : t("بطاقة", "Card");
  const addr = [store?.addressLine, store?.city].filter(Boolean).join(" · ");

  const lines = sale.lines.map((l) => {
    const name = ar ? (l.nameAr || l.name) : (l.name || l.nameAr || "");
    return `<tr><td class="n">${esc(name)}<div class="s">${l.qty} × ${money(l.unitPrice)}</div></td><td class="a">${money(l.unitPrice * l.qty)}</td></tr>`;
  }).join("");

  return `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(number)}</title>
<style>
@page { size: ${opts.paper}mm auto; margin: 3mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: ${w}mm; font-family: "Noto Sans Arabic", "Plus Jakarta Sans", Arial, sans-serif; color: #000; font-size: ${opts.paper === "58" ? 10 : 11.5}px; line-height: 1.35; }
.c { text-align: center; }
.b { font-weight: 800; }
.logo { max-width: ${opts.paper === "58" ? 28 : 36}mm; max-height: 14mm; object-fit: contain; margin: 0 auto 2mm; display: block; }
.h1 { font-size: ${opts.paper === "58" ? 13 : 15}px; font-weight: 800; }
.muted { color: #333; font-size: 0.92em; }
hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 0.6mm 0; vertical-align: top; }
td.n { text-align: start; }
td.a { text-align: end; direction: ltr; white-space: nowrap; font-variant-numeric: tabular-nums; }
.s { font-size: 0.88em; color: #333; direction: ltr; text-align: start; }
.tot td { padding: 0.4mm 0; }
.grand td { font-size: 1.25em; font-weight: 800; padding-top: 1.2mm; }
.badge { display: inline-block; border: 1px solid #000; padding: 0.4mm 1.6mm; border-radius: 2mm; font-size: 0.85em; }
.qr { margin: 2mm auto 1mm; width: fit-content; }
.foot { margin-top: 2mm; font-size: 0.9em; }
</style></head><body>
<div class="c">
${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ""}
<div class="h1">${esc(store?.name || "")}</div>
${store?.legalName && store.legalName !== store.name ? `<div class="muted">${esc(store.legalName)}</div>` : ""}
${addr ? `<div class="muted">${esc(addr)}</div>` : ""}
${store?.phone ? `<div class="muted" dir="ltr">${esc(store.phone)}</div>` : ""}
${store?.vatNumber ? `<div class="muted">${store.country === "US" ? "EIN" : t("الرقم الضريبي", "VAT No.")}: <span dir="ltr">${esc(store.vatNumber)}</span></div>` : ""}
${store?.crNumber ? `<div class="muted">${t("س.ت", "CR")}: <span dir="ltr">${esc(store.crNumber)}</span></div>` : ""}
</div>
<hr>
<div class="c b">${store?.vatNumber && store?.country === "SA" ? t("فاتورة ضريبية مبسطة", "Simplified Tax Invoice") : t("إيصال بيع", "Sales Receipt")}</div>
<table class="muted">
<tr><td class="n">${t("رقم", "No.")}</td><td class="a">${esc(number)}${provisional ? ` <span class="badge">${t("مؤقت", "offline")}</span>` : ""}</td></tr>
<tr><td class="n">${t("التاريخ", "Date")}</td><td class="a">${date} ${time}</td></tr>
${opts.branchName ? `<tr><td class="n">${t("الفرع", "Branch")}</td><td class="a">${esc(opts.branchName)}</td></tr>` : ""}
${sale.cashierName ? `<tr><td class="n">${t("الكاشير", "Cashier")}</td><td class="a">${esc(sale.cashierName)}</td></tr>` : ""}
${sale.customerName ? `<tr><td class="n">${t("العميل", "Customer")}</td><td class="a">${esc(sale.customerName)}</td></tr>` : ""}
</table>
<hr>
<table>${lines}</table>
<hr>
<table class="tot">
<tr><td class="n">${t("الإجمالي قبل الضريبة", "Subtotal (excl. VAT)")}</td><td class="a">${money(sale.totals.net)}</td></tr>
<tr><td class="n">${t("ضريبة القيمة المضافة", "VAT")}</td><td class="a">${money(sale.totals.vat)}</td></tr>
<tr class="grand"><td class="n">${t("الإجمالي", "TOTAL")}</td><td class="a">${money(sale.totals.grand)} ${esc(opts.currency)}</td></tr>
<tr><td class="n">${t("طريقة الدفع", "Paid by")}</td><td class="a">${method}</td></tr>
${sale.paymentMethod === "CASH" ? `<tr><td class="n">${t("المدفوع", "Tendered")}</td><td class="a">${money(sale.amountTendered)}</td></tr><tr><td class="n">${t("الباقي", "Change")}</td><td class="a">${money(sale.totals.change)}</td></tr>` : ""}
</table>
${qr ? `<div class="qr">${qr}</div>` : ""}
<div class="c foot">${esc(opts.footerText || t("شكرًا لتسوقكم معنا", "Thank you for shopping with us"))}</div>
<div class="c muted" style="margin-top:1mm">entix.io</div>
</body></html>`;
}

/** Print through a hidden iframe · resolves when the print dialog has been handed off. */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);
    const done = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* gone */ } resolve(); }, 1500); };
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { done(); return; }
    doc.open(); doc.write(html); doc.close();
    const go = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* blocked */ }
      done();
    };
    // give images/fonts a moment
    if (iframe.contentWindow) iframe.contentWindow.onafterprint = done;
    setTimeout(go, 350);
  });
}

export function printReceipt(sale: QueuedSale, store: PosStore | null, opts: ReceiptOptions) {
  return printHtml(receiptHtml(sale, store, opts));
}
