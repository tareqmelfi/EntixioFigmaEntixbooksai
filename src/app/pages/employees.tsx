/**
 * Employees list — app-wide standard: rows open the FULL contact detail page
 * (/app/contacts/:id · employees are contacts with the employee role).
 * New employee → /app/employees/new (full page with live salary preview).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { findCountry } from "../lib/countries";
import { api, ApiError, type Contact } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

function countryLabel(t: (ar: string, en?: string) => string, code: string) {
  const country = findCountry(code);
  return country ? t(country.nameAr, country.nameEn) : code;
}

export function Employees() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [costCenters, setCostCenters] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.contacts.list({ role: "employee", limit: 200 } as any);
      setItems(res.items || []);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("تعذر تحميل الموظفين", "Could not load employees"));
    } finally { setLoading(false); }
  }, []);

  const loadCostCenters = useCallback(async () => {
    try {
      const res = await api.costCenters.list();
      setCostCenters((res.items || []) as Array<{ id: string; code: string; name: string }>);
    } catch { setCostCenters([]); }
  }, []);

  useEffect(() => { load(); loadCostCenters(); }, [load, loadCostCenters]);

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

  const removeEmployee = async (id: string) => {
    setPendingDelete(null);
    setBusy(true);
    try {
      await api.contacts.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      push("success", t("تم حذف الموظف", "Employee deleted"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل حذف الموظف", "Failed to delete employee"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الموظفون", "Employees")}</h1>
          <p className="text-muted-foreground mt-1">{t("سجل الموظفين مربوط بقائمة الاتصال ويستخدم نفس قاعدة البيانات", "The employee register is linked to the contacts list and uses the same database")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/employees/new")}>
          <Plus className="me-2 h-4 w-4" />{t("موظف جديد", "New employee")}
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={t("إجمالي الموظفين", "Total employees")} value={items.length.toString()} />
        <Metric label={t("موظفون لديهم بريد", "Employees with email")} value={items.filter((item) => item.email).length.toString()} />
        <Metric label={t("موظفون لديهم هوية", "Employees with ID")} value={items.filter((item) => item.nationalId).length.toString()} />
        <Metric label={t("الأقسام المُدارة", "Managed departments")} value={costCenters.length.toString()} />
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>{t("سجل الموظفين", "Employee register")}</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("بحث بالاسم أو الهوية...", "Search by name or ID...")} className="ps-10 border-border" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground/60" /><p className="mt-3 text-sm text-muted-foreground">{t("لا يوجد موظفون مطابقون", "No matching employees")}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start">{t("الموظف", "Employee")}</th>
                  <th className="px-4 py-3 text-start">{t("التواصل", "Contact")}</th>
                  <th className="px-4 py-3 text-start">{t("الهوية", "ID")}</th>
                  <th className="px-4 py-3 text-start">{t("الدولة", "Country")}</th>
                  <th className="px-4 py-3 text-start w-[110px]"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/app/contacts/${item.id}`)}
                      className="border-b border-border/50 hover:bg-primary/5 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{item.displayName}</div>
                        <div className="text-xs text-muted-foreground/60 font-english">{item.customCode || item.id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">
                        <div className="font-english">{item.email || "—"}</div>
                        <div className="font-english text-muted-foreground">{item.phone || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-english text-foreground/80">{item.nationalId || "—"}</td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{countryLabel(t, item.country || "SA")}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {pendingDelete === item.id ? (
                            <InlineConfirm onConfirm={() => removeEmployee(item.id)} onCancel={() => setPendingDelete(null)} label={t("تأكيد الحذف؟", "Confirm delete?")} />
                          ) : (
                            <button disabled={busy} onClick={() => setPendingDelete(item.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50" title={t("حذف الموظف", "Delete employee")}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <ChevronLeft className="h-4 w-4 text-muted-foreground/50" />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground font-english">{value}</div>
    </div>
  );
}
