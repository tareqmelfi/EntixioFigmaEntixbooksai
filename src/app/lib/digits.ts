/**
 * Digit normalization · Arabic-Indic ↔ Western
 *
 * Per BIBLE rule: "منع استخدام الأرقام العربية الهندية تماماً ·
 *                  استخدام الأرقام اللاتينية (0-9) فقط في التخزين والعرض."
 *
 * Inputs from Mac/iOS Arabic keyboard often produce ٠١٢٣٤٥٦٧٨٩ instead of 0-9.
 * Eastern Arabic-Indic (used in Persian/Urdu): ۰۱۲۳۴۵۶۷۸۹ (also normalized).
 *
 * Usage:
 *   <Input onChange={(e) => setForm({ ...form, amount: normalizeDigits(e.target.value) })} />
 *
 * Or wrap once at form level:
 *   const onChange = makeDigitNormalizer(setForm, "amount");
 */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC = "۰۱۲۳۴۵۶۷۸۹";
const WESTERN = "0123456789";

/** Replace any Arabic-Indic or Extended-Arabic digits with Western (0-9). */
export function normalizeDigits(input: string): string {
  if (!input) return input;
  let out = "";
  for (const ch of input) {
    const ai = ARABIC_INDIC.indexOf(ch);
    if (ai >= 0) { out += WESTERN[ai]; continue; }
    const ea = EXTENDED_ARABIC.indexOf(ch);
    if (ea >= 0) { out += WESTERN[ea]; continue; }
    out += ch;
  }
  return out;
}

/** Western → Arabic-Indic · for display only when explicitly needed (e.g. legal docs). */
export function toArabicDigits(input: string): string {
  if (!input) return input;
  let out = "";
  for (const ch of input) {
    const w = WESTERN.indexOf(ch);
    out += w >= 0 ? ARABIC_INDIC[w] : ch;
  }
  return out;
}

/** Drop-in onChange wrapper that normalizes on every keystroke. */
export function digitChange<T extends Record<string, any>>(
  setForm: (updater: (f: T) => T) => void,
  field: keyof T,
) {
  return (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [field]: normalizeDigits(e.target.value) }) as T);
  };
}
