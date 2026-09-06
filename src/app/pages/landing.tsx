import { displayLocale } from "../lib/number-display";
import { useNavigate, Link } from "react-router";
import {
  Shield, BarChart3, Globe, Zap, Cloud, Smartphone, FileText, ArrowLeft, CheckCircle2, ChevronDown, Database, Receipt, Calculator, TrendingUp, Clock, CreditCard, Landmark, Rocket, Gift, Users, AlertCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { EntixWordmark } from "../components/entix-brand";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";
import { usePublicRoute } from "../lib/public-route";

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

  return <div ref={ref} className="ledger-figure-value">{count.toLocaleString(displayLocale("en-US"))}{suffix}</div>;
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
    <div>
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {shots.map((s, i) => (
          <button
            key={s.src}
            onClick={() => setActive(i)}
            className={`rounded-full px-5 py-2 transition-colors cursor-pointer border ${i === active ? "bg-foreground text-background border-foreground" : "bg-card text-content-secondary border-border hover:bg-surface-hover"}`}
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border border-border overflow-hidden bg-card"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-subtle border-b border-border" dir="ltr">
          <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
          <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
          <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
          <div className="flex-1 mx-4 bg-card border border-border rounded-full px-3 py-1 text-content-secondary text-center font-code" style={{ fontSize: "11px" }}>
            app.entix.io
          </div>
        </div>
        <img
          src={shots[active].src}
          alt={shots[active].label}
          loading="lazy"
          className="w-full block"
          width={1440}
          height={900}
        />
      </motion.div>
      <p className="text-center text-content-secondary mt-4" style={{ fontSize: "13px" }}>{shots[active].desc}</p>
    </div>
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

  const displayHeading = language === "en"
    ? "font-display font-normal tracking-tight text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.0]"
    : "font-bold text-[32px] sm:text-[44px] lg:text-[56px] leading-[1.18]";
  const sectionHeading = language === "en"
    ? "font-display font-normal tracking-tight text-[32px] sm:text-[40px] leading-[1.06] text-foreground"
    : "font-bold text-[26px] sm:text-[34px] leading-[1.3] text-foreground";

  return (
    <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      <SharedNavbar />

      <main>
      {/* ─── Hero Section ─── */}
      <section className="pt-32 sm:pt-36 pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex flex-wrap items-center gap-2 mb-7">
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
            <h1 className={`text-foreground mb-6 ${displayHeading}`}>
              {t("أدر حساباتك المالية", "Run your accounting")}
              <br />
              <span className="text-primary">{t("بذكاء وسهولة", "with clarity and control")}</span>
            </h1>
            <p className="text-content-secondary mb-8 max-w-xl" style={{ fontSize: "17px", lineHeight: 1.75 }}>
              {isSA
                ? t(
                    "ENTIX.IO نظام محاسبة سحابي متكامل يدعم العربية بالكامل. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.",
                    "ENTIX.IO is a cloud accounting platform with full Arabic RTL and English LTR. ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance."
                  )
                : t(
                    "ENTIX.IO نظام محاسبة سحابي متكامل. ضريبة مبيعات أمريكية، مدفوعات Stripe، وربط بنكي تجريبي عبر Plaid — وبواجهة عربية أو إنجليزية كاملة.",
                    "ENTIX.IO is a cloud accounting platform with US sales tax, Stripe payments, and Plaid bank feeds in Beta — in a full Arabic or English interface."
                  )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(href("/register"))}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-background transition-colors hover:bg-primary cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("ابدأ شهرك المجاني", "Start your free month")}
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => navigate(href("/login"))}
                className="inline-flex h-12 items-center rounded-full border border-foreground px-7 text-foreground transition-colors hover:bg-surface-hover cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                {t("تسجيل الدخول", "Sign in")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8">
              {[
                isSA
                  ? { icon: AlertCircle, text: t("ZATCA Phase 2 — قيد التحقق", "ZATCA Phase 2 — Under validation"), zatcaState: true }
                  : { icon: CreditCard, text: t("مدفوعات Stripe + Plaid تجريبي", "Stripe + Plaid Beta") },
                { icon: Database, text: t("نسخ احتياطي يومي", "Daily backups") },
                { icon: Clock, text: t("شهر مجاني كامل", "Full free month") },
              ].map(item => (
                <div key={item.text} data-plan-zatca-state={item.zatcaState ? "under-validation" : undefined} className={`flex items-center gap-2 ${item.zatcaState ? "text-warning" : "text-content-secondary"}`} style={{ fontSize: "13px", fontWeight: 500 }}>
                  <span className={`ledger-dot ${item.zatcaState ? "text-warning" : "text-success"}`} />
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Hero ledger card — built from tokens, no raster art */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <div className="rounded-lg border border-border bg-card p-5 sm:p-6 shadow-raised">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="ledger-eyebrow">{t("لوحة التحكم", "Dashboard")}</span>
                <span className="inline-flex items-center gap-1.5 text-success" style={{ fontSize: "12px", fontWeight: 600 }}>
                  <span className="ledger-dot" />
                  {t("نسخ احتياطي يومي", "Daily backups")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-6 py-5" dir="ltr">
                <div className="flex flex-col gap-1.5">
                  <span className="ledger-eyebrow">{t("فاتورة هذا الشهر", "invoices this month")}</span>
                  <span className="ledger-figure-value">1,247</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="ledger-eyebrow">{t("نمو الإيرادات", "Revenue growth")}</span>
                  <span className="ledger-figure-value text-primary">+23.5%</span>
                </div>
              </div>
              <div className="flex h-28 items-end gap-2 border-t border-border pt-5" aria-hidden="true">
                {[38, 52, 46, 66, 60, 100].map((h, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-t-[3px] ${i === 5 ? "bg-primary" : i >= 3 ? "bg-foreground" : "bg-border"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-content-secondary" style={{ fontSize: "12px" }}>{t("المساعد الذكي", "AI assistant")}</span>
                <span className="font-code text-content-secondary" style={{ fontSize: "12px" }}>app.entix.io</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Figures strip ─── */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="ledger-figures grid grid-cols-2 xl:grid-cols-4">
            {STATS.map(stat => (
              <div key={stat.label} className="ledger-figure flex flex-col gap-2">
                <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                <p className="text-content-secondary" style={{ fontSize: "14px" }}>{t(stat.label, stat.labelEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-8 mb-12">
            <div className="lg:col-span-5">
              <span className="ledger-eyebrow">{t("المميزات", "Features")}</span>
              <h2 className={`mt-3 ${sectionHeading}`}>{t("كل ما تحتاجه في مكان واحد", "Everything your accounting team needs")}</h2>
            </div>
            <p className="lg:col-span-6 lg:col-start-7 text-content-secondary self-end" style={{ fontSize: "16px", lineHeight: 1.7 }}>{t("أدوات محاسبية متكاملة مصممة لتسهيل عملك اليومي وتحسين أداءك المالي", "A practical accounting workspace for invoices, reports, expenses, VAT, and financial operations.")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                className="ledger-hoverable rounded-lg border border-border bg-card p-5 transition-all"
              >
                <div className="h-10 w-10 rounded-md bg-info-subtle flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 600 }}>{t(f.title, f.titleEn)}</h3>
                <p className="text-content-secondary" style={{ fontSize: "14px", lineHeight: 1.75 }}>{t(f.desc, f.descEn)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Product showcase · real app screenshots ─── */}
      <section id="showcase" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="ledger-eyebrow">{t("من داخل المنصة", "Inside the product")}</span>
            <h2 className={`mt-3 mb-4 ${sectionHeading}`}>{t("شاهد ENTIX.IO أثناء العمل", "See ENTIX.IO at work")}</h2>
            <p className="text-content-secondary max-w-xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>{t("لقطات حقيقية من المنصة — لوحة التحكم، الفواتير، والمساعد الذكي", "Real product screens — the dashboard, invoices, and the AI assistant")}</p>
          </div>
          <ShowcaseTabs t={t} />
        </div>
      </section>

      {/* ─── Sync Architecture ─── */}
      <section id="sync" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-info-subtle px-3 py-1.5 text-primary" style={{ fontSize: "12px", fontWeight: 600 }}>
              <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
              {t("الأمان والاعتمادية", "Security & reliability")}
            </span>
            <h2 className={`mt-4 mb-4 ${sectionHeading}`}>{t("بياناتك محمية وملكك دائمًا", "Your data is protected — and always yours")}</h2>
            <p className="text-content-secondary max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.75 }}>
              {t(
                "نسخ احتياطي يومي تلقائي مع احتفاظ 14 يومًا، وعزل كامل لبيانات كل منشأة، وتصدير بياناتك كاملة في أي وقت.",
                "Automatic daily backups with 14-day retention, complete isolation of each organization's data, and full export anytime."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
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
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="h-10 w-10 rounded-md bg-info-subtle flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 600 }}>{t(item.title, item.titleEn)}</h3>
                <p className="text-content-secondary" style={{ fontSize: "14px", lineHeight: 1.75 }}>{t(item.desc, item.descEn)}</p>
              </motion.div>
            ))}
          </div>

          {/* Architecture strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mt-10 rounded-lg bg-foreground text-background p-8 sm:p-10"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-6">
              {[
                { icon: Globe, label: "Cloudflare", sub: "حماية وتسريع", subEn: "protection & CDN" },
                { icon: Database, label: "PostgreSQL", sub: "قاعدة البيانات", subEn: "database" },
                { icon: CreditCard, label: "Stripe", sub: "مدفوعات آمنة", subEn: "secure payments" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-3">
                  {i > 0 && <div className="hidden sm:block w-10 h-px bg-background/30" />}
                  <div className="flex items-center gap-2.5 rounded-md border border-background/15 px-4 py-3">
                    <item.icon className="h-5 w-5 text-background/70" strokeWidth={1.75} />
                    <div>
                      <div className="font-code text-background" style={{ fontSize: "13px", fontWeight: 600 }}>{item.label}</div>
                      <div className="text-background/60" style={{ fontSize: "11px" }}>{t(item.sub, item.subEn)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-background/70 max-w-2xl mx-auto text-center" style={{ fontSize: "14px", lineHeight: 1.75 }}>
              {t(
                "بنية سحابية حديثة: Cloudflare للحماية والتسريع، وPostgreSQL للبيانات، وStripe للمدفوعات — لا تمر بيانات البطاقات بسيرفراتنا.",
                "A modern cloud stack: Cloudflare for protection and speed, PostgreSQL for data, and Stripe for payments — card data never touches our servers."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="ledger-eyebrow">{t("الأسعار", "Pricing")}</span>
            <h2 className={`mt-3 mb-4 ${sectionHeading}`}>{t("خطط أسعار مرنة", "Flexible pricing plans")}</h2>
            <p className="text-content-secondary" style={{ fontSize: "16px" }}>{t("اختر الخطة المناسبة لحجم أعمالك — يمكنك الترقية في أي وقت", "Choose the plan that fits your business size. You can upgrade at any time.")}</p>
          </div>

          {/* 2 years + 1 year free offer */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-4xl mx-auto mb-10 rounded-lg border border-border bg-card px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 text-center sm:text-start">
              <div className="h-10 w-10 rounded-md bg-info-subtle flex items-center justify-center flex-shrink-0">
                <Gift className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-foreground" style={{ fontSize: "15px", fontWeight: 700 }}>
                  {t("عرض سنتين + سنة مجاناً", "2 years + 1 year free")}
                </div>
                <div className="text-content-secondary" style={{ fontSize: "13px" }}>
                  {t("ادفع 24 شهراً واحصل على 36 شهراً كاملة — يُفعَّل عبر فريق المبيعات", "Pay for 24 months, get a full 36 — activated via our sales team")}
                </div>
              </div>
            </div>
            <a
              href="mailto:support@entix.io?subject=2Y%2B1Y%20Offer"
              className="inline-flex h-10 items-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-primary cursor-pointer whitespace-nowrap"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("فعّل العرض", "Activate offer")}
            </a>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-start">
            {PRICING.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-lg p-6 border relative ${
                  plan.highlighted
                    ? "bg-foreground border-foreground text-background"
                    : "bg-card border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 start-6">
                    <span className="rounded-full bg-primary px-3 py-1 text-background whitespace-nowrap" style={{ fontSize: "11px", fontWeight: 600 }}>{t("الأكثر شعبية", "Most popular")}</span>
                  </div>
                )}
                <h3 style={{ fontSize: "18px", fontWeight: 600 }} className={plan.highlighted ? "text-background mt-2" : "text-foreground"}>{t(plan.name, plan.nameEn)}</h3>
                <p style={{ fontSize: "13px" }} className={`mt-1 ${plan.highlighted ? "text-background/70" : "text-content-secondary"}`}>{t(plan.desc, plan.descEn)}</p>
                {plan.standard && (
                  <div className="flex items-center gap-2 mt-4" dir="ltr">
                    <span
                      style={{ fontSize: "14px", fontWeight: 500, textDecoration: "line-through" }}
                      className={plan.highlighted ? "text-background/60" : "text-content-secondary"}
                    >{plan.standard}</span>
                    <span className={`rounded-full px-2 py-0.5 ${plan.highlighted ? "bg-background/10 text-background" : "bg-success-subtle text-success"}`} style={{ fontSize: "11px", fontWeight: 600 }}>
                      {t("سعر الإطلاق", "Launch price")} −{Math.round((1 - Number(plan.price) / Number(plan.standard)) * 100)}%
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-2 mt-2 mb-1" dir="ltr">
                  <span className={`font-display leading-none text-[44px] ${plan.highlighted ? "text-background" : "text-foreground"}`} style={{ fontVariantNumeric: "tabular-nums" }}>{plan.price}</span>
                  <span style={{ fontSize: "13px" }} className={plan.highlighted ? "text-background/70" : "text-content-secondary"}>{t(plan.period, plan.periodEn)}</span>
                </div>
                {plan.standard && (
                  <p className={plan.highlighted ? "text-background/70 mt-1" : "text-primary mt-1"} style={{ fontSize: "12px", fontWeight: 600 }}>{t("+ شهرك الأول مجاناً", "+ your first month free")}</p>
                )}
                <hr className={`my-5 ${plan.highlighted ? "border-background/20" : "border-border"}`} />
                <ul className="space-y-3">
                  {plan.features.map((f, fi) => {
                    const isZatcaValidation = /ZATCA Phase 2/i.test(f);
                    return (
                      <li key={f} data-plan-zatca-state={isZatcaValidation ? "under-validation" : undefined} className="flex items-start gap-2.5" style={{ fontSize: "14px", lineHeight: 1.5 }}>
                        {isZatcaValidation ? (
                          <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? "text-background/70" : "text-warning"}`} strokeWidth={1.75} />
                        ) : (
                          <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? "text-background/70" : "text-primary"}`} strokeWidth={1.75} />
                        )}
                        <span className={isZatcaValidation ? (plan.highlighted ? "text-background/80" : "text-warning") : (plan.highlighted ? "text-background/80" : "text-content-secondary")}>{t(f, plan.featuresEn[fi])}</span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => navigate(href("/register"))}
                  className={
                    plan.highlighted
                      ? "w-full mt-6 h-11 rounded-full transition-colors cursor-pointer bg-background text-foreground hover:bg-background/90"
                      : "w-full mt-6 h-11 rounded-full transition-colors cursor-pointer border border-foreground text-foreground hover:bg-surface-hover"
                  }
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {t("ابدأ الآن", "Start now")}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Referral program strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-4xl mx-auto mt-10 rounded-lg border border-border bg-card px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 text-center sm:text-start">
              <div className="h-10 w-10 rounded-md bg-info-subtle flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-foreground" style={{ fontSize: "15px", fontWeight: 700 }}>
                  {t("برنامج الإحالة: صديقك يحصل على خصم، وأنت على عمولة 50%", "Referral program: your friend gets a discount, you earn 50% commission")}
                </div>
                <div className="text-content-secondary" style={{ fontSize: "13px" }}>
                  {t("شارك كودك — يحصل المشترك الجديد على خصم، وتُحوَّل لك عمولتك كمسوّق معتمد", "Share your code — new subscribers get a discount, and you earn as an approved marketer")}
                </div>
              </div>
            </div>
            <Link
              to={href("/referrals")}
              className="inline-flex h-10 items-center rounded-full border border-foreground px-6 text-foreground transition-colors hover:bg-surface-hover cursor-pointer whitespace-nowrap"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("صفحة الإحالات", "Referrals page")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-foreground text-background rounded-lg p-10 sm:p-14 text-center"
          >
            <div className="flex justify-center mb-6"><EntixWordmark size={26} light /></div>
            <h2 className={`mb-4 ${language === "en" ? "font-display font-normal tracking-tight text-[36px] sm:text-[48px] leading-[1.05] text-background" : "font-bold text-[26px] sm:text-[34px] leading-[1.3] text-background"}`}>
              {t("جاهز لتحويل إدارتك المالية؟", "Ready to modernize your financial operations?")}
            </h2>
            <p className="text-background/70 max-w-xl mx-auto mb-8" style={{ fontSize: "16px", lineHeight: 1.75 }}>
              {t(
                "ENTIX.IO في مرحلة الإطلاق التجريبي — كن من الداعمين الأوائل وأدر فواتيرك ومصاريفك وتقاريرك بكفاءة وأمان.",
                "Use ENTIX.IO to manage accounting, invoices, expenses, and reports with a cleaner bilingual workflow."
              )}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate(href("/register"))}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-background px-8 text-foreground transition-opacity hover:opacity-90 cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("ابدأ شهرك المجاني", "Start your free month")}
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="ledger-eyebrow">{t("مساعدة", "Help")}</span>
            <h2 className={`mt-3 ${sectionHeading}`}>{t("الأسئلة الشائعة", "Frequently asked questions")}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-start hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <span className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>{faq.q}</span>
                  <ChevronDown
                    strokeWidth={1.75}
                    className={
                      openFaq === i
                        ? "w-5 h-5 text-content-secondary flex-shrink-0 ms-3 transition-transform duration-300 rotate-180"
                        : "w-5 h-5 text-content-secondary flex-shrink-0 ms-3 transition-transform duration-300"
                    }
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: openFaq === i ? "220px" : "0px", opacity: openFaq === i ? 1 : 0 }}
                >
                  <div className="px-5 pb-5 border-t border-border pt-4">
                    <p className="text-content-secondary" style={{ fontSize: "14px", lineHeight: 1.85 }}>{faq.a}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      </main>
      {/* ─── Footer ─── */}
      <SharedFooter />
    </div>
  );
}
