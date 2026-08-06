import { motion } from "motion/react";
import { CheckCircle2, X, Sparkles, ArrowLeft, ArrowRight, HelpCircle, Rocket, ArrowLeftRight, Gift, AlertCircle, Mail } from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";

type Tier = "starter" | "professional" | "enterprise";
type Cell = { ar: string; en: string } | boolean;

const FEATURE_LABELS: Record<string, { ar: string; en: string }> = {
  invoices: { ar: "الفواتير", en: "Invoices" },
  users: { ar: "المستخدمون", en: "Users" },
  reports: { ar: "التقارير", en: "Reports" },
  storage: { ar: "التخزين", en: "Storage" },
  support: { ar: "الدعم", en: "Support" },
  zatca: { ar: "الفوترة الإلكترونية ZATCA", en: "ZATCA e-invoicing" },
  offline: { ar: "العمل أوفلاين", en: "Offline mode" },
  api: { ar: "الوصول للـ API", en: "API access" },
  customization: { ar: "التخصيص", en: "Customization" },
  multiCurrency: { ar: "تعدد العملات", en: "Multi-currency" },
  advanced: { ar: "مميزات متقدمة", en: "Advanced features" },
};

interface PlanDef {
  tier: Tier;
  name: { ar: string; en: string };
  desc: { ar: string; en: string };
  color: string;
  popular?: boolean;
  price: Record<"SAR" | "USD", { monthly: number; yearly: number }>;
  features: Record<string, Cell>;
}

const PLANS: PlanDef[] = [
  {
    tier: "starter",
    name: { ar: "أساسي", en: "Starter" },
    desc: { ar: "للمشاريع الناشئة والأفراد", en: "For early-stage projects & individuals" },
    color: "#6B7280",
    price: { SAR: { monthly: 0, yearly: 0 }, USD: { monthly: 0, yearly: 0 } },
    features: {
      invoices: { ar: "5 فواتير شهرياً", en: "5 invoices / month" },
      users: { ar: "مستخدم واحد", en: "1 user" },
      reports: { ar: "تقارير أساسية", en: "Basic reports" },
      storage: { ar: "1 جيجا تخزين", en: "1 GB storage" },
      support: { ar: "دعم بالبريد الإلكتروني", en: "Email support" },
      zatca: true, offline: true, api: false, customization: false, multiCurrency: false, advanced: false,
    },
  },
  {
    tier: "professional",
    name: { ar: "احترافي", en: "Professional" },
    desc: { ar: "للشركات الصغيرة والمتوسطة", en: "For small & medium businesses" },
    color: "#1276E3",
    popular: true,
    price: { SAR: { monthly: 99, yearly: 950 }, USD: { monthly: 29, yearly: 290 } },
    features: {
      invoices: { ar: "فواتير غير محدودة", en: "Unlimited invoices" },
      users: { ar: "حتى 5 مستخدمين", en: "Up to 5 users" },
      reports: { ar: "تقارير متقدمة + AI", en: "Advanced reports + AI" },
      storage: { ar: "50 جيجا تخزين", en: "50 GB storage" },
      support: { ar: "دعم مباشر", en: "Live support" },
      zatca: true, offline: true,
      api: { ar: "Read-only API", en: "Read-only API" },
      customization: true, multiCurrency: true, advanced: true,
    },
  },
  {
    tier: "enterprise",
    name: { ar: "مؤسسي", en: "Enterprise" },
    desc: { ar: "للمؤسسات الكبيرة", en: "For large organizations" },
    color: "#0B1B49",
    price: { SAR: { monthly: 299, yearly: 2990 }, USD: { monthly: 79, yearly: 790 } },
    features: {
      invoices: { ar: "فواتير غير محدودة", en: "Unlimited invoices" },
      users: { ar: "مستخدمون غير محدودون", en: "Unlimited users" },
      reports: { ar: "تقارير مخصصة + AI متقدم", en: "Custom reports + advanced AI" },
      storage: { ar: "تخزين غير محدود", en: "Unlimited storage" },
      support: { ar: "دعم مخصص 24/7", en: "Dedicated 24/7 support" },
      zatca: true, offline: true,
      api: { ar: "Full API Access", en: "Full API Access" },
      customization: { ar: "تخصيص كامل", en: "Full customization" },
      multiCurrency: true,
      advanced: { ar: "مميزات مؤسسية متقدمة", en: "Advanced enterprise features" },
    },
  },
];

interface ComparisonRow { name: { ar: string; en: string }; free: Cell; pro: Cell; enterprise: Cell }
interface ComparisonCategory { category: { ar: string; en: string }; features: ComparisonRow[] }

const COMPARISON: ComparisonCategory[] = [
  { category: { ar: "الفواتير والمبيعات", en: "Invoicing & sales" }, features: [
    { name: { ar: "عدد الفواتير", en: "Invoice volume" }, free: { ar: "5 / شهر", en: "5 / month" }, pro: { ar: "غير محدود", en: "Unlimited" }, enterprise: { ar: "غير محدود", en: "Unlimited" } },
    { name: { ar: "الفواتير الإلكترونية ZATCA", en: "ZATCA e-invoicing" }, free: true, pro: true, enterprise: true },
    { name: { ar: "QR Code", en: "QR Code" }, free: true, pro: true, enterprise: true },
    { name: { ar: "عروض الأسعار", en: "Quotes" }, free: true, pro: true, enterprise: true },
    { name: { ar: "إشعارات دائنة", en: "Credit notes" }, free: false, pro: true, enterprise: true },
    { name: { ar: "الفواتير المتكررة", en: "Recurring invoices" }, free: false, pro: true, enterprise: true },
    { name: { ar: "قوالب فواتير مخصصة", en: "Custom invoice templates" }, free: { ar: "1", en: "1" }, pro: { ar: "10", en: "10" }, enterprise: { ar: "غير محدود", en: "Unlimited" } },
  ]},
  { category: { ar: "المحاسبة والتقارير", en: "Accounting & reports" }, features: [
    { name: { ar: "دليل الحسابات", en: "Chart of accounts" }, free: { ar: "محدود", en: "Limited" }, pro: { ar: "كامل", en: "Full" }, enterprise: { ar: "كامل + مخصص", en: "Full + custom" } },
    { name: { ar: "القيود اليومية", en: "Journal entries" }, free: false, pro: true, enterprise: true },
    { name: { ar: "تقارير الأرباح والخسائر", en: "Profit & loss" }, free: true, pro: true, enterprise: true },
    { name: { ar: "الميزانية العمومية", en: "Balance sheet" }, free: false, pro: true, enterprise: true },
    { name: { ar: "تقارير الضرائب", en: "Tax reports" }, free: true, pro: true, enterprise: true },
    { name: { ar: "تحليلات AI", en: "AI analytics" }, free: false, pro: { ar: "أساسية", en: "Basic" }, enterprise: { ar: "متقدمة", en: "Advanced" } },
    { name: { ar: "تقارير مخصصة", en: "Custom reports" }, free: false, pro: false, enterprise: true },
  ]},
  { category: { ar: "المستخدمون والصلاحيات", en: "Users & permissions" }, features: [
    { name: { ar: "عدد المستخدمين", en: "User seats" }, free: { ar: "1", en: "1" }, pro: { ar: "5", en: "5" }, enterprise: { ar: "غير محدود", en: "Unlimited" } },
    { name: { ar: "الأدوار والصلاحيات", en: "Roles & permissions" }, free: false, pro: { ar: "3 أدوار", en: "3 roles" }, enterprise: { ar: "أدوار مخصصة", en: "Custom roles" } },
    { name: { ar: "سجل العمليات Audit Trail", en: "Audit trail" }, free: false, pro: { ar: "محدود", en: "Limited" }, enterprise: { ar: "كامل", en: "Full" } },
    { name: { ar: "موافقات متعددة المستويات", en: "Multi-level approvals" }, free: false, pro: false, enterprise: true },
  ]},
  { category: { ar: "التكامل والمزامنة", en: "Integration & sync" }, features: [
    { name: { ar: "العمل أوفلاين", en: "Offline mode" }, free: true, pro: true, enterprise: true },
    { name: { ar: "المزامنة التلقائية", en: "Automatic sync" }, free: true, pro: true, enterprise: true },
    { name: { ar: "API Access", en: "API access" }, free: false, pro: { ar: "Read-only", en: "Read-only" }, enterprise: { ar: "Full Access", en: "Full Access" } },
    { name: { ar: "Webhooks", en: "Webhooks" }, free: false, pro: false, enterprise: true },
    { name: { ar: "سيرفر VPS خاص", en: "Dedicated VPS" }, free: false, pro: false, enterprise: true },
  ]},
  { category: { ar: "الدعم والتدريب", en: "Support & training" }, features: [
    { name: { ar: "الدعم الفني", en: "Support channel" }, free: { ar: "بريد", en: "Email" }, pro: { ar: "دردشة", en: "Chat" }, enterprise: { ar: "24/7 مخصص", en: "24/7 dedicated" } },
    { name: { ar: "وقت الاستجابة", en: "Response time" }, free: { ar: "48 ساعة", en: "48 hours" }, pro: { ar: "4 ساعات", en: "4 hours" }, enterprise: { ar: "1 ساعة", en: "1 hour" } },
    { name: { ar: "تدريب مجاني", en: "Free training" }, free: false, pro: { ar: "فيديوهات", en: "Videos" }, enterprise: { ar: "تدريب مباشر", en: "Live training" } },
    { name: { ar: "مدير حساب مخصص", en: "Dedicated account manager" }, free: false, pro: false, enterprise: true },
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
      a: { ar: "بعد انتهاء الشهر المجاني، يمكنك الاستمرار في الباقة المجانية أو الترقية لباقة مدفوعة. لن تفقد أي بيانات في كلتا الحالتين.", en: "After your free month, continue on the free Starter plan or upgrade to a paid one. Your data is kept either way." },
    },
    {
      q: { ar: "هل الأسعار شاملة ضريبة القيمة المضافة؟", en: "Are prices VAT-inclusive?" },
      a: { ar: "الأسعار المعروضة غير شاملة ضريبة القيمة المضافة (15%). سيتم إضافة الضريبة عند الدفع حسب موقعك.", en: "Listed prices exclude VAT (15% in KSA). Any applicable tax is added at checkout based on your location." },
    },
    {
      q: { ar: "ما هي طرق الدفع المتاحة؟", en: "Which payment methods do you accept?" },
      a: { ar: "نقبل جميع البطاقات الائتمانية (Visa, Mastercard, Mada) والدفع عبر Apple Pay. للباقة المؤسسية، نوفر خيار الفواتير الشهرية.", en: "All major cards (Visa, Mastercard, Mada) and Apple Pay. Monthly invoicing is available on the Enterprise plan." },
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
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1B49] via-[#122354] to-[#1276E3] text-white">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-[#349FC4]" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("أسعار شفافة • بدون رسوم خفية", "Transparent pricing • no hidden fees")}</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              {t("اختر الباقة المناسبة", "Pick the plan that fits")}
              <br />
              <span className="bg-gradient-to-l from-[#349FC4] to-[#60A5FA] bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                {t("لحجم أعمالك", "your business size")}
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8" style={{ lineHeight: 1.8 }}>
              {t("خطط مرنة تنمو معك. ابدأ مجاناً وادفع فقط مقابل ما تحتاجه", "Flexible plans that grow with you. Start free — pay only for what you need.")}
            </p>

            {/* Launch Beta — early-supporter framing */}
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-[#22C55E]/15 border border-[#22C55E]/40 rounded-2xl px-5 py-3 mb-8 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 bg-[#22C55E] text-white px-3 py-1 rounded-full shrink-0" style={{ fontSize: "12px", fontWeight: 700 }}>
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
                  billingCycle === "yearly" ? "bg-white text-foreground shadow-lg" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("سنوي", "Yearly")}
                <span className="absolute -top-2 -end-2 bg-[#22C55E] text-white px-2 py-0.5 rounded-full text-xs">
                  {t("وفّر ~20%", "Save ~20%")}
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
                    ? "bg-white shadow-2xl border-2 border-[#1276E3] scale-105 z-10"
                    : "bg-white shadow-xl border border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-l from-[#1276E3] to-[#349FC4] text-white px-5 py-1.5 rounded-full whitespace-nowrap shadow-lg" style={{ fontSize: "13px", fontWeight: 600 }}>
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
                    <p className="text-[#22C55E]" style={{ fontSize: "13px" }} dir="ltr">
                      {t("وفّر", "Save")} {currencySymbol}{(plan.price[currency].monthly * 12 - plan.price[currency].yearly).toLocaleString("en-US")} {currency === "SAR" ? t("ر.س", "SAR") : "USD"} {t("سنوياً", "per year")}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => subscribe(plan.tier)}
                  disabled={checkoutBusy !== null}
                  className={`w-full py-3.5 rounded-xl transition-all mb-8 cursor-pointer ${
                    plan.popular
                      ? "bg-primary hover:bg-primary/80 text-white shadow-lg shadow-[#1276E3]/25"
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
                  {Object.entries(plan.features).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3">
                      {typeof value === "boolean" ? (
                        value ? (
                          <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-[#E5E7EB] flex-shrink-0 mt-0.5" />
                        )
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-foreground/80" style={{ fontSize: "14px" }}>
                        {typeof value === "boolean"
                          ? (isAr ? FEATURE_LABELS[key]?.ar : FEATURE_LABELS[key]?.en) || key
                          : cell(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Switcher Offer — free migration + remaining time credited FREE */}
      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-gradient-to-br from-[#0B1B49] to-[#1276E3] text-white p-8 sm:p-10 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute -top-10 -end-10 w-40 h-40 bg-[#349FC4]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4">
              <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-[#349FC4]" />
              </span>
              <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800 }}>
                {t("عندك اشتراك في برنامج محاسبة آخر؟", "Subscribed to another accounting app?")}
              </h2>
            </div>
            <p className="text-white/85 mb-6" style={{ fontSize: "15px", lineHeight: 1.9 }}>
              {t(
                "ننقل بياناتك مجاناً، والمدة المتبقية في اشتراكك الحالي نضيفها لك كاملة مجاناً — فوق شهرك المجاني. ما تخسر ولا يوم دفعته.",
                "We migrate your data FREE, and the remaining time on your current subscription gets added in full, FREE — on top of your free month. You never lose a paid day."
              )}
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-7">
              {[
                { n: "1", ar: "اشترك في الباقة المناسبة لك", en: "Subscribe to the plan that fits you" },
                { n: "2", ar: "أرسل إثبات اشتراكك الحالي (لقطة شاشة أو فاتورة) إلى support@entix.io", en: "Email proof of your current subscription (screenshot or invoice) to support@entix.io" },
                { n: "3", ar: "ننقل بياناتك مجاناً ونضيف مدتك المتبقية كاملة لحسابك", en: "We migrate your data FREE and credit your remaining time in full" },
              ].map((s) => (
                <div key={s.n} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15">
                  <span className="inline-flex w-7 h-7 rounded-full bg-[#22C55E] text-white items-center justify-center mb-2" style={{ fontSize: "13px", fontWeight: 800 }}>
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
              className="inline-flex items-center gap-2 bg-white text-[#0B1B49] px-6 py-3 rounded-xl hover:bg-white/90 transition-all shadow-lg"
              style={{ fontSize: "14px", fontWeight: 700 }}
            >
              <Mail className="w-4 h-4" />
              {t("ابدأ التبديل الآن", "Start your switch now")}
            </a>
          </motion.div>
        </div>
      </section>

      {/* Referral Program — coming soon teaser */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-dashed border-[#1276E3]/40 bg-[#1276E3]/5 p-8 sm:p-10 text-center">
            <span className="inline-flex items-center gap-2 bg-[#1276E3] text-white px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "12px", fontWeight: 700 }}>
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
          </div>
        </div>
      </section>

      {/* Comparison Toggle */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 bg-white border-2 border-[#1276E3] text-primary px-8 py-3.5 rounded-xl hover:bg-primary hover:text-white transition-all cursor-pointer shadow-lg"
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
                                  <CheckCircle2 className="w-5 h-5 text-[#22C55E] mx-auto" />
                                ) : (
                                  <X className="w-5 h-5 text-[#E5E7EB] mx-auto" />
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

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-foreground mb-12 text-center" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700 }}>
            {t("الأسئلة الشائعة", "Frequently asked questions")}
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-[#1276E3]/30 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 600 }}>
                      {isAr ? faq.q.ar : faq.q.en}
                    </h3>
                    <p className="text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.8 }}>
                      {isAr ? faq.a.ar : faq.a.en}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1B49] to-[#1276E3]">
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
              {t("ابدأ تجربتك المجانية الآن", "Start your free trial now")}
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
