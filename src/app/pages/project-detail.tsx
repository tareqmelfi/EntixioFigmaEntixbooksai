/**
 * Project full page — app-wide standard (no slide-overs):
 *   /app/projects/new  → create form
 *   /app/projects/:id  → project detail (edit, status, delete)
 *
 * Status uses segmented buttons (enums are NEVER dropdowns in this app).
 * W5 will extend this page with contractor payments, hours and performance.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Edit2, FolderKanban, Loader2, Save, Trash2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DateInput } from "../components/date-input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  ACTIVE: { ar: "نشط", en: "Active" }, ON_HOLD: { ar: "متوقف", en: "On Hold" },
  COMPLETED: { ar: "مكتمل", en: "Completed" }, CANCELLED: { ar: "ملغي", en: "Cancelled" },
};
const STATUS_ORDER = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

const EMPTY_FORM = { code: "", name: "", startDate: "", endDate: "", status: "ACTIVE" };

export function ProjectDetail() {
  const { t, language } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);

  const applyProject = useCallback((p: any) => {
    setProject(p);
    setForm({
      code: p.code || "", name: p.name || "",
      startDate: (p.startDate || "").slice(0, 10), endDate: (p.endDate || "").slice(0, 10),
      status: p.status || "ACTIVE",
    });
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try { applyProject(await api.projects.get(id!)); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل تحميل المشروع", "Failed to load project")); }
    finally { setLoading(false); }
  }, [id, isNew, applyProject, t]);
  useEffect(() => { load(); }, [load]);

  const statusLabel = (s: string) => STATUS_LABELS[s] ? (language === "ar" ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en) : s;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { setError(t("الرمز والاسم مطلوبان", "Code and name are required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = { code: form.code.trim(), name: form.name.trim(), startDate: form.startDate || null, endDate: form.endDate || null, status: form.status };
      const saved = isNew ? await api.projects.create(payload) : await api.projects.update(id!, payload);
      push("success", isNew ? t("تم إنشاء المشروع", "Project created") : t("تم تحديث المشروع", "Project updated"));
      if (isNew) navigate(`/app/projects/${saved.id}`, { replace: true });
      else { applyProject(saved); setEditMode(false); }
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    try {
      await api.projects.remove(id!);
      push("success", t("تم حذف المشروع", "Project deleted"));
      navigate("/app/projects");
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const formView = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("بيانات المشروع", "Project details")}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("الرمز", "Code")} *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="PRJ-001" dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("اسم المشروع", "Project name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("مشروع تطوير التطبيق", "App development project")} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("تاريخ البداية", "Start date")}</Label><DateInput value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} inputClassName="" /></div>
            <div className="space-y-2"><Label>{t("تاريخ النهاية", "End date")}</Label><DateInput value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} inputClassName="" /></div>
          </div>
          <div className="space-y-2">
            <Label>{t("الحالة", "Status")}</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${form.status === s ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}
                >{statusLabel(s)}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-[#F7F9FC] py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/projects") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("إنشاء المشروع", "Create project") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const detailView = project && (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الحالة", "Status")}</div>
          <div className="mt-1"><span className={`text-xs px-2 py-0.5 rounded-full ${project.status === "ACTIVE" ? "bg-green-100 text-green-700" : project.status === "ON_HOLD" ? "bg-amber-100 text-amber-700" : project.status === "COMPLETED" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{statusLabel(project.status)}</span></div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("البداية", "Start")}</div>
          <div className="font-english text-foreground mt-1" dir="ltr">{project.startDate?.slice(0, 10) || "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("النهاية", "End")}</div>
          <div className="font-english text-foreground mt-1" dir="ltr">{project.endDate?.slice(0, 10) || "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("الرمز", "Code")}</div>
          <div className="font-english text-primary mt-1" style={{ fontWeight: 700 }} dir="ltr">{project.code}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{t("حذف المشروع نهائياً؟", "Delete this project permanently?")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/projects" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للمشاريع", "Back to Projects")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("مشروع جديد", "New Project") : (project?.name || t("المشروع", "Project"))}
        </h1>
        {isNew && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><FolderKanban className="h-4 w-4" />{t("أنشئ مشروعاً واربطه بالفواتير والمصروفات والمقاولين", "Create a project and link it to invoices, expenses and contractors")}</p>}
      </div>
      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
