/**
 * Template designer — full page (app-wide standard · no slide-overs · UX-1):
 *   /app/templates/new  → create (optional ?type=QUOTE)
 *   /app/templates/:id  → edit
 *
 * Two panes: controls at the reading start · live preview of the WHOLE document
 * (every A4 sheet · cover → inner pages → terms page) at the end, rendered by the
 * shared brand engine (src/app/lib/document-render.ts) with sample data.
 * Updates as you type.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowRight, Loader2, Save, ChevronUp, ChevronDown, Upload, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, getOrgId, type Org, type BankAccount } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { TYPE_META, LAYOUT_META, type DocType, type Layout } from "../components/template-preview";
import { BrandDocument } from "../components/brand-document";
import { SearchableCombobox } from "../components/searchable-combobox";
import { downscaleDataUrl } from "../lib/print-image";
import {
  sampleInput, partyFromOrg, normalizeSections, SECTION_META,
  DEFAULT_BRAND_COLOR, DEFAULT_COVER_COLOR, LEGACY_PRIMARY_COLOR, LEGACY_ACCENT_COLOR,
  type DocKind, type DocLang, type SectionSetting, type BankSpec, type RenderOutput,
} from "../lib/document-render";

type Kind = "QUOTE" | "INVOICE" | "BOTH";
type CoverStyle = "DARK" | "LIGHT" | "NONE";

const KIND_META: Record<Kind, { ar: string; en: string }> = {
  QUOTE: { ar: "عروض الأسعار", en: "Quotes" },
  INVOICE: { ar: "الفواتير", en: "Invoices" },
  BOTH: { ar: "العروض والفواتير", en: "Quotes + invoices" },
};
const COVER_META: Record<CoverStyle, { ar: string; en: string }> = {
  DARK: { ar: "غلاف داكن", en: "Dark cover" },
  LIGHT: { ar: "غلاف فاتح", en: "Light cover" },
  NONE: { ar: "بدون غلاف", en: "No cover" },
};

const EMPTY_FORM = {
  name: "", nameEn: "", type: "INVOICE" as DocType, layout: "classic" as Layout,
  isDefault: false, primaryColor: LEGACY_PRIMARY_COLOR, accentColor: LEGACY_ACCENT_COLOR,
  showLogo: true, showTaxBreakdown: true, showTerms: true, terms: "", notes: "",
  // brand document designer
  kind: "BOTH" as Kind, coverStyle: "DARK" as CoverStyle, coverTitle: "", coverIntro: "", coverTitleEn: "", coverIntroEn: "",
  brandColor: DEFAULT_BRAND_COLOR, coverColor: DEFAULT_COVER_COLOR,
  sections: normalizeSections(null) as SectionSetting[],
  termsEn: "", closingTerms: "", closingTermsEn: "",
  bankAccountId: "", signatoryName: "", signatoryTitle: "", signatoryEmail: "", signatoryPhone: "",
  stampUrl: "", footerText: "", classification: "", classificationEn: "",
};

const DEFAULT_TERMS_AR = "العرض ساري 30 يومًا من تاريخ الإصدار.\nالدفع مقدمًا بالكامل عبر رابط الدفع أو التحويل البنكي.\nتبدأ مدة التنفيذ من تاريخ تأكيد الدفع.";
const DEFAULT_TERMS_EN = "This offer is valid for 30 days from the issue date.\nPayment in full in advance by payment link or bank transfer.\nDelivery starts on payment confirmation.";
const DEFAULT_CLOSING_AR = "نطاق الخدمة | يقتصر النطاق على البنود المذكورة صراحةً في هذا المستند؛ أي خدمة إضافية تُقدَّم بعرض منفصل.\nالسداد | الدفع مقدمًا بالكامل عبر رابط الدفع الإلكتروني أو التحويل البنكي المُثبت في المستند.\nالضريبة | تُطبَّق ضريبة القيمة المضافة 15٪ على القيمة الخاضعة بعد الخصم وفق متطلبات هيئة الزكاة والضريبة والجمارك.\nالتنفيذ | يبدأ التنفيذ فور تأكيد الدفع، ويعتمد على استلام ما يلزم من بيانات العميل.\nالإلغاء | المبالغ المسدَّدة غير قابلة للاسترداد بعد بدء التنفيذ إلا بموافقة كتابية.\nالقانون الواجب التطبيق | تخضع هذه الشروط لأنظمة المملكة العربية السعودية.";
const DEFAULT_CLOSING_EN = "Scope | The scope is limited to the items stated in this document; any additional service is quoted separately.\nPayment | Paid in full in advance by the payment link or the bank transfer details in this document.\nTax | VAT 15% applies on the taxable amount after discount as required by ZATCA.\nDelivery | Delivery starts on payment confirmation and depends on receiving the client's data.\nCancellation | Paid amounts are non-refundable once delivery has started unless agreed in writing.\nGoverning law | These terms are governed by the laws of the Kingdom of Saudi Arabia.";

/** Module-level so React keeps the inputs mounted between keystrokes */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function TemplateDetail() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const initialType = (searchParams.get("type") as DocType) || "INVOICE";
  const [form, setForm] = useState({
    ...EMPTY_FORM, type: initialType, kind: (initialType === "QUOTE" ? "QUOTE" : initialType === "INVOICE" ? "INVOICE" : "BOTH") as Kind,
    // a new template starts with sensible terms so the first document already prints a complete set
    terms: DEFAULT_TERMS_AR, termsEn: DEFAULT_TERMS_EN, closingTerms: DEFAULT_CLOSING_AR, closingTermsEn: DEFAULT_CLOSING_EN,
  });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [previewKind, setPreviewKind] = useState<DocKind>(initialType === "INVOICE" ? "INVOICE" : "QUOTE");
  const [previewLang, setPreviewLang] = useState<DocLang>(isAr ? "ar" : "en");
  const [sheetCount, setSheetCount] = useState(0);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

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
        kind: (tpl.kind as Kind) || "BOTH", coverStyle: (tpl.coverStyle as CoverStyle) || "DARK",
        coverTitle: tpl.coverTitle || "", coverIntro: tpl.coverIntro || "", coverTitleEn: tpl.coverTitleEn || "", coverIntroEn: tpl.coverIntroEn || "",
        brandColor: tpl.brandColor || tpl.accentColor || DEFAULT_BRAND_COLOR, coverColor: tpl.coverColor || tpl.primaryColor || DEFAULT_COVER_COLOR,
        sections: normalizeSections(tpl.sections),
        termsEn: tpl.termsEn || "", closingTerms: tpl.closingTerms || "", closingTermsEn: tpl.closingTermsEn || "",
        bankAccountId: tpl.bankAccountId || "", signatoryName: tpl.signatoryName || "", signatoryTitle: tpl.signatoryTitle || "",
        signatoryEmail: tpl.signatoryEmail || "", signatoryPhone: tpl.signatoryPhone || "",
        stampUrl: tpl.stampUrl || "", footerText: tpl.footerText || "", classification: tpl.classification || "", classificationEn: tpl.classificationEn || "",
      });
      if (tpl.kind === "INVOICE") setPreviewKind("INVOICE");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل القالب", "Failed to load template"));
    } finally { setLoading(false); }
  }, [id, isNew, t]);
  useEffect(() => { load(); }, [load]);

  // Company identity + bank accounts feed the preview and the bank picker
  useEffect(() => {
    const orgId = getOrgId();
    if (orgId) api.orgs.get(orgId).then(setOrg).catch(() => setOrg(null));
    api.bankAccounts.list().then((r) => setBanks(r.items.filter((b) => b.isActive !== false))).catch(() => setBanks([]));
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name.trim()) { setError(t("اسم القالب مطلوب", "Template name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(), nameEn: form.nameEn || null, type: form.type, layout: form.layout,
        isDefault: form.isDefault, primaryColor: form.primaryColor, accentColor: form.accentColor,
        showLogo: form.showLogo, showTaxBreakdown: form.showTaxBreakdown, showTerms: form.showTerms,
        terms: form.terms || null, notes: form.notes || null,
        kind: form.kind, coverStyle: form.coverStyle, coverTitle: form.coverTitle || null, coverIntro: form.coverIntro || null,
        coverTitleEn: form.coverTitleEn || null, coverIntroEn: form.coverIntroEn || null,
        brandColor: form.brandColor, coverColor: form.coverColor, sections: form.sections,
        termsEn: form.termsEn || null, closingTerms: form.closingTerms || null, closingTermsEn: form.closingTermsEn || null,
        bankAccountId: form.bankAccountId || null,
        signatoryName: form.signatoryName || null, signatoryTitle: form.signatoryTitle || null,
        signatoryEmail: form.signatoryEmail || null, signatoryPhone: form.signatoryPhone || null,
        stampUrl: form.stampUrl || null, footerText: form.footerText || null,
        classification: form.classification || null, classificationEn: form.classificationEn || null,
      };
      const saved = isNew ? await api.documentTemplates.create(payload) : await api.documentTemplates.update(id!, payload);
      push("success", isNew ? t("تم إنشاء القالب", "Template created") : t("تم تحديث القالب", "Template updated"));
      navigate("/app/templates");
      return saved;
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const uploadLogo = async (file: File) => {
    if (!org) return;
    try {
      const data = await downscaleDataUrl(await readFileAsDataUrl(file), 900);
      const updated = await api.orgs.update(org.id, { printLogoUrl: data } as any);
      setOrg({ ...org, ...(updated || {}), printLogoUrl: data } as Org);
      push("success", t("تم تحديث شعار الطباعة للشركة", "Company print logo updated"));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل رفع الشعار", "Logo upload failed")); }
  };
  const uploadStamp = async (file: File) => {
    try { set("stampUrl", await downscaleDataUrl(await readFileAsDataUrl(file), 600)); }
    catch { push("error", t("فشل رفع الختم", "Stamp upload failed")); }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...form.sections];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    set("sections", next);
  };

  // ── live preview input (sample document · this template · this company) ──
  const bankSpec = useMemo<BankSpec | null>(() => {
    const b = banks.find((x) => x.id === form.bankAccountId);
    return b ? { name: b.name, bankName: b.bankName, accountNumber: b.accountNumber, iban: b.iban, swiftCode: b.swiftCode, routingNumber: b.routingNumber, currency: b.currency } : null;
  }, [banks, form.bankAccountId]);
  const previewInput = useMemo(() => {
    const party = org ? partyFromOrg(org) : null;
    return sampleInput(previewKind, previewLang, form, party, bankSpec);
  }, [form, org, bankSpec, previewKind, previewLang]);
  const onRendered = useCallback((out: RenderOutput) => setSheetCount(out.sheetCount), []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const field = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none";
  const segBtn = (active: boolean) => `rounded-md px-2.5 py-1.5 text-xs transition-colors ${active ? "bg-card text-primary shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-4" data-testid="template-designer">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/app/templates" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
            <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للقوالب", "Back to Templates")}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {isNew ? t("قالب جديد", "New Template") : t("تعديل القالب", "Edit Template")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("صمّم قالب الطباعة وشاهد المعاينة الحية أثناء التعديل", "Design the print template and watch the live preview as you edit")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/app/templates")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="button" disabled={busy} onClick={() => handleSubmit()} className="min-w-[140px]" data-testid="template-save">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("حفظ القالب", "Save template") : t("حفظ التغييرات", "Save changes")}</>}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 items-start xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ── Controls (reading start) ── */}
        <div className="space-y-4 min-w-0 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:pe-1" data-testid="template-controls">
          {error && <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}

          <Section title={t("الهوية", "Identity")}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("الاسم (عربي)", "Name (Arabic)")} *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("فاتورة مبيعات - كلاسيك", "Sales invoice - Classic")} /></div>
              <div className="space-y-2"><Label>{t("الاسم (إنجليزي)", "Name (English)")}</Label><Input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} dir="ltr" className="font-english" placeholder="Sales Invoice - Classic" /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("يُستخدم مع", "Used for")}</Label>
              <div className="flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup" aria-label={t("نوع المستند", "Document type")}>
                {(Object.keys(KIND_META) as Kind[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={form.kind === k} data-testid={`kind-${k}`}
                    onClick={() => { set("kind", k); set("type", k === "QUOTE" ? "QUOTE" : "INVOICE"); if (k !== "BOTH") setPreviewKind(k); }}
                    className={segBtn(form.kind === k)}>{isAr ? KIND_META[k].ar : KIND_META[k].en}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
              <span style={{ fontWeight: 600 }}>{t("افتراضي لهذا النوع", "Default for this type")}</span>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="h-4 w-4 accent-primary" data-testid="template-default" />
            </label>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{t("التصميم القديم (للسندات والإشعارات)", "Legacy layout (vouchers · notes)")}</summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(LAYOUT_META) as Layout[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={form.layout === k} onClick={() => set("layout", k)}
                    className={`rounded-lg border p-2 text-start transition-colors ${form.layout === k ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"}`}>
                    <div className="text-xs text-foreground" style={{ fontWeight: 700 }}>{isAr ? LAYOUT_META[k].ar : LAYOUT_META[k].en}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-4">{isAr ? LAYOUT_META[k].hintAr : LAYOUT_META[k].hintEn}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup">
                {(Object.keys(TYPE_META) as DocType[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={form.type === k} onClick={() => set("type", k)} className={segBtn(form.type === k)}>{isAr ? TYPE_META[k].ar : TYPE_META[k].en}</button>
                ))}
              </div>
            </details>
          </Section>

          <Section title={t("الهوية البصرية", "Brand")}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("لون العلامة", "Brand colour")}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.brandColor} onChange={(e) => set("brandColor", e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-card p-1" aria-label={t("لون العلامة", "Brand colour")} />
                  <Input value={form.brandColor} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && set("brandColor", e.target.value)} dir="ltr" className="font-code" data-testid="brand-color" />
                </div></div>
              <div className="space-y-2"><Label>{t("لون الغلاف والإجمالي", "Cover / totals colour")}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.coverColor} onChange={(e) => set("coverColor", e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-card p-1" aria-label={t("لون الغلاف", "Cover colour")} />
                  <Input value={form.coverColor} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && set("coverColor", e.target.value)} dir="ltr" className="font-code" data-testid="cover-color" />
                </div></div>
            </div>
            <div className="space-y-2">
              <Label>{t("شعار الطباعة (مشترك لكل قوالب الشركة)", "Print logo (shared by all company templates)")}</Label>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3">
                {(org as any)?.printLogoUrl || (org as any)?.logoUrl
                  ? <img src={(org as any).printLogoUrl || (org as any).logoUrl} alt="" className="h-10 max-w-[140px] object-contain" />
                  : <span className="text-xs text-muted-foreground">{t("لا يوجد شعار — يُطبع اسم الشركة", "No logo — the company name is printed")}</span>}
                <label className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs cursor-pointer hover:bg-surface-hover">
                  <Upload className="h-3.5 w-3.5" /> {t("رفع", "Upload")}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
                </label>
              </div>
              <label className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
                <span>{t("إظهار الشعار", "Show logo")}</span>
                <input type="checkbox" checked={form.showLogo} onChange={(e) => set("showLogo", e.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التصنيف (عربي)", "Classification (Arabic)")}</Label><Input value={form.classification} onChange={(e) => set("classification", e.target.value)} placeholder={t("خاص بالعميل", "Client confidential")} /></div>
              <div className="space-y-2"><Label>{t("التصنيف (إنجليزي)", "Classification (English)")}</Label><Input value={form.classificationEn} onChange={(e) => set("classificationEn", e.target.value)} dir="ltr" className="font-english" placeholder="Client confidential" /></div>
            </div>
            <div className="space-y-2"><Label>{t("نص التذييل", "Footer text")}</Label><Input value={form.footerText} onChange={(e) => set("footerText", e.target.value)} placeholder={t("© السنة · اسم الشركة · المدينة (تلقائي)", "© year · company · city (automatic)")} /></div>
          </Section>

          <Section title={t("الغلاف", "Cover")}>
            <div className="flex gap-1 flex-wrap rounded-lg bg-muted/50 p-1" role="radiogroup" aria-label={t("نمط الغلاف", "Cover style")}>
              {(Object.keys(COVER_META) as CoverStyle[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={form.coverStyle === k} data-testid={`cover-${k}`} onClick={() => set("coverStyle", k)} className={segBtn(form.coverStyle === k)}>{isAr ? COVER_META[k].ar : COVER_META[k].en}</button>
              ))}
            </div>
            <div className="space-y-2"><Label>{t("عنوان الغلاف (سطران · السطر الثاني بلون العلامة)", "Cover title (two lines · second line in brand colour)")}</Label>
              <textarea rows={2} value={form.coverTitle} onChange={(e) => set("coverTitle", e.target.value)} className={field} placeholder={t("محاسبة مقاولات\nتُدار من المشروع", "Contracting accounting\nrun from the project")} /></div>
            <div className="space-y-2"><Label>{t("مقدمة الغلاف", "Cover intro")}</Label>
              <textarea rows={4} value={form.coverIntro} onChange={(e) => set("coverIntro", e.target.value)} className={field} placeholder={t("عرض سعر مقدَّم من {company} إلى {client} …", "A quotation from {company} to {client} …")} />
              <p className="text-[11px] text-muted-foreground font-code" dir="ltr">{"{company} {client} {number} {reference} {total} {date} {title}"}</p></div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2"><Label>{t("عنوان الغلاف (إنجليزي)", "Cover title (English)")}</Label>
                <textarea rows={2} value={form.coverTitleEn} onChange={(e) => set("coverTitleEn", e.target.value)} className={field} dir="ltr" placeholder={"Contracting accounting\nrun from the project"} /></div>
              <div className="space-y-2"><Label>{t("مقدمة الغلاف (إنجليزي)", "Cover intro (English)")}</Label>
                <textarea rows={3} value={form.coverIntroEn} onChange={(e) => set("coverIntroEn", e.target.value)} className={field} dir="ltr" placeholder="A quotation from {company} to {client} …" /></div>
            </div>
          </Section>

          <Section title={t("الأقسام وترتيبها", "Sections & order")}>
            <ul className="space-y-1" data-testid="section-list">
              {form.sections.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
                  <input type="checkbox" checked={s.enabled} onChange={(e) => set("sections", form.sections.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} className="h-4 w-4 accent-primary" aria-label={isAr ? SECTION_META[s.id].ar : SECTION_META[s.id].en} data-testid={`section-${s.id}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{isAr ? SECTION_META[s.id].ar : SECTION_META[s.id].en}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{isAr ? SECTION_META[s.id].hintAr : SECTION_META[s.id].hintEn}</div>
                  </div>
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={t("أعلى", "Up")}><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => moveSection(i, 1)} disabled={i === form.sections.length - 1} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={t("أسفل", "Down")}><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
            <label className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
              <span>{t("إظهار تفصيل الضريبة", "Show VAT breakdown")}</span>
              <input type="checkbox" checked={form.showTaxBreakdown} onChange={(e) => set("showTaxBreakdown", e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
          </Section>

          <Section title={t("الشروط والأحكام", "Terms & conditions")}>
            <label className="flex items-center justify-between gap-3 py-1 text-sm cursor-pointer">
              <span>{t("إظهار الشروط", "Show terms")}</span>
              <input type="checkbox" checked={form.showTerms} onChange={(e) => set("showTerms", e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
            <div className="space-y-2"><Label>{t("شروط المستند (عربي) — تُنسخ لكل عرض/فاتورة جديدة ويمكن تعديلها هناك", "Document terms (Arabic) — copied into each new quote/invoice and editable there")}</Label>
              <textarea rows={4} value={form.terms} onChange={(e) => set("terms", e.target.value)} className={field} placeholder={DEFAULT_TERMS_AR} data-testid="terms-ar" /></div>
            <div className="space-y-2"><Label>{t("شروط المستند (إنجليزي)", "Document terms (English)")}</Label>
              <textarea rows={4} value={form.termsEn} onChange={(e) => set("termsEn", e.target.value)} className={field} dir="ltr" placeholder={DEFAULT_TERMS_EN} data-testid="terms-en" /></div>
            <div className="space-y-2"><Label>{t("الشروط والأحكام للصفحة الأخيرة (عربي) — سطر لكل بند: «العنوان | النص»", "Closing-page terms (Arabic) — one clause per line: “Title | text”")}</Label>
              <textarea rows={7} value={form.closingTerms} onChange={(e) => set("closingTerms", e.target.value)} className={field} placeholder={DEFAULT_CLOSING_AR} data-testid="closing-ar" /></div>
            <div className="space-y-2"><Label>{t("الشروط والأحكام للصفحة الأخيرة (إنجليزي)", "Closing-page terms (English)")}</Label>
              <textarea rows={7} value={form.closingTermsEn} onChange={(e) => set("closingTermsEn", e.target.value)} className={field} dir="ltr" placeholder={DEFAULT_CLOSING_EN} data-testid="closing-en" /></div>
          </Section>

          <Section title={t("الحساب البنكي", "Bank account")}>
            <SearchableCombobox
              value={form.bankAccountId}
              onChange={(v) => set("bankAccountId", v)}
              items={banks.map((b) => ({ id: b.id, label: b.name, sublabel: [b.bankName, b.iban].filter(Boolean).join(" · ") }))}
              placeholder={t("بدون بطاقة تحويل بنكي", "No bank transfer card")}
              onCreate={async () => { navigate("/app/bank-accounts/new"); return ""; }}
              createLabel={(q) => t(`إضافة حساب بنكي «${q}»`, `Add bank account “${q}”`)}
            />
            {form.bankAccountId && <button type="button" onClick={() => set("bankAccountId", "")} className="text-xs text-muted-foreground hover:text-danger inline-flex items-center gap-1"><X className="h-3 w-3" />{t("إزالة", "Remove")}</button>}
          </Section>

          <Section title={t("ممثل الشركة والختم", "Signatory & stamp")}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("الاسم", "Name")}</Label><Input value={form.signatoryName} onChange={(e) => set("signatoryName", e.target.value)} data-testid="signatory-name" /></div>
              <div className="space-y-2"><Label>{t("المسمى", "Title")}</Label><Input value={form.signatoryTitle} onChange={(e) => set("signatoryTitle", e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("البريد", "Email")}</Label><Input value={form.signatoryEmail} onChange={(e) => set("signatoryEmail", e.target.value)} dir="ltr" className="font-english" type="email" /></div>
              <div className="space-y-2"><Label>{t("الجوال", "Phone")}</Label><Input value={form.signatoryPhone} onChange={(e) => set("signatoryPhone", e.target.value)} dir="ltr" className="font-english" /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("الختم (يُستخدم ختم الشركة من الإعدادات عند تركه فارغًا)", "Stamp (falls back to the company stamp in settings)")}</Label>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3">
                {form.stampUrl || (org as any)?.stampUrl
                  ? <img src={form.stampUrl || (org as any).stampUrl} alt="" className="h-12 max-w-[120px] object-contain" />
                  : <span className="text-xs text-muted-foreground">{t("لا يوجد ختم", "No stamp")}</span>}
                <div className="ms-auto flex items-center gap-2">
                  {form.stampUrl && <button type="button" onClick={() => set("stampUrl", "")} className="text-xs text-muted-foreground hover:text-danger">{t("إزالة", "Remove")}</button>}
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs cursor-pointer hover:bg-surface-hover">
                    <Upload className="h-3.5 w-3.5" /> {t("رفع", "Upload")}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStamp(f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Live preview (all sheets · scrollable) ── */}
        <div className="min-w-0 xl:sticky xl:top-4 space-y-2" data-testid="template-preview">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{t("معاينة حية", "Live preview")} <span className="text-muted-foreground font-normal">· {t(`${sheetCount} صفحات A4`, `${sheetCount} A4 pages`)}</span></Label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="radiogroup" aria-label={t("نوع المعاينة", "Preview document")}>
                {(["QUOTE", "INVOICE"] as DocKind[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={previewKind === k} data-testid={`preview-${k}`} onClick={() => setPreviewKind(k)} className={segBtn(previewKind === k)}>{k === "QUOTE" ? t("عرض سعر", "Quote") : t("فاتورة", "Invoice")}</button>
                ))}
              </div>
              <div className="flex gap-1 rounded-lg bg-muted/50 p-1" role="radiogroup" aria-label={t("لغة المعاينة", "Preview language")}>
                {(["ar", "en"] as DocLang[]).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={previewLang === l} data-testid={`preview-${l}`} onClick={() => setPreviewLang(l)} className={`${segBtn(previewLang === l)} font-english`}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-surface-hover p-3 xl:max-h-[calc(100vh-11rem)] overflow-y-auto" data-testid="template-preview-scroll">
            <BrandDocument input={previewInput} scaleToFit onRendered={onRendered} />
          </div>
        </div>
      </form>
    </div>
  );
}
