import { useEffect, useState, useCallback } from "react";
import { GitBranch, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

export function Branches() {
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.branches.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("الاسم مطلوب"); return; }
    setBusy(true); setError(null);
    try {
      const b = await api.branches.create({ name: form.name.trim(), code: form.code || undefined, address: form.address || undefined });
      setItems(prev => [...prev, b]);
      setOpen(false); setForm({ name: "", code: "", address: "" });
    } catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل الحفظ"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("حذف الفرع؟") — replace with InlineConfirm */ 
try { await api.branches.remove(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الفروع</h1><p className="text-[#6B7280] mt-1">إدارة فروع الشركة</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />فرع جديد</Button>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader><CardTitle className="text-[#0B1B49]">قائمة الفروع · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><GitBranch className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد فروع</p></div> :
          (<table className="w-full"><thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرمز</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>العنوان</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
          </tr></thead><tbody>
            {items.map(b => <tr key={b.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
              <td className="py-3 px-4 text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>{b.name}</td>
              <td className="py-3 px-4 font-english text-sm text-[#6B7280]">{b.code || "—"}</td>
              <td className="py-3 px-4 text-sm text-[#374151]">{b.address || "—"}</td>
              <td className="py-3 px-4"><button onClick={() => handleDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td>
            </tr>)}
          </tbody></table>)}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-[#0B1B49] text-lg font-semibold">فرع جديد</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-2"><Label>الاسم *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="فرع الرياض" /></div>
            <div className="space-y-2"><Label>الرمز</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RUH" dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="الرياض · حي الورود" /></div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]"><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "..." : "حفظ"}</Button></div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
