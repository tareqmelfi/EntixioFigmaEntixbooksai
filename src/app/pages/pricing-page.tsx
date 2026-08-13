import { motion } from "motion/react";
import { CheckCircle2, X, Sparkles, ArrowLeft, ArrowRight, HelpCircle, Rocket, ArrowLeftRight, Gift, AlertCircle, Mail } from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { api } from "../lib/api";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";

type Tier = "starter" | "professional" | "enterprise";
type Cell = { ar: string; en: string } | boolean;

interface PlanDef {
  tier: Tier;
  name: { ar: string; en: string };
  desc: { ar: string; en: string };
  color: string;
  popular?: boolean;
  price: Record<"SAR" | "USD", { monthly: number; yearly: number }>;
  /** anchor list price (monthly, strikethrough) — charge price stays `price` */
  standard?: Record<"SAR" | "USD", number>;
  features: { ar: string[]; en: string[] };
}

const PLANS: PlanDef[] = [
  {
    tier: "starter",
    name: { ar: "أساسي", en: "Starter" },
    desc: { ar: "للمشاريع الناشئة والأفراد", en: "For early-stage projects & individuals" },
    color: "#6B7280",
    price: { SAR: { monthly: 0, yearly: 0 }, USD: { monthly: 0, yearly: 0 } },
    features: {
      ar: ["5 فواتير شهريًا", "مستخدم واحد", "تقارير أساسية", "جاهزية ZATCA", "شهر مجاني على أي باقة مدفوعة"],
      en: ["5 invoices / month", "1 user", "Basic reports", "ZATCA-ready", "Free month on any paid plan"],
    },
  },
  {
    tier: "professional",
    name: { ar: "احترافي", en: "Professional" },
    desc: { ar: "للشركات الصغيرة والمتوسطة", en: "For small & medium businesses" },
    color: "#1276E3",
    popular: true,
    price: { SAR: { monthly: 99, yearly: 950 }, USD: { monthly: 19, yearly: 190 } },
    standard: { SAR: 149, USD: 29 },
    features: {
      ar: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "جاهزية ZATCA + QR", "تكاملات بنكية (Plaid)", "API كامل"],
      en: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "ZATCA-ready + QR", "Bank feeds (Plaid)", "Full API access"],
    },
  },
  {
    tier: "enterprise",
    name: { ar: "مؤسسي", en: "Enterprise" },
    desc: { ar: "للمؤسسات الكبيرة", en: "For large organizations" },
    color: "#0B1B49",
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
    { name: { ar: "جاهزية ZATCA + QR", en: "ZATCA-ready + QR" }, free: true, pro: true, enterprise: true },
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
    { name: { ar: "شهر مجاني", en: "Free month" }, free: { ar: "عند الترقية", en: "On upgrade" }, pro: true, enterprise: true },
  ]},
];

export function PricingPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const isAr = language !== "en";
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [currency, setCurrency] = useState<"SAR" | "USD">(isAr ? "SAR" : "USD");
  const [showComparison, setShowComparison] = useState(false);
  const [livePriceIds, setLivePriceIds] = useState<Record<string, string>>({});
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [openFaqs, setOpenFaqs] = useState<number[]>([0]);

  const cell = (v: Cell): string => (typeof v === "boolean" ? "" : isAr ? v.ar : v.en);

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

  const subscribe = async (tier: Tier) => {
    const interval = billingCycle === "monthly" ? "month" : "year";
    const priceId = livePriceIds[`${tier}:${interval}:${currency.toLowerCase()}`];
    const authed = authStore.getState().isAuthenticated;
    // Starter (free): guests register; signed-in users manage it from billing —
    // never bounce a logged-in user to /register (that just dumps them inside
    // the app with no explanation).
    if (tier === "starter" || !priceId) { navigate(authed ? "/app/billing" : "/register"); return; }
    if (!authed) { navigate("/register"); return; }
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
      q: { ar: "ماذا يحدث بعد انتهاء الفترة التجريبية؟", en: "What happens after the free trial ends?" },
      a: { ar: "بعد انتهاء الشهر المجاني تختار الباقة المناسبة للاستمرار، أو تبقى تلقائيًا على الباقة المجانية بحدودها (مستخدم واحد · 5 فواتير شهريًا). بياناتك محفوظة بالكامل ولا تُفقد في أي حال.", en: "After your free month, pick a paid plan to continue — or stay automatically on the free Starter plan within its limits (1 user · 5 invoices/month). Your data stays fully intact either way." },
    },
    {
      q: { ar: "هل الاشتراك على الشركة أم على المستخدم؟", en: "Is billing per company or per user?" },
      a: { ar: "على الشركة. تدفع باقة واحدة لكل شركة، وتضيف فريقك مجانًا ضمن حدود الباقة (أساسي: مستخدم واحد · احترافي: حتى 5 · مؤسسي: غير محدود). الأعضاء المدعوون لا يدفعون شيئًا — يكفيهم قبول الدعوة.", en: "Per company. You pay one plan per company and invite your team free within the plan's seats (Starter: 1 · Professional: up to 5 · Enterprise: unlimited). Invited members pay nothing — they simply accept the invite." },
    },
    {
      q: { ar: "عندي أكثر من شركة — هل أدفع لكل شركة؟", en: "I run multiple companies — do I pay for each one?" },
      a: { ar: "لكل شركة اشتراكها المستقل وشهرها المجاني الخاص، وتقدر تُبقي أي شركة على الباقة المجانية بحدودها. ولأنك معنا: كل شركة إضافية تحصل تلقائيًا على خصم 30% طالما شركتك الأولى مشتركة بباقة مدفوعة — يظهر الخصم في صفحة الدفع.", en: "Each company has its own subscription and its own free month, and you can keep any company on the free Starter plan within its limits. As a bonus: every additional company gets an automatic 30% discount while your first company stays on a paid plan — shown at checkout." },
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

  return (
    <div className="min-h-screen bg-white" dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />
      <main>

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-foreground via-foreground to-primary text-white">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("أسعار شفافة • بدون رسوم خفية", "Transparent pricing • no hidden fees")}</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              {t("اختر الباقة المناسبة", "Pick the plan that fits")}
              <br />
              <span className="bg-gradient-to-l from-secondary to-sky-400 bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                {t("لحجم أعمالك", "your business size")}
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8" style={{ lineHeight: 1.8 }}>
              {t("خطط مرنة تنمو معك. ابدأ مجاناً وادفع فقط مقابل ما تحتاجه", "Flexible plans that grow with you. Start free — pay only for what you need.")}
            </p>

            {/* Launch Beta — early-supporter framing */}
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-green-500/15 border border-green-500/40 rounded-2xl px-5 py-3 mb-8 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full shrink-0" style={{ fontSize: "12px", fontWeight: 700 }}>
                <Rocket className="w-3.5 h-3.5" />
                {t("إطلاق تجريبي", "Launch Beta")}
              </span>
              <p className="text-white/90" style={{ fontSize: "13px", lineHeight: 1.6 }}>
                {t(
                  "أنت من أوائل المشتركين — شكراً لدعمك! ملاحظاتك تشكّل المنتج ودعمك الآن يصنع الفرق.",
                  "You're among our very first subscribers — thank you for being an early supporter! Your feedback shapes the product."
                )}
              </p>
            </div>

            {/* Billing Cycle + Currency Toggles */}
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-6 py-2.5 rounded-xl transition-all cursor-pointer ${
                  billingCycle === "monthly" ? "bg-white text-foreground shadow-lg" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("شهري", "Monthly")}
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-6 py-2.5 rounded-xl transition-all cursor-pointer relative ${
                  billingCycle === "yearly" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-400/40"
                }`}
                style={{ fontSize: "15px", fontWeight: 700 }}
              >
                {t("سنوي · وفّر", "Yearly · save")}
                <span className="absolute -top-2 -end-2 bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full text-xs" style={{ fontWeight: 800 }}>
                  {currency === "SAR" ? t("وفّر 238 ر.س+", "Save 238+ SAR") : t("وفّر $38+", "Save $38+")}
                </span>
              </button>
              <span className="inline-flex rounded-xl overflow-hidden border border-white/25">
                {(["SAR", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-2.5 transition-all cursor-pointer ${currency === c ? "bg-white text-foreground" : "bg-white/10 text-white hover:bg-white/20"}`}
                    style={{ fontSize: "14px", fontWeight: 700 }}
                  >
                    {c === "SAR" ? t("ر.س", "SAR") : "$ USD"}
                  </button>
                ))}
              </span>
            </div>
            <p className="text-white/60 text-sm">{t("جميع الباقات المدفوعة تأتي مع شهر مجاني كامل", "Every paid plan starts with a full free month")}</p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          {checkoutError && (
            <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-3.5" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p style={{ fontSize: "14px", fontWeight: 500 }}>
                {t("تعذّر فتح صفحة الدفع — حاول مرة أخرى أو تواصل معنا على support@entix.io", "Couldn't open secure checkout — please try again or reach us at support@entix.io")}
                <span className="block text-red-500/70 mt-0.5" style={{ fontSize: "12px" }} dir="ltr">{checkoutError}</span>
              </p>
              <button onClick={() => setCheckoutError(null)} className="ms-auto shrink-0 cursor-pointer" aria-label="dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-8">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-3xl p-8 relative ${
                  plan.popular
                    ? "bg-white shadow-2xl border-2 border-primary scale-105 z-10"
                    : "bg-white shadow-xl border border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-l from-primary to-secondary text-white px-5 py-1.5 rounded-full whitespace-nowrap shadow-lg" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("الأكثر شعبية ⭐", "Most popular ⭐")}
                    </span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-foreground mb-2" style={{ fontSize: "24px", fontWeight: 700 }}>
                    {isAr ? plan.name.ar : plan.name.en}
                  </h3>
                  <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
                    {isAr ? plan.desc.ar : plan.desc.en}
                  </p>
                </div>

                <div className="mb-8">
                  {billingCycle === "monthly" && plan.standard && plan.price[currency].monthly > 0 && (
                    <div className="flex items-center gap-2 mb-1" dir="ltr">
                      <span className="text-muted-foreground/60" style={{ fontSize: "15px", fontWeight: 500, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", textDecoration: "line-through" }}>
                        {currencySymbol}{plan.standard[currency]}
                      </span>
                      <span className="bg-green-50 text-green-700 border border-green-500/30 px-2 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 700 }}>
                        {t("سعر الإطلاق", "Launch price")} −{Math.round((1 - plan.price[currency].monthly / plan.standard[currency]) * 100)}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 mb-2" dir="ltr">
                    <span className="text-foreground" style={{ fontSize: "48px", fontWeight: 800, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                      {plan.price[currency][billingCycle] === 0
                        ? t("مجاني", "Free")
                        : `${currencySymbol}${plan.price[currency][billingCycle].toLocaleString("en-US")}`}
                    </span>
                    {plan.price[currency][billingCycle] > 0 && (
                      <span className="text-muted-foreground" style={{ fontSize: "16px" }}>
                        {currency === "SAR" ? t("ر.س", "SAR") : ""} / {billingCycle === "monthly" ? t("شهر", "mo") : t("سنة", "yr")}
                      </span>
                    )}
                  </div>
                  {billingCycle === "yearly" && plan.price[currency].yearly > 0 && (
                    <>
                      <p className="text-green-500" style={{ fontSize: "13px" }} dir="ltr">
                        {t("وفّر", "Save")} {currencySymbol}{(plan.price[currency].monthly * 12 - plan.price[currency].yearly).toLocaleString("en-US")} {currency === "SAR" ? t("ر.س", "SAR") : "USD"} {t("سنوياً", "per year")}
                      </p>
                      <p className="text-muted-foreground" style={{ fontSize: "12px" }} dir="ltr">
                        ≈ {currencySymbol}{(plan.price[currency].yearly / 12).toLocaleString("en-US", { maximumFractionDigits: 2 })} {t("/ شهر", "/ mo")} · {t("تُدفع", "billed")} {currencySymbol}{plan.price[currency].yearly.toLocaleString("en-US")} {t("سنويًا", "yearly")}
                      </p>
                    </>
                  )}
                </div>

                <button
                  onClick={() => subscribe(plan.tier)}
                  disabled={checkoutBusy !== null}
                  className={`w-full py-3.5 rounded-xl transition-all mb-8 cursor-pointer ${
                    plan.popular
                      ? "bg-primary hover:bg-primary/80 text-white shadow-lg shadow-primary/25"
                      : "bg-gray-100 hover:bg-gray-200 text-foreground"
                  } disabled:opacity-60`}
                  style={{ fontSize: "15px", fontWeight: 600 }}
                >
                  {checkoutBusy === plan.tier
                    ? t("جارٍ تحويلك لصفحة الدفع الآمنة...", "Taking you to secure checkout...")
                    : plan.price[currency][billingCycle] === 0
                      ? t("ابدأ مجاناً", "Start free")
                      : t("ابدأ شهرك المجاني", "Start your free month")}
                </button>

                <div className="space-y-4">
                  <h4 className="text-foreground/80 mb-4" style={{ fontSize: "14px", fontWeight: 600 }}>
                    {t("ما ستحصل عليه:", "What you get:")}
                  </h4>
                  {(isAr ? plan.features.ar : plan.features.en).map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80" style={{ fontSize: "14px" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lite — grocery / very small business tier */}
      <section className="pb-14 px-4 sm:px-6 lg:px-8 -mt-2 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border-2 border-green-500/40 bg-gradient-to-br from-green-50 to-white p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shadow-lg">
            <div className="flex-1 text-center sm:text-start">
              <span className="inline-block bg-green-500 text-white px-3 py-1 rounded-full mb-2" style={{ fontSize: "11px", fontWeight: 800 }}>
                {t("جديد · للبقالات والمشاريع الصغيرة جدًا", "New · for groceries & very small businesses")}
              </span>
              <h3 className="text-foreground mb-1" style={{ fontSize: "19px", fontWeight: 800 }}>
                {currency === "USD" ? t("باقة لايت — $99", "Lite plan — $99") : t("باقة لايت — 375 ر.س", "Lite plan — SAR 375")} <span className="text-muted-foreground" style={{ fontSize: "14px", fontWeight: 600 }}>{t("سنويًا فقط", "per year, yearly only")}</span>
              </h3>
              <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: 1.8 }}>
                {t(
                  "محاسبة كاملة بدون ذكاء اصطناعي: فواتير ومصروفات غير محدودة، عملاء وموردون وأصناف، تقارير ضريبية، وجاهزية ZATCA — وننقل بياناتك من برنامجك القديم مجانًا أول مرة.",
                  "Full accounting without AI: unlimited invoices & expenses, customers, suppliers & items, tax reports, ZATCA-ready — and we migrate your data from your old software free, first time."
                )}
              </p>
            </div>
            <button
              onClick={() => navigate("/register")}
              className="shrink-0 bg-green-500 hover:bg-green-600 text-white px-7 py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-green-500/25"
              style={{ fontSize: "14px", fontWeight: 700 }}
            >
              {t("ابدأ بلايت", "Start with Lite")}
            </button>
          </div>
        </div>
      </section>

      {/* 2 years + 1 year free offer */}
      <section className="pb-14 px-4 sm:px-6 lg:px-8 -mt-2 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-50 to-orange-50 p-8 sm:p-10 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="w-11 h-11 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-amber-600" />
              </span>
              <h2 className="text-foreground" style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800 }}>
                {t("عرض سنتين + سنة مجاناً", "2 years + 1 year FREE")}
              </h2>
              <span className="bg-amber-500 text-white px-3 py-1 rounded-full" style={{ fontSize: "12px", fontWeight: 800 }}>
                {t("وفّر 33%", "Save 33%")}
              </span>
            </div>
            <p className="text-muted-foreground mb-6" style={{ fontSize: "15px", lineHeight: 1.9 }}>
              {t(
                "ادفع 24 شهراً واحصل على 36 شهراً كاملة على أي باقة مدفوعة — السنة الثالثة علينا. العرض يُفعَّل يدوياً عبر فريق المبيعات بعد اشتراكك السنوي.",
                "Pay for 24 months and get a full 36 on any paid plan — the third year is on us. The offer is activated manually by our sales team after your annual subscription."
              )}
            </p>
            <a
              href="mailto:support@entix.io?subject=2Y%2B1Y%20Offer"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-7 py-3 rounded-xl transition-all cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 700 }}
            >
              {t("فعّل العرض عبر الدعم", "Activate via support")}
            </a>
          </motion.div>
        </div>
      </section>

      {/* Switcher Offer — free migration + remaining time credited FREE */}
      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-gradient-to-br from-foreground to-primary text-white p-8 sm:p-10 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute -top-10 -end-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-secondary" />
              </span>
              <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800 }}>
                {t("عندك اشتراك في برنامج محاسبة آخر؟", "Subscribed to another accounting app?")}
              </h2>
              <span className="bg-amber-500 text-foreground px-3 py-1 rounded-full" style={{ fontSize: "12px", fontWeight: 800 }}>
                {t("للاشتراك السنوي فقط", "Annual plans only")}
              </span>
            </div>
            <p className="text-white/85 mb-6" style={{ fontSize: "15px", lineHeight: 1.9 }}>
              {t(
                "اشترك سنوياً وننقل بياناتك مجاناً، والمدة المتبقية في اشتراكك الحالي نضيفها لك كاملة مجاناً — فوق شهرك المجاني. ما تخسر ولا يوم دفعته.",
                "Subscribe annually and we migrate your data FREE, with the remaining time on your current subscription added in full, FREE — on top of your free month. You never lose a paid day."
              )}
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-7">
              {[
                { n: "1", ar: "اشترك في الباقة السنوية المناسبة لك", en: "Subscribe to the annual plan that fits you" },
                { n: "2", ar: "أرسل إثبات اشتراكك الحالي (لقطة شاشة أو فاتورة) إلى support@entix.io", en: "Email proof of your current subscription (screenshot or invoice) to support@entix.io" },
                { n: "3", ar: "ننقل بياناتك مجاناً ونضيف مدتك المتبقية كاملة لحسابك", en: "We migrate your data FREE and credit your remaining time in full" },
              ].map((s) => (
                <div key={s.n} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15">
                  <span className="inline-flex w-7 h-7 rounded-full bg-green-500 text-white items-center justify-center mb-2" style={{ fontSize: "13px", fontWeight: 800 }}>
                    {s.n}
                  </span>
                  <p className="text-white/90" style={{ fontSize: "13px", lineHeight: 1.7 }}>
                    {isAr ? s.ar : s.en}
                  </p>
                </div>
              ))}
            </div>
            <a
              href="mailto:support@entix.io?subject=Switching%20from%20another%20accounting%20app"
              className="inline-flex items-center gap-2 bg-white text-foreground px-6 py-3 rounded-xl hover:bg-white/90 transition-all shadow-lg"
              style={{ fontSize: "14px", fontWeight: 700 }}
            >
              <Mail className="w-4 h-4" />
              {t("ابدأ التبديل الآن", "Start your switch now")}
            </a>
            <p className="text-white/60 mt-4" style={{ fontSize: "12px", lineHeight: 1.7 }}>
              {t(
                "العرض حصري للاشتراكات السنوية الجديدة ويُطبَّق بعد التحقق من إثبات الاشتراك لدى المنافس.",
                "Offer is exclusive to new annual subscriptions and applies after we verify your proof of the competitor subscription."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Referral Program — coming soon teaser */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 sm:p-10 text-center">
            <span className="inline-flex items-center gap-2 bg-primary text-white px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "12px", fontWeight: 700 }}>
              <Gift className="w-4 h-4" />
              {t("قريباً", "Coming soon")}
            </span>
            <h2 className="text-foreground mb-3" style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800 }}>
              {t("زد دخلك 50% مع برنامج الإحالة", "Boost your income 50% with referrals")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "14px", lineHeight: 1.9 }}>
              {t(
                "أحِل شركات إلى ENTIX.IO واحصل على استرداد 50% يُحوَّل لك عمولات ومدفوعات كمسوّق معتمد — بعقد واضح وآلية دفع موثّقة. البرنامج في مراحله الأخيرة وسيُطلق كاملاً قريباً.",
                "Refer companies to ENTIX.IO and earn a 50% rebate, paid out as approved-marketer commissions — under a clear agreement and a documented payout process. The program is in its final stages and launches fully soon."
              )}
            </p>
            <Link
              to="/referrals"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-7 py-3 rounded-xl transition-all cursor-pointer mt-6"
              style={{ fontSize: "14px", fontWeight: 700 }}
            >
              {t("افتح صفحة الإحالات وأنشئ كودك", "Open the referrals page and generate your code")}
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Toggle */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 bg-white border-2 border-primary text-primary px-8 py-3.5 rounded-xl hover:bg-primary hover:text-white transition-all cursor-pointer shadow-lg"
            style={{ fontSize: "16px", fontWeight: 600 }}
          >
            {showComparison ? t("إخفاء", "Hide") : t("عرض", "View")} {t("جدول المقارنة التفصيلي", "detailed comparison")}
            <Arrow className={`w-5 h-5 transition-transform ${showComparison ? "rotate-90" : "-rotate-90"}`} />
          </button>
        </div>
      </section>

      {/* Detailed Comparison Table */}
      {showComparison && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="py-12 px-4 sm:px-6 lg:px-8 bg-white"
        >
          <div className="max-w-7xl mx-auto">
            <h2 className="text-foreground mb-12 text-center" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700 }}>
              {t("مقارنة شاملة بين الباقات", "Full plan comparison")}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-start p-4 text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {t("الميزة", "Feature")}
                    </th>
                    {PLANS.map((plan) => (
                      <th key={plan.tier} className="p-4 text-center" style={{ minWidth: "150px" }}>
                        <div className="text-foreground" style={{ fontSize: "16px", fontWeight: 700 }}>
                          {isAr ? plan.name.ar : plan.name.en}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((category) => (
                    <>
                      <tr key={isAr ? category.category.ar : category.category.en} className="bg-gray-100">
                        <td colSpan={4} className="p-4 text-foreground" style={{ fontSize: "15px", fontWeight: 700 }}>
                          {isAr ? category.category.ar : category.category.en}
                        </td>
                      </tr>
                      {category.features.map((feature, i) => (
                        <tr key={isAr ? feature.name.ar : feature.name.en} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                          <td className="p-4 text-foreground/80" style={{ fontSize: "14px" }}>
                            {isAr ? feature.name.ar : feature.name.en}
                          </td>
                          {([feature.free, feature.pro, feature.enterprise] as Cell[]).map((v, ci) => (
                            <td key={ci} className="p-4 text-center">
                              {typeof v === "boolean" ? (
                                v ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                                ) : (
                                  <X className="w-5 h-5 text-muted mx-auto" />
                                )
                              ) : (
                                <span className="text-muted-foreground" style={{ fontSize: "14px" }}>{cell(v)}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      )}

      {/* Competitor Benchmark — Wafeq & Wave · verified August 2026 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-primary/5 text-primary px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>
              {t("مقارنة صريحة", "Honest benchmark")}
            </span>
            <h2 className="text-foreground mb-3" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700 }}>
              {t("كيف نقارن بوفق وويف؟", "How we compare to Wafeq & Wave")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              {t(
                "أسعار المنافسين من مواقعهم الرسمية بتاريخ أغسطس 2026 وقد تتغير — أسعارنا ثابتة هنا. وفق للسوق السعودي، ويف للأمريكي.",
                "Competitor prices from their official sites as of August 2026 — theirs may change; ours are fixed here. Wafeq for Saudi, Wave for the US."
              )}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-lg bg-white">
            <table className="w-full min-w-[720px]" style={{ fontSize: "14px" }}>
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-start py-4 px-5 text-muted-foreground" style={{ fontWeight: 600 }}>{t("وجه المقارنة", "Benchmark")}</th>
                  <th className="py-4 px-5 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="text-primary" style={{ fontWeight: 800 }}>ENTIX.IO</span>
                      <span className="text-green-800 bg-green-100 rounded-full px-2.5 py-0.5 mt-1" style={{ fontSize: "10px", fontWeight: 700 }}>{t("الأفضل قيمة", "Best value")}</span>
                    </div>
                  </th>
                  <th className="py-4 px-5 text-center text-muted-foreground" style={{ fontWeight: 600 }}>Wafeq</th>
                  <th className="py-4 px-5 text-center text-muted-foreground" style={{ fontWeight: 600 }}>Wave</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { ar: "سعر البداية الشهري", en: "Starting monthly price", us: currency === "USD" ? "$29" : "SAR 99", wafeq: "SAR 99", wave: "$0 · Pro $19" },
                  { ar: "ماذا تشمل باقة البداية؟", en: "Entry plan includes", us: t("فواتير + مشتريات + رواتب + مخزون + AI", "Invoices + purchases + payroll + inventory + AI"), wafeq: t("فواتير فقط", "Invoices only"), wave: t("فواتير وقيود أساسية", "Basic invoicing & books") },
                  { ar: "تكلفة مزايا مماثلة لباقتنا", en: "Cost to match our features", us: currency === "USD" ? "$29" : "SAR 99", wafeq: "SAR 199 (Premium)", wave: t("$19 + إضافات مدفوعة", "$19 + paid add-ons") },
                  { ar: "باقة مجانية دائمة", en: "Permanent free plan", us: t("✓ (5 فواتير/شهر)", "✓ (5 invoices/mo)"), wafeq: t("✗ — تجربة 14 يوم فقط", "✗ — 14-day trial only"), wave: t("✓ فواتير غير محدودة", "✓ unlimited invoices") },
                  { ar: "تجربة الباقات المدفوعة", en: "Paid-plan trial", us: t("30 يومًا كاملة", "Full 30 days"), wafeq: t("14 يومًا", "14 days"), wave: "—" },
                  { ar: "المستخدمون في باقة البداية", en: "Users at entry", us: t("حتى 5", "Up to 5"), wafeq: "2", wave: "—" },
                  { ar: "وكيل ذكاء اصطناعي كامل", en: "Full AI agent", us: "✓", wafeq: t("مسح فقط (20/شهر في Plus)", "Scan only (20/mo on Plus)"), wave: t("✗ — الإيصالات بإضافة $8+", "✗ — receipts $8+ add-on") },
                  { ar: "عربي كامل + جاهزية ZATCA", en: "Full Arabic + ZATCA-ready", us: "✓", wafeq: "✓", wave: "✗" },
                  { ar: "ربط بنكي أمريكي", en: "US bank feeds", us: "✓ Plaid", wafeq: "✗", wave: "✓ Plaid" },
                  { ar: "الفوترة لكل شركة", en: "Per-company billing", us: t("✓ + خصم 30% للشركات الإضافية", "✓ + 30% off additional companies"), wafeq: t("كيانات متعددة في الباقات الكبرى", "Multi-entity on higher tiers"), wave: "✓ per business" },
                ] as const).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="text-start py-3.5 px-5 text-foreground" style={{ fontWeight: 500 }}>{isAr ? row.ar : row.en}</td>
                    <td className="py-3.5 px-5 text-center bg-primary/5/50 text-primary" style={{ fontWeight: 700 }}>{row.us}</td>
                    <td className="py-3.5 px-5 text-center text-muted-foreground">{row.wafeq}</td>
                    <td className="py-3.5 px-5 text-center text-muted-foreground">{row.wave}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-foreground mb-6 text-center" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700 }}>
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
            <span className="text-muted-foreground/40">·</span>
            <button
              onClick={() => setOpenFaqs([])}
              className="text-muted-foreground hover:underline cursor-pointer"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              {t("طي الكل", "Collapse all")}
            </button>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const open = openFaqs.includes(i);
              return (
                <div
                  key={i}
                  className={`bg-white rounded-xl border transition-all ${open ? "border-primary/30 shadow-md" : "border-gray-200 hover:border-primary/20"}`}
                >
                  <button
                    onClick={() => setOpenFaqs(open ? openFaqs.filter((x) => x !== i) : [...openFaqs, i])}
                    className="w-full flex items-center gap-3 p-5 text-start cursor-pointer"
                    aria-expanded={open}
                  >
                    <HelpCircle className={`w-5 h-5 flex-shrink-0 transition-colors ${open ? "text-primary" : "text-muted-foreground/50"}`} />
                    <span className="text-foreground flex-1" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {isAr ? faq.q.ar : faq.q.en}
                    </span>
                    <span className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-45" : ""}`} style={{ fontSize: "20px", lineHeight: 1 }}>+</span>
                  </button>
                  {open && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-5 ps-13">
                      <p className="text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.9 }}>
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-foreground to-primary">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-white mb-6" style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700 }}>
              {t("لا زلت غير متأكد؟", "Still not sure?")}
            </h2>
            <p className="text-white/80 text-lg mb-8" style={{ lineHeight: 1.8 }}>
              {t("جرّب ENTIX.IO مجاناً لمدة شهر كامل. لا حاجة لبطاقة ائتمانية.", "Try ENTIX.IO free for a full month. No credit card required.")}
            </p>
            <button
              onClick={() => navigate("/register")}
              className="bg-white hover:bg-gray-50 text-foreground px-8 py-4 rounded-xl transition-all hover:shadow-2xl flex items-center gap-2 mx-auto cursor-pointer"
              style={{ fontSize: "16px", fontWeight: 600 }}
            >
              {t("ابدأ شهرك المجاني الآن", "Start your free month now")}
              <Arrow className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>
      </main>


      <SharedFooter />
    </div>
  );
}
