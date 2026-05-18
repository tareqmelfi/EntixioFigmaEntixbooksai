import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, ApiError, type Contact } from "../lib/api";

type PayrollRow = {
  employeeId: string;
  nationalityCode: string;
  basicSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  otherDeductions: string;
  sanedEnabled: boolean;
};

const blankRow = (): PayrollRow => ({
  employeeId: "",
  nationalityCode: "SA",
  basicSalary: "",
  housingAllowance: "",
  transportAllowance: "",
  otherAllowances: "",
  otherDeductions: "",
  sanedEnabled: true,
});

const money = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Payroll() {
  const [employees, setEmployees] = useState<Contact[]>([]);
  const [rows, setRows] = useState<PayrollRow[]>([blankRow()]);
  const [results, setResults] = useState<any[]>([]);
  const [totals, setTotals] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.contacts.list({ role: "employee", limit: 200 } as any);
      setEmployees(res.items || []);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "تعذر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const updateRow = (index: number, patch: Partial<PayrollRow>) => {
    setRows((prev) => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const calculate = async () => {
    const payload = rows
      .filter((row) => row.employeeId && Number(row.basicSalary || 0) > 0)
      .map((row) => ({
        employeeId: row.employeeId,
        nationalityCode: row.nationalityCode,
        basicSalary: Number(row.basicSalary || 0),
        housingAllowance: Number(row.housingAllowance || 0),
        transportAllowance: Number(row.transportAllowance || 0),
        otherAllowances: Number(row.otherAllowances || 0),
        otherDeductions: Number(row.otherDeductions || 0),
        sanedEnabled: row.sanedEnabled,
      }));
    if (payload.length === 0) {
      setError("أضف موظف وراتب أساسي قبل الحساب");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.payroll.calculate(payload);
      setResults(res.results || []);
      setTotals(res.totals || null);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل حساب الرواتب");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الرواتب</h1>
          <p className="text-[#6B7280] mt-1">حساب مسير الرواتب مع GOSI وSANED بناءً على الموظفين المسجلين</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={calculate} disabled={busy || loading}>
          {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Calculator className="me-2 h-4 w-4" />}
          حساب المسير
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="الموظفون" value={employees.length.toString()} />
        <Metric label="إجمالي الراتب" value={`${money(totals?.grossSalary)} SAR`} />
        <Metric label="صافي الراتب" value={`${money(totals?.netSalary)} SAR`} />
        <Metric label="تكلفة صاحب العمل" value={`${money(totals?.employerCost)} SAR`} />
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>مسير الشهر</CardTitle>
            <Button variant="outline" onClick={() => setRows((prev) => [...prev, blankRow()])}><Plus className="me-2 h-4 w-4" />سطر</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1276E3]" /></div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto h-10 w-10 text-[#9CA3AF]" />
              <p className="mt-3 text-sm text-[#6B7280]">أضف موظفين من صفحة الموظفين قبل حساب الرواتب.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px]">
                <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <th className="px-3 py-3 text-start">الموظف</th>
                  <th className="px-3 py-3 text-start">الجنسية</th>
                  <th className="px-3 py-3 text-start">أساسي</th>
                  <th className="px-3 py-3 text-start">سكن</th>
                  <th className="px-3 py-3 text-start">نقل</th>
                  <th className="px-3 py-3 text-start">بدلات</th>
                  <th className="px-3 py-3 text-start">استقطاعات</th>
                  <th className="px-3 py-3 text-start">ساند</th>
                  <th className="px-3 py-3 text-start"></th>
                </tr></thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b border-[#F3F4F6]">
                      <td className="px-3 py-2">
                        <Select value={row.employeeId} onValueChange={(employeeId) => updateRow(index, { employeeId })}>
                          <SelectTrigger className="min-w-48"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                          <SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.displayName}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select value={row.nationalityCode} onValueChange={(nationalityCode) => updateRow(index, { nationalityCode })}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SA">SA</SelectItem>
                            <SelectItem value="AE">AE</SelectItem>
                            <SelectItem value="US">US</SelectItem>
                            <SelectItem value="GB">GB</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <MoneyInput value={row.basicSalary} onChange={(basicSalary) => updateRow(index, { basicSalary })} />
                      <MoneyInput value={row.housingAllowance} onChange={(housingAllowance) => updateRow(index, { housingAllowance })} />
                      <MoneyInput value={row.transportAllowance} onChange={(transportAllowance) => updateRow(index, { transportAllowance })} />
                      <MoneyInput value={row.otherAllowances} onChange={(otherAllowances) => updateRow(index, { otherAllowances })} />
                      <MoneyInput value={row.otherDeductions} onChange={(otherDeductions) => updateRow(index, { otherDeductions })} />
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.sanedEnabled} onChange={(e) => updateRow(index, { sanedEnabled: e.target.checked })} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle>نتيجة الحساب</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-4 py-3 text-start">الإجمالي</th>
                  <th className="px-4 py-3 text-start">GOSI الموظف</th>
                  <th className="px-4 py-3 text-start">GOSI الشركة</th>
                  <th className="px-4 py-3 text-start">الصافي</th>
                </tr></thead>
                <tbody>
                  {results.map((result) => {
                    const employee = employeeById.get(result.employeeId);
                    return (
                      <tr key={result.employeeId} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                        <td className="px-4 py-3 text-sm text-[#0B1B49]">{employee?.displayName || result.employeeId}</td>
                        <td className="px-4 py-3 text-sm font-english">{money(result.grossSalary)}</td>
                        <td className="px-4 py-3 text-sm font-english">{money(result.employeeGosi)}</td>
                        <td className="px-4 py-3 text-sm font-english">{money(result.employerGosi)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#0B1B49] font-english">{money(result.netSalary)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <td className="px-3 py-2">
      <Input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="w-28 font-english" />
    </td>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0B1B49] font-english">{value}</div>
    </div>
  );
}
