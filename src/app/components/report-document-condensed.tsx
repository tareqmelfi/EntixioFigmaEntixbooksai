import { reportAppearance, reportTheme, reportSign } from '../lib/report-appearance';
import { reportPaperSize } from '../lib/report-pagination';
import { ReportEquation } from './report-equation';
import { isMonthlyReport, reportColumnWidth, reportColumnLabel, reportLayoutSections } from "../lib/report-layout";
import { displayLocale } from "../lib/number-display";
/**
 * Condensed bilingual report template (CEO 2026-08-25 · Z12).
 *
 * Reference: EN-FIN-REF-Report-Style-Sample-Condensed-AR-EN-V01.pdf —
 *   · first-sheet header: logo left, centred title/period/currency, company right,
 *   · small company details and compact bilingual tables,
 *   · centred bilingual section titles «English — العربية»,
 *   · condensed tables: tinted alternating rows, thin rules, tabular numbers,
 *     total rows bold with a rule above,
 *   · management/notes commentary block,
 *   · one-line footer at the bottom of every sheet; notes follow the tables.
 *
 * Bilingual labels arrive from the API joined by U+241F (?bilingual=1); a
 * plain string renders in the document language only. Numbers use the explicit display preference (Western by default)
 * and keep 2 decimals.
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
const num = (v: number) => Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Bi({ value, lang, primary, size = "md", both: bothEnabled = true, currency }: { value: string; lang: "ar" | "en"; primary?: boolean; size?: "sm" | "md" | "lg"; both?: boolean; currency?: string }) {
  const { ar, en } = splitBi(value);
  const both = bothEnabled && ar && en;
  const main = lang === "ar" ? ar || en : en || ar;
  const alt = lang === "ar" ? en : ar;
  const mainCls = size === "lg" ? "text-[15px] font-bold" : size === "sm" ? "text-[11px] font-medium" : "text-[12.5px] font-bold";
  const altCls = size === "lg" ? "text-[11px] font-semibold tracking-wide" : "text-[10px] font-medium";
  return (
    <span className="report-bilingual inline-flex flex-wrap items-baseline gap-x-2">
      <span className={mainCls} style={primary ? { color: "var(--report-primary)" } : undefined} ><bdi dir={lang === "ar" ? "rtl" : "ltr"}>{main}</bdi>{currency && <span className="report-column-currency font-normal"><bdi dir="ltr">({currency})</bdi></span>}</span>
      {both && alt ? <span className={`${altCls} text-muted-foreground`} ><bdi dir={lang === "ar" ? "ltr" : "rtl"}>{alt}</bdi></span> : null}
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
  // Bilingual pairs only when the company wants them (explicit setting) — default
  // ON for Saudi companies, OFF elsewhere (a US company never shows Arabic chrome).
  const orgCountry = (report.org as any).country || "SA";
  const bilingual = typeof (resolved as any).bilingual === "boolean" ? (resolved as any).bilingual : orgCountry === "SA";
  const dir = isEn ? "ltr" : "rtl";
  const logo = resolved.logoSource === "none" ? null : resolved.logoSource === "main" ? report.org.logoUrl : report.org.printLogoUrl || report.org.logoUrl;
  const fontSize = resolved.fontScale === "large" ? 12.5 : resolved.fontScale === "compact" ? 10 : 10.5;
  const pad = resolved.density === "comfortable" ? "6px 8px" : resolved.density === "compact" ? "1.5px 4px" : "2px 5px";
  const dimensions = reportPaperSize(resolved);
  const style = { ...reportAppearance(resolved), "--report-accent": resolved.accentColor, "--report-font-size": `${fontSize}px`, "--report-cell-padding": pad, width: mode === "print" ? "100%" : `${dimensions.width}mm`, minHeight: mode === "print" ? undefined : `${dimensions.height}mm` } as CSSProperties;

  const nameAr = report.org.name || report.org.legalName || "";
  const nameEn = (report.org as any).legalName && (report.org as any).legalName !== report.org.name ? (report.org as any).legalName : "";
  const perRowCurrency = report.sections.some(s => s.columns.some(c => c.key === "currency"));
  const currencyLine = perRowCurrency ? t("(المبالغ حسب عملة كل صف · غير مدققة)", "(Amounts in each row’s currency · unaudited)") : t(`عملة التقرير: ${report.currency} · غير مدققة`, `report currency: ${report.currency} · unaudited`);
  const periodLine = `${report.period.allTime ? (isEn ? "All recorded periods" : "كل الفترات المسجلة") : report.period.from ?? "—"} → ${report.period.to}`;
  const taxLine = resolved.showTaxInfo ? [report.org.vatNumber ? `${t("الرقم الضريبي", "VAT")} ${report.org.vatNumber}` : null, report.org.crNumber ? `${t("س.ت", "CR")} ${report.org.crNumber}` : null].filter(Boolean).join(" · ") : "";
  const companyLine = resolved.showCompanyInfo ? [report.org.addressLine, report.org.city, report.org.phone, report.org.email].filter(Boolean).join(" · ") : "";
  const year = new Date(report.generatedAt || Date.now()).getFullYear();
  const generated = new Date(report.generatedAt).toLocaleString(displayLocale(isEn ? "en-GB" : "ar-SA-u-nu-latn"), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <article className={`entix-report-paper document-paper ${reportTheme(resolved)} report-condensed flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none ${isMonthlyReport(report) ? "report-monthly" : ""} ${report.id === "trial-balance" && report.sections.some(section => section.columns.some(column => column.key === "openingDebit")) ? "report-trial-balance" : ""}`} dir={dir} style={style}>
      {/* Branding belongs to the first sheet; the title stays centred on the paper. */}
      <header className="report-compact-header">
        <div className="report-company text-foreground" dir={dir}>
          <div className="report-company-name" dir="auto">{nameAr}</div>
          {nameEn ? <div dir="ltr">{nameEn}</div> : null}
          {taxLine ? <div><NumericText>{taxLine}</NumericText></div> : null}
          {companyLine ? <div dir="auto">{companyLine}</div> : null}
        </div>
        <div className="report-heading text-center" dir={dir}>
          <h1 style={{ color: "var(--report-primary)" }}>{isEn ? report.englishTitle : report.title}</h1>
          {bilingual ? <div className="report-heading-alternate" dir={isEn ? "rtl" : "ltr"}>{isEn ? report.title : report.englishTitle}</div> : null}
          <div><NumericText>{periodLine}</NumericText></div>
          <div data-testid={perRowCurrency ? undefined : "report-currency-badge"}>{currencyLine}</div>
        </div>
        <div className="report-logo">{logo ? <img src={logo} alt="" /> : null}</div>
      </header>

      {/* ── body ── */}
      <main className="report-compact-body flex-1" style={{ fontSize: "var(--report-font-size)" }}>
        {report.notices?.length ? (
          <div className="report-notice border border-warning-border bg-warning-subtle text-warning">{report.notices.map(value => { const pair = splitBi(value); return isEn ? (pair.en || pair.ar) : (pair.ar || pair.en); }).join(" · ")}</div>
        ) : null}
        {resolved.showEquation && <ReportEquation report={report} t={t} />}
        {!report.sections.length && <p role="status">{t("لا تتوفر بيانات لهذا التقرير خلال الفترة المحددة.", "No report data is available for the selected period.")}</p>}
        {reportLayoutSections(report, resolved).map((section) => {
          const columns = resolved.showNotes ? section.columns : section.columns.filter((c) => c.key !== "note");
          const sectionHasCurrency = columns.some(c => c.key === "currency");
          const title = splitBi(section.title);
          const sameTitle = (isEn ? title.en || title.ar : title.ar || title.en) === (isEn ? report.englishTitle : report.title);
          return (
            <section key={section.id} data-section-id={section.id} className="document-keep-together break-inside-avoid">
              <div className="report-section-heading text-center">
                {!sameTitle && <Bi value={section.title} lang={lang} primary size="md" both={bilingual} />}
                {section.description ? <div className="mt-0.5 text-[10px] text-muted-foreground"><Bi value={section.description} lang={lang} size="sm" both={bilingual} /></div> : null}
              </div>
              <table className="document-table report-readable-table w-full border-collapse">
                <colgroup>{columns.map(column => <col key={column.key} style={reportColumnWidth(section, column)} />)}</colgroup>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--report-primary)" }}>
                    {columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground" style={{ padding: "var(--report-cell-padding)", textAlign: column.align === "end" ? "end" : column.align === "center" ? "center" : "start" }}>
                        <Bi value={reportColumnLabel(column)} lang={lang} size="sm" both={bilingual}
                          currency={!sectionHasCurrency && (column.kind === "money" || moneyKeys.has(column.key)) ? report.currency : undefined} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length ? section.rows.map((row, i) => {
                    const total = isTotalRow(row);
                    const depth = Math.min(Math.max(row.depth ?? 0, 0), 5);
                    return (
                      <tr key={row.id} data-total={total || undefined} data-depth={depth} className={`${i % 2 === 1 && !total ? "bg-[#F5F7FB]" : ""}${onRowClick ? " cursor-pointer hover:bg-surface-hover/70" : ""}`} onClick={() => onRowClick?.(row)} style={{ borderBottom: "1px solid #EEF1F6" }}>
                        {columns.map((column) => {
                          const v = row.values[column.key];
                          const money = column.kind === "money" || moneyKeys.has(column.key);
                          const align = column.align === "end" ? "end" : column.align === "center" ? "center" : "start";
                          return (
                            <td key={`${row.id}-${column.key}`}
                              className={`${total ? "border-t border-border-strong font-bold text-foreground" : "text-foreground"}${column.key === "label" ? (report.id === "trial-balance" ? " whitespace-normal break-words" : " max-w-0 overflow-hidden text-ellipsis whitespace-nowrap") : " whitespace-nowrap"}`}
                              style={{ padding: "var(--report-cell-padding)", textAlign: align, ...(column.key === "label" && depth > 0 ? { paddingInlineStart: `${depth * 16 + 10}px`, color: "#475569" } : {}) }}
                              title={column.key === "label" ? String(v ?? row.label) : undefined}>
                              {v === null || v === undefined || v === "" ? <span className="text-muted-foreground">—</span>
                                : money ? <NumericText className={`${reportSign(v)} ${total ? "font-bold" : "font-medium"}`}>{Number(v) < 0 ? `(${num(Math.abs(Number(v)))})` : num(Number(v))}</NumericText>
                                : column.kind === "number" && typeof v === "number" ? <NumericText className={reportSign(v)}>{v.toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })}</NumericText>
                                : column.key === "label" ? <Bi value={String(v)} lang={lang} size="sm" both={bilingual} />
                                : <Bi value={String(v)} lang={lang} size="sm" both={bilingual} />}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={columns.length} className="px-4 py-4 text-center text-[11px] text-muted-foreground">{t("لا توجد بيانات في هذا القسم خلال الفترة المحددة.", "No data in this section for the selected period.")}</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          );
        })}
        {resolved.showFooter && resolved.footerNote ? <p className="report-footer-note text-muted-foreground" dir="auto">{resolved.footerNote}</p> : null}
        {resolved.preparedBy ? (
          <div className="pt-2 text-[10.5px] text-muted-foreground"><span className="font-semibold">{t("أُعدّ بواسطة", "Prepared by")}:</span> <span dir="auto">{resolved.preparedBy}</span></div>
        ) : null}
      </main>

      {/* ── footer · pinned to the page bottom (print: fixed on every page) ── */}
      {resolved.showFooter && (
        <footer className="report-condensed-footer text-muted-foreground">
          <span className="report-footer-company">© {year} <span dir="auto">{report.org.legalName || report.org.name}</span>{report.org.website ? ` · ${report.org.website}` : ""}</span>
          <span className="report-footer-code"><NumericText>{report.id}</NumericText> · <NumericText>{generated}</NumericText></span>
        </footer>
      )}
    </article>
  );
}
