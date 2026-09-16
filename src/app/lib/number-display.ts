import { normalizeDigits } from "./digits";

/** `arab` is accepted only for compatibility with old callers; output is always Latin. */
export type NumberingSystem = "latn" | "arab";
export const NUMBERING_STORAGE_KEY = "entix-numbering-system";
export const NUMBERING_EVENT = "entix:numbering-system";

/** The product uses 0123456789 for every language. Retire legacy preferences safely. */
export function getNumberingSystem(): "latn" {
  try {
    if (localStorage.getItem(NUMBERING_STORAGE_KEY) === "arab") localStorage.setItem(NUMBERING_STORAGE_KEY, "latn");
  } catch { /* Storage availability never changes the display rule. */ }
  return "latn";
}

export function setNumberingSystem(_legacyValue: NumberingSystem = "latn"): boolean {
  try {
    localStorage.setItem(NUMBERING_STORAGE_KEY, "latn");
    window.dispatchEvent(new Event(NUMBERING_EVENT));
    return true;
  } catch { return false; }
}

/** Preserve language/calendar, overriding browser, locale extensions and legacy preferences. */
export function displayLocale(locale?: string | string[], _legacyNumbering?: NumberingSystem): string {
  const base = (Array.isArray(locale) ? locale[0] : locale) || "en-US";
  return new Intl.Locale(base, { numberingSystem: "latn" }).toString();
}

/** Presentation only: normalize visible digits without changing source precision or records. */
export function displayDigits(value: string | number, _legacyNumbering?: NumberingSystem): string {
  return normalizeDigits(String(value));
}
