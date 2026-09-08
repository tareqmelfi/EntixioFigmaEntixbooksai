import { displayLocale } from "../lib/number-display";
import { EntixWordmark } from "../components/entix-brand";
import { motion } from "motion/react";
import { Check, X, Sparkles, ArrowLeft, ArrowRight, HelpCircle, Rocket, ArrowLeftRight, Gift, AlertCircle, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { api } from "../lib/api";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";

type Tier = "starter" | "lite" | "professional" | "enterprise";
type Cell = { ar: string; en: string; state?: "under-validation" } | boolean;

interface PlanDef {
  tier: Tier;
  name: { ar: string; en: string };
  desc: { ar: string; en: string };
  popular?: boolean;
  price: Record<"SAR" | "USD", { monthly: number; yearly: number }>;
  /** anchor list price (monthly, strikethrough) — charge price stays `price` */
  standard?: Record<"SAR" | "USD", number>;
  features: { ar: string[]; en: string[] };
  /** Market-scoped overrides — features follow the visitor's COUNTRY market,
   * never the payment currency (owner rule 2026-08-22). */
  featuresSa?: { ar: string[]; en: string[] };
  featuresUs?: { ar: string[]; en: string[] };
  /** Annual-only tiers (Lite) hide on the monthly view. */
  annualOnly?: boolean;
}

const PLANS: PlanDef[] = [
  {
    tier: "starter",
    name: { ar: "أساسي", en: "Starter" },
    desc: { ar: "للمشاريع الناشئة والأفراد", en: "For early-stage projects & individuals" },
    price: { SAR: { monthly: 0, yearly: 0 }, USD: { monthly: 0, yearly: 0 } },
    features: {
      ar: ["5 فواتير شهريًا", "مستخدم واحد", "تقارير أساسية"],
      en: ["5 invoices / month", "1 user", "Basic reports"],
    },
    featuresSa: {
      ar: ["5 فواتير شهريًا", "مستخدم واحد", "تقارير أساسية", "ZATCA Phase 2 — قيد التحقق"],
      en: ["5 invoices / month", "1 user", "Basic reports", "ZATCA Phase 2 — Under validation"],
    },
  },
  {
    tier: "lite",
    name: { ar: "لايت", en: "Lite" },
    desc: { ar: "محاسبة كاملة بسعر اقتصادي — بدون ذكاء اصطناعي", en: "Full accounting at an economy price — no hosted AI" },
    annualOnly: true,
    price: { SAR: { monthly: 0, yearly: 535 }, USD: { monthly: 0, yearly: 99 } },
    features: {
      ar: ["فواتير ومصروفات غير محدودة", "عملاء وموردون وأصناف", "تقارير أساسية وضريبية", "مستخدم واحد", "نقل بيانات مجاني أول مرة"],
      en: ["Unlimited invoices & expenses", "Customers, suppliers & items", "Core & tax reports", "1 user", "Free first data migration"],
    },
    featuresSa: {
      ar: ["فواتير ومصروفات غير محدودة", "عملاء وموردون وأصناف", "تقارير أساسية وضريبية", "جاهزية ZATCA + QR", "مستخدم واحد", "نقل بيانات مجاني أول مرة"],
      en: ["Unlimited invoices & expenses", "Customers, suppliers & items", "Core & tax reports", "ZATCA + QR readiness", "1 user", "Free first data migration"],
    },
  },
  {
    tier: "professional",
    name: { ar: "احترافي", en: "Professional" },
    desc: { ar: "للشركات الصغيرة والمتوسطة", en: "For small & medium businesses" },
    popular: true,
    price: { SAR: { monthly: 99, yearly: 950 }, USD: { monthly: 19, yearly: 190 } },
    standard: { SAR: 149, USD: 29 },
    features: {
      ar: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "تقارير متقدمة", "وصول API (مفاتيح · استيراد جماعي)"],
      en: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "Advanced reports", "API access (keys · bulk import)"],
    },
    // Features follow the MARKET, never the payment currency (owner rule:
    // a Saudi company paying in USD still gets ZATCA; a US company never sees it).
    featuresSa: {
      ar: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "ZATCA Phase 2 — قيد التحقق", "وصول API (مفاتيح · استيراد جماعي)"],
      en: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "ZATCA Phase 2 — Under validation", "API access (keys · bulk import)"],
    },
    featuresUs: {
      ar: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "تكاملات بنكية (Plaid)", "تتبع موردي 1099", "وصول API (مفاتيح · استيراد جماعي)"],
      en: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "Bank feeds (Plaid)", "1099 vendor tracking", "API access (keys · bulk import)"],
    },
  },
  {
    tier: "enterprise",
    name: { ar: "مؤسسي", en: "Enterprise" },
    desc: { ar: "للمؤسسات الكبيرة", en: "For large organizations" },
    price: { SAR: { monthly: 299, yearly: 2990 }, USD: { monthly: 59, yearly: 590 } },
    standard: { SAR: 449, USD: 89 },
    features: {
      ar: ["كل مزايا الاحترافي", "مستخدمون غير محدودون", "AI متقدم بلا حدود", "تعدد عملات كامل", "سجل تدقيق", "دعم أولوية"],
      en: ["Everything in Pro", "Unlimited users", "Advanced unlimited AI", "Full multi-currency", "Audit log", "Priority support"],
    },
  },
];

interface ComparisonRow { name: { ar: string; en: string }; free: Cell; pro: Cell; enterprise: Cell }
interface ComparisonCategory { category: { ar: string; en: string }; features: ComparisonRow[] }

const COMPARISON: ComparisonCategory[] = [
  { category: { ar: "الفواتير والمبيعات", en: "Invoicing & sales" }, features: [
    { name: { ar: "الفواتير شهريًا", en: "Monthly invoices" }, free: { ar: "5", en: "5" }, pro: { ar: "غير محدود", en: "Unlimited" }, enterprise: { ar: "غير محدود", en: "Unlimited" } },
    { name: { ar: "عروض الأسعار", en: "Quotes" }, free: true, pro: true, enterprise: true },
    { name: { ar: "ZATCA Phase 2 — قيد التحقق", en: "ZATCA Phase 2 — Under validation" }, free: { ar: "قيد التحقق", en: "Under validation", state: "under-validation" }, pro: { ar: "قيد التحقق", en: "Under validation", state: "under-validation" }, enterprise: { ar: "قيد التحقق", en: "Under validation", state: "under-validation" } },
    { name: { ar: "التقارير", en: "Reports" }, free: { ar: "أساسية", en: "Basic" }, pro: { ar: "متقدمة", en: "Advanced" }, enterprise: { ar: "مخصصة", en: "Custom" } },
  ]},
  { category: { ar: "المستخدمون والذكاء الاصطناعي", en: "Users & AI" }, features: [
    { name: { ar: "عدد المستخدمين", en: "User seats" }, free: { ar: "1", en: "1" }, pro: { ar: "حتى 5", en: "Up to 5" }, enterprise: { ar: "غير محدود", en: "Unlimited" } },
    { name: { ar: "وكيل الذكاء الاصطناعي", en: "AI agent" }, free: false, pro: { ar: "كامل", en: "Full" }, enterprise: { ar: "متقدم بلا حدود", en: "Advanced unlimited" } },
    { name: { ar: "سجل التدقيق", en: "Audit log" }, free: false, pro: false, enterprise: true },
    { name: { ar: "تعدد العملات الكامل", en: "Full multi-currency" }, free: false, pro: false, enterprise: true },
  ]},
  { category: { ar: "التكامل والدعم", en: "Integration & support" }, features: [
    { name: { ar: "التكاملات البنكية (Plaid)", en: "Bank feeds (Plaid)" }, free: false, pro: true, enterprise: true },
    { name: { ar: "API", en: "API access" }, free: false, pro: { ar: "كامل", en: "Full" }, enterprise: { ar: "كامل", en: "Full" } },
    { name: { ar: "الدعم", en: "Support" }, free: { ar: "بريد", en: "Email" }, pro: { ar: "مباشر", en: "Live" }, enterprise: { ar: "أولوية", en: "Priority" } },
    { name: { ar: "باقة مجانية دائمة", en: "Permanent free plan" }, free: true, pro: true, enterprise: true },
  ]},
];

export function PricingPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const isAr = language !== "en";
  // Currency follows the visitor's MARKET (country), never the UI language —
  // a Saudi reading English still pays SAR; a US reader of Arabic pays USD.
  const { isSA } = useMarketingRegion();
  // Yearly first (owner directive 2026-08-22): the discount is the headline —
  // monthly is the opt-out toggle, not the default.
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<"SAR" | "USD">(isSA ? "SAR" : "USD");
  const [showComparison, setShowComparison] = useState(false);
  const [livePriceIds, setLivePriceIds] = useState<Record<string, string>>({});
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [openFaqs, setOpenFaqs] = useState<number[]>([0]);
  // Billing identity must be VISIBLE before checkout — on a shared device the
  // previous person's session/email can otherwise carry into the payment page
  // without the new subscriber noticing.
  const [authState, setAuthState] = useState(authStore.getState());
  useEffect(() => authStore.subscribe(setAuthState), []);

  const switchAccount = async () => {
    await authStore.logout();
    navigate("/login");
  };

  const cell = (v: Cell): string => (typeof v === "boolean" ? "" : isAr ? v.ar : v.en);
  const featureList = (plan: PlanDef): string[] => {
    const scoped = isSA ? plan.featuresSa : plan.featuresUs;
    const pack = scoped || plan.features;
    return isAr ? pack.ar : pack.en;
  };

  // Live Stripe plans → map tier+interval+currency to the real priceId so the
  // CTA can start a real checkout for logged-in users (guests register first).
  useEffect(() => {
    api.stripe.plans().then((d) => {
      const map: Record<string, string> = {};
      for (const p of d.plans || []) {
        map[`${p.tier}:${p.interval}:${(p.currency || "sar").toLowerCase()}`] = p.stripePriceId;
      }
      setLivePriceIds(map);
    }).catch(() => {});
  }, []);

  /**
   * «ابدأ مجانًا» — the free path. Unchanged behaviour: guests register, a
   * signed-in user manages the plan from billing.
   */
  const startFree = () => {
    navigate(authStore.getState().isAuthenticated ? "/app/billing" : "/register");
  };

  /**
   * «اشترك الآن» — the MONEY path (CEO 2026-09-08: paying must never require an
   * account first). A guest goes straight to Stripe Checkout via the public
   * endpoint, which resolves the plan server-side from tier+interval+market —
   * so a missing client-side priceId can no longer divert a paying visitor into
   * the registration form, which is exactly what was costing sales.
   */
  const buyNow = async (tier: Tier) => {
    const interval = billingCycle === "monthly" ? "month" : "year";
    setCheckoutBusy(tier);
    setCheckoutError(null);
    try {
      const { url } = await api.public.checkout({
        planId: livePriceIds[`${tier}:${interval}:${currency.toLowerCase()}`] || undefined,
        tier,
        interval,
        locale: isAr ? "ar" : "en",
        market: currency === "SAR" ? "sa" : "us",
      });
      window.location.href = url;
    } catch (e: any) {
      setCheckoutBusy(null);
      setCheckoutError(e?.message || "checkout_failed");
    }
  };

  const subscribe = async (tier: Tier) => {
    const interval = billingCycle === "monthly" ? "month" : "year";
    const priceId = livePriceIds[`${tier}:${interval}:${currency.toLowerCase()}`];
    const authed = authStore.getState().isAuthenticated;
    // Starter (free): guests register; signed-in users manage it from billing —
    // never bounce a logged-in user to /register (that just dumps them inside
    // the app with no explanation).
    if (tier === "starter") { startFree(); return; }
    // Pay-first: guests pay BEFORE any account exists — the account is created
    // from the email Stripe collects (owner directive 2026-08-22 · 2026-09-08).
    if (!authed) { await buyNow(tier); return; }
    if (!priceId) { navigate("/app/billing"); return; }
    setCheckoutBusy(tier);
    setCheckoutError(null);
    try {
      const { url } = await api.stripe.createCheckoutSession(
        priceId,
        `${window.location.origin}/app/billing?success=true`,
        `${window.location.origin}/pricing?canceled=true`,
      );
      window.location.href = url;
    } catch (e: any) {
      // Surface the failure in place — a silent redirect into the app reads
      // like "the button did nothing".
      setCheckoutBusy(null);
      setCheckoutError(e?.message || "checkout_failed");
    }
  };

  const faqs = [
    {
      q: { ar: "هل يمكنني الترقية أو التخفيض في أي وقت؟", en: "Can I upgrade or downgrade anytime?" },
      a: { ar: "نعم، يمكنك تغيير باقتك في أي وقت. عند الترقية، ستدفع الفرق المتناسب للفترة المتبقية. عند التخفيض، سيطبق التغيير في بداية دورة الفوترة التالية.", en: "Yes, change your plan anytime. Upgrades are prorated for the remaining period; downgrades apply at the next billing cycle." },
    },
    {
      q: { ar: "هل يوجد التزام أو عقد طويل؟", en: "Is there a long-term commitment?" },
      a: { ar: "لا. الدفع مباشر والتفعيل فوري، وتقدر تلغي في أي وقت من بوابة الفوترة — تبقى صلاحيتك حتى نهاية الفترة المدفوعة. والباقة المجانية متاحة دائمًا بلا بطاقة.", en: "No. You pay upfront and activate instantly, and you can cancel anytime from the billing portal — access stays until the end of the paid period. The free Starter plan is always available, no card required." },
    },
    {
      q: { ar: "هل الاشتراك على الشركة أم على المستخدم؟", en: "Is billing per company or per user?" },
      a: { ar: "على الشركة. تدفع باقة واحدة لكل شركة، وتضيف فريقك مجانًا ضمن حدود الباقة (أساسي: مستخدم واحد · احترافي: حتى 5 · مؤسسي: غير محدود). الأعضاء المدعوون لا يدفعون شيئًا — يكفيهم قبول الدعوة.", en: "Per company. You pay one plan per company and invite your team free within the plan's seats (Starter: 1 · Professional: up to 5 · Enterprise: unlimited). Invited members pay nothing — they simply accept the invite." },
    },
    {
      q: { ar: "عندي أكثر من شركة — هل أدفع لكل شركة؟", en: "I run multiple companies — do I pay for each one?" },
      a: { ar: "لكل شركة اشتراكها المستقل، وتقدر تُبقي أي شركة على الباقة المجانية بحدودها. ولأنك معنا: كل شركة إضافية تحصل تلقائيًا على خصم 30% طالما شركتك الأولى مشتركة بباقة مدفوعة — يظهر الخصم في صفحة الدفع.", en: "Each company has its own subscription, and you can keep any company on the free Starter plan within its limits. As a bonus: every additional company gets an automatic 30% discount while your first company stays on a paid plan — shown at checkout." },
    },
    {
      q: { ar: "هل الأسعار شاملة ضريبة القيمة المضافة؟", en: "Are prices VAT-inclusive?" },
      a: { ar: "قد تُضاف ضريبة القيمة المضافة عند الدفع حسب موقعك والأنظمة المطبقة — تظهر التفاصيل النهائية في صفحة الدفع قبل التأكيد.", en: "Applicable taxes may be added at checkout based on your location — final details are shown on the payment page before you confirm." },
    },
    {
      q: { ar: "ما هي طرق الدفع المتاحة؟", en: "Which payment methods do you accept?" },
      a: { ar: "نقبل البطاقات الائتمانية الرئيسية (Visa, Mastercard, Mada) عبر Stripe الآمنة — لا تُحفظ بيانات بطاقتك لدينا.", en: "Major cards (Visa, Mastercard, Mada) via secure Stripe checkout — your card details are never stored with us." },
    },
    {
      q: { ar: "هل يمكنني استرداد أموالي؟", en: "Can I get a refund?" },
      a: { ar: "نعم، نوفر ضمان استرداد الأموال لمدة 30 يوم من تاريخ الاشتراك الأول. لا توجد أسئلة معقدة.", en: "Yes — 30-day money-back guarantee from your first subscription date. No questions asked." },
    },
  ];

  const currencySymbol = currency === "USD" ? "$" : "";
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  // Page shell + display hierarchy — same 72px gutters and serif/Arabic split
  // as the approved artboards (Latin display = serif, Arabic = Plex Arabic 700).
  const SHELL = "mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px]";
  const heroHeadingClass = isAr
    ? "font-bold m-0 text-[30px] sm:text-[40px] lg:text-[48px] leading-[1.3] text-foreground"
    : "font-display font-normal m-0 text-[38px] sm:text-[52px] lg:text-[64px] leading-none text-foreground";
  const sectionHeadingClass = isAr
    ? "font-bold m-0 text-[24px] sm:text-[30px] lg:text-[34px] leading-[1.3] text-foreground"
    : "font-display font-normal m-0 text-[30px] sm:text-[36px] lg:text-[42px] leading-[1.05] text-foreground";

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <SharedNavbar />
      <main>

      {/* Hero Section */}
      <section className={`${SHELL} pt-[104px] lg:pt-[168px] pb-10`}>
        <div className="max-w-[1100px] mx-auto text-center flex flex-col items-center gap-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
            <span className="ledger-eyebrow text-primary">{t("الأسعار", "Pricing")}</span>
            <h1 className={heroHeadingClass}>
              {t("شهر مجاني كامل. ثم سعر واحد صريح.", "One free month. Then one honest price.")}
            </h1>
            <p className="text-content-secondary m-0 max-w-[560px]" style={{ fontSize: "18px", lineHeight: isAr ? 1.8 : 1.5 }}>
              {t("كل باقة تشمل العربية والإنجليزية والضريبة وربط البنوك وتصدير غير محدود — ابدأ مجاناً وادفع فقط مقابل ما تحتاجه.", "Every plan includes Arabic and English, VAT, bank feeds and unlimited exports. Start free — pay only for what you need.")}
            </p>

            {/* Billing Cycle + Currency Toggles */}
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              <span className="inline-flex rounded-full border border-border bg-card p-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-full px-[18px] py-2 transition-colors cursor-pointer ${
                    billingCycle === "monthly" ? "bg-foreground text-background" : "text-content-secondary hover:text-foreground"
                  }`}
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {t("شهري", "Monthly")}
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`inline-flex items-center gap-2 rounded-full px-[18px] py-2 transition-colors cursor-pointer ${
                    billingCycle === "yearly" ? "bg-foreground text-background" : "text-content-secondary hover:text-foreground"
                  }`}
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {t("سنوي · وفّر", "Yearly · save")}
                  <span className={billingCycle === "yearly" ? "text-background/70" : "text-primary"} style={{ fontSize: "11px", fontWeight: 700 }}>
                    {currency === "SAR" ? t("وفّر 238 ر.س+", "Save 238+ SAR") : t("وفّر $38+", "Save $38+")}
                  </span>
                </button>
              </span>
              <span className="inline-flex rounded-full border border-border bg-card p-1">
                {(["SAR", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`rounded-full px-4 py-2 transition-colors cursor-pointer ${currency === c ? "bg-foreground text-background" : "text-content-secondary hover:text-foreground"}`}
                    style={{ fontSize: "13px", fontWeight: 700 }}
                  >
                    {c === "SAR" ? t("ر.س", "SAR") : "$ USD"}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-1 text-content-secondary" style={{ fontSize: "13px" }}>
              <span className="inline-flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                {t("إطلاق تجريبي — كن من الداعمين الأوائل", "Launch Beta — be an early supporter")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                {t("ادفع اليوم وابدأ العمل فورًا — التفعيل لحظي بعد الدفع", "Pay today and start immediately — activation is instant after payment")}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className={`${SHELL} pt-6 pb-10`}>
        <div>
          {authState.isAuthenticated && authState.user && (
            <div className="max-w-2xl mx-auto mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 bg-info-subtle border border-info-border text-foreground rounded-lg px-5 py-3.5" role="note">
              <p style={{ fontSize: "13px", fontWeight: 500 }}>
                {t("سيتم الاشتراك باسم", "Subscribing as")}{" "}
                <span className="font-semibold" dir="ltr">{authState.user.email}</span>
                {authState.user.company ? <> · {authState.user.company}</> : null}
                {" — "}
                {t("تأكد أن هذا حسابك قبل الدفع", "make sure this is your account before paying")}
              </p>
              <button
                type="button"
                onClick={switchAccount}
                className="text-primary hover:underline cursor-pointer"
                style={{ fontSize: "13px", fontWeight: 700 }}
              >
                {t("ليس حسابك؟ بدّل الحساب", "Not you? Switch account")}
              </button>
            </div>
          )}
          {checkoutError && (
            <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3 bg-danger-subtle border border-danger-border text-danger rounded-lg px-5 py-3.5" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <p style={{ fontSize: "14px", fontWeight: 500 }}>
                {t("تعذّر فتح صفحة الدفع — حاول مرة أخرى أو تواصل معنا على support@entix.io", "Couldn't open secure checkout — please try again or reach us at support@entix.io")}
                <span className="block text-content-secondary mt-0.5 font-code" style={{ fontSize: "12px" }} dir="ltr">{checkoutError}</span>
              </p>
              <button onClick={() => setCheckoutError(null)} className="ms-auto shrink-0 cursor-pointer" aria-label="dismiss">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {PLANS.filter((plan) => !plan.annualOnly || billingCycle === "yearly").map((plan, i) => (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-lg border p-7 sm:px-7 sm:py-8 relative flex flex-col gap-5 ${
                  plan.popular ? "bg-foreground border-foreground text-background" : "bg-card border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 start-7">
                    <span className="rounded-full bg-[var(--brand-blue-600)] px-3 py-1 text-primary-foreground whitespace-nowrap" style={{ fontSize: "11px", fontWeight: 600 }}>
                      {t("الأكثر شعبية", "Most popular")}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <h3 className={plan.popular ? "text-background m-0" : "text-foreground m-0"} style={{ fontSize: "18px", fontWeight: 600 }}>
                    {isAr ? plan.name.ar : plan.name.en}
                  </h3>
                  <p className={plan.popular ? "text-background/70 m-0" : "text-content-secondary m-0"} style={{ fontSize: "14px", lineHeight: 1.5 }}>
                    {isAr ? plan.desc.ar : plan.desc.en}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {billingCycle === "monthly" && plan.standard && plan.price[currency].monthly > 0 && (
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className={plan.popular ? "text-background/60" : "text-content-secondary"} style={{ fontSize: "14px", fontWeight: 500, textDecoration: "line-through" }}>
                        {currencySymbol}{plan.standard[currency]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 ${plan.popular ? "bg-background/10 text-background" : "bg-success-subtle text-success"}`} style={{ fontSize: "11px", fontWeight: 600 }}>
                        {t("سعر الإطلاق", "Launch price")} −{Math.round((1 - plan.price[currency].monthly / plan.standard[currency]) * 100)}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1.5" dir="ltr">
                    <span className={`font-display leading-none text-[44px] lg:text-[52px] ${plan.popular ? "text-background" : "text-foreground"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                      {plan.price[currency][billingCycle] === 0
                        ? t("مجاني", "Free")
                        : `${currencySymbol}${plan.price[currency][billingCycle].toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })}`}
                    </span>
                    {plan.price[currency][billingCycle] > 0 && (
                      <span className={plan.popular ? "text-background/70" : "text-content-secondary"} style={{ fontSize: "14px" }}>
                        {currency === "SAR" ? t("ر.س", "SAR") : ""} / {billingCycle === "monthly" ? t("شهر", "mo") : t("سنة", "yr")}
                      </span>
                    )}
                  </div>
                  {billingCycle === "yearly" && plan.price[currency].yearly > 0 && plan.price[currency].monthly > 0 && (
                    <>
                      <p className={`m-0 ${plan.popular ? "text-background/80" : "text-success"}`} style={{ fontSize: "13px", fontWeight: 600 }} dir="ltr">
                        {t("وفّر", "Save")} {currencySymbol}{(plan.price[currency].monthly * 12 - plan.price[currency].yearly).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })} {currency === "SAR" ? t("ر.س", "SAR") : "USD"} {t("سنوياً", "per year")}
                      </p>
                      <p className={`m-0 ${plan.popular ? "text-background/60" : "text-content-secondary"}`} style={{ fontSize: "12px" }} dir="ltr">
                        ≈ {currencySymbol}{(plan.price[currency].yearly / 12).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })} {t("/ شهر", "/ mo")} · {t("تُدفع", "billed")} {currencySymbol}{plan.price[currency].yearly.toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })} {t("سنويًا", "yearly")}
                      </p>
                    </>
                  )}
                </div>

                {/* TWO actions per paid plan (CEO 2026-09-08): pay now WITHOUT
                    an account, or take the free plan. The free tier keeps its
                    single action — there is nothing to pay for. */}
                <div className="flex flex-col gap-2" data-testid={`plan-actions-${plan.tier}`}>
                  <button
                    onClick={() => subscribe(plan.tier)}
                    disabled={checkoutBusy !== null}
                    data-testid={`plan-subscribe-${plan.tier}`}
                    className={`w-full rounded-full py-3.5 transition-colors cursor-pointer disabled:opacity-60 ${
                      plan.popular
                        ? "bg-[var(--brand-blue-600)] text-primary-foreground hover:opacity-90"
                        : "border border-foreground text-foreground hover:bg-surface-hover"
                    }`}
                    style={{ fontSize: "15px", fontWeight: 600 }}
                  >
                    {checkoutBusy === plan.tier
                      ? t("جارٍ تحويلك لصفحة الدفع الآمنة...", "Taking you to secure checkout...")
                      : plan.price[currency][billingCycle] === 0
                        ? t("ابدأ مجاناً", "Start free")
                        : t("اشترك الآن · يُفعّل فورًا", "Subscribe now · active instantly")}
                  </button>
                  {plan.price[currency][billingCycle] > 0 && (
                    <button
                      onClick={startFree}
                      disabled={checkoutBusy !== null}
                      data-testid={`plan-start-free-${plan.tier}`}
                      className={`w-full rounded-full py-3 transition-colors cursor-pointer disabled:opacity-60 ${
                        plan.popular
                          ? "border border-background/40 text-background hover:bg-background/10"
                          : "border border-border text-content-secondary hover:bg-surface-hover hover:text-foreground"
                      }`}
                      style={{ fontSize: "14px", fontWeight: 600 }}
                    >
                      {t("ابدأ مجانًا", "Start free")}
                    </button>
                  )}
                  {plan.price[currency][billingCycle] > 0 && (
                    <p className={`m-0 text-center ${plan.popular ? "text-background/60" : "text-content-secondary"}`} style={{ fontSize: "11px", lineHeight: 1.6 }}>
                      {t("الاشتراك بدون تسجيل — تُنشئ حسابك بعد الدفع", "Subscribe without registering — your account is created after payment")}
                    </p>
                  )}
                </div>

                <div className={`h-px w-full ${plan.popular ? "bg-background/20" : "bg-border"}`} />

                <div className="flex flex-col gap-2.5">
                  {featureList(plan).map((f) => {
                    const isZatcaValidation = /ZATCA Phase 2/i.test(f);
                    return (
                      <div key={f} data-plan-zatca-state={isZatcaValidation ? "under-validation" : undefined} className="flex items-start gap-2.5">
                        {isZatcaValidation ? (
                          <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-[3px] ${plan.popular ? "text-background/70" : "text-warning"}`} strokeWidth={1.75} />
                        ) : (
                          <Check className="w-4 h-4 text-[var(--brand-blue-600)] flex-shrink-0 mt-[3px]" strokeWidth={2.2} />
                        )}
                        <span className={isZatcaValidation ? (plan.popular ? "text-background/80" : "text-warning") : (plan.popular ? "text-background/85" : "text-foreground")} style={{ fontSize: "14px", lineHeight: 1.5 }}>{f}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lite — grocery / very small business tier */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-5">
            <div className="flex-1 text-center sm:text-start">
              <span className="inline-block rounded-full bg-info-subtle px-3 py-1 text-primary mb-2" style={{ fontSize: "11px", fontWeight: 700 }}>
                {t("جديد · للبقالات والمشاريع الصغيرة جدًا", "New · for groceries & very small businesses")}
              </span>
              <h3 className="text-foreground mb-1" style={{ fontSize: "18px", fontWeight: 700 }}>
                {currency === "USD" ? t("باقة لايت — $99", "Lite plan — $99") : t("باقة لايت — 375 ر.س", "Lite plan — SAR 375")} <span className="text-content-secondary" style={{ fontSize: "14px", fontWeight: 500 }}>{t("سنويًا فقط", "per year, yearly only")}</span>
              </h3>
              <p className="text-content-secondary" style={{ fontSize: "13px", lineHeight: 1.75 }}>
                {t(
                  "محاسبة كاملة بدون ذكاء اصطناعي: فواتير ومصروفات غير محدودة، عملاء وموردون وأصناف، وتقارير ضريبية. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.",
                  "Full accounting without AI: unlimited invoices and expenses, customers, suppliers, items, and tax reports. ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance."
                )}
              </p>
            </div>
            <button
              onClick={() => navigate("/register")}
              className="shrink-0 inline-flex h-11 items-center rounded-full bg-foreground px-7 text-background transition-colors hover:bg-primary cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("ابدأ بلايت", "Start with Lite")}
            </button>
          </div>
        </div>
      </section>

      {/* 2 years + 1 year free offer */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] pb-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-lg border border-border bg-card p-8"
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="h-10 w-10 rounded-md bg-info-subtle flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </span>
              <h2 className="text-foreground" style={{ fontSize: "22px", fontWeight: 700 }}>
                {t("عرض سنتين + سنة مجاناً", "2 years + 1 year FREE")}
              </h2>
              <span className="rounded-full bg-success-subtle text-success px-3 py-1" style={{ fontSize: "12px", fontWeight: 700 }}>
                {t("وفّر 33%", "Save 33%")}
              </span>
            </div>
            <p className="text-content-secondary mb-6" style={{ fontSize: "15px", lineHeight: 1.85 }}>
              {t(
                "ادفع 24 شهراً واحصل على 36 شهراً كاملة على أي باقة مدفوعة — السنة الثالثة علينا. العرض يُفعَّل يدوياً عبر فريق المبيعات بعد اشتراكك السنوي.",
                "Pay for 24 months and get a full 36 on any paid plan — the third year is on us. The offer is activated manually by our sales team after your annual subscription."
              )}
            </p>
            <a
              href="mailto:support@entix.io?subject=2Y%2B1Y%20Offer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-7 text-background transition-colors hover:bg-primary cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("فعّل العرض عبر الدعم", "Activate via support")}
            </a>
          </motion.div>
        </div>
      </section>

      {/* Switcher Offer — free migration + remaining time credited FREE */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-lg bg-foreground text-background p-8 sm:p-10"
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="h-10 w-10 rounded-md bg-background/10 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-background" strokeWidth={1.75} />
              </span>
              <h2 style={{ fontSize: "22px", fontWeight: 700 }}>
                {t("عندك اشتراك في برنامج محاسبة آخر؟", "Subscribed to another accounting app?")}
              </h2>
              <span className="rounded-full bg-background/10 text-background px-3 py-1" style={{ fontSize: "12px", fontWeight: 600 }}>
                {t("للاشتراك السنوي فقط", "Annual plans only")}
              </span>
            </div>
            <p className="text-background/75 mb-6" style={{ fontSize: "15px", lineHeight: 1.85 }}>
              {t(
                "اشترك سنوياً وننقل بياناتك مجاناً، والمدة المتبقية في اشتراكك الحالي نضيفها لك كاملة مجاناً. ما تخسر ولا يوم دفعته.",
                "Subscribe annually and we migrate your data FREE, with the remaining time on your current subscription added in full, FREE. You never lose a paid day."
              )}
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-7">
              {[
                { n: "1", ar: "اشترك في الباقة السنوية المناسبة لك", en: "Subscribe to the annual plan that fits you" },
                { n: "2", ar: "أرسل إثبات اشتراكك الحالي (لقطة شاشة أو فاتورة) إلى support@entix.io", en: "Email proof of your current subscription (screenshot or invoice) to support@entix.io" },
                { n: "3", ar: "ننقل بياناتك مجاناً ونضيف مدتك المتبقية كاملة لحسابك", en: "We migrate your data FREE and credit your remaining time in full" },
              ].map((step) => (
                <div key={step.n} className="rounded-md border border-background/15 p-4">
                  <span className="font-display inline-flex mb-2 text-background/70" style={{ fontSize: "22px", lineHeight: 1 }}>
                    {step.n}
                  </span>
                  <p className="text-background/80" style={{ fontSize: "13px", lineHeight: 1.7 }}>
                    {isAr ? step.ar : step.en}
                  </p>
                </div>
              ))}
            </div>
            <a
              href="mailto:support@entix.io?subject=Switching%20from%20another%20accounting%20app"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-background px-6 text-foreground transition-opacity hover:opacity-90"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              <Mail className="w-4 h-4" strokeWidth={1.75} />
              {t("ابدأ التبديل الآن", "Start your switch now")}
            </a>
            <p className="text-background/60 mt-4" style={{ fontSize: "12px", lineHeight: 1.7 }}>
              {t(
                "العرض حصري للاشتراكات السنوية الجديدة ويُطبَّق بعد التحقق من إثبات الاشتراك لدى المنافس.",
                "Offer is exclusive to new annual subscriptions and applies after we verify your proof of the competitor subscription."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Referral Program — coming soon teaser */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg border border-border bg-card p-8 sm:p-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-info-subtle px-3 py-1.5 text-primary mb-4" style={{ fontSize: "12px", fontWeight: 600 }}>
              <Gift className="w-3.5 h-3.5" strokeWidth={1.75} />
              {t("قريباً", "Coming soon")}
            </span>
            <h2 className="text-foreground mb-3" style={{ fontSize: "22px", fontWeight: 700 }}>
              {t("زد دخلك 50% مع برنامج الإحالة", "Boost your income 50% with referrals")}
            </h2>
            <p className="text-content-secondary max-w-2xl mx-auto" style={{ fontSize: "14px", lineHeight: 1.85 }}>
              {t(
                "أحِل شركات إلى ENTIX.IO واحصل على استرداد 50% يُحوَّل لك عمولات ومدفوعات كمسوّق معتمد — بعقد واضح وآلية دفع موثّقة. البرنامج في مراحله الأخيرة وسيُطلق كاملاً قريباً.",
                "Refer companies to ENTIX.IO and earn a 50% rebate, paid out as approved-marketer commissions — under a clear agreement and a documented payout process. The program is in its final stages and launches fully soon."
              )}
            </p>
            <Link
              to="/referrals"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-7 text-background transition-colors hover:bg-primary cursor-pointer mt-6"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("افتح صفحة الإحالات وأنشئ كودك", "Open the referrals page and generate your code")}
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Toggle */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] py-10">
        <div className="max-w-7xl mx-auto text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground bg-card px-7 text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
            style={{ fontSize: "15px", fontWeight: 600 }}
          >
            {showComparison ? t("إخفاء", "Hide") : t("عرض", "View")} {t("جدول المقارنة التفصيلي", "detailed comparison")}
            <Arrow className={`w-4 h-4 transition-transform ${showComparison ? "rotate-90" : "-rotate-90"}`} strokeWidth={1.75} />
          </button>
        </div>
      </section>

      {/* Detailed Comparison Table */}
      {showComparison && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] py-14"
        >
          <div className="max-w-7xl mx-auto">
            <h2 className={`${sectionHeadingClass} mb-10 text-center`}>
              {t("مقارنة شاملة بين الباقات", "Full plan comparison")}
            </h2>

            <div className="ledger-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("الميزة", "Feature")}</TableHead>
                    {PLANS.map((plan) => (
                      <TableHead key={plan.tier} className="text-center" style={{ minWidth: "150px" }}>
                        {isAr ? plan.name.ar : plan.name.en}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPARISON.map((category) => (
                    <>
                      <TableRow key={isAr ? category.category.ar : category.category.en} className="bg-surface-subtle">
                        <TableCell colSpan={5} className="text-foreground py-2.5" style={{ fontSize: "13px", fontWeight: 700 }}>
                          {isAr ? category.category.ar : category.category.en}
                        </TableCell>
                      </TableRow>
                      {category.features.map((feature) => (
                        <TableRow key={isAr ? feature.name.ar : feature.name.en}>
                          <TableCell className="text-foreground py-3" style={{ fontSize: "14px" }}>
                            {isAr ? feature.name.ar : feature.name.en}
                          </TableCell>
                          {([feature.free, feature.pro, feature.enterprise] as Cell[]).map((v, ci) => (
                            <TableCell key={ci} className="text-center py-3">
                              {typeof v === "boolean" ? (
                                v ? (
                                  <Check className="w-4 h-4 text-primary mx-auto" strokeWidth={2} />
                                ) : (
                                  <X className="w-4 h-4 text-content-secondary/50 mx-auto" strokeWidth={1.75} />
                                )
                              ) : v.state === "under-validation" ? (
                                <span data-zatca-state="under-validation" className="inline-flex items-center gap-1.5 rounded-full bg-warning-subtle px-2.5 py-1 text-warning" style={{ fontSize: "12px", fontWeight: 600 }}>
                                  <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                                  {cell(v)}
                                </span>
                              ) : (
                                <span className="text-content-secondary" style={{ fontSize: "14px" }}>{cell(v)}</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </motion.section>
      )}

      {/* Competitor Benchmark — Wafeq & Wave · verified August 2026 */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="ledger-eyebrow">
              {t("مقارنة صريحة", "Honest benchmark")}
            </span>
            <h2 className={`${sectionHeadingClass} mt-3 mb-3`}>
              {t("كيف نقارن بوفق وويف؟", "How we compare to Wafeq & Wave")}
            </h2>
            <p className="text-content-secondary max-w-2xl mx-auto" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              {t(
                "أسعار المنافسين من مواقعهم الرسمية بتاريخ أغسطس 2026 وقد تتغير — أسعارنا ثابتة هنا. وفق للسوق السعودي، ويف للأمريكي.",
                "Competitor prices from their official sites as of August 2026 — theirs may change; ours are fixed here. Wafeq for Saudi, Wave for the US."
              )}
            </p>
          </div>
          <div className="ledger-table rounded-lg border border-border bg-card p-5">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("وجه المقارنة", "Benchmark")}</TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex flex-col items-center gap-1">
                      <EntixWordmark size={14} />
                      <span className="rounded-full bg-success-subtle px-2 py-0.5 text-success" style={{ fontSize: "10px", fontWeight: 700 }}>{t("الأفضل قيمة", "Best value")}</span>
                    </span>
                  </TableHead>
                  <TableHead className="text-center">Wafeq</TableHead>
                  <TableHead className="text-center">Wave</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  { ar: "سعر البداية الشهري", en: "Starting monthly price", us: currency === "USD" ? "$19" : "SAR 99", wafeq: "SAR 99", wave: "$0 · Pro $19" },
                  { ar: "ماذا تشمل باقة البداية؟", en: "Entry plan includes", us: t("فواتير + مشتريات + رواتب + مخزون + AI", "Invoices + purchases + payroll + inventory + AI"), wafeq: t("فواتير فقط", "Invoices only"), wave: t("فواتير وقيود أساسية", "Basic invoicing & books") },
                  { ar: "تكلفة مزايا مماثلة لباقتنا", en: "Cost to match our features", us: currency === "USD" ? "$19" : "SAR 99", wafeq: "SAR 199 (Premium)", wave: t("$19 + إضافات مدفوعة", "$19 + paid add-ons") },
                  { ar: "باقة مجانية دائمة", en: "Permanent free plan", us: t("✓ (5 فواتير/شهر)", "✓ (5 invoices/mo)"), wafeq: t("✗ — تجربة 14 يوم فقط", "✗ — 14-day trial only"), wave: t("✓ فواتير غير محدودة", "✓ unlimited invoices") },
                  { ar: "تجربة الباقات المدفوعة", en: "Paid-plan trial", us: t("30 يومًا كاملة", "Full 30 days"), wafeq: t("14 يومًا", "14 days"), wave: "—" },
                  { ar: "المستخدمون في باقة البداية", en: "Users at entry", us: t("حتى 5", "Up to 5"), wafeq: "2", wave: "—" },
                  { ar: "وكيل ذكاء اصطناعي كامل", en: "Full AI agent", us: "✓", wafeq: t("مسح فقط (20/شهر في Plus)", "Scan only (20/mo on Plus)"), wave: t("✗ — الإيصالات بإضافة $8+", "✗ — receipts $8+ add-on") },
                  { ar: "عربي كامل + ZATCA Phase 2 قيد التحقق", en: "Full Arabic + ZATCA Phase 2 under validation", us: t("قيد التحقق", "Under validation"), wafeq: t("راجع المورّد", "Check vendor"), wave: "✗" },
                  { ar: "ربط بنكي أمريكي", en: "US bank feeds", us: "✓ Plaid", wafeq: "✗", wave: "✓ Plaid" },
                  { ar: "الفوترة لكل شركة", en: "Per-company billing", us: t("✓ + خصم 30% للشركات الإضافية", "✓ + 30% off additional companies"), wafeq: t("كيانات متعددة في الباقات الكبرى", "Multi-entity on higher tiers"), wave: "✓ per business" },
                ] as const).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-foreground py-3" style={{ fontWeight: 500 }}>{isAr ? row.ar : row.en}</TableCell>
                    <TableCell className="py-3 text-center text-primary" style={{ fontWeight: 600 }}>{row.us}</TableCell>
                    <TableCell className="py-3 text-center text-content-secondary">{row.wafeq}</TableCell>
                    <TableCell className="py-3 text-center text-content-secondary">{row.wave}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className={`${sectionHeadingClass} mb-6 text-center`}>
            {t("الأسئلة الشائعة", "Frequently asked questions")}
          </h2>
          <div className="flex justify-center gap-3 mb-10">
            <button
              onClick={() => setOpenFaqs(faqs.map((_, i) => i))}
              className="text-primary hover:underline cursor-pointer"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              {t("توسيع الكل", "Expand all")}
            </button>
            <span className="text-content-secondary">·</span>
            <button
              onClick={() => setOpenFaqs([])}
              className="text-content-secondary hover:underline cursor-pointer"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              {t("طي الكل", "Collapse all")}
            </button>
          </div>
          <div className="border-t border-foreground">
            {faqs.map((faq, i) => {
              const open = openFaqs.includes(i);
              return (
                <div key={i} className="border-b border-border">
                  <button
                    onClick={() => setOpenFaqs(open ? openFaqs.filter((x) => x !== i) : [...openFaqs, i])}
                    className="w-full flex items-center gap-3 py-5 text-start cursor-pointer hover:text-primary transition-colors"
                    aria-expanded={open}
                  >
                    <HelpCircle className={`w-4 h-4 flex-shrink-0 transition-colors ${open ? "text-primary" : "text-content-secondary"}`} strokeWidth={1.75} />
                    <span className="text-foreground flex-1" style={{ fontSize: "16px", fontWeight: 600 }}>
                      {isAr ? faq.q.ar : faq.q.en}
                    </span>
                    <span className={`text-content-secondary transition-transform duration-200 ${open ? "rotate-45" : ""}`} style={{ fontSize: "20px", lineHeight: 1 }}>+</span>
                  </button>
                  {open && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="pb-5">
                      <p className="text-content-secondary m-0" style={{ fontSize: "14px", lineHeight: 1.6 }}>
                        {isAr ? faq.a.ar : faq.a.en}
                      </p>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px] py-20 pb-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center gap-5"
          >
            <EntixWordmark size={22} />
            <h2 className={sectionHeadingClass}>
              {t("ابدأ بشهر مجاني كامل.", "Start with a full free month.")}
            </h2>
            <p className="text-content-secondary m-0 max-w-[560px]" style={{ fontSize: "18px", lineHeight: isAr ? 1.8 : 1.5 }}>
              {t("جرّب ENTIX.IO مجاناً لمدة شهر كامل. لا حاجة لبطاقة ائتمانية.", "Try ENTIX.IO free for a full month. No credit card required.")}
            </p>
            <button
              onClick={() => navigate("/register")}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-blue-600)] px-7 py-4 min-h-[52px] text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
              style={{ fontSize: "16px", fontWeight: 600 }}
            >
              {t("ابدأ شهرك المجاني الآن", "Start your free month now")}
              <Arrow className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </motion.div>
        </div>
      </section>
      </main>


      <SharedFooter />
    </div>
  );
}
