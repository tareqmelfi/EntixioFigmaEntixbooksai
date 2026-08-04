import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Trash2, Loader2, Eye, Edit2, Archive, RotateCcw, ExternalLink, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError, Account } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const EMPTY_FORM = {
  code: "", name: "", category: "",
  acquisitionDate: new Date().toISOString().slice(0, 10),
  acquisitionCost: "", salvageValue: "0", usefulLifeYears: "5",
  accountId: "", depreciationExpenseAccountId: "", accumulatedDepreciationAccountId: "",
  purchaseBillId: "", purchaseExpenseId: "", notes: "",
};

export function FixedAssets() {
  const [items, setItems] = useState<any[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalCost: 0, netBookValue: 0, totalDepreciation: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [disposeForm, setDisposeForm] = useState({ disposalDate: new Date().toISOString().slice(0, 10), disposalAmount: "", disposalReason: "" });
  const [disposeBusy, setDisposeBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

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
  useEffect(() => {
    api.accounts.list().then((d) => setAccounts(d.items)).catch(() => {});
  }, []);

  const assetAccounts = accounts.filter(a => a.type === "ASSET").map(a => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.nameAr || undefined }));
  const expenseAccounts = accounts.filter(a => a.type === "EXPENSE").map(a => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.nameAr || undefined }));

  const openCreate = async () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setOpen(true);
    // Auto code · يتولد تلقائياً (FA-0001 …) ويبقى قابلاً للتعديل
    try {
      const { code } = await api.fixedAssets.nextCode();
      setForm((f) => ({ ...f, code }));
    } catch { /* keep manual */ }
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      code: a.code || "", name: a.name || "", category: a.category || "",
      acquisitionDate: (a.acquisitionDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      acquisitionCost: String(a.acquisitionCost ?? ""), salvageValue: String(a.salvageValue ?? "0"), usefulLifeYears: String(a.usefulLifeYears ?? "5"),
      accountId: a.accountId || "", depreciationExpenseAccountId: a.depreciationExpenseAccountId || "", accumulatedDepreciationAccountId: a.accumulatedDepreciationAccountId || "",
      purchaseBillId: a.purchaseBillId || "", purchaseExpenseId: a.purchaseExpenseId || "", notes: a.notes || "",
    });
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.acquisitionCost) { setError(t("الرمز والاسم والتكلفة مطلوبة", "Code, name and cost are required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        code: form.code.trim(), name: form.name.trim(), category: form.category || null,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: Number(form.acquisitionCost),
        salvageValue: Number(form.salvageValue) || 0,
        usefulLifeYears: Number(form.usefulLifeYears) || 5,
        accountId: form.accountId || null,
        depreciationExpenseAccountId: form.depreciationExpenseAccountId || null,
        accumulatedDepreciationAccountId: form.accumulatedDepreciationAccountId || null,
        purchaseBillId: form.purchaseBillId || null,
        purchaseExpenseId: form.purchaseExpenseId || null,
        notes: form.notes || null,
      };
      const saved = editingId ? await api.fixedAssets.update(editingId, payload) : await api.fixedAssets.create(payload);
      setItems(prev => editingId ? prev.map(x => x.id === editingId ? saved : x) : [...prev, saved]);
      push("success", editingId ? t("تم تحديث الأصل", "Asset updated") : t("تم تسجيل الأصل", "Asset registered"));
      setOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      refresh();
    } catch (e: any) { setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Failed to save")); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try { await api.fixedAssets.remove(id); push("success", t("تم حذف الأصل", "Asset deleted")); setSelectedAsset(null); refresh(); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Failed to delete")); }
  };

  const handleDispose = async () => {
    if (!selectedAsset) return;
    setDisposeBusy(true);
    try {
      await api.fixedAssets.dispose(selectedAsset.id, {
        disposalDate: disposeForm.disposalDate,
        disposalAmount: Number(disposeForm.disposalAmount) || 0,
        disposalReason: disposeForm.disposalReason || null,
      });
      push("success", t("تم إخراج الأصل", "Asset disposed"));
      setSelectedAsset(null);
      setDisposeForm({ disposalDate: new Date().toISOString().slice(0, 10), disposalAmount: "", disposalReason: "" });
      refresh();
    } catch (e: any) { push("error", e instanceof ApiError ? (e.message === "already_disposed" ? t("الأصل مُخرج مسبقاً", "Asset already disposed") : e.message) : t("فشل الإخراج", "Dispose failed")); }
    finally { setDisposeBusy(false); }
  };

  const handleRestore = async (id: string) => {
    try { await api.fixedAssets.restore(id); push("success", t("تمت إعادة الأصل لنشط", "Asset restored to active")); setSelectedAsset(null); refresh(); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشلت الاستعادة", "Restore failed")); }
  };

  const formatMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const accountLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = accounts.find(x => x.id === id);
    return a ? `${a.code} · ${a.name}` : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الأصول الثابتة", "Fixed Assets")}</h1><p className="text-muted-foreground mt-1">{t("تسجيل الأصول وربطها بالمشتريات والحسابات مع الإهلاك والإخراج التلقائي", "Register assets linked to purchases and accounts, with depreciation and auto-disposal")}</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t("أصل جديد", "New Asset")}</Button>
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
           items.length === 0 ? <div className="py-12 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد أصول ثابتة", "No fixed assets")}</p><p className="text-xs text-muted-foreground/70 mt-1">{t("سجّل أصلاً يدوياً أو فعّل خيار الأصل في سطر فاتورة مشتريات ليُسجّل تلقائياً", "Register an asset manually, or flag a purchase bill line as an asset to register it automatically")}</p></div> :
          (<div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1000px] text-sm">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[260px]" />
                <col className="w-[130px]" />
                <col className="w-[180px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التصنيف", "Category")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("حساب الأصل", "Asset account")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("تاريخ الاقتناء", "Acquisition")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التكلفة", "Cost")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجراءات", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(a => <tr key={a.id} className="border-b border-border/50 hover:bg-primary/5">
                  <td className="py-3 px-4">
                    <button type="button" onClick={() => setSelectedAsset(a)} className="max-w-full truncate font-english text-sm text-primary hover:underline" style={{ fontWeight: 700 }}>{a.code}</button>
                  </td>
                  <td className="py-3 px-4">
                    <button type="button" onClick={() => setSelectedAsset(a)} className="block max-w-full truncate text-start text-sm text-foreground hover:text-primary hover:underline" title={a.name}>{a.name}</button>
                    {(a.purchaseBillId || a.purchaseExpenseId) && <span className="text-[10px] text-muted-foreground/70">{t("من المشتريات", "from purchases")}</span>}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground/80 truncate">{a.category || "—"}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground truncate" dir="ltr">{accountLabel(a.accountId)}</td>
                  <td className="py-3 px-4 font-english text-xs text-muted-foreground" dir="ltr">{a.acquisitionDate?.slice(0, 10)}</td>
                  <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }} dir="ltr">{formatMoney(a.acquisitionCost)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.status === "ACTIVE" ? t("نشط", "Active") : a.status === "DISPOSED" ? t("مُخرج", "Disposed") : t("مشطوب", "Written off")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedAsset(a)} className="rounded-md p-1.5 text-primary hover:bg-blue-50" title={t("فتح الأصل", "Open asset")}><Eye className="h-4 w-4" /></button>
                      <button onClick={() => openEdit(a)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title={t("تعديل", "Edit")}><Edit2 className="h-4 w-4" /></button>
                      {pendingDelete === a.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(a.id)} onCancel={() => setPendingDelete(null)} />
                      ) : (
                        <button onClick={() => setPendingDelete(a.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title={t("حذف الأصل", "Delete asset")}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>)}
        </CardContent>
      </Card>

      {/* Register / edit form · like products */}
      <SidePanel open={open} onClose={() => setOpen(false)}>
        <div className="mb-3"><h2 className="text-foreground text-lg font-semibold">{editingId ? t("تعديل أصل", "Edit Asset") : t("أصل ثابت جديد", "New Fixed Asset")}</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("الرمز", "Code")} *</Label>
                <div className="flex gap-1.5">
                  <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FA-0001" dir="ltr" className="font-english" />
                  {!editingId && (
                    <button type="button" onClick={openCreate} title={t("توليد تلقائي", "Auto-generate")} className="shrink-0 rounded-md border border-border px-2 text-primary hover:bg-blue-50"><Sparkles className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
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
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("الربط المحاسبي", "Accounting links")}</div>
              <div className="space-y-2">
                <Label>{t("حساب الأصل", "Asset account")}</Label>
                <SearchableCombobox value={form.accountId} onChange={(id) => setForm({ ...form, accountId: id })} items={assetAccounts} placeholder={t("اختر حساب الأصل...", "Choose asset account...")} />
              </div>
              <div className="space-y-2">
                <Label>{t("حساب مصروف الإهلاك", "Depreciation expense account")}</Label>
                <SearchableCombobox value={form.depreciationExpenseAccountId} onChange={(id) => setForm({ ...form, depreciationExpenseAccountId: id })} items={expenseAccounts} placeholder={t("اختر حساب مصروف الإهلاك...", "Choose depreciation expense account...")} />
              </div>
              <div className="space-y-2">
                <Label>{t("حساب مجمع الإهلاك", "Accumulated depreciation account")}</Label>
                <SearchableCombobox value={form.accumulatedDepreciationAccountId} onChange={(id) => setForm({ ...form, accumulatedDepreciationAccountId: id })} items={assetAccounts} placeholder={t("اختر حساب مجمع الإهلاك...", "Choose accumulated depreciation account...")} />
              </div>
            </div>
            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("اختياري", "Optional")} /></div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? "..." : editingId ? t("تحديث", "Update") : t("حفظ", "Save")}</Button>
            </div>
          </form>
        </SidePanel>

      {/* Asset detail · account links + purchase link + dispose/restore + delete */}
      <SidePanel open={!!selectedAsset} onClose={() => setSelectedAsset(null)}>
        {selectedAsset && (
          <div className="py-4 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-english text-xs text-primary" dir="ltr">{selectedAsset.code}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedAsset.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {selectedAsset.status === "ACTIVE" ? t("نشط", "Active") : t("مُخرج", "Disposed")}
                </span>
              </div>
              <h2 className="text-foreground text-lg font-semibold mt-1">{selectedAsset.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedAsset.category || t("بدون تصنيف", "Uncategorized")}</p>
            </div>

            {(selectedAsset.purchaseBillId || selectedAsset.purchaseExpenseId) && (
              <button
                type="button"
                onClick={() => navigate(selectedAsset.purchaseBillId ? `/app/purchases/bills` : `/app/expenses`)}
                className="flex w-full items-center justify-between rounded-lg border border-primary/30 bg-blue-50/50 px-3 py-2 text-sm text-primary hover:bg-blue-50"
              >
                <span>{selectedAsset.purchaseBillId ? t("مرتبط بفاتورة مشتريات · عرض", "Linked to a purchase bill · view") : t("مرتبط بمصروف · عرض", "Linked to an expense · view")}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}

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

            <div className="rounded-lg border border-border bg-white p-3 space-y-2 text-sm">
              <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("الربط المحاسبي", "Accounting links")}</div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("حساب الأصل", "Asset account")}</span><span className="font-english text-foreground" dir="ltr">{accountLabel(selectedAsset.accountId)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("مصروف الإهلاك", "Depreciation expense")}</span><span className="font-english text-foreground" dir="ltr">{accountLabel(selectedAsset.depreciationExpenseAccountId)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("مجمع الإهلاك", "Accumulated depreciation")}</span><span className="font-english text-foreground" dir="ltr">{accountLabel(selectedAsset.accumulatedDepreciationAccountId)}</span></div>
            </div>

            {selectedAsset.status === "DISPOSED" && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 text-sm">
                <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("بيانات الإخراج", "Disposal details")}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("التاريخ", "Date")}</span><span className="font-english" dir="ltr">{selectedAsset.disposalDate?.slice(0, 10) || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("مبلغ التصرف", "Disposal amount")}</span><span className="font-english" dir="ltr">{formatMoney(selectedAsset.disposalAmount)}</span></div>
                {selectedAsset.disposalReason && <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("السبب", "Reason")}</span><span>{selectedAsset.disposalReason}</span></div>}
              </div>
            )}

            {selectedAsset.status === "ACTIVE" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-800" style={{ fontWeight: 600 }}><Archive className="h-3.5 w-3.5" />{t("إخراج الأصل (بيع/تخلص)", "Dispose asset (sell/write-off)")}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">{t("تاريخ الإخراج", "Disposal date")}</Label><DateInput value={disposeForm.disposalDate} onChange={(iso) => setDisposeForm({ ...disposeForm, disposalDate: iso })} inputClassName="" /></div>
                  <div className="space-y-1"><Label className="text-xs">{t("مبلغ التصرف", "Disposal amount")}</Label><Input type="number" step="0.01" min="0" value={disposeForm.disposalAmount} onChange={(e) => setDisposeForm({ ...disposeForm, disposalAmount: e.target.value })} dir="ltr" className="font-english" placeholder="0" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">{t("السبب", "Reason")}</Label><Input value={disposeForm.disposalReason} onChange={(e) => setDisposeForm({ ...disposeForm, disposalReason: e.target.value })} placeholder={t("بيع · تلف · استبدال", "Sale · Damage · Replacement")} /></div>
                <Button type="button" variant="outline" onClick={handleDispose} disabled={disposeBusy} className="w-full border-amber-300 text-amber-800 hover:bg-amber-100">{disposeBusy ? "..." : t("تأكيد الإخراج", "Confirm disposal")}</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => handleRestore(selectedAsset.id)} className="w-full border-border"><RotateCcw className="me-2 h-4 w-4" />{t("إعادة إلى نشط (الإخراج كان بالخطأ)", "Restore to active (disposal was a mistake)")}</Button>
            )}

            <div className="flex gap-2 pt-2 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => { setSelectedAsset(null); openEdit(selectedAsset); }} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
              <Button type="button" variant="outline" onClick={() => setPendingDelete(selectedAsset.id)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
            </div>
            {pendingDelete === selectedAsset.id && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700 mb-2">{t("حذف الأصل نهائياً؟ يُستخدم عند تسجيله بالخطأ.", "Delete this asset permanently? Use when it was registered by mistake.")}</p>
                <InlineConfirm onConfirm={() => handleDelete(selectedAsset.id)} onCancel={() => setPendingDelete(null)} />
              </div>
            )}
          </div>
        )}
      </SidePanel>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
