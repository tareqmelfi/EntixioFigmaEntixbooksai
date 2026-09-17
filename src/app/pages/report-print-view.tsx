/** Standalone report output, isolated from the scrolling application shell. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { normalizeReportSettings } from "../components/report-document";
import { ReportOutput } from "../components/report-output";
import { api, ApiError, type ReportPayload, type ReportPrintSettings } from "../lib/api";
import { readTabOrgId } from "../lib/tab-org-selection";
import { useLanguage } from "../components/LanguageContext";

export function ReportPrintView() {
  const { id = "income-statement" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [settings, setSettings] = useState<ReportPrintSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Capture the originating company once; another tab must not change a printout.
  const [fallbackOrgId] = useState(() => readTabOrgId());
  const printOrgId = searchParams.get("orgId") || fallbackOrgId;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const allTime = searchParams.get("allTime") === "1" ? 1 : undefined;
  const compareTo = searchParams.get("compareTo") || undefined;
  const contactId = searchParams.get("contactId") || undefined;
  const branchId = searchParams.get("branchId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const summary = searchParams.get("detail") === "summary";
  const autoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        if (!printOrgId) throw new ApiError(400, t("افتح التقرير من داخل الشركة ثم اختر الطباعة.", "Open the report from your company, then choose Print."));
        const payload = await api.reports.get(id, { from, to, allTime, compareTo, bilingual: 1, branchId, projectId, contactId }, printOrgId);
        if (payload.org.id !== printOrgId) throw new ApiError(409, t("تغيّرت الشركة. أعد فتح التقرير من الشركة المطلوبة.", "Company mismatch. Reopen the report from the intended company."));
        const fullOrg = await api.orgs.get(payload.org.id);
        if (!alive) return;
        setReport(payload);
        setSettings(normalizeReportSettings(fullOrg.paymentSettings?.reports || payload.org.paymentSettings?.reports));
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : t("تعذّر تحميل التقرير", "Could not load the report"));
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id, printOrgId, from, to, allTime, compareTo, branchId, projectId, contactId]);

  const visibleReport = useMemo(() => report && summary ? { ...report, sections: report.sections.filter(s => !/-detail$|-crosscheck$/.test(s.id)) } : report, [report, summary]);
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-white"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !visibleReport || !settings) return <div className="flex min-h-dvh items-center justify-center bg-white px-6 text-center"><p className="text-sm text-danger" data-render-error>{error || t("لا يوجد تقرير", "No report")}</p></div>;

  return <div className="min-h-dvh bg-muted p-4 md:p-6">
    <div className="mx-auto max-w-[300mm]">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-lg font-semibold">{report?.org.name}</h1><p className="text-sm text-muted-foreground">{report?.period.from} — {report?.period.to} · {report?.currency}</p></div>
        <Button variant="outline" onClick={() => navigate(`/app/reports/${id}/print?${searchParams}`)}>{t("إعدادات الطباعة", "Print settings")}</Button>
      </div>
      <ReportOutput report={visibleReport} settings={settings} autoPrint={autoPrint} />
    </div>
  </div>;
}
export default ReportPrintView;
