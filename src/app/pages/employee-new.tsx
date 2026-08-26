/**
 * New Employee — full page (app-wide standard · no slide-overs).
 * /app/employees/new
 *
 * The employee is saved as a contact (isEmployee) plus a payroll contract.
 * Live GOSI/net-salary preview uses the same payroll engine.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Landmark, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { COUNTRIES, findCountry } from "../lib/countries";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const PRIORITY_COUNTRIES = ["SA", "AE", "US"];
const countrySort = (a: (typeof COUNTRIES)[number], b: (typeof COUNTRIES)[number]) => {
  const ai = PRIORITY_COUNTRIES.indexOf(a.code);
  const bi = PRIORITY_COUNTRIES.indexOf(b.code);
  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1;
  if (bi >= 0) return 1;
  return a.nameAr.localeCompare(b.nameAr, "ar");
};

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function idLabelByCountry(t: (ar: string, en?: string) => string, country: string) {
  if (country === "US") return "Tax ID / SSN";
  if (country === "SA") return t("الهوية/الإقامة", "National ID / Iqama");
  return t("الهوية / الرقم الضريبي", "National ID / Tax ID");
}

function countryComplianceHint(t: (ar: string, en?: string) => string, country: string) {
  if (country === "SA") return t("السعودية: يفضّل إدخال رقم الهوية/الإقامة + IBAN سعودي.", "Saudi Arabia: enter the National ID / Iqama number plus a Saudi IBAN.");
  if (country === "US") return t("US: استخدم Tax ID/SSN وأدخل بيانات بنك مناسبة للحوالات.", "US: use Tax ID/SSN and enter bank details suitable for wire transfers.");
  return t("يمكن تعديل المتطلبات لاحقاً حسب سياسات الموارد البشرية.", "Requirements can be adjusted later per HR policies.");
}

function createCostCenterCode(name: string, existingCodes: Set<string>) {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 5) || "DEPT";
  let index = 1;
  let candidate = `${normalized}-${String(index).padStart(3, "0")}`;
  while (existingCodes.has(candidate)) {
    index += 1;
    candidate = `${normalized}-${String(index).padStart(3, "0")}`;
  }
  return candidate;
}

const EMPTY_FORM = {
  displayName: "", email: "", phone: "", nationalId: "",
  country: "SA", employeeNumber: "", jobTitle: "",
  departmentId: "", department: "", nationalityCode: "SA",
  iban: "", bankId: "",
  basicSalary: "", housingAllowance: "", transportAllowance: "",
  otherAllowances: "", otherDeductions: "", notes: "",
};

export function EmployeeNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costCenters, setCostCenters] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [salaryPreview, setSalaryPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const loadCostCenters = useCallback(async () => {
    try {
      const res = await api.costCenters.list();
      setCostCenters((res.items || []) as Array<{ id: string; code: string; name: string }>);
    } catch { setCostCenters([]); }
  }, []);
  useEffect(() => { loadCostCenters(); }, [loadCostCenters]);

  const departmentItems = useMemo(
    () => costCenters.map((center) => ({ id: center.id, label: center.name, sublabel: center.code })),
    [costCenters],
  );

  const COUNTRY_ITEMS = useMemo(
    () => [...COUNTRIES].sort(countrySort).map((country) => ({
      id: country.code,
      label: `${country.flag} ${t(country.nameAr, country.nameEn)}`,
      sublabel: `${country.nameEn} · ${country.code}`,
    })),
    [t],
  );

  const selectedDepartment = useMemo(
    () => costCenters.find((center) => center.id === form.departmentId),
    [costCenters, form.departmentId],
  );
  const resolvedDepartment = useMemo(
    () => selectedDepartment?.name || form.department.trim() || null,
    [selectedDepartment, form.department],
  );

  const selectedCountry = useMemo(() => findCountry(form.country), [form.country]);
  const isSaudi = (form.nationalityCode || "").toUpperCase() === "SA";

  // Live salary preview (GOSI + net) · same engine as payroll
  useEffect(() => {
    const basicSalary = Number(form.basicSalary || 0);
    if (basicSalary <= 0) { setSalaryPreview(null); setPreviewLoading(false); return; }
    let disposed = false;
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const payload = [{
          employeeId: "preview",
          nationalityCode: (form.nationalityCode || "SA").toUpperCase(),
          basicSalary,
          housingAllowance: Number(form.housingAllowance || 0),
          transportAllowance: Number(form.transportAllowance || 0),
          otherAllowances: Number(form.otherAllowances || 0),
          otherDeductions: Number(form.otherDeductions || 0),
          sanedEnabled: isSaudi,
        }];
        const response = await api.payroll.calculate(payload);
        if (!disposed) setSalaryPreview(response.results?.[0] || null);
      } catch { if (!disposed) setSalaryPreview(null); }
      finally { if (!disposed) setPreviewLoading(false); }
    }, 260);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [form.basicSalary, form.housingAllowance, form.transportAllowance, form.otherAllowances, form.otherDeductions, form.nationalityCode, isSaudi]);

  const createDepartment = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error(t("اسم القسم مطلوب", "Department name is required"));
    const existingCodes = new Set(costCenters.map((center) => center.code));
    const code = createCostCenterCode(trimmed, existingCodes);
    const created = await api.costCenters.create({ code, name: trimmed });
    setCostCenters((prev) => [...prev, created as { id: string; code: string; name: string }].sort((a, b) => a.code.localeCompare(b.code)));
    push("success", `${t("تم إنشاء القسم", "Department created")} ${trimmed}`);
    return created.id as string;
  };

  const createEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) { setError(t("اسم الموظف مطلوب", "Employee name is required")); return; }
    setBusy(true); setError(null);
    try {
      const employee = await api.contacts.create({
        type: "CUSTOMER",
        isCustomer: false, isSupplier: false, isEmployee: true,
        entityKind: "INDIVIDUAL",
        displayName: form.displayName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        nationalId: form.nationalId.trim() || null,
        country: form.country,
        notes: form.notes.trim() || null,
      });

      await api.payroll.saveContract({
        contactId: employee.id,
        employeeNumber: form.employeeNumber.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        department: resolvedDepartment,
        nationalityCode: (form.nationalityCode || form.country).toUpperCase(),
        iban: form.iban.trim() || null,
        bankId: form.bankId.trim() || null,
        basicSalary: Number(form.basicSalary || 0),
        housingAllowance: Number(form.housingAllowance || 0),
        transportAllowance: Number(form.transportAllowance || 0),
        otherAllowances: Number(form.otherAllowances || 0),
        otherDeductions: Number(form.otherDeductions || 0),
        sanedEnabled: isSaudi,
      });

      push("success", t("تمت إضافة الموظف", "Employee added"));
      navigate(`/app/contacts/${employee.id}`);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل حفظ الموظف", "Failed to save employee"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/employees" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للموظفين", "Back to Employees")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{t("موظف جديد", "New employee")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("الموظف يحفظ كجهة اتصال بدور موظف. إنشاء مستخدم للنظام اختياري ويمكن تأجيله.", "The employee is saved as a contact with the employee role. Creating a system user is optional and can be deferred.")}</p>
      </div>

      <form onSubmit={createEmployee} className="space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("البيانات الأساسية", "Basics")}</div>
            <div className="space-y-2">
              <Label>{t("الاسم *", "Name *")}</Label>
              <Input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={t("اسم الموظف", "Employee name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("البريد", "Email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="font-english" placeholder="employee@company.sa" /></div>
              <div className="space-y-2"><Label>{t("الجوال", "Mobile")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="font-english" placeholder="+9665..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{idLabelByCountry(t, form.country)}</Label>
                <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" className="font-english" maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label>{t("الدولة", "Country")}</Label>
                <SearchableCombobox
                  value={form.country}
                  onChange={(country) => setForm((prev) => ({ ...prev, country, nationalityCode: !prev.nationalityCode || prev.nationalityCode === prev.country ? country : prev.nationalityCode }))}
                  items={COUNTRY_ITEMS}
                  placeholder={t("ابحث عن الدولة", "Search for a country")}
                />
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{countryComplianceHint(t, form.country)}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الوظيفة والقسم", "Job & department")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("رقم الموظف", "Employee number")}</Label><Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} dir="ltr" className="font-english" placeholder="EMP-001" /></div>
              <div className="space-y-2">
                <Label>{t("الجنسية", "Nationality")}</Label>
                <SearchableCombobox value={form.nationalityCode} onChange={(nationalityCode) => setForm({ ...form, nationalityCode })} items={COUNTRY_ITEMS} placeholder={t("اختر الجنسية", "Select nationality")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("المسمى الوظيفي", "Job title")}</Label><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder={t("محاسب", "Accountant")} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("القسم (من مراكز التكلفة)", "Department (from cost centers)")}</Label>
                  <Link to="/app/cost-centers" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Landmark className="h-3 w-3" /> {t("إدارة الأقسام", "Manage departments")}</Link>
                </div>
                <SearchableCombobox
                  value={form.departmentId}
                  onChange={(departmentId) => setForm({ ...form, departmentId, department: "" })}
                  items={departmentItems}
                  placeholder={t("اختر قسماً", "Select a department")}
                  onCreate={createDepartment}
                  createLabel={(query) => `${t("+ إنشاء قسم", "+ Create department")} "${query}"`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("قسم مخصص (اختياري)", "Custom department (optional)")}</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, departmentId: "" })} placeholder={t("اكتب القسم يدوياً عند الحاجة", "Type the department manually when needed")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })} dir="ltr" className="font-english" placeholder={selectedCountry?.code === "SA" ? "SA..." : "IBAN"} /></div>
              <div className="space-y-2"><Label>Bank ID</Label><Input value={form.bankId} onChange={(e) => setForm({ ...form, bankId: e.target.value.toUpperCase() })} dir="ltr" className="font-english" placeholder="RJHI" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/[0.02]">
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("حساب الراتب التقديري", "Estimated salary calculation")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>{t("الراتب الأساسي", "Basic salary")}</Label><Input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("بدل السكن", "Housing allowance")}</Label><Input type="number" min="0" step="0.01" value={form.housingAllowance} onChange={(e) => setForm({ ...form, housingAllowance: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("بدل النقل", "Transport allowance")}</Label><Input type="number" min="0" step="0.01" value={form.transportAllowance} onChange={(e) => setForm({ ...form, transportAllowance: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("بدلات أخرى", "Other allowances")}</Label><Input type="number" min="0" step="0.01" value={form.otherAllowances} onChange={(e) => setForm({ ...form, otherAllowances: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("استقطاعات أخرى", "Other deductions")}</Label><Input type="number" min="0" step="0.01" value={form.otherDeductions} onChange={(e) => setForm({ ...form, otherDeductions: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>

            {previewLoading && (
              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("جاري تحديث المعاينة...", "Updating preview...")}
              </div>
            )}

            {salaryPreview && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <PreviewMetric label={t("الإجمالي", "Gross")} value={money(Number(salaryPreview.grossSalary || 0))} tone="green" />
                <PreviewMetric label={t("استقطاعات", "Deductions")} value={money(Number(salaryPreview.totalDeductions || 0))} tone="red" />
                <PreviewMetric label={t("GOSI الموظف", "Employee GOSI")} value={money(Number(salaryPreview.employeeGosi || 0))} tone="amber" />
                <PreviewMetric label={t("الصافي", "Net")} value={money(Number(salaryPreview.netSalary || 0))} tone="blue" />
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t("المعاينة تعتمد نفس محرك حساب الرواتب الحالي ويمكنك تعديل الأرقام يدوياً قبل الحفظ.", "The preview uses the same payroll calculation engine, and you can adjust the numbers manually before saving.")}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <Label>{t("ملاحظات", "Notes")}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("أي ملاحظات إدارية إضافية", "Any additional administrative notes")} />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => navigate("/app/employees")}>{t("إلغاء", "Cancel")}</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{t("حفظ الموظف", "Save employee")}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" | "amber" }) {
  const toneClass =
    tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "red" ? "border-red-200 bg-red-50 text-red-700"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px]">{label}</div>
      <div className="font-english text-sm font-semibold" dir="ltr">{value}</div>
    </div>
  );
}
