/**
 * Contractor full page — app-wide standard:
 *   /app/contractors/new  → register form (auto CTR-001)
 *   /app/contractors/:id  → profile + stats + peer comparison + engagements
 *                           + work logs + payments + pay/log actions
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowRight, Banknote, Clock3, Edit2, HardHat, Loader2, Save, Sparkles,
  Star, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hrs = (v: any) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });

const KIND_LABELS: Record<string, { ar: string; en: string; bg: string }> = {
  FREELANCER: { ar: "فريلانسر", en: "Freelancer", bg: "bg-blue-100 text-blue-700" },
  CONTRACTOR: { ar: "مقاول", en: "Contractor", bg: "bg-amber-100 text-amber-700" },
  AGENCY: { ar: "وكالة", en: "Agency", bg: "bg-violet-100 text-violet-700" },
};

const EMPTY_FORM = {
  code: "", name: "", kind: "FREELANCER" as "FREELANCER" | "CONTRACTOR" | "AGENCY",
  specialty: "", nationalId: "", email: "", phone: "",
  hourlyRate: "", dayRate: "", rating: "", notes: "",
};

export function ContractorDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { toasts, push, dismiss } = useToasts();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [person, setPerson] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingLogDelete, setPendingLogDelete] = useState<string | null>(null);
  const [pendingPayDelete, setPendingPayDelete] = useState<string | null>(null);

  const applyPerson = useCallback((x: any) => {
    setPerson(x);
    setForm({
      code: x.code || "", name: x.name || "", kind: x.kind || "FREELANCER",
      specialty: x.specialty || "", nationalId: x.nationalId || "", email: x.email || "", phone: x.phone || "",
      hourlyRate: x.hourlyRate != null ? String(x.hourlyRate) : "", dayRate: x.dayRate != null ? String(x.dayRate) : "",
      rating: x.rating != null ? String(x.rating) : "", notes: x.notes || "",
    });
  }, []);

  const load = useCallback(async () => {
    if (isNew) {
      try { const { code } = await api.contractors.nextCode(); setForm((f) => ({ ...f, code })); } catch { /* manual */ }
      return;
    }
    setLoading(true);
    try { applyPerson(await api.contractors.get(id!)); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل تحميل المقاول", "Failed to load contractor")); }
    finally { setLoading(false); }
  }, [id, isNew, applyPerson, t]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("الاسم مطلوب", "Name is required")); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        code: form.code.trim() || undefined, name: form.name.trim(), kind: form.kind,
        specialty: form.specialty || null, nationalId: form.nationalId || null,
        email: form.email || null, phone: form.phone || null,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
        dayRate: form.dayRate ? Number(form.dayRate) : null,
        rating: form.rating ? Number(form.rating) : null,
        notes: form.notes || null,
      };
      const saved = isNew ? await api.contractors.create(payload) : await api.contractors.update(id!, payload);
      push("success", isNew ? t("تم تسجيل المقاول", "Contractor registered") : t("تم تحديث المقاول", "Contractor updated"));
      if (isNew) navigate(`/app/contractors/${saved.id}`, { replace: true });
      else { applyPerson({ ...person, ...saved }); setEditMode(false); load(); }
    } catch (e: any) {
      setError(e instanceof ApiError ? (e.message === "code_exists" ? t("الرمز موجود", "Code already exists") : e.message) : t("فشل الحفظ", "Save failed"));
    } finally { setBusy(false); }
  };

  const handleDeactivate = async () => {
    try {
      const x = await api.contractors.deactivate(id!);
      applyPerson({ ...person, ...x });
      push("success", x.isActive ? t("أُعيد تفعيله", "Reactivated") : t("أُوقف (سجله محفوظ)", "Deactivated (history kept)"));
      load();
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
  };

  const handleDelete = async () => {
    try {
      await api.contractors.remove(id!);
      push("success", t("تم حذف المقاول", "Contractor deleted"));
      navigate("/app/contractors");
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message === "has_history" ? t("له ساعات/مدفوعات مسجلة — أوقفه بدل الحذف", "Has hours/payments — deactivate instead") : t("فشل الحذف", "Delete failed"));
    }
  };

  const handleDeleteLog = async (logId: string) => {
    setPendingLogDelete(null);
    try { await api.contractors.deleteWorkLog(logId); push("success", t("حُذف السجل", "Log deleted")); load(); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
  };

  const handleDeletePayment = async (payId: string) => {
    setPendingPayDelete(null);
    try { await api.contractors.deletePayment(payId); push("success", t("حُذفت الدفعة وقيدها", "Payment and its entry deleted")); load(); }
    catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
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
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("البيانات", "Details")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("الرمز", "Code")}</Label>
                <div className="flex gap-1.5">
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CTR-001" dir="ltr" className="font-english" />
                  {isNew && (
                    <button type="button" onClick={async () => { try { const { code } = await api.contractors.nextCode(); setForm((f) => ({ ...f, code })); } catch { /* keep */ } }}
                      title={t("توليد تلقائي", "Auto-generate")} className="shrink-0 rounded-md border border-border px-2 text-primary hover:bg-blue-50">
                      <Sparkles className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2"><Label>{t("التخصص", "Specialty")}</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder={t("تصميم · مونتاج · كهرباء · محاماة", "Design · editing · electrical · legal")} /></div>
            </div>
            <div className="space-y-2"><Label>{t("الاسم *", "Name *")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("اسم الفريلانسر أو المقاول أو الوكالة", "Freelancer, contractor or agency name")} /></div>
            <div className="space-y-2">
              <Label>{t("النوع", "Kind")}</Label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(KIND_LABELS) as Array<keyof typeof KIND_LABELS>).map((k) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, kind: k as typeof form.kind })}
                    className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${form.kind === k ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/50"}`}>
                    {t(KIND_LABELS[k].ar, KIND_LABELS[k].en)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("الهوية / السجل", "ID / CR")}</Label><Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("الجوال", "Mobile")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="space-y-2"><Label>{t("البريد", "Email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="font-english" /></div>
            <div className="space-y-2"><Label>{t("ملاحظات", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/[0.02]">
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("الأسعار والتقييم", "Rates & rating")}</div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-5">{t("سعر الساعة الافتراضي يُستخدم عند تسجيل الساعات — ويمكن تثبيت سعر مختلف لكل مشروع عند الإشراك.", "The default hourly rate applies when logging hours — a different rate can be fixed per project at engagement.")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("سعر الساعة", "Hourly rate")}</Label><Input type="number" step="0.01" min="0" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} dir="ltr" className="font-english" /></div>
              <div className="space-y-2"><Label>{t("سعر اليومية", "Day rate")}</Label><Input type="number" step="0.01" min="0" value={form.dayRate} onChange={(e) => setForm({ ...form, dayRate: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="space-y-2">
              <Label>{t("تقييمك له (1-5)", "Your rating (1-5)")}</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button key={r} type="button" onClick={() => setForm({ ...form, rating: form.rating === String(r) ? "" : String(r) })}
                    className={`rounded-md p-2 transition-colors ${Number(form.rating) >= r ? "text-amber-500" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`}>
                    <Star className={`h-5 w-5 ${Number(form.rating) >= r ? "fill-current" : ""}`} />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-muted/50 py-3 -mx-1 px-1">
        <Button type="button" variant="outline" onClick={() => (isNew ? navigate("/app/contractors") : setEditMode(false))}>{t("إلغاء", "Cancel")}</Button>
        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 min-w-[140px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" />{isNew ? t("تسجيل المقاول", "Register contractor") : t("حفظ التغييرات", "Save changes")}</>}
        </Button>
      </div>
    </form>
  );

  const stats = person?.stats;
  const peers = person?.peers;
  const detailView = person && (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate(`/app/contractors/${person.id}/pay`)}>
          <Banknote className="me-2 h-4 w-4" />{t("ادفع له الآن", "Pay now")}
        </Button>
        <Button variant="outline" onClick={() => navigate(`/app/work-logs/new?contractor=${person.id}`)}>
          <Clock3 className="me-2 h-4 w-4" />{t("سجّل ساعات", "Log hours")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("ساعات العمل", "Hours worked")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.25rem" }} dir="ltr">{hrs(stats?.totalHours)}</div>
          <div className="text-[10px] text-muted-foreground">{t("قابلة للفوترة:", "billable:")} <span className="font-english">{hrs(stats?.billableHours)}</span></div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("مستحقاته (مكتسبة)", "Earned")}</div>
          <div className="font-english text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.25rem" }} dir="ltr">{money(stats?.totalEarned)}</div>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="text-xs text-muted-foreground">{t("المدفوع", "Paid")}</div>
          <div className="font-english text-emerald-600 mt-1" style={{ fontWeight: 700, fontSize: "1.25rem" }} dir="ltr">{money(stats?.totalPaid)}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs text-amber-800">{t("المتبقي له", "Outstanding")}</div>
          <div className="font-english text-amber-700 mt-1" style={{ fontWeight: 700, fontSize: "1.25rem" }} dir="ltr">{money(stats?.outstanding)}</div>
        </div>
      </div>

      {/* Peer comparison — the invention: أداؤه مقارنة بالمشابهين */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2"><CardTitle className="text-foreground text-base">{t("مقارنة بالمشابهين (السوق الداخلي)", "Peer benchmark (your market)")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              label: t("متوسط سعر الساعة", "Avg hourly rate"),
              value: stats?.avgRate, peer: peers?.avgRate, fmt: money, invert: true,
            },
            {
              label: t("عدد المشاريع", "Projects count"),
              value: stats?.projectsCount, peer: peers?.avgProjects, fmt: (v: any) => Number(v || 0).toFixed(1), invert: false,
            },
          ].map((row, i) => {
            const v = row.value != null ? Number(row.value) : null;
            const p = row.peer != null ? Number(row.peer) : null;
            const diff = v != null && p != null && p > 0 ? ((v - p) / p) * 100 : null;
            const good = diff == null ? null : (row.invert ? diff < 0 : diff > 0);
            return (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <div className="flex items-center gap-3 font-english" dir="ltr">
                  <span style={{ fontWeight: 700 }}>{v != null ? row.fmt(v) : "—"}</span>
                  <span className="text-xs text-muted-foreground">/ {t("الأقران", "peers")} {p != null ? row.fmt(p) : "—"}</span>
                  {diff != null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${good ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground leading-5">{t("السعر الأعلى من الأقران ليس بالضرورة سيئاً — قارنه بتقييمك له وبجودة تسليمه. المقاول الأغلى مع تقييم 5 نجوم قد يكون أوفر على المشروع كاملاً.", "Above-peer pricing isn't automatically bad — weigh it against your rating and delivery quality. A pricier 5-star contractor can be cheaper over the whole project.")}</p>
        </CardContent>
      </Card>

      {/* Engagements */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground text-base">{t("المشاريع المُشرَك فيها", "Engagements")} · {stats?.engagements?.filter((e: any) => e.status === "ACTIVE").length || 0}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!stats?.engagements || stats.engagements.filter((e: any) => e.status === "ACTIVE").length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("غير مُشرَك في أي مشروع — أشركه من صفحة المشروع", "Not engaged on any project — engage from the project page")}</div>
          ) : (
            <div className="divide-y divide-border/50">
              {stats.engagements.filter((e: any) => e.status === "ACTIVE").map((e: any) => (
                <button key={e.id} onClick={() => navigate(`/app/projects/${e.projectId}`)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 text-start">
                  <div>
                    <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{e.project?.name}</div>
                    <div className="text-xs text-muted-foreground">{e.role || e.rateType}</div>
                  </div>
                  <span className="font-english text-xs text-primary" dir="ltr">{e.agreedRate != null ? `${money(e.agreedRate)}/${e.rateType === "DAILY" ? t("يوم", "day") : e.rateType === "FIXED" ? t("ثابت", "fixed") : t("ساعة", "hr")}` : "—"}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work logs */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground text-base">{t("سجل الساعات", "Work logs")} · {person.workLogs?.length || 0}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!person.workLogs || person.workLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("لا توجد ساعات مسجلة", "No hours logged")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 text-start">{t("التاريخ", "Date")}</th>
                  <th className="py-2.5 px-4 text-start">{t("المشروع", "Project")}</th>
                  <th className="py-2.5 px-4 text-start">{t("الوصف", "Description")}</th>
                  <th className="py-2.5 px-4 text-start">{t("الساعات", "Hours")}</th>
                  <th className="py-2.5 px-4 text-start">{t("المبلغ", "Amount")}</th>
                  <th className="py-2.5 px-4 w-[60px]"></th>
                </tr></thead>
                <tbody>
                  {person.workLogs.map((l: any) => (
                    <tr key={l.id} className="border-b border-border/50 hover:bg-primary/5">
                      <td className="py-2.5 px-4 font-english text-xs text-muted-foreground" dir="ltr">{l.date?.slice(0, 10)}</td>
                      <td className="py-2.5 px-4 text-xs text-primary">{l.project?.name}</td>
                      <td className="py-2.5 px-4 text-xs text-foreground/80">{l.description || "—"} {!l.billable && <span className="text-[10px] text-gray-400">({t("غير قابل للفوترة", "non-billable")})</span>}</td>
                      <td className="py-2.5 px-4 font-english" dir="ltr">{hrs(l.hours)}</td>
                      <td className="py-2.5 px-4 font-english" style={{ fontWeight: 600 }} dir="ltr">{money(l.amount)}</td>
                      <td className="py-2.5 px-2">
                        {pendingLogDelete === l.id
                          ? <InlineConfirm onConfirm={() => handleDeleteLog(l.id)} onCancel={() => setPendingLogDelete(null)} />
                          : <button onClick={() => setPendingLogDelete(l.id)} className="rounded-md p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground text-base">{t("المدفوعات", "Payments")} · {person.payments?.length || 0}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!person.payments || person.payments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("لا توجد مدفوعات", "No payments yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 text-start">{t("التاريخ", "Date")}</th>
                  <th className="py-2.5 px-4 text-start">{t("المشروع", "Project")}</th>
                  <th className="py-2.5 px-4 text-start">{t("المبلغ", "Amount")}</th>
                  <th className="py-2.5 px-4 text-start">{t("القيد", "Entry")}</th>
                  <th className="py-2.5 px-4 w-[60px]"></th>
                </tr></thead>
                <tbody>
                  {person.payments.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-primary/5">
                      <td className="py-2.5 px-4 font-english text-xs text-muted-foreground" dir="ltr">{p.date?.slice(0, 10)}</td>
                      <td className="py-2.5 px-4 text-xs text-foreground/80">{p.project?.name || t("دفعة عامة", "General payment")}</td>
                      <td className="py-2.5 px-4 font-english text-emerald-700" style={{ fontWeight: 600 }} dir="ltr">{money(p.amount)}</td>
                      <td className="py-2.5 px-4 text-xs">{p.journalEntryId ? <span className="text-emerald-700">{t("مقيّد ✓", "posted ✓")}</span> : <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="py-2.5 px-2">
                        {pendingPayDelete === p.id
                          ? <InlineConfirm onConfirm={() => handleDeletePayment(p.id)} onCancel={() => setPendingPayDelete(null)} />
                          : <button onClick={() => setPendingPayDelete(p.id)} className="rounded-md p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={() => setEditMode(true)} className="flex-1 border-border min-w-[120px]"><Edit2 className="me-2 h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button type="button" variant="outline" onClick={handleDeactivate} className="border-border">
          {person.isActive ? t("إيقاف (يحتفظ بسجله)", "Deactivate (keeps history)") : t("إعادة تفعيل", "Reactivate")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setPendingDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {pendingDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700 mb-2">{t("حذف المقاول نهائياً؟ (يُسمح فقط بلا ساعات ولا مدفوعات)", "Delete permanently? (only with no hours and no payments)")}</p>
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setPendingDelete(false)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <Link to="/app/contractors" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
          <ArrowRight className="h-3.5 w-3.5" /> {t("العودة للمقاولين", "Back to Contractors")}
        </Link>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {isNew ? t("مقاول جديد", "New Contractor") : (person?.name || t("المقاول", "Contractor"))}
        </h1>
        {!isNew && person && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-english text-xs text-primary" dir="ltr">{person.code}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${(KIND_LABELS[person.kind] || KIND_LABELS.FREELANCER).bg}`}>{t((KIND_LABELS[person.kind] || KIND_LABELS.FREELANCER).ar, (KIND_LABELS[person.kind] || KIND_LABELS.FREELANCER).en)}</span>
            {person.rating != null && <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs font-english"><Star className="h-3 w-3 fill-current" />{Number(person.rating).toFixed(1)}</span>}
            <span className="text-xs text-muted-foreground">{person.specialty || ""}</span>
          </div>
        )}
        {isNew && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><HardHat className="h-4 w-4" />{t("المقاول يختلف عن مورد الشركة: تعاقد مباشر وساعات ودفع فوري بدون دورة فواتير شراء", "A contractor differs from a company supplier: direct engagement, hours and instant payment without a bill cycle")}</p>}
      </div>
      {error && !editMode && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {(isNew || editMode) ? formView : detailView}
    </div>
  );
}
