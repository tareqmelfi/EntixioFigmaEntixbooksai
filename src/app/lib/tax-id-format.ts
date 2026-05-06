/**
 * Tax ID auto-formatter · UX-104
 *
 * Country-aware formatting applied on paste/blur:
 *   US  · 9 digits → XX-XXXXXXX (EIN)
 *   SA  · 15 digits → 3 0 0 X X X X X X X X X X 0 0 3 (VAT, no separator but validates)
 *   AE  · 15 digits → similar (TRN)
 *   GB  · 9 digits → GB XXX XXXX XX (VAT)
 *   EG  · 9 digits → XXX-XXX-XXX
 *
 * Always strips non-digits first, then applies the pattern.
 */

export function formatTaxId(input: string, country: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';

  switch ((country || '').toUpperCase()) {
    case 'US': {
      // EIN · pad short input to 9 then format
      if (digits.length <= 2) return digits;
      const padded = digits.length >= 9 ? digits.slice(0, 9) : digits;
      return `${padded.slice(0, 2)}-${padded.slice(2)}`;
    }
    case 'SA':
    case 'AE': {
      // KSA VAT (15 digits) · group as 3-3-3-3-3 for readability
      if (digits.length <= 3) return digits;
      const padded = digits.length >= 15 ? digits.slice(0, 15) : digits;
      return padded.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    }
    case 'GB': {
      // GB VAT · 9 digits → "XXX XXXX XX"
      const padded = digits.length >= 9 ? digits.slice(0, 9) : digits;
      if (padded.length <= 3) return padded;
      if (padded.length <= 7) return `${padded.slice(0, 3)} ${padded.slice(3)}`;
      return `${padded.slice(0, 3)} ${padded.slice(3, 7)} ${padded.slice(7)}`;
    }
    case 'EG': {
      const padded = digits.length >= 9 ? digits.slice(0, 9) : digits;
      if (padded.length <= 3) return padded;
      if (padded.length <= 6) return `${padded.slice(0, 3)}-${padded.slice(3)}`;
      return `${padded.slice(0, 3)}-${padded.slice(3, 6)}-${padded.slice(6)}`;
    }
    default:
      return digits;
  }
}

/**
 * Format CR (commercial registration) number. KSA = 10 digits, no separators
 * but trimmed/zero-padded.
 */
export function formatCrNumber(input: string, country: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';
  if ((country || '').toUpperCase() === 'SA') {
    return digits.slice(0, 10);
  }
  return digits;
}

/**
 * Validate if a tax ID looks correct for the given country (loose check).
 */
export function isValidTaxId(value: string, country: string): boolean {
  const digits = (value || '').replace(/\D/g, '');
  switch ((country || '').toUpperCase()) {
    case 'US': return digits.length === 9;
    case 'SA':
    case 'AE': return digits.length === 15;
    case 'GB': return digits.length === 9;
    case 'EG': return digits.length === 9;
    default:   return digits.length >= 5;
  }
}
