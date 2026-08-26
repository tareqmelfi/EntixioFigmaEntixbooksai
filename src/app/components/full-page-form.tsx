/**
 * FullPageForm · replaces the entire main content area while editing.
 *
 * Product requirement: "يجب ان يفتح الصفحة كاملة وليست جانبية ولا منبثقة"
 * Pattern: when editing/creating, the form takes ALL content area · table is hidden.
 * Click X (top-end corner) returns to the list view.
 *
 * Same pattern as Wafeq's "فاتورة جديدة" page (screenshots in conversation).
 *
 * Usage:
 *   {createOpen ? (
 *     <FullPageForm title="فاتورة جديدة" subtitle="..." onClose={...} footer={<>...</>}>
 *       {form fields}
 *     </FullPageForm>
 *   ) : (
 *     <>{KPI cards} {Table}</>
 *   )}
 *
 * Draft protection (CEO 2026-08-25 · "never lose what I typed"):
 *   pass `draft={useFormDraft(...)}` → the form
 *   - shows «استُعيدت مسودة» with a Discard action when a draft was restored,
 *   - shows an autosave indicator,
 *   - intercepts X / Esc / in-app navigation / browser back while dirty with an
 *     INLINE bar (UX-1 · no dialogs) — the draft is already saved either way,
 *   - never blocks leaving: the draft is flushed on the way out + a toast says so (2026-08-26).
 */
import { useCallback, useEffect, useRef, ReactNode } from "react";
import { useLocation } from "react-router";
import { X, Save, RotateCcw } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { formatDraftTime, type FormDraftState } from "../lib/form-draft";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode; // required · place action buttons here (Save / Approve / Send)
  /** Optional toolbar row right under the header for filters/tabs/etc. */
  toolbar?: ReactNode;
  /** Disable Esc-to-close (e.g. while busy/saving). */
  disableEscape?: boolean;
  /** Draft state from useFormDraft · enables the unsaved-changes guards + banner. */
  draft?: FormDraftState;
}

export function FullPageForm({ title, subtitle, onClose, children, footer, toolbar, disableEscape, draft }: Props) {
  const { t } = useLanguage();
  const dirty = !!draft?.dirty;

  // Leaving NEVER blocks (CEO 2026-08-26: «لما طلعت أضغط على أي شي علّق»). The draft
  // is written on the way out and a toast says so; reopening the form restores it.
  const keepDraftToast = useCallback(() => {
    if (!dirty) return;
    draft?.flush?.();
    try { window.dispatchEvent(new CustomEvent("entix:toast", { detail: { kind: "info", message: t("حُفظت مسودتك تلقائيًا — ترجع لها عند فتح النموذج", "Your draft was saved — it comes back when you reopen the form") } })); } catch { /* ignore */ }
  }, [dirty, draft, t]);
  const requestClose = useCallback(() => { keepDraftToast(); onClose(); }, [keepDraftToast, onClose]);

  // Esc closes the form
  useEffect(() => {
    if (disableEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose, disableEscape]);

  // In-app navigation (sidebar · Back) while dirty → keep the draft, say so, let it through.
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const toastRef = useRef(keepDraftToast); toastRef.current = keepDraftToast;
  const location = useLocation();
  const firstPath = useRef(location.pathname + location.search);
  useEffect(() => {
    const here = location.pathname + location.search;
    if (here !== firstPath.current) { toastRef.current(); firstPath.current = here; }
  }, [location.pathname, location.search]);
  useEffect(() => () => { if (dirtyRef.current) toastRef.current(); }, []);

  return (
    <div className="-m-4 sm:-m-6 min-h-[calc(100vh-4rem)] flex flex-col bg-canvas relative">
      {/* Header bar · NOT sticky · scrolls with content (fixes banner-cover bug) */}
      <div className="bg-surface border-b border-border flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={requestClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors flex-shrink-0"
              aria-label="إغلاق وعودة للقائمة"
              title="إغلاق (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-section font-semibold text-foreground truncate">{title}</h1>
              {subtitle && <p className="text-muted-foreground text-xs mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {/* Header must stay clean: actions are ONLY in the bottom bar · the draft indicator is passive */}
          {draft && (dirty || draft.savedAt) && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-english" aria-live="polite">
              <Save className="h-3.5 w-3.5" />
              {draft.savedAt
                ? t(`مسودة محفوظة تلقائيًا · ${formatDraftTime(draft.savedAt, "ar")}`, `Draft autosaved · ${formatDraftTime(draft.savedAt, "en")}`)
                : t("تغييرات غير محفوظة", "Unsaved changes")}
            </div>
          )}
        </div>
        {toolbar && (
          <div className="px-4 sm:px-6 lg:px-8 py-2 border-t border-border bg-surface-subtle">
            {toolbar}
          </div>
        )}
        {/* Restored-draft banner · inline · dismiss = discard (back to the clean form) */}
        {draft?.restored && (
          <div className="px-4 sm:px-6 lg:px-8 py-2 border-t border-border bg-warning-subtle/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <RotateCcw className="h-4 w-4 text-warning flex-shrink-0" />
              <span>
                {t(`استعدنا مسودة لم تُحفظ (${formatDraftTime(draft.restored, "ar")}) — أكمل من حيث توقفت.`,
                   `We restored an unsaved draft (${formatDraftTime(draft.restored, "en")}) — continue where you left off.`)}
              </span>
            </div>
            <button type="button" onClick={draft.discard} className="text-xs font-medium text-muted-foreground hover:text-danger underline-offset-2 hover:underline">
              {t("تجاهل المسودة والبدء من جديد", "Discard draft and start fresh")}
            </button>
          </div>
        )}
      </div>

      {/* Body · normal flow · no overflow trap */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>

      {/* Footer bar · sticky at bottom · contains action buttons */}
      <div className="sticky bottom-0 bg-surface border-t border-border z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}
