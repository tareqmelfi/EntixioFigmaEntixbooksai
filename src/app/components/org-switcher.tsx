/**
 * Org Switcher · لتغيير الشركة + إنشاء شركة جديدة
 * يظهر في app-sidebar.tsx · يستبدل الـbutton الجامد القديم
 */
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { ChevronDown, Plus, Check, Building2, X } from "lucide-react";
import { api, Org, setOrgId } from "../lib/api";
import { AddressAutocomplete } from "./address-autocomplete";

function orgInitials(name?: string | null) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "?";
  const latinWords = cleaned.match(/[A-Za-z0-9]+/g);
  if (latinWords?.length) {
    return latinWords.slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase();
  }
  return cleaned.charAt(0).toUpperCase();
}

interface Props {
  className?: string;
  /** "sidebar" = full-width button (default) · "header-chip" = compact pill with logo for app-header */
  variant?: "sidebar" | "header-chip";
}

export function OrgSwitcher({ className, variant = "sidebar" }: Props) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seedMessage, setSeedMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
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

  // Compact chip · used in app-header (right side in RTL)
  // Logo + name = Link → /app (homepage) · ChevronDown = separate button to open dropdown
  if (variant === "header-chip") {
    return (
      <div className="relative" ref={dropdownRef}>
        <div className={`flex items-center rounded-lg border border-[#E5E7EB] bg-white hover:border-[#1276E3]/30 transition-all ${className || ""}`}>
          <Link
            to="/app"
            className="flex items-center gap-2.5 ps-2 pe-3 py-2 hover:bg-[#F9FAFB] rounded-s-lg transition-colors"
            title={`${activeOrg?.name || "الرئيسية"} · لوحة التحكم`}
          >
            {activeOrg?.logoUrl ? (
              <img src={activeOrg.logoUrl} alt={activeOrg.name} className="h-8 w-8 rounded-md object-cover bg-white border border-[#F3F4F6] shrink-0" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1276E3] to-[#179FC5] text-white text-sm font-english shadow-sm" style={{ fontWeight: 700 }}>
                {orgInitials(activeOrg?.name)}
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start gap-0 min-w-0 max-w-[260px]">
              <span className="truncate text-sm text-[#0B1B49] leading-tight" style={{ fontWeight: 600 }}>
                {activeOrg ? activeOrg.name : "اختر شركة"}
              </span>
              {activeOrg && (
                <span className="text-[10px] text-[#6B7280] font-english leading-tight">
                  {activeOrg.country} · {activeOrg.baseCurrency}
                </span>
              )}
            </div>
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="border-s border-[#E5E7EB] p-2 hover:bg-[#F9FAFB] rounded-e-lg transition-colors"
            title="تبديل الشركة"
            aria-label="تبديل الشركة"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {open && (
          <div className="absolute end-0 top-full z-[60] mt-1 w-80 max-h-[420px] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
            <div className="p-1">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleSelect(o)}
                  className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-sm text-[#0B1B49] hover:bg-[#F4FCFF]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {o.logoUrl ? (
                      <img src={o.logoUrl} alt={o.name} className="h-8 w-8 rounded object-cover bg-white border border-[#F3F4F6] shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#1276E3] text-white text-xs font-english" style={{ fontWeight: 700 }}>
                        {orgInitials(o.name)}
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-0.5 min-w-0">
                      <span className="truncate font-medium">{o.name}</span>
                      <span className="text-xs text-[#6B7280] font-english">{o.country} · {o.baseCurrency}</span>
                    </div>
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

  // Wafeq-parity sidebar variant · square logo + name + "مختارة حالياً" tag
  const filteredOrgs = orgs.filter((o) =>
    !search.trim() || o.name.toLowerCase().includes(search.toLowerCase()) || (o.legalName||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`mb-2 flex w-full items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm text-[#0B1B49] hover:bg-[#F9FAFB] hover:border-[#1276E3]/30 transition-all ${className || ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {activeOrg?.logoUrl ? (
            <img src={activeOrg.logoUrl} alt={activeOrg.name} className="h-9 w-9 rounded-md object-cover bg-white border border-[#F3F4F6] shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1276E3] to-[#179FC5] text-white text-sm font-english shadow-sm" style={{ fontWeight: 700 }}>
              {orgInitials(activeOrg?.name)}
            </div>
          )}
          <div className="flex flex-col items-start gap-0 min-w-0">
            <span className="truncate text-sm text-[#0B1B49] leading-tight max-w-[180px]" style={{ fontWeight: 600 }}>
              {activeOrg ? activeOrg.name : "اختر شركة"}
            </span>
            {activeOrg && (
              <span className="text-[10px] text-[#6B7280] font-english leading-tight">
                {activeOrg.country} · {activeOrg.baseCurrency}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-[60] mt-1 max-h-[min(70vh,520px)] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
          {/* Search bar · Wafeq style */}
          <div className="p-2 border-b border-[#F3F4F6]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن شركة..."
              className="w-full rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-sm focus:bg-white focus:border-[#1276E3]/30 outline-none"
              autoFocus
            />
          </div>

          {/* Create new · top action */}
          <button
            onClick={() => { setOpen(false); setShowCreate(true); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs leading-5 text-[#1276E3] hover:bg-[#F4FCFF] border-b border-[#F3F4F6]"
            style={{ fontWeight: 600 }}
          >
            <Plus className="h-4 w-4" />
            إنشاء منشأة جديدة
          </button>

          {/* Seed two demos (SA + US) · only show if user has 0 or 1 org · UX-179 */}
          {(true) /* UX-194 · always show */ && (
            <button
              onClick={async () => {
                try {
                  const r = await (api as any).seedTwoDemos();
                  if (r?.ok) {
                    setSeedMessage({ kind: "success", text: `تم إنشاء ${r.seeded.length} شركة تجريبية كاملة · جارِ التحميل...` });
                    window.setTimeout(() => window.location.reload(), 800);
                  }
                } catch (e: any) {
                  setSeedMessage({ kind: "error", text: `فشل: ${e?.message || "خطأ غير معروف"}` });
                }
              }}
              className="flex w-full items-start gap-2 px-3 py-2 text-xs leading-5 text-green-700 hover:bg-green-50 border-b border-[#F3F4F6]"
              style={{ fontWeight: 600 }}
            >
              <Plus className="h-4 w-4" />
              + إنشاء بيانات تجريبية كاملة (SA + US)
            </button>
          )}

          {seedMessage && (
            <div className={`mx-2 my-2 rounded-md border px-3 py-2 text-xs ${
              seedMessage.kind === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {seedMessage.text}
            </div>
          )}

          <div className="max-h-[360px] overflow-y-auto">
            {filteredOrgs.map((o) => (
              <button
                key={o.id}
                onClick={() => handleSelect(o)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#0B1B49] hover:bg-[#F4FCFF] border-b border-[#F3F4F6] last:border-b-0"
              >
                {o.logoUrl ? (
                  <img src={o.logoUrl} alt={o.name} className="h-9 w-9 rounded-md object-cover bg-white border border-[#F3F4F6] shrink-0" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1276E3] to-[#179FC5] text-white text-xs font-english" style={{ fontWeight: 700 }}>
                    {orgInitials(o.name)}
                  </div>
                )}
                <div className="flex flex-col items-start gap-0 min-w-0 flex-1">
                  <div className="flex items-start gap-1.5 w-full">
                    <span className="line-clamp-2 text-start text-[12px] font-medium leading-5">{o.name}</span>
                    {activeOrg?.id === o.id && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        مختارة حالياً
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#6B7280] font-english leading-4">
                    {o.country} · {o.baseCurrency}
                  </span>
                </div>
              </button>
            ))}
            {filteredOrgs.length === 0 && (
              <div className="py-8 text-center text-sm text-[#9CA3AF]">لا توجد منشأة بهذا الاسم</div>
            )}
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

// Country-specific tax/registration fields
type CountrySpec = {
  defaultCurrency: string;
  fields: { key: string; label: string; placeholder: string; ltr?: boolean; help?: string }[];
};
const COUNTRY_SPECS: Record<string, CountrySpec> = {
  SA: {
    defaultCurrency: "SAR",
    fields: [
      { key: "vatNumber", label: "الرقم الضريبي (ZATCA)", placeholder: "300xxxxxxxxxxxx", ltr: true, help: "15 رقم · يبدأ بـ 3" },
      { key: "crNumber", label: "السجل التجاري", placeholder: "10xxxxxxxx", ltr: true, help: "10 أرقام · من وزارة التجارة" },
    ],
  },
  AE: {
    defaultCurrency: "AED",
    fields: [
      { key: "vatNumber", label: "رقم التسجيل الضريبي (TRN)", placeholder: "100xxxxxxxxxxxx", ltr: true, help: "15 رقم من FTA" },
      { key: "crNumber", label: "رقم الرخصة التجارية", placeholder: "DED-xxxxxx", ltr: true },
    ],
  },
  KW: {
    defaultCurrency: "KWD",
    fields: [
      { key: "crNumber", label: "السجل التجاري", placeholder: "xxxxxxx", ltr: true },
      { key: "vatNumber", label: "الرقم الضريبي (إن وجد)", placeholder: "اختياري", ltr: true },
    ],
  },
  QA: {
    defaultCurrency: "QAR",
    fields: [
      { key: "crNumber", label: "السجل التجاري (CR)", placeholder: "xxxxxx", ltr: true },
      { key: "vatNumber", label: "الرقم الضريبي (إن وجد)", placeholder: "اختياري", ltr: true },
    ],
  },
  BH: { defaultCurrency: "BHD", fields: [{ key: "crNumber", label: "السجل التجاري (CR)", placeholder: "xxxxx-1", ltr: true }, { key: "vatNumber", label: "الرقم الضريبي", placeholder: "200xxxxxxxxxxxx", ltr: true }] },
  OM: { defaultCurrency: "OMR", fields: [{ key: "crNumber", label: "السجل التجاري", placeholder: "xxxxxxx", ltr: true }, { key: "vatNumber", label: "الرقم الضريبي", placeholder: "OMxxxxxxxxxx", ltr: true }] },
  EG: { defaultCurrency: "EGP", fields: [{ key: "crNumber", label: "السجل التجاري", placeholder: "xxxxx", ltr: true }, { key: "vatNumber", label: "البطاقة الضريبية", placeholder: "xxx-xxx-xxx", ltr: true }] },
  US: {
    defaultCurrency: "USD",
    fields: [
      { key: "vatNumber", label: "EIN (Federal Tax ID)", placeholder: "XX-XXXXXXX", ltr: true, help: "9 digits from IRS · format XX-XXXXXXX" },
      { key: "crNumber", label: "State / Filing Number", placeholder: "WY · 2026-001234567", ltr: true, help: "ولاية + رقم الـfiling من Secretary of State" },
    ],
  },
  GB: { defaultCurrency: "GBP", fields: [{ key: "crNumber", label: "Companies House Number", placeholder: "12345678", ltr: true }, { key: "vatNumber", label: "VAT Number", placeholder: "GB123456789", ltr: true }] },
};

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: Org) => void }) {
  const [form, setForm] = useState<any>({
    name: "",
    legalName: "",
    country: "SA",
    baseCurrency: "SAR",
    vatNumber: "",
    crNumber: "",
    fiscalYearEnd: 12, // December default
    industry: "",
    email: "",
    phone: "",
    website: "",
    addressLine: "",
    city: "",
    region: "",
    postalCode: "",
    district: "",
    buildingNumber: "",
    streetName: "",
    suiteUnit: "",
    state: "",
    taxRegistrationDate: "",
    firstVatPeriodStart: "",
    vatPeriod: "monthly",
    logoUrl: "",
    stampUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = COUNTRY_SPECS[form.country] || COUNTRY_SPECS.SA;

  const handleImageUpload = async (file: File, kind: "logoUrl" | "stampUrl") => {
    if (file.size > 2 * 1024 * 1024) {
      setError(`${kind === "logoUrl" ? "الشعار" : "الختم"} يجب أن يكون أصغر من 2 ميجا`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, [kind]: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  // Auto-set currency when country changes
  const setCountry = (c: string) => {
    const newSpec = COUNTRY_SPECS[c];
    setForm({ ...form, country: c, baseCurrency: newSpec ? newSpec.defaultCurrency : form.baseCurrency });
  };

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
      const payload: any = {
        slug: slug + "-" + Math.random().toString(36).slice(2, 6),
        name: form.name.trim(),
        country: form.country,
        baseCurrency: form.baseCurrency,
        fiscalYearEnd: Number(form.fiscalYearEnd) || 12,
      };
      const optStr = (k: string) => { const v = String(form[k] || "").trim(); if (v) payload[k] = v; };
      [
        "legalName","vatNumber","crNumber","industry",
        "email","phone","website",
        "addressLine","city","region","postalCode","district","buildingNumber","streetName",
        "suiteUnit","state",
        "logoUrl","stampUrl",
        "vatPeriod","taxRegistrationDate","firstVatPeriodStart",
      ].forEach(optStr);
      const org = await api.orgs.create(payload);
      onCreated(org);
    } catch (e: any) {
      // Defensive: ApiError.message is always a string after our normalization
      const msg =
        typeof e?.message === "string" ? e.message :
        typeof e === "string" ? e :
        e && typeof e === "object" ? JSON.stringify(e) :
        "فشل إنشاء الشركة";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const inp = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20";

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto" dir="rtl">
      <form onSubmit={handleSubmit}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-white/95 backdrop-blur px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>إنشاء شركة جديدة</h1>
              <p className="text-xs text-[#6B7280]">بعد الإنشاء: 20 حساب · 3 معدلات ضريبية · ZATCA جاهز</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6]">إلغاء</button>
            <button type="submit" disabled={busy} className="rounded bg-[#1276E3] px-5 py-2 text-sm text-white hover:bg-[#0B5FBF] disabled:opacity-60">
              {busy ? "جارٍ الإنشاء…" : "إنشاء الشركة"}
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Section: Branding */}
          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-[#0B1B49] mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>الهوية البصرية</h2>
            <p className="text-xs text-[#6B7280] mb-4">شعار الشركة + الختم الرسمي · يظهران على الفواتير والعقود</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm text-[#374151] block mb-1.5">الشعار · يقبل مربع أو طولي</label>
                <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-4 hover:border-[#1276E3] transition">
                  <input type="file" accept="image/*" hidden id="logo-upload"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logoUrl"); }} />
                  {form.logoUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={form.logoUrl} alt="logo" className="max-w-[240px] max-h-[80px] object-contain bg-[#F9FAFB] rounded p-1" />
                      <div className="flex flex-col gap-1">
                        <label htmlFor="logo-upload" className="text-xs text-[#1276E3] hover:underline cursor-pointer">تغيير</label>
                        <button type="button" onClick={() => setForm({ ...form, logoUrl: "" })} className="text-xs text-red-600 hover:underline text-start">حذف</button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="logo-upload" className="cursor-pointer block text-center py-4">
                      <div className="text-sm text-[#1276E3] font-medium">اضغط لرفع الشعار</div>
                      <div className="text-xs text-[#9CA3AF] mt-1">PNG · SVG · JPG · حتى 2MB</div>
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1.5">الختم الرسمي</label>
                <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-4 hover:border-[#1276E3] transition">
                  <input type="file" accept="image/*" hidden id="stamp-upload"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "stampUrl"); }} />
                  {form.stampUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={form.stampUrl} alt="stamp" className="max-w-[120px] max-h-[80px] object-contain bg-[#F9FAFB] rounded p-1" />
                      <div className="flex flex-col gap-1">
                        <label htmlFor="stamp-upload" className="text-xs text-[#1276E3] hover:underline cursor-pointer">تغيير</label>
                        <button type="button" onClick={() => setForm({ ...form, stampUrl: "" })} className="text-xs text-red-600 hover:underline text-start">حذف</button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="stamp-upload" className="cursor-pointer block text-center py-4">
                      <div className="text-sm text-[#1276E3] font-medium">اضغط لرفع الختم</div>
                      <div className="text-xs text-[#9CA3AF] mt-1">PNG شفاف يفضّل · حتى 2MB</div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Basic info */}
          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-[#0B1B49] mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>البيانات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-[#374151] block mb-1">اسم الشركة (العرض) *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: شركة سبيك بروز للاستثمار" className={inp} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-[#374151] block mb-1">الاسم القانوني الكامل</label>
                <input type="text" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="Spec Pros Fund LP" className={inp} />
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">الدولة</label>
                <select value={form.country} onChange={(e) => setCountry(e.target.value)} className={inp + " bg-white"}>
                  <option value="SA">السعودية (KSA)</option>
                  <option value="AE">الإمارات (UAE)</option>
                  <option value="KW">الكويت</option>
                  <option value="QA">قطر</option>
                  <option value="BH">البحرين</option>
                  <option value="OM">عُمان</option>
                  <option value="EG">مصر</option>
                  <option value="US">الولايات المتحدة (USA)</option>
                  <option value="GB">المملكة المتحدة (UK)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">العملة الأساسية</label>
                <select value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} className={inp + " bg-white"}>
                  <option value="SAR">SAR · ريال سعودي</option>
                  <option value="USD">USD · دولار</option>
                  <option value="AED">AED · درهم</option>
                  <option value="EUR">EUR · يورو</option>
                  <option value="GBP">GBP · جنيه</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">مجال الشركة</label>
                <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="استشارات · إنتاج فني · عقاري · …" className={inp} />
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">نهاية السنة المالية (شهر)</label>
                <select value={form.fiscalYearEnd} onChange={(e) => setForm({ ...form, fiscalYearEnd: Number(e.target.value) })} className={inp + " bg-white"}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <option key={m} value={m}>{["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][m-1]}</option>
                  ))}
                </select>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  السنة تبدأ في: {["فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر","يناير"][(Number(form.fiscalYearEnd) || 12) % 12]}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Tax & registration */}
          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-[#0B1B49] mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>التسجيل الضريبي والقانوني</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spec.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-sm text-[#374151] block mb-1">{f.label}</label>
                  <input type="text" value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} dir={f.ltr ? "ltr" : "rtl"}
                    className={`${inp} ${f.ltr ? "font-english" : ""}`} />
                  {f.help && <p className="text-xs text-[#9CA3AF] mt-1">{f.help}</p>}
                </div>
              ))}
              {form.country === "SA" && (
                <>
                  <div>
                    <label className="text-sm text-[#374151] block mb-1">تاريخ التسجيل الضريبي الفعلي</label>
                    <input type="date" value={form.taxRegistrationDate} onChange={(e) => setForm({ ...form, taxRegistrationDate: e.target.value })} className={inp + " font-english"} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-sm text-[#374151] block mb-1">تاريخ استحقاق أول إقرار ضريبي</label>
                    <input type="date" value={form.firstVatPeriodStart} onChange={(e) => setForm({ ...form, firstVatPeriodStart: e.target.value })} className={inp + " font-english"} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-sm text-[#374151] block mb-1">الفترة الضريبية</label>
                    <select value={form.vatPeriod} onChange={(e) => setForm({ ...form, vatPeriod: e.target.value })} className={inp + " bg-white"}>
                      <option value="monthly">شهرية</option>
                      <option value="quarterly">ربع سنوية</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Contact info */}
          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-[#0B1B49] mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>بيانات الاتصال</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[#374151] block mb-1">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@ensidex.com" className={inp + " font-english"} dir="ltr" />
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">رقم الهاتف</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+966 50 123 4567" className={inp + " font-english"} dir="ltr" />
              </div>
              <div>
                <label className="text-sm text-[#374151] block mb-1">الموقع الإلكتروني</label>
                <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://ensidex.com" className={inp + " font-english"} dir="ltr" />
              </div>
            </div>
          </div>

          {/* Section: Address · country-aware */}
          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-[#0B1B49] mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>
              {form.country === "US" ? "Mailing Address" : form.country === "SA" ? "العنوان الوطني" : "العنوان"}
            </h2>
            {form.country === "US" || form.country === "GB" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-[#374151] block mb-1">Street Address</label>
                  <AddressAutocomplete
                    value={form.streetName}
                    onChange={(v) => setForm({ ...form, streetName: v })}
                    onPick={(p) => setForm({
                      ...form,
                      streetName: p.line1,
                      city: p.city || form.city,
                      state: p.region || form.state,
                      region: p.region || form.region,
                      postalCode: p.postalCode || form.postalCode,
                    })}
                    country={form.country}
                    placeholder="30 N Gould St (start typing for suggestions)"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">Suite / Unit</label>
                  <input type="text" value={form.suiteUnit} onChange={(e) => setForm({ ...form, suiteUnit: e.target.value })}
                    placeholder="Ste R" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Sheridan" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">{form.country === "US" ? "State" : "Region"}</label>
                  <input type="text" value={form.state || form.region} onChange={(e) => setForm({ ...form, state: e.target.value, region: e.target.value })}
                    placeholder={form.country === "US" ? "WY" : "Greater London"} className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">{form.country === "US" ? "ZIP Code" : "Postcode"}</label>
                  <input type="text" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder={form.country === "US" ? "82801" : "SW1A 1AA"} className={inp + " font-english"} dir="ltr" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-[#374151] block mb-1">الشارع</label>
                  <AddressAutocomplete
                    value={form.streetName}
                    onChange={(v) => setForm({ ...form, streetName: v })}
                    onPick={(p) => setForm({
                      ...form,
                      streetName: p.line1,
                      city: p.city || form.city,
                      region: p.region || form.region,
                      postalCode: p.postalCode || form.postalCode,
                    })}
                    country={form.country}
                    placeholder="ابدأ بكتابة العنوان (مثل: طريق الدائري الشرقي)"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">الحي</label>
                  <input type="text" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="حي الروضة" className={inp} />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">رقم المبنى</label>
                  <input type="text" value={form.buildingNumber} onChange={(e) => setForm({ ...form, buildingNumber: e.target.value })}
                    placeholder="7421" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">الرمز البريدي</label>
                  <input type="text" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="13213" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">المدينة</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="الرياض" className={inp} />
                </div>
                <div>
                  <label className="text-sm text-[#374151] block mb-1">المنطقة</label>
                  <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="منطقة الرياض" className={inp} />
                </div>
              </div>
            )}
            <p className="text-xs text-[#9CA3AF] mt-3">
              💡 ابدأ بكتابة العنوان (مثل "30 N Gould") · سيظهر مساعد التعبئة التلقائية قريباً
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
