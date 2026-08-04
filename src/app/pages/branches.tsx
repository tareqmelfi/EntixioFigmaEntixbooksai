import { useEffect, useState, useCallback } from "react";
import { GitBranch, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function Branches() {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.branches.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("الاسم مطلوب", "Name is required")); return; }
    setBusy(true); setError(null);
    try {
      const b = await api.branches.create({ name: form.name.trim(), code: form.code || undefined, address: form.address || undefined });
      setItems(prev => [...prev, b]);
      setOpen(false); setForm({ name: "", code: "", address: "" });
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed")); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try { await api.branches.remove(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الفروع", "Branches")}</h1><p className="text-muted-foreground mt-1">{t("إدارة فروع الشركة", "Manage company branches")}</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />{t("فرع جديد", "New Branch")}</Button>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("قائمة الفروع", "Branches list")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><GitBranch className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد فروع", "No branches")}</p></div> :
          (<table className="w-full"><thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("العنوان", "Address")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
          </tr></thead><tbody>
            {items.map(b => <tr key={b.id} className="border-b border-border/50 hover:bg-primary/5">
              <td className="py-3 px-4 text-sm text-foreground" style={{ fontWeight: 500 }}>{b.name}</td>
              <td className="py-3 px-4 font-english text-sm text-muted-foreground">{b.code || "—"}</td>
              <td className="py-3 px-4 text-sm text-foreground/80">{b.address || "—"}</td>
              <td className="py-3 px-4">{pendingDelete === b.id ? (<InlineConfirm onConfirm={() => handleDelete(b.id)} onCancel={() => setPendingDelete(null)} />) : (<button onClick={() => setPendingDelete(b.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>)}</td>
            </tr>)}
          </tbody></table>)}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">{t("فرع جديد", "New Branch")}</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-2"><Label>{t("الاسم", "Name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("فرع الرياض", "Riyadh branch")} /></div>
            <div className="space-y-2"><Label>{t("الرمز", "Code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RUH" dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("العنوان", "Address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("الرياض · حي الورود", "Riyadh · Al-Wurud dist.")} /></div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button><Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : t("حفظ", "Save")}</Button></div>
          </form>
        </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
