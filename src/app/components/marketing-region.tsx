/** Country-based marketing split, independent from language. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { marketRegion, parsePublicPath } from "../public-site-manifest";
import { MARKET_STORAGE_KEY, PUBLIC_LOCATION_EVENT } from "./public-preferences";

export type MarketingRegion = "SA" | "US";

interface MarketingRegionContextType {
  region: MarketingRegion;
  setRegion: (region: MarketingRegion) => void;
  isSA: boolean;
  isUS: boolean;
}

const MarketingRegionContext = createContext<MarketingRegionContextType | undefined>(undefined);

function initialRegion(): MarketingRegion {
  const route = parsePublicPath(window.location.pathname);
  if (route) return marketRegion(route.market);
  try {
    return localStorage.getItem(MARKET_STORAGE_KEY) === "SA" ? "SA" : "US";
  } catch {
    return "US";
  }
}

export function MarketingRegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<MarketingRegion>(initialRegion);
  const setRegion = useCallback((next: MarketingRegion) => {
    const route = parsePublicPath(window.location.pathname);
    setRegionState(route ? marketRegion(route.market) : next);
  }, []);

  useEffect(() => {
    const syncCanonicalRoute = () => {
      const route = parsePublicPath(window.location.pathname);
      if (route) setRegionState(marketRegion(route.market));
    };
    window.addEventListener("popstate", syncCanonicalRoute);
    window.addEventListener(PUBLIC_LOCATION_EVENT, syncCanonicalRoute);
    return () => {
      window.removeEventListener("popstate", syncCanonicalRoute);
      window.removeEventListener(PUBLIC_LOCATION_EVENT, syncCanonicalRoute);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(MARKET_STORAGE_KEY, region); } catch { /* private mode */ }
  }, [region]);

  return (
    <MarketingRegionContext.Provider value={{ region, setRegion, isSA: region === "SA", isUS: region === "US" }}>
      {children}
    </MarketingRegionContext.Provider>
  );
}

export function useMarketingRegion() {
  const context = useContext(MarketingRegionContext);
  if (context === undefined) throw new Error("useMarketingRegion must be used within a MarketingRegionProvider");
  return context;
}
