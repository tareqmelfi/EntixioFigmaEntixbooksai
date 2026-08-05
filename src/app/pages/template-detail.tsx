/**
 * Template designer — full page (app-wide standard · no slide-overs):
 *   /app/templates/new  → create (optional ?type=QUOTE)
 *   /app/templates/:id  → edit
 *
 * Form on the left · live preview on the right (updates as you type).
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { TemplatePreview, TYPE_META, LAYOUT_META, type DocType, type Layout } from "../components/template-preview";

const EMPTY_FORM = {
  name: "", nameEn: "", type: "INVOICE" as DocType, layout: "classic" as Layout,
  isDefault: false, primaryColor: "#0B1B49", accentColor: "#1276E3",
  showLogo: true, showTaxBreakdown: true, showTerms: true, terms: "", notes: "",
};

export function TemplateDetail() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM, type: (searchParams.get("type") as DocType) || "INVOICE" });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const tpl = await api.documentTemplates.get(id!);
      setForm({
        name: tpl.name || "", nameEn: tpl.nameEn || "", type: tpl.type, layout: tpl.layout,
        isDefault: tpl.isDefault, primaryColor: tpl.primaryColor, accentColor: tpl.accentColor,
        showLogo: tpl.showLogo, showTaxBreakdown: tpl.showTaxBreakdown, showTerms: tpl.showTerms,
        terms: tpl.terms || "", notes: tpl.notes || "",
      });
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل القالب", "Failed to load template"));
    } finally { setLoading(false); }
  }, [id, isNew, t]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("اسم القالب مطلوب", "Template name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(), nameEn: form.nameEn || null, type: form.type, layout: form.layout,
        isDefault: form.isDefault, primaryColor: form.primaryColor, accentColor: form.accentColor,
        showLogo: form.showLogo, showTaxBreakdown: form.showTaxBreakdown, showTerms: form.showTerms,
        terms: form.terms || null, notes: form.notes || null,
      };
      const saved = isNew ? await api.documentTemplates.create(payload) : await api.documentTemplates.update(id!, payload);
      push("success", isNew ? t("تم إنشاء القالب", "Template created") : t("تم تحديث القالب", "Template updated"));
      navigate("/app/templates");
      return saved;
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/templates" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للقوالب", "Back to Templates")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("قالب جديد", "New Template") : t("تعديل القالب", "Edit Template")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("صمّم قالب الطباعة وشاهد المعاينة الحية أثناء التعديل", "Design the print template and watch the live preview as you edit")}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* Form column */}
          <div className="space-y-5">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الهوية", "Identity")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("الاسم (عربي)", "Name (Arabic)")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("فاتورة مبيعات - كلاسيك", "Sales invoice - Classic")} /></div>
                  <div className="space-y-2"><Label>{t("الاسم (إنجليزي)", "Name (English)")}</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" className="font-english" placeholder="Sales Invoice - Classic" /></div>
                </div>

                <div className="space-y-2">
                  <Label>{t("نوع المستند", "Document type")}</Label>
                  <div className="flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup">
                    {(Object.keys(TYPE_META) as DocType[]).map(k => (
                      <button key={k} type="button" role="radio" aria-checked={form.type === k} onClick={() => setForm({ ...form, type: k })}
                        className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${form.type === k ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        style={{ fontWeight: form.type === k ? 700 : 500 }}>{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("التصميم", "Layout")}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(LAYOUT_META) as Layout[]).map(k => (
                      <button key={k} type="button" role="radio" aria-checked={form.layout === k} onClick={() => setForm({ ...form, layout: k })}
                        className={`rounded-lg border p-2.5 text-start transition-colors ${form.layout === k ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"}`}>
                        <div className="text-xs" style={{ fontWeight: 700, color: form.layout === k ? "#1276E3" : "inherit" }}>{isAr ? LAYOUT_META[k].ar : LAYOUT_META[k].en}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-4">{isAr ? LAYOUT_META[k].hintAr : LAYOUT_META[k].hintEn}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الألوان والخيارات", "Colors & options")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("اللون الأساسي", "Primary color")}</Label><input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-white p-1" /></div>
                  <div className="space-y-2"><Label>{t("لون التمييز", "Accent color")}</Label><input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-white p-1" /></div>
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  {([
                    ["showLogo", t("إظهار الشعار", "Show logo")],
                    ["showTaxBreakdown", t("إظهار تفصيل الضريبة", "Show VAT breakdown")],
                    ["showTerms", t("إظهار الشروط", "Show terms")],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
                      <span>{label}</span>
                      <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked } as any)} className="h-4 w-4 accent-[#1276E3]" />
                    </label>
                  ))}
                  <label className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer border-t border-border/50 mt-1 pt-2">
                    <span style={{ fontWeight: 600 }}>{t("افتراضي لهذا النوع", "Default for this type")}</span>
                    <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 accent-[#1276E3]" />
                  </label>
                </div>

                {form.showTerms && (
                  <div className="space-y-2"><Label>{t("الشروط والأحكام (تُطبع أسفل المستند)", "Terms & conditions (printed at the bottom)")}</Label>
                    <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none" placeholder={t("الدفع خلال 30 يوماً من تاريخ الفاتورة...", "Payment due within 30 days of invoice date...")} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live preview column */}
          <div className="xl:sticky xl:top-4 space-y-2">
            <Label>{t("معاينة حية", "Live preview")}</Label>
            <div className="rounded-lg bg-slate-100 p-3">
              <TemplatePreview tpl={{ ...form, name: form.name || "—" }} language={language} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-border sticky bottom-0 bg-[#F7F9FC] py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/templates")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("حفظ القالب", "Save template") : t("حفظ التغييرات", "Save changes")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
