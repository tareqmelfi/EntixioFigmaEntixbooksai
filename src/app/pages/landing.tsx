import { displayLocale } from "../lib/number-display";
import { useNavigate, Link } from "react-router";
import {
  Shield, BarChart3, Globe, Zap, Cloud, Smartphone, FileText, ArrowLeft, ChevronDown, Check, Database, Receipt, Calculator, TrendingUp, Clock, CreditCard, Landmark, Rocket, Gift, Users, AlertCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";
import { usePublicRoute } from "../lib/public-route";
import { PLAN_PRICES, annualSavingsPercent, monthlyEquivalent, type PricingCurrency } from "../lib/pricing-plans";

// ─── Animated counter ───
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [started, target]);

  return (
    <div ref={ref} className="font-display text-foreground leading-none text-[40px] sm:text-[48px] lg:text-[56px]" style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" }}>
      {count.toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })}{suffix}
    </div>
  );
}

// ─── Shared page container · 72px gutters at the 1440 artboard ───
const SHELL = "mx-auto w-full max-w-[1536px] px-5 sm:px-8 lg:px-[72px]";

// ─── The ledger figures card that anchors the hero and the product band ───
function LedgerFigureCard({ t, className = "", elevated = false }: { t: (ar: string, en?: string) => string; className?: string; elevated?: boolean }) {
  const bars = [
    { h: 38, tone: "bg-border" },
    { h: 52, tone: "bg-border" },
    { h: 46, tone: "bg-border" },
    { h: 66, tone: "bg-foreground" },
    { h: 60, tone: "bg-foreground" },
    { h: 100, tone: "bg-[var(--brand-blue-600)]" },
  ];
  const figures = [
    { k: t("الإيراد · سبتمبر", "Revenue · Sep"), v: "84,200", note: t("▲ 12% مقارنة بأغسطس", "▲ 12% vs Aug"), tone: "text-primary" },
    { k: t("صافي الدخل", "Net income"), v: "31,050", note: t("هامش 37%", "margin 37%"), tone: "text-content-secondary" },
    { k: t("صافي الضريبة المستحقة", "VAT net due"), v: "4,780", note: t("يُقدَّم 30 سبتمبر", "files 30 Sep"), tone: "text-warning" },
  ];
  return (
    <div className={`rounded-lg border border-border bg-card p-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 ${elevated ? "shadow-popover" : ""} ${className}`}>
      {figures.map(f => (
        <div key={f.v} className="flex flex-col gap-1.5">
          <span className="ledger-eyebrow">{f.k}</span>
          <span className="font-display text-foreground text-[30px] leading-none" style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" }}>{f.v}</span>
          <span className={f.tone} style={{ fontSize: "12px", fontWeight: f.tone === "text-content-secondary" ? 400 : 600 }}>{f.note}</span>
        </div>
      ))}
      <div dir="ltr" className="sm:col-span-3 border-t border-border pt-3.5 flex items-end gap-2 h-24" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={i} className={`flex-1 rounded-t-[3px] ${b.tone}`} style={{ height: `${b.h}%` }} />
        ))}
      </div>
    </div>
  );
}

const FEATURES_SA = [
  { icon: FileText, title: "فواتير احترافية", titleEn: "Professional invoices", desc: "إنشاء وإدارة الفواتير مع QR يحتوي بيانات الفاتورة الأساسية. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.", descEn: "Create and manage invoices with a QR containing core invoice data. ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance." },
  { icon: BarChart3, title: "تقارير مالية متقدمة", titleEn: "Advanced financial reports", desc: "لوحة تحكم شاملة مع رسوم بيانية تفاعلية ومؤشرات أداء رئيسية", descEn: "A clear dashboard with interactive charts and key financial indicators." },
  { icon: Shield, title: "أمان وموثوقية", titleEn: "Secure and reliable", desc: "تشفير AES-256 وحماية متعددة الطبقات مع نسخ احتياطي تلقائي", descEn: "Layered protection, encrypted storage, and automated backups." },
  { icon: Globe, title: "دعم متعدد اللغات", titleEn: "Arabic and English", desc: "واجهة عربية كاملة RTL مع دعم اللغة الإنجليزية والعملات المتعددة", descEn: "Native Arabic RTL with English LTR support and multi-currency workflows." },
  { icon: Cloud, title: "سحابي بالكامل", titleEn: "Fully cloud", desc: "بياناتك متاحة من أي جهاز ومتصفح مع نسخ احتياطي يومي تلقائي", descEn: "Access from any device or browser with automatic daily backups." },
  { icon: Smartphone, title: "متوافق مع الجوال", titleEn: "Mobile friendly", desc: "تصميم متجاوب يعمل بسلاسة على جميع الأجهزة والشاشات", descEn: "Responsive screens built for desktop and mobile accounting work." },
  { icon: Receipt, title: "إدارة المصروفات", titleEn: "Expense management", desc: "تتبع المصروفات والمشتريات مع تصنيف تلقائي ومراكز تكلفة", descEn: "Track expenses, purchases, categories, and cost centers." },
  { icon: Calculator, title: "ضريبة القيمة المضافة", titleEn: "VAT handling", desc: "حساب تلقائي للضريبة مع تقارير جاهزة للمراجعة المحاسبية والامتثال", descEn: "Automated VAT calculations with reports prepared for compliance review." },
  { icon: TrendingUp, title: "تحليلات ذكية", titleEn: "Smart analytics", desc: "تنبؤات مالية مدعومة بالذكاء الاصطناعي مع توصيات لتحسين الأداء", descEn: "AI-assisted financial signals and recommendations for better decisions." },
];

const FEATURES_US = [
  { icon: FileText, title: "فواتير احترافية", titleEn: "Professional invoices", desc: "فواتير نظيفة بضريبة المبيعات الأمريكية مع تتبع الموردين 1099 وإمكانية الطباعة والمشاركة", descEn: "Clean invoices with US sales-tax handling, 1099 vendor tracking, printing, and sharing." },
  { icon: BarChart3, title: "تقارير مالية متقدمة", titleEn: "Advanced financial reports", desc: "لوحة تحكم شاملة مع رسوم بيانية تفاعلية ومؤشرات أداء رئيسية", descEn: "A clear dashboard with interactive charts and key financial indicators." },
  { icon: Shield, title: "أمان وموثوقية", titleEn: "Secure and reliable", desc: "تشفير AES-256 وحماية متعددة الطبقات مع نسخ احتياطي تلقائي", descEn: "Layered protection, encrypted storage, and automated backups." },
  { icon: Globe, title: "دعم متعدد اللغات", titleEn: "Arabic and English", desc: "واجهة عربية كاملة RTL مع دعم اللغة الإنجليزية والعملات المتعددة", descEn: "Native Arabic RTL with English LTR support and multi-currency workflows." },
  { icon: Cloud, title: "سحابي بالكامل", titleEn: "Fully cloud", desc: "بياناتك متاحة من أي جهاز ومتصفح مع نسخ احتياطي يومي تلقائي", descEn: "Access from any device or browser with automatic daily backups." },
  { icon: CreditCard, title: "مدفوعات Stripe", titleEn: "Stripe payments", desc: "اقبل البطاقات والمدفوعات الإلكترونية مباشرة على فواتيرك عبر Stripe", descEn: "Accept cards and online payments directly on your invoices via Stripe." },
  { icon: Receipt, title: "إدارة المصروفات", titleEn: "Expense management", desc: "تتبع المصروفات والمشتريات مع تصنيف تلقائي ومراكز تكلفة", descEn: "Track expenses, purchases, categories, and cost centers." },
  { icon: Landmark, title: "ربط البنوك Plaid — تجريبي", titleEn: "Plaid bank feeds — Beta", desc: "اربط حساباتك البنكية الأمريكية عبر Plaid التجريبي لمطابقة المعاملات تلقائياً", descEn: "Connect US bank accounts through the Plaid Beta for automatic transaction matching." },
  { icon: TrendingUp, title: "تحليلات ذكية", titleEn: "Smart analytics", desc: "تنبؤات مالية مدعومة بالذكاء الاصطناعي مع توصيات لتحسين الأداء", descEn: "AI-assisted financial signals and recommendations for better decisions." },
];

// Pricing · charge prices match the live plan catalog (api/stripe/plans)
// standard = anchor list price (strikethrough) · price = today's launch price
const PRICING_SA = [
  {
    name: "أساسي",
    nameEn: "Starter",
    price: "0",
    standard: null as string | null,
    period: "مجاني للأبد",
    periodEn: "free forever",
    desc: "للمشاريع الصغيرة والفردية",
    descEn: "For solo operators and small projects",
    features: ["5 فواتير شهريًا", "مستخدم واحد", "تقارير أساسية", "ZATCA Phase 2 — قيد التحقق", "شهر مجاني على أي باقة مدفوعة"],
    featuresEn: ["5 invoices / month", "1 user", "Basic reports", "ZATCA Phase 2 — Under validation", "Free month on any paid plan"],
    highlighted: false
  },
  {
    name: "احترافي",
    nameEn: "Professional",
    price: "99",
    standard: "149",
    period: "ريال / شهرياً",
    periodEn: "SAR / month",
    desc: "للشركات الصغيرة والمتوسطة",
    descEn: "For small and medium businesses",
    features: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "ZATCA Phase 2 — قيد التحقق", "تكاملات بنكية (Plaid)", "وصول API (مفاتيح · استيراد جماعي)"],
    featuresEn: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "ZATCA Phase 2 — Under validation", "Bank feeds (Plaid)", "API access (keys · bulk import)"],
    highlighted: true
  },
  {
    name: "مؤسسي",
    nameEn: "Enterprise",
    price: "299",
    standard: "449",
    period: "ريال / شهرياً",
    periodEn: "SAR / month",
    desc: "للمؤسسات الكبيرة",
    descEn: "For larger organizations",
    features: ["كل مزايا الاحترافي", "مستخدمون غير محدودون", "AI متقدم بلا حدود", "تعدد عملات كامل", "سجل تدقيق", "دعم أولوية"],
    featuresEn: ["Everything in Pro", "Unlimited users", "Advanced unlimited AI", "Full multi-currency", "Audit log", "Priority support"],
    highlighted: false
  },
];

const PRICING_US = [
  {
    name: "أساسي",
    nameEn: "Starter",
    price: "0",
    standard: null as string | null,
    period: "مجاني للأبد",
    periodEn: "free forever",
    desc: "للمشاريع الصغيرة والفردية",
    descEn: "For solo operators and small projects",
    features: ["5 فواتير شهريًا", "مستخدم واحد", "تقارير أساسية", "ضريبة مبيعات أمريكية", "شهر مجاني على أي باقة مدفوعة"],
    featuresEn: ["5 invoices / month", "1 user", "Basic reports", "US sales tax", "Free month on any paid plan"],
    highlighted: false
  },
  {
    name: "احترافي",
    nameEn: "Professional",
    price: "19",
    standard: "29",
    period: "دولار / شهرياً",
    periodEn: "USD / month",
    desc: "للشركات الصغيرة والمتوسطة",
    descEn: "For small and medium businesses",
    features: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "مدفوعات Stripe", "تكاملات بنكية (Plaid تجريبي)", "وصول API (مفاتيح · استيراد جماعي)"],
    featuresEn: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "Stripe payments", "Bank feeds (Plaid Beta)", "API access (keys · bulk import)"],
    highlighted: true
  },
  {
    name: "مؤسسي",
    nameEn: "Enterprise",
    price: "59",
    standard: "89",
    period: "دولار / شهرياً",
    periodEn: "USD / month",
    desc: "للمؤسسات الكبيرة",
    descEn: "For larger organizations",
    features: ["كل مزايا الاحترافي", "مستخدمون غير محدودون", "AI متقدم بلا حدود", "تعدد عملات كامل", "سجل تدقيق", "دعم أولوية"],
    featuresEn: ["Everything in Pro", "Unlimited users", "Advanced unlimited AI", "Full multi-currency", "Audit log", "Priority support"],
    highlighted: false
  },
];

// ─── Product showcase · tabbed real screenshots in a browser frame ───
function ShowcaseTabs({ t }: { t: (ar: string, en?: string) => string }) {
  const [active, setActive] = useState(0);
  const isEn = t("ar", "en") === "en";
  const sfx = isEn ? "-en" : "";
  const shots = [
    { src: `/marketing/dashboard${sfx}.webp`, label: t("لوحة التحكم", "Dashboard"), desc: t("نظرة لحظية على الإيرادات والمصروفات والضريبة", "A live view of revenue, expenses, and tax") },
    { src: `/marketing/invoices${sfx}.webp`, label: t("الفواتير", "Invoices"), desc: t("إدارة فواتير العملاء مع الحالات والتحصيل", "Manage customer invoices, statuses, and collection") },
    { src: `/marketing/ai-agent${sfx}.webp`, label: t("المساعد الذكي", "AI assistant"), desc: t("أنشئ فواتير ومصروفات وتقارير بمحادثة واحدة", "Create invoices, expenses, and reports in one chat") },
  ];
  return (
    <div className="bg-foreground text-background rounded-lg grid lg:grid-cols-12 gap-8 px-6 pt-8 sm:px-10 sm:pt-12 lg:px-16 lg:pt-14 overflow-hidden">
      <div className="lg:col-span-4 flex flex-col gap-4 pb-8 lg:pb-14">
        <span className="ledger-eyebrow text-chart-3">{t("شاهد ENTIX.IO أثناء العمل", "See ENTIX.IO at work")}</span>
        <h2 className={isEn
          ? "font-display font-normal m-0 text-[30px] sm:text-[34px] lg:text-[40px] leading-[1.05] text-background"
          : "font-bold m-0 text-[24px] sm:text-[28px] lg:text-[32px] leading-[1.4] text-background"}>
          {t("لوحة تجيب على «كيف حالنا؟» بنظرة واحدة.", "A dashboard that answers “how are we doing?” in one glance.")}
        </h2>
        <div className="flex flex-col gap-2.5 mt-1">
          {shots.map((s, i) => (
            <button
              key={s.src}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2.5 text-start cursor-pointer transition-colors ${i === active ? "text-background" : "text-background/70 hover:text-background"}`}
              style={{ fontSize: "15px" }}
              aria-pressed={i === active}
            >
              <span className={`h-2 w-2 rounded-full flex-none ${i === active ? "bg-[var(--brand-blue-600)]" : "bg-background/25"}`} />
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-background/60 mt-1" style={{ fontSize: "13px", lineHeight: 1.7 }}>{shots[active].desc}</p>
      </div>
      <div className="lg:col-span-8 bg-background rounded-t-lg p-4 sm:p-6 text-foreground">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg border border-border overflow-hidden bg-card"
        >
          <img
            src={shots[active].src}
            alt={shots[active].label}
            loading="lazy"
            className="w-full block"
            width={1440}
            height={900}
          />
        </motion.div>
      </div>
    </div>
  );
}

// ─── Compact pricing block · the FIRST thing after the hero ───
// CEO 2026-09-08: «الكل مو عارف كيف يشترك ويرسلي تساؤلات بسبب التصميم».
// Plan · annual price · green savings chip · pay-now and free actions, all
// visible without scrolling to the full pricing teaser further down the page.
function LandingPricingBlock({
  t, currency, onSubscribe, onStartFree, pricingHref,
}: {
  t: (ar: string, en?: string) => string;
  currency: PricingCurrency;
  onSubscribe: () => void;
  onStartFree: () => void;
  pricingHref: string;
}) {
  const symbol = currency === "USD" ? "$" : "";
  const label = currency === "SAR" ? t("ر.س", "SAR") : "";
  const money = (n: number) => `${symbol}${n.toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 2 })}`;
  const amount = (n: number) => (label ? `${money(n)} ${label}` : money(n));
  const tiers = [
    { tier: "professional" as const, name: t("احترافي", "Professional"), note: t("للشركات الصغيرة والمتوسطة", "For small & medium businesses"), highlighted: true },
    { tier: "enterprise" as const, name: t("مؤسسي", "Enterprise"), note: t("للمؤسسات الكبيرة", "For large organizations"), highlighted: false },
  ];
  return (
    <section id="plans" data-testid="landing-pricing-block" className={`${SHELL} pt-12 lg:pt-16`}>
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="ledger-eyebrow text-primary">{t("الأسعار", "Pricing")}</span>
            <h2 className="text-foreground m-0" style={{ fontSize: "22px", fontWeight: 700 }}>
              {t("اشترك في دقيقة — بدون إنشاء حساب", "Subscribe in a minute — no account needed")}
            </h2>
            <p className="text-content-secondary m-0" style={{ fontSize: "14px", lineHeight: 1.7 }}>
              {t("الأسعار سنوية بالخصم. تدفع مباشرة ويُنشأ حسابك بعد الدفع.", "Prices shown are the discounted annual rate. Pay directly — your account is created after payment.")}
            </p>
          </div>
          <Link to={pricingHref} data-testid="landing-pricing-all-plans" className="text-primary hover:underline cursor-pointer whitespace-nowrap" style={{ fontSize: "14px", fontWeight: 600 }}>
            {t("كل الباقات والمقارنة", "All plans & comparison")}
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {tiers.map((plan) => {
            const price = PLAN_PRICES[plan.tier][currency];
            const savings = annualSavingsPercent(price);
            return (
              <div
                key={plan.tier}
                data-testid={`landing-plan-${plan.tier}`}
                className={`rounded-lg border p-5 flex flex-col gap-3 min-w-0 ${plan.highlighted ? "border-foreground bg-surface-subtle" : "border-border bg-card"}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground" style={{ fontSize: "16px", fontWeight: 700 }}>{plan.name}</span>
                  {savings > 0 && (
                    <span
                      data-testid={`landing-savings-${plan.tier}`}
                      className="inline-block whitespace-nowrap rounded-full bg-savings-subtle px-2 py-0.5 text-savings"
                      style={{ fontSize: "11px", fontWeight: 700 }}
                    >
                      {t("وفّر", "Save")} <bdi dir="ltr">{savings}%</bdi>
                    </span>
                  )}
                </div>
                <p className="text-content-secondary m-0" style={{ fontSize: "13px" }}>{plan.note}</p>
                <div className="flex items-baseline gap-1.5" dir="ltr">
                  <span className="font-display text-foreground leading-none text-[36px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(monthlyEquivalent(price))}
                  </span>
                  <span className="text-content-secondary" style={{ fontSize: "13px" }}>{label} / {t("شهر", "mo")}</span>
                </div>
                <p className="text-content-secondary m-0" style={{ fontSize: "12px" }}>
                  {t("يُدفع سنويًا", "billed annually")} · <bdi dir="ltr">{amount(price.yearly)}</bdi>
                </p>
                <div className="flex flex-col gap-2 mt-1">
                  <button
                    onClick={onSubscribe}
                    data-testid={`landing-subscribe-${plan.tier}`}
                    className="w-full rounded-full bg-foreground py-3 text-background hover:bg-primary transition-colors cursor-pointer"
                    style={{ fontSize: "14px", fontWeight: 600 }}
                  >
                    {t("اشترك الآن — ادفع مباشرة", "Subscribe now — pay directly")}
                  </button>
                  <button
                    onClick={onStartFree}
                    data-testid={`landing-start-free-${plan.tier}`}
                    className="w-full rounded-full border border-border py-2.5 text-content-secondary hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
                    style={{ fontSize: "13px", fontWeight: 600 }}
                  >
                    {t("ابدأ مجانًا", "Start free")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: 30, suffix: "", label: "يومًا تجربة مجانية", labelEn: "days of free trial" },
  { value: 2, suffix: "", label: "سوق — السعودية وأمريكا", labelEn: "markets — Saudi & US" },
  { value: 20, suffix: "+", label: "حساب جاهز في الدليل المحاسبي", labelEn: "preconfigured accounts" },
  { value: 100, suffix: "%", label: "ملكية بياناتك — تصدير في أي وقت", labelEn: "your data, exportable anytime" },
];

export function Landing() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { isSA } = useMarketingRegion();
  const { href } = usePublicRoute();
  const FEATURES = isSA ? FEATURES_SA : FEATURES_US;
  const PRICING = isSA ? PRICING_SA : PRICING_US;
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [, setScrolled] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (authStore.getState().isAuthenticated) {
      // Don't redirect - let them browse landing if they want
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const faqs = [
    isSA
      ? { q: t("ما حالة تكامل الفوترة الإلكترونية في السعودية؟", "What is the status of Saudi e-invoicing integration?"), a: t("تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.", "ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance.") }
      : { q: t("هل يدعم ENTIX.IO ضريبة المبيعات والمدفوعات الأمريكية؟", "Does ENTIX.IO support US sales tax and payments?"), a: t("نعم، يدعم ضريبة المبيعات الأمريكية وتتبع الموردين 1099، مع قبول المدفوعات عبر Stripe وربط الحسابات البنكية عبر Plaid التجريبي.", "Yes. ENTIX.IO handles US sales tax and 1099 vendor tracking, accepts payments via Stripe, and connects bank feeds via Plaid Beta.") },
    { q: t("هل بياناتي محفوظة ويمكنني تصديرها؟", "Is my data safe and exportable?"), a: t("نعم — نسخ احتياطي يومي تلقائي مع احتفاظ بالنسخ 14 يومًا، وتصدّر بياناتك كاملة في أي وقت. بياناتك ملكك دائمًا.", "Yes — automatic daily backups with 14-day retention, and you can export all of your data anytime. Your data is always yours.") },
    { q: t("هل تتوفر خيارات نشر مخصصة للمؤسسات؟", "Do you offer custom deployments for enterprises?"), a: t("للمؤسسات ذات المتطلبات الخاصة، تواصل معنا على support@entix.io لبحث الخيارات المناسبة.", "For organizations with special requirements, contact us at support@entix.io to discuss the right options.") },
    { q: t("كيف يتم تأمين البيانات؟", "How is data secured?"), a: t("نستخدم تشفير AES-256 للبيانات المخزنة وTLS 1.3 للاتصالات. مع نسخ احتياطي يومي تلقائي وإمكانية تصدير البيانات في أي وقت بصيغة JSON.", "Data is protected with encrypted storage, secure transport, automated backups, and export options.") },
    isSA
      ? { q: t("هل يدعم العملات المتعددة؟", "Does it support multiple currencies?"), a: t("نعم، يدعم ENTIX.IO الريال السعودي والدولار الأمريكي وأكثر من 50 عملة أخرى مع أسعار صرف محدثة تلقائياً.", "Yes. ENTIX.IO supports Saudi riyals, US dollars, and additional currencies with exchange-rate workflows.") }
      : { q: t("هل يدعم العملات المتعددة؟", "Does it support multiple currencies?"), a: t("نعم، يدعم ENTIX.IO الدولار الأمريكي وعملات إضافية مع إجراءات عمل لأسعار الصرف.", "Yes. ENTIX.IO supports US dollars and additional currencies with exchange-rate workflows.") },
  ];

  const isEn = language === "en";
  // Display hierarchy comes from the approved artboards: Latin runs in the
  // serif display face, Arabic never does (Plex Arabic 700 instead).
  const h1Class = isEn
    ? "font-display font-normal m-0 text-[44px] sm:text-[64px] lg:text-[84px] leading-[0.98] tracking-[-1.5px] text-foreground"
    : "font-bold m-0 text-[34px] sm:text-[52px] lg:text-[72px] leading-[1.15] tracking-[-0.5px] text-foreground";
  const h2Class = isEn
    ? "font-display font-normal m-0 text-[34px] sm:text-[40px] lg:text-[48px] leading-[1.05] text-foreground"
    : "font-bold m-0 text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.3] text-foreground";
  const ctaHeadingClass = isEn
    ? "font-display font-normal m-0 text-[36px] sm:text-[46px] lg:text-[56px] leading-none text-foreground"
    : "font-bold m-0 text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.3] text-foreground";
  const leadClass = isEn ? "text-[16px] sm:text-[20px] leading-[1.55]" : "text-[16px] sm:text-[20px] leading-[1.8]";
  const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-blue-600)] px-7 py-4 text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer min-h-[52px]";
  const btnGhost = "inline-flex items-center justify-center rounded-full border border-foreground px-6 py-4 text-foreground transition-colors hover:bg-surface-hover cursor-pointer min-h-[52px]";

  return (
    <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      <SharedNavbar />

      <main>
      {/* ─── Hero ─── */}
      <section className={`${SHELL} pt-[104px] lg:pt-[184px] pb-12`}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="lg:col-span-6 flex flex-col gap-5 sm:gap-7"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-info-subtle px-3 py-1.5 text-primary" style={{ fontSize: "12px", fontWeight: 600 }}>
                <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>{isSA
                  ? t("نظام محاسبة سحابي متكامل للسوق السعودي", "Cloud accounting for Saudi businesses")
                  : t("نظام محاسبة سحابي متكامل للسوق الأمريكي", "Cloud accounting for US businesses")}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-content-secondary" style={{ fontSize: "12px", fontWeight: 600 }}>
                <Rocket className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>{t("إطلاق تجريبي — كن من الداعمين الأوائل", "Launch Beta — be an early supporter")}</span>
              </span>
            </div>
            <h1 className={h1Class}>
              {t("أدر حساباتك المالية", "Run your accounting")}
              <br />
              <span className={isEn ? "text-[var(--brand-blue-600)] italic" : "text-[var(--brand-blue-600)]"}>{t("بوضوح وتحكّم.", "with clarity and control.")}</span>
            </h1>
            <p className={`text-content-secondary m-0 max-w-[560px] ${leadClass}`}>
              {isSA
                ? t(
                    "محاسبة سحابية بالعربية أولًا مع دعم كامل للإنجليزية. فواتير، ضريبة القيمة المضافة، ربط البنوك وإقفال الفترات — وكل رقم يرجع إلى قيده. تكامل ZATCA للمرحلة الثانية قيد التحقق وغير مفعّل للاعتماد الإنتاجي.",
                    "Arabic-first cloud accounting with full RTL and English LTR. Invoices, VAT, bank feeds and closing — every number traceable back to its entry. ZATCA Phase 2 is under validation and not enabled for production reliance."
                  )
                : t(
                    "محاسبة سحابية بالعربية والإنجليزية. ضريبة مبيعات أمريكية، مدفوعات Stripe، وربط بنكي تجريبي عبر Plaid — وكل رقم يرجع إلى قيده.",
                    "Cloud accounting in Arabic and English. US sales tax, Stripe payments, and Plaid bank feeds in Beta — every number traceable back to its entry."
                  )}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 mt-1">
              <button
                onClick={() => navigate(href("/register"))}
                className={btnPrimary}
                style={{ fontSize: "16px", fontWeight: 600 }}
              >
                {t("ابدأ شهرك المجاني", "Start your free month")}
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => navigate(href("/login"))}
                className={btnGhost}
                style={{ fontSize: "16px", fontWeight: 600 }}
              >
                {t("تسجيل الدخول", "Sign in")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2.5">
              {[
                isSA
                  ? { icon: AlertCircle, text: t("المرحلة الثانية من ZATCA — قيد التحقق", "ZATCA Phase 2 — under validation"), zatcaState: true }
                  : { icon: CreditCard, text: t("مدفوعات Stripe + Plaid تجريبي", "Stripe + Plaid Beta") },
                { icon: Database, text: t("نسخ احتياطي يومي", "Daily backups") },
                { icon: Clock, text: t("شهر مجاني كامل", "Full free month") },
              ].map(item => (
                <div key={item.text} data-plan-zatca-state={item.zatcaState ? "under-validation" : undefined} className="flex items-center gap-1.5 text-content-secondary" style={{ fontSize: "13px" }}>
                  <span className={`h-2 w-2 rounded-full flex-none ${item.zatcaState ? "bg-warning" : "bg-[var(--brand-blue-600)]"}`} />
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Hero visual · photograph + the overlapping ledger figures card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-6 relative lg:mb-9"
          >
            <img
              src="/marketing/hero-ledger.jpg"
              alt=""
              aria-hidden="true"
              className="w-full h-[240px] sm:h-[380px] lg:h-[560px] object-cover rounded-lg block"
              style={language === "ar" ? { transform: "scaleX(-1)" } : undefined}
            />
            <div className="mt-6 lg:mt-0 lg:absolute lg:-start-10 lg:-bottom-9 lg:w-[460px]">
              <LedgerFigureCard t={t} elevated />
            </div>
          </motion.div>
        </div>
      </section>

      <LandingPricingBlock
        t={t}
        currency={isSA ? "SAR" : "USD"}
        onSubscribe={() => navigate(href("/pricing"))}
        onStartFree={() => navigate(href("/register"))}
        pricingHref={href("/pricing")}
      />

      {/* ─── Figures strip ─── */}
      <section className={`${SHELL} mt-16 lg:mt-[120px]`}>
        <div className="grid grid-cols-2 xl:grid-cols-4 border-y border-foreground">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col gap-1.5 py-6 lg:py-8 ${i === 0 ? "" : "ps-4 lg:ps-6"} ${i === STATS.length - 1 ? "" : "pe-4 lg:pe-6 border-e border-border"} ${i < 2 ? "" : "border-t xl:border-t-0 border-border"} ${i === 2 ? "xl:ps-6 ps-0" : ""}`}
            >
              <AnimatedNumber target={stat.value} suffix={stat.suffix} />
              <p className="text-content-secondary m-0" style={{ fontSize: "14px" }}>{t(stat.label, stat.labelEn)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features · heading column + three-up tiles, no boxes ─── */}
      <section id="features" className={`${SHELL} pt-16 lg:pt-24`}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4">
            <h2 className={h2Class}>{t("صُمّم للمحاسب الذي يراجع كل رقم.", "Built for the accountant who checks.")}</h2>
            <p className="text-content-secondary mt-5 m-0 max-w-[360px]" style={{ fontSize: "15px", lineHeight: isEn ? 1.6 : 1.8 }}>
              {t("أدوات محاسبية متكاملة مصممة لتسهيل عملك اليومي وتحسين أداءك المالي", "A practical accounting workspace for invoices, reports, expenses, VAT, and financial operations.")}
            </p>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                className="flex flex-col gap-3.5"
              >
                <f.icon className="h-7 w-7 text-[var(--brand-blue-600)]" strokeWidth={1.6} />
                <h3 className="text-foreground m-0" style={{ fontSize: "18px", fontWeight: 600 }}>{t(f.title, f.titleEn)}</h3>
                <p className="text-content-secondary m-0" style={{ fontSize: "15px", lineHeight: isEn ? 1.6 : 1.8 }}>{t(f.desc, f.descEn)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Product band · real screens on the ink card ─── */}
      <section id="showcase" className={`${SHELL} pt-16 lg:pt-24`}>
        <ShowcaseTabs t={t} />
      </section>

      {/* ─── ZATCA & compliance (Saudi market only — the US/EN prerender forbids Saudi-only concepts) ─── */}
      {isSA && (
      <section id="zatca" className={`${SHELL} pt-16 lg:pt-24`}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4">
            <span className="ledger-eyebrow">{t("الالتزام", "Compliance")}</span>
            <h2 className={`${h2Class} mt-3`}>{t("ضريبة تستطيع الدفاع عنها.", "VAT you can defend.")}</h2>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-8">
            <div className="flex flex-col gap-3.5">
              <Calculator className="h-7 w-7 text-[var(--brand-blue-600)]" strokeWidth={1.6} />
              <h3 className="text-foreground m-0" style={{ fontSize: "18px", fontWeight: 600 }}>{t("ضريبة القيمة المضافة 15%", "15% VAT, per line")}</h3>
              <p className="text-content-secondary m-0" style={{ fontSize: "15px", lineHeight: isEn ? 1.6 : 1.8 }}>
                {t("15% لكل بند ولكل فترة، مع إقرارات جاهزة للمراجعة والتدقيق.", "15% Saudi VAT per line, per period, with returns ready for review and audit.")}
              </p>
            </div>
            <div className="flex flex-col gap-3.5" data-plan-zatca-state="under-validation">
              <Shield className="h-7 w-7 text-warning" strokeWidth={1.6} />
              <h3 className="text-foreground m-0" style={{ fontSize: "18px", fontWeight: 600 }}>{t("المرحلة الثانية من ZATCA", "ZATCA Phase 2")}</h3>
              <p className="text-warning m-0" style={{ fontSize: "15px", lineHeight: isEn ? 1.6 : 1.8 }}>
                {t(
                  "ربط المرحلة الثانية قيد التحقق الفني والتنظيمي، ومُعلَن كذلك بوضوح داخل المنتج، وغير مفعّل للاعتماد الإنتاجي.",
                  "Phase 2 onboarding is under technical and regulatory validation, labelled as such inside the product, and not enabled for production reliance."
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ─── Security & data ownership ─── */}
      <section id="sync" className={`${SHELL} pt-16 lg:pt-24`}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4">
            <span className="ledger-eyebrow">{t("الأمان والاعتمادية", "Security & reliability")}</span>
            <h2 className={`${h2Class} mt-3`}>{t("بياناتك محمية وملكك دائمًا.", "Your data is protected — and always yours.")}</h2>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-3 gap-8">
            {[
              { icon: Database, title: "نسخ احتياطي يومي", titleEn: "Daily backups", desc: "نسخ احتياطي تلقائي كل يوم مع احتفاظ بالنسخ 14 يومًا — بياناتك قابلة للاستعادة عند الحاجة.", descEn: "Automatic backups every day with 14-day retention — your data stays recoverable when needed." },
              { icon: Shield, title: "عزل كامل للبيانات", titleEn: "Full data isolation", desc: "بيانات كل منشأة معزولة بالكامل مع صلاحيات وصول حسب أدوار المستخدمين وجلسات آمنة مشفّرة.", descEn: "Every organization's data is fully isolated, with role-based access and encrypted secure sessions." },
              { icon: FileText, title: "تصدير في أي وقت", titleEn: "Export anytime", desc: "بياناتك ملكك — صدّرها كاملة متى شئت، واحذف حسابك وبياناتك عند الطلب.", descEn: "Your data is yours — export it in full anytime, and delete your account and data on request." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col gap-3.5"
              >
                <item.icon className="h-7 w-7 text-[var(--brand-blue-600)]" strokeWidth={1.6} />
                <h3 className="text-foreground m-0" style={{ fontSize: "18px", fontWeight: 600 }}>{t(item.title, item.titleEn)}</h3>
                <p className="text-content-secondary m-0" style={{ fontSize: "15px", lineHeight: isEn ? 1.6 : 1.8 }}>{t(item.desc, item.descEn)}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Architecture strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="mt-10 border-t border-border pt-8 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10"
        >
          <div className="flex flex-wrap items-center gap-3">
            {[
              { icon: Globe, label: "Cloudflare", sub: "حماية وتسريع", subEn: "protection & CDN" },
              { icon: Database, label: "PostgreSQL", sub: "قاعدة البيانات", subEn: "database" },
              { icon: CreditCard, label: "Stripe", sub: "مدفوعات آمنة", subEn: "secure payments" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2.5">
                <item.icon className="h-5 w-5 text-content-secondary" strokeWidth={1.75} />
                <div>
                  <div className="font-code text-foreground" style={{ fontSize: "13px", fontWeight: 600 }}>{item.label}</div>
                  <div className="text-content-secondary" style={{ fontSize: "11px" }}>{t(item.sub, item.subEn)}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-content-secondary m-0 max-w-[520px]" style={{ fontSize: "14px", lineHeight: 1.7 }}>
            {t(
              "بنية سحابية حديثة: Cloudflare للحماية والتسريع، وPostgreSQL للبيانات، وStripe للمدفوعات — لا تمر بيانات البطاقات بسيرفراتنا.",
              "A modern cloud stack: Cloudflare for protection and speed, PostgreSQL for data, and Stripe for payments — card data never touches our servers."
            )}
          </p>
        </motion.div>
      </section>

      {/* ─── Pricing teaser ─── */}
      <section id="pricing" className={`${SHELL} pt-16 lg:pt-24`}>
        <div className="flex flex-col items-center text-center gap-4 mb-10">
          <span className="ledger-eyebrow text-primary">{t("الأسعار", "Pricing")}</span>
          <h2 className={h2Class}>{t("شهر مجاني كامل. ثم سعر واحد صريح.", "One free month. Then one honest price.")}</h2>
          <p className="text-content-secondary m-0 max-w-[560px]" style={{ fontSize: "18px", lineHeight: isEn ? 1.55 : 1.8 }}>
            {t("اختر الخطة المناسبة لحجم أعمالك — يمكنك الترقية في أي وقت", "Choose the plan that fits your business size. You can upgrade at any time.")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PRICING.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-lg border p-7 sm:px-7 sm:py-8 flex flex-col gap-5 relative ${
                plan.highlighted ? "bg-foreground border-foreground text-background" : "bg-card border-border"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 start-7">
                  <span className="rounded-full bg-[var(--brand-blue-600)] px-3 py-1 text-primary-foreground whitespace-nowrap" style={{ fontSize: "11px", fontWeight: 600 }}>{t("الأكثر شعبية", "Most popular")}</span>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span style={{ fontSize: "18px", fontWeight: 600 }} className={plan.highlighted ? "text-background" : "text-foreground"}>{t(plan.name, plan.nameEn)}</span>
                <span style={{ fontSize: "14px" }} className={plan.highlighted ? "text-background/70" : "text-content-secondary"}>{t(plan.desc, plan.descEn)}</span>
              </div>
              {plan.standard && (
                <div className="flex items-center gap-2 -mb-2" dir="ltr">
                  <span
                    style={{ fontSize: "14px", fontWeight: 500, textDecoration: "line-through" }}
                    className={plan.highlighted ? "text-background/60" : "text-content-secondary"}
                  >{plan.standard}</span>
                  <span className={`rounded-full px-2 py-0.5 ${plan.highlighted ? "bg-background/10 text-background" : "bg-success-subtle text-success"}`} style={{ fontSize: "11px", fontWeight: 600 }}>
                    {t("سعر الإطلاق", "Launch price")} −{Math.round((1 - Number(plan.price) / Number(plan.standard)) * 100)}%
                  </span>
                </div>
              )}
              <div className="flex items-baseline gap-1.5" dir="ltr">
                <span className={`font-display leading-none text-[52px] ${plan.highlighted ? "text-background" : "text-foreground"}`} style={{ fontVariantNumeric: "tabular-nums" }}>{plan.price}</span>
                <span style={{ fontSize: "14px" }} className={plan.highlighted ? "text-background/70" : "text-content-secondary"}>{t(plan.period, plan.periodEn)}</span>
              </div>
              {/* Paid plans lead with the money path; the free path stays one
                  quiet tap away (CEO 2026-09-08). */}
              {plan.standard ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate(href("/pricing"))}
                    data-testid={`teaser-subscribe-${plan.nameEn.toLowerCase()}`}
                    className={
                      plan.highlighted
                        ? "w-full rounded-full py-3.5 transition-opacity hover:opacity-90 cursor-pointer bg-[var(--brand-blue-600)] text-primary-foreground"
                        : "w-full rounded-full py-3.5 transition-colors cursor-pointer bg-foreground text-background hover:bg-primary"
                    }
                    style={{ fontSize: "15px", fontWeight: 600 }}
                  >
                    {t("اشترك الآن — ادفع مباشرة", "Subscribe now — pay directly")}
                  </button>
                  <button
                    onClick={() => navigate(href("/register"))}
                    data-testid={`teaser-start-free-${plan.nameEn.toLowerCase()}`}
                    className={
                      plan.highlighted
                        ? "w-full rounded-full py-3 transition-colors cursor-pointer border border-background/40 text-background hover:bg-background/10"
                        : "w-full rounded-full py-3 transition-colors cursor-pointer border border-border text-content-secondary hover:bg-surface-hover hover:text-foreground"
                    }
                    style={{ fontSize: "14px", fontWeight: 600 }}
                  >
                    {t("ابدأ مجانًا", "Start free")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate(href("/register"))}
                  className="w-full rounded-full py-3.5 transition-colors cursor-pointer border border-foreground text-foreground hover:bg-surface-hover"
                  style={{ fontSize: "15px", fontWeight: 600 }}
                >
                  {t("ابدأ شهرك المجاني", "Start free month")}
                </button>
              )}
              <div className={`h-px w-full ${plan.highlighted ? "bg-background/20" : "bg-border"}`} />
              <ul className="flex flex-col gap-2.5 m-0 p-0" style={{ listStyle: "none" }}>
                {plan.features.map((f, fi) => {
                  const isZatcaValidation = /ZATCA Phase 2/i.test(f);
                  return (
                    <li key={f} data-plan-zatca-state={isZatcaValidation ? "under-validation" : undefined} className="flex items-start gap-2.5" style={{ fontSize: "14px", lineHeight: 1.5 }}>
                      {isZatcaValidation ? (
                        <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-[3px] ${plan.highlighted ? "text-background/70" : "text-warning"}`} strokeWidth={1.75} />
                      ) : (
                        <Check className="h-4 w-4 flex-shrink-0 mt-[3px] text-[var(--brand-blue-600)]" strokeWidth={2.2} />
                      )}
                      <span className={isZatcaValidation ? (plan.highlighted ? "text-background/80" : "text-warning") : (plan.highlighted ? "text-background/85" : "text-foreground")}>{t(f, plan.featuresEn[fi])}</span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Offers · 2y+1y and the referral programme */}
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-lg border border-border bg-card p-5 flex items-start gap-4"
          >
            <Gift className="h-5 w-5 text-[var(--brand-blue-600)] flex-none mt-0.5" strokeWidth={1.75} />
            <div className="flex-1">
              <div className="text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>
                {t("عرض سنتين + سنة مجاناً", "2 years + 1 year free")}
              </div>
              <div className="text-content-secondary mt-1" style={{ fontSize: "13px", lineHeight: 1.7 }}>
                {t("ادفع 24 شهراً واحصل على 36 شهراً كاملة — يُفعَّل عبر فريق المبيعات", "Pay for 24 months, get a full 36 — activated via our sales team")}
              </div>
              <a
                href="mailto:support@entix.io?subject=2Y%2B1Y%20Offer"
                className="inline-flex items-center text-primary hover:underline mt-2 cursor-pointer"
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                {t("فعّل العرض", "Activate offer")}
              </a>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-lg border border-border bg-card p-5 flex items-start gap-4"
          >
            <Users className="h-5 w-5 text-[var(--brand-blue-600)] flex-none mt-0.5" strokeWidth={1.75} />
            <div className="flex-1">
              <div className="text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>
                {t("برنامج الإحالة: صديقك يحصل على خصم، وأنت على عمولة 50%", "Referral program: your friend gets a discount, you earn 50% commission")}
              </div>
              <div className="text-content-secondary mt-1" style={{ fontSize: "13px", lineHeight: 1.7 }}>
                {t("شارك كودك — يحصل المشترك الجديد على خصم، وتُحوَّل لك عمولتك كمسوّق معتمد", "Share your code — new subscribers get a discount, and you earn as an approved marketer")}
              </div>
              <Link
                to={href("/referrals")}
                className="inline-flex items-center text-primary hover:underline mt-2 cursor-pointer"
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                {t("صفحة الإحالات", "Referrals page")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className={`${SHELL} pt-16 lg:pt-24`}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4">
            <span className="ledger-eyebrow">{t("مساعدة", "Help")}</span>
            <h2 className={`${h2Class} mt-3`}>{t("الأسئلة الشائعة", "Frequently asked questions")}</h2>
          </div>
          <div className="lg:col-span-8 border-t border-foreground">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-border">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-start hover:text-primary transition-colors cursor-pointer"
                  aria-expanded={openFaq === i}
                >
                  <span className="text-foreground" style={{ fontSize: "16px", fontWeight: 600 }}>{faq.q}</span>
                  <ChevronDown
                    strokeWidth={1.75}
                    className={
                      openFaq === i
                        ? "w-5 h-5 text-content-secondary flex-shrink-0 transition-transform duration-300 rotate-180"
                        : "w-5 h-5 text-content-secondary flex-shrink-0 transition-transform duration-300"
                    }
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: openFaq === i ? "260px" : "0px", opacity: openFaq === i ? 1 : 0 }}
                >
                  <p className="text-content-secondary pb-5 m-0 max-w-[640px]" style={{ fontSize: "14px", lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Closing CTA ─── */}
      <section className={`${SHELL} py-20 lg:py-24 flex flex-col items-center text-center gap-5`}>
        <h2 className={ctaHeadingClass}>{t("ابدأ بشهر مجاني كامل.", "Start with a full free month.")}</h2>
        <p className="text-content-secondary m-0 max-w-[560px]" style={{ fontSize: "18px", lineHeight: isEn ? 1.5 : 1.8 }}>
          {t(
            "بدون بطاقة. استورد دليل حساباتك، وادعُ محاسبك، وصدّر كل شيء متى شئت.",
            "No card required. Import your chart of accounts, invite your accountant, export everything whenever you like."
          )}
        </p>
        <button
          onClick={() => navigate(href("/register"))}
          className={`${btnPrimary} mt-1`}
          style={{ fontSize: "16px", fontWeight: 600 }}
        >
          {t("ابدأ شهرك المجاني", "Start your free month")}
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </section>

      </main>
      {/* ─── Footer ─── */}
      <SharedFooter />
    </div>
  );
}
