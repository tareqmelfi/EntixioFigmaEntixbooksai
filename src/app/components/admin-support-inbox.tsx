/**
 * Admin · omni-channel support inbox (2026-09-14)
 *
 * Every WhatsApp lead and every website chat lands in AdminTicket. This is where
 * the CEO reads them and answers — and the answer goes back out on the channel
 * the customer used (WhatsApp via the n8n send webhook, the web widget on its
 * next poll). No modals, no popups: list on one side, thread on the other.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Send, MessageSquare, Bot, User, Smartphone, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { api, type AdminTicketRow } from "../lib/api";
import { supportDesk, type SupportDeskTicket } from "../lib/support-desk-api";
import { useSearchParams } from "react-router";
import { useLanguage } from "./LanguageContext";

const STATUS: Record<string, [string,string]> = { OPEN:["مفتوحة","Open"], PENDING:["بانتظار العميل","Pending"], RESOLVED:["تم الحل","Resolved"], CLOSED:["مغلقة","Closed"] };
const PRIORITY: Record<string, [string,string]> = { LOW:["منخفضة","Low"], NORMAL:["عادية","Normal"], HIGH:["عالية","High"], URGENT:["عاجلة","Urgent"] };

type Filter = "needs" | "whatsapp" | "web" | "portal" | "all";

const CATEGORY_LABEL: Record<string, [string, string]> = {
  sales_A: ["مبيعات A", "Sales A"],
  sales_B: ["مبيعات B", "Sales B"],
  sales_C: ["مبيعات C", "Sales C"],
  support: ["دعم", "Support"],
  bug: ["خلل", "Bug"],
  billing: ["اشتراك", "Billing"],
  open_question: ["سؤال مفتوح", "Open question"],
};

function fmt(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

function ChannelIcon({ channel }: { channel?: string }) {
  if (channel === "whatsapp") return <Smartphone className="h-3.5 w-3.5 text-success" />;
  if (channel === "web" || channel === "portal") return <Globe className="h-3.5 w-3.5 text-info" />;
  return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function AdminSupportInbox({ guard, push }: { guard: (e: any) => boolean; push: (kind: "success" | "error", msg: string) => void }) {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [internal, setInternal] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [subject, setSubject] = useState("");
  const [assignment, setAssignment] = useState("");
  const [draft, setDraft] = useState({ subject: "", message: "", contactName: "", contactEmail: "", contactPhone: "", priority: "NORMAL", category: "support" });
  const [channels, setChannels] = useState<{ whatsapp?: string | null; email?: string } | null>(null);
  useEffect(() => { api.admin.me().then(r => setCanWrite(r.permissions.includes("*") || r.permissions.includes("support.write"))).catch(guard); supportDesk.channels().then(setChannels).catch(guard); }, [guard]);
  const [filter, setFilter] = useState<Filter>("needs");
  const [rows, setRows] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportDeskTicket | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        filter === "needs"
          ? { needsHuman: "1" }
          : filter === "all"
            ? {}
            : { channel: filter };
      setRows((await api.admin.tickets(params)).tickets);
    } catch (e) {
      guard(e);
    } finally {
      setLoading(false);
    }
  }, [filter, guard]);

  useEffect(() => { void load(); }, [load]);

  const openThread = useCallback(async (id: string) => {
    setOpenId(id);
    setThread(null);
    try {
      const ticket = (await api.admin.ticket(id)).ticket;
      setThread(ticket); setSubject(ticket.subject); setAssignment(ticket.assignedAgentEmail || ""); setReply("");
    } catch (e) { guard(e); }
  }, [guard]);

  useEffect(() => { const id = params.get("ticket"); if (id) void openThread(id); }, [params, openThread]);
  const selectThread = (id: string) => { if (busy) return; setCreating(false); setParams(p => { p.set("ticket", id); return p; }); };
  const update = async (fields: Parameters<typeof supportDesk.update>[1]) => {
    if (!openId || busy || !canWrite) return;
    setBusy(true);
    try { await supportDesk.update(openId, fields); await openThread(openId); await load(); push("success", t("تم تحديث التذكرة", "Ticket updated")); } catch (e) { guard(e); } finally { setBusy(false); }
  };
  const prepareDraft = async () => {
    if (!openId || busy || !canWrite || reply.trim()) return; setBusy(true);
    try { const result = await supportDesk.draft(openId); setReply(result.draft); setInternal(false); push("success", t("مسودة الوكيل جاهزة للمراجعة؛ لم تُرسل", "Agent draft ready for review; not sent")); } catch (e) { guard(e); } finally { setBusy(false); }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !canWrite) return; setBusy(true);
    try { const result = await supportDesk.create({ ...draft, contactEmail: draft.contactEmail || undefined }); setFilter("all"); setCreating(false); setParams(p => { p.set("ticket", result.ticket.id); return p; }); await load(); push("success", t("تم إنشاء التذكرة الداخلية", "Internal ticket created")); setDraft({ subject: "", message: "", contactName: "", contactEmail: "", contactPhone: "", priority: "NORMAL", category: "support" }); } catch(e) { guard(e); } finally { setBusy(false); }
  };
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [thread?.messages?.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = reply.trim();
    if (!body || busy || !openId || !canWrite) return;
    setBusy(true);
    try {
      const res: any = await supportDesk.message(openId, body, internal || thread?.channel === "admin");
      setReply("");
      await openThread(openId);
      await load();
      const sent = res?.delivery?.sent;
      const channel = thread?.channel;
      push(channel === "whatsapp" && !internal && !sent ? "error" : "success",
        internal || channel === "admin" ? t("حُفظت الملاحظة داخل فريق الدعم", "Note saved for the support team") : channel === "whatsapp"
          ? sent ? t("قُبل الرد للإرسال إلى واتساب؛ وصوله غير مؤكد بعد", "Reply accepted for WhatsApp sending; delivery is not yet confirmed") : t("حُفظ الرد وتعذّر تأكيد إرساله إلى واتساب. راجع حالة الإرسال قبل إعادة المحاولة.", "Reply saved but WhatsApp sending could not be confirmed. Check delivery before retrying.")
          : t("الرد متاح للعميل في محادثته", "Reply is available in the customer's conversation"));
    } catch (err) { guard(err); } finally { setBusy(false); }
  };

  const TABS: Array<[Filter, string, string]> = [
    ["needs", "تحتاج ردّك", "Needs you"],
    ["whatsapp", "واتساب", "WhatsApp"],
    ["web", "شات الموقع", "Website chat"],
    ["portal", "داخل المنصة", "In-app support"],
    ["all", "الكل", "All"],
  ];

  return (
    <Card className="border-border">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base text-foreground">{t("صندوق الدعم الموحّد", "Unified support inbox")}</CardTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          {canWrite && <Button variant="outline" size="sm" onClick={() => setCreating(!creating)}>{t("تذكرة جديدة", "New ticket")}</Button>}
          {TABS.map(([key, ar, en]) => (
            <button
              key={key}
              onClick={() => { setFilter(key); }}
              className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                filter === key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t(ar, en)}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </CardHeader>
      <div className="space-y-3 px-6 pb-4 text-sm">
        <p className="text-muted-foreground">{t("رسائل الموقع وواتساب وطلبات البوابة تظهر هنا. استخدم الملاحظات الداخلية لتوثيق المتابعة مع فريقك.", "Website chat, WhatsApp and portal requests appear here. Use internal notes to coordinate with your team.")}</p>
        <div className="flex flex-wrap gap-4">
          {channels?.whatsapp && <a className="text-primary underline" href={`https://wa.me/${channels.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{t("رقم واتساب الدعم", "Support WhatsApp")} <bdi>+{channels.whatsapp}</bdi></a>}
          {channels?.email && <a className="text-primary underline" href={`mailto:${channels.email}`}>{channels.email}</a>}
          <a className="text-primary underline" href="/app/help">{t("بوابة تذاكر العميل", "Customer support portal")}</a>
        </div>
        {creating && <form onSubmit={create} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">{t("تسجيل طلب داخلي من مكالمة أو بريد أو متابعة", "Log an internal request from a call, email or follow-up")}</h3>
          <label>{t("موضوع التذكرة", "Ticket subject")}<input required maxLength={200} className="mt-1 w-full rounded border border-border p-2" value={draft.subject} onChange={e => setDraft({...draft, subject:e.target.value})}/></label>
          <label>{t("اسم جهة التواصل", "Contact name")}<input className="mt-1 w-full rounded border border-border p-2" value={draft.contactName} onChange={e => setDraft({...draft, contactName:e.target.value})}/></label>
          <label>{t("بريد جهة التواصل", "Contact email")}<input type="email" className="mt-1 w-full rounded border border-border p-2" value={draft.contactEmail} onChange={e => setDraft({...draft, contactEmail:e.target.value})}/></label>
          <label>{t("هاتف جهة التواصل", "Contact phone")}<input type="tel" className="mt-1 w-full rounded border border-border p-2" value={draft.contactPhone} onChange={e => setDraft({...draft, contactPhone:e.target.value})}/></label>
          <label className="sm:col-span-2">{t("تفاصيل الطلب", "Request details")}<textarea rows={3} maxLength={10000} className="mt-1 w-full rounded border border-border p-2" value={draft.message} onChange={e => setDraft({...draft, message:e.target.value})}/></label>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("تُحفظ لفريق الدعم؛ لا يرسل هذا النموذج رسالة خارجية للعميل.", "Saved for your support team. This form does not send an external customer message.")}</p>
          <Button disabled={busy || !draft.subject.trim()} type="submit">{t("إنشاء التذكرة", "Create ticket")}</Button>
          <Button variant="outline" type="button" onClick={() => setCreating(false)}>{t("إلغاء", "Cancel")}</Button>
        </form>}
      </div>
      <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* list */}
        <div className="max-h-[460px] overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-primary" />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {filter === "needs" ? t("ما فيه شيء ينتظر ردّك ✅", "Nothing waiting on you ✅") : t("لا محادثات", "No conversations")}
            </div>
          ) : (
            rows.map((tk: any) => (
              <button
                key={tk.id}
                onClick={() => selectThread(tk.id)}
                className={`w-full border-b border-border/60 px-3 py-2.5 text-start transition hover:bg-muted/40 ${openId === tk.id ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground" style={{ fontWeight: 600 }}>
                    <ChannelIcon channel={tk.channel} />
                    <span className="truncate">{tk.contactName || tk.contactPhone || tk.orgName || tk.subject}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{fmt(tk.updatedAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {tk.needsHuman && (
                    <span className="rounded bg-warning-subtle px-1.5 py-0.5 text-[10px] text-warning">{t("ينتظر ردّك", "Needs you")}</span>
                  )}
                  <span className="text-[10px]">{t(...(STATUS[tk.status] || [tk.status, tk.status]))}</span>
                  {tk.category && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t(...(CATEGORY_LABEL[tk.category] || [tk.category, tk.category]))}
                    </span>
                  )}
                  {tk.contactPhone && <span className="font-english text-[10px] text-muted-foreground">+{String(tk.contactPhone).replace(/\D/g, "")}</span>}
                </div>
                {tk.lastMessage && (
                  <div className="mt-1 truncate text-xs text-muted-foreground/80">
                    {tk.lastMessage.authorType === "CUSTOMER" ? "👤 " : tk.lastMessage.authorType === "AI" ? "🤖 " : "🧑‍💼 "}
                    {String(tk.lastMessage.body).slice(0, 90)}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* thread */}
        <div className="flex max-h-[800px] min-h-[460px] flex-col rounded-lg border border-border">
          {!thread ? (
            <div className="my-auto px-6 py-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              {t(
                "اختر محادثة — ردّك يوصل العميل على نفس القناة (واتساب أو شات الموقع)",
                "Pick a conversation — your reply goes back on the same channel (WhatsApp or the site chat)",
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-border px-3 py-2">
                <div className="flex items-center gap-1.5 text-sm text-foreground" style={{ fontWeight: 600 }}>
                  <ChannelIcon channel={(thread as any).channel} />
                  {(thread as any).contactName || (thread as any).contactPhone || thread.subject}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
                  <label>{t("الحالة", "Status")}<select aria-label={t("حالة التذكرة", "Ticket status")} disabled={!canWrite || busy} value={thread.status} onChange={e => void update({ status:e.target.value })} className="ms-2 rounded border border-border p-1">{Object.entries(STATUS).map(([key,label]) => <option key={key} value={key}>{t(...label)}</option>)}</select></label>
                  <label>{t("الأولوية", "Priority")}<select aria-label={t("أولوية التذكرة", "Ticket priority")} disabled={!canWrite || busy} value={thread.priority} onChange={e => void update({ priority:e.target.value })} className="ms-2 rounded border border-border p-1">{Object.entries(PRIORITY).map(([key,label]) => <option key={key} value={key}>{t(...label)}</option>)}</select></label>
                </div>
                {canWrite && <div className="mt-2 space-y-2 text-xs">
                  <label className="block">{t("موضوع التذكرة", "Ticket subject")}<input className="mt-1 w-full rounded border border-border p-2" value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)}/></label>
                  <label className="block">{t("المسؤول عن المتابعة (بريد)", "Assigned operator (email)")}<input type="email" className="mt-1 w-full rounded border border-border p-2" value={assignment} onChange={e=>setAssignment(e.target.value)}/></label>
                  <Button size="sm" variant="outline" disabled={busy || !subject.trim() || (!!assignment && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignment))} onClick={() => void update({ subject:subject.trim(), assignedAgentEmail:assignment.trim() || null })}>{t("حفظ معلومات التذكرة", "Save ticket details")}</Button>
                  {(thread.channel === "web" || thread.channel === "whatsapp") && <div className="flex flex-wrap items-center gap-2">
                    <span>{thread.needsHuman || thread.meta?.supportAgentMode === "human" ? t("المحادثة مع الفريق؛ رد الوكيل متوقف", "Team handling this conversation; agent replies paused") : t("الوكيل يجيب على الأسئلة العامة", "Agent answers general questions")}</span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void update({ agentMode: thread.needsHuman || thread.meta?.supportAgentMode === "human" ? "auto" : "human" })}>{thread.needsHuman || thread.meta?.supportAgentMode === "human" ? t("إعادة للوكيل", "Return to agent") : t("استلام المحادثة", "Take over")}</Button>
                  </div>}
                </div>}
                {(thread as any).summary && <div className="mt-1 text-[11px] text-muted-foreground">{(thread as any).summary}</div>}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {thread.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.authorType === "CUSTOMER" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs ${
                        m.authorType === "CUSTOMER"
                          ? "bg-muted/60 text-foreground"
                          : m.authorType === "ADMIN"
                            ? "bg-success text-primary-foreground"
                            : "bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      <div className="mb-0.5 flex items-center gap-1 text-[9px] opacity-80">
                        {m.authorType === "CUSTOMER" ? <User className="h-2.5 w-2.5" /> : m.authorType === "ADMIN" ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                        {m.authorType === "CUSTOMER" ? t("العميل", "Customer") : m.authorType === "NOTE" ? t("ملاحظة داخلية", "Internal note") : m.authorType === "ADMIN" ? t("فريق الدعم", "Support team") : t("الوكيل", "Agent")}
                        {" · "}{fmt(m.createdAt)}
                      </div>
                      <div>{m.body}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              {canWrite && <form onSubmit={send} className="flex flex-wrap gap-2 border-t border-border p-2">
                <div className="w-full"><Button size="sm" variant="outline" type="button" disabled={busy || !!reply.trim()} onClick={() => void prepareDraft()}>{t("اقتراح رد بالوكيل", "Draft with agent")}</Button><p className="mt-1 text-[11px] text-muted-foreground">{t("راجع الرد قبل إرساله. الوكيل هنا لا يفتح حساب العميل أو يعدّل بياناته.", "Review before sending. This assistant cannot access or modify the customer's account.")}</p></div>
                <label className="w-full text-xs"><input type="checkbox" checked={internal || thread.channel === "admin"} disabled={thread.channel === "admin"} onChange={e=>setInternal(e.target.checked)}/> {t("ملاحظة داخلية لفريق الدعم فقط", "Internal note for the support team only")}</label>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  aria-label={t("نص المتابعة", "Follow-up message")} placeholder={t("اكتب ردًا أو ملاحظة…", "Write a reply or note…")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
                <Button aria-label={internal || thread.channel === "admin" ? t("حفظ الملاحظة", "Save note") : t("إرسال الرد", "Send reply")} type="submit" disabled={busy || !reply.trim()} className="bg-success hover:bg-success">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
