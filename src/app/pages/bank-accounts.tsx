/**
 * Bank Accounts · CRUD wired to /api/bank-accounts
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Plus, Search, Trash2, Wallet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, BankAccount } from "../lib/api";

export function BankAccounts() {
  const [items, setItems] = useState<BankAccount[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(window.location.pathname.endsWith("/new") || searchParams.get("new") === "1");
  const [form, setForm] = useState({
    name: "", bankName: "", country: "SA",
    accountNumber: "", iban: "",
    swiftCode: "", routingNumber: "",
    currency: "SAR", balance: "0",
  });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.bankAccounts.list();
      setItems(d.items); setTotalBalance(d.totalBalance);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(b => !searchQuery ||
    b.name.includes(searchQuery) || (b.bankName || "").includes(searchQuery) || (b.iban || "").includes(searchQuery));

  const resetForm = () => setForm({
    name: "", bankName: "", country: "SA",
    accountNumber: "", iban: "",
    swiftCode: "", routingNumber: "",
    currency: "SAR", balance: "0",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError("اسم الحساب مطلوب"); return; }
    setBusy(true);
    try {
      const b = await api.bankAccounts.create({
        name: form.name.trim(),
        bankName: form.bankName || null,
        country: form.country || null,
        accountNumber: form.accountNumber || null,
        iban: form.iban || null,
        swiftCode: form.swiftCode || null,
        routingNumber: form.routingNumber || null,
        currency: form.currency,
        balance: Number(form.balance) || 0,
      });
      setItems(prev => [...prev, b]);
      setTotalBalance(prev => prev + Number(b.balance));
      setOpen(false); resetForm();
      push("success", `تم إنشاء حساب ${b.name}`);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("هل تريد حذف الحساب البنكي؟") — replace with InlineConfirm */ 
try {
      await api.bankAccounts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الحسابات البنكية</h1>
          <p className="text-[#6B7280] mt-1">إدارة حسابات البنوك والصناديق النقدية</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />حساب جديد</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">إجمالي الأرصدة</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalBalance.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">عدد الحسابات</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
        <Card className="border-[#E5E7EB]"><CardContent className="p-5">
          <div className="text-[#6B7280] text-sm mb-1">العملات</div>
          <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{new Set(items.map(b => b.currency)).size}</div>
        </CardContent></Card>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة الحسابات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><Wallet className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد حسابات بنكية بعد</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>البنك</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>IBAN</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرصيد</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>{b.name}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{b.bankName || "—"}</td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{b.iban || "—"}</td>
                    <td className="py-3 px-4 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{Number(b.balance).toLocaleString()} {b.currency}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-[#0B1B49] text-lg font-semibold">حساب بنكي جديد</h2></div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="space-y-2"><Label className="text-[#374151]">اسم الحساب *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: الحساب الجاري الرئيسي" required className="border-[#E5E7EB]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الدولة *</Label>
                  <select value={form.country} onChange={(e) => {
                    const c = e.target.value;
                    const cur = c === "SA" ? "SAR" : c === "US" ? "USD" : c === "AE" ? "AED" : c === "EG" ? "EGP" : c === "GB" ? "GBP" : c === "EU" || c === "DE" || c === "FR" ? "EUR" : "USD";
                    setForm({ ...form, country: c, currency: cur });
                  }} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    <option value="SA">السعودية</option>
                    <option value="AE">الإمارات</option>
                    <option value="KW">الكويت</option>
                    <option value="QA">قطر</option>
                    <option value="BH">البحرين</option>
                    <option value="OM">عُمان</option>
                    <option value="EG">مصر</option>
                    <option value="JO">الأردن</option>
                    <option value="US">الولايات المتحدة</option>
                    <option value="GB">المملكة المتحدة</option>
                    <option value="DE">ألمانيا</option>
                    <option value="FR">فرنسا</option>
                  </select></div>
                <div className="space-y-2"><Label className="text-[#374151]">العملة</Label>
                  <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">اسم البنك</Label>
                <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder={form.country === "SA" ? "الراجحي · الأهلي · ..." : form.country === "US" ? "Mercury · Chase · BofA · ..." : "Bank name"} className="border-[#E5E7EB]" /></div>

              {/* KSA + Gulf · IBAN-based */}
              {(form.country === "SA" || form.country === "AE" || form.country === "KW" || form.country === "QA" || form.country === "BH" || form.country === "OM" || form.country === "JO") && (
                <>
                  <div className="space-y-2"><Label className="text-[#374151]">IBAN *</Label>
                    <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })}
                      placeholder={form.country === "SA" ? "SA00 0000 0000 0000 0000 0000" : "Country IBAN"} maxLength={34} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-[#374151]">رمز SWIFT/BIC</Label>
                      <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="RJHISARIXXX" maxLength={11} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                    <div className="space-y-2"><Label className="text-[#374151]">رقم الحساب (اختياري)</Label>
                      <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  </div>
                </>
              )}

              {/* US · Routing + Account Number */}
              {form.country === "US" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-[#374151]">Routing Number * <span className="text-[#9CA3AF] text-xs">(ABA)</span></Label>
                      <Input value={form.routingNumber} onChange={(e) => setForm({ ...form, routingNumber: e.target.value.replace(/\D/g, "") })} placeholder="123456789" maxLength={9} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                    <div className="space-y-2"><Label className="text-[#374151]">Account Number *</Label>
                      <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[#374151]">SWIFT/BIC <span className="text-[#9CA3AF] text-xs">(للتحويلات الدولية)</span></Label>
                    <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="CHASUS33" maxLength={11} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                </>
              )}

              {/* UK / EU · IBAN + SWIFT */}
              {(form.country === "GB" || form.country === "DE" || form.country === "FR") && (
                <>
                  <div className="space-y-2"><Label className="text-[#374151]">IBAN *</Label>
                    <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, "").toUpperCase() })} placeholder="GB00 NWBK 0000 0000 0000 00" maxLength={34} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                  <div className="space-y-2"><Label className="text-[#374151]">SWIFT/BIC *</Label>
                    <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value.toUpperCase() })} placeholder="NWBKGB2L" maxLength={11} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                </>
              )}

              {/* Egypt · Account number only */}
              {form.country === "EG" && (
                <div className="space-y-2"><Label className="text-[#374151]">رقم الحساب *</Label>
                  <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              )}

              <div className="space-y-2"><Label className="text-[#374151]">الرصيد الافتتاحي</Label>
                <Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} dir="ltr" className="border-[#E5E7EB] font-english" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
