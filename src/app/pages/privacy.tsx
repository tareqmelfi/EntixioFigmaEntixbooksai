import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { Shield, Lock, Eye, Database, UserX, FileText, Smartphone, BadgeCheck } from "lucide-react";
import { useLanguage } from "../components/LanguageContext";

const enSections = [
  {
    icon: Database,
    title: "1. Information we collect",
    body: "We collect information needed to provide ENTIX.IO to you and your organizations, including through the web service and iOS app.",
    items: [
      "Account information such as name, email address, and user ID, plus workspace or organization membership and authentication metadata.",
      "organization financial records such as customers, vendors, invoices, quotes, receipts, expenses, products, inventory, bank records, accounting entries, reports, and related business data you choose to enter.",
      "Uploads you choose to submit, including images, PDFs, spreadsheets, bank statements, invoices, receipts, and other business documents.",
      "Basic usage, device, diagnostic, and security information needed to operate, protect, and troubleshoot the service.",
      "Payment and connected-service metadata when an organization administrator enables an integration; those providers process information under their own terms and privacy notices.",
    ],
  },
  {
    icon: Smartphone,
    title: "2. iOS camera, photo, and file access",
    body: "The iOS app requests access in context, when you choose to capture or import content. You can deny or later change optional access without giving ENTIX.IO unrestricted access to your device.",
    items: [
      "Camera access is used to capture invoices, receipts, business documents, or supported barcodes that you choose to scan.",
      "photo library access is used to select document images you choose to import. The access level is controlled by iOS.",
      "The iOS Files picker lets you choose specific files. ENTIX.IO receives the files you select, not general access to all files on your device.",
      "Selected or captured content may be uploaded to ENTIX.IO for storage, extraction, and the accounting workflow you requested.",
    ],
  },
  {
    icon: Eye,
    title: "3. How we use information",
    body: "We use information to provide accounting workflows, automation, imports, exports, support, security, and features you request.",
    items: [
      "Create, classify, search, organize, and reconcile business records.",
      "Prepare documents, reports, and operational summaries for your review.",
      "Authenticate users, apply organization and role access, prevent abuse, and investigate service issues.",
      "Meet applicable legal, tax, security, accounting, payment-processing, and dispute obligations.",
    ],
  },
  {
    icon: FileText,
    title: "4. AI, OCR, and service processors",
    body: "ENTIX.IO may use AI and OCR to read submitted documents, respond to AI prompts, extract fields, suggest classifications, and prepare draft accounting outputs. These features are assistive and require your review.",
    items: [
      "When you submit a document or AI prompt, the selected content and necessary context may be processed by our infrastructure and service processors, including OpenRouter and model providers used for the requested feature.",
      "Processors and models may change as the architecture evolves; we do not promise that a specific routed model will always be used.",
      "AI and OCR outputs can be incomplete or incorrect. Review results before saving or relying on them.",
      "AI suggestions are not legal, tax, or accounting advice.",
    ],
  },
  {
    icon: Lock,
    title: "5. Security, sharing, and retention",
    body: "We use reasonable technical and organizational safeguards designed to protect account and organization data. No online service can guarantee absolute security.",
    items: [
      "Access is restricted through account, organization, and role controls.",
      "We share information with service processors only as needed to provide, secure, support, or legally operate the service, or when you direct an enabled integration.",
      "We retain records while an account is active and as reasonably needed for service delivery, support, backups, security, fraud prevention, legal obligations, and dispute handling.",
      "Retention periods can differ by record type, organization instructions, applicable law, and backup lifecycle.",
    ],
  },
  {
    icon: UserX,
    title: "6. Deletion, recovery, and your rights",
    body: "You may request access, correction, export, or deletion of personal information, subject to applicable legal, accounting, security, ownership, and contractual limits.",
    items: [
      "In the iOS app, initiate account deletion from More > Account > Delete account and confirm the request.",
      "Account deletion is scheduled with a 30-day recovery period. During that period, sign in and cancel deletion to restore the account.",
      "After the recovery period, deletion proceeds for the account and eligible solely owned workspaces. Shared organization access and ownership are handled according to the service's organization rules.",
      "We may retain the minimum records required for legal, tax, accounting, security, or dispute purposes, including fraud prevention, even after a deletion request.",
      "You can disconnect integrations through available organization settings or the relevant provider.",
    ],
  },
  {
    icon: BadgeCheck,
    title: "7. No sale or cross-app tracking",
    body: "We do not sell personal information. We do not use the iOS app for cross-app tracking or cross-company advertising profiles.",
    items: [
      "ENTIX.IO may use first-party service measurements and diagnostics to understand reliability and improve the product.",
      "Website analytics and cookie choices are described through the website's cookie controls; these do not change the iOS app statement above.",
      "Contact privacy@entix.io for privacy questions or data requests.",
    ],
  },
];

const arSections = [
  {
    icon: Database,
    title: "١. البيانات التي نجمعها",
    body: "نجمع البيانات اللازمة لتقديم ENTIX.IO لك ولمنشآتك عبر خدمة الويب وتطبيق iOS.",
    items: [
      "بيانات الحساب مثل الاسم والبريد الإلكتروني ومعرّف المستخدم وعضوية مساحة العمل أو المنشأة وبيانات المصادقة.",
      "السجلات المالية للمنشأة مثل العملاء والموردين والفواتير والعروض والإيصالات والمصروفات والمنتجات والمخزون والسجلات البنكية والقيود والتقارير وبيانات الأعمال التي تختار إدخالها.",
      "الملفات التي تختار رفعها، مثل الصور وPDF والجداول وكشوف البنوك والفواتير والإيصالات ومستندات الأعمال الأخرى.",
      "بيانات الاستخدام والجهاز والتشخيص والأمان الأساسية اللازمة لتشغيل الخدمة وحمايتها وحل مشكلاتها.",
      "بيانات وصفية للدفع والخدمات المتصلة عندما يفعّل مسؤول المنشأة عملية ربط؛ ويعالج كل مزود بياناته وفق شروطه وإشعار الخصوصية الخاص به.",
    ],
  },
  {
    icon: Smartphone,
    title: "٢. الوصول إلى الكاميرا والصور والملفات في iOS",
    body: "يطلب تطبيق iOS الوصول عند الحاجة فقط، عندما تختار تصوير محتوى أو استيراده. يمكنك رفض الوصول الاختياري أو تغييره لاحقاً دون منح ENTIX.IO وصولاً غير مقيد إلى جهازك.",
    items: [
      "يُستخدم إذن الكاميرا لتصوير الفواتير أو الإيصالات أو مستندات الأعمال أو الرموز الشريطية المدعومة التي تختار مسحها.",
      "يُستخدم إذن مكتبة الصور لاختيار صور المستندات التي تريد استيرادها، ويتحكم iOS في مستوى الوصول.",
      "يتيح منتقي «الملفات» في iOS اختيار ملفات محددة؛ يستلم ENTIX.IO الملفات التي تختارها فقط وليس وصولاً عاماً إلى جميع ملفات الجهاز.",
      "قد يُرفع المحتوى المحدد أو المصوّر إلى ENTIX.IO للتخزين والاستخراج وسير العمل المحاسبي الذي طلبته.",
    ],
  },
  {
    icon: Eye,
    title: "٣. كيف نستخدم البيانات",
    body: "نستخدم البيانات لتقديم سير العمل المحاسبي والأتمتة والاستيراد والتصدير والدعم والأمان والميزات التي تطلبها.",
    items: [
      "إنشاء سجلات الأعمال وتصنيفها والبحث فيها وتنظيمها وتسويتها.",
      "إعداد المستندات والتقارير والملخصات التشغيلية لمراجعتك.",
      "مصادقة المستخدمين وتطبيق صلاحيات المنشأة والأدوار ومنع الإساءة والتحقيق في مشكلات الخدمة.",
      "الوفاء بالالتزامات القانونية والضريبية والأمنية والمحاسبية ومتطلبات معالجة الدفع والنزاعات حسب انطباقها.",
    ],
  },
  {
    icon: FileText,
    title: "٤. الذكاء الاصطناعي وOCR ومعالجو الخدمة",
    body: "قد يستخدم ENTIX.IO الذكاء الاصطناعي وOCR لقراءة المستندات المرسلة ومعالجة طلبات الذكاء الاصطناعي واستخراج الحقول واقتراح التصنيفات وإعداد مسودات محاسبية. هذه الميزات مساعدة وتتطلب مراجعتك.",
    items: [
      "عند إرسال مستند أو طلب ذكاء اصطناعي، قد تتم معالجة المحتوى المحدد والسياق اللازم عبر بنيتنا ومعالجي الخدمة، بما في ذلك OpenRouter ومزودو النماذج المستخدمون للميزة المطلوبة.",
      "قد تتغير المعالجات والنماذج مع تطور البنية، ولا نَعِد باستخدام نموذج موجّه محدد دائماً.",
      "قد تكون نتائج الذكاء الاصطناعي وOCR ناقصة أو غير صحيحة؛ راجعها قبل الحفظ أو الاعتماد عليها.",
      "اقتراحات الذكاء الاصطناعي ليست استشارة قانونية أو ضريبية أو محاسبية.",
    ],
  },
  {
    icon: Lock,
    title: "٥. الأمان والمشاركة والاحتفاظ",
    body: "نستخدم إجراءات تقنية وتنظيمية معقولة مصممة لحماية بيانات الحساب والمنشأة، ولا توجد خدمة إلكترونية تضمن الأمان المطلق.",
    items: [
      "يُقيّد الوصول من خلال الحساب والمنشأة والدور.",
      "نشارك البيانات مع معالجي الخدمة بالقدر اللازم لتقديم الخدمة أو حمايتها أو دعمها أو تشغيلها قانونياً، أو عندما توجهنا إلى عملية ربط مفعّلة.",
      "نحتفظ بالسجلات أثناء نشاط الحساب وبالقدر المعقول اللازم للتشغيل والدعم والنسخ الاحتياطي والأمان ومنع الاحتيال والالتزامات القانونية ومعالجة النزاعات.",
      "قد تختلف مدة الاحتفاظ حسب نوع السجل وتعليمات المنشأة والقانون المنطبق ودورة النسخ الاحتياطي.",
    ],
  },
  {
    icon: UserX,
    title: "٦. الحذف والاسترداد وحقوقك",
    body: "يمكنك طلب الوصول أو التصحيح أو التصدير أو حذف البيانات الشخصية، ضمن الحدود القانونية والمحاسبية والأمنية والتعاقدية وحدود الملكية المنطبقة.",
    items: [
      "في تطبيق iOS، ابدأ حذف الحساب من «المزيد > الحساب > حذف الحساب» ثم أكّد الطلب.",
      "يُجدول حذف الحساب مع فترة استرداد مدتها 30 يوماً. خلال هذه الفترة، سجّل الدخول وألغِ الحذف لاستعادة الحساب.",
      "بعد فترة الاسترداد، يستمر حذف الحساب ومساحات العمل المؤهلة التي يملكها منفرداً. وتُعالج صلاحيات وملكية المنشآت المشتركة وفق قواعد المنشآت في الخدمة.",
      "قد نحتفظ بالحد الأدنى من السجلات المطلوبة لأغراض قانونية أو ضريبية أو محاسبية أو أمنية أو لمنع الاحتيال أو معالجة النزاعات حتى بعد طلب الحذف.",
      "يمكنك فصل عمليات الربط عبر إعدادات المنشأة المتاحة أو من خلال المزود المعني.",
    ],
  },
  {
    icon: BadgeCheck,
    title: "٧. لا بيع ولا تتبع عبر التطبيقات",
    body: "لا نبيع البيانات الشخصية، ولا نستخدم تطبيق iOS للتتبع عبر التطبيقات أو لإنشاء ملفات إعلانية عبر الشركات.",
    items: [
      "قد يستخدم ENTIX.IO قياسات وتشخيصات خاصة بالخدمة لفهم الاعتمادية وتحسين المنتج.",
      "توضح أدوات ملفات الارتباط في الموقع خيارات تحليلات الويب؛ ولا تغيّر هذه الأدوات بيان تطبيق iOS أعلاه.",
      "لأسئلة الخصوصية أو طلبات البيانات: privacy@entix.io.",
    ],
  },
];

export function Privacy() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const sections = isAr ? arSections : enSections;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white" dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: isAr ? "var(--entix-font-ar)" : "var(--entix-font-en)" }}>
      <SharedNavbar />
      <main data-page="privacy">
        <div className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-foreground shadow-lg">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h1 className="mb-3 text-foreground" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
                {isAr ? "سياسة الخصوصية" : "ENTIX.IO Privacy Policy"}
              </h1>
              <p className="text-muted-foreground" style={{ fontSize: "0.95rem" }}>
                {isAr ? "آخر تحديث: 14 أغسطس 2026" : "Last updated: August 14, 2026"}
              </p>
            </div>

            <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
              <h2 className="mb-3 text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                {isAr ? "من نحن" : "Who we are"}
              </h2>
              <p className="m-0 text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                {isAr
                  ? "ENTIX.IO هو منتج محاسبة وفوترة وذكاء اصطناعي مملوك لشركة سبيك بروز للاستثمار، سجل تجاري 3400010090، وتتم إدارته وتشغيله بواسطة ENSIDEX LLC. تشرح هذه السياسة كيف نتعامل مع بيانات مستخدمي المنصة وتطبيق iOS."
                  : "ENTIX.IO is an accounting, invoicing, and AI workflow product owned by شركة سبيك بروز للاستثمار, CR 3400010090, and operated and powered by ENSIDEX LLC. This policy explains how we handle information for platform and iOS app users and their organizations."}
              </p>
            </div>

            <div className="space-y-8">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <section key={section.title}>
                    <div className="mb-4 flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0 text-primary" />
                      <h2 className="m-0 text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{section.title}</h2>
                    </div>
                    <p className="text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>{section.body}</p>
                    <ul className="space-y-2 text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                      {section.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                );
              })}
            </div>

            <div className="mt-12 rounded-lg border border-primary/20 bg-primary/5 p-6">
              <h3 className="mb-3 text-foreground" style={{ fontSize: "1.1rem", fontWeight: 700 }}>{isAr ? "التواصل" : "Contact"}</h3>
              <p className="mb-2 text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                {isAr ? "لأسئلة الخصوصية أو طلبات البيانات:" : "For privacy questions or data requests:"}
              </p>
              <a href="mailto:privacy@entix.io" className="break-all text-primary font-english" style={{ fontSize: "0.95rem" }}>privacy@entix.io</a>
            </div>
          </div>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
