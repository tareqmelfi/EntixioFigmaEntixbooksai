/**
 * Admin v3 · R2 — /admin/team: internal team · invitations · roles matrix ·
 * support-desk assignments (CEO 27/08: «أوظّف واحد دعم فني صلاحياته دعم وما
 * يشوف معلومات مالية · أحدد له العملاء»). No dialogs (UX-1): everything inline.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, Mail, Loader2, Plus, Trash2, ShieldCheck, Check, Copy, Building2, Ban, RotateCcw } from "lucide-react";
import { api, ApiError, type AdminRoleRecord, type AdminTeamMember, type AdminTeamInvite } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { invalidateAdminMe } from "../lib/use-admin-me";

const PERM_LABEL: Record<string, { ar: string; en: string; group: string }> = {
  "orgs.read": { ar: "عرض الشركات", en: "View companies", group: "orgs" },
  "orgs.write": { ar: "تعديل / تعليق الشركات", en: "Edit / suspend companies", group: "orgs" },
  "orgs.delete": { ar: "حذف / استعادة الشركات", en: "Delete / restore companies", group: "orgs" },
  "users.read": { ar: "عرض المستخدمين", en: "View users", group: "users" },
  "users.write": { ar: "إنشاء / تعطيل / حذف المستخدمين", en: "Create / disable / delete users", group: "users" },
  "subs.read": { ar: "عرض حالة الاشتراك", en: "View subscription status", group: "billing" },
  "subs.write": { ar: "تغيير الاشتراكات (مدعوم · مدى الحياة · يدوي…)", en: "Change subscriptions (sponsored · lifetime · manual…)", group: "billing" },
  "finance.read": { ar: "الأرقام المالية (MRR · أسعار · Stripe)", en: "Financials (MRR · prices · Stripe ids)", group: "billing" },
  "plans.read": { ar: "عرض الباقات", en: "View plans", group: "billing" },
  "plans.write": { ar: "تعديل الباقات", en: "Edit plans", group: "billing" },
  "support.read": { ar: "عرض التذاكر والمحادثات", en: "View tickets & threads", group: "support" },
  "support.write": { ar: "الرد وإغلاق التذاكر", en: "Reply & close tickets", group: "support" },
  "notes.read": { ar: "عرض ملاحظات الأدمن", en: "View admin notes", group: "support" },
  "notes.write": { ar: "كتابة ملاحظات", en: "Write notes", group: "support" },
  "usage.read": { ar: "النشاط والحمل", en: "Activity & load", group: "support" },
  "impersonate": { ar: "فتح الشركة كأدمن", en: "Open company as admin", group: "danger" },
  "system.read": { ar: "عرض النظام (بريد · نسخ)", en: "View system (email · backups)", group: "system" },
  "system.write": { ar: "تشغيل أدوات النظام", en: "Run system tools", group: "system" },
  "audit.read": { ar: "سجل الأثر", en: "Audit trail", group: "system" },
  "team.manage": { ar: "إدارة الفريق والصلاحيات", en: "Manage team & roles", group: "danger" },
  "partners.manage": { ar: "الشركاء والإحالات", en: "Partners & referrals", group: "billing" },
  "comms.send": { ar: "إرسال تعميمات", en: "Send broadcasts", group: "system" },
};
const GROUPS: Array<[string, string, string]> = [["orgs", "الشركات", "Companies"], ["users", "المستخدمون", "Users"], ["billing", "الفوترة والاشتراكات", "Billing"], ["support", "الدعم", "Support"], ["system", "النظام", "System"], ["danger", "حسّاس", "Sensitive"]];

export function AdminTeam() {
  const { t, language } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [tab, setTab] = useState<"team" | "roles">("team");
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [catalogue, setCatalogue] = useState<string[]>([]);
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [invites, setInvites] = useState<AdminTeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [r, tm] = await Promise.all([api.admin.roles(), api.admin.team()]);
      setRoles(r.items); setCatalogue(r.catalogue); setMembers(tm.items); setInvites(tm.invites); setErr(null);
    } catch (e) { setErr(e instanceof ApiError ? e.message : t("تعذّر التحميل", "Could not load")); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.6rem", fontWeight: 700 }}><UserCog className="h-5 w-5 text-primary" />{t("الفريق والصلاحيات", "Team & roles")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("من يدخل لوحة الإدارة · ماذا يرى · أي شركات يخدم — كله من هنا بلا كود", "Who enters the console · what they see · which companies they serve — all from here, no code")}</p>
      </div>
      <div className="flex gap-1.5 rounded-lg bg-muted/60 p-1 w-fit">
        {([["team", t("الفريق", "Team")], ["roles", t("الأدوار والصلاحيات", "Roles & permissions")]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-md text-sm transition ${tab === id ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`} style={{ fontWeight: tab === id ? 700 : 500 }}>{label}</button>
        ))}
      </div>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-12" /> : tab === "team"
        ? <TeamTab members={members} invites={invites} roles={roles} reload={load} push={push} t={t} language={language} />
        : <RolesTab roles={roles} catalogue={catalogue} reload={load} push={push} t={t} language={language} />}
    </div>
  );
}

function TeamTab({ members, invites, roles, reload, push, t, language }: { members: AdminTeamMember[]; invites: AdminTeamInvite[]; roles: AdminRoleRecord[]; reload: () => Promise<void>; push: any; t: any; language: "ar" | "en" }) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.key === "SUPPORT")?.id || roles[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const invite = async () => {
    if (!email.trim() || !roleId) return;
    setBusy(true);
    try {
      const r = await api.admin.inviteTeam({ email: email.trim(), roleId, language });
      setLastLink(r.link);
      push("success", r.emailSent ? t("أُرسلت الدعوة بالبريد", "Invitation emailed") : t("أُنشئت الدعوة — انسخ الرابط وأرسله يدويًا (البريد لم يُرسل)", "Invite created — copy the link and send it manually (email not sent)"));
      setEmail(""); await reload();
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="text-sm text-foreground mb-2" style={{ fontWeight: 700 }}>{t("دعوة موظف", "Invite a teammate")}</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground flex-1 min-w-[220px]">{t("البريد", "Email")}<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@ensidex.com" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm font-english" dir="ltr" /></label>
          <label className="text-xs text-muted-foreground min-w-[200px]">{t("الدور", "Role")}<select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-white px-2 py-2 text-sm">{roles.map((r) => <option key={r.id} value={r.id}>{language === "ar" ? r.nameAr : r.nameEn} ({r.key}){r.scopeAssigned ? ` · ${t("نطاق محدد", "scoped")}` : ""}</option>)}</select></label>
          <button onClick={() => void invite()} disabled={busy || !email.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50" style={{ fontWeight: 600 }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{t("إرسال الدعوة", "Send invite")}</button>
        </div>
        {lastLink && <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"><span className="truncate font-english flex-1" dir="ltr">{lastLink}</span><button onClick={() => { navigator.clipboard?.writeText(lastLink); push("success", t("نُسخ", "Copied")); }} className="inline-flex items-center gap-1 text-primary"><Copy className="h-3.5 w-3.5" />{t("نسخ", "Copy")}</button></div>}
        <p className="mt-2 text-[11px] text-muted-foreground">{t("الرابط صالح 72 ساعة · المدعو يسجّل الدخول (أو ينشئ حسابًا بنفس البريد) ثم يقبل — لا صلاحية قبل القبول.", "Link valid 72h · the invitee signs in (or registers with the same email) then accepts — nothing is granted before acceptance.")}</p>
      </section>

      {invites.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="text-sm text-foreground mb-2" style={{ fontWeight: 700 }}>{t("دعوات معلّقة", "Pending invitations")} · {invites.length}</div>
          <ul className="divide-y divide-amber-200/60 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-english" dir="ltr">{i.email}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-foreground border border-border">{language === "ar" ? i.role.nameAr : i.role.nameEn}</span>
                <span className="text-[11px] text-muted-foreground font-english" dir="ltr">{t("بواسطة", "by")} {i.invitedBy} · {t("تنتهي", "expires")} {new Date(i.expiresAt).toLocaleString("en-GB")}</span>
                <button onClick={() => api.admin.revokeInvite(i.id).then(reload)} className="ms-auto inline-flex items-center gap-1 text-xs text-red-700 hover:underline"><Trash2 className="h-3.5 w-3.5" />{t("إلغاء", "Revoke")}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><th className="px-4 py-2 text-start font-medium">{t("العضو", "Member")}</th><th className="px-4 py-2 text-start font-medium">{t("الدور", "Role")}</th><th className="px-4 py-2 text-start font-medium">{t("الشركات المسندة", "Assigned companies")}</th><th className="px-4 py-2 text-start font-medium">{t("الحالة", "Status")}</th><th className="px-4 py-2 text-end font-medium">{t("إجراء", "Actions")}</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <MemberRow key={m.id} m={m} roles={roles} reload={reload} push={push} t={t} language={language} assignOpen={assignFor === m.id} onAssign={() => setAssignFor(assignFor === m.id ? null : m.id)} pendingRemove={pendingRemove === m.id} setPendingRemove={(v) => setPendingRemove(v ? m.id : null)} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MemberRow({ m, roles, reload, push, t, language, assignOpen, onAssign, pendingRemove, setPendingRemove }: { m: AdminTeamMember; roles: AdminRoleRecord[]; reload: () => Promise<void>; push: any; t: any; language: "ar" | "en"; assignOpen: boolean; onAssign: () => void; pendingRemove: boolean; setPendingRemove: (v: boolean) => void }) {
  const [orgQ, setOrgQ] = useState("");
  const [orgOptions, setOrgOptions] = useState<Array<{ id: string; name: string; country: string }>>([]);
  const [picked, setPicked] = useState<string[]>(m.assignments.map((a) => a.orgId));
  useEffect(() => { if (!assignOpen) return; const h = setTimeout(() => { api.admin.orgs(orgQ || undefined).then((r) => setOrgOptions(r.items.map((o) => ({ id: o.id, name: o.name, country: o.country })))).catch(() => {}); }, 250); return () => clearTimeout(h); }, [assignOpen, orgQ]);
  const change = async (patch: { roleId?: string; disabled?: boolean; assignedOrgIds?: string[] }) => {
    try { await api.admin.updateTeamMember(m.id, patch); invalidateAdminMe(); push("success", t("تم الحفظ", "Saved")); await reload(); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
  };
  return (
    <>
      <tr className="border-b border-border/60 align-top">
        <td className="px-4 py-2.5"><div className="font-english text-xs text-foreground" style={{ fontWeight: 600 }} dir="ltr">{m.email}</div><div className="text-[11px] text-muted-foreground">{m.name || "—"}{m.bootstrap ? <span className="ms-1 rounded-full bg-[#0B1B49] px-1.5 py-0.5 text-[9px] text-white">ENV</span> : null}</div></td>
        <td className="px-4 py-2.5">
          {m.bootstrap ? <span className="inline-flex items-center gap-1 text-xs text-foreground" style={{ fontWeight: 600 }}><ShieldCheck className="h-3.5 w-3.5 text-primary" />{t("مشرف عام", "Super admin")}</span> : (
            <select value={m.role?.id || ""} onChange={(e) => void change({ roleId: e.target.value })} className="rounded-md border border-border bg-white px-2 py-1 text-xs">{roles.map((r) => <option key={r.id} value={r.id}>{language === "ar" ? r.nameAr : r.nameEn}</option>)}</select>
          )}
        </td>
        <td className="px-4 py-2.5 text-xs">
          {m.role?.scopeAssigned ? (
            <div className="flex flex-wrap items-center gap-1">{m.assignments.length === 0 ? <span className="text-amber-800">{t("لا شركات — لا يرى شيئًا", "None — sees nothing")}</span> : m.assignments.map((a) => <span key={a.orgId} className="rounded-full bg-muted px-2 py-0.5">{a.orgName}</span>)}<button onClick={onAssign} className="ms-1 inline-flex items-center gap-1 text-primary hover:underline"><Building2 className="h-3 w-3" />{t("تعديل", "Edit")}</button></div>
          ) : <span className="text-muted-foreground">{t("كل الشركات", "All companies")}</span>}
        </td>
        <td className="px-4 py-2.5 text-xs">{m.disabledAt ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{t("معطّل", "Disabled")}</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{t("نشط", "Active")}</span>}</td>
        <td className="px-4 py-2.5 text-end">
          {!m.bootstrap && (
            <div className="flex flex-wrap justify-end gap-1.5">
              <button onClick={() => void change({ disabled: !m.disabledAt })} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted/50">{m.disabledAt ? <><RotateCcw className="h-3 w-3" />{t("تفعيل", "Enable")}</> : <><Ban className="h-3 w-3" />{t("تعطيل", "Disable")}</>}</button>
              {pendingRemove ? <InlineConfirm label={t("إزالة من الفريق؟ (الحساب يبقى)", "Remove from team? (account stays)")} onCancel={() => setPendingRemove(false)} onConfirm={() => { void api.admin.removeTeamMember(m.id).then(() => { setPendingRemove(false); void reload(); }); }} /> : <button onClick={() => setPendingRemove(true)} className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700"><Trash2 className="h-3 w-3" />{t("إزالة", "Remove")}</button>}
            </div>
          )}
        </td>
      </tr>
      {assignOpen && (
        <tr className="border-b border-border/60 bg-primary/5"><td colSpan={5} className="px-4 py-3">
          <div className="text-xs text-foreground mb-2" style={{ fontWeight: 600 }}>{t("الشركات التي يخدمها", "Companies this member serves")} · {picked.length}</div>
          <input value={orgQ} onChange={(e) => setOrgQ(e.target.value)} placeholder={t("ابحث عن شركة…", "Search companies…")} className="mb-2 w-full max-w-md rounded-md border border-border px-3 py-1.5 text-xs" />
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
            {orgOptions.map((o) => { const on = picked.includes(o.id); return <button key={o.id} type="button" onClick={() => setPicked(on ? picked.filter((x) => x !== o.id) : [...picked, o.id])} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted/50"}`}>{on ? <Check className="inline h-3 w-3 me-1" /> : null}{o.name} <span className="opacity-70">{o.country}</span></button>; })}
          </div>
          <div className="mt-2 flex gap-2"><button onClick={() => void change({ assignedOrgIds: picked }).then(onAssign)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-white" style={{ fontWeight: 600 }}>{t("حفظ الإسناد", "Save assignments")}</button><button onClick={onAssign} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">{t("إغلاق", "Close")}</button></div>
        </td></tr>
      )}
    </>
  );
}

function RolesTab({ roles, catalogue, reload, push, t, language }: { roles: AdminRoleRecord[]; catalogue: string[]; reload: () => Promise<void>; push: any; t: any; language: "ar" | "en" }) {
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [newRole, setNewRole] = useState({ key: "", nameAr: "", nameEn: "", scopeAssigned: false });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const perms = useMemo(() => catalogue.filter((k) => PERM_LABEL[k]), [catalogue]);
  const current = (r: AdminRoleRecord) => draft[r.id] ?? r.permissions;
  const toggle = (r: AdminRoleRecord, key: string) => { if (r.key === "SUPER_ADMIN") return; const cur = current(r); setDraft({ ...draft, [r.id]: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] }); };
  const save = async (r: AdminRoleRecord) => {
    try { await api.admin.updateRole(r.id, { permissions: draft[r.id] }); const d = { ...draft }; delete d[r.id]; setDraft(d); invalidateAdminMe(); push("success", t(`حُفظ دور ${language === "ar" ? r.nameAr : r.nameEn}`, `Saved ${r.nameEn}`)); await reload(); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
  };
  const create = async () => {
    try { await api.admin.createRole({ key: newRole.key.toUpperCase(), nameAr: newRole.nameAr, nameEn: newRole.nameEn, permissions: ["orgs.read"], scopeAssigned: newRole.scopeAssigned }); setNewRole({ key: "", nameAr: "", nameEn: "", scopeAssigned: false }); push("success", t("أُنشئ الدور", "Role created")); await reload(); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground">
              <th className="sticky start-0 bg-muted/40 px-3 py-2 text-start font-medium min-w-[220px]">{t("الصلاحية", "Permission")}</th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-2 text-center font-medium min-w-[120px]">
                  <div className="text-foreground" style={{ fontWeight: 700 }}>{language === "ar" ? r.nameAr : r.nameEn}</div>
                  <div className="font-english text-[10px]">{r.key}{r.isSystem ? "" : " · custom"}</div>
                  <div className="text-[10px]">{r.members ?? 0} {t("عضو", "members")}{r.scopeAssigned ? ` · ${t("نطاق", "scoped")}` : ""}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(([g, ar, en]) => (
              <Fragment key={g}>
                <tr className="bg-muted/20"><td colSpan={roles.length + 1} className="px-3 py-1.5 text-[11px] text-muted-foreground" style={{ fontWeight: 700 }}>{language === "ar" ? ar : en}</td></tr>
                {perms.filter((k) => PERM_LABEL[k].group === g).map((k) => (
                  <tr key={k} className="border-b border-border/50">
                    <td className="sticky start-0 bg-white px-3 py-2 text-foreground">{language === "ar" ? PERM_LABEL[k].ar : PERM_LABEL[k].en}<div className="font-english text-[10px] text-muted-foreground">{k}</div></td>
                    {roles.map((r) => { const on = r.key === "SUPER_ADMIN" || current(r).includes(k); return (
                      <td key={r.id} className="px-3 py-2 text-center">
                        <button type="button" disabled={r.key === "SUPER_ADMIN"} onClick={() => toggle(r, k)} className={`inline-flex h-5 w-5 items-center justify-center rounded border ${on ? "border-primary bg-primary text-white" : "border-border bg-white"} disabled:opacity-60`} aria-pressed={on}>{on ? <Check className="h-3 w-3" /> : null}</button>
                      </td>); })}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr>
              <td className="sticky start-0 bg-white px-3 py-2" />
              {roles.map((r) => (
                <td key={r.id} className="px-3 py-2 text-center">
                  {draft[r.id] ? <button onClick={() => void save(r)} className="rounded-md bg-primary px-2.5 py-1 text-[11px] text-white" style={{ fontWeight: 600 }}>{t("حفظ", "Save")}</button> : null}
                  {!r.isSystem && !draft[r.id] ? (pendingDelete === r.id ? <InlineConfirm label={t("حذف الدور؟", "Delete role?")} onCancel={() => setPendingDelete(null)} onConfirm={() => { void api.admin.deleteRole(r.id).then(() => { setPendingDelete(null); void reload(); }).catch((e) => push("error", e instanceof ApiError ? e.message : "failed")); }} /> : <button onClick={() => setPendingDelete(r.id)} className="text-[11px] text-red-700 hover:underline">{t("حذف", "Delete")}</button>) : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="text-sm text-foreground mb-2" style={{ fontWeight: 700 }}>{t("دور مخصص جديد", "New custom role")}</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">KEY<input value={newRole.key} onChange={(e) => setNewRole({ ...newRole, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} placeholder="SALES_DESK" className="mt-1 w-40 rounded-md border border-border px-2 py-1.5 text-xs font-english" dir="ltr" /></label>
          <label className="text-xs text-muted-foreground">{t("الاسم عربي", "Name (AR)")}<input value={newRole.nameAr} onChange={(e) => setNewRole({ ...newRole, nameAr: e.target.value })} className="mt-1 w-40 rounded-md border border-border px-2 py-1.5 text-xs" /></label>
          <label className="text-xs text-muted-foreground">{t("الاسم إنجليزي", "Name (EN)")}<input value={newRole.nameEn} onChange={(e) => setNewRole({ ...newRole, nameEn: e.target.value })} className="mt-1 w-40 rounded-md border border-border px-2 py-1.5 text-xs font-english" dir="ltr" /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground pb-2"><input type="checkbox" checked={newRole.scopeAssigned} onChange={(e) => setNewRole({ ...newRole, scopeAssigned: e.target.checked })} />{t("نطاق محدد (يرى المسند له فقط)", "Scoped (sees assigned companies only)")}</label>
          <button onClick={() => void create()} disabled={newRole.key.length < 3 || !newRole.nameAr || !newRole.nameEn} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs text-white disabled:opacity-50" style={{ fontWeight: 600 }}><Plus className="h-3.5 w-3.5" />{t("إنشاء", "Create")}</button>
        </div>
      </section>
    </div>
  );
}

