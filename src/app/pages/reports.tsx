import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, type DashboardSummary } from "../lib/api";

const money = (value: string | number | null | undefined, currency = "SAR") =>
  `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function Reports() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pl" | "cash" | "vat" | "aging">("pl");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.dashboard.summary();
        if (alive) setSummary(data);
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : "تعذر تحميل التقارير");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const currency = summary?.org.baseCurrency || "SAR";
  const netIncome = (summary?.kpi.revenue || 0) - (summary?.kpi.purchases || 0) - (summary?.kpi.expenses || 0);
  const vatNet = summary?.kpi.vatNet || 0;
  const reportRows = useMemo(() => {
    if (!summary) return [];
    if (tab === "cash") return summary.cashFlowTrend.map((r) => ({ label: r.month, a: r.in, b: r.out, c: r.net }));
    if (tab === "vat") return [
      { label: "VAT مخرجات", a: summary.kpi.vatOutput, b: 0, c: summary.kpi.vatOutput },
      { label: "VAT مدخلات", a: summary.kpi.vatInput, b: 0, c: -summary.kpi.vatInput },
      { label: "الصافي", a: vatNet, b: 0, c: vatNet },
    ];
    return summary.profitLoss.map((r) => ({ label: r.month, a: r.revenue, b: r.expenses, c: r.net }));
  }, [summary, tab, vatNet]);

  const exportCsv = () => {
    const header = tab === "cash" ? "Period,Cash In,Cash Out,Net" : tab === "vat" ? "Line,Amount,Other,Net" : "Period,Revenue,Expenses,Net";
    const csv = [header, ...reportRows.map((row) => [row.label, row.a, row.b, row.c].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entix-${tab}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>التقارير</h1>
          <p className="text-[#6B7280] mt-1">P&L، التدفق النقدي، VAT، وأرصدة التحصيل من بيانات الشركة الحالية</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!summary || reportRows.length === 0}>
          <Download className="me-2 h-4 w-4" />تصدير CSV
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1276E3]" /></div>
      ) : summary ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="الإيرادات" value={money(summary.kpi.revenue, currency)} tone="good" />
            <Metric label="المشتريات والمصروفات" value={money(summary.kpi.purchases + summary.kpi.expenses, currency)} tone="warn" />
            <Metric label="صافي الربح" value={money(netIncome, currency)} tone={netIncome >= 0 ? "good" : "bad"} />
            <Metric label="VAT الصافي" value={money(vatNet, currency)} tone={vatNet >= 0 ? "warn" : "good"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "pl"} onClick={() => setTab("pl")}>الأرباح والخسائر</TabButton>
            <TabButton active={tab === "cash"} onClick={() => setTab("cash")}>التدفق النقدي</TabButton>
            <TabButton active={tab === "vat"} onClick={() => setTab("vat")}>VAT</TabButton>
            <TabButton active={tab === "aging"} onClick={() => setTab("aging")}>التحصيل</TabButton>
          </div>

          {tab === "aging" ? (
            <AgingReport summary={summary} currency={currency} />
          ) : (
            <Card className="border-[#E5E7EB]">
              <CardHeader><CardTitle>{tab === "cash" ? "التدفق النقدي آخر 6 أشهر" : tab === "vat" ? "ملخص VAT" : "الأرباح والخسائر آخر 6 أشهر"}</CardTitle></CardHeader>
              <CardContent>
                <ReportBars rows={reportRows} currency={currency} mode={tab} />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="مصادر الدخل" rows={summary.incomeBreakdown.map((r) => ({ label: r.category, total: r.total }))} currency={currency} />
            <Breakdown title="تصنيف المصروفات" rows={summary.expenseBreakdown.map((r) => ({ label: r.category || "غير مصنف", total: r.total }))} currency={currency} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" }) {
  const colors = tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "bad" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50";
  return (
    <div className={`rounded-lg border px-4 py-3 ${colors}`}>
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0B1B49] font-english">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md border px-3 py-2 text-sm ${active ? "border-[#1276E3] bg-[#EAF4FF] text-[#1276E3]" : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"}`}>
      {children}
    </button>
  );
}

function ReportBars({ rows, currency, mode }: { rows: Array<{ label: string; a: number; b: number; c: number }>; currency: string; mode: string }) {
  const max = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.a), Math.abs(row.b), Math.abs(row.c)]));
  if (rows.length === 0) return <Empty text="لا توجد بيانات كافية لهذا التقرير" />;
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-3 md:grid-cols-[130px_1fr_160px] md:items-center">
          <div className="text-sm font-medium text-[#0B1B49]">{row.label}</div>
          <div className="space-y-1.5">
            <Bar label={mode === "cash" ? "داخل" : mode === "vat" ? "المبلغ" : "إيراد"} value={row.a} max={max} color="#1276E3" />
            {mode !== "vat" && <Bar label={mode === "cash" ? "خارج" : "مصروف"} value={row.b} max={max} color="#EF4444" />}
          </div>
          <div className={`text-sm font-semibold font-english ${row.c >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {row.c >= 0 ? <TrendingUp className="me-1 inline h-4 w-4" /> : <TrendingDown className="me-1 inline h-4 w-4" />}
            {money(row.c, currency)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr_120px] items-center gap-2 text-xs">
      <span className="text-[#6B7280]">{label}</span>
      <div className="h-2 rounded bg-[#EEF2F7]"><div className="h-2 rounded" style={{ width: `${Math.min(100, Math.abs(value) / max * 100)}%`, background: color }} /></div>
      <span className="text-end font-english text-[#374151]">{money(value, "")}</span>
    </div>
  );
}

function Breakdown({ title, rows, currency }: { title: string; rows: Array<{ label: string; total: number }>; currency: string }) {
  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <Empty text="لا توجد بيانات" /> : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-[#F3F4F6] py-2 text-sm last:border-0">
                <span className="text-[#374151]">{row.label}</span>
                <span className="font-semibold font-english text-[#0B1B49]">{money(row.total, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgingReport({ summary, currency }: { summary: DashboardSummary; currency: string }) {
  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader><CardTitle>الفواتير المتأخرة والتحصيل</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <Metric label="ذمم مدينة" value={money(summary.kpi.accountsReceivable, currency)} tone="warn" />
          <Metric label="ذمم دائنة" value={money(summary.kpi.accountsPayable, currency)} tone="warn" />
          <Metric label="فواتير متأخرة" value={summary.kpi.overdueCount.toString()} tone={summary.kpi.overdueCount > 0 ? "bad" : "good"} />
        </div>
        {summary.overdueInvoices.length === 0 ? <Empty text="لا توجد فواتير متأخرة" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="px-4 py-3 text-start">الفاتورة</th>
                <th className="px-4 py-3 text-start">العميل</th>
                <th className="px-4 py-3 text-start">المتبقي</th>
                <th className="px-4 py-3 text-start">أيام التأخير</th>
              </tr></thead>
              <tbody>{summary.overdueInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-[#F3F4F6]">
                  <td className="px-4 py-3 font-english text-sm">{invoice.number}</td>
                  <td className="px-4 py-3 text-sm text-[#0B1B49]">{invoice.contact}</td>
                  <td className="px-4 py-3 font-english text-sm font-semibold">{money(invoice.remaining, currency)}</td>
                  <td className="px-4 py-3 font-english text-sm text-red-700">{invoice.daysOverdue}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-[#6B7280]"><BarChart3 className="mx-auto mb-3 h-9 w-9 text-[#9CA3AF]" />{text}</div>;
}
