import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Loader2, Printer, RefreshCw } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ReportDocument, normalizeReportSettings } from "../components/report-document";
import { api, ApiError, type ReportPayload, type ReportRow } from "../lib/api";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

export function ReportView() {
  const { id = "income-statement" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") || yearStartIso());
  const [to, setTo] = useState(searchParams.get("to") || todayIso());
  const [demo, setDemo] = useState(searchParams.get("demo") === "1");
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params: Record<string, string> = { from, to };
    if (demo) params.demo = "1";
    setSearchParams(params, { replace: true });
  }, [from, to, demo, setSearchParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.reports.get(id, { from, to, demo: demo ? 1 : undefined });
        if (alive) {
          setReport(data);
          setSelectedRow(null);
        }
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : "تعذر تحميل التقرير");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, from, to, demo]);

  const settings = useMemo(() => normalizeReportSettings(report?.org.paymentSettings?.reports), [report]);

  const printHref = `/app/reports/${id}/print?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${demo ? "&demo=1" : ""}`;

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
      <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button onClick={() => navigate("/app/reports")} className="mb-2 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#0B1B49]">
            <ArrowRight className="h-4 w-4" /> التقارير
          </button>
          <h1 className="text-2xl font-bold text-[#0B1B49]">{report?.title || "تقرير"}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{report?.englishTitle || "Live report"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDemo((value) => !value)}>
            {demo ? "إيقاف الديمو" : "معاينة ديمو"}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!report}>
            <Download className="me-2 h-4 w-4" />CSV
          </Button>
          <Button variant="outline" onClick={() => report && api.reports.get(id, { from, to, demo: demo ? 1 : undefined }).then(setReport)}>
            <RefreshCw className="me-2 h-4 w-4" />تحديث
          </Button>
          <Button onClick={() => navigate(printHref)}>
            <Printer className="me-2 h-4 w-4" />PDF / تصميم
          </Button>
        </div>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-[#374151]">
            <span className="font-semibold">من تاريخ</span>
            <input value={from} onChange={(event) => setFrom(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 outline-none focus:border-[#1276E3]" />
          </label>
          <label className="space-y-1 text-sm text-[#374151]">
            <span className="font-semibold">إلى تاريخ</span>
            <input value={to} onChange={(event) => setTo(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 outline-none focus:border-[#1276E3]" />
          </label>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#374151]">
            الحالة: <span className="font-semibold text-[#0B1B49]">{report?.status === "demo" ? "ديمو" : report?.status === "live" ? "لايف" : "فارغ"}</span>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1276E3]" />
          <div className="mt-3 text-sm text-[#6B7280]">جاري تحميل التقرير...</div>
        </div>
      ) : report ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-x-auto rounded-xl bg-[#EAF1F8] p-4">
            <ReportDocument report={report} settings={settings} onRowClick={setSelectedRow} />
          </div>
          <aside className="space-y-3">
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <h2 className="text-lg font-bold text-[#0B1B49]">تفاصيل الصف</h2>
                {selectedRow ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <div className="text-sm font-semibold text-[#0B1B49]">{selectedRow.label}</div>
                      {selectedRow.note && <div className="mt-1 text-xs leading-5 text-[#6B7280]">{selectedRow.note}</div>}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(selectedRow.values).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] pb-2 text-sm">
                          <span className="text-[#6B7280]">{key}</span>
                          <span className="font-semibold text-[#0B1B49]">{String(value ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                    {selectedRow.link?.href && (
                      <Button className="w-full" variant="outline" onClick={() => navigate(selectedRow.link!.href)}>
                        <ExternalLink className="me-2 h-4 w-4" />فتح المصدر
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#6B7280]">اضغط على أي صف داخل التقرير لعرض تفاصيله والانتقال للمستند أو الحساب المرتبط.</p>
                )}
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={() => navigate(printHref)}>
              <ArrowLeft className="me-2 h-4 w-4" />فتح مصمم الطباعة
            </Button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
