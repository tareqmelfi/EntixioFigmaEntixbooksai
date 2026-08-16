import { parsePublicPath, type PublicLocale } from "../public-site-manifest";

export const LANGUAGE_STORAGE_KEY = "entix-language";
export const MARKET_STORAGE_KEY = "entix-marketing-region";
export const PUBLIC_LOCATION_EVENT = "entix:public-location";

export function storedLanguage(): PublicLocale {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export function accountLocale(value: unknown): PublicLocale | null {
  if (value === "ar" || value === "en") return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().split(/[-_]/)[0];
  return normalized === "ar" || normalized === "en" ? normalized : null;
}

export function applyDocumentLocale(locale: PublicLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.style.fontFamily = locale === "ar"
    ? "var(--entix-font-ar)"
    : "var(--entix-font-en)";
}

export function canonicalPreference() {
  if (typeof window === "undefined") return null;
  const route = parsePublicPath(window.location.pathname);
  return route ? { language: route.locale, region: route.market === "sa" ? "SA" as const : "US" as const } : null;
}

function syncCanonicalPreference() {
  const preference = canonicalPreference();
  if (!preference) return;
  applyDocumentLocale(preference.language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, preference.language);
    localStorage.setItem(MARKET_STORAGE_KEY, preference.region);
  } catch { /* private mode */ }
}

if (typeof window !== "undefined" && !(window as Window & { __entixLocationPatched?: boolean }).__entixLocationPatched) {
  const notify = () => {
    syncCanonicalPreference();
    window.dispatchEvent(new Event(PUBLIC_LOCATION_EVENT));
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method].bind(history);
    history[method] = ((...args: Parameters<History[typeof method]>) => {
      original(args[0], args[1], args[2]);
      notify();
    }) as History[typeof method];
  }
  window.addEventListener("popstate", notify);
  ;(window as Window & { __entixLocationPatched?: boolean }).__entixLocationPatched = true;
}
