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

// localStorage (NOT sessionStorage) so the hint survives across tabs and browser restarts.
// The hint is just a UX nicety — the auth-store still revalidates the actual session
// in the background and revokes if the cookie is gone or expired.
const HINT_KEY = "entix_auth_hint";
const HINT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days · same as better-auth session

interface Hint { ok: boolean; ts: number }

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

  useEffect(() => {
    return authStore.subscribe((s) => {
      setState(s);
      // Cache result for next refresh — avoids login-flash entirely
      if (!s.loading) writeHint(s.isAuthenticated);
    });
  }, []);

  // 1. Session check still running → don't redirect, don't flash login
  if (state.loading) {
    // If we've previously confirmed the user was logged in, show children optimistically.
    // The auth-store will revoke in the background if the session has actually expired.
    if (optimistic) return <>{children}</>;
    // Otherwise show a tiny inline loader (no full-screen modal)
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

  // 3. Authenticated → render
  return <>{children}</>;
}
