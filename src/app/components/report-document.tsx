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
  showNotes: false,
};

const moneyKeys = new Set(["amount", "total", "paid", "open", "tax", "subtotal", "gross", "net", "debit", "credit", "balance", "value"]);

// Total rows are API rows whose id carries the total marker (e.g.
// assets-total, net-income). They get the classic accounting weight: bold
// with a rule above — no API change required.
function isTotalRow(row: ReportRow) {
  return /(^|-)total$/.test(row.id) || row.id === "net-income" || row.id === "current-earnings";
}

const fmt = (value: number, currency: string) =>
  `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/** Wave-style equation strip: revenue − expenses = net, straight under the
 * header so the arithmetic is visible before any table (user ask 2026-08-19). */
function EquationStrip({ report, currency }: { report: ReportPayload; currency: string }) {
  const { t } = useLanguage();
  if (report.id !== "income-statement") return null;
  const summary = report.sections.find((s) => s.id === "income-summary");
  if (!summary) return null;
  const amount = (id: string) => {
    const row = summary.rows.find((r) => r.id === id);
    return row ? Number(row.values.amount ?? 0) : null;
  };
  const revenue = amount("revenue");
  const expenses = amount("expenses");
  const net = amount("net-income");
  if (revenue === null || expenses === null || net === null) return null;
  return (
    <div className="report-equation mb-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border border-slate-200 bg-slate-50/70 px-4 py-3 text-center" dir="ltr">
      <span className="text-xs text-slate-500">{t("الإيرادات", "Revenue")}</span>
      <NumericText className="text-base font-bold text-slate-900">{fmt(revenue, currency)}</NumericText>
      <span className="text-lg font-bold text-slate-400">−</span>
      <span className="text-xs text-slate-500">{t("المصروفات", "Expenses")}</span>
      <NumericText className="text-base font-bold text-slate-900">{fmt(expenses, currency)}</NumericText>
      <span className="text-lg font-bold text-slate-400">=</span>
      <span className="text-xs text-slate-500">{t("صافي الربح / الخسارة", "Net income / (loss)")}</span>
      <NumericText className={`text-lg font-bold ${net < 0 ? "text-red-700" : "text-emerald-700"}`}>{fmt(net, currency)}</NumericText>
    </div>
  );
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
      className="entix-report-paper document-paper overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
      dir={dir}
      style={style}
    >
      {/* Header follows the DOCUMENT direction: an Arabic report aligns text
          to the right with the logo on the left; English keeps the Wave
          layout (title left, logo right). No logo → nothing renders. */}
      <header className="border-b-2 px-6 pb-4 pt-5" style={{ borderColor: "var(--report-primary)" }}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 text-start">
            <h1 className="document-title" style={{ color: "var(--report-primary)" }}>
              <BidiText mode="plaintext">{reportTitle}</BidiText>
            </h1>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">
              <BidiText mode="plaintext">{report.org.legalName || report.org.name}</BidiText>
            </div>
            <div className="mt-1.5 text-xs leading-5 text-slate-500">
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
          {logo ? (
            <div className="shrink-0">
              <img src={logo} alt={report.org.name} className="max-h-14 max-w-[170px] object-contain" />
            </div>
          ) : null}
        </div>
      </header>

      <main className="space-y-5 px-6 py-5" style={{ fontSize: "var(--report-font-size)" }}>
        {report.notices?.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {report.notices.join(" · ")}
          </div>
        ) : null}

        <EquationStrip report={report} currency={report.currency} />

        {report.sections.map((section) => {
          // The note column is custom-print opt-in (showNotes); default reports
          // stay a clean two-column «البند · القيمة» sheet.
          const columns = resolved.showNotes ? section.columns : section.columns.filter((c) => c.key !== "note");
          return (
          <section key={section.id} className="document-keep-together break-inside-avoid">
            <div className="mb-1.5">
              <h2 className="document-section-title" style={{ color: "var(--report-primary)" }}><BidiText mode="plaintext">{section.title}</BidiText></h2>
              {section.description && <p className="mt-0.5 text-xs text-slate-500"><BidiText mode="plaintext">{section.description}</BidiText></p>}
            </div>
            <table className="document-table w-full border-collapse">
              <thead>
                <tr style={{ borderTop: "1.5px solid var(--report-primary)", borderBottom: "1px solid #cbd5e1" }}>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-slate-500"
                      style={{ padding: "var(--report-cell-padding)", textAlign: alignToCss(column.align) }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.length ? section.rows.map((row, rowIndex) => {
                  const totalRow = isTotalRow(row);
                  return (
                    <tr
                      key={row.id}
                      className={`${rowIndex % 2 === 1 && !totalRow ? "bg-slate-50/70" : ""}${onRowClick ? " cursor-pointer transition hover:bg-slate-100/70" : ""}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((column) => {
                        // Tree hierarchy: the label cell indents by row.depth
                        // (max 5 levels — Wave-style), keeping the one-line
                        // density and ellipsis contract.
                        const depth = Math.min(Math.max(row.depth ?? 0, 0), 5);
                        return (
                        <td
                          key={`${row.id}-${column.key}`}
                          className={`${totalRow ? "border-t border-slate-300 font-bold text-slate-900" : "text-slate-700"}${column.key === "label" ? " max-w-0 overflow-hidden text-ellipsis whitespace-nowrap" : " whitespace-nowrap"}${depth > 0 && column.key === "label" ? " text-slate-500" : ""}`}
                          style={{
                            padding: "var(--report-cell-padding)",
                            textAlign: alignToCss(column.align),
                            ...(column.key === "label" && depth > 0 ? { paddingInlineStart: `${depth * 18 + 10}px` } : {}),
                          }}
                          title={column.key === "label" ? String(row.values[column.key] ?? row.label) : undefined}
                        >
                          <CellValue value={row.values[column.key]} keyName={column.key} kind={column.kind} currency={report.currency} strong={totalRow} />
                        </td>
                        );
                      })}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                      {t("لا توجد بيانات في هذا القسم خلال الفترة المحددة.", "No data in this section for the selected period.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          );
        })}
      </main>

      {resolved.showFooter && (
        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 px-6 py-3 text-[11px] text-slate-400">
          <span className="min-w-0 truncate"><BidiText mode="plaintext">{reportTitle}</BidiText> · <BidiText mode="plaintext">{report.org.name}</BidiText> · <NumericText>{report.id}</NumericText></span>
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
