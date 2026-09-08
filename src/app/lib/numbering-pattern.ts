/**
 * PL2 · numbering pattern preview.
 *
 * A deliberate mirror of the API's `src/lib/numbering.ts`
 * (`normalizeNumberingPattern` · `composeNumberingPattern` · `buildNumberFromPattern`)
 * so the settings screen can show a live preview as the user types WITHOUT a
 * round trip per keystroke. The two must agree — the API side is covered by
 * `src/lib/numbering-pattern.test.ts`; if you change one, change both.
 */
import type { NumberingKind, NumberingPerKind } from "./api";

export const NUMBERING_DEFAULTS: Record<NumberingKind, { prefix: string; padding: number; start: number }> = {
  contact: { prefix: "EN-CON-", padding: 4, start: 1 },
  invoice: { prefix: "EN-INV-{YYYY}{MM}-", padding: 4, start: 1 },
  quote: { prefix: "EN-QTE-{YYYY}{MM}-", padding: 4, start: 1 },
  bill: { prefix: "EN-BIL-{YYYY}{MM}-", padding: 4, start: 1 },
  receipt: { prefix: "EN-RCP-{YYYY}{MM}-", padding: 4, start: 1 },
  payment: { prefix: "EN-PAY-{YYYY}{MM}-", padding: 4, start: 1 },
  estimate: { prefix: "EST-{YYYY}{MM}-", padding: 4, start: 1 },
  project: { prefix: "PRJ-", padding: 4, start: 1 },
};

/** Accept the friendly lowercase spelling the settings screen advertises. */
export function normalizeNumberingPattern(raw: string, prefix = ""): string {
  return String(raw || "")
    .replace(/\{clientCode\}/gi, "{CLIENT}")
    .replace(/\{vendorCode\}/gi, "{VENDOR}")
    .replace(/\{projectCode\}/gi, "{PROJECT}")
    .replace(/\{entityCode\}/gi, "{ENTITY}")
    .replace(/\{prefix\}/gi, prefix)
    .replace(/\{seq\}/gi, "{SEQ}")
    .replace(/\{yyyy\}/g, "{YYYY}")
    .replace(/\{yy\}/g, "{YY}")
    .replace(/\{mm\}/g, "{MM}")
    .replace(/\{dd\}/g, "{DD}");
}

/** Fold prefix + switches + free pattern into ONE string that always ends in a sequence. */
export function composeNumberingPattern(cfg: NumberingPerKind = {}, fallbackPrefix = ""): string {
  const prefix = cfg.prefix ?? fallbackPrefix;
  if (cfg.pattern && cfg.pattern.trim()) {
    const explicit = normalizeNumberingPattern(cfg.pattern.trim(), prefix);
    return explicit.includes("{SEQ}") ? explicit : `${explicit}{SEQ}`;
  }

  let head = normalizeNumberingPattern(prefix);
  if (cfg.includeClientCode === true && !head.includes("{CLIENT}")) head = `{CLIENT}-${head}`;
  else if (cfg.includeClientCode === false) head = head.replace(/\{CLIENT\}-?/g, "");

  if (cfg.includeYear === false) head = head.replace(/\{YYYY\}|\{YY\}/g, "");
  if (cfg.includeMonth === false) head = head.replace(/\{MM\}/g, "");

  const hasSeq = head.includes("{SEQ}");
  const dateSuffix =
    (cfg.includeYear === true && !/\{YYYY\}|\{YY\}/.test(head) ? "{YYYY}" : "") +
    (cfg.includeMonth === true && !head.includes("{MM}") ? "{MM}" : "");
  if (dateSuffix) head = hasSeq ? head.replace("{SEQ}", `${dateSuffix}-{SEQ}`) : `${head}${dateSuffix}-`;

  head = head.replace(/-{2,}/g, "-");
  return head.includes("{SEQ}") ? head : `${head}{SEQ}`;
}

export type NumberingPreviewContext = {
  entityCode?: string;
  clientCode?: string;
  vendorCode?: string;
  projectCode?: string;
  docCode?: string;
  now?: Date;
};

/** Render a pattern for a concrete sequence number. */
export function buildNumberFromPattern(
  pattern: string,
  padding: number,
  sequenceNumber: number,
  ctx: NumberingPreviewContext = {},
): string {
  const now = ctx.now || new Date();
  const yyyy = String(now.getFullYear());
  const sequence = String(sequenceNumber).padStart(Math.max(1, padding || 1), "0");
  return pattern
    .replace(/\{ENTITY\}/g, ctx.entityCode || "EN")
    .replace(/\{CLIENT\}/g, ctx.clientCode || "GEN")
    .replace(/\{VENDOR\}/g, ctx.vendorCode || ctx.clientCode || "GEN")
    .replace(/\{PROJECT\}/g, ctx.projectCode || "GEN")
    .replace(/\{DOC\}/g, ctx.docCode || "DOC")
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(2))
    .replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{DD\}/g, String(now.getDate()).padStart(2, "0"))
    .replace(/\{SEQ\}/g, sequence);
}

/** One-shot: config → the number the server would issue next. */
export function previewNumber(kind: NumberingKind, cfg: NumberingPerKind = {}, ctx: NumberingPreviewContext = {}): string {
  const defaults = NUMBERING_DEFAULTS[kind];
  const pattern = composeNumberingPattern({ ...cfg, prefix: cfg.prefix ?? defaults.prefix }, defaults.prefix);
  const padding = cfg.padding ?? defaults.padding;
  const seq = cfg.start ?? defaults.start;
  return buildNumberFromPattern(pattern, padding, seq, ctx);
}
