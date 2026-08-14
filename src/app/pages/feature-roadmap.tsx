import { useState } from "react";
import {
  CheckCircle, Clock, AlertCircle, Globe,
  FileText, Calculator, Users, BarChart3, CreditCard,
  Shield, Brain, Package, Building2, Wallet, Layers,
  Target, ChevronDown, ChevronRight, Star, Sparkles,
  Plug, Landmark,
  type LucideIcon
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";

// ── Types ──
type FeatureStatus = "live" | "partial" | "planned" | "phase2" | "phase3";

interface Feature {
  name: string;
  nameEn?: string;
  status: FeatureStatus;
  description: string;
  descEn?: string;
  details?: string[];
  detailsEn?: string[];
  critical?: boolean;
}

interface FeatureModule {
  title: string;
  titleEn?: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  features: Feature[];
}

const statusConfig: Record<FeatureStatus, { label: string; labelEn: string; color: string; bg: string; icon: LucideIcon }> = {
  live: { label: "مفعّل", labelEn: "Active", color: "text-green-800", bg: "bg-green-100", icon: CheckCircle },
  partial: { label: "جزئي", labelEn: "Partial", color: "text-amber-800", bg: "bg-amber-100", icon: AlertCircle },
  planned: { label: "مخطط", labelEn: "Planned", color: "text-primary", bg: "bg-blue-100", icon: Clock },
  phase2: { label: "المرحلة 2", labelEn: "Phase 2", color: "text-primary", bg: "bg-primary/5", icon: Target },
  phase3: { label: "المرحلة 3", labelEn: "Phase 3", color: "text-destructive", bg: "bg-pink-50", icon: Sparkles },
};

// ── Feature Modules ──
const modules: FeatureModule[] = [
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
      { name: "تعدد العملات", nameEn: "Multi-currency", status: "partial", description: "دعم عملات متعددة مع تحويل سعر الصرف", descEn: "Support multiple currencies with exchange rate conversion", details: ["تم: تعريف العملة لكل جهة اتصال (أجنبية)", "يحتاج: تحويل سعر الصرف التلقائي في الفواتير", "يحتاج: حسابات أرباح/خسائر فروق العملة"], detailsEn: ["Done: define currency per contact (foreign)", "Needs: automatic exchange rate conversion in invoices", "Needs: exchange gain/loss accounts"], critical: true },
      { name: "السنة المالية", nameEn: "Fiscal Year", status: "planned", description: "إدارة الفترات المالية مع إقفال وفتح الفترات", descEn: "Manage fiscal periods with closing and opening", details: ["تعريف بداية ونهاية السنة", "إقفال الفترات (شهري/ربعي/سنوي)", "قيود الإقفال التلقائية"], detailsEn: ["Define year start and end", "Close periods (monthly/quarterly/annual)", "Automatic closing entries"], critical: true },
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
    color: "text-green-800",
    bgColor: "bg-green-800/10",
    features: [
      { name: "فواتير المشتريات", nameEn: "Purchase invoices", status: "live", description: "إدارة فواتير الموردين مع ربط المورد", descEn: "Manage supplier invoices with supplier linking", details: ["إنشاء / عرض / حذف", "ربط بالمورد مع بحث ذكي", "بنود مع ضريبة"], detailsEn: ["Create / view / delete", "Link to supplier with smart search", "Line items with tax"] },
      { name: "سندات الصرف", nameEn: "Payment vouchers", status: "live", description: "تسجيل المبالغ المصروفة للموردين", descEn: "Record amounts paid to suppliers" },
      { name: "المصروفات النقدية", nameEn: "Cash expenses", status: "live", description: "تسجيل المصاريف اليومية مع التصنيف", descEn: "Record daily expenses with categorization" },
      { name: "ربط المشتريات بالمدفوعات", nameEn: "Link purchases to payments", status: "partial", description: "تخصيص المدفوعات على فواتير الشراء", descEn: "Allocate payments to purchase invoices", details: ["يحتاج: شاشة تخصيص مدفوعات على فواتير متعددة"], detailsEn: ["Needs: payment allocation screen across multiple invoices"] },
    ],
  },
  {
    title: "الفوترة الإلكترونية (ZATCA)",
    titleEn: "E-Invoicing",
    icon: Shield,
    color: "text-green-800",
    bgColor: "bg-green-800/10",
    features: [
      { name: "UUID 128-bit لكل فاتورة", nameEn: "128-bit UUID per invoice", status: "planned", description: "مخطط وغير منفذ كمعرّف ZATCA متحقق منه.", descEn: "Planned and not implemented as a verified ZATCA identifier.", critical: true },
      { name: "ربط تسلسلي مشفر (Sequential Hash)", nameEn: "Encrypted sequential linking (Sequential Hash)", status: "planned", description: "مخطط وغير منفذ كربط ZATCA متحقق منه.", descEn: "Planned and not implemented as verified ZATCA sequential linking.", critical: true },
      { name: "رمز QR مع 9 عناصر TLV", nameEn: "QR code with 9 TLV elements", status: "planned", description: "مخطط وغير منفذ. المتاح حالياً QR محلي بخمسة عناصر للبيانات الأساسية فقط.", descEn: "Planned and not implemented. Only a local five-tag QR for core invoice data is currently available.", critical: true, details: ["غير منفذ: Hash الفاتورة", "غير منفذ: عناصر التوقيع والمفتاح العام وختم CSID"], detailsEn: ["Not implemented: invoice hash", "Not implemented: signature, public-key, and CSID-stamp elements"] },
      { name: "ختم CSID التشفيري", nameEn: "CSID cryptographic stamp", status: "planned", description: "مخطط وغير منفذ؛ لا يوجد ختم أو توقيع تشغيلي من ZATCA.", descEn: "Planned and not implemented; there is no operational ZATCA stamp or signature.", details: ["نموذج بيانات الاعتماد القديم معطّل", "غير مفعّل للاعتماد الإنتاجي"], detailsEn: ["The legacy credential form is disabled", "Not enabled for production reliance"] },
      { name: "عداد فواتير غير قابل لإعادة التعيين", nameEn: "Non-resettable invoice counter", status: "planned", description: "مخطط وغير منفذ كضابط ZATCA متحقق منه.", descEn: "Planned and not implemented as a verified ZATCA control." },
      { name: "صيغة XML/UBL 2.1 + PDF/A-3", nameEn: "XML/UBL 2.1 + PDF/A-3 format", status: "planned", description: "مخطط وغير منفذ؛ لا يوجد تصدير ZATCA إنتاجي بهذه الصيغ.", descEn: "Planned and not implemented; production ZATCA export in these formats is unavailable.", critical: true },
      { name: "تكامل API مع منصة فاتورة", nameEn: "API integration with Fatoora platform", status: "planned", description: "مخطط وغير منفذ؛ خط الإنتاج غير جاهز.", descEn: "Planned and not implemented; the production pipeline is not ready.", details: ["الحالة: LOCAL_UNVERIFIED", "السبب: zatca_pipeline_not_ready"], detailsEn: ["State: LOCAL_UNVERIFIED", "Reason: zatca_pipeline_not_ready"] },
      { name: "المرحلة 1 (الإصدار): QR للـ B2C", nameEn: "Phase 1 (Generation): QR for B2C", status: "planned", description: "غير منفذ كامتثال ZATCA متحقق منه؛ المتاح QR محلي للبيانات الأساسية فقط.", descEn: "Not implemented as verified ZATCA compliance; only a local core-data QR is available.", critical: true },
      { name: "المرحلة 2 (التكامل): API للـ B2B", nameEn: "Phase 2 (Integration): API for B2B", status: "planned", description: "مخطط وغير منفذ؛ التخليص والإبلاغ الإنتاجيان غير مفعّلين.", descEn: "Planned and not implemented; production clearance and reporting are disabled.", critical: true },
      { name: "بيئة اختبار Sandbox", nameEn: "Sandbox test environment", status: "planned", description: "مخططة وغير منفذة بانتظار مسار التهيئة الجديد.", descEn: "Planned and not implemented pending the new onboarding flow." },
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
      { name: "ملفات المستقلين (Freelancers)", nameEn: "Freelancer profiles", status: "live", description: "تسجيل وإدارة المتعاونين المستقلين", descEn: "Register and manage independent contractors" },
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
    color: "text-amber-800",
    bgColor: "bg-amber-800/10",
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
      { name: "مسير الرواتب", nameEn: "Payroll run", status: "planned", description: "معالجة وتشغيل الرواتب الشهرية مع التفاصيل", descEn: "Process and run monthly payroll with details", critical: true },
      { name: "الموظفين", nameEn: "Employees", status: "planned", description: "إدارة بيانات الموظفين وعقودهم", descEn: "Manage employee data and contracts", critical: true },
      { name: "مطالبات الموظفين", nameEn: "Employee claims", status: "planned", description: "تقديم واعتماد مطالبات المصاريف", descEn: "Submit and approve expense claims" },
      { name: "الحضور والانصراف", nameEn: "Attendance", status: "phase2", description: "تسجيل ومتابعة حضور الموظفين", descEn: "Record and track employee attendance" },
      { name: "الإجازات", nameEn: "Leave", status: "phase2", description: "طلبات واعتمادات الإجازات", descEn: "Leave requests and approvals" },
      { name: "امتثال GOSI", nameEn: "GOSI compliance", status: "phase2", description: "حساب تلقائي لاشتراكات التأمينات الاجتماعية", descEn: "Automatic calculation of social insurance contributions", critical: true },
    ],
  },
  {
    title: "المشاريع",
    titleEn: "Projects",
    icon: Layers,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "إدارة المشاريع", nameEn: "Project management", status: "phase2", description: "إنشاء مشاريع وربطها بالفواتير والمصروفات", descEn: "Create projects and link them to invoices and expenses" },
      { name: "المهام", nameEn: "Tasks", status: "phase2", description: "مهام فرعية مع تعيين موظفين ومواعيد", descEn: "Subtasks with employee assignment and due dates" },
      { name: "تتبع الوقت", nameEn: "Time tracking", status: "phase2", description: "تسجيل ساعات العمل على المشاريع", descEn: "Log work hours on projects" },
      { name: "تحليل الربحية", nameEn: "Profitability analysis", status: "phase2", description: "مقارنة الإيرادات بالمصاريف لكل مشروع", descEn: "Compare revenue to expenses per project", critical: true },
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
      { name: "تحويلات بين الحسابات", nameEn: "Transfers between accounts", status: "planned", description: "تحويل أرصدة بين الحسابات البنكية", descEn: "Transfer balances between bank accounts" },
      { name: "مطابقة بنكية", nameEn: "Bank reconciliation", status: "planned", description: "مطابقة كشف الحساب مع الحركات", descEn: "Match bank statement with transactions", critical: true },
      { name: "استيراد كشوف بنكية (CSV/OFX)", nameEn: "Import bank statements (CSV/OFX)", status: "planned", description: "رفع كشوف الحساب لمطابقتها", descEn: "Upload bank statements for reconciliation" },
    ],
  },
  {
    title: "مراكز التكلفة والفروع",
    titleEn: "Cost Centers & Branches",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
    features: [
      { name: "مراكز التكلفة", nameEn: "Cost centers", status: "live", description: "إدارة مراكز التكلفة مع الميزانيات والمصروفات", descEn: "Manage cost centers with budgets and expenses", details: ["ميزانيات ونسب استخدام", "هيكل أب-ابن", "ربط بالقيود والفواتير"], detailsEn: ["Budgets and utilization rates", "Parent-child structure", "Link to entries and invoices"] },
      { name: "الفروع", nameEn: "Branches", status: "live", description: "إدارة الفروع والمواقع", descEn: "Manage branches and locations", details: ["بيانات الفرع والعنوان", "المدير والموظفين", "إيرادات كل فرع"], detailsEn: ["Branch data and address", "Manager and employees", "Revenue per branch"] },
      { name: "إقفال الفترات", nameEn: "Period closing", status: "planned", description: "إقفال الفترات المالية ومنع التعديل بعد الإقفال", descEn: "Close fiscal periods and prevent editing after closing", critical: true },
    ],
  },
  {
    title: "التكاملات والمطورين",
    titleEn: "Integrations & Developer",
    icon: Plug,
    color: "text-foreground/80",
    bgColor: "bg-foreground/80/10",
    features: [
      { name: "REST API", nameEn: "REST API", status: "live", description: "واجهة برمجية كاملة للتكامل مع أنظمة خارجية", descEn: "Full API for integration with external systems" },
      { name: "Webhooks", nameEn: "Webhooks", status: "live", description: "إشعارات فورية للأحداث", descEn: "Instant event notifications" },
      { name: "قوالب المستندات", nameEn: "Document templates", status: "live", description: "إدارة قوالب الفواتير والمستندات بتصاميم متعددة", descEn: "Manage invoice and document templates with multiple designs", details: ["فواتير بيع / عروض أسعار / سندات", "تحديد قالب افتراضي", "تصميمات: كلاسيك / حديث / مبسّط"], detailsEn: ["Sales invoices / quotations / vouchers", "Set a default template", "Designs: classic / modern / minimal"] },
      { name: "ربط سلة (Salla)", nameEn: "Salla integration", status: "planned", description: "تكامل مع متجر سلة الإلكتروني", descEn: "Integration with Salla online store" },
      { name: "ربط زد (Zid)", nameEn: "Zid integration", status: "planned", description: "تكامل مع متجر زد الإلكتروني", descEn: "Integration with Zid online store" },
      { name: "ربط Stripe / Moyasar", nameEn: "Stripe / Moyasar integration", status: "planned", description: "بوابات دفع إلكترونية", descEn: "Electronic payment gateways" },
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
      { name: "Plaid (US)", nameEn: "Plaid (US)", status: "phase3", description: "ربط الحسابات البنكية الأمريكية عبر Plaid", descEn: "Link US bank accounts via Plaid" },
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
      { name: "بوابة العملاء", nameEn: "Customer portal", status: "phase3", description: "واجهة للعملاء لعرض فواتيرهم والدفع", descEn: "Interface for customers to view invoices and pay" },
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
      { name: "OCR - قراءة الفواتير", nameEn: "OCR - invoice reading", status: "partial", description: "استخراج بيانات الفواتير من صور وPDF تلقائياً", descEn: "Extract invoice data from images and PDFs automatically", details: ["واجهة الرفع موجودة", "يحتاج: تكامل Google Vision API"], detailsEn: ["Upload interface exists", "Needs: Google Vision API integration"] },
      { name: "التصنيف التلقائي", nameEn: "Automatic categorization", status: "phase3", description: "تصنيف المعاملات تلقائياً على الحسابات المناسبة", descEn: "Auto-categorize transactions to appropriate accounts" },
      { name: "توقعات التدفق النقدي", nameEn: "Cash flow forecasting", status: "phase3", description: "تنبؤ بالسيولة المستقبلية بناءً على الأنماط التاريخية", descEn: "Predict future liquidity based on historical patterns" },
    ],
  },
];

export function FeatureRoadmap() {
  const { language, t } = useLanguage();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.map(m => m.title)));
  const [filterStatus, setFilterStatus] = useState<FeatureStatus | "all">("all");
  const { toasts, push, dismiss } = useToasts();
  const [reported, setReported] = useState<Set<string>>(new Set());

  const toggleModule = (title: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // Stats
  const allFeatures = modules.flatMap(m => m.features);
  const stats = {
    total: allFeatures.length,
    live: allFeatures.filter(f => f.status === "live").length,
    partial: allFeatures.filter(f => f.status === "partial").length,
    planned: allFeatures.filter(f => f.status === "planned").length,
    phase2: allFeatures.filter(f => f.status === "phase2").length,
    phase3: allFeatures.filter(f => f.status === "phase3").length,
    critical: allFeatures.filter(f => f.critical).length,
    criticalDone: allFeatures.filter(f => f.critical && f.status === "live").length,
  };

  const completionRate = Math.round(((stats.live + stats.partial * 0.5) / stats.total) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("خارطة المزايا", "Feature Roadmap")}</h1>
        <p className="text-muted-foreground mt-1">{t("مراجعة شاملة لجميع مزايا المنصة وحالة التنفيذ", "Comprehensive review of all platform features and implementation status")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <button onClick={() => setFilterStatus(filterStatus === "all" ? "all" : "all")} className="text-start">
          <Card className={`border-border hover:shadow-md transition-all ${filterStatus === "all" ? "ring-2 ring-ring/20" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t("الإجمالي", "Total")}</p>
              <p className="font-english text-foreground mt-1" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.total}</p>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-english">{completionRate}% {t("مكتمل", "complete")}</p>
            </CardContent>
          </Card>
        </button>
        {(["live", "partial", "planned", "phase2", "phase3"] as FeatureStatus[]).map(status => {
          const cfg = statusConfig[status];
          const count = stats[status];
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? "all" : status)} className="text-start">
              <Card className={`border-border hover:shadow-md transition-all ${filterStatus === status ? "ring-2 ring-ring/20" : ""}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{t(cfg.label, cfg.labelEn)}</p>
                  <p className={`font-english mt-1 ${cfg.color}`} style={{ fontSize: "1.5rem", fontWeight: 700 }}>{count}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs mt-2 ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 500 }}>
                    <cfg.icon className="h-3 w-3" />{t(cfg.label, cfg.labelEn)}
                  </span>
                </CardContent>
              </Card>
            </button>
          );
        })}
        <button onClick={() => setFilterStatus("all")} className="text-start">
          <Card className="border-amber-100 bg-amber-100/20 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>{t("حرجة", "Critical")}</p>
              <p className="font-english text-amber-800 mt-1" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.criticalDone}/{stats.critical}</p>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs mt-2 bg-amber-100 text-amber-800" style={{ fontWeight: 500 }}>
                <Star className="h-3 w-3" />{t("أساسية", "Essential")}
              </span>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Modules */}
      <div className="space-y-3">
        {modules.map(mod => {
          const isExpanded = expandedModules.has(mod.title);
          const modFeatures = filterStatus === "all" ? mod.features : mod.features.filter(f => f.status === filterStatus);
          if (modFeatures.length === 0 && filterStatus !== "all") return null;
          const liveCount = mod.features.filter(f => f.status === "live").length;
          const totalCount = mod.features.length;

          return (
            <Card key={mod.title} className="border-border overflow-hidden">
              <button
                onClick={() => toggleModule(mod.title)}
                className="w-full text-start px-5 py-4 flex items-center justify-between hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${mod.bgColor}`}>
                    <mod.icon className={`h-5 w-5 ${mod.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground" style={{ fontWeight: 700 }}>{t(mod.title, mod.titleEn)}</span>
                      {language === "ar" && mod.titleEn && <span className="text-xs text-muted-foreground/60 font-english">{mod.titleEn}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-english">{liveCount}/{totalCount} {t("مفعّل", "active")}</span>
                      <div className="w-16 bg-muted rounded-full h-1">
                        <div className="bg-green-500 h-1 rounded-full" style={{ width: `${(liveCount / totalCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground/60" /> : <ChevronRight className="h-5 w-5 text-muted-foreground/60" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  {(filterStatus === "all" ? mod.features : modFeatures).map((feature, i) => {
                    const cfg = statusConfig[feature.status];
                    return (
                      <div key={feature.name} className={`px-5 py-3.5 flex items-start gap-3 ${i > 0 ? "border-t border-border/50" : ""} hover:bg-muted transition-colors group`}>
                        <cfg.icon className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{t(feature.name, feature.nameEn)}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${cfg.bg} ${cfg.color}`} style={{ fontWeight: 500 }}>{t(cfg.label, cfg.labelEn)}</span>
                            <button
                              onClick={async (e) => { e.stopPropagation(); if (reported.has(feature.name)) return; try { await api.notifications.create({ type: "feature_report", title: `${t("بلاغ على ميزة:", "Feature report:")} ${t(feature.name, feature.nameEn)}`, body: `${t("قسم:", "Module:")} ${t(mod.title, mod.titleEn)} · ${t("الحالة:", "Status:")} ${t(cfg.label, cfg.labelEn)}`, link: "/app/roadmap", refType: "feature", refId: feature.name }); setReported(prev => new Set(prev).add(feature.name)); push("success", `${t("تم استلام بلاغك على", "We received your report on")} «${t(feature.name, feature.nameEn)}»`); } catch { push("error", t("تعذر إرسال البلاغ", "Could not send the report")); } }}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${reported.has(feature.name) ? "border-green-200 bg-green-50 text-green-700" : "border-border text-muted-foreground/60 hover:text-destructive hover:border-destructive/40 opacity-0 group-hover:opacity-100"}`}
                              title={t("أبلغ عن مشكلة في هذه الميزة — يصل البلاغ لفريق التطوير", "Report an issue with this feature — the report reaches the dev team")}>
                              {reported.has(feature.name) ? t("✓ وصل البلاغ", "✓ Report received") : t("⚑ بلاغ", "⚑ Report")}
                            </button>
                            {feature.critical && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800" style={{ fontWeight: 600 }}>
                                <Star className="h-3 w-3" />{t("حرج", "Critical")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t(feature.description, feature.descEn)}</p>
                          {feature.details && feature.details.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {feature.details.map((d, j) => (
                                <li key={j} className="text-xs text-muted-foreground/60 flex items-start gap-1.5">
                                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted shrink-0" />
                                  {t(d, feature.detailsEn?.[j])}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="text-foreground mb-3" style={{ fontWeight: 700 }}>{t("دليل الحالات", "Status legend")}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                <span className={`text-sm ${cfg.color}`} style={{ fontWeight: 500 }}>{t(cfg.label, cfg.labelEn)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-800" />
              <span className="text-sm text-amber-800" style={{ fontWeight: 500 }}>{t("حرج — أساسي للإطلاق", "Critical — essential for launch")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
