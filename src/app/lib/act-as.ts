/**
 * Open-as-admin state (Z2.3 · 2026-08-26)
 *
 * A platform admin «opens» a company from /admin/orgs/:id with a mandatory
 * reason; the grant lives in localStorage (survives the new tab the workspace
 * opens in), expires after 60 minutes, and while present every org-scoped API
 * call carries X-Admin-Org-Id so requireOrg authorises it and audit-logs it.
 * The app shell shows a red «acting on behalf of» banner with the countdown.
 */
export type ActAs = { orgId: string; orgName: string; country: string; currency: string; reason: string; until: number };
const KEY = "entix_act_as";
const listeners = new Set<() => void>();

export function readActAs(): ActAs | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as ActAs;
    if (!v?.orgId || !v.until || v.until < Date.now()) { localStorage.removeItem(KEY); return null; }
    return v;
  } catch { return null; }
}
export function startActAs(v: ActAs) { localStorage.setItem(KEY, JSON.stringify(v)); for (const l of listeners) l(); }
export function stopActAs() { localStorage.removeItem(KEY); for (const l of listeners) l(); }
export function subscribeActAs(l: () => void) { listeners.add(l); const onStorage = (e: StorageEvent) => { if (e.key === KEY) l(); }; window.addEventListener("storage", onStorage); return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); }; }
