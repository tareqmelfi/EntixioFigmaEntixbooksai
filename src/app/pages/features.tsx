import { motion } from "motion/react";
import { 
  FileText, BarChart3, Shield, Globe, Cloud, Smartphone, Receipt, 
  Calculator, TrendingUp, Zap, CheckCircle2, Clock, Users, 
  Database, Sparkles, ArrowLeft, Eye, Download, Share2,
  CreditCard, Package, DollarSign, PieChart, Calendar, Bell
} from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { EntixWordmark } from "../components/entix-brand";
import { useState } from "react";
import { useNavigate } from "react-router";

export function Features() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("invoices");

  const features = [
    {
      icon: FileText,
      title: "فواتير إلكترونية متوافقة",
      desc: "إنشاء فواتير احترافية متوافقة بالكامل مع المرحلة الثانية من ZATCA مع QR Code وتوقيع رقمي",
      color: "#0B1A47",
      details: [
        "توافق كامل مع متطلبات هيئة الزكاة والضريبة والجمارك",
        "توليد QR Code تلقائي لكل فاتورة",
        "توقيع رقمي مشفر وختم زمني",
        "قوالب فواتير قابلة للتخصيص بالكامل",
        "إرسال الفواتير عبر البريد الإلكتروني و WhatsApp",
        "دعم الفواتير المبسطة والضريبية",
      ]
    },
    {
      icon: BarChart3,
      title: "تقارير مالية متقدمة",
      desc: "لوحة تحكم شاملة مع تقارير تفصيلية ورسوم بيانية تفاعلية لمتابعة أداء أعمالك",
      color: "#1276E3",
      details: [
        "تقرير الأرباح والخسائر التفصيلي",
        "الميزانية العمومية",
        "تقرير التدفقات النقدية",
        "تقارير الضرائب جاهزة للتقديم",
        "تحليل المبيعات والمشتريات",
        "مقارنات بين الفترات الزمنية",
      ]
    },
    {
      icon: Shield,
      title: "أمان وحماية متقدمة",
      desc: "تشفير من الدرجة المصرفية وحماية متعددة الطبقات لبياناتك المالية الحساسة",
      color: "#059669",
      details: [
        "تشفير AES-256 للبيانات المخزنة",
        "اتصال آمن SSL/TLS 1.3",
        "مصادقة ثنائية 2FA",
        "صلاحيات مستخدمين متقدمة",
        "سجل كامل لجميع العمليات (Audit Trail)",
        "نسخ احتياطي يومي تلقائي",
      ]
    },
    {
      icon: Cloud,
      title: "عمل أونلاين وأوفلاين",
      desc: "استمر في العمل حتى بدون إنترنت مع مزامنة ذكية تلقائية للبيانات",
      color: "#349FC4",
      details: [
        "تخزين محلي كامل على الجهاز",
        "مزامنة تلقائية عند توفر الاتصال",
        "حل ذكي للتعارضات",
        "جدولة المزامنة حسب الحاجة",
        "عرض حالة المزامنة في الوقت الفعلي",
        "دعم العمل من أجهزة متعددة",
      ]
    },
    {
      icon: Globe,
      title: "دعم متعدد اللغات والعملات",
      desc: "واجهة عربية كاملة مع دعم RTL والعملات المتعددة وأسعار الصرف",
      color: "#8B5CF6",
      details: [
        "واجهة عربية RTL احترافية",
        "دعم الإنجليزية والفرنسية",
        "أكثر من 150 عملة",
        "تحديث تلقائي لأسعار الصرف",
        "فواتير متعددة اللغات",
        "تقارير بعدة لغات",
      ]
    },
    {
      icon: Receipt,
      title: "إدارة المصروفات والمشتريات",
      desc: "تتبع دقيق للمصروفات مع تصنيف تلقائي ومراكز تكلفة ومشاريع",
      color: "#EF4444",
      details: [
        "تسجيل المصروفات بالكاميرا",
        "تصنيف تلقائي ذكي",
        "ربط بمراكز التكلفة والمشاريع",
        "موافقات متعددة المستويات",
        "تقارير تفصيلية بالمصروفات",
        "تنبيهات تجاوز الميزانية",
      ]
    },
    {
      icon: Calculator,
      title: "ضريبة القيمة المضافة",
      desc: "حساب تلقائي للضريبة مع تقارير جاهزة للتقديم لهيئة الزكاة والضريبة",
      color: "#F59E0B",
      details: [
        "حساب تلقائي لضريبة القيمة المضافة",
        "دعم نسب ضريبية متعددة",
        "تقرير الضريبة المستحقة",
        "تقرير المشتريات الخاضعة للضريبة",
        "تقرير المبيعات الخاضعة للضريبة",
        "تصدير تقارير جاهزة للتقديم",
      ]
    },
    {
      icon: TrendingUp,
      title: "تحليلات ذكية مدعومة بالـ AI",
      desc: "تنبؤات مالية وتوصيات ذكية لتحسين الأداء المالي لأعمالك",
      color: "#06B6D4",
      details: [
        "تنبؤ بالتدفقات النقدية",
        "توصيات لتحسين الأرباح",
        "تحليل اتجاهات المبيعات",
        "كشف الشذوذ في المعاملات",
        "توقعات الإيرادات الشهرية",
        "تحليل سلوك العملاء",
      ]
    },
    {
      icon: Users,
      title: "إدارة العملاء والموردين",
      desc: "قاعدة بيانات شاملة للعملاء والموردين مع تتبع المعاملات والأرصدة",
      color: "#10B981",
      details: [
        "ملفات تفصيلية للعملاء والموردين",
        "تتبع الأرصدة والمديونيات",
        "سجل كامل للمعاملات",
        "إشعارات تذكير بالمستحقات",
        "تقارير تحليلية بالعملاء",
        "تصنيفات وفئات مخصصة",
      ]
    },
  ];

  // Mock invoice preview
  const InvoiceMockup = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100"
    >
      {/* Invoice Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center mb-2">
            <EntixWordmark size={21} />
          </div>
          <p className="text-[#6B7280] text-sm">الرياض، المملكة العربية السعودية</p>
          <p className="text-[#6B7280] text-sm" dir="ltr">+966 800 430 088</p>
        </div>
        <div className="text-left">
          <h3 className="text-[#0B1A47] text-2xl font-bold mb-2">فاتورة ضريبية</h3>
          <p className="text-[#6B7280] text-sm">رقم: INV-2026-001</p>
          <p className="text-[#6B7280] text-sm">التاريخ: 18 مارس 2026</p>
        </div>
      </div>

      {/* Customer info */}
      <div className="mb-6">
        <p className="text-[#6B7280] text-sm mb-1">العميل</p>
        <p className="text-[#0B1A47] font-semibold">شركة التقنية المتقدمة</p>
        <p className="text-[#6B7280] text-sm">الرقم الضريبي: 300123456789003</p>
      </div>

      {/* Items table */}
      <div className="mb-6">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-right p-3 text-[#374151] text-sm font-semibold">البند</th>
              <th className="text-center p-3 text-[#374151] text-sm font-semibold">الكمية</th>
              <th className="text-center p-3 text-[#374151] text-sm font-semibold">السعر</th>
              <th className="text-left p-3 text-[#374151] text-sm font-semibold">المجموع</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="p-3 text-[#0B1A47]">خدمات استشارية محاسبية</td>
              <td className="text-center p-3 text-[#6B7280]" dir="ltr">10</td>
              <td className="text-center p-3 text-[#6B7280]" dir="ltr">500.00</td>
              <td className="text-left p-3 text-[#0B1A47]" dir="ltr">5,000.00</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-3 text-[#0B1A47]">تدريب على الأنظمة المالية</td>
              <td className="text-center p-3 text-[#6B7280]" dir="ltr">5</td>
              <td className="text-center p-3 text-[#6B7280]" dir="ltr">300.00</td>
              <td className="text-left p-3 text-[#0B1A47]" dir="ltr">1,500.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">المجموع الفرعي</span>
            <span className="text-[#0B1A47]" dir="ltr">6,500.00 SR</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">ضريبة القيمة المضافة (15%)</span>
            <span className="text-[#0B1A47]" dir="ltr">975.00 SR</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-[#0B1A47] font-bold">الإجمالي</span>
            <span className="text-[#0B1A47] font-bold text-lg" dir="ltr">7,475.00 SR</span>
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="grid grid-cols-4 gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-[#0B1A47]' : 'bg-transparent'}`} />
              ))}
            </div>
          </div>
          <div className="text-sm text-[#6B7280]">
            <p>رمز QR للفاتورة</p>
            <p className="text-xs">متوافق مع ZATCA</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <Download className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <Share2 className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button className="p-2.5 bg-[#1276E3] hover:bg-[#0B5FBF] text-white rounded-lg transition-colors">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  // Mock Dashboard
  const DashboardMockup = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#0B1A47] to-[#122354] rounded-2xl shadow-2xl p-6"
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "الإيرادات", value: "245,000", change: "+12.5%", icon: TrendingUp, color: "#22C55E" },
          { label: "المصروفات", value: "89,500", change: "-3.2%", icon: Receipt, color: "#EF4444" },
          { label: "صافي الربح", value: "155,500", change: "+18.7%", icon: DollarSign, color: "#1276E3" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "20" }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <span className="text-white text-xs" style={{ color: stat.change.startsWith('+') ? '#22C55E' : '#EF4444' }}>
                {stat.change}
              </span>
            </div>
            <p className="text-white/60 text-xs mb-1">{stat.label}</p>
            <p className="text-white text-xl font-bold" dir="ltr">{stat.value.toLocaleString("en-US")} SR</p>
          </div>
        ))}
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-semibold">المبيعات الشهرية</h4>
          <Calendar className="w-4 h-4 text-white/60" />
        </div>
        <div className="h-32 flex items-end justify-between gap-2">
          {[45, 60, 55, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((height, i) => (
            <div key={i} className="flex-1 bg-gradient-to-t from-[#1276E3] to-[#349FC4] rounded-t-lg transition-all hover:opacity-80" 
              style={{ height: `${height}%` }} 
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1A47] via-[#122354] to-[#1276E3] text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#1276E3]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#349FC4]/20 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-[#349FC4]" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>مميزات متقدمة لإدارة مالية احترافية</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              كل ما تحتاجه لإدارة
              <br />
              <span className="bg-gradient-to-l from-[#349FC4] to-[#60A5FA] bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                حساباتك بذكاء
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8" style={{ lineHeight: 1.8 }}>
              اكتشف مجموعة شاملة من الأدوات المحاسبية المتقدمة المصممة خصيصاً 
              لتبسيط عملك وزيادة إنتاجيتك وتحسين أدائك المالي
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-white hover:bg-gray-50 text-[#0B1A47] px-8 py-3.5 rounded-xl transition-all hover:shadow-xl flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                ابدأ تجربتك المجانية
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate("/pricing")}
                className="border border-white/30 hover:border-white/50 hover:bg-white/10 text-white px-8 py-3.5 rounded-xl transition-all cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                شاهد الأسعار
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Mockups Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              شاهد النظام في العمل
            </h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              واجهات احترافية سهلة الاستخدام مصممة لتوفير أفضل تجربة محاسبية
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {[
              { id: "invoices", label: "الفواتير", icon: FileText },
              { id: "dashboard", label: "لوحة التحكم", icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#1276E3] text-white shadow-lg shadow-[#1276E3]/25"
                    : "bg-white text-[#6B7280] hover:bg-gray-50 border border-gray-200"
                }`}
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mockup display */}
          <div className="max-w-4xl mx-auto">
            {activeTab === "invoices" && <InvoiceMockup />}
            {activeTab === "dashboard" && <DashboardMockup />}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              مميزات شاملة ومتكاملة
            </h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              نظام محاسبي متكامل يغطي جميع احتياجاتك المالية والإدارية
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 group"
              >
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: feature.color + "15" }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                </div>
                <h3 className="text-[#0B1A47] mb-3" style={{ fontSize: "18px", fontWeight: 600 }}>
                  {feature.title}
                </h3>
                <p className="text-[#6B7280] mb-4" style={{ fontSize: "14px", lineHeight: 1.7 }}>
                  {feature.desc}
                </p>
                <ul className="space-y-2">
                  {feature.details.slice(0, 4).map((detail) => (
                    <li key={detail} className="flex items-start gap-2 text-[#6B7280]" style={{ fontSize: "13px" }}>
                      <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1A47] to-[#1276E3]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-white mb-6" style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, lineHeight: 1.3 }}>
              جاهز لتجربة أفضل نظام محاسبي؟
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto" style={{ lineHeight: 1.8 }}>
              ابدأ اليوم واكتشف كيف يمكن لـ ENTIX.IO تحويل طريقة إدارتك لحساباتك المالية
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-white hover:bg-gray-50 text-[#0B1A47] px-8 py-4 rounded-xl transition-all hover:shadow-2xl flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "16px", fontWeight: 600 }}
              >
                ابدأ تجربتك المجانية — 14 يوم
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 mt-4 text-sm">لا حاجة لبطاقة ائتمانية • إلغاء في أي وقت</p>
          </motion.div>
        </div>
      </section>

      <SharedFooter />
    </div>
  );
}
