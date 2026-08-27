/**
 * Admin Dashboard · /admin (W31)
 *
 * «يوزر أدمن مختلف مرة — يشوف المشتركين والشركات ويتحكم ويرد على الدعم»
 * Server-side gate: every /api/admin/* call returns 403 unless the session
 * email is in ADMIN_EMAILS. Tabs: Overview · Orgs · Users · Support · AI usage.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader2, RefreshCw, Search, ShieldCheck, Users, Building2, CreditCard, MessageSquare, Sparkles, KeyRound, BadgeCheck, Ban, Gift, Send, MailWarning, UserPlus, Trash2, DatabaseBackup, Bot, X, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { AdminOverview } from "./admin-overview";

type Tab = "overview" | "orgs" | "users" | "support" | "ai" | "email" | "backups" | "agent";
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

/** Z2.1 · URL section → tab (the shell's sidebar drives navigation; «system» keeps sub-tabs). */
export type AdminSection = "overview" | "orgs" | "users" | "subscriptions" | "support" | "system";
const SYSTEM_TABS: Tab[] = ["email", "backups", "agent", "ai"];

export function AdminDashboard({ section = "overview" }: { section?: AdminSection }) {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [systemTab, setSystemTab] = useState<Tab>("email");
  const tab: Tab = section === "system" ? systemTab : section === "subscriptions" ? "orgs" : section;
  const [forbidden, setForbidden] = useState(false);
  const guard = useCallback((e: any) => {
    if (e instanceof ApiError && e.status === 403) { setForbidden(true); return true; }
    push("error", e instanceof ApiError ? e.message : t("فشل", "Failed"));
    return false;
  }, [push, t]);

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-foreground" style={{ fontWeight: 700, fontSize: "1.2rem" }}>{t("هذه الصفحة للأدمن فقط", "Admins only")}</h1>
        <p className="text-sm text-muted-foreground max-w-md">{t("حسابك غير مدرج في قائمة ADMIN_EMAILS على الخادم — سجّل بحساب الأدمن للمتابعة.", "Your account is not in the server's ADMIN_EMAILS list — sign in with the admin account to continue.")}</p>
      </div>
    );
  }

  const titles: Record<AdminSection, [string, string]> = {
    overview: [t("مركز القيادة", "Command center"), t("الإيراد · العملاء · التجارب · الدعم · الشركاء · النظام — في شاشة واحدة", "Revenue · customers · trials · support · partners · system — one screen")],
    orgs: [t("الشركات", "Companies"), t("بحث · الأعضاء · الاشتراك · فتح ملف الشركة", "Search · members · subscription · open the company file")],
    users: [t("المستخدمون", "Users"), t("بحث · توثيق · إعادة تعيين · إنشاء حساب", "Search · verify · reset · create account")],
    subscriptions: [t("الاشتراكات", "Subscriptions"), t("حسب الشركة: مجاملة · تجربة · إلغاء · Lifetime (الجدول الموحّد في Z2.2)", "Per company: comp · trial · cancel · lifetime (unified table lands in Z2.2)")],
    support: [t("الدعم", "Support"), t("المحادثات والتذاكر", "Threads and tickets")],
    system: [t("النظام", "System"), t("البريد · النسخ الاحتياطي · وكيل الأدمن · استهلاك الذكاء", "Email · backups · admin agent · AI usage")],
  };
  return (
    <div className={`space-y-5 ${section === "overview" ? "max-w-[1680px]" : "max-w-7xl"}`}>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }}>{titles[section][0]}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{titles[section][1]}</p>
      </div>
      {section === "system" && (
        <div className="flex gap-1.5 rounded-lg bg-muted/60 p-1 w-fit">
          {([["email", t("البريد", "Email")], ["backups", t("النسخ الاحتياطي", "Backups")], ["agent", t("وكيل الأدمن", "Admin agent")], ["ai", t("الذكاء", "AI usage")]] as [Tab, string][]).filter(([id]) => SYSTEM_TABS.includes(id)).map(([id, label]) => (
            <button key={id} onClick={() => setSystemTab(id)}
              className={`px-4 py-2 rounded-md text-sm transition ${tab === id ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ fontWeight: tab === id ? 700 : 500 }}>{label}</button>
          ))}
        </div>
      )}
      {tab === "overview" && <AdminOverview />}
      {tab === "orgs" && <OrgsTab guard={guard} push={push} t={t} />}
      {tab === "users" && <UsersTab guard={guard} push={push} t={t} />}
      {tab === "support" && <SupportTab guard={guard} push={push} t={t} />}
      {tab === "ai" && <AiTab guard={guard} />}
      {tab === "email" && <EmailTab guard={guard} push={push} t={t} />}
      {tab === "backups" && <BackupsTab guard={guard} push={push} t={t} />}
      {tab === "agent" && <AgentTab guard={guard} push={push} t={t} />}
    </div>
  );
}

// ═══ Overview (legacy · superseded by admin-overview.tsx · kept for reference) ═══
void 0 as unknown as typeof OverviewTab;
function OverviewTab({ guard }: { guard: (e: any) => boolean }) {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => { try { setData(await api.admin.overview()); } catch (e) { guard(e); } }, [guard]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-16" />;
  const kpis: Array<[string, any, any]> = [
    [t("المستخدمون", "Users"), data.users, Users], [t("المنشآت", "Orgs"), data.orgs, Building2],
    [t("جدد (7 أيام)", "New (7d)"), `${data.newUsers7d} / ${data.newOrgs7d}`, Sparkles],
    [t("اشتراكات نشطة", "Active subs"), data.subsByStatus?.ACTIVE ?? 0, BadgeCheck],
    [t("تجريبي", "Trialing"), data.subsByStatus?.TRIALING ?? 0, CreditCard],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(([l, v, I]) => (
          <Card key={l} className="border-border"><CardContent className="p-4"><I className="h-4 w-4 text-primary mb-2" /><div className="text-2xl text-foreground" style={{ fontWeight: 800 }}>{v}</div><div className="text-xs text-muted-foreground">{l}</div></CardContent></Card>
        ))}
      </div>
      <Card className="border-border">
        <CardHeader><CardTitle className="text-base text-foreground">{t("أحدث المنشآت", "Latest orgs")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs"><th className="px-4 py-2 text-start font-medium">{t("المنشأة", "Org")}</th><th className="px-4 py-2 text-start font-medium">{t("المالك", "Owner")}</th><th className="px-4 py-2 text-start font-medium">{t("الباقة", "Plan")}</th><th className="px-4 py-2 text-start font-medium">{t("الحالة", "Status")}</th><th className="px-4 py-2 text-start font-medium">{t("أُنشئت", "Created")}</th></tr></thead>
            <tbody>
              {data.recentOrgs.map((o: any) => (
                <tr key={o.id} className="relative border-b border-border/60 hover:bg-muted/20 focus-within:bg-muted/20">
                  <td className="px-4 py-2.5 relative">
                    <Link
                      to={`/admin/orgs/${o.id}`}
                      data-testid={`admin-overview-org-row-link-${o.id}`}
                      aria-label={`${o.name} workspace`}
                      className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    >
                      <span className="sr-only">{o.name}</span>
                    </Link>
                    <div className="relative z-20 pointer-events-none text-foreground" style={{ fontWeight: 600 }}>{o.name} <span className="text-xs text-muted-foreground font-normal">{o.country}</span></div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-english text-xs relative">
                    <Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
                    <div className="relative z-20 pointer-events-none">{o.ownerEmail || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-foreground/80 text-xs relative">
                    <Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
                    <div className="relative z-20 pointer-events-none">{o.plan || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 relative">
                    <Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
                    <div className="relative z-20 pointer-events-none"><span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : o.status === "TRIALING" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>{o.status}</span></div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs relative">
                    <Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
                    <div className="relative z-20 pointer-events-none">{fmtDate(o.createdAt)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ Orgs ═══
function OrgsTab({ guard, push, t }: any) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMemberRemove, setPendingMemberRemove] = useState<string | null>(null); // UX-1 · inline confirm instead of window.confirm
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("VIEWER");
  const [memberBusy, setMemberBusy] = useState(false);
  const load = useCallback(async (query?: string) => {
    setLoading(true);
    try { setItems((await api.admin.orgs(query || undefined)).items); } catch (e) { guard(e); } finally { setLoading(false); }
  }, [guard]);
  useEffect(() => { load(); }, [load]);
  const openMembers = async (orgId: string) => {
    if (membersFor === orgId) { setMembersFor(null); return; }
    setMembersFor(orgId);
    try { setMembers((await api.admin.orgMembers(orgId)).items); } catch (e) { guard(e); }
  };
  const act = async (orgId: string, action: "comp" | "trial" | "cancel" | "lifetime", months?: number) => {
    setBusyId(orgId + action);
    try {
      const r = await api.admin.orgSubscription(orgId, { action, months });
      push("success", action === "lifetime" && r.planName ? t(`تمت الترقية: ${r.planName} · بدون تاريخ انتهاء`, `Upgraded: ${r.planName} · no expiry`) : t("تم", "Done"));
      await load(q || undefined);
    } catch (e) { guard(e); } finally { setBusyId(null); }
  };
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالاسم أو slug…", "Search name or slug…")} className="ps-9 border-border" /></div>
          <Button type="submit" variant="outline">{t("بحث", "Search")}</Button>
          <Button type="button" variant="outline" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
        </form>
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-10" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
              <th className="px-3 py-2 text-start font-medium">{t("المنشأة", "Org")}</th><th className="px-3 py-2 text-start font-medium">{t("المالك", "Owner")}</th><th className="px-3 py-2 text-start font-medium">{t("الباقة", "Plan")}</th><th className="px-3 py-2 text-start font-medium">{t("أعضاء/فواتير", "Members/Inv")}</th><th className="px-3 py-2 text-start font-medium">{t("إجراءات", "Actions")}</th>
            </tr></thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-border/60 align-top hover:bg-muted/20 focus-within:bg-muted/20">
                  <td className="px-3 py-2.5 relative">
                    <Link
                      to={`/admin/orgs/${o.id}`}
                      data-testid={`admin-org-row-link-${o.id}`}
                      aria-label={`${o.name} workspace`}
                      className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    >
                      <span className="sr-only">{o.name}</span>
                    </Link>
                    <div className="relative z-20 pointer-events-none"><span className="text-foreground" style={{ fontWeight: 600 }}>{o.name}</span></div><div className="relative z-20 pointer-events-none text-[11px] text-muted-foreground">{o.country} · {o.currency} · {fmtDate(o.createdAt)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-english text-muted-foreground relative"><Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" /><div className="relative z-20 pointer-events-none">{o.owner?.email || "—"}</div></td>
                  <td className="px-3 py-2.5 text-xs relative"><Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" /><div className="relative z-20 pointer-events-none">{o.subscription ? (<><span className={`px-2 py-0.5 rounded-full ${o.subscription.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{o.subscription.status}</span><div className="mt-1 text-foreground/80">{o.subscription.plan?.name || ""}{o.subscription.status === "ACTIVE" && !o.subscription.currentPeriodEnd ? ` · ${t("بدون انتهاء", "no expiry")}` : ""}</div></>) : "—"}</div></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground relative"><Link to={`/admin/orgs/${o.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" /><div className="relative z-20 pointer-events-none">{o.members} / {o.invoices}</div></td>
                  <td className="px-3 py-2.5 relative z-20">
                    <div className="flex flex-wrap gap-1.5">
                      <button disabled={!!busyId} onClick={() => act(o.id, "comp", 3)} className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"><Gift className="inline h-3 w-3 me-0.5" />{t("إهداء 3ش", "Comp 3m")}</button>
                      <button disabled={!!busyId} onClick={() => act(o.id, "lifetime")} title={t("أعلى باقة · بدون تاريخ انتهاء", "Highest plan · no expiry")} className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"><Crown className="inline h-3 w-3 me-0.5" />{t("مدى الحياة", "Lifetime")}</button>
                      <button disabled={!!busyId} onClick={() => act(o.id, "trial")} className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">{t("تجريبي 30ي", "Trial 30d")}</button>
                      <button disabled={!!busyId} onClick={() => act(o.id, "cancel")} className="text-[11px] px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"><Ban className="inline h-3 w-3 me-0.5" />{t("إلغاء", "Cancel")}</button>
                      <button onClick={() => openMembers(o.id)} className="text-[11px] px-2 py-1 rounded bg-muted text-foreground border border-border hover:bg-accent"><Users className="inline h-3 w-3 me-0.5" />{t("الأعضاء", "Members")}</button>
                    </div>
                    {membersFor === o.id && (
                      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-2 min-w-[260px]">
                        <div className="text-xs text-muted-foreground" style={{ fontWeight: 700 }}>{t("أعضاء المنشأة", "Org members")}</div>
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-english text-foreground/80" dir="ltr">{m.user.email}</span>
                            <span className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-white border border-border text-[10px]">{m.role}</span>
                              {pendingMemberRemove === m.user.id ? (
                                <InlineConfirm label={t("إزالة العضو؟", "Remove member?")} onCancel={() => setPendingMemberRemove(null)} onConfirm={async () => {
                                  setPendingMemberRemove(null);
                                  try { await api.admin.removeOrgMember(o.id, m.user.id); push("success", t("أُزيل العضو", "Member removed")); setMembers((await api.admin.orgMembers(o.id)).items); } catch (e) { guard(e); }
                                }} />
                              ) : (
                                <button onClick={() => setPendingMemberRemove(m.user.id)} className="text-red-600 hover:bg-red-50 rounded p-0.5"><X className="h-3 w-3" /></button>
                              )}
                            </span>
                          </div>
                        ))}
                        <div className="flex gap-1.5 pt-1 border-t border-border">
                          <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder={t("بريد مستخدم موجود", "Existing user email")} dir="ltr" className="font-english h-8 text-xs border-border" />
                          <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="h-8 text-xs rounded-md border border-border bg-white px-1.5">
                            <option value="VIEWER">VIEWER</option><option value="ACCOUNTANT">ACCOUNTANT</option><option value="ADMIN">ADMIN</option><option value="OWNER">OWNER</option>
                          </select>
                          <Button size="sm" disabled={memberBusy || !memberEmail.includes("@")} onClick={async () => {
                            setMemberBusy(true);
                            try {
                              await api.admin.addOrgMember(o.id, { email: memberEmail.trim(), role: memberRole });
                              push("success", t("أُضيف/حُدّث العضو ✓", "Member added/updated ✓"));
                              setMemberEmail("");
                              setMembers((await api.admin.orgMembers(o.id)).items);
                            } catch (e) { guard(e); } finally { setMemberBusy(false); }
                          }} className="h-8">{memberBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : t("إضافة", "Add")}</Button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ═══ Users ═══
function UsersTab({ guard, push, t }: any) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [pendingUserDelete, setPendingUserDelete] = useState<string | null>(null); // UX-1 · inline confirm
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPass, setCreatePass] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const load = useCallback(async (query?: string) => {
    setLoading(true);
    try { setItems((await api.admin.users(query || undefined)).items); } catch (e) { guard(e); } finally { setLoading(false); }
  }, [guard]);
  useEffect(() => { load(); }, [load]);
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالإيميل أو الاسم…", "Search email or name…")} className="ps-9 border-border" /></div>
          <Button type="submit" variant="outline">{t("بحث", "Search")}</Button>
          <Button type="button" onClick={() => setCreateOpen((v) => !v)} className="bg-primary hover:bg-primary/90"><UserPlus className="h-4 w-4 me-1" />{t("مستخدم جديد", "New user")}</Button>
        </form>
        {createOpen && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("إنشاء حساب مستخدم (يوثَّق بريده تلقائيًا)", "Create a user account (email auto-verified)")}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="email@company.com" dir="ltr" className="font-english border-border" />
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t("الاسم (اختياري)", "Name (optional)")} className="border-border" />
              <Input value={createPass} onChange={(e) => setCreatePass(e.target.value)} placeholder={t("كلمة سر (فارغ = توليد تلقائي)", "Password (blank = auto-generate)")} dir="ltr" className="font-english border-border" />
            </div>
            <div className="flex gap-2">
              <Button disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(createEmail)} onClick={async () => {
                setBusy(true); setGenerated(null);
                try {
                  const r = await api.admin.createUser({ email: createEmail.trim(), name: createName.trim() || undefined, password: createPass || undefined });
                  if (r.generatedPassword) setGenerated(r.generatedPassword);
                  push("success", t("أُنشئ المستخدم ✓", "User created ✓"));
                  setCreateEmail(""); setCreateName(""); setCreatePass("");
                  await load(q || undefined);
                } catch (e) { guard(e); } finally { setBusy(false); }
              }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("إنشاء", "Create")}</Button>
              <Button variant="outline" onClick={() => { setCreateOpen(false); setGenerated(null); }}>{t("إغلاق", "Close")}</Button>
            </div>
            {generated && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                {t("كلمة السر المولّدة (تظهر مرة واحدة فقط — انسخها الآن):", "Generated password (shown once — copy it now):")}{" "}
                <span className="font-english select-all" dir="ltr" style={{ fontWeight: 700 }}>{generated}</span>
              </div>
            )}
          </div>
        )}
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-10" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs"><th className="px-3 py-2 text-start font-medium">{t("المستخدم", "User")}</th><th className="px-3 py-2 text-start font-medium">{t("المنشآت", "Orgs")}</th><th className="px-3 py-2 text-start font-medium">{t("سجّل", "Joined")}</th><th className="px-3 py-2 text-start font-medium">{t("إجراءات", "Actions")}</th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-border/60 align-top hover:bg-muted/20 focus-within:bg-muted/20">
                  <td className="px-3 py-2.5 relative">
                    <Link
                      to={`/admin/users/${u.id}`}
                      data-testid={`admin-user-row-link-${u.id}`}
                      aria-label={`${u.email} workspace`}
                      className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    >
                      <span className="sr-only">{u.email}</span>
                    </Link>
                    <div className="relative z-20 pointer-events-none text-foreground font-english text-xs" style={{ fontWeight: 600 }}>{u.email}</div>
                    <div className="relative z-20 pointer-events-none text-[11px] text-muted-foreground">{u.name || ""} {u.emailVerified ? "· ✓" : "· ⚠️ unverified"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground relative">
                    <Link to={`/admin/users/${u.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
                    <div className="relative z-20 pointer-events-none">{u.orgs.map((o: any) => `${o.name} (${o.role})`).join(" · ") || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground relative">
                    <Link to={`/admin/users/${u.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
                    <div className="relative z-20 pointer-events-none">{fmtDate(u.createdAt)}</div>
                  </td>
                  <td className="px-3 py-2.5 relative z-20">
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => { setResetFor(u); setNewPass(""); }} className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"><KeyRound className="inline h-3 w-3 me-0.5" />{t("كلمة سر", "Password")}</button>
                      {!u.emailVerified && <button onClick={async () => { try { await api.admin.verifyEmail(u.email); push("success", t("تم التوثيق", "Verified")); load(q || undefined); } catch (e) { guard(e); } }} className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">{t("توثيق", "Verify")}</button>}
                      {pendingUserDelete === u.id ? (
                        <InlineConfirm label={t("حذف نهائي؟ يشمل الجلسات والعضويات", "Delete permanently? Sessions and memberships too")} onCancel={() => setPendingUserDelete(null)} onConfirm={async () => {
                          setPendingUserDelete(null);
                          try { await api.admin.deleteUser(u.id); push("success", t("حُذف المستخدم", "User deleted")); load(q || undefined); } catch (e) { guard(e); }
                        }} />
                      ) : (
                        <button onClick={() => setPendingUserDelete(u.id)} className="text-[11px] px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"><Trash2 className="inline h-3 w-3 me-0.5" />{t("حذف", "Delete")}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {resetFor && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="text-sm text-foreground" style={{ fontWeight: 700 }}>{t("كلمة سر جديدة لـ", "New password for")} <span className="font-english">{resetFor.email}</span></div>
            <div className="flex gap-2">
              <Input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t("8+ أحرف", "8+ chars")} className="border-amber-300 font-english" dir="ltr" />
              <Button disabled={busy || newPass.length < 8} onClick={async () => {
                setBusy(true);
                try { await api.admin.resetPassword(resetFor.email, newPass); push("success", t("عُيّنت كلمة السر", "Password set")); setResetFor(null); } catch (e) { guard(e); } finally { setBusy(false); }
              }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("تعيين", "Set")}</Button>
              <Button variant="outline" onClick={() => setResetFor(null)}>{t("إلغاء", "Cancel")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══ Support inbox ═══
function SupportTab({ guard, push, t }: any) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setThreads((await api.admin.supportThreads()).items); } catch (e) { guard(e); } finally { setLoading(false); }
  }, [guard]);
  useEffect(() => { load(); }, [load]);
  const openThread = async (id: string) => {
    setOpenId(id); setThread(null);
    try { setThread(await api.admin.supportThread(id)); } catch (e) { guard(e); }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="border-border">
        <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base text-foreground">{t("محادثات العملاء مع الوكيل", "Customer conversations")}</CardTitle><Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button></CardHeader>
        <CardContent className="p-0 max-h-[520px] overflow-y-auto">
          {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-10" /> : threads.length === 0 ? <div className="text-center text-muted-foreground text-sm py-10">{t("لا محادثات بعد", "No conversations yet")}</div> : threads.map((th) => (
            <button key={th.id} onClick={() => openThread(th.id)} className={`w-full text-start px-4 py-3 border-b border-border/60 hover:bg-muted/40 transition ${openId === th.id ? "bg-primary/5" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{th.org.name}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDate(th.lastMessageAt)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-english">{th.user.email} · {th.messageCount} {t("رسالة", "msgs")}</div>
              {th.lastMessage && <div className="text-xs text-muted-foreground/80 truncate mt-1">{th.lastMessage.role === "user" ? "👤 " : "🤖 "}{th.lastMessage.content.slice(0, 90)}</div>}
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardHeader><CardTitle className="text-base text-foreground">{thread ? `${thread.org.name} · ${thread.user.email}` : t("اختر محادثة", "Pick a conversation")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!thread ? <div className="text-center text-muted-foreground text-sm py-10"><MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />{t("المحادثة والرد البشري يظهران هنا — يصل العميل إشعارًا ويرى ردك في شاته", "The thread and your human reply appear here — the customer gets a notification and sees your reply in their chat")}</div> : (
            <>
              <div className="max-h-[380px] overflow-y-auto space-y-2 pe-1">
                {thread.messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap ${m.role === "user" ? "bg-muted/60 text-foreground" : m.metadata?.source === "admin-human" ? "bg-emerald-600 text-white" : "bg-primary/90 text-white"}`}>
                      {m.metadata?.source === "admin-human" && <div className="text-[9px] opacity-80 mb-0.5">{t("فريق الدعم — رد بشري", "Support team — human reply")}</div>}
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!reply.trim() || busy) return;
                setBusy(true);
                try { await api.admin.supportReply(openId!, reply.trim()); setReply(""); await openThread(openId!); push("success", t("أُرسل الرد للعميل", "Reply sent to the customer")); } catch (err) { guard(err); } finally { setBusy(false); }
              }} className="flex gap-2">
                <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("ردك كإنسان من فريق الدعم…", "Your human reply as the support team…")} className="border-border" />
                <Button type="submit" disabled={busy || !reply.trim()} className="bg-emerald-600 hover:bg-emerald-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ AI usage (kept from the previous dashboard) ═══
function AiTab({ guard }: { guard: (e: any) => boolean }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topupFor, setTopupFor] = useState<any | null>(null);
  const [topupAmount, setTopupAmount] = useState("10");
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.aiBilling.admin.orgs(); setItems(r.items as any); setTotalSpend(r.totalSpend); } catch (e) { guard(e); } finally { setLoading(false); }
  }, [guard]);
  useEffect(() => { load(); }, [load]);
  return (
    <Card className="border-border">
      <CardHeader><CardTitle className="text-base text-foreground">{t("استهلاك الذكاء لكل منشأة", "AI spend per org")} · ${totalSpend.toFixed(2)}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-10" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs"><th className="px-4 py-2 text-start font-medium">{t("المنشأة", "Org")}</th><th className="px-4 py-2 text-start font-medium">{t("الرصيد", "Balance")}</th><th className="px-4 py-2 text-start font-medium">{t("الإنفاق", "Spend")}</th><th className="px-4 py-2 text-start font-medium">{t("الحالة", "Status")}</th><th className="px-4 py-2 text-start font-medium">{t("شحن", "Top up")}</th></tr></thead>
            <tbody>
              {items.map((o: any) => (
                <tr key={o.orgId} className="border-b border-border/60">
                  <td className="px-4 py-2.5 text-foreground">{o.orgName} <span className="text-xs text-muted-foreground">{o.country}</span></td>
                  <td className="px-4 py-2.5 font-english text-xs">${Number(o.creditBalance || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-english text-xs">${Number(o.spentThisPeriod || 0).toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-xs">{o.disabled ? "🔴" : "🟢"}</td>
                  <td className="px-4 py-2.5">
                    {topupFor?.orgId === o.orgId ? (
                      <div className="flex gap-1.5">
                        <Input value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} className="w-16 h-7 text-xs border-border" dir="ltr" />
                        <button onClick={async () => { try { await api.aiBilling.admin.topup({ orgId: o.orgId, amountUsd: Number(topupAmount) || 10 }); setTopupFor(null); load(); } catch (e) { guard(e); } }} className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">✓</button>
                      </div>
                    ) : (
                      <button onClick={() => setTopupFor(o)} className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">+ $</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function EmailTab({ guard, push, t }: { guard: (e: any) => boolean; push: (kind: "success" | "error", msg: string, ms?: number) => void; t: (ar: string, en?: string) => string }) {
  const [data, setData] = useState<{ configured: boolean; from?: string | null; suppressions: Array<{ email: string; origin: string; since: string }>; recent: Array<{ to: string[]; subject: string; event: string; at: string | null }> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { try { setData(await api.admin.emailHealth()); } catch (e) { guard(e); } }, [guard]);
  useEffect(() => { load(); }, [load]);

  const unsuppress = async (email: string) => {
    setBusy(email);
    try {
      await api.admin.unsuppressEmail(email);
      push("success", t("أُزيل من قائمة المنع — الرسائل القادمة تصل طبيعية", "Removed from the suppression list — future emails will arrive"));
      await load();
    } catch (e) { guard(e); } finally { setBusy(null); }
  };

  if (!data) return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>;
  if (!data.configured) return <Card className="border-border"><CardContent className="py-8 text-sm text-muted-foreground">{t("مزود البريد غير مُعد (RESEND_API_KEY مفقود في بيئة الخادم)", "Email provider not configured (RESEND_API_KEY missing on the server)")}</CardContent></Card>;

  const bad = new Set(["bounced", "suppressed", "failed", "complained"]);
  const failures = data.recent.filter((r) => bad.has(r.event));

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><MailWarning className="h-4 w-4 text-amber-600" />{t("قائمة المنع (Suppression List)", "Suppression list")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("أي عنوان هنا لا تصله رسائلنا إطلاقًا — أُضيف تلقائيًا بعد ارتداد سابق. الإرسال من:", "Addresses here never receive our emails — auto-added after a past bounce. Sending from:")} <span dir="ltr" className="font-english">{data.from || "—"}</span></p>
        </CardHeader>
        <CardContent>
          {data.suppressions.length === 0 ? (
            <p className="text-sm text-emerald-700">{t("لا يوجد أي عنوان محظور — مسار البريد نظيف ✓", "No suppressed addresses — the mail path is clean ✓")}</p>
          ) : (
            <div className="divide-y divide-border">
              {data.suppressions.map((sp) => (
                <div key={sp.email} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-sm font-english text-foreground" dir="ltr">{sp.email}</div>
                    <div className="text-[11px] text-muted-foreground">{sp.origin} · {fmtDate(sp.since)}</div>
                  </div>
                  <button onClick={() => unsuppress(sp.email)} disabled={busy === sp.email}
                    className="text-[11px] px-2.5 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                    {busy === sp.email ? <Loader2 className="h-3 w-3 animate-spin" /> : t("إزالة من المنع", "Unsuppress")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("أحدث الرسائل الفاشلة", "Recent failed emails")}</CardTitle>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("لا فشل في آخر 20 رسالة ✓", "No failures in the last 20 emails ✓")}</p>
          ) : (
            <div className="divide-y divide-border">
              {failures.map((r, i) => (
                <div key={i} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-english truncate" dir="ltr">{r.to.join(", ")}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.subject}</div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{r.event}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ Backups ═══
function BackupsTab({ guard, push, t }: any) {
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await api.admin.backupStatus()); } catch (e) { guard(e); } }, [guard]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>;
  const st = data.status || {};
  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><DatabaseBackup className="h-4 w-4 text-primary" />{t("النسخ الاحتياطي خارج الموقع", "Off-site backups")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("نسخة pg_dump كاملة إلى Google Drive يوميًا 03:30 UTC — مع التشغيل اليدوي هنا.", "Full pg_dump to Google Drive daily at 03:30 UTC — plus a manual run here.")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">{t("الحالة", "State")}</div><div className="text-foreground" style={{ fontWeight: 700 }}>{data.enabled ? t("مفعّل", "Enabled") : t("معطّل (env ناقص)", "Disabled (missing env)")}</div></div>
            <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">{t("آخر تشغيل", "Last run")}</div><div className="text-foreground text-xs" style={{ fontWeight: 600 }} dir="ltr">{st.lastRunAt ? new Date(st.lastRunAt).toLocaleString("en-GB") : "—"}</div></div>
            <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">{t("نتيجة آخر تشغيل", "Last result")}</div><div className={st.lastOk ? "text-emerald-700" : "text-red-700"} style={{ fontWeight: 700 }}>{st.lastRunAt ? (st.lastOk ? "✓ OK" : "✗ FAILED") : "—"}</div></div>
            <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">{t("الملف", "File")}</div><div className="text-foreground text-xs font-english truncate" dir="ltr">{st.lastFileName || "—"}</div></div>
          </div>
          {st.lastError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 font-english" dir="ltr">{st.lastError}</div>}
          <Button disabled={busy || !data.enabled} onClick={async () => {
            setBusy(true);
            try {
              const r = await api.admin.runBackup();
              if (r.ok) push("success", t("اكتمل النسخ الاحتياطي ✓", "Backup completed ✓"));
              else push("error", r.error || t("فشل النسخ", "Backup failed"));
              await load();
            } catch (e) { guard(e); } finally { setBusy(false); }
          }} className="bg-primary hover:bg-primary/90">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin me-2" />{t("جارٍ النسخ… (قد يأخذ دقيقة)", "Running… (may take a minute)")}</> : <><DatabaseBackup className="h-4 w-4 me-2" />{t("شغّل نسخة احتياطية الآن", "Run backup now")}</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ Admin AI agent ═══
function AgentTab({ guard, push, t }: any) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; tools?: string[] }>>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const history = next.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }));
      const r = await api.admin.agentChat(text, history.slice(0, -1));
      if (r.ok && r.reply) {
        setMessages([...next, { role: "assistant", content: r.reply, tools: (r.toolsUsed || []).map((x) => x.name) }]);
      } else {
        push("error", r.detail || r.error || t("فشل الوكيل", "Agent failed"));
      }
    } catch (e) { guard(e); } finally { setBusy(false); }
  };
  return (
    <Card className="border-border max-w-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-primary" />{t("وكيل الأدمن — إدارة وصيانة المنصة", "Admin agent — platform ops & maintenance")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("يسأل عن المشتركين والمستخدمين، يعدّل الاشتراكات، يدير قائمة منع البريد، ويشغّل النسخ الاحتياطي — كل تغيير يُسجَّل تدقيقيًا.", "Answers about subscribers and users, edits subscriptions, manages the email suppression list, and runs backups — every change is audit-logged.")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[240px] max-h-[420px] overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground space-y-1.5">
              <div>{t("أمثلة:", "Try:")}</div>
              <div>· {t("كم عدد المشتركين النشطين الآن؟", "How many active subscribers right now?")}</div>
              <div>· {t("أظهر آخر المنشآت المسجلة وباقاتها", "Show the latest orgs and their plans")}</div>
              <div>· {t("هل يوجد عناوين محظورة في البريد؟ أزلها", "Any suppressed email addresses? Remove them")}</div>
              <div>· {t("شغّل نسخة احتياطية الآن وأخبرني بالنتيجة", "Run a backup now and report the result")}</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.role === "user" ? "text-start" : "text-start"}`}>
              <div className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${m.role === "user" ? "bg-primary text-white" : "bg-white border border-border text-foreground"}`}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                {m.tools && m.tools.length > 0 && <div className="mt-1.5 text-[10px] text-muted-foreground font-english" dir="ltr">tools: {m.tools.join(", ")}</div>}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("الوكيل يعمل…", "Agent working…")}</div>}
        </div>
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={t("اطلب مهمة إدارية…", "Ask for an admin task…")} className="border-border" />
          <Button onClick={send} disabled={busy || !input.trim()} className="bg-primary hover:bg-primary/90"><Send className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
