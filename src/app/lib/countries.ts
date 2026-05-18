/**
 * countries · ISO-3166-1 alpha-2 reference with country-specific tax-id metadata.
 *
 * Used by contact registration to:
 * - render the right tax-id label (VAT/EIN/SIRET/TRN/etc.)
 * - validate tax-id format per country
 * - default currency per country
 * - auto-flag isForeign for non-base-org country
 *
 * "Open list" = user can pick from this list OR type a free-form country code.
 *
 * Product requirement: UX-47 · "تصنيف محلي / أجنبي + ITN/LEI + ضريبة استقطاع"
 */

export interface Country {
  code: string;          // ISO-3166-1 alpha-2
  nameEn: string;
  nameAr: string;
  flag: string;          // emoji flag
  /** Default currency · ISO 4217 */
  currency: string;
  /** Tax-id label shown in forms */
  taxIdLabel: { en: string; ar: string };
  /** Tax-id format hint · plain regex string */
  taxIdPattern?: string;
  /** Is this country in the GCC (special VAT treatment) */
  gcc?: boolean;
  /** Default withholding tax rate (%) for foreign-entity transactions · best-effort */
  withholdingHint?: number;
}

export const COUNTRIES: Country[] = [
  { code: "SA", nameEn: "Saudi Arabia", nameAr: "السعودية", flag: "🇸🇦", currency: "SAR",
    taxIdLabel: { en: "VAT Number", ar: "الرقم الضريبي" }, taxIdPattern: "^3\\d{14}$", gcc: true },
  { code: "AE", nameEn: "United Arab Emirates", nameAr: "الإمارات", flag: "🇦🇪", currency: "AED",
    taxIdLabel: { en: "TRN", ar: "الرقم الضريبي TRN" }, taxIdPattern: "^\\d{15}$", gcc: true },
  { code: "KW", nameEn: "Kuwait", nameAr: "الكويت", flag: "🇰🇼", currency: "KWD",
    taxIdLabel: { en: "Tax ID", ar: "الرقم الضريبي" }, gcc: true },
  { code: "BH", nameEn: "Bahrain", nameAr: "البحرين", flag: "🇧🇭", currency: "BHD",
    taxIdLabel: { en: "VAT Number", ar: "الرقم الضريبي" }, taxIdPattern: "^2\\d{14}$", gcc: true },
  { code: "QA", nameEn: "Qatar", nameAr: "قطر", flag: "🇶🇦", currency: "QAR",
    taxIdLabel: { en: "Tax ID", ar: "الرقم الضريبي" }, gcc: true },
  { code: "OM", nameEn: "Oman", nameAr: "عمان", flag: "🇴🇲", currency: "OMR",
    taxIdLabel: { en: "VAT Number", ar: "الرقم الضريبي" }, taxIdPattern: "^OM\\d{10}$", gcc: true },
  { code: "EG", nameEn: "Egypt", nameAr: "مصر", flag: "🇪🇬", currency: "EGP",
    taxIdLabel: { en: "Tax Card", ar: "البطاقة الضريبية" }, taxIdPattern: "^\\d{9}$",
    withholdingHint: 5 },
  { code: "JO", nameEn: "Jordan", nameAr: "الأردن", flag: "🇯🇴", currency: "JOD",
    taxIdLabel: { en: "Tax ID", ar: "الرقم الضريبي" }, withholdingHint: 7 },
  { code: "LB", nameEn: "Lebanon", nameAr: "لبنان", flag: "🇱🇧", currency: "LBP",
    taxIdLabel: { en: "Tax ID", ar: "الرقم الضريبي" } },
  { code: "TR", nameEn: "Turkey", nameAr: "تركيا", flag: "🇹🇷", currency: "TRY",
    taxIdLabel: { en: "VKN", ar: "الرقم الضريبي" }, taxIdPattern: "^\\d{10,11}$" },
  { code: "US", nameEn: "United States", nameAr: "الولايات المتحدة", flag: "🇺🇸", currency: "USD",
    taxIdLabel: { en: "EIN / ITIN", ar: "EIN / ITIN" }, taxIdPattern: "^\\d{2}-\\d{7}$",
    withholdingHint: 5 },
  { code: "GB", nameEn: "United Kingdom", nameAr: "بريطانيا", flag: "🇬🇧", currency: "GBP",
    taxIdLabel: { en: "VAT Number", ar: "VAT Number" }, taxIdPattern: "^GB\\d{9}$",
    withholdingHint: 5 },
  { code: "DE", nameEn: "Germany", nameAr: "ألمانيا", flag: "🇩🇪", currency: "EUR",
    taxIdLabel: { en: "USt-IdNr.", ar: "VAT Number" }, taxIdPattern: "^DE\\d{9}$",
    withholdingHint: 5 },
  { code: "FR", nameEn: "France", nameAr: "فرنسا", flag: "🇫🇷", currency: "EUR",
    taxIdLabel: { en: "SIRET", ar: "SIRET" }, taxIdPattern: "^\\d{14}$",
    withholdingHint: 5 },
  { code: "ES", nameEn: "Spain", nameAr: "إسبانيا", flag: "🇪🇸", currency: "EUR",
    taxIdLabel: { en: "NIF", ar: "NIF" } },
  { code: "IT", nameEn: "Italy", nameAr: "إيطاليا", flag: "🇮🇹", currency: "EUR",
    taxIdLabel: { en: "Partita IVA", ar: "VAT Number" }, taxIdPattern: "^IT\\d{11}$" },
  { code: "NL", nameEn: "Netherlands", nameAr: "هولندا", flag: "🇳🇱", currency: "EUR",
    taxIdLabel: { en: "BTW", ar: "VAT Number" } },
  { code: "BE", nameEn: "Belgium", nameAr: "بلجيكا", flag: "🇧🇪", currency: "EUR",
    taxIdLabel: { en: "BTW", ar: "VAT Number" } },
  { code: "CH", nameEn: "Switzerland", nameAr: "سويسرا", flag: "🇨🇭", currency: "CHF",
    taxIdLabel: { en: "UID", ar: "UID" } },
  { code: "CA", nameEn: "Canada", nameAr: "كندا", flag: "🇨🇦", currency: "CAD",
    taxIdLabel: { en: "BN", ar: "Business Number" }, taxIdPattern: "^\\d{9}$" },
  { code: "AU", nameEn: "Australia", nameAr: "أستراليا", flag: "🇦🇺", currency: "AUD",
    taxIdLabel: { en: "ABN", ar: "ABN" }, taxIdPattern: "^\\d{11}$" },
  { code: "SG", nameEn: "Singapore", nameAr: "سنغافورة", flag: "🇸🇬", currency: "SGD",
    taxIdLabel: { en: "UEN", ar: "UEN" } },
  { code: "MY", nameEn: "Malaysia", nameAr: "ماليزيا", flag: "🇲🇾", currency: "MYR",
    taxIdLabel: { en: "Tax ID", ar: "الرقم الضريبي" } },
  { code: "IN", nameEn: "India", nameAr: "الهند", flag: "🇮🇳", currency: "INR",
    taxIdLabel: { en: "GSTIN", ar: "GSTIN" }, taxIdPattern: "^\\d{2}[A-Z]{5}\\d{4}[A-Z][A-Z\\d][Z][A-Z\\d]$",
    withholdingHint: 10 },
  { code: "PK", nameEn: "Pakistan", nameAr: "باكستان", flag: "🇵🇰", currency: "PKR",
    taxIdLabel: { en: "NTN", ar: "NTN" }, withholdingHint: 15 },
  { code: "PH", nameEn: "Philippines", nameAr: "الفلبين", flag: "🇵🇭", currency: "PHP",
    taxIdLabel: { en: "TIN", ar: "TIN" } },
  { code: "ID", nameEn: "Indonesia", nameAr: "إندونيسيا", flag: "🇮🇩", currency: "IDR",
    taxIdLabel: { en: "NPWP", ar: "NPWP" } },
  { code: "JP", nameEn: "Japan", nameAr: "اليابان", flag: "🇯🇵", currency: "JPY",
    taxIdLabel: { en: "Corporate Number", ar: "Corporate Number" }, taxIdPattern: "^\\d{13}$" },
  { code: "CN", nameEn: "China", nameAr: "الصين", flag: "🇨🇳", currency: "CNY",
    taxIdLabel: { en: "USCC", ar: "USCC" }, taxIdPattern: "^[A-Z0-9]{18}$" },
  { code: "ZA", nameEn: "South Africa", nameAr: "جنوب أفريقيا", flag: "🇿🇦", currency: "ZAR",
    taxIdLabel: { en: "VAT Number", ar: "VAT Number" } },
  { code: "MA", nameEn: "Morocco", nameAr: "المغرب", flag: "🇲🇦", currency: "MAD",
    taxIdLabel: { en: "ICE", ar: "ICE" } },
  { code: "TN", nameEn: "Tunisia", nameAr: "تونس", flag: "🇹🇳", currency: "TND",
    taxIdLabel: { en: "Tax ID", ar: "الرقم الضريبي" } },
  { code: "DZ", nameEn: "Algeria", nameAr: "الجزائر", flag: "🇩🇿", currency: "DZD",
    taxIdLabel: { en: "NIF", ar: "NIF" } },
  // Open · accept any free-form code
];

export function findCountry(code: string | undefined | null): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export function isGcc(code: string | undefined | null): boolean {
  return !!findCountry(code)?.gcc;
}

/** Build a GLEIF lookup link for an LEI · opens the public registry */
export function leiLookupUrl(lei: string): string {
  return `https://search.gleif.org/#/record/${encodeURIComponent(lei.trim())}`;
}
