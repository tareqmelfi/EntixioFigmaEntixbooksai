import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Trash2, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function FixedAssets() {
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const { t } = useLanguage();
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
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.acquisitionCost) { setError(t("الرمز والاسم والتكلفة مطلوبة", "Code, name and cost are required")); return; }
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
    } catch (e: any) { setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Failed to save")); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.fixedAssets.remove(id); refresh(); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Failed to delete")); }
  };

  const formatMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الأصول الثابتة", "Fixed Assets")}</h1><p className="text-muted-foreground mt-1">{t("إدارة الأصول مع الإهلاك التلقائي", "Manage assets with automatic depreciation")}</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)}><Plus className="me-2 h-4 w-4" />{t("أصل جديد", "New Asset")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي التكلفة", "Total Cost")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalCost.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("الإهلاك المتراكم", "Accumulated Depreciation")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(stats.totalDepreciation).toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("صافي القيمة الدفترية", "Net Book Value")}</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(stats.netBookValue).toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("قائمة الأصول", "Assets List")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد أصول ثابتة", "No fixed assets")}</p></div> :
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
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التصنيف", "Category")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("تاريخ الاقتناء", "Acquisition Date")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التكلفة", "Cost")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("العمر الإنتاجي", "Useful Life")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
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
                  <td className="py-3 px-4 text-sm text-muted-foreground">{a.usefulLifeYears} {t("سنة", "years")}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedAsset(a)} className="rounded-md p-1.5 text-primary hover:bg-blue-50" title={t("فتح الأصل", "Open asset")}><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(a.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title={t("حذف الأصل", "Delete asset")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>)}
        </CardContent>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">{t("أصل ثابت جديد", "New Fixed Asset")}</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("الرمز", "Code")} *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FA-001" dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("التصنيف", "Category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t("مكاتب · معدات · عقار", "Office · Equipment · Property")} /></div>
            </div>
            <div className="space-y-2"><Label>{t("اسم الأصل", "Asset name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("جهاز كمبيوتر مكتبي", "Desktop computer")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("تاريخ الاقتناء", "Acquisition date")} *</Label><DateInput value={form.acquisitionDate} onChange={(iso) => setForm({ ...form, acquisitionDate: iso })} required inputClassName="" /></div>
              <div className="space-y-2"><Label>{t("العمر الإنتاجي (سنوات)", "Useful life (years)")} *</Label><Input type="number" min="1" required value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التكلفة", "Cost")} *</Label><Input type="number" step="0.01" min="0" required value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("القيمة المتبقية", "Salvage value")}</Label><Input type="number" step="0.01" min="0" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button><Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : t("حفظ", "Save")}</Button></div>
          </form>
        </SidePanel>
      <SidePanel open={!!selectedAsset} onClose={() => setSelectedAsset(null)}>
        {selectedAsset && (
          <div className="py-4 space-y-4">
            <div>
              <div className="font-english text-xs text-primary" dir="ltr">{selectedAsset.code}</div>
              <h2 className="text-foreground text-lg font-semibold mt-1">{selectedAsset.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedAsset.category || t("بدون تصنيف", "Uncategorized")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">{t("التكلفة", "Cost")}</div>
                <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{formatMoney(selectedAsset.acquisitionCost)}</div>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">{t("القيمة المتبقية", "Salvage Value")}</div>
                <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{formatMoney(selectedAsset.salvageValue)}</div>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">{t("تاريخ الاقتناء", "Acquisition Date")}</div>
                <div className="font-english text-foreground mt-1" dir="ltr">{selectedAsset.acquisitionDate?.slice(0, 10)}</div>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs text-muted-foreground">{t("العمر الإنتاجي", "Useful Life")}</div>
                <div className="text-foreground mt-1" style={{ fontWeight: 700 }}>{selectedAsset.usefulLifeYears} {t("سنة", "years")}</div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
              {t("هذا العرض يثبت أن الأصل قابل للفتح من الرمز أو الاسم. ربط الأصل تلقائياً من فاتورة مشتريات يحتاج حفظ حساب السطر/نوع الأصل في بيانات سطور المشتريات.", "This view confirms the asset can be opened from its code or name. Auto-linking an asset from a purchase bill requires saving the line account/asset type in the purchase line data.")}
            </div>
          </div>
        )}
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
