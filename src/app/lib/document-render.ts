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

// ─── free-form pages (CEO 2026-09-13 · «إمكانية إضافة صفحات · مثل Gamma») ──────
// Extra pages written INSIDE the platform (scope · requirements · method · photos) and
// printed by this same engine, in the document's own identity. Stored as JSON blocks —
// never HTML — so the renderer stays the only thing that produces markup.

export type PageBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "note"; text: string }
  | { type: "image"; url: string; caption?: string | null };

export interface DocPage { title: string; blocks: PageBlock[] }

export const PAGE_LIMITS = { pages: 20, blocks: 60, items: 40, cols: 6, rows: 60, text: 4000 } as const;
export const PAGE_BLOCK_TYPES: PageBlock["type"][] = ["heading", "paragraph", "bullets", "numbered", "table", "note", "image"];

const clipText = (v: unknown, max: number = PAGE_LIMITS.text): string => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, max);
const clipList = (v: unknown, max: number = PAGE_LIMITS.items): string[] =>
  (Array.isArray(v) ? v : []).map((x) => clipText(x, 600).trim()).filter(Boolean).slice(0, max);

/** Normalise whatever is stored/posted (null · partial · unknown block types) into a safe DocPage[].
 *  Unknown types and empty blocks are dropped; sizes are clipped to PAGE_LIMITS. */
export function normalizePages(raw: unknown): DocPage[] {
  if (!Array.isArray(raw)) return [];
  const out: DocPage[] = [];
  for (const p of raw.slice(0, PAGE_LIMITS.pages)) {
    if (!p || typeof p !== "object") continue;
    const blocks: PageBlock[] = [];
    for (const b of (Array.isArray((p as any).blocks) ? (p as any).blocks : []).slice(0, PAGE_LIMITS.blocks)) {
      if (!b || typeof b !== "object") continue;
      switch ((b as any).type) {
        case "heading": case "paragraph": case "note": {
          const text = clipText((b as any).text).trim();
          if (text) blocks.push({ type: (b as any).type, text });
          break;
        }
        case "bullets": case "numbered": {
          const items = clipList((b as any).items);
          if (items.length) blocks.push({ type: (b as any).type, items });
          break;
        }
        case "table": {
          const header = clipList((b as any).header, PAGE_LIMITS.cols);
          const rows = (Array.isArray((b as any).rows) ? (b as any).rows : [])
            .map((r: unknown) => (Array.isArray(r) ? r : []).map((c) => clipText(c, 600).trim()).slice(0, PAGE_LIMITS.cols))
            .filter((r: string[]) => r.some(Boolean))
            .slice(0, PAGE_LIMITS.rows);
          if (header.length || rows.length) blocks.push({ type: "table", header, rows });
          break;
        }
        case "image": {
          const url = clipText((b as any).url, 2_000_000).trim();
          if (url) blocks.push({ type: "image", url, caption: clipText((b as any).caption, 300).trim() || null });
          break;
        }
        default: break;
      }
    }
    const title = clipText((p as any).title, 200).trim();
    if (title || blocks.length) out.push({ title, blocks });
  }
  return out;
}

// ─── document identity (2026-09-14 · «هوية المستند» · per-org quotes/invoices) ──────
// Every token below is DATA saved with the template — chosen by the client in the designer,
// never a UI token. When none of these fields is set the engine renders EXACTLY the
// Ledger document of 2026-09-08 (regression-locked · see hasIdentity()).

export interface DocTheme {
  ink: string; navy: string; deep: string; steel: string; rule: string; chip: string; fill: string;
  slate: string; serial: string; wash: string; line: string; muted: string; paper: string;
  /** corner radius of cards / tables / boxes in identity mode · "2px" (ink-white) · "6px" (ledger · unused by the Ledger sheet) */
  radius?: string | null;
  /** embedded face keys · see DOC_FONT_OPTIONS (no CDN fonts — ever) */
  fontArabic?: DocFontArabic | null;
  fontLatin?: DocFontLatin | null;
  fontMono?: DocFontMono | null;
}
export type ThemePreset = "ledger" | "ink-white" | "custom";
export type HeaderStyle = "bar" | "centered";
export type PaymentPlanStyle = "table" | "stations";
export interface ClosingFact { label: string; value: string }
export type DocFontArabic = "noto" | "tajawal" | "ibm-plex-arabic";
export type DocFontLatin = "plus-jakarta" | "ibm-plex";
export type DocFontMono = "jetbrains";
export const DOC_FONT_OPTIONS = {
  arabic: [
    { id: "noto", label: "Noto Sans Arabic" },
    { id: "tajawal", label: "Tajawal" },
    { id: "ibm-plex-arabic", label: "IBM Plex Sans Arabic" },
  ] as Array<{ id: DocFontArabic; label: string }>,
  latin: [
    { id: "plus-jakarta", label: "Plus Jakarta Sans" },
    { id: "ibm-plex", label: "IBM Plex Sans" },
  ] as Array<{ id: DocFontLatin; label: string }>,
  mono: [{ id: "jetbrains", label: "JetBrains Mono" }] as Array<{ id: DocFontMono; label: string }>,
} as const;

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
  /** Second (Arabic) role line printed under signatoryTitle · identity mode only (reference EDG). */
  signatoryTitleAr?: string | null;
  signatoryEmail?: string | null;
  signatoryPhone?: string | null;
  /** Real signature image (uploaded) · preferred over the pen-style name rendering when present. */
  signatureUrl?: string | null;
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
  /** Template note (the stored record's `notes`) · identity quote: the tax note under the QR card */
  notes?: string | null;
  // ── identity (all optional · null = Ledger behaviour) ──
  theme?: DocTheme | null;
  themePreset?: ThemePreset | string | null;
  headerStyle?: HeaderStyle | string | null;
  /** Template-level marks · override the org's print logo when set */
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  watermarkUrl?: string | null;
  coverImageUrl?: string | null;
  closingImageUrl?: string | null;
  bankLogoUrl?: string | null;
  outOfScope?: string | null;
  outOfScopeEn?: string | null;
  paymentPlanStyle?: PaymentPlanStyle | string | null;
  paymentPlanNote?: string | null;
  showQr?: boolean | null;
  hideProviderBranding?: boolean | null;
  closingFacts?: ClosingFact[] | null;
  /** default true (identity templates) · the tafqit strip under the totals */
  amountInWords?: boolean | null;
  // ── round 2 (2026-09-14 · reference EDG-Q-2026-0010) · identity QUOTE pages ──
  /** Delivery & bank page · key/value rows (مدة التسليم · موقع التنفيذ · الضمان · مدة سداد المستخلصات) */
  deliveryFacts?: ClosingFact[] | null;
  /** Delivery & bank page · boxed note under the facts */
  deliveryNote?: string | null;
  /** Approval page · one-paragraph statement */
  approvalText?: string | null;
  /** Approval page · bottom boxed note («اعتماد العرض: يكفي الرد كتابيًا …») */
  approvalNote?: string | null;
  /** Closing page · one muted sentence under the project title */
  closingText?: string | null;
  /** Meta-strip caption for doc.reference2 (default "REFERENCE") */
  reference2Label?: string | null;
}

export interface PartySpec {
  name: string;
  nameEn?: string | null;
  legalName?: string | null;
  code?: string | null;
  /** ISO 3166-1 alpha-2. Drives the tax vocabulary (§ tax-registration law below) —
   *  never a hardcoded company-name list. Missing → treated as "SA" (existing default). */
  country?: string | null;
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
  signatureUrl?: string | null;
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
  /** Per-document print language override · "ar" | "en" · null → caller/org default */
  language?: DocLang | null;
  /** Free-form pages written in the platform · printed after the main flow, before the T&C page */
  pages?: DocPage[] | null;
  /** Per-document «خارج نطاق هذا العرض» · overrides the template default */
  outOfScope?: string | null;
  /** Scope of work paragraph (identity quote page 2) · quote.scope → coverIntro → intro · falls back to the template coverIntro */
  scope?: string | null;
  /** Second reference («EDG / 26 / 010») · meta-strip cell omitted when absent */
  reference2?: string | null;
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

// ─── identity helpers ───────────────────────────────────────────────────────

/** Ledger = today's document exactly · ink-white = the EDG reference (2026-09-14). */
export const DOC_THEME_PRESETS: Record<"ledger" | "ink-white", DocTheme> = {
  ledger: {
    ink: DOC_INK, navy: DEFAULT_COVER_COLOR, deep: DEFAULT_COVER_COLOR, steel: DEFAULT_BRAND_COLOR, rule: DOC_INK,
    chip: LEGACY_ACCENT_COLOR, fill: DOC_PAPER_SOFT, slate: DOC_MUTED, serial: DOC_INK, wash: DOC_PAPER_SOFT,
    line: DOC_RULE, muted: DOC_MUTED, paper: DOC_PAPER, radius: "6px", fontArabic: "noto", fontLatin: "plus-jakarta", fontMono: "jetbrains",
  },
  "ink-white": {
    ink: "#231F20", navy: "#1B2A41", deep: "#212B4F", steel: "#4675AD", rule: "#537197", chip: "#A7D1EA", fill: "#DCEFF6",
    slate: "#333F4B", serial: "#ED1D24", wash: "#F7F9FB", line: "#DFE4EA", muted: "#5B6577", paper: "#FFFFFF", radius: "2px",
    fontArabic: "tajawal", fontLatin: "plus-jakarta", fontMono: "jetbrains",
  },
};
const THEME_KEYS: Array<keyof DocTheme> = ["ink", "navy", "deep", "steel", "rule", "chip", "fill", "slate", "serial", "wash", "line", "muted", "paper"];

/** Preset + saved overrides → a complete, validated token set (bad hex → preset value). */
export function resolveTheme(tpl: TemplateSpec | null | undefined): DocTheme {
  const t = tpl || {};
  const preset = t.themePreset === "ink-white" ? "ink-white" : "ledger";
  const base = DOC_THEME_PRESETS[preset];
  const raw: any = t.theme && typeof t.theme === "object" ? t.theme : {};
  const out: DocTheme = { ...base };
  for (const k of THEME_KEYS) (out as any)[k] = safeColor(raw[k], base[k] as string);
  out.fontArabic = DOC_FONT_OPTIONS.arabic.some((f) => f.id === raw.fontArabic) ? raw.fontArabic : base.fontArabic;
  out.fontLatin = DOC_FONT_OPTIONS.latin.some((f) => f.id === raw.fontLatin) ? raw.fontLatin : base.fontLatin;
  out.fontMono = "jetbrains";
  out.radius = typeof raw.radius === "string" && /^\d{1,2}(\.\d)?(px|mm)$/.test(raw.radius) ? raw.radius : base.radius;
  // Ledger templates keep their two legacy colour fields as the accent / cover pair
  if (preset === "ledger" && !t.theme) { out.steel = safeColor(t.brandColor, out.steel); out.navy = safeColor(t.coverColor, out.navy); out.deep = out.navy; }
  return out;
}

/** True when the template carries its own identity (theme · preset ≠ ledger · any identity field). */
export function hasIdentity(tpl: TemplateSpec | null | undefined): boolean {
  if (!tpl) return false;
  if (isThemed(tpl)) return true;
  const set = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;
  return set(tpl.headerStyle && tpl.headerStyle !== "bar") || set(tpl.logoUrl) || set(tpl.logoLightUrl) || set(tpl.watermarkUrl)
    || set(tpl.coverImageUrl) || set(tpl.closingImageUrl) || set(tpl.bankLogoUrl) || set(tpl.outOfScope) || set(tpl.outOfScopeEn)
    || set(tpl.paymentPlanStyle && tpl.paymentPlanStyle !== "table") || set(tpl.paymentPlanNote) || tpl.showQr === true
    || tpl.hideProviderBranding === true || (Array.isArray(tpl.closingFacts) && tpl.closingFacts.length > 0) || tpl.amountInWords === true
    || (Array.isArray(tpl.deliveryFacts) && tpl.deliveryFacts.length > 0) || set(tpl.deliveryNote) || set(tpl.approvalText) || set(tpl.approvalNote) || set(tpl.closingText);
}
/** Theme tokens drive the CSS only for a themed template (preset ink-white / custom, or a saved theme object). */
function isThemed(tpl: TemplateSpec | null | undefined): boolean {
  if (!tpl) return false;
  if (tpl.themePreset === "ink-white" || tpl.themePreset === "custom") return true;
  return !!(tpl.theme && typeof tpl.theme === "object" && tpl.themePreset !== "ledger");
}

// ─── tafqit · amount in words (SAR) ──────────────────────────────────────────
const AR_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
function arBelow1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(AR_HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(AR_ONES[r]);
    else { const o = r % 10, tn = Math.floor(r / 10); parts.push(o ? `${AR_ONES[o]} و${AR_TENS[tn]}` : AR_TENS[tn]); }
  }
  return parts.join(" و");
}
/** n × unit with Arabic counted-noun agreement · (one, two, 3-10 plural, 11+ accusative singular) */
function arScale(n: number, forms: { one: string; two: string; plural: string; acc: string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const r = n % 100;
  if (n >= 3 && n <= 10) return `${arBelow1000(n)} ${forms.plural}`;
  if (r === 0) return `${arNumber(n)} ${forms.one}`;
  if (r === 1) return `${arNumber(n - 1)} و${forms.one}`;
  if (r === 2) return `${arNumber(n - 2)} و${forms.two}`;
  if (r >= 3 && r <= 10) return `${arNumber(n)} ${forms.plural}`;
  return `${arNumber(n)} ${forms.acc}`;
}
function arNumber(n: number): string {
  if (n === 0) return "صفر";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000), thousands = Math.floor((n % 1_000_000) / 1000), rest = n % 1000;
  if (millions) parts.push(arScale(millions, { one: "مليون", two: "مليونان", plural: "ملايين", acc: "مليونًا" }));
  if (thousands) parts.push(arScale(thousands, { one: "ألف", two: "ألفان", plural: "آلاف", acc: "ألفًا" }));
  if (rest) parts.push(arBelow1000(rest));
  return parts.join(" و");
}
const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function enNumber(n: number): string {
  if (n === 0) return "zero";
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    const p: string[] = [];
    if (h) p.push(`${EN_ONES[h]} hundred`);
    if (r) p.push(r < 20 ? EN_ONES[r] : `${EN_TENS[Math.floor(r / 10)]}${r % 10 ? "-" + EN_ONES[r % 10] : ""}`);
    return p.join(" ");
  };
  const parts: string[] = [];
  const m = Math.floor(n / 1_000_000), k = Math.floor((n % 1_000_000) / 1000), r = n % 1000;
  if (m) parts.push(`${below1000(m)} million`);
  if (k) parts.push(`${below1000(k)} thousand`);
  if (r) parts.push(below1000(r));
  return parts.join(" ");
}
/** «فقط ستة آلاف وسبعة وثلاثون ريالاً وخمسون هللة سعوديًا لا غير» · "Only … Saudi Riyals" */
export function tafqitSar(amount: number, lang: DocLang): string {
  const total = Math.round((Number.isFinite(amount) ? Math.abs(amount) : 0) * 100);
  const riyals = Math.floor(total / 100), halalas = total % 100;
  if (lang === "en") {
    const r = `${enNumber(riyals)} Saudi Riyal${riyals === 1 ? "" : "s"}`;
    const h = halalas ? ` and ${enNumber(halalas)} halala${halalas === 1 ? "" : "s"}` : "";
    const words = r + h;
    return `Only ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  }
  const rr = riyals % 100;
  // round hundreds / thousands / millions take the singular in construct («ألفا ريال» · «مائة ريال»)
  const riyalWord = riyals === 0 ? "" : riyals === 1 ? "ريال واحد" : riyals === 2 ? "ريالان"
    : rr === 0 ? `${arNumber(riyals).replace(/(ألفان|مليونان|مائتان)$/, (m) => m.slice(0, -1))} ريال`
    : `${arNumber(riyals)} ${(riyals <= 10 || (rr >= 3 && rr <= 10)) ? "ريالات" : "ريالاً"}`;
  const hr = halalas % 100;
  const halalaWord = halalas === 0 ? "" : halalas === 1 ? "هللة واحدة" : halalas === 2 ? "هللتان"
    : `${arNumber(halalas)} ${(hr >= 3 && hr <= 10) ? "هللات" : "هللة"}`;
  const words = [riyalWord, halalaWord].filter(Boolean).join(" و") || "صفر ريال";
  return `فقط ${words} سعوديًا لا غير`;
}

// ─── ZATCA phase-1 TLV QR (quotes carry it only when the template asks · showQr) ──
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function base64(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? "=" : B64[(n >> 6) & 63]) + (c === undefined ? "=" : B64[n & 63]);
  }
  return out;
}
export function zatcaTlvBase64(f: { sellerName: string; vatNumber: string; timestampIso: string; total: number; vat: number }): string {
  const fields: Array<[number, string]> = [[1, f.sellerName], [2, f.vatNumber], [3, f.timestampIso], [4, (Number(f.total) || 0).toFixed(2)], [5, (Number(f.vat) || 0).toFixed(2)]];
  const bytes: number[] = [];
  for (const [tag, value] of fields) { const v = utf8Bytes(value); bytes.push(tag, v.length & 255, ...v); }
  return base64(bytes);
}
/** "SA0380000000608010167519" → "SA03 8000 0000 6080 1016 7519" */
const ibanGroups = (v: string): string => String(v || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

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
  /** `bottom` (identity · 2026-09-14): budgeted like any block but rendered in the sheet's bottom slot
   *  (a note «near the footer») · never overlaps the footer band because it is part of the budget. */
  | { kind: "html"; h: number; html: string; keepWithNext?: boolean; forceBreak?: boolean; bottom?: boolean; optional?: boolean }
  /** `cont` · continuation caption («يتبع») printed under a table that splits to the next sheet · budgeted 6mm */
  | { kind: "table"; open: string; head: string; headH: number; rows: Array<{ h: number; html: string }>; close: string; cont?: string };

interface Sheet { flow: string; bottom: string; used: number }

/** Flow blocks into sheets of `capacity` mm. Tables split across sheets with a repeated head.
 *  Word-like law: a block that does not fit moves WHOLE to the next sheet (never clipped, never
 *  under the footer); a sheet is flushed only when the next block would not fit — so no
 *  half-empty page is emitted when the next block would have fit. Budgeting is by the known
 *  block heights (line-count estimates) — nothing is measured at runtime. */
function paginate(blocks: Block[], capacity: number): Sheet[] {
  const sheets: Sheet[] = [];
  let cur: string[] = [];
  let bot: string[] = [];
  let used = 0;
  const flush = () => { if (cur.length || bot.length) { sheets.push({ flow: cur.join(""), bottom: bot.join(""), used }); cur = []; bot = []; used = 0; } };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "html") {
      // forceBreak (closing page title 2026-09-08 · «سوي صفحة الشروط والاحكام مستقلة»):
      // the terms & conditions page always STARTS a fresh sheet, however much room the
      // previous sheet had left — a standalone page by construction, not by accident.
      if (b.forceBreak && used > 0) flush();
      let need = b.h;
      if (b.keepWithNext && blocks[i + 1]) {
        const n = blocks[i + 1];
        need += n.kind === "html" ? n.h : n.headH + (n.rows[0]?.h || 0);
      }
      // optional (a decorative stamp in the free area): dropped rather than stranded alone on a fresh sheet
      if (b.optional && used > 0 && used + need > capacity) continue;
      if (used > 0 && used + need > capacity) flush();
      if (b.bottom) bot.push(b.html); else cur.push(b.html);
      used += b.h;
      continue;
    }
    // table
    let open = false;
    const contH = b.cont ? 6 : 0;
    const openTable = () => { cur.push(b.open + b.head); used += b.headH; open = true; };
    const closeTable = () => { if (open) { cur.push(b.close); open = false; } };
    if (used > 0 && used + b.headH + (b.rows[0]?.h || 0) > capacity) flush();
    openTable();
    for (let ri = 0; ri < b.rows.length; ri++) {
      const r = b.rows[ri];
      const more = ri < b.rows.length - 1;
      if (used + r.h + (more ? contH : 0) > capacity && used > b.headH) { closeTable(); if (b.cont) { cur.push(b.cont); used += contH; } flush(); openTable(); }
      cur.push(r.html); used += r.h;
    }
    closeTable();
  }
  flush();
  return sheets;
}

// ─── css ────────────────────────────────────────────────────────────────────

/** Extras for identity templates (scoped on .edoc.idn / .edoc.hs · appended after the Ledger rules). */
function identityCss(idn: CssIdentity, lang: DocLang): string {
  const T = idn.extras;
  return `
.edoc.idn{--navy:${T.navy};--deep:${T.deep};--steel:${T.steel};--rule2:${T.rule};--chip:${T.chip};--fill:${T.fill};--slate:${T.slate};--serial:${T.serial};--wash:${T.wash};--line:${T.line};--radius:${T.radius || "6px"}}
/* corners · one token for every box in identity mode (ink-white = 2px) · chips stay pills */
.edoc.idn .card,.edoc.idn .totals,.edoc.idn .nb,.edoc.idn .flag,.edoc.idn .qr-side .qr,.edoc.idn .epay .qr,.edoc.idn .notes,.edoc.idn .expl,.edoc.idn .meta-strip .tile,.edoc.idn .tile2,.edoc.idn .note,.edoc.idn .pg-note,.edoc.idn .pg-fig img{border-radius:var(--radius)}
/* Word-like sheet: a flex column so bottom-slot blocks sit above the footer band, inside the budget */
.edoc.idn .pgflow{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}
.edoc.idn .pgbottom{margin-top:auto;padding-top:4mm}
.edoc.idn .cont{font-size:7.5pt;color:var(--muted);text-align:end;padding:1.5mm 0 0;font-style:italic}
/* section heading · Arabic bold + Latin caption · start-aligned */
.edoc.idn .sh{margin:1mm 0 1.5mm}
.edoc.idn .sh .a{font-size:13pt;font-weight:800;line-height:1.3;color:var(--ink)}
.edoc.idn .sh .e{font-family:var(--font-latin);font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:var(--slate);margin-top:0;line-height:1.4}
.edoc.idn .sh .e .sub{letter-spacing:0;text-transform:none;font-family:inherit;font-size:8pt;color:var(--muted)}
.edoc.idn .scope-t{font-weight:700;font-size:10.5pt;margin:0 0 1mm}
.edoc.idn .scope{font-size:10pt;line-height:1.75;margin:0 0 2mm;white-space:pre-wrap;overflow-wrap:break-word;color:var(--ink)}
/* quotation meta strip · Latin captions · number in serial */
.edoc.idn .meta-strip.idm.q{display:grid;margin:0 0 3mm;padding:1.4mm 0}
.edoc.idn .meta-strip.idm.q .cell{padding:.4mm 4mm;border-inline-end:1px solid var(--line);text-align:start}
.edoc.idn .meta-strip.idm.q .cell:last-child{border-inline-end:0}
.edoc.idn .meta-strip.idm.q .k{font-family:var(--font-latin);font-size:7px;letter-spacing:.22em;text-transform:uppercase;color:var(--slate);margin-bottom:.8mm}
.edoc.idn .meta-strip.idm.q .v{font-family:var(--font-mono);font-size:10.5pt;font-weight:700;direction:ltr;unicode-bidi:isolate;text-align:start}
.edoc.idn .meta-strip.idm.q .serial .v{color:var(--serial)}
/* BOQ · square corners · 1px line grid · navy head */
.edoc.idn table.items.boq{border:1px solid var(--line);border-radius:0;margin:0 0 4mm}
.edoc.idn table.items.boq th{border-radius:0;border-inline-end:1px solid rgba(255,255,255,.18);padding:3mm 2.5mm;text-align:start}
.edoc.idn table.items.boq th.n{text-align:end}
.edoc.idn table.items.boq td{border-bottom:1px solid var(--line);border-inline-end:1px solid var(--line);padding:1.4mm 2.5mm}
.edoc.idn table.items.boq td:last-child,.edoc.idn table.items.boq th:last-child{border-inline-end:0}
.edoc.idn table.items.boq td.idx{font-family:var(--font-mono);font-weight:700;color:var(--ink);text-align:center}
.edoc.idn table.items.boq td .u{font-size:7.5pt;color:var(--muted);font-family:var(--font-arabic)}
.edoc.idn table.items.boq td .code{font-size:7pt;color:var(--slate);font-family:var(--font-mono);margin-top:1mm}
/* totals at the inline end · no card border · light rules · grand + tafqit on fill */
.edoc.idn .tot2{display:flex;flex-direction:column;align-items:flex-end;margin:0 0 4mm}
.edoc.idn .tot2 .totals,.edoc.idn .tot2 .tafqit{width:46%;min-width:88mm}
.edoc.idn .tot2 .totals{border:0;border-radius:0}
.edoc.idn .tot2 .totals .r{padding:1.1mm 3mm;border-bottom:1px solid var(--line);line-height:1.35}
.edoc.idn .tot2 .totals .r .lbl{font-weight:400;color:var(--muted)}
.edoc.idn .tot2 .totals .r.grand{border:0;border-top:1.6px solid var(--ink);border-radius:var(--radius);margin-top:1mm;padding:2.2mm 3mm}
.edoc.idn .tot2 .totals .r.grand .lbl{font-weight:700;color:var(--ink)}
.edoc.idn .tot2 .tafqit{border-radius:var(--radius);margin-top:1.5mm;font-size:9pt;padding:1.8mm 3mm;line-height:1.5}
/* QR card · full width · text at the start · code at the end */
.edoc.idn .qrc{display:grid;grid-template-columns:1fr 22mm;gap:5mm;align-items:center;border:1px solid var(--line);border-radius:var(--radius);background:var(--wash);padding:2mm 4.5mm;margin:0 0 3mm;break-inside:avoid}
.edoc.idn .qrc .t{font-weight:700;font-size:10pt;margin-bottom:.5mm}
.edoc.idn .qrc p{margin:0 0 1.5mm;font-size:8pt;line-height:1.6;color:var(--muted)}
.edoc.idn .qrc .qr{width:22mm;height:22mm;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:1.5mm}
.edoc.idn .qrc .qr svg{width:100%;height:100%;display:block}
.edoc.idn .qrc .qr-data{grid-template-columns:auto 1fr;gap:.3mm 4mm;font-size:8pt;line-height:1.5}
.edoc.idn .qrc .qr-data dd{font-family:var(--font-mono);font-weight:700}
/* key / value tables (delivery facts · beneficiary · approval summary) */
.edoc.idn table.kv{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:var(--radius);table-layout:fixed;margin:0 0 5mm;font-size:9pt}
.edoc.idn table.kv td{padding:2.6mm 4mm;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:break-word}
.edoc.idn table.kv tr:last-child td{border-bottom:0}
.edoc.idn table.kv td.k{color:var(--muted);background:var(--wash);border-inline-end:1px solid var(--line)}
.edoc.idn table.kv td.v{font-weight:700}
.edoc.idn table.kv.sum td.v .num{font-size:9.5pt}
/* bank card · logo at the start · IBAN mono grouped */
.edoc.idn .bankc2{display:grid;grid-template-columns:62px 1fr;gap:6mm;align-items:center;border:1px solid var(--line);border-radius:var(--radius);background:var(--wash);padding:4mm 5mm;margin:0 0 4mm;break-inside:avoid}
.edoc.idn .bankc2 img{width:62px;height:62px;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc.idn .bankc2 .bd{text-align:center}
.edoc.idn .bankc2 .bn{font-weight:700;font-size:12pt;line-height:1.3}
.edoc.idn .bankc2 .be{font-family:var(--font-latin);font-size:8pt;color:var(--slate);letter-spacing:.12em;direction:ltr}
.edoc.idn .bankc2 .iban{font-family:var(--font-mono);font-size:15.5px;font-weight:700;direction:ltr;unicode-bidi:isolate;letter-spacing:.06em;margin:2mm 0 1mm}
.edoc.idn .bankc2 .sw{font-family:var(--font-latin);font-size:7.5pt;color:var(--muted);direction:ltr}
.edoc.idn .bankc2 .sw b{font-family:var(--font-mono);color:var(--ink)}
/* stamp · free area bottom-start (delivery page) · under the issuer column (approval page) */
/* rotated stamps are clipped by their own wrapper so the rotation never adds scrollable overflow (QA gate) */
.edoc.idn .stamp-free{display:flex;justify-content:flex-end;padding:4mm 8mm;overflow:hidden}
.edoc.idn .stamp-free img,.edoc.idn .stamp-under img{max-height:34mm;max-width:56mm;object-fit:contain;opacity:.86;mix-blend-mode:multiply;filter:saturate(.88) contrast(1.12);transform:rotate(-8deg);transform-origin:center;background:none;border:0;padding:0;border-radius:0;display:block}
.edoc.idn .stamp-under{margin-top:3mm;display:flex;justify-content:center;padding:4mm 8mm;overflow:hidden}
/* terms · two columns per row · numbered · never split */
.edoc.idn .terms2g{display:grid;grid-template-columns:1fr 1fr;gap:4mm 10mm;margin:0 0 3mm;break-inside:avoid}
.edoc.idn .terms2g .ti{font-size:8.8pt;line-height:1.7}
.edoc.idn .terms2g .ti b{display:block;font-weight:700;color:var(--ink);margin-bottom:.5mm}
.edoc.idn .terms2g .ti b .no{font-family:var(--font-latin);color:var(--steel)}
.edoc.idn .terms2g .ti span{color:var(--muted)}
/* approval · two signature columns */
.edoc.idn .sigcols{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin:2mm 0 6mm;align-items:start}
.edoc.idn .sigcols .sc{text-align:center}
.edoc.idn .sigcols .sarea{height:16mm;display:flex;align-items:flex-end;justify-content:center}
.edoc.idn .sigcols .sarea img{max-height:16mm;max-width:60mm;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc.idn .sigcols .sarea .n.pen{font-family:'${idn.fam} Signature',var(--font-latin);font-size:22pt;line-height:1.1;direction:ltr}
.edoc.idn .sigcols .srule{height:1px;background:var(--ink);position:relative;margin:1.5mm 0 2mm}
.edoc.idn .sigcols .srule::before{content:"";position:absolute;inset-inline-start:0;top:-1px;width:12mm;height:3px;background:var(--navy)}
.edoc.idn .sigcols .nm{font-size:11pt;font-weight:800}
.edoc.idn .sigcols .role{font-family:var(--font-latin);font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);margin-top:.5mm}
.edoc.idn .sigcols .co{font-size:8pt;color:var(--muted);margin-top:.8mm;line-height:1.5}
/* explainer title */
.edoc.idn .expl .t{font-weight:700;margin-bottom:1mm}
.edoc.idn .expl ol li{margin:0 0 .6mm}
/* outlined cards · cover strip + closing facts */
.edoc.idn .cards3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;border-top:0;padding-top:0}
.edoc.idn .cards3 .cd{border:1px solid rgba(255,255,255,.35);border-radius:var(--radius);padding:3.5mm 4mm;min-width:0}
.edoc.idn .cards3 .cd .k{font-family:var(--font-latin);font-size:7.5px;letter-spacing:.12em;color:rgba(255,255,255,.72);margin-bottom:1.2mm;text-transform:none}
.edoc.idn .cards3 .cd .v{font-size:10pt;font-weight:700;color:#fff;line-height:1.45;overflow-wrap:anywhere}
.edoc.idn .cards3 .cd .s{font-size:8pt;color:rgba(255,255,255,.78);margin-top:.8mm;overflow-wrap:anywhere}
.edoc.idn .ic .strip.cards3{margin-bottom:6mm;border-top:0;padding-top:0}
.edoc.idn .cl .sub{font-size:16px;color:rgba(255,255,255,.88);margin:-2mm 0 4mm;line-height:1.5}
.edoc.idn .cl .facts.cards3{display:grid;border-top:0;padding-top:0;margin-top:10mm;width:100%;max-width:none;gap:4mm}
.edoc.idn .cl .facts.cards3 .cd{text-align:start}
.edoc.idn .cl .facts.cards3 .cd .k{color:var(--chip);font-size:7.5px;letter-spacing:.12em;text-transform:none}
.edoc.idn .cl .facts.cards3 .cd .v{font-size:10pt;margin-top:0}
.edoc.idn .cl .facts.cards3 .cd .v .num{font-family:var(--font-latin)}
.edoc.idn .sheet{isolation:isolate}
/* faint bottom-anchored watermark · interior pages only · never on the cover or closing sheet */
.edoc.idn .wm{position:absolute;left:0;right:0;bottom:0;height:74%;display:flex;align-items:flex-end;justify-content:center;opacity:.05;transform:translateY(9%);pointer-events:none;z-index:-1}
.edoc.idn .wm img{height:100%;width:auto;max-width:100%;object-fit:contain;display:block}
/* centered header · no coloured bar · 3-line legal footer · page number top-end of the footer */
.edoc.hs .sheet.light,.edoc.hs .sheet.dark{border-top:0}
.edoc.hs .sheet{padding-bottom:27mm}
.edoc.hs .hdr{justify-content:center}
.edoc.hs .hdr-logo{height:14mm;max-width:110mm;justify-content:center}
.edoc.hs .hdr-logo img{max-height:14mm;max-width:76mm;object-position:center center}
.edoc.hs .ftr{flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0;border-top:1px solid var(--slate);padding-top:2mm;font-family:var(--font-latin);font-size:7.4px;line-height:1.55;direction:ltr;position:absolute}
.edoc.hs .ftr .fl{display:block;color:var(--slate);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.edoc.hs .ftr .fl bdi{font-family:var(--font-arabic)}
.edoc.hs .ftr .fl.f1{color:var(--ink);font-weight:700}
.edoc.hs .ftr .pn{position:absolute;top:1.5mm;right:0;font-family:var(--font-mono);font-size:7pt;color:var(--slate)}
.edoc.hs .dark .ftr{border-top-color:rgba(255,255,255,.28)}
.edoc.hs .dark .ftr .fl,.edoc.hs .dark .ftr .fl.f1,.edoc.hs .dark .ftr .pn{color:#fff}
/* document number · the serial colour is used HERE and nowhere else */
.edoc.idn .serial .v{color:var(--serial)}
/* identity cover · full-bleed image or solid navy · white marks */
.edoc.idn .sheet.dark{background:var(--navy)}
.edoc.idn .sheet.cover-img{background-size:cover;background-position:center;background-repeat:no-repeat}
.edoc.idn .sheet.cover-img::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.22),rgba(0,0,0,.58));z-index:-1}
.edoc.idn .ic{display:flex;flex-direction:column;height:100%;padding:36mm 0 0}
.edoc.idn .ic .eyebrow{font-family:var(--font-latin);font-size:9.6px;letter-spacing:.34em;color:var(--chip);text-transform:uppercase}
.edoc.idn .ic .h1{font-size:29px;font-weight:800;line-height:1.35;margin:5mm 0 1.5mm;color:#fff;letter-spacing:0}
.edoc.idn .ic .sub{font-size:19px;font-weight:400;color:rgba(255,255,255,.84);line-height:1.45}
.edoc.idn .ic .crule{width:74px;height:2px;background:var(--chip);margin:7mm 0}
.edoc.idn .ic .intro{font-size:11pt;line-height:1.9;max-width:150mm;color:rgba(255,255,255,.88)}
.edoc.idn .ic .intro strong{color:#fff}
.edoc.idn .ic .strip{margin-top:auto;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8mm;padding-top:6mm;border-top:1px solid rgba(255,255,255,.28);margin-bottom:4mm}
.edoc.idn .ic .strip .k{font-family:var(--font-latin);font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:var(--chip);margin-bottom:1.5mm}
.edoc.idn .ic .strip .v{font-size:11pt;font-weight:700;color:#fff;line-height:1.4}
.edoc.idn .ic .strip .s{font-size:8.5pt;color:rgba(255,255,255,.75);margin-top:1mm}
/* quotation page · centered section title + English caption */
.edoc.idn .st{text-align:center;margin:0 0 3mm}
.edoc.idn .st .a{font-size:25px;font-weight:800;line-height:1.25;color:var(--ink)}
.edoc.idn .st .e{font-family:var(--font-latin);font-size:10.4px;letter-spacing:.34em;text-transform:uppercase;color:var(--slate);margin-top:1mm}
.edoc.idn .doc-head.two{grid-template-columns:1fr 1fr;border-bottom-color:var(--line)}
.edoc.idn .meta-strip.idm{border-top:1.4px solid var(--ink);border-bottom:1.4px solid var(--ink);padding:2.5mm 0;gap:0}
.edoc.idn .meta-strip.idm .tile{background:none;border-radius:0;padding:1mm 4mm;border-inline-end:1px solid var(--line)}
.edoc.idn .meta-strip.idm .tile:last-child{border-inline-end:0}
.edoc.idn .meta-strip.idm .k{color:var(--slate)}
/* BOQ table · navy head · white text · hairline rows · mono numbers */
.edoc.idn table.items th{background:var(--navy);color:#fff;border-bottom:0;padding:3mm 2.5mm;font-size:8.5pt}
.edoc.idn table.items td{border-bottom:1px solid var(--line)}
.edoc.idn table.items .code{color:var(--slate)}
.edoc.idn table.items .sec td{background:var(--wash)}
/* totals card · right-aligned · ~56% */
.edoc.idn .totals-row{grid-template-columns:1fr 56%}
.edoc.idn .totals{border-color:var(--line);border-radius:0}
.edoc.idn .totals .r{border-bottom-color:var(--line)}
.edoc.idn .totals .r.disc .lbl,.edoc.idn .totals .r.disc .amt{color:var(--steel)}
.edoc.idn .totals .r.grand{background:var(--fill);color:var(--ink);border-top:1.6px solid var(--ink);font-weight:700}
.edoc.idn .totals .r.grand .amt{font-size:15px;font-weight:700}
.edoc.idn .totals .r.due{background:var(--wash)}
.edoc.idn .tafqit{background:var(--fill);text-align:center;font-weight:700;color:var(--navy);font-size:9.5pt;padding:3mm 4mm;line-height:1.7;margin-top:3mm;break-inside:avoid}
.edoc.idn .qr-side{max-width:80mm}
.edoc.idn .qr-side .qr{width:104px;height:104px;border-color:var(--line);border-radius:0}
.edoc.idn .qr-data{display:grid;grid-template-columns:auto 1fr;gap:.6mm 3mm;margin:0;font-size:7.5pt}
.edoc.idn .qr-data dt{color:var(--muted)}
.edoc.idn .qr-data dd{margin:0;color:var(--ink);font-weight:700;overflow-wrap:anywhere}
/* note box · flag (unconfirmed / warning) · placeholder span */
.edoc.idn .nb{border:1px solid var(--line);border-inline-start:3px solid var(--steel);background:var(--wash);padding:2.5mm 4mm;font-size:8.5pt;line-height:1.7;margin:0 0 4mm;break-inside:avoid;color:var(--ink)}
.edoc.idn .nb .t{font-weight:700;margin-bottom:1mm}
.edoc.idn .nb ul{margin:0;padding-inline-start:5mm;list-style:disc}
.edoc.idn .nb li{padding-inline-start:0;margin:0 0 .8mm;font-size:8.5pt;line-height:1.65}
.edoc.idn .nb li::before{display:none}
.edoc.idn .note{background:var(--wash);border-color:var(--line)}
.edoc.idn .note .i{border-color:var(--steel);color:var(--steel)}
.edoc.idn .card{border-color:var(--line)}
.edoc.idn .chip{border-color:var(--steel);color:var(--steel)}
.edoc.idn .flag{border:1px solid #EED9D7;border-inline-start:3px solid #B4443A;background:#FDF6F5;color:#7A2E27;padding:3mm 4mm;font-size:8.5pt;line-height:1.7;margin:0 0 4mm;break-inside:avoid}
.edoc.idn .ph{border-bottom:1px dashed #B08A2E;background:#FFF8DC;color:#7A5A00;padding:0 1mm}
/* payment plan · stations */
.edoc.idn .stations{display:flex;align-items:stretch;gap:3mm;margin:0 0 4mm;break-inside:avoid}
.edoc.idn .stations .stn{flex:1;text-align:center;padding:3mm 2mm;min-width:0}
.edoc.idn .stations .stn .no{font-family:var(--font-mono);font-size:58px;font-weight:700;line-height:1;color:var(--navy)}
.edoc.idn .stations .stn .r{height:1px;background:var(--line);margin:2.5mm 8mm}
.edoc.idn .stations .stn .pc{font-family:var(--font-mono);font-size:26px;font-weight:700;color:var(--steel);line-height:1.1}
.edoc.idn .stations .stn .lb{font-weight:700;font-size:9.5pt;margin-top:1.5mm;line-height:1.4}
.edoc.idn .stations .stn .am{font-size:8pt;color:var(--muted);margin-top:1mm;line-height:1.55}
.edoc.idn .stations .chev{display:flex;align-items:center;justify-content:center;flex:0 0 8mm}
.edoc.idn .stations .chev svg{width:6mm;height:12mm;stroke:var(--steel);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;transform:${lang === "ar" ? "scaleX(-1)" : "none"}}
.edoc.idn .expl{background:var(--fill);padding:3mm 4mm;font-size:8.5pt;line-height:1.7;margin:0 0 4mm;break-inside:avoid}
.edoc.idn .expl ol{margin:0;padding-inline-start:5mm}
/* terms · two columns · bold term + muted description */
.edoc.idn .terms2{column-count:2;column-gap:8mm;margin:0 0 3mm}
.edoc.idn .terms2 .ti{break-inside:avoid;margin:0 0 2.5mm;font-size:8.5pt;line-height:1.65}
.edoc.idn .terms2 .ti b{font-weight:700;display:block;color:var(--ink)}
.edoc.idn .terms2 .ti span{color:var(--muted)}
/* bank card · logo 62px · IBAN grouped mono */
.edoc.idn .bankc{display:grid;grid-template-columns:62px 1fr;gap:5mm;align-items:start}
.edoc.idn .bankc img{width:62px;height:62px;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc.idn .bankc .bn{font-weight:700;font-size:11pt;line-height:1.3}
.edoc.idn .bankc .be{font-family:var(--font-latin);font-size:8pt;color:var(--slate);text-transform:uppercase;letter-spacing:.12em;direction:ltr;text-align:${lang === "ar" ? "right" : "left"}}
.edoc.idn .bankc .iban{font-family:var(--font-mono);font-size:15.5px;font-weight:700;direction:ltr;unicode-bidi:isolate;letter-spacing:.04em;margin:2mm 0 1mm;text-align:${lang === "ar" ? "right" : "left"}}
.edoc.idn .bankc .sw{font-family:var(--font-mono);font-size:8pt;color:var(--muted);direction:ltr;unicode-bidi:isolate;text-align:${lang === "ar" ? "right" : "left"}}
.edoc.idn .bankc table{width:100%;border-collapse:collapse;margin-top:2mm;font-size:8.5pt}
.edoc.idn .bankc td{padding:1.2mm 0;border-bottom:1px solid var(--line);vertical-align:top}
.edoc.idn .bankc td:first-child{color:var(--muted);width:34mm}
/* signature block · 15mm reserved · rule with navy chip · bold name · uppercase role */
.edoc.idn .sig .sarea{height:15mm;display:flex;align-items:flex-end}
.edoc.idn .sig .sarea img{max-height:15mm;max-width:56mm;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc.idn .sig .srule{height:1px;background:var(--line);position:relative;margin:2mm 0 2mm}
.edoc.idn .sig .srule::before{content:"";position:absolute;inset-inline-start:0;top:-1px;width:10mm;height:3px;background:var(--navy)}
.edoc.idn .sig .n.bold{font-size:11pt;font-weight:800}
.edoc.idn .sig .o.role{text-transform:uppercase;letter-spacing:.14em;font-family:var(--font-latin);font-size:7.5pt;color:var(--slate)}
.edoc.idn .sig .o.small{font-size:7.5pt}
.edoc.idn .stamp-box img{transform:rotate(-8deg)}
/* closing page · image or solid navy · white logo · THANK YOU · facts strip */
.edoc.idn .sheet.closing{background:var(--navy);color:#fff;--ink:#fff;--muted:rgba(255,255,255,.7);--rule:rgba(255,255,255,.2);border-top:0}
.edoc.idn .sheet.closing .hdr{display:none}
.edoc.idn .cl{display:flex;flex-direction:column;align-items:stretch;justify-content:center;text-align:start;height:100%;padding:0 6mm}
.edoc.idn .cl .mark{margin-bottom:10mm;display:flex;justify-content:center}
.edoc.idn .cl .mark img{height:70px;max-width:120mm;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc.idn .cl .mark .hdr-word{color:#fff;font-size:30pt}
.edoc.idn .cl .eyebrow{font-family:var(--font-latin);font-size:9.6px;letter-spacing:.34em;color:var(--chip)}
.edoc.idn .cl .h1{font-size:26px;font-weight:800;margin:4mm 0 4mm;color:#fff;line-height:1.4}
.edoc.idn .cl .lead{color:rgba(255,255,255,.8);max-width:150mm;margin:0}
.edoc.idn .cl .facts{display:flex;flex-wrap:wrap;justify-content:center;gap:6mm 12mm;margin-top:10mm;padding-top:6mm;border-top:1px solid rgba(255,255,255,.28);max-width:160mm}
.edoc.idn .cl .facts .k{font-size:7.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--chip);font-family:var(--font-latin)}
.edoc.idn .cl .facts .v{font-size:11pt;font-weight:700;color:#fff;margin-top:1mm}
`;
}

/** Identity inputs for the stylesheet · null = the Ledger sheet of 2026-09-08, byte for byte. */
interface CssIdentity {
  /** resolved tokens when the template is themed · null keeps the Ledger palette */
  theme: DocTheme | null;
  /** any identity field set → the extras block (note boxes · stations · cover · closing …) is emitted */
  extras: DocTheme;
  /** centered header · no top bar · 3-line legal footer */
  hs: boolean;
  /** hideProviderBranding → the embedded faces are named without the provider */
  fam: string;
}

function buildCss(brand: string, dark: string, fontBase: string, lang: DocLang, embed: boolean, idn: CssIdentity | null = null): string {
  const fb = fontBase.replace(/\/$/, "");
  const F = idn?.fam || "Entix Doc";
  const th = idn?.theme || null;
  const ink = th ? th.ink : DOC_INK, muted = th ? th.muted : DOC_MUTED, soft = th ? th.fill : DOC_PAPER_SOFT, rule = th ? th.line : DOC_RULE, paper = th ? th.paper : DOC_PAPER;
  const faceAr = th?.fontArabic === "tajawal" ? `'${F} Tajawal','Tajawal',` : th?.fontArabic === "ibm-plex-arabic" ? `'${F} Plex Arabic','IBM Plex Sans Arabic',` : "";
  const faceLat = th?.fontLatin === "ibm-plex" ? `'${F} Plex','IBM Plex Sans',` : "";
  const arabic = `${faceAr}'${F} Arabic','Noto Sans Arabic','IBM Plex Sans Arabic',system-ui,sans-serif`;
  // FONT LAW (CEO 2026-09-13): Arabic glyphs always render in the document's Arabic
  // face, whatever the document language. Plus Jakarta Sans has no Arabic block, so an
  // English document must fall through to 'Entix Doc Arabic' (Noto Sans Arabic) instead
  // of the OS Arabic face — otherwise Arabic names/notes change shape between AR and EN.
  const latin = `${faceLat}'${F} Latin','Plus Jakarta Sans',${faceAr}'${F} Arabic','Noto Sans Arabic','IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif`;
  const mono = `'${F} Mono','JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace`;
  const body = lang === "ar" ? arabic : latin;
  // Optional embedded faces (self-hosted woff2 in public/fonts · never a CDN). Emitted only when
  // the theme selects them, so a Ledger document's stylesheet is unchanged.
  const AR_RANGE = "unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF";
  const extraFaces = (th?.fontArabic === "tajawal" ? [400, 500, 700].map((w) => `
@font-face{font-family:'${F} Tajawal';src:url('${fb}/Tajawal-${w}-arabic.woff2') format('woff2');font-weight:${w === 700 ? "600 800" : w};font-style:normal;font-display:block;${AR_RANGE}}
@font-face{font-family:'${F} Tajawal';src:url('${fb}/Tajawal-${w}-latin.woff2') format('woff2');font-weight:${w === 700 ? "600 800" : w};font-style:normal;font-display:block}`).join("") : "")
    + (th?.fontArabic === "ibm-plex-arabic" ? [400, 500, 600, 700].map((w) => `
@font-face{font-family:'${F} Plex Arabic';src:url('${fb}/IBMPlexSansArabic-${w}-arabic.woff2') format('woff2');font-weight:${w === 700 ? "700 800" : w};font-style:normal;font-display:block;${AR_RANGE}}
@font-face{font-family:'${F} Plex Arabic';src:url('${fb}/IBMPlexSansArabic-${w}-latin.woff2') format('woff2');font-weight:${w === 700 ? "700 800" : w};font-style:normal;font-display:block}`).join("") : "")
    + (th?.fontLatin === "ibm-plex" ? [400, 500, 600].map((w) => `
@font-face{font-family:'${F} Plex';src:url('${fb}/IBMPlexSans-${w}-latin.woff2') format('woff2');font-weight:${w === 600 ? "600 800" : w};font-style:normal;font-display:block}`).join("") : "");
  return `
@font-face{font-family:'${F} Arabic';src:url('${fb}/NotoSansArabic-400-arabic.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF}
@font-face{font-family:'${F} Arabic';src:url('${fb}/NotoSansArabic-700-arabic.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF}
@font-face{font-family:'${F} Arabic';src:url('${fb}/NotoSansArabic-400-latin.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'${F} Arabic';src:url('${fb}/NotoSansArabic-700-latin.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:block}
@font-face{font-family:'${F} Latin';src:url('${fb}/PlusJakartaSans-400-latin.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'${F} Latin';src:url('${fb}/PlusJakartaSans-700-latin.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:block}
@font-face{font-family:'${F} Mono';src:url('${fb}/JetBrainsMono-400-latin.woff2') format('woff2');font-weight:400 700;font-style:normal;font-display:block}${extraFaces}
/* Pen-style signatory signature (CEO 2026-09-08) · TeX Gyre Chorus, self-hosted woff2 ·
   GUST Font License (see public/fonts/GUST-FONT-LICENSE-SignatureScript.txt) · no network
   fetch at print time. Latin names only — Arabic names fall back to the Arabic face. */
@font-face{font-family:'${F} Signature';src:url('${fb}/SignatureScript-400.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
.edoc{--brand:${brand};--brand-lift:${lift(brand, 0.42)};--dark:${dark};--ink:${ink};--muted:${muted};--soft:${soft};--rule:${rule};--paper:${paper};
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
/* logo cap (CEO 2026-09-08 · «صغر شكله»): a professional wordmark-scale mark — a large
   uploaded logo is scaled down to this box, never allowed to dominate the header. */
.edoc .hdr-logo img{max-height:9mm;max-width:46mm;object-fit:contain;object-position:${lang === "ar" ? "right" : "left"} center;display:block;background:none;border:0;padding:0;border-radius:0;box-shadow:none}
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
/* A name/title run that wraps mid-word inside an RTL sentence gets its two halves
   reordered onto the wrong lines by the browser's per-line bidi pass — keep each
   embedded name atomic so it moves to whichever line it fits on as one block
   (CEO 2026-09-08 · «العربية مضروبة»). */
.edoc bdi.nm{white-space:nowrap;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}
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
.edoc .party .d{font-size:8pt;color:var(--muted);line-height:1.55;margin-top:1.5mm;overflow-wrap:break-word}
.edoc .meta-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:0 0 5mm}
.edoc .meta-strip .tile{background:var(--soft);border-radius:2mm;padding:3mm 4mm}
.edoc .meta-strip .k{font-size:7.5pt;color:var(--muted);margin-bottom:.5mm}
.edoc .meta-strip .v{font-size:10pt;font-weight:700}
.edoc table.items{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 5mm}
.edoc table.items th{font-size:8pt;font-weight:700;color:var(--muted);text-align:start;padding:2.5mm 2mm;border-bottom:1.2pt solid var(--ink)}
.edoc table.items td{padding:3mm 2mm;border-bottom:.5pt solid var(--rule);vertical-align:top;font-size:9.5pt;overflow-wrap:break-word}
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
.edoc .card li{position:relative;padding-inline-start:4mm;font-size:8.5pt;line-height:1.65;color:var(--ink);margin-bottom:1.2mm;overflow-wrap:break-word}
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
.edoc table.tc td{padding:2mm 2mm;border-bottom:.5pt solid var(--rule);font-size:8.3pt;line-height:1.55;vertical-align:top;overflow-wrap:break-word}
.edoc table.tc .idx{font-family:var(--font-mono);color:var(--brand);font-weight:700;font-size:8pt}
.edoc table.tc .ttl{font-weight:700}
/* signatory + stamp · FRAMELESS by CEO instruction (2026-09-08): «الغِ الفريم الي عند
   الختم والفريم الي عند التوقيع» — the stamp must read as ink on the paper, bigger,
   with no card, border or plate behind it. */
.edoc .sig-cards{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin:0 0 6mm;align-items:start;break-inside:avoid}
.edoc .sig{background:none;border:0;padding:0}
.edoc .sig .k{font-size:8pt;color:var(--muted);margin-bottom:2mm}
.edoc .sig .n{font-size:13pt;font-weight:800}
/* pen-style rendering of the signatory's own name (CEO 2026-09-08) · Latin names only —
   an Arabic name has no matching script glyphs in this face and keeps the bold sans. */
.edoc .sig .n.pen{font-family:'${F} Signature',var(--font-latin);font-weight:400;font-style:normal;font-size:22pt;line-height:1.1;letter-spacing:.01em;color:var(--ink);direction:ltr;text-align:${lang === "ar" ? "right" : "left"}}
.edoc .sig .n.img{margin:0 0 1mm}
.edoc .sig .n.img img{max-height:16mm;max-width:56mm;object-fit:contain;display:block;background:none;border:0;padding:0;border-radius:0}
.edoc .sig .c{font-family:var(--font-mono);font-size:8pt;color:var(--muted);direction:ltr;text-align:${lang === "ar" ? "right" : "left"};margin-top:1mm}
.edoc .sig .o{font-size:8pt;color:var(--muted);margin-top:1mm}
.edoc .stamp{background:none;border:0;padding:0}
.edoc .stamp .k{font-size:8pt;color:var(--muted);margin-bottom:2mm}
.edoc .stamp-box{display:flex;align-items:flex-start;justify-content:flex-start;min-height:34mm;background:none;border:0;padding:0}
/* ink impression (CEO 2026-09-08 · «يكون فعلا لون ختم مو كذا بس كانه صورة»): multiply
   blend sits the mark IN the paper · a slight desaturate + contrast push reads as a
   press rather than a filter, without discarding the artwork's own colours. */
.edoc .stamp-box img{max-height:40mm;max-width:64mm;object-fit:contain;opacity:.86;mix-blend-mode:multiply;filter:saturate(.88) contrast(1.12);transform:rotate(-5deg);transform-origin:center;background:none;border:0;padding:0;border-radius:0}
.edoc .bank dl{display:grid;grid-template-columns:auto 1fr;gap:1.2mm 5mm;margin:0;font-size:8.5pt}
.edoc .bank dt{color:var(--muted)}
.edoc .bank dd{margin:0;overflow-wrap:anywhere}
.edoc .notes{background:var(--soft);border-radius:2mm;padding:3mm 4mm;font-size:8.5pt;white-space:pre-wrap;margin:0 0 6mm;line-height:1.65}
/* free-form pages (CEO 2026-09-13) · same type scale as the rest of the sheet */
.edoc .pg-title{margin-bottom:5mm}
.edoc .pg-h{font-size:11pt;font-weight:700;margin:2mm 0 1.5mm;line-height:1.4}
.edoc .pg-p{font-size:9.5pt;line-height:1.7;margin:0 0 3mm;white-space:pre-wrap;overflow-wrap:break-word}
.edoc .pg-note{background:var(--soft);border-inline-start:1.2mm solid var(--brand);border-radius:2mm;padding:3mm 4mm;font-size:9pt;line-height:1.65;margin:0 0 4mm;white-space:pre-wrap}
.edoc .pg-list{margin:0 0 3mm;padding-inline-start:6mm;font-size:9.5pt;line-height:1.7}
.edoc .pg-list li{margin:0 0 1mm;padding-inline-start:1mm}
.edoc table.pg-table td{font-size:8.6pt}
.edoc .pg-fig{margin:0 0 5mm;break-inside:avoid}
.edoc .pg-fig img{display:block;max-width:100%;max-height:62mm;object-fit:contain;border-radius:2mm}
.edoc .pg-fig figcaption{font-size:8pt;color:var(--muted);margin-top:1.5mm}
.edoc .actions{position:fixed;top:12px;${lang === "ar" ? "left" : "right"}:12px;z-index:50;display:flex;gap:8px}
.edoc .actions button{padding:8px 16px;border-radius:8px;border:1px solid #CDD3DC;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:#111827}
.edoc .actions button.primary{background:var(--brand);color:#fff;border-color:var(--brand)}${idn ? identityCss(idn, lang) : ""}
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
  // ── identity (2026-09-14) · themed = tokens drive the palette · identity = any identity
  // field at all (extras stylesheet + boxes). Neither → the Ledger sheet, byte for byte.
  const themed = isThemed(tpl);
  const identity = hasIdentity(tpl);
  const theme = resolveTheme(tpl);
  const brand = themed ? theme.steel : safeColor(tpl.brandColor, DEFAULT_BRAND_COLOR);
  const dark = themed ? theme.navy : safeColor(tpl.coverColor, DEFAULT_COVER_COLOR);
  const hs = identity && tpl.headerStyle === "centered";
  const hideBrand = identity && tpl.hideProviderBranding === true;
  const coverImage = identity ? safeUrl(tpl.coverImageUrl) : "";
  const closingImage = identity ? safeUrl(tpl.closingImageUrl) : "";
  const watermark = identity ? safeUrl(tpl.watermarkUrl) : "";
  const showWords = identity && tpl.amountInWords !== false;
  const stations = identity && tpl.paymentPlanStyle === "stations";
  let coverStyle: CoverStyle = tpl.coverStyle === "LIGHT" ? "LIGHT" : tpl.coverStyle === "NONE" ? "NONE" : "DARK";
  const sections = normalizeSections(tpl.sections);
  const on = (id: SectionId) => sections.find((s) => s.id === id)?.enabled !== false;
  const order = sections.map((s) => s.id);
  const cur = doc.currency || "SAR";
  const year = (isoDate(doc.issueDate) || new Date().toISOString()).slice(0, 4);
  // ── TAX-INVOICE LAW (CEO · 2026-09-08 · «كيف شركة امريكية تصدر فاتورة ضريبية؟!») ──
  // A "tax invoice" and every VAT/ZATCA vocabulary item exist ONLY where a real Saudi
  // VAT registration backs them. This is derived from the ISSUING ORG's own country and
  // registration number — never a hardcoded company name — so it holds for every org,
  // ENSIDEX (US, no VAT) and any Saudi-registered tenant alike:
  //   · country === "SA" AND a 15-digit VAT number  → tax invoice · VAT rows · ZATCA QR
  //   · anything else (a US org's EIN in the same field included) → plain invoice, no
  //     "tax" wording anywhere, no VAT row (not even a zero one), no ZATCA QR — the
  //     document-verification QR (doc number only) stays.
  // Applied per-party (isVatRegistered/regLabel below) so a party's own registration
  // number is never mislabelled under a foreign party's tax regime.
  const isVatRegistered = (p: PartySpec | null | undefined): boolean => {
    const country = String(p?.country || "SA").trim().toUpperCase();
    const digits = String(p?.vatNumber || "").replace(/\D/g, "");
    return country === "SA" && digits.length === 15;
  };
  const regLabel = (p: PartySpec | null | undefined): string => {
    if (isVatRegistered(p)) return t("الرقم الضريبي", "VAT no.");
    const country = String(p?.country || "SA").trim().toUpperCase();
    if (country === "US") return t("الرقم الفيدرالي الأمريكي (EIN)", "EIN");
    return t("رقم التسجيل الضريبي", "Registration no.");
  };
  const orgTaxRegistered = isVatRegistered(org);
  const docType = isQuote ? t("عرض سعر", "Quotation") : (orgTaxRegistered ? t("فاتورة ضريبية", "Tax invoice") : t("فاتورة", "Invoice"));
  const docEyebrow = isQuote ? "QUOTATION" : (orgTaxRegistered ? "TAX INVOICE" : "INVOICE");
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
  const logoPaper = logoOn ? (safeUrl(tpl.logoUrl) || safeUrl(org.logoUrl)) : "";           // dark mark · light ground
  const logoReverse = logoOn ? (safeUrl(tpl.logoLightUrl) || safeUrl(org.logoLightUrl)) : "";    // light mark · dark ground
  if (coverStyle === "DARK" && logoPaper && !logoReverse && !coverImage) coverStyle = "LIGHT";
  const stamp = safeUrl(tpl.stampUrl) || safeUrl(org.stampUrl);
  const orgName = ar ? org.name : (org.nameEn || org.legalName || org.name);
  const orgAlt = ar ? (org.legalName && org.legalName !== org.name ? org.legalName : org.nameEn) : (org.name !== orgName ? org.name : "");
  const clientName = contact ? (ar ? contact.name : (contact.nameEn || contact.legalName || contact.name)) : "—";
  const clientAlt = contact ? (ar ? (contact.legalName && contact.legalName !== contact.name ? contact.legalName : contact.nameEn) : (contact.name !== clientName ? contact.name : "")) : "";
  // Built (not one translated string) so the trailing "15%" gets its own LTR isolate —
  // digits+percent as the last token of an un-isolated Arabic sentence render reversed
  // ("%15") in every Chromium bidi pass (CEO 2026-09-08 · «العربية مضروبة»).
  const taxLabel = doc.taxRateLabel ? bdi(doc.taxRateLabel) : `${bdi(t("ضريبة القيمة المضافة", "VAT"))} ${num("15%")}`;
  const footerLeft = tpl.footerText ? esc(tpl.footerText) : `© ${esc(year)} ${esc(org.legalName || org.name)}${org.city ? " · " + bdi(org.city) : ""}`;
  const paid = Number(doc.amountPaid || 0);
  const due = doc.total - paid;
  const included = doc.lines.filter((l) => l.included !== false);
  const optional = doc.lines.filter((l) => l.included === false);
  const listPrice = included.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discount = Math.max(doc.discountTotal || 0, listPrice - doc.subtotal, 0);
  const taxable = doc.subtotal;

  // usable mm per inner sheet (297 − 32 top − 20 bottom) · the 3-line legal footer of the
  // centered header style needs a 27mm bottom band, so the flow capacity drops with it —
  // content never enters the footer band.
  const CAP = hs ? 238 : 245;

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
  const header = (onDark = false) => hs ? `<div class="hdr"><div class="hdr-logo">${markFor(onDark)}</div></div>` : `<div class="hdr">
  <div class="hdr-logo">${markFor(onDark)}</div>
  <div class="hdr-meta"><div class="l1">${esc(docType)} · ${esc(classification)}</div><div class="l2">${esc(issue)} · ${esc(fileId)}</div></div>
</div>`;
  // Centered style · fixed 3-line legal footer: 1 legal name + registrations (ink) · 2 address ·
  // 3 channels (slate). Page number top-end of the footer · none on the cover / closing sheet.
  // Reference footer (EDG-Q-2026-0010): 1 address (bold) · 2 Phone · VAT · C.R. · 3 Website · E-mail
  const legalLines = (): string[] => {
    // A footerText written as 2-3 lines is the whole footer — the org's own registration/contact
    // lines are NOT appended under it (they were duplicating the same VAT/C.R./website · CEO 2026-09-14).
    const authored = String(tpl.footerText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (authored.length > 1) return authored.slice(0, 3).map(esc);
    const where = [org.address, org.city && !(org.address || "").includes(org.city) ? org.city : ""].filter(Boolean).map(bdi).join(" · ");
    const l1 = tpl.footerText ? esc(tpl.footerText) : (where || bdi(org.legalName || org.name));
    const l2 = [org.phone ? `Phone: ${esc(org.phone)}` : "", org.vatNumber ? `${isVatRegistered(org) ? "VAT" : "Reg."}: ${esc(org.vatNumber)}` : "", org.crNumber ? `C.R. ${esc(org.crNumber)}` : ""].filter(Boolean).join(" | ");
    const l3 = [org.website ? `Website: ${esc(org.website)}` : "", org.email ? `E-mail: ${esc(org.email)}` : ""].filter(Boolean).join(" | ");
    return [l1, l2, l3];
  };
  const footer = (n: number, total: number, cover = false) => hs
    ? (cover ? "" : `<div class="ftr"><span class="pn">${String(n).padStart(2, "0")}</span>${legalLines().map((l, i) => l ? `<span class="fl${i === 0 ? " f1" : ""}">${l}</span>` : "").join("")}</div>`)
    : `<div class="ftr">
  <span class="f-left">${footerLeft}</span>
  <span class="f-mid">${cover ? `${esc(issue)} · ${esc(fileId)}` : `${n} / ${total}`}</span>
  <span class="f-right">${esc(docType)} · ${esc(classification)}</span>
</div>`;

  const sheets: Array<{ cls: string; body: string; cover?: boolean; style?: string; closing?: boolean; used?: number }> = [];

  // ── cover ──
  if (on("cover") && coverStyle !== "NONE") {
    const title = ((ar ? tpl.coverTitle : (tpl.coverTitleEn || tpl.coverTitle)) || "").trim() || doc.title || docType;
    // Each embedded name/number is a foreign run inside the RTL sentence — wrap it in an
    // atomic (bdi.nm, see CSS) isolate so it can't be split mid-word across a line wrap,
    // which is what was reordering company vs. client (CEO 2026-09-08 · «العربية مضروبة»).
    const fill = (s: string) => s
      .replace(/\{company\}/g, `<bdi dir="auto" class="nm"><strong>${esc(orgName)}</strong></bdi>`)
      .replace(/\{client\}/g, `<bdi dir="auto" class="nm"><strong>${esc(clientName)}</strong></bdi>`)
      .replace(/\{number\}/g, num(doc.number))
      .replace(/\{reference\}/g, num(doc.reference || "—"))
      .replace(/\{total\}/g, num(`${cur} ${money(doc.total)}`))
      .replace(/\{date\}/g, num(issue))
      .replace(/\{title\}/g, `<bdi dir="auto" class="nm"><strong>${esc(doc.title || "")}</strong></bdi>`);
    const introRaw = ((ar ? tpl.coverIntro : (tpl.coverIntroEn || tpl.coverIntro)) || "").trim() || (isQuote
      ? t("عرض سعر مقدَّم من {company} إلى {client}. تجدون في الصفحات التالية البنود والأسعار وشروط العرض، وطريقة القبول والسداد.",
          "A quotation from {company} to {client}. The following pages detail the items, prices, terms of the offer, and how to accept and pay.")
      : orgTaxRegistered
        ? t("فاتورة ضريبية صادرة عن {company} إلى {client}. تجدون في الصفحات التالية تفاصيل البنود والضريبة وطريقة السداد.",
            "A tax invoice issued by {company} to {client}. The following pages detail the items, tax and how to pay.")
        : t("فاتورة صادرة عن {company} إلى {client}. تجدون في الصفحات التالية تفاصيل البنود وطريقة السداد.",
            "An invoice issued by {company} to {client}. The following pages detail the items and how to pay."));
    const intro = esc(introRaw).replace(/&lt;strong&gt;|&lt;\/strong&gt;/g, "");
    const titleParts = title.split(/\r?\n/).filter(Boolean);
    const titleHtml = titleParts.length > 1
      ? `${esc(titleParts[0])}<br><span class="accent">${esc(titleParts.slice(1).join(" "))}</span>`
      : esc(title);
    if (themed || coverImage) {
      // identity cover · full-bleed image (or solid navy) · white mark · eyebrow QUOTATION · number ·
      // H1 + sub-line · chip rule · intro · bottom strip Client / Issuer / Date + validity
      // bottom strip · 3 outlined cards (reference cover): owner/client · contractor (site · C.R.) · date + validity
      const validDays = issue && end ? Math.round((Date.parse(end) - Date.parse(issue)) / 86_400_000) : 0;
      const strip = `<div class="strip cards3">
    <div class="cd"><div class="k">${isQuote ? t("الجهة المالكة / العميل", "Owner / Client") : t("العميل", "Client")}</div><div class="v">${bdi(clientName)}</div><div class="s">${[contact?.city ? bdi(contact.city) : "", contact?.code ? esc(contact.code) : ""].filter(Boolean).join(" · ") || "&nbsp;"}</div></div>
    <div class="cd"><div class="k">${isQuote ? t("المقاول", "Contractor") : t("الجهة المُصدِرة", "Issuer")}</div><div class="v">${bdi(orgName)}</div><div class="s">${[org.website ? num(org.website) : "", org.crNumber ? `C.R. ${num(org.crNumber)}` : ""].filter(Boolean).join(" · ") || "&nbsp;"}</div></div>
    <div class="cd"><div class="k">${t("التاريخ", "Date")}</div><div class="v">${num(issue)}</div><div class="s">${validDays > 0 ? (isQuote ? t(`صلاحية العرض ${validDays} يومًا`, `Valid for ${validDays} days`) : `${esc(endLabel)} ${num(end)}`) : (end ? `${esc(endLabel)} ${num(end)}` : "&nbsp;")}</div></div>
  </div>`;
      const ownTitle = ((ar ? tpl.coverTitle : (tpl.coverTitleEn || tpl.coverTitle)) || "").trim();
      const h1 = ownTitle ? titleParts[0] : docType;
      const subLine = ownTitle ? titleParts.slice(1).join(" ") : (doc.title || "").split(/\r?\n/).filter(Boolean).join(" · ");
      const body = `<div class="ic">
  <div class="eyebrow">${docEyebrow} · ${esc(doc.number)}${doc.reference ? ` · ${esc(doc.reference)}` : ""}</div>
  <div class="h1">${esc(h1)}</div>
  ${subLine ? `<div class="sub">${esc(subLine)}</div>` : ""}
  <div class="crule"></div>
  <div class="intro">${fill(intro)}</div>
  ${strip}
</div>`;
      sheets.push({ cls: coverImage ? "dark cover-img" : "dark", body, cover: true, style: coverImage ? `background-image:url('${esc(coverImage)}')` : undefined });
    } else {
    const body = `<div class="cover-body">
  <div class="eyebrow">${docEyebrow} · ${esc(issue)}</div>
  <div class="cover-title">${titleHtml}</div>
  <div class="cover-rule"></div>
  <div class="cover-intro">${fill(intro)}</div>
  <div class="cover-meta">
    <div><div class="k">${isQuote ? t("بيانات العرض", "Quotation") : t("بيانات الفاتورة", "Invoice")}</div>
      <div class="v">${isQuote ? t("رقم العرض", "Quote no.") : t("رقم الفاتورة", "Invoice no.")} ${num(doc.number)}</div>
      <div class="s">${t("تاريخ الإصدار", "Issue date")} ${num(issue)}</div>
      ${end ? `<div class="s">${esc(endLabel)} ${num(end)}</div>` : ""}</div>
    <div><div class="k">${isQuote ? (orgTaxRegistered ? t("الإجمالي شامل الضريبة", "Total incl. tax") : t("الإجمالي", "Total")) : (orgTaxRegistered ? t("إجمالي الفاتورة شامل الضريبة", "Invoice total incl. tax") : t("إجمالي الفاتورة", "Invoice total"))}</div>
      <div class="big">${cur} ${money(doc.total)}</div>
      ${orgTaxRegistered ? `<div class="s">${num(money(taxable))} + ${taxLabel} ${num(money(doc.taxTotal))}</div>` : ""}
      ${doc.title && title !== doc.title ? `<div class="s">${esc(doc.title)}</div>` : ""}</div>
    <div class="col-client"><div class="k">${t("العميل", "Client")}</div>
      ${contact?.code ? `<div class="v lat" dir="ltr">${esc(contact.code)}</div>` : ""}
      <div class="v">${bdi(clientName)}</div>
      <div class="s">${[contact?.crNumber ? `${t("س.ت", "CR")} ${contact.crNumber}` : "", contact?.city || ""].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</div></div>
  </div>
</div>`;
    sheets.push({ cls: coverStyle === "DARK" ? "dark" : "light", body, cover: true });
    }
  }

  // ── inner flow ──
  const blocks: Block[] = [];

  const partyHtml = (label: string, name: string, alt: string | null | undefined, p: PartySpec | null, showRep: boolean) => {
    const d: string[] = [];
    if (p?.crNumber) d.push(`${t("س.ت", "CR")} ${num(p.crNumber)}`);
    if (p?.vatNumber) d.push(`${regLabel(p)} ${num(p.vatNumber)}`);
    if (p?.address) d.push(bdi(p.address));
    if (p?.city && !(p.address || "").includes(p.city)) d.push(bdi(p.city));
    const contacts = [p?.phone ? num(p.phone) : "", p?.email ? num(p.email) : ""].filter(Boolean).join(" · ");
    if (contacts) d.push(contacts);
    if (p?.website) d.push(num(p.website));
    if (showRep && tpl.signatoryName) d.push(`${t("ممثل الشركة", "Representative")}: <strong>${bdi(tpl.signatoryName)}</strong>`);
    return `<div class="party"><div class="k">${esc(label)}</div><div class="n">${bdi(name)}</div>${alt ? `<div class="n2">${esc(alt)}</div>` : ""}<div class="d">${d.join("<br>")}</div></div>`;
  };

  const headerBlock = (): Block => themed ? ({
    kind: "html", h: 84, html: `<div class="st"><div class="a">${esc(docType)}</div><div class="e">${docEyebrow}</div></div>
<div class="doc-head two">
  ${partyHtml(isQuote ? t("المورد · الجهة المُقدِّمة", "Supplier · issued by") : t("المورد · الجهة المُصدِرة", "Supplier · issued by"), orgName, orgAlt, org, true)}
  ${partyHtml(t("العميل", "Client"), clientName, clientAlt, contact, false)}
</div>
<div class="meta-strip idm">
  <div class="tile serial"><div class="k">${isQuote ? t("رقم العرض", "Quote no.") : t("رقم الفاتورة", "Invoice no.")}</div><div class="v">${num(doc.number)}</div></div>
  <div class="tile"><div class="k">${t("تاريخ الإصدار", "Issue date")}</div><div class="v">${num(issue)}</div></div>
  <div class="tile"><div class="k">${esc(endLabel)}</div><div class="v">${num(end || "—")}</div></div>
  <div class="tile"><div class="k">${doc.reference ? t("المرجع", "Reference") : t("العملة", "Currency")}</div><div class="v">${doc.reference ? num(doc.reference) : num(cur)}</div></div>
</div>` }) : ({
    kind: "html", h: 76, html: `<div class="doc-head">
  <div><div class="eyebrow">${docEyebrow}</div><div class="title">${esc(docType)}</div></div>
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
    const cols = themed
      ? `<colgroup>${hasPics ? `<col style="width:14mm">` : ""}<col style="width:22mm"><col><col style="width:16mm"><col style="width:28mm"><col style="width:30mm"></colgroup>`
      : `<colgroup>${hasPics ? `<col style="width:14mm">` : ""}<col style="width:30mm"><col><col style="width:16mm"><col style="width:26mm"><col style="width:28mm"></colgroup>`;
    const head = themed
      ? `<thead><tr>${hasPics ? `<th></th>` : ""}<th>${t("البند", "Item")}</th><th>${t("الوصف", "Description")}</th><th class="n">${t("الكمية", "Qty")}</th><th class="n">${t("سعر الوحدة", "Unit price")} (${esc(cur)})</th><th class="n">${t("السعر الإجمالي", "Total")} (${esc(cur)})</th></tr></thead>`
      : `<thead><tr>${hasPics ? `<th></th>` : ""}<th>${t("الرمز", "Code")}</th><th>${t("البند", "Item")}</th><th class="n">${t("الكمية", "Qty")}</th><th class="n">${t("السعر", "Price")} (${esc(cur)})</th><th class="n">${t("المبلغ", "Amount")} (${esc(cur)})</th></tr></thead>`;
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
    if (themed) {
      // subtotal → [discount] → [net] → VAT → grand (the EDG order)
      rows.push(`<div class="r"><span class="lbl">${t("المجموع الفرعي", "Subtotal")}</span><span class="amt">${cur} ${money(discount > 0.005 ? listPrice : taxable)}</span></div>`);
      if (discount > 0.005) {
        rows.push(`<div class="r disc"><span class="lbl">${t("الخصم", "Discount")}</span><span class="amt">- ${cur} ${money(discount)}</span></div>`);
        rows.push(`<div class="r"><span class="lbl">${t("الصافي", "Net")}</span><span class="amt">${cur} ${money(taxable)}</span></div>`);
      }
      if (orgTaxRegistered && tpl.showTaxBreakdown !== false) rows.push(`<div class="r"><span class="lbl">${taxLabel}</span><span class="amt">${cur} ${money(doc.taxTotal)}</span></div>`);
    } else {
    if (discount > 0.005) {
      rows.push(`<div class="r"><span class="lbl">${isQuote ? t("سعر القائمة", "List price") : t("الإجمالي قبل الخصم", "Total before discount")}</span><span class="amt">${cur} ${money(listPrice)}</span></div>`);
      rows.push(`<div class="r disc"><span class="lbl">${t("الخصم", "Discount")}</span><span class="amt">- ${cur} ${money(discount)}</span></div>`);
    }
    if (orgTaxRegistered) {
      rows.push(`<div class="r"><span class="lbl">${t("الخاضع للضريبة", "Taxable amount")}</span><span class="amt">${cur} ${money(taxable)}</span></div>`);
      if (tpl.showTaxBreakdown !== false) rows.push(`<div class="r"><span class="lbl">${taxLabel}</span><span class="amt">${cur} ${money(doc.taxTotal)}</span></div>`);
    }
    }
    rows.push(`<div class="r grand"><span class="lbl">${isQuote ? (orgTaxRegistered ? t("الإجمالي شامل الضريبة", "Total incl. tax") : t("الإجمالي", "Total")) : t("إجمالي الفاتورة", "Invoice total")}</span><span class="amt">${cur} ${money(doc.total)}</span></div>`);
    if (!isQuote && paid > 0) {
      rows.push(`<div class="r"><span class="lbl">${t("المسدَّد", "Paid")}</span><span class="amt">${cur} ${money(paid)}</span></div>`);
      rows.push(`<div class="r due"><span class="lbl">${t("المتبقي", "Balance due")}</span><span class="amt">${cur} ${money(due)}</span></div>`);
    }
    // ── QR / verification code — ALWAYS present (CEO 2026-09-08: «وين الباركود
    // هذه اشياء بديهية لازم دايم تكون موجودة»). Priority: real ZATCA Phase-1 TLV
    // QR on a tax invoice → the document number as plain text. The payment-link
    // QR (when a pay link exists) is drawn once, in the "pay online" card below —
    // it is intentionally not repeated here to avoid printing the same QR twice.
    // Quotes carry a TLV payload only when the template asks for it (showQr · identity) — the
    // caller builds it with zatcaTlvBase64(); an invoice's ZATCA payload is untouched.
    const zatcaQr = (!isQuote || identity) && orgTaxRegistered && doc.qrPayload;
    const qrText = zatcaQr ? doc.qrPayload! : (doc.number || "");
    const qr = qrText ? qrSvg(qrText) : "";
    const qrCaption = zatcaQr
      ? (isQuote ? t("رمز التحقق — اسم البائع · الرقم الضريبي · التاريخ · الإجمالي · الضريبة.", "Verification QR — seller · VAT no. · date · total · tax.") : t("رمز الفاتورة الضريبية — اسم البائع · الرقم الضريبي · التاريخ · الإجمالي · الضريبة.", "Tax invoice QR — seller · VAT no. · date · total · tax."))
      : t("رمز التحقق من رقم المستند.", "Document verification code.");
    const qrData = zatcaQr && identity ? `<dl class="qr-data"><dt>${t("البائع", "Seller")}</dt><dd>${bdi(org.legalName || org.name)}</dd><dt>${t("الرقم الضريبي", "VAT no.")}</dt><dd>${num(org.vatNumber || "")}</dd><dt>${t("الإجمالي شامل الضريبة", "Total incl. VAT")}</dt><dd>${num(`${cur} ${money(doc.total)}`)}</dd><dt>${t("مبلغ الضريبة", "VAT amount")}</dt><dd>${num(`${cur} ${money(doc.taxTotal)}`)}</dd></dl>` : "";
    const notesHtml = doc.notes ? `<div class="notes">${bdi(doc.notes)}</div>` : "";
    const side = (qr ? `<div class="qr-side"><div class="qr">${qr}</div>${qrData || `<div>${qrCaption}</div>`}</div>` : "") + notesHtml;
    // tafqit strip · «فقط … سعوديًا لا غير» under the totals (identity templates · amountInWords ≠ false)
    const words = showWords && cur === "SAR" ? `<div class="tafqit">${esc(tafqitSar(doc.total, lang))}</div>` : "";
    const h = Math.max(10 + rows.length * 9.2 + 8 + (words ? 14 : 0), qr ? (qrData ? 52 : 40) : 0) + (doc.notes ? 14 : 0);
    return { kind: "html", h, html: `<div class="totals-row"><div>${side}</div>${words ? `<div><div class="totals">${rows.join("")}</div>${words}</div>` : `<div class="totals">${rows.join("")}</div>`}</div>` };
  };

  const termsBlock = (): Block | null => {
    const raw = ar ? (doc.termsConditions || tpl.terms || "") : (doc.termsConditions || tpl.termsEn || tpl.terms || "");
    const items = tpl.showTerms === false ? [] : lines(raw);
    const link = safeUrl(doc.paymentLinkUrl);
    // «خارج نطاق هذا العرض» · mandatory boxed block · document override → template default
    const oosRaw = identity ? String(doc.outOfScope || (ar ? tpl.outOfScope : (tpl.outOfScopeEn || tpl.outOfScope)) || "") : "";
    const oos = lines(oosRaw);
    if (!items.length && !link && !oos.length) return null;
    const oosBox = oos.length ? `<div class="nb oos"><div class="t">${isQuote ? t("خارج نطاق هذا العرض:", "Outside the scope of this offer:") : t("خارج نطاق هذا المستند:", "Outside the scope of this document:")}</div><ul>${oos.map((i) => `<li>${bdi(i)}</li>`).join("")}</ul></div>` : "";
    const termsCard = identity
      ? ((items.length || oosBox) ? `<div class="card"><div class="t">${isQuote ? t("شروط العرض", "Terms of this offer") : t("شروط السداد", "Payment terms")}</div>${items.length ? `<div class="terms2">${items.map((i) => { const c = clause(i); return `<div class="ti">${c.title ? `<b>${bdi(c.title)}</b>` : ""}<span>${bdi(c.text)}</span></div>`; }).join("")}</div>` : ""}${oosBox}</div>` : "")
      : items.length ? `<div class="card"><div class="t">${isQuote ? t("شروط العرض", "Terms of this offer") : t("شروط السداد", "Payment terms")}</div><ul>${items.map((i) => `<li>${bdi(i)}</li>`).join("")}</ul></div>` : "";
    const payAmount = `${cur} ${money(isQuote ? doc.total : Math.max(due, 0))}`;
    const settled = !isQuote && due <= 0;
    const payNote = settled
      ? t("هذه الفاتورة مسددة بالكامل. افتح الرابط لمراجعة المستند الأصلي وإثبات السداد.", "This invoice is fully paid. Open the link to review the original invoice and payment confirmation.")
      : orgTaxRegistered
      ? t(`امسح الرمز أو افتح الرابط وادفع الإجمالي ${payAmount} بخطوة واحدة — المبلغ شامل الضريبة، بلا رسوم إضافية.`, `Scan the code or open the link and pay ${payAmount} in one step — tax included, no extra fees.`)
      : t(`امسح الرمز أو افتح الرابط وادفع الإجمالي ${payAmount} بخطوة واحدة — بلا رسوم إضافية.`, `Scan the code or open the link and pay ${payAmount} in one step — no extra fees.`);
    const payCard = link ? `<div class="card"><div class="t">${settled ? t("الفاتورة الأصلية وإثبات السداد", "Original invoice and payment confirmation") : t("الدفع الإلكتروني المباشر", "Pay online")}</div><div class="epay"><div class="qr">${qrSvg(link)}</div><div><p>${payNote}</p><a href="${esc(link)}">${esc(link)}</a>${settled ? "" : `<div class="chips"><span class="chip">Apple Pay ✓</span><span class="chip">${t("بطاقة ائتمانية / مدى", "Credit card / mada")} ✓</span><span class="chip">${t("بوابة دفع مؤمَّنة", "Secure gateway")} 🔒</span></div>`}</div></div></div>` : "";
    const h = 20 + Math.max(items.reduce((s, i) => s + textHeight(i, 70, 5.2, 1.7), 0) / (identity && !payCard ? 2 : 1) + (oos.length ? 12 + oos.reduce((s, i) => s + textHeight(i, payCard ? 70 : 160, 5, 1.7), 0) : 0), link ? 42 : 0);
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
    const noteHtml = identity && tpl.paymentPlanNote ? `<div class="flag">${bdi(tpl.paymentPlanNote)}</div>` : "";
    if (stations && plan.length >= 2 && plan.length <= 4 && (doc.paymentPlan?.length || 0) > 0) {
      // «المحطات» · 2-4 columns separated by a chevron · huge step number · % · label · SAR sub-line ·
      // then a numbered explainer box (fill) and the optional flag line
      const chevron = `<div class="chev"><svg viewBox="0 0 12 24" aria-hidden="true"><path d="M2 2l8 10-8 10"/></svg></div>`;
      const pct = (p: PaymentPlanRow) => p.percent ? qty(p.percent) : (doc.total > 0 ? qty(Math.round((p.total / doc.total) * 1000) / 10) : "");
      const cols = plan.map((p, i) => `<div class="stn"><div class="no">${String(i + 1).padStart(2, "0")}</div><div class="r"></div>${pct(p) ? `<div class="pc">${num(`${pct(p)}%`)}</div>` : ""}<div class="lb">${bdi(p.label)}</div><div class="am">${num(`${cur} ${money(p.total)}`)}</div></div>`).join(chevron);
      const expl = `<div class="expl"><ol>${plan.map((p) => `<li><strong>${bdi(p.label)}</strong>${planNote(p) ? ` — ${bdi(planNote(p))}` : ""} · ${num(`${cur} ${money(p.total)}`)}</li>`).join("")}</ol></div>`;
      const html = `<div class="h3">${t("خطة الدفع", "Payment plan")}</div><div class="stations">${cols}</div>${expl}${noteHtml}`;
      return { kind: "html", h: 16 + 42 + 8 + plan.length * 6 + (noteHtml ? 12 : 0), html };
    }
    const rows = plan.map((p, i) => `<tr><td class="idx">${String(i + 1).padStart(2, "0")}</td><td>${bdi(p.label)}${planNote(p) ? `<div class="rest" style="font-size:7.5pt;color:var(--muted)">${bdi(planNote(p))}</div>` : ""}</td>${hasNet ? `<td class="n">${num(money(p.net))}</td><td class="n">${num(money(p.tax))}</td>` : ""}<td class="n"><strong>${num(money(p.total))}</strong></td></tr>`).join("");
    const html = `<div class="h3">${t("جدول السداد", "Payment schedule")}</div><table class="plan"><colgroup><col style="width:10mm"><col>${hasNet ? `<col style="width:30mm"><col style="width:26mm">` : ""}<col style="width:32mm"></colgroup><thead><tr><th>#</th><th>${t("الدفعة", "Instalment")}</th>${hasNet ? `<th class="n">${t("الخاضع", "Net")} (${esc(cur)})</th><th class="n">${t("الضريبة", "Tax")}</th>` : ""}<th class="n">${t("الإجمالي", "Total")}</th></tr></thead><tbody>${rows}${plan.length > 1 && (doc.paymentPlan?.length || 0) > 0 ? `<tr class="sum"><td></td><td>${t("الإجمالي", "Total")}</td>${hasNet ? `<td class="n">${num(money(sum.net))}</td><td class="n">${num(money(sum.tax))}</td>` : ""}<td class="n">${num(money(sum.total))}</td></tr>` : ""}</tbody></table>${noteHtml}`;
    return { kind: "html", h: 16 + (plan.length + 1) * 9 + (noteHtml ? 12 : 0), html };
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
    const bankLogo = identity ? safeUrl(tpl.bankLogoUrl) : "";
    if (bankLogo) {
      // identity bank card · logo 62px · bank name AR bold + EN caption · IBAN grouped by 4 · SWIFT + currency · beneficiary rows
      const rows: string[] = [];
      rows.push(`<tr><td>${t("اسم المستفيد", "Beneficiary")}</td><td>${bdi(b.holder || org.legalName || org.name)}</td></tr>`);
      if (b.accountNumber) rows.push(`<tr><td>${t("رقم الحساب", "Account no.")}</td><td>${num(b.accountNumber)}</td></tr>`);
      if (b.routingNumber) rows.push(`<tr><td>Routing</td><td>${num(b.routingNumber)}</td></tr>`);
      const sub = [b.swiftCode ? `SWIFT ${b.swiftCode}` : "", b.currency ? String(b.currency) : ""].filter(Boolean).join(" · ");
      const html = `<div class="cards" style="grid-template-columns:1fr"><div class="card bank"><div class="t">${t("التحويل البنكي", "Bank transfer")}</div><div class="bankc"><img src="${esc(bankLogo)}" alt=""><div>${b.bankName ? `<div class="bn">${bdi(b.bankName)}</div>` : ""}${b.name && b.name !== b.bankName ? `<div class="be">${esc(b.name)}</div>` : ""}${b.iban ? `<div class="iban">${esc(ibanGroups(b.iban))}</div>` : ""}${sub ? `<div class="sw">${esc(sub)}</div>` : ""}<table>${rows.join("")}</table></div></div></div></div>`;
      return { kind: "html", h: 30 + rows.length * 6, html };
    }
    return { kind: "html", h: 14 + dl.length * 5.5, html: `<div class="cards" style="grid-template-columns:1fr"><div class="card bank"><div class="t">${t("التحويل البنكي", "Bank transfer")}</div><dl>${dl.join("")}</dl></div></div>` };
  };

  const companyBlock = (): Block => {
    const parts: string[] = [];
    parts.push(`<strong>${t("عن الجهة المُصدِرة:", "About the issuer:")}</strong> <strong>${bdi(ar ? org.name : (org.legalName || org.nameEn || org.name))}</strong>`);
    // identifiers stay LTR-isolated · an un-isolated "2026-001962138" reorders inside Arabic text
    const ids = [org.crNumber ? `${t("س.ت", "CR")} ${num(org.crNumber)}` : "", org.vatNumber ? `${regLabel(org)} ${num(org.vatNumber)}` : ""].filter(Boolean);
    if (ids.length) parts.push(`(${ids.join(" · ")})`);
    const where = [org.address, org.city].filter(Boolean).map(bdi).join(" · ");
    if (where) parts.push(`— ${where}`);
    const ch = [org.phone, org.email, org.website].filter(Boolean).map((v) => num(v)).join(" · ");
    if (ch) parts.push(`· ${ch}`);
    parts.push(t("هي الطرف المتعاقد والمسؤول أمام العميل عن هذا المستند والفوترة والدعم طوال مدة التعامل.", "is the contracting party responsible to the client for this document, invoicing and support throughout the engagement."));
    return { kind: "html", h: 26, html: `<div class="note"><div class="i">i</div><div>${parts.join(" ")}</div></div>` };
  };

  const signatoryBlock = (): Block | null => {
    // Pen-style signature (CEO 2026-09-08): a real uploaded signature image wins when
    // present · otherwise the signatory's own name is set in the script face — never a
    // hardcoded person. Arabic names have no glyphs in this Latin script face, so they
    // keep the bold sans instead of falling back to tofu.
    const sigImg = safeUrl(tpl.signatureUrl) || safeUrl(org.signatureUrl);
    if (!tpl.signatoryName && !stamp && !sigImg) return null;
    const nameIsLatin = tpl.signatoryName ? !hasArabic(tpl.signatoryName) : false;
    // The uploaded signature image always wins once it exists — even when no
    // signatory name was ever typed in — never fall through to a bare dash
    // when a real signature is on file (CEO 2026-09-08 · «التوقيع مو واضح»).
    const nameHtml = sigImg
      ? `<div class="n img"><img src="${esc(sigImg)}" alt="${esc(tpl.signatoryName || orgName)}"></div>`
      : tpl.signatoryName
        ? `<div class="n${nameIsLatin ? " pen" : ""}">${bdi(tpl.signatoryName)}</div>`
        : `<div class="n">—</div>`;
    if (identity) {
      // identity signature block · 15mm reserved area · rule with navy chip · bold name · uppercase role ·
      // small print · stamp on the issuer side (rotated −8° · multiply · .86 · inside the card flow — never over text)
      const area = `<div class="sarea">${sigImg ? `<img src="${esc(sigImg)}" alt="${esc(tpl.signatoryName || orgName)}">` : (tpl.signatoryName && nameIsLatin ? `<div class="n pen">${bdi(tpl.signatoryName)}</div>` : "")}</div>`;
      const sigI = `<div class="sig"><div class="k">${t("ممثل الشركة", "Company representative")}</div>${area}<div class="srule"></div><div class="n bold">${bdi(tpl.signatoryName || orgName)}</div>${tpl.signatoryTitle ? `<div class="o role">${bdi(tpl.signatoryTitle)}</div>` : ""}${identity && tpl.signatoryTitleAr ? `<div class="o small">${bdi(tpl.signatoryTitleAr)}</div>` : ""}${(tpl.signatoryEmail || tpl.signatoryPhone) ? `<div class="c">${[tpl.signatoryEmail, tpl.signatoryPhone].filter(Boolean).map(esc).join(" · ")}</div>` : ""}<div class="o small">${bdi(ar ? org.name : (org.legalName || org.nameEn || org.name))}</div></div>`;
      const stI = `<div class="stamp"><div class="k">${t("ختم الشركة", "Company stamp")}</div><div class="stamp-box">${stamp ? `<img src="${esc(stamp)}" alt="">` : ""}</div></div>`;
      return { kind: "html", h: 52, html: `<div class="sig-cards">${ar ? stI + sigI : sigI + stI}</div>` };
    }
    // frameless by instruction · no .card wrapper on either block
    const sig = `<div class="sig"><div class="k">${t("ممثل الشركة", "Company representative")}</div>${nameHtml}${tpl.signatoryTitle ? `<div class="o">${bdi(tpl.signatoryTitle)}</div>` : ""}${(tpl.signatoryEmail || tpl.signatoryPhone) ? `<div class="c">${[tpl.signatoryEmail, tpl.signatoryPhone].filter(Boolean).map(esc).join(" · ")}</div>` : ""}<div class="o">${bdi(ar ? org.name : (org.legalName || org.nameEn || org.name))}</div></div>`;
    const st = `<div class="stamp"><div class="k">${t("ختم الشركة", "Company stamp")}</div><div class="stamp-box">${stamp ? `<img src="${esc(stamp)}" alt="">` : ""}</div></div>`;
    // stamp keeps the outer edge in both scripts (right in RTL · right in LTR)
    return { kind: "html", h: 50, html: `<div class="sig-cards">${ar ? st + sig : sig + st}</div>` };
  };

  // Terms & conditions ALWAYS get their own standalone sheet (CEO 2026-09-08 · «سوي صفحة
  // الشروط والاحكام مستقلة لابد تكون موجودة»): a template/org's own closingTerms print when
  // set, otherwise a neutral default clause set — the page is never simply omitted.
  const DEFAULT_CLOSING_AR = [
    "القبول | يُعد استخدام هذا المستند أو التوقيع عليه أو الشروع في التنفيذ بموجبه قبولًا بجميع ما ورد فيه من شروط.",
    "السداد | تُستحق المبالغ وفق الشروط والمواعيد الموضحة في هذا المستند، ما لم يُتفق كتابيًا على خلاف ذلك.",
    "الصلاحية | يبقى هذا المستند ساريًا حتى التاريخ المحدد فيه، ما لم يُجدَّد أو يُعدَّل كتابيًا.",
    "التعديلات | أي تعديل على البنود أو الأسعار يكون نافذًا فقط إذا تم كتابيًا وبموافقة الطرفين.",
    "السرية | هذا المستند سرّي وموجّه حصرًا للعميل المذكور فيه، ولا يجوز مشاركته مع طرف ثالث دون إذن كتابي.",
  ];
  const DEFAULT_CLOSING_EN = [
    "Acceptance | Using, signing, or acting on this document constitutes acceptance of all terms stated in it.",
    "Payment | Amounts fall due per the terms and dates shown in this document, unless otherwise agreed in writing.",
    "Validity | This document remains valid until the date stated in it, unless renewed or amended in writing.",
    "Amendments | Any change to items or prices takes effect only when made in writing and agreed by both parties.",
    "Confidentiality | This document is confidential and addressed solely to the named client; it may not be shared with a third party without written permission.",
  ];
  const closingLinesRaw = lines(ar ? tpl.closingTerms : (tpl.closingTermsEn || tpl.closingTerms));
  const closingLines = closingLinesRaw.length ? closingLinesRaw : (ar ? DEFAULT_CLOSING_AR : DEFAULT_CLOSING_EN);
  const hasClosing = on("closing");

  // ── identity QUOTE composer (round 2 · 2026-09-14 · reference EDG-Q-2026-0010, page by page) ──
  // Page law: every page starts a fresh sheet (forceBreak on its title · keepWithNext so a title never
  // strands alone); content that overflows continues on the next sheet under the same header /
  // watermark / footer; "near the footer" notes are `bottom` blocks (budgeted, never overlapping).
  const identityQuote = identity && isQuote;
  const COLW = 182; // usable mm across the sheet
  const sar = (v: number) => `${money(v)} ${cur === "SAR" ? t("ر.س", "SAR") : cur}`;
  const pageTitle = (a: string, e: string): Block => ({ kind: "html", h: 16.8, forceBreak: true, keepWithNext: true, html: `<div class="st"><div class="a">${esc(a)}</div><div class="e">${esc(e)}</div></div>` });
  const sectionHead = (a: string, e: string, sub = ""): Block => ({ kind: "html", h: sub ? 12.8 : 11.8, keepWithNext: true, html: `<div class="sh"><div class="a">${esc(a)}</div><div class="e">${esc(e)}${sub ? ` <span class="sub">· ${bdi(sub)}</span>` : ""}</div></div>` });
  const noteBox = (html: string, text: string, bottom = false, cls = "nb"): Block => ({ kind: "html", h: 10 + textHeight(text, COLW - 14, 5.0, 2.05), bottom, html: `<div class="${cls}">${html}</div>` });
  const kvTable = (rows: Array<[string, string]>, cls = "kv"): Block => ({ kind: "table", open: `<table class="${cls}"><colgroup><col style="width:46mm"><col></colgroup>`, head: "", headH: 0, rows: rows.map(([k, v]) => ({ h: 7.2 + Math.max(5.6, textHeight(v.replace(/<[^>]+>/g, ""), 118, 5, 1.85), textHeight(k, 40, 5, 2.0)), html: `<tr><td class="k">${bdi(k)}</td><td class="v">${v}</td></tr>` })), close: `</table>`, cont: `<div class="cont">${t("يتبع", "continued")} …</div>` });
  const ordinalAr = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
  const ordinalEn = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

  /** Quotation & cost page · meta strip · scope · BOQ · totals + tafqit · QR card · tax note */
  const identityQuotationPage = () => {
    blocks.push(pageTitle(t("عـرض سـعـر", "Quotation"), "QUOTATION"));
    const cells: string[] = [];
    const norm = (x?: string | null) => String(x || "").replace(/\s+/g, "").toUpperCase();
    cells.push(`<div class="cell serial"><div class="k">QUOTATION NO</div><div class="v">${num(doc.number)}</div></div>`);
    if (doc.reference) cells.push(`<div class="cell"><div class="k">${esc(ar ? "OPPORTUNITY NO" : "OPPORTUNITY NO")}</div><div class="v">${num(doc.reference)}</div></div>`);
    if (doc.reference2 && norm(doc.reference2) !== norm(doc.reference)) cells.push(`<div class="cell"><div class="k">${esc((tpl.reference2Label || "REFERENCE").toUpperCase())}</div><div class="v">${num(doc.reference2)}</div></div>`);
    cells.push(`<div class="cell"><div class="k">DATE</div><div class="v">${num(issue)}</div></div>`);
    blocks.push({ kind: "html", h: 17, keepWithNext: true, html: `<div class="meta-strip idm q" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.join("")}</div>` });
    // scope of work · doc.scope → template coverIntro (filled) · doc.title as the bold sub-line
    const scopeText = String(doc.scope || "").trim() || ((ar ? tpl.coverIntro : (tpl.coverIntroEn || tpl.coverIntro)) || "").trim();
    if (scopeText || doc.title) {
      blocks.push(sectionHead(t("نطاق الأعمال", "Scope of work"), "SCOPE OF WORK"));
      const fillTxt = (x: string) => esc(x).replace(/\{company\}/g, bdi(orgName)).replace(/\{client\}/g, bdi(clientName)).replace(/\{number\}/g, num(doc.number)).replace(/\{date\}/g, num(issue)).replace(/\{total\}/g, num(`${cur} ${money(doc.total)}`)).replace(/\{reference\}/g, num(doc.reference || "—")).replace(/\{title\}/g, bdi(doc.title || ""));
      const titleLine = doc.title ? doc.title.split(/\r?\n/).filter(Boolean).join(" · ") : "";
      blocks.push({ kind: "html", h: (titleLine ? 6.8 : 0) + (scopeText ? 2 + textHeight(scopeText, COLW, 5.6, 2.0) : 0) + 2, html: `${titleLine ? `<div class="scope-t">${bdi(titleLine)}</div>` : ""}${scopeText ? `<p class="scope">${fillTxt(scopeText)}</p>` : ""}` });
    }
    // pricing · BOQ (# · description · qty+unit · unit price · total)
    blocks.push(sectionHead(t("البند والتكلفة", "Pricing"), "PRICING"));
    const rows: Array<{ h: number; html: string }> = [];
    let lastSec: string | null = null;
    const multi = new Set(included.map((l) => l.sectionLabel || "")).size > 1;
    const boqRow = (l: LineSpec, i: number) => {
      const parts = String(l.description || "").split(/\r?\n/);
      const headTxt = parts[0] || "";
      const rest = parts.slice(1).join("\n").trim();
      const h = 6 + Math.max(9, textHeight(headTxt, 88, 5, 2.05)) + (rest ? textHeight(rest, 88, 4.4, 1.7) : 0) + (l.code && !identity ? 3 : 0);
      return { h, html: `<tr><td class="n idx">${num(String(i + 1))}</td><td><div class="head">${bdi(headTxt)}</div>${rest ? `<div class="rest">${bdi(rest)}</div>` : ""}${l.code && !identity ? `<div class="code">${esc(l.code)}</div>` : ""}</td><td class="n"><div class="u">${bdi(l.unit || t("عدد", "qty"))}</div>${num(qty(l.quantity))}</td><td class="n">${num(money(l.unitPrice))}</td><td class="n">${num(money(l.subtotal))}</td></tr>` };
    };
    included.forEach((l, i) => {
      const sec = l.sectionLabel || "";
      if (multi && sec !== lastSec) { rows.push({ h: 8, html: `<tr class="sec"><td colspan="5">${bdi(sec || t("بنود عامة", "General items"))}</td></tr>` }); lastSec = sec; }
      rows.push(boqRow(l, i));
    });
    if (optional.length) {
      rows.push({ h: 8, html: `<tr class="sec"><td colspan="5">${t("بنود اختيارية — غير مشمولة في الإجمالي", "Optional items — not included in the total")}</td></tr>` });
      optional.forEach((l, i) => rows.push(boqRow(l, included.length + i)));
    }
    blocks.push({ kind: "table", open: `<table class="items boq"><colgroup><col style="width:12mm"><col><col style="width:20mm"><col style="width:30mm"><col style="width:32mm"></colgroup>`,
      head: `<thead><tr><th class="n">${t("البند", "#")}</th><th>${t("الوصف", "Description")}</th><th class="n">${t("الكمية", "Qty")}</th><th class="n">${t("سعر الوحدة", "Unit price")}</th><th class="n">${t("السعر الإجمالي", "Total")}</th></tr></thead>`,
      headH: 11, rows, close: `</table>`, cont: `<div class="cont">${t("يتبع في الصفحة التالية", "continued on the next page")} …</div>` });
    // totals + tafqit (one unit) · then the QR card · then the tax note — the unit never splits
    const tr: string[] = [];
    tr.push(`<div class="r"><span class="lbl">${t("المجموع الفرعي", "Subtotal")}</span><span class="amt">${num(`${cur} ${money(discount > 0.005 ? listPrice : taxable)}`)}</span></div>`);
    if (discount > 0.005) {
      tr.push(`<div class="r disc"><span class="lbl">${t("الخصم", "Discount")}</span><span class="amt">${num(`- ${cur} ${money(discount)}`)}</span></div>`);
      tr.push(`<div class="r"><span class="lbl">${t("الصافي", "Net")}</span><span class="amt">${num(`${cur} ${money(taxable)}`)}</span></div>`);
    }
    if (orgTaxRegistered && tpl.showTaxBreakdown !== false) tr.push(`<div class="r"><span class="lbl">${taxLabel}</span><span class="amt">${num(`${cur} ${money(doc.taxTotal)}`)}</span></div>`);
    tr.push(`<div class="r grand"><span class="lbl">${orgTaxRegistered ? t("الإجمالي شامل الضريبة", "Total incl. VAT") : t("الإجمالي", "Total")}</span><span class="amt">${num(`${cur} ${money(doc.total)}`)}</span></div>`);
    const words = showWords && cur === "SAR" ? `<div class="tafqit">${esc(tafqitSar(doc.total, lang))}</div>` : "";
    blocks.push({ kind: "html", h: (tr.length - 1) * 7.6 + 11 + (words ? 9.8 : 0) + 4.5, html: `<div class="tot2"><div class="totals">${tr.join("")}</div>${words}</div>` });
    const zatca = orgTaxRegistered && !!doc.qrPayload;
    const qrText = zatca ? doc.qrPayload! : (doc.number || "");
    const qr = qrText ? qrSvg(qrText) : "";
    if (qr) {
      const qrRows = zatca
        ? [[t("اسم البائع", "Seller"), bdi(org.legalName || org.name)], [t("الرقم الضريبي", "VAT no."), num(org.vatNumber || "")], [t("الإجمالي شامل الضريبة", "Total incl. VAT"), num(`${money(doc.total)} ${cur}`)], [t("مقدار الضريبة", "VAT amount"), num(`${money(doc.taxTotal)} ${cur}`)]]
        : [[t("رقم المستند", "Document no."), num(doc.number)], [t("التاريخ", "Date"), num(issue)], [t("الإجمالي", "Total"), num(`${money(doc.total)} ${cur}`)]];
      const qrLead = zatca
        ? t("يحمل بيانات المنشأة والمبلغ بصيغة TLV المعتمدة من هيئة الزكاة والضريبة والجمارك، ويُقرأ بتطبيق التحقق من الفواتير.", "Carries the issuer and amount data in the ZATCA-approved TLV format and reads with the invoice verification app.")
        : t("رمز التحقق من رقم المستند.", "Document verification code.");
      blocks.push({ kind: "html", h: 37.5, html: `<div class="qrc"><div class="qrc-body"><div class="t">${t("رمز الاستجابة السريعة (QR)", "QR code")}</div><p>${qrLead}</p><dl class="qr-data">${qrRows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div><div class="qr">${qr}</div></div>` });
    }
    const taxNote = String(doc.notes || tpl.notes || "").trim() || (orgTaxRegistered
      ? t("الأسعار بالريال السعودي وغير شاملة ضريبة القيمة المضافة 15% المبيَّنة أعلاه. وتُصدَر الفاتورة الضريبية النظامية عند اعتماد العرض وتنفيذ الأعمال.", "Prices are in Saudi Riyals and exclude the 15% VAT shown above. The statutory tax invoice is issued on approval of this offer and execution of the works.")
      : t("الأسعار بالعملة المبيَّنة أعلاه، وتُصدَر الفاتورة عند اعتماد العرض وتنفيذ الأعمال.", "Prices are in the currency shown above; the invoice is issued on approval of this offer and execution of the works."));
    blocks.push(noteBox(bdi(taxNote), taxNote));
  };

  /** Payment plan page · stations · «كيف تُحتسب الدفعات» · bottom note */
  const identityPlanPage = () => {
    let plan = doc.paymentPlan && doc.paymentPlan.length ? doc.paymentPlan.slice(0, 8) : null;
    if (!plan && stations) {
      // default 30 / 60 / 10 stations · the last one absorbs rounding
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const a = r2(doc.total * 0.3), b = r2(doc.total * 0.6);
      plan = [
        { label: t("دفعة مقدّمة", "Advance payment"), note: t("عند الاعتماد الكتابي وقبل بدء التنفيذ", "On written approval, before work starts"), percent: 30, net: 0, tax: 0, total: a },
        { label: t("عند التوريد والتركيب", "On supply and installation"), note: t("بعد إتمام التوريد والتركيب في الموقع", "After supply and installation on site"), percent: 60, net: 0, tax: 0, total: b },
        { label: t("عند التسليم النهائي", "On final handover"), note: t("بعد الفحص النهائي وتوقيع محضر التسليم", "After the final inspection and the handover report"), percent: 10, net: 0, tax: 0, total: r2(doc.total - a - b) },
      ];
    }
    if (!plan || !plan.length) return;
    blocks.push(pageTitle(t("خطة الدفع", "Payment plan"), "PAYMENT PLAN"));
    const pct = (p: PaymentPlanRow) => p.percent ? qty(p.percent) : (doc.total > 0 ? qty(Math.round((p.total / doc.total) * 1000) / 10) : "");
    const noteOf = (p: PaymentPlanRow) => planNoteOf(p) || "";
    if (stations && plan.length <= 4) {
      const chevron = `<div class="chev"><svg viewBox="0 0 12 24" aria-hidden="true"><path d="M2 2l8 10-8 10"/></svg></div>`;
      const cols = plan.map((p, i) => `<div class="stn"><div class="no">${i + 1}</div><div class="r"></div>${pct(p) ? `<div class="pc">${num(`${pct(p)}%`)}</div>` : ""}<div class="lb">${bdi(p.label)}</div><div class="am">${noteOf(p) ? `${bdi(noteOf(p))} — ` : ""}${bdi(t("بقيمة", "amount"))} ${num(sar(p.total))}</div></div>`).join(chevron);
      blocks.push({ kind: "html", h: 57, html: `<div class="stations">${cols}</div>` });
    } else {
      const rows = plan.map((p, i) => ({ h: 9, html: `<tr><td class="n idx">${num(String(i + 1))}</td><td>${bdi(p.label)}${noteOf(p) ? `<div class="rest">${bdi(noteOf(p))}</div>` : ""}</td><td class="n">${pct(p) ? num(`${pct(p)}%`) : ""}</td><td class="n"><strong>${num(money(p.total))}</strong></td></tr>` }));
      blocks.push({ kind: "table", open: `<table class="items boq plan2"><colgroup><col style="width:12mm"><col><col style="width:22mm"><col style="width:34mm"></colgroup>`, head: `<thead><tr><th class="n">#</th><th>${t("الدفعة", "Instalment")}</th><th class="n">%</th><th class="n">${t("الإجمالي", "Total")} (${esc(cur)})</th></tr></thead>`, headH: 12, rows, close: `</table>`, cont: `<div class="cont">${t("يتبع", "continued")} …</div>` });
    }
    // explainer · auto-generated from the rows
    const items = plan.map((p, i) => ar
      ? `الدفعة ${ordinalAr[i] || String(i + 1)} (${qty(Number(pct(p)) || 0)}% – ${money(p.total)} ر.س) تُستحق ${noteOf(p) || p.label}.`
      : `The ${ordinalEn[i] || String(i + 1)} instalment (${pct(p)}% – ${money(p.total)} ${cur}) falls due ${noteOf(p) || p.label}.`);
    items.push(t("التحويل باسم المنشأة على الحساب المذكور في هذا العرض — لا تُقبل التحويلات إلى حسابات أفراد.", "Transfers in the company's name to the account stated in this offer — transfers to personal accounts are not accepted."));
    if (orgTaxRegistered) items.push(t("تُصدَر فاتورة ضريبية نظامية عن كل دفعة عند استحقاقها.", "A statutory tax invoice is issued for every instalment when it falls due."));
    blocks.push({ kind: "html", h: 15 + items.reduce((a, it) => a + textHeight(it, COLW - 16, 5.2, 2.05), 0), html: `<div class="expl"><div class="t">${t("كيف تُحتسب الدفعات", "How the instalments are computed")}</div><ol>${items.map((it) => `<li>${bdi(it)}</li>`).join("")}</ol></div>` });
    const pn = String(tpl.paymentPlanNote || "").trim() || t(`القيم أعلاه محسوبة من الإجمالي شامل الضريبة (${money(doc.total)} ر.س). خطة الدفع مقترحة وقابلة للتعديل بالاتفاق الكتابي.`, `The amounts above are computed from the total incl. VAT (${money(doc.total)} ${cur}). The plan is a proposal and can be adjusted in writing.`);
    blocks.push(noteBox(bdi(pn), pn, true));
  };
  const planNoteOf = (p: PaymentPlanRow): string | null => {
    if (p.note) return p.note;
    const v = p.conditionValue || "";
    const cond = p.condition === "SIGNATURE" ? t("عند التوقيع", "on signature")
      : p.condition === "PROGRESS" ? (v ? t(`عند إنجاز ${v}%`, `at ${v}% progress`) : t("حسب نسبة الإنجاز", "by progress"))
      : p.condition === "DELIVERY" ? t("عند التسليم", "on delivery")
      : p.condition === "DATE" ? (v ? t(`في ${v}`, `on ${v}`) : "")
      : p.condition === "MILESTONE" ? (v ? t(`عند: ${v}`, `at: ${v}`) : "")
      : "";
    return cond || null;
  };

  /** Delivery & bank page · facts table · note · bank card · beneficiary rows · stamp bottom-start */
  const identityDeliveryPage = () => {
    const facts = (Array.isArray(tpl.deliveryFacts) ? tpl.deliveryFacts : []).filter((f) => f && (f.label || f.value)).slice(0, 10);
    const b = on("bank") ? input.bank : null;
    const hasBank = !!(b && (b.iban || b.accountNumber));
    const dn = String(tpl.deliveryNote || "").trim();
    if (!facts.length && !hasBank && !dn) return;
    blocks.push(pageTitle(t("مدة التنفيذ والحساب البنكي", "Delivery & bank details"), "DELIVERY & BANK DETAILS"));
    if (facts.length) blocks.push(kvTable(facts.map((f) => [f.label, bdi(f.value)])));
    if (dn) blocks.push(noteBox(bdi(dn), dn));
    if (hasBank && b) {
      blocks.push(sectionHead(t("الحساب البنكي", "Bank details"), "BANK DETAILS", t("التحويل باسم المنشأة فقط", "transfers in the company's name only")));
      const bankLogo = safeUrl(tpl.bankLogoUrl);
      const sub = [b.swiftCode ? `SWIFT / BIC · <b>${esc(b.swiftCode)}</b>` : "", b.currency ? `${t("العملة", "Currency")} · <b>${esc(b.currency)}</b>` : ""].filter(Boolean).join(" &nbsp;&nbsp; ");
      blocks.push({ kind: "html", h: 38, keepWithNext: true, html: `<div class="bankc2">${bankLogo ? `<img src="${esc(bankLogo)}" alt="">` : ""}<div class="bd">${b.bankName ? `<div class="bn">${bdi(b.bankName)}</div>` : ""}${b.name && b.name !== b.bankName ? `<div class="be">${esc(b.name)}</div>` : ""}${b.iban ? `<div class="iban">${esc(ibanGroups(b.iban))}</div>` : b.accountNumber ? `<div class="iban">${esc(b.accountNumber)}</div>` : ""}${sub ? `<div class="sw">${sub}</div>` : ""}</div></div>` });
      const ben: Array<[string, string]> = [[t("اسم المستفيد", "Beneficiary"), `<b>${bdi(b.holder || org.legalName || org.name)}</b>`]];
      if (b.iban && b.accountNumber) ben.push([t("رقم الحساب", "Account no."), num(b.accountNumber)]);
      if (org.crNumber) ben.push([t("رقم السجل التجاري", "Commercial registration"), num(org.crNumber)]);
      if (org.vatNumber) ben.push([regLabel(org), num(org.vatNumber)]);
      blocks.push(kvTable(ben, "kv ben"));
    }
    if (stamp) blocks.push({ kind: "html", h: 42, bottom: true, optional: true, html: `<div class="stamp-free"><img src="${esc(stamp)}" alt=""></div>` });
  };

  /** Terms page · two-column numbered terms (never split) · bottom «خارج نطاق هذا العرض» */
  const identityTermsPage = () => {
    const raw = ar ? (doc.termsConditions || tpl.terms || "") : (doc.termsConditions || tpl.termsEn || tpl.terms || "");
    const paras = String(raw).replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const strip = (x: string) => x.replace(/^\s*(?:[-•·*]|\d+[.)])\s*/, "").trim();
    let items: Array<{ title: string; body: string }> = [];
    if (paras.length > 1) items = paras.map((pg) => { const ls = pg.split("\n").map(strip).filter(Boolean); const c = clause(ls[0] || ""); return ls.length > 1 ? { title: c.title || ls[0], body: (c.title ? [c.text, ...ls.slice(1)] : ls.slice(1)).join(" ") } : { title: c.title, body: c.text }; });
    else items = lines(raw).map((l) => { const c = clause(l); return { title: c.title, body: c.text }; });
    if (tpl.showTerms === false) items = [];
    const oosRaw = String(doc.outOfScope || (ar ? tpl.outOfScope : (tpl.outOfScopeEn || tpl.outOfScope)) || "");
    const oos = lines(oosRaw);
    if (!items.length && !oos.length) return;
    blocks.push(pageTitle(t("الشروط والأحكام", "Terms & conditions"), "TERMS & CONDITIONS"));
    // column order like the reference (1-4 start column · 5-8 end column) · each grid row is one
    // paginator block, so a term never splits across a column or a page
    const cell = (it: { title: string; body: string } | undefined, i: number) => it ? `<div class="ti"><b><span class="no">${i + 1}.</span> ${it.title ? bdi(it.title) : ""}</b><span>${bdi(it.body)}</span></div>` : `<div class="ti"></div>`;
    const half = Math.ceil(items.length / 2);
    for (let i = 0; i < half; i++) {
      const a = items[i], b2 = items[i + half];
      const h = 9 + Math.max(textHeight(a.body, 84, 5, 2.05), b2 ? textHeight(b2.body, 84, 5, 2.05) : 0);
      blocks.push({ kind: "html", h, html: `<div class="terms2g">${cell(a, i)}${cell(b2, i + half)}</div>` });
    }
    if (oos.length) {
      const lead = t("خارج نطاق هذا العرض:", "Outside the scope of this offer:");
      const body = oos.length === 1 ? `<b>${lead}</b> ${bdi(oos[0])}` : `<b>${lead}</b><ul>${oos.map((i) => `<li>${bdi(i)}</li>`).join("")}</ul>`;
      blocks.push(noteBox(body, `${lead} ${oos.join(" ")}`, true));
    }
  };

  /** Approval & signature page · statement · summary table · two signature columns · stamp · bottom note */
  const identityApprovalPage = () => {
    if (!on("signatory")) return;
    blocks.push(pageTitle(t("الاعتماد والتوقيع", "Approval & signature"), "APPROVAL & SIGNATURE"));
    const st = String(tpl.approvalText || "").trim() || t("باعتماد هذا العرض تصبح بنوده وأسعار الوحدة الواردة فيه مرجعًا للتنفيذ والمستخلصات، ولا يُعتد بأي تعديل شفهي عليها.", "On approval of this offer, its items and unit prices become the reference for execution and progress claims; no verbal amendment is recognised.");
    blocks.push({ kind: "html", h: 4 + textHeight(st, COLW, 5.8, 2.05), keepWithNext: true, html: `<p class="scope">${bdi(st)}</p>` });
    const same = (a?: string | null, b?: string | null) => String(a || "").replace(/\s+/g, "").toUpperCase() === String(b || "").replace(/\s+/g, "").toUpperCase();
    const sum: Array<[string, string]> = [[t("رقم العرض", "Quotation no."), `<b>${num([doc.number, same(doc.reference2, doc.reference) ? "" : doc.reference2].filter(Boolean).join(" · "))}</b>`]];
    if (doc.reference) sum.push([t("رقم الفرصة / المرجع", "Opportunity / reference"), `<b>${num(doc.reference)}</b>`]);
    if (doc.title) sum.push([t("المشروع", "Project"), `<b>${bdi(doc.title.split(/\r?\n/).filter(Boolean).join(" · "))}</b>`]);
    sum.push([orgTaxRegistered ? t("الإجمالي شامل الضريبة", "Total incl. VAT") : t("الإجمالي", "Total"), `<b>${num(`${money(doc.total)} ${cur}`)}</b>`]);
    if (end) sum.push([t("صلاحية العرض", "Validity"), `<b>${t("حتى", "Until")} ${num(end)}</b>`]);
    blocks.push(kvTable(sum, "kv sum"));
    const sigImg = safeUrl(tpl.signatureUrl) || safeUrl(org.signatureUrl);
    const nameIsLatin = tpl.signatoryName ? !hasArabic(tpl.signatoryName) : false;
    const issuerCol = `<div class="sc"><div class="sarea">${sigImg ? `<img src="${esc(sigImg)}" alt="">` : (tpl.signatoryName && nameIsLatin ? `<div class="n pen">${bdi(tpl.signatoryName)}</div>` : "")}</div><div class="srule"></div><div class="nm">${bdi(tpl.signatoryName || orgName)}</div>${tpl.signatoryTitle ? `<div class="role">${bdi(tpl.signatoryTitle)}</div>` : ""}${tpl.signatoryTitleAr ? `<div class="co">${bdi(tpl.signatoryTitleAr)}</div>` : ""}<div class="co">${bdi(ar ? org.name : (org.legalName || org.nameEn || org.name))}</div>${stamp ? `<div class="stamp-under"><img src="${esc(stamp)}" alt=""></div>` : ""}</div>`;
    const clientCol = `<div class="sc"><div class="sarea"></div><div class="srule"></div><div class="nm">${t("عن الجهة المالكة", "For the owner")}</div><div class="role">Owner</div><div class="co">${bdi(clientName)}</div><div class="co">${t("الاسم والصفة · التوقيع والختم · التاريخ", "Name & title · signature & stamp · date")}</div></div>`;
    blocks.push({ kind: "html", h: 50 + (stamp ? 42 : 0), html: `<div class="sigcols">${clientCol}${issuerCol}</div>` });
    const an = String(tpl.approvalNote || "").trim() || t(`اعتماد العرض: يكفي الرد كتابيًا بالاعتماد على هذا العرض برقمه ${doc.number}، أو إعادته موقَّعًا ومختومًا${tpl.signatoryEmail || org.email ? ` إلى ${tpl.signatoryEmail || org.email}` : ""}${tpl.signatoryPhone || org.phone ? ` أو عبر واتساب ${tpl.signatoryPhone || org.phone}` : ""}.`, `Approval: a written reply approving this offer by its number ${doc.number} is sufficient, or return it signed and stamped${tpl.signatoryEmail || org.email ? ` to ${tpl.signatoryEmail || org.email}` : ""}${tpl.signatoryPhone || org.phone ? ` or via WhatsApp ${tpl.signatoryPhone || org.phone}` : ""}.`);
    blocks.push(noteBox(`<b>${t("اعتماد العرض:", "Approval:")}</b> ${bdi(an.replace(/^(اعتماد العرض:|Approval:)\s*/, ""))}`, an, true));
  };

  if (identityQuote) {
    identityQuotationPage();
  } else {
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
      case "company": b = hasClosing || identity ? null : companyBlock(); break;
      case "signatory": b = hasClosing ? null : signatoryBlock(); break;
      default: b = null;
    }
    if (b) blocks.push(b);
  }
  if (!on("header") && doc.notes && !on("totals")) blocks.push({ kind: "html", h: 20, html: `<div class="notes">${bdi(doc.notes)}</div>` });
  }

  // ── free-form pages (CEO 2026-09-13) ──
  // Each page STARTS a fresh sheet (forceBreak) and flows through the same paginator, so a
  // long page spills onto the next sheet with tables split under a repeated head — never
  // clipped. Everything is escaped by the renderer; image URLs pass safeUrl().
  const pages = normalizePages(doc.pages);
  if (pages.length) {
    const COL = 182; // usable mm across the sheet (210 − 14 − 14)
    const li = (items: string[]) => items.map((it) => `<li>${bdi(it)}</li>`).join("");
    pages.forEach((pg, pi) => {
      const titleText = pg.title || t(`ملحق ${pi + 1}`, `Appendix ${pi + 1}`);
      blocks.push({ kind: "html", h: 16, forceBreak: true, keepWithNext: true, html: `<div class="h2 pg-title">${bdi(titleText)}</div>` });
      for (const b of pg.blocks) {
        switch (b.type) {
          case "heading":
            blocks.push({ kind: "html", h: 4 + textHeight(b.text, COL, 6, 2.2), keepWithNext: true, html: `<div class="pg-h">${bdi(b.text)}</div>` });
            break;
          case "paragraph":
            blocks.push({ kind: "html", h: 3 + textHeight(b.text, COL, 5.2, 1.75), html: `<p class="pg-p">${bdi(b.text)}</p>` });
            break;
          case "note":
            blocks.push({ kind: "html", h: 9 + textHeight(b.text, COL - 12, 5, 1.75), html: `<div class="pg-note">${bdi(b.text)}</div>` });
            break;
          case "bullets":
          case "numbered": {
            const h = 3 + b.items.reduce((acc, it) => acc + textHeight(it, COL - 10, 5.2, 1.75), 0);
            blocks.push({ kind: "html", h, html: `<${b.type === "numbered" ? "ol" : "ul"} class="pg-list">${li(b.items)}</${b.type === "numbered" ? "ol" : "ul"}>` });
            break;
          }
          case "table": {
            const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
            const colMm = COL / cols;
            const head = b.header.length
              ? `<thead><tr>${Array.from({ length: cols }, (_, i) => `<th>${bdi(b.header[i] || "")}</th>`).join("")}</tr></thead>`
              : "";
            const rows = b.rows.map((r) => ({
              h: 3.5 + Math.max(...Array.from({ length: cols }, (_, i) => textHeight(r[i] || "", colMm - 4, 4.6, 1.55))),
              html: `<tr>${Array.from({ length: cols }, (_, i) => `<td>${bdi(r[i] || "")}</td>`).join("")}</tr>`,
            }));
            blocks.push({ kind: "table", open: `<table class="tc pg-table">`, head, headH: head ? 9 : 0, rows, close: `</table>` });
            break;
          }
          case "image": {
            const src = safeUrl(b.url);
            if (!src) break;
            blocks.push({ kind: "html", h: 78, html: `<figure class="pg-fig"><img src="${src}" alt="">${b.caption ? `<figcaption>${bdi(b.caption)}</figcaption>` : ""}</figure>` });
            break;
          }
        }
      }
    });
  }

  // ── closing page (terms & conditions) ──
  // Appended to the SAME block list — one single paginate() pass — rather than paginated
  // on its own. The closing intro carries forceBreak, so it always STARTS a fresh sheet
  // (a standalone T&C page, per CEO instruction) while whatever small tail the main flow
  // left (e.g. a lone terms/bank card) still packs onto the previous sheet instead of
  // being stranded alone on a nearly-empty page (CEO 2026-09-08 · «مافي فراغات كذا مالها
  // داعي أو انه يتوسع» — no sheet is ever emitted mostly empty).
  if (identityQuote) {
    if (on("paymentPlan")) identityPlanPage();
    identityDeliveryPage();
    if (on("terms") || on("closing")) identityTermsPage();
    identityApprovalPage();
  } else if (hasClosing) {
    const clauses = closingLines.map(clause);
    const rows = clauses.map((c, i) => ({
      h: 4 + textHeight(c.text, 118, 4.5, 1.42),
      html: `<tr><td class="idx">${String(i + 1).padStart(2, "0")}</td><td class="ttl">${bdi(c.title || "—")}</td><td>${bdi(c.text)}</td></tr>`,
    }));
    const intro: Block = { kind: "html", h: 26, forceBreak: true, html: `<div class="h2">${t("الشروط والأحكام", "Terms & conditions")}</div><p class="lead">${isQuote
      ? t(`تسري هذه الشروط على عرض السعر ${doc.number} والفاتورة الصادرة بموجبه، وتُعد جزءًا لا يتجزأ من الاتفاق بين الطرفين.`, `These terms apply to quotation ${doc.number} and any invoice issued under it, and form an integral part of the agreement between the parties.`)
      : t(`تسري هذه الشروط على الفاتورة ${doc.number}${doc.reference ? ` بمرجع ${doc.reference}` : ""}.`, `These terms apply to invoice ${doc.number}${doc.reference ? ` (ref. ${doc.reference})` : ""}.`)}</p>` };
    const table: Block = { kind: "table", open: `<table class="tc"><colgroup><col style="width:9mm"><col style="width:34mm"><col></colgroup>`, head: `<thead><tr><th>#</th><th>${t("البند", "Clause")}</th><th>${t("الشرط", "Terms")}</th></tr></thead>`, headH: 9, rows, close: `</table>` };
    blocks.push(intro, table);
    if (on("signatory")) { const s = signatoryBlock(); if (s) blocks.push(s); }
    if (on("company") && !identity) blocks.push(companyBlock());
  }

  for (const page of paginate(blocks, CAP)) {
    // identity sheets: a flex column so `bottom` blocks sit above the footer band · budget stamped for QA
    const body = identity ? `<div class="pgflow">${page.flow}${page.bottom ? `<div class="pgbottom">${page.bottom}</div>` : ""}</div>` : page.flow;
    sheets.push({ cls: "light", body, used: page.used });
  }

  // ── closing page (identity · themed templates) · image or solid navy · white mark · THANK YOU · facts strip ──
  if (themed) {
    // 3 outlined cards (reference closing): number · total incl. VAT · contact — then any template closingFacts
    const auto: Array<{ label: string; value: string }> = [
      { label: isQuote ? t("رقم العرض", "Quotation no.") : t("رقم الفاتورة", "Invoice no."), value: doc.number },
      { label: orgTaxRegistered ? t("الإجمالي شامل الضريبة", "Total incl. VAT") : t("الإجمالي", "Total"), value: `${money(doc.total)} ${cur}` },
      { label: t("التواصل", "Contact"), value: [tpl.signatoryEmail || org.email, tpl.signatoryPhone || org.phone].filter(Boolean).join("\n") },
    ].filter((f) => f.value);
    const facts = [...auto, ...(Array.isArray(tpl.closingFacts) ? tpl.closingFacts : []).filter((f) => f && (f.label || f.value))].slice(0, 6);
    const mark = logoReverse ? `<img src="${esc(logoReverse)}" alt="${esc(orgName)}">` : wordmark();
    const subLine = doc.title ? doc.title.split(/\r?\n/).filter(Boolean).join(" · ") : "";
    const closingText = String(tpl.closingText || "").trim() || (isQuote
      ? t("يسعدنا الإجابة عن أي استفسار حول هذا العرض، ونتطلع إلى العمل معكم.", "We are glad to answer any question about this offer and look forward to working with you.")
      : t("نشكركم على تعاملكم معنا، ونبقى في خدمتكم لأي استفسار حول هذه الفاتورة.", "Thank you for your business — we remain at your service for any question about this invoice."));
    const body = `<div class="cl"><div class="mark">${mark}</div><div class="eyebrow">THANK YOU</div><div class="h1">${t("شكرًا لثقتكم", "Thank you for your trust")}</div>${subLine ? `<div class="sub">${bdi(subLine)}</div>` : ""}<p class="lead">${bdi(closingText)}</p>${facts.length ? `<div class="facts cards3">${facts.map((f) => `<div class="cd"><div class="k">${bdi(f.label)}</div><div class="v">${String(f.value).split("\n").map((v) => `<div>${num(v)}</div>`).join("")}</div></div>`).join("")}</div>` : ""}</div>`;
    sheets.push({ cls: closingImage ? "dark closing cover-img" : "dark closing", body, closing: true, style: closingImage ? `background-image:url('${esc(closingImage)}')` : undefined });
  }

  // ── assemble ──
  const total = sheets.length;
  const wmHtml = watermark ? `<div class="wm"><img src="${esc(watermark)}" alt=""></div>` : "";
  // data-doc-page-check (identity): "flow:<budgeted mm>/<capacity mm>" · a QA gate verifies, per sheet,
  // sheet.querySelector(".pgflow").scrollHeight <= .clientHeight (the sheet itself carries the
  // bottom-anchored watermark, so the flow element is the thing to measure). Cover/closing: "fixed".
  const coverCount = sheets.filter((s) => s.cover).length;
  const bodyHtml = sheets.map((s, i) => `<section class="sheet ${s.cls}" data-page="${i + 1}"${identity ? ` data-doc-page-check="${s.cover || s.closing ? "fixed" : `flow:${Math.round(s.used || 0)}/${CAP}`}"` : ""}${s.style ? ` style="${s.style}"` : ""}>${s.cover || s.closing ? "" : wmHtml}${header(s.cls.startsWith("dark"))}${s.body}${footer(hs ? i + 1 - coverCount : i + 1, total, !!s.cover || !!s.closing)}</section>`).join("\n");
  const actions = input.actions ? `<div class="actions no-print"><button class="primary" type="button" onclick="window.print()">${t("طباعة / حفظ PDF", "Print / save PDF")}</button><button type="button" onclick="window.close()">${t("إغلاق", "Close")}</button></div>` : "";
  const rawCss = buildCss(brand, dark, input.fontBase || "/fonts", lang, !!input.embed, identity ? { theme: themed ? theme : null, extras: theme, hs, fam: hideBrand ? "Doc" : "Entix Doc" } : null);
  // hideProviderBranding · the stylesheet's own comments name the provider's reference sheets — strip them
  const css = hideBrand ? rawCss.replace(/\/\*[\s\S]*?\*\//g, "") : rawCss;
  const rootCls = `edoc${identity ? " idn" : ""}${hs ? " hs" : ""}`;
  const body = `<div class="${rootCls}" dir="${ar ? "rtl" : "ltr"}" lang="${lang}" data-sheets="${total}">${actions}${bodyHtml}</div>`;
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
    country: org.country || "SA",
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
    signatureUrl: org.signatureUrl || null,
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

/** `qrPayload` · a ZATCA TLV built by the caller with zatcaTlvBase64() when the template has showQr (quotes only). */
export function docFromQuote(q: any, qrPayload?: string | null): DocSpec {
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
    qrPayload: qrPayload || null,
    language: q.language === "en" || q.language === "ar" ? q.language : null,
    pages: normalizePages(q.pages),
    outOfScope: q.outOfScope || null,
    scope: q.scope || q.coverIntro || q.intro || null,
    reference2: q.reference2 || null,
  };
}

/** Build the quote QR payload the way every web caller must: template showQr + a Saudi VAT-registered org. */
export function quoteQrPayload(q: any, org: PartySpec | null | undefined, tpl: TemplateSpec | null | undefined): string | null {
  if (!tpl?.showQr || !org?.vatNumber) return null;
  const digits = String(org.vatNumber).replace(/\D/g, "");
  if (String(org.country || "SA").toUpperCase() !== "SA" || digits.length !== 15) return null;
  const day = isoDate(q?.issueDate) || new Date().toISOString().slice(0, 10);
  return zatcaTlvBase64({ sellerName: org.legalName || org.name || "", vatNumber: digits, timestampIso: `${day}T00:00:00Z`, total: n(q?.total), vat: n(q?.taxTotal) });
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
    language: inv.language === "en" || inv.language === "ar" ? inv.language : null,
    pages: normalizePages(inv.pages),
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
  // hideProviderBranding · the sample lines name no provider either
  const product = template?.hideProviderBranding ? (ar ? "النظام المحاسبي" : "Accounting suite") : "ENTIX Books";
  const lines: LineSpec[] = [
    { code: "SP-ENT-ENTP-YR", description: ar ? `${product} · باقة المؤسسات · اشتراك سنوي · إعداد مقاولات\nالنظام المحاسبي الكامل بلا حدود على المستخدمين أو الفروع أو المشاريع · إعداد مخصص لنشاط المقاولات (مشاريع ومراكز تكلفة ودليل حسابات مقاولات) · ترحيل البيانات الحالية · قالب فواتير بهوية الشركة · دعم فني ذو أولوية طوال مدة الاشتراك · 12 شهرًا من تاريخ التفعيل` : `${product} · Enterprise plan · annual subscription · contracting setup\nFull cloud accounting with unlimited users, branches and projects · contracting-specific setup (projects, cost centres, chart of accounts) · data migration · branded invoice template · priority support for the whole term · 12 months from activation`, quantity: 1, unitPrice: 2990, subtotal: 1200, taxRate: 0.15 },
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
  // showQr (identity) · the designer preview carries the same TLV a real quote would
  if (kind === "QUOTE" && template?.showQr) doc.qrPayload = quoteQrPayload(doc, orgSpec, template);
  return { lang, template, org: orgSpec, contact, doc, bank: bank || { bankName: ar ? "البنك الأهلي السعودي" : "Saudi National Bank", iban: "SA03 8000 0000 6080 1016 7519", swiftCode: "NCBKSAJE", currency: "SAR" }, embed: true };
}
