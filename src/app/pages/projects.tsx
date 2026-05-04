import { useEffect, useState, useCallback } from "react";
import { FolderKanban, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, ApiError } from "../lib/api";

const STATUS_LABELS: Record<string, string> = { ACTIVE: "نشط", ON_HOLD: "متوقف", COMPLETED: "مكتمل", CANCELLED: "ملغي" };
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700", ON_HOLD: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700", CANCELLED: "bg-gray-100 text-gray-500",
};

export function Projects() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", startDate: "", endDate: "", status: "ACTIVE" });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.projects.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setError("الرمز والاسم مطلوبان"); return; }
    setBusy(true); setError(null);
    try {
      const p = await api.projects.create({
        code: form.code.trim(), name: form.name.trim(),
        startDate: form.startDate || null, endDate: form.endDate || null,
        status: form.status,
      });
      setItems(prev => [...prev, p]);
      setOpen(false); setForm({ code: "", name: "", startDate: "", endDate: "", status: "ACTIVE" });
    } catch (e: any) { setError(e instanceof ApiError ? (e.message === "code_exists" ? "الرمز موجود" : e.message) : "فشل الحفظ"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف المشروع؟")) return;
    try { await api.projects.remove(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e: any) { alert(e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المشاريع</h1><p className="text-[#6B7280] mt-1">إدارة المشاريع وربطها بالفواتير والمصروفات</p></div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />مشروع جديد</Button>
      </div>

      <Card className="border-[#E5E7EB]">
        <CardHeader><CardTitle className="text-[#0B1B49]">القائمة · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><FolderKanban className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" /><p className="text-sm text-[#6B7280]">لا توجد مشاريع</p></div> :
          (<table className="w-full"><thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرمز</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>البداية</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>النهاية</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الحالة</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
          </tr></thead><tbody>
            {items.map(p => <tr key={p.id} className="border-b border-[#F3F4F6] hover:bg-[#F4FCFF]">
              <td className="py-3 px-4 font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{p.code}</td>
              <td className="py-3 px-4 text-sm text-[#0B1B49]">{p.name}</td>
              <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{p.startDate?.slice(0, 10) || "—"}</td>
              <td className="py-3 px-4 font-english text-xs text-[#6B7280]">{p.endDate?.slice(0, 10) || "—"}</td>
              <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[p.status] || ""}`}>{STATUS_LABELS[p.status] || p.status}</span></td>
              <td className="py-3 px-4"><button onClick={() => handleDelete(p.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td>
            </tr>)}
          </tbody></table>)}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
        <DialogContent className="sm:max-w-[500px]"><DialogHeader><DialogTitle>مشروع جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>الرمز *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="PRJ-001" dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">نشط</SelectItem>
                    <SelectItem value="ON_HOLD">متوقف</SelectItem>
                    <SelectItem value="COMPLETED">مكتمل</SelectItem>
                    <SelectItem value="CANCELLED">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>اسم المشروع *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مشروع تطوير التطبيق" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>تاريخ البداية</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>تاريخ النهاية</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={busy} className="bg-[#1276E3] hover:bg-[#1060C0]">{busy ? "..." : "حفظ"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
