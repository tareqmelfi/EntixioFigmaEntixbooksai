/**
 * BrandThemeCard · Settings → Branding (SPEC-06 §8)
 *
 * The company identity that appears ONLY on shared outputs (/b/:token + print) —
 * never inside /app/*. Logo URL (defaults to the org logo) + 4 colours
 * (native colour picker + hex) · live preview of the public-board header, one
 * KPI tile and one kanban column · save via PATCH (422 low_contrast shown inline)
 * · «استعادة ألوان Entix» = PATCH null. UX-1: inline + toasts only.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Loader2, Save, RotateCcw, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineAlert } from "./product";
import { api, ApiError, type BrandTheme, type Org } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { BRAND_FALLBACK, brandVars } from "./board-widgets";

type ColorKey = "primary" | "secondary" | "fill" | "ink";
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

export function BrandThemeCard({ org, push }: { org: Org; push: (kind: "success" | "error" | "info", msg: string) => void }) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<BrandTheme | null>(null);
  const [theme, setTheme] = useState<BrandTheme>({ ...BRAND_FALLBACK, logoUrl: org.logoUrl || null });
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.extSources.brandTheme(org.id);
        if (!alive) return;
        setSaved(r.brandTheme);
        setTheme(r.brandTheme ? { ...r.brandTheme } : { ...BRAND_FALLBACK, logoUrl: org.logoUrl || null });
      } catch { /* card still usable · save reports errors */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [org.id, org.logoUrl]);

  const setColor = (k: ColorKey, v: string) => setTheme((th) => ({ ...th, [k]: v }));

  const invalid = (["primary", "secondary", "fill", "ink"] as ColorKey[]).filter((k) => !HEX.test(theme[k] || ""));
  const inkFill = contrast(theme.ink, theme.fill);
  const primaryFill = contrast(theme.primary, theme.fill);
  const lowContrast = invalid.length === 0 && (inkFill < 4.5 || primaryFill < 3);

  const save = async () => {
    if (invalid.length) { push("error", t("أدخل ألوان hex صحيحة (#RRGGBB)", "Enter valid hex colours (#RRGGBB)")); return; }
    setBusy(true); setServerError(null);
    try {
      const r = await api.extSources.updateBrandTheme(org.id, { primary: theme.primary, secondary: theme.secondary, fill: theme.fill, ink: theme.ink, logoUrl: theme.logoUrl || null });
      setSaved(r.brandTheme);
      push("success", t("حُفظت هوية المخرجات", "Output identity saved"));
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.code === "low_contrast" || err?.status === 422) {
        const ratios = ((err?.body as any)?.ratios || {}) as Record<string, number>;
        const detail = Object.entries(ratios).map(([k, v]) => `${k}: ${Number(v).toFixed(2)}`).join(" · ");
        setServerError(t(`التباين منخفض — النص/الخلفية ≥ 4.5 والأساسي/الخلفية ≥ 3 مطلوبان${detail ? ` (${detail})` : ""}`, `Contrast too low — ink/fill ≥ 4.5 and primary/fill ≥ 3 are required${detail ? ` (${detail})` : ""}`));
      } else {
        push("error", err?.message || t("فشل الحفظ", "Save failed"));
      }
    } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true); setServerError(null);
    try {
      await api.extSources.updateBrandTheme(org.id, null);
      setSaved(null);
      setTheme({ ...BRAND_FALLBACK, logoUrl: org.logoUrl || null });
      push("success", t("استُعيدت ألوان Entix", "Entix colours restored"));
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
    finally { setBusy(false); }
  };

  const previewStyle = useMemo(() => brandVars(theme) as CSSProperties, [theme]);
  const previewLogo = theme.logoUrl || org.logoUrl || null;
  const baseline: BrandTheme = saved || { ...BRAND_FALLBACK, logoUrl: org.logoUrl || null };
  const dirty = JSON.stringify({ ...theme, logoUrl: theme.logoUrl || null }) !== JSON.stringify({ ...baseline, logoUrl: baseline.logoUrl || null });

  const fields: Array<{ k: ColorKey; ar: string; en: string; hintAr: string; hintEn: string }> = [
    { k: "primary", ar: "الأساسي", en: "Primary", hintAr: "شريط الرأس · رؤوس الأعمدة · أرقام KPI", hintEn: "Header bar · column heads · KPI figures" },
    { k: "secondary", ar: "الثانوي", en: "Secondary", hintAr: "الحدود · الروابط · الأزرار", hintEn: "Borders · links · buttons" },
    { k: "fill", ar: "الخلفية", en: "Fill", hintAr: "خلفية الصفحة والبطاقات", hintEn: "Page and card background" },
    { k: "ink", ar: "النص", en: "Ink", hintAr: "لون النص في المخرج", hintEn: "Text colour on the output" },
  ];

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground"><Palette className="h-5 w-5" /> {t("هوية المخرجات المشتركة", "Shared-output identity")}</CardTitle>
        <CardDescription>{t("الشعار والألوان التي يراها عملاؤك على روابط لوحات المتابعة العامة (/b/…) وعند الطباعة", "The logo and colours your clients see on public board links (/b/…) and on print")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <InlineAlert tone="info">{t("تظهر هذه الهوية في المخرجات المشتركة فقط، لا في واجهة التطبيق.", "This identity appears on shared outputs only, not inside the app.")}</InlineAlert>

        {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div> : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bt-logo">{t("رابط الشعار", "Logo URL")}</Label>
                <Input id="bt-logo" dir="ltr" value={theme.logoUrl || ""} onChange={(e) => setTheme((th) => ({ ...th, logoUrl: e.target.value || null }))} placeholder={org.logoUrl || "https://…/logo.png"} className="font-code text-xs" />
                <p className="text-xs text-muted-foreground">{t("فارغ = شعار الشركة الحالي", "Empty = the current company logo")}</p>
              </div>
              {fields.map((f) => {
                const bad = !HEX.test(theme[f.k] || "");
                return (
                  <div key={f.k} className="space-y-1.5">
                    <Label htmlFor={`bt-${f.k}`}>{t(f.ar, f.en)} <span className="text-xs font-normal text-muted-foreground">· {t(f.hintAr, f.hintEn)}</span></Label>
                    <div className="flex items-center gap-2">
                      <input type="color" aria-label={t(f.ar, f.en)} value={HEX.test(theme[f.k] || "") ? theme[f.k] : "#000000"} onChange={(e) => setColor(f.k, e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface p-0.5" />
                      <Input id={`bt-${f.k}`} dir="ltr" value={theme[f.k] || ""} onChange={(e) => setColor(f.k, e.target.value.trim())} className={`w-[130px] font-code text-xs ${bad ? "border-danger" : ""}`} placeholder="#RRGGBB" />
                    </div>
                  </div>
                );
              })}

              {(lowContrast || serverError) && (
                <InlineAlert tone="warning" title={t("تباين منخفض", "Low contrast")}>
                  {serverError || t(`النص/الخلفية ${inkFill.toFixed(2)} (مطلوب ≥ 4.5) · الأساسي/الخلفية ${primaryFill.toFixed(2)} (مطلوب ≥ 3)`, `Ink/fill ${inkFill.toFixed(2)} (need ≥ 4.5) · primary/fill ${primaryFill.toFixed(2)} (need ≥ 3)`)}
                </InlineAlert>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button onClick={save} disabled={busy || invalid.length > 0} className="bg-primary">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" /> {t("حفظ الهوية", "Save identity")}</>}
                </Button>
                <Button variant="secondary" onClick={reset} disabled={busy || (saved === null && !dirty)}>
                  <RotateCcw className="me-2 h-4 w-4" /> {t("استعادة ألوان Entix", "Restore Entix colours")}
                </Button>
                {saved === null && <span className="text-xs text-muted-foreground">{t("الحالي: ألوان Entix الافتراضية", "Current: Entix defaults")}</span>}
              </div>
            </div>

            {/* Live preview of the OUTPUT (/b/:token) */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t("معاينة المخرج كما يراه العميل", "Output preview as the client sees it")}</div>
              <div dir={language === "ar" ? "rtl" : "ltr"} className="overflow-hidden rounded-xl border border-border" style={{ ...previewStyle, background: "var(--bt-fill)", color: "var(--bt-ink)" }}>
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" style={{ background: "var(--bt-primary)" }}>
                  <div className="flex min-w-0 items-center gap-2">
                    {previewLogo ? <img src={previewLogo} alt="" className="h-7 w-auto max-w-[100px] object-contain" /> : null}
                    <div className="min-w-0">
                      <div className="truncate text-[11px] opacity-90">{org.name}</div>
                      <div className="truncate text-sm font-bold">{t("سجل عروض الأسعار", "Quotes register")}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{t("آخر تحديث: اليوم", "Last updated: today")}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4">
                  <div className="rounded-lg border p-3" style={{ background: "var(--bt-fill)", borderColor: "color-mix(in srgb, var(--bt-secondary) 35%, transparent)" }}>
                    <div className="text-[11px] opacity-80">{t("بانتظار الرد", "Pending")}</div>
                    <div dir="ltr" className={`font-english text-xl font-bold tabular-nums ${language === "ar" ? "text-right" : "text-left"}`} style={{ color: "var(--bt-primary)" }}>12,500.00 SAR</div>
                    <div className="text-[10px] opacity-70">{t("3 عروض", "3 quotes")}</div>
                  </div>
                  <div className="flex flex-col rounded-lg border" style={{ background: "var(--bt-fill)", borderColor: "color-mix(in srgb, var(--bt-secondary) 35%, transparent)" }}>
                    <div className="flex items-center justify-between rounded-t-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--bt-primary)" }}><span>✓ {t("مقبول", "Accepted")}</span><span className="font-english">2</span></div>
                    <div className="space-y-1.5 p-2">
                      <div className="rounded-md border bg-white p-2 text-[11px]" style={{ borderColor: "color-mix(in srgb, var(--bt-secondary) 45%, transparent)" }}><div className="font-semibold">{t("شركة النور", "Al Noor Co.")}</div><div dir="ltr" className={`font-english tabular-nums ${language === "ar" ? "text-right" : "text-left"}`}>8,050.00 SAR</div></div>
                      <div className="rounded-md border bg-white p-2 text-[11px]" style={{ borderColor: "color-mix(in srgb, var(--bt-secondary) 45%, transparent)" }}><div className="font-semibold">{t("مؤسسة الفجر", "Al Fajr Est.")}</div><div dir="ltr" className={`font-english tabular-nums ${language === "ar" ? "text-right" : "text-left"}`}>4,450.00 SAR</div></div>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3 text-center text-[10px] opacity-60">{t("مُشغَّل بواسطة Entix Books", "Powered by Entix Books")} · <span style={{ color: "var(--bt-secondary)" }}>entix.io</span></div>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("ألوان الدلالة (✓ ⚠ ✕ ⓘ) ثابتة ولا تتأثر بالهوية.", "Semantic colours (✓ ⚠ ✕ ⓘ) are fixed and unaffected by the identity.")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

