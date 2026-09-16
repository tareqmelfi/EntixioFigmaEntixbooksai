/**
 * /app/settings/external-sources/new · «ربط مصدر جديد» (SPEC-06 · M1)
 *
 * One full page (FullPageForm) · four steps revealed progressively · no modal:
 *   1. paste the Google Sheet URL/ID · service-account email + copy · validate
 *   2. choose the sheet tab + header row
 *   3. choose the template (M1 ships one) + mapping table (auto-filled · required unmapped highlighted)
 *   4. preview 20 rows with per-row error badges → «ربط وبدء المزامنة»
 *
 * UX-1: inline alerts + toasts only. UX-5: mapping uses SearchableCombobox.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Copy, Check, Link2, Table2, ListChecks, Eye, ArrowDown } from "lucide-react";
import { FullPageForm } from "../components/full-page-form";
import { ToastStack, useToasts } from "../components/side-panel";
import { InlineAlert } from "../components/product";
import { SearchableCombobox } from "../components/searchable-combobox";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { normalizeDigits } from "../lib/digits";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";
import { api, ApiError, type ExtMapping, type ExtPreviewResult, type ExtTemplate, type ExtValidateResult } from "../lib/api";
import { fieldLabel, formatCell, fmtNumber } from "../components/board-widgets";

const NONE = "__none__";
const POLL_OPTIONS = [5, 10, 15, 30, 60];

function StepHeader({ n, icon, title, hint, done }: { n: number; icon: React.ReactNode; title: string; hint?: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-success text-white" : "bg-foreground text-background"}`}>{done ? "✓" : n}</span>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">{icon}{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function ExternalSourceNew() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { currency } = useOrgRegion();
  const { toasts, push, dismiss } = useToasts();

  // Step 1
  const [urlInput, setUrlInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<ExtValidateResult | null>(null);
  const [validateError, setValidateError] = useState<{ code: string; message: string; email?: string } | null>(null);
  const [serviceEmail, setServiceEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Step 2
  const [sheetTitle, setSheetTitle] = useState("");
  const [headerRow, setHeaderRow] = useState("1");
  // Step 3
  const [templates, setTemplates] = useState<ExtTemplate[]>([]);
  const [templateCode, setTemplateCode] = useState("");
  const [mapping, setMapping] = useState<ExtMapping>({});
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ExtPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Step 4
  const [name, setName] = useState("");
  const [pollIntervalMin, setPollIntervalMin] = useState(30);
  const [creating, setCreating] = useState(false);

  const template = useMemo(() => templates.find((x) => x.code === templateCode) || null, [templates, templateCode]);
  const close = useCallback(() => navigate("/app/settings?tab=external-sources"), [navigate]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.extSources.templates();
        setTemplates(r.templates);
        setServiceEmail(r.serviceAccountEmail);
        if (r.templates[0]) setTemplateCode(r.templates[0].code);
      } catch (e) {
        push("error", e instanceof ApiError ? e.message : t("تعذّر تحميل القوالب", "Could not load templates"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyEmail = async () => {
    const email = validateError?.email || serviceEmail;
    if (!email) return;
    try { await navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { push("error", t("تعذّر النسخ", "Copy failed")); }
  };

  // ── Step 1 · validate ──────────────────────────────────────────────────────
  const validate = async () => {
    const v = urlInput.trim();
    if (!v) { setValidateError({ code: "empty", message: t("الصق رابط الشيت أو معرّفه", "Paste the sheet URL or ID") }); return; }
    setValidating(true); setValidateError(null); setValidated(null); setPreview(null); setSheetTitle("");
    try {
      const r = await api.extSources.validate(v);
      setValidated(r);
      setServiceEmail(r.serviceAccountEmail || serviceEmail);
      if (!name) setName(r.title);
      if (r.sheets[0]) setSheetTitle(r.sheets[0].title);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const code = err?.code || "error";
      const body = (err?.body || {}) as { serviceAccountEmail?: string };
      const message =
        code === "sheet_not_shared" ? t("الشيت غير مشارك مع حساب الخدمة — شاركه كمشاهد ثم أعد المحاولة", "The sheet is not shared with the service account — share it as viewer and retry") :
        code === "sheet_not_found" ? t("لم نجد الشيت — تأكد من الرابط أو المعرّف", "Sheet not found — check the URL or ID") :
        code === "not_configured" ? t("ربط Google Sheets غير مفعّل على هذا الخادم بعد", "Google Sheets linking is not configured on this server yet") :
        (err?.message || t("تعذّر التحقق", "Validation failed"));
      setValidateError({ code, message, email: body.serviceAccountEmail || serviceEmail || undefined });
    } finally { setValidating(false); }
  };

  // ── Step 2/3 · preview (auto on sheet/header/template change · manual on mapping change) ──
  const previewSeq = useRef(0);
  const runPreview = useCallback(async (opts: { mapping?: ExtMapping }) => {
    if (!validated || !sheetTitle || !templateCode) return;
    const seq = ++previewSeq.current;
    setPreviewing(true); setPreviewError(null);
    try {
      const hr = Math.max(1, Number(normalizeDigits(headerRow)) || 1);
      const r = await api.extSources.preview({ spreadsheetId: validated.spreadsheetId, sheetTitle, headerRow: hr, templateCode, mapping: opts.mapping });
      if (seq !== previewSeq.current) return;
      setPreview(r);
      setMapping(r.mapping);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreviewError(e instanceof ApiError ? e.message : t("تعذّرت المعاينة", "Preview failed"));
    } finally { if (seq === previewSeq.current) setPreviewing(false); }
    // `t` is intentionally excluded · it is recreated by the provider and must not re-trigger the auto-preview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validated, sheetTitle, templateCode, headerRow]);

  useEffect(() => { if (validated && sheetTitle && templateCode) void runPreview({}); }, [validated, sheetTitle, templateCode, headerRow, runPreview]);

  const setMap = (fieldKey: string, header: string) => {
    const next: ExtMapping = { ...mapping, [fieldKey]: header === NONE ? null : header };
    setMapping(next);
  };
  const mappingDirty = useMemo(() => preview ? JSON.stringify(preview.mapping) !== JSON.stringify(mapping) : false, [preview, mapping]);

  const missingRequired = useMemo(() => {
    if (!template) return [];
    return template.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.key);
  }, [template, mapping]);

  const headerItems = useMemo(() => [
    { id: NONE, label: t("— غير مربوط —", "— not mapped —") },
    ...(preview?.headers || []).map((h) => ({ id: h, label: h })),
  ], [preview, t]);

  // ── Step 4 · create ────────────────────────────────────────────────────────
  const create = async () => {
    if (!validated || !template || !preview) return;
    if (!name.trim()) { push("error", t("اكتب اسمًا للمصدر", "Enter a source name")); return; }
    if (missingRequired.length) { push("error", t("اربط الحقول المطلوبة أولًا", "Map the required fields first")); return; }
    setCreating(true);
    try {
      const r = await api.extSources.create({
        name: name.trim(),
        spreadsheetId: validated.spreadsheetId,
        sheetTitle,
        headerRow: Math.max(1, Number(normalizeDigits(headerRow)) || 1),
        templateCode: template.code,
        mapping,
        pollIntervalMin,
      });
      push("success", t("تم الربط وبدأت المزامنة", "Linked · first sync started"));
      navigate(`/app/boards/${r.source.id}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      push("error", err?.code === "source_exists" ? t("هذا الشيت/التبويب مرتبط مسبقًا", "This sheet tab is already linked") : (err?.message || t("فشل الربط", "Linking failed")));
    } finally { setCreating(false); }
  };

  const step1Done = !!validated;
  const step2Done = step1Done && !!sheetTitle && !!preview;
  const step3Done = step2Done && missingRequired.length === 0 && !mappingDirty;
  const canCreate = step3Done && !creating && !previewing;

  const emailBox = (email: string | null | undefined) => email ? (
    <div className="flex max-w-xl items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <code dir="ltr" className="min-w-0 flex-1 truncate font-code text-xs text-foreground text-left">{email}</code>
      <button type="button" onClick={copyEmail} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground" title={t("نسخ", "Copy")}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  ) : null;

  return (
    <FullPageForm
      title={t("ربط مصدر جديد", "Link a new source")}
      subtitle={t("Google Sheets → لوحة متابعة", "Google Sheets → pipeline board")}
      onClose={close}
      disableEscape={creating}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {!step1Done ? t("الخطوة 1 من 4 · تحقّق من الشيت", "Step 1 of 4 · validate the sheet")
              : !step2Done ? t("الخطوة 2 من 4 · اختر التبويب", "Step 2 of 4 · choose the tab")
              : !step3Done ? t("الخطوة 3 من 4 · أكمل الربط", "Step 3 of 4 · complete the mapping")
              : t("الخطوة 4 من 4 · راجع المعاينة ثم اربط", "Step 4 of 4 · review the preview, then link")}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={close} disabled={creating}>{t("إلغاء", "Cancel")}</Button>
            <Button onClick={create} disabled={!canCreate} className="min-w-[180px]">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="me-2 h-4 w-4" strokeWidth={1.75} />{t("ربط وبدء المزامنة", "Link & start syncing")}</>}
            </Button>
          </div>
        </div>
      }
    >
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── Step 1 ── */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <StepHeader n={1} done={step1Done} icon={<Link2 className="h-4 w-4" strokeWidth={1.75} />} title={t("الصق رابط Google Sheet", "Paste the Google Sheet link")} hint={t("شارك الشيت أولًا مع حساب الخدمة أدناه بصلاحية «مشاهد»", "First share the sheet with the service account below as “Viewer”")} />
          <div className="space-y-2">
            <Label>{t("حساب الخدمة", "Service account")}</Label>
            {emailBox(serviceEmail) || <p className="text-xs text-muted-foreground">{t("يظهر البريد بعد أول تحقق", "Shown after the first validation")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-url">{t("رابط الشيت أو المعرّف *", "Sheet URL or ID *")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="ext-url" dir="ltr" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void validate(); }} placeholder="https://docs.google.com/spreadsheets/d/…" className="flex-1 font-code text-xs" />
              <Button type="button" variant="outline" onClick={validate} disabled={validating} className="sm:w-[140px]">
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("تحقّق", "Validate")}
              </Button>
            </div>
          </div>
          {validateError && (
            <InlineAlert tone="critical" title={validateError.message}>
              {validateError.code === "sheet_not_shared" && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">{t("افتح الشيت → مشاركة → أضف هذا البريد كمشاهد:", "Open the sheet → Share → add this email as Viewer:")}</p>
                  {emailBox(validateError.email)}
                </div>
              )}
            </InlineAlert>
          )}
          {validated && (
            <InlineAlert tone="success" title={validated.title}>
              {t(`${fmtNumber(validated.sheets.length, language)} تبويب · جاهز للربط`, `${fmtNumber(validated.sheets.length, language)} tabs · ready to link`)}
            </InlineAlert>
          )}
        </section>

        {/* ── Step 2 ── */}
        {step1Done && validated && (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <StepHeader n={2} done={step2Done} icon={<Table2 className="h-4 w-4" strokeWidth={1.75} />} title={t("اختر التبويب وصف العناوين", "Choose the tab and the header row")} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>{t("التبويب *", "Tab *")}</Label>
                <div className="flex flex-wrap gap-2">
                  {validated.sheets.map((sh) => (
                    <button
                      key={sh.title}
                      type="button"
                      onClick={() => setSheetTitle(sh.title)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${sheetTitle === sh.title ? "border-primary bg-primary/10 text-foreground font-semibold" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"}`}
                    >
                      <bdi dir="auto">{sh.title}</bdi> <span dir="ltr" className="font-english text-[11px] tabular-nums opacity-70">({fmtNumber(sh.rowCount, language)})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ext-header-row">{t("صف العناوين", "Header row")}</Label>
                <Input id="ext-header-row" dir="ltr" inputMode="numeric" value={headerRow} onChange={(e) => setHeaderRow(normalizeDigits(e.target.value).replace(/[^0-9]/g, "") || "")} onBlur={() => { if (!headerRow) setHeaderRow("1"); }} className="font-english" />
                <p className="text-xs text-muted-foreground">{t("عادةً 1 · غيّره إذا كان الشيت يبدأ بعنوان أو ملاحظات", "Usually 1 · change it if the sheet starts with a title or notes")}</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Step 3 ── */}
        {step1Done && sheetTitle && (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <StepHeader n={3} done={step3Done} icon={<ListChecks className="h-4 w-4" strokeWidth={1.75} />} title={t("القالب وربط الأعمدة", "Template and column mapping")} hint={t("رُبطت الأعمدة تلقائيًا حسب العناوين · صحّح ما لم يُطابَق", "Columns were auto-mapped by header · fix whatever did not match")} />
            <div className="space-y-2">
              <Label>{t("القالب", "Template")}</Label>
              <div className="flex flex-wrap gap-2">
                {templates.map((tp) => (
                  <button key={tp.code} type="button" onClick={() => setTemplateCode(tp.code)} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${templateCode === tp.code ? "border-primary bg-primary/10 text-foreground font-semibold" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"}`}>
                    {language === "ar" ? tp.nameAr : tp.nameEn}
                  </button>
                ))}
                {templates.length === 0 && <span className="text-xs text-muted-foreground">{t("لا قوالب متاحة", "No templates available")}</span>}
              </div>
            </div>

            {previewError && <InlineAlert tone="critical">{previewError}</InlineAlert>}
            {previewing && !preview && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>}

            {template && preview && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="px-3 py-2 text-start font-semibold">{t("حقل القالب", "Template field")}</th>
                      <th className="px-3 py-2 text-start font-semibold">{t("النوع", "Type")}</th>
                      <th className="px-3 py-2 text-start font-semibold">{t("عمود الشيت", "Sheet column")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.fields.map((f) => {
                      const missing = f.required && !mapping[f.key];
                      return (
                        <tr key={f.key} className={`border-b border-border last:border-b-0 ${missing ? "bg-warning-subtle/50" : ""}`}>
                          <td className="px-3 py-2 align-middle">
                            <div className="font-medium text-foreground">{fieldLabel(f, language)}{f.required && <span className="ms-1 text-danger">*</span>}{f.key === template.keyField && <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{t("مفتاح", "key")}</span>}</div>
                            {missing && <div className="text-[11px] text-warning">⚠ {t("حقل مطلوب غير مربوط", "Required field not mapped")}</div>}
                          </td>
                          <td className="px-3 py-2 align-middle"><code className="font-code text-[11px] text-muted-foreground">{f.type}</code></td>
                          <td className="px-3 py-2 align-middle">
                            <SearchableCombobox
                              value={mapping[f.key] || NONE}
                              onChange={(id) => setMap(f.key, id)}
                              items={headerItems}
                              placeholder={t("اختر عمودًا…", "Pick a column…")}
                              menuMinWidth={260}
                              className="w-full max-w-[320px]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {template && preview && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {missingRequired.length > 0
                    ? <span className="text-warning">⚠ {t(`${fmtNumber(missingRequired.length, language)} حقول مطلوبة غير مربوطة`, `${fmtNumber(missingRequired.length, language)} required fields unmapped`)}</span>
                    : <span className="text-success">✓ {t("كل الحقول المطلوبة مربوطة", "All required fields are mapped")}</span>}
                </div>
                {mappingDirty && (
                  <Button type="button" variant="outline" size="sm" onClick={() => runPreview({ mapping })} disabled={previewing}>
                    {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDown className="me-1.5 h-3.5 w-3.5" />{t("تحديث المعاينة بالربط الجديد", "Refresh preview with the new mapping")}</>}
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Step 4 ── */}
        {template && preview && (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <StepHeader n={4} icon={<Eye className="h-4 w-4" strokeWidth={1.75} />} title={t("معاينة أول 20 صفًا", "Preview of the first 20 rows")} hint={t(`الشيت يحتوي ${fmtNumber(preview.totalRows, language)} صفًا · الصفوف ذات المشاكل تُخزَّن وتُعلَّم ولا توقف المزامنة`, `The sheet has ${fmtNumber(preview.totalRows, language)} rows · rows with issues are stored and flagged, they never block the sync`)} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ext-name">{t("اسم المصدر *", "Source name *")}</Label>
                <Input id="ext-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("مثال: سجل عروض الأسعار", "e.g. Quotes register")} />
              </div>
              <div className="space-y-2">
                <Label>{t("فاصل المزامنة", "Sync interval")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POLL_OPTIONS.map((m) => (
                    <button key={m} type="button" onClick={() => setPollIntervalMin(m)} className={`rounded-full border px-2.5 py-1 text-xs font-english tabular-nums transition-colors ${pollIntervalMin === m ? "border-primary bg-primary/10 text-foreground font-semibold" : "border-border text-muted-foreground hover:text-foreground"}`}>{m} {t("د", "min")}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`overflow-x-auto rounded-lg border border-border ${previewing ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="w-10 px-2 py-2 text-start font-semibold">#</th>
                    <th className="w-24 px-2 py-2 text-start font-semibold">{t("الحالة", "Status")}</th>
                    {template.fields.map((f) => <th key={f.key} className={`px-3 py-2 font-semibold whitespace-nowrap ${f.type === "money" || f.type === "number" ? "text-end" : "text-start"}`}>{fieldLabel(f, language)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.length === 0 && <tr><td colSpan={2 + template.fields.length} className="px-3 py-6 text-center text-muted-foreground">{t("لا صفوف تحت صف العناوين", "No rows under the header row")}</td></tr>}
                  {preview.rows.map((r) => (
                    <tr key={r.rowIndex} className={`border-b border-border last:border-b-0 ${!r.valid ? "bg-warning-subtle/40" : ""}`}>
                      <td className="px-2 py-2 align-top"><span dir="ltr" className="font-english text-xs tabular-nums text-muted-foreground">{r.rowIndex}</span></td>
                      <td className="px-2 py-2 align-top">
                        {r.valid
                          ? <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">✓ {t("سليم", "OK")}</span>
                          : <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-subtle px-2 py-0.5 text-[11px] font-semibold text-warning" title={r.errors.join(" · ")}>⚠ {t(`${fmtNumber(r.errors.length, language)} مشاكل`, `${fmtNumber(r.errors.length, language)} issues`)}</span>}
                        {!r.valid && r.errors.length > 0 && <ul className="mt-1 space-y-0.5 text-[11px] text-warning">{r.errors.slice(0, 3).map((er, i) => <li key={i}>· {er}</li>)}</ul>}
                      </td>
                      {template.fields.map((f) => {
                        const num = f.type === "money" || f.type === "number";
                        return (
                          <td key={f.key} className={`px-3 py-2 align-top ${num ? "text-end" : "text-start"}`}>
                            <span dir={num || f.type === "date" ? "ltr" : undefined} className={`${num ? "font-english tabular-nums" : ""} block max-w-[240px] truncate`} title={String(r.normalized[f.key] ?? r.data[mapping[f.key] || ""] ?? "")}>
                              {formatCell(f, r.normalized[f.key], language, currency || "SAR")}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </FullPageForm>
  );
}
