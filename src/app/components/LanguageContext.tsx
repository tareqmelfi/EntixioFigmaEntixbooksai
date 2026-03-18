import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (ar: string, en?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("entix-language");
    return (saved === "en" ? "en" : "ar") as Language;
  });

  useEffect(() => {
    localStorage.setItem("entix-language", language);
    // Update document lang and dir for Google Translate compatibility
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    
    // Update body font
    document.body.style.fontFamily = language === "ar" 
      ? "'Noto Sans Arabic', sans-serif" 
      : "'Inter', sans-serif";
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