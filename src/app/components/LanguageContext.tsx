import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { parsePublicPath } from "../public-site-manifest";
import { authStore } from "./auth-store";
import {
  accountLocale,
  applyDocumentLocale,
  LANGUAGE_STORAGE_KEY,
  PUBLIC_LOCATION_EVENT,
  storedLanguage,
} from "./public-preferences";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
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
    setLanguageState(next);
    void authStore.updateLocale(next);
  }, []);

  useEffect(() => {
    const syncCurrentPath = (state = authStore.getState()) => {
      const route = parsePublicPath(window.location.pathname);
      if (route) {
        setLanguageState(route.locale);
        return;
      }
      if (!window.location.pathname.startsWith("/app") || state.loading || !state.isAuthenticated) return;
      const locale = accountLocale(state.user?.locale);
      if (locale) setLanguageState(locale);
    };
    const syncLocation = () => syncCurrentPath();
    window.addEventListener("popstate", syncLocation);
    window.addEventListener(PUBLIC_LOCATION_EVENT, syncLocation);
    const unsubscribe = authStore.subscribe(syncCurrentPath);
    syncCurrentPath();
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener(PUBLIC_LOCATION_EVENT, syncLocation);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    applyDocumentLocale(language);
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  const t = (ar: string, en?: string): string => {
    if (language === "en") return en || "";
    return ar || en || "";
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
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
    setLanguage: () => {},
    toggleLanguage: () => {},
    t: (_ar: string, en?: string) => en ?? _ar,
  };
}
