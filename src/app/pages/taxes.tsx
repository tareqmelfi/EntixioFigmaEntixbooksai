import { useEffect, useState } from "react";
import { Loader2, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { api, ApiError, type DashboardSummary } from "../lib/api";
import { taxRates } from "../components/tax-rate-select";

const money = (value: string | number | null | undefined, currency = "SAR") =>
  `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function Taxes() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.dashboard.summary();
        if (alive) setSummary(data);
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : "تعذر تحميل بيانات الضرائب");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const currency = summary?.org.baseCurrency || "SAR";
  const vatNet = summary?.kpi.vatNet || 0;
  const payable = vatNet >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الضرائب</h1>
        <p className="text-[#6B7280] mt-1">معدلات VAT، ضريبة الاستقطاع، وملخص الإقرار من الفواتير والمشتريات</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1276E3]" /></div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="VAT مخرجات" value={money(summary?.kpi.vatOutput, currency)} />
            <Metric label="VAT مدخلات" value={money(summary?.kpi.vatInput, currency)} />
            <Metric label={payable ? "مستحق الدفع" : "رصيد مسترد"} value={money(Math.abs(vatNet), currency)} tone={payable ? "warn" : "good"} />
            <Metric label="الدولة الضريبية" value={summary?.org.country || "SA"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-[#E5E7EB]">
              <CardHeader><CardTitle>معدلات الضريبة المفعلة في النماذج</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                      <th className="px-4 py-3 text-start">المعدل</th>
                      <th className="px-4 py-3 text-start">الاسم الإنجليزي</th>
                      <th className="px-4 py-3 text-start">النسبة</th>
                      <th className="px-4 py-3 text-start">الاستخدام</th>
                    </tr></thead>
                    <tbody>{taxRates.map((rate) => (
                      <tr key={rate.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                        <td className="px-4 py-3 text-sm text-[#0B1B49]">{rate.name}</td>
                        <td className="px-4 py-3 text-sm font-english text-[#374151]">{rate.nameEn}</td>
                        <td className="px-4 py-3 text-sm font-semibold font-english">{rate.rate}%</td>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">{rate.type === "both" ? "مبيعات ومشتريات" : rate.type === "sales" ? "مبيعات" : "مشتريات"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5E7EB]">
              <CardHeader><CardTitle>إقرار VAT مبدئي</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <TaxLine label="ضريبة المبيعات" value={summary?.kpi.vatOutput || 0} currency={currency} />
                  <TaxLine label="ضريبة المشتريات القابلة للاسترداد" value={-(summary?.kpi.vatInput || 0)} currency={currency} />
                  <div className="border-t border-[#E5E7EB] pt-3">
                    <TaxLine label={payable ? "صافي الضريبة المستحقة" : "صافي الرصيد المسترد"} value={vatNet} currency={currency} strong />
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    هذه قراءة تشغيلية من بيانات النظام الحالية. الإرسال الرسمي لـ ZATCA يحتاج تفعيل بيانات CSID وملف الشركة الضريبي من الإعدادات.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "good" }) {
  const colors = tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "warn" ? "border-amber-200 bg-amber-50" : "border-[#E5E7EB] bg-white";
  return (
    <div className={`rounded-lg border px-4 py-3 ${colors}`}>
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0B1B49] font-english">{value}</div>
    </div>
  );
}

function TaxLine({ label, value, currency, strong = false }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "text-base" : "text-sm"}`}>
      <span className="text-[#374151]">{label}</span>
      <span className={`font-english ${strong ? "font-bold text-[#0B1B49]" : "font-semibold text-[#374151]"}`}>{money(value, currency)}</span>
    </div>
  );
}
