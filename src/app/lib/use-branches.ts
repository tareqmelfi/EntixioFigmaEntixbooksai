/**
 * useBranches · B1 (2026-08-26)
 *
 * One cached fetch of the company's branches (+ the caller's default branch)
 * shared by every form that carries the branch dimension. The cache is keyed by
 * org and invalidated on create/default-change so a quick-created branch shows
 * up everywhere at once. No dialogs · no global store.
 */
import { useCallback, useEffect, useState } from "react";
import { api, getOrgId, type Branch } from "./api";

type Snapshot = { items: Branch[]; defaultBranchId: string | null };
const cache = new Map<string, Snapshot>();
const inflight = new Map<string, Promise<Snapshot>>();
const listeners = new Set<() => void>();

function notify() { for (const l of listeners) l(); }

async function fetchBranches(orgId: string): Promise<Snapshot> {
  const cached = cache.get(orgId);
  if (cached) return cached;
  let p = inflight.get(orgId);
  if (!p) {
    p = api.branches.list().then((r) => {
      const snap = { items: r.items || [], defaultBranchId: r.defaultBranchId ?? null };
      cache.set(orgId, snap);
      return snap;
    }).finally(() => inflight.delete(orgId));
    inflight.set(orgId, p);
  }
  return p;
}

export function invalidateBranches(orgId = getOrgId()) {
  if (orgId) cache.delete(orgId);
  notify();
}

export function useBranches() {
  const orgId = getOrgId();
  const [snap, setSnap] = useState<Snapshot | null>(orgId ? cache.get(orgId) ?? null : null);
  const [loading, setLoading] = useState(!snap);

  const load = useCallback(async () => {
    if (!orgId) { setSnap({ items: [], defaultBranchId: null }); setLoading(false); return; }
    try { setSnap(await fetchBranches(orgId)); } catch { setSnap({ items: [], defaultBranchId: null }); }
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const l = () => { void load(); };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [load]);

  const create = useCallback(async (name: string) => {
    const b = await api.branches.create({ name: name.trim() });
    invalidateBranches(orgId);
    return b;
  }, [orgId]);

  const setDefault = useCallback(async (branchId: string | null) => {
    await api.branches.setDefault(branchId);
    invalidateBranches(orgId);
  }, [orgId]);

  return {
    branches: snap?.items ?? [],
    defaultBranchId: snap?.defaultBranchId ?? null,
    loading,
    create,
    setDefault,
    refresh: () => invalidateBranches(orgId),
  };
}
