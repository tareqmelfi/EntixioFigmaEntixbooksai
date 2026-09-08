/**
 * SPEC-05 §5 · «البنود / المهام» — the project's executable items with the
 * pipeline the CEO asked for: «pipeline لكل مهمة بالوقت والتكلفة».
 *
 * Each row shows the planned cost ceiling, the ACTUAL cost the API summed from
 * the expenses / bill lines / purchase orders tagged with the task, the progress
 * bar, and one colour:
 *   🟢 ضمن الحدود (≤80% وفي الوقت) · 🟡 اقترب (80–100%) · 🔴 تجاوز أو متأخر.
 *
 * There is no sale price and no margin anywhere on this surface — the API does
 * not send one to a non-financial role, and this component never asks for one.
 *
 * UX-1: no dialogs. Adding a task is an inline row, deleting is `InlineConfirm`,
 * editing status / progress happens in place.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EmptyState, StatusBadge } from "./product";
import { InlineConfirm } from "./side-panel";
import { useLanguage } from "./LanguageContext";
import { api, ApiError, type ProjectTask, type ProjectTaskList, type TaskHealth, type TaskStatus } from "../lib/api";
import { displayLocale, displayDigits } from "../lib/number-display";
import { normalizeDigits } from "../lib/digits";

const STATUS_LABELS: Record<TaskStatus, { ar: string; en: string }> = {
  TODO: { ar: "لم تبدأ", en: "To do" },
  IN_PROGRESS: { ar: "قيد التنفيذ", en: "In progress" },
  BLOCKED: { ar: "متعثرة", en: "Blocked" },
  DONE: { ar: "منجزة", en: "Done" },
};
const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

/** The three pipeline colours · SPEC-05 §5. */
const HEALTH: Record<TaskHealth, { tone: "success" | "warning" | "critical"; ar: string; en: string }> = {
  GREEN: { tone: "success", ar: "ضمن الحدود", en: "On track" },
  AMBER: { tone: "warning", ar: "اقترب من السقف", en: "Near ceiling" },
  RED: { tone: "critical", ar: "تجاوز أو متأخر", en: "Over or late" },
};

const BAR_TONE: Record<TaskHealth, string> = {
  GREEN: "bg-success",
  AMBER: "bg-warning",
  RED: "bg-danger",
};

const toast = (kind: "success" | "error" | "info", message: string) =>
  window.dispatchEvent(new CustomEvent("entix:toast", { detail: { kind, message } }));

const EMPTY_DRAFT = { title: "", plannedCost: "", plannedDays: "", dueDate: "" };

export function ProjectTasksSection({
  projectId,
  currency = "SAR",
  onSummary,
}: {
  projectId: string;
  currency?: string;
  /** Lets the page's figures strip reflect the same numbers this section shows. */
  onSummary?: (summary: ProjectTaskList["summary"] | null) => void;
}) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<ProjectTaskList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.projects.tasks(projectId);
      setData(res);
      onSummary?.(res.summary);
    } catch {
      setData(null);
      onSummary?.(null);
    } finally {
      setLoading(false);
    }
    // onSummary is a parent callback; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const money = (v: number | string) =>
    Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const run = async (key: string, action: () => Promise<void>, ok: string, fail: string) => {
    setBusy(key);
    try { await action(); await load(); toast("success", ok); }
    catch (e: unknown) {
      const code = e instanceof ApiError ? e.message : "";
      toast("error",
        code === "budget_not_approved" ? t("اعتمد ميزانية التكلفة أولاً — المهام تُقاس على سقف معتمد", "Approve the cost budget first — tasks measure against an approved ceiling")
        : code === "budget_not_found" ? t("لا توجد ميزانية تكلفة لهذا المشروع", "This project has no cost budget")
        : code === "estimate_not_found" ? t("لا توجد دراسة تكلفة مرتبطة بهذا المشروع", "No cost study is linked to this project")
        : fail);
    }
    finally { setBusy(null); }
  };

  const fromBudget = () => run("from-budget", async () => { await api.projects.tasksFromBudget(projectId); },
    t("تم توليد المهام من بنود الميزانية", "Tasks generated from the budget lines"),
    t("تعذر توليد المهام", "Could not generate the tasks"));

  const fromEstimate = () => run("from-estimate", async () => { await api.projects.tasksFromEstimate(projectId); },
    t("تم توليد المهام من بنود الدراسة", "Tasks generated from the cost study"),
    t("تعذر توليد المهام", "Could not generate the tasks"));

  const create = () => {
    if (!draft.title.trim()) { toast("error", t("اكتب عنوان المهمة", "Give the task a title")); return; }
    return run("create", async () => {
      await api.projects.createTask(projectId, {
        title: draft.title.trim(),
        plannedCost: Number(normalizeDigits(draft.plannedCost)) || 0,
        plannedDays: draft.plannedDays ? Number(normalizeDigits(draft.plannedDays)) : null,
        dueDate: draft.dueDate || null,
      } as any);
      setDraft({ ...EMPTY_DRAFT });
      setAdding(false);
    }, t("أُضيفت المهمة", "Task added"), t("تعذر إضافة المهمة", "Could not add the task"));
  };

  const setStatus = (task: ProjectTask, status: TaskStatus) =>
    run(`status-${task.id}`, async () => { await api.tasks.update(task.id, { status } as any); },
      t("حُدّثت حالة المهمة", "Task status updated"), t("تعذر التحديث", "Could not update"));

  const setProgress = (task: ProjectTask, progressPct: number) =>
    run(`progress-${task.id}`, async () => { await api.tasks.update(task.id, { progressPct } as any); },
      t("حُدّثت نسبة الإنجاز", "Progress updated"), t("تعذر التحديث", "Could not update"));

  const remove = (task: ProjectTask) =>
    run(`delete-${task.id}`, async () => { await api.tasks.remove(task.id); setPendingDelete(null); },
      t("حُذفت المهمة · المصروفات المرتبطة لم تُحذف", "Task deleted · the spend recorded against it was not"),
      t("تعذر الحذف", "Could not delete"));

  const items = data?.items || [];
  const statusLabel = (s: TaskStatus) => (language === "ar" ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en);
  const healthLabel = (h: TaskHealth) => (language === "ar" ? HEALTH[h].ar : HEALTH[h].en);

  const counts = useMemo(() => data?.summary.byHealth || { GREEN: 0, AMBER: 0, RED: 0 }, [data]);

  return (
    <section className="space-y-3" data-testid="project-tasks">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-section font-semibold text-foreground">
            {t("البنود والمهام", "Items & tasks")}
            {items.length > 0 && <> · <span className="font-english tabular-nums">{items.length}</span></>}
          </h2>
          <p className="mt-0.5 text-xs text-content-secondary">
            {t(
              "كل بند مهمة تُقاس بالتكلفة والوقت · الفعلي يُجمَع من المصروفات وفواتير الموردين وأوامر الشراء الموسومة بالمهمة.",
              "Every item is a task measured on cost and time · the actual is summed from the expenses, supplier bills and purchase orders tagged with it.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <span className="flex items-center gap-2 text-xs" data-testid="task-health-counts">
              <span className="inline-flex items-center gap-1 text-success"><span className="h-2 w-2 rounded-full bg-success" />{displayDigits(String(counts.GREEN))}</span>
              <span className="inline-flex items-center gap-1 text-warning"><span className="h-2 w-2 rounded-full bg-warning" />{displayDigits(String(counts.AMBER))}</span>
              <span className="inline-flex items-center gap-1 text-danger"><span className="h-2 w-2 rounded-full bg-danger" />{displayDigits(String(counts.RED))}</span>
            </span>
          )}
          <Button type="button" size="sm" variant="outline" onClick={fromBudget} disabled={busy === "from-budget"} data-testid="tasks-from-budget">
            {busy === "from-budget" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("من الميزانية", "From the budget")}</>}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={fromEstimate} disabled={busy === "from-estimate"} data-testid="tasks-from-estimate">
            {busy === "from-estimate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("من الدراسة", "From the cost study")}</>}
          </Button>
          {!adding && (
            <Button type="button" size="sm" onClick={() => setAdding(true)} data-testid="task-add">
              <Plus className="me-1.5 h-3.5 w-3.5" strokeWidth={1.75} />{t("مهمة", "Task")}
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="task-form">
          <div className="min-w-0 space-y-1 xl:col-span-2">
            <Label className="text-xs text-content-secondary">{t("عنوان المهمة", "Task title")}</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t("أعمال الحفر والردم", "Excavation and backfill")} data-testid="task-title" />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-content-secondary">{t("التكلفة المخططة", "Planned cost")}</Label>
            <Input value={draft.plannedCost} onChange={(e) => setDraft({ ...draft, plannedCost: normalizeDigits(e.target.value) })} inputMode="decimal" dir="ltr" className="font-english" placeholder="25000" />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-content-secondary">{t("المدة (يوم)", "Duration (days)")}</Label>
            <Input value={draft.plannedDays} onChange={(e) => setDraft({ ...draft, plannedDays: normalizeDigits(e.target.value) })} inputMode="numeric" dir="ltr" className="font-english" placeholder="14" />
          </div>
          <div className="flex min-w-0 items-end gap-2">
            <Button type="button" size="sm" onClick={create} disabled={busy === "create"} data-testid="task-save">
              {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("حفظ", "Save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setDraft({ ...EMPTY_DRAFT }); }}>{t("إلغاء", "Cancel")}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : !items.length ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10" strokeWidth={1.5} />}
          title={t("لا توجد مهام بعد", "No tasks yet")}
          description={t("ولّدها من بنود ميزانية التكلفة المعتمدة أو من دراسة المشروع — أو أضف مهمة يدوياً.", "Generate them from the approved cost-budget lines or the cost study — or add one by hand.")}
        />
      ) : (
        <div className="ledger-table overflow-x-auto">
          <Table className="min-w-[1000px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "88px" }} />{/* رقم البند · mono */}
              <col />{/* البند · flexible */}
              <col style={{ width: "132px" }} />{/* الحالة */}
              <col style={{ width: "118px" }} />{/* التسليم */}
              <col style={{ width: "140px" }} />{/* المخطط */}
              <col style={{ width: "140px" }} />{/* الفعلي */}
              <col style={{ width: "158px" }} />{/* الإنجاز */}
              <col style={{ width: "96px" }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("رقم", "No.")}</TableHead>
                <TableHead className="text-start">{t("البند", "Item")}</TableHead>
                <TableHead className="text-start">{t("الحالة", "Status")}</TableHead>
                <TableHead className="text-start">{t("التسليم", "Due")}</TableHead>
                <TableHead className="text-end">{t("المخطط", "Planned")}</TableHead>
                <TableHead className="text-end">{t("الفعلي", "Actual")}</TableHead>
                <TableHead className="text-start">{t("المؤشر", "Pipeline")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((task) => {
                const pct = Math.max(0, Math.min(100, Number(task.progressPct) || 0));
                // NOT capped at 100 — an over-budget task must read 110%, not «100% of the ceiling».
                const costPct = task.costRatio === null ? null : Math.max(0, Math.round(task.costRatio * 100));
                return (
                  <TableRow key={task.id} data-testid={`task-row-${task.id}`} data-health={task.health}>
                    <TableCell className="truncate font-code text-xs text-content-secondary" dir="ltr">{task.itemNo || "—"}</TableCell>
                    <TableCell className="truncate">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${BAR_TONE[task.health]}`}
                          title={healthLabel(task.health)}
                          data-testid={`task-dot-${task.health}`}
                          aria-label={healthLabel(task.health)}
                        />
                        <span className="min-w-0 truncate text-foreground" title={task.title}><bdi dir="auto">{task.title}</bdi></span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <select
                        value={task.status}
                        aria-label={t("الحالة", "Status")}
                        onChange={(e) => setStatus(task, e.target.value as TaskStatus)}
                        disabled={busy === `status-${task.id}`}
                        className="h-8 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground"
                      >
                        {STATUS_ORDER.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="font-english text-xs tabular-nums" dir="ltr">
                      <span className={task.overdue ? "text-warning" : "text-muted-foreground"}>{task.dueDate?.slice(0, 10) || "—"}</span>
                    </TableCell>
                    <TableCell className="text-end font-english tabular-nums text-foreground" dir="ltr">{money(task.plannedCost)}</TableCell>
                    <TableCell
                      className={`text-end font-english tabular-nums ${task.overBudget ? "text-danger" : "text-foreground"}`}
                      dir="ltr"
                      data-testid={`task-actual-${task.id}`}
                    >{money(task.actualCost)}</TableCell>
                    <TableCell>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-center justify-between gap-2 text-[11px] text-content-secondary">
                          <StatusBadge tone={HEALTH[task.health].tone}>{healthLabel(task.health)}</StatusBadge>
                          <span className="shrink-0 font-english tabular-nums" dir="ltr">{displayDigits(String(pct))}%</span>
                        </span>
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle" role="presentation">
                          <span className={`block h-full rounded-full ${BAR_TONE[task.health]}`} style={{ width: `${pct}%` }} />
                        </span>
                        {costPct !== null && (
                          <span className="text-[11px] text-content-secondary">
                            <span className="font-english tabular-nums" dir="ltr">{displayDigits(String(costPct))}%</span> {t("من السقف", "of the ceiling")}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pendingDelete === task.id ? (
                        <InlineConfirm onConfirm={() => remove(task)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <span className="flex items-center justify-end gap-0.5">
                          {task.status !== "DONE" && (
                            <button
                              type="button"
                              onClick={() => setProgress(task, Math.min(100, pct + 25))}
                              aria-label={t("زد الإنجاز 25%", "Advance 25%")}
                              title={t("زد الإنجاز 25%", "Advance 25%")}
                              className="rounded p-1 text-content-secondary hover:text-primary"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDelete(task.id)}
                            aria-label={t("حذف", "Delete")}
                            className="rounded p-1 text-content-secondary hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data && items.length > 0 && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-xs text-content-secondary">
          <span>{t("إجمالي المخطط مقابل الفعلي", "Planned vs actual")}</span>
          <span className="font-english tabular-nums text-foreground" dir="ltr" data-testid="tasks-total">
            {money(data.summary.actualCost)} / {money(data.summary.plannedCost)} {currency}
          </span>
        </div>
      )}
    </section>
  );
}
