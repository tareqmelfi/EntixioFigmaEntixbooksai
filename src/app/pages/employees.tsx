/**
 * Employees list — app-wide standard: rows open the FULL contact detail page
 * (/app/contacts/:id · employees are contacts with the employee role).
 * New employee → /app/employees/new (full page with live salary preview).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { EmptyState, InlineAlert, Metric as LedgerMetric, MetricStrip, PageHeader, SearchField, SectionHeader } from "../components/product";
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
      <PageHeader
        eyebrow={t("الموظفون والرواتب", "Employees & payroll")}
        title={t("الموظفون", "Employees")}
        description={t("سجل الموظفين مربوط بقائمة الاتصال ويستخدم نفس قاعدة البيانات", "The employee register is linked to the contacts list and uses the same database")}
        actions={(
          <Button onClick={() => navigate("/app/employees/new")}>
            <Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("موظف جديد", "New employee")}
          </Button>
        )}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <MetricStrip>
        <LedgerMetric label={t("إجمالي الموظفين", "Total employees")} value={items.length.toString()} />
        <LedgerMetric label={t("موظفون لديهم بريد", "Employees with email")} value={items.filter((item) => item.email).length.toString()} />
        <LedgerMetric label={t("موظفون لديهم هوية", "Employees with ID")} value={items.filter((item) => item.nationalId).length.toString()} />
        <LedgerMetric label={t("الأقسام المُدارة", "Managed departments")} value={costCenters.length.toString()} />
      </MetricStrip>

      <section className="space-y-3">
        <SectionHeader
          title={t("سجل الموظفين", "Employee register")}
          actions={<SearchField containerClassName="w-full md:w-72" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("بحث بالاسم أو الهوية...", "Search by name or ID...")} aria-label={t("بحث", "Search")} />}
        />
        {loading ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" strokeWidth={1.5} />} title={t("لا يوجد موظفون مطابقون", "No matching employees")} />
        ) : (
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <colgroup>
                <col />{/* الموظف · flexible */}
                <col style={{ width: "260px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "160px" }} />
                <col style={{ width: "110px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                <th className="px-4 py-3 text-start font-medium">{t("الموظف", "Employee")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("التواصل", "Contact")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("الهوية", "ID")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("الدولة", "Country")}</th>
                <th className="px-4 py-3 text-start"></th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/app/contacts/${item.id}`)}
                    className="border-b border-border hover:bg-surface-hover cursor-pointer"
                    title={t("فتح الموظف", "Open employee")}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/app/contacts/${item.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-medium text-foreground hover:underline underline-offset-4" title={item.displayName}><bdi dir="auto">{item.displayName}</bdi></Link>
                      <div className="truncate text-xs text-muted-foreground/60 font-code" dir="ltr">{item.customCode || item.id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/80">
                      <div className="truncate font-english" dir="ltr" title={item.email || ""}>{item.email || "—"}</div>
                      <div className="truncate font-english text-muted-foreground tabular-nums" dir="ltr">{item.phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-english text-foreground/80 tabular-nums truncate" dir="ltr">{item.nationalId || "—"}</td>
                    <td className="px-4 py-3 text-sm text-foreground/80 truncate">{countryLabel(t, item.country || "SA")}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {pendingDelete === item.id ? (
                          <InlineConfirm onConfirm={() => removeEmployee(item.id)} onCancel={() => setPendingDelete(null)} label={t("تأكيد الحذف؟", "Confirm delete?")} />
                        ) : (
                          <button disabled={busy} onClick={() => setPendingDelete(item.id)} className="rounded-md p-1.5 text-danger hover:bg-danger-subtle disabled:opacity-50" title={t("حذف الموظف", "Delete employee")}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronLeft className="h-4 w-4 text-muted-foreground/50 ltr:rotate-180" strokeWidth={1.75} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
