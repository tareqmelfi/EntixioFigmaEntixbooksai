import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { Shield, Lock, Eye, Database, UserX, FileText } from "lucide-react";
import { useLanguage } from "../components/LanguageContext";

const enSections = [
  {
    icon: Database,
    title: "1. Information we collect",
    body: "We collect account, company, billing, product, invoice, expense, document, usage, and device information needed to operate ENTIX.IO.",
    items: [
      "Account details such as name, email, workspace, and authentication metadata.",
      "Company records such as customers, vendors, invoices, quotes, receipts, products, services, inventory, bank accounts, and fixed assets.",
      "Files you upload for OCR, reconciliation, or record keeping, including PDFs, images, spreadsheets, and bank statements.",
      "Payment and integration metadata from providers such as Stripe, Plaid, Mercury, DocuSeal, and email delivery services when enabled by your workspace.",
    ],
  },
  {
    icon: Eye,
    title: "2. How we use information",
    body: "We use information to provide accounting workflows, automation, AI assistance, payments, imports, exports, support, security, and compliance features.",
    items: [
      "Create, classify, search, and reconcile business records.",
      "Generate invoices, payment links, reports, and operational summaries.",
      "Improve product reliability, fraud prevention, access controls, and customer support.",
      "Meet legal, tax, security, accounting, and payment-processing obligations.",
    ],
  },
  {
    icon: FileText,
    title: "3. AI, OCR, and connected services",
    body: "ENTIX.IO may use AI and OCR to read documents, suggest classifications, and prepare accounting entries. You remain responsible for reviewing generated outputs before relying on them.",
    items: [
      "Bank connections and transaction data are processed only after a workspace admin enables the connection.",
      "Payment data may be processed by Stripe or other enabled payment providers.",
      "AI suggestions are assistive and are not legal, tax, or accounting advice.",
    ],
  },
  {
    icon: Lock,
    title: "4. Security and retention",
    body: "We use reasonable technical and organizational safeguards designed to protect business data. No online service can guarantee absolute security.",
    items: [
      "Access is restricted by account, workspace, and role controls.",
      "Sensitive integrations should use environment secrets and provider-side access controls.",
      "We retain records while your account is active, as required for service delivery, support, legal obligations, backups, and dispute handling.",
    ],
  },
  {
    icon: UserX,
    title: "5. Your choices and rights",
    body: "You may request access, correction, export, or deletion of personal information, subject to legal, accounting, security, and contractual limits.",
    items: [
      "You can disconnect integrations from workspace settings or provider dashboards.",
      "You can request account or workspace deletion when legal retention obligations allow.",
      "You can contact us about privacy questions at privacy@entix.io.",
    ],
  },
];

const arSections = [
  {
    icon: Database,
    title: "١. البيانات التي نجمعها",
    body: "نجمع بيانات الحساب والمنشأة والفواتير والمصروفات والملفات والاستخدام اللازمة لتشغيل ENTIX.IO.",
    items: [
      "بيانات الحساب مثل الاسم والبريد والمنشأة وبيانات تسجيل الدخول.",
      "سجلات المنشأة مثل العملاء والموردين والفواتير والعروض والمنتجات والمخزون والحسابات البنكية والأصول.",
      "الملفات المرفوعة للقراءة الآلية أو التسوية مثل PDF والصور وملفات Excel وكشوف البنوك.",
      "بيانات الربط مع مزودي الدفع والبنوك مثل Stripe وPlaid وMercury وDocuSeal عند تفعيلها من مسؤول المنشأة.",
    ],
  },
  {
    icon: Eye,
    title: "٢. كيف نستخدم البيانات",
    body: "نستخدم البيانات لتقديم المحاسبة والأتمتة والمساعد الذكي والمدفوعات والاستيراد والتقارير والدعم والأمان.",
    items: [
      "إنشاء وتصنيف وبحث وتسوية السجلات التجارية.",
      "إصدار الفواتير وروابط الدفع والتقارير والملخصات التشغيلية.",
      "تحسين الاعتمادية ومنع الاحتيال والصلاحيات وخدمة العملاء.",
      "الامتثال للمتطلبات القانونية والضريبية والمحاسبية ومتطلبات مزودي الدفع.",
    ],
  },
  {
    icon: FileText,
    title: "٣. الذكاء الاصطناعي والقراءة الآلية",
    body: "قد يستخدم ENTIX.IO الذكاء الاصطناعي وOCR لقراءة المستندات واقتراح التصنيفات والقيود. تبقى مسؤولاً عن مراجعة النتائج قبل الاعتماد عليها.",
    items: [
      "ربط الحسابات البنكية يتم فقط بعد تفعيله من مسؤول المنشأة.",
      "بيانات الدفع قد تتم معالجتها عبر Stripe أو مزود دفع آخر مفعّل.",
      "اقتراحات الذكاء الاصطناعي مساعدة وليست استشارة قانونية أو ضريبية أو محاسبية.",
    ],
  },
  {
    icon: Lock,
    title: "٤. الأمان والاحتفاظ",
    body: "نستخدم إجراءات تقنية وتنظيمية معقولة لحماية بيانات الأعمال، ولا توجد خدمة إلكترونية تضمن الأمان المطلق.",
    items: [
      "الوصول محكوم بالحساب والمنشأة والدور.",
      "مفاتيح الربط الحساسة يجب أن تحفظ كأسرار بيئة وصلاحيات لدى مزودي الخدمة.",
      "نحتفظ بالسجلات أثناء نشاط الحساب وبما يلزم للتشغيل والدعم والالتزامات القانونية والنسخ الاحتياطي والنزاعات.",
    ],
  },
  {
    icon: UserX,
    title: "٥. حقوقك واختياراتك",
    body: "يمكنك طلب الوصول أو التصحيح أو التصدير أو الحذف ضمن حدود الالتزامات القانونية والمحاسبية والأمنية والتعاقدية.",
    items: [
      "يمكنك فصل عمليات الربط من إعدادات المنشأة أو لوحة المزود.",
      "يمكنك طلب حذف الحساب أو المنشأة متى سمحت التزامات الاحتفاظ النظامية.",
      "لأسئلة الخصوصية: privacy@entix.io.",
    ],
  },
];

export function Privacy() {
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
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-[#0B1B49] mb-3" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
              {isAr ? "سياسة الخصوصية" : "ENTIX.IO Privacy Policy"}
            </h1>
            <p className="text-[#6B7280]" style={{ fontSize: "0.95rem" }}>
              {isAr ? "آخر تحديث: 4 يونيو 2026" : "Last updated: June 4, 2026"}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-200">
            <h2 className="text-[#0B1B49] mb-3" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {isAr ? "من نحن" : "Who we are"}
            </h2>
            <p className="text-[#374151] m-0" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
              {isAr
                ? "ENTIX.IO هو منتج محاسبة وفوترة وذكاء اصطناعي تديره ENSIDEX LLC، Wyoming, USA. هذه السياسة تشرح كيف نتعامل مع بيانات مستخدمي المنصة."
                : "ENTIX.IO is an accounting, invoicing, and AI workflow product operated by ENSIDEX LLC, Wyoming, USA. This policy explains how we handle information for users and workspaces."}
            </p>
          </div>

          <div className="space-y-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.title}>
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-5 h-5 text-[#1276E3]" />
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

          <div className="bg-[#EFF6FF] rounded-lg p-6 mt-12 border border-[#1276E3]/20">
            <h3 className="text-[#0B1B49] mb-3" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              {isAr ? "التواصل" : "Contact"}
            </h3>
            <p className="text-[#374151] mb-2" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
              {isAr ? "لأسئلة الخصوصية أو طلبات البيانات:" : "For privacy questions or data requests:"}
            </p>
            <p className="text-[#1276E3] font-english" style={{ fontSize: "0.95rem" }}>
              privacy@entix.io
            </p>
          </div>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
