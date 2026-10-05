import type { TaxRate } from './api';

/** Legacy catalogues can contain foreign VAT. Keep those records for history and
 * explicit foreign-tax use; they must not be the ordinary US entry choices. */
export function isForeignVatRate(rate: TaxRate, country: string): boolean {
  return country === 'US' && /\bVAT\b|القيمة المضافة/i.test(`${rate.name} ${rate.nameAr || ''}`);
}
