/**
 * مركز الدعم · /app/help (W28)
 *
 * نموذج الدعم المعتمد من المالك: «وكيل يحل أغلب الأشياء + تصعيد مباشر»
 *  1) وكيل الدعم — نفس محرك الوكيل المحاسبي (يعرف التطبيق فعلًا) بأسئلة جاهزة
 *  2) التصعيد — واتساب (يظهر فقط عند ضبط SUPPORT_WHATSAPP في الخادم) + إيميل
 *  3) أسئلة شائعة مُتحققة من الكود — بلا أي ادعاء زائف
 * الصدق: باقة Lite بلا وكيل مُستضاف — تظهر لها الأسئلة الشائعة + قنوات التصعيد.
 */
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS: Array<{ ar: string; en: string }> = [
  { ar: "كيف أنقل بياناتي من برنامجي القديم بدون إدخال يدوي؟", en: "How do I migrate my data from my old software without manual entry?" },
  { ar: "كيف أنشئ فاتورة وأرسلها للعميل؟", en: "How do I create an invoice and send it to a customer?" },
  { ar: "كيف أضيف مستخدمًا لشركتي وما حدود باقتي؟", en: "How do I add a user to my company and what are my plan limits?" },
  { ar: "كيف يعمل الكاشير (POS) والوردية؟", en: "How does the cashier (POS) and shift work?" },
  { ar: "ما الفرق بين الباقات وهل الاشتراك على الشركة أم على حسابي؟", en: "What's the difference between plans, and is the subscription per company or per account?" },
  { ar: "كيف أنقل ملكية شركة أنشأتها لحساب عميل؟", en: "How do I transfer ownership of a company I created to a client's account?" },
];

const FAQS: Array<{ qAr: string; qEn: string; aAr: string; aEn: string }> = [
  { qAr: "الاشتراك على الشركة أم على الإيميل؟", qEn: "Is the subscription per company or per account?",
    aAr: "على الشركة. كل منشأة لها اشتراكها المستقل — وأنت كمالك تدخل كل شركاتك بنفس الحساب. شركتك الإضافية تحصل على خصم 30% تلقائي عند الدفع.",
    aEn: "Per company. Each entity has its own subscription — you access all your companies from one account. Your additional companies get an automatic 30% discount at checkout." },
  { qAr: "ماذا يحدث عند انتهاء التجربة المجانية؟", qEn: "What happens when the free trial ends?",
    aAr: "لا تُقفل بياناتك. تنزل المنشأة تلقائيًا للباقة الأساسية المجانية (فاتورة واحدة… حتى 5 فواتير شهريًا) وتقدر تترقى متى ما بغيت.",
    aEn: "Your data is never locked. The company gracefully falls back to the free Starter plan (up to 5 invoices/month) and you can upgrade anytime." },
  { qAr: "كم مستخدم أقدر أضيف؟", qEn: "How many users can I add?",
    aAr: "الأساسية: مستخدم واحد · الاحترافية: 5 · المؤسسات: غير محدود. تضيفهم من الإعدادات ← الأعضاء، وعند بلوغ الحد تظهر رسالة ترقية واضحة.",
    aEn: "Starter: 1 seat · Professional: 5 · Enterprise: unlimited. Add them in Settings → Members; a clear upgrade message appears at the limit." },
  { qAr: "كيف أنقل بياناتي من برنامجي القديم؟", qEn: "How do I migrate from my old software?",
    aAr: "من لوحة التحكم ← «أكمل إعداد شركتك»: أرصدة افتتاحية بقيد واحد متوازن، أصناف وجهات عبر CSV جاهز، أو استخرج بالذكاء الاصطناعي من صورة/PDF — بدون أي إدخال يدوي.",
    aEn: "From the dashboard → “Finish setting up”: opening balances in one balanced journal, items & contacts via ready CSV, or AI-extract from an image/PDF — zero manual entry." },
  { qAr: "هل يوجد كاشير نقاط بيع؟", qEn: "Is there a POS cashier?",
    aAr: "نعم — من المبيعات ← «كاشير POS». شاشة ملء-شاشة: باركود أولًا، نقود سريعة مع الباقي، تعليق فواتير، وردية بفتح وإغلاق ومطابقة درج، وإيصال 80مم.",
    aEn: "Yes — Sales → “Cashier POS”. Full-screen: barcode-first, quick cash with live change, held bills, shift open/close with drawer reconciliation, 80mm receipt." },
  { qAr: "ما حالة تكامل ZATCA؟", qEn: "What is the ZATCA integration status?",
    aAr: "تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.",
    aEn: "ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance." },
  { qAr: "كيف أنشئ شركة جديدة بسرعة؟", qEn: "How do I create a company quickly?",
    aAr: "من مبدّل الشركات ← «إنشاء منشأة جديدة»: اختر الدولة أولًا (السعودية/أمريكا) ثم الاسم فقط يكفي — الشعار والإيميل والنشاط اختيارية، وشجرة الحسابات تنبني حسب النشاط وتعدّلها لاحقًا.",
    aEn: "From the org switcher → “Create new company”: pick the country first (SA/US), then just a name is enough — logo/email/industry optional, and the chart of accounts builds from the industry, editable later." },
  { qAr: "ما سياسة شركة الديمو؟", qEn: "What's the demo company policy?",
    aAr: "ديمو واحدة فقط لكل حساب، تُحذف تلقائيًا بعد 30 يومًا حتى لا تتراكم البيانات. إنشاء واحدة جديدة يستبدل الحالية بعد تأكيدك.",
    aEn: "One demo per account, auto-deleted after 30 days so data never piles up. Creating a new one replaces the current after your confirmation." },
  { qAr: "كيف أنقل ملكية شركة لعميل؟", qEn: "How do I transfer a company to a client?",
    aAr: "الإعدادات ← منطقة الخطر ← «نقل ملكية الشركة»: أدخل إيميل حساب العميل (يجب أن يسجّل أولًا) — يصبح هو المالك وتبقى أنت مديرًا.",
    aEn: "Settings → danger zone → “Transfer company ownership”: enter the client's account email (they must register first) — they become OWNER and you stay an admin." },
  { qAr: "ما هي باقة Lite (375 ر.س/سنة)؟", qEn: "What is the Lite plan (375 SAR/yr)?",
    aAr: "للمشاريع الصغيرة جدًا والبقالات: فواتير ومصروفات وعملاء ومخزون وتقارير ضريبية بلا وكيل ذكاء اصطناعي مُستضاف — مع نقل بيانات مجاني بالذكاء الاصطناعي خلال أول 30 يومًا.",
    aEn: "For very small businesses & groceries: invoices, expenses, contacts, inventory and tax reports without the hosted AI agent — with free AI-assisted migration during the first 30 days." },
  { qAr: "بياناتي — من يملكها وكيف أخرجها؟", qEn: "My data — who owns it and how do I export?",
    aAr: "أنت تملك بياناتك 100%. تصدّرها في أي وقت من الإعدادات، ولا نبيع بياناتك لأحد، والنسخ الاحتياطي يومي.",
    aEn: "You own 100% of your data. Export anytime from Settings; we never sell data, and backups run daily." },
  { qAr: "كيف ألغي اشتراكي؟", qEn: "How do I cancel my subscription?",
    aAr: "من الاشتراك والفوترة ← بوابة Stripe — الإلغاء ذاتي وفوري ويظل الوصول حتى نهاية الفترة المدفوعة.",
    aEn: "From Subscription & billing → the Stripe portal — cancellation is self-serve and instant, with access kept until the paid period ends." },
];

export function HelpCenter() {
  const { t, language } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [cfg, setCfg] = useState<{ whatsapp: string | null; email: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatErr, setChatErr] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("https://api.entix.io/api/support/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ whatsapp: null, email: "support@entix.io" }));
  }, []);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setChatErr(null);
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      // locale is sent explicitly — with messages[] the server can't infer the
      // UI language and would default to Arabic (verified live: EN UI got AR reply).
      const r = await api.agent.chat({ messages: next.map((m) => ({ role: m.role, content: m.content })), locale: language } as any);
      const answer = (r as any)?.message || t("ما وصلني رد — جرّب مرة ثانية", "No reply came back — try again");
      setMsgs([...next, { role: "assistant", content: answer }]);
    } catch (e: any) {
      if (e instanceof ApiError && (e as any).status === 403) {
        setChatErr(t("وكيل الدعم الذكي متاح من الباقة الاحترافية — الأسئلة الشائعة تحت تغطي أغلب المواضيع، أو صعّد لنا مباشرة", "The AI support agent is available from the Professional plan — the FAQ below covers most topics, or escalate to us directly"));
      } else {
        setChatErr(t("تعذر الوصول للوكيل الآن — صعّد لنا مباشرة من الأزرار فوق", "Could not reach the agent right now — escalate via the buttons above"));
      }
      setMsgs(msgs);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("مركز الدعم", "Support center")}</h1>
        <p className="text-muted-foreground mt-1">{t("الوكيل يحل أغلب الأسئلة فورًا — وإلا صعّد لنا مباشرة", "The agent solves most questions instantly — otherwise escalate to us directly")}</p>
      </div>

      {/* escalation — direct line first (product requirement: يرتبط فيني مباشرة) */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-foreground" style={{ fontWeight: 700 }}>{t("تحتاج إنسانًا؟ كلمنا مباشرة", "Need a human? Talk to us directly")}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("نرد خلال ساعات العمل — وعادة أسرع بكثير", "We reply within business hours — usually much faster")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cfg?.whatsapp && (
              <a href={`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent("مرحبًا، أحتاج مساعدة في ENTIX Books")}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm text-white hover:opacity-90" style={{ fontWeight: 700 }}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.3.6-.6.8-.4 1.1.6 1.1 1.4 1.9 2.5 2.5.3.2.5.1.7-.1l.9-1c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.3 1.3Z"/></svg>
                {t("واتساب الدعم", "Support WhatsApp")}
              </a>
            )}
            <a href={`mailto:${cfg?.email || "support@entix.io"}?subject=${encodeURIComponent("دعم ENTIX Books")}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground hover:bg-muted/50" style={{ fontWeight: 600 }}>
              ✉️ {cfg?.email || "support@entix.io"}
            </a>
          </div>
        </div>
      </div>

      {/* support agent */}
      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <div className="text-foreground" style={{ fontWeight: 700 }}>{t("اسأل وكيل الدعم", "Ask the support agent")}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{t("يعرف التطبيق فعلًا — جرّب سؤالًا جاهزًا أو اكتب سؤالك", "It actually knows the app — try a suggested question or type yours")}</p>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {QUICK_PROMPTS.map((p) => (
            <button key={p.ar} onClick={() => ask(t(p.ar, p.en))} disabled={busy}
              className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground/80 hover:border-primary/40 hover:text-primary transition disabled:opacity-50">
              {t(p.ar, p.en)}
            </button>
          ))}
        </div>
        <div ref={threadRef} className="max-h-72 overflow-y-auto px-5 py-4 space-y-3">
          {msgs.length === 0 && !chatErr && (
            <div className="text-center text-xs text-muted-foreground/70 py-6">{t("لا رسائل بعد — اختر سؤالًا جاهزًا بالأعلى أو اكتب سؤالك تحت", "No messages yet — pick a suggested question above or type below")}</div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-white" : "bg-muted/60 text-foreground"}`}>{m.content}</div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">…</div></div>}
          {chatErr && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">{chatErr}</div>}
        </div>
        <div className="border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={t("اكتب سؤالك هنا…", "Type your question…")}
              className="flex-1 rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none" />
            <button type="submit" disabled={busy || !input.trim()}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50" style={{ fontWeight: 700 }}>
              {t("إرسال", "Send")}
            </button>
          </form>
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="text-foreground" style={{ fontWeight: 700 }}>{t("الأسئلة الشائعة", "Frequently asked questions")}</div>
          <button onClick={() => setOpenFaq(openFaq === -1 ? null : -1)} className="text-xs text-primary hover:underline">
            {openFaq === -1 ? t("طي الكل", "Collapse all") : t("توسيع الكل", "Expand all")}
          </button>
        </div>
        <div className="divide-y divide-border/70">
          {FAQS.map((f, i) => (
            <div key={i}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-start text-sm text-foreground hover:bg-muted/30">
                <span style={{ fontWeight: 600 }}>{t(f.qAr, f.qEn)}</span>
                <span className={`text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`}>▾</span>
              </button>
              {(openFaq === i || openFaq === -1) && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{t(f.aAr, f.aEn)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
