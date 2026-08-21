/**
 * displayName · locale-correct bilingual entity names (W30)
 *
 * Root cause: screens hardcoded `nameAr || name` — so an ENGLISH UI (and any
 * foreign subscriber) saw Arabic first. A US company chart of accounts read
 * «النقد في الصندوق» with "Cash on Hand" as the tiny subtitle.
 *
 * Rule: Arabic UI → Arabic first, English subtitle. English UI → English
 * first, Arabic subtitle. Always fall back to whichever name exists.
 */
export type BilingualNamed = { name?: string | null; nameAr?: string | null };

/** UI locale without a hook — LanguageContext persists it as `entix-language`. */
function uiLang(): string {
  try { return localStorage.getItem("entix-language") === "ar" ? "ar" : "en"; } catch { return "en"; }
}

export function displayName(entity: BilingualNamed, lang?: string): string {
  const l = lang ?? uiLang();
  const en = (entity.name || "").trim();
  const ar = (entity.nameAr || "").trim();
  if (l === "ar") return ar || en;
  return en || ar;
}

/** The other-language label, when it differs from the primary.
 *  Owner rule (2026-08-21): an English UI NEVER shows Arabic — no subtitle,
 *  no exception. Arabic UI may show the English subtitle (Latin reads fine
 *  for Arabic users and account codes are Latin anyway). */
export function secondaryName(entity: BilingualNamed, lang?: string): string | null {
  const l = lang ?? uiLang();
  const en = (entity.name || "").trim();
  const ar = (entity.nameAr || "").trim();
  if (!en || !ar || en === ar) return null;
  if (l === "ar") return en;
  return null;
}
