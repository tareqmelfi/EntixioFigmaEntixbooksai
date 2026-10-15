import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { parsePublicPath } from "../public-site-manifest";
import { authStore } from "./auth-store";
import { displayDigits, getNumberingSystem, setNumberingSystem, NUMBERING_EVENT, NUMBERING_STORAGE_KEY, type NumberingSystem } from "../lib/number-display";
import {
  appLanguageKey,
  preferredAppLanguage,
  applyDocumentLocale,
  LANGUAGE_STORAGE_KEY,
  PUBLIC_LOCATION_EVENT,
  storedLanguage,
} from "./public-preferences";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  numberingSystem: NumberingSystem;
  setNumberingSystem: (value: NumberingSystem) => boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (ar: string, en?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function initialLanguage(): Language {
  const route = parsePublicPath(window.location.pathname);
  if (route) return route.locale;
  if (window.location.pathname === "/") return "en";
  return storedLanguage();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [numberingSystem, setNumberingState] = useState(getNumberingSystem);
  useEffect(() => {
    const sync = () => setNumberingState(getNumberingSystem());
    const onStorage = (event: StorageEvent) => { if (event.key === NUMBERING_STORAGE_KEY || event.key === null) sync(); };
    window.addEventListener(NUMBERING_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(NUMBERING_EVENT, sync); window.removeEventListener("storage", onStorage); };
  }, []);
  const [language, setLanguageState] = useState<Language>(() => {
    const initial = initialLanguage();
    applyDocumentLocale(initial);
    return initial;
  });

  const setLanguage = useCallback((next: Language) => {
    const route = parsePublicPath(window.location.pathname);
    if (route) {
      setLanguageState(route.locale);
      return;
    }
    const user = authStore.getState().user;
    const isApp = /^\/(app|admin)(\/|$)/.test(window.location.pathname);
    if (user && isApp) {
      try { localStorage.setItem(appLanguageKey(user.id), next); } catch { /* private mode */ }
    }
    // Persist before notifying subscribers so no render reads the old locale.
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* private mode */ }
    applyDocumentLocale(next);
    setLanguageState(next);
    if (isApp) void authStore.updateLocale(next);
  }, []);

  useEffect(() => {
    const syncCurrentPath = (state = authStore.getState()) => {
      const route = parsePublicPath(window.location.pathname);
      if (route) {
        setLanguageState(route.locale);
        return;
      }
      if (!/^\/(app|admin)(\/|$)/.test(window.location.pathname) || state.loading || !state.isAuthenticated) return;
      const locale = preferredAppLanguage(state.user);
      if (locale) {
        // Legacy name/number helpers must see the new locale during this render.
        try { localStorage.setItem(LANGUAGE_STORAGE_KEY, locale); } catch { /* private mode */ }
        applyDocumentLocale(locale);
        setLanguageState(locale);
      }
    };
    const syncLocation = () => syncCurrentPath();
    const syncStorage = (event: StorageEvent) => {
      const user = authStore.getState().user;
      if (user && (event.key === appLanguageKey(user.id) || event.key === null)) syncCurrentPath();
    };
    window.addEventListener("storage", syncStorage);
    window.addEventListener("popstate", syncLocation);
    window.addEventListener(PUBLIC_LOCATION_EVENT, syncLocation);
    const unsubscribe = authStore.subscribe(syncCurrentPath);
    syncCurrentPath();
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener(PUBLIC_LOCATION_EVENT, syncLocation);
      window.removeEventListener("storage", syncStorage);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* private mode */ }
    applyDocumentLocale(language);
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  const t = useCallback((ar: string, en?: string): string => {
    if (language === "en") return displayDigits(en || "");
    return displayDigits(ar || en || "");
  }, [language, numberingSystem]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, numberingSystem, setNumberingSystem }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}

/**
 * Provider-optional variant for leaf UI primitives (panels, confirms) that are
 * also rendered bare by layout contract tests. Falls back to the global-market
 * default (English) when no provider is present.
 */
export function useLanguageSafe(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context !== undefined) return context;
  return {
    language: "en",
    numberingSystem: getNumberingSystem(),
    setNumberingSystem,
    setLanguage: () => {},
    toggleLanguage: () => {},
    t: (_ar: string, en?: string) => displayDigits(en ?? _ar),
  };
}
