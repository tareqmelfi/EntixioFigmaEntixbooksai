/**
 * SmartImportWizard · «استيراد ذكي من أي ملف» (2026-09-08)
 *
 * One FullPageForm wizard (UX-1 · no dialogs, no browser popups) shared by the
 * chart of accounts, contacts and products:
 *
 *   1. drop     — drag a file, browse, or paste a table
 *   2. mapping  — the detected sheet + header row + column→field selects with a
 *                 confidence chip and the alternatives, so anything can be fixed
 *   3. preview  — the normalized rows colour-coded new / update / conflict,
 *                 counters, and every warning listed in full
 *   4. result   — created / updated / skipped, warnings, and a way back
 *
 * The API does the parsing (deterministic, no AI for spreadsheets). Every error
 * this component can hit is rendered on screen — never a silent no-op, which is
 * exactly the defect this replaces.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload, FileSpreadsheet, ClipboardPaste, ArrowRight, ArrowLeft,
  CheckCircle2, AlertTriangle, Loader2, Download, RefreshCw,
} from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { FullPageForm } from "./full-page-form";
import { Button } from "./ui/button";
import { DataTable, InlineAlert, Metric, MetricStrip, StatusBadge } from "./product";
import { api, ApiError, type ImportAnalysis, type ImportMsg, type ImportReport } from "../lib/api";

export type ImportEntity = "accounts" | "contacts" | "products";

type Step = "drop" | "mapping" | "preview" | "result";

const ENTITY_TITLE: Record<ImportEntity, { ar: string; en: string }> = {
  accounts: { ar: "استيراد دليل الحسابات", en: "Import chart of accounts" },
  contacts: { ar: "استيراد جهات الاتصال", en: "Import contacts" },
  products: { ar: "استيراد الأصناف", en: "Import items" },
};

/** Columns rendered in the preview table, per entity. */
const PREVIEW_COLUMNS: Record<ImportEntity, Array<{ key: string; ar: string; en: string; mono?: boolean }>> = {
  accounts: [
    { key: "code", ar: "الكود", en: "Code", mono: true },
    { key: "name", ar: "الاسم", en: "Name" },
    { key: "nameAr", ar: "الاسم بالعربية", en: "Name (AR)" },
    { key: "type", ar: "التصنيف", en: "Type" },
    { key: "parentCode", ar: "الأب", en: "Parent", mono: true },
  ],
  contacts: [
    { key: "displayName", ar: "الاسم", en: "Name" },
    { key: "email", ar: "البريد", en: "Email" },
    { key: "phone", ar: "الجوال", en: "Phone", mono: true },
    { key: "role", ar: "النوع", en: "Role" },
    { key: "city", ar: "المدينة", en: "City" },
  ],
  products: [
    { key: "sku", ar: "الرمز", en: "SKU", mono: true },
    { key: "name", ar: "الاسم", en: "Name" },
    { key: "type", ar: "النوع", en: "Type" },
    { key: "unitPrice", ar: "السعر", en: "Price", mono: true },
    { key: "stockQty", ar: "الكمية", en: "Qty", mono: true },
  ],
};

const STATUS_TONE = { new: "success", update: "info", conflict: "critical", skipped: "neutral" } as const;

function clientFor(entity: ImportEntity) {
  return entity === "accounts" ? api.accounts.smartImport : entity === "contacts" ? api.contacts.smartImport : api.products.smartImport;
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const s = String(reader.result || "");
    const idx = s.indexOf("base64,");
    resolve(idx >= 0 ? s.slice(idx + "base64,".length) : s);
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/**
 * A SpreadsheetML 2003 workbook — a real spreadsheet Excel/Numbers open with
 * Arabic intact, written with no library (an .xlsx would need a ZIP writer),
 * and read back by the importer's own parser on re-upload.
 */
export function buildSpreadsheetXml(sheetName: string, rows: Array<Array<string | number>>): string {
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const cell = (v: string | number) =>
    typeof v === "number" && Number.isFinite(v)
      ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${esc(sheetName).slice(0, 31)}">
  <Table>
${rows.map((r) => `   <Row>${r.map(cell).join("")}</Row>`).join("\n")}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function downloadSpreadsheet(fileName: string, sheetName: string, rows: Array<Array<string | number>>) {
  const blob = new Blob(["﻿", buildSpreadsheetXml(sheetName, rows)], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface Props {
  entity: ImportEntity;
  onClose: () => void;
  /** called after a successful commit so the list can refresh */
  onImported?: (report: ImportReport) => void;
  /** rows for the «تنزيل قالب» button: [header, ...data] */
  templateRows?: Array<Array<string | number>>;
  templateFileName?: string;
  templateSheetName?: string;
}

export function SmartImportWizard({ entity, onClose, onImported, templateRows, templateFileName, templateSheetName }: Props) {
  const { t, language } = useLanguage();
  const client = useMemo(() => clientFor(entity), [entity]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("drop");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<ImportMsg | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [source, setSource] = useState<{ fileBase64?: string; text?: string; fileName?: string; mimeType?: string } | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [withOpening, setWithOpening] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const say = useCallback((m?: ImportMsg | null) => (m ? (language === "ar" ? m.ar : m.en) : ""), [language]);

  const runAnalyze = useCallback(async (payload: { fileBase64?: string; text?: string; fileName?: string; mimeType?: string }, overrides?: { sheet?: string; headerRow?: number; mapping?: Record<string, number> }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await client.analyze({ ...payload, ...overrides });
      setAnalysis(r);
      setSource(payload);
      if (!r.ok && r.message) setError(r.message);
      setStep("mapping");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : String((e as Error)?.message || e);
      setError({ ar: `تعذر تحليل الملف: ${message}`, en: `Could not analyse the file: ${message}` });
      setAnalysis(null);
    } finally {
      setBusy(false);
    }
  }, [client]);

  const onPickFile = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await runAnalyze({ fileBase64, fileName: file.name, mimeType: file.type || "application/octet-stream" });
    } catch (e) {
      setError({ ar: "تعذر قراءة الملف من جهازك", en: "Could not read the file from your device" });
      setBusy(false);
    }
  }, [runAnalyze]);

  const remap = useCallback((field: string, column: number) => {
    if (!analysis || !source) return;
    const mapping = { ...analysis.mapping };
    if (column < 0) delete mapping[field]; else mapping[field] = column;
    void runAnalyze(source, { sheet: analysis.sheet, headerRow: analysis.headerRow, mapping });
  }, [analysis, source, runAnalyze]);

  const changeSheet = useCallback((sheet: string) => {
    if (!source) return;
    void runAnalyze(source, { sheet });
  }, [source, runAnalyze]);

  const changeHeaderRow = useCallback((headerRow: number) => {
    if (!analysis || !source) return;
    void runAnalyze(source, { sheet: analysis.sheet, headerRow });
  }, [analysis, source, runAnalyze]);

  const commit = useCallback(async () => {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const rows = analysis.rows.filter((r: any) => r.status === "new" || (r.status === "update" && updateExisting));
      const r = await client.commit({
        rows,
        updateExisting,
        openingBalances: withOpening && analysis.openingBalances?.lines.length
          ? { lines: analysis.openingBalances.lines.map((l) => ({ code: l.code, debit: l.debit, credit: l.credit })) }
          : null,
      });
      setReport(r);
      setStep("result");
      onImported?.(r);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : String((e as Error)?.message || e);
      setError({ ar: `فشل الاستيراد ولم يُحفظ أي شيء: ${message}`, en: `Import failed and nothing was saved: ${message}` });
    } finally {
      setBusy(false);
    }
  }, [analysis, client, updateExisting, withOpening, onImported]);

  const counts = analysis?.counts || {};
  const importable = (counts.new || 0) + (updateExisting ? counts.update || 0 : 0);
  const previewCols = PREVIEW_COLUMNS[entity];

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-content-secondary">
        {step === "drop" && t("الخطوة 1 من 4 · اختر الملف", "Step 1 of 4 · choose a file")}
        {step === "mapping" && t("الخطوة 2 من 4 · تأكيد الأعمدة", "Step 2 of 4 · confirm the columns")}
        {step === "preview" && t("الخطوة 3 من 4 · مراجعة الصفوف", "Step 3 of 4 · review the rows")}
        {step === "result" && t("الخطوة 4 من 4 · النتيجة", "Step 4 of 4 · result")}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {step === "mapping" && (
          <Button variant="outline" onClick={() => { setStep("drop"); setAnalysis(null); }} disabled={busy}>
            <ArrowLeft className="me-2 h-4 w-4" strokeWidth={1.75} />{t("ملف آخر", "Another file")}
          </Button>
        )}
        {step === "preview" && (
          <Button variant="outline" onClick={() => setStep("mapping")} disabled={busy}>
            <ArrowLeft className="me-2 h-4 w-4" strokeWidth={1.75} />{t("رجوع للربط", "Back to mapping")}
          </Button>
        )}
        {step === "mapping" && (
          <Button onClick={() => setStep("preview")} disabled={busy || !analysis?.ok} data-testid="import-to-preview">
            {t("معاينة الصفوف", "Preview rows")}<ArrowRight className="ms-2 h-4 w-4" strokeWidth={1.75} />
          </Button>
        )}
        {step === "preview" && (
          <Button onClick={commit} disabled={busy || importable === 0} data-testid="import-commit">
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Upload className="me-2 h-4 w-4" strokeWidth={1.75} />}
            {t(`استيراد ${importable} صف`, `Import ${importable} rows`)}
          </Button>
        )}
        {step === "result" && (
          <Button onClick={onClose} data-testid="import-done">{t("عودة للقائمة", "Back to the list")}</Button>
        )}
      </div>
    </div>
  );

  return (
    <FullPageForm
      title={t(ENTITY_TITLE[entity].ar, ENTITY_TITLE[entity].en)}
      subtitle={t("Excel · CSV · TSV · JSON · نسخ ولصق جدول — أي ملف بلا استثناء", "Excel · CSV · TSV · JSON · pasted table — any file, no exceptions")}
      onClose={onClose}
      disableEscape={busy}
      footer={footer}
    >
      <div className="space-y-6" data-testid={`import-wizard-${step}`}>
        {error && (
          <InlineAlert tone="critical" title={t("لم يكتمل الاستيراد", "The import did not go through")} icon={<AlertTriangle className="h-4 w-4 text-danger" />}>
            {say(error)}
          </InlineAlert>
        )}

        {/* ── 1 · drop ─────────────────────────────────────────────────── */}
        {step === "drop" && (
          <div className="space-y-5">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.json,.pdf,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); e.target.value = ""; }}
            />
            <div
              role="button"
              tabIndex={0}
              data-testid="import-dropzone"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void onPickFile(f); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-primary bg-surface-subtle" : "border-border bg-card"}`}
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileSpreadsheet className="h-8 w-8 text-primary" strokeWidth={1.5} />}
              <div className="text-base font-semibold text-foreground">
                {busy ? t("جارٍ التحليل…", "Analysing…") : t("اسحب الملف هنا أو اضغط للاختيار", "Drop the file here, or click to choose")}
              </div>
              <div className="text-xs text-content-secondary">
                {entity === "accounts"
                  ? t("يقرأ الملف كما هو: أي ورقة · أي صف عناوين · عناوين عربية أو إنجليزية · الحساب الأب بالكود",
                       "Read as-is: any sheet · any header row · Arabic or English headers · parent by code")
                  : t("يقرأ الملف كما هو: أي ورقة · أي صف عناوين · عناوين عربية أو إنجليزية",
                       "Read as-is: any sheet · any header row · Arabic or English headers")}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardPaste className="h-4 w-4 text-primary" strokeWidth={1.75} />
                {t("أو الصق الجدول مباشرة", "Or paste the table directly")}
              </div>
              <textarea
                data-testid="import-paste"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={5}
                dir="auto"
                placeholder={t("انسخ الصفوف من Excel والصقها هنا", "Copy the rows from Excel and paste them here")}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" disabled={busy || pasted.trim().length < 3} onClick={() => void runAnalyze({ text: pasted, fileName: "pasted.tsv", mimeType: "text/plain" })}>
                  {t("تحليل النص الملصوق", "Analyse pasted text")}
                </Button>
                {templateRows && templateRows.length > 0 && (
                  <Button
                    variant="outline"
                    data-testid="import-template"
                    onClick={() => downloadSpreadsheet(templateFileName || `entix-${entity}-template.xls`, templateSheetName || t("قالب", "Template"), templateRows)}
                  >
                    <Download className="me-2 h-4 w-4" strokeWidth={1.75} />{t("تنزيل قالب", "Download template")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 2 · mapping ──────────────────────────────────────────────── */}
        {step === "mapping" && analysis && (
          <div className="space-y-5">
            <MetricStrip className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
              <Metric label={t("الورقة", "Sheet")} value={<span className="font-sans text-base">{analysis.sheet || "—"}</span>} />
              <Metric label={t("صف العناوين", "Header row")} value={analysis.headerRow + 1} />
              <Metric label={t("جديد", "New")} value={counts.new ?? 0} tone="success" />
              <Metric label={t("موجود مسبقًا", "Existing")} value={counts.update ?? 0} tone="info" />
              <Metric label={t("متعارض / متخطى", "Conflict / skipped")} value={(counts.conflict ?? 0) + (counts.skipped ?? 0)} tone={(counts.conflict ?? 0) > 0 ? "warning" : "neutral"} />
            </MetricStrip>

            {analysis.sheets.length > 1 && (
              <section className="space-y-2">
                <h2 className="text-section font-semibold">{t("الورقة المختارة", "Selected sheet")}</h2>
                <div className="flex flex-wrap gap-2" data-testid="import-sheets">
                  {analysis.sheets.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => changeSheet(s.name)}
                      disabled={busy}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${s.name === analysis.sheet ? "border-primary text-primary" : "border-border text-content-secondary hover:text-foreground"}`}
                    >
                      <bdi dir="auto">{s.name}</bdi>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-section font-semibold">{t("ربط الأعمدة", "Column mapping")}</h2>
                <label className="flex items-center gap-2 text-xs text-content-secondary">
                  {t("صف العناوين", "Header row")}
                  <input
                    type="number"
                    min={1}
                    value={analysis.headerRow + 1}
                    onChange={(e) => changeHeaderRow(Math.max(0, Number(e.target.value) - 1))}
                    disabled={busy}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm font-code text-foreground"
                    data-testid="import-header-row"
                  />
                </label>
              </div>
              <DataTable
                className="overflow-x-auto"
                density="dense"
                rows={analysis.fields}
                rowKey={(f) => f.field}
                columns={[
                  {
                    key: "field",
                    header: t("الحقل", "Field"),
                    cell: (f) => (
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{say(f.label)}</span>
                        <span className="ms-2 font-code text-xs text-muted-foreground">{f.field}</span>
                      </span>
                    ),
                  },
                  {
                    key: "column",
                    header: t("العمود في الملف", "Column in the file"),
                    cell: (f) => (
                      <select
                        value={f.column ?? -1}
                        disabled={busy}
                        onChange={(e) => remap(f.field, Number(e.target.value))}
                        data-testid={`import-map-${f.field}`}
                        aria-label={say(f.label)}
                        className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                      >
                        <option value={-1}>{t("— بدون —", "— none —")}</option>
                        {analysis.headers.map((h, i) => (
                          <option key={i} value={i}>{h || t(`عمود ${i + 1}`, `Column ${i + 1}`)}</option>
                        ))}
                      </select>
                    ),
                  },
                  {
                    key: "confidence",
                    header: t("الثقة", "Confidence"),
                    cell: (f) => (
                      <span className="flex flex-wrap items-center gap-2">
                        {f.column === null || f.column < 0
                          ? <StatusBadge tone="neutral">{t("غير مربوط", "Unmapped")}</StatusBadge>
                          : <StatusBadge tone={f.confidence >= 0.9 ? "success" : f.confidence >= 0.6 ? "info" : "warning"}>
                              {Math.round(f.confidence * 100)}%
                            </StatusBadge>}
                        {f.alternatives.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t("بدائل:", "Alt:")} <bdi dir="auto">{f.alternatives.map((a) => a.header).join(" · ")}</bdi>
                          </span>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </section>

            {analysis.warnings.length > 0 && (
              <InlineAlert tone="warning" title={t("تنبيهات", "Warnings")} icon={<AlertTriangle className="h-4 w-4 text-warning" />}>
                <ul className="list-disc space-y-1 ps-4" data-testid="import-warnings">
                  {analysis.warnings.map((w, i) => <li key={i}>{say(w)}</li>)}
                </ul>
              </InlineAlert>
            )}
          </div>
        )}

        {/* ── 3 · preview ──────────────────────────────────────────────── */}
        {step === "preview" && analysis && (
          <div className="space-y-5">
            <MetricStrip className="grid-cols-2 sm:grid-cols-4">
              <Metric label={t("جديد", "New")} value={counts.new ?? 0} tone="success" />
              <Metric label={t("تحديث", "Update")} value={counts.update ?? 0} tone="info" />
              <Metric label={t("متعارض", "Conflict")} value={counts.conflict ?? 0} tone={(counts.conflict ?? 0) > 0 ? "warning" : "neutral"} />
              <Metric label={t("متخطى", "Skipped")} value={counts.skipped ?? 0} />
            </MetricStrip>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} data-testid="import-update-existing" />
                {t("تحديث الصفوف الموجودة بنفس الكود", "Update rows that already exist with the same code")}
              </label>
              {entity === "accounts" && analysis.openingBalances && analysis.openingBalances.lines.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={withOpening} onChange={(e) => setWithOpening(e.target.checked)} data-testid="import-opening" />
                  {t(`ترحيل الأرصدة الافتتاحية (${analysis.openingBalances.lines.length} سطر)`, `Post opening balances (${analysis.openingBalances.lines.length} lines)`)}
                </label>
              )}
            </div>

            <div data-testid="import-preview-rows">
            <DataTable
              className="overflow-x-auto"
              density="dense"
              rows={analysis.rows.slice(0, 30)}
              rowKey={(row: any) => row.row}
              empty={t("لا توجد صفوف", "No rows")}
              columns={[
                { key: "row", header: t("الصف", "Row"), cell: (row: any) => <span className="font-code text-xs text-muted-foreground">{row.row}</span> },
                ...previewCols.map((col) => ({
                  key: col.key,
                  header: t(col.ar, col.en),
                  className: col.mono ? "font-code" : undefined,
                  cell: (row: any) => (
                    <bdi dir="auto">{row[col.key] === null || row[col.key] === undefined || row[col.key] === "" ? "—" : String(row[col.key])}</bdi>
                  ),
                })),
                {
                  key: "status",
                  header: t("الحالة", "Status"),
                  cell: (row: any) => (
                    <StatusBadge tone={STATUS_TONE[(row.status as keyof typeof STATUS_TONE)] ?? "neutral"}>
                      {row.status === "new" ? t("جديد", "New")
                        : row.status === "update" ? t("موجود", "Existing")
                        : row.status === "conflict" ? t("متعارض", "Conflict")
                        : t("متخطى", "Skipped")}
                    </StatusBadge>
                  ),
                },
                {
                  key: "messages",
                  header: t("ملاحظات", "Notes"),
                  cell: (row: any) => (
                    <bdi dir="auto" className="text-xs text-content-secondary">
                      {(row.messages || []).map((m: ImportMsg) => say(m)).join(" · ") || "—"}
                    </bdi>
                  ),
                },
              ]}
            />
            </div>
            {analysis.rows.length > 30 && (
              <p className="text-xs text-muted-foreground">
                {t(`تعرض المعاينة أول 30 صفًا من ${analysis.rows.length} — الاستيراد يشمل كل الصفوف الصالحة.`,
                   `Showing the first 30 of ${analysis.rows.length} rows — the import covers every valid row.`)}
              </p>
            )}

            {analysis.rows.some((r: any) => (r.messages || []).length > 0) && (
              <InlineAlert tone="warning" title={t("كل التنبيهات", "Every warning")} icon={<AlertTriangle className="h-4 w-4 text-warning" />}>
                <ul className="list-disc space-y-1 ps-4">
                  {analysis.rows.flatMap((r: any) => (r.messages || []).map((m: ImportMsg) => say(m))).map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              </InlineAlert>
            )}
          </div>
        )}

        {/* ── 4 · result ───────────────────────────────────────────────── */}
        {step === "result" && report && (
          <div className="space-y-5">
            <InlineAlert tone={report.ok ? "success" : "critical"} title={report.ok ? t("تم الاستيراد", "Import complete") : t("لم يتم الاستيراد", "Import did not complete")} icon={report.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-danger" />}>
              {say(report.message)}
            </InlineAlert>
            <MetricStrip className="grid-cols-1 sm:grid-cols-3">
              <Metric label={t("أُنشئ", "Created")} value={report.created} tone="success" />
              <Metric label={t("حُدِّث", "Updated")} value={report.updated} tone="info" />
              <Metric label={t("تُخطّي", "Skipped")} value={report.skipped} />
            </MetricStrip>
            {report.openingEntry && (
              <InlineAlert tone="info" title={t("قيد الأرصدة الافتتاحية", "Opening balance entry")}>
                <span className="font-code">{report.openingEntry.entryNumber}</span> · {t(`${report.openingEntry.lines} سطر`, `${report.openingEntry.lines} lines`)}
              </InlineAlert>
            )}
            {report.warnings?.length > 0 && (
              <InlineAlert tone="warning" title={t("تنبيهات", "Warnings")} icon={<AlertTriangle className="h-4 w-4 text-warning" />}>
                <ul className="list-disc space-y-1 ps-4">{report.warnings.map((w, i) => <li key={i}>{say(w)}</li>)}</ul>
              </InlineAlert>
            )}
            <Button variant="outline" onClick={() => { setStep("drop"); setAnalysis(null); setReport(null); setPasted(""); }}>
              <RefreshCw className="me-2 h-4 w-4" strokeWidth={1.75} />{t("استيراد ملف آخر", "Import another file")}
            </Button>
          </div>
        )}
      </div>
    </FullPageForm>
  );
}
