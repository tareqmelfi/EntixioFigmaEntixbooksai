import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, type Contact } from "../lib/api";

export function Employees() {
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    nationalId: "",
    country: "SA",
    employeeNumber: "",
    jobTitle: "",
    department: "",
    nationalityCode: "SA",
    iban: "",
    bankId: "",
    basicSalary: "",
    housingAllowance: "",
    transportAllowance: "",
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

  useEffect(() => { load(); }, [load]);

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
        department: form.department.trim() || null,
        nationalityCode: form.nationalityCode,
        iban: form.iban.trim() || null,
        bankId: form.bankId.trim() || null,
        basicSalary: Number(form.basicSalary || 0),
        housingAllowance: Number(form.housingAllowance || 0),
        transportAllowance: Number(form.transportAllowance || 0),
        sanedEnabled: form.nationalityCode === "SA",
      });
      setOpen(false);
      setForm({
        displayName: "", email: "", phone: "", nationalId: "", country: "SA",
        employeeNumber: "", jobTitle: "", department: "", nationalityCode: "SA",
        iban: "", bankId: "", basicSalary: "", housingAllowance: "", transportAllowance: "", notes: "",
      });
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
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الموظفون</h1>
          <p className="text-[#6B7280] mt-1">سجل الموظفين مربوط بقائمة الاتصال ويستخدم نفس قاعدة البيانات</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />موظف جديد</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="إجمالي الموظفين" value={items.length.toString()} />
        <Metric label="موظفون لديهم بريد" value={items.filter((item) => item.email).length.toString()} />
        <Metric label="موظفون لديهم هوية" value={items.filter((item) => item.nationalId).length.toString()} />
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>سجل الموظفين</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهوية..." className="ps-10 border-[#E5E7EB]" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1276E3]" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center"><Users className="mx-auto h-10 w-10 text-[#9CA3AF]" /><p className="mt-3 text-sm text-[#6B7280]">لا يوجد موظفون مطابقون</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-4 py-3 text-start">التواصل</th>
                  <th className="px-4 py-3 text-start">الهوية</th>
                  <th className="px-4 py-3 text-start">الدولة</th>
                  <th className="px-4 py-3 text-start"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0B1B49]">{item.displayName}</div>
                        <div className="text-xs text-[#9CA3AF] font-english">{item.customCode || item.id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151]">
                        <div className="font-english">{item.email || "—"}</div>
                        <div className="font-english text-[#6B7280]">{item.phone || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-english text-[#374151]">{item.nationalId || "—"}</td>
                      <td className="px-4 py-3 text-sm font-english text-[#374151]">{item.country}</td>
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

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <form onSubmit={createEmployee} className="space-y-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0B1B49]">موظف جديد</h2>
            <p className="text-sm text-[#6B7280]">الموظف يحفظ كجهة اتصال بدور موظف.</p>
          </div>
          <div className="space-y-2"><Label>الاسم *</Label><Input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="اسم الموظف" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>البريد</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="font-english" placeholder="employee@company.sa" /></div>
            <div className="space-y-2"><Label>الجوال</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="font-english" placeholder="+9665..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>الهوية/الإقامة</Label><Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" className="font-english" maxLength={20} /></div>
            <div className="space-y-2">
              <Label>الدولة</Label>
              <Select value={form.country} onValueChange={(country) => setForm({ ...form, country })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SA">السعودية</SelectItem>
                  <SelectItem value="AE">الإمارات</SelectItem>
                  <SelectItem value="US">الولايات المتحدة</SelectItem>
                  <SelectItem value="GB">بريطانيا</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>رقم الموظف</Label><Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} dir="ltr" className="font-english" placeholder="EMP-001" /></div>
            <div className="space-y-2"><Label>الجنسية</Label><Input value={form.nationalityCode} onChange={(e) => setForm({ ...form, nationalityCode: e.target.value.toUpperCase().slice(0, 2) })} dir="ltr" className="font-english" placeholder="SA" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>المسمى الوظيفي</Label><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="محاسب" /></div>
            <div className="space-y-2"><Label>القسم</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="المالية" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>الراتب الأساسي</Label><Input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>بدل السكن</Label><Input type="number" min="0" step="0.01" value={form.housingAllowance} onChange={(e) => setForm({ ...form, housingAllowance: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>بدل النقل</Label><Input type="number" min="0" step="0.01" value={form.transportAllowance} onChange={(e) => setForm({ ...form, transportAllowance: e.target.value })} dir="ltr" className="font-english" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })} dir="ltr" className="font-english" placeholder="SA..." /></div>
            <div className="space-y-2"><Label>Bank ID</Label><Input value={form.bankId} onChange={(e) => setForm({ ...form, bankId: e.target.value.toUpperCase() })} dir="ltr" className="font-english" placeholder="RJHI" /></div>
          </div>
          <div className="space-y-2"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="المسمى الوظيفي أو القسم" /></div>
          <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
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
