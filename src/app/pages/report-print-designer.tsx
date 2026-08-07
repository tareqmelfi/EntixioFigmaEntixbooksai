import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Loader2, Palette, Printer, Save } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ReportDocument, normalizeReportSettings } from "../components/report-document";
import { api, ApiError, type Org, type ReportPayload, type ReportPrintSettings } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const defaultColors = {
  primaryColor: "#0B1B49",
  accentColor: "#1276E3",
};

export function ReportPrintDesigner() {
  const { t } = useLanguage();
  const { id = "income-statement" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [settings, setSettings] = useState<ReportPrintSettings>({ ...defaultColors });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const demo = searchParams.get("demo") === "1";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.reports.get(id, { from, to, demo: demo ? 1 : undefined });
        const fullOrg = await api.orgs.get(payload.org.id);
        const nextSettings = normalizeReportSettings(fullOrg.paymentSettings?.reports || payload.org.paymentSettings?.reports);
        if (alive) {
          setReport(payload);
          setOrg(fullOrg);
          setSettings(nextSettings);
        }
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : t("تعذر تحميل مصمم التقرير", "Could not load the report designer"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, from, to, demo]);

  const resolved = useMemo(() => normalizeReportSettings(settings), [settings]);
  const selectClass = "h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary";

  const update = <K extends keyof ReportPrintSettings>(key: K, value: ReportPrintSettings[K]) => {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    if (!org) return;
    setSaving(true);
    setError(null);
    try {
      const paymentSettings = { ...(org.paymentSettings || {}), reports: normalizeReportSettings(settings) };
      const updated = await api.orgs.update(org.id, { paymentSettings });
      setOrg(updated);
      setSaved(true);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر حفظ إعدادات التقرير", "Could not save report settings"));
    } finally {
      setSaving(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="report-designer-page space-y-4">
      <style>{`
        @media print {
          @page {
            size: ${resolved.paper} ${resolved.orientation};
            margin: 12mm;
          }
          body {
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .entix-print-zone,
          .entix-print-zone * {
            visibility: visible !important;
          }
          .entix-print-zone {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .entix-report-paper {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .report-designer-chrome {
            display: none !important;
          }
        }
      `}</style>

      <div className="report-designer-chrome flex flex-col gap-3 rounded-xl border border-border bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button onClick={() => navigate(`/app/reports/${id}${window.location.search}`)} className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> {t("الرجوع للتقرير", "Back to report")}
          </button>
          <h1 className="text-2xl font-bold text-foreground">{t("مصمم التقرير والطباعة", "Report & print designer")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("تحكم في الشعار والشكل ثم اطبع أو احفظ PDF.", "Control logo and layout, then print or save as PDF.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveSettings} disabled={saving || !org}>
            {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
            {t("حفظ كإعداد شركة", "Save as company default")}
          </Button>
          <Button onClick={printReport} disabled={!report}>
            <Printer className="me-2 h-4 w-4" />{t("طباعة / Save PDF", "Print / Save PDF")}
          </Button>
        </div>
      </div>

      {saved && <div className="report-designer-chrome rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{t("تم حفظ قالب التقارير للشركة.", "Report template saved for the company.")}</div>}
      {error && <div className="report-designer-chrome rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-border bg-white py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">{t("جاري تجهيز المعاينة...", "Preparing preview...")}</div>
        </div>
      ) : report ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="report-designer-chrome space-y-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Palette className="h-4 w-4" />{t("إعدادات الشكل", "Appearance settings")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Control label={t("الشعار", "Logo")}>
                  <select value={resolved.logoSource} onChange={(e) => update("logoSource", e.target.value as any)} className={selectClass}>
                    <option value="print">{t("شعار الطباعة", "Print logo")}</option>
                    <option value="main">{t("شعار الشركة", "Company logo")}</option>
                    <option value="none">{t("بدون شعار", "No logo")}</option>
                  </select>
                </Control>
                <div className="grid grid-cols-2 gap-3">
                  <Control label={t("الورق", "Paper")}>
                    <select value={resolved.paper} onChange={(e) => update("paper", e.target.value as any)} className={selectClass}>
                      <option value="A4">A4</option>
                      <option value="Letter">Letter</option>
                    </select>
                  </Control>
                  <Control label={t("الاتجاه", "Orientation")}>
                    <select value={resolved.orientation} onChange={(e) => update("orientation", e.target.value as any)} className={selectClass}>
                      <option value="portrait">{t("طولي", "Portrait")}</option>
                      <option value="landscape">{t("عرضي", "Landscape")}</option>
                    </select>
                  </Control>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Control label={t("اللغة", "Language")}>
                    <select value={resolved.language} onChange={(e) => update("language", e.target.value as any)} className={selectClass}>
                      <option value="ar">عربي RTL</option>
                      <option value="en">English LTR</option>
                    </select>
                  </Control>
                  <Control label={t("حجم الخط", "Font size")}>
                    <select value={resolved.fontScale} onChange={(e) => update("fontScale", e.target.value as any)} className={selectClass}>
                      <option value="compact">{t("صغير", "Small")}</option>
                      <option value="normal">{t("عادي", "Normal")}</option>
                      <option value="large">{t("كبير", "Large")}</option>
                    </select>
                  </Control>
                </div>
                <Control label={t("كثافة الجدول", "Table density")}>
                  <select value={resolved.density} onChange={(e) => update("density", e.target.value as any)} className={selectClass}>
                    <option value="comfortable">{t("مريح", "Comfortable")}</option>
                    <option value="standard">{t("قياسي", "Standard")}</option>
                    <option value="compact">{t("مضغوط", "Compact")}</option>
                  </select>
                </Control>
                <div className="grid grid-cols-2 gap-3">
                  <Control label={t("اللون الأساسي", "Primary color")}>
                    <input value={resolved.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} type="color" className="h-10 w-full rounded-lg border border-border bg-white p-1" />
                  </Control>
                  <Control label={t("لون التمييز", "Accent color")}>
                    <input value={resolved.accentColor} onChange={(e) => update("accentColor", e.target.value)} type="color" className="h-10 w-full rounded-lg border border-border bg-white p-1" />
                  </Control>
                </div>
                <Toggle label={t("معلومات الشركة", "Company info")} checked={resolved.showCompanyInfo} onChange={(value) => update("showCompanyInfo", value)} />
                <Toggle label={t("معلومات الضريبة والسجل", "Tax & registration info")} checked={resolved.showTaxInfo} onChange={(value) => update("showTaxInfo", value)} />
                <Toggle label={t("تذييل التقرير", "Report footer")} checked={resolved.showFooter} onChange={(value) => update("showFooter", value)} />
                <Toggle label="Prepared for" checked={resolved.showPreparedBy} onChange={(value) => update("showPreparedBy", value)} />
              </CardContent>
            </Card>
          </aside>

          <div className="entix-print-zone overflow-x-auto rounded-xl bg-muted p-5 print:overflow-visible print:bg-white print:p-0">
            <ReportDocument report={report} settings={resolved} mode="print" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-semibold text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground/80">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#1276E3]" />
    </label>
  );
}
