/** Labels describe the company context, never rewrite a document's tax amounts. */
export function taxLabel(country: string | null | undefined, language: 'ar' | 'en'): string {
  const ar = language === 'ar';
  if (country === 'SA') return ar ? 'ضريبة القيمة المضافة' : 'VAT';
  if (country === 'US') return ar ? 'ضريبة المبيعات' : 'Sales tax';
  return ar ? 'الضريبة' : 'Tax';
}
