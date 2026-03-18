import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { FileText, Users, CreditCard, AlertTriangle, Scale, RefreshCw } from "lucide-react";

export function Terms() {
  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <SharedNavbar />
      
      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#0B1A47] to-[#1A2D5C] flex items-center justify-center shadow-xl">
              <Scale className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-[#0B1A47] mb-4" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
              الشروط والأحكام
            </h1>
            <p className="text-[#6B7280]" style={{ fontSize: "16px" }}>
              آخر تحديث: 18 مارس 2026
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-gray-50 rounded-2xl p-8 mb-8 border border-gray-200">
              <p className="text-[#374151] m-0" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                باستخدامك لخدمات Entix Books، فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها بعناية قبل استخدام الخدمة.
              </p>
            </div>

            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ١. التعريفات
                  </h2>
                </div>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li><strong>"الخدمة"</strong>: تطبيق Entix Books بجميع مكوناته وميزاته</li>
                  <li><strong>"المستخدم"</strong> أو <strong>"أنت"</strong>: الشخص أو الكيان الذي يستخدم الخدمة</li>
                  <li><strong>"نحن"</strong> أو <strong>"Entix"</strong>: شركة Entix Books ومالكو التطبيق</li>
                  <li><strong>"الحساب"</strong>: حسابك الشخصي على التطبيق</li>
                  <li><strong>"المحتوى"</strong>: جميع البيانات والمعلومات التي تدخلها في الخدمة</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٢. استخدام الخدمة
                  </h2>
                </div>
                <h3 className="text-[#374151]" style={{ fontSize: "17px", fontWeight: 600 }}>الأهلية</h3>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  يجب أن يكون عمرك 18 عاماً على الأقل لاستخدام الخدمة. باستخدامك للخدمة، تؤكد أنك تستوفي هذا المتطلب.
                </p>
                <h3 className="text-[#374151] mt-4" style={{ fontSize: "17px", fontWeight: 600 }}>الحساب</h3>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>أنت مسؤول عن الحفاظ على سرية بيانات حسابك</li>
                  <li>أنت مسؤول عن جميع الأنشطة التي تحدث تحت حسابك</li>
                  <li>يجب عليك إخطارنا فوراً بأي استخدام غير مصرح به</li>
                  <li>لا يجوز مشاركة حسابك مع آخرين دون إذن</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٣. الرسوم والدفع
                  </h2>
                </div>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>الأسعار معروضة في صفحة <a href="/pricing" className="text-[#1276E3] hover:underline">التسعير</a></li>
                  <li>جميع الرسوم غير شاملة لضريبة القيمة المضافة (15%)</li>
                  <li>يتم الدفع مقدماً شهرياً أو سنوياً حسب الباقة المختارة</li>
                  <li>نقبل البطاقات الائتمانية (Visa, Mastercard, Mada)</li>
                  <li>الفواتير الشهرية متاحة للباقة المؤسسية فقط</li>
                  <li>نحتفظ بالحق في تغيير الأسعار بإشعار مسبق 30 يوماً</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <RefreshCw className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٤. الإلغاء والاسترداد
                  </h2>
                </div>
                <h3 className="text-[#374151]" style={{ fontSize: "17px", fontWeight: 600 }}>الإلغاء</h3>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  يمكنك إلغاء اشتراكك في أي وقت من صفحة الإعدادات. سيستمر حسابك نشطاً حتى نهاية فترة الفوترة الحالية.
                </p>
                <h3 className="text-[#374151] mt-4" style={{ fontSize: "17px", fontWeight: 600 }}>سياسة الاسترداد</h3>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>نوفر ضمان استرداد كامل لمدة 30 يوماً من تاريخ الاشتراك الأول</li>
                  <li>بعد 30 يوماً، لا يتم استرداد المبالغ المدفوعة</li>
                  <li>الاشتراكات السنوية غير قابلة للاسترداد بعد 30 يوماً</li>
                  <li>لطلب الاسترداد، تواصل معنا على: refund@entix.io</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٥. الاستخدام المقبول
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  يحظر استخدام الخدمة في:
                </p>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>أي أنشطة غير قانونية أو احتيالية</li>
                  <li>انتهاك حقوق الملكية الفكرية</li>
                  <li>إرسال برمجيات خبيثة أو فيروسات</li>
                  <li>محاولة اختراق أو تعطيل الخدمة</li>
                  <li>استخدام أدوات آلية للوصول للخدمة دون إذن</li>
                  <li>جمع بيانات مستخدمين آخرين</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٦. الملكية الفكرية
                  </h2>
                </div>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>جميع حقوق الملكية الفكرية في الخدمة مملوكة لـ Entix Books</li>
                  <li>تحتفظ بملكية بياناتك ومحتواك</li>
                  <li>نمنحك ترخيصاً محدوداً لاستخدام الخدمة</li>
                  <li>لا يجوز نسخ أو تعديل أو توزيع الخدمة دون إذن</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Scale className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٧. إخلاء المسؤولية
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  نوفر الخدمة "كما هي" دون أي ضمانات صريحة أو ضمنية. لا نتحمل المسؤولية عن:
                </p>
                <ul className="text-[#374151] space-y-2" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  <li>أي أخطاء أو انقطاعات في الخدمة</li>
                  <li>فقدان البيانات أو الأرباح</li>
                  <li>الأضرار غير المباشرة أو العرضية</li>
                  <li>استخدامك أو عدم قدرتك على استخدام الخدمة</li>
                </ul>
                <p className="text-[#374151] mt-4" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  مسؤوليتنا الإجمالية محدودة بالمبلغ المدفوع من قبلك خلال 12 شهراً السابقة.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٨. التعديلات
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار في التطبيق قبل 30 يوماً من سريانها. استمرارك في استخدام الخدمة بعد التعديلات يعني موافقتك عليها.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Scale className="w-6 h-6 text-[#0B1A47]" />
                  <h2 className="text-[#0B1A47] m-0" style={{ fontSize: "20px", fontWeight: 700 }}>
                    ٩. القانون الحاكم
                  </h2>
                </div>
                <p className="text-[#374151]" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                  تخضع هذه الشروط وتفسر وفقاً لأنظمة المملكة العربية السعودية. أي نزاع ينشأ عن هذه الشروط يخضع للاختصاص الحصري للمحاكم السعودية.
                </p>
              </section>
            </div>

            <div className="bg-[#FEF2F2] rounded-2xl p-8 mt-12 border border-[#EF4444]/20">
              <h3 className="text-[#0B1A47] mb-4" style={{ fontSize: "20px", fontWeight: 700 }}>
                تواصل معنا
              </h3>
              <p className="text-[#374151] mb-4" style={{ fontSize: "15px", lineHeight: 1.9 }}>
                إذا كان لديك أي استفسارات حول الشروط والأحكام، يرجى التواصل معنا:
              </p>
              <div className="space-y-2">
                <p className="text-[#374151]" style={{ fontSize: "15px" }}>
                  <strong>البريد الإلكتروني:</strong>{" "}
                  <span className="text-[#1276E3]" style={{ fontFamily: "Inter" }}>legal@entix.io</span>
                </p>
                <p className="text-[#374151]" style={{ fontSize: "15px" }}>
                  <strong>الهاتف:</strong>{" "}
                  <span className="text-[#1276E3]" style={{ fontFamily: "Inter", direction: "ltr", display: "inline-block" }}>+966 800 430 088</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
