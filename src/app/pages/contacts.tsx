/**
 * Contacts page · UNIFIED PARTY MODEL · multi-role
 *
 * 4-step wizard (Figma spec):
 *   1. النوع    · individual / organization
 *   2. البيانات · displayName, email, phone, tax IDs (KSA or foreign)
 *   3. الأدوار  · multi-select: customer · supplier · employee · shareholder · freelancer
 *   4. التفاصيل · address, website, notes · live preview
 *
 * Edit re-uses the same wizard with prefilled state.
 *
 * Roles get distinct color badges. KPI strip at top: total · customers · suppliers · net balance.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Link } from "react-router";
import {
  Users, Plus, Search, Trash2, Edit2, Loader2, User,
  Building2, Mail, Phone, ExternalLink, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, Contact } from "../lib/api";
import { ContactWizard, ROLES, RoleKey } from "../components/contact-wizard";
import { useLanguage } from "../components/LanguageContext";

// ── Roles filter ───────────────────────────────────────────────────────────
type RoleFilter = "ALL" | RoleKey;

// English labels for the role badges defined in contact-wizard.tsx
const ROLE_LABEL_EN: Record<RoleKey, string> = {
  isCustomer: "Customer",
  isSupplier: "Supplier",
  isEmployee: "Employee",
  isShareholder: "Shareholder",
  isFreelancer: "Freelancer",
};

// ── Main page ────────────────────────────────────────────────────────────────
export function Contacts() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Contact[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoleFilter>("ALL");
  const [kindFilter, setKindFilter] = useState<"ALL" | "INDIVIDUAL" | "COMPANY">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [wizard, setWizard] = useState<{ open: boolean; editing: Contact | null }>({ open: false, editing: null });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.contacts.list({ limit: 200 });
      setItems(d.items);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // UX-196 · open edit wizard when navigated with ?edit=ID
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get("edit");
    const isNew = searchParams.get("new");
    if (isNew === "1" && items.length > 0 && !wizard.open) {
      openCreate();
      const next = new URLSearchParams(searchParams); next.delete("new"); setSearchParams(next, { replace: true });
      return;
    }
    if (editId && items.length > 0 && !wizard.open) {
      const target = items.find(c => c.id === editId);
      if (target) {
        openEdit(target);
        const next = new URLSearchParams(searchParams); next.delete("edit"); setSearchParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchParams]);

  // Counts per role
  const counts = useMemo(() => {
    const c = { ALL: items.length, isCustomer: 0, isSupplier: 0, isEmployee: 0, isShareholder: 0, isFreelancer: 0 } as Record<RoleFilter, number>;
    for (const x of items) {
      if (x.isCustomer || x.type === "CUSTOMER" || x.type === "BOTH") c.isCustomer++;
      if (x.isSupplier || x.type === "SUPPLIER" || x.type === "BOTH") c.isSupplier++;
      if (x.isEmployee) c.isEmployee++;
      if (x.isShareholder) c.isShareholder++;
      if (x.isFreelancer) c.isFreelancer++;
    }
    return c;
  }, [items]);

  // Filter
  const filtered = useMemo(() => {
    return items.filter(c => {
      if (kindFilter !== "ALL" && c.entityKind !== kindFilter) return false;
      if (filter !== "ALL") {
        if (filter === "isCustomer" && !(c.isCustomer || c.type === "CUSTOMER" || c.type === "BOTH")) return false;
        if (filter === "isSupplier" && !(c.isSupplier || c.type === "SUPPLIER" || c.type === "BOTH")) return false;
        if (filter === "isEmployee" && !c.isEmployee) return false;
        if (filter === "isShareholder" && !c.isShareholder) return false;
        if (filter === "isFreelancer" && !c.isFreelancer) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.displayName.toLowerCase().includes(q) ||
          (c.legalName || "").toLowerCase().includes(q) ||
          (c.customCode || "").toLowerCase().includes(q) ||
          (c.shortCode || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").includes(q) ||
          (c.vatNumber || "").includes(q) ||
          (c.crNumber || "").includes(q) ||
          (c.taxId || "").includes(q) ||
          (c.leiCode || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, kindFilter, searchQuery]);

  // ── Wizard handlers ────────────────────────────────────────────────────────
  const openCreate = () => setWizard({ open: true, editing: null });
  const openEdit = (c: Contact) => setWizard({ open: true, editing: c });
  const closeWizard = () => setWizard({ open: false, editing: null });



  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    try {
      await api.contacts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", t("تم الحذف", "Deleted"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Failed to delete"));
    } finally { setPendingDelete(null); }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("جهات الاتصال", "Contacts")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة جميع الأطراف ذات العلاقة · عميل · مورد · موظف · مساهم · فري لانسر", "Manage all related parties · Customer · Supplier · Employee · Shareholder · Freelancer")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" /> {t("إضافة جهة", "Add contact")}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={t("إجمالي جهات الاتصال", "Total contacts")} value={String(items.length)} hint={`${items.filter(c => c.entityKind === "COMPANY").length} ${t("منظمة", "organizations")} · ${items.filter(c => c.entityKind === "INDIVIDUAL").length} ${t("فرد", "individuals")}`} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        <KpiCard label={t("العملاء", "Customers")} value={String(counts.isCustomer)} hint="" active={filter === "isCustomer"} onClick={() => setFilter("isCustomer")} valueColor="text-blue-700" />
        <KpiCard label={t("الموردين", "Suppliers")} value={String(counts.isSupplier)} hint="" active={filter === "isSupplier"} onClick={() => setFilter("isSupplier")} valueColor="text-green-700" />
        <KpiCard label={t("الموظفين + المساهمين + الفري لانسر", "Employees + Shareholders + Freelancers")} value={String(counts.isEmployee + counts.isShareholder + counts.isFreelancer)} hint={`${counts.isEmployee} ${t("موظف", "employees")} · ${counts.isShareholder} ${t("مساهم", "shareholders")} · ${counts.isFreelancer} ${t("فري لانسر", "freelancers")}`} active={false} onClick={() => {}} valueColor="text-purple-700" />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setKindFilter("ALL")} className={pillClass(kindFilter === "ALL")}>{t("الكل", "All")}</button>
        <button onClick={() => setKindFilter("COMPANY")} className={pillClass(kindFilter === "COMPANY")}>{t("منظمات", "Organizations")}</button>
        <button onClick={() => setKindFilter("INDIVIDUAL")} className={pillClass(kindFilter === "INDIVIDUAL")}>{t("أفراد", "Individuals")}</button>
        <span className="mx-2 text-muted">|</span>
        {(["ALL", "isCustomer", "isSupplier", "isEmployee", "isShareholder", "isFreelancer"] as RoleFilter[]).map(r => {
          const def = ROLES.find(x => x.key === r);
          return (
            <button key={r} onClick={() => setFilter(r)} className={pillClass(filter === r)}>
              {r === "ALL" ? t("الكل", "All") : t(def?.label ?? "", ROLE_LABEL_EN[r as RoleKey])} <span className="ms-1 text-xs opacity-60">({r === "ALL" ? items.length : counts[r]})</span>
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-foreground flex items-center gap-2"><Filter className="h-4 w-4" /> {t("قائمة جهات الاتصال", "Contacts list")} ({filtered.length})</CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input placeholder={t("بحث بالاسم · الرمز · البريد · الرقم الضريبي...", "Search by name · code · email · tax number...")} className="ps-10 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted mb-3" />
              <p className="text-sm text-muted-foreground">{t("لا توجد جهات اتصال مطابقة", "No matching contacts")}</p>
              <button onClick={openCreate} className="text-sm text-primary hover:underline mt-2">{t("+ إضافة جهة جديدة", "+ Add new contact")}</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm table-fixed">
                <colgroup>
                  <col className="w-[340px]" />
                  <col className="w-[150px]" />
                  <col className="w-[240px]" />
                  <col className="w-[140px]" />
                  <col className="w-[90px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium">{t("الاسم", "Name")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("الأدوار", "Roles")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("الاتصال", "Contact")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("الرقم الضريبي", "Tax number")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{t("الدولة", "Country")}</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const Avatar = c.entityKind === "INDIVIDUAL" ? User : Building2;
                    return (
                      <tr key={c.id} className="border-t border-border/50 hover:bg-primary/5">
                        <td className="px-4 py-3 overflow-hidden align-middle" style={{ maxWidth: 0 }}>
                          <Link to={`/app/contacts/${c.id}`} className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                              <Avatar className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div dir="auto" className="block w-full truncate text-foreground font-semibold hover:underline" title={c.displayName} style={{ unicodeBidi: "plaintext" }}>{c.displayName}</div>
                              {c.legalName && c.legalName !== c.displayName && <div dir="auto" className="w-full truncate text-xs text-muted-foreground/60" style={{ unicodeBidi: "plaintext" }}>{c.legalName}</div>}
                              {(c.customCode || c.shortCode) && (
                                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground/60">
                                  {c.customCode && <span dir="ltr" className="font-english">{c.customCode}</span>}
                                  {c.shortCode && <span dir="ltr" className="rounded bg-muted/50 px-1 font-english text-muted-foreground">{c.shortCode}</span>}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 overflow-hidden align-middle" style={{ maxWidth: 0 }}>
                          <div className="flex min-w-0 max-w-full flex-wrap gap-1 overflow-hidden">
                            {ROLES.filter(r => (c as any)[r.key] || (r.key === "isCustomer" && (c.type === "CUSTOMER" || c.type === "BOTH")) || (r.key === "isSupplier" && (c.type === "SUPPLIER" || c.type === "BOTH")))
                              .map(r => (
                                <span key={r.key} className={`text-xs px-1.5 py-0.5 rounded ${r.bg} ${r.text}`}>{t(r.label, ROLE_LABEL_EN[r.key])}</span>
                              ))}
                            {c.isForeign && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{t("خارجي", "Foreign")}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground space-y-0.5 text-start overflow-hidden align-middle" style={{ maxWidth: 0 }}>
                          {c.email && <div dir="ltr" className="flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" /><span className="truncate font-english" title={c.email} style={{ fontVariantNumeric: "tabular-nums" }}>{c.email}</span></div>}
                          {c.phone && <div dir="ltr" className="flex min-w-0 items-center gap-1"><Phone className="h-3 w-3 shrink-0" /><span className="truncate font-english" title={c.phone} style={{ fontVariantNumeric: "tabular-nums" }}>{c.phone}</span></div>}
                        </td>
                        <td className="px-4 py-3 text-start"><span dir="ltr" className="font-english text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{c.vatNumber || c.taxId || "—"}</span></td>
                        <td className="px-4 py-3 text-start"><span dir="ltr" className="font-english text-xs text-foreground/80 uppercase">{c.country}</span></td>
                        <td className="px-2 py-3 text-end">
                          <div className="flex items-center gap-1 justify-end">
                            <Link to={`/app/contacts/${c.id}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/5 hover:text-primary" title={t("فتح", "Open")}><ExternalLink className="h-4 w-4" /></Link>
                            <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/5 hover:text-primary" title={t("تعديل", "Edit")}><Edit2 className="h-4 w-4" /></button>
                            {pendingDelete === c.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                <button onClick={() => handleDelete(c.id)} className="px-2 py-1 rounded bg-red-600 text-white">{t("تأكيد", "Confirm")}</button>
                                <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded border border-border">{t("إلغاء", "Cancel")}</button>
                              </span>
                            ) : (
                              <button onClick={() => setPendingDelete(c.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
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

      {/* 4-step wizard */}
      <ContactWizard
        open={wizard.open}
        editing={wizard.editing}
        onClose={(saved) => {
          const wasEditing = !!wizard.editing;
          closeWizard();
          if (saved) setItems(prev => wasEditing ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]);
        }}
      />
    </div>
  );
}
// ── Subcomponents ────────────────────────────────────────────────────────────
// ── Subcomponents ────────────────────────────────────────────────────────────
function pillClass(active: boolean) {
  return `px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap ${active ? "bg-primary text-white" : "bg-white border border-border text-muted-foreground hover:border-primary/40"}`;
}

function KpiCard({ label, value, hint, active, onClick, valueColor = "text-foreground" }: { label: string; value: string; hint: string; active: boolean; onClick: () => void; valueColor?: string }) {
  return (
    <button onClick={onClick} className={`text-start rounded-lg border px-4 py-3 transition ${active ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-english font-bold mt-1 ${valueColor}`} style={{ fontSize: "1.5rem" }}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground/60 mt-0.5">{hint}</div>}
    </button>
  );
}

