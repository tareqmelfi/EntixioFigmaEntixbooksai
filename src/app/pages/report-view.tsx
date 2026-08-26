import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Download, ExternalLink, ListTree, ListX, Loader2, Printer, RefreshCw } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { DateInput } from "../components/date-input";
import { Card, CardContent } from "../components/ui/card";
import { ReportDocument, normalizeReportSettings } from "../components/report-document";
import { splitBi } from "../components/report-document-condensed";
import { api, ApiError, type ReportPayload, type ReportRow } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { BranchFilter } from "../components/branch-field";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

// Detail sections carry the per-account breakouts («*-detail» / «*-crosscheck»).
// The summary mode keeps the statement compact (Wave-style) — a company with
// a hundred accounts should not need a book to read its P&L (2026-08-19).
const isDetailSection = (id: string) => /-detail$|-crosscheck$/.test(id);

const VIEW_MODE_KEY = "entix-report-view-mode";

/** Single compact export dropdown — icon-only trigger, formats inside the menu. */
function ExportMenu({ onCsv, onPdf, disabled }: { onCsv: () => void; onPdf: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen((v) => !v)} title={t("تصدير التقرير", "Export report")} aria-label={t("تصدير التقرير", "Export report")}>
        <Download className="h-4 w-4" />
        <ChevronDown className={`ms-1 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-lg">
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted" onClick={() => { setOpen(false); onPdf(); }}>
            <Printer className="h-4 w-4 text-muted-foreground" />{t("PDF / طباعة", "PDF / Print")}
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted" onClick={() => { setOpen(false); onCsv(); }}>
            <Download className="h-4 w-4 text-muted-foreground" />CSV
          </button>
        </div>
      )}
    </div>
  );
}

export function ReportView() {
  const { t, language } = useLanguage();
  const { id = "income-statement" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") || yearStartIso());
  const [to, setTo] = useState(searchParams.get("to") || todayIso());
  // Comparative layout (user ask 2026-08-19 — Apple-style year-over-year):
  // toggle sends compareTo = the day before the current window starts.
  const [compare, setCompare] = useState(searchParams.get("compare") === "1");
  // B1 · branch scope ("" = all · "none" = unassigned · id)
  const [branchId, setBranchId] = useState(searchParams.get("branchId") || "");
  const compareTo = useMemo(() => {
    if (!compare) return undefined;
    const start = new Date(from);
    if (Number.isNaN(start.getTime())) return undefined;
    return new Date(start.getTime() - 86400000).toISOString().slice(0, 10);
  }, [compare, from]);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reports load FULLY EXPANDED (all account categories visible immediately —
  // user ask 2026-08-19: «Reports should load with all account categories
  // expanded by default for immediate visibility»). «ملخص» collapses the
  // per-account detail sections; the choice persists.
  const [detailMode, setDetailMode] = useState<"summary" | "full">(() => {
    if (typeof window === "undefined") return "full";
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    return stored === "summary" ? "summary" : "full";
  });
  const changeDetailMode = (mode: "summary" | "full") => {
    setDetailMode(mode);
    try { window.localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* private mode */ }
  };

  useEffect(() => {
    setSearchParams(branchId ? { from, to, branchId } : { from, to }, { replace: true });
  }, [from, to, branchId, setSearchParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Bilingual labels («ar␟en») — the Condensed template shows both, the classic one collapses to the document language.
        const data = await api.reports.get(id, { from, to, compareTo, bilingual: 1, branchId: branchId || undefined });
        if (alive) {
          setReport(data);
          setSelectedRow(null);
        }
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : t("تعذر تحميل التقرير", "Could not load the report"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, from, to, compareTo, branchId]);

  const settings = useMemo(() => normalizeReportSettings(report?.org.paymentSettings?.reports), [report]);

  const hasDetailSections = useMemo(() => (report?.sections || []).some((s) => isDetailSection(s.id)), [report]);
  const visibleReport = useMemo(() => {
    if (!report) return report;
    if (detailMode === "full" || !hasDetailSections) return report;
    return { ...report, sections: report.sections.filter((s) => !isDetailSection(s.id)) };
  }, [report, detailMode, hasDetailSections]);

  const printHref = `/app/reports/${id}/print?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`;

  const exportCsv = () => {
    if (!report) return;
    const lines = ["Section,Row,Key,Value"];
    for (const section of report.sections) {
      for (const row of section.rows) {
        for (const [key, value] of Object.entries(row.values)) {
          const sectionTitle = (() => { const b = splitBi(section.title); return b.en ? `${b.ar} / ${b.en}` : b.ar; })();
          lines.push([sectionTitle, row.label, key, value ?? ""].map((item) => `"${String(item).replace(/"/g, '""')}"`).join(","));
        }
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entix-${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button onClick={() => navigate("/app/reports")} className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> {t("التقارير", "Reports")}
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {language === "en" ? (report?.englishTitle || report?.title || t("تقرير", "Report")) : (report?.title || t("تقرير", "Report"))}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "en" ? (report?.title || "Live report") : (report?.englishTitle || "Live report")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasDetailSections && (
            <Button
              variant="outline"
              onClick={() => changeDetailMode(detailMode === "summary" ? "full" : "summary")}
              title={t("تصغير التقرير لأقسامه الرئيسية أو عرض الشجرة بكل تفاصيلها", "Collapse to main sections or expand the full tree")}
            >
              {detailMode === "summary" ? (
                <><ListTree className="me-2 h-4 w-4" />{t("تفصيل كامل", "Full detail")}</>
              ) : (
                <><ListX className="me-2 h-4 w-4" />{t("ملخص فقط", "Summary only")}</>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => report && api.reports.get(id, { from, to, compareTo, bilingual: 1, branchId: branchId || undefined }).then(setReport)}>
            <RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}
          </Button>
          {/* One compact export control — formats live inside the menu (no
              PDF/CSV/Excel text cluttering the toolbar, user ask 2026-08-19). */}
          <ExportMenu onCsv={exportCsv} onPdf={() => navigate(printHref)} disabled={!report} />
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-end">
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">{t("من تاريخ", "From date")}</span>
            <DateInput value={from} onChange={setFrom} inputClassName="h-10 text-sm" />
          </label>
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">{t("إلى تاريخ", "To date")}</span>
            <DateInput value={to} onChange={setTo} inputClassName="h-10 text-sm" />
          </label>
          <BranchFilter value={branchId} onChange={setBranchId} className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground" />
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${compare ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-foreground/80 hover:bg-muted"}`}
            title={t("قارن بنفس الفترة من العام الماضي (مثل قوائم آبل)", "Compare to the same window last year (Apple-style)")}
          >
            {t("مقارنة سنوية", "Compare YoY")}
          </button>
          <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground/80">
            {t("الحالة:", "Status:")} <span className="font-semibold text-foreground">{report?.status === "live" ? t("مباشر", "Live") : t("فارغ", "Empty")}</span>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-border bg-white py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">{t("جاري تحميل التقرير...", "Loading report...")}</div>
        </div>
      ) : report && visibleReport ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-x-auto rounded-xl bg-muted/50 p-4">
            <ReportDocument report={visibleReport} settings={settings} onRowClick={setSelectedRow} />
          </div>
          <aside className="space-y-3">
            <Card className="border-border">
              <CardContent className="p-4">
                <h2 className="text-lg font-bold text-foreground">{t("تفاصيل الصف", "Row details")}</h2>
                {selectedRow ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <div className="text-sm font-semibold text-foreground">{selectedRow.label}</div>
                      {selectedRow.note && <div className="mt-1 text-xs leading-5 text-muted-foreground">{selectedRow.note}</div>}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(selectedRow.values).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-semibold text-foreground">{String(value ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                    {selectedRow.link?.href && (
                      <Button className="w-full" variant="outline" onClick={() => navigate(selectedRow.link!.href)}>
                        <ExternalLink className="me-2 h-4 w-4" />{t("فتح المصدر", "Open source")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("اضغط على أي صف داخل التقرير لعرض تفاصيله والانتقال للمستند أو الحساب المرتبط.", "Click any row in the report to see its details and jump to the linked document or account.")}</p>
                )}
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={() => navigate(printHref)}>
              <ArrowLeft className="me-2 h-4 w-4" />{t("فتح مصمم الطباعة", "Open print designer")}
            </Button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
