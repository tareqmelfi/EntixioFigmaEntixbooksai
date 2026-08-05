/**
 * AuthGuard
 *
 * UX-bug fix: previously redirected to /login on every page load because the
 * initial `isAuthenticated` was false while the session check was still in flight.
 * That caused a flash of the login screen on every refresh.
 *
 * Fix: while `state.loading === true`, render a transparent placeholder
 * (NOT a redirect). Only after the session check completes do we decide
 * authenticated → render children, OR unauthenticated → redirect.
 *
 * Also: persist last-checked auth result in sessionStorage to skip the loader
 * on subsequent same-tab refreshes (optimistic boot — no flash at all).
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { authStore } from "./auth-store";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageContext";

// localStorage (NOT sessionStorage) so the hint survives across tabs and browser restarts.
// The hint is just a UX nicety — the auth-store still revalidates the actual session
// in the background and revokes if the cookie is gone or expired.
const HINT_KEY = "entix_auth_hint";
const HINT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days · same as better-auth session

interface Hint { ok: boolean; ts: number }

function hasLocalQaAuthBypass(): boolean {
  if (!(import.meta.env.DEV && import.meta.env.VITE_QA_AUTH_BYPASS === "1")) return false;
  if (typeof window === "undefined") return false;

  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  const params = new URLSearchParams(window.location.search);
  return localHosts.has(window.location.hostname) && params.get("__qa_auth") === "1";
}

function readHint(): boolean {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(HINT_KEY) : null;
    if (!raw) return false;
    const h: Hint = JSON.parse(raw);
    if (!h.ok) return false;
    if (Date.now() - h.ts > HINT_TTL_MS) return false;
    return true;
  } catch { return false; }
}

function writeHint(value: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    if (value) localStorage.setItem(HINT_KEY, JSON.stringify({ ok: true, ts: Date.now() } as Hint));
    else localStorage.removeItem(HINT_KEY);
  } catch {}
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(authStore.getState());
  const location = useLocation();
  const optimistic = readHint();
  const localQaAuthBypass = hasLocalQaAuthBypass();

  useEffect(() => {
    return authStore.subscribe((s) => {
      setState(s);
      // Cache result for next refresh — avoids login-flash entirely
      if (!s.loading) writeHint(s.isAuthenticated);
    });
  }, []);

  if (localQaAuthBypass) return <>{children}</>;

  // 1. Session check still running → show loading spinner.
  // SECURITY: Do NOT render children optimistically. The previous user's
  // localStorage could cause pages to fetch and render another user's data
  // before the server confirms the current session.
  if (state.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1276E3] border-t-transparent" />
      </div>
    );
  }

  // 2. Check finished, not authenticated → redirect, but REMEMBER where the user was
  // so the login page can return them after sign-in (instead of dumping at /app default).
  if (!state.isAuthenticated) {
    const fromPath = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from: fromPath }} />;
  }

  // 3. Authenticated BUT account deletion is pending → the whole app swaps
  // for the restore screen. Cancelling clears the flag and the user comes
  // back to a fully intact account (30-day recovery window).
  if (state.user?.deletionRequestedAt) {
    return <AccountRestoreScreen requestedAt={state.user.deletionRequestedAt} />;
  }

  // 4. Authenticated → render
  return <>{children}</>;
}

/** Full-screen recovery prompt shown while account deletion is pending. */
function AccountRestoreScreen({ requestedAt }: { requestedAt: string }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = new Date(requestedAt);
  const purgeAfter = new Date(requested.getTime() + 30 * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil((purgeAfter.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.meCancelDeletion();
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || t("تعذّر الاسترداد — حاول مجدداً", "Could not restore — try again"));
      setBusy(false);
    }
  };

  const signOut = async () => {
    await authStore.logout();
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F7F9FC] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#DEE4EF] bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-red-50 flex items-center justify-center text-xl">⚠️</div>
          <div>
            <h1 className="text-foreground" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {t("حسابك مجدول للحذف", "Your account is scheduled for deletion")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("طُلب في", "Requested on")} <span className="font-english" dir="ltr">{requested.toISOString().slice(0, 10)}</span>
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground/80 leading-6">
          {t(
            "كل شيء محفوظ كما هو — الشركات والفواتير والمصروفات. سجّلت دخولك خلال مهلة الاسترداد، لذلك تقدر تلغي الحذف الآن وتستعيد حسابك كاملاً.",
            "Everything is exactly as you left it — companies, invoices, expenses. You signed in during the recovery window, so you can cancel the deletion now and restore your account fully.",
          )}
        </p>

        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {t("إن لم تلغِ، يُحذف الحساب نهائياً في", "If you don't cancel, the account is permanently deleted on")}{" "}
          <span className="font-english font-semibold" dir="ltr">{purgeAfter.toISOString().slice(0, 10)}</span>
          {" "}({t("متبقّي", "left")} <span className="font-english font-semibold">{daysLeft}</span> {t("يوم", "days")}).
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="space-y-2">
          <button
            onClick={restore}
            disabled={busy}
            className="w-full rounded-lg bg-[#1276E3] px-4 py-3 text-sm font-bold text-white hover:bg-[#0F66C7] disabled:opacity-60"
          >
            {busy ? t("يُستعاد…", "Restoring…") : t("استرداد الحساب · إلغاء الحذف", "Restore account · cancel deletion")}
          </button>
          <button
            onClick={signOut}
            className="w-full rounded-lg border border-[#DEE4EF] px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            {t("تسجيل الخروج — أريد المتابعة مع الحذف", "Sign out — I want to proceed with deletion")}
          </button>
        </div>
      </div>
    </div>
  );
}
