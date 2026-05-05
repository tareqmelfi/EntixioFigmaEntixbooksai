/**
 * Settings · org info + members + auth · wired to /orgs · /orgs/:id/members
 */
import { useEffect, useState, useCallback } from "react";
import { Building2, Users, Loader2, Save, LogOut, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, Org } from "../lib/api";
import { authStore } from "../components/auth-store";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "مالك", ADMIN: "مدير", ACCOUNTANT: "محاسب", VIEWER: "مشاهد فقط",
};

export function Settings() {
  const [tab, setTab] = useState<"company" | "members" | "account" | "branding">("company");
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

      <div className="flex gap-2 border-b border-[#E5E7EB]">
        {([["company", "بيانات الشركة"], ["members", "الفريق"], ["branding", "العلامة التجارية"], ["account", "حسابي"]] as const).map(([k, label]) => (
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
    </div>
  );
}
