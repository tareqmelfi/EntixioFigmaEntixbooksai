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
import { Navigate } from "react-router";
import { authStore } from "./auth-store";

const SESSION_HINT_KEY = "entix_auth_optimistic";

function readHint(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch { return false; }
}

function writeHint(value: boolean) {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (value) sessionStorage.setItem(SESSION_HINT_KEY, "1");
    else sessionStorage.removeItem(SESSION_HINT_KEY);
  } catch {}
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(authStore.getState());
  const optimistic = readHint();

  useEffect(() => {
    return authStore.subscribe((s) => {
      setState(s);
      // Cache result for next refresh — avoids login-flash entirely
      if (!s.loading) writeHint(s.isAuthenticated);
    });
  }, []);

  // 1. Session check still running → don't redirect, don't flash login
  if (state.loading) {
    // If we've previously confirmed the user was logged in this tab, show children optimistically.
    // The auth-store will revoke immediately if the session has actually expired.
    if (optimistic) return <>{children}</>;
    // Otherwise show a tiny inline loader (no full-screen modal)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1276E3] border-t-transparent" />
      </div>
    );
  }

  // 2. Check finished, not authenticated → redirect once
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Authenticated → render
  return <>{children}</>;
}
