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
import { api, type AdminTicketRow, type AdminTicketDetail } from "../lib/api";
import { useLanguage } from "./LanguageContext";

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
  const [filter, setFilter] = useState<Filter>("needs");
  const [rows, setRows] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<AdminTicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        filter === "needs"
          ? { needsHuman: "1", status: "OPEN" }
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
      setThread((await api.admin.ticket(id)).ticket);
    } catch (e) { guard(e); }
  }, [guard]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [thread?.messages?.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = reply.trim();
    if (!body || busy || !openId) return;
    setBusy(true);
    try {
      const res: any = await api.admin.replyTicket(openId, body);
      setReply("");
      await openThread(openId);
      await load();
      const sent = res?.delivery?.sent;
      const channel = thread?.channel;
      push(
        "success",
        channel === "whatsapp" && !sent
          ? t("حُفظ الرد — لكن إرساله لواتساب لم ينجح، افحص الويبهوك", "Saved — but the WhatsApp push failed, check the webhook")
          : t("أُرسل الرد للعميل", "Reply sent to the customer"),
      );
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
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base text-foreground">{t("صندوق الدعم الموحّد", "Unified support inbox")}</CardTitle>
        <div className="flex items-center gap-1.5">
          {TABS.map(([key, ar, en]) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setOpenId(null); setThread(null); }}
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
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                onClick={() => openThread(tk.id)}
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
        <div className="flex max-h-[460px] flex-col rounded-lg border border-border">
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
                        {m.authorType === "CUSTOMER" ? t("العميل", "Customer") : m.authorType === "ADMIN" ? t("أنت", "You") : t("الوكيل", "Agent")}
                        {" · "}{fmt(m.createdAt)}
                      </div>
                      {m.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-border p-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={t("ردّك كإنسان من فريق الدعم…", "Your human reply…")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
                <Button type="submit" disabled={busy || !reply.trim()} className="bg-success hover:bg-success">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
