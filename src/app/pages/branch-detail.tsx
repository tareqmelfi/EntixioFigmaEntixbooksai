/**
 * Branch full page — app-wide standard (no slide-overs):
 *   /app/branches/new  → create form
 *   /app/branches/:id  → detail (edit, deactivate)
 *
 * Delete is a soft deactivate (isActive=false) so historical links survive.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Edit2, GitBranch, Loader2, Save, Trash2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function BranchDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [branch, setBranch] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);

  const applyBranch = useCallback((b: any) => {
    setBranch(b);
    setForm({ name: b.name || "", code: b.code || "", address: b.address || "" });
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try { applyBranch(await api.branches.get(id!)); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل تحميل الفرع", "Failed to load branch")); }
    finally { setLoading(false); }
  }, [id, isNew, applyBranch, t]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("الاسم مطلوب", "Name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = { name: form.name.trim(), code: form.code.trim() || undefined, address: form.address.trim() || undefined };
      const saved = isNew ? await api.branches.create(payload) : await api.branches.update(id!, payload);
      push("success", isNew ? t("تم إنشاء الفرع", "Branch created") : t("تم تحديث الفرع", "Branch updated"));
      if (isNew) navigate(`/app/branches/${saved.id}`, { replace: true });
      else { applyBranch(saved); setEditMode(false); }
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    try {
      await api.branches.remove(id!);
      push("success", t("تم إيقاف الفرع", "Branch deactivated"));
      navigate("/app/branches");
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
          <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات الفرع", "Branch details")}</div>
          <div className="space-y-2"><Label>{t("الاسم", "Name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("فرع الرياض", "Riyadh branch")} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("الرمز", "Code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RUH" dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("العنوان", "Address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("الرياض · حي الورود", "Riyadh · Al-Wurud dist.")} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-[#F7F9FC] py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/branches") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("إنشاء الفرع", "Create branch") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = branch && (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الاسم", "Name")}</div>
          <div className="text-foreground mt-1" style={{ fontWeight: 600 }}>{branch.name}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الرمز", "Code")}</div>
          <div className="font-english text-foreground mt-1" dir="ltr">{branch.code || "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("العنوان", "Address")}</div>
          <div className="text-foreground mt-1">{branch.address || "—"}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{t("إيقاف الفرع؟ القيود التاريخية تحتفظ بربطها.", "Deactivate this branch? Historical entries keep their link.")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/branches" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للفروع", "Back to Branches")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("فرع جديد", "New Branch") : (branch?.name || t("الفرع", "Branch"))}
        </h1>
        {isNew && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><GitBranch className="h-4 w-4" />{t("أضف فرعاً جديداً للشركة", "Add a new company branch")}</p>}
      </div>
      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
