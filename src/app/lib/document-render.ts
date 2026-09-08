/**
 * Entix Books · brand document engine (quotes + invoices).
 *
 * ONE pure function turns a template + org + contact + document into
 * print-ready HTML made of fixed A4 sheets (cover → inner pages → closing page),
 * mirroring the ENSIDEX / SpecPros reference documents:
 *   · running header (logo start · classification / date / file-id end) + 3px brand rule
 *   · footer law: © year company · city | n / N | document type · classification
 *   · dark cover with title · intro · three-column meta
 *   · inner page: supplier / client / meta block · 5-column items table · totals block ·
 *     terms card + e-payment card (QR + link) · payment plan · bank card · company note
 *   · closing page: numbered terms & conditions · signatory · stamp
 *
 * IDENTICAL copies live in the web app (src/app/lib/document-render.ts) and the API
 * (src/lib/document-render.ts) so the designer preview, the browser print views and
 * the server `GET /api/document-templates/render/:kind/:docId` produce the same pages.
 * No DOM, no framework, no dependencies — keep it that way.
 */

export type DocKind = "QUOTE" | "INVOICE";
export type DocLang = "ar" | "en";
export type CoverStyle = "DARK" | "LIGHT" | "NONE";
export type SectionId =
  | "cover" | "header" | "items" | "totals" | "paymentPlan" | "terms"
  | "bank" | "company" | "signatory" | "closing";

export interface SectionSetting { id: SectionId; enabled: boolean }

export const SECTION_IDS: SectionId[] = ["cover", "header", "items", "totals", "terms", "paymentPlan", "bank", "company", "signatory", "closing"];

export const SECTION_META: Record<SectionId, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  cover: { ar: "صفحة الغلاف", en: "Cover page", hintAr: "غلاف بعنوان ومقدمة وبيانات العميل", hintEn: "Title · intro · client meta" },
  header: { ar: "ترويسة المستند", en: "Document header", hintAr: "المورد · العميل · بيانات المستند", hintEn: "Supplier · client · document meta" },
  items: { ar: "جدول البنود", en: "Items table", hintAr: "الرمز · البند · الكمية · السعر · المبلغ", hintEn: "Code · item · qty · price · amount" },
  totals: { ar: "الإجماليات", en: "Totals", hintAr: "الخصم · الضريبة · المستحق", hintEn: "Discount · VAT · total due" },
  terms: { ar: "شروط المستند + الدفع الإلكتروني", en: "Document terms + e-payment", hintAr: "بطاقة الشروط وبطاقة الدفع بالرابط و QR", hintEn: "Terms card and pay-by-link card with QR" },
  paymentPlan: { ar: "جدول السداد", en: "Payment schedule", hintAr: "يظهر عند وجود جدول سداد أو دفعات", hintEn: "Shown when a schedule or payments exist" },
  bank: { ar: "بطاقة التحويل البنكي", en: "Bank transfer card", hintAr: "اسم البنك · IBAN · SWIFT", hintEn: "Bank · IBAN · SWIFT" },
  company: { ar: "عن الجهة المُصدِرة", en: "About the issuer", hintAr: "ملاحظة تعريفية بالشركة", hintEn: "Issuer identity note" },
  signatory: { ar: "ممثل الشركة والختم", en: "Signatory & stamp", hintAr: "بطاقة الممثل وبطاقة الختم", hintEn: "Signatory card and stamp card" },
  closing: { ar: "صفحة الشروط والأحكام", en: "Terms & conditions page", hintAr: "صفحة أخيرة بجدول شروط مرقّم", hintEn: "Closing page with numbered clauses" },
};

/** Template colour defaults (data values · saved with the template · not UI tokens).
 *  2026-09-08 · the document palette is the Ledger palette of the accounting app:
 *  ink #1A1E48 · accent #4661C7 (AA on paper) / #5875DB · warm paper #F6F1E8 family.
 *  No document-only palette is invented here. */
export const DEFAULT_BRAND_COLOR = "#4661C7";
export const DEFAULT_COVER_COLOR = "#1A1E48";
export const LEGACY_PRIMARY_COLOR = "#1A1E48";
export const LEGACY_ACCENT_COLOR = "#5875DB";
/** Ledger paper / ink / rules used by the printed sheets. */
export const DOC_PAPER = "#FBF8F2";
export const DOC_PAPER_SOFT = "#F6F1E8";
export const DOC_INK = "#1A1E48";
export const DOC_MUTED = "#5C6480";
export const DOC_RULE = "#E3DACB";

export function defaultSections(): SectionSetting[] {
  return SECTION_IDS.map((id) => ({ id, enabled: true }));
}

/** Normalise whatever is stored (null · partial · unknown ids) into a full ordered list. */
export function normalizeSections(raw: unknown): SectionSetting[] {
  const out: SectionSetting[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const s of raw) {
      const id = typeof s === "string" ? s : s?.id;
      if (!id || !SECTION_IDS.includes(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, enabled: typeof s === "string" ? true : s.enabled !== false });
    }
  }
  for (const id of SECTION_IDS) if (!seen.has(id)) out.push({ id, enabled: true });
  return out;
}

export interface TemplateSpec {
  kind?: string | null;
  coverStyle?: string | null;
  coverTitle?: string | null;
  coverIntro?: string | null;
  coverTitleEn?: string | null;
  coverIntroEn?: string | null;
  brandColor?: string | null;
  coverColor?: string | null;
  sections?: unknown;
  terms?: string | null;
  termsEn?: string | null;
  closingTerms?: string | null;
  closingTermsEn?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  signatoryEmail?: string | null;
  signatoryPhone?: string | null;
  stampUrl?: string | null;
  /** Trailing substring of the company wordmark drawn in the brand colour ("X" for ENSIDEX,
   *  "PROS" for SPECPROS). Null → the engine accents a trailing "X" on an all-Latin name (§14). */
  wordmarkAccent?: string | null;
  footerText?: string | null;
  classification?: string | null;
  classificationEn?: string | null;
  showLogo?: boolean | null;
  showTaxBreakdown?: boolean | null;
  showTerms?: boolean | null;
}

export interface PartySpec {
  name: string;
  nameEn?: string | null;
  legalName?: string | null;
  code?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  /** Reverse ("light") logo variant, for dark grounds. LOGO FRAME LAW: a logo is never
   *  boxed — a dark sheet either carries this variant or the sheet itself turns light. */
  logoLightUrl?: string | null;
  stampUrl?: string | null;
}

export interface LineSpec {
  code?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  /** Net amount (after discount · before tax) */
  subtotal: number;
  taxRate?: number;
  unit?: string | null;
  sectionLabel?: string | null;
  included?: boolean;
  /** Small product image / mark printed beside the line (composed invoices · CEO 2026-09-08).
   *  Drawn bare on the paper — never on a chip, card or filled box. */
  imageUrl?: string | null;
}

export interface PaymentPlanRow {
  label: string;
  note?: string | null;
  net: number;
  tax: number;
  total: number;
  /** SPEC-05 L2 (2026-09-08) · structured instalment (a stored PaymentPlanItem) · the note is derived when absent */
  percent?: number | null;
  condition?: "SIGNATURE" | "MILESTONE" | "PROGRESS" | "DELIVERY" | "DATE" | string | null;
  conditionValue?: string | null;
  billingMethod?: "INVOICE" | "PROGRESS_CLAIM" | string | null;
}

export interface BankSpec {
  name?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  routingNumber?: string | null;
  currency?: string | null;
  holder?: string | null;
}

export interface DocSpec {
  kind: DocKind;
  number: string;
  issueDate: string;
  /** validUntil (quote) · dueDate (invoice) */
  endDate?: string | null;
  currency: string;
  status?: string | null;
  title?: string | null;
  reference?: string | null;
  notes?: string | null;
  termsConditions?: string | null;
  lines: LineSpec[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid?: number;
  paymentLinkUrl?: string | null;
  paymentPlan?: PaymentPlanRow[] | null;
  /** ZATCA / tax QR payload (invoice) */
  qrPayload?: string | null;
  /** Tax rate label · default 15% */
  taxRateLabel?: string | null;
}

export interface RenderInput {
  lang: DocLang;
  template: TemplateSpec | null | undefined;
  org: PartySpec;
  contact: PartySpec | null | undefined;
  doc: DocSpec;
  bank?: BankSpec | null;
  /** Base URL for the self-hosted woff2 fonts (web: "/fonts" · api: "/assets/fonts") */
  fontBase?: string;
  /** QR renderer (text → <svg …>) · omitted = no QR images */
  qr?: (text: string) => string;
  /** Screen-only chrome (print buttons) · print views only */
  actions?: boolean;
  /** Scope class on the root for inline embedding (designer preview) */
  embed?: boolean;
}

export interface RenderOutput {
  html: string;
  css: string;
  body: string;
  sheetCount: number;
  title: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const esc = (s: unknown): string => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const money = (n: number): string => (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number): string => (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const num = (s: unknown, cls = ""): string => `<bdi dir="ltr" class="num${cls ? " " + cls : ""}">${esc(s)}</bdi>`;
const bdi = (s: unknown): string => `<bdi dir="auto">${esc(s)}</bdi>`;
const isoDate = (d: unknown): string => {
  if (!d) return "";
  const s = String(d);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : (() => { try { return new Date(s).toISOString().slice(0, 10); } catch { return s; } })();
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const safeColor = (v: unknown, fallback: string): string => (typeof v === "string" && HEX.test(v) ? v : fallback);
const safeUrl = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return /^(https?:\/\/|data:image\/)/i.test(s) ? s : "";
};
/** Mix a #rrggbb toward white — used for the "lifted" accent on dark sheets, so the
 *  accent stays legible on ink without inventing a second palette. */
function lift(hex: string, amount: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    .map((c) => Math.round(c + (255 - c) * Math.max(0, Math.min(1, amount))));
  return "#" + ch.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const lines = (s: unknown): string[] => String(s ?? "").split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-•·*]|\d+[.)])\s*/, "").trim()).filter(Boolean);

/** "Title | text" · "Title: text" · plain → { title, text } */
function clause(line: string): { title: string; text: string } {
  const m = line.match(/^(.{2,48}?)\s*(?:\||:|—|–)\s+(.+)$/);
  if (m) return { title: m[1].trim(), text: m[2].trim() };
  return { title: "", text: line };
}

/** rough text height: chars per line at a given column width (mm) → mm */
function textHeight(text: string, colMm: number, lineMm = 5.2, charMm = 1.75): number {
  const perLine = Math.max(10, Math.floor(colMm / charMm));
  let n = 0;
  for (const l of String(text || "").split(/\r?\n/)) n += Math.max(1, Math.ceil(l.length / perLine));
  return Math.max(1, n) * lineMm;
}

// ─── paginator ──────────────────────────────────────────────────────────────

type Block =
  | { kind: "html"; h: number; html: string; keepWithNext?: boolean }
  | { kind: "table"; open: string; head: string; headH: number; rows: Array<{ h: number; html: string }>; close: string };

/** Flow blocks into sheets of `capacity` mm. Tables split across sheets with a repeated head. */
function paginate(blocks: Block[], capacity: number): string[] {
  const sheets: string[] = [];
  let cur: string[] = [];
  let used = 0;
  const flush = () => { if (cur.length) { sheets.push(cur.join("")); cur = []; used = 0; } };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "html") {
      let need = b.h;
      if (b.keepWithNext && blocks[i + 1]) {
        const n = blocks[i + 1];
        need += n.kind === "html" ? n.h : n.headH + (n.rows[0]?.h || 0);
      }
      if (used > 0 && used + need > capacity) flush();
      cur.push(b.html); used += b.h;
      continue;
    }
    // table
    let open = false;
    const openTable = () => { cur.push(b.open + b.head); used += b.headH; open = true; };
    const closeTable = () => { if (open) { cur.push(b.close); open = false; } };
    if (used > 0 && used + b.headH + (b.rows[0]?.h || 0) > capacity) flush();
    openTable();
    for (const r of b.rows) {
      if (used + r.h > capacity && used > b.headH) { closeTable(); flush(); openTable(); }
      cur.push(r.html); used += r.h;
    }
    closeTable();
  }
  flush();
  return sheets;
}

// ─── css ────────────────────────────────────────────────────────────────────

function buildCss(brand: string, dark: string, fontBase: string, lang: DocLang, embed: boolean): string {
  const fb = fontBase.replace(/\/$/, "");
  const arabic = "'Entix Doc Arabic','Noto Sans Arabic','IBM Plex Sans Arabic',system-ui,sans-serif";
  const latin = "'Entix Doc Latin','Plus Jakarta Sans','IBM Plex Sans',system-ui,sans-serif";
  const mono = "'Entix Doc Mono','JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
  const body = lang === "ar" ? arabic : latin;
  return `
@font-face{font-family:'Entix Doc Arabic';src:url('${fb}/NotoSansArabic-400-arabic.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF}
@font-face{font-family:'Entix Doc Arabic';src:url('${fb}/NotoSansArabic-700-arabic.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF}
@font-face{font-family:'Entix Doc Arabic';src:url('${fb}/NotoSansArabic-400-latin.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'Entix Doc Arabic';src:url('${fb}/NotoSansArabic-700-latin.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:block}
@font-face{font-family:'Entix Doc Latin';src:url('${fb}/PlusJakartaSans-400-latin.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'Entix Doc Latin';src:url('${fb}/PlusJakartaSans-700-latin.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:block}
@font-face{font-family:'Entix Doc Mono';src:url('${fb}/JetBrainsMono-400-latin.woff2') format('woff2');font-weight:400 700;font-style:normal;font-display:block}
.edoc{--brand:${brand};--brand-lift:${lift(brand, 0.42)};--dark:${dark};--ink:${DOC_INK};--muted:${DOC_MUTED};--soft:${DOC_PAPER_SOFT};--rule:${DOC_RULE};--paper:${DOC_PAPER};
  --font-arabic:${arabic};--font-latin:${latin};--font-mono:${mono};
  font-family:${body};color:var(--ink);font-size:10.5pt;line-height:1.6;-webkit-font-smoothing:antialiased;
  ${embed ? "" : "background:#E9ECF1;padding:16px 0 32px;min-height:100vh;"}}
.edoc *,.edoc *::before,.edoc *::after{box-sizing:border-box}
/* host apps style :lang(ar) per element · the document keeps its own print faces */
.edoc *{font-family:inherit}
.edoc bdi{unicode-bidi:isolate}
.edoc bdi[dir="auto"]{word-break:normal;overflow-wrap:normal}
.edoc .num{font-family:var(--font-mono);direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;white-space:nowrap}
.edoc .lat{font-family:var(--font-latin)}
.edoc .sheet{position:relative;width:210mm;height:297mm;margin:0 auto 14px;background:var(--paper);overflow:hidden;padding:32mm 14mm 20mm;break-after:page;page-break-after:always;box-shadow:0 2px 14px rgba(17,24,39,.10)}
.edoc .sheet:last-child{break-after:auto;page-break-after:auto}
/* §15 · a 3px brand bar across the top of every sheet, dark and light alike */
.edoc .sheet.light{border-top:3px solid var(--brand)}
.edoc .sheet.dark{background:var(--dark);color:#fff;--ink:#fff;--muted:rgba(255,255,255,.70);--rule:rgba(255,255,255,.20);--brand:var(--brand-lift);border-top:3px solid var(--brand-lift)}
.edoc .hdr{position:absolute;top:10mm;left:14mm;right:14mm;height:14mm;display:flex;align-items:center;justify-content:space-between;direction:ltr;gap:8mm}
.edoc .hdr-logo{display:flex;align-items:center;height:14mm;max-width:78mm}
/* ══ LOGO FRAME LAW ══════════════════════════════════════════════════════════
   A logo NEVER sits on a chip, card, plate or rounded box of its own. It is drawn
   directly on the ground: the reverse variant on a dark sheet, the normal variant
   on paper. If a company has no reverse variant, the SHEET turns light — the mark
   is never boxed to rescue it. Do not add background / border / padding / radius
   to .hdr-logo img, .li-img or .stamp-box img in any future edit. */
.edoc .hdr-logo img{max-height:11mm;max-width:72mm;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0;box-shadow:none}
/* the wordmark IS the logo when no image exists · sized as a wordmark, never as an icon */
.edoc .hdr-word{font-family:var(--font-latin);font-weight:800;font-size:24pt;line-height:1;letter-spacing:-.025em;color:var(--ink);white-space:nowrap;max-width:78mm;overflow:hidden;text-overflow:ellipsis;direction:ltr;background:none;border:0;padding:0}
.edoc .hdr-word .x{color:var(--brand)}
.edoc .hdr-word.ar{font-family:var(--font-arabic);font-size:15pt;letter-spacing:0;direction:rtl}
.edoc .hdr-meta{text-align:right;direction:${lang === "ar" ? "rtl" : "ltr"};line-height:1.45}
.edoc .hdr-meta .l1{font-weight:700;font-size:8.5pt;color:var(--ink)}
.edoc .hdr-meta .l2{font-family:var(--font-mono);font-size:7pt;color:var(--muted);direction:ltr}
.edoc .ftr{position:absolute;bottom:9mm;left:14mm;right:14mm;display:flex;align-items:center;justify-content:space-between;direction:ltr;font-size:7pt;color:var(--muted);border-top:.5pt solid var(--rule);padding-top:2.5mm;gap:6mm}
.edoc .ftr .f-left{font-family:var(--font-mono);white-space:nowrap}
.edoc .ftr .f-left bdi{font-family:${lang === "ar" ? "var(--font-arabic)" : "var(--font-latin)"}}
.edoc .ftr .f-mid{font-family:var(--font-mono);white-space:nowrap}
.edoc .ftr .f-right{direction:${lang === "ar" ? "rtl" : "ltr"};text-align:right;white-space:nowrap}
.edoc .dark .ftr{border-top-color:rgba(255,255,255,.16)}
/* cover */
/* cover rhythm follows the reference sheets (SpecPros / ENSIDEX cover PDFs, measured
   2026-09-08): the block starts a fixed distance below the running header — NOT
   bottom-anchored — so the eyebrow sits at ≈25% of the sheet height, the title
   lands mid-page, and the three-column meta closes out around ≈80-85%, leaving a
   modest, deliberate margin above the footer rather than one huge dead band. */
.edoc .cover-body{display:flex;flex-direction:column;height:100%;padding:54mm 0 0}
.edoc .eyebrow{font-family:var(--font-mono);font-size:7.5pt;letter-spacing:.14em;color:var(--brand);text-transform:uppercase}
.edoc .cover-title{font-size:32pt;font-weight:800;line-height:1.25;margin:5mm 0 7mm;letter-spacing:-.015em}
.edoc .cover-title .accent{color:var(--brand)}
.edoc .cover-rule{height:.5pt;background:var(--rule);margin:0 0 7mm}
.edoc .cover-intro{font-size:11.5pt;line-height:1.9;max-width:150mm;color:var(--ink)}
.edoc .cover-intro strong{font-weight:700;color:var(--brand)}
.edoc .cover-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8mm;margin-top:24mm;padding-top:8mm;border-top:.5pt solid var(--rule)}
.edoc .cover-meta .k{font-size:8pt;font-weight:700;color:var(--brand);margin-bottom:1.5mm}
.edoc .cover-meta .v{font-size:11pt;font-weight:700}
.edoc .cover-meta .s{font-size:8.5pt;color:var(--muted);margin-top:1mm}
.edoc .cover-meta .big{font-family:var(--font-mono);font-size:15pt;font-weight:700}
.edoc .cover-meta .col-client{border-inline-start:1.5pt solid var(--brand);padding-inline-start:5mm}
/* inner */
.edoc .doc-head{display:grid;grid-template-columns:46mm 1fr 1fr;gap:8mm;align-items:start;padding-bottom:5mm;border-bottom:1.5pt solid var(--ink);margin-bottom:5mm}
.edoc .doc-head .title{font-size:21pt;font-weight:800;line-height:1.15;letter-spacing:-.01em}
.edoc .party .k{font-size:8pt;font-weight:700;color:var(--muted);margin-bottom:1mm}
.edoc .party .n{font-size:10.5pt;font-weight:700;line-height:1.4}
.edoc .party .n2{font-family:var(--font-latin);font-size:8.5pt;color:var(--muted);direction:ltr;text-align:${lang === "ar" ? "right" : "left"}}
.edoc .party .d{font-size:8pt;color:var(--muted);line-height:1.55;margin-top:1.5mm;overflow-wrap:anywhere}
.edoc .meta-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:0 0 5mm}
.edoc .meta-strip .tile{background:var(--soft);border-radius:2mm;padding:3mm 4mm}
.edoc .meta-strip .k{font-size:7.5pt;color:var(--muted);margin-bottom:.5mm}
.edoc .meta-strip .v{font-size:10pt;font-weight:700}
.edoc table.items{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 5mm}
.edoc table.items th{font-size:8pt;font-weight:700;color:var(--muted);text-align:start;padding:2.5mm 2mm;border-bottom:1.2pt solid var(--ink)}
.edoc table.items td{padding:3mm 2mm;border-bottom:.5pt solid var(--rule);vertical-align:top;font-size:9.5pt;overflow-wrap:anywhere}
.edoc table.items th.n,.edoc table.items td.n{text-align:end}
.edoc table.items .code{font-family:var(--font-mono);font-size:8pt;color:var(--brand);font-weight:700;direction:ltr;unicode-bidi:isolate}
.edoc table.items .head{font-weight:700}
.edoc table.items .rest{font-size:8pt;color:var(--muted);line-height:1.6;margin-top:.5mm;white-space:pre-wrap}
.edoc table.items .sec td{background:var(--soft);font-weight:700;font-size:9pt;padding:2mm}
/* per-line product image / mark · bare on the paper (LOGO FRAME LAW: no box, no plate) */
.edoc table.items td.pic{padding:3mm 1mm 3mm 2mm;vertical-align:top}
.edoc .li-img{width:12mm;height:12mm;object-fit:contain;object-position:center;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc .totals-row{display:grid;grid-template-columns:1fr 100mm;gap:8mm;align-items:start;margin:0 0 6mm}
.edoc .totals{border:.5pt solid var(--rule);border-radius:2mm;overflow:hidden}
.edoc .totals .r{display:flex;justify-content:space-between;align-items:center;gap:4mm;padding:2.6mm 4mm;border-bottom:.5pt solid var(--rule);font-size:9.5pt}
.edoc .totals .r .lbl{font-weight:700}
.edoc .totals .r .sub{display:block;font-size:7.5pt;color:var(--muted);font-weight:400;margin-top:.5mm}
.edoc .totals .r .amt{font-family:var(--font-mono);font-size:9.5pt;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
.edoc .totals .r.disc .lbl,.edoc .totals .r.disc .amt{color:var(--brand)}
.edoc .totals .r.grand{background:var(--dark);color:#fff;border-bottom:0;padding:3.5mm 4mm}
.edoc .totals .r.grand .amt{font-size:13pt;font-weight:700}
.edoc .totals .r.due{background:var(--soft)}
.edoc .qr-side{display:flex;flex-direction:column;align-items:flex-start;gap:2mm;font-size:7.5pt;color:var(--muted);max-width:60mm}
.edoc .qr-side .qr{width:26mm;height:26mm;border:.5pt solid var(--rule);border-radius:1.5mm;padding:1.5mm;background:#fff}
.edoc .qr-side .qr svg{width:100%;height:100%;display:block}
.edoc .cards{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:0 0 6mm}
.edoc .card{border:.5pt solid var(--rule);border-radius:2.5mm;padding:4mm 5mm;min-height:20mm;break-inside:avoid}
.edoc .card .t{font-weight:700;font-size:10pt;margin-bottom:2.5mm}
.edoc .card ul{margin:0;padding:0;list-style:none}
.edoc .card li{position:relative;padding-inline-start:4mm;font-size:8.5pt;line-height:1.65;color:var(--ink);margin-bottom:1.2mm;overflow-wrap:anywhere}
.edoc .card li::before{content:"";position:absolute;inset-inline-start:0;top:2.6mm;width:1.6mm;height:1.6mm;border-radius:50%;background:var(--brand)}
.edoc .epay{display:grid;grid-template-columns:24mm 1fr;gap:4mm;align-items:start}
.edoc .epay .qr{width:24mm;height:24mm;border:.5pt solid var(--rule);border-radius:1.5mm;padding:1.5mm;background:#fff}
.edoc .epay .qr svg{width:100%;height:100%;display:block}
.edoc .epay p{margin:0 0 2mm;font-size:8.5pt;line-height:1.6}
.edoc .epay a{font-family:var(--font-mono);font-size:7.5pt;color:var(--brand);text-decoration:underline;direction:ltr;unicode-bidi:isolate;overflow-wrap:anywhere;display:block}
.edoc .chips{display:flex;flex-wrap:wrap;gap:1.5mm;margin-top:2.5mm}
.edoc .chip{font-size:7pt;border:.5pt solid var(--brand);color:var(--brand);border-radius:99px;padding:.6mm 2.4mm;white-space:nowrap}
.edoc .h2{display:flex;align-items:center;gap:3mm;font-size:15pt;font-weight:800;margin:0 0 3mm;line-height:1.3}
.edoc .h2::before{content:"";display:block;width:1.2mm;height:6mm;background:var(--brand);border-radius:1px}
.edoc .lead{font-size:9.5pt;color:var(--muted);line-height:1.7;margin:0 0 5mm;max-width:160mm}
.edoc .h3{font-size:10.5pt;font-weight:700;margin:0 0 2.5mm}
.edoc table.plan{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 6mm}
.edoc table.plan th{font-size:8pt;color:var(--muted);text-align:start;padding:2mm;border-bottom:1.2pt solid var(--ink)}
.edoc table.plan td{padding:2.4mm 2mm;border-bottom:.5pt solid var(--rule);font-size:9pt;vertical-align:top}
.edoc table.plan .n{text-align:end}
.edoc table.plan .idx{font-family:var(--font-mono);color:var(--brand);font-weight:700;font-size:8pt}
.edoc table.plan tr.sum td{background:var(--soft);font-weight:700}
.edoc .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:0 0 6mm}
.edoc .tile2{background:var(--soft);border-radius:2mm;padding:3mm 4mm}
.edoc .tile2 .k{font-size:7.5pt;color:var(--muted)}
.edoc .tile2 .v{font-size:12pt;font-weight:800;color:var(--brand);line-height:1.3}
.edoc .tile2 .s{font-size:7.5pt;color:var(--muted)}
.edoc .note{display:grid;grid-template-columns:6mm 1fr;gap:3mm;background:#EDF0FB;border:.5pt solid #C9D3F3;border-radius:2.5mm;padding:4mm 5mm;font-size:8.5pt;line-height:1.7;margin:0 0 6mm;break-inside:avoid}
.edoc .note .i{width:5mm;height:5mm;border-radius:50%;border:1pt solid var(--brand);color:var(--brand);font-family:var(--font-latin);font-weight:700;font-size:7pt;display:flex;align-items:center;justify-content:center;margin-top:.8mm}
.edoc .note strong{font-weight:700}
.edoc table.tc{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 6mm}
.edoc table.tc th{font-size:8pt;color:var(--muted);text-align:start;padding:2mm;border-bottom:1.2pt solid var(--ink)}
.edoc table.tc td{padding:2mm 2mm;border-bottom:.5pt solid var(--rule);font-size:8.3pt;line-height:1.55;vertical-align:top;overflow-wrap:anywhere}
.edoc table.tc .idx{font-family:var(--font-mono);color:var(--brand);font-weight:700;font-size:8pt}
.edoc table.tc .ttl{font-weight:700}
/* signatory + stamp · FRAMELESS by CEO instruction (2026-09-08): «الغِ الفريم الي عند
   الختم والفريم الي عند التوقيع» — the stamp must read as ink on the paper, bigger,
   with no card, border or plate behind it. */
.edoc .sig-cards{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin:0 0 6mm;align-items:start;break-inside:avoid}
.edoc .sig{background:none;border:0;padding:0}
.edoc .sig .k{font-size:8pt;color:var(--muted);margin-bottom:2mm}
.edoc .sig .n{font-size:13pt;font-weight:800}
.edoc .sig .c{font-family:var(--font-mono);font-size:8pt;color:var(--muted);direction:ltr;text-align:${lang === "ar" ? "right" : "left"};margin-top:1mm}
.edoc .sig .o{font-size:8pt;color:var(--muted);margin-top:1mm}
.edoc .stamp{background:none;border:0;padding:0}
.edoc .stamp .k{font-size:8pt;color:var(--muted);margin-bottom:2mm}
.edoc .stamp-box{display:flex;align-items:flex-start;justify-content:flex-start;min-height:34mm;background:none;border:0;padding:0}
.edoc .stamp-box img{max-height:40mm;max-width:64mm;object-fit:contain;opacity:.94;mix-blend-mode:multiply;transform:rotate(-5deg);transform-origin:center;background:none;border:0;padding:0;border-radius:0}
.edoc .bank dl{display:grid;grid-template-columns:auto 1fr;gap:1.2mm 5mm;margin:0;font-size:8.5pt}
.edoc .bank dt{color:var(--muted)}
.edoc .bank dd{margin:0;overflow-wrap:anywhere}
.edoc .notes{background:var(--soft);border-radius:2mm;padding:3mm 4mm;font-size:8.5pt;white-space:pre-wrap;margin:0 0 6mm;line-height:1.65}
.edoc .actions{position:fixed;top:12px;${lang === "ar" ? "left" : "right"}:12px;z-index:50;display:flex;gap:8px}
.edoc .actions button{padding:8px 16px;border-radius:8px;border:1px solid #CDD3DC;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:#111827}
.edoc .actions button.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
@media print{
  @page{size:A4;margin:0}
  html,body{margin:0!important;padding:0!important;background:#fff!important;width:auto!important;max-width:100%!important}
  .edoc{background:#fff!important;padding:0!important;min-height:0!important}
  /* host shells (print pages · #root) must add no offset or the 297mm sheets spill into blank pages */
  .edoc-shell,#root{padding:0!important;margin:0!important;min-height:0!important;height:auto!important;overflow:visible!important}
  .edoc .sheet{margin:0!important;box-shadow:none!important}
  .edoc .actions,.edoc .no-print{display:none!important}
  .edoc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`;
}

// ─── render ─────────────────────────────────────────────────────────────────

export function renderDocument(input: RenderInput): RenderOutput {
  const lang = input.lang === "en" ? "en" : "ar";
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const tpl = input.template || {};
  const doc = input.doc;
  const org = input.org;
  const contact = input.contact || null;
  const isQuote = doc.kind === "QUOTE";
  const brand = safeColor(tpl.brandColor, DEFAULT_BRAND_COLOR);
  const dark = safeColor(tpl.coverColor, DEFAULT_COVER_COLOR);
  let coverStyle: CoverStyle = tpl.coverStyle === "LIGHT" ? "LIGHT" : tpl.coverStyle === "NONE" ? "NONE" : "DARK";
  const sections = normalizeSections(tpl.sections);
  const on = (id: SectionId) => sections.find((s) => s.id === id)?.enabled !== false;
  const order = sections.map((s) => s.id);
  const cur = doc.currency || "SAR";
  const year = (isoDate(doc.issueDate) || new Date().toISOString()).slice(0, 4);
  const docType = isQuote ? t("عرض سعر", "Quotation") : t("فاتورة ضريبية", "Tax invoice");
  const hasArabic = (v: unknown) => /[\u0600-\u06FF]/.test(String(v || ""));
  const classification = (ar ? tpl.classification : (tpl.classificationEn || (hasArabic(tpl.classification) ? "" : tpl.classification))) || t("خاص بالعميل", "Client confidential");
  const fileId = doc.number || "";
  const issue = isoDate(doc.issueDate);
  const endLabel = isQuote ? t("صالح حتى", "Valid until") : t("تاريخ الاستحقاق", "Due date");
  const end = isoDate(doc.endDate);
  // ── LOGO FRAME LAW (CEO · 2026-09-08) ────────────────────────────────────
  // «أبدًا لا تضع أي شعار داخل فريم لونه يختلف عن لون الخلفية … لو تغيّر الخلفية كلها
  //  بس ما تسوي الحركة هذه» — a logo is never placed in a box of its own. On a dark
  // sheet only the reverse (light) variant may be drawn; a company that has no reverse
  // variant gets a LIGHT cover instead, so the mark always sits on its own ground.
  const logoOn = tpl.showLogo !== false;
  const logoPaper = logoOn ? safeUrl(org.logoUrl) : "";           // dark mark · light ground
  const logoReverse = logoOn ? safeUrl(org.logoLightUrl) : "";    // light mark · dark ground
  if (coverStyle === "DARK" && logoPaper && !logoReverse) coverStyle = "LIGHT";
  const stamp = safeUrl(tpl.stampUrl) || safeUrl(org.stampUrl);
  const orgName = ar ? org.name : (org.nameEn || org.legalName || org.name);
  const orgAlt = ar ? (org.legalName && org.legalName !== org.name ? org.legalName : org.nameEn) : (org.name !== orgName ? org.name : "");
  const clientName = contact ? (ar ? contact.name : (contact.nameEn || contact.legalName || contact.name)) : "—";
  const clientAlt = contact ? (ar ? (contact.legalName && contact.legalName !== contact.name ? contact.legalName : contact.nameEn) : (contact.name !== clientName ? contact.name : "")) : "";
  const taxLabel = doc.taxRateLabel || t("ضريبة القيمة المضافة 15%", "VAT 15%");
  const footerLeft = tpl.footerText ? esc(tpl.footerText) : `© ${esc(year)} ${esc(org.legalName || org.name)}${org.city ? " · " + bdi(org.city) : ""}`;
  const paid = Number(doc.amountPaid || 0);
  const due = doc.total - paid;
  const included = doc.lines.filter((l) => l.included !== false);
  const optional = doc.lines.filter((l) => l.included === false);
  const listPrice = included.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discount = Math.max(doc.discountTotal || 0, listPrice - doc.subtotal, 0);
  const taxable = doc.subtotal;

  const CAP = 245; // usable mm per inner sheet (297 − 32 top − 20 bottom)

  // ── running header / footer ──
  // The mark is either the uploaded logo (drawn bare) or the company WORDMARK — the
  // letters themselves, at wordmark size, with the trailing accent in the brand colour
  // (ENSIDE·X · SPEC·PROS). Never an icon, never inside a box.
  const wordmarkText = (() => {
    const latin = [org.nameEn, org.legalName, org.name].find((v) => v && !hasArabic(v));
    return String(latin || orgName || "").trim();
  })();
  const wordmarkAr = hasArabic(wordmarkText);
  const wordmarkAccent = (() => {
    const explicit = String(tpl.wordmarkAccent || "").trim();
    if (explicit) return explicit;
    // §14 · an all-Latin mark ending in X carries the blue X by default
    return !wordmarkAr && /^[A-Za-z0-9&.\-' ]+$/.test(wordmarkText) && /x$/i.test(wordmarkText) ? wordmarkText.slice(-1) : "";
  })();
  const wordmark = () => {
    const dir = wordmarkAr ? "rtl" : "ltr";
    const cls = wordmarkAr ? "hdr-word ar" : "hdr-word";
    if (wordmarkAccent && wordmarkText.toLowerCase().endsWith(wordmarkAccent.toLowerCase())) {
      const cut = wordmarkText.length - wordmarkAccent.length;
      return `<span class="${cls}" dir="${dir}">${esc(wordmarkText.slice(0, cut))}<span class="x">${esc(wordmarkText.slice(cut))}</span></span>`;
    }
    return `<span class="${cls}" dir="${dir}">${esc(wordmarkText)}</span>`;
  };
  const markFor = (onDark: boolean) => {
    const src = onDark ? logoReverse : logoPaper;
    return src ? `<img src="${esc(src)}" alt="${esc(orgName)}">` : wordmark();
  };
  const header = (onDark = false) => `<div class="hdr">
  <div class="hdr-logo">${markFor(onDark)}</div>
  <div class="hdr-meta"><div class="l1">${esc(docType)} · ${esc(classification)}</div><div class="l2">${esc(issue)} · ${esc(fileId)}</div></div>
</div>`;
  const footer = (n: number, total: number, cover = false) => `<div class="ftr">
  <span class="f-left">${footerLeft}</span>
  <span class="f-mid">${cover ? `${esc(issue)} · ${esc(fileId)}` : `${n} / ${total}`}</span>
  <span class="f-right">${esc(docType)} · ${esc(classification)}</span>
</div>`;

  const sheets: Array<{ cls: string; body: string; cover?: boolean }> = [];

  // ── cover ──
  if (on("cover") && coverStyle !== "NONE") {
    const title = ((ar ? tpl.coverTitle : (tpl.coverTitleEn || tpl.coverTitle)) || "").trim() || doc.title || docType;
    const fill = (s: string) => s
      .replace(/\{company\}/g, `<strong>${esc(orgName)}</strong>`)
      .replace(/\{client\}/g, `<strong>${esc(clientName)}</strong>`)
      .replace(/\{number\}/g, num(doc.number))
      .replace(/\{reference\}/g, num(doc.reference || "—"))
      .replace(/\{total\}/g, num(`${cur} ${money(doc.total)}`))
      .replace(/\{date\}/g, num(issue))
      .replace(/\{title\}/g, `<strong>${esc(doc.title || "")}</strong>`);
    const introRaw = ((ar ? tpl.coverIntro : (tpl.coverIntroEn || tpl.coverIntro)) || "").trim() || (isQuote
      ? t("عرض سعر مقدَّم من {company} إلى {client}. تجدون في الصفحات التالية البنود والأسعار وشروط العرض، وطريقة القبول والسداد.",
          "A quotation from {company} to {client}. The following pages detail the items, prices, terms of the offer, and how to accept and pay.")
      : t("فاتورة ضريبية صادرة عن {company} إلى {client}. تجدون في الصفحات التالية تفاصيل البنود والضريبة وطريقة السداد.",
          "A tax invoice issued by {company} to {client}. The following pages detail the items, tax and how to pay."));
    const intro = esc(introRaw).replace(/&lt;strong&gt;|&lt;\/strong&gt;/g, "");
    const titleParts = title.split(/\r?\n/).filter(Boolean);
    const titleHtml = titleParts.length > 1
      ? `${esc(titleParts[0])}<br><span class="accent">${esc(titleParts.slice(1).join(" "))}</span>`
      : esc(title);
    const body = `<div class="cover-body">
  <div class="eyebrow">${isQuote ? "QUOTATION" : "TAX INVOICE"} · ${esc(issue)}</div>
  <div class="cover-title">${titleHtml}</div>
  <div class="cover-rule"></div>
  <div class="cover-intro">${fill(intro)}</div>
  <div class="cover-meta">
    <div><div class="k">${isQuote ? t("بيانات العرض", "Quotation") : t("بيانات الفاتورة", "Invoice")}</div>
      <div class="v">${isQuote ? t("رقم العرض", "Quote no.") : t("رقم الفاتورة", "Invoice no.")} ${num(doc.number)}</div>
      <div class="s">${t("تاريخ الإصدار", "Issue date")} ${num(issue)}</div>
      ${end ? `<div class="s">${esc(endLabel)} ${num(end)}</div>` : ""}</div>
    <div><div class="k">${isQuote ? t("الإجمالي شامل الضريبة", "Total incl. tax") : t("المستحق شامل الضريبة", "Total due incl. tax")}</div>
      <div class="big">${cur} ${money(doc.total)}</div>
      <div class="s">${num(money(taxable))} + ${esc(taxLabel)} ${num(money(doc.taxTotal))}</div>
      ${doc.title && title !== doc.title ? `<div class="s">${esc(doc.title)}</div>` : ""}</div>
    <div class="col-client"><div class="k">${t("العميل", "Client")}</div>
      ${contact?.code ? `<div class="v lat" dir="ltr">${esc(contact.code)}</div>` : ""}
      <div class="v">${bdi(clientName)}</div>
      <div class="s">${[contact?.crNumber ? `${t("س.ت", "CR")} ${contact.crNumber}` : "", contact?.city || ""].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</div></div>
  </div>
</div>`;
    sheets.push({ cls: coverStyle === "DARK" ? "dark" : "light", body, cover: true });
  }

  // ── inner flow ──
  const blocks: Block[] = [];

  const partyHtml = (label: string, name: string, alt: string | null | undefined, p: PartySpec | null, showRep: boolean) => {
    const d: string[] = [];
    if (p?.crNumber) d.push(`${t("س.ت", "CR")} ${num(p.crNumber)}`);
    if (p?.vatNumber) d.push(`${t("الرقم الضريبي", "VAT no.")} ${num(p.vatNumber)}`);
    if (p?.address) d.push(bdi(p.address));
    if (p?.city && !(p.address || "").includes(p.city)) d.push(bdi(p.city));
    const contacts = [p?.phone ? num(p.phone) : "", p?.email ? num(p.email) : ""].filter(Boolean).join(" · ");
    if (contacts) d.push(contacts);
    if (p?.website) d.push(num(p.website));
    if (showRep && tpl.signatoryName) d.push(`${t("ممثل الشركة", "Representative")}: <strong>${bdi(tpl.signatoryName)}</strong>`);
    return `<div class="party"><div class="k">${esc(label)}</div><div class="n">${bdi(name)}</div>${alt ? `<div class="n2">${esc(alt)}</div>` : ""}<div class="d">${d.join("<br>")}</div></div>`;
  };

  const headerBlock = (): Block => ({
    kind: "html", h: 76, html: `<div class="doc-head">
  <div><div class="eyebrow">${isQuote ? "QUOTATION" : "TAX INVOICE"}</div><div class="title">${esc(docType)}</div></div>
  ${partyHtml(isQuote ? t("المورد · الجهة المُقدِّمة", "Supplier · issued by") : t("المورد · الجهة المُصدِرة", "Supplier · issued by"), orgName, orgAlt, org, true)}
  ${partyHtml(t("العميل", "Client"), clientName, clientAlt, contact, false)}
</div>
<div class="meta-strip">
  <div class="tile"><div class="k">${isQuote ? t("رقم العرض", "Quote no.") : t("رقم الفاتورة", "Invoice no.")}</div><div class="v">${num(doc.number)}</div></div>
  <div class="tile"><div class="k">${t("تاريخ الإصدار", "Issue date")}</div><div class="v">${num(issue)}</div></div>
  <div class="tile"><div class="k">${esc(endLabel)}</div><div class="v">${num(end || "—")}</div></div>
  <div class="tile"><div class="k">${doc.reference ? t("المرجع", "Reference") : t("العملة", "Currency")}</div><div class="v">${doc.reference ? num(doc.reference) : num(cur)}</div></div>
</div>` });

  /** A line may carry a small product image / mark. Drawn bare beside the line — never boxed. */
  const lineImg = (l: LineSpec) => safeUrl(l.imageUrl);
  const hasPics = doc.lines.some((l) => lineImg(l));

  const itemsBlock = (): Block => {
    const span = hasPics ? 6 : 5;
    const cols = `<colgroup>${hasPics ? `<col style="width:14mm">` : ""}<col style="width:30mm"><col><col style="width:16mm"><col style="width:26mm"><col style="width:28mm"></colgroup>`;
    const head = `<thead><tr>${hasPics ? `<th></th>` : ""}<th>${t("الرمز", "Code")}</th><th>${t("البند", "Item")}</th><th class="n">${t("الكمية", "Qty")}</th><th class="n">${t("السعر", "Price")} (${esc(cur)})</th><th class="n">${t("المبلغ", "Amount")} (${esc(cur)})</th></tr></thead>`;
    const rows: Array<{ h: number; html: string }> = [];
    let lastSec: string | null = null;
    const multi = new Set(included.map((l) => l.sectionLabel || "")).size > 1;
    const row = (l: LineSpec, i: number) => {
      const parts = String(l.description || "").split(/\r?\n/);
      const headTxt = parts[0] || "";
      const rest = parts.slice(1).join("\n").trim();
      const pic = lineImg(l);
      const h = Math.max(hasPics ? 16 : 0, 9 + textHeight(headTxt, 80, 5, 1.9) + (rest ? textHeight(rest, 80, 4.4, 1.5) : 0));
      const code = l.code || (l.unit ? l.unit : "");
      const picCell = hasPics ? `<td class="pic">${pic ? `<img class="li-img" src="${esc(pic)}" alt="">` : ""}</td>` : "";
      return { h, html: `<tr>${picCell}<td><span class="code">${esc(code || String(i + 1).padStart(2, "0"))}</span></td><td><div class="head">${bdi(headTxt)}</div>${rest ? `<div class="rest">${bdi(rest)}</div>` : ""}</td><td class="n">${num(qty(l.quantity))}</td><td class="n">${num(money(l.unitPrice))}</td><td class="n">${num(money(l.subtotal))}</td></tr>` };
    };
    included.forEach((l, i) => {
      const sec = l.sectionLabel || "";
      if (multi && sec !== lastSec) { rows.push({ h: 8, html: `<tr class="sec"><td colspan="${span}">${bdi(sec || t("بنود عامة", "General items"))}</td></tr>` }); lastSec = sec; }
      rows.push(row(l, i));
    });
    if (optional.length) {
      rows.push({ h: 8, html: `<tr class="sec"><td colspan="${span}">${t("بنود اختيارية — غير مشمولة في الإجمالي", "Optional items — not included in the total")}</td></tr>` });
      optional.forEach((l, i) => rows.push(row(l, included.length + i)));
    }
    return { kind: "table", open: `<table class="items">${cols}`, head, headH: 14, rows, close: `</table>` };
  };

  const qrSvg = (text: string) => (input.qr ? input.qr(text) : "");

  const totalsBlock = (): Block => {
    const rows: string[] = [];
    if (discount > 0.005) {
      rows.push(`<div class="r"><span class="lbl">${isQuote ? t("سعر القائمة", "List price") : t("الإجمالي قبل الخصم", "Total before discount")}</span><span class="amt">${cur} ${money(listPrice)}</span></div>`);
      rows.push(`<div class="r disc"><span class="lbl">${t("الخصم", "Discount")}</span><span class="amt">- ${cur} ${money(discount)}</span></div>`);
    }
    rows.push(`<div class="r"><span class="lbl">${t("الخاضع للضريبة", "Taxable amount")}</span><span class="amt">${cur} ${money(taxable)}</span></div>`);
    if (tpl.showTaxBreakdown !== false) rows.push(`<div class="r"><span class="lbl">${esc(taxLabel)}</span><span class="amt">${cur} ${money(doc.taxTotal)}</span></div>`);
    rows.push(`<div class="r grand"><span class="lbl">${isQuote ? t("الإجمالي شامل الضريبة", "Total incl. tax") : t("الإجمالي المستحق", "Total due")}</span><span class="amt">${cur} ${money(doc.total)}</span></div>`);
    if (!isQuote && paid > 0) {
      rows.push(`<div class="r"><span class="lbl">${t("المسدَّد", "Paid")}</span><span class="amt">${cur} ${money(paid)}</span></div>`);
      rows.push(`<div class="r due"><span class="lbl">${t("المتبقي", "Balance due")}</span><span class="amt">${cur} ${money(due)}</span></div>`);
    }
    // ── QR / verification code — ALWAYS present (CEO 2026-09-08: «وين الباركود
    // هذه اشياء بديهية لازم دايم تكون موجودة»). Priority: real ZATCA Phase-1 TLV
    // QR on a tax invoice → the document number as plain text. The payment-link
    // QR (when a pay link exists) is drawn once, in the "pay online" card below —
    // it is intentionally not repeated here to avoid printing the same QR twice.
    const zatcaQr = !isQuote && doc.qrPayload;
    const qrText = zatcaQr ? doc.qrPayload! : (doc.number || "");
    const qr = qrText ? qrSvg(qrText) : "";
    const qrCaption = zatcaQr
      ? t("رمز الفاتورة الضريبية — اسم البائع · الرقم الضريبي · التاريخ · الإجمالي · الضريبة.", "Tax invoice QR — seller · VAT no. · date · total · tax.")
      : t("رمز التحقق من رقم المستند.", "Document verification code.");
    const notesHtml = doc.notes ? `<div class="notes">${bdi(doc.notes)}</div>` : "";
    const side = (qr ? `<div class="qr-side"><div class="qr">${qr}</div><div>${qrCaption}</div></div>` : "") + notesHtml;
    const h = Math.max(10 + rows.length * 9.2 + 8, qr ? 40 : 0) + (doc.notes ? 14 : 0);
    return { kind: "html", h, html: `<div class="totals-row"><div>${side}</div><div class="totals">${rows.join("")}</div></div>` };
  };

  const termsBlock = (): Block | null => {
    const raw = ar ? (doc.termsConditions || tpl.terms || "") : (doc.termsConditions || tpl.termsEn || tpl.terms || "");
    const items = tpl.showTerms === false ? [] : lines(raw);
    const link = safeUrl(doc.paymentLinkUrl);
    if (!items.length && !link) return null;
    const termsCard = items.length ? `<div class="card"><div class="t">${isQuote ? t("شروط العرض", "Terms of this offer") : t("شروط السداد", "Payment terms")}</div><ul>${items.map((i) => `<li>${bdi(i)}</li>`).join("")}</ul></div>` : "";
    const payCard = link ? `<div class="card"><div class="t">${t("الدفع الإلكتروني المباشر", "Pay online")}</div><div class="epay"><div class="qr">${qrSvg(link)}</div><div><p>${t(`امسح الرمز أو افتح الرابط وادفع الإجمالي ${cur} ${money(isQuote ? doc.total : Math.max(due, 0))} بخطوة واحدة — المبلغ شامل الضريبة، بلا رسوم إضافية.`, `Scan the code or open the link and pay ${cur} ${money(isQuote ? doc.total : Math.max(due, 0))} in one step — tax included, no extra fees.`)}</p><a href="${esc(link)}">${esc(link)}</a><div class="chips"><span class="chip">Apple Pay ✓</span><span class="chip">${t("بطاقة ائتمانية / مدى", "Credit card / mada")} ✓</span><span class="chip">${t("بوابة دفع مؤمَّنة", "Secure gateway")} 🔒</span></div></div></div></div>` : "";
    const h = 20 + Math.max(items.reduce((s, i) => s + textHeight(i, 70, 5.2, 1.7), 0), link ? 42 : 0);
    const html = termsCard && payCard ? `<div class="cards">${termsCard}${payCard}</div>` : `<div class="cards" style="grid-template-columns:1fr">${termsCard || payCard}</div>`;
    return { kind: "html", h, html };
  };

  const planBlock = (): Block | null => {
    let plan = doc.paymentPlan || null;
    if ((!plan || !plan.length) && !isQuote && paid > 0) {
      plan = [
        { label: t("المسدَّد حتى تاريخه", "Paid to date"), net: 0, tax: 0, total: paid },
        { label: t("المتبقي", "Balance due"), note: end ? `${t("يستحق في", "Due")} ${end}` : null, net: 0, tax: 0, total: due },
      ];
    }
    if (!plan || !plan.length) return null;
    const hasNet = plan.some((p) => p.net || p.tax);
    const sum = plan.reduce((s, p) => ({ net: s.net + (p.net || 0), tax: s.tax + (p.tax || 0), total: s.total + (p.total || 0) }), { net: 0, tax: 0, total: 0 });
    const planNote = (p: PaymentPlanRow): string | null => {
      if (p.note) return p.note;
      const pct = p.percent ? `${qty(p.percent)}%` : "";
      const v = p.conditionValue || "";
      const cond = p.condition === "SIGNATURE" ? t("عند التوقيع", "On signature")
        : p.condition === "PROGRESS" ? (v ? t(`عند إنجاز ${v}%`, `At ${v}% progress`) : t("حسب نسبة الإنجاز", "By progress"))
        : p.condition === "DELIVERY" ? t("عند التسليم", "On delivery")
        : p.condition === "DATE" ? (v ? t(`يستحق في ${v}`, `Due ${v}`) : "")
        : p.condition === "MILESTONE" ? (v ? t(`عند: ${v}`, `Milestone: ${v}`) : "")
        : "";
      const method = p.billingMethod === "PROGRESS_CLAIM" ? t("مستخلص", "Progress claim") : "";
      return [pct, cond, method].filter(Boolean).join(" · ") || null;
    };
    const rows = plan.map((p, i) => `<tr><td class="idx">${String(i + 1).padStart(2, "0")}</td><td>${bdi(p.label)}${planNote(p) ? `<div class="rest" style="font-size:7.5pt;color:var(--muted)">${bdi(planNote(p))}</div>` : ""}</td>${hasNet ? `<td class="n">${num(money(p.net))}</td><td class="n">${num(money(p.tax))}</td>` : ""}<td class="n"><strong>${num(money(p.total))}</strong></td></tr>`).join("");
    const html = `<div class="h3">${t("جدول السداد", "Payment schedule")}</div><table class="plan"><colgroup><col style="width:10mm"><col>${hasNet ? `<col style="width:30mm"><col style="width:26mm">` : ""}<col style="width:32mm"></colgroup><thead><tr><th>#</th><th>${t("الدفعة", "Instalment")}</th>${hasNet ? `<th class="n">${t("الخاضع", "Net")} (${esc(cur)})</th><th class="n">${t("الضريبة", "Tax")}</th>` : ""}<th class="n">${t("الإجمالي", "Total")}</th></tr></thead><tbody>${rows}${plan.length > 1 && (doc.paymentPlan?.length || 0) > 0 ? `<tr class="sum"><td></td><td>${t("الإجمالي", "Total")}</td>${hasNet ? `<td class="n">${num(money(sum.net))}</td><td class="n">${num(money(sum.tax))}</td>` : ""}<td class="n">${num(money(sum.total))}</td></tr>` : ""}</tbody></table>`;
    return { kind: "html", h: 16 + (plan.length + 1) * 9, html };
  };

  const bankBlock = (): Block | null => {
    const b = input.bank;
    if (!b || (!b.iban && !b.accountNumber)) return null;
    const dl: string[] = [];
    if (b.bankName) dl.push(`<dt>${t("البنك", "Bank")}</dt><dd>${bdi(b.bankName)}</dd>`);
    if (b.holder || org.legalName || org.name) dl.push(`<dt>${t("اسم الحساب", "Account name")}</dt><dd>${bdi(b.holder || org.legalName || org.name)}</dd>`);
    if (b.iban) dl.push(`<dt>IBAN</dt><dd>${num(b.iban)}</dd>`);
    if (b.accountNumber) dl.push(`<dt>${t("رقم الحساب", "Account no.")}</dt><dd>${num(b.accountNumber)}</dd>`);
    if (b.swiftCode) dl.push(`<dt>SWIFT</dt><dd>${num(b.swiftCode)}</dd>`);
    if (b.routingNumber) dl.push(`<dt>Routing</dt><dd>${num(b.routingNumber)}</dd>`);
    if (b.currency) dl.push(`<dt>${t("العملة", "Currency")}</dt><dd>${num(b.currency)}</dd>`);
    return { kind: "html", h: 14 + dl.length * 5.5, html: `<div class="cards" style="grid-template-columns:1fr"><div class="card bank"><div class="t">${t("التحويل البنكي", "Bank transfer")}</div><dl>${dl.join("")}</dl></div></div>` };
  };

  const companyBlock = (): Block => {
    const parts: string[] = [];
    parts.push(`<strong>${t("عن الجهة المُصدِرة:", "About the issuer:")}</strong> <strong>${bdi(ar ? org.name : (org.legalName || org.nameEn || org.name))}</strong>`);
    // identifiers stay LTR-isolated · an un-isolated "2026-001962138" reorders inside Arabic text
    const ids = [org.crNumber ? `${t("س.ت", "CR")} ${num(org.crNumber)}` : "", org.vatNumber ? `${t("الرقم الضريبي", "VAT no.")} ${num(org.vatNumber)}` : ""].filter(Boolean);
    if (ids.length) parts.push(`(${ids.join(" · ")})`);
    const where = [org.address, org.city].filter(Boolean).map(bdi).join(" · ");
    if (where) parts.push(`— ${where}`);
    const ch = [org.phone, org.email, org.website].filter(Boolean).map((v) => num(v)).join(" · ");
    if (ch) parts.push(`· ${ch}`);
    parts.push(t("هي الطرف المتعاقد والمسؤول أمام العميل عن هذا المستند والفوترة والدعم طوال مدة التعامل.", "is the contracting party responsible to the client for this document, invoicing and support throughout the engagement."));
    return { kind: "html", h: 26, html: `<div class="note"><div class="i">i</div><div>${parts.join(" ")}</div></div>` };
  };

  const signatoryBlock = (): Block | null => {
    if (!tpl.signatoryName && !stamp) return null;
    // frameless by instruction · no .card wrapper on either block
    const sig = `<div class="sig"><div class="k">${t("ممثل الشركة", "Company representative")}</div><div class="n">${bdi(tpl.signatoryName || "—")}</div>${tpl.signatoryTitle ? `<div class="o">${bdi(tpl.signatoryTitle)}</div>` : ""}${(tpl.signatoryEmail || tpl.signatoryPhone) ? `<div class="c">${[tpl.signatoryEmail, tpl.signatoryPhone].filter(Boolean).map(esc).join(" · ")}</div>` : ""}<div class="o">${bdi(ar ? org.name : (org.legalName || org.nameEn || org.name))}</div></div>`;
    const st = `<div class="stamp"><div class="k">${t("ختم الشركة", "Company stamp")}</div><div class="stamp-box">${stamp ? `<img src="${esc(stamp)}" alt="">` : ""}</div></div>`;
    // stamp keeps the outer edge in both scripts (right in RTL · right in LTR)
    return { kind: "html", h: 46, html: `<div class="sig-cards">${ar ? st + sig : sig + st}</div>` };
  };

  const closingLines = lines(ar ? tpl.closingTerms : (tpl.closingTermsEn || tpl.closingTerms));
  const hasClosing = on("closing") && closingLines.length > 0;

  for (const id of order) {
    if (!on(id)) continue;
    let b: Block | null = null;
    switch (id) {
      case "header": b = headerBlock(); break;
      case "items": b = itemsBlock(); break;
      case "totals": b = totalsBlock(); break;
      case "terms": b = termsBlock(); break;
      case "paymentPlan": b = planBlock(); break;
      case "bank": b = bankBlock(); break;
      case "company": b = hasClosing ? null : companyBlock(); break;
      case "signatory": b = hasClosing ? null : signatoryBlock(); break;
      default: b = null;
    }
    if (b) blocks.push(b);
  }
  if (!on("header") && doc.notes && !on("totals")) blocks.push({ kind: "html", h: 20, html: `<div class="notes">${bdi(doc.notes)}</div>` });

  for (const page of paginate(blocks, CAP)) sheets.push({ cls: "light", body: page });

  // ── closing page ──
  if (hasClosing) {
    const clauses = closingLines.map(clause);
    const rows = clauses.map((c, i) => ({
      h: 4 + textHeight(c.text, 118, 4.5, 1.42),
      html: `<tr><td class="idx">${String(i + 1).padStart(2, "0")}</td><td class="ttl">${bdi(c.title || "—")}</td><td>${bdi(c.text)}</td></tr>`,
    }));
    const intro: Block = { kind: "html", h: 26, html: `<div class="h2">${t("الشروط والأحكام", "Terms & conditions")}</div><p class="lead">${isQuote
      ? t(`تسري هذه الشروط على عرض السعر ${doc.number} والفاتورة الصادرة بموجبه، وتُعد جزءًا لا يتجزأ من الاتفاق بين الطرفين.`, `These terms apply to quotation ${doc.number} and any invoice issued under it, and form an integral part of the agreement between the parties.`)
      : t(`تسري هذه الشروط على الفاتورة ${doc.number}${doc.reference ? ` بمرجع ${doc.reference}` : ""}.`, `These terms apply to invoice ${doc.number}${doc.reference ? ` (ref. ${doc.reference})` : ""}.`)}</p>` };
    const table: Block = { kind: "table", open: `<table class="tc"><colgroup><col style="width:9mm"><col style="width:34mm"><col></colgroup>`, head: `<thead><tr><th>#</th><th>${t("البند", "Clause")}</th><th>${t("الشرط", "Terms")}</th></tr></thead>`, headH: 9, rows, close: `</table>` };
    const tail: Block[] = [];
    if (on("signatory")) { const s = signatoryBlock(); if (s) tail.push(s); }
    if (on("company")) tail.push(companyBlock());
    for (const page of paginate([intro, table, ...tail], CAP)) sheets.push({ cls: "light", body: page });
  }

  // ── assemble ──
  const total = sheets.length;
  const bodyHtml = sheets.map((s, i) => `<section class="sheet ${s.cls}" data-page="${i + 1}">${header(s.cls === "dark")}${s.body}${footer(i + 1, total, !!s.cover)}</section>`).join("\n");
  const actions = input.actions ? `<div class="actions no-print"><button class="primary" type="button" onclick="window.print()">${t("طباعة / حفظ PDF", "Print / save PDF")}</button><button type="button" onclick="window.close()">${t("إغلاق", "Close")}</button></div>` : "";
  const css = buildCss(brand, dark, input.fontBase || "/fonts", lang, !!input.embed);
  const body = `<div class="edoc" dir="${ar ? "rtl" : "ltr"}" lang="${lang}" data-sheets="${total}">${actions}${bodyHtml}</div>`;
  const title = `${doc.number}${contact?.name ? " · " + contact.name : ""}`;
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${ar ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>html,body{margin:0;padding:0;background:#E9ECF1}${css}</style>
</head>
<body>${body}</body>
</html>`;
  return { html, css, body, sheetCount: total, title };
}

// ─── adapters (loose typing · both API records and web API objects) ─────────

const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export function partyFromOrg(org: any): PartySpec {
  if (!org) return { name: "" };
  const address = [org.buildingNumber, org.streetName, org.district, org.city, org.region, org.postalCode].filter(Boolean).join(" · ");
  return {
    name: org.name || org.legalName || "",
    nameEn: org.nameEn || org.legalName || null,
    legalName: org.legalName || null,
    vatNumber: org.vatNumber || null,
    crNumber: org.crNumber || null,
    address: address || null,
    city: org.city || null,
    phone: org.phone || null,
    email: org.email || null,
    website: org.website || null,
    logoUrl: org.printLogoUrl || org.logoUrl || null,
    logoLightUrl: org.printLogoLightUrl || null,
    stampUrl: org.stampUrl || null,
  };
}

export function partyFromContact(c: any): PartySpec | null {
  if (!c) return null;
  const address = [c.addressLine1, c.addressLine2, c.district, c.city, c.postalCode].filter(Boolean).join(" · ");
  return {
    name: c.displayName || c.legalName || c.name || "",
    nameEn: c.nameEn || null,
    legalName: c.legalName || null,
    code: c.customCode || c.code || null,
    vatNumber: c.vatNumber || c.taxId || null,
    crNumber: c.crNumber || null,
    address: address || null,
    city: c.city || null,
    phone: c.phone || null,
    email: c.email || null,
    website: c.website || null,
  };
}

function lineSpec(l: any, code?: string | null): LineSpec {
  const q = n(l.quantity), p = n(l.unitPrice), d = n(l.discount);
  const rate = typeof l.taxRate === "number" ? l.taxRate : (l.taxRate && typeof l.taxRate === "object" ? n(l.taxRate.rate) : 0);
  return {
    code: code ?? (l.code || l.product?.sku || l.product?.code || null),
    description: String(l.description || ""),
    quantity: q,
    unitPrice: p,
    discount: d,
    subtotal: l.subtotal !== undefined && l.subtotal !== null ? n(l.subtotal) : q * p - d,
    taxRate: rate,
    unit: l.unit || null,
    sectionLabel: l.sectionLabel || null,
    included: l.included !== false,
    imageUrl: l.imageUrl || l.product?.imageUrl || null,
  };
}

/**
 * doc.paymentPlan accepts engine rows OR a stored PaymentPlan ({ items: [{ label · percent · amount ·
 * condition · conditionValue · billingMethod }] }) · SPEC-05 L2 (2026-09-08). A stored item's amount
 * is its share of the document total; net / tax are split by the document's own tax ratio.
 */
function planRows(plan: any, taxTotal: number, total: number): PaymentPlanRow[] | null {
  if (!plan) return null;
  if (Array.isArray(plan)) return plan.length ? plan : null;
  const items: any[] = Array.isArray(plan.items) ? plan.items : [];
  if (!items.length) return null;
  const taxShare = total > 0 ? taxTotal / total : 0;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return items.map((it) => {
    const amount = r2(n(it.amount) || (total * n(it.percent)) / 100);
    const tax = r2(amount * taxShare);
    return {
      label: String(it.label || ""),
      note: it.note || null,
      net: r2(amount - tax),
      tax,
      total: amount,
      percent: n(it.percent) || null,
      condition: it.condition || null,
      conditionValue: it.conditionValue || null,
      billingMethod: it.billingMethod || null,
    };
  });
}

export function docFromQuote(q: any): DocSpec {
  return {
    kind: "QUOTE",
    number: q.quoteNumber || "",
    issueDate: isoDate(q.issueDate),
    endDate: isoDate(q.validUntil),
    currency: q.currency || "SAR",
    status: q.status || null,
    title: q.title || null,
    reference: q.reference || null,
    notes: q.notes || null,
    termsConditions: q.termsConditions || null,
    lines: (q.lines || []).map((l: any) => lineSpec(l)),
    subtotal: n(q.subtotal),
    discountTotal: n(q.discountTotal),
    taxTotal: n(q.taxTotal),
    total: n(q.total),
    paymentLinkUrl: q.paymentLinkUrl || null,
    paymentPlan: planRows(q.paymentPlan, n(q.taxTotal), n(q.total)),
  };
}

export function docFromInvoice(inv: any, qrPayload?: string | null): DocSpec {
  return {
    kind: "INVOICE",
    number: inv.invoiceNumber || "",
    issueDate: isoDate(inv.issueDate),
    endDate: isoDate(inv.dueDate),
    currency: inv.currency || "SAR",
    status: inv.status || null,
    title: inv.title || null,
    reference: inv.reference || null,
    notes: inv.notes || null,
    termsConditions: inv.termsConditions || null,
    lines: (inv.lines || []).map((l: any) => lineSpec(l)),
    subtotal: n(inv.subtotal),
    discountTotal: n(inv.discountTotal),
    taxTotal: n(inv.taxTotal),
    total: n(inv.total),
    amountPaid: n(inv.amountPaid),
    paymentLinkUrl: inv.paymentLinkUrl || null,
    paymentPlan: planRows(inv.paymentPlan, n(inv.taxTotal), n(inv.total)),
    qrPayload: qrPayload ?? inv.zatcaQr ?? null,
  };
}

/** Sample document for the designer preview (long realistic values). */
export function sampleInput(kind: DocKind, lang: DocLang, template: TemplateSpec | null | undefined, org?: PartySpec | null, bank?: BankSpec | null): RenderInput {
  const ar = lang === "ar";
  const orgSpec: PartySpec = org && org.name ? org : {
    name: ar ? "شركة الأساسية للإلكترونيات المحدودة" : "AL-ASASYAH BASIC ELECTRONICS CO. LTD",
    nameEn: "AL-ASASYAH BASIC ELECTRONICS CO. LTD",
    legalName: "AL-ASASYAH BASIC ELECTRONICS CO. LTD",
    vatNumber: "311691775200003", crNumber: "1010889599",
    address: ar ? "7421 الطريق الدائري الشرقي الفرعي · حي الروضة" : "7421 East Ring Road · Al Rawdah",
    city: ar ? "الرياض 13213" : "Riyadh 13213", phone: "800-111-0110", email: "info@example.sa", website: "example.sa",
  };
  const contact: PartySpec = {
    name: ar ? "شركة بوابات التصاميم الهندسية" : "Bawabat Altasamim Alhandasiah Company",
    nameEn: "Bawabat Altasamim Alhandasiah Company", legalName: "Bawabat Altasamim Alhandasiah Company",
    code: "EDG · edg.sa", vatNumber: "314976132800003", crNumber: "7055039445",
    address: ar ? "مبنى 6143 · طريق الملك عبدالعزيز بن عبدالرحمن سعود · حي العارض" : "Bldg 6143 · King Abdulaziz Road · Al Arid",
    city: ar ? "الرياض 13342" : "Riyadh 13342", phone: "+966 54 310 1464", email: "info@edg.sa",
  };
  const lines: LineSpec[] = [
    { code: "SP-ENT-ENTP-YR", description: ar ? "ENTIX Books · باقة المؤسسات · اشتراك سنوي · إعداد مقاولات\nالنظام المحاسبي الكامل بلا حدود على المستخدمين أو الفروع أو المشاريع · إعداد مخصص لنشاط المقاولات (مشاريع ومراكز تكلفة ودليل حسابات مقاولات) · ترحيل البيانات الحالية · قالب فواتير بهوية الشركة · دعم فني ذو أولوية طوال مدة الاشتراك · 12 شهرًا من تاريخ التفعيل" : "ENTIX Books · Enterprise plan · annual subscription · contracting setup\nFull cloud accounting with unlimited users, branches and projects · contracting-specific setup (projects, cost centres, chart of accounts) · data migration · branded invoice template · priority support for the whole term · 12 months from activation", quantity: 1, unitPrice: 2990, subtotal: 1200, taxRate: 0.15 },
    { code: "SP-SRV-ONB", description: ar ? "جلسة تعريفية وتسليم الحساب\nترحيل العملاء والموردين ودليل الحسابات · مراجعة الأرصدة الافتتاحية" : "Onboarding & hand-over session\nCustomers, suppliers and chart-of-accounts migration · opening balances review", quantity: 2, unitPrice: 750, subtotal: 1500, taxRate: 0.15 },
    { code: "SP-SRV-TRN", description: ar ? "تدريب فريق المحاسبة — 3 جلسات عن بُعد" : "Accounting team training — 3 remote sessions", quantity: 3, unitPrice: 400, subtotal: 1200, taxRate: 0.15 },
  ];
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const tax = subtotal * 0.15;
  const doc: DocSpec = {
    kind,
    number: kind === "QUOTE" ? "SP-Q-0001" : "SP-INV-2026032608",
    issueDate: "2026-09-07",
    endDate: "2026-10-07",
    currency: "SAR",
    title: ar ? "محاسبة مقاولات\nتُدار من المشروع" : "Contracting accounting\nrun from the project",
    reference: kind === "INVOICE" ? "SP-Q-0001" : null,
    notes: null,
    termsConditions: null,
    lines,
    subtotal,
    discountTotal: 1790,
    taxTotal: tax,
    total: subtotal + tax,
    amountPaid: 0,
    paymentLinkUrl: "https://buy.stripe.com/cNiaEWcmM6RR5iVg0n7Vm0H",
    paymentPlan: kind === "QUOTE" ? [1, 2, 3, 4, 5].map((y) => ({ label: y === 1 ? (ar ? "عند قبول العرض — تفعيل الحساب" : "On acceptance — account activation") : (ar ? `مقدّمًا قبل بداية سنة الاشتراك ${y}` : `In advance before subscription year ${y}`), net: 1200, tax: 180, total: 1380 })) : null,
    qrPayload: kind === "INVOICE" ? "AQ9TYW1wbGUgU2VsbGVyAg8zMTE2OTE3NzUyMDAwMDMDFDIwMjYtMDktMDdUMDA6MDA6MDBaBAc0NDg1LjAwBQY1ODUuMDA=" : null,
  };
  return { lang, template, org: orgSpec, contact, doc, bank: bank || { bankName: ar ? "البنك الأهلي السعودي" : "Saudi National Bank", iban: "SA03 8000 0000 6080 1016 7519", swiftCode: "NCBKSAJE", currency: "SAR" }, embed: true };
}
