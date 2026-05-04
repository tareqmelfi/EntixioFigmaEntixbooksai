/**
 * Org Switcher · لتغيير الشركة + إنشاء شركة جديدة
 * يظهر في app-sidebar.tsx · يستبدل الـbutton الجامد القديم
 */
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, Check, Building2, X } from "lucide-react";
import { api, Org, setOrgId } from "../lib/api";

interface Props {
  className?: string;
}

export function OrgSwitcher({ className }: Props) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const list = await api.orgs.list();
      setOrgs(list);
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const found = stored ? list.find((o) => o.id === stored) : null;
      const active = found || list[0] || null;
      setActiveOrg(active);
      if (active) setOrgId(active.id);
    } catch (e) {
      console.error("[orgs] load failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleSelect = (o: Org) => {
    setActiveOrg(o);
    setOrgId(o.id);
    setOpen(false);
    // Hard refresh so all pages re-fetch with the new org id
    window.location.reload();
  };

  if (loading) {
    return (
      <button className={`mb-2 flex w-full items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#9CA3AF] ${className || ""}`}>
        <span>...جارٍ التحميل</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`mb-2 flex w-full items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0B1B49] hover:bg-[#F9FAFB] ${className || ""}`}
      >
        <span className="truncate flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
          {activeOrg ? activeOrg.name : "اختر شركة"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[400px] overflow-y-auto rounded-md border border-[#E5E7EB] bg-white shadow-lg">
          <div className="p-1">
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => handleSelect(o)}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#0B1B49] hover:bg-[#F4FCFF]"
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-[#6B7280] font-english">
                    {o.country} · {o.baseCurrency}
                  </span>
                </div>
                {activeOrg?.id === o.id && <Check className="h-4 w-4 text-[#1276E3] shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-[#E5E7EB] p-1">
            <button
              onClick={() => { setOpen(false); setShowCreate(true); }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-[#1276E3] hover:bg-[#F4FCFF]"
            >
              <Plus className="h-4 w-4" />
              إنشاء شركة جديدة
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateOrgModal
          onClose={() => setShowCreate(false)}
          onCreated={(o) => {
            setShowCreate(false);
            setOrgs((prev) => [...prev, o]);
            handleSelect(o);
          }}
        />
      )}
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: Org) => void }) {
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    country: "SA",
    baseCurrency: "SAR",
    vatNumber: "",
    crNumber: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("الاسم مطلوب"); return; }
    setBusy(true);
    setError(null);
    try {
      const slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9؀-ۿ]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30) || `co-${Math.random().toString(36).slice(2, 8)}`;
      const org = await api.orgs.create({
        slug: slug + "-" + Math.random().toString(36).slice(2, 6),
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        country: form.country,
        baseCurrency: form.baseCurrency,
        vatNumber: form.vatNumber.trim() || undefined,
        crNumber: form.crNumber.trim() || undefined,
      });
      onCreated(org);
    } catch (e: any) {
      setError(e?.message || "فشل إنشاء الشركة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] p-4">
          <h2 className="text-[#0B1B49]" style={{ fontSize: "1.1rem", fontWeight: 600 }}>إنشاء شركة جديدة</h2>
          <button onClick={onClose} className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="space-y-1">
            <label className="text-sm text-[#374151]">اسم الشركة *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: شركة الأمل التجارية"
              className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[#374151]">الاسم القانوني (اختياري)</label>
            <input
              type="text"
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              placeholder="Al Amal Trading Co. LLC"
              className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-[#374151]">الدولة</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value, baseCurrency: e.target.value === "SA" ? "SAR" : e.target.value === "US" ? "USD" : form.baseCurrency })}
                className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white focus:border-[#1276E3] focus:outline-none"
              >
                <option value="SA">السعودية</option>
                <option value="AE">الإمارات</option>
                <option value="KW">الكويت</option>
                <option value="QA">قطر</option>
                <option value="BH">البحرين</option>
                <option value="OM">عُمان</option>
                <option value="EG">مصر</option>
                <option value="US">الولايات المتحدة</option>
                <option value="GB">المملكة المتحدة</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-[#374151]">العملة الأساسية</label>
              <select
                value={form.baseCurrency}
                onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
                className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white focus:border-[#1276E3] focus:outline-none"
              >
                <option value="SAR">SAR · ريال سعودي</option>
                <option value="USD">USD · دولار أمريكي</option>
                <option value="AED">AED · درهم إماراتي</option>
                <option value="EUR">EUR · يورو</option>
                <option value="GBP">GBP · جنيه إسترليني</option>
                <option value="KWD">KWD · دينار كويتي</option>
                <option value="QAR">QAR · ريال قطري</option>
                <option value="BHD">BHD · دينار بحريني</option>
                <option value="OMR">OMR · ريال عُماني</option>
                <option value="EGP">EGP · جنيه مصري</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-[#374151]">الرقم الضريبي</label>
              <input
                type="text"
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                placeholder="300xxxxxxxxxxxx"
                className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm font-english focus:border-[#1276E3] focus:outline-none"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-[#374151]">السجل التجاري</label>
              <input
                type="text"
                value={form.crNumber}
                onChange={(e) => setForm({ ...form, crNumber: e.target.value })}
                placeholder="10xxxxxxxx"
                className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm font-english focus:border-[#1276E3] focus:outline-none"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-3">
            <button type="button" onClick={onClose} className="rounded border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6]">
              إلغاء
            </button>
            <button type="submit" disabled={busy} className="rounded bg-[#1276E3] px-4 py-2 text-sm text-white hover:bg-[#0B5FBF] disabled:opacity-60">
              {busy ? "جارٍ الإنشاء..." : "إنشاء"}
            </button>
          </div>
          <p className="text-xs text-[#6B7280] text-center">
            بعد الإنشاء · تُضاف 20 حساب CoA + 3 معدلات ضريبة + بيانات تجريبية افتراضية
          </p>
        </form>
      </div>
    </div>
  );
}
