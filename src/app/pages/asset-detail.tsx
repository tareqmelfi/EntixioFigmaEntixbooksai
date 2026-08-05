/**
 * Fixed Asset full page — the app-wide standard (no slide-overs):
 *   /app/assets/new  → register form (auto-generated editable code FA-0001…)
 *   /app/assets/:id  → asset detail (account links, purchase link,
 *                      dispose/restore, edit, delete)
 *
 * Xero-style behavior note: posting a purchase (bill/expense) to an account
 * inside the assets branch of the chart registers the asset automatically —
 * manual registration here is for assets acquired outside purchases.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Archive, ArrowRight, Building2, Edit2, ExternalLink, Loader2, RotateCcw,
  Save, Sparkles, Trash2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
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

export function AssetDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [asset, setAsset] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [disposeForm, setDisposeForm] = useState({ disposalDate: new Date().toISOString().slice(0, 10), disposalAmount: "", disposalReason: "" });
  const [disposeBusy, setDisposeBusy] = useState(false);

  useEffect(() => {
    api.accounts.list().then((d) => setAccounts(d.items)).catch(() => {});
  }, []);

  const applyAsset = useCallback((a: any) => {
    setAsset(a);
    setForm({
      code: a.code || "", name: a.name || "", category: a.category || "",
      acquisitionDate: (a.acquisitionDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      acquisitionCost: String(a.acquisitionCost ?? ""), salvageValue: String(a.salvageValue ?? "0"), usefulLifeYears: String(a.usefulLifeYears ?? "5"),
      accountId: a.accountId || "", depreciationExpenseAccountId: a.depreciationExpenseAccountId || "", accumulatedDepreciationAccountId: a.accumulatedDepreciationAccountId || "",
      purchaseBillId: a.purchaseBillId || "", purchaseExpenseId: a.purchaseExpenseId || "", notes: a.notes || "",
    });
  }, []);

  const load = useCallback(async () => {
    if (isNew) {
      // Auto code · يتولد تلقائياً ويبقى قابلاً للتعديل
      try {
        const { code } = await api.fixedAssets.nextCode();
        setForm((f) => ({ ...f, code }));
      } catch { /* keep manual */ }
      return;
    }
    setLoading(true);
    try {
      const a = await api.fixedAssets.get(id!) as any;
      applyAsset(a);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل الأصل", "Failed to load asset"));
    } finally { setLoading(false); }
  }, [id, isNew, applyAsset, t]);
  useEffect(() => { load(); }, [load]);

  const assetAccounts = accounts.filter(a => a.type === "ASSET").map(a => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.nameAr || undefined }));
  const expenseAccounts = accounts.filter(a => a.type === "EXPENSE").map(a => ({ id: a.id, label: `${a.code} · ${a.name}`, sublabel: a.nameAr || undefined }));
  const accountLabel = (accountId?: string | null) => {
    if (!accountId) return "—";
    const a = accounts.find(x => x.id === accountId);
    return a ? `${a.code} · ${a.name}` : "—";
  };
  const formatMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

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
      const saved = isNew ? await api.fixedAssets.create(payload) : await api.fixedAssets.update(id!, payload);
      push("success", isNew ? t("تم تسجيل الأصل", "Asset registered") : t("تم تحديث الأصل", "Asset updated"));
      if (isNew) navigate("/app/assets");
      else { applyAsset(saved); setEditMode(false); }
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Failed to save"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    try {
      await api.fixedAssets.remove(id!);
      push("success", t("تم حذف الأصل", "Asset deleted"));
      navigate("/app/assets");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Failed to delete")); }
  };

  const handleDispose = async () => {
    setDisposeBusy(true);
    try {
      await api.fixedAssets.dispose(id!, {
        disposalDate: disposeForm.disposalDate,
        disposalAmount: Number(disposeForm.disposalAmount) || 0,
        disposalReason: disposeForm.disposalReason || null,
      });
      push("success", t("تم إخراج الأصل", "Asset disposed"));
      setDisposeForm({ disposalDate: new Date().toISOString().slice(0, 10), disposalAmount: "", disposalReason: "" });
      load();
    } catch (e: any) { push("error", e instanceof ApiError ? (e.message === "already_disposed" ? t("الأصل مُخرج مسبقاً", "Asset already disposed") : e.message) : t("فشل الإخراج", "Dispose failed")); }
    finally { setDisposeBusy(false); }
  };

  const handleRestore = async () => {
    try {
      await api.fixedAssets.restore(id!);
      push("success", t("تمت إعادة الأصل لنشط", "Asset restored to active"));
      load();
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشلت الاستعادة", "Restore failed")); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const formView = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات الأصل", "Asset details")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("الرمز", "Code")} *</Label>
                <div className="flex gap-1.5">
                  <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FA-0001" dir="ltr" className="font-english" />
                  {isNew && (
                    <button
                      type="button"
                      onClick={async () => { try { const { code } = await api.fixedAssets.nextCode(); setForm((f) => ({ ...f, code })); } catch { /* keep manual */ } }}
                      title={t("توليد تلقائي", "Auto-generate")}
                      className="shrink-0 rounded-md border border-border px-2 text-primary hover:bg-blue-50"
                    ><Sparkles className="h-4 w-4" /></button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{t("يتولّد تلقائياً ويبقى قابلاً للتعديل", "Auto-generated · stays editable")}</p>
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
            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("اختياري", "Optional")} /></div>
          </CardContent>
        </Card>

        <Card className="border-[#1276E3]/40 bg-primary/[0.02]">
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الربط المحاسبي", "Accounting links")}</div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                {t("الإهلاك السنوي يقيد تلقائياً بين حساب مصروف الإهلاك ومجمع الإهلاك، وعند الإخراج تُغلق التكلفة والمجمع.", "Annual depreciation posts automatically between the depreciation expense and accumulated accounts; on disposal, cost and accumulated close out.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("حساب الأصل", "Asset account")}</Label>
              <SearchableCombobox value={form.accountId} onChange={(accountId) => setForm({ ...form, accountId })} items={assetAccounts} placeholder={t("اختر حساب الأصل...", "Choose asset account...")} />
            </div>
            <div className="space-y-2">
              <Label>{t("حساب مصروف الإهلاك", "Depreciation expense account")}</Label>
              <SearchableCombobox value={form.depreciationExpenseAccountId} onChange={(depreciationExpenseAccountId) => setForm({ ...form, depreciationExpenseAccountId })} items={expenseAccounts} placeholder={t("اختر حساب مصروف الإهلاك...", "Choose depreciation expense account...")} />
            </div>
            <div className="space-y-2">
              <Label>{t("حساب مجمع الإهلاك", "Accumulated depreciation account")}</Label>
              <SearchableCombobox value={form.accumulatedDepreciationAccountId} onChange={(accumulatedDepreciationAccountId) => setForm({ ...form, accumulatedDepreciationAccountId })} items={assetAccounts} placeholder={t("اختر حساب مجمع الإهلاك...", "Choose accumulated depreciation account...")} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-[#F7F9FC] py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/assets") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("تسجيل الأصل", "Register asset") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = asset && (
    <div className="space-y-5">
      {(asset.purchaseBillId || asset.purchaseExpenseId) && (
        <button
          type="button"
          onClick={() => navigate(asset.purchaseBillId ? `/app/purchases/bills` : `/app/expenses`)}
          className="flex w-full items-center justify-between rounded-lg border border-primary/30 bg-blue-50/50 px-3 py-2 text-sm text-primary hover:bg-blue-50"
        >
          <span>{asset.purchaseBillId ? t("مرتبط بفاتورة مشتريات · عرض", "Linked to a purchase bill · view") : t("مرتبط بمصروف · عرض", "Linked to an expense · view")}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("التكلفة", "Cost")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{formatMoney(asset.acquisitionCost)}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("القيمة المتبقية", "Salvage Value")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700 }} dir="ltr">{formatMoney(asset.salvageValue)}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("تاريخ الاقتناء", "Acquisition Date")}</div>
          <div className="font-english text-foreground mt-1" dir="ltr">{asset.acquisitionDate?.slice(0, 10)}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("العمر الإنتاجي", "Useful Life")}</div>
          <div className="text-foreground mt-1" style={{ fontWeight: 700 }}>{asset.usefulLifeYears} {t("سنة", "years")}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 space-y-2 text-sm">
        <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("الربط المحاسبي", "Accounting links")}</div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("حساب الأصل", "Asset account")}</span><span className="font-english text-foreground" dir="ltr">{accountLabel(asset.accountId)}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("مصروف الإهلاك", "Depreciation expense")}</span><span className="font-english text-foreground" dir="ltr">{accountLabel(asset.depreciationExpenseAccountId)}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("مجمع الإهلاك", "Accumulated depreciation")}</span><span className="font-english text-foreground" dir="ltr">{accountLabel(asset.accumulatedDepreciationAccountId)}</span></div>
      </div>

      {asset.status === "DISPOSED" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 text-sm">
          <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("بيانات الإخراج", "Disposal details")}</div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("التاريخ", "Date")}</span><span className="font-english" dir="ltr">{asset.disposalDate?.slice(0, 10) || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("مبلغ التصرف", "Disposal amount")}</span><span className="font-english" dir="ltr">{formatMoney(asset.disposalAmount)}</span></div>
          {asset.disposalReason && <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("السبب", "Reason")}</span><span>{asset.disposalReason}</span></div>}
        </div>
      )}

      {asset.status === "ACTIVE" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-amber-800" style={{ fontWeight: 600 }}><Archive className="h-3.5 w-3.5" />{t("إخراج الأصل (بيع/تخلص)", "Dispose asset (sell/write-off)")}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">{t("تاريخ الإخراج", "Disposal date")}</Label><DateInput value={disposeForm.disposalDate} onChange={(iso) => setDisposeForm({ ...disposeForm, disposalDate: iso })} inputClassName="" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("مبلغ التصرف", "Disposal amount")}</Label><Input type="number" step="0.01" min="0" value={disposeForm.disposalAmount} onChange={(e) => setDisposeForm({ ...disposeForm, disposalAmount: e.target.value })} dir="ltr" className="font-english" placeholder="0" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("السبب", "Reason")}</Label><Input value={disposeForm.disposalReason} onChange={(e) => setDisposeForm({ ...disposeForm, disposalReason: e.target.value })} placeholder={t("بيع · تلف · استبدال", "Sale · Damage · Replacement")} /></div>
          <Button type="button" variant="outline" onClick={handleDispose} disabled={disposeBusy} className="w-full border-amber-300 text-amber-800 hover:bg-amber-100">{disposeBusy ? "..." : t("تأكيد الإخراج", "Confirm disposal")}</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={handleRestore} className="w-full border-border"><RotateCcw className="me-2 h-4 w-4" />{t("إعادة إلى نشط (الإخراج كان بالخطأ)", "Restore to active (disposal was a mistake)")}</Button>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{t("حذف الأصل نهائياً؟ يُستخدم عند تسجيله بالخطأ.", "Delete this asset permanently? Use when it was registered by mistake.")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/app/assets" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
            <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للأصول الثابتة", "Back to Fixed Assets")}
          </Link>
          <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
            {isNew ? t("أصل ثابت جديد", "New Fixed Asset") : (asset?.name || t("الأصل", "Asset"))}
          </h1>
          {!isNew && asset && (
            <div className="flex items-center gap-2 mt-1">
              <span className="font-english text-xs text-primary" dir="ltr">{asset.code}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${asset.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {asset.status === "ACTIVE" ? t("نشط", "Active") : t("مُخرج", "Disposed")}
              </span>
              <span className="text-xs text-muted-foreground">{asset.category || t("بدون تصنيف", "Uncategorized")}</span>
            </div>
          )}
          {isNew && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {t("التسجيل اليدوي للأصول المقتناة خارج المشتريات · الشراء على حساب أصل يسجّل تلقائياً", "Manual registration for assets acquired outside purchases · buying on an asset account auto-registers")}
            </p>
          )}
        </div>
      </div>

      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
