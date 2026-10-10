import { useEffect } from "react";
import { API_BASE_URL } from "../lib/api";
import { ROOT_LOCALE, ROOT_MARKET, localizedPath, type PublicLocale, type PublicMarket } from "../public-site-manifest";
import { Landing } from "./landing";

/**
 * Root document (`/`) — the x-default entry of the hreflang cluster.
 *
 * It renders the en-US landing itself instead of a "Taking you to your market…"
 * chooser (2026-10-10). Reasons:
 *   · PageSpeed/CrUX flagged the old root as a client-side redirect to /us/en.
 *   · GSC reported "Duplicate, Google chose different canonical" for the root
 *     because the chooser was thin content that canonicalled to itself.
 *   · Every default-audience visit (US + English browser, Googlebot, PSI) now
 *     paints real content on the first response with no redirect at all.
 *
 * Non-default audiences are still routed automatically: the API resolves
 * Cloudflare geo + browser language (Saudi + Arabic browser → /sa/ar, Saudi +
 * English → /sa/en, Arabic elsewhere → /us/ar). A previously STORED choice must
 * NOT win here (user report 2026-08-21). Network failure falls back to the
 * browser language alone. Bots/prerender (navigator.webdriver) never redirect.
 */
export function RootLanding() {
  useEffect(() => {
    if (navigator.webdriver) return;
    let cancelled = false;

    const go = (market: PublicMarket, locale: PublicLocale) => {
      if (cancelled) return;
      if (market === ROOT_MARKET && locale === ROOT_LOCALE) return; // already on the right document
      window.location.replace(localizedPath(market, locale));
    };

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/market-resolve`, {
          headers: { "Accept-Language": navigator.language || "en" },
        });
        const data = await res.json().catch(() => null);
        if (data?.market === "sa" || data?.market === "us") {
          go(data.market, data.locale === "ar" ? "ar" : "en");
          return;
        }
      } catch { /* offline/geo failure → language-only fallback below */ }
      const arabic = (navigator.language || "").toLowerCase().startsWith("ar");
      go(arabic ? "sa" : "us", arabic ? "ar" : "en");
    })();

    return () => { cancelled = true; };
  }, []);

  return <Landing />;
}

/** @deprecated kept for one release so stale imports fail loudly at type level rather than at runtime. */
export const MarketLocaleChooser = RootLanding;
