import { motion } from "motion/react";
import {
  Cloud, Wifi, WifiOff, Server, Database, Shield, Lock, Key,
  CheckCircle2, FileCheck, Award, Globe, Zap, ArrowLeft,
  Clock, RefreshCw, HardDrive, Smartphone, Laptop, Fingerprint,
  Eye, AlertTriangle, FileText, Sparkles, GitBranch, Circle
} from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useState } from "react";
import { useNavigate } from "react-router";

export function Integration() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("sync");

  const sections = [
    { id: "sync", label: "المزامنة الذكية", icon: RefreshCw },
    { id: "compliance", label: "الالتزام والتوافق", icon: FileCheck },
    { id: "security", label: "الأمان والحماية", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1A47] via-[#122354] to-[#1276E3] text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#349FC4]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#1276E3]/20 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-[#349FC4]" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>تقنية متقدمة • أمان عالي • توافق كامل</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              تكامل سلس وأمان
              <br />
              <span className="bg-gradient-to-l from-[#349FC4] to-[#60A5FA] bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                من الدرجة المصرفية
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto" style={{ lineHeight: 1.8 }}>
              نظام متكامل يعمل أونلاين وأوفلاين مع مزامنة ذكية، متوافق بالكامل مع المتطلبات القانونية،
              ومحمي بأعلى معايير الأمان العالمية
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
                    ? "bg-[#1276E3] text-white shadow-lg shadow-[#1276E3]/25"
                    : "bg-gray-50 text-[#6B7280] hover:bg-gray-100"
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
            <div className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#1276E3] px-4 py-2 rounded-full mb-4">
              <RefreshCw className="w-4 h-4" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>مزامنة ذكية</span>
            </div>
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              اعمل في أي مكان، في أي وقت
            </h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              نظام مزامنة متقدم يتيح لك العمل بدون إنترنت مع ضمان تزامن جميع بياناتك تلقائياً
            </p>
          </motion.div>

          {/* Architecture Diagram */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: WifiOff,
                title: "العمل أوفلاين",
                desc: "استمر في العمل حتى بدون إنترنت. جميع البيانات محفوظة محلياً على جهازك.",
                color: "#0B1A47",
                features: [
                  "تخزين محلي آمن بتقنية IndexedDB",
                  "معالجة فورية للمعاملات",
                  "لا حاجة لاتصال مستمر",
                  "قائمة انتظار ذكية للمعاملات",
                ]
              },
              {
                icon: Wifi,
                title: "المزامنة التلقائية",
                desc: "مزامنة ذكية عند توفر الاتصال مع حل تلقائي للتعارضات.",
                color: "#1276E3",
                features: [
                  "مزامنة تلقائية في الخلفية",
                  "جدولة مرنة للمزامنة",
                  "حل ذكي للتعارضات",
                  "إشعارات فورية بحالة المزامنة",
                ],
                highlighted: true
              },
              {
                icon: Server,
                title: "سيرفر خاص VPS",
                desc: "استضافة على سيرفرك الخاص مع تحكم كامل ببياناتك.",
                color: "#349FC4",
                features: [
                  "تثبيت على VPS خاص بك",
                  "قاعدة بيانات PostgreSQL",
                  "نسخ احتياطي محلي",
                  "تحكم كامل بالبيانات",
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
                    ? "bg-gradient-to-br from-[#0B1A47] to-[#1276E3] text-white shadow-2xl shadow-[#1276E3]/20 scale-105"
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
                  className={`mb-3 ${mode.highlighted ? "text-white" : "text-[#0B1A47]"}`}
                  style={{ fontSize: "19px", fontWeight: 600 }}
                >
                  {mode.title}
                </h3>
                <p 
                  className={`mb-5 ${mode.highlighted ? "text-white/80" : "text-[#6B7280]"}`}
                  style={{ fontSize: "14px", lineHeight: 1.7 }}
                >
                  {mode.desc}
                </p>
                <ul className="space-y-2.5">
                  {mode.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2" style={{ fontSize: "13px" }}>
                      <CheckCircle2 
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          mode.highlighted ? "text-[#60A5FA]" : "text-[#22C55E]"
                        }`} 
                      />
                      <span className={mode.highlighted ? "text-white/90" : "text-[#6B7280]"}>
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
            <h3 className="text-[#0B1A47] mb-8 text-center" style={{ fontSize: "22px", fontWeight: 600 }}>
              كيف تعمل المزامنة؟
            </h3>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { 
                  step: "1", 
                  icon: HardDrive, 
                  title: "التخزين المحلي", 
                  desc: "البيانات محفوظة على جهازك" 
                },
                { 
                  step: "2", 
                  icon: Wifi, 
                  title: "الاتصال بالسحابة", 
                  desc: "اتصال آمن عند توفر الإنترنت" 
                },
                { 
                  step: "3", 
                  icon: GitBranch, 
                  title: "حل التعارضات", 
                  desc: "مقارنة ذكية للتغييرات" 
                },
                { 
                  step: "4", 
                  icon: CheckCircle2, 
                  title: "اكتمال المزامنة", 
                  desc: "بياناتك محدّثة ومتطابقة" 
                },
              ].map((step, i) => (
                <div key={step.step} className="relative">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#1276E3] to-[#349FC4] flex items-center justify-center shadow-lg shadow-[#1276E3]/20">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#0B1A47] text-white flex items-center justify-center" style={{ fontSize: "14px", fontWeight: 700, fontFamily: "Inter" }}>
                      {step.step}
                    </div>
                    <h4 className="text-[#0B1A47] mb-2" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {step.title}
                    </h4>
                    <p className="text-[#6B7280]" style={{ fontSize: "13px" }}>
                      {step.desc}
                    </p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-8 -left-3 w-6 h-0.5 bg-gradient-to-l from-[#1276E3] to-transparent" />
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
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] text-[#22C55E] px-4 py-2 rounded-full mb-4">
              <FileCheck className="w-4 h-4" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>التزام كامل</span>
            </div>
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              متوافق مع جميع المتطلبات القانونية
            </h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              نظام مصمم بعناية ليتوافق بالكامل مع متطلبات هيئة الزكاة والضريبة والجمارك ZATCA 
              والمعايير الدولية
            </p>
          </motion.div>

          {/* Compliance Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {[
              {
                icon: Award,
                title: "متوافق مع ZATCA",
                subtitle: "المرحلة الثانية من الفوترة الإلكترونية",
                color: "#22C55E",
                features: [
                  "فواتير بصيغة XML القياسية",
                  "توليد QR Code متوافق",
                  "توقيع رقمي مشفر (Cryptographic Stamp)",
                  "ختم زمني موثوق (Timestamp)",
                  "معرف فريد عالمي UUID",
                  "تشفير بـ ECDSA / SHA-256",
                  "ربط مع منصة فاتورة",
                  "سجل كامل غير قابل للتعديل",
                ]
              },
              {
                icon: Globe,
                title: "المعايير الدولية",
                subtitle: "توافق مع IFRS و GAAP",
                color: "#1276E3",
                features: [
                  "معايير المحاسبة الدولية IFRS",
                  "مبادئ المحاسبة المقبولة عموماً GAAP",
                  "UBL 2.1 للفواتير الإلكترونية",
                  "دليل محاسبي قياسي",
                  "تقارير مالية موحدة",
                  "قواعد الاعتراف بالإيرادات",
                  "معالجة العملات المتعددة",
                  "دعم السنة المالية المخصصة",
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
                <h3 className="text-[#0B1A47] mb-1" style={{ fontSize: "22px", fontWeight: 700 }}>
                  {compliance.title}
                </h3>
                <p className="text-[#6B7280] mb-6" style={{ fontSize: "14px" }}>
                  {compliance.subtitle}
                </p>
                <ul className="space-y-3">
                  {compliance.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5" style={{ fontSize: "14px" }}>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: compliance.color }} />
                      <span className="text-[#374151]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Compliance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "100%", label: "توافق ZATCA", icon: Award },
              { value: "256-bit", label: "تشفير AES", icon: Lock },
              { value: "24/7", label: "مراقبة الأمان", icon: Eye },
              { value: "99.9%", label: "وقت التشغيل", icon: Zap },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl p-6 text-center border border-gray-200 hover:border-[#1276E3]/30 hover:shadow-lg transition-all"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-3 text-[#1276E3]" />
                <div className="text-[#0B1A47] mb-1" style={{ fontSize: "28px", fontWeight: 700, fontFamily: "Inter" }}>
                  {stat.value}
                </div>
                <div className="text-[#6B7280]" style={{ fontSize: "13px" }}>
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
            <div className="inline-flex items-center gap-2 bg-[#FEF2F2] text-[#EF4444] px-4 py-2 rounded-full mb-4">
              <Shield className="w-4 h-4" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>أمان متقدم</span>
            </div>
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              حماية من الدرجة المصرفية
            </h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              بياناتك المالية محمية بأعلى معايير الأمان العالمية مع تشفير متقدم
              وحماية متعددة الطبقات
            </p>
          </motion.div>

          {/* Security Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                icon: Lock,
                title: "تشفير متقدم",
                color: "#EF4444",
                features: [
                  "تشفير AES-256 للبيانات المخزنة",
                  "TLS 1.3 لنقل البيانات",
                  "تشفير End-to-End",
                  "مفاتيح تشفير فريدة لكل عميل",
                ]
              },
              {
                icon: Key,
                title: "التحكم بالوصول",
                color: "#F59E0B",
                features: [
                  "مصادقة ثنائية 2FA",
                  "تسجيل دخول بالبصمة",
                  "صلاحيات متقدمة حسب الدور",
                  "جلسات آمنة محدودة المدة",
                ]
              },
              {
                icon: Eye,
                title: "المراقبة والتدقيق",
                color: "#8B5CF6",
                features: [
                  "سجل كامل لجميع العمليات",
                  "تنبيهات الأنشطة المشبوهة",
                  "مراقبة في الوقت الفعلي",
                  "تقارير أمنية دورية",
                ]
              },
              {
                icon: Database,
                title: "النسخ الاحتياطي",
                color: "#06B6D4",
                features: [
                  "نسخ احتياطي يومي تلقائي",
                  "تشفير النسخ الاحتياطية",
                  "استعادة فورية للبيانات",
                  "حفظ في مواقع متعددة",
                ]
              },
              {
                icon: Fingerprint,
                title: "الخصوصية",
                color: "#10B981",
                features: [
                  "امتثال كامل لـ GDPR",
                  "إخفاء البيانات الحساسة",
                  "سياسة خصوصية شفافة",
                  "حقك في حذف بياناتك",
                ]
              },
              {
                icon: AlertTriangle,
                title: "الحماية من التهديدات",
                color: "#F97316",
                features: [
                  "جدار حماية متقدم",
                  "كشف محاولات الاختراق",
                  "حماية من DDoS",
                  "فحص دوري للثغرات",
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
                <h3 className="text-[#0B1A47] mb-4" style={{ fontSize: "17px", fontWeight: 600 }}>
                  {security.title}
                </h3>
                <ul className="space-y-2">
                  {security.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[#6B7280]" style={{ fontSize: "13px" }}>
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
            className="bg-gradient-to-br from-[#0B1A47] to-[#1276E3] rounded-2xl p-10 text-center text-white"
          >
            <h3 className="text-white mb-6" style={{ fontSize: "24px", fontWeight: 700 }}>
              شهادات الأمان والامتثال
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {["ISO 27001", "SOC 2 Type II", "GDPR", "PCI DSS"].map((cert) => (
                <div key={cert} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-colors">
                  <Award className="w-10 h-10 mx-auto mb-3 text-[#60A5FA]" />
                  <div className="text-white" style={{ fontSize: "15px", fontWeight: 600, fontFamily: "Inter" }}>
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
            <h2 className="text-[#0B1A47] mb-6" style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700 }}>
              بياناتك في أمان تام
            </h2>
            <p className="text-[#6B7280] text-lg mb-8 max-w-2xl mx-auto" style={{ lineHeight: 1.8 }}>
              ابدأ اليوم بثقة تامة في نظام محمي بأعلى معايير الأمان ومتوافق مع جميع المتطلبات القانونية
            </p>
            <button 
              onClick={() => navigate("/register")}
              className="bg-[#1276E3] hover:bg-[#0B5FBF] text-white px-8 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-[#1276E3]/25 flex items-center gap-2 mx-auto cursor-pointer"
              style={{ fontSize: "16px", fontWeight: 600 }}
            >
              ابدأ تجربتك المجانية
              <ArrowLeft className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      <SharedFooter />
    </div>
  );
}
