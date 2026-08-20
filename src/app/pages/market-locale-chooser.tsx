import { useEffect } from "react";
import { Link } from "react-router";
import { EntixWordmark } from "../components/entix-brand";
import { API_BASE_URL } from "../lib/api";
import { LANGUAGE_STORAGE_KEY, MARKET_STORAGE_KEY } from "../components/public-preferences";
import { localizedPath, type PublicLocale, type PublicMarket } from "../public-site-manifest";

/**
 * The marketing root no longer asks visitors to pick a market — it resolves
 * automatically and replaces the history entry so Back never returns here:
 *  1. An explicit stored preference (a previous market/language choice) wins.
 *  2. Otherwise the API resolves Cloudflare geo + browser language
 *     (Saudi Arabia + Arabic → /sa/ar · everywhere else → /us/en).
 *  3. Network failure falls back to the browser language alone.
 * Bots/prerender (navigator.webdriver) are NOT redirected — they get the
 * static links below so every canonical page stays crawlable.
 */
export function MarketLocaleChooser() {
  useEffect(() => {
    if (navigator.webdriver) return;
    let cancelled = false;

    const go = (market: PublicMarket, locale: PublicLocale) => {
      if (cancelled) return;
      window.location.replace(localizedPath(market, locale));
    };

    try {
      const market = localStorage.getItem(MARKET_STORAGE_KEY);
      const locale = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if ((market === "SA" || market === "US") && (locale === "ar" || locale === "en")) {
        go(market === "SA" ? "sa" : "us", locale);
        return;
      }
    } catch { /* private mode */ }

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

  return (
    <main data-page="market-locale-chooser" className="min-h-screen bg-white px-5 py-14" dir="ltr">
      <div className="mx-auto max-w-4xl">
        <div className="flex justify-center"><EntixWordmark size={42} /></div>
        <p className="mt-10 text-center text-sm font-medium text-slate-500">
          Taking you to your market… · جاري تحويلك لسوقك…
        </p>
        <div className="mt-8 flex justify-center gap-3 text-sm font-semibold">
          <Link to={localizedPath("sa", "ar")} className="rounded-xl border border-slate-200 px-5 py-3 text-slate-900 transition hover:border-primary hover:bg-primary/5">
            السعودية — العربية
          </Link>
          <Link to={localizedPath("us", "en")} className="rounded-xl border border-slate-200 px-5 py-3 text-slate-900 transition hover:border-primary hover:bg-primary/5">
            United States — English
          </Link>
        </div>
      </div>
    </main>
  );
}
