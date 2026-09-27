/** Explicit print choice wins; saved document/template/company preferences follow. */
export function resolveDocumentLanguage(override: unknown, document: { language?: unknown } | null | undefined, template: { docLang?: unknown } | null | undefined, org: { defaultInvoiceLanguage?: unknown; country?: unknown } | null | undefined): 'ar' | 'en' {
  for (const value of [override, document?.language, template?.docLang, org?.defaultInvoiceLanguage]) {
    if (value === 'ar' || value === 'en') return value;
  }
  return String(org?.country || 'SA').trim().toUpperCase() === 'SA' ? 'ar' : 'en';
}
