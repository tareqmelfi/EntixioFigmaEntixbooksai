import { useState, useRef, useEffect } from "react";
import {
  Search, Plus, X, Building2, User, Globe, MapPin,
  ExternalLink, AlertTriangle
} from "lucide-react";
import { useContacts, type Party, type RoleType, type EntityLocation, ROLE_LABELS } from "./contacts-store";
import { useLanguage } from "./LanguageContext";
import { BidiText } from "./bidi-text";

// ── Countries ──
const countries = [
  { code: "SA", name: { ar: "المملكة العربية السعودية", en: "Saudi Arabia" }, currency: "SAR", flag: "🇸🇦" },
  { code: "US", name: { ar: "الولايات المتحدة", en: "United States" }, currency: "USD", flag: "🇺🇸" },
  { code: "GB", name: { ar: "المملكة المتحدة", en: "United Kingdom" }, currency: "GBP", flag: "🇬🇧" },
  { code: "AE", name: { ar: "الإمارات العربية المتحدة", en: "United Arab Emirates" }, currency: "AED", flag: "🇦🇪" },
  { code: "EG", name: { ar: "مصر", en: "Egypt" }, currency: "EGP", flag: "🇪🇬" },
  { code: "DE", name: { ar: "ألمانيا", en: "Germany" }, currency: "EUR", flag: "🇩🇪" },
  { code: "FR", name: { ar: "فرنسا", en: "France" }, currency: "EUR", flag: "🇫🇷" },
  { code: "JP", name: { ar: "اليابان", en: "Japan" }, currency: "JPY", flag: "🇯🇵" },
  { code: "CN", name: { ar: "الصين", en: "China" }, currency: "CNY", flag: "🇨🇳" },
  { code: "IN", name: { ar: "الهند", en: "India" }, currency: "INR", flag: "🇮🇳" },
];

const withholdingClassifications = [
  { ar: "خدمات تقنية", en: "IT services" },
  { ar: "تراخيص برمجية", en: "Software licenses" },
  { ar: "خدمات سحابية", en: "Cloud services" },
  { ar: "استشارات", en: "Consulting" },
  { ar: "خدمات إدارية", en: "Administrative services" },
  { ar: "خدمات مالية", en: "Financial services" },
  { ar: "خدمات تسويقية", en: "Marketing services" },
  { ar: "إيجارات", en: "Rentals" },
  { ar: "أخرى", en: "Other" },
];

interface ContactSearchInputProps {
  value: string;
  onChange: (name: string, partyId?: string) => void;
  onCreate?: (name: string, data: {
    entityLocation: EntityLocation;
    type: "organization" | "person";
    nameEn?: string;
    country: string;
    currency: string;
    taxNumber?: string;
    commercialReg?: string;
    itn?: string;
    leiCode?: string;
    licenseNumber?: string;
    withholdingTaxRate?: number;
    transactionClassification?: string;
    email?: string;
    phone?: string;
  }) => Promise<{ id: string; name?: string; displayName?: string } | null | void>;
  roleFilter?: RoleType;
  placeholder?: string;
  label?: string;
}

export function ContactSearchInput({
  value,
  onChange,
  onCreate,
  roleFilter,
  placeholder,
  label,
}: ContactSearchInputProps) {
  const { t } = useLanguage();
  const { searchParties, addParty, getPartyByName } = useContacts();
  const resolvedPlaceholder = placeholder ?? t("اكتب اسم العميل أو المورد...", "Type a customer or supplier name...");
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Quick-create form state
  const [qcEntityLocation, setQcEntityLocation] = useState<EntityLocation>("local");
  const [qcType, setQcType] = useState<"organization" | "person">("organization");
  const [qcNameEn, setQcNameEn] = useState("");
  const [qcCountry, setQcCountry] = useState("SA");
  const [qcCurrency, setQcCurrency] = useState("SAR");
  const [qcTaxNumber, setQcTaxNumber] = useState("");
  const [qcCommercialReg, setQcCommercialReg] = useState("");
  const [qcItn, setQcItn] = useState("");
  const [qcLeiCode, setQcLeiCode] = useState("");
  const [qcLicense, setQcLicense] = useState("");
  const [qcWithholdingRate, setQcWithholdingRate] = useState(5);
  const [qcTransClass, setQcTransClass] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcPhone, setQcPhone] = useState("");

  const results = searchParties(query, roleFilter).slice(0, 8);
  const hasExactMatch = results.some((p) => p.name === query || p.nameEn === query);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync value prop
  useEffect(() => { setQuery(value); }, [value]);

  const handleSelect = (party: Party) => {
    setQuery(party.name);
    onChange(party.name, party.id);
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    setIsOpen(true);
    setHighlightIndex(-1);
    // If exact match exists, auto-select
    const match = getPartyByName(val);
    if (match) {
      onChange(match.name, match.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, results.length)); // +1 for "add new" option
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        handleSelect(results[highlightIndex]);
      } else if (query.trim() && !hasExactMatch) {
        // Quick create with just the name
        openQuickCreate();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const openQuickCreate = () => {
    setShowQuickCreate(true);
    setIsOpen(false);
    setQcEntityLocation("local");
    setQcType("organization");
    setQcNameEn("");
    setQcCountry("SA");
    setQcCurrency("SAR");
    setQcTaxNumber("");
    setQcCommercialReg("");
    setQcItn("");
    setQcLeiCode("");
    setQcLicense("");
    setQcWithholdingRate(5);
    setQcTransClass("");
    setQcEmail("");
    setQcPhone("");
  };

  const handleQuickCreate = async () => {
    if (onCreate) {
      const created = await onCreate(query.trim(), {
        entityLocation: qcEntityLocation,
        type: qcType,
        nameEn: qcNameEn || undefined,
        country: qcCountry,
        currency: qcCurrency,
        taxNumber: qcEntityLocation === "local" ? qcTaxNumber || undefined : undefined,
        commercialReg: qcEntityLocation === "local" ? qcCommercialReg || undefined : undefined,
        itn: qcEntityLocation === "foreign" ? qcItn || undefined : undefined,
        leiCode: qcLeiCode || undefined,
        licenseNumber: qcLicense || undefined,
        withholdingTaxRate: qcEntityLocation === "foreign" ? qcWithholdingRate : undefined,
        transactionClassification: qcEntityLocation === "foreign" ? qcTransClass || undefined : undefined,
        email: qcEmail || undefined,
        phone: qcPhone || undefined,
      });
      if (created) {
        setQuery(created.displayName ?? created.name ?? query.trim());
        onChange(created.displayName ?? created.name ?? query.trim(), created.id);
        setShowQuickCreate(false);
        return;
      }
    }
    const defaultRole: RoleType = roleFilter || "عميل";
    const country = countries.find((c) => c.code === qcCountry);
    const newParty = addParty({
      name: query.trim(),
      nameEn: qcNameEn || undefined,
      type: qcType,
      roles: [defaultRole],
      email: qcEmail,
      phone: qcPhone,
      taxNumber: qcEntityLocation === "local" ? qcTaxNumber || undefined : undefined,
      commercialReg: qcEntityLocation === "local" ? qcCommercialReg || undefined : undefined,
      address: "",
      netBalance: 0,
      entityLocation: qcEntityLocation,
      country: qcCountry,
      currency: qcCurrency || country?.currency || "SAR",
      itn: qcEntityLocation === "foreign" ? qcItn || undefined : undefined,
      leiCode: qcLeiCode || undefined,
      licenseNumber: qcLicense || undefined,
      withholdingTaxRate: qcEntityLocation === "foreign" ? qcWithholdingRate : undefined,
      transactionClassification: qcEntityLocation === "foreign" ? qcTransClass || undefined : undefined,
    });
    setQuery(newParty.name);
    onChange(newParty.name, newParty.id);
    setShowQuickCreate(false);
  };

  const handleLocationChange = (loc: EntityLocation) => {
    setQcEntityLocation(loc);
    if (loc === "local") {
      setQcCountry("SA");
      setQcCurrency("SAR");
    } else {
      setQcCountry("US");
      setQcCurrency("USD");
    }
  };

  const selectedParty = getPartyByName(query);

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm text-foreground/80 mb-1.5" style={{ fontWeight: 500 }}>{label}</label>}

      {/* Input */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          dir="auto"
          className="w-full rounded-lg border border-border bg-white py-2.5 ps-10 pe-10 text-start text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); onChange(""); inputRef.current?.focus(); }}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selected party badge */}
      {selectedParty && !isOpen && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {selectedParty.entityLocation === "foreign" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800" style={{ fontWeight: 500 }}>
              <Globe className="h-3 w-3" />{countries.find((c) => c.code === selectedParty.country)?.flag} {t("كيان أجنبي", "Foreign entity")} — {selectedParty.currency}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-800" style={{ fontWeight: 500 }}>
              🇸🇦 {t("محلي", "Local")}
            </span>
          )}
          {selectedParty.taxNumber && <span className="font-english">{t("ض:", "VAT:")} {selectedParty.taxNumber.slice(0, 6)}...</span>}
          {selectedParty.leiCode && (
            <a
              href={`https://search.gleif.org/#/record/${selectedParty.leiCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              LEI <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {selectedParty.entityLocation === "foreign" && selectedParty.withholdingTaxRate && (
            <span className="inline-flex items-center gap-1 text-amber-500">
              <AlertTriangle className="h-3 w-3" /> {t("استقطاع", "WHT")} {selectedParty.withholdingTaxRate}%
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-white shadow-lg overflow-hidden"
          style={{ maxHeight: "320px" }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: "280px" }}>
            {results.length > 0 ? (
              results.map((party, i) => (
                <button
                  key={party.id}
                  onClick={() => handleSelect(party)}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={`w-full text-start px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    highlightIndex === i ? "bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    party.type === "organization" ? "bg-blue-100" : "bg-primary/5"
                  }`}>
                    {party.type === "organization" ? (
                      <Building2 className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex min-w-0 items-start gap-2">
                      <BidiText compact className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground" title={party.name}>{party.name}</BidiText>
                      {party.nameEn && <BidiText compact className="max-w-[45%] text-xs leading-5 text-muted-foreground/60" title={party.nameEn}>{party.nameEn}</BidiText>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {party.entityLocation === "foreign" ? (
                        <span className="text-xs text-amber-500">{countries.find((c) => c.code === party.country)?.flag} {t("أجنبي", "Foreign")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">🇸🇦 {t("محلي", "Local")}</span>
                      )}
                      {party.roles.map((r) => (
                        <span key={r} className="text-xs text-muted-foreground/60">{ROLE_LABELS[r] ? t(ROLE_LABELS[r].ar, ROLE_LABELS[r].en) : r}</span>
                      ))}
                    </div>
                  </div>
                  {party.taxNumber && (
                    <span className="text-xs font-english text-muted-foreground/60 shrink-0">{t("ض:", "VAT:")} {party.taxNumber.slice(0, 6)}...</span>
                  )}
                </button>
              ))
            ) : query.trim() ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">{t("لا توجد نتائج لـ", "No results for")} "{query}"</div>
            ) : null}
          </div>

          {/* Add new button */}
          {query.trim() && !hasExactMatch && (
            <button
              onClick={openQuickCreate}
              onMouseEnter={() => setHighlightIndex(results.length)}
              className={`w-full text-start px-4 py-3 flex items-center gap-2 border-t border-border transition-colors ${
                highlightIndex === results.length ? "bg-primary/5" : "hover:bg-muted"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-sm text-primary" style={{ fontWeight: 600 }}>{t("إضافة", "Add")} "{query}" {t("كجهة اتصال جديدة...", "as a new contact...")}</span>
                <p className="text-xs text-muted-foreground/60">{t("اضغط Enter للإضافة السريعة", "Press Enter for quick add")}</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Quick Create Modal (inline, no page navigation) */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setShowQuickCreate(false); }}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-foreground" style={{ fontSize: "1.125rem", fontWeight: 700 }}>{t("إضافة جهة اتصال جديدة", "Add new contact")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t("بيانات أساسية — يمكنك تعديلها لاحقاً من ملف الجهة", "Basic details — you can edit them later from the contact profile")}</p>
              </div>
              <button onClick={() => setShowQuickCreate(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>
              {/* Entity Location Toggle */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block" style={{ fontWeight: 600 }}>{t("نوع الكيان", "Entity type")}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLocationChange("local")}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                      qcEntityLocation === "local" ? "border-primary bg-primary/5" : "border-border hover:border-border"
                    }`}
                  >
                    <MapPin className={`h-5 w-5 mx-auto mb-1 ${qcEntityLocation === "local" ? "text-primary" : "text-muted-foreground/60"}`} />
                    <p className="text-sm" style={{ fontWeight: 600, color: qcEntityLocation === "local" ? "#1276E3" : "#374151" }}>🇸🇦 {t("داخل المملكة", "Inside Saudi Arabia")}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{t("سجل تجاري، رقم ضريبي", "Commercial registration, tax ID")}</p>
                  </button>
                  <button
                    onClick={() => handleLocationChange("foreign")}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                      qcEntityLocation === "foreign" ? "border-amber-500 bg-amber-100/30" : "border-border hover:border-border"
                    }`}
                  >
                    <Globe className={`h-5 w-5 mx-auto mb-1 ${qcEntityLocation === "foreign" ? "text-amber-500" : "text-muted-foreground/60"}`} />
                    <p className="text-sm" style={{ fontWeight: 600, color: qcEntityLocation === "foreign" ? "#F59E0B" : "#374151" }}>🌍 {t("خارج المملكة", "Outside Saudi Arabia")}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{t("ITN، LEI، ضريبة استقطاع", "ITN, LEI, withholding tax")}</p>
                  </button>
                </div>
              </div>

              {/* Name & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("الاسم (عربي)", "Name (Arabic)")}</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("الاسم (إنجليزي)", "Name (English)")}</label>
                  <input
                    value={qcNameEn}
                    onChange={(e) => setQcNameEn(e.target.value)}
                    placeholder="English name"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("التصنيف", "Classification")}</label>
                  <div className="flex gap-2">
                    <button onClick={() => setQcType("organization")} className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${qcType === "organization" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`} style={{ fontWeight: 600 }}>
                      <Building2 className="h-3.5 w-3.5 mx-auto mb-0.5" />{t("منشأة", "Organization")}
                    </button>
                    <button onClick={() => setQcType("person")} className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${qcType === "person" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`} style={{ fontWeight: 600 }}>
                      <User className="h-3.5 w-3.5 mx-auto mb-0.5" />{t("فرد", "Individual")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Country & Currency (for foreign) */}
              {qcEntityLocation === "foreign" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("الدولة", "Country")}</label>
                    <select
                      value={qcCountry}
                      onChange={(e) => {
                        setQcCountry(e.target.value);
                        const c = countries.find((c) => c.code === e.target.value);
                        if (c) setQcCurrency(c.currency);
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      {countries.filter((c) => c.code !== "SA").map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {t(c.name.ar, c.name.en)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("العملة", "Currency")}</label>
                    <input
                      value={qcCurrency}
                      onChange={(e) => setQcCurrency(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Tax / Legal IDs */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block" style={{ fontWeight: 600 }}>
                  {qcEntityLocation === "local" ? t("البيانات الضريبية والتجارية", "Tax and commercial details") : t("البيانات الضريبية والقانونية", "Tax and legal details")}
                </label>
                {qcEntityLocation === "local" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground/60 mb-1 block">{t("الرقم الضريبي (VAT)", "Tax ID (VAT)")}</label>
                      <input
                        value={qcTaxNumber}
                        onChange={(e) => setQcTaxNumber(e.target.value)}
                        placeholder="300XXXXXXXXXX003"
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground/60 mb-1 block">{t("السجل التجاري", "Commercial registration")}</label>
                      <input
                        value={qcCommercialReg}
                        onChange={(e) => setQcCommercialReg(e.target.value)}
                        placeholder="1010XXXXXX"
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                        dir="ltr"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground/60 mb-1 block">{t("ITN (رقم ضريبي دولي)", "ITN (international tax number)")}</label>
                        <input
                          value={qcItn}
                          onChange={(e) => setQcItn(e.target.value)}
                          placeholder="XX-XXXXXXX"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground/60 mb-1 flex items-center gap-1">
                          LEI Code
                          <a href="https://search.gleif.org/" target="_blank" rel="noopener noreferrer" className="text-primary"><ExternalLink className="h-3 w-3" /></a>
                        </label>
                        <input
                          value={qcLeiCode}
                          onChange={(e) => setQcLeiCode(e.target.value)}
                          placeholder="XXXXXXXXXXXXXXXXXXXX"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground/60 mb-1 block">{t("رقم الترخيص / التسجيل", "License / registration number")}</label>
                      <input
                        value={qcLicense}
                        onChange={(e) => setQcLicense(e.target.value)}
                        placeholder={t("اختياري", "Optional")}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                        dir="ltr"
                      />
                    </div>

                    {/* Withholding Tax */}
                    <div className="rounded-lg border-2 border-amber-100 bg-amber-100/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-800" style={{ fontWeight: 700 }}>{t("ضريبة الاستقطاع (Withholding Tax)", "Withholding Tax")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground/60 mb-1 block">{t("نسبة الاستقطاع %", "Withholding rate %")}</label>
                          <input
                            type="number"
                            value={qcWithholdingRate}
                            onChange={(e) => setQcWithholdingRate(+e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                            dir="ltr" min={0} max={100}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground/60 mb-1 block">{t("تصنيف المعاملة", "Transaction classification")}</label>
                          <select
                            value={qcTransClass}
                            onChange={(e) => setQcTransClass(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="">{t("اختر...", "Select...")}</option>
                            {withholdingClassifications.map((c) => <option key={c.ar} value={c.ar}>{t(c.ar, c.en)}</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-2">{t("سيتم تطبيق ضريبة الاستقطاع تلقائياً على كل معاملة مع هذا الكيان الأجنبي وإدراجها في الإقرار الضريبي الشهري.", "Withholding tax will be applied automatically to every transaction with this foreign entity and included in the monthly tax return.")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Contact info (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("البريد الإلكتروني", "Email")}</label>
                  <input
                    value={qcEmail}
                    onChange={(e) => setQcEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                    dir="ltr" type="email"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" style={{ fontWeight: 600 }}>{t("الهاتف", "Phone")}</label>
                  <input
                    value={qcPhone}
                    onChange={(e) => setQcPhone(e.target.value)}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm font-english"
                    dir="ltr" type="tel"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-muted">
              <p className="text-xs text-muted-foreground/60">{t("يمكنك إكمال البيانات لاحقاً من ملف الجهة", "You can complete the details later from the contact profile")}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowQuickCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors" style={{ fontWeight: 500 }}>{t("إلغاء", "Cancel")}</button>
                <button
                  onClick={handleQuickCreate}
                  disabled={!query.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="h-4 w-4 inline-block me-1" />
                  {t("إضافة وتحديد", "Add & select")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
