/**
 * MarketingChat · floating assistant bubble for marketing pages
 * SCAFFOLD — will be wired to a specialized Azure-hosted marketing agent.
 * Endpoint resolution order:
 *   1) import.meta.env.VITE_MARKETING_CHAT_URL  (future Azure agent endpoint)
 *   2) graceful local fallback reply (support contact) — no error surfaced to visitors
 */
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "./LanguageContext";
import { usePublicRoute } from "../lib/public-route";

interface Msg { from: "bot" | "user"; text: string }

const CHAT_URL: string = (import.meta as any).env?.VITE_MARKETING_CHAT_URL || "";

export function MarketingChat() {
  const { language, t } = useLanguage();
  const { href } = usePublicRoute();
  const isAr = language !== "en";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        from: "bot",
        text: t(
          "أهلاً بك في ENTIX.IO 👋 كيف أقدر أساعدك؟ اسأل عن الأسعار أو المزايا أو برنامج الإحالة.",
          "Welcome to ENTIX.IO 👋 How can I help? Ask about pricing, features, or the referral program."
        ),
      }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const fallbackReply = () =>
    t(
      "المساعد الذكي قيد التجهيز حالياً — فريقنا يرد بسرعة على support@entix.io أو +1 (442) 444-410. وتقدر أيضاً تشوف صفحة الأسعار أو برنامج الإحالة.",
      "The smart assistant is being finalized — our team replies quickly at support@entix.io or +1 (442) 444-410. You can also check the pricing page or the referral program."
    );

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { from: "user", text }]);
    setBusy(true);
    try {
      if (CHAT_URL) {
        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, locale: language }),
        });
        if (!res.ok) throw new Error(`chat ${res.status}`);
        const data = await res.json().catch(() => ({}));
        setMsgs((m) => [...m, { from: "bot", text: data.reply || fallbackReply() }]);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        setMsgs((m) => [...m, { from: "bot", text: fallbackReply() }]);
      }
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: fallbackReply() }]);
    } finally {
      setBusy(false);
    }
  };

  const quick = [
    { label: t("الأسعار", "Pricing"), href: "/pricing" },
    { label: t("برنامج الإحالة", "Referrals"), href: "/referrals" },
    { label: t("المزايا", "Features"), href: "/features" },
  ];

  return (
    <>
      {/* Floating bubble — above the mobile bottom CTA bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("محادثة المساعد", "Assistant chat")}
        className={`fixed z-40 bottom-20 lg:bottom-6 ${isAr ? "left-4" : "right-4"} w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-primary text-white shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer`}
        style={{ width: 52, height: 52 }}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={`fixed z-40 bottom-[136px] lg:bottom-24 ${isAr ? "left-4" : "right-4"} w-[calc(100vw-2rem)] max-w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col`}
            dir={isAr ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="bg-foreground px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-white" style={{ fontSize: "14px", fontWeight: 700 }}>{t("مساعد ENTIX", "ENTIX Assistant")}</div>
                <div className="flex items-center gap-1.5 text-white/60" style={{ fontSize: "11px" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {t("متاح — رد فوري", "Online — instant reply")}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors cursor-pointer" aria-label={t("إغلاق", "Close")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 320, minHeight: 220 }}>
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      m.from === "user"
                        ? "bg-primary text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 max-w-[85%]"
                        : "bg-muted/60 text-foreground rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[85%]"
                    }
                    style={{ fontSize: "13px", lineHeight: 1.8 }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {quick.map((q) => (
                <a
                  key={q.href}
                  href={href(q.href)}
                  className="text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full transition-colors"
                  style={{ fontSize: "12px", fontWeight: 600 }}
                >
                  {q.label}
                </a>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 p-3 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder={t("اكتب سؤالك…", "Type your question…")}
                className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
                style={{ fontSize: "13px" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || busy}
                className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/80 disabled:opacity-40 transition-all cursor-pointer"
                aria-label={t("إرسال", "Send")}
              >
                <Send className={`w-4 h-4 ${isAr ? "-scale-x-100" : ""}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
