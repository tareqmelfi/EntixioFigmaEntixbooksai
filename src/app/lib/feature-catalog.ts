import { Globe, FileText, Calculator, Users, BarChart3, CreditCard, Shield, Brain, Package, Building2, Wallet, Layers, Target, Plug, Landmark, type LucideIcon } from "lucide-react";

// ── Types ──
export type FeatureStatus = "live" | "partial" | "planned" | "phase2" | "phase3";

export interface Feature {
  name: string;
  nameEn?: string;
  status: FeatureStatus;
  description: string;
  descEn?: string;
  details?: string[];
  detailsEn?: string[];
  critical?: boolean;
}

export interface FeatureModule {
  title: string;
  titleEn?: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  features: Feature[];
}


// Shared public/internal capability catalog. Availability is not a compliance certification.
export const modules: FeatureModule[] = [
  {
    title: "المحاسبة العامة",
    titleEn: "General Ledger",
    icon: Calculator,
    color: "text-foreground",
    bgColor: "bg-foreground/10",
    features: [
      { name: "دليل الحسابات", nameEn: "Chart of Accounts", status: "live", description: "شجرة حسابات متعددة المستويات مع إمكانية التوسيع والطي", descEn: "Multi-level account tree with expand/collapse", details: ["هيكل شجري تفاعلي", "تصنيفات: أصل / التزام / حقوق ملكية / إيراد / مصروف", "بحث وفلترة متقدمة", "KPI cards قابلة للنقر مع فلترة الشجرة"], detailsEn: ["Interactive tree structure", "Categories: Asset / Liability / Equity / Revenue / Expense", "Advanced search and filtering", "Clickable KPI cards with tree filtering"] },
      { name: "قوالب GAAP / IFRS", nameEn: "GAAP / IFRS Templates", status: "partial", description: "قوالب معيارية حسب نوع النشاط التجاري", descEn: "Standard templates by business activity type", details: ["قالب أساسي موجود", "يحتاج: قوالب جاهزة حسب القطاع (تقنية / تجزئة / مقاولات / خدمات)"], detailsEn: ["Basic template available", "Needs: ready-made templates by sector (tech / retail / contracting / services)"], critical: true },
      { name: "قيود اليومية", nameEn: "Journal Entries", status: "live", description: "إنشاء وإدارة قيود يدوية مع workflow كامل", descEn: "Create and manage manual journal entries with full workflow", details: ["مسودة → مرحّل → ملغي", "التحقق من التوازن (مدين = دائن)", "ربط بمراكز التكلفة", "عرض تفاصيل القيد"], detailsEn: ["Draft → Posted → Cancelled", "Balance validation (debit = credit)", "Link to cost centers", "View entry details"] },
      { name: "مراكز التكلفة", nameEn: "Cost Centers", status: "live", description: "تتبع المصاريف والإيرادات حسب مركز التكلفة", descEn: "Track expenses and revenue by cost center", details: ["متاح في كل سطر قيد", "تقارير حسب مركز التكلفة في التقارير"], detailsEn: ["Available on every entry line", "Cost center reports in Reports"] },
      { name: "هيكل مراكز تكلفة متعدد المستويات", nameEn: "Multi-level Cost Center Structure", status: "planned", description: "هيكل هرمي لمراكز التكلفة مع تقارير مفصلة", descEn: "Hierarchical cost center structure with detailed reports", critical: true },
      { name: "تعدد العملات", nameEn: "Multi-currency", status: "partial", description: "دعم عملات متعددة مع تحويل سعر الصرف", descEn: "Support multiple currencies with exchange rate conversion", details: ["عملة المستند وعملة الحساب والمبلغ المدفوع فعليًا", "تسجيل فروقات الصرف والرسوم بحسب المعالجة المختارة", "أسعار الصرف الآلية تعتمد على إعداد المزود؛ راجع السعر"], detailsEn: ["Document currency, account currency and actual payment", "Exchange differences and fees follow the selected treatment", "Automatic rates depend on provider configuration; review the rate"], critical: true },
      { name: "السنة المالية", nameEn: "Fiscal Year", status: "live", description: "إدارة الفترات المالية مع إقفال وفتح الفترات", descEn: "Manage fiscal periods with closing and opening", details: ["تهيئة فترات السنة", "قفل / فتح الفترة", "معاينة الإقفال قبل التنفيذ ثم الإقفال"], detailsEn: ["Initialize year periods", "Lock / unlock a period", "Preview a close before committing, then close"] },
    ],
  },
  {
    title: "المبيعات",
    titleEn: "Sales",
    icon: FileText,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "فواتير المبيعات", nameEn: "Sales Invoices", status: "live", description: "إنشاء وإدارة فواتير المبيعات بالكامل", descEn: "Full creation and management of sales invoices", details: ["إنشاء / تعديل / عرض / حذف", "بنود ذكية مع ضريبة القيمة المضافة", "حالات: مسودة / مرسلة / مدفوعة / متأخرة", "بحث + فلتر بالحالة", "KPI cards قابلة للنقر"], detailsEn: ["Create / edit / view / delete", "Smart line items with VAT", "Statuses: draft / sent / paid / overdue", "Search + filter by status", "Clickable KPI cards"] },
      { name: "قالب فاتورة محلي + QR بيانات أساسية", nameEn: "Local invoice template + core-data QR", status: "live", description: "قالب طباعة محلي بشعار وختم المنشأة · ضريبة لكل بند · QR محلي بخمسة عناصر TLV للبيانات الأساسية · معاينة حية · اسم PDF تلقائي. القالب ليس رسمياً أو معتمداً من ZATCA.", descEn: "Local print template with organization logo and stamp · per-line tax · local five-tag TLV QR for core data · live preview · automatic PDF filename. ZATCA has not stamped or approved this template.", details: ["المستند غير مختوم من ZATCA وغير مفعّل للاعتماد الإنتاجي", "شروط وأحكام عامة افتراضية قابلة للتخصيص"], detailsEn: ["The document is not ZATCA-stamped and is not enabled for production reliance", "Customizable default terms and conditions"] },
      { name: "اقتراح ذكي للبنود", nameEn: "Smart line-item suggestions", status: "planned", description: "اقتراح تلقائي من قاعدة المنتجات عند الكتابة", descEn: "Auto-suggest from product database while typing", details: ["قاعدة بيانات المنتجات/الخدمات", "اقتراح السعر والوصف تلقائياً"], detailsEn: ["Products/services database", "Auto-suggest price and description"] },
      { name: "عروض الأسعار", nameEn: "Quotations", status: "live", description: "إنشاء عروض أسعار مع تحويلها لفواتير", descEn: "Create quotations and convert them to invoices", details: ["إنشاء عرض سعر كامل", "حالات: مسودة / مرسل / مقبول / مرفوض / محوّل لفاتورة", "تحويل مباشر لفاتورة بضغطة"], detailsEn: ["Create a full quotation", "Statuses: draft / sent / accepted / rejected / converted to invoice", "One-click conversion to invoice"] },
      { name: "سندات القبض", nameEn: "Receipt vouchers", status: "live", description: "تسجيل المدفوعات المستلمة من العملاء", descEn: "Record payments received from customers", details: ["ربط بالفاتورة", "طرق دفع متعددة", "KPI cards مع إجماليات"], detailsEn: ["Link to invoice", "Multiple payment methods", "KPI cards with totals"] },
      { name: "الإشعارات الدائنة", nameEn: "Credit notes", status: "live", description: "إصدار إشعارات دائنة للمرتجعات", descEn: "Issue credit notes for returns", details: ["ربط بالفاتورة الأصلية", "حالات: مسودة / صادر / مطبق"], detailsEn: ["Link to original invoice", "Statuses: draft / issued / applied"] },
      { name: "ترقيم تسلسلي مع بادئة قابلة للتخصيص", nameEn: "Sequential numbering with customizable prefix", status: "live", description: "ترقيم تلقائي مع إمكانية تعديل البادئة", descEn: "Automatic numbering with editable prefix", details: ["ترقيم تسلسلي موجود (INV-2026-XXX)", "يحتاج: إعدادات تخصيص البادئة والصيغة"], detailsEn: ["Sequential numbering exists (INV-2026-XXX)", "Needs: prefix and format customization settings"] },
    ],
  },
  {
    title: "المشتريات",
    titleEn: "Purchases",
    icon: Package,
    color: "text-success",
    bgColor: "bg-success/10",
    features: [
      { name: "فواتير المشتريات", nameEn: "Purchase invoices", status: "live", description: "إدارة فواتير الموردين مع ربط المورد", descEn: "Manage supplier invoices with supplier linking", details: ["إنشاء / عرض / حذف", "ربط بالمورد مع بحث ذكي", "بنود مع ضريبة"], detailsEn: ["Create / view / delete", "Link to supplier with smart search", "Line items with tax"] },
      { name: "سندات الصرف", nameEn: "Payment vouchers", status: "live", description: "تسجيل المبالغ المصروفة للموردين", descEn: "Record amounts paid to suppliers" },
      { name: "المصروفات النقدية", nameEn: "Cash expenses", status: "live", description: "تسجيل المصاريف اليومية مع التصنيف", descEn: "Record daily expenses with categorization" },
      { name: "ربط المشتريات بالمدفوعات", nameEn: "Link purchases to payments", status: "live", description: "ربط الفواتير بمدفوعاتها وعرض الرصيد المتبقي", descEn: "Link purchase bills to payments and show the outstanding balance" },
    ],
  },
  {
    title: "الفوترة الإلكترونية (ZATCA)",
    titleEn: "E-Invoicing",
    icon: Shield,
    color: "text-success",
    bgColor: "bg-success/10",
    features: [
      { name: "معرف الفاتورة UUID", nameEn: "Invoice UUID", status: "partial", description: "معرف فريد ضمن مسار الفواتير الإلكتروني المُدار.", descEn: "Unique identifier in the managed e-invoice pipeline." },
      { name: "سلسلة الفواتير والتوقيع", nameEn: "Invoice chain and signing", status: "partial", description: "توقيع XML وربط التجزئة والعداد في مسار مُدار؛ يتطلب تهيئة المنشأة وشهادة الجهاز.", descEn: "XML signing, hash linking and counter in a managed pipeline; requires organization setup and device credentials." },
      { name: "رمز QR الإلكتروني", nameEn: "E-invoice QR", status: "partial", description: "توليد QR محلي أو من الفاتورة الموقعة حسب المسار؛ حالة قبول الهيئة منفصلة.", descEn: "Local or signed-invoice QR according to the pipeline; authority acceptance is a separate status." },
      { name: "ربط الجهاز والشهادة", nameEn: "Device and certificate onboarding", status: "partial", description: "تهيئة الجهاز والشهادة وفحوصات المطابقة قبل تفعيل المعالجة للمنشأة.", descEn: "Device and certificate setup with compliance checks before organization processing is enabled." },
      { name: "XML/UBL والتصدير", nameEn: "XML/UBL and export", status: "partial", description: "توليد XML في المسار المُدار؛ تضمين PDF/A-3 والملفات النهائية يحتاج تحققًا منفصلًا.", descEn: "XML generation in the managed pipeline; PDF/A-3 embedding and final files require separate verification." },
      { name: "التخليص والإبلاغ", nameEn: "Clearance and reporting", status: "partial", description: "مسار مُدار محدود بالمنشآت والحالات المدعومة. يلزم قبول الهيئة للفواتير الفعلية؛ الربط ليس مفعّلًا لجميع العملاء تلقائيًا.", descEn: "Managed workflow restricted to supported organizations and profiles. Actual invoices require authority acceptance; integration is not automatically enabled for all customers." },
      { name: "بيئة الاختبار والمحاكاة", nameEn: "Sandbox and simulation", status: "partial", description: "مسارات اختبار منفصلة عن الإنتاج؛ نجاح الاختبار لا يعني قبول فواتير الإنتاج.", descEn: "Test environments are separate from production; test success does not establish acceptance of production invoices." },
    ],
  },
  {
    title: "التقارير المالية",
    titleEn: "Financial Reports",
    icon: BarChart3,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    features: [
      { name: "ميزان المراجعة", nameEn: "Trial balance", status: "live", description: "تقرير ميزان المراجعة", descEn: "Trial balance report" },
      { name: "قائمة الدخل", nameEn: "Income statement", status: "live", description: "قائمة الأرباح والخسائر (P&L)", descEn: "Profit and loss statement (P&L)", details: ["عادية / بحسب الفرع / بحسب مركز التكلفة / بحسب المشروع"], detailsEn: ["Standard / by branch / by cost center / by project"] },
      { name: "قائمة المركز المالي", nameEn: "Statement of financial position", status: "live", description: "الميزانية العمومية (Balance Sheet)", descEn: "Balance Sheet" },
      { name: "قائمة التدفقات النقدية", nameEn: "Cash flow statement", status: "live", description: "مباشرة وغير مباشرة", descEn: "Direct and indirect", details: ["الطريقة المباشرة", "الطريقة غير المباشرة"], detailsEn: ["Direct method", "Indirect method"] },
      { name: "إقرار ضريبة القيمة المضافة", nameEn: "VAT return", status: "live", description: "تقرير VAT Return", descEn: "VAT Return report" },
      { name: "فلترة نطاق تاريخي", nameEn: "Date range filter", status: "live", description: "تحديد فترة زمنية مخصصة للتقارير", descEn: "Define a custom date range for reports" },
      { name: "تصدير PDF / Excel", nameEn: "PDF / Excel export", status: "live", description: "تصدير جميع التقارير", descEn: "Export all reports" },
      { name: "تقارير موحدة (Consolidated)", nameEn: "Consolidated reports", status: "live", description: "ميزانية ودخل وتدفق نقدي موحد لمتعدد الشركات", descEn: "Consolidated balance sheet, income, and cash flow for multiple companies" },
      { name: "تقارير الإدارة (PDF)", nameEn: "Management reports (PDF)", status: "live", description: "تقارير تنفيذية شاملة", descEn: "Comprehensive executive reports" },
    ],
  },
  {
    title: "جهات الاتصال (Party Model)",
    titleEn: "Contacts & CRM",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "إدارة العملاء", nameEn: "Customer management", status: "live", description: "إدارة كاملة مع بيانات الاتصال والأدوار المتعددة", descEn: "Full management with contact data and multiple roles" },
      { name: "حدود ائتمانية للعملاء", nameEn: "Customer credit limits", status: "planned", description: "تعيين سقف ائتماني مع تنبيهات عند التجاوز", descEn: "Set a credit ceiling with alerts on breach", critical: true },
      { name: "إدارة الموردين", nameEn: "Supplier management", status: "live", description: "بيانات الموردين مع الأدوار والتصنيفات", descEn: "Supplier data with roles and categories" },
      { name: "شروط الدفع للموردين", nameEn: "Supplier payment terms", status: "partial", description: "تعيين شروط دفع افتراضية لكل مورد", descEn: "Set default payment terms per supplier", details: ["موجود في الفواتير", "يحتاج: ربط مع ملف المورد"], detailsEn: ["Exists in invoices", "Needs: link to supplier profile"] },
      { name: "ملفات المستقلين (Freelancers)", nameEn: "Freelancer profiles", status: "live", description: "جهة اتصال واحدة بأدوار متعددة، مرتبطة بالمقاول والأسعار والساعات؛ رقم ضريبي اختياري للفرد", descEn: "One contact with multiple roles linked to contractor rates and hours; optional individual tax ID" },
      { name: "خط زمني للنشاط", nameEn: "Activity timeline", status: "live", description: "سجل كامل لتاريخ التفاعلات والمعاملات", descEn: "Full history log of interactions and transactions" },
      { name: "CRM خفيف", nameEn: "Lightweight CRM", status: "partial", description: "ملاحظات وتصنيفات وآخر تفاعل", descEn: "Notes, categories, and last interaction", details: ["سجل النشاط موجود", "يحتاج: tags / ملاحظات حرة / تذكيرات"], detailsEn: ["Activity log exists", "Needs: tags / free notes / reminders"] },
      { name: "بحث ذكي وإنشاء فوري", nameEn: "Smart search and instant create", status: "live", description: "اكتب اسم العميل في أي نموذج واختر أو أنشئ جديد بدون مغادرة الصفحة", descEn: "Type a customer name in any form and select or create new without leaving the page", details: ["بحث أثناء الكتابة (Autocomplete)", "إنشاء سريع مع نموذج مدمج", "تصنيف محلي / أجنبي", "بيانات ضريبية (VAT / ITN / LEI)", "ضريبة الاستقطاع للكيانات الأجنبية"], detailsEn: ["Search as you type (autocomplete)", "Quick create with an inline form", "Local / foreign classification", "Tax data (VAT / ITN / LEI)", "Withholding tax for foreign entities"] },
      { name: "كيانات أجنبية مع ضريبة استقطاع", nameEn: "Foreign entities with withholding tax", status: "live", description: "تصنيف كيان أجنبي مع نسبة استقطاع وتصنيف المعاملة", descEn: "Classify a foreign entity with withholding rate and transaction classification", details: ["عملة مختلفة تلقائياً", "ITN بدل سجل تجاري", "LEI Code مع رابط GLEIF", "ضريبة استقطاع % مع تصنيف", "يظهر في الإقرار الضريبي الشهري"], detailsEn: ["Different currency automatically", "ITN instead of commercial registration", "LEI Code with GLEIF link", "Withholding tax % with classification", "Appears in the monthly tax return"] },
    ],
  },
  {
    title: "الأصول والمخزون",
    titleEn: "Assets & Inventory",
    icon: Building2,
    color: "text-warning",
    bgColor: "bg-warning/10",
    features: [
      { name: "الأصول الثابتة", nameEn: "Fixed assets", status: "live", description: "إدارة الأصول مع الإهلاك والقيمة الدفترية", descEn: "Manage assets with depreciation and book value", details: ["جدول الإهلاك", "رسوم بيانية", "حالات: نشط / مستبعد / قيد الصيانة"], detailsEn: ["Depreciation schedule", "Charts", "Statuses: active / disposed / under maintenance"] },
      { name: "المخزون", nameEn: "Inventory", status: "live", description: "إدارة المنتجات والمستودعات مع حد إعادة الطلب", descEn: "Manage products and warehouses with reorder point" },
      { name: "المنتجات والخدمات", nameEn: "Products and services", status: "live", description: "قسم شامل للمنتجات والخدمات مع تغيير النوع ديناميكياً", descEn: "Comprehensive products and services section with dynamic type switching", details: ["منتج / خدمة / أصل", "صفحة تفصيلية لكل عنصر", "حركات مالية وحركات مخزون", "فلاتر متعددة + بحث + checkboxes"], detailsEn: ["Product / service / asset", "Detail page for each item", "Financial movements and inventory movements", "Multiple filters + search + checkboxes"] },
    ],
  },
  {
    title: "الرواتب والموارد البشرية",
    titleEn: "Payroll & HR",
    icon: Wallet,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    features: [
      { name: "دورات الرواتب", nameEn: "Payroll cycles", status: "live", description: "تشغيل دورات رواتب شهرية مع قائمة الموظفين", descEn: "Run monthly payroll cycles with employee list" },
      { name: "مسير الرواتب", nameEn: "Payroll run", status: "live", description: "حساب وحفظ واعتماد مسير رواتب شهري، مع تصدير ملف SIF", descEn: "Calculate, save, and approve a monthly payroll run, with SIF file export" },
      { name: "الموظفين", nameEn: "Employees", status: "live", description: "إدارة بيانات الموظفين وعقودهم", descEn: "Manage employee data and contracts" },
      { name: "مطالبات الموظفين", nameEn: "Employee claims", status: "planned", description: "تقديم واعتماد مطالبات المصاريف", descEn: "Submit and approve expense claims" },
      { name: "الحضور والانصراف", nameEn: "Attendance", status: "phase2", description: "تسجيل ومتابعة حضور الموظفين", descEn: "Record and track employee attendance" },
      { name: "الإجازات", nameEn: "Leave", status: "phase2", description: "طلبات واعتمادات الإجازات", descEn: "Leave requests and approvals" },
      { name: "امتثال GOSI", nameEn: "GOSI compliance", status: "partial", description: "حساب تلقائي لاشتراكات التأمينات الاجتماعية وتصدير ملف SIF", descEn: "Automatic calculation of social insurance contributions and SIF file export", details: ["تم: حساب اشتراكات الموظف وصاحب العمل وتصدير SIF CSV", "يحتاج: ربط مباشر (API) مع بوابة التأمينات"], detailsEn: ["Done: employee/employer contribution calculation and SIF CSV export", "Needs: direct API sync with the GOSI portal"], critical: true },
    ],
  },
  {
    title: "المشاريع",
    titleEn: "Projects",
    icon: Layers,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "إدارة المشاريع", nameEn: "Project management", status: "live", description: "إنشاء مشاريع بلوحة متابعة وتواريخ ونسب إنجاز وربط المستندات", descEn: "Project dashboard with dates, progress and linked documents" },
      { name: "المهام", nameEn: "Tasks", status: "live", description: "مهام داخل المشاريع مع المسؤول والمواعيد والتكلفة", descEn: "Project tasks with assignees, due dates and costs" },
      { name: "تتبع الوقت", nameEn: "Time tracking", status: "live", description: "تسجيل ساعات العمل وربط جهة الاتصال والمقاول بالمشروع", descEn: "Log work hours and link contacts and contractors to projects" },
      { name: "تحليل الربحية", nameEn: "Profitability analysis", status: "live", description: "تقارير إيرادات وتكاليف وربحية المشاريع حسب البيانات المسجلة", descEn: "Project revenue, cost and profitability reports from recorded data", critical: true },
    ],
  },
  {
    title: "الحسابات البنكية",
    titleEn: "Bank Accounts",
    icon: Landmark,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "إدارة الحسابات البنكية", nameEn: "Bank account management", status: "live", description: "إنشاء وإدارة الحسابات البنكية والصناديق", descEn: "Create and manage bank accounts and cash boxes", details: ["حسابات جارية / توفير / صناديق", "أرصدة وعملات متعددة", "IBAN ومعلومات البنك"], detailsEn: ["Current / savings / cash boxes", "Balances and multiple currencies", "IBAN and bank information"] },
      { name: "تحويلات بين الحسابات", nameEn: "Transfers between accounts", status: "live", description: "تحويل أرصدة بين الحسابات البنكية", descEn: "Transfer balances between bank accounts" },
      { name: "مطابقة بنكية", nameEn: "Bank reconciliation", status: "live", description: "رفع كشف الحساب ومطابقته مع السندات والفواتير سطراً بسطر", descEn: "Upload a bank statement and match it against vouchers and invoices row by row", details: ["اقتراح مطابقات تلقائي لكل سطر", "قرار: قبول / إنشاء سند / تجاهل لكل سطر"], detailsEn: ["Automatic match suggestions per row", "Decision per row: accept / create voucher / skip"] },
      { name: "استيراد كشوف بنكية (CSV/OFX)", nameEn: "Import bank statements (CSV/OFX)", status: "live", description: "رفع كشوف الحساب لمطابقتها، بصيغ CSV / MT940 / OFX / QIF / PDF / Excel", descEn: "Upload account statements for reconciliation, in CSV / MT940 / OFX / QIF / PDF / Excel formats" },
    ],
  },
  {
    title: "مراكز التكلفة والفروع",
    titleEn: "Cost Centers & Branches",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "مراكز التكلفة", nameEn: "Cost centers", status: "live", description: "إدارة مراكز التكلفة مع الميزانيات والمصروفات", descEn: "Manage cost centers with budgets and expenses", details: ["ميزانيات ونسب استخدام", "ربط بالقيود والفواتير"], detailsEn: ["Budgets and utilization rates", "Link to entries and invoices"] },
      { name: "الفروع", nameEn: "Branches", status: "live", description: "إدارة الفروع والمواقع", descEn: "Manage branches and locations", details: ["بيانات الفرع والعنوان", "المدير والموظفين", "إيرادات كل فرع"], detailsEn: ["Branch data and address", "Manager and employees", "Revenue per branch"] },
      { name: "إقفال الفترات", nameEn: "Period closing", status: "live", description: "إقفال الفترات المالية ومنع التعديل بعد الإقفال — من صفحة الفترات المالية", descEn: "Close fiscal periods and prevent editing after closing — from the Fiscal Periods page" },
    ],
  },
  {
    title: "التكاملات والمطورين",
    titleEn: "Integrations & Developer",
    icon: Plug,
    color: "text-foreground/80",
    bgColor: "bg-foreground/80/10",
    features: [
      { name: "REST API", nameEn: "REST API", status: "live", description: "واجهات برمجية؛ نطاق الوصول والتكامل الخارجي يحتاجان إعدادًا وصلاحيات مناسبة", descEn: "APIs are available; external access and integration scope require appropriate setup and permissions" },
      { name: "Webhooks", nameEn: "Webhooks", status: "planned", description: "إشعارات فورية للأحداث لأنظمة خارجية", descEn: "Instant event notifications to external systems" },
      { name: "قوالب المستندات", nameEn: "Document templates", status: "live", description: "إدارة قوالب الفواتير والمستندات بتصاميم متعددة", descEn: "Manage invoice and document templates with multiple designs", details: ["فواتير بيع / عروض أسعار / سندات", "تحديد قالب افتراضي", "تصميمات: كلاسيك / حديث / مبسّط"], detailsEn: ["Sales invoices / quotations / vouchers", "Set a default template", "Designs: classic / modern / minimal"] },
      { name: "ربط سلة (Salla)", nameEn: "Salla integration", status: "planned", description: "تكامل مع متجر سلة الإلكتروني", descEn: "Integration with Salla online store" },
      { name: "ربط زد (Zid)", nameEn: "Zid integration", status: "planned", description: "تكامل مع متجر زد الإلكتروني", descEn: "Integration with Zid online store" },
      { name: "ربط المدفوعات عبر Stripe", nameEn: "Stripe payments integration", status: "partial", description: "روابط دفع وتسوية تحصيلات Stripe؛ يتطلب حسابًا متصلًا وتهيئة صحيحة", descEn: "Stripe invoice payment links and collection reconciliation; requires a connected account and correct configuration", details: ["روابط دفع الفواتير وتسوية التحصيلات عبر Stripe", "يتطلب حسابًا متصلًا وتهيئة صحيحة؛ لا يشمل تفعيل كل مزود دفع"], detailsEn: ["Invoice payment links and collection reconciliation through Stripe", "Requires a connected account and configuration; not every payment provider is activated"] },
      { name: "ربط واتساب أعمال", nameEn: "WhatsApp Business integration", status: "phase2", description: "إرسال الفواتير عبر WhatsApp Business", descEn: "Send invoices via WhatsApp Business" },
    ],
  },
  {
    title: "التغذية البنكية",
    titleEn: "Bank Feeds",
    icon: CreditCard,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "المطابقة التلقائية", nameEn: "Automatic reconciliation", status: "phase3", description: "مطابقة تلقائية بين كشوف البنك والمعاملات", descEn: "Auto-match bank statements with transactions" },
      { name: "Plaid (US)", nameEn: "Plaid (US)", status: "partial", description: "ربط تجريبي عبر Plaid؛ يتطلب تفعيل المزود ودعم المؤسسة البنكية", descEn: "Beta Plaid connection; requires provider configuration and supported institutions" },
      { name: "Open Banking (GCC)", nameEn: "Open Banking (GCC)", status: "phase3", description: "ربط الحسابات البنكية الخليجية عبر Open Banking", descEn: "Link GCC bank accounts via Open Banking" },
    ],
  },
  {
    title: "البوابات الذاتية",
    titleEn: "Portals",
    icon: Globe,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "بوابة العملاء", nameEn: "Customer portal", status: "partial", description: "عرض مستندات العميل والدفع وفق صلاحيات البوابة وربط الدفع", descEn: "Customer documents and payment subject to portal permissions and payment setup" },
      { name: "بوابة الموردين", nameEn: "Supplier portal", status: "phase3", description: "واجهة للموردين لتتبع مستحقاتهم", descEn: "Interface for suppliers to track their dues" },
      { name: "بوابة المساهمين", nameEn: "Shareholder portal", status: "phase3", description: "واجهة للمساهمين عرض التقارير المالية", descEn: "Interface for shareholders to view financial reports" },
    ],
  },
  {
    title: "الذكاء الاصطناعي",
    titleEn: "Smart AI",
    icon: Brain,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "OCR - قراءة الفواتير", nameEn: "OCR - invoice reading", status: "partial", description: "استخراج مقترح لبيانات الصور وPDF لمراجعته قبل اعتماد المصروف؛ يتطلب مزود قراءة مهيّأ", descEn: "Extract proposed data from images and PDFs for review before approving an expense; requires a configured extraction provider" },
      { name: "التصنيف التلقائي", nameEn: "Automatic categorization", status: "partial", description: "اقتراح حسابات من المستندات؛ راجع الاقتراح قبل الاعتماد", descEn: "Suggest accounts from documents; review the suggestion before approval" },
      { name: "توقعات التدفق النقدي", nameEn: "Cash flow forecasting", status: "phase3", description: "تنبؤ بالسيولة المستقبلية بناءً على الأنماط التاريخية", descEn: "Predict future liquidity based on historical patterns" },
    ],
  },
];

