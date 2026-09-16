/**
 * Report print view · /print/report/:id  ·  PRINT LAW (2026-09-16)
 *
 * Why this page exists. The printable report used to live INSIDE the app
 * shell (`/app/reports/:id/print`). The shell pins itself to `h-dvh` and
 * clips with `overflow:hidden`, so at print time the browser had already
 * cut the document down to one viewport box — and the page came out BLANK.
 * The old CSS tried to rescue it by hiding every element that is not an
 * ancestor of `.entix-print-zone`; a visibility trick cannot un-clip what an
 * ancestor already clipped, and when the zone was missing it hid the whole
 * document instead.
 *
 * The rule now: a statement prints from a route with NO shell above it, and
 * the print core below is pasted verbatim from the ENSIDEX document system —
 * `@page` at the real paper size with zero margin, width pinned on
 * html/body, on the wrapper and on the sheet. Any one of those left loose
 * and Chrome silently scales the document down, after which nothing lands on
 * its own page.
 *
 * The screen keeps a toolbar (preview → download); `.no-print` removes it
 * from the paper.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "../components/ui/button";
import { ReportDocument, normalizeReportSettings } from "../components/report-document";
import { api, ApiError, type Org, type ReportPayload, type ReportPrintSettings } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const PAPER = {
  A4: { portrait: ["210mm", "297mm"], landscape: ["297mm", "210mm"] },
  Letter: { portrait: ["216mm", "279mm"], landscape: ["279mm", "216mm"] },
} as const;

export function ReportPrintView() {
  const { id = "income-statement" } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [settings, setSettings] = useState<ReportPrintSettings | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const allTime = searchParams.get("allTime") === "1" ? 1 : undefined;
  const compareTo = searchParams.get("compareTo") || undefined;
  const contactId = searchParams.get("contactId") || undefined;
  const branchId = searchParams.get("branchId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const autoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.reports.get(id, { from, to, allTime, compareTo, bilingual: 1, branchId, projectId, contactId });
        const fullOrg = await api.orgs.get(payload.org.id);
        if (!alive) return;
        setReport(payload);
        setOrg(fullOrg);
        setSettings(normalizeReportSettings(fullOrg.paymentSettings?.reports || payload.org.paymentSettings?.reports));
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : t("تعذّر تحميل التقرير", "Could not load the report"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, from, to, allTime, compareTo, branchId, projectId, contactId]);

  const paper = (settings?.paper === "Letter" ? "Letter" : "A4") as keyof typeof PAPER;
  const orientation = settings?.orientation === "landscape" ? "landscape" : "portrait";
  const [sheetW, sheetH] = PAPER[paper][orientation];

  // LOCKED PRINT CORE — do not edit. Width is pinned three times on purpose:
  // html/body, the wrapper, and the sheet. Leave one loose and Chrome scales
  // the whole document to fit, and no sheet lands on its own page again.
  const printCss = useMemo(() => `
    @page { size: ${sheetW} ${sheetH}; margin: 0; }
    @media print {
      html, body {
        width: ${sheetW} !important; max-width: ${sheetW} !important;
        margin: 0 !important; padding: 0 !important;
        background: #fff !important; height: auto !important; overflow: visible !important;
      }
      .print-desk {
        width: ${sheetW} !important; max-width: ${sheetW} !important; min-width: 0 !important;
        display: block !important; margin: 0 !important; padding: 0 !important; gap: 0 !important;
        background: #fff !important;
      }
      .no-print { display: none !important; }
      .entix-report-paper {
        width: ${sheetW} !important; max-width: ${sheetW} !important;
        min-height: 0 !important; height: auto !important;
        margin: 0 !important; border: 0 !important; box-shadow: none !important;
        overflow: visible !important; border-radius: 0 !important;
      }
      /* A table must never be cut mid-row, and a section keeps its heading. */
      tr, .document-keep-together { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
      img, svg, table, pre { max-width: 100% !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `, [sheetW, sheetH]);

  useEffect(() => {
    if (!autoPrint || loading || !report) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [autoPrint, loading, report]);

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-white"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error || !report || !settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-6 text-center">
        <p className="text-sm text-danger" data-render-error>{error || t("لا يوجد تقرير", "No report")}</p>
      </div>
    );
  }

  return (
    <div className="print-desk min-h-dvh bg-[#EEF1F6] py-6">
      <style>{printCss}</style>

      <div className="no-print mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground"><bdi dir="auto">{report.title}</bdi></div>
          <div className="font-english text-xs text-muted-foreground" dir="ltr">
            {org?.name} · {report.currency} · {paper} {orientation === "landscape" ? "landscape" : "portrait"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />{t("طباعة", "Print")}
          </Button>
          <Button onClick={() => window.print()} className="gap-2" data-testid="report-download-pdf">
            <Download className="h-4 w-4" />{t("تحميل PDF", "Download PDF")}
          </Button>
        </div>
      </div>

      <div className="mx-auto w-fit">
        <ReportDocument report={report} settings={settings} mode="print" />
      </div>
    </div>
  );
}

export default ReportPrintView;
