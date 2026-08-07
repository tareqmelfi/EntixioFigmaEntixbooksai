/**
 * Cost Center full page — app-wide standard (no slide-overs):
 *   /app/cost-centers/new  → create form
 *   /app/cost-centers/:id  → detail (edit, deactivate)
 *
 * Note: delete is a soft deactivate (isActive=false) so historical
 * transactions keep their cost-center link.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Edit2, Loader2, Save, Target, Trash2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function CostCenterDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ code: "", name: "" });
  const [cc, setCc] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);

  const applyCc = useCallback((x: any) => {
    setCc(x);
    setForm({ code: x.code || "", name: x.name || "" });
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try { applyCc(await api.costCenters.get(id!)); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل تحميل مركز التكلفة", "Failed to load cost center")); }
    finally { setLoading(false); }
  }, [id, isNew, applyCc, t]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setError(t("الرمز والاسم مطلوبان", "Code and name are required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = { code: form.code.trim(), name: form.name.trim() };
      const saved = isNew ? await api.costCenters.create(payload) : await api.costCenters.update(id!, payload);
      push("success", isNew ? t("تم إنشاء مركز التكلفة", "Cost center created") : t("تم تحديث مركز التكلفة", "Cost center updated"));
      if (isNew) navigate(`/app/cost-centers/${saved.id}`, { replace: true });
      else { applyCc(saved); setEditMode(false); }
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    try {
      await api.costCenters.remove(id!);
      push("success", t("تم إيقاف مركز التكلفة", "Cost center deactivated"));
      navigate("/app/cost-centers");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الإيقاف", "Deactivate failed")); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const formView = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات مركز التكلفة", "Cost center details")}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("الرمز", "Code")} *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CC-001" dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("الاسم", "Name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("قسم المبيعات", "Sales department")} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/cost-centers") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("إنشاء المركز", "Create cost center") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = cc && (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الرمز", "Code")}</div>
          <div className="font-english text-primary mt-1" style={{ fontWeight: 700 }} dir="ltr">{cc.code}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الاسم", "Name")}</div>
          <div className="text-foreground mt-1" style={{ fontWeight: 600 }}>{cc.name}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{t("إيقاف مركز التكلفة؟ القيود التاريخية تحتفظ بربطها.", "Deactivate this cost center? Historical entries keep their link.")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/cost-centers" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة لمراكز التكلفة", "Back to Cost Centers")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("مركز تكلفة جديد", "New Cost Center") : (cc?.name || t("مركز التكلفة", "Cost Center"))}
        </h1>
        {isNew && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Target className="h-4 w-4" />{t("تتبع المصاريف والإيرادات حسب مركز التكلفة", "Track expenses and revenue by cost center")}</p>}
      </div>
      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
