import type { CSSProperties } from "react";
import type { ReportPayload, ReportPrintSettings, ReportRow } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { BidiText, NumericText } from "./bidi-text";

const defaultSettings: Required<ReportPrintSettings> = {
  logoSource: "print",
  paper: "A4",
  orientation: "portrait",
  language: "ar",
  fontScale: "normal",
  density: "standard",
  primaryColor: "#0B1B49",
  accentColor: "#1276E3",
  showCompanyInfo: true,
  showTaxInfo: true,
  showFooter: true,
  showPreparedBy: true,
};

const moneyKeys = new Set(["amount", "total", "paid", "open", "tax", "subtotal", "gross", "net", "debit", "credit", "balance", "value"]);

// Total rows are API rows whose id carries the total marker (e.g.
// assets-total, net-income). They get the classic accounting weight: bold
// with a rule above — no API change required.
function isTotalRow(row: ReportRow) {
  return /(^|-)total$/.test(row.id) || row.id === "net-income" || row.id === "current-earnings";
}

export function normalizeReportSettings(settings?: ReportPrintSettings | null): Required<ReportPrintSettings> {
  return { ...defaultSettings, ...(settings || {}) };
}

export function ReportDocument({
  report,
  settings,
  mode = "screen",
  onRowClick,
}: {
  report: ReportPayload;
  settings?: ReportPrintSettings | null;
  mode?: "screen" | "print";
  onRowClick?: (row: ReportRow) => void;
}) {
  const { t, language: appLanguage } = useLanguage();
  // The document language follows the org's explicit print-setting when set;
  // otherwise it follows the APP UI language — an English app must render an
  // English report, never Arabic chrome (product rule: no language mixing).
  const resolved = { ...normalizeReportSettings(settings), language: settings?.language || appLanguage };
  const isEn = resolved.language === "en";
  const dir = isEn ? "ltr" : "rtl";
  const logo = resolved.logoSource === "none" ? null : resolved.logoSource === "main" ? report.org.logoUrl : report.org.printLogoUrl || report.org.logoUrl;
  const fontSize = resolved.fontScale === "large" ? 14 : resolved.fontScale === "compact" ? 11.5 : 12.5;
  // Compact-first density: large charts of accounts must fit on fewer pages.
  const cellPadding = resolved.density === "comfortable" ? "8px 14px" : resolved.density === "compact" ? "4px 10px" : "6px 12px";
  const paperWidth =
    mode === "print"
      ? "100%"
      : resolved.paper === "Letter"
        ? resolved.orientation === "landscape" ? "1056px" : "816px"
        : resolved.orientation === "landscape" ? "1122px" : "794px";

  const style = {
    "--report-primary": resolved.primaryColor,
    "--report-accent": resolved.accentColor,
    "--report-font-size": `${fontSize}px`,
    "--report-cell-padding": cellPadding,
    width: paperWidth,
  } as CSSProperties;

  const reportTitle = resolved.language === "en" ? report.englishTitle : report.title;
  const companyLine = [report.org.addressLine, report.org.city, report.org.region, report.org.postalCode].filter(Boolean).join(" · ");
  const contactLine = [report.org.email, report.org.phone, report.org.website].filter(Boolean).join(" · ");
  const taxLine = [
    report.org.vatNumber ? `${t("الرقم الضريبي", "VAT")} ${report.org.vatNumber}` : null,
    report.org.crNumber ? `${t("السجل التجاري", "CR")} ${report.org.crNumber}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article
      className="entix-report-paper document-paper overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
      dir={dir}
      style={style}
    >
      {/* Reference chrome (user-approved Wave-style P&L): client logo pinned
          TOP RIGHT, title block TOP LEFT — physically LTR in BOTH languages.
          No software brand, no gradient, no status chips. */}
      <header dir="ltr" className="border-b-2 px-8 pb-5 pt-7" style={{ borderColor: "var(--report-primary)" }}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 text-left">
            <h1 className="document-title" style={{ color: "var(--report-primary)" }}>
              <BidiText mode="plaintext">{reportTitle}</BidiText>
            </h1>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              <BidiText mode="plaintext">{report.org.legalName || report.org.name}</BidiText>
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              <div>
                {t("الفترة", "Date Range")}: <NumericText>{report.period.from}</NumericText> {t("إلى", "to")} <NumericText>{report.period.to}</NumericText>
                {" · "}
                <NumericText>{report.currency}</NumericText>
              </div>
              {resolved.showCompanyInfo && companyLine ? <div><BidiText mode="plaintext">{companyLine}</BidiText></div> : null}
              {resolved.showCompanyInfo && contactLine ? <div><BidiText mode="plaintext">{contactLine}</BidiText></div> : null}
              {resolved.showTaxInfo && taxLine ? <div><BidiText mode="plaintext">{taxLine}</BidiText></div> : null}
            </div>
          </div>
          <div className="shrink-0">
            {logo ? (
              <img src={logo} alt={report.org.name} className="max-h-14 max-w-[170px] object-contain" />
            ) : (
              <div className="inline-flex h-14 min-w-14 items-center justify-center rounded-lg px-3 text-base font-bold text-white" style={{ background: "var(--report-primary)" }}>
                {report.org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="space-y-5 px-8 py-5" style={{ fontSize: "var(--report-font-size)" }}>
        {report.notices?.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {report.notices.join(" · ")}
          </div>
        ) : null}

        {report.sections.map((section) => (
          <section key={section.id} className="document-keep-together break-inside-avoid">
            <div className="mb-1.5">
              <h2 className="document-section-title" style={{ color: "var(--report-primary)" }}><BidiText mode="plaintext">{section.title}</BidiText></h2>
              {section.description && <p className="mt-0.5 text-xs text-slate-500"><BidiText mode="plaintext">{section.description}</BidiText></p>}
            </div>
            <table className="document-table w-full border-collapse">
              <thead>
                <tr style={{ borderTop: "1.5px solid var(--report-primary)", borderBottom: "1px solid #cbd5e1" }}>
                  {section.columns.map((column) => (
                    <th
                      key={column.key}
                      className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
                      style={{ padding: "var(--report-cell-padding)", textAlign: alignToCss(column.align) }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.length ? section.rows.map((row) => {
                  const totalRow = isTotalRow(row);
                  return (
                    <tr
                      key={row.id}
                      className={onRowClick ? "cursor-pointer transition hover:bg-slate-50" : ""}
                      onClick={() => onRowClick?.(row)}
                    >
                      {section.columns.map((column) => (
                        <td
                          key={`${row.id}-${column.key}`}
                          className={totalRow ? "border-t border-slate-300 font-bold text-slate-900" : "border-b border-slate-100 text-slate-700"}
                          style={{ padding: "var(--report-cell-padding)", textAlign: alignToCss(column.align) }}
                        >
                          <CellValue value={row.values[column.key]} keyName={column.key} kind={column.kind} currency={report.currency} strong={totalRow} />
                        </td>
                      ))}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={section.columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                      {t("لا توجد بيانات في هذا القسم خلال الفترة المحددة.", "No data in this section for the selected period.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        ))}
      </main>

      {resolved.showFooter && (
        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 px-8 py-3 text-[11px] text-slate-400">
          <span className="min-w-0 truncate"><BidiText mode="plaintext">{reportTitle}</BidiText> · <BidiText mode="plaintext">{report.org.name}</BidiText></span>
          <span className="hidden sm:inline">
            {t("أُنشئ في", "Created on")} <NumericText>{new Date(report.generatedAt).toLocaleDateString(isEn ? "en-GB" : "ar-SA")}</NumericText>
            {" · "}
            {t("الفترة", "Date Range")}: <NumericText>{report.period.from}</NumericText> {t("إلى", "to")} <NumericText>{report.period.to}</NumericText>
          </span>
          <span className="print-page-number">Page 1</span>
        </footer>
      )}
    </article>
  );
}

function alignToCss(align?: "start" | "end" | "center") {
  if (align === "end") return "end";
  if (align === "center") return "center";
  return "start";
}

function CellValue({ value, keyName, kind, currency, strong }: { value: string | number | null | undefined; keyName: string; kind?: string; currency: string; strong?: boolean }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">—</span>;
  if (kind === "money" || moneyKeys.has(keyName)) {
    const amount = Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return <NumericText className={Number(value) < 0 ? "font-semibold text-red-700" : strong ? "font-bold text-slate-900" : "font-semibold text-slate-900"}>{amount} {currency}</NumericText>;
  }
  if (kind === "number" && typeof value === "number") return <NumericText>{value.toLocaleString("en-US")}</NumericText>;
  if (kind === "status") return <BidiText className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{String(value)}</BidiText>;
  return <BidiText mode="plaintext">{String(value)}</BidiText>;
}
