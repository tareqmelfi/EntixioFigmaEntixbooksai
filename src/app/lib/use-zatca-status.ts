import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * useZatcaStatus · per-org ZATCA Phase 2 connection state (CEO 26/08).
 *
 * One honest word per org instead of a blanket "under validation":
 *   not_connected → no CSR yet (wizard step 0)
 *   in_progress   → CSR / compliance certificate issued, production pending
 *   connected     → production CSID + certificate present (signing + chain live)
 *
 * Live submission (clearance/reporting) is a separate, platform-level switch
 * (Gate 0 · `submission: "frozen"`) — connection ≠ submission.
 *
 * Cached module-level per orgId so the header strip, the company tab and the
 * ZATCA tab never fire three requests for the same answer; an org switch is a
 * cache miss by construction (different orgId). Wizard actions call
 * `invalidateZatcaStatus()` so the header updates without a reload.
 */

export type ZatcaConnection = "not_connected" | "in_progress" | "connected";
export type ZatcaOnboardingStatus = "NONE" | "CSR_READY" | "COMPLIANCE" | "PRODUCTION";

export type ZatcaStatus = {
  loading: boolean;
  connection: ZatcaConnection;
  status: ZatcaOnboardingStatus;
  /** wizard progress 0..4 (prepare · compliance · checks · production) */
  step: number;
  submission: "frozen" | "live";
  vatConfigured: boolean;
  raw: Awaited<ReturnType<typeof api.zatca.onboarding.status>> | null;
};

const STEP: Record<ZatcaOnboardingStatus, number> = { NONE: 0, CSR_READY: 1, COMPLIANCE: 2, PRODUCTION: 4 };

function derive(raw: ZatcaStatus["raw"]): Omit<ZatcaStatus, "loading" | "raw"> {
  const status = (raw?.status || "NONE") as ZatcaOnboardingStatus;
  let step = STEP[status] ?? 0;
  if (status === "COMPLIANCE" && raw?.complianceResult?.ok) step = 3;
  const connected = status === "PRODUCTION" && !!raw?.hasCsid && !!raw?.hasCertificate;
  const connection: ZatcaConnection = connected ? "connected" : status === "NONE" ? "not_connected" : "in_progress";
  return { connection, status, step, submission: "frozen", vatConfigured: !!raw?.vatConfigured };
}

const EMPTY: ZatcaStatus = { loading: true, connection: "not_connected", status: "NONE", step: 0, submission: "frozen", vatConfigured: false, raw: null };

let cached: { orgId: string; value: ZatcaStatus } | null = null;
let inflight: Promise<ZatcaStatus> | null = null;
const listeners = new Set<() => void>();

function activeOrgId(): string {
  try { return localStorage.getItem("entix_org_id") || ""; } catch { return ""; }
}

async function load(orgId: string): Promise<ZatcaStatus> {
  let raw: ZatcaStatus["raw"] = null;
  try { raw = await api.zatca.onboarding.status(); } catch { raw = null; }
  const value: ZatcaStatus = { loading: false, raw, ...derive(raw) };
  cached = { orgId, value };
  listeners.forEach((fn) => fn());
  return value;
}

export function invalidateZatcaStatus() {
  cached = null;
  listeners.forEach((fn) => fn());
}

/** `enabled=false` (US orgs) skips the request entirely — ZATCA UI must not leak. */
export function useZatcaStatus(enabled = true): ZatcaStatus {
  const orgId = activeOrgId();
  const [state, setState] = useState<ZatcaStatus>(() => (cached && cached.orgId === orgId ? cached.value : EMPTY));

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    const sync = () => {
      if (!mounted) return;
      const id = activeOrgId();
      if (cached && cached.orgId === id) { setState(cached.value); return; }
      setState(EMPTY);
      inflight = inflight || load(id).finally(() => { inflight = null; });
    };
    listeners.add(sync);
    sync();
    return () => { mounted = false; listeners.delete(sync); };
  }, [enabled, orgId]);

  return enabled ? state : { ...EMPTY, loading: false };
}
