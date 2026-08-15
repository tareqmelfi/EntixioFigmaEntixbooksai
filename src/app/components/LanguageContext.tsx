import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { publicRouteFromWindow } from "../lib/public-route";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (ar: string, en?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const publicRoute = publicRouteFromWindow();
    if (publicRoute) return publicRoute.locale;
    if (window.location.pathname === "/") return "en";
    const saved = localStorage.getItem("entix-language");
    return saved === "ar" ? "ar" : "en";
  });

  useEffect(() => {
    const syncFromUrl = () => {
      const urlLocale = publicRouteFromWindow()?.locale;
      if (urlLocale) setLanguage(urlLocale);
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    localStorage.setItem("entix-language", language);
    // Update document lang and dir for Google Translate compatibility
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.dir = language === "ar" ? "rtl" : "ltr";
    document.body.style.fontFamily = language === "ar"
      ? "var(--entix-font-ar)"
      : "var(--entix-font-en)";
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === "ar" ? "en" : "ar");
  };

  // Simple translation function: t(arabic, english)
  const t = (ar: string, en?: string): string => {
    if (language === "en" && en) return en;
    return ar;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
