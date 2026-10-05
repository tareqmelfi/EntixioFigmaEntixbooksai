/**
 * The org's VAT catalogue, loaded once per session and shared by every line grid.
 *
 * Why this exists: the grid's tax dropdown was a hard-coded list of four options
 * that sent nothing to the API. The API expected a `taxRateId`, so every quote
 * saved `taxTotal = 0` and a 400 quote was sent to the client as 400 instead of
 * 460 (CEO screenshot 2026-09-08). The dropdown now offers the ORG's real rates
 * and the editors send the id.
 *
 * The fetch is cached at module level: a document editor mounts several grids and
 * a page switch should not re-ask. `refreshTaxRates()` clears it after the
 * settings page edits the catalogue.
 */
import { useEffect, useState } from "react";
import { api, getOrgId, type TaxRate } from "./api";

const cache = new Map<string, Promise<TaxRate[]>>();

export function loadTaxRates(): Promise<TaxRate[]> {
  const orgId = getOrgId();
  if (!orgId) return Promise.resolve([]);
  let pending = cache.get(orgId);
  if (!pending) {
    pending = api.taxRates.list().then(r => r.items || []).catch(() => {
      // A transient failure must not poison this company's catalogue for the session.
      if (cache.get(orgId) === pending) cache.delete(orgId);
      return [];
    });
    cache.set(orgId, pending);
  }
  return pending;
}

export function refreshTaxRates() {
  const orgId = getOrgId();
  if (orgId) cache.delete(orgId);
}

/** Fraction (0.15) → the label the CEO reads («15%»), ASCII digits, no trailing zeros. */
export function taxRatePercentLabel(rate: string | number): string {
  const pct = Number(rate) * 100;
  if (!Number.isFinite(pct)) return "0%";
  return `${Number(pct.toFixed(4))}%`;
}

/**
 * The label for the LINE GRID's tax cell — a ~90px column, so the percentage has
 * to survive truncation. The full catalogue name belongs on the settings page;
 * here the number and the inclusive/exclusive mode are what the user is choosing.
 */
export function taxRateShortLabel(rate: TaxRate, language: "ar" | "en"): string {
  if (rate.type === "EXEMPT") return language === "ar" ? "معفى" : "Exempt";
  const pct = taxRatePercentLabel(rate.rate);
  const mode = language === "ar"
    ? (rate.isInclusive ? "شامل" : "غير شامل")
    : (rate.isInclusive ? "incl." : "excl.");
  return `${pct} ${mode}`;
}

export function taxRateLabel(rate: TaxRate, language: "ar" | "en"): string {
  const name = language === "ar" ? rate.nameAr || rate.name : rate.name;
  const inclusive = language === "ar"
    ? (rate.isInclusive ? "شامل" : "غير شامل")
    : (rate.isInclusive ? "inclusive" : "exclusive");
  return `${name} · ${inclusive}`;
}

export function useTaxRates(): { rates: TaxRate[]; loading: boolean } {
  const orgId = getOrgId();
  const [result, setResult] = useState<{ orgId: string | null; items: TaxRate[] }>({ orgId, items: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setResult({ orgId, items: [] }); setLoading(true);
    loadTaxRates().then((items) => {
      if (!alive || getOrgId() !== orgId) return;
      setResult({ orgId, items });
      setLoading(false);
    });
    return () => { alive = false; };
  }, [orgId]);
  return { rates: result.orgId === orgId ? result.items : [], loading: result.orgId !== orgId || loading };
}
