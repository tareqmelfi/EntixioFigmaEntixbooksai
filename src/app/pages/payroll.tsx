import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Calculator, CheckCircle2, Download, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SearchableCombobox } from "../components/searchable-combobox";
import { ToastStack, useToasts } from "../components/side-panel";
import { COUNTRIES } from "../lib/countries";
import { api, ApiError, type Contact } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type PayrollRow = {
  employeeId: string;
  nationalityCode: string;
  basicSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  otherDeductions: string;
  sanedEnabled: boolean;
  gosiOverride: string; // empty = auto-calc; a number = manual override of employee GOSI
};

type PayrollPreview = {
  grossSalary: number;
  employeeGosi: number;
  employerGosi: number;
  totalDeductions: number;
  netSalary: number;
  gosiBase: number;
};

const GOSI_SALARY_CAP = 45_000;
const GOSI_SALARY_FLOOR = 1_500;

const blankRow = (): PayrollRow => ({
  employeeId: "",
  nationalityCode: "SA",
  basicSalary: "",
  housingAllowance: "",
  transportAllowance: "",
  otherAllowances: "",
  otherDeductions: "",
  sanedEnabled: true,
  gosiOverride: "",
});

const money = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRIORITY_COUNTRIES = ["SA", "AE", "US"];
const countrySort = (a: (typeof COUNTRIES)[number], b: (typeof COUNTRIES)[number]) => {
  const ai = PRIORITY_COUNTRIES.indexOf(a.code);
  const bi = PRIORITY_COUNTRIES.indexOf(b.code);
  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1;
  if (bi >= 0) return 1;
  return a.nameAr.localeCompare(b.nameAr, "ar");
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function numberValue(input: string) {
  return Number(input || 0);
}

function calculateRowPreview(row: PayrollRow): PayrollPreview {
  const basicSalary = numberValue(row.basicSalary);
  const housingAllowance = numberValue(row.housingAllowance);
  const transportAllowance = numberValue(row.transportAllowance);
  const otherAllowances = numberValue(row.otherAllowances);
  const otherDeductions = numberValue(row.otherDeductions);
  const isSaudi = row.nationalityCode.toUpperCase() === "SA";

  const grossSalary = basicSalary + housingAllowance + transportAllowance + otherAllowances;
  const rawBase = basicSalary + housingAllowance;
  const gosiBase = Math.min(
    GOSI_SALARY_CAP,
    Math.max(isSaudi ? GOSI_SALARY_FLOOR : rawBase, rawBase),
  );

  let annuitiesEmployee = 0;
  let annuitiesEmployer = 0;
  let occupationalEmployer = 0;
  let sanedEmployee = 0;
  let sanedEmployer = 0;

  if (isSaudi) {
    annuitiesEmployee = round2(gosiBase * 0.09);
    annuitiesEmployer = round2(gosiBase * 0.09);
    occupationalEmployer = round2(gosiBase * 0.02);
    if (row.sanedEnabled) {
      sanedEmployee = round2(gosiBase * 0.0075);
      sanedEmployer = round2(gosiBase * 0.0075);
    }
  } else {
    occupationalEmployer = round2(gosiBase * 0.02);
  }

  const employeeGosi = round2(annuitiesEmployee + sanedEmployee);
  const employerGosi = round2(annuitiesEmployer + occupationalEmployer + sanedEmployer);
  const totalDeductions = round2(employeeGosi + otherDeductions);
  const netSalary = round2(grossSalary - totalDeductions);

  return {
    grossSalary: round2(grossSalary),
    employeeGosi,
    employerGosi,
    totalDeductions,
    netSalary,
    gosiBase: round2(gosiBase),
  };
}

export function Payroll() {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [settings, setSettings] = useState({ employerId: "", establishmentId: "", currency: "SAR" });
  const [rows, setRows] = useState<PayrollRow[]>([blankRow()]);
  const [results, setResults] = useState<any[]>([]);
  const [totals, setTotals] = useState<any | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedRunId, setLastSavedRunId] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, contractsRes, runsRes, settingsRes] = await Promise.all([
        api.contacts.list({ role: "employee", limit: 200 } as any),
        api.payroll.contracts().catch(() => ({ items: [] })),
        api.payroll.runs().catch(() => ({ items: [] })),
        api.payroll.settings().catch(() => ({ employerId: "", establishmentId: "", currency: "SAR" })),
      ]);
      setEmployees(res.items || []);
      setContracts(contractsRes.items || []);
      setRuns(runsRes.items || []);
      setSettings({
        employerId: settingsRes?.employerId || "",
        establishmentId: settingsRes?.establishmentId || "",
        currency: settingsRes?.currency || "SAR",
      });

      if ((res.items || []).length > 0 && (contractsRes.items || []).length > 0) {
        setRows((prev) => {
          const hasUserInput = prev.some((row) => row.employeeId || row.basicSalary);
          if (hasUserInput) return prev;
          return contractsRes.items.map((contract: any) => ({
            employeeId: contract.contactId,
            nationalityCode: contract.nationalityCode || "SA",
            basicSalary: String(contract.basicSalary || ""),
            housingAllowance: String(contract.housingAllowance || ""),
            transportAllowance: String(contract.transportAllowance || ""),
            otherAllowances: String(contract.otherAllowances || ""),
            otherDeductions: String(contract.otherDeductions || ""),
            sanedEnabled: contract.sanedEnabled !== false,
            gosiOverride: "",
          }));
        });
      }
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر تحميل الموظفين", "Could not load employees"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const contractByEmployeeId = useMemo(
    () => new Map(contracts.map((contract: any) => [contract.contactId, contract])),
    [contracts],
  );

  const employeeItems = useMemo(
    () => employees.map((employee) => ({
      id: employee.id,
      label: employee.displayName,
      sublabel: [employee.customCode, employee.nationalId].filter(Boolean).join(" · ") || employee.id,
    })),
    [employees],
  );

  const rowPreviews = useMemo(() => rows.map((row) => calculateRowPreview(row)), [rows]);

  const NATIONALITY_ITEMS = useMemo(
    () => [...COUNTRIES]
      .sort(countrySort)
      .map((country) => ({
        id: country.code,
        label: `${country.flag} ${t(country.nameAr, country.nameEn)}`,
        sublabel: `${country.nameEn} · ${country.code}`,
      })),
    [t],
  );

  const estimatedTotals = useMemo(
    () => rowPreviews.reduce((acc, preview) => ({
      grossSalary: acc.grossSalary + preview.grossSalary,
      employeeGosi: acc.employeeGosi + preview.employeeGosi,
      employerGosi: acc.employerGosi + preview.employerGosi,
      netSalary: acc.netSalary + preview.netSalary,
      employerCost: acc.employerCost + preview.grossSalary + preview.employerGosi,
      totalDeductions: acc.totalDeductions + preview.totalDeductions,
    }), {
      grossSalary: 0,
      employeeGosi: 0,
      employerGosi: 0,
      netSalary: 0,
      employerCost: 0,
      totalDeductions: 0,
    }),
    [rowPreviews],
  );

  const updateRow = (index: number, patch: Partial<PayrollRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const applyEmployeeContract = (index: number, employeeId: string) => {
    const contract = contractByEmployeeId.get(employeeId);
    const employee = employeeById.get(employeeId);

    if (!contract) {
      updateRow(index, {
        employeeId,
        nationalityCode: (employee?.country || "SA").toUpperCase(),
      });
      return;
    }

    updateRow(index, {
      employeeId,
      nationalityCode: (contract.nationalityCode || employee?.country || "SA").toUpperCase(),
      basicSalary: String(contract.basicSalary || ""),
      housingAllowance: String(contract.housingAllowance || ""),
      transportAllowance: String(contract.transportAllowance || ""),
      otherAllowances: String(contract.otherAllowances || ""),
      otherDeductions: String(contract.otherDeductions || ""),
      sanedEnabled: contract.sanedEnabled !== false,
    });
  };

  const buildPayrollPayload = () =>
    rows
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

  // Calculate + auto-save as DRAFT · the primary action. Calculates the payroll
  // and immediately persists it so the user can review the results and then approve.
  const calculate = async () => {
    const payload = buildPayrollPayload();
    if (payload.length === 0) {
      setError(t("أضف موظف وراتب أساسي قبل الحساب", "Add an employee and a basic salary before calculating"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 1 · calculate (preview)
      const res = await api.payroll.calculate(payload);
      setResults(res.results || []);
      setTotals(res.totals || null);
      // 2 · auto-save as DRAFT so the run is accessible + can be approved/deleted
      const run = await api.payroll.saveRun({ period, employees: payload, notes: "Auto-saved from Calculate" });
      setLastSavedRunId(run.id);
      setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل حساب الرواتب", "Failed to calculate payroll"));
    } finally {
      setBusy(false);
    }
  };

  // Approve · locks the last-saved DRAFT run → APPROVED.
  const approveRun = async () => {
    if (!lastSavedRunId) {
      setError(t("احسب المسير أولاً قبل الاعتماد", "Calculate the payroll run first before approving"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.payroll.updateRunStatus(lastSavedRunId, "APPROVED");
      setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      push("success", t("تم اعتماد المسير بنجاح", "Payroll run approved successfully"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل اعتماد المسير", "Failed to approve payroll run"));
    } finally {
      setBusy(false);
    }
  };

  // Delete a saved DRAFT run.
  const deleteRun = async (runId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.payroll.deleteRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (lastSavedRunId === runId) setLastSavedRunId(null);
      push("success", t("تم حذف المسير", "Payroll run deleted"));
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل حذف المسير", "Failed to delete payroll run"));
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.payroll.updateSettings(settings);
      setSettings({ employerId: saved.employerId || "", establishmentId: saved.establishmentId || "", currency: saved.currency || "SAR" });
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل حفظ إعدادات الرواتب", "Failed to save payroll settings"));
    } finally {
      setBusy(false);
    }
  };

  const displayedTotals = totals || estimatedTotals;

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الرواتب", "Payroll")}</h1>
          <p className="text-muted-foreground mt-1">{t("حساب مسير الرواتب مع GOSI وSANED بناءً على الموظفين المسجلين", "Calculate the payroll run with GOSI and SANED based on registered employees")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} dir="ltr" className="w-36 font-english" />
          {/* Primary: Calculate → auto-saves as DRAFT */}
          <Button className="bg-primary hover:bg-primary/90" onClick={calculate} disabled={busy || loading}>
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Calculator className="me-2 h-4 w-4" />}
            {t("حساب المسير", "Calculate payroll")}
          </Button>
          {/* Secondary: Approve → locks the last-saved DRAFT → APPROVED */}
          <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={approveRun} disabled={busy || loading || !lastSavedRunId}>
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}
            {t("اعتماد المسير", "Approve payroll run")}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label={t("الموظفون", "Employees")} value={employees.length.toString()} />
        <Metric label={t("العقود المحفوظة", "Saved contracts")} value={contracts.length.toString()} />
        <Metric label={t("إجمالي الراتب", "Gross salary")} value={`${money(displayedTotals?.grossSalary)} SAR`} />
        <Metric label={t("الاستقطاعات", "Deductions")} value={`${money(displayedTotals?.totalDeductions)} SAR`} />
        <Metric label={t("صافي الراتب", "Net salary")} value={`${money(displayedTotals?.netSalary)} SAR`} />
        <Metric label={t("تكلفة صاحب العمل", "Employer cost")} value={`${money(displayedTotals?.employerCost)} SAR`} />
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle>{t("إعدادات WPS / مدد", "WPS / Mudad settings")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2"><Label>{t("رقم صاحب العمل", "Employer ID")}</Label><Input value={settings.employerId} onChange={(e) => setSettings({ ...settings, employerId: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("رقم المنشأة", "Establishment ID")}</Label><Input value={settings.establishmentId} onChange={(e) => setSettings({ ...settings, establishmentId: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("العملة", "Currency")}</Label><Input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase().slice(0, 3) })} dir="ltr" className="font-english" /></div>
            <div className="flex items-end"><Button variant="outline" className="w-full border-border" onClick={saveSettings} disabled={busy}>{t("حفظ الإعدادات", "Save settings")}</Button></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>مسير الشهر</CardTitle>
            <Button variant="outline" onClick={() => setRows((prev) => [...prev, blankRow()])}><Plus className="me-2 h-4 w-4" />سطر</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">أضف موظفين من صفحة الموظفين قبل حساب الرواتب.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-3 py-3 text-start">الموظف</th>
                  <th className="px-3 py-3 text-start">الجنسية</th>
                  <th className="px-3 py-3 text-end">أساسي</th>
                  <th className="px-3 py-3 text-end">سكن</th>
                  <th className="px-3 py-3 text-end">نقل</th>
                  <th className="px-3 py-3 text-end">بدلات</th>
                  <th className="px-3 py-3 text-end">GOSI الموظف</th>
                  <th className="px-3 py-3 text-end">استقطاعات أخرى</th>
                  <th className="px-3 py-3 text-center">ساند</th>
                  <th className="px-3 py-3 text-end">قبل / بعد</th>
                  <th className="px-3 py-3"></th>
                </tr></thead>
                <tbody>
                  {rows.map((row, index) => {
                    const preview = rowPreviews[index];
                    const employee = employeeById.get(row.employeeId);

                    return (
                      <tr key={index} className="border-b border-border/50 align-top">
                        <td className="px-3 py-2 min-w-[220px]">
                          <SearchableCombobox
                            value={row.employeeId}
                            onChange={(employeeId) => applyEmployeeContract(index, employeeId)}
                            items={employeeItems}
                            placeholder="اختر الموظف"
                            menuMinWidth={340}
                          />
                          {employee && (
                            <p className="mt-1 text-[11px] text-muted-foreground font-english" dir="ltr">
                              {employee.email || employee.phone || employee.id}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <SearchableCombobox
                            value={row.nationalityCode}
                            onChange={(nationalityCode) => updateRow(index, { nationalityCode: nationalityCode.toUpperCase() })}
                            items={NATIONALITY_ITEMS}
                            placeholder="الجنسية"
                            menuMinWidth={280}
                          />
                        </td>
                        <MoneyInput value={row.basicSalary} onChange={(basicSalary) => updateRow(index, { basicSalary })} />
                        <MoneyInput value={row.housingAllowance} onChange={(housingAllowance) => updateRow(index, { housingAllowance })} />
                        <MoneyInput value={row.transportAllowance} onChange={(transportAllowance) => updateRow(index, { transportAllowance })} />
                        <MoneyInput value={row.otherAllowances} onChange={(otherAllowances) => updateRow(index, { otherAllowances })} />
                        {/* GOSI · its own editable column (auto-calculated, manual override allowed) */}
                        <td className="px-3 py-2 text-end">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.gosiOverride || (preview.employeeGosi > 0 ? String(preview.employeeGosi.toFixed(2)) : "")}
                            onChange={(e) => updateRow(index, { gosiOverride: e.target.value })}
                            dir="ltr"
                            className="w-28 font-english text-end"
                            placeholder="تلقائي"
                          />
                          {row.nationalityCode.toUpperCase() === "SA" && (
                            <div className="mt-1 text-[9px] text-muted-foreground">أساس: <span className="font-english">{money(preview.gosiBase)}</span></div>
                          )}
                        </td>
                        {/* Other Deductions · independent input (loans, penalties, custom) */}
                        <td className="px-3 py-2 text-end">
                          <Input type="number" min="0" step="0.01" value={row.otherDeductions} onChange={(e) => updateRow(index, { otherDeductions: e.target.value })} dir="ltr" className="w-28 font-english text-end" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={row.sanedEnabled} onChange={(e) => updateRow(index, { sanedEnabled: e.target.checked })} />
                          <div className="mt-1 text-[10px] text-muted-foreground">{row.nationalityCode.toUpperCase() === "SA" ? "للسعوديين" : "غير مطبق"}</div>
                        </td>
                        <td className="px-3 py-2 text-end min-w-[190px]">
                          <div className="text-[11px] text-muted-foreground">الإجمالي قبل الاستقطاع: <span className="font-english text-foreground">{money(preview.grossSalary)}</span></div>
                          <div className="text-[11px] text-red-600">الاستقطاعات: <span className="font-english">{money(preview.totalDeductions)}</span></div>
                          <div className="text-sm font-semibold text-emerald-700">الصافي: <span className="font-english">{money(preview.netSalary)}</span></div>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-border">
          <CardHeader><CardTitle>نتيجة الحساب</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-4 py-3 text-end">الإجمالي</th>
                  <th className="px-4 py-3 text-end">GOSI الموظف</th>
                  <th className="px-4 py-3 text-end">إجمالي الاستقطاع</th>
                  <th className="px-4 py-3 text-end">GOSI الشركة</th>
                  <th className="px-4 py-3 text-end">الصافي</th>
                </tr></thead>
                <tbody>
                  {results.map((result) => {
                    const employee = employeeById.get(result.employeeId);
                    return (
                      <tr key={result.employeeId} className="border-b border-border/50 hover:bg-primary/5">
                        <td className="px-4 py-3 text-sm text-foreground">{employee?.displayName || result.employeeId}</td>
                        <td className="px-4 py-3 text-sm font-english text-end">{money(result.grossSalary)}</td>
                        <td className="px-4 py-3 text-sm font-english text-end text-amber-700">{money(result.employeeGosi)}</td>
                        <td className="px-4 py-3 text-sm font-english text-end text-red-700">{money(result.totalDeductions)}</td>
                        <td className="px-4 py-3 text-sm font-english text-end">{money(result.employerGosi)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-700 font-english text-end">{money(result.netSalary)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader><CardTitle>مسيرات محفوظة</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">لا توجد مسيرات محفوظة بعد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start">الرقم</th>
                  <th className="px-4 py-3 text-start">الفترة</th>
                  <th className="px-4 py-3 text-start">الحالة</th>
                  <th className="px-4 py-3 text-start">الصافي</th>
                  <th className="px-4 py-3 text-start">عدد الموظفين</th>
                  <th className="px-4 py-3 text-start"></th>
                </tr></thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/50 hover:bg-primary/5">
                      <td className="px-4 py-3 text-sm font-english text-primary font-semibold">
                        <button onClick={() => navigate(`/app/payroll/${run.id}`)} className="hover:underline">{run.runNumber}</button>
                      </td>
                      <td className="px-4 py-3 text-sm font-english">{run.period}</td>
                      <td className="px-4 py-3 text-xs"><span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">{run.status}</span></td>
                      <td className="px-4 py-3 text-sm font-english text-foreground font-semibold">{money(run.netSalary)} {run.currency}</td>
                      <td className="px-4 py-3 text-sm font-english text-end">{run.lines?.length || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => window.open(api.payroll.runSifUrl(run.id), "_blank", "noopener,noreferrer")}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-blue-50"
                          >
                            <Download className="h-3.5 w-3.5" /> SIF
                          </button>
                          {run.status === "DRAFT" && (
                            <button
                              onClick={() => deleteRun(run.id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="حذف المسير (مسودة)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground font-english">{value}</div>
    </div>
  );
}
