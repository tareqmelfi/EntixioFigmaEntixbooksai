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

type RegionData = { country: string; currency: string };
const cache = new Map<string, RegionData>();
const inflight = new Map<string, Promise<RegionData | undefined>>();
const region = (data?: RegionData, loading = false): OrgRegion => ({
  country: data?.country || '', currency: data?.currency || '',
  isSA: data?.country === 'SA', isUS: data?.country === 'US', loading,
});

async function loadOnce(orgId: string): Promise<RegionData | undefined> {
  try {
    const act = readActAs();
    const active = act?.orgId === orgId
      ? { country: act.country, baseCurrency: act.currency }
      : (await api.orgs.list()).find(o => o.id === orgId);
    if (!active) return undefined;
    const data = { country: (active.country || '').toUpperCase(), currency: (active.baseCurrency || '').toUpperCase() };
    cache.set(orgId, data);
    return data;
  } catch { return undefined; }
}

export function useOrgRegion(): OrgRegion {
  const orgId = getOrgId();
  const [resolved, setResolved] = useState<{ orgId: string | null; value: OrgRegion }>(() => ({ orgId, value: region(orgId ? cache.get(orgId) : undefined, !!orgId && !cache.has(orgId)) }));
  useEffect(() => {
    if (!orgId) { setResolved({ orgId, value: region() }); return; }
    const cached = cache.get(orgId);
    if (cached) { setResolved({ orgId, value: region(cached) }); return; }
    let mounted = true;
    let pending = inflight.get(orgId);
    if (!pending) {
      pending = loadOnce(orgId).finally(() => { inflight.delete(orgId); });
      inflight.set(orgId, pending);
    }
    pending.then(data => {
      if (mounted && getOrgId() === orgId) setResolved({ orgId, value: region(data) });
    });
    return () => { mounted = false; };
  }, [orgId]);
  return resolved.orgId === orgId ? resolved.value : region(undefined, !!orgId);
}

export function invalidateOrgRegion() { cache.clear(); }
