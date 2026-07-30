import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Trash2, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";

export function FixedAssets() {
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [stats, setStats] = useState({ totalCost: 0, netBookValue: 0, totalDepreciation: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [form, setForm] = useState({
    code: "", name: "", category: "",
    acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionCost: "", salvageValue: "0", usefulLifeYears: "5",
  });

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.fixedAssets.list();
      setItems(d.items);
      setStats({ totalCost: d.totalCost, netBookValue: d.netBookValue, totalDepreciation: d.totalDepreciation });
    } catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.acquisitionCost) { setError("الرمز والاسم والتكلفة مطلوبة"); return; }
    setBusy(true); setError(null);
    try {
      const a = await api.fixedAssets.create({
        code: form.code, name: form.name, category: form.category || null,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: Number(form.acquisitionCost),
        salvageValue: Number(form.salvageValue) || 0,
        usefulLifeYears: Number(form.usefulLifeYears) || 5,
      });
      setItems(prev => [...prev, a]);
      setOpen(false);
      setForm({ code: "", name: "", category: "", acquisitionDate: new Date().toISOString().slice(0, 10), acquisitionCost: "", salvageValue: "0", usefulLifeYears: "5" });
      refresh();
    } catch (e: any) { setError(e instanceof ApiError ? (e.message === "code_exists" ? "الرمز موجود" : e.message) : "فشل الحفظ"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.fixedAssets.remove(id); refresh(); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  const formatMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الأصول الثابتة</h1><p className="text-muted-foreground mt-1">إدارة الأصول مع الإهلاك التلقائي</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />أصل جديد</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">إجمالي التكلفة</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalCost.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">الإهلاك المتراكم</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(stats.totalDepreciation).toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">صافي القيمة الدفترية</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(stats.netBookValue).toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">قائمة الأصول · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">لا توجد أصول ثابتة</p></div> :
          (<div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[900px] text-sm">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[280px]" />
                <col className="w-[150px]" />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الرمز</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>الاسم</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التصنيف</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>تاريخ الاقتناء</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>التكلفة</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>العمر الإنتاجي</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map(a => <tr key={a.id} className="border-b border-border/50 hover:bg-primary/5">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setSelectedAsset(a)}
                      className="max-w-full truncate font-english text-sm text-primary hover:underline"
                      style={{ fontWeight: 700 }}
                    >
                      {a.code}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setSelectedAsset(a)}
                      className="block max-w-full truncate text-start text-sm text-foreground hover:text-primary hover:underline"
                      title={a.name}
                    >
                      {a.name}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground/80 truncate">{a.category || "—"}</td>
                  <td className="py-3 px-4 font-english text-xs text-muted-foreground" dir="ltr">{a.acquisitionDate?.slice(0, 10)}</td>
                  <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }} dir="ltr">{formatMoney(a.acquisitionCost)}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{a.usefulLifeYears} سنة</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedAsset(a)} className="rounded-md p-1.5 text-primary hover:bg-blue-50" title="فتح الأصل"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(a.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title="حذف الأصل"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>)}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">أصل ثابت جديد</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>الرمز *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FA-001" dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>التصنيف</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="مكاتب · معدات · عقار" /></div>
            </div>
            <div className="space-y-2"><Label>اسم الأصل *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="جهاز كمبيوتر مكتبي" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>تاريخ الاقتناء *</Label><DateInput value={form.acquisitionDate} onChange={(iso) => setForm({ ...form, acquisitionDate: iso })} required inputClassName="" /></div>
              <div className="space-y-2"><Label>العمر الإنتاجي (سنوات) *</Label><Input type="number" min="1" required value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>التكلفة *</Label><Input type="number" step="0.01" min="0" required value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>القيمة المتبقية</Label><Input type="number" step="0.01" min="0" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border"><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : "حفظ"}</Button></div>
          </form>
        </SidePanel>
      <SidePanel open={!!selectedAsset} onClose={() => setSelectedAsset(null)}>
        {selectedAsset && (
          <div className="py-4 space-y-4">
            <div>
              <div className="font-english text-xs text-primary" dir="ltr">{selectedAsset.code}</div>
              <h2 className="text-foreground text-lg font-semibold mt-1">{selectedAsset.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedAsset.category || "بدون تصنيف"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">التكلفة</div>
                <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{formatMoney(selectedAsset.acquisitionCost)}</div>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">القيمة المتبقية</div>
                <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{formatMoney(selectedAsset.salvageValue)}</div>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">تاريخ الاقتناء</div>
                <div className="font-english text-foreground mt-1" dir="ltr">{selectedAsset.acquisitionDate?.slice(0, 10)}</div>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">العمر الإنتاجي</div>
                <div className="text-foreground mt-1" style={{ fontWeight: 700 }}>{selectedAsset.usefulLifeYears} سنة</div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
              هذا العرض يثبت أن الأصل قابل للفتح من الرمز أو الاسم. ربط الأصل تلقائياً من فاتورة مشتريات يحتاج حفظ حساب السطر/نوع الأصل في بيانات سطور المشتريات.
            </div>
          </div>
        )}
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
