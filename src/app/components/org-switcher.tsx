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
    fiscalYearStart: 1,
    industry: "",
    addressLine: "",
    city: "",
    region: "",
    postalCode: "",
    district: "",
    buildingNumber: "",
    streetName: "",
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
        fiscalYearStart: Number(form.fiscalYearStart) || 1,
      };
      const optStr = (k: string) => { const v = String(form[k] || "").trim(); if (v) payload[k] = v; };
      ["legalName","vatNumber","crNumber","industry","addressLine","city","region","postalCode","district","buildingNumber","streetName","logoUrl","stampUrl","vatPeriod","taxRegistrationDate","firstVatPeriodStart"].forEach(optStr);
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
                      <img src={form.logoUrl} alt="logo" className="max-w-[160px] max-h-[80px] object-contain bg-[#F9FAFB] rounded p-1" />
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
                <label className="text-sm text-[#374151] block mb-1">بداية السنة المالية (شهر)</label>
                <select value={form.fiscalYearStart} onChange={(e) => setForm({ ...form, fiscalYearStart: e.target.value })} className={inp + " bg-white"}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <option key={m} value={m}>{["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][m-1]}</option>
                  ))}
                </select>
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

          {/* Section: Address */}
          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-[#0B1B49] mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>العنوان الوطني</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#374151] block mb-1">الشارع</label>
                <input type="text" value={form.streetName} onChange={(e) => setForm({ ...form, streetName: e.target.value })}
                  placeholder="طريق الدائري الشرقي الفرعي" className={inp} />
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
          </div>
        </div>
      </form>
    </div>
  );
}
