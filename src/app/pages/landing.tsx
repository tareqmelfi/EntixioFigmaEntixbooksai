import { useNavigate } from "react-router";
import { 
  Shield, BarChart3, Globe, Zap, Cloud, Smartphone, 
  FileText, Users, ArrowLeft, CheckCircle2, ChevronDown,
  Database, Wifi, WifiOff, Server
} from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const FEATURES = [
  { icon: FileText, title: "فواتير احترافية", desc: "إنشاء وإدارة الفواتير بمعايير هيئة الزكاة والضريبة والجمارك ZATCA" },
  { icon: BarChart3, title: "تقارير مالية متقدمة", desc: "لوحة تحكم شاملة مع رسوم بيانية تفاعلية ومؤشرات أداء" },
  { icon: Shield, title: "أمان وموثوقية", desc: "تشفير البيانات وحماية متعددة الطبقات مع نسخ احتياطي تلقائي" },
  { icon: Globe, title: "دعم متعدد اللغات", desc: "واجهة عربية كاملة مع دعم RTL واللغة الإنجليزية" },
  { icon: Cloud, title: "سحابي + محلي", desc: "اعمل أونلاين أو أوفلاين مع مزامنة تلقائية للبيانات" },
  { icon: Smartphone, title: "متوافق مع الجوال", desc: "تصميم متجاوب يعمل على جميع الأجهزة والشاشات" },
];

const PRICING = [
  { 
    name: "أساسي", 
    price: "0", 
    period: "مجاني للأبد",
    features: ["5 فواتير شهرياً", "مستخدم واحد", "تقارير أساسية", "دعم بالبريد"],
    highlighted: false 
  },
  { 
    name: "احترافي", 
    price: "99", 
    period: "ريال / شهرياً",
    features: ["فواتير غير محدودة", "5 مستخدمين", "تقارير متقدمة", "ZATCA متوافق", "دعم مباشر", "تطبيق جوال"],
    highlighted: true 
  },
  { 
    name: "مؤسسي", 
    price: "299", 
    period: "ريال / شهرياً",
    features: ["كل مميزات الاحترافي", "مستخدمون غير محدودون", "API مفتوح", "سيرفر خاص VPS", "مزامنة محلية", "دعم مخصص 24/7"],
    highlighted: false 
  },
];

export function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "هل Entix Books متوافق مع متطلبات الفوترة الإلكترونية في السعودية؟", a: "نعم، Entix Books متوافق بالكامل مع المرحلة الثانية من الفوترة الإلكترونية (ZATCA) ويدعم إصدار الفواتير بصيغة XML وQR Code." },
    { q: "هل يمكنني العمل بدون إنترنت؟", a: "نعم، يدعم Entix Books العمل أوفلاين بالكامل. جميع البيانات تُحفظ محلياً وتتم المزامنة تلقائياً عند عودة الاتصال." },
    { q: "هل يمكن تثبيته على سيرفر خاص؟", a: "نعم، في الباقة المؤسسية يمكنك تثبيت Entix Books على VPS الخاص بك مع قاعدة بيانات PostgreSQL محلية." },
    { q: "كيف يتم تأمين البيانات؟", a: "نستخدم تشفير AES-256 للبيانات المخزنة و TLS 1.3 للاتصالات. مع نسخ احتياطي يومي تلقائي." },
  ];

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 right-0 left-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1A47] flex items-center justify-center">
              <span className="text-white" style={{ fontSize: "14px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
            </div>
            <span className="text-[#0B1A47]" style={{ fontSize: "18px", fontWeight: 700 }}>Entix Books</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[#6B7280] hover:text-[#0B1A47] transition-colors" style={{ fontSize: "14px" }}>المميزات</a>
            <a href="#pricing" className="text-[#6B7280] hover:text-[#0B1A47] transition-colors" style={{ fontSize: "14px" }}>الأسعار</a>
            <a href="#sync" className="text-[#6B7280] hover:text-[#0B1A47] transition-colors" style={{ fontSize: "14px" }}>المزامنة</a>
            <a href="#faq" className="text-[#6B7280] hover:text-[#0B1A47] transition-colors" style={{ fontSize: "14px" }}>الأسئلة الشائعة</a>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/login")}
              className="text-[#0B1A47] hover:text-[#1276E3] transition-colors cursor-pointer" 
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              تسجيل الدخول
            </button>
            <button 
              onClick={() => navigate("/register")}
              className="bg-[#1276E3] hover:bg-[#0B5FBF] text-white px-5 py-2 rounded-lg transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              ابدأ مجاناً
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#1276E3] px-3 py-1.5 rounded-full mb-6" style={{ fontSize: "13px", fontWeight: 500 }}>
              <Zap className="w-4 h-4" />
              نظام محاسبة سحابي متكامل
            </div>
            <h1 className="text-[#0B1A47] mb-6" style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, lineHeight: 1.3 }}>
              أدر حساباتك المالية
              <br />
              <span className="text-[#1276E3]">بذكاء وسهولة</span>
            </h1>
            <p className="text-[#6B7280] mb-8 max-w-lg" style={{ fontSize: "16px", lineHeight: 1.8 }}>
              Entix Books نظام محاسبة سحابي مصمم للسوق السعودي والأمريكي. 
              يعمل أونلاين وأوفلاين مع مزامنة ذكية، متوافق مع ZATCA، ويدعم العربية بالكامل.
            </p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => navigate("/register")}
                className="bg-[#1276E3] hover:bg-[#0B5FBF] text-white px-8 py-3 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                ابدأ تجربتك المجانية
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate("/login")}
                className="border border-[#E5E7EB] hover:border-[#1276E3] text-[#0B1A47] px-8 py-3 rounded-lg transition-colors cursor-pointer"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                تسجيل الدخول
              </button>
            </div>
            <div className="flex items-center gap-6 mt-8">
              {[
                "متوافق مع ZATCA",
                "يعمل أوفلاين",
                "تجربة مجانية",
              ].map(t => (
                <div key={t} className="flex items-center gap-1.5 text-[#6B7280]" style={{ fontSize: "13px" }}>
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="bg-gradient-to-br from-[#0B1A47] to-[#1276E3] rounded-2xl p-1 shadow-2xl shadow-[#1276E3]/20">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1759159347934-1cdc38dd1f3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhY2NvdW50aW5nJTIwc29mdHdhcmUlMjBkYXNoYm9hcmQlMjBkYXJrJTIwYmx1ZXxlbnwxfHx8fDE3NzM4MDA5NzN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Entix Books Dashboard"
                className="rounded-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-[#F8FAFC] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[#0B1A47] mb-3" style={{ fontSize: "32px", fontWeight: 700 }}>كل ما تحتاجه في مكان واحد</h2>
            <p className="text-[#6B7280]" style={{ fontSize: "16px" }}>أدوات محاسبية متكاملة مصممة لتسهيل عملك اليومي</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#1276E3]/30 hover:shadow-lg transition-all cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4 group-hover:bg-[#1276E3] transition-colors">
                  <f.icon className="w-6 h-6 text-[#1276E3] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "17px", fontWeight: 600 }}>{f.title}</h3>
                <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sync Architecture Section */}
      <section id="sync" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[#0B1A47] mb-3" style={{ fontSize: "32px", fontWeight: 700 }}>يعمل بدون إنترنت</h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.7 }}>
              صُمم Entix Books لحل مشكلة الاتصال في القطاعات المختلفة. 
              اعمل محلياً وزامن بياناتك عند توفر الاتصال.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-b from-[#F0F7FF] to-white border border-[#E5E7EB]">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0B1A47] flex items-center justify-center mb-5">
                <WifiOff className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "18px", fontWeight: 600 }}>العمل أوفلاين</h3>
              <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.7 }}>
                جميع البيانات تُحفظ محلياً على الجهاز. لا حاجة لاتصال مستمر بالإنترنت.
              </p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-b from-[#F0F7FF] to-white border border-[#1276E3]/20 shadow-lg">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1276E3] flex items-center justify-center mb-5">
                <Wifi className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "18px", fontWeight: 600 }}>مزامنة ذكية</h3>
              <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.7 }}>
                مزامنة تلقائية نهاية اليوم أو يدوية في أي وقت. دون فقد أي بيانات.
              </p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-b from-[#F0F7FF] to-white border border-[#E5E7EB]">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#349FC4] flex items-center justify-center mb-5">
                <Server className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-[#0B1A47] mb-2" style={{ fontSize: "18px", fontWeight: 600 }}>سيرفر خاص VPS</h3>
              <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.7 }}>
                ثبّت على سيرفرك الخاص مع PostgreSQL. تحكم كامل ببياناتك.
              </p>
            </div>
          </div>
          <div className="mt-12 bg-[#0B1A47] rounded-2xl p-8 text-center">
            <div className="flex justify-center gap-4 mb-4">
              <Database className="w-6 h-6 text-[#349FC4]" />
              <span className="text-white" style={{ fontSize: "13px", fontFamily: "Inter" }}>PostgreSQL + LocalStorage + REST API</span>
            </div>
            <p className="text-[#94A3B8] max-w-2xl mx-auto" style={{ fontSize: "14px", lineHeight: 1.7 }}>
              بنية تقنية مرنة تدعم التخزين المحلي والسحابي والسيرفر الخاص، مع إمكانية التبديل بينها دون الحاجة لتعديل الكود.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-[#F8FAFC] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[#0B1A47] mb-3" style={{ fontSize: "32px", fontWeight: 700 }}>خطط أسعار مرنة</h2>
            <p className="text-[#6B7280]" style={{ fontSize: "16px" }}>اختر الخطة المناسبة لحجم أعمالك</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PRICING.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${
                  plan.highlighted
                    ? "bg-[#0B1A47] border-[#0B1A47] text-white shadow-xl scale-105"
                    : "bg-white border-gray-200"
                } transition-all`}
              >
                {plan.highlighted && (
                  <div className="text-center mb-3">
                    <span className="bg-[#1276E3] text-white px-3 py-1 rounded-full" style={{ fontSize: "12px", fontWeight: 500 }}>الأكثر شعبية</span>
                  </div>
                )}
                <h3 style={{ fontSize: "20px", fontWeight: 600 }} className={plan.highlighted ? "text-white" : "text-[#0B1A47]"}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-3 mb-1" dir="ltr">
                  <span style={{ fontSize: "36px", fontWeight: 700, fontFamily: "Inter" }} className={plan.highlighted ? "text-white" : "text-[#0B1A47]"}>{plan.price}</span>
                </div>
                <p style={{ fontSize: "13px" }} className={plan.highlighted ? "text-[#94A3B8]" : "text-[#6B7280]"}>{plan.period}</p>
                <hr className={`my-5 ${plan.highlighted ? "border-white/10" : "border-gray-100"}`} />
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2" style={{ fontSize: "14px" }}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${plan.highlighted ? "text-[#349FC4]" : "text-[#22C55E]"}`} />
                      <span className={plan.highlighted ? "text-gray-300" : "text-[#6B7280]"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/register")}
                  className={`w-full mt-6 py-2.5 rounded-lg transition-colors cursor-pointer ${
                    plan.highlighted
                      ? "bg-[#1276E3] hover:bg-[#0B5FBF] text-white"
                      : "bg-[#F0F7FF] hover:bg-[#1276E3] hover:text-white text-[#1276E3]"
                  }`}
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  ابدأ الآن
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[#0B1A47] mb-3" style={{ fontSize: "32px", fontWeight: 700 }}>الأسئلة الشائعة</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-right hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="text-[#0B1A47]" style={{ fontSize: "15px", fontWeight: 500 }}>{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-[#6B7280] flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-[#6B7280]" style={{ fontSize: "14px", lineHeight: 1.8 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B1A47] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="text-white" style={{ fontSize: "14px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
            </div>
            <span className="text-white" style={{ fontSize: "18px", fontWeight: 700 }}>Entix Books</span>
          </div>
          <p className="text-[#94A3B8] mb-6" style={{ fontSize: "14px" }}>نظام محاسبة سحابي متكامل للسوق السعودي والأمريكي</p>
          <p className="text-[#64748B]" style={{ fontSize: "12px", fontFamily: "Inter" }}>
            &copy; 2026 Entix Books. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
