import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { FileText, Users, CreditCard, AlertTriangle, Scale, RefreshCw } from "lucide-react";
import { useLanguage } from "../components/LanguageContext";

const enSections = [
  {
    icon: Users,
    title: "1. Accounts and workspaces",
    body: "You are responsible for your account, users you invite, workspace data, permissions, and activity performed under your credentials.",
    items: [
      "Use accurate company and billing information.",
      "Keep credentials, API keys, bank connections, and payment-provider access secure.",
      "Only upload documents and data you have the right to process.",
    ],
  },
  {
    icon: FileText,
    title: "2. Accounting and AI outputs",
    body: "ENTIX.IO provides tools for invoices, expenses, reports, OCR, reconciliation, and AI-assisted workflows. Outputs must be reviewed before use.",
    items: [
      "AI, OCR, categorization, tax, and reconciliation suggestions may be incomplete or incorrect.",
      "ENTIX.IO is not a law firm, CPA firm, tax advisor, or financial advisor.",
      "You are responsible for final filings, tax positions, books, payments, and records.",
    ],
  },
  {
    icon: CreditCard,
    title: "3. Subscriptions, payments, and third-party services",
    body: "Paid features may require a subscription, usage fees, payment-provider account, bank connection, or third-party service.",
    items: [
      "Stripe, Plaid, Mercury, DocuSeal, email delivery, and similar services are governed by their own terms.",
      "Fees are billed as shown at checkout, in your plan, or in a signed agreement.",
      "We may change pricing with reasonable notice for active customers when required.",
    ],
  },
  {
    icon: RefreshCw,
    title: "4. Cancellation and data export",
    body: "You may cancel paid services according to your plan terms. We aim to support reasonable data export before deletion or account closure.",
    items: [
      "Cancellation does not automatically erase records that must be retained for legal, accounting, security, or dispute purposes.",
      "Refunds, if available, are handled according to the applicable plan, checkout terms, or written agreement.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "5. Acceptable use",
    body: "Do not misuse ENTIX.IO, interfere with the service, upload unlawful content, abuse automation, or attempt unauthorized access.",
    items: [
      "Do not process payment, bank, identity, or customer data without proper authority.",
      "Do not reverse engineer, scrape, overload, or bypass product limits.",
      "Do not use the service for fraud, deceptive invoicing, money laundering, or prohibited businesses.",
    ],
  },
  {
    icon: Scale,
    title: "6. Governing entity and contact",
    body: "ENTIX.IO is owned by شركة سبيك بروز للاستثمار, CR 3400010090, and operated and powered by ENSIDEX LLC. These terms may be supplemented for local markets when required.",
    items: [
      "Questions: legal@entix.io.",
      "Privacy questions: privacy@entix.io.",
      "Support questions: support@entix.io.",
    ],
  },
];

const arSections = [
  {
    icon: Users,
    title: "١. الحسابات والمنشآت",
    body: "أنت مسؤول عن حسابك والمستخدمين الذين تضيفهم وبيانات المنشأة والصلاحيات والنشاط الذي يتم عبر بيانات دخولك.",
    items: [
      "استخدم بيانات شركة وفوترة صحيحة.",
      "حافظ على سرية بيانات الدخول ومفاتيح API وربط البنوك ومزودي الدفع.",
      "لا ترفع مستندات أو بيانات لا تملك حق معالجتها.",
    ],
  },
  {
    icon: FileText,
    title: "٢. المحاسبة ومخرجات الذكاء الاصطناعي",
    body: "يوفر ENTIX.IO أدوات للفواتير والمصروفات والتقارير وOCR والتسوية والذكاء الاصطناعي، ويجب مراجعة المخرجات قبل الاعتماد عليها.",
    items: [
      "اقتراحات الذكاء والتصنيف والضرائب والتسوية قد تكون ناقصة أو غير صحيحة.",
      "ENTIX.IO ليس مكتب محاماة أو محاسب قانوني أو مستشار ضريبي أو مالي.",
      "أنت مسؤول عن الإقرارات والدفاتر والمدفوعات والسجلات النهائية.",
    ],
  },
  {
    icon: CreditCard,
    title: "٣. الاشتراكات والمدفوعات والخدمات الخارجية",
    body: "قد تتطلب بعض الميزات اشتراكاً أو رسوم استخدام أو حساب مزود دفع أو ربط بنك أو خدمة خارجية.",
    items: [
      "Stripe وPlaid وMercury وDocuSeal وخدمات البريد وغيرها تخضع لشروطها الخاصة.",
      "الرسوم تظهر في صفحة الدفع أو الباقة أو الاتفاقية المكتوبة.",
      "قد نعدل الأسعار بإشعار مناسب للعملاء النشطين عند الحاجة.",
    ],
  },
  {
    icon: RefreshCw,
    title: "٤. الإلغاء وتصدير البيانات",
    body: "يمكنك إلغاء الخدمات المدفوعة حسب شروط الباقة، ونسعى لدعم تصدير البيانات بشكل معقول قبل الحذف أو إغلاق الحساب.",
    items: [
      "الإلغاء لا يعني حذف السجلات المطلوبة قانونياً أو محاسبياً أو أمنياً أو للنزاعات.",
      "الاسترداد، إن وجد، يخضع لشروط الباقة أو الدفع أو الاتفاقية المكتوبة.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "٥. الاستخدام المقبول",
    body: "لا تستخدم ENTIX.IO بطريقة تسيء للخدمة أو تعطلها أو تخالف الأنظمة أو تتجاوز الصلاحيات.",
    items: [
      "لا تعالج بيانات دفع أو بنك أو هوية أو عملاء بدون صلاحية.",
      "لا تحاول عكس الهندسة أو السحب الآلي أو تجاوز حدود المنتج.",
      "لا تستخدم الخدمة للاحتيال أو الفوترة المضللة أو غسل الأموال أو الأنشطة المحظورة.",
    ],
  },
  {
    icon: Scale,
    title: "٦. الكيان والتواصل",
    body: "ENTIX.IO مملوك لشركة سبيك بروز للاستثمار، سجل تجاري 3400010090، وتتم إدارته وتشغيله بواسطة ENSIDEX LLC. قد تضاف ملاحق محلية لهذه الشروط عند الحاجة.",
    items: [
      "الأسئلة القانونية: legal@entix.io.",
      "أسئلة الخصوصية: privacy@entix.io.",
      "الدعم: support@entix.io.",
    ],
  },
];

export function Terms() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const sections = isAr ? arSections : enSections;

  return (
    <div className="min-h-screen bg-white" dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: isAr ? "var(--entix-font-ar)" : "var(--entix-font-en)" }}>
      <SharedNavbar />

      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-[#0B1B49] flex items-center justify-center shadow-lg">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-[#0B1B49] mb-3" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
              {isAr ? "الشروط والأحكام" : "ENTIX.IO Terms of Service"}
            </h1>
            <p className="text-[#6B7280]" style={{ fontSize: "0.95rem" }}>
              {isAr ? "آخر تحديث: 4 يونيو 2026" : "Last updated: June 4, 2026"}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-200">
            <p className="text-[#374151] m-0" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
              {isAr
                ? "باستخدامك ENTIX.IO، فإنك توافق على هذه الشروط. إذا كنت تستخدم الخدمة نيابة عن منشأة، فأنت تؤكد أن لديك الصلاحية لإلزامها بهذه الشروط."
                : "By using ENTIX.IO, you agree to these Terms. If you use the service on behalf of a company, you confirm that you are authorized to bind that company to these Terms."}
            </p>
          </div>

          <div className="space-y-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.title}>
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-5 h-5 text-[#0B1B49]" />
                    <h2 className="text-[#0B1B49] m-0" style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-[#374151]" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                    {section.body}
                  </p>
                  <ul className="text-[#374151] space-y-2" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <div className="bg-[#F8FAFC] rounded-lg p-6 mt-12 border border-[#CBD5E1]">
            <h3 className="text-[#0B1B49] mb-3" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              {isAr ? "ملاحظة مهمة" : "Important note"}
            </h3>
            <p className="text-[#374151]" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
              {isAr
                ? "هذه الصفحة نسخة تشغيلية مبدئية للمنتج ويجب مراجعتها قانونياً قبل إطلاق عام واسع أو عقود مؤسسية."
                : "This is an operational product draft and should be reviewed by counsel before broad public launch or enterprise agreements."}
            </p>
          </div>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
