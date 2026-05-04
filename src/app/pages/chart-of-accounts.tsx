/**
 * Chart of Accounts · wired to /api/accounts
 */
import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Search, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, ApiError, Account } from "../lib/api";

const TYPE_LABELS: Record<string, string> = {
  ASSET: "أصل", LIABILITY: "التزام", EQUITY: "حقوق ملكية", REVENUE: "إيراد", EXPENSE: "مصروف",
};
const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700",
  LIABILITY: "bg-red-100 text-red-700",
  EQUITY: "bg-purple-100 text-purple-700",
  REVENUE: "bg-green-100 text-green-700",
  EXPENSE: "bg-amber-100 text-amber-700",
};

export function ChartOfAccounts() {
  const [items, setItems] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", nameAr: "", type: "ASSET" as Account["type"] });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.accounts.list();
      setItems(d.items);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل التحميل");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = items.filter(a => {
    if (filterType !== "ALL" && a.type !== filterType) return false;
    if (searchQuery) return a.code.includes(searchQuery) || a.name.includes(searchQuery) || (a.nameAr || "").includes(searchQuery);
    return true;
  });

  const counts = items.reduce((acc: Record<string, number>, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const resetForm = () => setForm({ code: "", name: "", nameAr: "", type: "ASSET" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.code.trim() || !form.name.trim()) { setError("الرمز والاسم مطلوبان"); return; }
    setBusy(true);
    try {
      const a = await api.accounts.create({
        code: form.code.trim(), name: form.name.trim(),
        nameAr: form.nameAr.trim() || null,
        type: form.type,
      });
      setItems(prev => [...prev, a].sort((a, b) => a.code.localeCompare(b.code)));
      setOpen(false); resetForm();
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_already_exists" ? "الرمز موجود مسبقاً" : e.message) : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد إخفاء الحساب؟")) return;
    try {
      await api.accounts.remove(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { alert(e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>دليل الحسابات</h1>
          <p className="text-[#6B7280] mt-1">شجرة الحسابات حسب التصنيف</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />حساب جديد</Button>
      </div>

      {error && !open && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const).slice(0, 6).map(t => (
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
            <CardTitle className="text-[#0B1B49]">الحسابات</CardTitle>
            <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="بحث..." className="w-64 ps-10 border-[#E5E7EB]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           filtered.length === 0 ? (
            <div className="py-12 text-center"><BookOpen className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد حسابات</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرمز</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التصنيف</th>
                <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
                    <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{a.code}</td>
                    <td className="py-3 px-4 text-sm">
                      <div className="text-[#0B1B49]" style={{ fontWeight: 500 }}>{a.nameAr || a.name}</div>
                      {a.nameAr && <div className="text-xs text-[#6B7280] font-english">{a.name}</div>}
                    </td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span></td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleDelete(a.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-[#0B1B49]">حساب جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-[#374151]">الرمز *</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="61000" required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
                <div className="space-y-2"><Label className="text-[#374151]">التصنيف *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Account["type"] })}>
                    <SelectTrigger className="border-[#E5E7EB]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSET">أصل (Asset)</SelectItem>
                      <SelectItem value="LIABILITY">التزام (Liability)</SelectItem>
                      <SelectItem value="EQUITY">حقوق ملكية (Equity)</SelectItem>
                      <SelectItem value="REVENUE">إيراد (Revenue)</SelectItem>
                      <SelectItem value="EXPENSE">مصروف (Expense)</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="space-y-2"><Label className="text-[#374151]">الاسم بالإنجليزية *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Office Supplies" required dir="ltr" className="border-[#E5E7EB] font-english" /></div>
              <div className="space-y-2"><Label className="text-[#374151]">الاسم بالعربية</Label>
                <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="مستلزمات مكتبية" className="border-[#E5E7EB]" /></div>
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
