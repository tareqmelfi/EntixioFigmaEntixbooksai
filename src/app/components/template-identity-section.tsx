/**
 * «هوية المستند» · document identity section of the template designer (2026-09-14).
 *
 * Every control here writes a TemplateSpec identity field (src/app/lib/document-render.ts ·
 * field names fixed with the API): preset + 13 colour tokens · header style · embedded font
 * stacks · asset uploads (data URLs ≤ 1.5 MB · downscaled to ≤ 1600 px) · out-of-scope text ·
 * payment-plan style + note · closing facts · toggles. Premium controls lock on the basic plan
 * (identityTier from GET /api/document-templates/defaults) with a pill → /app/settings?tab=plans.
 *
 * UX-1: no dialogs · no browser popups — errors are toasts / inline alerts.
 */
import { useMemo } from "react";
import { Link } from "react-router";
import { Upload, X, Lock, Plus } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineAlert } from "./product";
import { useLanguage } from "./LanguageContext";
import type { IdentityTier } from "../lib/api";
import {
  DOC_FONT_OPTIONS, resolveTheme,
  type DocTheme, type ThemePreset, type HeaderStyle, type PaymentPlanStyle, type ClosingFact,
} from "../lib/document-render";

export interface IdentityValues {
  theme: DocTheme | null;
  themePreset: ThemePreset;
  headerStyle: HeaderStyle;
  logoUrl: string;
  logoLightUrl: string;
  watermarkUrl: string;
  coverImageUrl: string;
  closingImageUrl: string;
  bankLogoUrl: string;
  signatureUrl: string;
  outOfScope: string;
  outOfScopeEn: string;
  paymentPlanStyle: PaymentPlanStyle;
  paymentPlanNote: string;
  /** null = not set (legacy templates keep the Ledger document exactly) */
  showQr: boolean | null;
  amountInWords: boolean | null;
  hideProviderBranding: boolean | null;
  closingFacts: ClosingFact[];
}

export const EMPTY_IDENTITY: IdentityValues = {
  theme: null, themePreset: "ledger", headerStyle: "bar",
  logoUrl: "", logoLightUrl: "", watermarkUrl: "", coverImageUrl: "", closingImageUrl: "", bankLogoUrl: "", signatureUrl: "",
  outOfScope: "", outOfScopeEn: "", paymentPlanStyle: "table", paymentPlanNote: "",
  showQr: null, amountInWords: null, hideProviderBranding: null, closingFacts: [],
};

/** Stored record → designer values (unknown / bad values fall back to the Ledger defaults). */
export function identityFromTemplate(tpl: any): IdentityValues {
  const t = tpl || {};
  return {
    theme: t.theme && typeof t.theme === "object" ? { ...resolveTheme({ theme: t.theme, themePreset: t.themePreset }) } : null,
    themePreset: t.themePreset === "ink-white" || t.themePreset === "custom" ? t.themePreset : "ledger",
    headerStyle: t.headerStyle === "centered" ? "centered" : "bar",
    logoUrl: t.logoUrl || "", logoLightUrl: t.logoLightUrl || "", watermarkUrl: t.watermarkUrl || "",
    coverImageUrl: t.coverImageUrl || "", closingImageUrl: t.closingImageUrl || "", bankLogoUrl: t.bankLogoUrl || "", signatureUrl: t.signatureUrl || "",
    outOfScope: t.outOfScope || "", outOfScopeEn: t.outOfScopeEn || "",
    paymentPlanStyle: t.paymentPlanStyle === "stations" ? "stations" : "table", paymentPlanNote: t.paymentPlanNote || "",
    showQr: typeof t.showQr === "boolean" ? t.showQr : null,
    amountInWords: typeof t.amountInWords === "boolean" ? t.amountInWords : null,
    hideProviderBranding: typeof t.hideProviderBranding === "boolean" ? t.hideProviderBranding : null,
    closingFacts: Array.isArray(t.closingFacts) ? t.closingFacts.filter((f: any) => f && typeof f === "object").map((f: any) => ({ label: String(f.label || ""), value: String(f.value || "") })) : [],
  };
}

/** Designer values → PATCH payload · empty strings become null · a Ledger template with nothing set sends nulls only. */
export function identityPayload(v: IdentityValues) {
  const s = (x: string) => (x && x.trim() ? x : null);
  return {
    theme: v.themePreset === "custom" ? (v.theme || resolveTheme({ themePreset: "custom" })) : null,
    themePreset: v.themePreset === "ledger" ? null : v.themePreset,
    headerStyle: v.headerStyle === "bar" ? null : v.headerStyle,
    logoUrl: s(v.logoUrl), logoLightUrl: s(v.logoLightUrl), watermarkUrl: s(v.watermarkUrl),
    coverImageUrl: s(v.coverImageUrl), closingImageUrl: s(v.closingImageUrl), bankLogoUrl: s(v.bankLogoUrl), signatureUrl: s(v.signatureUrl),
    outOfScope: s(v.outOfScope), outOfScopeEn: s(v.outOfScopeEn),
    paymentPlanStyle: v.paymentPlanStyle === "table" ? null : v.paymentPlanStyle, paymentPlanNote: s(v.paymentPlanNote),
    showQr: v.showQr, amountInWords: v.amountInWords, hideProviderBranding: v.hideProviderBranding,
    closingFacts: v.closingFacts.filter((f) => f.label.trim() || f.value.trim()).length ? v.closingFacts.filter((f) => f.label.trim() || f.value.trim()) : null,
  };
}

/** Premium (full-plan) fields · anything else is available on the basic plan. */
export const PREMIUM_IDENTITY_KEYS: Array<keyof IdentityValues> = ["theme", "themePreset", "headerStyle", "logoLightUrl", "watermarkUrl", "coverImageUrl", "closingImageUrl", "hideProviderBranding", "paymentPlanStyle", "closingFacts"];

export const MAX_ASSET_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE = 1600;

/** File → data URL · rejects > 1.5 MB · raster images downscaled to ≤ 1600 px on the longest side (alpha kept for PNG/WebP). */
export function prepareAssetImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("not_image"));
    if (file.size > MAX_ASSET_BYTES) return reject(new Error("too_large"));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const url = String(reader.result || "");
      if (file.type === "image/svg+xml") return resolve(url);
      const img = new Image();
      img.onerror = () => resolve(url);
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
          if (scale >= 1) return resolve(url);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(url);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const alpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
          resolve(alpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9));
        } catch { resolve(url); }
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}

const HEX = /^#[0-9a-fA-F]{6}$/;
function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 0;
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

type TokenKey = Exclude<keyof DocTheme, "fontArabic" | "fontLatin" | "fontMono">;
const TOKENS: Array<{ k: TokenKey; ar: string; en: string; hintAr: string; hintEn: string }> = [
  { k: "ink", ar: "الحبر", en: "Ink", hintAr: "نص المستند", hintEn: "Body text" },
  { k: "navy", ar: "الكحلي", en: "Navy", hintAr: "رأس الجدول · الغلاف · صفحة الختام", hintEn: "Table head · cover · closing page" },
  { k: "deep", ar: "الداكن", en: "Deep", hintAr: "درجة ثانية للكحلي", hintEn: "Secondary navy" },
  { k: "steel", ar: "الفولاذي", en: "Steel", hintAr: "اللمسات · النسب · الحواف", hintEn: "Accents · percentages · edges" },
  { k: "rule", ar: "الخط", en: "Rule", hintAr: "خطوط فاصلة", hintEn: "Dividers" },
  { k: "chip", ar: "الشريحة", en: "Chip", hintAr: "العناوين الصغيرة على الأسطح الداكنة", hintEn: "Eyebrows on dark grounds" },
  { k: "fill", ar: "التعبئة", en: "Fill", hintAr: "الإجمالي · التفقيط · صندوق الشرح", hintEn: "Grand total · words · explainer" },
  { k: "slate", ar: "الرمادي", en: "Slate", hintAr: "التذييل · العناوين الفرعية", hintEn: "Footer · captions" },
  { k: "serial", ar: "الرقم التسلسلي", en: "Serial", hintAr: "رقم المستند فقط", hintEn: "Document number only" },
  { k: "wash", ar: "الغسيل", en: "Wash", hintAr: "خلفية صناديق الملاحظات", hintEn: "Note box background" },
  { k: "line", ar: "الحدود", en: "Line", hintAr: "حدود الجداول والبطاقات", hintEn: "Table / card borders" },
  { k: "muted", ar: "الخافت", en: "Muted", hintAr: "النص الثانوي", hintEn: "Secondary text" },
  { k: "paper", ar: "الورق", en: "Paper", hintAr: "خلفية الصفحة", hintEn: "Page background" },
];

const PRESETS: Array<{ id: ThemePreset; ar: string; en: string }> = [
  { id: "ledger", ar: "Ledger (الافتراضي)", en: "Ledger (default)" },
  { id: "ink-white", ar: "حبر على أبيض", en: "Ink on white" },
  { id: "custom", ar: "مخصص", en: "Custom" },
];

export function LockPill({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <Link to="/app/settings?tab=plans" className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary ${className}`} data-testid="identity-lock-pill">
      <Lock className="h-3 w-3" /> {t("متاح في باقة الأعمال 2,990 ر.س/سنة", "Business plan · 2,990 SAR/yr")}
    </Link>
  );
}

type Uploader = (file: File, set: (v: string) => void) => void;
function AssetRow({ label, hint, value, onChange, locked, testId, upload }: { label: string; hint?: string; value: string; onChange: (v: string) => void; locked: boolean; testId: string; upload: Uploader }) {
  const { t } = useLanguage();
  return (
    <div className={`space-y-1 ${locked ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2"><Label>{label}</Label>{locked && <LockPill />}</div>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-2.5">
        {value ? <img src={value} alt="" className="h-10 max-w-[120px] object-contain" /> : <span className="text-xs text-muted-foreground">{hint || t("لا يوجد", "None")}</span>}
        <div className="ms-auto flex items-center gap-2">
          {value && !locked && <button type="button" onClick={() => onChange("")} className="text-xs text-muted-foreground hover:text-danger inline-flex items-center gap-1"><X className="h-3 w-3" />{t("إزالة", "Remove")}</button>}
          <label className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs ${locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-hover"}`}>
            <Upload className="h-3.5 w-3.5" /> {t("رفع", "Upload")}
            <input type="file" accept="image/*" className="sr-only" disabled={locked} data-testid={testId}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, onChange); }} />
          </label>
        </div>
      </div>
    </div>
  );
}

type ToggleKey = "showQr" | "amountInWords" | "hideProviderBranding";
function Toggle({ label, hint, k, locked, value, onChange }: { label: string; hint?: string; k: ToggleKey; locked?: boolean; value: IdentityValues; onChange: (patch: Partial<IdentityValues>) => void }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-1 text-sm ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <span><span style={{ fontWeight: 600 }}>{label}</span>{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</span>
      <span className="flex items-center gap-2">{locked && <LockPill />}
        <input type="checkbox" disabled={locked} checked={k === "amountInWords" ? value[k] !== false : value[k] === true} onChange={(e) => onChange({ [k]: e.target.checked })} className="h-4 w-4 accent-primary" data-testid={`identity-${k}`} /></span>
    </label>
  );
}

export function TemplateIdentitySection({ value, onChange, tier, planError, push }: {
  value: IdentityValues;
  onChange: (patch: Partial<IdentityValues>) => void;
  tier: IdentityTier;
  /** 422 plan_required from PATCH · shown inline */
  planError?: string | null;
  push: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const basic = tier === "basic";
  const resolved = useMemo(() => resolveTheme({ themePreset: value.themePreset, theme: value.theme }), [value.themePreset, value.theme]);
  const themed = value.themePreset !== "ledger";

  // one upload pipeline for every asset row (size gate → downscale → data URL)
  const upload: Uploader = async (file, set) => {
    try { set(await prepareAssetImage(file)); }
    catch (e: any) {
      push("error", e?.message === "too_large" ? t("الحد الأقصى للصورة 1.5 ميجابايت", "Image must be 1.5 MB or smaller") : t("تعذّر قراءة الصورة", "Could not read the image"));
    }
  };

  const setToken = (k: TokenKey, hex: string) => {
    if (!HEX.test(hex)) return;
    onChange({ themePreset: "custom", theme: { ...resolved, [k]: hex } });
  };
  const setFont = (k: "fontArabic" | "fontLatin", id: string) => onChange({ themePreset: "custom", theme: { ...resolved, [k]: id as any } });
  const pickPreset = (id: ThemePreset) => onChange({ themePreset: id, theme: id === "custom" ? { ...resolved } : null });

  const field = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-60";
  const segBtn = (active: boolean, locked = false) => `rounded-md px-2.5 py-1.5 text-xs transition-colors ${active ? "bg-card text-primary shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"} ${locked ? "cursor-not-allowed opacity-60" : ""}`;

  const warn = (label: string, ratio: number, min = 4.5) => ratio > 0 && ratio < min ? <div className="text-[11px] text-warning">{t(`تباين منخفض: ${label} (${ratio.toFixed(1)}:1)`, `Low contrast: ${label} (${ratio.toFixed(1)}:1)`)}</div> : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" data-testid="template-identity">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("هوية المستند", "Document identity")}</h2>
        {basic && <LockPill />}
      </div>
      {planError && <InlineAlert tone="warning" title={t("هذه الميزة خارج باقتك الحالية", "Not included in your current plan")} data-testid="identity-plan-error">{planError} · <Link to="/app/settings?tab=plans" className="text-primary underline">{t("ترقية الباقة", "Upgrade plan")}</Link></InlineAlert>}

      {/* preset */}
      <div className="space-y-2">
        <Label>{t("النمط", "Preset")}</Label>
        <div className="flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup" aria-label={t("نمط الهوية", "Identity preset")}>
          {PRESETS.map((p) => { const locked = basic && p.id !== "ledger"; return (
            <button key={p.id} type="button" role="radio" aria-checked={value.themePreset === p.id} disabled={locked} data-testid={`preset-${p.id}`}
              onClick={() => !locked && pickPreset(p.id)} className={segBtn(value.themePreset === p.id, locked)}>{isAr ? p.ar : p.en}</button>
          ); })}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("Ledger يطبع المستند الحالي بلا تغيير · «حبر على أبيض» هو النمط المرجعي · «مخصص» يفتح الألوان والخطوط.", "Ledger prints today's document unchanged · Ink on white is the reference style · Custom unlocks colours and fonts.")}</p>
      </div>

      {/* 13 tokens */}
      <div className={`space-y-2 ${basic ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between gap-2"><Label>{t("الألوان (13 رمزًا)", "Colour tokens (13)")}</Label>{basic && <LockPill />}</div>
        <div className="grid grid-cols-2 gap-2">
          {TOKENS.map((tk) => (
            <div key={tk.k} className="flex items-center gap-2 rounded-lg border border-border p-1.5">
              <input type="color" value={resolved[tk.k]} disabled={basic} onChange={(e) => setToken(tk.k, e.target.value)} className="h-8 w-9 rounded border border-border bg-card p-0.5" aria-label={isAr ? tk.ar : tk.en} data-testid={`token-${tk.k}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-foreground truncate" style={{ fontWeight: 600 }}>{isAr ? tk.ar : tk.en}</div>
                <input value={resolved[tk.k]} disabled={basic} onChange={(e) => setToken(tk.k, e.target.value)} dir="ltr" className="w-full bg-transparent font-code text-[11px] text-muted-foreground outline-none" aria-label={`${isAr ? tk.ar : tk.en} hex`} />
              </div>
            </div>
          ))}
        </div>
        {themed && (
          <div className="space-y-0.5">
            {warn(t("الحبر على الورق", "ink on paper"), contrast(resolved.ink, resolved.paper))}
            {warn(t("الخافت على الورق", "muted on paper"), contrast(resolved.muted, resolved.paper))}
            {warn(t("الأبيض على الكحلي", "white on navy"), contrast("#FFFFFF", resolved.navy))}
            {warn(t("الفولاذي على الورق", "steel on paper"), contrast(resolved.steel, resolved.paper), 3)}
            {warn(t("الشريحة على الكحلي", "chip on navy"), contrast(resolved.chip, resolved.navy), 3)}
            {warn(t("الحبر على التعبئة", "ink on fill"), contrast(resolved.ink, resolved.fill))}
          </div>
        )}
        {value.themePreset === "custom" && <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => pickPreset("ink-white")}>{t("إعادة إلى «حبر على أبيض»", "Reset to Ink on white")}</button>}
      </div>

      {/* header style + fonts */}
      <div className={`grid grid-cols-1 gap-3 ${basic ? "opacity-60" : ""}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2"><Label>{t("نمط الترويسة", "Header style")}</Label>{basic && <LockPill />}</div>
          <div className="flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup">
            {([["bar", t("شريط ملوّن + بيانات", "Colour bar + meta")], ["centered", t("شعار في المنتصف · بلا شريط", "Centered logo · no bar")]] as Array<[HeaderStyle, string]>).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={value.headerStyle === k} disabled={basic} data-testid={`header-${k}`} onClick={() => !basic && onChange({ headerStyle: k })} className={segBtn(value.headerStyle === k, basic)}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("الترويسة المتوسطة تأتي مع تذييل قانوني ثابت من 3 أسطر ورقم صفحة.", "The centered header comes with a fixed 3-line legal footer and a page number.")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>{t("الخط العربي", "Arabic face")}</Label>
            <select className={field} disabled={basic} value={resolved.fontArabic || "noto"} onChange={(e) => setFont("fontArabic", e.target.value)} data-testid="font-arabic">
              {DOC_FONT_OPTIONS.arabic.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select></div>
          <div className="space-y-1"><Label>{t("الخط اللاتيني", "Latin face")}</Label>
            <select className={field} disabled={basic} value={resolved.fontLatin || "plus-jakarta"} onChange={(e) => setFont("fontLatin", e.target.value)} data-testid="font-latin">
              {DOC_FONT_OPTIONS.latin.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select></div>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("الخطوط مضمّنة في المنصة (بلا CDN) · الأرقام دائمًا JetBrains Mono.", "Faces are embedded in the platform (no CDN) · numbers are always JetBrains Mono.")}</p>
      </div>

      {/* assets */}
      <div className="space-y-2">
        <Label>{t("الأصول", "Assets")}</Label>
        <AssetRow label={t("الشعار (للورق)", "Logo (on paper)")} hint={t("يُستخدم شعار الشركة من الإعدادات", "Falls back to the company print logo")} value={value.logoUrl} onChange={(v) => onChange({ logoUrl: v })} locked={false} testId="asset-logo" upload={upload} />
        <AssetRow label={t("الشعار الفاتح (للأسطح الداكنة)", "Light logo (dark grounds)")} value={value.logoLightUrl} onChange={(v) => onChange({ logoLightUrl: v })} locked={basic} testId="asset-logo-light" upload={upload} />
        <AssetRow label={t("العلامة المائية", "Watermark")} hint={t("رمز الشركة · يُطبع خافتًا أسفل الصفحات الداخلية", "Company symbol · faint at the foot of interior pages")} value={value.watermarkUrl} onChange={(v) => onChange({ watermarkUrl: v })} locked={basic} testId="asset-watermark" upload={upload} />
        <AssetRow label={t("صورة الغلاف", "Cover image")} hint={t("صورة كاملة خلف الغلاف", "Full-bleed behind the cover")} value={value.coverImageUrl} onChange={(v) => onChange({ coverImageUrl: v })} locked={basic} testId="asset-cover" upload={upload} />
        <AssetRow label={t("صورة صفحة الختام", "Closing page image")} hint={t("فارغة = كحلي صلب", "Empty = solid navy")} value={value.closingImageUrl} onChange={(v) => onChange({ closingImageUrl: v })} locked={basic} testId="asset-closing" upload={upload} />
        <AssetRow label={t("شعار البنك", "Bank logo")} value={value.bankLogoUrl} onChange={(v) => onChange({ bankLogoUrl: v })} locked={false} testId="asset-bank-logo" upload={upload} />
        <AssetRow label={t("التوقيع", "Signature")} hint={t("PNG بخلفية شفافة", "Transparent PNG")} value={value.signatureUrl} onChange={(v) => onChange({ signatureUrl: v })} locked={false} testId="asset-signature" upload={upload} />
        <p className="text-[11px] text-muted-foreground">{t("كل صورة ≤ 1.5 ميجابايت · تُصغَّر إلى 1600 بكسل كحد أقصى قبل الحفظ.", "Each image ≤ 1.5 MB · downscaled to 1600 px max before saving.")}</p>
      </div>

      {/* out of scope */}
      <div className="space-y-2">
        <Label>{t("خارج نطاق هذا العرض (سطر لكل بند)", "Outside the scope (one item per line)")}</Label>
        <textarea rows={3} value={value.outOfScope} onChange={(e) => onChange({ outOfScope: e.target.value })} className={field} placeholder={t("أعمال الكهرباء والسباكة\nرسوم البلدية والتصاريح", "Electrical and plumbing works\nMunicipality fees and permits")} data-testid="identity-oos" />
        <textarea rows={2} value={value.outOfScopeEn} onChange={(e) => onChange({ outOfScopeEn: e.target.value })} className={field} dir="ltr" placeholder="Outside the scope (English)" data-testid="identity-oos-en" />
      </div>

      {/* payment plan */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><Label>{t("شكل خطة الدفع", "Payment plan style")}</Label>{basic && <LockPill />}</div>
        <div className={`flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1 ${basic ? "opacity-60" : ""}`} role="radiogroup">
          {([["table", t("جدول", "Table")], ["stations", t("محطات (2–4 دفعات)", "Stations (2–4 instalments)")]] as Array<[PaymentPlanStyle, string]>).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={value.paymentPlanStyle === k} disabled={basic} data-testid={`plan-${k}`} onClick={() => !basic && onChange({ paymentPlanStyle: k })} className={segBtn(value.paymentPlanStyle === k, basic)}>{l}</button>
          ))}
        </div>
        <Input value={value.paymentPlanNote} onChange={(e) => onChange({ paymentPlanNote: e.target.value })} placeholder={t("خطة الدفع مقترحة وقابلة للتعديل.", "The payment plan is a proposal and can be adjusted.")} data-testid="identity-plan-note" />
      </div>

      {/* closing facts */}
      <div className={`space-y-2 ${basic ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between gap-2"><Label>{t("حقائق صفحة الختام", "Closing page facts")}</Label>{basic && <LockPill />}</div>
        {value.closingFacts.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={f.label} disabled={basic} onChange={(e) => onChange({ closingFacts: value.closingFacts.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder={t("العنوان", "Label")} className="flex-1" />
            <Input value={f.value} disabled={basic} onChange={(e) => onChange({ closingFacts: value.closingFacts.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} placeholder={t("القيمة", "Value")} className="flex-1" />
            <button type="button" disabled={basic} onClick={() => onChange({ closingFacts: value.closingFacts.filter((_, j) => j !== i) })} className="rounded p-1 text-muted-foreground hover:text-danger disabled:opacity-40" aria-label={t("حذف", "Remove")}><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <button type="button" disabled={basic || value.closingFacts.length >= 8} onClick={() => onChange({ closingFacts: [...value.closingFacts, { label: "", value: "" }] })} className="inline-flex items-center gap-1 text-xs text-primary disabled:opacity-40" data-testid="identity-add-fact"><Plus className="h-3.5 w-3.5" />{t("إضافة حقيقة", "Add fact")}</button>
      </div>

      {/* toggles */}
      <div className="space-y-1">
        <Toggle value={value} onChange={onChange} k="showQr" label={t("رمز QR على عروض الأسعار", "QR on quotes")} hint={t("رمز ZATCA TLV · يتطلب رقمًا ضريبيًا سعوديًا", "ZATCA TLV code · needs a Saudi VAT number")} />
        <Toggle value={value} onChange={onChange} k="amountInWords" label={t("التفقيط تحت الإجماليات", "Amount in words under the totals")} hint={t("«فقط … سعوديًا لا غير»", "“Only … Saudi Riyals”")} />
        <Toggle value={value} onChange={onChange} k="hideProviderBranding" label={t("إخفاء علامة المنصة", "Hide platform branding")} hint={t("لا يظهر اسم المنصة في أي مكان بالمستند", "No platform name anywhere in the document")} locked={basic} />
      </div>
    </section>
  );
}
