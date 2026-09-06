import { normalizeDigits, toArabicDigits } from "./digits";

export type NumberingSystem = "latn" | "arab";
export const NUMBERING_STORAGE_KEY = "entix-numbering-system";
export const NUMBERING_EVENT = "entix:numbering-system";

/** Presentation only. Never use this preference for identifiers or API payloads. */
export function getNumberingSystem(): NumberingSystem {
  try { return localStorage.getItem(NUMBERING_STORAGE_KEY) === "arab" ? "arab" : "latn"; }
  catch { return "latn"; }
}

export function setNumberingSystem(value: NumberingSystem): boolean {
  try {
    localStorage.setItem(NUMBERING_STORAGE_KEY, value === "arab" ? "arab" : "latn");
    window.dispatchEvent(new Event(NUMBERING_EVENT));
    return true;
  } catch { return false; }
}

/** Preserve the requested language/calendar while making digits explicit.
 * No locale argument must never inherit the browser's numbering convention.
 */
export function displayLocale(locale?: string | string[], numbering = getNumberingSystem()): string {
  const base = (Array.isArray(locale) ? locale[0] : locale) || "en-US";
  return new Intl.Locale(base, { numberingSystem: numbering }).toString();
}

/** For preformatted visible quantities/dates only; leaves precision unchanged. */
export function displayDigits(value: string | number, numbering = getNumberingSystem()): string {
  const normalized = normalizeDigits(String(value));
  return numbering === "arab" ? toArabicDigits(normalized) : normalized;
}
