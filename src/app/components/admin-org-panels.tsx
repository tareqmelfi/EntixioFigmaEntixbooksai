/**
 * Admin v3 · R1.5 — company workspace panels (CEO 27/08):
 *   <AdminOrgUsagePanel>  ops footprint: health · activity 30d · users · daily ops ·
 *                         POS/branches · storage estimate · what the org holds — nothing
 *                         financial about the customer, just what the platform carries.
 *   <AdminOrgNotes>       private admin notes (pinned first) · never shown to the customer.
 */
import { useCallback, useEffect, useState } from "react";
import { Activity, Database, Users, Store, GitBranch, FileText, Pin, PinOff, Trash2, Plus, Loader2, HardDrive, Bot, KeyRound, CreditCard } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api, ApiError, type AdminOrgUsage, type AdminNoteRecord, type AdminOrganizationWorkspaceSubscription } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { InlineConfirm } from "./side-panel";
import { SubscriptionProgress, SubscriptionSourceBadge } from "./admin-subscription-tools";

const fmtBytes = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`;

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{label}</div>
      <div className="mt-1 text-lg text-foreground font-english tabular-nums" style={{ fontWeight: 800 }} dir="ltr">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function AdminOrgUsagePanel({ orgId, subscription, onManage }: { orgId: string; subscription: AdminOrganizationWorkspaceSubscription | null; onManage: () => void }) {
  const { t } = useLanguage();
  const [u, setU] = useState<AdminOrgUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.admin.orgUsage(orgId).then(setU).catch((e) => setErr(e instanceof ApiError ? e.message : "failed")); }, [orgId]);
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{err}</div>;
  if (!u) return <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const health = { active: ["🟢", t("نشطة", "Active"), "text-emerald-700 bg-emerald-50"], quiet: ["🟡", t("هادئة", "Quiet"), "text-amber-800 bg-amber-50"], idle: ["⚪", t("خاملة", "Idle"), "text-muted-foreground bg-muted"], new: ["🔵", t("جديدة", "New"), "text-blue-700 bg-blue-50"] }[u.activity.health];
  const load = { light: [t("خفيف", "Light"), "text-emerald-700"], normal: [t("عادي", "Normal"), "text-blue-700"], heavy: [t("ثقيل · راقبه", "Heavy · watch it"), "text-red-700"] }[u.footprint.load];
  const c = u.counts;
  const opsPerDay = Math.round((u.activity.events30 / 30) * 10) / 10;
  return (
    <section className="rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(11,27,73,0.04)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}><Activity className="h-4 w-4 text-primary" />{t("النشاط والحمل على المنصة", "Activity & platform load")}</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${health[2]}`} style={{ fontWeight: 600 }}>{health[0]} {health[1]}{u.activity.idleDays !== null ? ` · ${u.activity.idleDays}d` : ""}</span>
          <span className={`rounded-full bg-muted px-2 py-0.5 ${load[1]}`} style={{ fontWeight: 600 }}>{t("الحمل", "Load")}: {load[0]}</span>
        </div>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground"><span>{t("العمليات اليومية · 30 يوم", "Daily operations · 30 days")}</span><span>{u.activity.events30} {t("عملية", "ops")} · {u.activity.activeDays30} {t("يوم نشط", "active days")}</span></div>
          <div dir="ltr" className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={u.activity.series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs><linearGradient id="gOps" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1276E3" stopOpacity={0.3} /><stop offset="100%" stopColor="#1276E3" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 9, fill: "#8A94A6" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5EAF2", fontSize: 11 }} />
                <Area type="monotone" dataKey="events" name={t("عمليات", "ops")} stroke="#1276E3" strokeWidth={2} fill="url(#gOps)" />
                <Area type="monotone" dataKey="activeUsers" name={t("مستخدمون نشطون", "active users")} stroke="#179FC5" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat icon={Users} label={t("المستخدمون", "Users")} value={c.members} />
            <Stat icon={Activity} label={t("عمليات/يوم", "Ops / day")} value={opsPerDay} sub={`${u.activity.events7} ${t("آخر 7 أيام", "last 7 days")}`} />
            <Stat icon={Store} label={t("نقاط البيع", "POS")} value={`${c.posShifts} / ${c.posSales}`} sub={t("ورديات / مبيعات", "shifts / sales")} />
            <Stat icon={GitBranch} label={t("فروع / مستودعات", "Branches / warehouses")} value={`${c.branches} / ${c.warehouses}`} />
            <Stat icon={FileText} label={t("مستندات", "Documents")} value={c.invoices + c.quotes + c.receipts + c.bills + c.expenses + c.journals} sub={`${c.invoices} ${t("فاتورة", "inv")} · ${c.journals} ${t("قيد", "JE")}`} />
            <Stat icon={Database} label={t("سجلات", "Rows")} value={u.footprint.rows.toLocaleString("en-US")} sub={`${c.contacts} ${t("عميل", "contacts")} · ${c.products} ${t("منتج", "products")}`} />
            <Stat icon={HardDrive} label={t("المساحة التقديرية", "Est. storage")} value={fmtBytes(u.footprint.estimatedBytes)} sub={`${u.footprint.attachmentCount} ${t("مرفق", "attachments")} · ${fmtBytes(u.footprint.attachmentBytes)}`} />
            <Stat icon={Bot} label={t("ذكاء / API", "AI / API")} value={`${c.aiConversations} / ${c.apiKeys}`} sub={t("محادثات / مفاتيح", "chats / keys")} />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">{t("آخر نشاط:", "Last activity:")} <span className="font-english" dir="ltr">{u.activity.lastActivityAt ? new Date(u.activity.lastActivityAt).toLocaleString("en-GB") : "—"}</span>{u.activity.lastAction ? <span className="font-english"> · {u.activity.lastAction}</span> : null} · {t("موظفون", "employees")} {c.employees} · {t("مشاريع", "projects")} {c.projects} · {t("حسابات بنكية", "bank accounts")} {c.bankAccounts}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CreditCard className="h-3.5 w-3.5 text-primary" />{t("الاشتراك", "Subscription")}</div>{subscription ? <SubscriptionSourceBadge lifetime={subscription.lifetime} sponsored={subscription.sponsored} source={subscription.maskedStripeSubscriptionId ? "stripe" : undefined} /> : null}</div>
          {subscription ? (
            <>
              <div className="mt-2 text-foreground" style={{ fontWeight: 700 }}>{subscription.plan?.name || "—"} <span className="text-xs font-normal text-muted-foreground">· {subscription.status}</span></div>
              <div className="mt-2"><SubscriptionProgress start={subscription.currentPeriodStart} end={subscription.currentPeriodEnd || subscription.trialEndsAt} status={subscription.status} lifetime={subscription.lifetime} sponsored={subscription.sponsored} /></div>
              {subscription.note ? <div className="mt-2 text-[11px] text-amber-900">📝 {subscription.note}</div> : null}
            </>
          ) : <div className="mt-2 text-xs text-muted-foreground">{t("لا اشتراك", "No subscription")}</div>}
          <button type="button" onClick={onManage} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs text-white hover:bg-primary/90" style={{ fontWeight: 600 }}>{t("تغيير الاشتراك", "Change subscription")}</button>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground"><KeyRound className="h-3 w-3" />{t("لا نعرض أرقام العميل المالية هنا — فقط ما تحمله المنصة.", "No customer financials here — only what the platform carries.")}</div>
        </div>
      </div>
    </section>
  );
}

export function AdminOrgNotes({ orgId, push }: { orgId: string; push: (kind: "success" | "error", msg: string) => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<AdminNoteRecord[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const load = useCallback(() => api.admin.notes(orgId).then((r) => setItems(r.items)).catch(() => {}), [orgId]);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try { await api.admin.addNote(orgId, body.trim()); setBody(""); await load(); push("success", t("أُضيفت الملاحظة", "Note added")); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل", "Failed")); }
    finally { setBusy(false); }
  };
  return (
    <section className="rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(11,27,73,0.04)]">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}><FileText className="h-4 w-4 text-primary" />{t("ملاحظات الأدمن (خاصة · لا يراها العميل)", "Admin notes (private · never shown to the customer)")}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </header>
      <div className="p-4">
        <div className="flex gap-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={t("مثال: اتفاق شفوي 26/08 — يشترك بالمؤسسي وأفتح له شركتين إضافيتين مجانًا…", "e.g. verbal deal 26/08 — pays Enterprise, two extra companies on us…")} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
          <button type="button" onClick={() => void add()} disabled={busy || !body.trim()} className="self-end inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs text-white disabled:opacity-50" style={{ fontWeight: 600 }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{t("إضافة", "Add")}</button>
        </div>
        {items.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{t("لا ملاحظات بعد.", "No notes yet.")}</p> : (
          <ul className="mt-3 divide-y divide-border/60">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 py-2.5 ${n.pinned ? "bg-amber-50/40 -mx-2 px-2 rounded-lg" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap text-sm text-foreground">{n.body}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground font-english" dir="ltr">{n.adminEmail} · {new Date(n.createdAt).toLocaleString("en-GB")}</div>
                </div>
                <button type="button" title={n.pinned ? t("إلغاء التثبيت", "Unpin") : t("تثبيت", "Pin")} onClick={() => api.admin.updateNote(n.id, { pinned: !n.pinned }).then(load)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">{n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
                {pendingDelete === n.id ? (
                  <InlineConfirm label={t("حذف الملاحظة؟", "Delete note?")} onConfirm={() => { void api.admin.deleteNote(n.id).then(() => { setPendingDelete(null); void load(); }); }} onCancel={() => setPendingDelete(null)} />
                ) : (
                  <button type="button" onClick={() => setPendingDelete(n.id)} className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
