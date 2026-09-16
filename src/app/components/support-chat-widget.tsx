/**
 * Entix Books · public support chat widget (2026-09-14)
 *
 * One floating thread on every public page and inside the app. The answer comes
 * from the same brain that answers WhatsApp (`/api/public/support/chat`), so a
 * visitor and a WhatsApp lead hear exactly the same thing about pricing, ZATCA
 * and what is still «قيد الإطلاق».
 *
 * UX-1 compliant: no <Dialog>, no <Sheet>, no window.alert/confirm — a plain
 * fixed panel that never blocks the page.
 *
 * State: sessionId in localStorage (per browser). Nothing else is stored client
 * side; the thread itself lives in AdminTicket so the CEO can answer it from
 * /admin/support and the visitor sees that human reply on the next poll.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, User } from "lucide-react";
import { API_BASE_URL } from "../lib/api";
import { useLanguage } from "./LanguageContext";

type Author = "you" | "agent" | "team";
type Msg = { id: string; author: Author; body: string; createdAt?: string };

const SESSION_KEY = "entix-support-session";
/**
 * Public marketing surface only. Signed-in users already have the in-app AI
 * assistant and the help centre, and a floating button inside /app would also
 * sit on top of every visual-regression snapshot. Anything under these prefixes
 * never renders the widget.
 */
const HIDDEN_PREFIXES = [
  "/app", "/admin", "/welcome", "/onboarding",
  "/login", "/register", "/forgot-password", "/reset-password", "/invite", "/claim",
  "/print", "/q/", "/b/", "/portal",
];
const POLL_MS = 12_000;

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function writeSession(id: string) {
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* private mode — the thread still works for this page view */
  }
}

export function SupportChatWidget() {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [whatsapp, setWhatsapp] = useState("966593305959");
  const [needsHuman, setNeedsHuman] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const sessionRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const hidden = HIDDEN_PREFIXES.some((p) => path.startsWith(p));

  useEffect(() => {
    sessionRef.current = readSession();
  }, []);

  // Boot payload: greeting + the live WhatsApp number, both owned by the API.
  useEffect(() => {
    if (hidden) return;
    let alive = true;
    fetch(`${API_BASE_URL}/api/public/support/health?lang=${language}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.greeting) setGreeting(d.greeting);
        if (d?.whatsapp) setWhatsapp(String(d.whatsapp).replace(/\D/g, ""));
      })
      .catch(() => { /* widget still works — greeting falls back below */ });
    return () => { alive = false; };
  }, [language, hidden]);

  const poll = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/public/support/chat/${sid}`);
      if (!r.ok) return;
      const d = await r.json();
      if (!Array.isArray(d.messages)) return;
      setMsgs((prev) => {
        if (d.messages.length > prev.length && !open) {
          const added = d.messages.slice(prev.length).filter((m: Msg) => m.author === "team");
          if (added.length) setUnseen((u) => u + added.length);
        }
        return d.messages;
      });
      setNeedsHuman(!!d.needsHuman);
    } catch { /* offline — retry on the next tick */ }
  }, [open]);

  // Poll only while there is a thread: a human reply from /admin/support has to
  // reach the visitor without a refresh.
  useEffect(() => {
    if (hidden || !sessionRef.current) return;
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll, hidden]);

  useEffect(() => {
    if (open) {
      setUnseen(0);
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [open, msgs.length]);

  if (hidden) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    setMsgs((m) => [...m, { id: `local-${Date.now()}`, author: "you", body: text }]);
    try {
      const r = await fetch(`${API_BASE_URL}/api/public/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionRef.current,
          text,
          page: path,
          lang: language === "ar" ? "ar" : "en",
        }),
      });
      const d = await r.json();
      if (d?.sessionId) {
        sessionRef.current = d.sessionId;
        writeSession(d.sessionId);
      }
      if (d?.reply) setMsgs((m) => [...m, { id: d.ticketId + Date.now(), author: "agent", body: d.reply }]);
      if (d?.handoff) setNeedsHuman(true);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          author: "agent",
          body: t(
            "تعذّر الإرسال الآن. جرّب مرة ثانية أو راسلنا واتساب.",
            "Could not send just now. Try again, or message us on WhatsApp.",
          ),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const shown: Msg[] = msgs.length
    ? msgs
    : [{ id: "greet", author: "agent", body: greeting || t("حياك الله في Entix Books 👋 وش أقدر أساعدك فيه؟", "Welcome to Entix Books 👋 How can I help?") }];

  return (
    <>
      {open && (
        <div
          dir={language === "ar" ? "rtl" : "ltr"}
          className="fixed bottom-20 end-4 z-50 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-raised"
          style={{ height: "min(560px, calc(100dvh - 7rem))" }}
          role="complementary"
          aria-label={t("دعم Entix", "Entix support")}
        >
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="min-w-0">
              <div className="text-sm" style={{ fontWeight: 600 }}>{t("فريق Entix", "Entix team")}</div>
              <div className="text-[11px] opacity-80">
                {needsHuman
                  ? t("طلبك وصل الفريق — الرد يظهر هنا", "Your request reached the team — the reply shows up here")
                  : t("نرد خلال ثوانٍ", "We answer in seconds")}
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t("إغلاق", "Close")} className="rounded-lg p-1.5 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-background px-3 py-3">
            {shown.map((m) => (
              <div key={m.id} className={`flex ${m.author === "you" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.author === "you"
                      ? "bg-primary text-primary-foreground"
                      : m.author === "team"
                        ? "border border-success-border bg-success-subtle text-foreground"
                        : "border border-border bg-card text-foreground"
                  }`}
                >
                  {m.author === "team" && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] text-success">
                      <User className="h-3 w-3" />
                      {t("رد من فريق الدعم", "Reply from the support team")}
                    </div>
                  )}
                  {m.body}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-card px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("اكتب سؤالك…", "Type your question…")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t("إرسال", "Send")}
              className="rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-t border-border bg-muted/40 px-3 py-2 text-center text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t("تفضّل واتساب؟ راسلنا على", "Prefer WhatsApp? Message us on")} <span className="font-english">+{whatsapp}</span>
          </a>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("محادثة الدعم", "Support chat")}
        className="fixed bottom-4 end-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition hover:opacity-90"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && unseen > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-primary-foreground">
            {unseen}
          </span>
        )}
      </button>
    </>
  );
}
