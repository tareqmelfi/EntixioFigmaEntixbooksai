import { getOrgId } from "./api";
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
export type DeviceProof = {
  orgId: string; companyName: string; vatNumber: string | null; deviceLinked: boolean;
  certificateState: "missing" | "valid" | "expired" | "not_yet_valid" | "invalid";
  certificate: { deviceName: string; issuedAt: string; expiresAt: string; fingerprint: string; issuer: string } | null;
  complianceChecksPassed: number; complianceCheckedAt: string | null; checkedAt: string;
  verificationScope: string; revocationStatus: string; submissionStatus: "frozen" | "live";
};

export type ZatcaStatus = {
  loading: boolean;
  connection: ZatcaConnection;
  status: ZatcaOnboardingStatus;
  /** wizard progress 0..4 (prepare · compliance · checks · production) */
  step: number;
  submission: "frozen" | "live";
  vatConfigured: boolean;
  raw: (Awaited<ReturnType<typeof api.zatca.onboarding.status>> & { deviceProof?: DeviceProof }) | null;
};

const STEP: Record<ZatcaOnboardingStatus, number> = { NONE: 0, CSR_READY: 1, COMPLIANCE: 2, PRODUCTION: 4 };

function derive(raw: ZatcaStatus["raw"]): Omit<ZatcaStatus, "loading" | "raw"> {
  const status = (raw?.status || "NONE") as ZatcaOnboardingStatus;
  let step = STEP[status] ?? 0;
  if (status === "COMPLIANCE" && raw?.complianceResult?.ok) step = 3;
  const connected = raw?.deviceProof?.deviceLinked === true && raw?.mode === "production" && raw?.environmentVerified === true;
  const connection: ZatcaConnection = connected ? "connected" : status === "NONE" ? "not_connected" : "in_progress";
  return { connection, status, step, submission: "frozen", vatConfigured: !!raw?.vatConfigured };
}

const EMPTY: ZatcaStatus = { loading: true, connection: "not_connected", status: "NONE", step: 0, submission: "frozen", vatConfigured: false, raw: null };

let cached: { orgId: string; value: ZatcaStatus; fetchedAt: number } | null = null;
const inflight = new Map<string, Promise<ZatcaStatus>>();
let generation = 0;
const listeners = new Set<() => void>();

function activeOrgId(): string {
  try { return getOrgId() || ""; } catch { return ""; }
}

async function load(orgId: string): Promise<ZatcaStatus> {
  const requestedGeneration = generation;
  let raw: ZatcaStatus["raw"] = null;
  try { raw = await api.zatca.onboarding.status(orgId); } catch { raw = null; }
  const value: ZatcaStatus = { loading: false, raw, ...derive(raw) };
  if (requestedGeneration === generation && orgId === activeOrgId()) cached = { orgId, value, fetchedAt: Date.now() };
  return value;
}

export function invalidateZatcaStatus() {
  generation += 1;
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
      if (!inflight.has(id)) {
        inflight.set(id, load(id).finally(() => { inflight.delete(id); listeners.forEach(fn => fn()); }));
      }
    };
    listeners.add(sync);
    sync();
    const refreshIfStale = () => { if (cached && Date.now() - cached.fetchedAt >= 55_000) invalidateZatcaStatus(); };
    const timer = window.setInterval(refreshIfStale, 60_000);
    window.addEventListener("focus", refreshIfStale);
    return () => { mounted = false; listeners.delete(sync); window.clearInterval(timer); window.removeEventListener("focus", refreshIfStale); };
  }, [enabled, orgId]);

  return !enabled ? { ...EMPTY, loading: false } : state.raw?.deviceProof && state.raw.deviceProof.orgId !== orgId ? EMPTY : state;
}
