import { Link } from "react-router";
import {
  ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardCheck, FileSearch,
  FileText, Landmark, LockKeyhole, MessageSquare, Receipt, ShieldCheck,
  ShoppingBag, Store, Users, UtensilsCrossed, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";

type Localized = { ar: string; en: string };
type SolutionSlug = "small-business" | "enterprises" | "restaurants" | "ecommerce";
type Card = { icon: LucideIcon; title: Localized; description: Localized };
type SolutionData = {
  slug: SolutionSlug;
  pageMarker: `solutions-${SolutionSlug}`;
  icon: LucideIcon;
  eyebrow: Localized;
  title: Localized;
  intro: Localized;
  proof: Localized[];
  workflows: Card[];
  security: Localized;
  onboarding: Localized[];
};

const copy = (ar: string, en: string): Localized => ({ ar, en });

const SHARED_ONBOARDING = [
  copy("أنشئ مساحة العمل وأدخل بيانات المنشأة.", "Create a workspace and enter the organization profile."),
  copy("اضبط الدليل المحاسبي والضرائب والمستخدمين.", "Configure the chart of accounts, taxes, and users."),
  copy("ابدأ بالعمليات الحالية ثم راجع التقارير دورياً.", "Start with current transactions, then review reports on a regular cadence."),
];

const SOLUTIONS: Record<SolutionSlug, SolutionData> = {
  "small-business": {
    slug: "small-business", pageMarker: "solutions-small-business", icon: Store,
    eyebrow: copy("للشركات الصغيرة", "For small businesses"),
    title: copy("محاسبة يومية واضحة تنمو مع شركتك", "Clear daily accounting that grows with your business"),
    intro: copy("نظّم الفواتير والمصروفات والبنك والتقارير في مساحة عمل واحدة، من دون تحويل كل مهمة إلى مشروع تقني.", "Keep invoices, expenses, banking, and reports in one workspace without turning every task into an IT project."),
    proof: [copy("رؤية موحّدة للمبيعات والمشتريات والنقد", "One view of sales, purchases, and cash"), copy("عربية RTL وإنجليزية LTR", "Arabic RTL and English LTR"), copy("تصدير البيانات عند الحاجة", "Export data when needed")],
    workflows: [
      { icon: FileText, title: copy("الفواتير والتحصيل", "Invoices and collection"), description: copy("أنشئ الفواتير وتابع حالتها ومدفوعاتها.", "Create invoices and follow their status and payments.") },
      { icon: Receipt, title: copy("المصروفات والمشتريات", "Expenses and purchases"), description: copy("سجّل المصروفات وفواتير الموردين مع المستندات.", "Record expenses and supplier bills with supporting documents.") },
      { icon: Landmark, title: copy("البنك والتسوية", "Bank and reconciliation"), description: copy("راجع الحركات وطابقها مع سجلاتك المالية.", "Review transactions and reconcile them against your records.") },
      { icon: BarChart3, title: copy("تقارير القرار", "Decision reports"), description: copy("استخدم تقارير الربح والخسارة والتدفق النقدي للمراجعة.", "Review profit and loss and cash-flow reports.") },
    ],
    security: copy("صلاحيات المستخدمين وعزل بيانات كل منشأة ونسخ احتياطي تساعدك على تشغيل مساحة عمل مسؤولة.", "User permissions, organization data isolation, and backups support an accountable workspace."),
    onboarding: SHARED_ONBOARDING,
  },
  enterprises: {
    slug: "enterprises", pageMarker: "solutions-enterprises", icon: Building2,
    eyebrow: copy("للمؤسسات", "For enterprises"),
    title: copy("ضوابط مالية أوضح للفرق والفروع", "Clearer financial controls for teams and branches"),
    intro: copy("اجمع الفروع ومراكز التكلفة والمشاريع والتقارير ضمن هيكل محاسبي يمكن لفريقك مراجعته.", "Bring branches, cost centers, projects, and reports into an accounting structure your team can review."),
    proof: [copy("متابعة الفروع ومراكز التكلفة", "Branch and cost-center tracking"), copy("أدوار وصول للمستخدمين", "User access roles"), copy("تقارير قابلة للتصدير", "Exportable reports")],
    workflows: [
      { icon: Building2, title: copy("الفروع", "Branches"), description: copy("نظّم البيانات التشغيلية والمالية حسب الفرع.", "Organize operational and financial data by branch.") },
      { icon: Workflow, title: copy("مراكز التكلفة والمشاريع", "Cost centers and projects"), description: copy("تتبّع الأداء عبر أبعاد محاسبية عملية.", "Track performance across practical accounting dimensions.") },
      { icon: Users, title: copy("وصول الفريق", "Team access"), description: copy("وزّع الوصول بحسب مسؤوليات المستخدمين.", "Assign access according to user responsibilities.") },
      { icon: BarChart3, title: copy("المراجعة والتقارير", "Review and reporting"), description: copy("راجع القيود والتقارير وصدّر البيانات للتحليل.", "Review entries and reports, then export data for analysis.") },
    ],
    security: copy("عزل المنشآت وصلاحيات الأدوار وسجل العمليات المتاح في مسارات النظام تدعم المساءلة؛ ناقش المتطلبات الخاصة مع فريقنا قبل الشراء.", "Organization isolation, role permissions, and available operational records support accountability; discuss specialized requirements with our team before purchase."),
    onboarding: SHARED_ONBOARDING,
  },
  restaurants: {
    slug: "restaurants", pageMarker: "solutions-restaurants", icon: UtensilsCrossed,
    eyebrow: copy("للمطاعم والمقاهي", "For restaurants and cafés"),
    title: copy("راقب المبيعات والتكاليف والمخزون من دفتر واحد", "Review sales, costs, and inventory from one ledger"),
    intro: copy("رتّب الإيرادات والمشتريات والمصروفات وحركات المخزون لتفهم هامش التشغيل بصورة أفضل.", "Organize revenue, purchases, expenses, and stock movements to understand operating margin more clearly."),
    proof: [copy("منتجات ومخزون وحركات مخزنية", "Products, inventory, and stock movements"), copy("موردون ومشتريات ومصروفات", "Suppliers, purchases, and expenses"), copy("تقارير مالية دورية", "Periodic financial reports")],
    workflows: [
      { icon: Store, title: copy("تسجيل المبيعات", "Sales recording"), description: copy("سجّل المبيعات والفواتير ضمن دفتر المنشأة.", "Record sales and invoices in the organization ledger.") },
      { icon: ShoppingBag, title: copy("المشتريات والموردون", "Purchases and suppliers"), description: copy("تابع الفواتير والموردين والمدفوعات.", "Track bills, suppliers, and payments.") },
      { icon: Receipt, title: copy("التكلفة والمصروف", "Costs and expenses"), description: copy("صنّف مصروفات التشغيل وراجع أثرها.", "Classify operating expenses and review their impact.") },
      { icon: BarChart3, title: copy("هامش التشغيل", "Operating margin"), description: copy("استخدم التقارير لفهم الإيراد والتكلفة؛ تكاملات نقاط البيع الخارجية ليست وعداً ضمن هذه الصفحة.", "Use reports to understand revenue and cost; third-party POS integrations are not promised on this page.") },
    ],
    security: copy("احتفظ بالمستندات داخل مساحة المنشأة وحدد وصول الفريق؛ راجع أي متطلبات تكامل خاصة قبل الاعتماد.", "Keep documents in the organization workspace and limit team access; validate specialized integration needs before adoption."),
    onboarding: SHARED_ONBOARDING,
  },
  ecommerce: {
    slug: "ecommerce", pageMarker: "solutions-ecommerce", icon: ShoppingBag,
    eyebrow: copy("للتجارة الإلكترونية", "For ecommerce"),
    title: copy("دفتر مالي منظم للطلبات والمصروفات والمدفوعات", "An organized ledger for orders, expenses, and payments"),
    intro: copy("سجّل مبيعات المتجر ورسوم الدفع والمشتريات والمخزون، ثم سوِّ البنك وراجع الربحية.", "Record store sales, payment fees, purchases, and inventory, then reconcile banking and review profitability."),
    proof: [copy("فواتير ومنتجات ومخزون", "Invoices, products, and inventory"), copy("مصروفات ورسوم قابلة للتصنيف", "Classifiable expenses and fees"), copy("تسوية بنكية وتقارير", "Bank reconciliation and reports")],
    workflows: [
      { icon: ShoppingBag, title: copy("مبيعات المتجر", "Store sales"), description: copy("سجّل الفواتير والإيرادات بمرجع واضح.", "Record invoices and revenue with a clear reference.") },
      { icon: Receipt, title: copy("الرسوم والمصروفات", "Fees and expenses"), description: copy("صنّف رسوم الدفع والشحن والمصروفات التشغيلية.", "Classify payment, shipping, and operating expenses.") },
      { icon: Store, title: copy("المنتجات والمخزون", "Products and inventory"), description: copy("تابع الأصناف وحركات المخزون داخل النظام.", "Track items and stock movements in the system.") },
      { icon: Landmark, title: copy("التسوية والربحية", "Reconciliation and profitability"), description: copy("طابق البنك وراجع التقارير؛ ربط منصات المتاجر يعتمد على التكامل المتاح ويجب تأكيده.", "Reconcile banking and review reports; storefront connections depend on available integrations and must be confirmed.") },
    ],
    security: copy("بيانات المنشأة معزولة وقابلة للتصدير، مع وصول مستخدمين يمكن ضبطه بما يناسب مسؤوليات الفريق.", "Organization data is isolated and exportable, with user access configurable to team responsibilities."),
    onboarding: SHARED_ONBOARDING,
  },
};

function tx(language: "ar" | "en", value: Localized) {
  return value[language];
}

function SectionHeading({ eyebrow, title, description, inverse = false }: { eyebrow: string; title: string; description?: string; inverse?: boolean }) {
  return <div className="mx-auto mb-10 max-w-3xl text-center">
    <span data-heading-eyebrow className={`mb-3 inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${inverse ? "bg-white/15 text-white" : "bg-primary/5 text-primary"}`}>{eyebrow}</span>
    <h2 data-heading-title className={`text-2xl sm:text-3xl font-bold ${inverse ? "text-white" : "text-foreground"}`}>{title}</h2>
    {description && <p data-heading-description className={`mt-4 leading-8 ${inverse ? "text-white" : "text-muted-foreground"}`}>{description}</p>}
  </div>;
}

function SolutionShell({ data, children }: { data: SolutionData; children?: React.ReactNode }) {
  const { language, t } = useLanguage();
  const { isSA } = useMarketingRegion();
  const Icon = data.icon;
  const market = isSA
    ? t("للسوق السعودي: ضريبة القيمة المضافة وسير عمل الفوترة الإلكترونية والامتثال تحتاج إعداد المنشأة الصحيح ومراجعة المحاسب.", "For Saudi businesses: VAT, e-invoicing, and compliance workflows depend on correct organization setup and accountant review.")
    : t("للسوق الأمريكي: راجع ضريبة المبيعات وتتبع موردي 1099 والتسوية؛ تتوفر مسارات ربط بنكي بحسب التكامل والحساب.", "For US businesses: review sales tax, 1099 vendor tracking, and reconciliation; bank feeds depend on the available integration and account.");

  return <div className="min-h-screen overflow-x-clip bg-white" dir={language === "ar" ? "rtl" : "ltr"}>
    <SharedNavbar />
    <main data-page={data.pageMarker} dir={language === "ar" ? "rtl" : "ltr"}>
      <section data-section="hero" className="px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"><Icon className="h-4 w-4" />{tx(language, data.eyebrow)}</span>
            <h1 className="max-w-4xl text-3xl sm:text-5xl font-extrabold leading-tight text-foreground">{tx(language, data.title)}</h1>
            <p className="mt-6 max-w-3xl text-base sm:text-lg leading-8 text-muted-foreground">{tx(language, data.intro)}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white">{t("ابدأ مجاناً", "Start free")}<ArrowRight className="h-4 w-4" /></Link>
              <a href="#workflow" className="inline-flex items-center justify-center rounded-xl border-2 border-border px-6 py-3.5 font-semibold text-foreground">{t("استكشف سير العمل", "Explore the workflow")}</a>
            </div>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-foreground to-primary p-7 text-white shadow-2xl">
            <Icon className="h-9 w-9 text-white/80" />
            <h2 className="mt-5 text-xl font-bold">{t("مبني للعمل الحقيقي", "Built for real work")}</h2>
            <ul className="mt-5 space-y-4">{data.proof.map((item) => <li key={item.en} className="flex gap-3 text-white/80"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /><span>{tx(language, item)}</span></li>)}</ul>
          </div>
        </div>
      </section>
      <section data-section="role-proof" className="bg-muted/40 px-4 py-16 sm:px-6">
        <SectionHeading eyebrow={t("الاحتياج", "The use case")} title={t("مساحة عمل مترابطة بدل الملفات المتفرقة", "One connected workspace instead of scattered files")} />
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">{data.proof.map((item) => <div key={item.en} className="rounded-2xl border border-gray-100 bg-white p-6"><CheckCircle2 className="h-5 w-5 text-primary" /><p className="mt-4 font-semibold leading-7 text-foreground">{tx(language, item)}</p></div>)}</div>
      </section>
      <section data-section="workflow" id="workflow" className="px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading eyebrow={t("سير العمل", "Workflow")} title={t("من الإدخال إلى المراجعة", "From entry to review")} />
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.workflows.map((item) => <div key={item.title.en} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><item.icon className="h-6 w-6 text-primary" /><h3 className="mt-4 font-bold text-foreground">{tx(language, item.title)}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{tx(language, item.description)}</p></div>)}</div>
      </section>
      <section data-section="market-compliance" className="bg-foreground px-4 py-16 text-white sm:px-6"><div className="mx-auto max-w-4xl text-center"><ShieldCheck className="mx-auto h-8 w-8 text-secondary" /><h2 className="mt-4 text-2xl sm:text-3xl font-bold">{isSA ? t("السوق السعودي", "Saudi market") : t("السوق الأمريكي", "US market")}</h2><p className="mt-5 leading-8 text-white/75">{market}</p></div></section>
      <section data-section="security" className="px-4 py-16 sm:px-6"><div className="mx-auto max-w-5xl rounded-3xl border border-primary/10 bg-primary/5 p-7 sm:p-10"><LockKeyhole className="h-7 w-7 text-primary" /><h2 className="mt-4 text-2xl font-bold text-foreground">{t("الأمان والمساءلة", "Security and accountability")}</h2><p className="mt-4 leading-8 text-muted-foreground">{tx(language, data.security)}</p></div></section>
      <section data-section="onboarding" className="bg-muted/40 px-4 py-16 sm:px-6"><SectionHeading eyebrow={t("البدء", "Onboarding")} title={t("ابدأ بخطوات عملية", "Start with practical steps")} /><ol className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">{data.onboarding.map((item, index) => <li key={item.en} className="rounded-2xl bg-white p-6"><span className="text-sm font-bold text-primary">0{index + 1}</span><p className="mt-3 leading-7 text-foreground">{tx(language, item)}</p></li>)}</ol></section>
      {children}
      <section data-section="final-cta" className="px-4 py-16 pb-24 sm:px-6"><div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-foreground to-primary p-8 text-center text-white sm:p-12"><h2 className="text-2xl sm:text-3xl font-bold">{t("اختبر سير العمل على بياناتك", "Test the workflow with your own data")}</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-white/75">{t("ابدأ بمساحة عمل، وتحقق من الملاءمة والامتثال والتكاملات المطلوبة قبل الاعتماد الكامل.", "Start a workspace and validate fit, compliance, and required integrations before full adoption.")}</p><Link to="/register" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-bold text-foreground">{t("سجّل حساباً", "Sign up")}<ArrowRight className="h-4 w-4" /></Link></div></section>
    </main>
    <SharedFooter />
  </div>;
}

const ACCOUNTANT_WORKFLOW: Card[] = [
  { icon: Users, title: copy("محفظة العملاء", "Client portfolio"), description: copy("نظّم كل منشأة في مساحة مستقلة وانتقل بين أعمال العملاء من حسابك. تحقّق من خطة الاشتراك المناسبة لعدد المنشآت والمستخدمين.", "Keep each organization in a separate workspace and move between client work from your account. Confirm the right plan for organization and user counts.") },
  { icon: FileSearch, title: copy("مراجعة الإيصالات والفواتير", "Receipt and invoice review"), description: copy("اجمع المستندات مع المصروفات والمشتريات والفواتير، ثم راجع التصنيف والضريبة قبل الترحيل أو التقرير.", "Keep documents with expenses, purchases, and invoices, then review classification and tax before posting or reporting.") },
  { icon: ClipboardCheck, title: copy("الاعتمادات وضوابط المسودة", "Approvals and draft controls"), description: copy("استخدم حالات المسودة والمراجعة المتاحة حالياً. مسارات اعتماد متعددة المراحل وسياسات مكاتب المحاسبة الأوسع ضمن خارطة الطريق وليست ميزة موعودة الآن.", "Use the draft and review states available today. Multi-stage approval chains and broader firm policies are roadmap items, not promised current features.") },
  { icon: MessageSquare, title: copy("التقارير والتعاون", "Reporting and collaboration"), description: copy("شارك العمل عبر صلاحيات المستخدمين وراجع دفتر الأستاذ وميزان المراجعة والتقارير المالية، مع إمكانية تصدير البيانات.", "Collaborate through user permissions and review the ledger, trial balance, financial reports, and exportable data.") },
];

function AccountantsPage() {
  const { language, t } = useLanguage();
  const { isSA } = useMarketingRegion();
  const faq = isSA ? [
    copy("هل تغني المنصة عن مسؤولية المحاسب؟", "Does the platform replace accountant responsibility?"),
    copy("لا. ENTIX.IO يساعد في التسجيل والمراجعة والتقارير، بينما يبقى المحاسب والمنشأة مسؤولين عن صحة البيانات والإقرارات والامتثال.", "No. ENTIX.IO supports recordkeeping, review, and reports; the accountant and business remain responsible for data accuracy, filings, and compliance."),
    copy("كيف يدعم السوق السعودي؟", "How does it support the Saudi market?"),
    copy("يوفر مسارات لضريبة القيمة المضافة والفوترة الإلكترونية الجاهزة لـ ZATCA. يلزم إعداد بيانات المنشأة والشهادة والمراجعة المهنية وفق حالة العميل.", "It provides VAT and ZATCA-ready e-invoicing workflows. Organization details, certificates, and professional review must be configured for each client."),
  ] : [
    copy("هل تغني المنصة عن مسؤولية المحاسب؟", "Does the platform replace accountant responsibility?"),
    copy("لا. تساعد المنصة في حفظ السجلات والتقارير، ولا تقدم إقراراً بأن الضرائب أو النماذج تُقدَّم تلقائياً نيابة عن العميل.", "No. The platform supports records and reports; it does not claim that taxes or forms are automatically filed for a client."),
    copy("ما المسارات المتاحة للسوق الأمريكي؟", "What US workflows are available?"),
    copy("ضريبة المبيعات وتتبع موردي 1099 ومسارات الحسابات البنكية والتسوية. يعتمد الربط البنكي على حساب وتكامل متاح، وتبقى مراجعة القواعد حسب الولاية مسؤولية مهنية.", "Sales tax, 1099 vendor tracking, bank-account workflows, and reconciliation. Bank feeds depend on an available account and integration, and state rules still require professional review."),
  ];

  const data: SolutionData = {
    slug: "small-business", pageMarker: "solutions-small-business", icon: ClipboardCheck,
    eyebrow: copy("حلول المحاسبين", "Solutions for accountants"),
    title: copy("مساحة عمل تجعل المحاسب مسيطراً على المراجعة والقرار", "An accountant workspace that keeps review and decisions under control"),
    intro: isSA
      ? copy("رتّب أعمال العملاء والمستندات والقيود والتقارير في نظام عربي وإنجليزي، مع مسارات امتثال مناسبة للسوق السعودي.", "Organize client work, documents, entries, and reports in an Arabic and English system with compliance workflows for the selected market.")
      : copy("رتّب أعمال العملاء والمستندات والقيود والتقارير في نظام عربي وإنجليزي، مع ضريبة المبيعات و1099 ومسارات البنوك للسوق الأمريكي.", "Organize client work, documents, entries, and reports in an Arabic and English system with sales tax, 1099, and banking workflows for the selected US market."),
    proof: [copy("مساحات مستقلة لبيانات المنشآت", "Separate organization workspaces"), copy("مستندات وقيود وتقارير مترابطة", "Connected documents, entries, and reports"), copy("ضوابط حالية وخارطة طريق واضحة", "Current controls and a clearly labeled roadmap")],
    workflows: ACCOUNTANT_WORKFLOW,
    security: copy("تعتمد المساءلة على عزل بيانات كل منشأة وصلاحيات المستخدمين والجلسات الآمنة والنسخ الاحتياطية والتصدير. لا نعد بوصول غير محدود أو أتمتة ذكاء اصطناعي بلا مراجعة.", "Accountability is supported by organization data isolation, user permissions, secure sessions, backups, and export. We do not promise unlimited access or unreviewed AI automation."),
    onboarding: [copy("أنشئ حسابك وحدد السوق واللغة بشكل مستقل.", "Create your account and select market and language independently."), copy("أنشئ مساحة لكل عميل واضبط الدليل والضرائب والصلاحيات.", "Create each client workspace and configure accounts, taxes, and permissions."), copy("استورد أو أدخل الأرصدة والمستندات، ثم نفّذ مراجعة قبل الاعتماد.", "Import or enter balances and documents, then complete a review before reliance.")],
  };

  return <div className="min-h-screen overflow-x-clip bg-white" dir={language === "ar" ? "rtl" : "ltr"}>
    <SharedNavbar />
    <main data-page="solutions-accountants" dir={language === "ar" ? "rtl" : "ltr"}>
      <section data-section="hero" className="px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-20"><div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_.85fr]"><div><span className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"><ClipboardCheck className="h-4 w-4" />{tx(language, data.eyebrow)}</span><h1 className="text-3xl sm:text-5xl font-extrabold leading-tight text-foreground">{tx(language, data.title)}</h1><p className="mt-6 max-w-3xl text-base sm:text-lg leading-8 text-muted-foreground">{tx(language, data.intro)}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white">{t("سجّل حساباً", "Sign up")}<ArrowRight className="h-4 w-4" /></Link><a href="#accountant-workflow" className="inline-flex items-center justify-center rounded-xl border-2 border-border px-6 py-3.5 font-semibold text-foreground">{t("استكشف سير عمل المحاسب", "Explore the accountant workflow")}</a></div></div><div className="rounded-3xl bg-gradient-to-br from-foreground to-primary p-7 text-white shadow-2xl"><Workflow className="h-9 w-9 text-secondary" /><h2 className="mt-5 text-xl font-bold">{t("من المستند إلى المراجعة", "From document to review")}</h2><ul className="mt-5 space-y-4">{data.proof.map((item) => <li key={item.en} className="flex gap-3 text-white/80"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />{tx(language, item)}</li>)}</ul></div></div></section>
      <section data-section="role-proof" className="bg-muted/40 px-4 py-16 sm:px-6"><SectionHeading eyebrow={t("دور المحاسب", "The accountant's role")} title={t("المراجعة المهنية تبقى في مركز سير العمل", "Professional review stays at the center of the workflow")} description={t("تجمع المنصة السجلات والمستندات والتقارير لتقليل التشتت، لكنها لا تستبدل الحكم المهني أو مسؤولية الامتثال.", "The platform brings records, documents, and reports together to reduce fragmentation; it does not replace professional judgment or compliance responsibility.")} /><div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">{data.proof.map((item) => <div key={item.en} className="rounded-2xl border border-gray-100 bg-white p-6"><CheckCircle2 className="h-5 w-5 text-primary" /><p className="mt-4 font-semibold leading-7 text-foreground">{tx(language, item)}</p></div>)}</div></section>
      <section data-section="workflow" id="accountant-workflow" className="px-4 py-16 sm:px-6 sm:py-20"><SectionHeading eyebrow={t("سير عمل المحاسب", "Accountant workflow")} title={t("أربع نقاط تحكم عملية", "Four practical control points")} /><div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2">{ACCOUNTANT_WORKFLOW.map((item) => <article key={item.title.en} className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 shadow-sm"><item.icon className="h-7 w-7 text-primary" /><h3 className="mt-4 text-lg font-bold text-foreground">{tx(language, item.title)}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{tx(language, item.description)}</p></article>)}</div></section>
      <section data-section="market-compliance" className="bg-foreground px-4 py-16 text-white sm:px-6"><div className="mx-auto max-w-5xl"><SectionHeading inverse eyebrow={t("السوق والامتثال", "Market and compliance")} title={isSA ? t("السعودية: ضريبة القيمة المضافة وجاهزية ZATCA", "Saudi Arabia: VAT and ZATCA readiness") : t("الولايات المتحدة: ضريبة المبيعات و1099 وربط البنوك", "United States: sales tax, 1099, and bank feeds")} description={isSA ? t("راجع ملف العميل الضريبي وإعدادات الفاتورة وشهادة المنشأة قبل الاعتماد. توفر ENTIX.IO مسارات فوترة إلكترونية وVAT جاهزة للمراجعة، ولا تستبدل الإقرار أو الاستشارة المهنية.", "Review the client's tax profile, invoice settings, and organization certificate before reliance. ENTIX.IO provides VAT and ZATCA-ready e-invoicing workflows for review; it does not replace filing or professional advice.") : t("راجع قواعد ضريبة المبيعات حسب الولاية، وتتبع موردي 1099، وسوِّ الحركات البنكية. تتوفر bank feeds بحسب الحساب والتكامل، ولا تتضمن الصفحة ادعاء تقديم الإقرارات تلقائياً.", "Review state-specific sales tax rules, track 1099 vendors, and reconcile transactions. Bank feeds depend on the account and available integration; this page does not claim automatic tax filing.")} /></div></section>
      <section data-section="security" className="px-4 py-16 sm:px-6"><div className="mx-auto grid max-w-5xl gap-6 rounded-3xl border border-primary/10 bg-primary/5 p-7 sm:grid-cols-[auto_1fr] sm:p-10"><LockKeyhole className="h-8 w-8 text-primary" /><div><h2 className="text-2xl font-bold text-foreground">{t("الأمان والمساءلة", "Security and accountability")}</h2><p className="mt-4 leading-8 text-muted-foreground">{tx(language, data.security)}</p></div></div></section>
      <section data-section="onboarding" className="bg-muted/40 px-4 py-16 sm:px-6"><SectionHeading eyebrow={t("تهيئة المكتب", "Firm onboarding")} title={t("ابدأ بعميل واحد وسير مراجعة واضح", "Start with one client and a clear review cycle")} /><ol className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">{data.onboarding.map((item, index) => <li key={item.en} className="rounded-2xl bg-white p-6"><span className="text-sm font-bold text-primary">0{index + 1}</span><p className="mt-3 leading-7 text-foreground">{tx(language, item)}</p></li>)}</ol></section>
      <section data-section="faq" className="px-4 py-16 sm:px-6"><SectionHeading eyebrow={t("الأسئلة الشائعة", "FAQ")} title={t("ما يجب تأكيده قبل الاعتماد", "What to confirm before adoption")} /><div className="mx-auto max-w-4xl space-y-4">{[0, 2].map((index) => <details key={faq[index].en} className="rounded-2xl border border-gray-100 bg-white p-6" open={index === 0}><summary className="cursor-pointer font-bold text-foreground">{tx(language, faq[index])}</summary><p className="mt-4 leading-8 text-muted-foreground">{tx(language, faq[index + 1])}</p></details>)}</div></section>
      <section data-section="final-cta" className="px-4 py-16 pb-24 sm:px-6"><div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-foreground to-primary p-8 text-center text-white sm:p-12"><ShieldCheck className="mx-auto h-8 w-8 text-white/80" /><h2 className="mt-4 text-2xl sm:text-3xl font-bold">{t("جرّب سير عمل عميل واحد أولاً", "Pilot one client workflow first")}</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-white/75">{t("تحقق من البيانات والصلاحيات والامتثال والتكاملات المطلوبة، ثم وسّع الاستخدام بناءً على نتيجة المراجعة.", "Validate data, permissions, compliance, and required integrations, then expand based on the review outcome.")}</p><div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-bold text-foreground">{t("سجّل حساباً", "Sign up")}<ArrowRight className="h-4 w-4" /></Link><a href="#accountant-workflow" className="rounded-xl border border-white/30 px-7 py-3.5 font-semibold text-white">{t("سير عمل المحاسب", "Accountant workflow")}</a></div></div></section>
    </main>
    <SharedFooter />
  </div>;
}

export function SolutionsAccountants() { return <AccountantsPage />; }
export function SolutionsSmallBusiness() { return <SolutionShell data={SOLUTIONS["small-business"]} />; }
export function SolutionsEnterprises() { return <SolutionShell data={SOLUTIONS.enterprises} />; }
export function SolutionsRestaurants() { return <SolutionShell data={SOLUTIONS.restaurants} />; }
export function SolutionsEcommerce() { return <SolutionShell data={SOLUTIONS.ecommerce} />; }
