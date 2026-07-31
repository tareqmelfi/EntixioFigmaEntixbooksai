/**
 * Payroll Detail · payslip/statement view for a saved payroll run
 * Route: /app/payroll/:id
 *
 * Shows: run header (number, period, status, totals) + per-employee payslip table
 * + company stamp + actions (Execute Payment, Download SIF/WPS, Print Payslip)
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowRight, Download, Loader2, Printer, Wallet, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";

const money = (v: string | number | null | undefined) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PayrollDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api.payroll.getRun(id);
        setRun(data);
      } catch (e: any) {
        setError(e instanceof ApiError ? e.message : "تعذر تحميل المسير");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const executePayment = async () => {
    if (!run) return;
    setBusy(true);
    try {
      const updated = await api.payroll.updateRunStatus(run.id, "PAID");
      setRun({ ...updated, org: run.org, lines: run.lines });
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل تنفيذ المسير");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>;
  if (error) return <div className="py-8 text-center text-red-600">{error}</div>;
  if (!run) return <div className="py-8 text-center text-muted-foreground">لم يتم العثور على المسير</div>;

  const currency = run.currency || run.org?.baseCurrency || "SAR";
  const org = run.org || {};
  const isApproved = run.status === "APPROVED" || run.status === "PAID";

  return (
    <div className="space-y-6">
      {/* Header + actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app/payroll")} className="rounded-lg p-2 hover:bg-muted transition">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-foreground font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{run.runNumber}</h1>
            <p className="text-sm text-muted-foreground">مسير رواتب · {run.period}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()} className="border-border">
            <Printer className="me-2 h-4 w-4" /> طباعة قسيمة
          </Button>
          <Button variant="outline" onClick={() => window.open(api.payroll.runSifUrl(run.id), "_blank", "noopener")} className="border-border">
            <Download className="me-2 h-4 w-4" /> تحميل SIF / WPS
          </Button>
          {isApproved && run.status !== "PAID" && (
            <Button onClick={executePayment} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Wallet className="me-2 h-4 w-4" />}
              تنفيذ المسير
            </Button>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
          run.status === "DRAFT" ? "bg-blue-50 text-blue-700" :
          run.status === "APPROVED" ? "bg-amber-50 text-amber-700" :
          run.status === "PAID" ? "bg-emerald-50 text-emerald-700" :
          "bg-gray-100 text-gray-600"
        }`}>{run.status}</span>
        {run.status === "PAID" && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> تم التنفيذ</span>}
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <div className="text-xs text-muted-foreground">إجمالي الرواتب</div>
          <div className="mt-1 text-lg font-semibold text-foreground font-english" dir="ltr">{money(run.grossSalary)} {currency}</div>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <div className="text-xs text-muted-foreground">GOSI الموظف</div>
          <div className="mt-1 text-lg font-semibold text-amber-700 font-english" dir="ltr">{money(run.employeeGosi)} {currency}</div>
        </div>
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <div className="text-xs text-muted-foreground">GOSI الشركة</div>
          <div className="mt-1 text-lg font-semibold text-amber-700 font-english" dir="ltr">{money(run.employerGosi)} {currency}</div>
        </div>
        <div className="rounded-lg border border-border bg-emerald-50 px-4 py-3">
          <div className="text-xs text-muted-foreground">صافي الرواتب</div>
          <div className="mt-1 text-lg font-bold text-emerald-700 font-english" dir="ltr">{money(run.netSalary)} {currency}</div>
        </div>
      </div>

      {/* Payslip table */}
      <Card className="border-border">
        <CardHeader><CardTitle>قسائم الرواتب · {run.lines?.length || 0} موظف</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-4 py-3 text-end">أساسي</th>
                  <th className="px-4 py-3 text-end">بدلات</th>
                  <th className="px-4 py-3 text-end">إجمالي</th>
                  <th className="px-4 py-3 text-end">GOSI</th>
                  <th className="px-4 py-3 text-end">استقطاعات</th>
                  <th className="px-4 py-3 text-end">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {(run.lines || []).map((line: any) => (
                  <tr key={line.id} className="border-b border-border/50 hover:bg-primary/5">
                    <td className="px-4 py-3 text-foreground">
                      {line.employee?.displayName || "—"}
                      {line.employee?.nationalId && (
                        <div className="text-[11px] text-muted-foreground font-english" dir="ltr">{line.employee.nationalId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end font-english" dir="ltr">{money(line.basicSalary)}</td>
                    <td className="px-4 py-3 text-end font-english" dir="ltr">{money(Number(line.housingAllowance) + Number(line.transportAllowance) + Number(line.otherAllowances))}</td>
                    <td className="px-4 py-3 text-end font-english font-semibold" dir="ltr">{money(line.grossSalary)}</td>
                    <td className="px-4 py-3 text-end font-english text-amber-700" dir="ltr">{money(line.employeeGosi)}</td>
                    <td className="px-4 py-3 text-end font-english text-red-700" dir="ltr">{money(line.totalDeductions)}</td>
                    <td className="px-4 py-3 text-end font-english font-bold text-emerald-700" dir="ltr">{money(line.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50">
                  <td className="px-4 py-3 font-semibold">الإجمالي</td>
                  <td className="px-4 py-3 text-end font-english font-semibold" dir="ltr">{money(run.grossSalary)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-end font-english font-semibold" dir="ltr">{money(run.grossSalary)}</td>
                  <td className="px-4 py-3 text-end font-english font-semibold text-amber-700" dir="ltr">{money(run.employeeGosi)}</td>
                  <td className="px-4 py-3 text-end font-english font-semibold text-red-700" dir="ltr">{money(Number(run.employeeGosi))}</td>
                  <td className="px-4 py-3 text-end font-english font-bold text-emerald-700" dir="ltr">{money(run.netSalary)} {currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Company stamp */}
      {isApproved && (org.stampUrl || org.logoUrl) && (
        <div className="flex justify-center py-4">
          <div className="text-center">
            {org.stampUrl ? (
              <img src={org.stampUrl} alt="ختم المؤسسة" style={{ maxHeight: 120, maxWidth: 180, objectFit: "contain", opacity: 0.9, mixBlendMode: "multiply" }} />
            ) : org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} style={{ maxHeight: 80, maxWidth: 160, objectFit: "contain" }} />
            ) : null}
            <div className="mt-2 text-xs text-muted-foreground">
              {org.legalName || org.name} · {run.runNumber} · {run.period}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
