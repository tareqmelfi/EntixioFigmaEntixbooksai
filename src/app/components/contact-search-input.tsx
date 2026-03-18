import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router";
import {
  Search, Plus, X, Building2, User, Globe, MapPin, ChevronDown,
  ExternalLink, FileText, AlertTriangle
} from "lucide-react";
import { useContacts, type Party, type RoleType, type EntityLocation } from "./contacts-store";

// ── Countries ──
const countries = [
  { code: "SA", name: "المملكة العربية السعودية", currency: "SAR", flag: "🇸🇦" },
  { code: "US", name: "الولايات المتحدة", currency: "USD", flag: "🇺🇸" },
  { code: "GB", name: "المملكة المتحدة", currency: "GBP", flag: "🇬🇧" },
  { code: "AE", name: "الإمارات العربية المتحدة", currency: "AED", flag: "🇦🇪" },
  { code: "EG", name: "مصر", currency: "EGP", flag: "🇪🇬" },
  { code: "DE", name: "ألمانيا", currency: "EUR", flag: "🇩🇪" },
  { code: "FR", name: "فرنسا", currency: "EUR", flag: "🇫🇷" },
  { code: "JP", name: "اليابان", currency: "JPY", flag: "🇯🇵" },
  { code: "CN", name: "الصين", currency: "CNY", flag: "🇨🇳" },
  { code: "IN", name: "الهند", currency: "INR", flag: "🇮🇳" },
];

const withholdingClassifications = [
  "خدمات تقنية", "تراخيص برمجية", "خدمات سحابية", "استشارات",
  "خدمات إدارية", "خدمات مالية", "خدمات تسويقية", "إيجارات", "أخرى",
];

interface ContactSearchInputProps {
  value: string;
  onChange: (name: string, partyId?: string) => void;
  roleFilter?: RoleType;
  placeholder?: string;
  label?: string;
}

export function ContactSearchInput({
  value, onChange, roleFilter, placeholder = "اكتب اسم العميل أو المورد...", label,
}: ContactSearchInputProps) {
  const { searchParties, addParty, getPartyByName } = useContacts();
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

  const handleQuickCreate = () => {
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
      {label && <label className="block text-sm text-[#374151] mb-1.5" style={{ fontWeight: 500 }}>{label}</label>}

      {/* Input */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 ps-10 pe-10 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); onChange(""); inputRef.current?.focus(); }}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#9CA3AF] hover:text-[#6B7280]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selected party badge */}
      {selectedParty && !isOpen && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[#6B7280]">
          {selectedParty.entityLocation === "foreign" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[#92400E]" style={{ fontWeight: 500 }}>
              <Globe className="h-3 w-3" />{countries.find((c) => c.code === selectedParty.country)?.flag} كيان أجنبي — {selectedParty.currency}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[#166534]" style={{ fontWeight: 500 }}>
              🇸🇦 محلي
            </span>
          )}
          {selectedParty.taxNumber && <span className="font-english">ض: {selectedParty.taxNumber.slice(0, 6)}...</span>}
          {selectedParty.leiCode && (
            <a
              href={`https://search.gleif.org/#/record/${selectedParty.leiCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#1276E3] hover:underline"
            >
              LEI <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {selectedParty.entityLocation === "foreign" && selectedParty.withholdingTaxRate && (
            <span className="inline-flex items-center gap-1 text-[#F59E0B]">
              <AlertTriangle className="h-3 w-3" /> استقطاع {selectedParty.withholdingTaxRate}%
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white shadow-lg overflow-hidden"
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
                    highlightIndex === i ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    party.type === "organization" ? "bg-[#DBEAFE]" : "bg-[#F3E8FF]"
                  }`}>
                    {party.type === "organization" ? (
                      <Building2 className="h-4 w-4 text-[#1E40AF]" />
                    ) : (
                      <User className="h-4 w-4 text-[#6B21A8]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 500 }}>{party.name}</span>
                      {party.nameEn && <span className="text-xs text-[#9CA3AF] font-english truncate">{party.nameEn}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {party.entityLocation === "foreign" ? (
                        <span className="text-xs text-[#F59E0B]">{countries.find((c) => c.code === party.country)?.flag} أجنبي</span>
                      ) : (
                        <span className="text-xs text-[#6B7280]">🇸🇦 محلي</span>
                      )}
                      {party.roles.map((r) => (
                        <span key={r} className="text-xs text-[#9CA3AF]">{r}</span>
                      ))}
                    </div>
                  </div>
                  {party.taxNumber && (
                    <span className="text-xs font-english text-[#9CA3AF] shrink-0">ض: {party.taxNumber.slice(0, 6)}...</span>
                  )}
                </button>
              ))
            ) : query.trim() ? (
              <div className="px-4 py-3 text-sm text-[#6B7280] text-center">لا توجد نتائج لـ "{query}"</div>
            ) : null}
          </div>

          {/* Add new button */}
          {query.trim() && !hasExactMatch && (
            <button
              onClick={openQuickCreate}
              onMouseEnter={() => setHighlightIndex(results.length)}
              className={`w-full text-start px-4 py-3 flex items-center gap-2 border-t border-[#E5E7EB] transition-colors ${
                highlightIndex === results.length ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-[#1276E3]" />
              </div>
              <div>
                <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>إضافة "{query}" كجهة اتصال جديدة...</span>
                <p className="text-xs text-[#9CA3AF]">اضغط Enter للإضافة السريعة</p>
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
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h3 className="text-[#0B1B49]" style={{ fontSize: "1.125rem", fontWeight: 700 }}>إضافة جهة اتصال جديدة</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">بيانات أساسية — يمكنك تعديلها لاحقاً من ملف الجهة</p>
              </div>
              <button onClick={() => setShowQuickCreate(false)} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>
              {/* Entity Location Toggle */}
              <div>
                <label className="text-xs text-[#6B7280] mb-2 block" style={{ fontWeight: 600 }}>نوع الكيان</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLocationChange("local")}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                      qcEntityLocation === "local" ? "border-[#1276E3] bg-[#EFF6FF]" : "border-[#E5E7EB] hover:border-[#D1D5DB]"
                    }`}
                  >
                    <MapPin className={`h-5 w-5 mx-auto mb-1 ${qcEntityLocation === "local" ? "text-[#1276E3]" : "text-[#9CA3AF]"}`} />
                    <p className="text-sm" style={{ fontWeight: 600, color: qcEntityLocation === "local" ? "#1276E3" : "#374151" }}>🇸🇦 داخل المملكة</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">سجل تجاري، رقم ضريبي</p>
                  </button>
                  <button
                    onClick={() => handleLocationChange("foreign")}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                      qcEntityLocation === "foreign" ? "border-[#F59E0B] bg-[#FEF3C7]/30" : "border-[#E5E7EB] hover:border-[#D1D5DB]"
                    }`}
                  >
                    <Globe className={`h-5 w-5 mx-auto mb-1 ${qcEntityLocation === "foreign" ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`} />
                    <p className="text-sm" style={{ fontWeight: 600, color: qcEntityLocation === "foreign" ? "#F59E0B" : "#374151" }}>🌍 خارج المملكة</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">ITN، LEI، ضريبة استقطاع</p>
                  </button>
                </div>
              </div>

              {/* Name & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>الاسم (عربي)</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>الاسم (إنجليزي)</label>
                  <input
                    value={qcNameEn}
                    onChange={(e) => setQcNameEn(e.target.value)}
                    placeholder="English name"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>التصنيف</label>
                  <div className="flex gap-2">
                    <button onClick={() => setQcType("organization")} className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${qcType === "organization" ? "border-[#1276E3] bg-[#EFF6FF] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280]"}`} style={{ fontWeight: 600 }}>
                      <Building2 className="h-3.5 w-3.5 mx-auto mb-0.5" />منشأة
                    </button>
                    <button onClick={() => setQcType("person")} className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${qcType === "person" ? "border-[#1276E3] bg-[#EFF6FF] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280]"}`} style={{ fontWeight: 600 }}>
                      <User className="h-3.5 w-3.5 mx-auto mb-0.5" />فرد
                    </button>
                  </div>
                </div>
              </div>

              {/* Country & Currency (for foreign) */}
              {qcEntityLocation === "foreign" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>الدولة</label>
                    <select
                      value={qcCountry}
                      onChange={(e) => {
                        setQcCountry(e.target.value);
                        const c = countries.find((c) => c.code === e.target.value);
                        if (c) setQcCurrency(c.currency);
                      }}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none"
                    >
                      {countries.filter((c) => c.code !== "SA").map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>العملة</label>
                    <input
                      value={qcCurrency}
                      onChange={(e) => setQcCurrency(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Tax / Legal IDs */}
              <div>
                <label className="text-xs text-[#6B7280] mb-2 block" style={{ fontWeight: 600 }}>
                  {qcEntityLocation === "local" ? "البيانات الضريبية والتجارية" : "البيانات الضريبية والقانونية"}
                </label>
                {qcEntityLocation === "local" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#9CA3AF] mb-1 block">الرقم الضريبي (VAT)</label>
                      <input
                        value={qcTaxNumber}
                        onChange={(e) => setQcTaxNumber(e.target.value)}
                        placeholder="300XXXXXXXXXX003"
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9CA3AF] mb-1 block">السجل التجاري</label>
                      <input
                        value={qcCommercialReg}
                        onChange={(e) => setQcCommercialReg(e.target.value)}
                        placeholder="1010XXXXXX"
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                        dir="ltr"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-[#9CA3AF] mb-1 block">ITN (رقم ضريبي دولي)</label>
                        <input
                          value={qcItn}
                          onChange={(e) => setQcItn(e.target.value)}
                          placeholder="XX-XXXXXXX"
                          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#9CA3AF] mb-1 flex items-center gap-1">
                          LEI Code
                          <a href="https://search.gleif.org/" target="_blank" rel="noopener noreferrer" className="text-[#1276E3]"><ExternalLink className="h-3 w-3" /></a>
                        </label>
                        <input
                          value={qcLeiCode}
                          onChange={(e) => setQcLeiCode(e.target.value)}
                          placeholder="XXXXXXXXXXXXXXXXXXXX"
                          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#9CA3AF] mb-1 block">رقم الترخيص / التسجيل</label>
                      <input
                        value={qcLicense}
                        onChange={(e) => setQcLicense(e.target.value)}
                        placeholder="اختياري"
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                        dir="ltr"
                      />
                    </div>

                    {/* Withholding Tax */}
                    <div className="rounded-lg border-2 border-[#FEF3C7] bg-[#FEF3C7]/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                        <span className="text-xs text-[#92400E]" style={{ fontWeight: 700 }}>ضريبة الاستقطاع (Withholding Tax)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[#9CA3AF] mb-1 block">نسبة الاستقطاع %</label>
                          <input
                            type="number"
                            value={qcWithholdingRate}
                            onChange={(e) => setQcWithholdingRate(+e.target.value)}
                            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                            dir="ltr" min={0} max={100}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#9CA3AF] mb-1 block">تصنيف المعاملة</label>
                          <select
                            value={qcTransClass}
                            onChange={(e) => setQcTransClass(e.target.value)}
                            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none"
                          >
                            <option value="">اختر...</option>
                            {withholdingClassifications.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-[#9CA3AF] mt-2">سيتم تطبيق ضريبة الاستقطاع تلقائياً على كل معاملة مع هذا الكيان الأجنبي وإدراجها في الإقرار الضريبي الشهري.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Contact info (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>البريد الإلكتروني</label>
                  <input
                    value={qcEmail}
                    onChange={(e) => setQcEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                    dir="ltr" type="email"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block" style={{ fontWeight: 600 }}>الهاتف</label>
                  <input
                    value={qcPhone}
                    onChange={(e) => setQcPhone(e.target.value)}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-english"
                    dir="ltr" type="tel"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3 bg-[#F9FAFB]">
              <p className="text-xs text-[#9CA3AF]">يمكنك إكمال البيانات لاحقاً من ملف الجهة</p>
              <div className="flex gap-2">
                <button onClick={() => setShowQuickCreate(false)} className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>إلغاء</button>
                <button
                  onClick={handleQuickCreate}
                  disabled={!query.trim()}
                  className="rounded-lg bg-[#1276E3] px-4 py-2 text-sm text-white hover:bg-[#1060C0] disabled:opacity-50 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="h-4 w-4 inline-block me-1" />
                  إضافة وتحديد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
