/**
 * MarketingRegionContext · country-based (NOT language-based) marketing split
 * Saudi visitors can browse Arabic OR English; US visitors likewise.
 * Region drives: feature emphasis (ZATCA vs Stripe/Plaid), currency, offers.
 * Persisted in localStorage("entix-marketing-region") · default "SA".
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type MarketingRegion = "SA" | "US";

interface MarketingRegionContextType {
  region: MarketingRegion;
  setRegion: (r: MarketingRegion) => void;
  isSA: boolean;
  isUS: boolean;
}

const MarketingRegionContext = createContext<MarketingRegionContextType | undefined>(undefined);

const STORAGE_KEY = "entix-marketing-region";

export function MarketingRegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<MarketingRegion>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "US" ? "US" : "SA";
    } catch {
      return "SA";
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, region); } catch { /* private mode */ }
  }, [region]);

  const setRegion = (r: MarketingRegion) => setRegionState(r);

  return (
    <MarketingRegionContext.Provider value={{ region, setRegion, isSA: region === "SA", isUS: region === "US" }}>
      {children}
    </MarketingRegionContext.Provider>
  );
}

export function useMarketingRegion() {
  const ctx = useContext(MarketingRegionContext);
  if (ctx === undefined) throw new Error("useMarketingRegion must be used within a MarketingRegionProvider");
  return ctx;
}
