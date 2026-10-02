import { normalizeDigits } from './digits';

/** Calendar validation only: historical entries have no today-relative age limit. */
export function parseDocumentDate(text: string): string | null {
  const value = normalizeDigits(text || '').trim().replace(/[\u200e\u200f\u061c]/g, '');
  if (!value) return null;
  let year: string, month: string, day: string;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value))) {
    [, year, month, day] = match;
  } else if ((match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(value))) {
    [, day, month, year] = match;
    if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
  } else if ((match = /^(\d{2})(\d{2})(\d{4})$/.exec(value))) {
    [, day, month, year] = match;
  } else return '';
  if (Number(year) < 1 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1) return '';
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : '';
}
