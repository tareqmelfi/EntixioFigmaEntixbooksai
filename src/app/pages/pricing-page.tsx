import { motion } from "motion/react";
import { CheckCircle2, X, Sparkles, ArrowLeft, HelpCircle } from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useState } from "react";
import { useNavigate } from "react-router";

export function PricingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showComparison, setShowComparison] = useState(false);

  const plans = [
    {
      name: "أساسي",
      nameEn: "Starter",
      price: { monthly: 0, yearly: 0 },
      desc: "للمشاريع الناشئة والأفراد",
      color: "#6B7280",
      features: {
        invoices: "5 فواتير شهرياً",
        users: "مستخدم واحد",
        reports: "تقارير أساسية",
        storage: "1 جيجا تخزين",
        support: "دعم بالبريد الإلكتروني",
        zatca: true,
        offline: true,
        api: false,
        customization: false,
        multiCurrency: false,
        advanced: false,
      }
    },
    {
      name: "احترافي",
      nameEn: "Professional",
      price: { monthly: 99, yearly: 950 }, // ~20% discount
      desc: "للشركات الصغيرة والمتوسطة",
      color: "#1276E3",
      popular: true,
      features: {
        invoices: "فواتير غير محدودة",
        users: "حتى 5 مستخدمين",
        reports: "تقارير متقدمة + AI",
        storage: "50 جيجا تخزين",
        support: "دعم مباشر",
        zatca: true,
        offline: true,
        api: "Read-only API",
        customization: true,
        multiCurrency: true,
        advanced: true,
      }
    },
    {
      name: "مؤسسي",
      nameEn: "Enterprise",
      price: { monthly: 299, yearly: 2990 }, // ~16% discount
      desc: "للمؤسسات الكبيرة",
      color: "#0B1A47",
      features: {
        invoices: "فواتير غير محدودة",
        users: "مستخدمون غير محدودون",
        reports: "تقارير مخصصة + AI متقدم",
        storage: "تخزين غير محدود",
        support: "دعم مخصص 24/7",
        zatca: true,
        offline: true,
        api: "Full API Access",
        customization: "تخصيص كامل",
        multiCurrency: true,
        advanced: "مميزات مؤسسية متقدمة",
      }
    },
  ];

  const comparisonFeatures = [
    { category: "الفواتير والمبيعات", features: [
      { name: "عدد الفواتير", free: "5 / شهر", pro: "غير محدود", enterprise: "غير محدود" },
      { name: "الفواتير الإلكترونية ZATCA", free: true, pro: true, enterprise: true },
      { name: "QR Code", free: true, pro: true, enterprise: true },
      { name: "عروض الأسعار", free: true, pro: true, enterprise: true },
      { name: "إشعارات دائنة", free: false, pro: true, enterprise: true },
      { name: "الفواتير المتكررة", free: false, pro: true, enterprise: true },
      { name: "قوالب فواتير مخصصة", free: "1", pro: "10", enterprise: "غير محدود" },
    ]},
    { category: "المحاسبة والتقارير", features: [
      { name: "دليل الحسابات", free: "محدود", pro: "كامل", enterprise: "كامل + مخصص" },
      { name: "القيود اليومية", free: false, pro: true, enterprise: true },
      { name: "تقارير الأرباح والخسائر", free: true, pro: true, enterprise: true },
      { name: "الميزانية العمومية", free: false, pro: true, enterprise: true },
      { name: "تقارير الضرائب", free: true, pro: true, enterprise: true },
      { name: "تحليلات AI", free: false, pro: "أساسية", enterprise: "متقدمة" },
      { name: "تقارير مخصصة", free: false, pro: false, enterprise: true },
    ]},
    { category: "المستخدمون والصلاحيات", features: [
      { name: "عدد المستخدمين", free: "1", pro: "5", enterprise: "غير محدود" },
      { name: "الأدوار والصلاحيات", free: false, pro: "3 أدوار", enterprise: "أدوار مخصصة" },
      { name: "سجل العمليات Audit Trail", free: false, pro: "محدود", enterprise: "كامل" },
      { name: "موافقات متعددة المستويات", free: false, pro: false, enterprise: true },
    ]},
    { category: "التكامل والمزامنة", features: [
      { name: "العمل أوفلاين", free: true, pro: true, enterprise: true },
      { name: "المزامنة التلقائية", free: true, pro: true, enterprise: true },
      { name: "API Access", free: false, pro: "Read-only", enterprise: "Full Access" },
      { name: "Webhooks", free: false, pro: false, enterprise: true },
      { name: "سيرفر VPS خاص", free: false, pro: false, enterprise: true },
    ]},
    { category: "الدعم والتدريب", features: [
      { name: "الدعم الفني", free: "بريد", pro: "دردشة", enterprise: "24/7 مخصص" },
      { name: "وقت الاستجابة", free: "48 ساعة", pro: "4 ساعات", enterprise: "1 ساعة" },
      { name: "تدريب مجاني", free: false, pro: "فيديوهات", enterprise: "تدريب مباشر" },
      { name: "مدير حساب مخصص", free: false, pro: false, enterprise: true },
    ]},
  ];

  const faqs = [
    {
      q: "هل يمكنني الترقية أو التخفيض في أي وقت؟",
      a: "نعم، يمكنك تغيير باقتك في أي وقت. عند الترقية، ستدفع الفرق المتناسب للفترة المتبقية. عند التخفيض، سيطبق التغيير في بداية دورة الفوترة التالية."
    },
    {
      q: "ماذا يحدث بعد انتهاء الفترة التجريبية؟",
      a: "بعد انتهاء الـ 14 يوم تجريبية، يمكنك الاستمرار في الباقة المجانية أو الترقية لباقة مدفوعة. لن تفقد أي بيانات في كلتا الحالتين."
    },
    {
      q: "هل الأسعار شاملة ضريبة القيمة المضافة؟",
      a: "الأسعار المعروضة غير شاملة ضريبة القيمة المضافة (15%). سيتم إضافة الضريبة عند الدفع حسب موقعك."
    },
    {
      q: "ما هي طرق الدفع المتاحة؟",
      a: "نقبل جميع البطاقات الائتمانية (Visa, Mastercard, Mada) والدفع عبر Apple Pay. للباقة المؤسسية، نوفر خيار الفواتير الشهرية."
    },
    {
      q: "هل يمكنني استرداد أموالي؟",
      a: "نعم، نوفر ضمان استرداد الأموال لمدة 30 يوم من تاريخ الاشتراك الأول. لا توجد أسئلة معقدة."
    },
  ];

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1A47] via-[#122354] to-[#1276E3] text-white">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-[#349FC4]" />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>أسعار شفافة • بدون رسوم خفية</span>
            </div>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.2 }}>
              اختر الباقة المناسبة
              <br />
              <span className="bg-gradient-to-l from-[#349FC4] to-[#60A5FA] bg-clip-text" style={{ WebkitTextFillColor: "transparent" }}>
                لحجم أعمالك
              </span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8" style={{ lineHeight: 1.8 }}>
              خطط مرنة تنمو معك. ابدأ مجاناً وادفع فقط مقابل ما تحتاجه
            </p>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-6 py-2.5 rounded-xl transition-all cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-white text-[#0B1A47] shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                شهري
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-6 py-2.5 rounded-xl transition-all cursor-pointer relative ${
                  billingCycle === "yearly"
                    ? "bg-white text-[#0B1A47] shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                سنوي
                <span className="absolute -top-2 -left-2 bg-[#22C55E] text-white px-2 py-0.5 rounded-full text-xs">
                  وفّر 20%
                </span>
              </button>
            </div>
            <p className="text-white/60 text-sm">جميع الباقات تأتي مع تجربة مجانية 14 يوم</p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
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
                      الأكثر شعبية ⭐
                    </span>
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "24px", fontWeight: 700 }}>
                    {plan.name}
                  </h3>
                  <p className="text-[#6B7280]" style={{ fontSize: "14px" }}>
                    {plan.desc}
                  </p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2 mb-2" dir="ltr">
                    <span className="text-[#0B1A47]" style={{ fontSize: "48px", fontWeight: 800, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
                      {plan.price[billingCycle] === 0 
                        ? "مجاني" 
                        : plan.price[billingCycle].toLocaleString("en-US")}
                    </span>
                    {plan.price[billingCycle] > 0 && (
                      <span className="text-[#6B7280]" style={{ fontSize: "16px" }}>
                        SR / {billingCycle === "monthly" ? "شهر" : "سنة"}
                      </span>
                    )}
                  </div>
                  {billingCycle === "yearly" && plan.price.yearly > 0 && (
                    <p className="text-[#22C55E]" style={{ fontSize: "13px" }} dir="ltr">
                      وفّر {((plan.price.monthly * 12 - plan.price.yearly)).toLocaleString("en-US")} SR سنوياً
                    </p>
                  )}
                </div>

                <button
                  onClick={() => navigate("/register")}
                  className={`w-full py-3.5 rounded-xl transition-all mb-8 cursor-pointer ${
                    plan.popular
                      ? "bg-[#1276E3] hover:bg-[#0B5FBF] text-white shadow-lg shadow-[#1276E3]/25"
                      : "bg-gray-100 hover:bg-gray-200 text-[#0B1A47]"
                  }`}
                  style={{ fontSize: "15px", fontWeight: 600 }}
                >
                  {plan.price[billingCycle] === 0 ? "ابدأ مجاناً" : "ابدأ التجربة المجانية"}
                </button>

                <div className="space-y-4">
                  <h4 className="text-[#374151] mb-4" style={{ fontSize: "14px", fontWeight: 600 }}>
                    ما ستحصل عليه:
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
                      <span className="text-[#374151]" style={{ fontSize: "14px" }}>
                        {typeof value === "boolean" ? key : value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Toggle */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 bg-white border-2 border-[#1276E3] text-[#1276E3] px-8 py-3.5 rounded-xl hover:bg-[#1276E3] hover:text-white transition-all cursor-pointer shadow-lg"
            style={{ fontSize: "16px", fontWeight: 600 }}
          >
            {showComparison ? "إخفاء" : "عرض"} جدول المقارنة التفصيلي
            <ArrowLeft className={`w-5 h-5 transition-transform ${showComparison ? "rotate-90" : "-rotate-90"}`} />
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
            <h2 className="text-[#0B1A47] mb-12 text-center" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700 }}>
              مقارنة شاملة بين الباقات
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-right p-4 text-[#0B1A47]" style={{ fontSize: "15px", fontWeight: 600 }}>
                      الميزة
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.name} className="p-4 text-center" style={{ minWidth: "150px" }}>
                        <div className="text-[#0B1A47]" style={{ fontSize: "16px", fontWeight: 700 }}>
                          {plan.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((category) => (
                    <>
                      <tr key={category.category} className="bg-gray-100">
                        <td colSpan={4} className="p-4 text-[#0B1A47]" style={{ fontSize: "15px", fontWeight: 700 }}>
                          {category.category}
                        </td>
                      </tr>
                      {category.features.map((feature, i) => (
                        <tr key={feature.name} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                          <td className="p-4 text-[#374151]" style={{ fontSize: "14px" }}>
                            {feature.name}
                          </td>
                          <td className="p-4 text-center">
                            {typeof feature.free === "boolean" ? (
                              feature.free ? (
                                <CheckCircle2 className="w-5 h-5 text-[#22C55E] mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-[#E5E7EB] mx-auto" />
                              )
                            ) : (
                              <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>{feature.free}</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {typeof feature.pro === "boolean" ? (
                              feature.pro ? (
                                <CheckCircle2 className="w-5 h-5 text-[#22C55E] mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-[#E5E7EB] mx-auto" />
                              )
                            ) : (
                              <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>{feature.pro}</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {typeof feature.enterprise === "boolean" ? (
                              feature.enterprise ? (
                                <CheckCircle2 className="w-5 h-5 text-[#22C55E] mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-[#E5E7EB] mx-auto" />
                              )
                            ) : (
                              <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>{feature.enterprise}</span>
                            )}
                          </td>
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
          <h2 className="text-[#0B1A47] mb-12 text-center" style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700 }}>
            الأسئلة الشائعة
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
                  <HelpCircle className="w-5 h-5 text-[#1276E3] flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "16px", fontWeight: 600 }}>
                      {faq.q}
                    </h3>
                    <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.8 }}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1A47] to-[#1276E3]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-white mb-6" style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700 }}>
              لا زلت غير متأكد؟
            </h2>
            <p className="text-white/80 text-lg mb-8" style={{ lineHeight: 1.8 }}>
              جرّب Entix Books مجاناً لمدة 14 يوم. لا حاجة لبطاقة ائتمانية.
            </p>
            <button
              onClick={() => navigate("/register")}
              className="bg-white hover:bg-gray-50 text-[#0B1A47] px-8 py-4 rounded-xl transition-all hover:shadow-2xl flex items-center gap-2 mx-auto cursor-pointer"
              style={{ fontSize: "16px", fontWeight: 600 }}
            >
              ابدأ تجربتك المجانية الآن
              <ArrowLeft className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      <SharedFooter />
    </div>
  );
}
