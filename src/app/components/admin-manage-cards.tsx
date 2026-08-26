/**
 * Admin Console v2 · Z2.2 management cards (2026-08-26)
 *
 *   <AdminOrgManageCard>  edit name/legal name/country/currency · suspend (reason) ·
 *                         delete (reason · 30-day grace) · restore
 *   <AdminUserManageCard> edit name/email · disable (reason) · enable
 *
 * UX-1: no dialogs — reasons are inline inputs, destructive steps use InlineConfirm
 * (3-second window), results go to the toast stack. Every action is audit-logged
 * server-side (AdminAudit).
 */
import { useState } from "react";
import { Ban, CheckCircle2, Loader2, Pencil, RotateCcw, Save, ShieldAlert, Trash2, UserX, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InlineConfirm } from "./side-panel";
import { api, ApiError, setOrgId } from "../lib/api";
import { startActAs } from "../lib/act-as";
import { invalidateOrgRegion } from "../lib/use-org-region";
import { useLanguage } from "./LanguageContext";

type Push = (kind: "success" | "error" | "info", msg: string) => void;
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function AdminOrgManageCard({ org, push, onChanged }: {
  org: { id: string; name: string; legalName?: string | null; country: string; baseCurrency: string; industry?: string | null; deletedAt?: string | null; suspendedAt?: string | null; suspendedReason?: string | null };
  push: Push;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: org.name, legalName: org.legalName || "", country: org.country, baseCurrency: org.baseCurrency, industry: org.industry || "" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"suspend" | "delete" | null>(null);
  const [actReason, setActReason] = useState("");

  const openAsAdmin = async () => {
    setBusy("act");
    try {
      const g = await api.admin.impersonate(org.id, actReason.trim());
      startActAs({ orgId: g.orgId, orgName: g.orgName, country: g.country, currency: g.baseCurrency, reason: g.reason, until: new Date(g.expiresAt).getTime() });
      setOrgId(g.orgId); invalidateOrgRegion();
      push("success", t(`فُتحت «${g.orgName}» بالنيابة · ${g.minutes} دقيقة`, `Opened “${g.orgName}” on behalf · ${g.minutes} min`));
      window.open("/app/dashboard", "_blank", "noopener");
    } catch (e) { push("error", errMsg(e, t("تعذر الفتح", "Could not open"))); }
    finally { setBusy(null); }
  };

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); push("success", ok); setConfirm(null); setReason(""); onChanged(); }
    catch (e) { push("error", errMsg(e, t("فشل الإجراء", "Action failed"))); }
    finally { setBusy(null); }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-primary" />{t("إدارة الشركة", "Manage company")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {org.deletedAt && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
            <Trash2 className="h-4 w-4" />{t("محذوفة (حذف ناعم) · يمكن استعادتها خلال فترة السماح", "Soft-deleted · restorable during the grace period")}
            <Button size="sm" variant="outline" className="ms-auto border-border" disabled={busy === "restore"} onClick={() => run("restore", () => api.admin.restoreOrg(org.id), t("استُعيدت الشركة", "Company restored"))}><RotateCcw className="me-1 h-3.5 w-3.5" />{t("استعادة", "Restore")}</Button>
          </div>
        )}
        {org.suspendedAt && !org.deletedAt && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-sm text-warning">
            <Ban className="h-4 w-4" />{t("موقوفة", "Suspended")}{org.suspendedReason ? ` · ${org.suspendedReason}` : ""}
            <Button size="sm" variant="outline" className="ms-auto border-border" disabled={busy === "unsuspend"} onClick={() => run("unsuspend", () => api.admin.updateOrg(org.id, { suspended: false }), t("رُفع الإيقاف", "Suspension lifted"))}><CheckCircle2 className="me-1 h-3.5 w-3.5" />{t("رفع الإيقاف", "Lift suspension")}</Button>
          </div>
        )}

        {/* Z2.3 · Open-as-admin */}
        {!org.deletedAt && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
            <Label className="text-xs">{t("فتح كأدمن — السبب إلزامي (10 أحرف+) · 60 دقيقة · كل إجراء يُسجَّل باسمك", "Open as admin — reason required (10+ chars) · 60 minutes · every action is logged under your name")}</Label>
            <div className="flex flex-wrap gap-2">
              <Input value={actReason} onChange={(e) => setActReason(e.target.value)} placeholder={t("مثال: تذكرة #123 · نقل بيانات بطلب المالك", "e.g. ticket #123 · data migration at the owner's request")} className="flex-1 min-w-[240px]" />
              <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={busy === "act" || actReason.trim().length < 10} onClick={() => void openAsAdmin()}>
                {busy === "act" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="me-1 h-3.5 w-3.5" />{t("فتح كأدمن", "Open as admin")}</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("يُفتح في تبويب جديد بشريط أحمر «تعمل بالنيابة». ممنوع أثناءه: مفاتيح API · حذف الشركة · Stripe checkout · كلمة مرور المالك.", "Opens in a new tab with a red «acting on behalf» strip. Blocked meanwhile: API keys · company delete · Stripe checkout · owner password.")}</p>
          </div>
        )}

        {/* Edit */}
        {editing ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">{t("الاسم", "Name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("الاسم القانوني", "Legal name")}</Label><Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("الدولة (ISO-2)", "Country (ISO-2)")}</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} dir="ltr" className="font-english" maxLength={2} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("العملة", "Currency")}</Label><Input value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value.toUpperCase() })} dir="ltr" className="font-english" maxLength={3} /></div>
              <div className="space-y-1 md:col-span-2"><Label className="text-xs">{t("النشاط", "Industry")}</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} dir="ltr" className="font-english" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="border-border" onClick={() => setEditing(false)}>{t("إلغاء", "Cancel")}</Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={busy === "edit" || form.name.trim().length < 2 || form.country.length !== 2 || form.baseCurrency.length !== 3}
                onClick={() => run("edit", () => api.admin.updateOrg(org.id, { name: form.name.trim(), legalName: form.legalName.trim() || null, country: form.country, baseCurrency: form.baseCurrency, industry: form.industry.trim() || null }).then(() => setEditing(false)), t("حُفظت بيانات الشركة", "Company saved"))}>
                {busy === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-1 h-3.5 w-3.5" />{t("حفظ", "Save")}</>}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="border-border" onClick={() => { setForm({ name: org.name, legalName: org.legalName || "", country: org.country, baseCurrency: org.baseCurrency, industry: org.industry || "" }); setEditing(true); }}><Pencil className="me-1 h-3.5 w-3.5" />{t("تعديل البيانات", "Edit details")}</Button>
        )}

        {/* Suspend / delete */}
        {!org.deletedAt && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <Label className="text-xs">{t("سبب الإجراء (إلزامي للإيقاف والحذف · يُحفظ في سجل الأثر)", "Reason (required for suspend/delete · stored in the audit trail)")}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("مثال: نزاع دفع · طلب المالك · حساب مكرر", "e.g. payment dispute · owner request · duplicate account")} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!org.suspendedAt && (confirm === "suspend"
                ? <InlineConfirm label={t("إيقاف الشركة الآن؟ (الأعضاء يُمنعون فورًا · البيانات تبقى)", "Suspend now? (members locked immediately · data untouched)")} onConfirm={() => run("suspend", () => api.admin.updateOrg(org.id, { suspended: true, reason: reason.trim() }), t("أُوقفت الشركة", "Company suspended"))} onCancel={() => setConfirm(null)} />
                : <Button size="sm" variant="outline" className="border-warning-border text-warning hover:bg-warning-subtle" disabled={reason.trim().length < 3} onClick={() => setConfirm("suspend")}><Ban className="me-1 h-3.5 w-3.5" />{t("إيقاف مؤقت", "Suspend")}</Button>)}
              {confirm === "delete"
                ? <InlineConfirm label={t("حذف الشركة (حذف ناعم · استعادة خلال 30 يومًا)؟", "Delete company (soft · restorable for 30 days)?")} onConfirm={() => run("delete", () => api.admin.deleteOrg(org.id, reason.trim()), t("حُذفت الشركة (قابلة للاستعادة)", "Company deleted (restorable)"))} onCancel={() => setConfirm(null)} />
                : <Button size="sm" variant="outline" className="border-danger-border text-danger hover:bg-danger-subtle" disabled={reason.trim().length < 3} onClick={() => setConfirm("delete")}><Trash2 className="me-1 h-3.5 w-3.5" />{t("حذف", "Delete")}</Button>}
              {busy && busy !== "edit" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminUserManageCard({ user, push, onChanged }: {
  user: { id: string; email: string; name: string | null; disabledAt?: string | null; disabledReason?: string | null };
  push: Push;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name || "", email: user.email });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); push("success", ok); setConfirm(false); setReason(""); onChanged(); }
    catch (e) { push("error", errMsg(e, t("فشل الإجراء", "Action failed"))); }
    finally { setBusy(null); }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-primary" />{t("إدارة الحساب", "Manage account")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {user.disabledAt && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
            <UserX className="h-4 w-4" />{t("الحساب موقوف", "Account disabled")}{user.disabledReason ? ` · ${user.disabledReason}` : ""}
            <Button size="sm" variant="outline" className="ms-auto border-border" disabled={busy === "enable"} onClick={() => run("enable", () => api.admin.updateUser(user.id, { disabled: false }), t("أُعيد تفعيل الحساب", "Account enabled"))}><CheckCircle2 className="me-1 h-3.5 w-3.5" />{t("إعادة التفعيل", "Enable")}</Button>
          </div>
        )}
        {editing ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">{t("الاسم", "Name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("البريد (تغييره يُلغي التوثيق)", "Email (changing it un-verifies)")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="font-english" type="email" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="border-border" onClick={() => setEditing(false)}>{t("إلغاء", "Cancel")}</Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={busy === "edit" || !form.email.includes("@")}
                onClick={() => run("edit", () => api.admin.updateUser(user.id, { name: form.name.trim() || null, email: form.email.trim() }).then(() => setEditing(false)), t("حُفظ الحساب", "Account saved"))}>
                {busy === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-1 h-3.5 w-3.5" />{t("حفظ", "Save")}</>}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="border-border" onClick={() => { setForm({ name: user.name || "", email: user.email }); setEditing(true); }}><Pencil className="me-1 h-3.5 w-3.5" />{t("تعديل البيانات", "Edit details")}</Button>
        )}
        {!user.disabledAt && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <Label className="text-xs">{t("سبب الإيقاف (إلزامي · يُحفظ في سجل الأثر)", "Reason for disabling (required · stored in the audit trail)")}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("مثال: إساءة استخدام · طلب المستخدم", "e.g. abuse · user request")} />
            <div className="flex items-center gap-2 pt-1">
              {confirm
                ? <InlineConfirm label={t("إيقاف الحساب؟ (تُنهى جلساته فورًا)", "Disable account? (sessions end immediately)")} onConfirm={() => run("disable", () => api.admin.updateUser(user.id, { disabled: true, reason: reason.trim() }), t("أُوقف الحساب", "Account disabled"))} onCancel={() => setConfirm(false)} />
                : <Button size="sm" variant="outline" className="border-danger-border text-danger hover:bg-danger-subtle" disabled={reason.trim().length < 3} onClick={() => setConfirm(true)}><UserX className="me-1 h-3.5 w-3.5" />{t("إيقاف الحساب", "Disable account")}</Button>}
              {busy === "disable" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
