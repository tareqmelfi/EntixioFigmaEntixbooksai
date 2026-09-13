/**
 * Board widgets (SPEC-06 · External sheet sources → pipeline boards)
 *
 * Shared between the in-app board (/app/boards/:id · Entix tokens only) and the
 * branded public page (/b/:token · company brandTheme via CSS variables).
 *
 * `brand` prop:
 *   false (default) → Tailwind design tokens (Navy / Blue / Cyan / BG). Used everywhere under /app/*.
 *   true            → colours come from `--bt-primary --bt-secondary --bt-fill --bt-ink` set on the
 *                     public page root. The fallbacks in `BRAND_FALLBACK` equal the Entix defaults.
 *
 * Semantic status colours are FIXED and always paired with a mark + word:
 *   good ✓ · attention ⚠ · blocking ✕ · neutral ⓘ  — never re-tinted by a brand theme.
 *
 * Kanban = CSS grid · read-only · no drag library (BIBLE).
 */
import type { ReactNode } from "react";
import type { ExtKpi, ExtRow, ExtStatusColor, ExtStatusOption, ExtTemplate, ExtTemplateField, BrandTheme } from "../lib/api";
import { displayLocale } from "../lib/number-display";

export type BoardLang = "ar" | "en";
export type BoardRow = Pick<ExtRow, "id" | "rowKey" | "rowIndex" | "normalized" | "valid"> & Partial<Pick<ExtRow, "data" | "errors" | "syncedAt">>;

/** Entix defaults · also the fallback for every `--bt-*` variable */
export const BRAND_FALLBACK: BrandTheme = { primary: "#0B1B49", secondary: "#1276E3", fill: "#F4FCFF", ink: "#0B1B49", logoUrl: null };

/** CSS variables for the public page root (and its print view). */
export function brandVars(theme: BrandTheme | null | undefined): Record<string, string> {
  const th = theme || BRAND_FALLBACK;
  return {
    "--bt-primary": th.primary || BRAND_FALLBACK.primary,
    "--bt-secondary": th.secondary || BRAND_FALLBACK.secondary,
    "--bt-fill": th.fill || BRAND_FALLBACK.fill,
    "--bt-ink": th.ink || BRAND_FALLBACK.ink,
    "--bt-logo": th.logoUrl ? `url("${th.logoUrl}")` : "none",
  };
}

export const tr = (lang: BoardLang) => (ar: string, en: string) => (lang === "ar" ? ar : en);

// ── Formatting ───────────────────────────────────────────────────────────────
export function fmtMoney(n: unknown, currency: string, lang: BoardLang = "ar"): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const num = v.toLocaleString(displayLocale(lang === "ar" ? "ar-SA" : "en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${num} ${currency}` : num;
}
export function fmtNumber(n: unknown, lang: BoardLang = "ar"): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(displayLocale(lang === "ar" ? "ar-SA" : "en-US"), { maximumFractionDigits: 2 });
}
export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}
export function fmtPercent(n: unknown, lang: BoardLang = "ar"): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const pct = v <= 1 && v >= 0 ? v * 100 : v;
  return `${pct.toLocaleString(displayLocale(lang === "ar" ? "ar-SA" : "en-US"), { maximumFractionDigits: 1 })}%`;
}
/** Relative "last sync" label · 0-9 digits */
export function relativeTime(iso: string | null | undefined, lang: BoardLang): string {
  const t = tr(lang);
  if (!iso) return t("لم تتم بعد", "Not yet");
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const m = Math.round(diff / 60000);
  if (m < 1) return t("الآن", "just now");
  if (m < 60) return t(`قبل ${m} د`, `${m} min ago`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`قبل ${h} س`, `${h} h ago`);
  const d = Math.round(h / 24);
  return t(`قبل ${d} يوم`, `${d} d ago`);
}
export function fmtDateTime(iso: string | null | undefined, lang: BoardLang): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(displayLocale(lang === "ar" ? "ar-SA" : "en-US"), { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}

export function fieldLabel(f: ExtTemplateField, lang: BoardLang): string { return lang === "ar" ? f.labelAr : f.labelEn; }
export function isNumericField(f: ExtTemplateField): boolean { return f.type === "money" || f.type === "number"; }

export function formatCell(f: ExtTemplateField, value: unknown, lang: BoardLang, currency: string): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (f.type) {
    case "money": return fmtMoney(value, currency, lang);
    case "number": return fmtNumber(value, lang);
    case "date": return fmtDate(value);
    default: return String(value);
  }
}

// ── Status pill (semantic · fixed) ───────────────────────────────────────────
const STATUS_MARK: Record<ExtStatusColor, string> = { good: "✓", attention: "⚠", blocking: "✕", neutral: "ⓘ" };
const STATUS_CLASS: Record<ExtStatusColor, string> = {
  good: "border-success-border bg-success-subtle text-success",
  attention: "border-warning-border bg-warning-subtle text-warning",
  blocking: "border-danger-border bg-danger-subtle text-danger",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function statusOptionFor(value: unknown, options: ExtStatusOption[]): ExtStatusOption | null {
  if (value === null || value === undefined || value === "") return null;
  const v = String(value);
  return options.find((o) => o.value === v) || null;
}

export function StatusPill({ value, options, lang, className = "" }: { value: unknown; options: ExtStatusOption[]; lang: BoardLang; className?: string }) {
  const opt = statusOptionFor(value, options);
  const color: ExtStatusColor = opt?.color || "neutral";
  const word = opt ? (lang === "ar" ? opt.labelAr : opt.labelEn) : (value ? String(value) : tr(lang)("غير مصنّف", "Unclassified"));
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_CLASS[color]} ${className}`} title={word}>
      <span aria-hidden="true">{STATUS_MARK[color]}</span>
      <span>{word}</span>
    </span>
  );
}

// ── KPI tiles · 2×2 on phones · 4-5 on desktop ───────────────────────────────
export function BoardKpis({ kpis, lang, currency, brand = false }: { kpis: ExtKpi[]; lang: BoardLang; currency: string; brand?: boolean }) {
  if (!kpis.length) return null;
  const t = tr(lang);
  const cols = kpis.length >= 5 ? "lg:grid-cols-5" : kpis.length === 4 ? "lg:grid-cols-4" : kpis.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <div className={`grid grid-cols-2 gap-3 ${cols} board-kpis`}>
      {kpis.map((k) => {
        const val = k.format === "money" ? fmtMoney(k.value, currency, lang) : k.format === "percent" ? fmtPercent(k.value, lang) : fmtNumber(k.value, lang);
        const label = lang === "ar" ? k.labelAr : k.labelEn;
        const hint = k.count !== undefined && k.format !== "count" ? t(`${fmtNumber(k.count, lang)} عرض`, `${fmtNumber(k.count, lang)} items`) : undefined;
        return (
          <div
            key={k.key}
            className={brand ? "rounded-xl border p-4 min-w-0" : "rounded-xl border border-border bg-card p-4 min-w-0"}
            style={brand ? { background: "var(--bt-fill, #F4FCFF)", borderColor: "color-mix(in srgb, var(--bt-secondary, #1276E3) 35%, transparent)", color: "var(--bt-ink, #0B1B49)" } : undefined}
          >
            <div className={brand ? "text-xs opacity-80 truncate" : "text-xs text-muted-foreground truncate"}>{label}</div>
            <div
              dir="ltr"
              className={`mt-1 font-english font-bold tabular-nums text-[22px] leading-tight sm:text-[26px] truncate ${brand ? "" : "text-foreground"} ${lang === "ar" ? "text-right" : "text-left"}`}
              style={brand ? { color: "var(--bt-primary, #0B1B49)" } : undefined}
              title={val}
            >
              {val}
            </div>
            {hint && <div className={brand ? "mt-1 text-[11px] opacity-70" : "mt-1 text-[11px] text-muted-foreground"}>{hint}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Table · all template fields · numeric columns text-end ───────────────────
export function BoardTable({
  template, rows, statusOptions, lang, currency, onRowClick, selectedId, brand = false, showErrors = false, empty,
}: {
  template: ExtTemplate;
  rows: BoardRow[];
  statusOptions: ExtStatusOption[];
  lang: BoardLang;
  currency: string;
  onRowClick?: (row: BoardRow) => void;
  selectedId?: string | null;
  brand?: boolean;
  /** in-app only · an invalid row gets a ⚠ marker (never shown on the public output) */
  showErrors?: boolean;
  empty?: ReactNode;
}) {
  const t = tr(lang);
  const fields = template.fields;
  const kanbanField = template.kanbanField;
  const headStyle = brand ? { color: "var(--bt-primary, #0B1B49)", borderColor: "color-mix(in srgb, var(--bt-secondary, #1276E3) 35%, transparent)" } : undefined;
  // Mobile card: key · party/project-ish text · total-ish money · status
  const keyField = fields.find((f) => f.key === template.keyField) || fields[0];
  const textFields = fields.filter((f) => f.type === "text" && f.key !== template.keyField).slice(0, 2);
  const moneyField = fields.find((f) => f.key === "total") || fields.find((f) => f.type === "money");
  const dateField = fields.find((f) => f.type === "date");

  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-10 text-center text-sm text-muted-foreground">{empty ?? t("لا توجد صفوف", "No rows")}</div>;
  }

  return (
    <>
      {/* Phones · stacked cards */}
      <ul className="md:hidden divide-y divide-border rounded-lg border border-border bg-card board-cards">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className="flex w-full items-start justify-between gap-3 p-3 text-start"
              style={brand ? { color: "var(--bt-ink, #0B1B49)" } : undefined}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span dir="ltr" className={`font-code text-xs ${brand ? "opacity-80" : "text-muted-foreground"} ${lang === "ar" ? "text-right" : "text-left"}`}>{keyField ? formatCell(keyField, r.normalized[keyField.key], lang, currency) : r.rowKey}</span>
                {textFields.map((f) => <span key={f.key} className="truncate text-sm font-semibold"><bdi dir="auto">{formatCell(f, r.normalized[f.key], lang, currency)}</bdi></span>)}
                {dateField && <span dir="ltr" className={`text-xs tabular-nums ${brand ? "opacity-70" : "text-muted-foreground"} ${lang === "ar" ? "text-right" : "text-left"}`}>{formatCell(dateField, r.normalized[dateField.key], lang, currency)}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {moneyField && <span dir="ltr" className="font-english text-[15px] font-semibold tabular-nums">{formatCell(moneyField, r.normalized[moneyField.key], lang, currency)}</span>}
                {kanbanField && <StatusPill value={r.normalized[kanbanField]} options={statusOptions} lang={lang} />}
                {showErrors && r.valid === false && <span className="text-[11px] text-warning">⚠ {t("مشاكل", "issues")}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop · full ledger table */}
      <div className={`hidden md:block overflow-x-auto rounded-lg border ${brand ? "" : "border-border bg-card"} board-table`} style={brand ? { borderColor: "color-mix(in srgb, var(--bt-secondary, #1276E3) 35%, transparent)", background: "#fff" } : undefined}>
        <table className="w-full min-w-[720px] text-sm" style={brand ? { color: "var(--bt-ink, #0B1B49)" } : undefined}>
          <thead>
            <tr className={brand ? "border-b" : "border-b border-border"} style={headStyle}>
              {showErrors && <th className="w-8 px-2 py-2" aria-label={t("صلاحية الصف", "Row validity")} />}
              {fields.map((f) => (
                <th key={f.key} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap ${isNumericField(f) ? "text-end" : "text-start"} ${brand ? "" : "text-muted-foreground"}`}>
                  {fieldLabel(f, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = selectedId === r.id;
              return (
                <tr
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`${brand ? "border-b" : "border-b border-border"} ${onRowClick ? "cursor-pointer hover:bg-muted/40" : ""} ${selected ? "bg-primary/[0.05]" : ""} ${showErrors && r.valid === false ? "bg-warning-subtle/40" : ""}`}
                  style={brand ? { borderColor: "color-mix(in srgb, var(--bt-secondary, #1276E3) 18%, transparent)" } : undefined}
                  aria-selected={selected || undefined}
                >
                  {showErrors && (
                    <td className="px-2 py-2 text-center">
                      {r.valid === false ? <span className="text-warning" title={(r.errors || []).join(" · ")}>⚠</span> : <span className="text-success" aria-hidden="true">✓</span>}
                    </td>
                  )}
                  {fields.map((f) => {
                    const v = r.normalized[f.key];
                    if (kanbanField && f.key === kanbanField) {
                      return <td key={f.key} className="px-3 py-2 align-middle"><StatusPill value={v} options={statusOptions} lang={lang} /></td>;
                    }
                    if (isNumericField(f)) {
                      return <td key={f.key} className="px-3 py-2 text-end align-middle"><span dir="ltr" className="font-english tabular-nums whitespace-nowrap">{formatCell(f, v, lang, currency)}</span></td>;
                    }
                    if (f.type === "date" || f.key === template.keyField) {
                      return <td key={f.key} className="px-3 py-2 text-start align-middle"><span dir="ltr" className={`font-code text-xs tabular-nums whitespace-nowrap block ${lang === "ar" ? "text-right" : "text-left"}`}>{formatCell(f, v, lang, currency)}</span></td>;
                    }
                    return <td key={f.key} className="px-3 py-2 text-start align-middle max-w-[280px]"><span className="block truncate" title={v == null ? "" : String(v)}><bdi dir="auto">{formatCell(f, v, lang, currency)}</bdi></span></td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Kanban · one column per status option + «غير مصنّف» · CSS grid · read-only ─
export function BoardKanban({
  template, rows, statusOptions, lang, currency, onRowClick, brand = false,
}: {
  template: ExtTemplate;
  rows: BoardRow[];
  statusOptions: ExtStatusOption[];
  lang: BoardLang;
  currency: string;
  onRowClick?: (row: BoardRow) => void;
  brand?: boolean;
}) {
  const t = tr(lang);
  const kf = template.kanbanField;
  const fields = template.fields;
  const partyField = fields.find((f) => f.key === "party") || fields.find((f) => f.type === "text" && f.key !== template.keyField);
  const projectField = fields.find((f) => f.key === "project");
  const totalField = fields.find((f) => f.key === "total") || fields.find((f) => f.type === "money");
  const dateField = fields.find((f) => f.type === "date");
  const keyField = fields.find((f) => f.key === template.keyField);

  if (!kf) {
    return <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-10 text-center text-sm text-muted-foreground">{t("هذا القالب لا يحتوي عمود حالة لعرض Kanban", "This template has no status column for a kanban view")}</div>;
  }

  const known = new Set(statusOptions.map((o) => o.value));
  const columns: Array<{ key: string; label: string; color: ExtStatusColor; rows: BoardRow[] }> = statusOptions.map((o) => ({
    key: o.value, label: lang === "ar" ? o.labelAr : o.labelEn, color: o.color,
    rows: rows.filter((r) => String(r.normalized[kf] ?? "") === o.value),
  }));
  const other = rows.filter((r) => { const v = r.normalized[kf]; return v === null || v === undefined || v === "" || !known.has(String(v)); });
  columns.push({ key: "__other", label: t("غير مصنّف", "Unclassified"), color: "neutral", rows: other });

  return (
    <div className="overflow-x-auto pb-2 board-kanban">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))`, minWidth: `${columns.length * 250}px` }}>
        {columns.map((col) => {
          const sum = totalField ? col.rows.reduce((s, r) => s + (Number(r.normalized[totalField.key]) || 0), 0) : 0;
          return (
            <section
              key={col.key}
              className={`flex flex-col rounded-xl border ${brand ? "" : "border-border bg-muted/30"}`}
              style={brand ? { background: "var(--bt-fill, #F4FCFF)", borderColor: "color-mix(in srgb, var(--bt-secondary, #1276E3) 35%, transparent)" } : undefined}
              aria-label={col.label}
            >
              <header
                className={`flex items-center justify-between gap-2 rounded-t-xl px-3 py-2 ${brand ? "text-white" : "bg-foreground text-background"}`}
                style={brand ? { background: "var(--bt-primary, #0B1B49)" } : undefined}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
                  <span aria-hidden="true">{STATUS_MARK[col.color]}</span>{col.label}
                </span>
                <span dir="ltr" className="font-english text-xs tabular-nums opacity-90 shrink-0">{fmtNumber(col.rows.length, lang)}</span>
              </header>
              {totalField && (
                <div dir="ltr" className={`px-3 py-1.5 text-xs font-english tabular-nums ${lang === "ar" ? "text-right" : "text-left"} ${brand ? "opacity-80" : "text-muted-foreground"}`} style={brand ? { color: "var(--bt-ink, #0B1B49)" } : undefined}>
                  {fmtMoney(sum, currency, lang)}
                </div>
              )}
              <div className="flex flex-col gap-2 p-2 min-h-[80px]">
                {col.rows.length === 0 && <div className={`py-4 text-center text-xs ${brand ? "opacity-60" : "text-muted-foreground"}`}>{t("لا شيء هنا", "Nothing here")}</div>}
                {col.rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={`rounded-lg border bg-card p-3 text-start shadow-sm ${onRowClick ? "hover:border-primary/50" : "cursor-default"} ${brand ? "" : "border-border"}`}
                    style={brand ? { borderColor: "color-mix(in srgb, var(--bt-secondary, #1276E3) 45%, transparent)", color: "var(--bt-ink, #0B1B49)", background: "#fff" } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex flex-col gap-0.5">
                        {keyField && <span dir="ltr" className={`font-code text-[11px] ${brand ? "opacity-70" : "text-muted-foreground"} ${lang === "ar" ? "text-right" : "text-left"}`}>{formatCell(keyField, r.normalized[keyField.key], lang, currency)}</span>}
                        {partyField && <span className="truncate text-sm font-semibold"><bdi dir="auto">{formatCell(partyField, r.normalized[partyField.key], lang, currency)}</bdi></span>}
                        {projectField && r.normalized[projectField.key] ? <span className={`truncate text-xs ${brand ? "opacity-80" : "text-muted-foreground"}`}><bdi dir="auto">{formatCell(projectField, r.normalized[projectField.key], lang, currency)}</bdi></span> : null}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {dateField && <span dir="ltr" className={`text-[11px] tabular-nums ${brand ? "opacity-70" : "text-muted-foreground"}`}>{formatCell(dateField, r.normalized[dateField.key], lang, currency)}</span>}
                      {totalField && <span dir="ltr" className="font-english text-sm font-semibold tabular-nums">{formatCell(totalField, r.normalized[totalField.key], lang, currency)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ── Source status pill (🟢 ACTIVE · 🟡 PAUSED · 🔴 ERROR) · mark + word ───────
export function SourceStatusPill({ status, lang }: { status: "ACTIVE" | "PAUSED" | "ERROR"; lang: BoardLang }) {
  const t = tr(lang);
  const map = {
    ACTIVE: { cls: STATUS_CLASS.good, dot: "🟢", word: t("نشط", "Active") },
    PAUSED: { cls: STATUS_CLASS.attention, dot: "🟡", word: t("متوقف مؤقتًا", "Paused") },
    ERROR: { cls: STATUS_CLASS.blocking, dot: "🔴", word: t("خطأ", "Error") },
  } as const;
  const m = map[status] || map.ERROR;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${m.cls}`}><span aria-hidden="true">{m.dot}</span>{m.word}</span>;
}
