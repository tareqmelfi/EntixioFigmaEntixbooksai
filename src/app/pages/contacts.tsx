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
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { Link } from "react-router";
import {
  Users, Plus, Search, Trash2, Loader2, Edit2, X, ChevronRight, ChevronLeft,
  Building2, User, Mail, Phone, ExternalLink, AlertCircle, Globe, MapPin,
  Briefcase, Landmark, UserCheck, TrendingUp, Filter, Upload, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, Contact, ContactInput } from "../lib/api";
import { formatTaxId, formatCrNumber } from "../lib/tax-id-format";
import { AddressAutocomplete } from "../components/address-autocomplete";

// ── Roles ────────────────────────────────────────────────────────────────────
type RoleKey = "isCustomer" | "isSupplier" | "isEmployee" | "isShareholder" | "isFreelancer";

const ROLES: Array<{ key: RoleKey; label: string; icon: any; bg: string; text: string }> = [
  { key: "isCustomer",    label: "عميل",       icon: Users,      bg: "bg-blue-100",   text: "text-blue-700" },
  { key: "isSupplier",    label: "مورد",       icon: Building2,  bg: "bg-green-100",  text: "text-green-700" },
  { key: "isEmployee",    label: "موظف",       icon: Briefcase,  bg: "bg-purple-100", text: "text-purple-700" },
  { key: "isShareholder", label: "مساهم",      icon: Landmark,   bg: "bg-pink-100",   text: "text-pink-700" },
  { key: "isFreelancer",  label: "فري لانسر",  icon: UserCheck,  bg: "bg-cyan-100",   text: "text-cyan-700" },
];

const COUNTRY_OPTIONS = [
  { code: "SA", label: "السعودية", currency: "SAR" },
  { code: "AE", label: "الإمارات", currency: "AED" },
  { code: "KW", label: "الكويت", currency: "KWD" },
  { code: "QA", label: "قطر", currency: "QAR" },
  { code: "BH", label: "البحرين", currency: "BHD" },
  { code: "OM", label: "عُمان", currency: "OMR" },
  { code: "EG", label: "مصر", currency: "EGP" },
  { code: "JO", label: "الأردن", currency: "JOD" },
  { code: "US", label: "الولايات المتحدة", currency: "USD" },
  { code: "GB", label: "المملكة المتحدة", currency: "GBP" },
  { code: "DE", label: "ألمانيا", currency: "EUR" },
  { code: "FR", label: "فرنسا", currency: "EUR" },
];

type RoleFilter = "ALL" | RoleKey;

// ── State helpers ────────────────────────────────────────────────────────────
type FormState = {
  entityKind: "INDIVIDUAL" | "COMPANY";
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  vatNumber: string;
  crNumber: string;
  nationalId: string;
  leiCode: string;
  isForeign: boolean;
  withholdingTaxRate: string;
  defaultCurrency: string;
  country: string;
  city: string;
  region: string;
  addressLine1: string;
  postalCode: string;
  notes: string;
  // role flags
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  isShareholder: boolean;
  isFreelancer: boolean;
};

const emptyForm: FormState = {
  entityKind: "COMPANY",
  displayName: "", legalName: "", email: "", phone: "",
  vatNumber: "", crNumber: "", nationalId: "", leiCode: "",
  isForeign: false, withholdingTaxRate: "", defaultCurrency: "SAR",
  country: "SA", city: "", region: "", addressLine1: "", postalCode: "",
  notes: "",
  isCustomer: true, isSupplier: false, isEmployee: false, isShareholder: false, isFreelancer: false,
};

function contactToForm(c: Contact): FormState {
  return {
    entityKind: c.entityKind || "COMPANY",
    displayName: c.displayName || "",
    legalName: c.legalName || "",
    email: c.email || "",
    phone: c.phone || "",
    vatNumber: c.vatNumber || "",
    crNumber: c.crNumber || "",
    nationalId: c.nationalId || "",
    leiCode: c.leiCode || "",
    isForeign: !!c.isForeign,
    withholdingTaxRate: c.withholdingTaxRate != null ? String(c.withholdingTaxRate) : "",
    defaultCurrency: c.defaultCurrency || "SAR",
    country: c.country || "SA",
    city: c.city || "",
    region: c.region || "",
    addressLine1: c.addressLine1 || "",
    postalCode: c.postalCode || "",
    notes: c.notes || "",
    isCustomer: !!c.isCustomer || c.type === "CUSTOMER" || c.type === "BOTH",
    isSupplier: !!c.isSupplier || c.type === "SUPPLIER" || c.type === "BOTH",
    isEmployee: !!c.isEmployee,
    isShareholder: !!c.isShareholder,
    isFreelancer: !!c.isFreelancer,
  };
}

function formToInput(form: FormState): ContactInput {
  return {
    entityKind: form.entityKind,
    displayName: form.displayName.trim(),
    legalName: form.legalName.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    vatNumber: form.vatNumber.trim() || null,
    crNumber: form.crNumber.trim() || null,
    nationalId: form.nationalId.trim() || null,
    leiCode: form.leiCode.trim() || null,
    isForeign: form.isForeign,
    withholdingTaxRate: form.withholdingTaxRate ? Number(form.withholdingTaxRate) : null,
    defaultCurrency: form.defaultCurrency || null,
    country: form.country,
    city: form.city.trim() || null,
    region: form.region.trim() || null,
    addressLine1: form.addressLine1.trim() || null,
    postalCode: form.postalCode.trim() || null,
    notes: form.notes.trim() || null,
    isCustomer: form.isCustomer,
    isSupplier: form.isSupplier,
    isEmployee: form.isEmployee,
    isShareholder: form.isShareholder,
    isFreelancer: form.isFreelancer,
  };
}

// ── Main page ────────────────────────────────────────────────────────────────
export function Contacts() {
  const [items, setItems] = useState<Contact[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<RoleFilter>("ALL");
  const [kindFilter, setKindFilter] = useState<"ALL" | "INDIVIDUAL" | "COMPANY">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [wizard, setWizard] = useState<{ open: boolean; step: 1 | 2 | 3 | 4; editingId: string | null }>({ open: false, step: 1, editingId: null });
  const [form, setForm] = useState<FormState>(emptyForm);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.contacts.list({ limit: 200 });
      setItems(d.items);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, [push]);
  useEffect(() => { refresh(); }, [refresh]);

  // UX-196 · open edit wizard when navigated with ?edit=ID
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get("edit");
    const isNew = searchParams.get("new");
    if (isNew === "1" && items.length > 0 && !wizard.open) {
      setWizard({ open: true, step: 1, editingId: null });
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
  const openCreate = () => {
    setForm(emptyForm);
    setWizard({ open: true, step: 1, editingId: null });
  };
  const openEdit = (c: Contact) => {
    setForm(contactToForm(c));
    setWizard({ open: true, step: 1, editingId: c.id });
  };
  const closeWizard = () => setWizard({ open: false, step: 1, editingId: null });

  const canProceed = useMemo(() => {
    if (wizard.step === 1) return true;
    if (wizard.step === 2) return form.displayName.trim().length > 0;
    if (wizard.step === 3) return form.isCustomer || form.isSupplier || form.isEmployee || form.isShareholder || form.isFreelancer;
    return true;
  }, [wizard.step, form]);

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = formToInput(form);
      if (wizard.editingId) {
        const updated = await api.contacts.update(wizard.editingId, payload);
        setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
        push("success", "تم تحديث جهة الاتصال");
      } else {
        const created = await api.contacts.create(payload);
        setItems(prev => [created, ...prev]);
        push("success", `تم إنشاء ${created.displayName}`);
      }
      closeWizard();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    try {
      await api.contacts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
      push("success", "تم الحذف");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    } finally { setPendingDelete(null); }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>جهات الاتصال</h1>
          <p className="text-[#6B7280] mt-1">إدارة جميع الأطراف ذات العلاقة · عميل · مورد · موظف · مساهم · فري لانسر</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" /> إضافة جهة
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="إجمالي جهات الاتصال" value={String(items.length)} hint={`${items.filter(c => c.entityKind === "COMPANY").length} منظمة · ${items.filter(c => c.entityKind === "INDIVIDUAL").length} فرد`} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        <KpiCard label="العملاء" value={String(counts.isCustomer)} hint="" active={filter === "isCustomer"} onClick={() => setFilter("isCustomer")} valueColor="text-blue-700" />
        <KpiCard label="الموردين" value={String(counts.isSupplier)} hint="" active={filter === "isSupplier"} onClick={() => setFilter("isSupplier")} valueColor="text-green-700" />
        <KpiCard label="الموظفين + المساهمين + الفري لانسر" value={String(counts.isEmployee + counts.isShareholder + counts.isFreelancer)} hint={`${counts.isEmployee} موظف · ${counts.isShareholder} مساهم · ${counts.isFreelancer} فري لانسر`} active={false} onClick={() => {}} valueColor="text-purple-700" />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setKindFilter("ALL")} className={pillClass(kindFilter === "ALL")}>الكل</button>
        <button onClick={() => setKindFilter("COMPANY")} className={pillClass(kindFilter === "COMPANY")}>منظمات</button>
        <button onClick={() => setKindFilter("INDIVIDUAL")} className={pillClass(kindFilter === "INDIVIDUAL")}>أفراد</button>
        <span className="mx-2 text-[#E5E7EB]">|</span>
        {(["ALL", "isCustomer", "isSupplier", "isEmployee", "isShareholder", "isFreelancer"] as RoleFilter[]).map(r => {
          const def = ROLES.find(x => x.key === r);
          return (
            <button key={r} onClick={() => setFilter(r)} className={pillClass(filter === r)}>
              {r === "ALL" ? "الكل" : def?.label} <span className="ms-1 text-xs opacity-60">({r === "ALL" ? items.length : counts[r]})</span>
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-[#0B1B49] flex items-center gap-2"><Filter className="h-4 w-4" /> قائمة جهات الاتصال ({filtered.length})</CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input placeholder="بحث بالاسم · البريد · الرقم الضريبي · LEI..." className="ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-[#E5E7EB] mb-3" />
              <p className="text-sm text-[#6B7280]">لا توجد جهات اتصال مطابقة</p>
              <button onClick={openCreate} className="text-sm text-[#1276E3] hover:underline mt-2">+ إضافة جهة جديدة</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium">الاسم</th>
                    <th className="text-start px-4 py-2.5 font-medium">الأدوار</th>
                    <th className="text-start px-4 py-2.5 font-medium">الاتصال</th>
                    <th className="text-start px-4 py-2.5 font-medium">الرقم الضريبي</th>
                    <th className="text-start px-4 py-2.5 font-medium">الدولة</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const Avatar = c.entityKind === "INDIVIDUAL" ? User : Building2;
                    return (
                      <tr key={c.id} className="border-t border-[#F3F4F6] hover:bg-[#F4FCFF]">
                        <td className="px-4 py-3">
                          <Link to={`/app/contacts/${c.id}`} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#F4FCFF] flex items-center justify-center shrink-0">
                              <Avatar className="h-4 w-4 text-[#1276E3]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[#0B1B49] font-semibold hover:underline">{c.displayName}</div>
                              {c.legalName && c.legalName !== c.displayName && <div className="text-xs text-[#9CA3AF] truncate">{c.legalName}</div>}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {ROLES.filter(r => (c as any)[r.key] || (r.key === "isCustomer" && (c.type === "CUSTOMER" || c.type === "BOTH")) || (r.key === "isSupplier" && (c.type === "SUPPLIER" || c.type === "BOTH")))
                              .map(r => (
                                <span key={r.key} className={`text-xs px-1.5 py-0.5 rounded ${r.bg} ${r.text}`}>{r.label}</span>
                              ))}
                            {c.isForeign && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">خارجي</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B7280] space-y-0.5">
                          {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="font-english">{c.email}</span></div>}
                          {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span className="font-english">{c.phone}</span></div>}
                        </td>
                        <td className="px-4 py-3 font-english text-xs text-[#6B7280]">{c.vatNumber || c.taxId || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#374151] font-english uppercase">{c.country}</td>
                        <td className="px-2 py-3 text-end">
                          <div className="flex items-center gap-1 justify-end">
                            <Link to={`/app/contacts/${c.id}`} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F4FCFF] hover:text-[#1276E3]" title="فتح"><ExternalLink className="h-4 w-4" /></Link>
                            <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F4FCFF] hover:text-[#1276E3]" title="تعديل"><Edit2 className="h-4 w-4" /></button>
                            {pendingDelete === c.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                <button onClick={() => handleDelete(c.id)} className="px-2 py-1 rounded bg-red-600 text-white">تأكيد</button>
                                <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded border border-[#E5E7EB]">إلغاء</button>
                              </span>
                            ) : (
                              <button onClick={() => setPendingDelete(c.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="h-4 w-4" /></button>
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
      {wizard.open && (
        <WizardModal
          step={wizard.step}
          isEditing={!!wizard.editingId}
          form={form}
          setForm={setForm}
          canProceed={canProceed}
          busy={busy}
          onClose={closeWizard}
          onPrev={() => setWizard(w => ({ ...w, step: Math.max(1, w.step - 1) as any }))}
          onNext={() => setWizard(w => ({ ...w, step: Math.min(4, w.step + 1) as any }))}
          onSave={handleSave}
          onAutoFill={async (file) => {
            try {
              const base64 = await new Promise<string>((res, rej) => {
                const r = new FileReader();
                r.onload = () => {
                  const s = r.result as string;
                  const i = s.indexOf("base64,");
                  res(i >= 0 ? s.slice(i + 7) : s);
                };
                r.onerror = () => rej(r.error);
                r.readAsDataURL(file);
              });
              const data = await api.contacts.extractFromDocument({
                fileBase64: base64,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
              });
              setForm(prev => ({
                ...prev,
                displayName: data.displayName || prev.displayName,
                legalName: data.legalName || prev.legalName,
                entityKind: data.entityKind || prev.entityKind,
                country: data.country || prev.country,
                vatNumber: data.vatNumber ? formatTaxId(data.vatNumber, data.country || prev.country) : prev.vatNumber,
                crNumber: data.crNumber ? formatCrNumber(data.crNumber, data.country || prev.country) : prev.crNumber,
                nationalId: data.nationalId || prev.nationalId,
                addressLine1: data.addressLine1 || prev.addressLine1,
                city: data.city || prev.city,
                region: data.region || prev.region,
                postalCode: data.postalCode || prev.postalCode,
                phone: data.phone || prev.phone,
                email: data.email || prev.email,
                isCustomer: data.isCustomer ?? prev.isCustomer,
                isSupplier: data.isSupplier ?? prev.isSupplier,
                isForeign: (data.country || prev.country) !== "SA",
              }));
              push("success", `✨ ${data.notes || "تم استخراج البيانات"} (ثقة ${(data.confidence * 100).toFixed(0)}%)`);
              // Auto-advance to step 2 so user sees filled fields
              setWizard(w => ({ ...w, step: 2 }));
            } catch (e: any) {
              push("error", e instanceof ApiError ? e.message : "فشل قراءة المستند");
            }
          }}
        />
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────
function pillClass(active: boolean) {
  return `px-3 py-1.5 rounded-full text-sm transition whitespace-nowrap ${active ? "bg-[#1276E3] text-white" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#1276E3]/40"}`;
}

function KpiCard({ label, value, hint, active, onClick, valueColor = "text-[#0B1B49]" }: { label: string; value: string; hint: string; active: boolean; onClick: () => void; valueColor?: string }) {
  return (
    <button onClick={onClick} className={`text-start rounded-lg border px-4 py-3 transition ${active ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] bg-white hover:border-[#1276E3]/40"}`}>
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className={`font-english font-bold mt-1 ${valueColor}`} style={{ fontSize: "1.5rem" }}>{value}</div>
      {hint && <div className="text-xs text-[#9CA3AF] mt-0.5">{hint}</div>}
    </button>
  );
}

function WizardModal(props: {
  step: 1 | 2 | 3 | 4;
  isEditing: boolean;
  form: FormState;
  setForm: (f: FormState) => void;
  canProceed: boolean;
  busy: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  onAutoFill?: (file: File) => Promise<void>;
}) {
  const { step, isEditing, form, setForm, canProceed, busy, onClose, onPrev, onNext, onSave, onAutoFill } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
          <h2 className="text-lg text-[#0B1B49]" style={{ fontWeight: 700 }}>{isEditing ? "تعديل جهة اتصال" : "إضافة جهة اتصال"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded"><X className="h-5 w-5 text-[#6B7280]" /></button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center font-english font-semibold ${step === s ? "bg-[#1276E3] text-white" : step > s ? "bg-[#1276E3]/20 text-[#1276E3]" : "bg-[#F3F4F6] text-[#9CA3AF]"}`}>{s}</div>
                <span className={step === s ? "text-[#0B1B49] font-semibold" : "text-[#9CA3AF]"}>
                  {s === 1 ? "النوع" : s === 2 ? "البيانات" : s === 3 ? "الأدوار" : "التفاصيل"}
                </span>
                {s < 4 && <div className="flex-1 h-px bg-[#E5E7EB]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {step === 1 && <Step1 form={form} setForm={setForm} onAutoFill={onAutoFill} />}
          {step === 2 && <Step2 form={form} setForm={setForm} />}
          {step === 3 && <Step3 form={form} setForm={setForm} />}
          {step === 4 && <Step4 form={form} setForm={setForm} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-[#F3F4F6]">
          <Button type="button" variant="outline" onClick={step === 1 ? onClose : onPrev} className="border-[#E5E7EB]">
            {step === 1 ? "إلغاء" : <><ChevronRight className="h-4 w-4 me-1" /> السابق</>}
          </Button>
          {step < 4 ? (
            <Button onClick={onNext} disabled={!canProceed} className="bg-[#1276E3] hover:bg-[#1060C0]">
              التالي <ChevronLeft className="h-4 w-4 ms-1" />
            </Button>
          ) : (
            <Button onClick={onSave} disabled={busy || !canProceed} className="bg-[#1276E3] hover:bg-[#1060C0]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditing ? "حفظ التعديلات" : "حفظ جهة الاتصال")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1({ form, setForm, onAutoFill }: { form: FormState; setForm: (f: FormState) => void; onAutoFill?: (file: File) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!onAutoFill) return;
    setAiBusy(true);
    try { await onAutoFill(file); } finally { setAiBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#374151]">هل هي منظمة أم فرد؟</p>
      <div className="grid grid-cols-2 gap-3">
        {(["INDIVIDUAL", "COMPANY"] as const).map(k => {
          const Icon = k === "INDIVIDUAL" ? User : Building2;
          const active = form.entityKind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setForm({ ...form, entityKind: k })}
              className={`p-6 rounded-xl border-2 transition flex flex-col items-center gap-3 ${active ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] hover:border-[#1276E3]/40"}`}
            >
              <Icon className={`h-10 w-10 ${active ? "text-[#1276E3]" : "text-[#9CA3AF]"}`} />
              <div>
                <div className="font-semibold text-[#0B1B49]">{k === "INDIVIDUAL" ? "فرد" : "منظمة"}</div>
                <div className="text-xs text-[#9CA3AF] mt-0.5">{k === "INDIVIDUAL" ? "شخص طبيعي" : "شركة أو مؤسسة"}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* AI · upload registration / EIN letter / passport → auto-fill */}
      <div className="rounded-xl border-2 border-dashed border-[#1276E3]/30 bg-[#F4FCFF] p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-[#1276E3]" />
          <div className="flex-1">
            <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>تعبئة تلقائية بالذكاء</div>
            <p className="text-xs text-[#6B7280] mt-0.5">ارفع السجل التجاري · رسالة EIN · شهادة الزكاة · والذكاء يقرأها ويعبّي البيانات</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          <Button type="button" variant="outline" disabled={aiBusy} onClick={() => fileRef.current?.click()} className="border-[#1276E3] text-[#1276E3]">
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 me-1.5" /> رفع مستند</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step2({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const isKsa = form.country === "SA";
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#374151]">{form.entityKind === "COMPANY" ? "بيانات المنظمة" : "بيانات الفرد"}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[#6B7280]">الاسم *</Label>
          <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={form.entityKind === "COMPANY" ? "مثال: شركة التقنية المتقدمة" : "مثال: أحمد محمد"} className="border-[#E5E7EB]" />
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">الاسم بالإنجليزية</Label>
          <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="e.g. Advanced Tech Co." dir="ltr" className="border-[#E5E7EB] font-english" />
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">البريد الإلكتروني</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" dir="ltr" className="border-[#E5E7EB] font-english" />
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">رقم الهاتف</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966 5X XXX XXXX" dir="ltr" className="border-[#E5E7EB] font-english" />
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">الدولة</Label>
          <select value={form.country} onChange={(e) => {
            const c = COUNTRY_OPTIONS.find(o => o.code === e.target.value);
            setForm({ ...form, country: e.target.value, defaultCurrency: c?.currency || "SAR", isForeign: e.target.value !== "SA" });
          }} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
            {COUNTRY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">العملة الافتراضية</Label>
          <Input value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" className="border-[#E5E7EB] font-english" />
        </div>
        {isKsa && form.entityKind === "COMPANY" && (
          <>
            <div>
              <Label className="text-xs text-[#6B7280]">الرقم الضريبي</Label>
              <Input
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: formatTaxId(e.target.value, form.country) })}
                onPaste={(e) => { e.preventDefault(); const txt = e.clipboardData.getData("text"); setForm({ ...form, vatNumber: formatTaxId(txt, form.country) }); }}
                placeholder="300 XXX XXX XXX X 003" maxLength={20} dir="ltr" className="border-[#E5E7EB] font-english"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280]">السجل التجاري</Label>
              <Input
                value={form.crNumber}
                onChange={(e) => setForm({ ...form, crNumber: formatCrNumber(e.target.value, form.country) })}
                onPaste={(e) => { e.preventDefault(); const txt = e.clipboardData.getData("text"); setForm({ ...form, crNumber: formatCrNumber(txt, form.country) }); }}
                placeholder="1010XXXXXX" maxLength={10} dir="ltr" className="border-[#E5E7EB] font-english"
              />
            </div>
          </>
        )}
        {isKsa && form.entityKind === "INDIVIDUAL" && (
          <div className="col-span-1 md:col-span-2">
            <Label className="text-xs text-[#6B7280]">رقم الهوية الوطنية / الإقامة</Label>
            <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="10XXXXXXXX" maxLength={10} dir="ltr" className="border-[#E5E7EB] font-english" />
          </div>
        )}
        {!isKsa && (
          <>
            <div>
              <Label className="text-xs text-[#6B7280]">Tax ID (EIN / VAT / TRN)</Label>
              <Input
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: formatTaxId(e.target.value, form.country) })}
                onPaste={(e) => { e.preventDefault(); const txt = e.clipboardData.getData("text"); setForm({ ...form, vatNumber: formatTaxId(txt, form.country) }); }}
                placeholder={form.country === "US" ? "XX-XXXXXXX" : "Tax ID"} maxLength={20} dir="ltr" className="border-[#E5E7EB] font-english"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280]">LEI Code (اختياري)</Label>
              <Input value={form.leiCode} onChange={(e) => setForm({ ...form, leiCode: e.target.value })} placeholder="20 chars" maxLength={20} dir="ltr" className="border-[#E5E7EB] font-english" />
            </div>
            <div className="col-span-1 md:col-span-2">
              <Label className="text-xs text-[#6B7280]">نسبة ضريبة الاستقطاع (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={form.withholdingTaxRate} onChange={(e) => setForm({ ...form, withholdingTaxRate: e.target.value })} placeholder="5" dir="ltr" className="border-[#E5E7EB] font-english" />
              <p className="text-xs text-[#9CA3AF] mt-1">سيتم حجز هذه النسبة تلقائياً عند فاتورة الشراء</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step3({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#374151]">اختر الأدوار <span className="text-[#9CA3AF]">(يمكن اختيار أكثر من دور)</span></p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {ROLES.map(r => {
          const active = form[r.key];
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setForm({ ...form, [r.key]: !active } as any)}
              className={`p-3 rounded-lg border-2 transition flex items-center justify-between ${active ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] hover:border-[#1276E3]/40"}`}
            >
              <span className="flex items-center gap-2 text-sm text-[#0B1B49]">
                <span className={`p-1.5 rounded ${r.bg} ${r.text}`}><Icon className="h-3.5 w-3.5" /></span>
                {r.label}
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? "border-[#1276E3] bg-[#1276E3]" : "border-[#E5E7EB]"}`}>
                {active && <span className="text-white text-xs">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!(form.isCustomer || form.isSupplier || form.isEmployee || form.isShareholder || form.isFreelancer) && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5" /> اختر دوراً واحداً على الأقل
        </div>
      )}
    </div>
  );
}

function Step4({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#374151]">تفاصيل إضافية</p>
      <div>
        <Label className="text-xs text-[#6B7280] flex items-center gap-1.5">العنوان <span className="text-[10px] text-[#1276E3]">✨ ابدأ الكتابة لاقتراحات تلقائية</span></Label>
        <AddressAutocomplete
          value={form.addressLine1}
          country={form.country}
          onChange={(v) => setForm({ ...form, addressLine1: v })}
          onPick={(p) => setForm({
            ...form,
            addressLine1: p.line1 || form.addressLine1,
            city: p.city || form.city,
            region: p.region || form.region,
            postalCode: p.postalCode || form.postalCode,
            country: p.country || form.country,
          })}
          placeholder="مثال: 30 N Gould St Sheridan WY · أو الرياض حي العليا"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-[#6B7280]">المدينة</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="الرياض" className="border-[#E5E7EB]" />
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">المنطقة</Label>
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="منطقة الرياض" className="border-[#E5E7EB]" />
        </div>
        <div>
          <Label className="text-xs text-[#6B7280]">الرمز البريدي</Label>
          <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="12345" dir="ltr" className="border-[#E5E7EB] font-english" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-[#6B7280]">ملاحظات</Label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="أي ملاحظات إضافية..." rows={3} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-4">
        <div className="text-xs text-[#9CA3AF] mb-2">معاينة</div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
            {(form.displayName || "؟").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[#0B1B49] font-semibold truncate">{form.displayName || "—"}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {ROLES.filter(r => form[r.key]).map(r => (
                <span key={r.key} className={`text-xs px-1.5 py-0.5 rounded ${r.bg} ${r.text}`}>{r.label}</span>
              ))}
            </div>
          </div>
          {form.isForeign && <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700">خارجي</span>}
        </div>
      </div>
    </div>
  );
}
