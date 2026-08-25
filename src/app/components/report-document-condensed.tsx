/**
 * Condensed bilingual report template (CEO 2026-08-25 · Z12).
 *
 * Reference: EN-FIN-REF-Report-Style-Sample-Condensed-AR-EN-V01.pdf —
 *   · header: logo on one side, Arabic company name (bold) + letter-spaced
 *     English legal name on the other,
 *   · centred bilingual title block + «(In <currency> · period)» line,
 *   · centred bilingual section titles «English — العربية»,
 *   · condensed tables: tinted alternating rows, thin rules, tabular numbers,
 *     total rows bold with a rule above,
 *   · management/notes commentary block,
 *   · footer PINNED to the bottom of every printed page (disclaimer + ©).
 *
 * Bilingual labels arrive from the API joined by U+241F (?bilingual=1); a
 * plain string renders in the document language only. Numbers are always
 * Latin digits (product rule) and keep 2 decimals.
 */
import type { CSSProperties } from "react";
import type { ReportPayload, ReportRow } from "../lib/api";
import type { NormalizedReportSettings } from "./report-document";
import { NumericText } from "./bidi-text";

const SEP = "␟";
export function splitBi(value: string | null | undefined): { ar: string; en: string } {
  const s = String(value ?? "");
  const i = s.indexOf(SEP);
  if (i < 0) return { ar: s, en: "" };
  return { ar: s.slice(0, i).trim(), en: s.slice(i + 1).trim() };
}

const moneyKeys = new Set(["amount", "total", "paid", "open", "tax", "subtotal", "gross", "net", "debit", "credit", "balance", "value"]);
const isTotalRow = (row: ReportRow) => /(^|-)total$/.test(row.id) || row.id === "net-income" || row.id === "current-earnings";
const num = (v: number) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Bi({ value, lang, primary, size = "md" }: { value: string; lang: "ar" | "en"; primary?: boolean; size?: "sm" | "md" | "lg" }) {
  const { ar, en } = splitBi(value);
  const both = ar && en;
  const main = lang === "ar" ? ar || en : en || ar;
  const alt = lang === "ar" ? en : ar;
  const mainCls = size === "lg" ? "text-[15px] font-bold" : size === "sm" ? "text-[11px] font-semibold" : "text-[12.5px] font-bold";
  const altCls = size === "lg" ? "text-[11px] font-semibold tracking-wide" : "text-[10px] font-medium";
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={mainCls} style={primary ? { color: "var(--report-primary)" } : undefined} dir={lang === "ar" ? "rtl" : "ltr"}>{main}</span>
      {both && alt ? <span className={`${altCls} text-slate-500`} dir={lang === "ar" ? "ltr" : "rtl"}>{alt}</span> : null}
    </span>
  );
}

export function CondensedReportDocument({ report, resolved, mode, onRowClick, t }: {
  report: ReportPayload;
  resolved: NormalizedReportSettings & { language: "ar" | "en" };
  mode: "screen" | "print";
  onRowClick?: (row: ReportRow) => void;
  t: (ar: string, en: string) => string;
}) {
  const lang = resolved.language;
  const isEn = lang === "en";
  const dir = isEn ? "ltr" : "rtl";
  const logo = resolved.logoSource === "none" ? null : resolved.logoSource === "main" ? report.org.logoUrl : report.org.printLogoUrl || report.org.logoUrl;
  const fontSize = resolved.fontScale === "large" ? 12.5 : resolved.fontScale === "compact" ? 10.5 : 11.5;
  const pad = resolved.density === "comfortable" ? "7px 10px" : resolved.density === "compact" ? "3px 8px" : "5px 10px";
  const paperWidth = mode === "print" ? "100%" : resolved.paper === "Letter" ? (resolved.orientation === "landscape" ? "1056px" : "816px") : (resolved.orientation === "landscape" ? "1122px" : "794px");
  const paperMinHeight = mode === "print" ? undefined : resolved.paper === "Letter" ? (resolved.orientation === "landscape" ? "816px" : "1056px") : (resolved.orientation === "landscape" ? "794px" : "1123px");

  const style = { "--report-primary": resolved.primaryColor, "--report-accent": resolved.accentColor, "--report-font-size": `${fontSize}px`, "--report-cell-padding": pad, width: paperWidth, minHeight: paperMinHeight } as CSSProperties;

  const nameAr = report.org.name || report.org.legalName || "";
  const nameEn = (report.org as any).legalName && (report.org as any).legalName !== report.org.name ? (report.org as any).legalName : "";
  const currencyLine = t(`(المبالغ بـ ${report.currency} · غير مدققة)`, `(In ${report.currency} · unaudited)`);
  const periodLine = `${report.period.from} → ${report.period.to}`;
  const taxLine = resolved.showTaxInfo ? [report.org.vatNumber ? `${t("الرقم الضريبي", "VAT")} ${report.org.vatNumber}` : null, report.org.crNumber ? `${t("س.ت", "CR")} ${report.org.crNumber}` : null].filter(Boolean).join(" · ") : "";
  const companyLine = resolved.showCompanyInfo ? [report.org.addressLine, report.org.city, report.org.phone, report.org.email].filter(Boolean).join(" · ") : "";
  const year = new Date(report.generatedAt || Date.now()).getFullYear();
  const generated = new Date(report.generatedAt).toLocaleString(isEn ? "en-GB" : "ar-SA-u-nu-latn", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <article className="entix-report-paper document-paper report-condensed flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none" dir={dir} style={style}>
      {/* ── header ── */}
      <header className="flex items-start justify-between gap-6 px-8 pt-7">
        <div className="min-w-0 text-start">
          <div className="text-[17px] font-extrabold leading-tight text-slate-900" dir="auto">{nameAr}</div>
          {nameEn ? <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" dir="ltr">{nameEn}</div> : null}
          {taxLine ? <div className="mt-1 text-[10px] text-slate-500"><NumericText>{taxLine}</NumericText></div> : null}
          {companyLine ? <div className="text-[10px] text-slate-500" dir="auto">{companyLine}</div> : null}
        </div>
        {logo ? <img src={logo} alt="" className="max-h-12 max-w-[150px] shrink-0 object-contain" /> : null}
      </header>

      {/* ── title block ── */}
      <div className="px-8 pb-2 pt-6 text-center">
        <h1 className="text-[17px] font-extrabold leading-tight text-slate-900" dir="rtl">{report.title}</h1>
        <div className="mt-0.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--report-primary)" }} dir="ltr">{report.englishTitle}</div>
        <div className="mt-1 text-[10.5px] text-slate-500"><NumericText>{periodLine}</NumericText> · {currencyLine}</div>
      </div>

      {/* ── body ── */}
      <main className="flex-1 space-y-5 px-8 pb-6 pt-3" style={{ fontSize: "var(--report-font-size)" }}>
        {report.notices?.length ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] leading-5 text-amber-800">{report.notices.join(" · ")}</div>
        ) : null}
        {report.sections.map((section) => {
          const columns = resolved.showNotes ? section.columns : section.columns.filter((c) => c.key !== "note");
          return (
            <section key={section.id} className="document-keep-together break-inside-avoid">
              <div className="mb-1.5 text-center">
                <Bi value={section.title} lang={lang} primary size="md" />
                {section.description ? <div className="mt-0.5 text-[10px] text-slate-500"><Bi value={section.description} lang={lang} size="sm" /></div> : null}
              </div>
              <table className="document-table w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--report-primary)" }}>
                    {columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap text-[10px] font-semibold text-slate-600" style={{ padding: "var(--report-cell-padding)", textAlign: column.align === "end" ? "end" : column.align === "center" ? "center" : "start" }}>
                        <Bi value={column.label} lang={lang} size="sm" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length ? section.rows.map((row, i) => {
                    const total = isTotalRow(row);
                    const depth = Math.min(Math.max(row.depth ?? 0, 0), 5);
                    return (
                      <tr key={row.id} className={`${i % 2 === 1 && !total ? "bg-[#F5F7FB]" : ""}${onRowClick ? " cursor-pointer hover:bg-slate-100/70" : ""}`} onClick={() => onRowClick?.(row)} style={{ borderBottom: "1px solid #EEF1F6" }}>
                        {columns.map((column) => {
                          const v = row.values[column.key];
                          const money = column.kind === "money" || moneyKeys.has(column.key);
                          const align = column.align === "end" ? "end" : column.align === "center" ? "center" : "start";
                          return (
                            <td key={`${row.id}-${column.key}`}
                              className={`${total ? "border-t border-slate-400 font-bold text-slate-900" : "text-slate-800"}${column.key === "label" ? " max-w-0 overflow-hidden text-ellipsis whitespace-nowrap" : " whitespace-nowrap"}`}
                              style={{ padding: "var(--report-cell-padding)", textAlign: align, ...(column.key === "label" && depth > 0 ? { paddingInlineStart: `${depth * 16 + 10}px`, color: "#475569" } : {}) }}
                              title={column.key === "label" ? String(v ?? row.label) : undefined}>
                              {v === null || v === undefined || v === "" ? <span className="text-slate-400">—</span>
                                : money ? <NumericText className={Number(v) < 0 ? "font-semibold text-red-700" : total ? "font-bold" : "font-medium"}>{Number(v) < 0 ? `(${num(Math.abs(Number(v)))})` : num(Number(v))}</NumericText>
                                : column.kind === "number" && typeof v === "number" ? <NumericText>{v.toLocaleString("en-US")}</NumericText>
                                : column.key === "label" ? <span dir="auto">{String(v)}</span>
                                : <Bi value={String(v)} lang={lang} size="sm" />}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={columns.length} className="px-4 py-4 text-center text-[11px] text-slate-500">{t("لا توجد بيانات في هذا القسم خلال الفترة المحددة.", "No data in this section for the selected period.")}</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          );
        })}
        {resolved.preparedBy ? (
          <div className="pt-2 text-[10.5px] text-slate-600"><span className="font-semibold">{t("أُعدّ بواسطة", "Prepared by")}:</span> <span dir="auto">{resolved.preparedBy}</span></div>
        ) : null}
      </main>

      {/* ── footer · pinned to the page bottom (print: fixed on every page) ── */}
      {resolved.showFooter && (
        <footer className="report-condensed-footer mt-auto border-t border-slate-200 px-8 py-3 text-[9.5px] leading-4 text-slate-500">
          {resolved.footerNote ? <div className="mb-1 text-slate-500" dir="auto">{resolved.footerNote}</div> : null}
          <div className="flex items-center justify-between gap-4">
            <span className="min-w-0 truncate">© {year} <span dir="auto">{report.org.legalName || report.org.name}</span> — {t("جميع الحقوق محفوظة", "All rights reserved")}{report.org.website ? ` · ${report.org.website}` : ""}</span>
            <span className="shrink-0"><NumericText>{report.id}</NumericText> · {t("أُنشئ", "Generated")} <NumericText>{generated}</NumericText></span>
          </div>
        </footer>
      )}
    </article>
  );
}
