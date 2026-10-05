import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { useLanguage } from "./LanguageContext";
import type { FormDraftState } from "../lib/form-draft";

/** Explicit exit decisions for financial editors. No save or send on navigation. */
export function FormExitGuard({ draft, requested, onStay, onClose, onSave, disabled }: {
  draft: FormDraftState;
  requested: boolean;
  onStay: () => void;
  onClose: () => void;
  onSave: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const blocker = useBlocker(() => draft.hasChanges?.() ?? draft.dirty);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const pending = requested || blocker.state === "blocked";
  const busy = saving || disabled;

  useEffect(() => {
    if (pending) { setFailed(false); setDiscardFailed(false); region.current?.focus(); }
  }, [pending]);
  useEffect(() => {
    if (!draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!(draft.hasChanges?.() ?? draft.dirty)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);

  const stay = () => {
    if (busy) return;
    if (blocker.state === "blocked") blocker.reset();
    onStay();
  };
  const leave = () => {
    onStay();
    if (blocker.state === "blocked") blocker.proceed();
    else onClose();
  };
  const save = async () => {
    if (busy) return;
    setSaving(true); setFailed(false);
    try {
      if (await onSave()) leave();
      else setFailed(true);
    } catch { setFailed(true); }
    finally { setSaving(false); }
  };
  const discard = async () => {
    if (busy) return;
    setSaving(true); setFailed(false); setDiscardFailed(false);
    try { await draft.discard(); leave(); }
    catch { setDiscardFailed(true); }
    finally { setSaving(false); }
  };
  if (!pending) return null;
  return <div ref={region} tabIndex={-1} role="region" aria-label={t("تغييرات غير محفوظة", "Unsaved changes")} data-testid="unsaved-exit-guard" className="border-b border-warning/30 bg-warning-subtle px-4 py-3 outline-none">
    <p className="text-sm font-medium">{t("لديك تعديلات لم تُحفظ. هل تريد حفظها قبل الخروج؟", "You have unsaved changes. Save them before leaving?")}</p>
    <p className="text-xs text-muted-foreground mt-1">{t("تجاهل التعديلات يعيد النسخة المحفوظة ويحذف مسودة الاستعادة لهذا النموذج.", "Discarding returns to the saved version and removes this form’s recovery copy.")}</p>
    {failed && <p role="alert" className="text-sm text-danger mt-2">{t("لم يكتمل الحفظ. راجع البيانات وحاول مجددًا؛ تعديلاتك ما زالت هنا.", "Save did not complete. Check the form and retry; your changes are still here.")}</p>}
    {discardFailed && <p role="alert" className="text-sm text-danger mt-2">{t("تعذّر حذف نسخة الاستعادة. حاول مجددًا؛ لم نغادر النموذج.", "Could not remove the recovery copy. Retry; the form is still open.")}</p>}
    <div className="flex gap-2 flex-wrap mt-3">
      <button type="button" data-testid="unsaved-save" disabled={busy} onClick={save} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm disabled:opacity-50">{saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ والخروج", "Save and leave")}</button>
      <button type="button" data-testid="unsaved-discard" disabled={busy} onClick={discard} className="rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50">{t("تجاهل التعديلات والخروج", "Discard changes and leave")}</button>
      <button type="button" data-testid="unsaved-stay" disabled={busy} onClick={stay} className="rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50">{t("البقاء والتعديل", "Keep editing")}</button>
    </div>
  </div>;
}
