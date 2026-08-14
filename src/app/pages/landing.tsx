import { useNavigate, Link } from "react-router";
import {
  Shield, BarChart3, Globe, Zap, Cloud, Smartphone, FileText, ArrowLeft, CheckCircle2, ChevronDown, Database, Receipt, Calculator, TrendingUp, Clock, CreditCard, Landmark, Rocket, Gift, Users, AlertCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { InteractiveDashboard3D } from "../components/interactive-dashboard-3d";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";

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

  return <div ref={ref} style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fontWeight: 700 }}>{count.toLocaleString("en-US")}{suffix}</div>;
}

const FEATURES_SA = [
  { icon: FileText, title: "فواتير احترافية", titleEn: "Professional invoices", desc: "إنشاء وإدارة الفواتير مع QR يحتوي بيانات الفاتورة الأساسية. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.", descEn: "Create and manage invoices with a QR containing core invoice data. ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance." },
  { icon: BarChart3, title: "تقارير مالية متقدمة", titleEn: "Advanced financial reports", desc: "لوحة تحكم شاملة مع رسوم بيانية تفاعلية ومؤشرات أداء رئيسية", descEn: "A clear dashboard with interactive charts and key financial indicators." },
  { icon: Shield, title: "أمان وموثوقية", titleEn: "Secure and reliable", desc: "تشفير AES-256 وحماية متعددة الطبقات مع نسخ احتياطي تلقائي", descEn: "Layered protection, encrypted storage, and automated backups." },
  { icon: Globe, title: "دعم متعدد اللغات", titleEn: "Arabic and English", desc: "واجهة عربية كاملة RTL مع دعم اللغة الإنجليزية والعملات المتعددة", descEn: "Native Arabic RTL with English LTR support and multi-currency workflows." },
  { icon: Cloud, title: "سحابي بالكامل", titleEn: "Fully cloud", desc: "بياناتك متاحة من أي جهاز ومتصفح مع نسخ احتياطي يومي تلقائي", descEn: "Access from any device or browser with automatic daily backups." },
  { icon: Smartphone, title: "متوافق مع الجوال", titleEn: "Mobile friendly", desc: "تصميم متجاوب يعمل بسلاسة على جميع الأجهزة والشاشات", descEn: "Responsive screens built for desktop and mobile accounting work." },
  { icon: Receipt, title: "إدارة المصروفات", titleEn: "Expense management", desc: "تتبع المصروفات والمشتريات مع تصنيف تلقائي ومراكز تكلفة", descEn: "Track expenses, purchases, categories, and cost centers." },
  { icon: Calculator, title: "ضريبة القيمة المضافة", titleEn: "VAT handling", desc: "حساب تلقائي للضريبة مع تقارير جاهزة للتقديم لهيئة الزكاة", descEn: "Automated VAT calculations with reports prepared for compliance review." },
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
  { icon: Landmark, title: "ربط البنوك Plaid", titleEn: "Plaid bank feeds", desc: "اربط حساباتك البنكية الأمريكية عبر Plaid لمطابقة المعاملات تلقائياً", descEn: "Connect US bank accounts via Plaid for automatic transaction matching." },
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
    features: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "ZATCA Phase 2 — قيد التحقق", "تكاملات بنكية (Plaid)", "API كامل"],
    featuresEn: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "ZATCA Phase 2 — Under validation", "Bank feeds (Plaid)", "Full API access"],
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
    features: ["فواتير غير محدودة", "حتى 5 مستخدمين", "وكيل ذكاء اصطناعي كامل", "مدفوعات Stripe", "تكاملات بنكية (Plaid)", "API كامل"],
    featuresEn: ["Unlimited invoices", "Up to 5 users", "Full AI agent", "Stripe payments", "Bank feeds (Plaid)", "Full API access"],
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
  const shots = [
    { src: "/marketing/dashboard.webp", label: t("لوحة التحكم", "Dashboard"), desc: t("نظرة لحظية على الإيرادات والمصروفات والضريبة", "A live view of revenue, expenses, and tax") },
    { src: "/marketing/invoices.webp", label: t("الفواتير", "Invoices"), desc: t("إدارة فواتير العملاء مع الحالات والتحصيل", "Manage customer invoices, statuses, and collection") },
    { src: "/marketing/ai-agent.webp", label: t("المساعد الذكي", "AI assistant"), desc: t("أنشئ فواتير ومصروفات وتقارير بمحادثة واحدة", "Create invoices, expenses, and reports in one chat") },
  ];
  return (
    <div>
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {shots.map((s, i) => (
          <button
            key={s.src}
            onClick={() => setActive(i)}
            className={`px-5 py-2.5 rounded-xl transition-all cursor-pointer ${i === active ? "bg-primary text-white shadow-lg shadow-primary/25" : "bg-muted/60 text-foreground/70 hover:bg-muted"}`}
            style={{ fontSize: "14px", fontWeight: 600 }}
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
        className="rounded-2xl border border-gray-200 shadow-2xl shadow-foreground/10 overflow-hidden bg-white"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/60 border-b border-gray-100" dir="ltr">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          <div className="flex-1 mx-4 bg-white rounded-md px-3 py-1 text-muted-foreground text-center" style={{ fontSize: "11px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
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
      <p className="text-center text-muted-foreground mt-4" style={{ fontSize: "13px" }}>{shots[active].desc}</p>
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
      : { q: t("هل يدعم ENTIX.IO ضريبة المبيعات والمدفوعات الأمريكية؟", "Does ENTIX.IO support US sales tax and payments?"), a: t("نعم، يدعم ضريبة المبيعات الأمريكية وتتبع الموردين 1099، مع قبول المدفوعات عبر Stripe وربط الحسابات البنكية عبر Plaid.", "Yes. ENTIX.IO handles US sales tax and 1099 vendor tracking, accepts payments via Stripe, and connects bank feeds via Plaid.") },
    { q: t("هل بياناتي محفوظة ويمكنني تصديرها؟", "Is my data safe and exportable?"), a: t("نعم — نسخ احتياطي يومي تلقائي مع احتفاظ بالنسخ 14 يومًا، وتصدّر بياناتك كاملة في أي وقت. بياناتك ملكك دائمًا.", "Yes — automatic daily backups with 14-day retention, and you can export all of your data anytime. Your data is always yours.") },
    { q: t("هل تتوفر خيارات نشر مخصصة للمؤسسات؟", "Do you offer custom deployments for enterprises?"), a: t("للمؤسسات ذات المتطلبات الخاصة، تواصل معنا على support@entix.io لبحث الخيارات المناسبة.", "For organizations with special requirements, contact us at support@entix.io to discuss the right options.") },
    { q: t("كيف يتم تأمين البيانات؟", "How is data secured?"), a: t("نستخدم تشفير AES-256 للبيانات المخزنة وTLS 1.3 للاتصالات. مع نسخ احتياطي يومي تلقائي وإمكانية تصدير البيانات في أي وقت بصيغة JSON.", "Data is protected with encrypted storage, secure transport, automated backups, and export options.") },
    { q: t("هل يدعم العملات المتعددة؟", "Does it support multiple currencies?"), a: t("نعم، يدعم ENTIX.IO الريال السعودي والدولار الأمريكي وأكثر من 50 عملة أخرى مع أسعار صرف محدثة تلقائياً.", "Yes. ENTIX.IO supports SAR, USD, and additional currencies with exchange-rate workflows.") },
  ];

  return (
    <div className="min-h-screen bg-white" dir={language === "ar" ? "rtl" : "ltr"}>
      <SharedNavbar />

      <main>
      {/* ─── Hero Section ─── */}
      <section className="pt-28 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 bg-primary/5 text-primary px-4 py-2 rounded-full" style={{ fontSize: "13px", fontWeight: 600 }}>
                <Zap className="w-4 h-4" />
                <span>{isSA
                  ? t("نظام محاسبة سحابي متكامل للسوق السعودي", "Cloud accounting for Saudi businesses")
                  : t("نظام محاسبة سحابي متكامل للسوق الأمريكي", "Cloud accounting for US businesses")}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-500/30 px-3.5 py-2 rounded-full" style={{ fontSize: "12px", fontWeight: 700 }}>
                <Rocket className="w-3.5 h-3.5" />
                <span>{t("إطلاق تجريبي — كن من الداعمين الأوائل", "Launch Beta — be an early supporter")}</span>
              </div>
            </div>
            <h1 className="text-foreground mb-6" style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.2 }}>
              {t("أدر حساباتك المالية", "Run your accounting")}
              <br />
              <span className="bg-gradient-to-l from-primary to-secondary bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>{t("بذكاء وسهولة", "with clarity and control")}</span>
            </h1>
            <p className="text-muted-foreground mb-8 max-w-lg" style={{ fontSize: "17px", lineHeight: 1.9 }}>
              {isSA
                ? t(
                    "ENTIX.IO نظام محاسبة سحابي متكامل يدعم العربية بالكامل. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.",
                    "ENTIX.IO is a cloud accounting platform with full Arabic RTL and English LTR. ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance."
                  )
                : t(
                    "ENTIX.IO نظام محاسبة سحابي متكامل. ضريبة مبيعات أمريكية، مدفوعات Stripe، ربط بنكي عبر Plaid — وبواجهة عربية أو إنجليزية كاملة.",
                    "ENTIX.IO is a cloud accounting platform with US sales tax, Stripe payments, and Plaid bank feeds — in a full Arabic or English interface."
                  )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-primary hover:bg-primary/80 text-white px-8 py-3.5 rounded-xl transition-all hover:shadow-xl hover:shadow-primary/25 flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("ابدأ شهرك المجاني", "Start your free month")}
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate("/login")}
                className="border-2 border-border hover:border-primary text-foreground px-8 py-3.5 rounded-xl transition-all cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                {t("تسجيل الدخول", "Sign in")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-8">
              {[
                isSA
                  ? { icon: AlertCircle, text: t("ZATCA Phase 2 — قيد التحقق", "ZATCA Phase 2 — Under validation"), zatcaState: true }
                  : { icon: CreditCard, text: t("مدفوعات Stripe + Plaid", "Stripe + Plaid") },
                { icon: Database, text: t("نسخ احتياطي يومي", "Daily backups") },
                { icon: Clock, text: t("شهر مجاني كامل", "Full free month") },
              ].map(item => (
                <div key={item.text} data-plan-zatca-state={item.zatcaState ? "under-validation" : undefined} className={`flex items-center gap-1.5 ${item.zatcaState ? "text-amber-800" : "text-muted-foreground"}`} style={{ fontSize: "13px", fontWeight: 500 }}>
                  <item.icon className={`h-4 w-4 ${item.zatcaState ? "text-amber-600" : "text-green-500"}`} />
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Decorative blobs */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
            
            <InteractiveDashboard3D />

            {/* Floating stat cards */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="hidden sm:block absolute -bottom-6 right-4 bg-white rounded-xl shadow-xl border border-gray-100 p-3 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="text-green-700" style={{ fontSize: "13px", fontWeight: 600 }}>+23.5%</div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("نمو الإيرادات", "Revenue growth")}</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
              className="hidden sm:block absolute -top-4 left-4 bg-white rounded-xl shadow-xl border border-gray-100 p-3 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-foreground" style={{ fontSize: "13px", fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>1,247</div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("فاتورة هذا الشهر", "invoices this month")}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-12 bg-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-white mb-1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-muted-foreground" style={{ fontSize: "14px" }}>{t(stat.label, stat.labelEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 sm:py-24 bg-muted/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-primary/5 text-primary px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("المميزات", "Features")}</span>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("كل ما تحتاجه في مكان واحد", "Everything your accounting team needs")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>{t("أدوات محاسبية متكاملة مصممة لتسهيل عملك اليومي وتحسين أداءك المالي", "A practical accounting workspace for invoices, reports, expenses, VAT, and financial operations.")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div 
                key={f.title} 
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary transition-colors duration-300">
                  <f.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-foreground mb-2" style={{ fontSize: "17px", fontWeight: 600 }}>{t(f.title, f.titleEn)}</h3>
                <p className="text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.8 }}>{t(f.desc, f.descEn)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Product showcase · real app screenshots ─── */}
      <section id="showcase" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-primary/5 text-primary px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("من داخل المنصة", "Inside the product")}</span>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("شاهد ENTIX.IO أثناء العمل", "See ENTIX.IO at work")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>{t("لقطات حقيقية من المنصة — لوحة التحكم، الفواتير، والمساعد الذكي", "Real product screens — the dashboard, invoices, and the AI assistant")}</p>
          </div>
          <ShowcaseTabs t={t} />
        </div>
      </section>

      {/* ─── Sync Architecture ─── */}
      <section id="sync" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-green-50 text-green-700 px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الأمان والاعتمادية", "Security & reliability")}</span>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("بياناتك محمية وملكك دائمًا", "Your data is protected — and always yours")}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.8 }}>
              {t(
                "نسخ احتياطي يومي تلقائي مع احتفاظ 14 يومًا، وعزل كامل لبيانات كل منشأة، وتصدير بياناتك كاملة في أي وقت.",
                "Automatic daily backups with 14-day retention, complete isolation of each organization's data, and full export anytime."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { icon: Database, color: "#0B1B49", title: "نسخ احتياطي يومي", titleEn: "Daily backups", desc: "نسخ احتياطي تلقائي كل يوم مع احتفاظ بالنسخ 14 يومًا — بياناتك قابلة للاستعادة عند الحاجة.", descEn: "Automatic backups every day with 14-day retention — your data stays recoverable when needed." },
              { icon: Shield, color: "#1276E3", title: "عزل كامل للبيانات", titleEn: "Full data isolation", desc: "بيانات كل منشأة معزولة بالكامل مع صلاحيات وصول حسب أدوار المستخدمين وجلسات آمنة مشفّرة.", descEn: "Every organization's data is fully isolated, with role-based access and encrypted secure sessions." },
              { icon: FileText, color: "#349FC4", title: "تصدير في أي وقت", titleEn: "Export anytime", desc: "بياناتك ملكك — صدّرها كاملة متى شئت، واحذف حسابك وبياناتك عند الطلب.", descEn: "Your data is yours — export it in full anytime, and delete your account and data on request." },
            ].map((item, i) => (
              <motion.div 
                key={item.title}
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.1 }}
                className={`text-center p-8 rounded-2xl bg-gradient-to-b from-muted/40 to-white border ${i === 1 ? "border-primary/20 shadow-xl shadow-primary/5 scale-[1.02]" : "border-gray-100"} hover:shadow-lg transition-all`}
              >
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: item.color }}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-foreground mb-3" style={{ fontSize: "19px", fontWeight: 600 }}>{t(item.title, item.titleEn)}</h3>
                <p className="text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.8 }}>{t(item.desc, item.descEn)}</p>
              </motion.div>
            ))}
          </div>
          
          {/* Architecture diagram */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mt-12 bg-gradient-to-br from-foreground to-foreground rounded-2xl p-8 sm:p-10"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-6">
              {[
                { icon: Globe, label: "Cloudflare", sub: "حماية وتسريع", subEn: "protection & CDN" },
                { icon: Database, label: "PostgreSQL", sub: "قاعدة البيانات", subEn: "database" },
                { icon: CreditCard, label: "Stripe", sub: "مدفوعات آمنة", subEn: "secure payments" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-3">
                  {i > 0 && <div className="hidden sm:block w-12 h-[2px] bg-secondary/40 rounded" />}
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <item.icon className="w-5 h-5 text-secondary" />
                    <div>
                      <div className="text-white" style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fontWeight: 600 }}>{item.label}</div>
                      <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t(item.sub, item.subEn)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto text-center" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              {t(
                "بنية سحابية حديثة: Cloudflare للحماية والتسريع، وPostgreSQL للبيانات، وStripe للمدفوعات — لا تمر بيانات البطاقات بسيرفراتنا.",
                "A modern cloud stack: Cloudflare for protection and speed, PostgreSQL for data, and Stripe for payments — card data never touches our servers."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 sm:py-24 bg-muted/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-orange-50 text-amber-700 px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الأسعار", "Pricing")}</span>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("خطط أسعار مرنة", "Flexible pricing plans")}</h2>
            <p className="text-muted-foreground" style={{ fontSize: "16px" }}>{t("اختر الخطة المناسبة لحجم أعمالك — يمكنك الترقية في أي وقت", "Choose the plan that fits your business size. You can upgrade at any time.")}</p>
          </div>

          {/* 2 years + 1 year free offer */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-4xl mx-auto mb-10 rounded-2xl bg-gradient-to-l from-primary to-secondary p-[1.5px]"
          >
            <div className="rounded-2xl bg-white px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-center sm:text-start">
                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-foreground" style={{ fontSize: "16px", fontWeight: 700 }}>
                    {t("عرض سنتين + سنة مجاناً", "2 years + 1 year free")}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                    {t("ادفع 24 شهراً واحصل على 36 شهراً كاملة — يُفعَّل عبر فريق المبيعات", "Pay for 24 months, get a full 36 — activated via our sales team")}
                  </div>
                </div>
              </div>
              <a
                href="mailto:support@entix.io?subject=2Y%2B1Y%20Offer"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-6 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                style={{ fontSize: "14px", fontWeight: 600 }}
              >
                {t("فعّل العرض", "Activate offer")}
              </a>
            </div>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PRICING.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-7 border relative ${
                  plan.highlighted
                    ? "bg-foreground border-foreground text-white shadow-2xl shadow-foreground/20 scale-105 z-10"
                    : "bg-white border-gray-200 hover:border-primary/20 hover:shadow-lg"
                } transition-all`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-l from-primary to-secondary text-white px-4 py-1 rounded-full whitespace-nowrap" style={{ fontSize: "12px", fontWeight: 600 }}>{t("الأكثر شعبية", "Most popular")}</span>
                  </div>
                )}
                <h3 style={{ fontSize: "20px", fontWeight: 600 }} className={plan.highlighted ? "text-white mt-2" : "text-foreground"}>{t(plan.name, plan.nameEn)}</h3>
                <p style={{ fontSize: "13px" }} className={`mt-1 ${plan.highlighted ? "text-muted-foreground" : "text-muted-foreground/60"}`}>{t(plan.desc, plan.descEn)}</p>
                {plan.standard && (
                  <div className="flex items-center gap-2 mt-4" dir="ltr">
                    <span
                      style={{ fontSize: "15px", fontWeight: 500, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", textDecoration: "line-through" }}
                      className={plan.highlighted ? "text-muted-foreground" : "text-muted-foreground/60"}
                    >{plan.standard}</span>
                    <span className="bg-green-50 text-green-700 border border-green-500/30 px-2 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 700 }}>
                      {t("سعر الإطلاق", "Launch price")} −{Math.round((1 - Number(plan.price) / Number(plan.standard)) * 100)}%
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-1 mt-1 mb-1" dir="ltr">
                  <span style={{ fontSize: "40px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }} className={plan.highlighted ? "text-white" : "text-foreground"}>{plan.price}</span>
                </div>
                <p style={{ fontSize: "13px" }} className={plan.highlighted ? "text-muted-foreground" : "text-muted-foreground"}>{t(plan.period, plan.periodEn)}</p>
                {plan.standard && (
                  <p className="text-green-600 mt-1" style={{ fontSize: "12px", fontWeight: 600 }}>{t("+ شهرك الأول مجاناً", "+ your first month free")}</p>
                )}
                <hr className={`my-6 ${plan.highlighted ? "border-white/10" : "border-gray-100"}`} />
                <ul className="space-y-3">
                  {plan.features.map((f, fi) => {
                    const isZatcaValidation = /ZATCA Phase 2/i.test(f);
                    return (
                      <li key={f} data-plan-zatca-state={isZatcaValidation ? "under-validation" : undefined} className="flex items-center gap-2.5" style={{ fontSize: "14px" }}>
                        {isZatcaValidation ? (
                          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                        ) : (
                          <CheckCircle2 className={plan.highlighted ? "h-4 w-4 flex-shrink-0 text-secondary" : "h-4 w-4 flex-shrink-0 text-green-500"} />
                        )}
                        <span className={isZatcaValidation ? "text-amber-300" : plan.highlighted ? "text-gray-300" : "text-muted-foreground"}>{t(f, plan.featuresEn[fi])}</span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => navigate("/register")}
                  className={
                    plan.highlighted
                      ? "w-full mt-7 py-3 rounded-xl transition-all cursor-pointer bg-primary hover:bg-primary/80 text-white hover:shadow-lg"
                      : "w-full mt-7 py-3 rounded-xl transition-all cursor-pointer bg-primary/5 hover:bg-primary hover:text-white text-primary"
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
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-4xl mx-auto mt-10 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 text-center sm:text-start">
              <div className="w-11 h-11 rounded-xl bg-white border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-foreground" style={{ fontSize: "15px", fontWeight: 700 }}>
                  {t("برنامج الإحالة: صديقك يحصل على خصم، وأنت على عمولة 50%", "Referral program: your friend gets a discount, you earn 50% commission")}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                  {t("شارك كودك — يحصل المشترك الجديد على خصم، وتُحوَّل لك عمولتك كمسوّق معتمد", "Share your code — new subscribers get a discount, and you earn as an approved marketer")}
                </div>
              </div>
            </div>
            <Link
              to="/referrals"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("صفحة الإحالات", "Referrals page")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="bg-gradient-to-br from-foreground via-foreground to-primary rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden"
          >
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
            
            <div className="relative z-10">
              <h2 className="text-white mb-4" style={{ fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 700, lineHeight: 1.3 }}>
                {t("جاهز لتحويل إدارتك المالية؟", "Ready to modernize your financial operations?")}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8" style={{ fontSize: "16px", lineHeight: 1.8 }}>
                {t(
                  "ENTIX.IO في مرحلة الإطلاق التجريبي — كن من الداعمين الأوائل وأدر فواتيرك ومصاريفك وتقاريرك بكفاءة وأمان.",
                  "Use ENTIX.IO to manage accounting, invoices, expenses, and reports with a cleaner bilingual workflow."
                )}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button 
                  onClick={() => navigate("/register")}
                  className="bg-white hover:bg-gray-50 text-foreground px-8 py-3.5 rounded-xl transition-all hover:shadow-xl flex items-center gap-2 cursor-pointer"
                  style={{ fontSize: "15px", fontWeight: 600 }}
                >
                  {t("ابدأ شهرك المجاني", "Start your free month")}
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-20 sm:py-24 bg-muted/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-primary/5 text-primary px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("مساعدة", "Help")}</span>
            <h2 className="text-foreground mb-3" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("الأسئلة الشائعة", "Frequently asked questions")}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-primary/20 transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-start hover:bg-gray-50/50 transition-colors cursor-pointer"
                >
                  <span className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>{faq.q}</span>
                  <ChevronDown 
                    className={
                      openFaq === i 
                        ? "w-5 h-5 text-muted-foreground flex-shrink-0 ms-3 transition-transform duration-300 rotate-180"
                        : "w-5 h-5 text-muted-foreground flex-shrink-0 ms-3 transition-transform duration-300"
                    } 
                  />
                </button>
                <div 
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: openFaq === i ? "200px" : "0px", opacity: openFaq === i ? 1 : 0 }}
                >
                  <div className="px-5 pb-5">
                    <p className="text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.9 }}>{faq.a}</p>
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
