import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { COUNTRIES, findCountry } from "../lib/countries";
import { api, ApiError, type Contact } from "../lib/api";

const PRIORITY_COUNTRIES = ["SA", "AE", "US"];
const COUNTRY_ITEMS = [...COUNTRIES]
  .sort((a, b) => {
    const ai = PRIORITY_COUNTRIES.indexOf(a.code);
    const bi = PRIORITY_COUNTRIES.indexOf(b.code);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.nameAr.localeCompare(b.nameAr, "ar");
  })
  .map((country) => ({
    id: country.code,
    label: `${country.flag} ${country.nameAr}`,
    sublabel: `${country.nameEn} · ${country.code}`,
  }));

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function countryLabel(code: string) {
  return findCountry(code)?.nameAr || code;
}

function idLabelByCountry(country: string) {
  if (country === "US") return "Tax ID / SSN";
  if (country === "SA") return "الهوية/الإقامة";
  return "الهوية / الرقم الضريبي";
}

function countryComplianceHint(country: string) {
  if (country === "SA") return "السعودية: يفضّل إدخال رقم الهوية/الإقامة + IBAN سعودي.";
  if (country === "US") return "US: استخدم Tax ID/SSN وأدخل بيانات بنك مناسبة للحوالات.";
  return "يمكن تعديل المتطلبات لاحقاً حسب سياسات الموارد البشرية.";
}

function createCostCenterCode(name: string, existingCodes: Set<string>) {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 5) || "DEPT";

  let index = 1;
  let candidate = `${normalized}-${String(index).padStart(3, "0")}`;
  while (existingCodes.has(candidate)) {
    index += 1;
    candidate = `${normalized}-${String(index).padStart(3, "0")}`;
  }
  return candidate;
}

export function Employees() {
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [costCenters, setCostCenters] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [salaryPreview, setSalaryPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    nationalId: "",
    country: "SA",
    employeeNumber: "",
    jobTitle: "",
    departmentId: "",
    department: "",
    nationalityCode: "SA",
    iban: "",
    bankId: "",
    basicSalary: "",
    housingAllowance: "",
    transportAllowance: "",
    otherAllowances: "",
    otherDeductions: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.contacts.list({ role: "employee", limit: 200 } as any);
      setItems(res.items || []);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "تعذر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCostCenters = useCallback(async () => {
    try {
      const res = await api.costCenters.list();
      setCostCenters((res.items || []) as Array<{ id: string; code: string; name: string }>);
    } catch {
      setCostCenters([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadCostCenters();
  }, [load, loadCostCenters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.displayName.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.phone?.includes(q) ||
      item.nationalId?.includes(q),
    );
  }, [items, search]);

  const departmentItems = useMemo(
    () => costCenters.map((center) => ({ id: center.id, label: center.name, sublabel: center.code })),
    [costCenters],
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

  useEffect(() => {
    const basicSalary = Number(form.basicSalary || 0);
    if (!open || basicSalary <= 0) {
      setSalaryPreview(null);
      setPreviewLoading(false);
      return;
    }

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
      } catch {
        if (!disposed) setSalaryPreview(null);
      } finally {
        if (!disposed) setPreviewLoading(false);
      }
    }, 260);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    form.basicSalary,
    form.housingAllowance,
    form.transportAllowance,
    form.otherAllowances,
    form.otherDeductions,
    form.nationalityCode,
    isSaudi,
  ]);

  const createDepartment = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("اسم القسم مطلوب");

    const existingCodes = new Set(costCenters.map((center) => center.code));
    const code = createCostCenterCode(trimmed, existingCodes);
    const created = await api.costCenters.create({ code, name: trimmed });

    setCostCenters((prev) => {
      const next = [...prev, created as { id: string; code: string; name: string }];
      return next.sort((a, b) => a.code.localeCompare(b.code));
    });

    push("success", `تم إنشاء القسم ${trimmed}`);
    return created.id as string;
  };

  const resetForm = () => {
    setForm({
      displayName: "",
      email: "",
      phone: "",
      nationalId: "",
      country: "SA",
      employeeNumber: "",
      jobTitle: "",
      departmentId: "",
      department: "",
      nationalityCode: "SA",
      iban: "",
      bankId: "",
      basicSalary: "",
      housingAllowance: "",
      transportAllowance: "",
      otherAllowances: "",
      otherDeductions: "",
      notes: "",
    });
    setSalaryPreview(null);
  };

  const createEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) {
      setError("اسم الموظف مطلوب");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const employee = await api.contacts.create({
        type: "CUSTOMER",
        isCustomer: false,
        isSupplier: false,
        isEmployee: true,
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

      setOpen(false);
      resetForm();
      await load();
      push("success", "تمت إضافة الموظف");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل حفظ الموظف");
    } finally {
      setBusy(false);
    }
  };

  const removeEmployee = async (id: string) => {
    setBusy(true);
    try {
      await api.contacts.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      push("success", "تم حذف الموظف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل حذف الموظف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الموظفون</h1>
          <p className="text-muted-foreground mt-1">سجل الموظفين مربوط بقائمة الاتصال ويستخدم نفس قاعدة البيانات</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />موظف جديد
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="إجمالي الموظفين" value={items.length.toString()} />
        <Metric label="موظفون لديهم بريد" value={items.filter((item) => item.email).length.toString()} />
        <Metric label="موظفون لديهم هوية" value={items.filter((item) => item.nationalId).length.toString()} />
        <Metric label="الأقسام المُدارة" value={costCenters.length.toString()} />
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>سجل الموظفين</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهوية..." className="ps-10 border-border" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground/60" /><p className="mt-3 text-sm text-muted-foreground">لا يوجد موظفون مطابقون</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-4 py-3 text-start">التواصل</th>
                  <th className="px-4 py-3 text-start">الهوية</th>
                  <th className="px-4 py-3 text-start">الدولة</th>
                  <th className="px-4 py-3 text-start"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-primary/5">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{item.displayName}</div>
                        <div className="text-xs text-muted-foreground/60 font-english">{item.customCode || item.id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">
                        <div className="font-english">{item.email || "—"}</div>
                        <div className="font-english text-muted-foreground">{item.phone || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-english text-foreground/80">{item.nationalId || "—"}</td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{countryLabel(item.country || "SA")}</td>
                      <td className="px-4 py-3">
                        <button disabled={busy} onClick={() => removeEmployee(item.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
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

      <SidePanel title="موظف جديد" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={createEmployee} className="space-y-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">موظف جديد</h2>
            <p className="text-sm text-muted-foreground">الموظف يحفظ كجهة اتصال بدور موظف. إنشاء مستخدم للنظام اختياري ويمكن تأجيله.</p>
          </div>

          <div className="space-y-2">
            <Label>الاسم *</Label>
            <Input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="اسم الموظف" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>البريد</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="font-english" placeholder="employee@company.sa" />
            </div>
            <div className="space-y-2">
              <Label>الجوال</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="font-english" placeholder="+9665..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{idLabelByCountry(form.country)}</Label>
              <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" className="font-english" maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label>الدولة</Label>
              <SearchableCombobox
                value={form.country}
                onChange={(country) => {
                  setForm((prev) => ({
                    ...prev,
                    country,
                    nationalityCode: !prev.nationalityCode || prev.nationalityCode === prev.country
                      ? country
                      : prev.nationalityCode,
                  }));
                }}
                items={COUNTRY_ITEMS}
                placeholder="ابحث عن الدولة"
              />
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {countryComplianceHint(form.country)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>رقم الموظف</Label>
              <Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} dir="ltr" className="font-english" placeholder="EMP-001" />
            </div>
            <div className="space-y-2">
              <Label>الجنسية</Label>
              <SearchableCombobox
                value={form.nationalityCode}
                onChange={(nationalityCode) => setForm({ ...form, nationalityCode })}
                items={COUNTRY_ITEMS}
                placeholder="اختر الجنسية"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>المسمى الوظيفي</Label>
              <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="محاسب" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>القسم (من مراكز التكلفة)</Label>
                <Link to="/app/cost-centers" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Landmark className="h-3 w-3" /> إدارة الأقسام
                </Link>
              </div>
              <SearchableCombobox
                value={form.departmentId}
                onChange={(departmentId) => setForm({ ...form, departmentId, department: "" })}
                items={departmentItems}
                placeholder="اختر قسماً"
                onCreate={createDepartment}
                createLabel={(query) => `+ إنشاء قسم "${query}"`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>قسم مخصص (اختياري)</Label>
            <Input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value, departmentId: "" })}
              placeholder="اكتب القسم يدوياً عند الحاجة"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })} dir="ltr" className="font-english" placeholder={selectedCountry?.code === "SA" ? "SA..." : "IBAN"} />
            </div>
            <div className="space-y-2">
              <Label>Bank ID</Label>
              <Input value={form.bankId} onChange={(e) => setForm({ ...form, bankId: e.target.value.toUpperCase() })} dir="ltr" className="font-english" placeholder="RJHI" />
            </div>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">حساب الراتب التقديري</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>الراتب الأساسي</Label><Input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>بدل السكن</Label><Input type="number" min="0" step="0.01" value={form.housingAllowance} onChange={(e) => setForm({ ...form, housingAllowance: e.target.value })} dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>بدل النقل</Label><Input type="number" min="0" step="0.01" value={form.transportAllowance} onChange={(e) => setForm({ ...form, transportAllowance: e.target.value })} dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>بدلات أخرى</Label><Input type="number" min="0" step="0.01" value={form.otherAllowances} onChange={(e) => setForm({ ...form, otherAllowances: e.target.value })} dir="ltr" className="font-english" /></div>
                <div className="space-y-2"><Label>استقطاعات أخرى</Label><Input type="number" min="0" step="0.01" value={form.otherDeductions} onChange={(e) => setForm({ ...form, otherDeductions: e.target.value })} dir="ltr" className="font-english" /></div>
              </div>

              {previewLoading && (
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري تحديث المعاينة...
                </div>
              )}

              {salaryPreview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <PreviewMetric label="الإجمالي" value={money(Number(salaryPreview.grossSalary || 0))} tone="green" />
                  <PreviewMetric label="استقطاعات" value={money(Number(salaryPreview.totalDeductions || 0))} tone="red" />
                  <PreviewMetric label="GOSI الموظف" value={money(Number(salaryPreview.employeeGosi || 0))} tone="amber" />
                  <PreviewMetric label="الصافي" value={money(Number(salaryPreview.netSalary || 0))} tone="blue" />
                </div>
              )}

              <p className="text-xs text-muted-foreground">المعاينة تعتمد نفس محرك حساب الرواتب الحالي ويمكنك تعديل الأرقام يدوياً قبل الحفظ.</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="أي ملاحظات إدارية إضافية" />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
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

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" | "amber" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px]">{label}</div>
      <div className="font-english text-sm font-semibold" dir="ltr">{value}</div>
    </div>
  );
}
