import { getOrgId } from "./api";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { readActAs } from "./act-as";

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
  // Z2.3 · an admin acting on behalf of a company has no membership → region comes from the grant.
  const act = readActAs();
  if (act && act.orgId === getOrgId()) { cached = { orgId: act.orgId, country: (act.country || "SA").toUpperCase(), currency: (act.currency || "").toUpperCase() || currencyFor((act.country || "SA").toUpperCase()) }; return; }
  try {
    const orgs = await api.orgs.list();
    const stored = getOrgId();
    const active = (stored ? orgs.find((o) => o.id === stored) : null);
    if (!active) throw new Error("active_company_unavailable");
    const country = (active.country || "").toUpperCase();
    cached = { orgId: active?.id || "", country, currency: currencyFor(country, (active as any)?.baseCurrency) };
  } catch {
    // Never invent a region or currency when the selected company is unavailable.
    cached = cached?.orgId === getOrgId() ? cached : null;
  }
}

export function useOrgRegion(): OrgRegion {
  const [state, setState] = useState<OrgRegion>(() => ({
    country: cached?.country || "",
    isSA: cached?.country === "SA",
    isUS: cached?.country === "US",
    currency: cached?.currency || "",
    loading: !cached,
  }));

  useEffect(() => {
    if (cached) return;
    let mounted = true;
    inflight = inflight || loadOnce().finally(() => { inflight = null; });
    inflight.then(() => {
      if (!mounted) return;
      const country = cached?.country || "";
      setState({ country, isSA: country === "SA", isUS: country === "US", currency: cached?.currency || "", loading: false });
    });
    return () => { mounted = false; };
  }, []);

  return state;
}

/** Re-resolve on org switch (call after changing active org) */
export function invalidateOrgRegion() {
  cached = null;
}
