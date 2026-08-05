/**
 * Settings · org info + members + auth · wired to /orgs · /orgs/:id/members
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Building2, Users, Loader2, Save, LogOut, Shield, Sparkles, Key, AlertTriangle, ExternalLink, Database, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, Org, AiBillingConfig, AiKeyMode, setOrgId, type AuditLogItem } from "../lib/api";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";

type SettingsTab = "company" | "data" | "members" | "account" | "branding" | "ai" | "numbering" | "payments" | "catalog" | "zatca" | "plans";
const SETTINGS_TABS: SettingsTab[] = ["company", "data", "members", "account", "branding", "ai", "numbering", "payments", "catalog", "zatca", "plans"];

function initialSettingsTab(): SettingsTab {
  if (typeof window === "undefined") return "company";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return SETTINGS_TABS.includes(requested as SettingsTab) ? requested as SettingsTab : "company";
}

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>(initialSettingsTab);
  const [searchParams, setSearchParams] = useSearchParams();
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seedArmed, setSeedArmed] = useState(false);
  const [form, setForm] = useState({
    name: "", legalName: "", legalType: "" as string, country: "SA", baseCurrency: "SAR",
    vatNumber: "", crNumber: "", fiscalYearEnd: 12, zatcaEnabled: false,
    logoUrl: "", stampUrl: "", signatureUrl: "",
    email: "", phone: "", website: "",
    industry: "",
    defaultInvoiceLanguage: "ar" as "ar" | "en",
  });

  // AI Billing state
  const [aiConfig, setAiConfig] = useState<AiBillingConfig | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [byokKey, setByokKey] = useState("");
  const [byokProvider, setByokProvider] = useState<"openrouter" | "anthropic">("openrouter");
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [inboxStatus, setInboxStatus] = useState<any>(null);
  const { toasts, push, dismiss } = useToasts();
  const [pendingSignOut, setPendingSignOut] = useState(false);
  const { t } = useLanguage();
  const MODE_LABELS: Record<AiKeyMode, { label: string; price: string; alloc: string }> = {
    BYOK:            { label: t("مفتاحي الخاص (BYOK)", "Bring Your Own Key (BYOK)"),   price: "$0",      alloc: t("غير محدود", "Unlimited") },
    HOSTED_FREE:     { label: t("مجاني", "Free"),                  price: "$0",      alloc: t("$5/شهر", "$5/month") },
    HOSTED_PRO:      { label: t("احترافي", "Pro"),                price: t("$19/شهر", "$19/month"), alloc: t("$30/شهر", "$30/month") },
    HOSTED_BUSINESS: { label: t("أعمال", "Business"),                  price: t("$49/شهر", "$49/month"), alloc: t("$100/شهر", "$100/month") },
    PAYG:            { label: t("ادفع عند الاستخدام", "Pay as you go"),     price: t("$1.20 لكل $1", "$1.20 per $1"),    alloc: t("غير محدود", "Unlimited") },
  };

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (SETTINGS_TABS.includes(requested as SettingsTab)) {
      setTab(requested as SettingsTab);
    }
  }, [searchParams]);

  const selectTab = (nextTab: SettingsTab) => {
    setTab(nextTab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next, { replace: false });
  };

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const orgs = await api.orgs.list();
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const active = (stored ? orgs.find(o => o.id === stored) : null) || orgs[0];
      if (!active) { setError(t("لا توجد شركة", "No company")); setLoading(false); return; }
      setOrg(active);
      setForm({
        name: active.name, legalName: active.legalName || "",
        legalType: (active as any).legalType || "",
        country: active.country, baseCurrency: active.baseCurrency,
        vatNumber: active.vatNumber || "", crNumber: active.crNumber || "",
        fiscalYearEnd: (active as any).fiscalYearEnd || 12,
        zatcaEnabled: active.zatcaEnabled,
        logoUrl: (active as any).logoUrl || "",
        stampUrl: (active as any).stampUrl || "",
        signatureUrl: (active as any).signatureUrl || ((active as any).brandingSettings || {}).signatureUrl || "",
        email: (active as any).email || "",
        phone: (active as any).phone || "",
        website: (active as any).website || "",
        industry: (active as any).industry || "",
        defaultInvoiceLanguage: ((active as any).defaultInvoiceLanguage as "ar" | "en") || "ar",
      });
      const m = await api.orgs.members(active.id);
      setMembers(m.members);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!org) return;
    api.email.status().then(setEmailStatus).catch(() => setEmailStatus(null));
    api.inbox.status().then(setInboxStatus).catch(() => setInboxStatus(null));
  }, [org?.id]);

  const handleSave = async () => {
    if (!org) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      // Auto-derive fiscalYearStart = (end mod 12) + 1 · per UX-134
      const yearStart = (form.fiscalYearEnd % 12) + 1;
      const updated = await api.orgs.update(org.id, {
        name: form.name, legalName: form.legalName || null,
        legalType: form.legalType || null,
        country: form.country, baseCurrency: form.baseCurrency,
        vatNumber: form.vatNumber || null, crNumber: form.crNumber || null,
        fiscalYearEnd: form.fiscalYearEnd,
        fiscalYearStart: yearStart,
        zatcaEnabled: form.zatcaEnabled,
        logoUrl: form.logoUrl || null,
        stampUrl: form.stampUrl || null,
        signatureUrl: form.signatureUrl || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        industry: form.industry || null,
        defaultInvoiceLanguage: form.defaultInvoiceLanguage,
      } as any);
      setOrg(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Failed to save")); }
    finally { setBusy(false); }
  };

  // ── AI Billing handlers ────────────────────────────────────────────────────
  const refreshAiConfig = useCallback(async () => {
    try {
      const c = await api.aiBilling.get();
      setAiConfig(c);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل تحميل إعدادات AI", "Failed to load AI settings"));
    }
  }, [push]);

  useEffect(() => {
    if (tab === "ai" && !aiConfig) refreshAiConfig();
  }, [tab, aiConfig, refreshAiConfig]);

  const handleAiModeChange = async (mode: AiKeyMode) => {
    setAiBusy(true);
    try {
      const c = await api.aiBilling.update({ mode });
      setAiConfig(c);
      push("success", t(`تم التحويل إلى ${MODE_LABELS[mode].label}`, `Switched to ${MODE_LABELS[mode].label}`));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل التحديث", "Update failed"));
    } finally { setAiBusy(false); }
  };

  const handleSaveByok = async () => {
    if (!byokKey.trim() || byokKey.length < 20) {
      push("error", t("المفتاح غير صحيح · يجب أن يبدأ بـ sk-", "Invalid key · must start with sk-"));
      return;
    }
    setAiBusy(true);
    try {
      const c = await api.aiBilling.update({ mode: "BYOK", byokProvider, byokKey: byokKey.trim() });
      setAiConfig(c);
      setByokKey("");
      push("success", t("تم حفظ المفتاح وتفعيل BYOK", "Key saved and BYOK activated"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setAiBusy(false); }
  };

  const handleClearByok = async () => {
    setAiBusy(true);
    try {
      const c = await api.aiBilling.update({ clearByok: true, mode: "HOSTED_FREE" });
      setAiConfig(c);
      push("success", t("تم حذف المفتاح · رجعت للباقة المجانية", "Key deleted · reverted to the free plan"));
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed"));
    } finally { setAiBusy(false); }
  };

  const handleSignOut = async () => {
    setPendingSignOut(false);
    await authStore.logout();
    window.location.href = "/login";
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الإعدادات", "Settings")}</h1>
        <p className="text-muted-foreground mt-1">{org?.name}</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto pb-px [scrollbar-width:none]">
        {(([
          ["company", "بيانات الشركة", "Company"],
          ["data", "البيانات", "Data"],
          ["numbering", "الترقيم", "Numbering"],
          // ZATCA tab is KSA-only · hide when country=US (UX-176)
          ...(org?.country === "US" ? [] : [["zatca", "ZATCA · الفوترة الإلكترونية", "ZATCA e-invoicing"]]),
          ["payments", "بوابات الدفع", "Payment gateways"],
          ["catalog", "كتالوج المنتجات", "Product catalog"],
          ["members", "الفريق", "Team"],
          ["ai", "الذكاء الاصطناعي", "AI"],
          ["branding", "العلامة التجارية", "Branding"],
          ["plans", "الباقات", "Plans"],
          ["account", "حسابي", "Account"],
        ] as const) as Array<readonly [string, string, string]>).map(([k, label, labelEn]) => (
          <button
            key={k}
            onClick={() => selectTab(k as SettingsTab)}
            className={`shrink-0 min-w-[76px] max-w-[132px] whitespace-normal px-2 sm:px-3 py-2 text-center text-[12px] sm:text-sm leading-4 transition-colors border-b-2 -mb-px ${tab === k ? "border-[#1276E3] text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >{t(label, labelEn)}</button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">✅ {t("تم الحفظ", "Saved")}</div>}

      {tab === "company" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="flex items-center gap-2 text-foreground"><Building2 className="h-5 w-5" /> {t("بيانات الشركة", "Company data")}</CardTitle><CardDescription>{t("الاسم · الرقم الضريبي · العملة · الشعار · الختم · بيانات التواصل", "Name · Tax number · Currency · Logo · Stamp · Contact info")}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("اسم الشركة *", "Company name *")}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-border" /></div>
              <div className="space-y-2"><Label>{t("الاسم القانوني", "Legal name")}</Label>
                <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="ENSIDEX LLC" className="border-border" /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("الكيان القانوني", "Legal entity type")}</Label>
              <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
                {([
                  ["LLC", t("ذات مسؤولية محدودة", "LLC")],
                  ["JSC", t("مساهمة", "Joint-stock")],
                  ["SOLE_PROP", t("مؤسسة فردية", "Sole prop.")],
                  ["PARTNERSHIP", t("شراكة", "Partnership")],
                  ["NONPROFIT", t("غير ربحية", "Non-profit")],
                  ["OTHER", t("أخرى", "Other")],
                ] as [string, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, legalType: form.legalType === value ? "" : value })}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${form.legalType === value ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    style={{ fontWeight: form.legalType === value ? 600 : 500 }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {t("«مساهمة» تفعّل سجل المساهمين وحركات الأسهم · باقي الأنواع تستخدم سجل الملاك المرتبط بجهات الاتصال", "“Joint-stock” enables the shareholders register & share transactions · other forms use the contact-linked owners registry")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>{t("الدولة", "Country")}</Label>
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                  <option value="SA">{t("السعودية", "Saudi Arabia")}</option><option value="AE">{t("الإمارات", "UAE")}</option><option value="KW">{t("الكويت", "Kuwait")}</option>
                  <option value="QA">{t("قطر", "Qatar")}</option><option value="BH">{t("البحرين", "Bahrain")}</option><option value="OM">{t("عُمان", "Oman")}</option>
                  <option value="EG">{t("مصر", "Egypt")}</option><option value="US">{t("الولايات المتحدة", "United States")}</option><option value="GB">{t("المملكة المتحدة", "United Kingdom")}</option>
                </select></div>
              <div className="space-y-2"><Label>{t("العملة الأساسية", "Base currency")}</Label>
                <select value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                  <option value="SAR">SAR</option><option value="USD">USD</option><option value="AED">AED</option>
                  <option value="EUR">EUR</option><option value="GBP">GBP</option><option value="KWD">KWD</option>
                </select></div>
              <div className="space-y-2"><Label>{t("نهاية السنة المالية", "Fiscal year end")}</Label>
                <Select value={String(form.fiscalYearEnd)} onValueChange={(v) => setForm({ ...form, fiscalYearEnd: Number(v) })}>
                  <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <SelectItem key={m} value={String(m)}>{[t("يناير","January"),t("فبراير","February"),t("مارس","March"),t("أبريل","April"),t("مايو","May"),t("يونيو","June"),t("يوليو","July"),t("أغسطس","August"),t("سبتمبر","September"),t("أكتوبر","October"),t("نوفمبر","November"),t("ديسمبر","December")][m-1]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{t("شهر إقفال الحسابات السنوي (KSA: ديسمبر افتراضي)", "Annual accounts closing month (KSA: December by default)")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{form.country === "US" ? "EIN" : form.country === "AE" ? "TRN" : t("الرقم الضريبي", "Tax number")}</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} dir="ltr" className="border-border font-english" /></div>
              <div className="space-y-2"><Label>{form.country === "US" ? "State Filing #" : t("السجل التجاري", "Commercial registration")}</Label>
                <Input value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} dir="ltr" className="border-border font-english" /></div>
            </div>

            {/* Branding · logo + stamp upload (UX-157) */}
            <div className="border-t border-border/50 pt-4">
              <h3 className="text-sm text-foreground mb-3" style={{ fontWeight: 600 }}>{t("الشعار والختم", "Logo & stamp")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-2 block">{t("الشعار (مربع أو طولي · يظهر على الفواتير)", "Logo (square or rectangular · shown on invoices)")}</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-3">
                    <input type="file" id="company-logo" accept="image/*" hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 2 * 1024 * 1024) { setError(t("الحد الأقصى 2 ميجا", "Max 2 MB")); return; }
                        const r = new FileReader(); r.onload = () => setForm(p => ({ ...p, logoUrl: String(r.result || "") })); r.readAsDataURL(f);
                      }} />
                    {form.logoUrl ? (
                      <div className="flex items-center gap-3">
                        <img src={form.logoUrl} alt="logo" className="max-w-[160px] max-h-[60px] object-contain bg-white rounded border border-border/50" />
                        <div className="flex flex-col gap-1">
                          <label htmlFor="company-logo" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                          <button type="button" onClick={() => setForm(p => ({ ...p, logoUrl: "" }))} className="text-xs text-red-600 text-start hover:underline">{t("حذف", "Delete")}</button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="company-logo" className="cursor-pointer block text-center py-4">
                        <div className="text-sm text-primary font-medium">{t("رفع الشعار", "Upload logo")}</div>
                        <div className="text-xs text-muted-foreground/60 mt-1">{t("PNG · SVG · JPG · حتى 2MB", "PNG · SVG · JPG · up to 2MB")}</div>
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">{t("الختم الرسمي (يظهر على العقود + السندات)", "Official stamp (shown on contracts + vouchers)")}</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-3">
                    <input type="file" id="company-stamp" accept="image/*" hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 2 * 1024 * 1024) { setError(t("الحد الأقصى 2 ميجا", "Max 2 MB")); return; }
                        const r = new FileReader(); r.onload = () => setForm(p => ({ ...p, stampUrl: String(r.result || "") })); r.readAsDataURL(f);
                      }} />
                    {form.stampUrl ? (
                      <div className="flex items-center gap-3">
                        <img src={form.stampUrl} alt="stamp" className="max-w-[120px] max-h-[60px] object-contain bg-white rounded border border-border/50" />
                        <div className="flex flex-col gap-1">
                          <label htmlFor="company-stamp" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                          <button type="button" onClick={() => setForm(p => ({ ...p, stampUrl: "" }))} className="text-xs text-red-600 text-start hover:underline">{t("حذف", "Delete")}</button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="company-stamp" className="cursor-pointer block text-center py-4">
                        <div className="text-sm text-primary font-medium">{t("رفع الختم", "Upload stamp")}</div>
                        <div className="text-xs text-muted-foreground/60 mt-1">{t("PNG شفاف يفضّل · حتى 2MB", "Transparent PNG preferred · up to 2MB")}</div>
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">{t("توقيع صاحب الصلاحية (يظهر كتوقيع إلكتروني على السندات)", "Authorized signatory (shown as an electronic signature on vouchers)")}</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-3">
                    <input type="file" id="company-signature" accept="image/*" hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 2 * 1024 * 1024) { setError(t("الحد الأقصى 2 ميجا", "Max 2 MB")); return; }
                        const r = new FileReader(); r.onload = () => setForm(p => ({ ...p, signatureUrl: String(r.result || "") })); r.readAsDataURL(f);
                      }} />
                    {form.signatureUrl ? (
                      <div className="flex items-center gap-3">
                        <img src={form.signatureUrl} alt="signature" className="max-w-[120px] max-h-[60px] object-contain bg-white rounded border border-border/50" />
                        <div className="flex flex-col gap-1">
                          <label htmlFor="company-signature" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                          <button type="button" onClick={() => setForm(p => ({ ...p, signatureUrl: "" }))} className="text-xs text-red-600 text-start hover:underline">{t("حذف", "Delete")}</button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="company-signature" className="cursor-pointer block text-center py-4">
                        <div className="text-sm text-primary font-medium">{t("رفع التوقيع", "Upload signature")}</div>
                        <div className="text-xs text-muted-foreground/60 mt-1">{t("PNG شفاف يفضّل · حتى 2MB", "Transparent PNG preferred · up to 2MB")}</div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact info (UX-132) */}
            <div className="border-t border-border/50 pt-4">
              <h3 className="text-sm text-foreground mb-3" style={{ fontWeight: 600 }}>{t("بيانات التواصل", "Contact info")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="text-xs">{t("البريد الإلكتروني", "Email")}</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" placeholder="info@company.com" className="border-border font-english" /></div>
                <div className="space-y-2"><Label className="text-xs">{t("الهاتف", "Phone")}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="+966500000000" className="border-border font-english" /></div>
                <div className="space-y-2"><Label className="text-xs">{t("الموقع", "Website")}</Label>
                  <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} dir="ltr" placeholder="https://company.com" className="border-border font-english" /></div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs">{t("الصناعة", "Industry")}</Label>
                  <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                    <option value="">{t("اختر...", "Select...")}</option>
                    <option value="CONSULTING">{t("استشارات", "Consulting")}</option>
                    <option value="RETAIL">{t("تجارة تجزئة", "Retail")}</option>
                    <option value="REAL_ESTATE">{t("عقارات", "Real estate")}</option>
                    <option value="VET_CLINIC">{t("عيادة بيطرية", "Veterinary clinic")}</option>
                    <option value="PRODUCTION">{t("إنتاج إعلامي", "Media production")}</option>
                    <option value="EDUCATION">{t("تعليم", "Education")}</option>
                    <option value="SAAS">{t("SaaS · تكنولوجيا", "SaaS · Technology")}</option>
                    <option value="OTHER">{t("أخرى", "Other")}</option>
                  </select>
                </div>
                <div className="space-y-2"><Label className="text-xs">{t("اللغة الافتراضية للفواتير", "Default invoice language")}</Label>
                  <select value={form.defaultInvoiceLanguage} onChange={(e) => setForm({ ...form, defaultInvoiceLanguage: e.target.value as "ar" | "en" })} className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                    <option value="ar">{t("عربي · Arabic", "Arabic")}</option>
                    <option value="en">{t("إنجليزي · English", "English")}</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground/60">{t("يحدد اللغة الافتراضية للفواتير + السندات + التقارير عند الطباعة", "Sets the default language for invoices + vouchers + reports when printing")}</p>
                </div>
              </div>
            </div>
            {form.country !== "US" && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-blue-100">
                <input type="checkbox" id="zatca" checked={form.zatcaEnabled} onChange={(e) => setForm({ ...form, zatcaEnabled: e.target.checked })} className="h-4 w-4" />
                <label htmlFor="zatca" className="text-sm text-foreground cursor-pointer">{t("تفعيل ZATCA Phase 2 e-invoicing (السوق السعودي · UUID + QR + XML)", "Enable ZATCA Phase 2 e-invoicing (Saudi market · UUID + QR + XML)")}</label>
              </div>
            )}
            {form.country === "US" && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                {t("🇺🇸 وضع الشركات الأمريكية مفعّل · لا حاجة لـ ZATCA · أنت مرتبط ببوابات أمريكية (Stripe · Plaid · 1099) ولا تحتاج للسوق السعودي", "🇺🇸 US company mode is on · no ZATCA needed · you are linked to US gateways (Stripe · Plaid · 1099) and don't need the Saudi market")}
              </div>
            )}
            {/* Inbox forwarding alias (UX-159) · shows the unique email for this org */}
            {org && (org as any).slug && (
              <div className="border-t border-border/50 pt-4">
                <h3 className="text-sm text-foreground mb-2" style={{ fontWeight: 600 }}>
                  {t("صندوق البريد الوارد · يستلم الفواتير تلقائياً", "Inbound bills mailbox")}
                </h3>
                <div className={`rounded-lg border p-3 flex items-center gap-3 ${inboxStatus?.configured ? "border-blue-200 bg-gradient-to-l from-[#F4FCFF] to-white" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex-1 min-w-0">
                    <code className="text-sm text-foreground font-english font-semibold block truncate" dir="ltr">
                      {inboxStatus?.address || `bills+${(org as any).slug}@entix.io`}
                    </code>
                    <p className={`text-xs mt-1 ${inboxStatus?.configured ? "text-muted-foreground" : "text-amber-800"}`}>
                      {inboxStatus?.configured
                        ? t('أرسل أي فاتورة من المورد إلى هذا الإيميل · يقوم الذكاء بتحليلها وإنشاء مسودة في "البريد الوارد" تلقائياً', 'Forward supplier bills to this mailbox. Entix will parse them into Inbox drafts automatically.')
                        : t("هذا العنوان غير مفعّل كبريد حقيقي بعد. يلزم إعداد توجيه البريد و INBOX_WEBHOOK_TOKEN على الخادم قبل استخدامه.", "This address is not live yet. Configure inbound email routing and INBOX_WEBHOOK_TOKEN on the server before using it.")}
                    </p>
                    {emailStatus && (
                      <p className={`text-xs mt-1 ${emailStatus.configured ? "text-emerald-700" : "text-amber-800"}`}>
                        {emailStatus.configured
                          ? t(`إرسال الفواتير مفعّل من ${emailStatus.from}`, `Invoice email delivery is active from ${emailStatus.from}`)
                          : t("إرسال الفواتير غير مفعّل: RESEND_API_KEY أو EMAIL_FROM ناقص.", "Invoice email delivery is not active: RESEND_API_KEY or EMAIL_FROM is missing.")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inboxStatus?.address || `bills+${(org as any).slug}@entix.io`);
                      push("success", t("تم نسخ العنوان", "Address copied"));
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-primary/5 transition"
                  >
                    {t("نسخ", "Copy")}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 gap-2">
              {seedArmed ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!org) return;
                      setSeedArmed(false);
                      try {
                        const r = await (api as any).seedDemoData(org.id);
                        if (r?.ok) {
                          push("success", t("تمت إضافة البيانات التجريبية", "Demo data added"));
                          setSaved(true);
                          setTimeout(() => window.location.reload(), 800);
                        }
                      } catch (e: any) {
                        setError(e?.message || t("فشل التعبئة", "Seeding failed"));
                      }
                    }}
                    className="px-3 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
                  >
                    {t("تأكيد التعبئة", "Confirm seeding")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeedArmed(false)}
                    className="px-3 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted"
                  >
                    {t("إلغاء", "Cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSeedArmed(true)}
                  className="px-3 py-2 text-sm rounded-md border border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-2"
                >
                  ✨ {t("تعبئة بيانات تجريبية كاملة", "Seed full demo data")}
                </button>
              )}
              <Button onClick={handleSave} disabled={busy} className="bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> {t("حفظ التغييرات", "Save changes")}</>}
              </Button>
            </div>

            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{t("تحتاج حذف هذه الشركة؟ الحذف متاح للمالك فقط ويتطلب كتابة اسم الشركة للتأكيد.", "Need to delete this company? Deletion is available to the owner only and requires typing the company name to confirm.")}</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => selectTab("data")}
                  className="shrink-0 border-red-200 bg-white text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="me-2 h-4 w-4" /> {t("فتح الحذف", "Open delete")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "members" && org && <MembersTab orgId={org.id} initialMembers={members} setMembers={setMembers} push={push} />}
      {tab === "data" && org && <DataResetTab org={org} setOrg={setOrg} push={push} refresh={refresh} />}

      {tab === "ai" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground"><Sparkles className="h-5 w-5" /> {t("الذكاء الاصطناعي · الاشتراك والمفتاح", "AI · subscription & key")}</CardTitle>
            <CardDescription>{t("اختر الباقة · أو ضع مفتاحك الخاص (BYOK) · لا تكاليف إضافية علينا", "Choose a plan · or use your own key (BYOK) · no extra cost from us")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!aiConfig ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : (
              <>
                {/* Current usage bar */}
                <div className="rounded-lg border border-border p-4 bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("الباقة الحالية", "Current plan")}: {MODE_LABELS[aiConfig.mode].label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("المخصص", "Allocation")}: {MODE_LABELS[aiConfig.mode].alloc} · {t("السعر", "Price")}: {MODE_LABELS[aiConfig.mode].price}</p>
                    </div>
                    {aiConfig.disabled && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="h-3 w-3" /> {t("معطّل من الإدارة", "Disabled by admin")}
                      </span>
                    )}
                  </div>
                  {aiConfig.mode !== "BYOK" && aiConfig.mode !== "PAYG" && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 mb-1">
                        <span>{t("المستخدَم", "Used")}: <span className="font-english text-foreground">${Number(aiConfig.spentThisPeriod).toFixed(2)}</span></span>
                        <span className="font-english">${Number(aiConfig.monthlyAllocation).toFixed(2)} + ${Number(aiConfig.creditBalance).toFixed(2)} {t("رصيد", "credit")}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                        <div
                          className={`h-full transition-all ${aiConfig.percentUsed >= 1 ? "bg-red-500" : aiConfig.percentUsed >= 0.8 ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${Math.min(aiConfig.percentUsed * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground/60 font-english mt-1">{(aiConfig.percentUsed * 100).toFixed(0)}% used</p>
                    </>
                  )}
                </div>

                {/* Mode selector */}
                <div>
                  <Label className="text-foreground/80">{t("اختر الباقة", "Choose a plan")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {(Object.entries(MODE_LABELS) as [AiKeyMode, typeof MODE_LABELS[AiKeyMode]][]).map(([k, m]) => (
                      <button
                        key={k}
                        onClick={() => k !== "BYOK" && handleAiModeChange(k)}
                        disabled={aiBusy || aiConfig.mode === k || aiConfig.disabled}
                        className={`text-start rounded-lg border p-3 transition-all ${
                          aiConfig.mode === k
                            ? "border-[#1276E3] bg-primary/5"
                            : "border-border hover:border-[#1276E3]/40 hover:bg-muted"
                        } ${aiBusy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{m.label}</p>
                          {aiConfig.mode === k && <span className="text-xs text-primary">{t("✓ نشطة", "✓ Active")}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{m.alloc} · <span className="font-english">{m.price}</span></p>
                        {k === "BYOK" && <p className="text-xs text-primary mt-1">{t("↓ ضع مفتاحك أدناه", "↓ Enter your key below")}</p>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BYOK form */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-primary" />
                    <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t("مفتاحي الخاص (BYOK)", "Bring Your Own Key (BYOK)")}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("استخدم مفتاح OpenRouter أو Anthropic الخاص بك · لا تكاليف منا · المفتاح مشفّر بـAES-256-GCM في قاعدة البيانات", "Use your own OpenRouter or Anthropic key · no cost from us · the key is encrypted with AES-256-GCM in the database")}
                  </p>

                  {aiConfig.byokKeyHint ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-md bg-primary/5 border border-blue-100 p-3">
                        <div>
                          <p className="text-sm text-foreground" style={{ fontWeight: 500 }}>
                            {t("المفتاح النشط", "Active key")}: <span className="font-english">{aiConfig.byokKeyHint}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("المزود", "Provider")}: {aiConfig.byokProvider}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={async () => {
                            try {
                              const r = await api.aiBilling.testKey();
                              if (r.ok) {
                                push("success", t(`✅ المفتاح يعمل · ${r.message || ""} (${r.elapsedMs}ms)`, `✅ Key works · ${r.message || ""} (${r.elapsedMs}ms)`));
                              } else {
                                push("error", t(`❌ المفتاح لا يعمل: ${r.message || r.error || "مجهول"}`, `❌ Key does not work: ${r.message || r.error || "unknown"}`));
                              }
                            } catch (e: any) {
                              push("error", e?.message || t("فشل الاختبار", "Test failed"));
                            }
                          }} variant="outline" disabled={aiBusy} className="border-green-300 text-green-700 hover:bg-green-50">
                            {t("اختبار الاتصال", "Test connection")}
                          </Button>
                          <Button onClick={handleClearByok} variant="outline" disabled={aiBusy} className="border-red-200 text-red-600 hover:bg-red-50">
                            {t("حذف المفتاح", "Delete key")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-foreground/80 text-xs">{t("المزود", "Provider")}</Label>
                        <select value={byokProvider} onChange={(e) => setByokProvider(e.target.value as any)} className="w-full mt-1 rounded-md border border-border px-3 py-2 text-sm bg-white">
                          <option value="openrouter">{t("OpenRouter (موصى به · أسعار أفضل)", "OpenRouter (recommended · better pricing)")}</option>
                          <option value="anthropic">{t("Anthropic (مباشر)", "Anthropic (direct)")}</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-foreground/80 text-xs">{t("المفتاح", "Key")}</Label>
                        <Input
                          type="password"
                          value={byokKey}
                          onChange={(e) => setByokKey(e.target.value)}
                          dir="ltr"
                          placeholder="sk-or-v1-..."
                          className="font-english border-border mt-1"
                        />
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {t("احصل على مفتاح من", "Get a key from")} <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-primary hover:underline">openrouter.ai/keys</a>
                        </p>
                      </div>
                      <Button onClick={handleSaveByok} disabled={aiBusy || !byokKey} className="bg-primary hover:bg-primary/90">
                        {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ المفتاح وتفعيل BYOK", "Save key and activate BYOK")}
                      </Button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("💡 يتم إعادة ضبط الاستهلاك تلقائياً كل 30 يوم · رصيد الـtop-up يضاف إلى المخصص الشهري", "💡 Usage resets automatically every 30 days · top-up credit is added to the monthly allocation")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "numbering" && org && <NumberingTab orgId={org.id} push={push} />}
      {tab === "payments" && org && <PaymentsTab org={org} setOrg={setOrg} push={push} />}
      {tab === "catalog" && org && <CatalogTab push={push} />}
      {tab === "zatca" && org && <ZatcaTab org={org} push={push} />}
      {tab === "branding" && org && <BrandingTab org={org} setOrg={setOrg} push={push} />}
      {tab === "plans" && org && <PlansTab org={org} />}

      {tab === "account" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="flex items-center gap-2 text-foreground"><Shield className="h-5 w-5" /> {t("حسابي", "My account")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{t("جلسة آمنة · 30 يوم · مشفّرة بكوكي HttpOnly على", "Secure session · 30 days · encrypted via HttpOnly cookie on")} <span className="font-english">.entix.io</span></p>
            </div>
            {pendingSignOut ? (
            <InlineConfirm onConfirm={handleSignOut} onCancel={() => setPendingSignOut(false)} label={t("تسجيل الخروج؟", "Sign out?")} />
          ) : (
            <Button onClick={() => setPendingSignOut(true)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4 me-2" /> {t("تسجيل الخروج", "Sign out")}</Button>
          )}
          </CardContent>
        </Card>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function DataResetTab({
  org,
  setOrg,
  push,
  refresh,
}: {
  org: Org;
  setOrg: (org: Org) => void;
  push: (kind: any, msg: string) => void;
  refresh: () => Promise<void>;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [accountScheduled, setAccountScheduled] = useState<string | null>(null);
  const [busy, setBusy] = useState<"blank" | "demo" | "clean_company" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const { t } = useLanguage();

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await api.orgs.auditLog(org.id, 20);
      setAudit(res.items || []);
    } catch {
      setAudit([]);
    } finally {
      setLoadingAudit(false);
    }
  }, [org.id]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  const runReset = async (mode: "blank" | "demo" | "clean_company") => {
    if (confirmName.trim() !== org.name && confirmName.trim() !== org.slug) {
      push("error", t("اكتب اسم الشركة أو slug كما هو للتأكيد", "Type the company name or slug as-is to confirm"));
      return;
    }
    setBusy(mode);
    try {
      const result = await api.orgs.resetData(org.id, { mode, confirmName: confirmName.trim() });
      if (mode === "clean_company" && result.org) {
        setOrgId(result.org.id);
        setOrg(result.org);
        push("success", t("تم إنشاء شركة نظيفة والتبديل عليها", "Created a clean company and switched to it"));
        setTimeout(() => window.location.reload(), 500);
        return;
      }
      push("success", mode === "demo" ? t("تمت إعادة ضبط البيانات وتحميل بيانات تجريبية", "Data reset and demo data loaded") : t("تمت إعادة ضبط بيانات الشركة", "Company data has been reset"));
      setConfirmName("");
      await refresh();
      await loadAudit();
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشلت العملية", "Operation failed"));
    } finally {
      setBusy(null);
    }
  };

  const disabled = !!busy || (confirmName.trim() !== org.name && confirmName.trim() !== org.slug);
  const deleteDisabled = deleting || (deleteConfirmName.trim() !== org.name && deleteConfirmName.trim() !== org.slug);

  const deleteCompany = async () => {
    if (deleteDisabled) {
      push("error", t("اكتب اسم الشركة أو slug كما هو للحذف", "Type the company name or slug as-is to delete"));
      return;
    }
    setDeleting(true);
    try {
      const result = await api.orgs.remove(org.id, { confirmName: deleteConfirmName.trim() });
      if (result.nextOrgId) setOrgId(result.nextOrgId);
      push("success", t("تم حذف الشركة والتبديل إلى شركة أخرى", "Company deleted and switched to another company"));
      setTimeout(() => window.location.assign("/app/settings?tab=company"), 500);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل حذف الشركة", "Failed to delete company"));
    } finally {
      setDeleting(false);
    }
  };

  const deleteAccount = async () => {
    if (accountDeleting) return;
    setAccountDeleting(true);
    try {
      const res = await api.meDeleteAccount(accountConfirm.trim());
      setAccountScheduled((res.purgeAfter || "").slice(0, 10));
      // The server revoked every session — show the schedule, then land on login.
      setTimeout(async () => {
        await authStore.logout();
        window.location.href = "/login";
      }, 4500);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشل طلب الحذف", "Deletion request failed"));
      setAccountDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#F4B4B4] bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-red-600" /> {t("إعادة ضبط البيانات", "Reset data")}
          </CardTitle>
          <CardDescription>
            {t("هذه الأدوات مخصصة للنسخة الخاصة والتجارب. لا تحذف المستخدم أو عضوية الشركة أو جلسات الدخول.", "These tools are for the self-hosted edition and trials. They do not delete the user, company membership, or login sessions.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("اكتب", "Type")} <span className="font-semibold">{org.name}</span> {t("أو", "or")} <span className="font-english">{org.slug}</span> {t("لتأكيد أي عملية.", "to confirm any operation.")}</p>
            </div>
          </div>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={org.name} className="border-border" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <ResetOption
              title={t("شركة فاضية", "Blank company")}
              description={t("يمسح المستندات والجهات والمنتجات ويعيد دليل الحسابات والضريبة والمستودع الرئيسي.", "Erases documents, contacts, and products, and resets the chart of accounts, taxes, and the main warehouse.")}
              icon={RotateCcw}
              disabled={disabled}
              busy={busy === "blank"}
              onClick={() => runReset("blank")}
              action={t("إعادة ضبط", "Reset")}
            />
            <ResetOption
              title={t("بيانات تجريبية", "Demo data")}
              description={t("يمسح البيانات ثم يضيف عميل ومورد وموظف ومنتج وفاتورة ومشتريات جاهزة للفحص.", "Erases data then adds a customer, supplier, employee, product, invoice, and purchases ready for inspection.")}
              icon={Sparkles}
              disabled={disabled}
              busy={busy === "demo"}
              onClick={() => runReset("demo")}
              action={t("تحميل ديمو", "Load demo")}
            />
            <ResetOption
              title={t("شركة نظيفة جديدة", "New clean company")}
              description={t("ينشئ شركة جديدة بنفس معلوماتك الأساسية ويترك الشركة الحالية كما هي.", "Creates a new company with your same basic info and leaves the current company as-is.")}
              icon={ShieldCheck}
              disabled={disabled}
              busy={busy === "clean_company"}
              onClick={() => runReset("clean_company")}
              action={t("إنشاء نسخة", "Create copy")}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="h-5 w-5" /> {t("حذف الشركة", "Delete company")}
          </CardTitle>
          <CardDescription>
            {t("يحذف الشركة الحالية وكل بياناتها التابعة. لا يمكن حذف آخر شركة في الحساب، والحذف متاح للمالك فقط.", "Deletes the current company and all its dependent data. The last company in the account cannot be deleted, and deletion is available to the owner only.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
            {t("للتأكيد اكتب", "To confirm, type")} <span className="font-semibold">{org.name}</span> {t("أو", "or")} <span className="font-english">{org.slug}</span> {t("كما هو.", "as-is.")}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={org.name}
              className="border-red-200"
            />
            <Button
              type="button"
              onClick={deleteCompany}
              disabled={deleteDisabled}
              variant="outline"
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 me-2" /> {t("حذف الشركة", "Delete company")}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-300 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <ShieldCheck className="h-5 w-5" /> {t("حذف الحساب نهائياً", "Delete account permanently")}
          </CardTitle>
          <CardDescription>
            {t(
              "يحذف حسابك بالكامل — كل شركاتك وبياناتك وجلساتك على كل الأجهزة. لا يتم من الجوال أبداً، ويتطلب كتابة بريدك الإلكتروني للتأكيد.",
              "Deletes your entire account — all your companies, data, and sessions on every device. Never from the phone, and requires typing your email to confirm.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            {t(
              "حماية الاسترداد: بعد الطلب تدخل مهلة 30 يوماً — سجّل دخولك خلالها واختر «استرداد الحساب» ليُلغى الحذف ويعود كل شيء كما كان. بعد 30 يوماً يُمحى نهائياً.",
              "Recovery protection: after the request a 30-day window starts — sign in during it and choose “Restore account” to cancel and get everything back. After 30 days it's permanently erased.",
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={accountConfirm}
              onChange={(e) => setAccountConfirm(e.target.value)}
              placeholder={authStore.getState().user?.email || t("بريدك الإلكتروني", "Your email")}
              className="border-red-200 font-english"
              dir="ltr"
            />
            <Button
              type="button"
              onClick={deleteAccount}
              disabled={accountDeleting || !accountConfirm.trim() || accountConfirm.trim().toLowerCase() !== (authStore.getState().user?.email || "").toLowerCase()}
              variant="outline"
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {accountDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 me-2" /> {t("جدولة حذف الحساب", "Schedule account deletion")}</>}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            {t("الزر لا يعمل إلا إذا كتبت بريدك الإلكتروني كاملاً كما هو مسجل.", "The button only activates when you type your full registered email.")}
          </p>
        </CardContent>
      </Card>

      {accountScheduled && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 text-center">
            <div className="text-4xl">🗓️</div>
            <h2 className="text-foreground" style={{ fontWeight: 700 }}>{t("تمت جدولة حذف حسابك", "Account deletion scheduled")}</h2>
            <p className="text-sm text-foreground/80 leading-6">
              {t("سيُحذف نهائياً في", "It will be permanently deleted on")}{" "}
              <span className="font-english font-semibold" dir="ltr">{accountScheduled}</span>.
              {" "}{t("سجّل دخولك قبلها واختر «استرداد الحساب» لإلغاء الحذف.", "Sign in before then and choose “Restore account” to cancel.")}
            </p>
            <p className="text-xs text-muted-foreground">{t("ستُسجَّل خروجك من كل الأجهزة الآن…", "You're being signed out on all devices…")}</p>
          </div>
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t("سجل التدقيق", "Audit log")}</CardTitle>
          <CardDescription>{t("آخر عمليات حساسة على بيانات الشركة.", "Recent sensitive operations on company data.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAudit ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
          ) : audit.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("لا يوجد سجل تدقيق بعد", "No audit log yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start">{t("العملية", "Operation")}</th>
                  <th className="px-4 py-3 text-start">{t("النوع", "Type")}</th>
                  <th className="px-4 py-3 text-start">{t("المستوى", "Level")}</th>
                  <th className="px-4 py-3 text-start">{t("التاريخ", "Date")}</th>
                </tr></thead>
                <tbody>
                  {audit.map((item) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-sm font-english text-foreground">{item.action}</td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{item.entityType}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`rounded px-2 py-0.5 ${item.severity === "WARNING" ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{item.severity}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-english text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</td>
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

function ResetOption({
  title,
  description,
  icon: Icon,
  disabled,
  busy,
  onClick,
  action,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  action: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="min-h-14 text-xs leading-6 text-muted-foreground">{description}</p>
      <Button type="button" disabled={disabled} onClick={onClick} className="mt-4 w-full bg-primary hover:bg-primary/90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : action}
      </Button>
    </div>
  );
}

// ── NUMBERING TAB ──────────────────────────────────────────────────────────
function NumberingTab({ orgId, push }: { orgId: string; push: (kind: any, msg: string) => void }) {
  const [config, setConfig] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  type NumberingKindUi = "contact" | "invoice" | "quote" | "bill" | "receipt" | "payment";
  const kinds: Array<[NumberingKindUi, string]> = [
    ["contact", t("العملاء/الموردين", "Customers/Suppliers")],
    ["invoice", t("فواتير المبيعات", "Sales invoices")],
    ["quote", t("عروض الأسعار", "Price quotes")],
    ["bill", t("فواتير المشتريات", "Purchase invoices")],
    ["receipt", t("سندات القبض", "Receipt vouchers")],
    ["payment", t("سندات الصرف", "Payment vouchers")],
  ];
  const tokenHintByKind: Record<NumberingKindUi, string> = {
    contact: "{CLIENT}",
    invoice: "{CLIENT}",
    quote: "{CLIENT}",
    bill: "{VENDOR}",
    receipt: "{CLIENT}",
    payment: "{VENDOR}",
  };

  const normalizeLegacyPrefix = (prefix: string, kind: NumberingKindUi) => {
    return String(prefix || "").replace(/X{2,}/gi, tokenHintByKind[kind]);
  };

  const normalizeLoadedConfig = (raw: any) => {
    const source = raw || {};
    const voucher = source.voucher || {};
    return {
      ...source,
      receipt: source.receipt || (Object.keys(voucher).length ? { ...voucher } : undefined),
      payment: source.payment || (Object.keys(voucher).length ? { ...voucher } : undefined),
    };
  };

  useEffect(() => {
    api.orgs.getNumbering(orgId)
      .then((raw) => setConfig(normalizeLoadedConfig(raw)))
      .catch(() => setConfig({
        contact: { prefix: "EN-CON-{CLIENT}-", padding: 4 },
        invoice: { prefix: "EN-INV-{YYYY}{MM}-", padding: 4 },
        quote: { prefix: "EN-QTE-{YYYY}{MM}-", padding: 4 },
        bill: { prefix: "EN-BIL-{VENDOR}-{YYYY}{MM}-", padding: 4 },
        receipt: { prefix: "EN-RCP-{CLIENT}-{YYYY}{MM}-", padding: 4 },
        payment: { prefix: "EN-PAY-{VENDOR}-{YYYY}{MM}-", padding: 4 },
      }))
      .finally(() => setLoading(false));
  }, [orgId]);

  const expand = (s: string) => {
    const now = new Date();
    return s
      .replace(/\{ENTITY\}/g, String(config?.entityCode || "EN"))
      .replace(/\{CLIENT\}/g, "CLNT")
      .replace(/\{VENDOR\}/g, "VNDR")
      .replace(/\{PROJECT\}/g, "PRJ1")
      .replace(/\{DOC\}/g, "DOC")
      .replace(/\{YYYY\}/g, String(now.getFullYear()))
      .replace(/\{YY\}/g, String(now.getFullYear()).slice(-2))
      .replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, "0"))
      .replace(/\{DD\}/g, String(now.getDate()).padStart(2, "0"));
  };

  const preview = (kind: NumberingKindUi) => {
    const k = config?.[kind];
    if (!k) return "—";
    const prefix = String(k.prefix || "");
    const padded = "1".padStart(Math.max(Number(k.padding) || 4, 1), "0");
    const base = expand(prefix);
    return prefix.includes("{SEQ}") ? base.replace(/\{SEQ\}/g, padded) : `${base}${padded}`;
  };

  const normalizeConfigForSave = (current: any) => {
    const next = { ...(current || {}) };
    for (const [k] of kinds) {
      const item = next[k];
      if (!item?.prefix) continue;
      next[k] = {
        ...item,
        prefix: normalizeLegacyPrefix(String(item.prefix), k),
      };
    }
    return next;
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const normalized = normalizeConfigForSave(config);
      const wasNormalized = JSON.stringify(normalized) !== JSON.stringify(config);
      setConfig(normalized);
      await api.orgs.saveNumbering(orgId, normalized);
      if (wasNormalized) {
        push("success", t("تم تحويل XXXX تلقائياً إلى المتغير المناسب وحفظ الإعدادات", "Automatically converted XXXX to the appropriate token and saved settings"));
      } else {
        push("success", t("تم حفظ إعدادات الترقيم", "Numbering settings saved"));
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Do not use XXXX") || msg.includes("Unsupported token")) {
        push("error", t("صيغة البادئة غير صحيحة. استخدم المتغيرات: {ENTITY} {CLIENT} {VENDOR} {PROJECT} {DOC} {YYYY} {YY} {MM} {DD} {SEQ}", "Invalid prefix format. Use the tokens: {ENTITY} {CLIENT} {VENDOR} {PROJECT} {DOC} {YYYY} {YY} {MM} {DD} {SEQ}"));
      } else {
        push("error", e?.message || t("فشل الحفظ", "Save failed"));
      }
    } finally { setBusy(false); }
  };

  if (loading) return <Card className="border-border"><CardContent className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></CardContent></Card>;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t("الترقيم التلقائي للمستندات", "Automatic document numbering")}</CardTitle>
        <CardDescription className="leading-7">
          {t("المتغيرات المدعومة", "Supported tokens")}: <code className="font-english bg-gray-100 px-1 rounded">{"{ENTITY}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{CLIENT}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{VENDOR}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{PROJECT}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{DOC}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{YYYY}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{YY}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{MM}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{DD}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{SEQ}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium border-b pb-2">
          <div className="col-span-3">{t("النوع", "Type")}</div>
          <div className="col-span-5">{t("البادئة", "Prefix")}</div>
          <div className="col-span-2 text-center">{t("عدد الأرقام", "Digits")}</div>
          <div className="col-span-2">{t("معاينة", "Preview")}</div>
        </div>
        {kinds.map(([k, label]) => (
          <div key={k} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3 text-sm text-foreground">{label}</div>
            <div className="col-span-5 space-y-1">
              <Input
                className="font-english"
                dir="ltr"
                value={config?.[k]?.prefix || ""}
                onChange={(e) => setConfig({ ...config, [k]: { ...config[k], prefix: e.target.value } })}
                onBlur={(e) => {
                  const normalized = normalizeLegacyPrefix(e.target.value, k);
                  if (normalized === e.target.value) return;
                  setConfig((prev: any) => ({ ...prev, [k]: { ...prev[k], prefix: normalized } }));
                  push("success", t(`تم تحويل XXXX تلقائياً إلى ${tokenHintByKind[k]}`, `Automatically converted XXXX to ${tokenHintByKind[k]}`));
                }}
              />
              <p className="text-[11px] text-muted-foreground font-english" dir="ltr">
                Tip: use {tokenHintByKind[k]} instead of XXXX
              </p>
            </div>
            <Input
              className="col-span-2 font-english text-center"
              type="number"
              min="1"
              max="10"
              dir="ltr"
              value={config?.[k]?.padding || 4}
              onChange={(e) => setConfig({ ...config, [k]: { ...config[k], padding: Number(e.target.value) } })}
            />
            <div className="col-span-2 font-english text-xs text-primary" dir="ltr">{preview(k)}</div>
          </div>
        ))}
        <Button onClick={handleSave} disabled={busy} className="bg-primary hover:bg-primary/90 mt-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> {t("حفظ", "Save")}</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── PAYMENTS TAB ───────────────────────────────────────────────────────────
function PaymentsTab({ org, setOrg, push }: { org: Org; setOrg: (o: Org) => void; push: (kind: any, msg: string) => void }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<any>((org as any).paymentSettings || {
    stripe: { enabled: false, publishableKey: "", secretKey: "" },
    paypal: { enabled: false, clientId: "", clientSecret: "", mode: "live" },
    moyasar: { enabled: false, publishableKey: "", secretKey: "" },
    tamara: { enabled: false, publicKey: "", token: "" },
    tabby: { enabled: false, publicKey: "", secretKey: "" },
  });
  const [busy, setBusy] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<any>(null);

  // Pull connection state · runs once + after returning from OAuth callback
  useEffect(() => {
    (api as any).oauth?.status?.(org.id).then(setOauthStatus).catch(() => {});
    // ?oauth=stripe&status=success on return URL · refresh org + show toast
    const url = new URL(window.location.href);
    const oauth = url.searchParams.get("oauth");
    const status = url.searchParams.get("status");
    if (oauth && status) {
      const reason = url.searchParams.get("reason");
      if (status === "success") {
        push("success", t(`تم ربط ${oauth === "stripe" ? "Stripe" : "PayPal"} بنجاح`, `${oauth === "stripe" ? "Stripe" : "PayPal"} connected successfully`));
        api.orgs.get(org.id).then(setOrg).catch(() => {});
      } else {
        push("error", t(`فشل ربط ${oauth}: ${reason || "خطأ غير معروف"}`, `Failed to connect ${oauth}: ${reason || "unknown error"}`));
      }
      url.searchParams.delete("oauth");
      url.searchParams.delete("status");
      url.searchParams.delete("reason");
      url.searchParams.delete("account");
      url.searchParams.delete("merchant");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  const connectStripe = () => {
    if (!oauthStatus?.stripe?.connectConfigured) {
      push("error", t("Stripe Connect غير مهيأ في الخادم · أضف STRIPE_CLIENT_ID إذا تريد OAuth onboarding", "Stripe Connect is not configured on the server. Add STRIPE_CLIENT_ID if you want OAuth onboarding."));
      return;
    }
    window.location.href = (api as any).oauth.startUrl("stripe", org.id);
  };
  const connectPayPal = () => {
    if (!oauthStatus?.paypal?.connectConfigured) {
      push("error", t("PayPal غير مهيأ في الخادم · أضف PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET", "PayPal is not configured on the server. Add PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET."));
      return;
    }
    window.location.href = (api as any).oauth.startUrl("paypal", org.id);
  };
  const disconnectStripe = async () => {
    setBusy(true);
    try {
      await (api as any).oauth.disconnectStripe(org.id);
      push("success", t("تم فصل Stripe", "Stripe disconnected"));
      const updated = await api.orgs.get(org.id);
      setOrg(updated);
      const next = await (api as any).oauth.status(org.id);
      setOauthStatus(next);
    } catch (e: any) {
      push("error", e?.message || t("فشل الفصل", "Disconnect failed"));
    } finally { setBusy(false); }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const updated = await api.orgs.update(org.id, { paymentSettings: settings } as any);
      setOrg(updated);
      push("success", t("تم حفظ بوابات الدفع", "Payment gateways saved"));
    } catch (e: any) {
      push("error", e?.message || t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const Provider = ({ name, label, fields }: { name: string; label: string; fields: Array<[string, string, "text" | "secret"]> }) => (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-foreground font-medium">{label}</div>
          <div className="text-xs text-muted-foreground/60">{settings[name]?.enabled ? t("مفعّل", "Enabled") : t("غير مفعّل", "Disabled")}</div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!settings[name]?.enabled}
            onChange={(e) => setSettings({ ...settings, [name]: { ...settings[name], enabled: e.target.checked } })} />
          {t("تفعيل", "Enable")}
        </label>
      </div>
      {settings[name]?.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/50">
          {fields.map(([fk, fl, ft]) => (
            <div key={fk}>
              <Label className="text-xs">{fl}</Label>
              <Input className="font-english" dir="ltr" type={ft === "secret" && !showSecrets ? "password" : "text"}
                value={settings[name]?.[fk] || ""}
                onChange={(e) => setSettings({ ...settings, [name]: { ...settings[name], [fk]: e.target.value } })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t("بوابات الدفع", "Payment gateways")}</CardTitle>
        <CardDescription>{t("روابط دفع للفواتير · USD/SAR", "Invoice payment links · USD/SAR")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* ── Stripe · OAuth Connect (recommended) ─────────────────────── */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-foreground font-medium flex items-center gap-2">
                💳 Stripe
                {oauthStatus?.stripe?.connected && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    {oauthStatus?.stripe?.source === "server" ? t("مفعّل من الخادم", "Active on server") : t("مربوط", "Connected")}
                  </span>
                )}
                {oauthStatus && !oauthStatus?.stripe?.configured && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{t("يحتاج إعداد بالخادم", "Server setup required")}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">
                {oauthStatus?.stripe?.connected
                  ? <>{t("الحساب", "Account")}: <span className="font-english">{oauthStatus.stripe.accountId}</span> · {oauthStatus.stripe.mode} · {oauthStatus.stripe.source}</>
                  : t("بطاقات ائتمانية عالمية · USD/EUR/SAR · لا حاجة لنسخ المفاتيح", "Global cards · USD/EUR/SAR · no customer-side key paste required")}
              </div>
            </div>
            {oauthStatus?.stripe?.connected && oauthStatus?.stripe?.source === "oauth" ? (
              <Button onClick={disconnectStripe} disabled={busy} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("فصل", "Disconnect")}
              </Button>
            ) : oauthStatus?.stripe?.connected ? (
              <span className="text-xs text-muted-foreground">{t("يُدار من إعدادات الخادم/Stripe", "Managed from server/Stripe settings")}</span>
            ) : (
              <Button onClick={connectStripe} disabled={!oauthStatus?.stripe?.connectConfigured} className="bg-[#635BFF] hover:bg-[#4F47CC] text-white">
                <ExternalLink className="h-4 w-4 me-2" /> {t("ربط Stripe", "Connect Stripe")}
              </Button>
            )}
          </div>
        </div>

        {/* ── PayPal · Partner Referrals OAuth ─────────────────────────── */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-foreground font-medium flex items-center gap-2">
                🅿️ PayPal
                {oauthStatus?.paypal?.connected && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    {oauthStatus?.paypal?.source === "server" ? t("مفعّل من الخادم", "Active on server") : t("مربوط", "Connected")}
                  </span>
                )}
                {oauthStatus && !oauthStatus?.paypal?.configured && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{t("يحتاج إعداد بالخادم", "Server setup required")}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">
                {oauthStatus?.paypal?.connected
                  ? <>{t("التاجر", "Merchant")}: <span className="font-english">{oauthStatus.paypal.merchantId}</span> · {oauthStatus.paypal.mode} · {oauthStatus.paypal.source}</>
                  : t("محفظة PayPal · بطاقات + رصيد PayPal", "PayPal wallet · cards + PayPal balance")}
              </div>
            </div>
            {oauthStatus?.paypal?.connected ? (
              <span className="text-xs text-muted-foreground">{t("للفصل: استخدم لوحة PayPal أو إعدادات الخادم", "To disconnect: use PayPal dashboard or server settings")}</span>
            ) : (
              <Button onClick={connectPayPal} disabled={!oauthStatus?.paypal?.connectConfigured} className="bg-[#003087] hover:bg-[#001E5F] text-white">
                <ExternalLink className="h-4 w-4 me-2" /> {t("ربط PayPal", "Connect PayPal")}
              </Button>
            )}
          </div>
        </div>

        {/* ── Moyasar / Tamara / Tabby · Manual paste (no OAuth) ────────── */}
        <div className="text-xs text-muted-foreground mt-2">
          {t("البوابات السعودية تتطلب نسخ المفتاح يدوياً (لا يوجد OAuth):", "Saudi gateways require manual key entry:")}
        </div>
        <Provider name="moyasar" label={t("🟢 Moyasar (السعودية · SAR · مدى/Apple Pay)", "🟢 Moyasar (Saudi Arabia · SAR · Mada/Apple Pay)")} fields={[
          ["publishableKey", "Publishable Key (pk_live_...)", "text"],
          ["secretKey", "Secret Key (sk_live_...)", "secret"],
        ]} />

        {/* ── Advanced: paste Stripe/PayPal manually (legacy / dev mode) ─ */}
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-muted-foreground underline mt-2">
          {showAdvanced ? t("إخفاء", "Hide") : t("إظهار", "Show")} {t("الإعدادات المتقدمة (نسخ المفاتيح يدوياً · للمطورين)", "advanced settings (manual keys · developers)")}
        </button>
        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showSecrets} onChange={(e) => setShowSecrets(e.target.checked)} />
              {t("إظهار المفاتيح السرية", "Show secret keys")}
            </label>
            <Provider name="stripe" label={t("💳 Stripe (نسخ يدوي)", "💳 Stripe (manual paste)")} fields={[
              ["publishableKey", "Publishable Key (pk_live_...)", "text"],
              ["secretKey", "Secret Key (sk_live_...)", "secret"],
            ]} />
            <Provider name="paypal" label={t("🅿️ PayPal (نسخ يدوي)", "🅿️ PayPal (manual paste)")} fields={[
              ["clientId", "Client ID", "text"],
              ["clientSecret", "Client Secret", "secret"],
              ["mode", t("البيئة (live | sandbox)", "Mode (live | sandbox)"), "text"],
            ]} />
            <Provider name="tamara" label={t("🛍️ Tamara (تقسيط)", "🛍️ Tamara (installments)")} fields={[
              ["publicKey", "Public Key", "text"],
              ["token", "API Token", "secret"],
            ]} />
            <Provider name="tabby" label={t("🛒 Tabby (تقسيط)", "🛒 Tabby (installments)")} fields={[
              ["publicKey", "Public Key", "text"],
              ["secretKey", "Secret Key", "secret"],
            ]} />
          </div>
        )}

        <Button onClick={handleSave} disabled={busy} className="bg-primary hover:bg-primary/90 mt-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> {t("حفظ المفاتيح اليدوية", "Save manual keys")}</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── CATALOG TAB ────────────────────────────────────────────────────────────
function CatalogTab({ push }: { push: (kind: any, msg: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [industries, setIndustries] = useState<any[]>([]);
  const [pendingSeed, setPendingSeed] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    (api as any).products.categories?.().then(setStats).catch(() => {});
    (api as any).products.industryCatalogs?.()
      .then((r: any) => setIndustries(r.items || []))
      .catch(() => {});
  }, []);

  const seedIndustry = async (industryId: string) => {
    setPendingSeed(null);
    setBusy(industryId);
    try {
      const result: any = await (api as any).products.seedIndustry(industryId);
      push("success", t(`${result?.catalog?.icon || ""} تمت إضافة ${result?.created || 0} منتج · تخطي ${result?.skipped || 0}`, `${result?.catalog?.icon || ""} Added ${result?.created || 0} products · skipped ${result?.skipped || 0}`));
      const s = await (api as any).products.categories?.();
      setStats(s);
    } catch (e: any) {
      push("error", e?.message || t("فشل", "Failed"));
    } finally { setBusy(null); }
  };

  const seedEnsidexCatalog = async () => {
    setPendingSeed(null);
    setBusy("ensidex");
    try {
      const result: any = await (api as any).products.seedEnsidexCatalog?.();
      push("success", t(`تمت إضافة ${result?.created || 0} منتج`, `Added ${result?.created || 0} products`));
      const s = await (api as any).products.categories?.();
      setStats(s);
    } catch (e: any) {
      push("error", e?.message || t("فشل", "Failed"));
    } finally { setBusy(null); }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t("كتالوج المنتجات", "Product catalog")}</CardTitle>
        <CardDescription>{t("اختر قطاعك واحصل على كتالوج جاهز · أو اعتمد كتالوج ENSIDEX الداخلي", "Choose your sector and get a ready catalog · or adopt the internal ENSIDEX catalog")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">{t("اختر قطاع شركتك", "Choose your company sector")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {industries.map((ind) => (
              <div key={ind.id} className="rounded-lg border border-border p-4 hover:border-[#1276E3] transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{ind.icon}</span>
                      <div>
                        <div className="text-foreground font-medium">{ind.nameAr}</div>
                        <div className="text-xs text-muted-foreground/60 font-english" dir="ltr">{ind.name}</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{ind.description}</p>
                  </div>
                  <span className="text-xs text-primary bg-primary/5 px-2 py-0.5 rounded font-english" dir="ltr">{ind.productCount}</span>
                </div>
                <Button onClick={() => setPendingSeed(ind.id)} disabled={busy === ind.id}
                  variant="outline" className="w-full mt-3 border-border hover:bg-primary/5">
                  {busy === ind.id ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                  {t("زرع", "Seed")}
                </Button>
                {pendingSeed === ind.id && (
                  <div className="mt-2">
                    <InlineConfirm
                      label={t("إضافة منتجات قطاع جديدة؟", "Add new sector products?")}
                      onConfirm={() => seedIndustry(ind.id)}
                      onCancel={() => setPendingSeed(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-foreground font-medium">{t("كتالوج ENSIDEX الداخلي", "Internal ENSIDEX catalog")}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("فقط للمنشآت الداخلية المصرح لها · 50+ منتج وخدمة", "For authorized internal organizations only · 50+ products and services")}
              </p>
              <Button onClick={() => setPendingSeed("ensidex")} disabled={busy === "ensidex"} className="bg-amber-600 hover:bg-amber-700 text-white mt-3">
                {busy === "ensidex" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Sparkles className="h-4 w-4 me-2" />}
                {t("زرع كتالوج ENSIDEX", "Seed ENSIDEX catalog")}
              </Button>
              {pendingSeed === "ensidex" && (
                <div className="mt-2">
                  <InlineConfirm
                    label={t("زرع كتالوج ENSIDEX؟", "Seed ENSIDEX catalog?")}
                    onConfirm={seedEnsidexCatalog}
                    onCancel={() => setPendingSeed(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {stats && stats.categories && stats.categories.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium text-foreground mb-3">{t("الفئات الحالية", "Current categories")}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {stats.categories.map((c: any) => (
                <div key={c.category} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                  <span className="text-foreground font-english" dir="ltr">{c.category}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-english" dir="ltr">{c.count}</span> {t("منتج", "products")} · <span className="font-english" dir="ltr">{Number(c.totalValue || 0).toLocaleString()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── MEMBERS TAB ─────────────────────────────────────────────────────────────
function MembersTab({ orgId, initialMembers, setMembers, push }: { orgId: string; initialMembers: any[]; setMembers: (m: any[]) => void; push: any }) {
  const [members, setLocal] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "ADMIN" | "ACCOUNTANT" | "VIEWER">("ACCOUNTANT");
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      const r = await api.orgs.inviteMember(orgId, { email: inviteEmail.trim(), role: inviteRole });
      if (r.pending) {
        setInviteUrl(r.inviteUrl || null);
        push("info", t(`${r.message} · انسخ الرابط أدناه`, `${r.message} · copy the link below`));
      } else {
        const next = [r.member, ...members];
        setLocal(next); setMembers(next);
        push("success", t(`تمت الدعوة · ${inviteEmail}`, `Invited · ${inviteEmail}`));
      }
      setInviteEmail("");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : t("فشلت الدعوة", "Invite failed"));
    } finally { setBusy(false); }
  };

  const handleRoleChange = async (memberId: string, role: any) => {
    try {
      await api.orgs.updateMemberRole(orgId, memberId, role);
      const next = members.map(m => m.id === memberId ? { ...m, role } : m);
      setLocal(next); setMembers(next);
      push("success", t("تم التحديث", "Updated"));
    } catch (e: any) { push("error", e?.message || t("فشل", "Failed")); }
  };

  const handleRemove = async (memberId: string) => {
    setPendingRemove(null);
    try {
      await api.orgs.removeMember(orgId, memberId);
      const next = members.filter(m => m.id !== memberId);
      setLocal(next); setMembers(next);
      push("success", t("تم الحذف", "Deleted"));
    } catch (e: any) { push("error", e?.message || t("فشل", "Failed")); }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground"><Users className="h-5 w-5" /> {t("أعضاء الفريق", "Team members")}</CardTitle>
        <CardDescription>{members.length} {t("عضو · يمكنك دعوة محاسبين، مدراء، مشاهدين", "members · you can invite accountants, managers, viewers")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end p-3 bg-muted rounded-lg">
          <div className="flex-1">
            <Label className="text-xs">{t("البريد الإلكتروني", "Email")}</Label>
            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com" dir="ltr" className="font-english" />
          </div>
          <div>
            <Label className="text-xs">{t("الدور", "Role")}</Label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
              <option value="OWNER">{t("مالك", "Owner")}</option>
              <option value="ADMIN">{t("مدير", "Admin")}</option>
              <option value="ACCOUNTANT">{t("محاسب", "Accountant")}</option>
              <option value="VIEWER">{t("مشاهد", "Viewer")}</option>
            </select>
          </div>
          <Button onClick={handleInvite} disabled={busy || !inviteEmail.trim()} className="bg-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("دعوة", "Invite")}
          </Button>
        </div>

        {inviteUrl && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs">
            <div className="font-medium text-amber-700 mb-1">{t("المستخدم لم يُسجَّل بعد · انسخ الرابط وأرسله له:", "The user is not registered yet · copy the link and send it to them:")}</div>
            <div className="flex items-center gap-2">
              <input value={inviteUrl} readOnly className="flex-1 text-xs px-2 py-1 rounded border border-border font-english" dir="ltr" />
              <button onClick={() => { navigator.clipboard.writeText(inviteUrl); push("success", t("تم النسخ", "Copied")); }} className="text-xs text-primary hover:underline">{t("نسخ", "Copy")}</button>
              <button onClick={() => setInviteUrl(null)} className="text-xs text-muted-foreground hover:underline">{t("إخفاء", "Hide")}</button>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
            <th className="py-3 px-4 text-start font-medium">{t("الاسم", "Name")}</th>
            <th className="py-3 px-4 text-start font-medium">{t("البريد", "Email")}</th>
            <th className="py-3 px-4 text-start font-medium">{t("الدور", "Role")}</th>
            <th className="py-3 px-4 text-start font-medium">{t("منذ", "Since")}</th>
            <th className="py-3 px-4"></th>
          </tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-border/50">
                <td className="py-3 px-4 text-sm text-foreground">{m.user.name || "—"}</td>
                <td className="py-3 px-4 font-english text-sm text-foreground/80" dir="ltr">{m.user.email}</td>
                <td className="py-3 px-4">
                  <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="text-xs rounded border border-border px-2 py-1 bg-white">
                    <option value="OWNER">{t("مالك", "Owner")}</option>
                    <option value="ADMIN">{t("مدير", "Admin")}</option>
                    <option value="ACCOUNTANT">{t("محاسب", "Accountant")}</option>
                    <option value="VIEWER">{t("مشاهد", "Viewer")}</option>
                  </select>
                </td>
                <td className="py-3 px-4 font-english text-xs text-muted-foreground" dir="ltr">{m.createdAt?.slice(0, 10)}</td>
                <td className="py-3 px-4 text-end">
                  {pendingRemove === m.id ? (
                    <InlineConfirm
                      label={t("حذف العضو؟", "Remove member?")}
                      onConfirm={() => handleRemove(m.id)}
                      onCancel={() => setPendingRemove(null)}
                    />
                  ) : (
                    <button onClick={() => setPendingRemove(m.id)} className="text-xs text-red-600 hover:underline">{t("حذف", "Delete")}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── ZATCA TAB ───────────────────────────────────────────────────────────────
function ZatcaTab({ org, push }: { org: Org; push: any }) {
  const [csid, setCsid] = useState((org as any).zatcaCsid || "");
  const [csidSecret, setCsidSecret] = useState((org as any).zatcaCsidSecret || "");
  const [mode, setMode] = useState<"sandbox" | "simulation" | "production">((org as any).zatcaMode || "sandbox");
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    api.zatca.status().then(setStatus).catch(() => {});
  }, []);

  const handleOnboard = async () => {
    if (!csid.trim() || !csidSecret.trim()) { push("error", t("أدخل CSID والمفتاح السري", "Enter CSID and the secret key")); return; }
    setBusy(true);
    try {
      await api.zatca.onboard({ csid: csid.trim(), csidSecret: csidSecret.trim(), mode });
      push("success", t("تم الحفظ · ZATCA Phase 2 مفعّل", "Saved · ZATCA Phase 2 enabled"));
      const s = await api.zatca.status();
      setStatus(s);
    } catch (e: any) {
      push("error", e?.message || t("فشل", "Failed"));
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">📋 {t("ZATCA Phase 2 · الفوترة الإلكترونية", "ZATCA Phase 2 · e-invoicing")}</CardTitle>
        <CardDescription>{t("تكامل مع هيئة الزكاة والضريبة والجمارك (السعودية) · UUID + QR + XML + CSID", "Integration with the Zakat, Tax and Customs Authority (Saudi Arabia) · UUID + QR + XML + CSID")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status && (
          <div className={`rounded-lg border p-4 ${status.ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-medium ${status.ready ? "text-green-700" : "text-amber-700"}`}>
                  {status.ready ? t("✅ جاهز للترحيل", "✅ Ready to clear") : t("⚠️ يحتاج إعداد", "⚠️ Needs setup")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{status.nextActions}</div>
              </div>
              <div className="text-end text-xs text-muted-foreground">
                <div>{t("الفواتير المُرحَّلة", "Cleared invoices")}: <span className="font-english font-bold" dir="ltr">{status.invoicesProcessed || 0}</span></div>
                <div>ICV: <span className="font-english" dir="ltr">{status.icv || 0}</span></div>
                <div>{t("الوضع", "Mode")}: {status.mode}</div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs">
          <div className="font-medium text-foreground mb-2">{t("📚 خطوات الحصول على CSID:", "📚 Steps to obtain CSID:")}</div>
          <ol className="space-y-1 text-foreground/80 list-decimal list-inside">
            <li>{t("سجّل دخول في", "Sign in at")} <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noreferrer" className="text-primary hover:underline">fatoora.zatca.gov.sa</a> {t("بهوية المنشأة", "with your establishment ID")}</li>
            <li>{t("اختر \"إصدار CSID\" (Compliance / Cryptographic Stamp ID)", "Choose \"Issue CSID\" (Compliance / Cryptographic Stamp ID)")}</li>
            <li>{t("سيُصدر لك ملفان:", "It will issue two files:")} <code className="bg-white px-1 rounded">CSID Token</code> + <code className="bg-white px-1 rounded">Secret</code></li>
            <li>{t("الصقهما هنا واحفظ", "Paste them here and save")}</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">CSID Token</Label>
            <Input value={csid} onChange={(e) => setCsid(e.target.value)} dir="ltr" className="font-english" placeholder={t("base64 token من ZATCA", "base64 token from ZATCA")} />
          </div>
          <div>
            <Label className="text-xs">{t("الوضع", "Mode")}</Label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
              <option value="sandbox">{t("Sandbox (تجريبي)", "Sandbox (test)")}</option>
              <option value="simulation">Simulation</option>
              <option value="production">{t("Production (إنتاج)", "Production (live)")}</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">CSID Secret</Label>
            <Input type="password" value={csidSecret} onChange={(e) => setCsidSecret(e.target.value)} dir="ltr" className="font-english" placeholder="secret token من ZATCA" />
          </div>
        </div>

        <Button onClick={handleOnboard} disabled={busy} className="bg-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ وتفعيل", "Save and activate")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── BRANDING TAB ────────────────────────────────────────────────────────────
function BrandingTab({ org, setOrg, push }: { org: Org; setOrg: (o: Org) => void; push: any }) {
  const [primaryColor, setPrimaryColor] = useState(((org as any).brandingSettings || {}).primaryColor || "#1276E3");
  const [accentColor, setAccentColor] = useState(((org as any).brandingSettings || {}).accentColor || "#0B1B49");
  const [fontFamily, setFontFamily] = useState(((org as any).brandingSettings || {}).fontFamily || "Tajawal");
  const [logoUrl, setLogoUrl] = useState((org as any).logoUrl || "");
  const [printLogoUrl, setPrintLogoUrl] = useState((org as any).printLogoUrl || "");
  const [stampUrl, setStampUrl] = useState((org as any).stampUrl || "");
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();

  const upload = (kind: "logoUrl" | "printLogoUrl" | "stampUrl") => async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { push("error", t("الحد الأقصى 2 ميجا", "Max 2 MB")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (kind === "logoUrl") setLogoUrl(url);
      else if (kind === "printLogoUrl") setPrintLogoUrl(url);
      else setStampUrl(url);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const updated = await api.orgs.update(org.id, {
        logoUrl: logoUrl || null,
        printLogoUrl: printLogoUrl || null,
        stampUrl: stampUrl || null,
      } as any);
      setOrg(updated);
      push("success", t("تم الحفظ", "Saved"));
    } catch (e: any) {
      push("error", e?.message || t("فشل", "Failed"));
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t("العلامة التجارية", "Branding")}</CardTitle>
        <CardDescription>{t("الشعار · الختم · الألوان · الخط · تنعكس على الفواتير، السندات، العقود", "Logo · Stamp · Colors · Font · reflected on invoices, vouchers, contracts")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-2 block">{t("الشعار · Avatar (يظهر في الواجهة)", "Logo · Avatar (shown in the UI)")}</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input type="file" id="brand-logo" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("logoUrl")(f); }} />
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="logo" className="max-w-[120px] max-h-[80px] object-contain bg-white rounded" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="brand-logo" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                    <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-600 text-start hover:underline">{t("حذف", "Delete")}</button>
                  </div>
                </div>
              ) : (
                <label htmlFor="brand-logo" className="cursor-pointer block text-center py-4">
                  <div className="text-sm text-primary font-medium">{t("رفع شعار صغير", "Upload small logo")}</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">{t("يفضّل مربع · PNG/SVG · حتى 2MB", "Square preferred · PNG/SVG · up to 2MB")}</div>
                </label>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">{t("يظهر في الـ org switcher + الـ header", "Shown in the org switcher + the header")}</p>
          </div>
          <div>
            <Label className="text-xs mb-2 block">{t("شعار الطباعة · Print Logo (يظهر على الفواتير)", "Print Logo (shown on invoices)")}</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input type="file" id="brand-print-logo" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("printLogoUrl")(f); }} />
              {printLogoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={printLogoUrl} alt="print logo" className="max-w-[200px] max-h-[80px] object-contain bg-white rounded" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="brand-print-logo" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                    <button type="button" onClick={() => setPrintLogoUrl("")} className="text-xs text-red-600 text-start hover:underline">{t("حذف", "Delete")}</button>
                  </div>
                </div>
              ) : (
                <label htmlFor="brand-print-logo" className="cursor-pointer block text-center py-4">
                  <div className="text-sm text-primary font-medium">{t("رفع شعار للطباعة", "Upload print logo")}</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">{t("يفضّل أفقي بدقة عالية · PNG/SVG · حتى 2MB", "Horizontal high-res preferred · PNG/SVG · up to 2MB")}</div>
                </label>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">{t("يظهر على الفواتير · السندات · العقود · لو فاضي يستخدم الـ Avatar", "Shown on invoices · vouchers · contracts · if empty, the Avatar is used")}</p>
          </div>
          <div>
            <Label className="text-xs mb-2 block">{t("الختم الرسمي", "Official stamp")}</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input type="file" id="brand-stamp" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("stampUrl")(f); }} />
              {stampUrl ? (
                <div className="flex items-center gap-3">
                  <img src={stampUrl} alt="stamp" className="max-w-[120px] max-h-[80px] object-contain bg-white rounded" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="brand-stamp" className="text-xs text-primary hover:underline cursor-pointer">{t("تغيير", "Change")}</label>
                    <button type="button" onClick={() => setStampUrl("")} className="text-xs text-red-600 text-start hover:underline">{t("حذف", "Delete")}</button>
                  </div>
                </div>
              ) : (
                <label htmlFor="brand-stamp" className="cursor-pointer block text-center py-4">
                  <div className="text-sm text-primary font-medium">{t("رفع الختم", "Upload stamp")}</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">{t("PNG شفاف يفضّل · حتى 2MB", "Transparent PNG preferred · up to 2MB")}</div>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-2 block">{t("اللون الأساسي", "Primary color")}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-16 rounded border border-border" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} dir="ltr" className="font-english" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">{t("لون التميز", "Accent color")}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-16 rounded border border-border" />
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} dir="ltr" className="font-english" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">{t("الخط", "Font")}</Label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full text-sm rounded border border-border px-3 py-2 bg-white">
              <option value="Tajawal">Tajawal</option>
              <option value="Noto Sans Arabic">Noto Sans Arabic</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 bg-muted">
          <div className="text-xs text-muted-foreground mb-2">{t("معاينة", "Preview")}</div>
          <div className="bg-white rounded p-4 border" style={{ borderColor: primaryColor, fontFamily }}>
            <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: primaryColor }}>
              {logoUrl ? <img src={logoUrl} alt="" className="max-h-[40px]" /> : <div style={{ color: accentColor, fontWeight: 700 }}>{org.name}</div>}
              <div className="text-xs text-muted-foreground">{t("فاتورة", "Invoice")} · INV-2026-0001</div>
            </div>
            <div className="text-sm" style={{ color: accentColor }}>
              {t("العميل", "Customer")}: {t("عميل تجريبي", "Demo customer")}<br />
              {t("المبلغ", "Amount")}: <span style={{ color: primaryColor, fontWeight: 700 }}>1,150 SAR</span>
            </div>
            {stampUrl && <img src={stampUrl} className="mt-3 max-h-[60px] opacity-80" />}
          </div>
        </div>

        <Button onClick={handleSave} disabled={busy} className="bg-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> {t("حفظ", "Save")}</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── PLANS TAB ───────────────────────────────────────────────────────────────
function PlansTab({ org }: { org: Org }) {
  const isAdmin = (org as any).platformRole === "ADMIN";
  const { t } = useLanguage();
  const plans = [
    { id: "free", name: t("مجاني", "Free"), price: "$0", users: "2", invoices: t("20/شهر", "20/month"), ai: t("$5/شهر", "$5/month"), features: [t("حساب واحد", "One account"), t("فواتير أساسية", "Basic invoices"), t("تصدير PDF", "PDF export")] },
    { id: "pro", name: t("احترافي", "Pro"), price: t("$19/شهر", "$19/month"), users: "5", invoices: t("غير محدود", "Unlimited"), ai: t("$30/شهر", "$30/month"), features: [t("حسابات متعددة", "Multiple accounts"), "ZATCA", t("تكاملات بنكية", "Bank integrations"), "API access"], popular: true },
    { id: "business", name: t("أعمال", "Business"), price: t("$49/شهر", "$49/month"), users: "20", invoices: t("غير محدود", "Unlimited"), ai: t("$100/شهر", "$100/month"), features: [t("كل ميزات Pro", "All Pro features"), "AI advanced", t("متعدد العملات", "Multi-currency"), t("إغلاق سنوي", "Yearly closing"), "Audit log"] },
    { id: "enterprise", name: t("مؤسسات", "Enterprise"), price: t("تواصل معنا", "Contact us"), users: t("غير محدود", "Unlimited"), invoices: t("غير محدود", "Unlimited"), ai: t("غير محدود", "Unlimited"), features: ["SSO", "SLA", "Priority support", "Custom integrations", "Dedicated account manager"] },
  ];
  const adminPlan = { id: "admin", name: "ADMIN ULTRA", price: "FREE", users: "∞", invoices: "∞", ai: "∞", features: [t("جميع الميزات مفتوحة", "All features unlocked"), t("بدون حد على العملاء/الفواتير/AI", "No limit on customers/invoices/AI"), "Cross-org admin dashboard", t("متاح فقط لمشرفي المنصة", "Available to platform admins only")] };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t("الباقات والاشتراكات", "Plans & subscriptions")}</CardTitle>
        <CardDescription>{t("اختر الباقة المناسبة · يمكن الترقية أو التخفيض في أي وقت", "Choose the right plan · upgrade or downgrade at any time")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-amber-700 font-bold text-lg">⚡ {adminPlan.name}</div>
                <div className="text-xs text-amber-600">{t("باقة الادمن · مفعّلة تلقائياً لك", "Admin plan · auto-enabled for you")}</div>
              </div>
              <div className="text-end">
                <div className="font-english font-bold text-2xl text-amber-700" dir="ltr">{adminPlan.price}</div>
              </div>
            </div>
            <ul className="text-sm text-foreground/80 space-y-1">
              {adminPlan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2"><span className="text-green-600">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {plans.map(p => (
            <div key={p.id} className={`rounded-lg border p-4 ${p.popular ? "border-[#1276E3] ring-2 ring-[#1276E3]/30" : "border-border"} relative`}>
              {p.popular && <div className="absolute -top-2.5 right-3 bg-primary text-white text-xs px-2 py-0.5 rounded">{t("الأكثر شعبية", "Most popular")}</div>}
              <div className="text-foreground font-bold">{p.name}</div>
              <div className="text-2xl font-bold text-foreground mt-2 font-english" dir="ltr">{p.price}</div>
              <div className="text-xs text-muted-foreground mt-3 space-y-1">
                <div>👤 {p.users} {t("مستخدمين", "users")}</div>
                <div>📄 {p.invoices}</div>
                <div>🤖 AI: {p.ai}</div>
              </div>
              <ul className="text-xs text-foreground/80 mt-3 space-y-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1"><span className="text-green-600 mt-0.5">✓</span><span>{f}</span></li>
                ))}
              </ul>
              <Button className="w-full mt-4 bg-primary hover:bg-primary/90" disabled>
                {p.id === "enterprise" ? t("تواصل", "Contact") : t("اختيار", "Select")}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/60 text-center">
          {t("الفوترة عبر Stripe · اشتراك شهري قابل للإلغاء في أي وقت", "Billed via Stripe · monthly subscription, cancelable at any time")}
        </p>
      </CardContent>
    </Card>
  );
}
