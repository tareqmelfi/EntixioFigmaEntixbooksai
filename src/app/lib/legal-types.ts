/**
 * LEGAL_TYPES_BY_COUNTRY · country-specific legal entity lists (W30)
 *
 * Saudi forms (مؤسسة فردية · ذ.م.م · مساهمة مقفلة/مبسطة · شراكة) differ from US
 * forms (LLC · C-Corp · S-Corp · Sole Prop …) — and the choice drives which tax
 * report shape the org gets (ZATCA vs IRS). Shared by the create modal + settings.
 */
export const LEGAL_TYPES_BY_COUNTRY: Record<string, Array<{ id: string; ar: string; en: string; subtypes?: Array<{ id: string; ar: string; en: string }> }>> = {
  SA: [
    { id: "SOLE_PROP", ar: "مؤسسة فردية", en: "Sole proprietorship" },
    { id: "LLC", ar: "ذات مسؤولية محدودة (ذ.م.م)", en: "Limited liability company (LLC)" },
    { id: "JSC", ar: "مساهمة", en: "Joint stock company (JSC)", subtypes: [
      { id: "closed", ar: "مقفلة", en: "Closed" },
      { id: "simplified", ar: "مبسطة", en: "Simplified" },
    ] },
    { id: "PARTNERSHIP", ar: "شراكة (تضامن/توصية)", en: "Partnership" },
    { id: "NONPROFIT", ar: "غير ربحية", en: "Nonprofit" },
    { id: "OTHER", ar: "أخرى", en: "Other" },
  ],
  US: [
    { id: "LLC", ar: "LLC", en: "LLC" },
    { id: "JSC", ar: "Corporation", en: "Corporation (Inc.)", subtypes: [
      { id: "ccorp", ar: "C-Corp", en: "C-Corp" },
      { id: "scorp", ar: "S-Corp", en: "S-Corp" },
    ] },
    { id: "SOLE_PROP", ar: "Sole Proprietorship", en: "Sole Proprietorship" },
    { id: "PARTNERSHIP", ar: "Partnership", en: "Partnership (GP/LP/LLP)" },
    { id: "NONPROFIT", ar: "Nonprofit", en: "Nonprofit 501(c)" },
    { id: "OTHER", ar: "أخرى", en: "Other" },
  ],
};
export const LEGAL_TYPES_DEFAULT = LEGAL_TYPES_BY_COUNTRY.SA;
