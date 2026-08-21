import { motion } from "motion/react";
import {
  Wifi, Database, Shield, Lock, Key, CheckCircle2, FileCheck, Award, Globe, Zap, ArrowLeft, RefreshCw, HardDrive, Fingerprint, Eye, AlertTriangle, Sparkles, GitBranch, Circle, Cloud
} from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useLanguage } from "../components/LanguageContext";

export function Integration() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("sync");

  const sections = [
    { id: "sync", label: t("المزامنة الذكية", "Smart sync"), icon: RefreshCw },
    { id: "compliance", label: t("الالتزام والتوافق", "Compliance"), icon: FileCheck },
    { id: "security", label: t("الأمان والحماية", "Security"), icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />
      <main>

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-foreground via-foreground to-primary text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("ZATCA Phase 2 • قيد التحقق الفني والتنظيمي", "ZATCA Phase 2 • Under technical and regulatory validation")}</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              {t("تكامل سلس وأمان", "Seamless integration and security")}
              <br />
              <span className="bg-gradient-to-l from-secondary to-sky-400 bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                {t("يمكنك الوثوق به", "you can trust")}
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto" style={{ lineHeight: 1.8 }}>
              {t("تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي، مع بنية سحابية محمية بممارسات أمان قياسية", "ZATCA Phase 2 integration is under technical and regulatory validation and not enabled for production reliance, on a cloud architecture protected by standard security practices")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section Tabs */}
      <div className="sticky top-[68px] z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto py-4">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  activeSection === section.id
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "bg-gray-50 text-muted-foreground hover:bg-gray-100"
                }`}
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                <section.icon className="w-4 h-4" />
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sync Section */}
      <section id="sync" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-primary/5 text-primary px-4 py-2 rounded-full mb-4">
              <RefreshCw className="w-4 h-4" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("بنية سحابية موثوقة", "Trusted cloud architecture")}</span>
            </div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              {t("اعمل في أي مكان، في أي وقت", "Work anywhere, anytime")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              {t("نظام سحابي بالكامل — بياناتك محفوظة بأمان ومتاحة من أي جهاز ومتصفح، مع نسخ احتياطي يومي تلقائي", "Fully cloud-based — your data is stored securely and available from any device or browser, with automatic daily backups")}
            </p>
          </motion.div>

          {/* Architecture Diagram */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Cloud,
                title: t("سحابي بالكامل", "Fully cloud"),
                desc: t("لا حاجة لأي تثبيت — افتح المتصفح وابدأ العمل من أي جهاز.", "No installation needed — open the browser and start working from any device."),
                color: "#0B1B49",
                features: [
                  t("وصول من أي جهاز ومتصفح", "Access from any device and browser"),
                  t("تحديثات تلقائية بدون توقف", "Automatic updates with no downtime"),
                  t("واجهة عربية وإنجليزية كاملة", "Full Arabic and English interface"),
                  t("بيانات محدّثة دائمًا لكل فريقك", "Always up-to-date data for your whole team"),
                ]
              },
              {
                icon: Database,
                title: t("نسخ احتياطي يومي", "Daily backups"),
                desc: t("نسخ احتياطي تلقائي كل يوم مع احتفاظ بالنسخ 14 يومًا.", "Automatic backups every day with 14-day retention."),
                color: "#1276E3",
                features: [
                  t("نسخ تلقائي يومي", "Automatic daily copies"),
                  t("احتفاظ 14 يومًا", "14-day retention"),
                  t("استعادة عند الحاجة", "Restore when needed"),
                  t("تصدير كامل في أي وقت", "Full export anytime"),
                ],
                highlighted: true
              },
              {
                icon: Lock,
                title: t("حماية عبر Cloudflare", "Protection via Cloudflare"),
                desc: t("تشفير أثناء النقل وحماية من الهجمات على مستوى الشبكة.", "Encryption in transit and network-level attack protection."),
                color: "#349FC4",
                features: [
                  t("تشفير TLS لكل الاتصالات", "TLS encryption for all connections"),
                  t("حماية DDoS عبر Cloudflare", "DDoS protection via Cloudflare"),
                  t("Turnstile ضد البوتات", "Turnstile bot protection"),
                  t("تحديد معدل الطلبات", "Rate limiting"),
                ]
              },
            ].map((mode, i) => (
              <motion.div
                key={mode.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-8 ${
                  mode.highlighted
                    ? "bg-gradient-to-br from-foreground to-primary text-white shadow-2xl shadow-primary/20 scale-105"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div 
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${
                    mode.highlighted ? "bg-white/20" : ""
                  }`}
                  style={{ backgroundColor: mode.highlighted ? "" : mode.color + "15" }}
                >
                  <mode.icon 
                    className="w-7 h-7" 
                    style={{ color: mode.highlighted ? "#fff" : mode.color }} 
                  />
                </div>
                <h3 
                  className={`mb-3 ${mode.highlighted ? "text-white" : "text-foreground"}`}
                  style={{ fontSize: "19px", fontWeight: 600 }}
                >
                  {mode.title}
                </h3>
                <p 
                  className={`mb-5 ${mode.highlighted ? "text-white/80" : "text-muted-foreground"}`}
                  style={{ fontSize: "14px", lineHeight: 1.7 }}
                >
                  {mode.desc}
                </p>
                <ul className="space-y-2.5">
                  {mode.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2" style={{ fontSize: "13px" }}>
                      <CheckCircle2 
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          mode.highlighted ? "text-sky-400" : "text-green-500"
                        }`} 
                      />
                      <span className={mode.highlighted ? "text-white/90" : "text-muted-foreground"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Sync Flow Diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border border-gray-100"
          >
            <h3 className="text-foreground mb-8 text-center" style={{ fontSize: "22px", fontWeight: 600 }}>
              {t("كيف تعمل المزامنة؟", "How does sync work?")}
            </h3>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { 
                  step: "1", 
                  icon: HardDrive, 
                  title: t("التخزين المحلي", "Local storage"), 
                  desc: t("البيانات محفوظة على جهازك", "Data is stored on your device") 
                },
                { 
                  step: "2", 
                  icon: Wifi, 
                  title: t("الاتصال بالسحابة", "Cloud connection"), 
                  desc: t("اتصال آمن عند توفر الإنترنت", "Secure connection when the internet is available") 
                },
                { 
                  step: "3", 
                  icon: GitBranch, 
                  title: t("حل التعارضات", "Conflict resolution"), 
                  desc: t("مقارنة ذكية للتغييرات", "Smart comparison of changes") 
                },
                { 
                  step: "4", 
                  icon: CheckCircle2, 
                  title: t("اكتمال المزامنة", "Sync complete"), 
                  desc: t("بياناتك محدّثة ومتطابقة", "Your data is updated and identical") 
                },
              ].map((step, i) => (
                <div key={step.step} className="relative">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-foreground text-white flex items-center justify-center" style={{ fontSize: "14px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                      {step.step}
                    </div>
                    <h4 className="text-foreground mb-2" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {step.title}
                    </h4>
                    <p className="text-muted-foreground" style={{ fontSize: "13px" }}>
                      {step.desc}
                    </p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-8 -left-3 w-6 h-0.5 bg-gradient-to-l from-primary to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Compliance Section */}
      <section id="compliance" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-500 px-4 py-2 rounded-full mb-4">
              <FileCheck className="w-4 h-4" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("جاهزية نظامية", "Regulatory readiness")}</span>
            </div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              {t("مصمم لدعم المتطلبات النظامية", "Designed to support regulatory requirements")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              {t("تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.", "ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance.")}
            </p>
          </motion.div>

          {/* Compliance Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {[
              {
                icon: Award,
                title: t("ZATCA Phase 2 — قيد التحقق", "ZATCA Phase 2 — under validation"),
                subtitle: t("غير مفعّل للاعتماد الإنتاجي", "Not enabled for production reliance"),
                color: "#F59E0B",
                features: [
                  t("التحقق الفني والتنظيمي مستمر", "Technical and regulatory validation is ongoing"),
                  t("QR محلي يحتوي بيانات الفاتورة الأساسية", "Local QR containing core invoice data"),
                  t("إعداد محلي غير متحقق منه (LOCAL_UNVERIFIED)", "Local unverified setup (LOCAL_UNVERIFIED)"),
                  t("خط الإنتاج غير جاهز (zatca_pipeline_not_ready)", "Production line not ready (zatca_pipeline_not_ready)"),
                ]
              },
              {
                icon: Globe,
                title: t("المعايير الدولية", "International standards"),
                subtitle: t("توافق مع IFRS و GAAP", "IFRS and GAAP alignment"),
                color: "#1276E3",
                features: [
                  t("معايير المحاسبة الدولية IFRS", "International Financial Reporting Standards (IFRS)"),
                  t("مبادئ المحاسبة المقبولة عموماً GAAP", "Generally Accepted Accounting Principles (GAAP)"),
                  t("UBL 2.1 للفواتير الإلكترونية", "UBL 2.1 for electronic invoices"),
                  t("دليل محاسبي قياسي", "Standard chart of accounts"),
                  t("تقارير مالية موحدة", "Standardized financial reports"),
                  t("قواعد الاعتراف بالإيرادات", "Revenue recognition rules"),
                  t("معالجة العملات المتعددة", "Multi-currency handling"),
                  t("دعم السنة المالية المخصصة", "Custom fiscal-year support"),
                ]
              },
            ].map((compliance, i) => (
              <motion.div
                key={compliance.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-8 border-2 shadow-xl"
                style={{ borderColor: compliance.color + "30" }}
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                  style={{ 
                    backgroundColor: compliance.color + "15",
                    boxShadow: `0 8px 20px ${compliance.color}20`
                  }}
                >
                  <compliance.icon className="w-7 h-7" style={{ color: compliance.color }} />
                </div>
                <h3 className="text-foreground mb-1" style={{ fontSize: "22px", fontWeight: 700 }}>
                  {compliance.title}
                </h3>
                <p className="text-muted-foreground mb-6" style={{ fontSize: "14px" }}>
                  {compliance.subtitle}
                </p>
                <ul className="space-y-3">
                  {compliance.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5" style={{ fontSize: "14px" }}>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: compliance.color }} />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Compliance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "Phase 2", label: t("قيد التحقق الفني والتنظيمي", "Under technical and regulatory validation"), icon: Award },
              { value: t("محلي", "Local"), label: t("إعداد غير متحقق منه", "Unverified setup"), icon: Lock },
              { value: t("يوميًا", "Daily"), label: t("نسخ احتياطي تلقائي", "Automatic backups"), icon: Eye },
              { value: "AR + EN", label: t("واجهة ثنائية اللغة", "Bilingual interface"), icon: Zap },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl p-6 text-center border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <div className="text-foreground mb-1" style={{ fontSize: "28px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                  {stat.value}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-500 px-4 py-2 rounded-full mb-4">
              <Shield className="w-4 h-4" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("أمان متقدم", "Advanced security")}</span>
            </div>
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              {t("حماية بممارسات قياسية", "Protection with standard practices")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              {t("بياناتك المالية محمية بتشفير أثناء النقل، ونسخ احتياطي يومي تلقائي، وجلسات آمنة مشفّرة", "Your financial data is protected with encryption in transit, automatic daily backups, and encrypted secure sessions")}
            </p>
          </motion.div>

          {/* Security Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                icon: Lock,
                title: t("تشفير متقدم", "Advanced encryption"),
                color: "#EF4444",
                features: [
                  t("تشفير AES-256-GCM لمفاتيح التكامل", "AES-256-GCM encryption for integration keys"),
                  t("تشفير الاتصال عبر TLS", "TLS connection encryption"),
                  t("كلمات المرور مُجزّأة ولا تُحفظ نصيًا", "Passwords are hashed and never stored in plain text"),
                  t("بيانات البطاقات عبر Stripe فقط — لا تمر بسيرفراتنا", "Card data goes through Stripe only — never touches our servers"),
                ]
              },
              {
                icon: Key,
                title: t("التحكم بالوصول", "Access control"),
                color: "#F59E0B",
                features: [
                  t("صلاحيات حسب أدوار المستخدمين", "Role-based user permissions"),
                  t("جلسات آمنة محدودة المدة بكوكي HttpOnly", "Time-limited secure sessions with HttpOnly cookies"),
                  t("عزل كامل لبيانات كل منشأة", "Full data isolation per organization"),
                  t("إدارة الأعضاء والصلاحيات من الإعدادات", "Member and permission management from Settings"),
                ]
              },
              {
                icon: Eye,
                title: t("المراقبة والتدقيق", "Monitoring & audit"),
                color: "#8B5CF6",
                features: [
                  t("سجل نشاط لعمليات المنشأة", "Activity log for organization operations"),
                  t("سجل استخدام AI بالتكلفة لكل عملية", "AI usage log with per-operation cost"),
                  t("تتبع حالة الفوترة الإلكترونية لكل فاتورة", "E-invoicing status tracking per invoice"),
                  t("سجلات نظام مركزية على الخادم", "Centralized server system logs"),
                ]
              },
              {
                icon: Database,
                title: t("النسخ الاحتياطي", "Backups"),
                color: "#06B6D4",
                features: [
                  t("نسخ احتياطي يومي تلقائي", "Automatic daily backups"),
                  t("احتفاظ بالنسخ 14 يومًا", "14-day backup retention"),
                  t("نسخ مؤرشفة قابلة للاستعادة عند الحاجة", "Archived copies restorable when needed"),
                  t("بياناتك قابلة للتصدير في أي وقت", "Your data is exportable at any time"),
                ]
              },
              {
                icon: Fingerprint,
                title: t("الخصوصية", "Privacy"),
                color: "#10B981",
                features: [
                  t("بياناتك ملكك — لا نبيعها ولا نشاركها", "Your data is yours — we never sell or share it"),
                  t("إخفاء الأسرار والمفاتيح في الواجهة", "Secrets and keys are masked in the UI"),
                  t("سياسة خصوصية منشورة وواضحة", "A clear, published privacy policy"),
                  t("حقك في حذف حسابك وبياناتك", "Your right to delete your account and data"),
                ]
              },
              {
                icon: AlertTriangle,
                title: t("بنية تحتية محمية", "Protected infrastructure"),
                color: "#F97316",
                features: [
                  t("حماية DDoS عبر Cloudflare", "DDoS protection via Cloudflare"),
                  t("تحديد معدل الطلبات ضد التخمين", "Rate limiting against guessing attacks"),
                  t("Cloudflare Turnstile ضد البوتات", "Cloudflare Turnstile bot protection"),
                  t("تحديثات أمنية مستمرة للمنصة", "Continuous platform security updates"),
                ]
              },
            ].map((security, i) => (
              <motion.div
                key={security.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all group"
              >
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: security.color + "15" }}
                >
                  <security.icon className="w-6 h-6" style={{ color: security.color }} />
                </div>
                <h3 className="text-foreground mb-4" style={{ fontSize: "17px", fontWeight: 600 }}>
                  {security.title}
                </h3>
                <ul className="space-y-2">
                  {security.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-muted-foreground" style={{ fontSize: "13px" }}>
                      <Circle className="w-1.5 h-1.5 flex-shrink-0 mt-1.5" style={{ fill: security.color }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Security Certifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-foreground to-primary rounded-2xl p-10 text-center text-white"
          >
            <h3 className="text-white mb-6" style={{ fontSize: "24px", fontWeight: 700 }}>
              {t("ممارسات الأمان لدينا", "Our security practices")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {["تشفير TLS أثناء النقل", t("نسخ احتياطي يومي تلقائي", "Automatic daily backups"), "جلسات HttpOnly مشفّرة"].map((cert) => (
                <div key={cert} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-colors">
                  <Award className="w-10 h-10 mx-auto mb-3 text-sky-400" />
                  <div className="text-white" style={{ fontSize: "15px", fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                    {cert}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-foreground mb-6" style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700 }}>
              {t("بياناتك محمية وملكك دائمًا", "Your data is protected and always yours")}
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto" style={{ lineHeight: 1.8 }}>
              {t("نطبّق ممارسات حماية قياسية — تشفير أثناء النقل، نسخ احتياطي يومي، وجلسات آمنة — وتصدّر بياناتك كاملة متى شئت", "We apply standard protection practices — encryption in transit, daily backups, and secure sessions — and you can export all your data anytime")}
            </p>
            <button 
              onClick={() => navigate("/register")}
              className="bg-primary hover:bg-primary/80 text-white px-8 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-primary/25 flex items-center gap-2 mx-auto cursor-pointer"
              style={{ fontSize: "16px", fontWeight: 600 }}
            >
              {t("ابدأ تجربتك المجانية", "Start your free trial")}
              <ArrowLeft className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>
      </main>


      <SharedFooter />
    </div>
  );
}
