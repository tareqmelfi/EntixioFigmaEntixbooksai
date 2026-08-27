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
import type { AdminTicketRow, AdminTicketDetail } from "../lib/api";
import { Link } from "react-router";
import { MessageSquare, Bot as BotIcon, Send, CircleDot, CheckCircle2, Clock as ClockIcon, Plus as PlusIcon } from "lucide-react";
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

// ── Inbox · tickets + AI threads for one company (Admin v3 R2 · CEO 27/08) ───

const STATUS_TONE: Record<string, string> = { OPEN: "bg-amber-50 text-amber-800", PENDING: "bg-blue-50 text-blue-700", RESOLVED: "bg-emerald-50 text-emerald-700", CLOSED: "bg-muted text-muted-foreground" };

export function AdminOrgInbox({ orgId, threads, canWrite, push }: { orgId: string; threads: Array<{ id: string; title: string | null; lastMessageAt: string; messageCount: number; user: { email: string } }>; canWrite: boolean; push: (kind: "success" | "error", msg: string) => void }) {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [open, setOpen] = useState<AdminTicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.admin.tickets({ orgId }).then((r) => setTickets(r.tickets)).catch(() => {}), [orgId]);
  useEffect(() => { void load(); }, [load]);
  const openTicket = async (id: string) => { try { const r = await api.admin.ticket(id); setOpen(r.ticket); } catch (e) { push("error", e instanceof ApiError ? e.message : "failed"); } };
  const send = async () => {
    if (!open || !reply.trim()) return;
    setBusy(true);
    try { await api.admin.replyTicket(open.id, reply.trim()); setReply(""); await openTicket(open.id); await load(); push("success", t("أُرسل الرد", "Reply sent")); }
    catch (e) { push("error", e instanceof ApiError ? e.message : "failed"); } finally { setBusy(false); }
  };
  const setStatus = async (status: string) => { if (!open) return; try { await api.admin.updateTicket(open.id, { status }); await openTicket(open.id); await load(); } catch (e) { push("error", e instanceof ApiError ? e.message : "failed"); } };
  const create = async () => {
    if (!newSubject.trim()) return;
    setBusy(true);
    try { const r = await api.admin.createTicket({ orgId, subject: newSubject.trim(), message: newBody.trim() || undefined }); setNewSubject(""); setNewBody(""); setCreating(false); await load(); await openTicket(r.id); push("success", t("أُنشئت التذكرة", "Ticket created")); }
    catch (e) { push("error", e instanceof ApiError ? e.message : "failed"); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <section className="xl:col-span-2 rounded-2xl border border-border bg-white">
        <header className="flex items-center justify-between border-b border-border/70 px-4 py-3"><h2 className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}><MessageSquare className="h-4 w-4 text-primary" />{t("التذاكر", "Tickets")} <span className="text-xs text-muted-foreground">{tickets.length}</span></h2>{canWrite && <button onClick={() => setCreating(!creating)} className="inline-flex items-center gap-1 text-xs text-primary"><PlusIcon className="h-3.5 w-3.5" />{t("تذكرة جديدة", "New ticket")}</button>}</header>
        {creating && (
          <div className="border-b border-border/70 p-3 space-y-2 bg-primary/5">
            <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder={t("الموضوع", "Subject")} className="w-full rounded-md border border-border px-2 py-1.5 text-sm" />
            <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={2} placeholder={t("أول رسالة (اختياري)", "First message (optional)")} className="w-full rounded-md border border-border px-2 py-1.5 text-sm" />
            <div className="flex gap-2"><button onClick={() => void create()} disabled={busy || !newSubject.trim()} className="rounded-md bg-primary px-3 py-1.5 text-xs text-white disabled:opacity-50" style={{ fontWeight: 600 }}>{t("إنشاء", "Create")}</button><button onClick={() => setCreating(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">{t("إلغاء", "Cancel")}</button></div>
          </div>
        )}
        <ul className="divide-y divide-border/60 max-h-[420px] overflow-auto">
          {tickets.length === 0 && <li className="p-4 text-xs text-muted-foreground">{t("لا تذاكر لهذه الشركة.", "No tickets for this company.")}</li>}
          {tickets.map((tk) => (
            <li key={tk.id}><button onClick={() => void openTicket(tk.id)} className={`w-full px-4 py-2.5 text-start hover:bg-muted/30 ${open?.id === tk.id ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[tk.status] || ""}`} style={{ fontWeight: 700 }}>{tk.status}</span><span className="truncate text-sm text-foreground" style={{ fontWeight: 600 }}>{tk.subject}</span></div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{tk.lastMessage ? `${tk.lastMessage.authorType === "ADMIN" ? "↩ " : ""}${tk.lastMessage.body}` : "—"} · <span className="font-english" dir="ltr">{new Date(tk.updatedAt).toLocaleString("en-GB")}</span>{tk.assignedAgentEmail ? ` · ${tk.assignedAgentEmail}` : ""}</div>
            </button></li>
          ))}
        </ul>
        <header className="flex items-center gap-2 border-t border-b border-border/70 px-4 py-3"><h2 className="flex items-center gap-2 text-sm text-foreground" style={{ fontWeight: 700 }}><BotIcon className="h-4 w-4 text-primary" />{t("محادثات الوكيل", "Agent conversations")} <span className="text-xs text-muted-foreground">{threads.length}</span></h2></header>
        <ul className="divide-y divide-border/60 max-h-[260px] overflow-auto">
          {threads.length === 0 && <li className="p-4 text-xs text-muted-foreground">{t("لا محادثات.", "No conversations.")}</li>}
          {threads.map((th) => (
            <li key={th.id} className="px-4 py-2.5"><Link to={`/admin/support/${th.id}`} className="text-sm text-foreground hover:underline" style={{ fontWeight: 600 }}>{th.title || t("محادثة", "Thread")}</Link><div className="text-[11px] text-muted-foreground font-english" dir="ltr">{th.user.email} · {th.messageCount} msgs · {new Date(th.lastMessageAt).toLocaleString("en-GB")}</div></li>
          ))}
        </ul>
      </section>
      <section className="xl:col-span-3 rounded-2xl border border-border bg-white flex flex-col min-h-[420px]">
        {!open ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t("اختر تذكرة لعرض المحادثة والرد", "Pick a ticket to read and reply")}</div> : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[open.status] || ""}`} style={{ fontWeight: 700 }}>{open.status}</span>
              <span className="text-sm text-foreground" style={{ fontWeight: 700 }}>{open.subject}</span>
              <span className="text-[11px] text-muted-foreground font-english" dir="ltr">{open.priority} · {open.createdByEmail || "—"}</span>
              {canWrite && <div className="ms-auto flex gap-1">
                {open.status !== "OPEN" && <button onClick={() => void setStatus("OPEN")} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px]"><CircleDot className="h-3 w-3" />{t("فتح", "Open")}</button>}
                {open.status !== "PENDING" && <button onClick={() => void setStatus("PENDING")} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px]"><ClockIcon className="h-3 w-3" />{t("بانتظار العميل", "Pending")}</button>}
                {open.status !== "RESOLVED" && <button onClick={() => void setStatus("RESOLVED")} className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700"><CheckCircle2 className="h-3 w-3" />{t("حُلّت", "Resolve")}</button>}
              </div>}
            </header>
            <div className="flex-1 space-y-2 overflow-auto p-4">
              {open.messages.length === 0 && <p className="text-xs text-muted-foreground">{t("لا رسائل بعد.", "No messages yet.")}</p>}
              {open.messages.map((m) => (
                <div key={m.id} className={`flex ${m.authorType === "ADMIN" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.authorType === "ADMIN" ? "bg-[#0B1B49] text-white" : "bg-muted text-foreground"}`}>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className={`mt-1 text-[10px] font-english ${m.authorType === "ADMIN" ? "text-white/60" : "text-muted-foreground"}`} dir="ltr">{m.authorEmail || m.authorType} · {new Date(m.createdAt).toLocaleString("en-GB")}</div>
                  </div>
                </div>
              ))}
            </div>
            {canWrite && (
              <div className="flex gap-2 border-t border-border/70 p-3">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={t("اكتب الرد للعميل…", "Write a reply to the customer…")} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
                <button onClick={() => void send()} disabled={busy || !reply.trim()} className="self-end inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs text-white disabled:opacity-50" style={{ fontWeight: 600 }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{t("إرسال", "Send")}</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
