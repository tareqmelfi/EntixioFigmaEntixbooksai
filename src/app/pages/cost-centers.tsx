import { useEffect, useState, useCallback } from "react";
import { Target, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

export function CostCenters() {
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.costCenters.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setError("الرمز والاسم مطلوبان"); return; }
    setBusy(true); setError(null);
    try {
      const c = await api.costCenters.create({ code: form.code.trim(), name: form.name.trim() });
      setItems(prev => [...prev, c]);
      setOpen(false); setForm({ code: "", name: "" });
    } catch (e: any) { setError(e instanceof ApiError ? (e.message === "code_exists" ? "الرمز موجود" : e.message) : "فشل الحفظ"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try { await api.costCenters.remove(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>مراكز التكلفة</h1><p className="text-muted-foreground mt-1">تتبع المصاريف والإيرادات حسب مركز التكلفة</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />مركز جديد</Button>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">القائمة · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><Target className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">لا توجد مراكز تكلفة</p></div> :
          (<table className="w-full"><thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرمز</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
          </tr></thead><tbody>
            {items.map(c => <tr key={c.id} className="border-b border-border/50 hover:bg-primary/5">
              <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{c.code}</td>
              <td className="py-3 px-4 text-sm text-foreground">{c.name}</td>
              <td className="py-3 px-4">{pendingDelete === c.id ? (<InlineConfirm onConfirm={() => handleDelete(c.id)} onCancel={() => setPendingDelete(null)} />) : (<button onClick={() => setPendingDelete(c.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>)}</td>
            </tr>)}
          </tbody></table>)}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">مركز تكلفة جديد</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-2"><Label>الرمز *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CC-001" dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>الاسم *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="قسم المبيعات" /></div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border"><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : "حفظ"}</Button></div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
