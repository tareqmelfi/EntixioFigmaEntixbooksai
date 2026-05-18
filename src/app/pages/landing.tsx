import { useNavigate } from "react-router";
import { 
  Shield, BarChart3, Globe, Zap, Cloud, Smartphone, 
  FileText, Users, ArrowLeft, CheckCircle2, ChevronDown,
  Database, Wifi, WifiOff, Server, Menu, X,
  Receipt, Calculator, TrendingUp, Clock, Play, Sparkles
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import Balancer from "react-wrap-balancer";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { authStore } from "../components/auth-store";
import { Hero3DBackground } from "../components/hero-3d-background";
import { InteractiveDashboard3D } from "../components/interactive-dashboard-3d";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";

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

const FEATURES = [
  { icon: FileText, title: "فواتير احترافية", titleEn: "Professional invoices", desc: "إنشاء وإدارة الفواتير بمعايير ZATCA مع QR Code وتوقيع رقمي", descEn: "Create and manage ZATCA-ready invoices with QR codes and digital signatures." },
  { icon: BarChart3, title: "تقارير مالية متقدمة", titleEn: "Advanced financial reports", desc: "لوحة تحكم شاملة مع رسوم بيانية تفاعلية ومؤشرات أداء رئيسية", descEn: "A clear dashboard with interactive charts and key financial indicators." },
  { icon: Shield, title: "أمان وموثوقية", titleEn: "Secure and reliable", desc: "تشفير AES-256 وحماية متعددة الطبقات مع نسخ احتياطي تلقائي", descEn: "Layered protection, encrypted storage, and automated backups." },
  { icon: Globe, title: "دعم متعدد اللغات", titleEn: "Arabic and English", desc: "واجهة عربية كاملة RTL مع دعم اللغة الإنجليزية والعملات المتعددة", descEn: "Native Arabic RTL with English LTR support and multi-currency workflows." },
  { icon: Cloud, title: "سحابي + محلي", titleEn: "Cloud + local", desc: "اعمل أونلاين أو أوفلاين مع مزامنة ذكية تلقائية للبيانات", descEn: "Work online or offline with controlled data synchronization." },
  { icon: Smartphone, title: "متوافق مع الجوال", titleEn: "Mobile friendly", desc: "تصميم متجاوب يعمل بسلاسة على جميع الأجهزة والشاشات", descEn: "Responsive screens built for desktop and mobile accounting work." },
  { icon: Receipt, title: "إدارة المصروفات", titleEn: "Expense management", desc: "تتبع المصروفات والمشتريات مع تصنيف تلقائي ومراكز تكلفة", descEn: "Track expenses, purchases, categories, and cost centers." },
  { icon: Calculator, title: "ضريبة القيمة المضافة", titleEn: "VAT handling", desc: "حساب تلقائي للضريبة مع تقارير جاهزة للتقديم لهيئة الزكاة", descEn: "Automated VAT calculations with reports prepared for compliance review." },
  { icon: TrendingUp, title: "تحليلات ذكية", titleEn: "Smart analytics", desc: "تنبؤات مالية مدعومة بالذكاء الاصطناعي مع توصيات لتحسين الأداء", descEn: "AI-assisted financial signals and recommendations for better decisions." },
];

const PRICING = [
  { 
    name: "أساسي", 
    nameEn: "Starter",
    price: "0", 
    period: "مجاني للأبد",
    periodEn: "free forever",
    desc: "للمشاريع الصغيرة والفردية",
    descEn: "For solo operators and small projects",
    features: ["5 فواتير شهرياً", "مستخدم واحد", "تقارير أساسية", "دعم بالبريد"],
    featuresEn: ["5 invoices monthly", "1 user", "Basic reports", "Email support"],
    highlighted: false 
  },
  { 
    name: "احترافي", 
    nameEn: "Professional",
    price: "99", 
    period: "ريال / شهرياً",
    periodEn: "SAR / month",
    desc: "للشركات الصغيرة والمتوسطة",
    descEn: "For small and medium businesses",
    features: ["فواتير غير محدودة", "5 مستخدمين", "تقارير متقدمة", "ZATCA متوافق", "دعم مباشر", "تطبيق جوال"],
    featuresEn: ["Unlimited invoices", "5 users", "Advanced reports", "ZATCA-ready", "Live support", "Mobile app"],
    highlighted: true 
  },
  { 
    name: "مؤسسي", 
    nameEn: "Enterprise",
    price: "299", 
    period: "ريال / شهرياً",
    periodEn: "SAR / month",
    desc: "للمؤسسات الكبيرة",
    descEn: "For larger organizations",
    features: ["كل مميزات الاحترافي", "مستخدمون غير محدودون", "API مفتوح", "سيرفر خاص VPS", "مزامنة محلية", "دعم مخصص 24/7"],
    featuresEn: ["Everything in Professional", "Unlimited users", "Open API", "Private VPS", "Local sync", "Dedicated 24/7 support"],
    highlighted: false 
  },
];

const STATS = [
  { value: 2500, suffix: "+", label: "شركة تستخدم Entix", labelEn: "companies using Entix" },
  { value: 150, suffix: "K+", label: "فاتورة صدرت", labelEn: "invoices issued" },
  { value: 99.9, suffix: "%", label: "وقت التشغيل", labelEn: "uptime" },
  { value: 24, suffix: "/7", label: "دعم فني متواصل", labelEn: "support coverage" },
];

export function Landing() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
    { q: t("هل Entix Books متوافق مع متطلبات الفوترة الإلكترونية في السعودية؟", "Is Entix Books compatible with Saudi e-invoicing requirements?"), a: t("نعم، Entix Books متوافق بالكامل مع المرحلة الثانية من الفوترة الإلكترونية (ZATCA) ويدعم إصدار الفواتير بصيغة XML وQR Code مع التوقيع الرقمي المطلوب.", "Yes. Entix Books is built for ZATCA Phase 2 workflows, including XML, QR code, and digital-signature requirements.") },
    { q: t("هل يمكنني العمل بدون إنترنت؟", "Can I work without internet?"), a: t("نعم، يدعم Entix Books العمل أوفلاين بالكامل. جميع البيانات تُحفظ محلياً على الجهاز وتتم المزامنة تلقائياً عند عودة الاتصال بالإنترنت. يمكنك جدولة المزامنة نهاية اليوم أو القيام بها يدوياً.", "Yes. Entix Books supports offline work, keeps data locally, and syncs when the connection returns.") },
    { q: t("هل يمكن تثبيته على سيرفر خاص؟", "Can it run on a private server?"), a: t("نعم، في الباقة المؤسسية يمكنك تثبيت Entix Books على VPS الخاص بك مع قاعدة بيانات PostgreSQL. تحكم كامل ببياناتك مع إمكانية النسخ الاحتياطي المحلي.", "Yes. Enterprise deployments can run on a private VPS with PostgreSQL, backups, and full data control.") },
    { q: t("كيف يتم تأمين البيانات؟", "How is data secured?"), a: t("نستخدم تشفير AES-256 للبيانات المخزنة وTLS 1.3 للاتصالات. مع نسخ احتياطي يومي تلقائي وإمكانية تصدير البيانات في أي وقت بصيغة JSON.", "Data is protected with encrypted storage, secure transport, automated backups, and export options.") },
    { q: t("هل يدعم العملات المتعددة؟", "Does it support multiple currencies?"), a: t("نعم، يدعم Entix Books الريال السعودي والدولار الأمريكي وأكثر من 50 عملة أخرى مع أسعار صرف محدثة تلقائياً.", "Yes. Entix Books supports SAR, USD, and additional currencies with exchange-rate workflows.") },
  ];

  const handleNavigate = (path: string) => {
    setMobileNav(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-white" dir={language === "ar" ? "rtl" : "ltr"}>
      <SharedNavbar />

      {/* ─── Hero Section ─── */}
      <section className="pt-28 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-gradient-to-l from-[#EFF6FF] to-[#E0F2FE] text-[#1276E3] px-4 py-2 rounded-full mb-6" style={{ fontSize: "13px", fontWeight: 600 }}>
              <Zap className="w-4 h-4" />
              <span>{t("نظام محاسبة سحابي متكامل للسوق السعودي", "Cloud accounting for Saudi businesses")}</span>
            </div>
            <h1 className="text-[#0B1A47] mb-6" style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.2 }}>
              {t("أدر حساباتك المالية", "Run your accounting")}
              <br />
              <span className="bg-gradient-to-l from-[#1276E3] to-[#349FC4] bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>{t("بذكاء وسهولة", "with clarity and control")}</span>
            </h1>
            <p className="text-[#6B7280] mb-8 max-w-lg" style={{ fontSize: "17px", lineHeight: 1.9 }}>
              {t(
                "Entix Books نظام محاسبة سحابي يعمل أونلاين وأوفلاين. متوافق مع ZATCA، يدعم العربية بالكامل، ومصمم لتبسيط عملياتك المالية.",
                "Entix Books is a cloud accounting platform that works online and offline. It supports ZATCA workflows, Arabic RTL, English LTR, and the daily financial operations of growing businesses."
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-[#1276E3] hover:bg-[#0B5FBF] text-white px-8 py-3.5 rounded-xl transition-all hover:shadow-xl hover:shadow-[#1276E3]/25 flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("ابدأ تجربتك المجانية", "Start your free trial")}
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate("/login")}
                className="border-2 border-[#E5E7EB] hover:border-[#1276E3] text-[#0B1A47] px-8 py-3.5 rounded-xl transition-all cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                {t("تسجيل الدخول", "Sign in")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-8">
              {[
                { icon: CheckCircle2, text: t("متوافق مع ZATCA", "ZATCA-ready") },
                { icon: WifiOff, text: t("يعمل أوفلاين", "Offline capable") },
                { icon: Clock, text: t("تجربة مجانية 14 يوم", "14-day free trial") },
              ].map(t => (
                <div key={t.text} className="flex items-center gap-1.5 text-[#6B7280]" style={{ fontSize: "13px", fontWeight: 500 }}>
                  <t.icon className="w-4 h-4 text-[#22C55E]" />
                  {t.text}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Decorative blobs */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#1276E3]/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#349FC4]/10 rounded-full blur-3xl" />
            
            <InteractiveDashboard3D />

            {/* Floating stat cards */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="hidden sm:block absolute -bottom-6 right-4 bg-white rounded-xl shadow-xl border border-gray-100 p-3 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div>
                  <div className="text-[#22C55E]" style={{ fontSize: "13px", fontWeight: 600 }}>+23.5%</div>
                  <div className="text-[#6B7280]" style={{ fontSize: "11px" }}>{t("نمو الإيرادات", "Revenue growth")}</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
              className="hidden sm:block absolute -top-4 left-4 bg-white rounded-xl shadow-xl border border-gray-100 p-3 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1276E3]" />
                </div>
                <div>
                  <div className="text-[#0B1A47]" style={{ fontSize: "13px", fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>1,247</div>
                  <div className="text-[#6B7280]" style={{ fontSize: "11px" }}>{t("فاتورة هذا الشهر", "invoices this month")}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-12 bg-[#0B1A47]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-white mb-1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{t(stat.label, stat.labelEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 sm:py-24 bg-[#FAFBFC] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#EFF6FF] text-[#1276E3] px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("المميزات", "Features")}</span>
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("كل ما تحتاجه في مكان واحد", "Everything your accounting team needs")}</h2>
            <p className="text-[#6B7280] max-w-xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>{t("أدوات محاسبية متكاملة مصممة لتسهيل عملك اليومي وتحسين أداءك المالي", "A practical accounting workspace for invoices, reports, expenses, VAT, and financial operations.")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div 
                key={f.title} 
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#1276E3]/20 hover:shadow-xl hover:shadow-[#1276E3]/5 transition-all duration-300 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4 group-hover:bg-[#1276E3] transition-colors duration-300">
                  <f.icon className="w-5 h-5 text-[#1276E3] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "17px", fontWeight: 600 }}>{t(f.title, f.titleEn)}</h3>
                <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.8 }}>{t(f.desc, f.descEn)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Sync Architecture ─── */}
      <section id="sync" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#F0FDF4] text-[#22C55E] px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("بدون إنترنت", "Offline")}</span>
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("يعمل بدون إنترنت", "Works without internet")}</h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.8 }}>
              {t(
                "صُمم Entix Books لحل مشكلة الاتصال في القطاعات المختلفة. اعمل محلياً وزامن بياناتك عند توفر الاتصال.",
                "Entix Books is designed for teams that cannot depend on perfect connectivity. Work locally, then sync when the connection is available."
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { icon: WifiOff, color: "#0B1A47", title: "العمل أوفلاين", titleEn: "Offline work", desc: "جميع البيانات تُحفظ محلياً على الجهاز. لا حاجة لاتصال مستمر بالإنترنت. أدخل فواتيرك وسجل معاملاتك في أي وقت.", descEn: "Keep working locally when the connection drops. Enter invoices and transactions without waiting for the network." },
              { icon: Wifi, color: "#1276E3", title: "مزامنة ذكية", titleEn: "Smart sync", desc: "مزامنة تلقائية نهاية اليوم أو يدوية في أي وقت. حل ذكي للتعارضات مع ضمان عدم فقد أي بيانات.", descEn: "Sync automatically at the end of the day or manually when needed, with controlled conflict handling." },
              { icon: Server, color: "#349FC4", title: "سيرفر خاص VPS", titleEn: "Private VPS", desc: "ثبّت على سيرفرك الخاص مع PostgreSQL. تحكم كامل ببياناتك مع إمكانية النسخ الاحتياطي والتصدير.", descEn: "Run on a private VPS with PostgreSQL, backups, exports, and full control over your data." },
            ].map((item, i) => (
              <motion.div 
                key={item.title}
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.1 }}
                className={`text-center p-8 rounded-2xl bg-gradient-to-b from-[#F8FAFC] to-white border ${i === 1 ? "border-[#1276E3]/20 shadow-xl shadow-[#1276E3]/5 scale-[1.02]" : "border-gray-100"} hover:shadow-lg transition-all`}
              >
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: item.color }}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-[#0B1A47] mb-3" style={{ fontSize: "19px", fontWeight: 600 }}>{t(item.title, item.titleEn)}</h3>
                <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.8 }}>{t(item.desc, item.descEn)}</p>
              </motion.div>
            ))}
          </div>
          
          {/* Architecture diagram */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mt-12 bg-gradient-to-br from-[#0B1A47] to-[#122354] rounded-2xl p-8 sm:p-10"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-6">
              {[
                { icon: Database, label: "PostgreSQL", sub: "قاعدة البيانات", subEn: "database" },
                { icon: Cloud, label: "LocalStorage", sub: "تخزين محلي", subEn: "local storage" },
                { icon: Globe, label: "REST API", sub: "واجهة برمجية", subEn: "API layer" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-3">
                  {i > 0 && <div className="hidden sm:block w-12 h-[2px] bg-[#349FC4]/40 rounded" />}
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <item.icon className="w-5 h-5 text-[#349FC4]" />
                    <div>
                      <div className="text-white" style={{ fontSize: "13px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fontWeight: 600 }}>{item.label}</div>
                      <div className="text-[#94A3B8]" style={{ fontSize: "11px" }}>{t(item.sub, item.subEn)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[#94A3B8] max-w-2xl mx-auto text-center" style={{ fontSize: "14px", lineHeight: 1.8 }}>
              {t(
                "بنية تقنية مرنة تدعم التخزين المحلي والسحابي والسيرفر الخاص، مع إمكانية التبديل بينها بدون تعديل أي كود في التطبيق.",
                "A flexible architecture for local storage, cloud sync, and private server deployments without changing the app workflow."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 sm:py-24 bg-[#FAFBFC] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#FFF7ED] text-[#F59E0B] px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الأسعار", "Pricing")}</span>
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("خطط أسعار مرنة", "Flexible pricing plans")}</h2>
            <p className="text-[#6B7280]" style={{ fontSize: "16px" }}>{t("اختر الخطة المناسبة لحجم أعمالك — يمكنك الترقية في أي وقت", "Choose the plan that fits your business size. You can upgrade at any time.")}</p>
          </div>
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
                    ? "bg-[#0B1A47] border-[#0B1A47] text-white shadow-2xl shadow-[#0B1A47]/20 scale-105 z-10"
                    : "bg-white border-gray-200 hover:border-[#1276E3]/20 hover:shadow-lg"
                } transition-all`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-l from-[#1276E3] to-[#349FC4] text-white px-4 py-1 rounded-full whitespace-nowrap" style={{ fontSize: "12px", fontWeight: 600 }}>{t("الأكثر شعبية", "Most popular")}</span>
                  </div>
                )}
                <h3 style={{ fontSize: "20px", fontWeight: 600 }} className={plan.highlighted ? "text-white mt-2" : "text-[#0B1A47]"}>{t(plan.name, plan.nameEn)}</h3>
                <p style={{ fontSize: "13px" }} className={`mt-1 ${plan.highlighted ? "text-[#94A3B8]" : "text-[#9CA3AF]"}`}>{t(plan.desc, plan.descEn)}</p>
                <div className="flex items-baseline gap-1 mt-4 mb-1" dir="ltr">
                  <span style={{ fontSize: "40px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }} className={plan.highlighted ? "text-white" : "text-[#0B1A47]"}>{plan.price}</span>
                </div>
                <p style={{ fontSize: "13px" }} className={plan.highlighted ? "text-[#94A3B8]" : "text-[#6B7280]"}>{t(plan.period, plan.periodEn)}</p>
                <hr className={`my-6 ${plan.highlighted ? "border-white/10" : "border-gray-100"}`} />
                <ul className="space-y-3">
                  {plan.features.map((f, fi) => (
                    <li key={f} className="flex items-center gap-2.5" style={{ fontSize: "14px" }}>
                      <CheckCircle2 
                        className={
                          plan.highlighted 
                            ? "w-4 h-4 flex-shrink-0 text-[#349FC4]"
                            : "w-4 h-4 flex-shrink-0 text-[#22C55E]"
                        } 
                      />
                      <span className={plan.highlighted ? "text-gray-300" : "text-[#6B7280]"}>{t(f, plan.featuresEn[fi])}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/register")}
                  className={
                    plan.highlighted
                      ? "w-full mt-7 py-3 rounded-xl transition-all cursor-pointer bg-[#1276E3] hover:bg-[#0B5FBF] text-white hover:shadow-lg"
                      : "w-full mt-7 py-3 rounded-xl transition-all cursor-pointer bg-[#F0F7FF] hover:bg-[#1276E3] hover:text-white text-[#1276E3]"
                  }
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {t("ابدأ الآن", "Start now")}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="bg-gradient-to-br from-[#0B1A47] via-[#122354] to-[#1276E3] rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden"
          >
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
            
            <div className="relative z-10">
              <h2 className="text-white mb-4" style={{ fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 700, lineHeight: 1.3 }}>
                {t("جاهز لتحويل إدارتك المالية؟", "Ready to modernize your financial operations?")}
              </h2>
              <p className="text-[#94A3B8] max-w-xl mx-auto mb-8" style={{ fontSize: "16px", lineHeight: 1.8 }}>
                {t(
                  "انضم لآلاف الشركات السعودية التي تثق في Entix Books لإدارة حساباتها بكفاءة وأمان.",
                  "Use Entix Books to manage accounting, invoices, expenses, and reports with a cleaner bilingual workflow."
                )}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button 
                  onClick={() => navigate("/register")}
                  className="bg-white hover:bg-gray-50 text-[#0B1A47] px-8 py-3.5 rounded-xl transition-all hover:shadow-xl flex items-center gap-2 cursor-pointer"
                  style={{ fontSize: "15px", fontWeight: 600 }}
                >
                  {t("ابدأ تجربتك المجانية", "Start your free trial")}
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => navigate("/login")}
                  className="border border-white/20 hover:border-white/40 text-white px-8 py-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  style={{ fontSize: "15px", fontWeight: 500 }}
                >
                  <Play className="w-4 h-4" />
                  {t("شاهد العرض التوضيحي", "Watch demo")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-20 sm:py-24 bg-[#FAFBFC] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-[#F3E8FF] text-[#9333EA] px-4 py-1.5 rounded-full mb-4" style={{ fontSize: "13px", fontWeight: 600 }}>{t("مساعدة", "Help")}</span>
            <h2 className="text-[#0B1A47] mb-3" style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700 }}>{t("الأسئلة الشائعة", "Frequently asked questions")}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#1276E3]/20 transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-start hover:bg-gray-50/50 transition-colors cursor-pointer"
                >
                  <span className="text-[#0B1A47]" style={{ fontSize: "15px", fontWeight: 500 }}>{faq.q}</span>
                  <ChevronDown 
                    className={
                      openFaq === i 
                        ? "w-5 h-5 text-[#6B7280] flex-shrink-0 ms-3 transition-transform duration-300 rotate-180"
                        : "w-5 h-5 text-[#6B7280] flex-shrink-0 ms-3 transition-transform duration-300"
                    } 
                  />
                </button>
                <div 
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: openFaq === i ? "200px" : "0px", opacity: openFaq === i ? 1 : 0 }}
                >
                  <div className="px-5 pb-5">
                    <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.9 }}>{faq.a}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <SharedFooter />
    </div>
  );
}
