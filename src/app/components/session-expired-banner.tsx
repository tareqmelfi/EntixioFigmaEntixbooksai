/**
 * SessionExpiredBanner · shown by the app shell when any API call answers 401
 * while the user is mid-work (CEO 2026-08-25: pressing Save must never throw
 * the user out and lose the form). Non-blocking · no dialog (UX-1). The form
 * stays on screen and its draft is autosaved; signing in happens in a NEW tab
 * so nothing here is unmounted.
 */
import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { authStore } from "./auth-store";

export function SessionExpiredBanner() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener("entix:session-expired", on);
    return () => window.removeEventListener("entix:session-expired", on);
  }, []);
  // Hide again once the session is valid (user signed in from the other tab and we re-checked).
  useEffect(() => {
    if (!show) return;
    const timer = setInterval(async () => {
      try { await authStore.refresh(); if (authStore.getState().isAuthenticated) setShow(false); } catch { /* keep banner */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [show]);
  if (!show) return null;
  return (
    <div role="alert" className="flex items-center justify-between gap-3 px-4 py-2 bg-warning-subtle border-b border-warning/40 text-sm text-foreground">
      <span>
        {t("انتهت جلستك. سجّل الدخول في تبويب جديد ثم اضغط حفظ مرة أخرى — ما كتبته محفوظ كمسودة ولن يضيع.",
           "Your session expired. Sign in from a new tab, then press Save again — what you typed is kept as a draft and will not be lost.")}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <a href="/login" target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <LogIn className="h-3.5 w-3.5" /> {t("تسجيل الدخول في تبويب جديد", "Sign in in a new tab")}
        </a>
        <button type="button" onClick={() => setShow(false)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label="close"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
