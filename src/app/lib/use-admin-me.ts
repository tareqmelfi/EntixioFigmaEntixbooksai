/**
 * useAdminMe · Admin v3 R2 — who am I inside /admin and what may I do.
 * Cached module-level (one request per session) · `can('finance.read')` drives
 * which sections/buttons render. The API enforces the same keys; the UI only
 * hides what would 403 anyway.
 */
import { useEffect, useState } from "react";
import { api, type AdminMe } from "./api";

let cached: AdminMe | null = null;
let inflight: Promise<AdminMe | null> | null = null;

export function invalidateAdminMe() { cached = null; }

export type AdminMeState = { me: AdminMe | null; loading: boolean; can: (key: string) => boolean; isSuper: boolean };

export function useAdminMe(): AdminMeState {
  const [me, setMe] = useState<AdminMe | null>(cached);
  const [loading, setLoading] = useState(!cached);
  useEffect(() => {
    if (cached) { setMe(cached); setLoading(false); return; }
    let mounted = true;
    inflight = inflight || api.admin.me().then((m) => { cached = m; return m; }).catch(() => null).finally(() => { inflight = null; });
    inflight.then((m) => { if (mounted) { setMe(m); setLoading(false); } });
    return () => { mounted = false; };
  }, []);
  const perms = new Set(me?.permissions || []);
  const isSuper = !!me?.isSuper || perms.has("*");
  return { me, loading, isSuper, can: (key) => isSuper || perms.has(key) };
}

/** Sidebar section → permission needed to see it (undefined = everyone internal). */
export const SECTION_PERMISSION: Record<string, string | undefined> = {
  overview: undefined,
  orgs: "orgs.read",
  users: "users.read",
  subscriptions: "subs.read",
  plans: "plans.read",
  support: "support.read",
  system: "system.read",
  audit: "audit.read",
  team: "team.manage",
};
