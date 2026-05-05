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
  const [tab, setTab] = useState<"company" | "members" | "account" | "branding" | "ai">("company");
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
        {([["company", "بيانات الشركة"], ["members", "الفريق"], ["ai", "الذكاء الاصطناعي"], ["branding", "العلامة التجارية"], ["account", "حسابي"]] as const).map(([k, label]) => (
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

      {tab === "members" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-[#0B1B49]"><Users className="h-5 w-5" /> أعضاء الفريق</CardTitle><CardDescription>{members.length} عضو · دعوة الأعضاء قادمة قريباً</CardDescription></CardHeader>
          <CardContent>
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>البريد</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الدور</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>تاريخ الانضمام</th>
              </tr></thead>
              <tbody>
                {members.map(m => <tr key={m.id} className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm text-[#0B1B49]">{m.user.name || "—"}</td>
                  <td className="py-3 px-4 font-english text-sm text-[#374151]">{m.user.email}</td>
                  <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded bg-[#F4FCFF] text-[#1276E3]">{ROLE_LABELS[m.role] || m.role}</span></td>
                  <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{m.createdAt?.slice(0, 10)}</td>
                </tr>)}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
                    <div className="flex items-center justify-between rounded-md bg-[#F4FCFF] border border-blue-100 p-3">
                      <div>
                        <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>
                          المفتاح النشط: <span className="font-english">{aiConfig.byokKeyHint}</span>
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5">المزود: {aiConfig.byokProvider}</p>
                      </div>
                      <Button onClick={handleClearByok} variant="outline" disabled={aiBusy} className="border-red-200 text-red-600 hover:bg-red-50">
                        حذف المفتاح
                      </Button>
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

      {tab === "branding" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">العلامة التجارية</CardTitle><CardDescription>الشعار · الألوان · القوالب</CardDescription></CardHeader>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-[#6B7280]">قريباً · محرر القوالب المرئي مع رفع شعار · اختيار ألوان · قالب فاتورة + عرض سعر + سند مخصص</p>
          </CardContent>
        </Card>
      )}

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
