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
 * Draft protection:
 *   - draft displays a local recovery indicator and restore/discard controls.
 *   - onSaveBeforeLeave opts into explicit save/discard/stay for close and routing.
 *   - Other editors retain their existing recovery-only navigation behavior.
 */
import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation } from "react-router";
import { FormExitGuard } from "./form-exit-guard";
import { X, Save, RotateCcw } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { formatDraftTime, type FormDraftState } from "../lib/form-draft";

interface Props {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode | ((requestClose: () => void) => ReactNode); // required · place action buttons here (Save / Approve / Send)
  /** Optional toolbar row right under the header for filters/tabs/etc. */
  toolbar?: ReactNode;
  /** Disable Esc-to-close (e.g. while busy/saving). */
  disableEscape?: boolean;
  /** Draft state from useFormDraft · enables the unsaved-changes guards + banner. */
  draft?: FormDraftState;
  /** Opt-in explicit save/discard/stay, with real persistence supplied by the editor. */
  onSaveBeforeLeave?: () => Promise<boolean>;
}

export function FullPageForm({ title, subtitle, onClose, children, footer, toolbar, disableEscape, draft, onSaveBeforeLeave }: Props) {
  const { t } = useLanguage();
  const dirty = !!draft?.dirty;
  const [closeRequested, setCloseRequested] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);
  const discardRecovery = async () => {
    if (discarding || disableEscape) return;
    setDiscarding(true); setDiscardFailed(false);
    try { await draft?.discard(); }
    catch { setDiscardFailed(true); }
    finally { setDiscarding(false); }
  };

  // Legacy editors keep recovery-only navigation; opted-in editors ask explicitly.
  const keepDraftToast = useCallback(() => {
    if (!dirty || onSaveBeforeLeave) return;
    draft?.flush?.();
    try { window.dispatchEvent(new CustomEvent("entix:toast", { detail: { kind: "info", message: t("حُفظت مسودتك تلقائيًا — ترجع لها عند فتح النموذج", "Your draft was saved — it comes back when you reopen the form") } })); } catch { /* ignore */ }
  }, [dirty, draft, t, onSaveBeforeLeave]);
  const requestClose = useCallback(() => {
    if (disableEscape) return;
    if (onSaveBeforeLeave && (draft?.hasChanges?.() ?? dirty)) { setCloseRequested(true); return; }
    keepDraftToast(); onClose();
  }, [disableEscape, onSaveBeforeLeave, draft, dirty, keepDraftToast, onClose]);

  /**
   * Esc closes the form — but only when it is the form Esc is aimed at.
   *
   * 2026-09-21: this listener sat on `document` and fired from ANY field, so
   * one Esc while typing threw away the whole new quote, and the Esc that was
   * meant to dismiss an open dropdown closed the form behind it too. Esc now
   * steps back one layer at a time: a child that handled it wins, an open
   * listbox or menu wins, a field being typed in wins (it yields focus first),
   * and only a plain Esc with nothing in the way closes the form.
   */
  useEffect(() => {
    if (disableEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // An open combobox/select/menu owns this Esc.
      if (document.querySelector('[role="listbox"], [role="menu"], [data-state="open"][role="dialog"]')) return;
      const el = document.activeElement as HTMLElement | null;
      const editing = !!el && (
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable ||
        el.getAttribute("role") === "combobox" || el.getAttribute("aria-expanded") === "true"
      );
      if (editing) { el?.blur(); return; }
      requestClose();
    };
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
    <div data-full-page-form="true" className="-m-4 sm:-mx-[40px] sm:-my-[28px] min-h-[calc(100vh-4rem)] flex flex-col bg-canvas relative">
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
                ? t(`نسخة استعادة محلية — التعديلات لم تُحفظ · ${formatDraftTime(draft.savedAt, "ar")}`, `Local recovery copy — changes not saved · ${formatDraftTime(draft.savedAt, "en")}`)
                : t("تغييرات غير محفوظة", "Unsaved changes")}
            </div>
          )}
        </div>
        {toolbar && (
          <div className="px-4 sm:px-6 lg:px-8 py-2 border-t border-border bg-surface-subtle">
            {toolbar}
          </div>
        )}
        {draft?.recoveryAt && <div data-testid="draft-recovery" className="px-4 py-3 border-t border-border bg-warning-subtle flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm">{t("توجد تعديلات محلية لم تُحفظ. المعروض الآن هو النسخة المحفوظة؛ هل تريد استعادة التعديلات؟", "Unsaved local changes are available. The saved version is shown; restore those changes?")}</p>
          <div className="flex gap-3">
            <button type="button" data-testid="draft-recover" onClick={draft.recover} className="text-sm font-medium text-primary">{t("استعادة التعديلات", "Restore changes")}</button>
            <button type="button" disabled={discarding || disableEscape} onClick={discardRecovery} className="text-sm font-medium">{t("تجاهل المسودة واستخدام المحفوظ", "Discard recovery copy and use saved version")}</button>
          </div>
        </div>}
        {discardFailed && <p role="alert" className="px-4 py-2 text-sm text-danger">{t("تعذّر حذف نسخة الاستعادة. حاول مجددًا.", "Could not remove the recovery copy. Please retry.")}</p>}
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
            <button type="button" disabled={discarding || disableEscape} onClick={discardRecovery} className="text-xs font-medium text-muted-foreground hover:text-danger underline-offset-2 hover:underline">
              {t("تجاهل المسودة والبدء من جديد", "Discard draft and start fresh")}
            </button>
          </div>
        )}
      </div>

      {/* Body · normal flow · no overflow trap */}
      <div inert={draft?.recoveryAt ? true : undefined} className="flex-1 px-4 sm:px-[40px] py-6">
        {children}
      </div>

      {/* Footer bar · sticky at bottom · contains action buttons */}
      <div className="sticky bottom-0 bg-surface border-t border-border z-10">
        {draft && onSaveBeforeLeave && <FormExitGuard draft={draft} requested={closeRequested} onStay={() => setCloseRequested(false)} onClose={onClose} onSave={onSaveBeforeLeave} disabled={disableEscape} />}
        <div inert={draft?.recoveryAt ? true : undefined} className="px-4 sm:px-6 lg:px-8 py-3">
          {typeof footer === "function" ? footer(requestClose) : footer}
        </div>
      </div>
    </div>
  );
}
