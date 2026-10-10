/** Shared quote data rules: no customer-specific defaults. */
export interface QuotePresentation {
  signatoryName?: string;
  signatoryTitle?: string;
  signatoryTitleAr?: string;
  clientRole?: string;
  clientRoleEn?: string;
  deliveryFacts?: Array<{ label: string; value: string }>;
  deliveryNote?: string;
}
export const QUOTE_UNITS = [
  { value: 'm2', ar: 'م²', en: 'm²' }, { value: 'm3', ar: 'م³', en: 'm³' },
  { value: 'lm', ar: 'متر طولي', en: 'Linear m' }, { value: 'piece', ar: 'قطعة', en: 'Piece' },
  { value: 'each', ar: 'عدد', en: 'Each' }, { value: 'lump_sum', ar: 'مقطوعية', en: 'Lump sum' },
];
export function unitLabel(unit: string | null | undefined, lang: 'ar' | 'en'): string {
  const aliases: Record<string, string> = { 'م2':'m2','م²':'m2','m²':'m2','sqm':'m2','م3':'m3','م³':'m3','m³':'m3','cum':'m3','متر طولي':'lm','قطعة':'piece','عدد':'each','ea':'each','qty':'each','مقطوعية':'lump_sum','ls':'lump_sum' };
  const raw = (unit || '').trim();
  const key = aliases[raw.toLowerCase()] || raw.toLowerCase();
  return QUOTE_UNITS.find(u => u.value === key)?.[lang] || raw || (lang === 'ar' ? 'عدد' : 'Each');
}
/** Integer minor units; clamp earlier rows so tiny totals never produce a negative last payment. */
export function allocatePayments(total: number, percents: number[]): number[] {
  let remaining = Math.round((total + Number.EPSILON) * 100);
  const cents = remaining;
  return percents.map((p, i) => {
    const amount = i === percents.length - 1 ? remaining : Math.min(remaining, Math.max(0, Math.round(cents * p / 100)));
    remaining -= amount;
    return amount / 100;
  });
}
export function balancedPercentages(percents: number[]): boolean {
  return percents.length > 0 && percents.every(p => Number.isFinite(p) && p > 0 && p <= 100) && Math.abs(percents.reduce((a,b) => a+b, 0) - 100) <= 0.01;
}
/** Legacy free-text conditions remain literal; only a numeric progress value receives %. */
export function progressCondition(value: string | null | undefined, lang: 'ar' | 'en'): string {
  const raw = (value || '').trim();
  if (!raw) return lang === 'ar' ? 'حسب نسبة الإنجاز' : 'By progress';
  const normalized = raw.replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[۰-۹]/g, x => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/٫/g, '.').replace(/[%٪]$/, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) > 100) return raw;
  return lang === 'ar' ? `عند إنجاز ${normalized}%` : `At ${normalized}% progress`;
}
