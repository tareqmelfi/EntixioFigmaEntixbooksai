/**
 * Org Switcher · لتغيير الشركة + {t("إنشاء شركة جديدة", "Create new company")}
 * يظهر في app-sidebar.tsx · يستبدل الـbutton الجامد القديم
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { ChevronDown, Plus, Check, X } from "lucide-react";
import { api, Org, setOrgId, API_BASE_URL } from "../lib/api";
import { AddressAutocomplete } from "./address-autocomplete";
import { useLanguage } from "./LanguageContext";

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
  const { language, t } = useLanguage();
  const isRtl = language === "ar";
  const rowDirClass = isRtl ? "flex-row-reverse" : "flex-row";
  const alignItemsClass = isRtl ? "items-end text-end" : "items-start text-start";

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seedMessage, setSeedMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Calculate dropdown position for portal rendering (avoids sidebar overflow clipping)
  const updateDropdownPos = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(368, window.innerWidth - 24); // 23rem = 368px
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      setDropdownPos({ top: rect.bottom + 4, left, width });
    }
  }, []);

  const refresh = async () => {
    try {
      const list = await api.orgs.list();
      setOrgs(list);
      // Honor the user's last org selection from localStorage, but only if it
      // exists in the server-returned list. This keeps the OrgSwitcher in sync
      // with authStore.refresh() which now also honors the stored org_id.
      // If the stored org isn't in the list (e.g. after account switch), fall
      // back to the first org from the server.
      const storedId = typeof localStorage !== 'undefined'
        ? localStorage.getItem('entix_org_id') : null
      const active = (storedId ? list.find(o => o.id === storedId) : null) || list[0] || null;
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

  // Update dropdown position when opening
  useEffect(() => {
    if (open) updateDropdownPos();
  }, [open, updateDropdownPos]);

  const handleSelect = (o: Org) => {
    setActiveOrg(o);
    setOrgId(o.id);
    // Mark this as an explicit user pick so authStore.refresh() honors it on
    // reload — even for demo orgs (clearStaleState wipes it on next login).
    try { localStorage.setItem('entix_org_explicit', String(Date.now())); } catch {}
    // Persist the pick on the server profile so EVERY platform (web + iOS)
    // resolves the same active company for this user. Fire-and-forget.
    fetch(`${API_BASE_URL}/me/preferences`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedOrgId: o.id }),
    }).catch(() => {});
    setOpen(false);
    // Hard refresh so all pages re-fetch with the new org id
    window.location.reload();
  };

  if (loading) {
    return (
      <button className={`mb-2 flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground/60 ${className || ""}`}>
        <span>...{t("جارٍ التحميل", "Loading")}</span>
      </button>
    );
  }

  // Compact chip · used in app-header (right side in RTL)
  // Logo + name = Link → /app (homepage) · ChevronDown = separate button to open dropdown
  if (variant === "header-chip") {
    return (
      <div className="relative" ref={dropdownRef}>
        <div className={`flex items-center rounded-lg border border-border bg-white hover:border-[#1276E3]/30 transition-all ${className || ""}`}>
          <Link
            to="/app"
            className="flex items-center gap-2.5 ps-2 pe-3 py-2 hover:bg-muted rounded-s-lg transition-colors"
            title={activeOrg?.name ? activeOrg.name + " · " + t("لوحة التحكم","Dashboard") : t("الرئيسية","Home")}
          >
            {activeOrg?.logoUrl ? (
              <img src={activeOrg.logoUrl} alt={activeOrg.name} className="h-8 w-8 rounded-md object-cover bg-white border border-border/50 shrink-0" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1276E3] to-[#179FC5] text-white text-sm font-english shadow-sm" style={{ fontWeight: 700 }}>
                {orgInitials(activeOrg?.name)}
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start gap-0 min-w-0 max-w-[260px]">
              <span className="line-clamp-2 break-words text-sm text-foreground leading-tight" style={{ fontWeight: 600 }}>
                {activeOrg ? activeOrg.name : t("اختر شركة", "Select company")}
              </span>
              {activeOrg && (
                <span className="text-[10px] text-muted-foreground font-english leading-tight">
                  {activeOrg.country} · {activeOrg.baseCurrency}
                </span>
              )}
            </div>
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="border-s border-border p-2 hover:bg-muted rounded-e-lg transition-colors"
            title={t("تبديل الشركة","Switch company")}
            aria-label={t("تبديل الشركة","Switch company")}
          >
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {open && (
          <div className="absolute end-0 top-full z-[60] mt-1 w-[min(22rem,calc(100vw-1.5rem))] max-h-[420px] overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
            <div className="p-1">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleSelect(o)}
                  className={`flex w-full ${rowDirClass} items-center justify-between gap-2 rounded px-3 py-2 text-sm text-foreground hover:bg-primary/5`}
                >
                  <div className={`flex min-w-0 ${rowDirClass} items-center gap-2`}>
                    {o.logoUrl ? (
                      <img src={o.logoUrl} alt={o.name} className="h-8 w-8 rounded object-cover bg-white border border-border/50 shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-white text-xs font-english" style={{ fontWeight: 700 }}>
                        {orgInitials(o.name)}
                      </div>
                    )}
                    <div className={`flex min-w-0 flex-col gap-0.5 ${alignItemsClass}`}>
                      <span className="max-w-[16.5rem] truncate font-medium">{o.name}</span>
                      <span className="text-xs text-muted-foreground font-english">{o.country} · {o.baseCurrency}</span>
                    </div>
                  </div>
                  {activeOrg?.id === o.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
            </div>
            <div className="border-t border-border p-1">
              <button
                onClick={() => { setOpen(false); setShowCreate(true); }}
                className={`flex w-full ${rowDirClass} items-center gap-2 rounded px-3 py-2 text-sm text-primary hover:bg-primary/5`}
              >
                <Plus className="h-4 w-4" />
                {t("إنشاء شركة جديدة", "Create new company")}
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

  // Wafeq-parity sidebar variant · square logo + name + "{t("مختارة حالياً", "Active")}" tag
  const filteredOrgs = orgs.filter((o) =>
    !search.trim() || o.name.toLowerCase().includes(search.toLowerCase()) || (o.legalName||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`mb-2 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-2.5 py-2 text-sm text-foreground hover:bg-muted hover:border-[#1276E3]/30 transition-all ${className || ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {activeOrg?.logoUrl ? (
            <img src={activeOrg.logoUrl} alt={activeOrg.name} className="h-9 w-9 rounded-md object-cover bg-white border border-border/50 shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1276E3] to-[#179FC5] text-white text-sm font-english shadow-sm" style={{ fontWeight: 700 }}>
              {orgInitials(activeOrg?.name)}
            </div>
          )}
          <div className="flex flex-col items-start gap-0 min-w-0">
            <span className="line-clamp-2 break-words text-sm text-foreground leading-tight max-w-[220px]" style={{ fontWeight: 600 }}>
              {activeOrg ? activeOrg.name : t("اختر شركة", "Select company")}
            </span>
            {activeOrg && (
              <span className="text-[10px] text-muted-foreground font-english leading-tight">
                {activeOrg.country} · {activeOrg.baseCurrency}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && dropdownPos && createPortal(
        <div
          className="fixed z-[100] overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: 'min(70vh, 520px)',
          }}
        >
          {/* Search bar · Wafeq style */}
          <div className="p-2 border-b border-border/50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ابحث عن شركة...", "Search company...")}
              className="w-full rounded-md border border-border bg-muted px-3 py-1.5 text-sm focus:bg-white focus:border-[#1276E3]/30 outline-none"
              autoFocus
            />
          </div>

          {/* Create new · top action */}
          <button
            onClick={() => { setOpen(false); setShowCreate(true); }}
            className={`flex w-full ${rowDirClass} items-center justify-between gap-2 px-3 py-2 text-xs leading-5 text-primary hover:bg-primary/5 border-b border-border/50`}
            style={{ fontWeight: 600 }}
          >
            <Plus className="h-4 w-4" />
            {t("إنشاء منشأة جديدة", "Create new company")}
          </button>

          {/* Seed two demos (SA + US) · only show if user has 0 or 1 org · UX-179 */}
          {(true) /* UX-194 · always show */ && (
            <button
              onClick={async () => {
                try {
                  const r = await (api as any).seedTwoDemos();
                  if (r?.ok) {
                    setSeedMessage({ kind: "success", text: t("تم إنشاء ", "Created ") + r.seeded.length + t(" شركة تجريبية كاملة · جارٍ التحميل...", " full demo companies · Loading...") });
                    window.setTimeout(() => window.location.reload(), 800);
                  }
                } catch (e: any) {
                  setSeedMessage({ kind: "error", text: t("فشل: ", "Failed: ") + (e?.message || t("خطأ غير معروف", "Unknown error")) });
                }
              }}
              className={`flex w-full ${rowDirClass} items-start justify-between gap-2 px-3 py-2 text-xs leading-5 text-green-700 hover:bg-green-50 border-b border-border/50`}
              style={{ fontWeight: 600 }}
            >
              <Plus className="h-4 w-4" />
              {t("+ إنشاء بيانات تجريبية كاملة (SA + US)", "+ Create full demo data (SA + US)")}
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
                className={`flex w-full ${rowDirClass} items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-primary/5 border-b border-border/50 last:border-b-0`}
              >
                {o.logoUrl ? (
                  <img src={o.logoUrl} alt={o.name} className="h-9 w-9 rounded-md object-cover bg-white border border-border/50 shrink-0" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1276E3] to-[#179FC5] text-white text-xs font-english" style={{ fontWeight: 700 }}>
                    {orgInitials(o.name)}
                  </div>
                )}
                <div className={`flex min-w-0 flex-1 flex-col gap-0 ${alignItemsClass}`}>
                  <div className={`flex w-full ${rowDirClass} items-start gap-1.5`}>
                    <span className={`line-clamp-2 text-[12px] font-medium leading-5 ${isRtl ? "text-end" : "text-start"}`}>{o.name}</span>
                    {activeOrg?.id === o.id && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        {t("مختارة حالياً", "Active")}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-english leading-4">
                    {o.country} · {o.baseCurrency}
                  </span>
                </div>
              </button>
            ))}
            {filteredOrgs.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground/60">{t("لا توجد منشأة بهذا الاسم", "No company found with this name")}</div>
            )}
          </div>
        </div>,
        document.body
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
  fields: { key: string; label: { ar: string; en: string }; placeholder: string; placeholderEn?: string; ltr?: boolean; help?: { ar: string; en: string } }[];
};
const COUNTRY_SPECS: Record<string, CountrySpec> = {
  SA: {
    defaultCurrency: "SAR",
    fields: [
      { key: "vatNumber", label: { ar: "الرقم الضريبي (ZATCA)", en: "VAT number (ZATCA)" }, placeholder: "300xxxxxxxxxxxx", ltr: true, help: { ar: "15 رقم · يبدأ بـ 3", en: "15 digits · starts with 3" } },
      { key: "crNumber", label: { ar: "السجل التجاري", en: "Commercial registration" }, placeholder: "10xxxxxxxx", ltr: true, help: { ar: "10 أرقام · من وزارة التجارة", en: "10 digits · from Ministry of Commerce" } },
    ],
  },
  AE: {
    defaultCurrency: "AED",
    fields: [
      { key: "vatNumber", label: { ar: "رقم التسجيل الضريبي (TRN)", en: "Tax registration number (TRN)" }, placeholder: "100xxxxxxxxxxxx", ltr: true, help: { ar: "15 رقم من FTA", en: "15 digits from FTA" } },
      { key: "crNumber", label: { ar: "رقم الرخصة التجارية", en: "Trade license number" }, placeholder: "DED-xxxxxx", ltr: true },
    ],
  },
  KW: {
    defaultCurrency: "KWD",
    fields: [
      { key: "crNumber", label: { ar: "السجل التجاري", en: "Commercial registration" }, placeholder: "xxxxxxx", ltr: true },
      { key: "vatNumber", label: { ar: "الرقم الضريبي (إن وجد)", en: "VAT number (if any)" }, placeholder: "اختياري", placeholderEn: "Optional", ltr: true },
    ],
  },
  QA: {
    defaultCurrency: "QAR",
    fields: [
      { key: "crNumber", label: { ar: "السجل التجاري (CR)", en: "Commercial registration (CR)" }, placeholder: "xxxxxx", ltr: true },
      { key: "vatNumber", label: { ar: "الرقم الضريبي (إن وجد)", en: "VAT number (if any)" }, placeholder: "اختياري", placeholderEn: "Optional", ltr: true },
    ],
  },
  BH: { defaultCurrency: "BHD", fields: [{ key: "crNumber", label: { ar: "السجل التجاري (CR)", en: "Commercial registration (CR)" }, placeholder: "xxxxx-1", ltr: true }, { key: "vatNumber", label: { ar: "الرقم الضريبي", en: "VAT number" }, placeholder: "200xxxxxxxxxxxx", ltr: true }] },
  OM: { defaultCurrency: "OMR", fields: [{ key: "crNumber", label: { ar: "السجل التجاري", en: "Commercial registration" }, placeholder: "xxxxxxx", ltr: true }, { key: "vatNumber", label: { ar: "الرقم الضريبي", en: "VAT number" }, placeholder: "OMxxxxxxxxxx", ltr: true }] },
  EG: { defaultCurrency: "EGP", fields: [{ key: "crNumber", label: { ar: "السجل التجاري", en: "Commercial registration" }, placeholder: "xxxxx", ltr: true }, { key: "vatNumber", label: { ar: "البطاقة الضريبية", en: "Tax card" }, placeholder: "xxx-xxx-xxx", ltr: true }] },
  US: {
    defaultCurrency: "USD",
    fields: [
      { key: "vatNumber", label: { ar: "EIN (Federal Tax ID)", en: "EIN (Federal Tax ID)" }, placeholder: "XX-XXXXXXX", ltr: true, help: { ar: "9 digits from IRS · format XX-XXXXXXX", en: "9 digits from IRS · format XX-XXXXXXX" } },
      { key: "crNumber", label: { ar: "State / Filing Number", en: "State / Filing Number" }, placeholder: "WY · 2026-001234567", ltr: true, help: { ar: "ولاية + رقم الـfiling من Secretary of State", en: "State + filing number from Secretary of State" } },
    ],
  },
  GB: { defaultCurrency: "GBP", fields: [{ key: "crNumber", label: { ar: "Companies House Number", en: "Companies House Number" }, placeholder: "12345678", ltr: true }, { key: "vatNumber", label: { ar: "VAT Number", en: "VAT Number" }, placeholder: "GB123456789", ltr: true }] },
};

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: Org) => void }) {
  const { language, t } = useLanguage();
  const isRtl = language === "ar";
  const months = isRtl ? MONTHS_AR : MONTHS_EN;
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
      setError(t(
        `${kind === "logoUrl" ? "الشعار" : "الختم"} يجب أن يكون أصغر من 2 ميجا`,
        `${kind === "logoUrl" ? "Logo" : "Stamp"} must be smaller than 2 MB`,
      ));
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
    if (!form.name.trim()) { setError(t("الاسم مطلوب", "Name is required")); return; }
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
        t("فشل إنشاء الشركة", "Failed to create company");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const inp = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-[#1276E3] focus:outline-none focus:ring-1 focus:ring-[#1276E3]/20";

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
      <form onSubmit={handleSubmit}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b border-border bg-white/95 backdrop-blur px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted/50"><X className="h-5 w-5" /></button>
            <div>
              <h1 className="text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{t("إنشاء شركة جديدة", "Create new company")}</h1>
              <p className="text-xs text-muted-foreground">{t("بعد الإنشاء: 20 حساب · 3 معدلات ضريبية · ZATCA جاهز", "After creating: 20 accounts · 3 tax rates · ZATCA ready")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">{t("إلغاء", "Cancel")}</button>
            <button type="submit" disabled={busy} className="rounded bg-primary px-5 py-2 text-sm text-white hover:bg-primary/80 disabled:opacity-60">
              {busy ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء الشركة", "Create company")}
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Section: Branding */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-foreground mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("الهوية البصرية", "Brand identity")}</h2>
            <p className="text-xs text-muted-foreground mb-4">{t("شعار الشركة + الختم الرسمي · يظهران على الفواتير والعقود", "Company logo + official stamp · shown on invoices and contracts")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm text-foreground/80 block mb-1.5">{t("الشعار · يقبل مربع أو طولي", "Logo · square or wide accepted")}</label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-[#1276E3] transition">
                  <input type="file" accept="image/*" hidden id="logo-upload"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logoUrl"); }} />
                  {form.logoUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={form.logoUrl} alt="logo" className="max-w-[240px] max-h-[80px] object-contain bg-muted rounded p-1" />
                      <div className="flex flex-col gap-1">
                        <label htmlFor="logo-upload" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                        <button type="button" onClick={() => setForm({ ...form, logoUrl: "" })} className="text-xs text-red-600 hover:underline text-start">{t("حذف", "Remove")}</button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="logo-upload" className="cursor-pointer block text-center py-4">
                      <div className="text-sm text-primary font-medium">{t("اضغط لرفع الشعار", "Click to upload logo")}</div>
                      <div className="text-xs text-muted-foreground/60 mt-1">{t("PNG · SVG · JPG · حتى 2MB", "PNG · SVG · JPG · up to 2MB")}</div>
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1.5">{t("الختم الرسمي", "Official stamp")}</label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-[#1276E3] transition">
                  <input type="file" accept="image/*" hidden id="stamp-upload"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "stampUrl"); }} />
                  {form.stampUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={form.stampUrl} alt="stamp" className="max-w-[120px] max-h-[80px] object-contain bg-muted rounded p-1" />
                      <div className="flex flex-col gap-1">
                        <label htmlFor="stamp-upload" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                        <button type="button" onClick={() => setForm({ ...form, stampUrl: "" })} className="text-xs text-red-600 hover:underline text-start">{t("حذف", "Remove")}</button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="stamp-upload" className="cursor-pointer block text-center py-4">
                      <div className="text-sm text-primary font-medium">{t("اضغط لرفع الختم", "Click to upload stamp")}</div>
                      <div className="text-xs text-muted-foreground/60 mt-1">{t("PNG شفاف يفضّل · حتى 2MB", "Transparent PNG preferred · up to 2MB")}</div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Basic info */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-foreground mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("البيانات الأساسية", "Basic info")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-foreground/80 block mb-1">{t("اسم الشركة (العرض) *", "Company name (display) *")}</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("مثال: شركة سبيك بروز للاستثمار", "e.g. Spec Pros Investment Co.")} className={inp} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-foreground/80 block mb-1">{t("الاسم القانوني الكامل", "Full legal name")}</label>
                <input type="text" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="Spec Pros Fund LP" className={inp} />
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("الدولة", "Country")}</label>
                <select value={form.country} onChange={(e) => setCountry(e.target.value)} className={inp + " bg-white"}>
                  <option value="SA">{t("السعودية (KSA)", "Saudi Arabia (KSA)")}</option>
                  <option value="AE">{t("الإمارات (UAE)", "United Arab Emirates (UAE)")}</option>
                  <option value="KW">{t("الكويت", "Kuwait")}</option>
                  <option value="QA">{t("قطر", "Qatar")}</option>
                  <option value="BH">{t("البحرين", "Bahrain")}</option>
                  <option value="OM">{t("عُمان", "Oman")}</option>
                  <option value="EG">{t("مصر", "Egypt")}</option>
                  <option value="US">{t("الولايات المتحدة (USA)", "United States (USA)")}</option>
                  <option value="GB">{t("المملكة المتحدة (UK)", "United Kingdom (UK)")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("العملة الأساسية", "Base currency")}</label>
                <select value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} className={inp + " bg-white"}>
                  <option value="SAR">{t("SAR · ريال سعودي", "SAR · Saudi Riyal")}</option>
                  <option value="USD">{t("USD · دولار", "USD · Dollar")}</option>
                  <option value="AED">{t("AED · درهم", "AED · Dirham")}</option>
                  <option value="EUR">{t("EUR · يورو", "EUR · Euro")}</option>
                  <option value="GBP">{t("GBP · جنيه", "GBP · Pound")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("مجال الشركة", "Industry")}</label>
                <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder={t("استشارات · إنتاج فني · عقاري · …", "Consulting · media production · real estate · …")} className={inp} />
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("نهاية السنة المالية (شهر)", "Fiscal year end (month)")}</label>
                <select value={form.fiscalYearEnd} onChange={(e) => setForm({ ...form, fiscalYearEnd: Number(e.target.value) })} className={inp + " bg-white"}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <option key={m} value={m}>{months[m-1]}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t("السنة تبدأ في:", "Year starts in:")} {months[(Number(form.fiscalYearEnd) || 12) % 12]}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Tax & registration */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-foreground mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("التسجيل الضريبي والقانوني", "Tax & legal registration")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spec.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-sm text-foreground/80 block mb-1">{t(f.label.ar, f.label.en)}</label>
                  <input type="text" value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={isRtl ? f.placeholder : (f.placeholderEn || f.placeholder)} dir={f.ltr ? "ltr" : "rtl"}
                    className={`${inp} ${f.ltr ? "font-english" : ""}`} />
                  {f.help && <p className="text-xs text-muted-foreground/60 mt-1">{t(f.help.ar, f.help.en)}</p>}
                </div>
              ))}
              {form.country === "SA" && (
                <>
                  <div>
                    <label className="text-sm text-foreground/80 block mb-1">{t("تاريخ التسجيل الضريبي الفعلي", "Actual tax registration date")}</label>
                    <input type="date" value={form.taxRegistrationDate} onChange={(e) => setForm({ ...form, taxRegistrationDate: e.target.value })} className={inp + " font-english"} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-sm text-foreground/80 block mb-1">{t("تاريخ استحقاق أول إقرار ضريبي", "First VAT return due date")}</label>
                    <input type="date" value={form.firstVatPeriodStart} onChange={(e) => setForm({ ...form, firstVatPeriodStart: e.target.value })} className={inp + " font-english"} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-sm text-foreground/80 block mb-1">{t("الفترة الضريبية", "VAT period")}</label>
                    <select value={form.vatPeriod} onChange={(e) => setForm({ ...form, vatPeriod: e.target.value })} className={inp + " bg-white"}>
                      <option value="monthly">{t("شهرية", "Monthly")}</option>
                      <option value="quarterly">{t("ربع سنوية", "Quarterly")}</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Contact info */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-foreground mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>{t("بيانات الاتصال", "Contact info")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("البريد الإلكتروني", "Email")}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@ensidex.com" className={inp + " font-english"} dir="ltr" />
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("رقم الهاتف", "Phone number")}</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+966 50 123 4567" className={inp + " font-english"} dir="ltr" />
              </div>
              <div>
                <label className="text-sm text-foreground/80 block mb-1">{t("الموقع الإلكتروني", "Website")}</label>
                <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://ensidex.com" className={inp + " font-english"} dir="ltr" />
              </div>
            </div>
          </div>

          {/* Section: Address · country-aware */}
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-foreground mb-4" style={{ fontSize: "1rem", fontWeight: 600 }}>
              {form.country === "US" ? t("Mailing Address", "Mailing Address") : form.country === "SA" ? t("العنوان الوطني", "National Address") : t("العنوان", "Address")}
            </h2>
            {form.country === "US" || form.country === "GB" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-foreground/80 block mb-1">Street Address</label>
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
                  <label className="text-sm text-foreground/80 block mb-1">Suite / Unit</label>
                  <input type="text" value={form.suiteUnit} onChange={(e) => setForm({ ...form, suiteUnit: e.target.value })}
                    placeholder="Ste R" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Sheridan" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{form.country === "US" ? "State" : "Region"}</label>
                  <input type="text" value={form.state || form.region} onChange={(e) => setForm({ ...form, state: e.target.value, region: e.target.value })}
                    placeholder={form.country === "US" ? "WY" : "Greater London"} className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{form.country === "US" ? "ZIP Code" : "Postcode"}</label>
                  <input type="text" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder={form.country === "US" ? "82801" : "SW1A 1AA"} className={inp + " font-english"} dir="ltr" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-foreground/80 block mb-1">{t("الشارع", "Street")}</label>
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
                    placeholder={t("ابدأ بكتابة العنوان (مثل: طريق الدائري الشرقي)", "Start typing the address (e.g. Eastern Ring Rd)")}
                  />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{t("الحي", "District")}</label>
                  <input type="text" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder={t("حي الروضة", "Al Rawdah district")} className={inp} />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{t("رقم المبنى", "Building number")}</label>
                  <input type="text" value={form.buildingNumber} onChange={(e) => setForm({ ...form, buildingNumber: e.target.value })}
                    placeholder="7421" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{t("الرمز البريدي", "Postal code")}</label>
                  <input type="text" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="13213" className={inp + " font-english"} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{t("المدينة", "City")}</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder={t("الرياض", "Riyadh")} className={inp} />
                </div>
                <div>
                  <label className="text-sm text-foreground/80 block mb-1">{t("المنطقة", "Region")}</label>
                  <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder={t("منطقة الرياض", "Riyadh region")} className={inp} />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground/60 mt-3">
              {t("💡 ابدأ بكتابة العنوان (مثل \"30 N Gould\") · سيظهر مساعد التعبئة التلقائية قريباً", "💡 Start typing the address (e.g. \"30 N Gould\") · autocomplete assistant coming soon")}
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
