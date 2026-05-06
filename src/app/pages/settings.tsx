/**
 * Settings · org info + members + auth · wired to /orgs · /orgs/:id/members
 */
import { useEffect, useState, useCallback } from "react";
import { Building2, Users, Loader2, Save, LogOut, Shield, Sparkles, Key, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, Org, AiBillingConfig, AiKeyMode } from "../lib/api";
import { authStore } from "../components/auth-store";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "مالك", ADMIN: "مدير", ACCOUNTANT: "محاسب", VIEWER: "مشاهد فقط",
};

const MODE_LABELS: Record<AiKeyMode, { label: string; price: string; alloc: string }> = {
  BYOK:            { label: "مفتاحي الخاص (BYOK)",   price: "$0",      alloc: "غير محدود" },
  HOSTED_FREE:     { label: "مجاني",                  price: "$0",      alloc: "$5/شهر" },
  HOSTED_PRO:      { label: "احترافي",                price: "$19/شهر", alloc: "$30/شهر" },
  HOSTED_BUSINESS: { label: "أعمال",                  price: "$49/شهر", alloc: "$100/شهر" },
  PAYG:            { label: "ادفع عند الاستخدام",     price: "$1.20 لكل $1",    alloc: "غير محدود" },
};

export function Settings() {
  const [tab, setTab] = useState<"company" | "members" | "account" | "branding" | "ai" | "numbering" | "payments" | "catalog" | "zatca" | "plans">("company");
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", legalName: "", country: "SA", baseCurrency: "SAR",
    vatNumber: "", crNumber: "", fiscalYearStart: 1, zatcaEnabled: false,
  });

  // AI Billing state
  const [aiConfig, setAiConfig] = useState<AiBillingConfig | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [byokKey, setByokKey] = useState("");
  const [byokProvider, setByokProvider] = useState<"openrouter" | "anthropic">("openrouter");
  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const orgs = await api.orgs.list();
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
      const active = (stored ? orgs.find(o => o.id === stored) : null) || orgs[0];
      if (!active) { setError("لا توجد شركة"); setLoading(false); return; }
      setOrg(active);
      setForm({
        name: active.name, legalName: active.legalName || "",
        country: active.country, baseCurrency: active.baseCurrency,
        vatNumber: active.vatNumber || "", crNumber: active.crNumber || "",
        fiscalYearStart: active.fiscalYearStart, zatcaEnabled: active.zatcaEnabled,
      });
      const m = await api.orgs.members(active.id);
      setMembers(m.members);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async () => {
    if (!org) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const updated = await api.orgs.update(org.id, {
        name: form.name, legalName: form.legalName || null,
        country: form.country, baseCurrency: form.baseCurrency,
        vatNumber: form.vatNumber || null, crNumber: form.crNumber || null,
        fiscalYearStart: form.fiscalYearStart, zatcaEnabled: form.zatcaEnabled,
      });
      setOrg(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل الحفظ"); }
    finally { setBusy(false); }
  };

  // ── AI Billing handlers ────────────────────────────────────────────────────
  const refreshAiConfig = useCallback(async () => {
    try {
      const c = await api.aiBilling.get();
      setAiConfig(c);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل تحميل إعدادات AI");
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
      push("success", `تم التحويل إلى ${MODE_LABELS[mode].label}`);
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل التحديث");
    } finally { setAiBusy(false); }
  };

  const handleSaveByok = async () => {
    if (!byokKey.trim() || byokKey.length < 20) {
      push("error", "المفتاح غير صحيح · يجب أن يبدأ بـ sk-");
      return;
    }
    setAiBusy(true);
    try {
      const c = await api.aiBilling.update({ mode: "BYOK", byokProvider, byokKey: byokKey.trim() });
      setAiConfig(c);
      setByokKey("");
      push("success", "تم حفظ المفتاح وتفعيل BYOK");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setAiBusy(false); }
  };

  const handleClearByok = async () => {
    setAiBusy(true);
    try {
      const c = await api.aiBilling.update({ clearByok: true, mode: "HOSTED_FREE" });
      setAiConfig(c);
      push("success", "تم حذف المفتاح · رجعت للباقة المجانية");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشل الحذف");
    } finally { setAiBusy(false); }
  };

  const handleSignOut = async () => {
    /* TODO-UX1: was confirm("هل تريد تسجيل الخروج؟") — replace with InlineConfirm */ 
await authStore.logout();
    window.location.href = "/login";
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الإعدادات</h1>
        <p className="text-[#6B7280] mt-1">{org?.name}</p>
      </div>

      <div className="flex gap-2 border-b border-[#E5E7EB] overflow-x-auto">
        {([["company", "بيانات الشركة"], ["numbering", "الترقيم"], ["zatca", "ZATCA · الفوترة الإلكترونية"], ["payments", "بوابات الدفع"], ["catalog", "كتالوج المنتجات"], ["members", "الفريق"], ["ai", "الذكاء الاصطناعي"], ["branding", "العلامة التجارية"], ["plans", "الباقات"], ["account", "حسابي"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === k ? "border-[#1276E3] text-[#1276E3] font-medium" : "border-transparent text-[#6B7280] hover:text-[#0B1B49]"}`}
          >{label}</button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">✅ تم الحفظ</div>}

      {tab === "company" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-[#0B1B49]"><Building2 className="h-5 w-5" /> بيانات الشركة</CardTitle><CardDescription>الاسم · الرقم الضريبي · العملة الأساسية</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>اسم الشركة *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-[#E5E7EB]" /></div>
              <div className="space-y-2"><Label>الاسم القانوني</Label>
                <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="ENSIDEX LLC" className="border-[#E5E7EB]" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>الدولة</Label>
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                  <option value="SA">السعودية</option><option value="AE">الإمارات</option><option value="KW">الكويت</option>
                  <option value="QA">قطر</option><option value="BH">البحرين</option><option value="OM">عُمان</option>
                  <option value="EG">مصر</option><option value="US">الولايات المتحدة</option><option value="GB">المملكة المتحدة</option>
                </select></div>
              <div className="space-y-2"><Label>العملة الأساسية</Label>
                <select value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                  <option value="SAR">SAR</option><option value="USD">USD</option><option value="AED">AED</option>
                  <option value="EUR">EUR</option><option value="GBP">GBP</option><option value="KWD">KWD</option>
                </select></div>
              <div className="space-y-2"><Label>بداية السنة المالية</Label>
                <Select value={String(form.fiscalYearStart)} onValueChange={(v) => setForm({ ...form, fiscalYearStart: Number(v) })}>
                  <SelectTrigger className="border-[#E5E7EB]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <SelectItem key={m} value={String(m)}>{["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][m-1]}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{form.country === "US" ? "EIN" : form.country === "AE" ? "TRN" : "الرقم الضريبي"}</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              <div className="space-y-2"><Label>{form.country === "US" ? "State Filing #" : "السجل التجاري"}</Label>
                <Input value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F4FCFF] border border-blue-100">
              <input type="checkbox" id="zatca" checked={form.zatcaEnabled} onChange={(e) => setForm({ ...form, zatcaEnabled: e.target.checked })} className="h-4 w-4" />
              <label htmlFor="zatca" className="text-sm text-[#0B1B49] cursor-pointer">تفعيل ZATCA Phase 2 e-invoicing (السوق السعودي · UUID + QR + XML)</label>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> حفظ التغييرات</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "members" && org && <MembersTab orgId={org.id} initialMembers={members} setMembers={setMembers} push={push} />}

      {tab === "ai" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B1B49]"><Sparkles className="h-5 w-5" /> الذكاء الاصطناعي · الاشتراك والمفتاح</CardTitle>
            <CardDescription>اختر الباقة · أو ضع مفتاحك الخاص (BYOK) · لا تكاليف إضافية علينا</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!aiConfig ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
            ) : (
              <>
                {/* Current usage bar */}
                <div className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F9FAFB]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>الباقة الحالية: {MODE_LABELS[aiConfig.mode].label}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">المخصص: {MODE_LABELS[aiConfig.mode].alloc} · السعر: {MODE_LABELS[aiConfig.mode].price}</p>
                    </div>
                    {aiConfig.disabled && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="h-3 w-3" /> معطّل من الإدارة
                      </span>
                    )}
                  </div>
                  {aiConfig.mode !== "BYOK" && aiConfig.mode !== "PAYG" && (
                    <>
                      <div className="flex items-center justify-between text-xs text-[#6B7280] mt-3 mb-1">
                        <span>المستخدَم: <span className="font-english text-[#0B1B49]">${Number(aiConfig.spentThisPeriod).toFixed(2)}</span></span>
                        <span className="font-english">${Number(aiConfig.monthlyAllocation).toFixed(2)} + ${Number(aiConfig.creditBalance).toFixed(2)} رصيد</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                        <div
                          className={`h-full transition-all ${aiConfig.percentUsed >= 1 ? "bg-red-500" : aiConfig.percentUsed >= 0.8 ? "bg-amber-500" : "bg-[#1276E3]"}`}
                          style={{ width: `${Math.min(aiConfig.percentUsed * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#9CA3AF] font-english mt-1">{(aiConfig.percentUsed * 100).toFixed(0)}% used</p>
                    </>
                  )}
                </div>

                {/* Mode selector */}
                <div>
                  <Label className="text-[#374151]">اختر الباقة</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {(Object.entries(MODE_LABELS) as [AiKeyMode, typeof MODE_LABELS[AiKeyMode]][]).map(([k, m]) => (
                      <button
                        key={k}
                        onClick={() => k !== "BYOK" && handleAiModeChange(k)}
                        disabled={aiBusy || aiConfig.mode === k || aiConfig.disabled}
                        className={`text-start rounded-lg border p-3 transition-all ${
                          aiConfig.mode === k
                            ? "border-[#1276E3] bg-[#F4FCFF]"
                            : "border-[#E5E7EB] hover:border-[#1276E3]/40 hover:bg-[#F9FAFB]"
                        } ${aiBusy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{m.label}</p>
                          {aiConfig.mode === k && <span className="text-xs text-[#1276E3]">✓ نشطة</span>}
                        </div>
                        <p className="text-xs text-[#6B7280] mt-1">{m.alloc} · <span className="font-english">{m.price}</span></p>
                        {k === "BYOK" && <p className="text-xs text-[#1276E3] mt-1">↓ ضع مفتاحك أدناه</p>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BYOK form */}
                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-[#1276E3]" />
                    <h3 className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>مفتاحي الخاص (BYOK)</h3>
                  </div>
                  <p className="text-xs text-[#6B7280] mb-3">
                    استخدم مفتاح OpenRouter أو Anthropic الخاص بك · لا تكاليف منا · المفتاح مشفّر بـAES-256-GCM في قاعدة البيانات
                  </p>

                  {aiConfig.byokKeyHint ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-md bg-[#F4FCFF] border border-blue-100 p-3">
                        <div>
                          <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>
                            المفتاح النشط: <span className="font-english">{aiConfig.byokKeyHint}</span>
                          </p>
                          <p className="text-xs text-[#6B7280] mt-0.5">المزود: {aiConfig.byokProvider}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={async () => {
                            try {
                              const r = await api.aiBilling.testKey();
                              if (r.ok) {
                                push("success", `✅ المفتاح يعمل · ${r.message || ""} (${r.elapsedMs}ms)`);
                              } else {
                                push("error", `❌ المفتاح لا يعمل: ${r.message || r.error || "مجهول"}`);
                              }
                            } catch (e: any) {
                              push("error", e?.message || "فشل الاختبار");
                            }
                          }} variant="outline" disabled={aiBusy} className="border-green-300 text-green-700 hover:bg-green-50">
                            اختبار الاتصال
                          </Button>
                          <Button onClick={handleClearByok} variant="outline" disabled={aiBusy} className="border-red-200 text-red-600 hover:bg-red-50">
                            حذف المفتاح
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-[#374151] text-xs">المزود</Label>
                        <select value={byokProvider} onChange={(e) => setByokProvider(e.target.value as any)} className="w-full mt-1 rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                          <option value="openrouter">OpenRouter (موصى به · أسعار أفضل)</option>
                          <option value="anthropic">Anthropic (مباشر)</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[#374151] text-xs">المفتاح</Label>
                        <Input
                          type="password"
                          value={byokKey}
                          onChange={(e) => setByokKey(e.target.value)}
                          dir="ltr"
                          placeholder="sk-or-v1-..."
                          className="font-english border-[#E5E7EB] mt-1"
                        />
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          احصل على مفتاح من <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-[#1276E3] hover:underline">openrouter.ai/keys</a>
                        </p>
                      </div>
                      <Button onClick={handleSaveByok} disabled={aiBusy || !byokKey} className="bg-[#1276E3] hover:bg-[#1060C0]">
                        {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ المفتاح وتفعيل BYOK"}
                      </Button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#6B7280]">
                  💡 يتم إعادة ضبط الاستهلاك تلقائياً كل 30 يوم · رصيد الـtop-up يضاف إلى المخصص الشهري
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "numbering" && org && <NumberingTab orgId={org.id} push={push} />}
      {tab === "payments" && org && <PaymentsTab org={org} setOrg={setOrg} push={push} />}
      {tab === "catalog" && org && <CatalogTab push={push} />}
      {tab === "zatca" && org && <ZatcaTab org={org} setOrg={setOrg} push={push} />}
      {tab === "branding" && org && <BrandingTab org={org} setOrg={setOrg} push={push} />}
      {tab === "plans" && org && <PlansTab org={org} setOrg={setOrg} push={push} />}

      {tab === "account" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-[#0B1B49]"><Shield className="h-5 w-5" /> حسابي</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-[#E5E7EB] p-4">
              <p className="text-sm text-[#6B7280]">جلسة آمنة · 30 يوم · مشفّرة بكوكي HttpOnly على <span className="font-english">.entix.io</span></p>
            </div>
            <Button onClick={handleSignOut} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4 me-2" /> تسجيل الخروج</Button>
          </CardContent>
        </Card>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// ── NUMBERING TAB ──────────────────────────────────────────────────────────
function NumberingTab({ orgId, push }: { orgId: string; push: (kind: any, msg: string) => void }) {
  const [config, setConfig] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.orgs.getNumbering(orgId)
      .then(setConfig)
      .catch(() => setConfig({ contact: { prefix: "CUST-", padding: 4 }, invoice: { prefix: "INV-{YYYY}-", padding: 4 }, quote: { prefix: "QT-{YYYY}-", padding: 4 }, bill: { prefix: "BILL-{YYYY}-", padding: 4 }, voucher: { prefix: "VCR-", padding: 4 } }))
      .finally(() => setLoading(false));
  }, [orgId]);

  const expand = (s: string) => {
    const now = new Date();
    return s.replace(/\{YYYY\}/g, String(now.getFullYear()))
      .replace(/\{YY\}/g, String(now.getFullYear()).slice(-2))
      .replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, "0"))
      .replace(/\{DD\}/g, String(now.getDate()).padStart(2, "0"));
  };

  const preview = (kind: string) => {
    const k = config?.[kind];
    if (!k) return "—";
    return `${expand(k.prefix || "")}${"1".padStart(k.padding || 4, "0")}`;
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await api.orgs.saveNumbering(orgId, config);
      push("success", "تم حفظ إعدادات الترقيم");
    } catch (e: any) {
      push("error", e?.message || "فشل الحفظ");
    } finally { setBusy(false); }
  };

  if (loading) return <Card className="border-[#E5E7EB]"><CardContent className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></CardContent></Card>;

  const kinds: Array<[string, string]> = [
    ["contact", "العملاء/الموردين"],
    ["invoice", "فواتير المبيعات"],
    ["quote", "عروض الأسعار"],
    ["bill", "فواتير المشتريات"],
    ["voucher", "السندات"],
  ];

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[#0B1B49]">الترقيم التلقائي للمستندات</CardTitle>
        <CardDescription>
          البادئة تدعم متغيرات: <code className="font-english bg-gray-100 px-1 rounded">{"{YYYY}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{YY}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{MM}"}</code>{" "}
          <code className="font-english bg-gray-100 px-1 rounded">{"{DD}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-xs text-[#6B7280] font-medium border-b pb-2">
          <div className="col-span-3">النوع</div>
          <div className="col-span-5">البادئة</div>
          <div className="col-span-2 text-center">عدد الأرقام</div>
          <div className="col-span-2">معاينة</div>
        </div>
        {kinds.map(([k, label]) => (
          <div key={k} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3 text-sm text-[#0B1B49]">{label}</div>
            <Input className="col-span-5 font-english" dir="ltr" value={config?.[k]?.prefix || ""}
              onChange={(e) => setConfig({ ...config, [k]: { ...config[k], prefix: e.target.value } })} />
            <Input className="col-span-2 font-english text-center" type="number" min="1" max="10" dir="ltr"
              value={config?.[k]?.padding || 4}
              onChange={(e) => setConfig({ ...config, [k]: { ...config[k], padding: Number(e.target.value) } })} />
            <div className="col-span-2 font-english text-xs text-[#1276E3]" dir="ltr">{preview(k)}</div>
          </div>
        ))}
        <Button onClick={handleSave} disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0] mt-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> حفظ</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── PAYMENTS TAB ───────────────────────────────────────────────────────────
function PaymentsTab({ org, setOrg, push }: { org: Org; setOrg: (o: Org) => void; push: (kind: any, msg: string) => void }) {
  const [settings, setSettings] = useState<any>((org as any).paymentSettings || {
    stripe: { enabled: false, publishableKey: "", secretKey: "" },
    paypal: { enabled: false, clientId: "", clientSecret: "", mode: "live" },
    moyasar: { enabled: false, publishableKey: "", secretKey: "" },
    tamara: { enabled: false, publicKey: "", token: "" },
    tabby: { enabled: false, publicKey: "", secretKey: "" },
  });
  const [busy, setBusy] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      const updated = await api.orgs.update(org.id, { paymentSettings: settings } as any);
      setOrg(updated);
      push("success", "تم حفظ بوابات الدفع");
    } catch (e: any) {
      push("error", e?.message || "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const Provider = ({ name, label, fields }: { name: string; label: string; fields: Array<[string, string, "text" | "secret"]> }) => (
    <div className="rounded-lg border border-[#E5E7EB] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#0B1B49] font-medium">{label}</div>
          <div className="text-xs text-[#9CA3AF]">{settings[name]?.enabled ? "✅ مفعّل" : "⚪ غير مفعّل"}</div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!settings[name]?.enabled}
            onChange={(e) => setSettings({ ...settings, [name]: { ...settings[name], enabled: e.target.checked } })} />
          تفعيل
        </label>
      </div>
      {settings[name]?.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#F3F4F6]">
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
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[#0B1B49]">بوابات الدفع</CardTitle>
        <CardDescription>روابط دفع للفواتير · USD/SAR</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-[#6B7280] cursor-pointer mb-2">
          <input type="checkbox" checked={showSecrets} onChange={(e) => setShowSecrets(e.target.checked)} />
          إظهار المفاتيح السرية
        </label>
        <Provider name="stripe" label="💳 Stripe (عالمي · USD/EUR)" fields={[
          ["publishableKey", "Publishable Key (pk_live_...)", "text"],
          ["secretKey", "Secret Key (sk_live_...)", "secret"],
        ]} />
        <Provider name="paypal" label="🅿️ PayPal" fields={[
          ["clientId", "Client ID", "text"],
          ["clientSecret", "Client Secret", "secret"],
          ["mode", "البيئة (live | sandbox)", "text"],
        ]} />
        <Provider name="moyasar" label="🟢 Moyasar (السعودية · SAR · مدى/Apple Pay)" fields={[
          ["publishableKey", "Publishable Key (pk_live_...)", "text"],
          ["secretKey", "Secret Key (sk_live_...)", "secret"],
        ]} />
        <Provider name="tamara" label="🛍️ Tamara (تقسيط)" fields={[
          ["publicKey", "Public Key", "text"],
          ["token", "API Token", "secret"],
        ]} />
        <Provider name="tabby" label="🛒 Tabby (تقسيط)" fields={[
          ["publicKey", "Public Key", "text"],
          ["secretKey", "Secret Key", "secret"],
        ]} />
        <Button onClick={handleSave} disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0] mt-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> حفظ</>}
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

  useEffect(() => {
    (api as any).products.categories?.().then(setStats).catch(() => {});
    (api as any).products.industryCatalogs?.()
      .then((r: any) => setIndustries(r.items || []))
      .catch(() => {});
  }, []);

  const seedIndustry = async (industryId: string) => {
    if (!confirm(`سيتم إضافة منتجات قطاع جديدة. هل أنت متأكد؟`)) return;
    setBusy(industryId);
    try {
      const result: any = await (api as any).products.seedIndustry(industryId);
      push("success", `${result?.catalog?.icon || ""} تمت إضافة ${result?.created || 0} منتج · تخطي ${result?.skipped || 0}`);
      const s = await (api as any).products.categories?.();
      setStats(s);
    } catch (e: any) {
      push("error", e?.message || "فشل");
    } finally { setBusy(null); }
  };

  const seedFc = async () => {
    if (!confirm("زرع كتالوج Falcon Core / ENSIDEX (50+ منتج). متابعة؟")) return;
    setBusy("fc");
    try {
      const result: any = await (api as any).products.seedFcCatalog?.();
      push("success", `تمت إضافة ${result?.created || 0} منتج`);
      const s = await (api as any).products.categories?.();
      setStats(s);
    } catch (e: any) {
      push("error", e?.message || "فشل");
    } finally { setBusy(null); }
  };

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[#0B1B49]">كتالوج المنتجات</CardTitle>
        <CardDescription>اختر قطاعك واحصل على كتالوج جاهز · أو اعتمد كتالوج FC</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="text-sm font-medium text-[#0B1B49] mb-3">اختر قطاع شركتك</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {industries.map((ind) => (
              <div key={ind.id} className="rounded-lg border border-[#E5E7EB] p-4 hover:border-[#1276E3] transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{ind.icon}</span>
                      <div>
                        <div className="text-[#0B1B49] font-medium">{ind.nameAr}</div>
                        <div className="text-xs text-[#9CA3AF] font-english" dir="ltr">{ind.name}</div>
                      </div>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">{ind.description}</p>
                  </div>
                  <span className="text-xs text-[#1276E3] bg-[#F4FCFF] px-2 py-0.5 rounded font-english" dir="ltr">{ind.productCount}</span>
                </div>
                <Button onClick={() => seedIndustry(ind.id)} disabled={busy === ind.id}
                  variant="outline" className="w-full mt-3 border-[#E5E7EB] hover:bg-[#F4FCFF]">
                  {busy === ind.id ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                  زرع
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-[#0B1B49] font-medium">كتالوج Falcon Core / ENSIDEX (للداخلية)</div>
              <p className="text-xs text-[#6B7280] mt-1">
                فقط لمنشأت Falcon Core أو ENSIDEX · 50+ منتج (FC-ADV/AI/BRD/CLD/CNT/ENT/LLC/PRM/WEB)
              </p>
              <Button onClick={seedFc} disabled={busy === "fc"} className="bg-amber-600 hover:bg-amber-700 text-white mt-3">
                {busy === "fc" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Sparkles className="h-4 w-4 me-2" />}
                زرع كتالوج FC
              </Button>
            </div>
          </div>
        </div>

        {stats && stats.categories && stats.categories.length > 0 && (
          <div className="rounded-lg border border-[#E5E7EB] p-4">
            <div className="text-sm font-medium text-[#0B1B49] mb-3">الفئات الحالية</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {stats.categories.map((c: any) => (
                <div key={c.category} className="flex items-center justify-between p-2 rounded bg-[#F9FAFB] text-sm">
                  <span className="text-[#0B1B49] font-english" dir="ltr">{c.category}</span>
                  <span className="text-xs text-[#6B7280]">
                    <span className="font-english" dir="ltr">{c.count}</span> منتج · <span className="font-english" dir="ltr">{Number(c.totalValue || 0).toLocaleString()}</span>
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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      const r = await api.orgs.inviteMember(orgId, { email: inviteEmail.trim(), role: inviteRole });
      if (r.pending) {
        setInviteUrl(r.inviteUrl || null);
        push("info", `${r.message} · انسخ الرابط أدناه`);
      } else {
        const next = [r.member, ...members];
        setLocal(next); setMembers(next);
        push("success", `تمت الدعوة · ${inviteEmail}`);
      }
      setInviteEmail("");
    } catch (e: any) {
      push("error", e instanceof ApiError ? e.message : "فشلت الدعوة");
    } finally { setBusy(false); }
  };

  const handleRoleChange = async (memberId: string, role: any) => {
    try {
      await api.orgs.updateMemberRole(orgId, memberId, role);
      const next = members.map(m => m.id === memberId ? { ...m, role } : m);
      setLocal(next); setMembers(next);
      push("success", "تم التحديث");
    } catch (e: any) { push("error", e?.message || "فشل"); }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("حذف العضو من الفريق؟")) return;
    try {
      await api.orgs.removeMember(orgId, memberId);
      const next = members.filter(m => m.id !== memberId);
      setLocal(next); setMembers(next);
      push("success", "تم الحذف");
    } catch (e: any) { push("error", e?.message || "فشل"); }
  };

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0B1B49]"><Users className="h-5 w-5" /> أعضاء الفريق</CardTitle>
        <CardDescription>{members.length} عضو · يمكنك دعوة محاسبين، مدراء، مشاهدين</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end p-3 bg-[#F9FAFB] rounded-lg">
          <div className="flex-1">
            <Label className="text-xs">البريد الإلكتروني</Label>
            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com" dir="ltr" className="font-english" />
          </div>
          <div>
            <Label className="text-xs">الدور</Label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full text-sm rounded border border-[#E5E7EB] px-3 py-2 bg-white">
              <option value="OWNER">مالك</option>
              <option value="ADMIN">مدير</option>
              <option value="ACCOUNTANT">محاسب</option>
              <option value="VIEWER">مشاهد</option>
            </select>
          </div>
          <Button onClick={handleInvite} disabled={busy || !inviteEmail.trim()} className="bg-[#1276E3]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "دعوة"}
          </Button>
        </div>

        {inviteUrl && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs">
            <div className="font-medium text-amber-700 mb-1">المستخدم لم يُسجَّل بعد · انسخ الرابط وأرسله له:</div>
            <div className="flex items-center gap-2">
              <input value={inviteUrl} readOnly className="flex-1 text-xs px-2 py-1 rounded border border-[#E5E7EB] font-english" dir="ltr" />
              <button onClick={() => { navigator.clipboard.writeText(inviteUrl); push("success", "تم النسخ"); }} className="text-xs text-[#1276E3] hover:underline">نسخ</button>
              <button onClick={() => setInviteUrl(null)} className="text-xs text-[#6B7280] hover:underline">إخفاء</button>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
            <th className="py-3 px-4 text-start font-medium">الاسم</th>
            <th className="py-3 px-4 text-start font-medium">البريد</th>
            <th className="py-3 px-4 text-start font-medium">الدور</th>
            <th className="py-3 px-4 text-start font-medium">منذ</th>
            <th className="py-3 px-4"></th>
          </tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-[#F3F4F6]">
                <td className="py-3 px-4 text-sm text-[#0B1B49]">{m.user.name || "—"}</td>
                <td className="py-3 px-4 font-english text-sm text-[#374151]" dir="ltr">{m.user.email}</td>
                <td className="py-3 px-4">
                  <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="text-xs rounded border border-[#E5E7EB] px-2 py-1 bg-white">
                    <option value="OWNER">مالك</option>
                    <option value="ADMIN">مدير</option>
                    <option value="ACCOUNTANT">محاسب</option>
                    <option value="VIEWER">مشاهد</option>
                  </select>
                </td>
                <td className="py-3 px-4 font-english text-xs text-[#6B7280]" dir="ltr">{m.createdAt?.slice(0, 10)}</td>
                <td className="py-3 px-4 text-end">
                  <button onClick={() => handleRemove(m.id)} className="text-xs text-red-600 hover:underline">حذف</button>
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
function ZatcaTab({ org, setOrg, push }: { org: Org; setOrg: (o: Org) => void; push: any }) {
  const [csid, setCsid] = useState((org as any).zatcaCsid || "");
  const [csidSecret, setCsidSecret] = useState((org as any).zatcaCsidSecret || "");
  const [mode, setMode] = useState<"sandbox" | "simulation" | "production">((org as any).zatcaMode || "sandbox");
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.zatca.status().then(setStatus).catch(() => {});
  }, []);

  const handleOnboard = async () => {
    if (!csid.trim() || !csidSecret.trim()) { push("error", "أدخل CSID والمفتاح السري"); return; }
    setBusy(true);
    try {
      await api.zatca.onboard({ csid: csid.trim(), csidSecret: csidSecret.trim(), mode });
      push("success", "تم الحفظ · ZATCA Phase 2 مفعّل");
      const s = await api.zatca.status();
      setStatus(s);
    } catch (e: any) {
      push("error", e?.message || "فشل");
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[#0B1B49] flex items-center gap-2">📋 ZATCA Phase 2 · الفوترة الإلكترونية</CardTitle>
        <CardDescription>تكامل مع هيئة الزكاة والضريبة والجمارك (السعودية) · UUID + QR + XML + CSID</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status && (
          <div className={`rounded-lg border p-4 ${status.ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-medium ${status.ready ? "text-green-700" : "text-amber-700"}`}>
                  {status.ready ? "✅ جاهز للترحيل" : "⚠️ يحتاج إعداد"}
                </div>
                <div className="text-xs text-[#6B7280] mt-1">{status.nextActions}</div>
              </div>
              <div className="text-end text-xs text-[#6B7280]">
                <div>الفواتير المُرحَّلة: <span className="font-english font-bold" dir="ltr">{status.invoicesProcessed || 0}</span></div>
                <div>ICV: <span className="font-english" dir="ltr">{status.icv || 0}</span></div>
                <div>الوضع: {status.mode}</div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs">
          <div className="font-medium text-[#0B1B49] mb-2">📚 خطوات الحصول على CSID:</div>
          <ol className="space-y-1 text-[#374151] list-decimal list-inside">
            <li>سجّل دخول في <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noreferrer" className="text-[#1276E3] hover:underline">fatoora.zatca.gov.sa</a> بهوية المنشأة</li>
            <li>اختر "إصدار CSID" (Compliance / Cryptographic Stamp ID)</li>
            <li>سيُصدر لك ملفان: <code className="bg-white px-1 rounded">CSID Token</code> + <code className="bg-white px-1 rounded">Secret</code></li>
            <li>الصقهما هنا واحفظ</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">CSID Token</Label>
            <Input value={csid} onChange={(e) => setCsid(e.target.value)} dir="ltr" className="font-english" placeholder="base64 token من ZATCA" />
          </div>
          <div>
            <Label className="text-xs">الوضع</Label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full text-sm rounded border border-[#E5E7EB] px-3 py-2 bg-white">
              <option value="sandbox">Sandbox (تجريبي)</option>
              <option value="simulation">Simulation</option>
              <option value="production">Production (إنتاج)</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">CSID Secret</Label>
            <Input type="password" value={csidSecret} onChange={(e) => setCsidSecret(e.target.value)} dir="ltr" className="font-english" placeholder="secret token من ZATCA" />
          </div>
        </div>

        <Button onClick={handleOnboard} disabled={busy} className="bg-[#1276E3]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ وتفعيل"}
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
  const [stampUrl, setStampUrl] = useState((org as any).stampUrl || "");
  const [busy, setBusy] = useState(false);

  const upload = (kind: "logoUrl" | "stampUrl") => async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { push("error", "الحد الأقصى 2 ميجا"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (kind === "logoUrl") setLogoUrl(url);
      else setStampUrl(url);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const updated = await api.orgs.update(org.id, {
        logoUrl: logoUrl || null,
        stampUrl: stampUrl || null,
        // brandingSettings is stored on numberingSettings sibling — for now use a simple JSON
      } as any);
      setOrg(updated);
      push("success", "تم الحفظ");
    } catch (e: any) {
      push("error", e?.message || "فشل");
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[#0B1B49]">العلامة التجارية</CardTitle>
        <CardDescription>الشعار · الختم · الألوان · الخط · تنعكس على الفواتير، السندات، العقود</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-2 block">الشعار (مربع أو طولي)</Label>
            <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-4">
              <input type="file" id="brand-logo" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("logoUrl")(f); }} />
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="logo" className="max-w-[160px] max-h-[80px] object-contain bg-white rounded" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="brand-logo" className="text-xs text-[#1276E3] hover:underline cursor-pointer">تغيير</label>
                    <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-600 text-start hover:underline">حذف</button>
                  </div>
                </div>
              ) : (
                <label htmlFor="brand-logo" className="cursor-pointer block text-center py-4">
                  <div className="text-sm text-[#1276E3] font-medium">رفع الشعار</div>
                  <div className="text-xs text-[#9CA3AF] mt-1">PNG · SVG · JPG · حتى 2MB</div>
                </label>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">الختم الرسمي</Label>
            <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-4">
              <input type="file" id="brand-stamp" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("stampUrl")(f); }} />
              {stampUrl ? (
                <div className="flex items-center gap-3">
                  <img src={stampUrl} alt="stamp" className="max-w-[120px] max-h-[80px] object-contain bg-white rounded" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="brand-stamp" className="text-xs text-[#1276E3] hover:underline cursor-pointer">تغيير</label>
                    <button type="button" onClick={() => setStampUrl("")} className="text-xs text-red-600 text-start hover:underline">حذف</button>
                  </div>
                </div>
              ) : (
                <label htmlFor="brand-stamp" className="cursor-pointer block text-center py-4">
                  <div className="text-sm text-[#1276E3] font-medium">رفع الختم</div>
                  <div className="text-xs text-[#9CA3AF] mt-1">PNG شفاف يفضّل · حتى 2MB</div>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-2 block">اللون الأساسي</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-16 rounded border border-[#E5E7EB]" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} dir="ltr" className="font-english" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">لون التميز</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-16 rounded border border-[#E5E7EB]" />
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} dir="ltr" className="font-english" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">الخط</Label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full text-sm rounded border border-[#E5E7EB] px-3 py-2 bg-white">
              <option value="Tajawal">Tajawal</option>
              <option value="Noto Sans Arabic">Noto Sans Arabic</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="Cairo">Cairo</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F9FAFB]">
          <div className="text-xs text-[#6B7280] mb-2">معاينة</div>
          <div className="bg-white rounded p-4 border" style={{ borderColor: primaryColor, fontFamily }}>
            <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: primaryColor }}>
              {logoUrl ? <img src={logoUrl} alt="" className="max-h-[40px]" /> : <div style={{ color: accentColor, fontWeight: 700 }}>{org.name}</div>}
              <div className="text-xs text-[#6B7280]">فاتورة · INV-2026-0001</div>
            </div>
            <div className="text-sm" style={{ color: accentColor }}>
              العميل: عميل تجريبي<br />
              المبلغ: <span style={{ color: primaryColor, fontWeight: 700 }}>1,150 SAR</span>
            </div>
            {stampUrl && <img src={stampUrl} className="mt-3 max-h-[60px] opacity-80" />}
          </div>
        </div>

        <Button onClick={handleSave} disabled={busy} className="bg-[#1276E3]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 me-2" /> حفظ</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── PLANS TAB ───────────────────────────────────────────────────────────────
function PlansTab({ org, setOrg, push }: { org: Org; setOrg: (o: Org) => void; push: any }) {
  const isAdmin = (org as any).role === "OWNER" || (typeof window !== "undefined" && localStorage.getItem("user_email") === "tareq@fc.sa");
  const plans = [
    { id: "free", name: "مجاني", price: "$0", users: "2", invoices: "20/شهر", ai: "$5/شهر", features: ["حساب واحد", "فواتير أساسية", "تصدير PDF"] },
    { id: "pro", name: "احترافي", price: "$19/شهر", users: "5", invoices: "غير محدود", ai: "$30/شهر", features: ["حسابات متعددة", "ZATCA", "تكاملات بنكية", "API access"], popular: true },
    { id: "business", name: "أعمال", price: "$49/شهر", users: "20", invoices: "غير محدود", ai: "$100/شهر", features: ["كل ميزات Pro", "AI advanced", "متعدد العملات", "إغلاق سنوي", "Audit log"] },
    { id: "enterprise", name: "مؤسسات", price: "تواصل معنا", users: "غير محدود", invoices: "غير محدود", ai: "غير محدود", features: ["SSO", "SLA", "Priority support", "Custom integrations", "Dedicated account manager"] },
  ];
  const adminPlan = { id: "admin", name: "ADMIN ULTRA", price: "FREE", users: "∞", invoices: "∞", ai: "∞", features: ["جميع الميزات مفتوحة", "بدون حد على العملاء/الفواتير/AI", "Cross-org admin dashboard", "متاح فقط لـ tareq@fc.sa"] };

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[#0B1B49]">الباقات والاشتراكات</CardTitle>
        <CardDescription>اختر الباقة المناسبة · يمكن الترقية أو التخفيض في أي وقت</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-amber-700 font-bold text-lg">⚡ {adminPlan.name}</div>
                <div className="text-xs text-amber-600">باقة الادمن · مفعّلة تلقائياً لك</div>
              </div>
              <div className="text-end">
                <div className="font-english font-bold text-2xl text-amber-700" dir="ltr">{adminPlan.price}</div>
              </div>
            </div>
            <ul className="text-sm text-[#374151] space-y-1">
              {adminPlan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2"><span className="text-green-600">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {plans.map(p => (
            <div key={p.id} className={`rounded-lg border p-4 ${p.popular ? "border-[#1276E3] ring-2 ring-[#1276E3]/30" : "border-[#E5E7EB]"} relative`}>
              {p.popular && <div className="absolute -top-2.5 right-3 bg-[#1276E3] text-white text-xs px-2 py-0.5 rounded">الأكثر شعبية</div>}
              <div className="text-[#0B1B49] font-bold">{p.name}</div>
              <div className="text-2xl font-bold text-[#0B1B49] mt-2 font-english" dir="ltr">{p.price}</div>
              <div className="text-xs text-[#6B7280] mt-3 space-y-1">
                <div>👤 {p.users} مستخدمين</div>
                <div>📄 {p.invoices}</div>
                <div>🤖 AI: {p.ai}</div>
              </div>
              <ul className="text-xs text-[#374151] mt-3 space-y-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1"><span className="text-green-600 mt-0.5">✓</span><span>{f}</span></li>
                ))}
              </ul>
              <Button className="w-full mt-4 bg-[#1276E3] hover:bg-[#1060C0]" disabled>
                {p.id === "enterprise" ? "تواصل" : "اختيار"}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#9CA3AF] text-center">
          الفوترة عبر Stripe · اشتراك شهري قابل للإلغاء في أي وقت
        </p>
      </CardContent>
    </Card>
  );
}
