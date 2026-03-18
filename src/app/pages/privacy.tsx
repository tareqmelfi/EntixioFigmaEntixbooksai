import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { Shield, Lock, Eye, Database, UserX, FileText } from "lucide-react";

export function Privacy() {
  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />
      
      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#1276E3] to-[#349FC4] flex items-center justify-center shadow-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
              سياسة الخصوصية
            </h1>
            <p className="text-[#6B7280]" style={{ fontSize: "16px" }}>
              آخر تحديث: 18 مارس 2026
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-gray-50 rounded-2xl p-8 mb-8 border border-gray-200">
              <h2 className="text-[#0B1A47] mb-4" style={{ fontSize: "22px", fontWeight: 700 }}>
                التزامنا بخصوصيتك
              </h2>
              <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                في Entix Books، نحن ملتزمون بحماية خصوصيتك وأمان بياناتك. هذه السياسة توضح كيف نجمع، نستخدم، ونحمي معلوماتك الشخصية والمالية.
              </p>
            </div>

            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-6 h-6 text-[#1276E3]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ١. البيانات التي نجمعها
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  نجمع المعلومات التالية لتوفير خدماتنا:
                </p>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>معلومات الحساب: الاسم، البريد الإلكتروني، رقم الجوال، اسم الشركة</li>
                  <li>البيانات المالية: الفواتير، المصروفات، العملاء، الموردين</li>
                  <li>معلومات الاستخدام: سجلات الدخول، نشاط التطبيق، تفضيلات الإعدادات</li>
                  <li>البيانات التقنية: عنوان IP، نوع المتصفح، نظام التشغيل</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-[#1276E3]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٢. كيف نستخدم بياناتك
                  </h2>
                </div>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>توفير وتحسين خدماتنا المحاسبية</li>
                  <li>معالجة المعاملات المالية وإنشاء الفواتير</li>
                  <li>تقديم الدعم الفني والمساعدة</li>
                  <li>إرسال التحديثات والإشعارات المهمة</li>
                  <li>تحليل الاستخدام لتحسين التطبيق</li>
                  <li>الامتثال للمتطلبات القانونية والتنظيمية</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-[#1276E3]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٣. حماية البيانات
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  نستخدم أحدث تقنيات الأمان لحماية بياناتك:
                </p>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>تشفير AES-256 للبيانات المخزنة</li>
                  <li>بروتوكول TLS 1.3 لنقل البيانات</li>
                  <li>مصادقة ثنائية (2FA)</li>
                  <li>نسخ احتياطي يومي مشفر</li>
                  <li>مراقبة أمنية على مدار الساعة</li>
                  <li>فحص دوري للثغرات الأمنية</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <UserX className="w-6 h-6 text-[#1276E3]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٤. حقوقك
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  لديك الحق في:
                </p>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>الوصول إلى بياناتك الشخصية</li>
                  <li>تصحيح أي معلومات غير دقيقة</li>
                  <li>حذف حسابك وبياناتك</li>
                  <li>تصدير بياناتك بصيغة قابلة للقراءة</li>
                  <li>الاعتراض على معالجة بياناتك</li>
                  <li>سحب موافقتك في أي وقت</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-[#1276E3]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٥. الامتثال القانوني
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  نلتزم بـ:
                </p>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>اللائحة العامة لحماية البيانات (GDPR)</li>
                  <li>نظام حماية البيانات الشخصية في المملكة العربية السعودية</li>
                  <li>معايير PCI DSS لأمان بيانات البطاقات</li>
                  <li>متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)</li>
                </ul>
              </section>
            </div>

            <div className="bg-[#EFF6FF] rounded-2xl p-8 mt-12 border border-[#1276E3]/20">
              <h3 className="text-[#0B1A47] mb-4" style={{ fontSize: "20px", fontWeight: 700 }}>
                هل لديك أسئلة؟
              </h3>
              <p className="text-[#374151] mb-4" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                إذا كان لديك أي استفسارات حول سياسة الخصوصية أو كيفية استخدامنا لبياناتك، يرجى التواصل معنا:
              </p>
              <p className="text-[#1276E3]" style={{ fontSize: "15px", fontFamily: "Inter" }}>
                privacy@entix.io
              </p>
            </div>
          </div>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
