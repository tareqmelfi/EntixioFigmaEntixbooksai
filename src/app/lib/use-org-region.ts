import { useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * useOrgRegion · active-org country → region gates (SA vs US …)
 *
 * Saudi orgs get the ZATCA surface (e-invoicing banner, integrations, taxes
 * submission). US orgs get Plaid/Stripe and US-oriented modules instead —
 * ZATCA UI must not leak into their workspace.
 *
 * The active org is cached module-level so every consumer renders instantly
 * after the first load.
 */

export type OrgRegion = {
  country: string; // ISO-ish code as stored on the org ("SA" | "US" | …)
  isSA: boolean;
  isUS: boolean;
  loading: boolean;
};

let cached: { orgId: string; country: string } | null = null;
let inflight: Promise<void> | null = null;

async function loadOnce(): Promise<void> {
  try {
    const orgs = await api.orgs.list();
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
    const active = (stored ? orgs.find((o) => o.id === stored) : null) || orgs[0];
    cached = { orgId: active?.id || "", country: (active?.country || "SA").toUpperCase() };
  } catch {
    // network hiccup → default SA (the product's home market) without blocking UI
    cached = cached || { orgId: "", country: "SA" };
  }
}

export function useOrgRegion(): OrgRegion {
  const [state, setState] = useState<OrgRegion>(() => ({
    country: cached?.country || "SA",
    isSA: (cached?.country || "SA") === "SA",
    isUS: cached?.country === "US",
    loading: !cached,
  }));

  useEffect(() => {
    if (cached) return;
    let mounted = true;
    inflight = inflight || loadOnce().finally(() => { inflight = null; });
    inflight.then(() => {
      if (!mounted) return;
      const country = cached?.country || "SA";
      setState({ country, isSA: country === "SA", isUS: country === "US", loading: false });
    });
    return () => { mounted = false; };
  }, []);

  return state;
}

/** Re-resolve on org switch (call after changing active org) */
export function invalidateOrgRegion() {
  cached = null;
}
