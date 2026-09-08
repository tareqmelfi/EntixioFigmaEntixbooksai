/**
 * «إنشاء مشروع من ملف» · AI project intake (2026-09-09)
 *
 * The CEO: «حط إمكانية أني أرفع ملف — مثلاً عرض — بطريقة أني أرفعه ويصير الذكاء
 * يفهمه ويفتح المشروع منه ويطلع مشروع فعلاً متقن».
 *
 * Same wizard shape as `smart-import-wizard.tsx` — one FullPageForm, no dialogs
 * (UX-1), a numbered footer, every warning printed rather than swallowed:
 *
 *   1. drop    — drag a proposal / BOQ / cost study (PDF · image · Excel · CSV)
 *   2. review  — EVERY extracted number, editable, before anything is written
 *   3. result  — the project that was created, with a way into it
 *
 * The rule the CEO asked for, enforced visibly: a field the file does not
 * contain is EMPTY and carries the «غير موجود في الملف» chip. Nothing is
 * invented, and a cost taken from a sale amount says so on the row.
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { FullPageForm } from "./full-page-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { InlineAlert, Metric, MetricStrip, LedgerFigure, StatusBadge } from "./product";
import { DateInput } from "./date-input";
import { api, ApiError, type ProjectIntakePreview, type ProjectIntakeTask } from "../lib/api";
import { normalizeDigits } from "../lib/digits";
import { displayLocale, displayDigits } from "../lib/number-display";

type Step = "drop" | "review" | "result";

type EditableTask = ProjectIntakeTask & { plannedCostText: string; plannedDaysText: string };

/** The chip the CEO asked for · a field the file did not contain stays empty. */
function NotInFile() {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[11px] text-content-secondary" data-testid="not-in-file">
      {t("غير موجود في الملف", "Not in the file")}
    </span>
  );
}

const num = (v: string): number | null => {
  const s = normalizeDigits(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function ProjectIntakeWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (projectId: string) => void }) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("drop");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProjectIntakePreview | null>(null);
  const [created, setCreated] = useState<{ projectId: string; name: string; taskCount: number; contactName: string | null } | null>(null);

  // The editable copy of the preview · the CEO confirms every number here.
  const [form, setForm] = useState({ name: "", code: "", startDate: "", endDate: "", contractValue: "", notes: "" });
  const [clientMode, setClientMode] = useState<"existing" | "new" | "none">("none");
  const [clientName, setClientName] = useState("");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [createBudget, setCreateBudget] = useState(true);

  const missing = useMemo(() => new Set(preview?.missing || []), [preview]);

  const money = (v: number) => Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const analyse = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const res = await api.projects.intake(file);
      setPreview(res);
      setForm({
        name: res.project.name || "",
        code: res.project.code || "",
        startDate: res.project.startDate || "",
        endDate: res.project.endDate || "",
        contractValue: res.project.contractValue === null ? "" : String(res.project.contractValue),
        notes: res.source.fileName ? t(`من ملف ${res.source.fileName}`, `From ${res.source.fileName}`) : "",
      });
      setClientMode(res.client.matchedContactId ? "existing" : res.client.name ? "new" : "none");
      setClientName(res.client.name || "");
      setTasks(res.tasks.map((task) => ({
        ...task,
        plannedCostText: task.plannedCost === null ? "" : String(task.plannedCost),
        plannedDaysText: task.plannedDays === null ? "" : String(task.plannedDays),
      })));
      setStep("review");
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : t("تعذر قراءة الملف", "Could not read the file"));
    } finally { setBusy(false); }
  };

  const commit = async () => {
    if (!form.name.trim()) { setError(t("اسم المشروع مطلوب", "The project name is required")); return; }
    setBusy(true); setError(null);
    try {
      const res = await api.projects.intakeCommit({
        project: {
          name: form.name.trim(),
          code: form.code.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          contractValue: num(form.contractValue),
          notes: form.notes.trim() || null,
        },
        client: clientMode === "existing"
          ? { contactId: preview?.client.matchedContactId || null }
          : clientMode === "new"
            ? { createName: clientName.trim() || null, taxId: preview?.client.taxId || null }
            : undefined,
        tasks: tasks
          .filter((task) => task.title.trim())
          .map((task) => ({
            itemNo: task.itemNo,
            title: task.title.trim(),
            unit: task.unit,
            quantity: task.quantity,
            plannedCost: num(task.plannedCostText),
            plannedDays: num(task.plannedDaysText),
          })),
        createBudget,
        source: preview ? { fileName: preview.source.fileName, mimeType: preview.source.mimeType, fileHash: preview.source.fileHash, extract: preview } : undefined,
      });
      setCreated({
        projectId: res.project.id,
        name: res.project.name,
        taskCount: res.taskCount,
        contactName: res.createdContact?.displayName || null,
      });
      setStep("result");
    } catch (e: unknown) {
      const code = e instanceof ApiError ? e.message : "";
      setError(code === "code_exists"
        ? t("هذا الرمز مستخدم في مشروع آخر · اختر رمزاً مختلفاً", "This code is already used by another project · choose a different one")
        : (code || t("تعذر إنشاء المشروع", "Could not create the project")));
    } finally { setBusy(false); }
  };

  const costTotal = tasks.reduce((sum, task) => sum + (num(task.plannedCostText) || 0), 0);
  const costedCount = tasks.filter((task) => num(task.plannedCostText) !== null).length;

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-content-secondary">
        {step === "drop" && t("الخطوة 1 من 3 · اختر الملف", "Step 1 of 3 · choose the file")}
        {step === "review" && t("الخطوة 2 من 3 · راجع كل رقم قبل الحفظ", "Step 2 of 3 · confirm every figure before saving")}
        {step === "result" && t("الخطوة 3 من 3 · النتيجة", "Step 3 of 3 · result")}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {step === "review" && (
          <Button variant="outline" onClick={() => { setStep("drop"); setPreview(null); setError(null); }} disabled={busy}>
            <ArrowLeft className="me-2 h-4 w-4" strokeWidth={1.75} />{t("ملف آخر", "Another file")}
          </Button>
        )}
        {step === "review" && (
          <Button onClick={commit} disabled={busy || !form.name.trim()} data-testid="intake-commit">
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Upload className="me-2 h-4 w-4" strokeWidth={1.75} />}
            {t(`أنشئ المشروع و ${tasks.length} مهمة`, `Create the project and ${tasks.length} tasks`)}
          </Button>
        )}
        {step === "result" && created && (
          <>
            <Button variant="outline" onClick={onClose}>{t("عودة للقائمة", "Back to the list")}</Button>
            <Button onClick={() => onCreated(created.projectId)} data-testid="intake-open-project">
              {t("افتح المشروع", "Open the project")}<ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" strokeWidth={1.75} />
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <FullPageForm
      title={t("إنشاء مشروع من ملف", "Create a project from a file")}
      subtitle={t(
        "عرض سعر · جدول كميات · دراسة تكلفة — PDF أو صورة أو Excel. لا يُكتب شيء قبل مراجعتك.",
        "A proposal · a BOQ · a cost study — PDF, image or Excel. Nothing is written until you review it.",
      )}
      onClose={onClose}
      disableEscape={busy}
      footer={footer}
    >
      <div className="space-y-6" data-testid={`intake-wizard-${step}`}>
        {error && (
          <InlineAlert tone="critical" title={t("لم يكتمل الإجراء", "That did not go through")} icon={<AlertTriangle className="h-4 w-4 text-danger" />}>
            {error}
          </InlineAlert>
        )}

        {/* ── 1 · drop ──────────────────────────────────────────────────── */}
        {step === "drop" && (
          <div className="space-y-5">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.xlsm,.csv,.tsv,.txt,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void analyse(f); e.target.value = ""; }}
            />
            <div
              role="button"
              tabIndex={0}
              data-testid="intake-dropzone"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void analyse(f); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-primary bg-surface-subtle" : "border-border bg-card"}`}
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileUp className="h-8 w-8 text-primary" strokeWidth={1.5} />}
              <div className="text-base font-semibold text-foreground">
                {busy ? t("جارٍ قراءة الملف…", "Reading the file…") : t("اسحب العرض هنا أو اضغط للاختيار", "Drop the proposal here, or click to choose")}
              </div>
              <div className="max-w-xl text-xs text-content-secondary">
                {t(
                  "الجداول تُقرأ بمحرك الاستيراد الذكي · الـ PDF والصور تُقرأ بالذكاء الاصطناعي. أي حقل غير موجود في الملف يبقى فارغاً — لا يُخترع رقم أبداً.",
                  "Spreadsheets are read by the smart-import engine · PDFs and images by AI. A field the file does not contain stays empty — no number is ever invented.",
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 2 · review ────────────────────────────────────────────────── */}
        {step === "review" && preview && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
              <StatusBadge tone="info">
                {preview.source.engine === "ai" ? t("قراءة بالذكاء الاصطناعي", "Read by AI") : t("قراءة جدول", "Spreadsheet read")}
              </StatusBadge>
              {preview.source.fileName && <bdi dir="auto" className="min-w-0 max-w-[38ch] truncate font-code" title={preview.source.fileName}>{preview.source.fileName}</bdi>}
              {preview.source.sheet && <span>· {preview.source.sheet}</span>}
              {preview.confidence !== null && (
                <span>· {t("الثقة", "Confidence")} <span className="font-english tabular-nums" dir="ltr">{displayDigits(String(Math.round(preview.confidence * 100)))}%</span></span>
              )}
            </div>

            {preview.warnings.length > 0 && (
              <InlineAlert tone="warning" title={t("انتبه لهذه الملاحظات", "Read these before saving")} icon={<AlertTriangle className="h-4 w-4 text-warning" />}>
                <ul className="list-disc space-y-1 ps-4">
                  {preview.warnings.map((w, i) => <li key={i}><bdi dir="auto">{w}</bdi></li>)}
                </ul>
              </InlineAlert>
            )}

            <MetricStrip>
              <Metric label={t("البنود المقروءة", "Items read")} value={displayDigits(String(tasks.length))} />
              <Metric
                label={t("إجمالي التكلفة المخططة", "Total planned cost")}
                value={costedCount ? <LedgerFigure value={costTotal} currency={preview.project.currency} /> : "—"}
                hint={costedCount < tasks.length ? t(`${tasks.length - costedCount} بند بلا تكلفة في الملف`, `${tasks.length - costedCount} ${tasks.length - costedCount === 1 ? "item carries" : "items carry"} no cost in the file`) : undefined}
              />
              <Metric
                label={t("قيمة العقد", "Contract value")}
                value={num(form.contractValue) === null ? "—" : <LedgerFigure value={num(form.contractValue)!} currency={preview.project.currency} />}
                hint={missing.has("project.contractValue") ? t("غير موجود في الملف", "Not in the file") : undefined}
              />
              <Metric
                label={t("العميل", "Client")}
                value={<span className="block min-w-0 truncate font-sans text-base" title={clientName}><bdi dir="auto">{clientName || t("لم يُذكر", "Not stated")}</bdi></span>}
                hint={preview.client.matchedBy === "vat" ? t("مطابَق بالرقم الضريبي", "Matched by tax id")
                  : preview.client.matchedBy === "name" ? t("مطابَق بالاسم", "Matched by name")
                  : preview.client.name ? t("عميل جديد — يُنشأ عند الحفظ", "New client — created on save") : undefined}
              />
            </MetricStrip>

            {/* Project header fields */}
            <section className="space-y-3">
              <h2 className="text-section font-semibold text-foreground">{t("بيانات المشروع", "Project details")}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="intake-name">{t("اسم المشروع", "Project name")} *</Label>
                    {missing.has("project.name") && <NotInFile />}
                  </span>
                  <Input id="intake-name" data-testid="intake-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="intake-code">{t("الرمز", "Code")}</Label>
                  <Input id="intake-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" className="font-english" placeholder="PRJ-0001" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="intake-contract">{t("قيمة العقد", "Contract value")}</Label>
                    {missing.has("project.contractValue") && <NotInFile />}
                  </span>
                  <Input id="intake-contract" data-testid="intake-contract" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: normalizeDigits(e.target.value) })} inputMode="decimal" dir="ltr" className="font-english" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Label>{t("تاريخ البداية", "Start date")}</Label>
                    {missing.has("project.startDate") && <NotInFile />}
                  </span>
                  <DateInput value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} inputClassName="" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Label>{t("تاريخ النهاية", "End date")}</Label>
                    {missing.has("project.endDate") && <NotInFile />}
                  </span>
                  <DateInput value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} inputClassName="" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="intake-client">{t("العميل", "Client")}</Label>
                    {missing.has("client.name") && <NotInFile />}
                  </span>
                  <Input id="intake-client" data-testid="intake-client" value={clientName} onChange={(e) => { setClientName(e.target.value); if (clientMode === "none" && e.target.value.trim()) setClientMode("new"); }} />
                  <p className="text-[11px] text-muted-foreground">
                    {clientMode === "existing"
                      ? t("مربوط بجهة اتصال قائمة — لن يُنشأ عميل جديد", "Linked to an existing contact — no new client is created")
                      : clientMode === "new"
                        ? t("سيُنشأ كعميل جديد عند الحفظ", "Will be created as a new client on save")
                        : t("اتركه فارغاً لإنشاء المشروع بلا عميل", "Leave empty to create the project without a client")}
                  </p>
                </div>
              </div>
            </section>

            {/* Proposed tasks */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-section font-semibold text-foreground">
                  {t("المهام المقترحة", "Proposed tasks")} · <span className="font-english tabular-nums">{tasks.length}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setCreateBudget(!createBudget)}
                  data-testid="intake-create-budget"
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${createBudget ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-content-secondary"}`}
                >
                  {createBudget ? t("مع ميزانية تكلفة (مسودة)", "With a draft cost budget") : t("بدون ميزانية تكلفة", "Without a cost budget")}
                </button>
              </div>

              {!tasks.length ? (
                <InlineAlert tone="warning">{t("لم يُقرأ أي بند من الملف — يمكنك إنشاء المشروع وإضافة المهام يدوياً.", "No items were read from the file — you can still create the project and add tasks by hand.")}</InlineAlert>
              ) : (
                <div className="ledger-table overflow-x-auto">
                  <Table className="min-w-[880px] table-fixed text-sm">
                    <colgroup>
                      <col style={{ width: "80px" }} />
                      <col />
                      <col style={{ width: "110px" }} />
                      <col style={{ width: "160px" }} />
                      <col style={{ width: "110px" }} />
                      <col style={{ width: "150px" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">{t("رقم", "No.")}</TableHead>
                        <TableHead className="text-start">{t("البند", "Item")}</TableHead>
                        <TableHead className="text-end">{t("الكمية", "Qty")}</TableHead>
                        <TableHead className="text-end">{t("التكلفة المخططة", "Planned cost")}</TableHead>
                        <TableHead className="text-end">{t("المدة (يوم)", "Days")}</TableHead>
                        <TableHead className="text-start">{t("المصدر", "Source")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task, i) => (
                        <TableRow key={`${task.sourceRow}-${i}`} data-testid={`intake-task-${i}`}>
                          <TableCell className="truncate font-code text-xs text-content-secondary" dir="ltr">{task.itemNo || "—"}</TableCell>
                          <TableCell className="truncate">
                            <Input
                              value={task.title}
                              onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                              className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell className="text-end font-english tabular-nums text-content-secondary" dir="ltr">
                            {task.quantity === null ? "—" : displayDigits(String(task.quantity))}
                          </TableCell>
                          <TableCell className="text-end">
                            <Input
                              value={task.plannedCostText}
                              onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, plannedCostText: normalizeDigits(e.target.value) } : x)))}
                              inputMode="decimal" dir="ltr"
                              placeholder={t("غير موجود", "Not in file")}
                              className="h-8 border-0 bg-transparent px-0 text-end font-english text-sm focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell className="text-end">
                            <Input
                              value={task.plannedDaysText}
                              onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, plannedDaysText: normalizeDigits(e.target.value) } : x)))}
                              inputMode="numeric" dir="ltr"
                              placeholder={t("غير موجود", "Not in file")}
                              className="h-8 border-0 bg-transparent px-0 text-end font-english text-sm focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell className="text-xs text-content-secondary">
                            {task.plannedCostSource === "cost-column"
                              ? t("عمود تكلفة", "Cost column")
                              : task.plannedCostSource === "line-amount"
                                ? t("قيمة البند (سعر بيع)", "Line amount (sale price)")
                                : <NotInFile />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {tasks.length > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-xs text-content-secondary">
                  <span>{t("مجموع التكلفة المخططة", "Total planned cost")}</span>
                  <span className="font-english tabular-nums text-foreground" dir="ltr" data-testid="intake-cost-total">{money(costTotal)} {preview.project.currency}</span>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── 3 · result ────────────────────────────────────────────────── */}
        {step === "result" && created && (
          <div className="space-y-5">
            <InlineAlert tone="success" title={t("تم إنشاء المشروع", "Project created")} icon={<CheckCircle2 className="h-4 w-4 text-success" />}>
              <bdi dir="auto">{created.name}</bdi>
            </InlineAlert>
            <MetricStrip>
              <Metric label={t("المهام", "Tasks")} value={displayDigits(String(created.taskCount))} />
              <Metric label={t("ميزانية التكلفة", "Cost budget")} value={<span className="block min-w-0 truncate font-sans text-base">{createBudget ? t("مسودة — تنتظر اعتماد المحاسب", "Draft — awaiting accountant approval") : t("لم تُنشأ", "Not created")}</span>} />
              <Metric
                label={t("العميل", "Client")}
                value={<span className="block min-w-0 truncate font-sans text-base" title={created.contactName || clientName}><bdi dir="auto">{created.contactName || clientName || t("بدون عميل", "None")}</bdi></span>}
                hint={created.contactName ? t("عميل جديد أُنشئ الآن", "Newly created client") : undefined}
              />
              <Metric label={t("المصدر", "Source")} value={<span className="block min-w-0 truncate font-sans text-base" title={preview?.source.fileName || undefined}><bdi dir="auto">{preview?.source.fileName || "—"}</bdi></span>} />
            </MetricStrip>
            <p className="flex items-center gap-2 text-xs text-content-secondary">
              <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              {t("الملف مرتبط بالمشروع كمصدر — تقدر ترجع له من صفحة المشروع.", "The source file is recorded on the project — you can trace back to it from the project page.")}
            </p>
          </div>
        )}
      </div>
    </FullPageForm>
  );
}
