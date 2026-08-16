import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Globe, MapPin } from "lucide-react";
import { useLanguage, type Language } from "./LanguageContext";
import { useMarketingRegion, type MarketingRegion } from "./marketing-region";
import { usePublicRoute } from "../lib/public-route";

const REGIONS: { id: MarketingRegion; market: "sa" | "us"; flag: string; ar: string; en: string }[] = [
  { id: "SA", market: "sa", flag: "🇸🇦", ar: "السعودية", en: "Saudi Arabia" },
  { id: "US", market: "us", flag: "🇺🇸", ar: "أمريكا", en: "United States" },
];

export function PublicPreferenceSelector({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { language, setLanguage, t } = useLanguage();
  const { region, setRegion } = useMarketingRegion();
  const publicRoute = usePublicRoute();
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() => Math.max(0, REGIONS.findIndex((item) => item.id === region)));
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const activeRegion = REGIONS.find((item) => item.id === region) ?? REGIONS[0];
  const dark = variant === "dark";
  const buttonClass = dark
    ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
    : "border-gray-100 text-foreground/80 hover:border-primary/30 hover:bg-primary/5";

  useEffect(() => {
    if (!countriesOpen) return;
    optionRefs.current[focusedIndex]?.focus();
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setCountriesOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [countriesOpen, focusedIndex]);

  const openCountries = (index = Math.max(0, REGIONS.findIndex((item) => item.id === region))) => {
    setFocusedIndex(index);
    setCountriesOpen(true);
  };

  const closeCountries = (restoreFocus = false) => {
    setCountriesOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveFocus = (delta: number) => {
    setFocusedIndex((current) => (current + delta + REGIONS.length) % REGIONS.length);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openCountries(event.key === "ArrowDown" ? Math.max(0, REGIONS.findIndex((item) => item.id === region)) : REGIONS.length - 1);
    }
  };

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeCountries(true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setFocusedIndex(event.key === "Home" ? 0 : REGIONS.length - 1);
    }
  };

  const changeLanguage = (next: Language) => {
    if (next === language) return;
    if (publicRoute.route) publicRoute.changeLocale(next);
    else setLanguage(next);
  };

  const changeRegion = (next: MarketingRegion) => {
    if (next === region) return;
    const item = REGIONS.find((candidate) => candidate.id === next)!;
    if (publicRoute.route) publicRoute.changeMarket(item.market);
    else setRegion(next);
    closeCountries(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-public-preference-selector>
      <div className="relative" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => countriesOpen ? closeCountries() : openCountries()}
          onKeyDown={handleTriggerKeyDown}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors ${buttonClass}`}
          style={{ fontSize: "13px", fontWeight: 600 }}
          aria-label={t("اختيار الدولة", "Select country")}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-expanded={countriesOpen}
        >
          <MapPin className="h-4 w-4" />
          <span>{activeRegion.flag} {t(activeRegion.ar, activeRegion.en)}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${countriesOpen ? "rotate-180" : ""}`} />
        </button>
        {countriesOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={t("اختيار الدولة", "Select country")}
            aria-activedescendant={`${listboxId}-option-${REGIONS[focusedIndex].id}`}
            onKeyDown={handleListboxKeyDown}
            className={`absolute top-full end-0 z-50 mt-2 w-[220px] overflow-hidden rounded-xl border shadow-2xl ${dark ? "border-white/10 bg-slate-900" : "border-gray-100 bg-white"}`}
          >
            <div className={`border-b px-4 py-2.5 text-xs ${dark ? "border-white/10 text-white/60" : "border-gray-50 text-muted-foreground"}`}>
              {t("المزايا والأسعار حسب الدولة", "Features & pricing by country")}
            </div>
            {REGIONS.map((item, index) => (
              <button
                ref={(element) => { optionRefs.current[index] = element; }}
                id={`${listboxId}-option-${item.id}`}
                type="button"
                role="option"
                aria-selected={item.id === region}
                tabIndex={index === focusedIndex ? 0 : -1}
                key={item.id}
                onFocus={() => setFocusedIndex(index)}
                onClick={() => changeRegion(item.id)}
                className={`flex w-full items-center gap-2.5 px-4 py-3 text-start transition-colors ${dark ? "text-white hover:bg-white/10" : "text-foreground hover:bg-gray-50"} ${item.id === region ? "bg-primary/10" : ""}`}
              >
                <span>{item.flag}</span>
                <span className="font-semibold">{t(item.ar, item.en)}</span>
                {item.id === region && <span className="ms-auto text-primary">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => changeLanguage(language === "ar" ? "en" : "ar")}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors ${buttonClass}`}
        style={{ fontSize: "13px", fontWeight: 600 }}
        aria-label={t("تغيير اللغة إلى الإنجليزية", "Switch language to Arabic")}
      >
        <Globe className="h-4 w-4" />
        <span>{language === "ar" ? "English" : "Arabic"}</span>
      </button>
    </div>
  );
}
