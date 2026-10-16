import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { FileText, Users, CreditCard, AlertTriangle, Scale, RefreshCw, Database, ShieldAlert, CloudOff, HandCoins, Ban, Gavel } from "lucide-react";
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
    body: "Entix Books provides tools for invoices, expenses, reports, OCR, reconciliation, and AI-assisted workflows. Outputs must be reviewed before use.",
    items: [
      "AI, OCR, categorization, tax, and reconciliation suggestions may be incomplete or incorrect.",
      "Entix Books is not a law firm, CPA firm, tax advisor, or financial advisor.",
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
      "Refunds follow our Refund Policy at entix.io/refund, including a 30-day money-back guarantee on your first paid subscription.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "5. Acceptable use",
    body: "Do not misuse Entix Books, interfere with the service, upload unlawful content, abuse automation, or attempt unauthorized access.",
    items: [
      "Do not process payment, bank, identity, or customer data without proper authority.",
      "Do not reverse engineer, scrape, overload, or bypass product limits.",
      "Do not use the service for fraud, deceptive invoicing, money laundering, or prohibited businesses.",
    ],
  },
  {
    icon: Scale,
    title: "6. Governing entity and contact",
    body: "Entix Books is owned and operated by ENSIDEX LLC, a Wyoming limited liability company, 30 N Gould St Ste R, Sheridan, WY 82801, United States. Purchases made through an authorized reseller are also subject to that reseller's sales terms.",
    items: [
      "Questions: legal@entix.io.",
      "Privacy questions: privacy@entix.io.",
      "Support questions: support@entix.io.",
    ],
  },
  {
    icon: Database,
    title: "7. Your data, retention, and backups",
    body: "You own your business data. We process it to provide the service, keep daily encrypted backups, and never sell it to anyone.",
    items: [
      "You can export your data at any time from Settings before closing an account.",
      "After account deletion, data is purged after a 30-day grace period, except records we must keep for legal, tax, accounting, security, or dispute reasons (kept isolated, minimum necessary).",
      "Backups run daily with a 14-day retention window; they exist for disaster recovery, not as a substitute for your own exports.",
    ],
  },
  {
    icon: CloudOff,
    title: "8. Availability, maintenance, and errors",
    body: "We target high availability for a cloud accounting service, but the service is provided as-is and as-available, and uninterrupted or error-free operation is not guaranteed.",
    items: [
      "Planned maintenance is announced in-app whenever reasonably possible.",
      "Third-party dependencies (Stripe, Plaid, ZATCA portals, email delivery, AI providers, Cloudflare) may fail independently of us.",
      "Known defects are fixed on a commercially reasonable effort basis; critical data-integrity issues take priority.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "9. Security incidents and breach notification",
    body: "We run layered security (encryption in transit and at rest, hashed passwords, role isolation, activity logs). If a confirmed breach affects your data, we tell you.",
    items: [
      "We will notify affected customers by email without undue delay after confirming a personal-data breach, describing what happened, what data was affected, and what we are doing about it.",
      "You are responsible for securing your own devices, sessions, invited users, and API keys.",
      "Report vulnerabilities to security@entix.io — good-faith security research is welcomed, not prosecuted.",
    ],
  },
  {
    icon: HandCoins,
    title: "10. Limitation of liability",
    body: "To the maximum extent permitted by law, Entix Books, its owners, and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, lost profits, lost data, lost filings, penalties, or business interruption.",
    items: [
      "Our total aggregate liability for any claim is capped at the amounts you paid us for the service in the 12 months before the event giving rise to the claim (or USD 100 if you paid nothing).",
      "Nothing limits liability that cannot legally be limited (willful misconduct, gross negligence, or non-waivable consumer rights).",
      "You remain responsible for reviewing AI outputs, tax filings, payroll runs, and financial statements before relying on them.",
    ],
  },
  {
    icon: Ban,
    title: "11. Suspension and termination",
    body: "We may suspend or terminate access for non-payment, abuse, security risk, unlawful use, or repeated terms violations — with notice when reasonably possible.",
    items: [
      "You may terminate at any time from the billing portal; access continues until the end of the paid period.",
      "On termination we stop charging; already-incurred fees are non-refundable except where required by law or under the Refund Policy.",
      "We may retain and use anonymized, aggregated data that no longer identifies you or your customers.",
    ],
  },
  {
    icon: Gavel,
    title: "12. Governing law and disputes",
    body: "These terms are governed by the laws of the State of Wyoming, USA, without regard to conflict-of-law rules, except where mandatory local law applies (including Saudi regulations for Saudi-established entities and ZATCA data requirements).",
    items: [
      "The parties first attempt to resolve disputes amicably within 30 days of written notice.",
      "For US customers: exclusive venue is the state and federal courts of Wyoming. For Saudi establishments: the competent courts of Saudi Arabia, unless the parties agree otherwise in writing.",
      "If any provision is held unenforceable, the rest of these terms stays in force.",
    ],
  },
  {
    icon: FileText,
    title: "13. Changes to these terms",
    body: "We may update these terms as the product and the law change. The date at the top of this page always shows the current version.",
    items: [
      "Material changes are announced by email or in-app before they take effect.",
      "Continuing to use Entix Books after a change takes effect means you accept the updated terms; if you do not agree, you can cancel and export your data.",
    ],
  },
];

const arSections = [
  {
    icon: Users,
    title: "1. الحسابات والمنشآت",
    body: "أنت مسؤول عن حسابك والمستخدمين الذين تضيفهم وبيانات المنشأة والصلاحيات والنشاط الذي يتم عبر بيانات دخولك.",
    items: [
      "استخدم بيانات شركة وفوترة صحيحة.",
      "حافظ على سرية بيانات الدخول ومفاتيح API وربط البنوك ومزودي الدفع.",
      "لا ترفع مستندات أو بيانات لا تملك حق معالجتها.",
    ],
  },
  {
    icon: FileText,
    title: "2. المحاسبة ومخرجات الذكاء الاصطناعي",
    body: "يوفر Entix Books أدوات للفواتير والمصروفات والتقارير وOCR والتسوية والذكاء الاصطناعي، ويجب مراجعة المخرجات قبل الاعتماد عليها.",
    items: [
      "اقتراحات الذكاء والتصنيف والضرائب والتسوية قد تكون ناقصة أو غير صحيحة.",
      "Entix Books ليس مكتب محاماة أو محاسب قانوني أو مستشار ضريبي أو مالي.",
      "أنت مسؤول عن الإقرارات والدفاتر والمدفوعات والسجلات النهائية.",
    ],
  },
  {
    icon: CreditCard,
    title: "3. الاشتراكات والمدفوعات والخدمات الخارجية",
    body: "قد تتطلب بعض الميزات اشتراكاً أو رسوم استخدام أو حساب مزود دفع أو ربط بنك أو خدمة خارجية.",
    items: [
      "Stripe وPlaid وMercury وDocuSeal وخدمات البريد وغيرها تخضع لشروطها الخاصة.",
      "الرسوم تظهر في صفحة الدفع أو الباقة أو الاتفاقية المكتوبة.",
      "قد نعدل الأسعار بإشعار مناسب للعملاء النشطين عند الحاجة.",
    ],
  },
  {
    icon: RefreshCw,
    title: "4. الإلغاء وتصدير البيانات",
    body: "يمكنك إلغاء الخدمات المدفوعة حسب شروط الباقة، ونسعى لدعم تصدير البيانات بشكل معقول قبل الحذف أو إغلاق الحساب.",
    items: [
      "الإلغاء لا يعني حذف السجلات المطلوبة قانونياً أو محاسبياً أو أمنياً أو للنزاعات.",
      "الاسترداد يخضع لسياسة الاسترداد على entix.io/refund، ومنها ضمان استرداد خلال 30 يومًا لأول اشتراك مدفوع.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "5. الاستخدام المقبول",
    body: "لا تستخدم Entix Books بطريقة تسيء للخدمة أو تعطلها أو تخالف الأنظمة أو تتجاوز الصلاحيات.",
    items: [
      "لا تعالج بيانات دفع أو بنك أو هوية أو عملاء بدون صلاحية.",
      "لا تحاول عكس الهندسة أو السحب الآلي أو تجاوز حدود المنتج.",
      "لا تستخدم الخدمة للاحتيال أو الفوترة المضللة أو غسل الأموال أو الأنشطة المحظورة.",
    ],
  },
  {
    icon: Scale,
    title: "6. الكيان والتواصل",
    body: "Entix Books مملوكة لشركة ENSIDEX LLC وتديرها، وهي شركة ذات مسؤولية محدودة مسجلة في ولاية وايومنغ، 30 N Gould St Ste R, Sheridan, WY 82801، الولايات المتحدة. وتخضع المشتريات عبر موزّع معتمد أيضًا لشروط البيع الخاصة بذلك الموزّع.",
    items: [
      "الأسئلة القانونية: legal@entix.io.",
      "أسئلة الخصوصية: privacy@entix.io.",
      "الدعم: support@entix.io.",
    ],
  },
  {
    icon: Database,
    title: "7. بياناتك والاحتفاظ والنسخ الاحتياطي",
    body: "بيانات منشأتك ملك لك. نعالجها لتقديم الخدمة، ونحتفظ بنسخ احتياطية يومية مشفرة، ولا نبيعها لأي طرف.",
    items: [
      "يمكنك تصدير بياناتك في أي وقت من الإعدادات قبل إغلاق الحساب.",
      "بعد حذف الحساب تُمحى البيانات بعد فترة سماح 30 يومًا، باستثناء ما يلزم الاحتفاظ به نظامًا للأغراض القانونية أو الضريبية أو المحاسبية أو الأمنية أو النزاعات (يُحفظ معزولًا وبأقل قدر).",
      "النسخ الاحتياطي يومي بنافذة استرجاع 14 يومًا — وهو للطوارئ ولا يغني عن تصديرك الدوري.",
    ],
  },
  {
    icon: CloudOff,
    title: "8. التوفر والصيانة والأخطاء",
    body: "نستهدف توفرًا عاليًا لخدمة محاسبة سحابية، لكن الخدمة تُقدَّم «كما هي» و«حسب التوفر»، ولا نضمن عملًا متواصلًا أو خاليًا من الأخطاء.",
    items: [
      "الصيانة المجدولة تُعلن داخل التطبيق متى أمكن ذلك.",
      "الأطراف الخارجية (Stripe وPlaid وبوابات ZATCA والبريد ومزودو الذكاء وCloudflare) قد تتعطل مستقلًا عنا.",
      "الأخطاء المعروفة تُعالج بجهد تجاري معقول، وقضايا سلامة البيانات الحرجة لها الأولوية.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "9. الحوادث الأمنية والإبلاغ عن الاختراق",
    body: "نشغّل أمنًا متعدد الطبقات (تشفير أثناء النقل وفي التخزين، كلمات سر مخزّنة مشفرة، عزل صلاحيات، سجلات نشاط). وإن وقع اختراق مؤكد يمس بياناتك نُعلمك.",
    items: [
      "سنخطر العملاء المتأثرين بالبريد دون تأخير غير مبرر بعد تأكيد اختراق بيانات شخصية، موضحين ماذا حدث وأي بيانات تأثرت وما نفعله حياله.",
      "أنت مسؤول عن تأمين أجهزتك وجلساتك والمستخدمين الذين تدعوهم ومفاتيح API الخاصة بك.",
      "بلّغ الثغرات إلى security@entix.io — البحث الأمني بحسن نية مرحّب به ولا يُلاحق.",
    ],
  },
  {
    icon: HandCoins,
    title: "10. حدود المسؤولية",
    body: "بالقدر الذي يسمح به النظام، لا تتحمل Entix Books ومالكوها ومشغلوها أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو عقابية، أو فقدان أرباح أو بيانات أو إقرارات، أو غرامات، أو توقف أعمال.",
    items: [
      "سقف مسؤوليتنا الإجمالية عن أي مطالبة هو ما دفعته لنا عن الخدمة خلال الاثني عشر شهرًا السابقة للحدث محل المطالبة (أو 100 دولار أمريكي إن لم تدفع شيئًا).",
      "لا تحد هذه الشروط مسؤولية لا يجوز تحديدها نظامًا (سوء النية المتعمد، الإهمال الجسيم، حقوق مستهلك غير قابلة للتنازل).",
      "تبقى مسؤولًا عن مراجعة مخرجات الذكاء والإقرارات الضريبية ومسيرات الرواتب والقوائم المالية قبل الاعتماد عليها.",
    ],
  },
  {
    icon: Ban,
    title: "11. التعليق والإنهاء",
    body: "يجوز لنا تعليق أو إنهاء الوصول لعدم السداد أو إساءة الاستخدام أو خطر أمني أو استخدام غير نظامي أو مخالفات متكررة — مع إشعار متى أمكن.",
    items: [
      "يمكنك الإنهاء في أي وقت من بوابة الفوترة؛ ويستمر الوصول حتى نهاية الفترة المدفوعة.",
      "عند الإنهاء نوقف التحصيل؛ والرسوم المستحقة سابقًا غير قابلة للاسترداد إلا إذا أوجب النظام أو وفق سياسة الاسترداد.",
      "يجوز لنا الاحتفاظ ببيانات مجمعة مجهولة الهوية لا تُعرّف بك أو بعملائك واستخدامها.",
    ],
  },
  {
    icon: Gavel,
    title: "12. القانون الحاكم والنزاعات",
    body: "تخضع هذه الشروط لقوانين ولاية وايومنغ بالولايات المتحدة دون إعمال قواعد تنازع القوانين، باستثناء ما توجبه الأنظمة المحلية الإلزامية (ومنها الأنظمة السعودية للمنشآت السعودية ومتطلبات بيانات ZATCA).",
    items: [
      "يحاول الطرفان حل أي نزاع وديًا خلال 30 يومًا من إشعار كتابي.",
      "لعملاء أمريكا: الاختصاص الحصري لمحاكم وايومنغ. للمنشآت السعودية: المحاكم المختصة في السعودية، ما لم يتفق كتابيًا على غير ذلك.",
      "إن بُطل حكم من هذه الشروط، يبقى الباقي نافذًا.",
    ],
  },
  {
    icon: FileText,
    title: "13. تعديل هذه الشروط",
    body: "قد نحدّث هذه الشروط مع تطور المنتج والأنظمة، والتاريخ أعلى الصفحة يوضح النسخة السارية دائمًا.",
    items: [
      "نُعلن التعديلات الجوهرية بالبريد أو داخل التطبيق قبل سريانها.",
      "استمرارك في استخدام Entix Books بعد سريان التعديل يعني قبولك له، وإن لم توافق يمكنك الإلغاء وتصدير بياناتك.",
    ],
  },
];

export function Terms() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const sections = isAr ? arSections : enSections;

  return (
    <div className="min-h-screen bg-card" dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: isAr ? "var(--entix-font-ar)" : "var(--entix-font-en)" }}>
      <SharedNavbar />
      <main>

      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-foreground flex items-center justify-center shadow-lg">
              <Scale className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-foreground mb-3" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800 }}>
              {isAr ? "الشروط والأحكام" : "Entix Books Terms of Service"}
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: "0.95rem" }}>
              {isAr ? "آخر تحديث: 16 أكتوبر 2026" : "Last updated: October 16, 2026"}
            </p>
          </div>

          <div className="bg-surface-subtle rounded-lg p-6 mb-8 border border-border">
            <p className="text-foreground/80 m-0" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
              {isAr
                ? "باستخدامك Entix Books، فإنك توافق على هذه الشروط. إذا كنت تستخدم الخدمة نيابة عن منشأة، فأنت تؤكد أن لديك الصلاحية لإلزامها بهذه الشروط."
                : "By using Entix Books, you agree to these Terms. If you use the service on behalf of a company, you confirm that you are authorized to bind that company to these Terms."}
            </p>
          </div>

          <div className="space-y-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.title}>
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-5 h-5 text-foreground" />
                    <h2 className="text-foreground m-0" style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-foreground/80" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                    {section.body}
                  </p>
                  <ul className="text-foreground/80 space-y-2" style={{ fontSize: "0.95rem", lineHeight: 1.8 }}>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

        </div>
      </div>
      </main>


      <SharedFooter />
    </div>
  );
}
