import type { CSSProperties } from "react";
import type { ReportPayload, ReportPrintSettings, ReportRow } from "../lib/api";

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
  const resolved = normalizeReportSettings(settings);
  const dir = resolved.language === "en" ? "ltr" : "rtl";
  const logo = resolved.logoSource === "none" ? null : resolved.logoSource === "main" ? report.org.logoUrl : report.org.printLogoUrl || report.org.logoUrl;
  const fontSize = resolved.fontScale === "large" ? 15 : resolved.fontScale === "compact" ? 12 : 13;
  const cellPadding = resolved.density === "comfortable" ? "12px 14px" : resolved.density === "compact" ? "7px 10px" : "9px 12px";
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

  return (
    <article
      className="entix-report-paper overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
      dir={dir}
      style={style}
    >
      <header className="border-b border-slate-200 px-8 py-7" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)" }}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {report.status === "demo" ? "Demo Preview" : "Live Report"}
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight" style={{ color: "var(--report-primary)" }}>
              {resolved.language === "en" ? report.englishTitle : report.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{report.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">من {report.period.from}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">إلى {report.period.to}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{report.currency}</span>
            </div>
          </div>
          <div className="shrink-0 text-end">
            {logo ? (
              <img src={logo} alt={report.org.name} className="ms-auto max-h-16 max-w-[180px] object-contain" />
            ) : (
              <div className="inline-flex h-16 min-w-16 items-center justify-center rounded-xl px-4 text-lg font-bold text-white" style={{ background: "var(--report-primary)" }}>
                {report.org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {resolved.showCompanyInfo && (
              <div className="mt-4 text-xs leading-5 text-slate-600">
                <div className="font-semibold" style={{ color: "var(--report-primary)" }}>{report.org.legalName || report.org.name}</div>
                <div>{[report.org.addressLine, report.org.city, report.org.region, report.org.postalCode].filter(Boolean).join(" · ") || report.org.country}</div>
                <div>{[report.org.email, report.org.phone, report.org.website].filter(Boolean).join(" · ")}</div>
              </div>
            )}
          </div>
        </div>

        {resolved.showTaxInfo && (
          <div className="mt-6 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <Info label="الرقم الضريبي" value={report.org.vatNumber || "—"} />
            <Info label="السجل التجاري" value={report.org.crNumber || "—"} />
            <Info label="تاريخ الإصدار" value={new Date(report.generatedAt).toLocaleString("ar-SA")} />
          </div>
        )}
      </header>

      <main className="space-y-6 px-8 py-7" style={{ fontSize: "var(--report-font-size)" }}>
        {report.notices?.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {report.notices.join(" · ")}
          </div>
        ) : null}

        {report.sections.map((section) => (
          <section key={section.id} className="break-inside-avoid">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--report-primary)" }}>{section.title}</h2>
                {section.description && <p className="mt-1 text-xs text-slate-500">{section.description}</p>}
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--report-accent) 12%, white)", color: "var(--report-accent)" }}>
                {section.rows.length} صف
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: "color-mix(in srgb, var(--report-primary) 7%, white)" }}>
                    {section.columns.map((column) => (
                      <th
                        key={column.key}
                        className="border-b border-slate-200 text-xs font-bold text-slate-600"
                        style={{ padding: "var(--report-cell-padding)", textAlign: alignToCss(column.align) }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length ? section.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={onRowClick ? "cursor-pointer transition hover:bg-slate-50" : ""}
                      onClick={() => onRowClick?.(row)}
                    >
                      {section.columns.map((column) => (
                        <td
                          key={`${row.id}-${column.key}`}
                          className="border-b border-slate-100 text-slate-700 last:border-b-0"
                          style={{ padding: "var(--report-cell-padding)", textAlign: alignToCss(column.align) }}
                        >
                          <CellValue value={row.values[column.key]} keyName={column.key} kind={column.kind} currency={report.currency} />
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={section.columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                        لا توجد بيانات في هذا القسم خلال الفترة المحددة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>

      {resolved.showFooter && (
        <footer className="flex items-center justify-between border-t border-slate-200 px-8 py-4 text-xs text-slate-500">
          <span>ENTIX.IO · {report.id}</span>
          {resolved.showPreparedBy && <span>Prepared for {report.org.name}</span>}
          <span className="print-page-number">Page 1</span>
        </footer>
      )}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function alignToCss(align?: "start" | "end" | "center") {
  if (align === "end") return "end";
  if (align === "center") return "center";
  return "start";
}

function CellValue({ value, keyName, kind, currency }: { value: string | number | null | undefined; keyName: string; kind?: string; currency: string }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">—</span>;
  if (kind === "money" || moneyKeys.has(keyName)) {
    const amount = Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return <span className={Number(value) < 0 ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>{amount} {currency}</span>;
  }
  if (kind === "number" && typeof value === "number") return <span>{value.toLocaleString("en-US")}</span>;
  if (kind === "status") return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{String(value)}</span>;
  return <span>{String(value)}</span>;
}
