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
import { api, type TaxRate } from "./api";

let cache: Promise<TaxRate[]> | null = null;

export function loadTaxRates(): Promise<TaxRate[]> {
  if (!cache) {
    cache = api.taxRates
      .list()
      .then((r) => r.items || [])
      // A failure must never blank the dropdown — the caller falls back to its
      // own static options and the user can still type a document.
      .catch(() => []);
  }
  return cache;
}

/** Forget the cached catalogue (after «الضرائب» in settings changes a rate). */
export function refreshTaxRates() {
  cache = null;
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
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    loadTaxRates().then((items) => {
      if (!alive) return;
      setRates(items);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  return { rates, loading };
}
