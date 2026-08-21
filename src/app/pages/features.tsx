import { motion } from "motion/react";
import {
  FileText, BarChart3, Shield, Globe, Cloud, Receipt,
  Calculator, TrendingUp, CheckCircle2, Users,
  Sparkles, ArrowLeft, Eye, Download, Share2,
  DollarSign, Calendar
} from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { EntixWordmark } from "../components/entix-brand";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useLanguage } from "../components/LanguageContext";

export function Features() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("invoices");

  const features = [
    {
      icon: FileText,
      title: t("ZATCA Phase 2 — قيد التحقق", "ZATCA Phase 2 — under validation"),
      desc: t("تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.", "ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance."),
      color: "#0B1B49",
      details: [
        t("حالة التكامل: قيد التحقق الفني والتنظيمي", "Integration status: under technical and regulatory validation"),
        t("توليد QR يحتوي بيانات الفاتورة الأساسية", "QR generation with core invoice data"),
        t("غير مفعّل للاعتماد الإنتاجي", "Not enabled for production reliance"),
        t("قوالب فواتير قابلة للتخصيص بالكامل", "Fully customizable invoice templates"),
        t("إرسال الفواتير عبر البريد الإلكتروني و WhatsApp", "Send invoices via email and WhatsApp"),
        t("دعم الفواتير المبسطة والضريبية", "Simplified and tax invoice support"),
      ]
    },
    {
      icon: BarChart3,
      title: t("تقارير مالية متقدمة", "Advanced financial reports"),
      desc: t("لوحة تحكم شاملة مع تقارير تفصيلية ورسوم بيانية تفاعلية لمتابعة أداء أعمالك", "A comprehensive dashboard with detailed reports and interactive charts to track your business performance"),
      color: "#1276E3",
      details: [
        t("تقرير الأرباح والخسائر التفصيلي", "Detailed profit & loss report"),
        t("الميزانية العمومية", "Balance sheet"),
        t("تقرير التدفقات النقدية", "Cash flow statement"),
        t("تقارير الضرائب جاهزة للتقديم", "Filing-ready tax reports"),
        t("تحليل المبيعات والمشتريات", "Sales and purchases analysis"),
        t("مقارنات بين الفترات الزمنية", "Period-over-period comparisons"),
      ]
    },
    {
      icon: Shield,
      title: t("أمان وحماية متقدمة", "Advanced security"),
      desc: t("تشفير أثناء النقل وجلسات آمنة ونسخ احتياطي يومي لبياناتك المالية", "Encryption in transit, secure sessions, and daily backups for your financial data"),
      color: "#059669",
      details: [
        t("تشفير الاتصال عبر TLS", "TLS connection encryption"),
        t("جلسات آمنة بكوكي HttpOnly مشفّرة", "Secure sessions with encrypted HttpOnly cookies"),
        t("مدفوعات عبر Stripe — لا تُحفظ بيانات البطاقات لدينا", "Payments via Stripe — card data is never stored with us"),
        t("صلاحيات وصول حسب أدوار المستخدمين", "Role-based access permissions"),
        t("سجل نشاط للعمليات (Activity Log)", "Activity log for operations"),
        t("نسخ احتياطي يومي تلقائي", "Automatic daily backups"),
      ]
    },
    {
      icon: Cloud,
      title: t("نسخ احتياطي واستمرارية", "Backups & continuity"),
      desc: t("نسخ احتياطي يومي تلقائي مع احتفاظ 14 يومًا — بياناتك آمنة وقابلة للتصدير", "Automatic daily backups with 14-day retention — your data is safe and exportable"),
      color: "#349FC4",
      details: [
        t("نسخ احتياطي يومي تلقائي", "Automatic daily backups"),
        t("احتفاظ بالنسخ 14 يومًا", "14-day backup retention"),
        t("تصدير بياناتك كاملة في أي وقت", "Export all your data anytime"),
        t("بياناتك ملكك — حذف عند الطلب", "Your data is yours — deletion on request"),
        t("سجل نشاط للعمليات", "Operations activity log"),
        t("وصول من أي جهاز ومتصفح", "Access from any device and browser"),
      ]
    },
    {
      icon: Globe,
      title: t("دعم متعدد اللغات والعملات", "Multi-language & multi-currency"),
      desc: t("واجهة عربية كاملة مع دعم RTL والعملات المتعددة وأسعار الصرف", "Full Arabic interface with RTL support, multiple currencies, and exchange rates"),
      color: "#8B5CF6",
      details: [
        t("واجهة عربية RTL احترافية", "Professional Arabic RTL interface"),
        t("واجهة إنجليزية كاملة LTR", "Full English LTR interface"),
        t("عملات متعددة (SAR · USD وغيرها)", "Multiple currencies (SAR · USD and more)"),
        t("أسعار صرف محدّثة", "Up-to-date exchange rates"),
        t("فواتير بالعربية والإنجليزية", "Invoices in Arabic and English"),
        t("أرقام بصيغة عربية وإنجليزية", "Numbers in Arabic and English formats"),
      ]
    },
    {
      icon: Receipt,
      title: t("إدارة المصروفات والمشتريات", "Expense & purchase management"),
      desc: t("تتبع دقيق للمصروفات مع تصنيف تلقائي ومراكز تكلفة ومشاريع", "Precise expense tracking with automatic categorization, cost centers, and projects"),
      color: "#EF4444",
      details: [
        t("تسجيل المصروفات بالكاميرا", "Capture expenses with the camera"),
        t("تصنيف تلقائي ذكي", "Smart automatic categorization"),
        t("ربط بمراكز التكلفة والمشاريع", "Link to cost centers and projects"),
        t("موافقات متعددة المستويات", "Multi-level approvals"),
        t("تقارير تفصيلية بالمصروفات", "Detailed expense reports"),
        t("تنبيهات تجاوز الميزانية", "Budget overrun alerts"),
      ]
    },
    {
      icon: Calculator,
      title: t("ضريبة القيمة المضافة", "Value-added tax"),
      desc: t("حساب تلقائي للضريبة مع تقارير جاهزة للتقديم لهيئة الزكاة والضريبة", "Automatic tax calculation with filing-ready reports"),
      color: "#F59E0B",
      details: [
        t("حساب تلقائي لضريبة القيمة المضافة", "Automatic VAT calculation"),
        t("دعم نسب ضريبية متعددة", "Multiple tax-rate support"),
        t("تقرير الضريبة المستحقة", "Tax due report"),
        t("تقرير المشتريات الخاضعة للضريبة", "Taxable purchases report"),
        t("تقرير المبيعات الخاضعة للضريبة", "Taxable sales report"),
        t("تصدير تقارير جاهزة للتقديم", "Export filing-ready reports"),
      ]
    },
    {
      icon: TrendingUp,
      title: t("تحليلات ذكية مدعومة بالـ AI", "AI-powered smart analytics"),
      desc: t("تنبؤات مالية وتوصيات ذكية لتحسين الأداء المالي لأعمالك", "Financial forecasts and smart recommendations to improve your business performance"),
      color: "#06B6D4",
      details: [
        t("تنبؤ بالتدفقات النقدية", "Cash flow forecasting"),
        t("توصيات لتحسين الأرباح", "Profit improvement recommendations"),
        t("تحليل اتجاهات المبيعات", "Sales trend analysis"),
        t("كشف الشذوذ في المعاملات", "Transaction anomaly detection"),
        t("توقعات الإيرادات الشهرية", "Monthly revenue forecasts"),
        t("تحليل سلوك العملاء", "Customer behavior analysis"),
      ]
    },
    {
      icon: Users,
      title: t("إدارة العملاء والموردين", "Customer & vendor management"),
      desc: t("قاعدة بيانات شاملة للعملاء والموردين مع تتبع المعاملات والأرصدة", "A comprehensive customer and vendor database with transaction and balance tracking"),
      color: "#10B981",
      details: [
        t("ملفات تفصيلية للعملاء والموردين", "Detailed customer and vendor profiles"),
        t("تتبع الأرصدة والمديونيات", "Balance and receivables tracking"),
        t("سجل كامل للمعاملات", "Full transaction history"),
        t("إشعارات تذكير بالمستحقات", "Due-amount reminder notifications"),
        t("تقارير تحليلية بالعملاء", "Customer analytics reports"),
        t("تصنيفات وفئات مخصصة", "Custom tags and categories"),
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
            <EntixWordmark size={30} />
          </div>
          <p className="text-muted-foreground text-sm">{t("الرياض، المملكة العربية السعودية", "Riyadh, Saudi Arabia")}</p>
          <p className="text-muted-foreground text-sm" dir="ltr">+966 800 430 088</p>
        </div>
        <div className="text-left">
          <h3 className="text-foreground text-2xl font-bold mb-2">{t("فاتورة ضريبية", "Tax Invoice")}</h3>
          <p className="text-muted-foreground text-sm">{t("رقم:", "No:")} INV-2026-001</p>
          <p className="text-muted-foreground text-sm">{t("التاريخ: 18 مارس 2026", "Date: March 18, 2026")}</p>
        </div>
      </div>

      {/* Customer info */}
      <div className="mb-6">
        <p className="text-muted-foreground text-sm mb-1">{t("العميل", "Customer")}</p>
        <p className="text-foreground font-semibold">{t("شركة التقنية المتقدمة", "Advanced Technology Co.")}</p>
        <p className="text-muted-foreground text-sm">{t("الرقم الضريبي:", "VAT No.:")} 300123456789003</p>
      </div>

      {/* Items table */}
      <div className="mb-6">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-right p-3 text-foreground/80 text-sm font-semibold">{t("البند", "Item")}</th>
              <th className="text-center p-3 text-foreground/80 text-sm font-semibold">{t("الكمية", "Qty")}</th>
              <th className="text-center p-3 text-foreground/80 text-sm font-semibold">{t("السعر", "Price")}</th>
              <th className="text-left p-3 text-foreground/80 text-sm font-semibold">{t("المجموع", "Amount")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="p-3 text-foreground">{t("خدمات استشارية محاسبية", "Accounting consulting services")}</td>
              <td className="text-center p-3 text-muted-foreground" dir="ltr">10</td>
              <td className="text-center p-3 text-muted-foreground" dir="ltr">500.00</td>
              <td className="text-left p-3 text-foreground" dir="ltr">5,000.00</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-3 text-foreground">{t("تدريب على الأنظمة المالية", "Financial systems training")}</td>
              <td className="text-center p-3 text-muted-foreground" dir="ltr">5</td>
              <td className="text-center p-3 text-muted-foreground" dir="ltr">300.00</td>
              <td className="text-left p-3 text-foreground" dir="ltr">1,500.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("المجموع الفرعي", "Subtotal")}</span>
            <span className="text-foreground" dir="ltr">6,500.00 SR</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("ضريبة القيمة المضافة (15%)", "VAT (15%)")}</span>
            <span className="text-foreground" dir="ltr">975.00 SR</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-foreground font-bold">{t("الإجمالي", "Total")}</span>
            <span className="text-foreground font-bold text-lg" dir="ltr">7,475.00 SR</span>
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="grid grid-cols-4 gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-foreground' : 'bg-transparent'}`} />
              ))}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>{t("رمز QR للفاتورة", "Invoice QR code")}</p>
            <p className="text-xs">{t("ZATCA Phase 2 — قيد التحقق", "ZATCA Phase 2 — under validation")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <Share2 className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors">
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
      className="bg-gradient-to-br from-foreground to-foreground rounded-2xl shadow-2xl p-6"
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t("الإيرادات", "Revenue"), value: "245,000", change: "+12.5%", icon: TrendingUp, color: "#22C55E" },
          { label: t("المصروفات", "Expenses"), value: "89,500", change: "-3.2%", icon: Receipt, color: "#EF4444" },
          { label: t("صافي الربح", "Net profit"), value: "155,500", change: "+18.7%", icon: DollarSign, color: "#1276E3" },
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
            <p className="text-white text-xl font-bold" dir="ltr">{stat.value} SR</p>
          </div>
        ))}
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-semibold">{t("المبيعات الشهرية", "Monthly sales")}</h4>
          <Calendar className="w-4 h-4 text-white/60" />
        </div>
        <div className="h-32 flex items-end justify-between gap-2">
          {[45, 60, 55, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((height, i) => (
            <div key={i} className="flex-1 bg-gradient-to-t from-primary to-secondary rounded-t-lg transition-all hover:opacity-80" 
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
      <main>

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-foreground via-foreground to-primary text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("مميزات متقدمة لإدارة مالية احترافية", "Advanced features for professional financial management")}</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              {t("كل ما تحتاجه لإدارة", "Everything you need to manage")}
              <br />
              <span className="bg-gradient-to-l from-secondary to-sky-400 bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                {t("حساباتك بذكاء", "your books smarter")}
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8" style={{ lineHeight: 1.8 }}>
              {t("اكتشف مجموعة شاملة من الأدوات المحاسبية المتقدمة المصممة خصيصاً لتبسيط عملك وزيادة إنتاجيتك وتحسين أدائك المالي", "Discover a comprehensive set of advanced accounting tools designed to simplify your work, boost productivity, and improve your financial performance")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-white hover:bg-gray-50 text-foreground px-8 py-3.5 rounded-xl transition-all hover:shadow-xl flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("ابدأ شهرك المجاني", "Start your free month")}
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate("/pricing")}
                className="border border-white/30 hover:border-white/50 hover:bg-white/10 text-white px-8 py-3.5 rounded-xl transition-all cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                {t("شاهد الأسعار", "See pricing")}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Mockups Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              {t("شاهد النظام في العمل", "See the system in action")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              {t("واجهات احترافية سهلة الاستخدام مصممة لتوفير أفضل تجربة محاسبية", "Professional, easy-to-use interfaces designed for the best accounting experience")}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {[
              { id: "invoices", label: t("الفواتير", "Invoices"), icon: FileText },
              { id: "dashboard", label: t("لوحة التحكم", "Dashboard"), icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "bg-white text-muted-foreground hover:bg-gray-50 border border-gray-200"
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
            <h2 className="text-foreground mb-4" style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700 }}>
              {t("مميزات شاملة ومتكاملة", "Complete, integrated features")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              {t("نظام محاسبي متكامل يغطي جميع احتياجاتك المالية والإدارية", "An integrated accounting system covering all your financial and administrative needs")}
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
                <h3 className="text-foreground mb-3" style={{ fontSize: "18px", fontWeight: 600 }}>
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mb-4" style={{ fontSize: "14px", lineHeight: 1.7 }}>
                  {feature.desc}
                </p>
                <ul className="space-y-2">
                  {feature.details.slice(0, 4).map((detail) => (
                    <li key={detail} className="flex items-start gap-2 text-muted-foreground" style={{ fontSize: "13px" }}>
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-foreground to-primary">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-white mb-6" style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, lineHeight: 1.3 }}>
              {t("جاهز لتجربة أفضل نظام محاسبي؟", "Ready to try a better accounting system?")}
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto" style={{ lineHeight: 1.8 }}>
              {t("ابدأ اليوم واكتشف كيف يمكن لـ ENTIX.IO تحويل طريقة إدارتك لحساباتك المالية", "Start today and discover how ENTIX.IO can transform the way you manage your finances")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-white hover:bg-gray-50 text-foreground px-8 py-4 rounded-xl transition-all hover:shadow-2xl flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "16px", fontWeight: 600 }}
              >
                {t("ابدأ شهرك المجاني — 30 يومًا كاملة", "Start your free month — 30 full days")}
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 mt-4 text-sm">{t("لا حاجة لبطاقة ائتمانية • إلغاء في أي وقت", "No credit card required • Cancel anytime")}</p>
          </motion.div>
        </div>
      </section>
      </main>


      <SharedFooter />
    </div>
  );
}
