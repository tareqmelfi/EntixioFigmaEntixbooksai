import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, ExternalLink, ListTree, ListX, Loader2, Printer, RefreshCw } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { DateInput } from "../components/date-input";
import { Card, CardContent } from "../components/ui/card";
import { ReportDocument, normalizeReportSettings } from "../components/report-document";
import { api, ApiError, type ReportPayload, type ReportRow } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

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

export function ReportView() {
  const { t, language } = useLanguage();
  const { id = "income-statement" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") || yearStartIso());
  const [to, setTo] = useState(searchParams.get("to") || todayIso());
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // «ملخص» collapses the per-account detail sections; the choice persists.
  const [detailMode, setDetailMode] = useState<"summary" | "full">(() => {
    if (typeof window === "undefined") return "summary";
    return window.localStorage.getItem(VIEW_MODE_KEY) === "full" ? "full" : "summary";
  });
  const changeDetailMode = (mode: "summary" | "full") => {
    setDetailMode(mode);
    try { window.localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* private mode */ }
  };

  useEffect(() => {
    setSearchParams({ from, to }, { replace: true });
  }, [from, to, setSearchParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.reports.get(id, { from, to });
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
  }, [id, from, to]);

  const settings = useMemo(() => normalizeReportSettings(report?.org.paymentSettings?.reports), [report]);

  const hasDetailSections = useMemo(() => (report?.sections || []).some((s) => isDetailSection(s.id)), [report]);
  const visibleReport = useMemo(() => {
    if (!report) return report;
    if (detailMode === "full" || !hasDetailSections) return report;
    return { ...report, sections: report.sections.filter((s) => !isDetailSection(s.id)) };
  }, [report, detailMode, hasDetailSections]);

  const printHref = `/app/reports/${id}/print?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const exportCsv = () => {
    if (!report) return;
    const lines = ["Section,Row,Key,Value"];
    for (const section of report.sections) {
      for (const row of section.rows) {
        for (const [key, value] of Object.entries(row.values)) {
          lines.push([section.title, row.label, key, value ?? ""].map((item) => `"${String(item).replace(/"/g, '""')}"`).join(","));
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
          <Button variant="outline" onClick={exportCsv} disabled={!report}>
            <Download className="me-2 h-4 w-4" />CSV
          </Button>
          <Button variant="outline" onClick={() => report && api.reports.get(id, { from, to }).then(setReport)}>
            <RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}
          </Button>
          <Button onClick={() => navigate(printHref)}>
            <Printer className="me-2 h-4 w-4" />{t("PDF / تصميم", "PDF / Design")}
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">{t("من تاريخ", "From date")}</span>
            <DateInput value={from} onChange={setFrom} inputClassName="h-10 text-sm" />
          </label>
          <label className="space-y-1 text-sm text-foreground/80">
            <span className="font-semibold">{t("إلى تاريخ", "To date")}</span>
            <DateInput value={to} onChange={setTo} inputClassName="h-10 text-sm" />
          </label>
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
