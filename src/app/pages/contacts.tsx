/**
 * Contacts page · customers + suppliers · wired to /api/contacts
 */
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Search, Trash2, Loader2, Mail, Phone, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, ApiError, Contact } from "../lib/api";

const TYPE_LABELS: Record<string, string> = { CUSTOMER: "عميل", SUPPLIER: "مورد", BOTH: "عميل ومورد" };
const TYPE_COLORS: Record<string, string> = {
  CUSTOMER: "bg-blue-100 text-blue-700",
  SUPPLIER: "bg-amber-100 text-amber-700",
  BOTH: "bg-purple-100 text-purple-700",
};

export function Contacts() {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "CUSTOMER" as Contact["type"],
    displayName: "", legalName: "", email: "", phone: "",
    vatNumber: "", crNumber: "", country: "SA", city: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.contacts.list({ limit: 200 });
      setItems(d.items);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(c => {
    if (filterType !== "ALL" && c.type !== filterType) return false;
    if (searchQuery) return c.displayName.includes(searchQuery) || (c.email || "").includes(searchQuery) ||
      (c.phone || "").includes(searchQuery) || (c.vatNumber || "").includes(searchQuery);
    return true;
  });

  const counts = items.reduce((acc: Record<string, number>, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  const resetForm = () => setForm({
    type: "CUSTOMER", displayName: "", legalName: "", email: "", phone: "",
    vatNumber: "", crNumber: "", country: "SA", city: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.displayName.trim()) { setError("الاسم مطلوب"); return; }
    setBusy(true);
    try {
      const c = await api.contacts.create({
        type: form.type,
        displayName: form.displayName.trim(),
        legalName: form.legalName.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        crNumber: form.crNumber.trim() || null,
        country: form.country,
        city: form.city.trim() || null,
      });
      setItems(prev => [c, ...prev]);
      setOpen(false); resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف جهة الاتصال؟")) return;
    try {
      await api.contacts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { alert(e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>العملاء والموردين</h1>
          <p className="text-[#6B7280] mt-1">إدارة جهات الاتصال والشركاء التجاريين</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />جهة اتصال جديدة</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["ALL", "CUSTOMER", "SUPPLIER", "BOTH"] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-lg border px-4 py-3 text-start transition-colors ${filterType === t ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] hover:bg-[#F9FAFB]"}`}
          >
            <div className="text-xs text-[#6B7280] mb-1">{t === "ALL" ? "الكل" : TYPE_LABELS[t]}</div>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{t === "ALL" ? items.length : (counts[t] || 0)}</div>
          </button>
        ))}
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة جهات الاتصال</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث بالاسم أو البريد أو الرقم..." className="w-72 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><Users className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد جهات اتصال · اضغط "جهة اتصال جديدة"</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>النوع</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاتصال</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرقم الضريبي</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>المدينة</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 text-sm">
                      <div className="text-[#0B1B49]" style={{ fontWeight: 500 }}>{c.displayName}</div>
                      {c.legalName && <div className="text-xs text-[#6B7280]">{c.legalName}</div>}
                    </td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[c.type]}`}>{TYPE_LABELS[c.type]}</span></td>
                    <td className="py-3 px-4 text-xs text-[#6B7280] space-y-0.5">
                      {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="font-english">{c.email}</span></div>}
                      {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span className="font-english">{c.phone}</span></div>}
                    </td>
                    <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{c.vatNumber || "—"}</td>
                    <td className="py-3 px-4 text-sm text-[#374151]">{c.city || "—"}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleDelete(c.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle className="text-[#0B1B49]">جهة اتصال جديدة</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">النوع *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Contact["type"] })}>
                    <SelectTrigger className="border-[#E5E7EB]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTOMER">عميل</SelectItem>
                      <SelectItem value="SUPPLIER">مورد</SelectItem>
                      <SelectItem value="BOTH">عميل ومورد</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label className="text-[#374151]">الاسم *</Label>
                  <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="شركة الأمل التجارية" required className="border-[#E5E7EB]" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">الاسم القانوني (اختياري)</Label>
                <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="Al Amal Trading Co. LLC" className="border-[#E5E7EB]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">البريد الإلكتروني</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@example.com" dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">الجوال</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966555000111" dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الرقم الضريبي</Label>
                  <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} placeholder="300xxxxxxxxxxxx" dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">السجل التجاري</Label>
                  <Input value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} placeholder="10xxxxxxxx" dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الدولة</Label>
                  <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                    <option value="SA">السعودية</option>
                    <option value="AE">الإمارات</option>
                    <option value="KW">الكويت</option>
                    <option value="QA">قطر</option>
                    <option value="BH">البحرين</option>
                    <option value="OM">عُمان</option>
                    <option value="EG">مصر</option>
                    <option value="US">الولايات المتحدة</option>
                    <option value="GB">المملكة المتحدة</option>
                  </select></div>
                <div className="space-y-2"><Label className="text-[#374151]">المدينة</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="الرياض" className="border-[#E5E7EB]" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#E5E7EB]">إلغاء</Button>
              <Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
