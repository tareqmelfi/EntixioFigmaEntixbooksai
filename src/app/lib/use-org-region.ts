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
  /** Org base currency ("SAR" | "USD" | …) — drives every money label */
  currency: string;
  loading: boolean;
};

let cached: { orgId: string; country: string; currency: string } | null = null;

function currencyFor(country: string, base?: string | null): string {
  if (base) return base.toUpperCase();
  return country === "US" ? "USD" : "SAR";
}
let inflight: Promise<void> | null = null;

async function loadOnce(): Promise<void> {
  try {
    const orgs = await api.orgs.list();
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
    const active = (stored ? orgs.find((o) => o.id === stored) : null) || orgs[0];
    const country = (active?.country || "SA").toUpperCase();
    cached = { orgId: active?.id || "", country, currency: currencyFor(country, (active as any)?.baseCurrency) };
  } catch {
    // network hiccup → default SA (the product's home market) without blocking UI
    cached = cached || { orgId: "", country: "SA", currency: "SAR" };
  }
}

export function useOrgRegion(): OrgRegion {
  const [state, setState] = useState<OrgRegion>(() => ({
    country: cached?.country || "SA",
    isSA: (cached?.country || "SA") === "SA",
    isUS: cached?.country === "US",
    currency: cached?.currency || "SAR",
    loading: !cached,
  }));

  useEffect(() => {
    if (cached) return;
    let mounted = true;
    inflight = inflight || loadOnce().finally(() => { inflight = null; });
    inflight.then(() => {
      if (!mounted) return;
      const country = cached?.country || "SA";
      setState({ country, isSA: country === "SA", isUS: country === "US", currency: cached?.currency || "SAR", loading: false });
    });
    return () => { mounted = false; };
  }, []);

  return state;
}

/** Re-resolve on org switch (call after changing active org) */
export function invalidateOrgRegion() {
  cached = null;
}
