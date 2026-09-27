import { displayLocale } from "../lib/number-display";
/**
 * Fixed Asset full page — the app-wide standard (no slide-overs):
 *   /app/assets/new  → register form (auto-generated editable code FA-0001…)
 *   /app/assets/:id  → asset detail (account links, purchase link,
 *                      dispose/restore, edit, delete)
 *
 * Xero-style behavior note: posting a purchase (bill/expense) to an account
 * inside the assets branch of the chart queues the asset for review —
 * manual registration here is for assets acquired outside purchases.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Archive, ArrowRight, Building2, Edit2, ExternalLink, Loader2, RotateCcw,
  Save, Sparkles, Trash2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { InlineAlert, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { SearchableCombobox } from "../components/searchable-combobox";
import { api, ApiError, Account, type AssetIntakeCandidate } from "../lib/api";
import { displayName, secondaryName } from "../lib/display-name";
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
  const [params] = useSearchParams();
  const intakeKey = params.get("intake");
  const [candidate, setCandidate] = useState<AssetIntakeCandidate | null>(null);
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
      if (intakeKey) {
        setLoading(true);
        try {
          const pending = await api.fixedAssets.intake();
          const source = pending.items.find(item => item.sourceKey === intakeKey);
          if (!source) throw new Error("source_unavailable");
          setCandidate(source);
          setForm(f => ({...f, code:source.code || f.code, name:source.name, accountId:source.accountId || "", acquisitionDate:source.acquisitionDate.slice(0,10), acquisitionCost:source.currency === source.baseCurrency ? source.acquisitionCost : "", usefulLifeYears:""}));
        } catch { setError(t("البند غير متاح أو تمت مراجعته. ارجع لقائمة الأصول وحدّثها.", "The source is unavailable or already reviewed. Return to assets and refresh.")); }
        finally { setLoading(false); }
      }
      return;
    }
    setLoading(true);
    try {
      const a = await api.fixedAssets.get(id!) as any;
      applyAsset(a);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل تحميل الأصل", "Failed to load asset"));
    } finally { setLoading(false); }
  }, [id, isNew, intakeKey, applyAsset, t]);
  useEffect(() => { load(); }, [load]);

  const assetAccounts = accounts.filter(a => a.type === "ASSET").map(a => ({ id: a.id, label: `${a.code} · ${displayName(a)}`, sublabel: secondaryName(a) || undefined }));
  const expenseAccounts = accounts.filter(a => a.type === "EXPENSE").map(a => ({ id: a.id, label: `${a.code} · ${displayName(a)}`, sublabel: secondaryName(a) || undefined }));
  const accountLabel = (accountId?: string | null) => {
    if (!accountId) return "—";
    const a = accounts.find(x => x.id === accountId);
    return a ? `${a.code} · ${a.name}` : "—";
  };
  const formatMoney = (value: any) => Number(value || 0).toLocaleString(displayLocale(undefined), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.acquisitionCost) { setError(t("الرمز والاسم والتكلفة مطلوبة", "Code, name and cost are required")); return; }
    if (intakeKey && !candidate) return;
    setBusy(true); setError(null);
    try {
      const payload = {
        code: form.code.trim(), name: form.name.trim(), category: form.category || null,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: Number(form.acquisitionCost),
        salvageValue: Number(form.salvageValue) || 0,
        usefulLifeYears: Number(form.usefulLifeYears),
        accountId: form.accountId || null,
        depreciationExpenseAccountId: form.depreciationExpenseAccountId || null,
        accumulatedDepreciationAccountId: form.accumulatedDepreciationAccountId || null,
        purchaseBillId: form.purchaseBillId || null,
        purchaseExpenseId: form.purchaseExpenseId || null,
        notes: form.notes || null,
      };
      const saved = candidate ? await api.fixedAssets.registerIntake({...payload, sourceKey:candidate.sourceKey, fingerprint:candidate.fingerprint}) : isNew ? await api.fixedAssets.create(payload) : await api.fixedAssets.update(id!, payload);
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
      {error && <InlineAlert tone="critical">{error}</InlineAlert>}
      {candidate && <InlineAlert tone="info">{t("من المستند", "From document")} {candidate.sourceNumber} · {candidate.acquisitionCost} {candidate.currency}. {t("أكد تكلفة الأصل بعملة الشركة", "Confirm asset cost in company currency")} ({candidate.baseCurrency}). {t("التسجيل هنا لا ينشئ قيدًا ماليًا آخر.", "Registration does not create another journal entry.")}</InlineAlert>}
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
                      className="shrink-0 rounded-md border border-border px-2 text-primary hover:bg-info-subtle"
                    ><Sparkles className="h-4 w-4" /></button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{t("يتولّد تلقائياً ويبقى قابلاً للتعديل", "Auto-generated · stays editable")}</p>
              </div>
              <div className="space-y-2"><Label>{t("التصنيف", "Category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t("مكاتب · معدات · عقار", "Office · Equipment · Property")} /></div>
            </div>
            <div className="space-y-2"><Label>{t("اسم الأصل", "Asset name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("جهاز كمبيوتر مكتبي", "Desktop computer")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("تاريخ الاقتناء", "Acquisition date")} *</Label><DateInput disabled={!!candidate} value={form.acquisitionDate} onChange={(iso) => setForm({ ...form, acquisitionDate: iso })} required inputClassName="" /></div>
              <div className="space-y-2"><Label>{t("العمر الإنتاجي (سنوات)", "Useful life (years)")} *</Label><Input aria-label={t("العمر الإنتاجي (سنوات)", "Useful life (years)")} type="number" min="1" max="200" required value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("التكلفة", "Cost")} *</Label><Input type="number" step="0.01" min="0" required value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("القيمة المتبقية", "Salvage value")}</Label><Input type="number" step="0.01" min="0" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("اختياري", "Optional")} /></div>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/[0.02]">
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الربط المحاسبي", "Accounting links")}</div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                {t("حدد حسابات الإهلاك للربط والمراجعة. تسجيل الأصل وتعديل بياناته لا ينشئ قيود إهلاك أو إخراج تلقائيًا.", "Choose depreciation accounts for reference and review. Registering or editing an asset does not automatically post depreciation or disposal entries.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("حساب الأصل", "Asset account")}</Label>
              <SearchableCombobox disabled={!!candidate} value={form.accountId} onChange={(accountId) => setForm({ ...form, accountId })} items={assetAccounts} placeholder={t("اختر حساب الأصل...", "Choose asset account...")} />
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

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-background py-3">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/assets") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy || (!!intakeKey && !candidate)} className="min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("تسجيل الأصل", "Register asset") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = asset && (
    <div className="space-y-5">
      {asset.sourceJournal && <p className="rounded-lg border border-border p-3 text-sm">{t("القيد المصدر", "Source journal")}: <span dir="ltr">{asset.sourceJournal.entryNumber}</span> · {asset.sourceJournal.isPosted ? t("مرحّل", "Posted") : t("يحتاج مراجعة", "Needs review")}</p>}
      {(asset.purchaseBillId || asset.purchaseExpenseId) && (
        <button
          type="button"
          onClick={() => navigate(asset.purchaseBillId ? `/app/purchases/bills` : `/app/expenses`)}
          className="flex w-full items-center justify-between rounded-lg border border-primary/30 bg-info-subtle/50 px-3 py-2 text-sm text-primary hover:bg-info-subtle"
        >
          <span>{asset.purchaseBillId ? t("مرتبط بفاتورة مشتريات · عرض", "Linked to a purchase bill · view") : t("مرتبط بمصروف · عرض", "Linked to an expense · view")}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="min-w-0 rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("التكلفة", "Cost")}</div>
          <div className="mt-1 truncate font-display text-lg tabular-nums text-foreground" dir="ltr">{formatMoney(asset.acquisitionCost)}</div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("القيمة المتبقية", "Salvage Value")}</div>
          <div className="mt-1 truncate font-display text-lg tabular-nums text-foreground" dir="ltr">{formatMoney(asset.salvageValue)}</div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("تاريخ الاقتناء", "Acquisition Date")}</div>
          <div className="mt-1 truncate font-english tabular-nums text-foreground" dir="ltr">{asset.acquisitionDate?.slice(0, 10)}</div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("العمر الإنتاجي", "Useful Life")}</div>
          <div className="mt-1 truncate text-foreground" style={{ fontWeight: 700 }}><span className="font-english tabular-nums">{asset.usefulLifeYears}</span> {t("سنة", "years")}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
        <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("الربط المحاسبي", "Accounting links")}</div>
        <div className="flex justify-between gap-2"><span className="shrink-0 text-muted-foreground">{t("حساب الأصل", "Asset account")}</span><span className="min-w-0 truncate font-english text-foreground" dir="ltr" title={accountLabel(asset.accountId)}>{accountLabel(asset.accountId)}</span></div>
        <div className="flex justify-between gap-2"><span className="shrink-0 text-muted-foreground">{t("مصروف الإهلاك", "Depreciation expense")}</span><span className="min-w-0 truncate font-english text-foreground" dir="ltr" title={accountLabel(asset.depreciationExpenseAccountId)}>{accountLabel(asset.depreciationExpenseAccountId)}</span></div>
        <div className="flex justify-between gap-2"><span className="shrink-0 text-muted-foreground">{t("مجمع الإهلاك", "Accumulated depreciation")}</span><span className="min-w-0 truncate font-english text-foreground" dir="ltr" title={accountLabel(asset.accumulatedDepreciationAccountId)}>{accountLabel(asset.accumulatedDepreciationAccountId)}</span></div>
      </div>

      {asset.status === "DISPOSED" && (
        <div className="rounded-lg border border-border bg-surface-subtle p-3 space-y-1 text-sm">
          <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("بيانات الإخراج", "Disposal details")}</div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("التاريخ", "Date")}</span><span className="font-english" dir="ltr">{asset.disposalDate?.slice(0, 10) || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("مبلغ التصرف", "Disposal amount")}</span><span className="font-english" dir="ltr">{formatMoney(asset.disposalAmount)}</span></div>
          {asset.disposalReason && <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("السبب", "Reason")}</span><span>{asset.disposalReason}</span></div>}
        </div>
      )}

      {asset.status === "ACTIVE" ? (
        <div className="rounded-lg border border-warning-border bg-warning-subtle/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-warning" style={{ fontWeight: 600 }}><Archive className="h-3.5 w-3.5" />{t("إخراج الأصل (بيع/تخلص)", "Dispose asset (sell/write-off)")}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">{t("تاريخ الإخراج", "Disposal date")}</Label><DateInput value={disposeForm.disposalDate} onChange={(iso) => setDisposeForm({ ...disposeForm, disposalDate: iso })} inputClassName="" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("مبلغ التصرف", "Disposal amount")}</Label><Input type="number" step="0.01" min="0" value={disposeForm.disposalAmount} onChange={(e) => setDisposeForm({ ...disposeForm, disposalAmount: e.target.value })} dir="ltr" className="font-english" placeholder="0" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("السبب", "Reason")}</Label><Input value={disposeForm.disposalReason} onChange={(e) => setDisposeForm({ ...disposeForm, disposalReason: e.target.value })} placeholder={t("بيع · تلف · استبدال", "Sale · Damage · Replacement")} /></div>
          <Button type="button" variant="outline" onClick={handleDispose} disabled={disposeBusy} className="w-full border-warning-border text-warning hover:bg-warning-subtle">{disposeBusy ? "..." : t("تأكيد الإخراج", "Confirm disposal")}</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={handleRestore} className="w-full border-border"><RotateCcw className="me-2 h-4 w-4" />{t("إعادة إلى نشط (الإخراج كان بالخطأ)", "Restore to active (disposal was a mistake)")}</Button>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-danger-border text-danger hover:bg-danger-subtle"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-danger-border bg-danger-subtle p-3">
          <p className="text-xs text-danger mb-2">{t("حذف الأصل نهائياً؟ يُستخدم عند تسجيله بالخطأ.", "Delete this asset permanently? Use when it was registered by mistake.")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <PageHeader
        eyebrow={(
          <Link to="/app/assets" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" strokeWidth={1.75} /> {t("المحاسبة", "Accounting")} · {t("العودة للأصول الثابتة", "Back to Fixed Assets")}
          </Link>
        )}
        title={isNew ? t("أصل ثابت جديد", "New Fixed Asset") : <bdi dir="auto">{asset?.name || t("الأصل", "Asset")}</bdi>}
        description={(
          <>
            {!isNew && asset && (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-code text-xs text-foreground" dir="ltr">{asset.code}</span>
                <StatusBadge tone={asset.status === "ACTIVE" ? "success" : "neutral"}>
                  {asset.status === "ACTIVE" ? t("نشط", "Active") : t("مُخرج", "Disposed")}
                </StatusBadge>
                <span className="text-xs text-muted-foreground"><bdi dir="auto">{asset.category || t("بدون تصنيف", "Uncategorized")}</bdi></span>
              </span>
            )}
            {isNew && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {t("سجل الأصل أو راجع البيانات القادمة من المشتريات والقيود", "Register an asset or review source information from purchases and journals")}
              </span>
            )}
          </>
        )}
      />

      {error && !editMode && <InlineAlert tone="critical">{error}</InlineAlert>}

      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
