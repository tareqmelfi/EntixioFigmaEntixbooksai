import { useLanguage } from "./LanguageContext";

export function useDirectionClasses() {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  return {
    dir: isRTL ? "rtl" : "ltr",
    isRTL,
    textAlign: isRTL ? "text-right" : "text-left",
  };
}
