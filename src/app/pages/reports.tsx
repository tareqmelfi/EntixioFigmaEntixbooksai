import { displayLocale } from "../lib/number-display";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Gauge,
  HardHat,
  Hourglass,
  Landmark,
  Layers,
  ListChecks,
  Loader2,
  MapPin,
  Network,
  Package,
  PackageOpen,
  PackageSearch,
  Percent,
  Receipt,
  Repeat,
  Scale,
  ScrollText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Target,
  Timer,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Waves,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { api, ApiError, type DashboardSummary } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type TFunc = (ar: string, en?: string) => string;

type ReportCategoryId =
  | "financial"
  | "consolidated"
  | "sales"
  | "purchases"
  | "payroll"
  | "forecast"
  | "tax"
  | "accountant"
  | "inventory";

type ReportStatus = "live" | "ready" | "needs_data";
type ReportFormat = "PDF" | "CSV" | "Excel";

type ReportDefinition = {
  id: string;
  category: ReportCategoryId;
  title: string;
  englishTitle: string;
  description: string;
  status: ReportStatus;
  isNew?: boolean;
  formats: ReportFormat[];
  dataSources: string[];
  segmentation?: string[];
  ksaTerm?: string;
  usTerm?: string;
};

type CategoryDefinition = {
  id: ReportCategoryId;
  title: string;
  englishTitle: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

type ReportIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

const money = (value: string | number | null | undefined, currency = "SAR") => {
  const formatted = Number(value || 0).toLocaleString(displayLocale("en-US"), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
};

const numberValue = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString(displayLocale("en-US"));

const categories: CategoryDefinition[] = [
  { id: "financial", title: "تقارير مالية", englishTitle: "Financial Reports", icon: BarChart3 },
  { id: "consolidated", title: "التقارير المالية الموحدة", englishTitle: "Consolidated Reports", icon: Building2 },
  { id: "sales", title: "مبيعات", englishTitle: "Sales", icon: Users },
  { id: "purchases", title: "مشتريات", englishTitle: "Purchases", icon: Wallet },
  { id: "payroll", title: "الرواتب", englishTitle: "Payroll", icon: ClipboardList },
  { id: "forecast", title: "توقعات", englishTitle: "Forecasts", icon: TrendingUp },
  { id: "tax", title: "تقارير الضرائب", englishTitle: "Tax Reports", icon: ShieldCheck },
  { id: "accountant", title: "للمحاسب", englishTitle: "Accountant", icon: Calculator },
  { id: "inventory", title: "مخزون", englishTitle: "Inventory", icon: Package },
];

/** One expressive, distinct icon per report — the card's identity in the grid. */
const REPORT_ICONS: Record<string, ReportIcon> = {
  "income-statement": TrendingUp,
  "income-by-branch": Store,
  "branch-performance": Gauge,
  "income-by-cost-center": Target,
  "income-by-project": FolderKanban,
  "project-profitability": HardHat,
  "cash-flow": Waves,
  "cash-flow-indirect": Repeat,
  "balance-sheet": Scale,
  "cash-forecast": CalendarClock,
  "management-pdf": FileText,
  "consolidated-income": Layers,
  "consolidated-cash-flow": Network,
  "consolidated-balance-sheet": Building2,
  "customer-balances": Users,
  "customer-statement": ScrollText,
  "customer-statement-detail": FileSearch,
  "ar-aging": Hourglass,
  "ar-aging-detail": Timer,
  "sales-by-customer": ShoppingCart,
  "sales-by-branch": Store,
  "sales-by-project": FolderKanban,
  "sales-by-product": Package,
  "supplier-balances": Truck,
  "supplier-statement": ScrollText,
  "supplier-statement-detail": FileSearch,
  "ap-aging": Hourglass,
  "ap-aging-detail": Timer,
  "bills-by-supplier": Receipt,
  "bills-by-branch": Store,
  "expenses-by-vendor": CreditCard,
  "expenses-by-branch": MapPin,
  "purchases-by-product": PackageSearch,
  "employee-statement": Wallet,
  "employee-statement-detail": ClipboardList,
  "forecast-cash": CalendarClock,
  "vat-summary": Percent,
  taxes: Receipt,
  "taxes-detail": FileSpreadsheet,
  "trial-balance": ListChecks,
  "account-statement": ScrollText,
  "account-statement-detail": FileSearch,
  "general-ledger": BookOpen,
  "audit-log": ShieldCheck,
  "bank-reconciliation-report": Landmark,
  "inventory-movement": PackageOpen,
  "inventory-by-warehouse": Warehouse,
  "inventory-monthly-summary": Boxes,
};

const iconFor = (report: ReportDefinition): ReportIcon =>
  REPORT_ICONS[report.id] || categories.find((item) => item.id === report.category)?.icon || FileText;

const reportCatalog: ReportDefinition[] = [
  {
    id: "income-statement",
    category: "financial",
    title: "قائمة الدخل",
    englishTitle: "Income Statement",
    description: "إيرادات ومصاريف وصافي ربح الشركة خلال الفترة.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Invoices", "Bills", "Expenses", "Journal Entries"],
    ksaTerm: "قائمة الدخل حسب IFRS/SME",
    usTerm: "Income Statement / Profit and Loss",
  },
  {
    id: "income-by-branch",
    category: "financial",
    title: "قائمة الدخل بحسب الفرع",
    englishTitle: "Income Statement by Branch",
    description: "نفس قائمة الدخل مع فصل النتائج لكل فرع.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Branches", "Invoices", "Bills", "Journal Entries"],
    segmentation: ["Branch"],
  },
  {
    id: "branch-performance",
    category: "financial",
    title: "أداء الفروع",
    englishTitle: "Branch Performance",
    description: "إيراد · تكلفة مباشرة · هامش · عدد الفواتير · متوسط الفاتورة لكل فرع.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Branches", "Invoices", "Credit Notes", "Bills", "Expenses"],
    segmentation: ["Branch"],
  },
  {
    id: "income-by-cost-center",
    category: "financial",
    title: "قائمة الدخل بحسب مركز التكلفة",
    englishTitle: "Income Statement by Cost Center",
    description: "تحليل الإيراد والمصروف على مراكز التكلفة.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Cost Centers", "Journal Lines", "Expenses"],
    segmentation: ["Cost Center"],
  },
  {
    id: "income-by-project",
    category: "financial",
    title: "قائمة الدخل بحسب المشروع",
    englishTitle: "Income Statement by Project",
    description: "ربحية كل مشروع من المبيعات والمشتريات والمصاريف المرتبطة.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Projects", "Invoices", "Bills", "Expenses"],
    segmentation: ["Project"],
  },
  {
    id: "project-profitability",
    category: "financial",
    title: "ربحية المشاريع (تكلفة الأعمال)",
    englishTitle: "Project Profitability (Job Costing)",
    description: "قيمة العقد · المفوتر · الإيراد · التكلفة (فواتير · مصروفات · مقاولون) · الهامش · الميزانية مقابل الفعلي · نسبة الإنجاز · الاحتجاز.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Projects", "Invoices", "Credit Notes", "Bills", "Expenses", "Contractor Payments"],
    segmentation: ["Project"],
  },
  {
    id: "cash-flow",
    category: "financial",
    title: "التدفق النقدي",
    englishTitle: "Cash Flow Statement",
    description: "ملخص النقد الداخل والخارج من المستندات والحسابات البنكية.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Receipts", "Payments", "Bank Accounts", "Journal Entries"],
  },
  {
    id: "cash-flow-indirect",
    category: "financial",
    title: "التدفقات النقدية – الطريقة غير المباشرة",
    englishTitle: "Cash Flow Statement - Indirect Method",
    description: "يبدأ من صافي الربح ثم يعدله بالذمم والمخزون والقيود غير النقدية.",
    status: "ready",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Income Statement", "Balance Sheet", "Journal Entries"],
  },
  {
    id: "balance-sheet",
    category: "financial",
    title: "قائمة المركز المالي",
    englishTitle: "Statement of Financial Position",
    description: "الأصول والالتزامات وحقوق الملكية حسب أرصدة الحسابات.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Chart of Accounts", "Journal Entries", "Bank Accounts"],
    ksaTerm: "قائمة المركز المالي",
    usTerm: "Balance Sheet",
  },
  {
    id: "cash-forecast",
    category: "financial",
    title: "التوقعات النقدية",
    englishTitle: "Cash Forecast",
    description: "توقع النقد القادم من الفواتير المستحقة والمصروفات والمدفوعات.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Open Invoices", "Open Bills", "Payroll", "Bank Accounts"],
  },
  {
    id: "management-pdf",
    category: "financial",
    title: "تقارير الإدارة (PDF)",
    englishTitle: "Management Reports PDF Pack",
    description: "حزمة PDF للإدارة تشمل ملخص تنفيذي، أرباح، نقد، ضريبة، ومؤشرات تشغيلية.",
    status: "ready",
    isNew: true,
    formats: ["PDF"],
    dataSources: ["Dashboard", "Reports", "Tax", "Inventory", "Payroll"],
  },
  {
    id: "consolidated-income",
    category: "consolidated",
    title: "قائمة الدخل الموحدة",
    englishTitle: "Consolidated Income Statement",
    description: "نتائج عدة شركات أو فروع قانونية مع استبعاد التعاملات البينية.",
    status: "needs_data",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Entities", "Intercompany Eliminations", "Journal Entries"],
  },
  {
    id: "consolidated-cash-flow",
    category: "consolidated",
    title: "التدفق النقدي الموحد",
    englishTitle: "Consolidated Cash Flow",
    description: "تدفقات نقدية موحدة للمجموعة مع عرض الكيانات التابعة.",
    status: "needs_data",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Entities", "Bank Accounts", "Eliminations"],
  },
  {
    id: "consolidated-balance-sheet",
    category: "consolidated",
    title: "قائمة المركز المالي الموحدة",
    englishTitle: "Consolidated Balance Sheet",
    description: "مركز مالي موحد للمجموعة أو الشركات ذات العلاقة.",
    status: "needs_data",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Entities", "Chart of Accounts", "Eliminations"],
  },
  {
    id: "customer-balances",
    category: "sales",
    title: "ملخص أرصدة العملاء",
    englishTitle: "Customer Balances Summary",
    description: "أرصدة العملاء المفتوحة ومبالغ التحصيل المتوقعة.",
    status: "live",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Contacts", "Invoices", "Receipts"],
  },
  {
    id: "customer-statement",
    category: "sales",
    title: "كشف حساب عميل",
    englishTitle: "Customer Statement",
    description: "كشف مختصر لحركة العميل من فواتير وسندات قبض وإشعارات.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Customer", "Invoices", "Receipts", "Credit Notes"],
  },
  {
    id: "customer-statement-detail",
    category: "sales",
    title: "كشف حساب عميل - مفصّل",
    englishTitle: "Detailed Customer Statement",
    description: "حركة مفصلة بالأسطر والمستندات والمدفوعات والرصيد الجاري.",
    status: "ready",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Customer", "Journal Entries", "Sales Documents"],
  },
  {
    id: "ar-aging",
    category: "sales",
    title: "تقادم الحسابات المدينة",
    englishTitle: "Accounts Receivable Aging",
    description: "تقسيم الذمم المدينة حسب أيام التأخير.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Invoices", "Receipts", "Customers"],
  },
  {
    id: "ar-aging-detail",
    category: "sales",
    title: "تقادم الحسابات المدينة - مفصّل",
    englishTitle: "Detailed Accounts Receivable Aging",
    description: "تقادم مفصل حسب العميل والفاتورة وتاريخ الاستحقاق.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Invoices", "Receipts", "Customers"],
  },
  {
    id: "sales-by-customer",
    category: "sales",
    title: "المبيعات بحسب العميل",
    englishTitle: "Sales by Customer",
    description: "مبيعات كل عميل مع إجمالي الفواتير والمبالغ المحصلة.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Invoices", "Contacts"],
    segmentation: ["Customer"],
  },
  {
    id: "sales-by-branch",
    category: "sales",
    title: "المبيعات بحسب الفرع",
    englishTitle: "Sales by Branch",
    description: "تحليل المبيعات لكل فرع.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Branches", "Invoices"],
    segmentation: ["Branch"],
  },
  {
    id: "sales-by-project",
    category: "sales",
    title: "المبيعات بحسب المشروع",
    englishTitle: "Sales by Project",
    description: "إيرادات المشاريع من الفواتير والعقود.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Projects", "Invoices"],
    segmentation: ["Project"],
  },
  {
    id: "sales-by-product",
    category: "sales",
    title: "المبيعات بحسب المنتج أو الخدمة",
    englishTitle: "Sales by Product or Service",
    description: "أكثر المنتجات والخدمات مبيعاً والكميات والهامش.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Products", "Invoice Lines"],
    segmentation: ["Product", "Service"],
  },
  {
    id: "supplier-balances",
    category: "purchases",
    title: "ملخص أرصدة الموردين",
    englishTitle: "Supplier Balances Summary",
    description: "أرصدة الموردين المفتوحة والمدفوعات المستحقة.",
    status: "live",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Contacts", "Bills", "Payments"],
  },
  {
    id: "supplier-statement",
    category: "purchases",
    title: "كشف حساب مورد",
    englishTitle: "Supplier Statement",
    description: "كشف مختصر لحركة المورد من فواتير ومدفوعات وإشعارات موردين.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Supplier", "Bills", "Payments", "Supplier Credits"],
  },
  {
    id: "supplier-statement-detail",
    category: "purchases",
    title: "كشف حساب مورد - مفصّل",
    englishTitle: "Detailed Supplier Statement",
    description: "حركة مورد مفصلة بأسطر المستندات والمدفوعات والرصيد الجاري.",
    status: "ready",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Supplier", "Journal Entries", "Purchase Documents"],
  },
  {
    id: "ap-aging",
    category: "purchases",
    title: "تقادم الحسابات الدائنة",
    englishTitle: "Accounts Payable Aging",
    description: "تقسيم الذمم الدائنة حسب تاريخ الاستحقاق.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Bills", "Payments", "Suppliers"],
  },
  {
    id: "ap-aging-detail",
    category: "purchases",
    title: "تقادم الحسابات الدائنة - مفصّل",
    englishTitle: "Detailed Accounts Payable Aging",
    description: "تقادم مفصل حسب المورد والفاتورة وتاريخ الاستحقاق.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Bills", "Payments", "Suppliers"],
  },
  {
    id: "bills-by-supplier",
    category: "purchases",
    title: "الفواتير بحسب المورد",
    englishTitle: "Bills by Supplier",
    description: "فواتير الموردين وإجمالياتها حسب الجهة.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Bills", "Suppliers"],
    segmentation: ["Supplier"],
  },
  {
    id: "bills-by-branch",
    category: "purchases",
    title: "الفواتير بحسب الفرع",
    englishTitle: "Bills by Branch",
    description: "توزيع فواتير المشتريات على الفروع.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Bills", "Branches"],
    segmentation: ["Branch"],
  },
  {
    id: "expenses-by-vendor",
    category: "purchases",
    title: "المصروفات بحسب مورد",
    englishTitle: "Expenses by Vendor",
    description: "تحليل المصروفات النقدية حسب المورد أو الجهة.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Expenses", "Contacts", "OCR Receipts"],
    segmentation: ["Vendor"],
  },
  {
    id: "expenses-by-branch",
    category: "purchases",
    title: "المصروفات بحسب الفرع",
    englishTitle: "Expenses by Branch",
    description: "توزيع المصروفات على فروع الشركة.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Expenses", "Branches"],
    segmentation: ["Branch"],
  },
  {
    id: "purchases-by-product",
    category: "purchases",
    title: "مشتريات بحسب المنتج أو الخدمة",
    englishTitle: "Purchases by Product or Service",
    description: "مشتريات المنتجات والخدمات مع الكميات والتكاليف.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Products", "Bill Lines", "Expense Lines"],
    segmentation: ["Product", "Service"],
  },
  {
    id: "employee-statement",
    category: "payroll",
    title: "كشف حساب موظف",
    englishTitle: "Employee Statement",
    description: "حركة الموظف من رواتب وسلف ومطالبات ومبالغ مستحقة.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Employees", "Payroll Runs", "Expense Claims"],
  },
  {
    id: "employee-statement-detail",
    category: "payroll",
    title: "كشف حساب موظف - مفصّل",
    englishTitle: "Detailed Employee Statement",
    description: "كشف مفصل للراتب والبدلات والخصومات والمدفوعات والقيود.",
    status: "ready",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Employees", "Payroll Lines", "Journal Entries"],
  },
  {
    id: "forecast-cash",
    category: "forecast",
    title: "التوقعات النقدية",
    englishTitle: "Cash Forecast",
    description: "نظرة تشغيلية على النقد المتوقع حسب التحصيل والمدفوعات والرواتب.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Open Invoices", "Open Bills", "Payroll", "Bank Accounts"],
  },
  {
    id: "vat-summary",
    category: "tax",
    title: "ضريبة القيمة المضافة",
    englishTitle: "VAT Summary",
    description: "ملخص ضريبة المخرجات والمدخلات وصافي المستحق.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Invoices", "Bills", "Expenses", "Tax Rates"],
    ksaTerm: "VAT Return Summary",
    usTerm: "Sales Tax Summary",
  },
  {
    id: "taxes",
    category: "tax",
    title: "الضرائب",
    englishTitle: "Taxes",
    description: "كل الضرائب المطبقة حسب بلد الشركة: VAT أو Sales Tax.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Tax Rates", "Sales", "Purchases", "Expenses"],
    ksaTerm: "VAT / accounting review required",
    usTerm: "Sales Tax / State-ready",
  },
  {
    id: "taxes-detail",
    category: "tax",
    title: "الضرائب - مفصّل",
    englishTitle: "Detailed Taxes",
    description: "تفاصيل الضريبة حسب المستند، الجهة، المعدل، والفرع.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Tax Lines", "Invoices", "Bills", "Expenses"],
  },
  {
    id: "trial-balance",
    category: "accountant",
    title: "ميزان المراجعة",
    englishTitle: "Trial Balance",
    description: "أرصدة مدينة ودائنة لكل حساب مع تحقق التوازن.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Chart of Accounts", "Journal Entries"],
  },
  {
    id: "account-statement",
    category: "accountant",
    title: "كشف الحساب",
    englishTitle: "Account Statement",
    description: "كشف حساب محاسبي مختصر مع الرصيد الجاري.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Accounts", "Journal Lines"],
  },
  {
    id: "account-statement-detail",
    category: "accountant",
    title: "كشف الحساب - مفصّل",
    englishTitle: "Detailed Account Statement",
    description: "كشف مفصل لكل قيد وسطر ومصدر وربط بالمرفقات.",
    status: "ready",
    isNew: true,
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Accounts", "Journal Lines", "Attachments"],
  },
  {
    id: "general-ledger",
    category: "accountant",
    title: "دفتر الأستاذ العام",
    englishTitle: "General Ledger",
    description: "دفتر الأستاذ لكل الحسابات مع المدين والدائن والرصيد.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Journal Entries", "Chart of Accounts"],
  },
  {
    id: "audit-log",
    category: "accountant",
    title: "سجل التدقيق",
    englishTitle: "Audit Log",
    description: "سجل تغييرات المستخدمين والاعتمادات والحذف والعكس المحاسبي.",
    status: "live",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Audit Log", "Users", "Documents"],
  },
  {
    id: "bank-reconciliation-report",
    category: "accountant",
    title: "تقرير تسوية مصرفية",
    englishTitle: "Bank Reconciliation Report",
    description: "حالة التسوية بين كشف البنك والحركات المسجلة في النظام.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Bank Accounts", "Bank Transactions", "Journal Entries"],
  },
  {
    id: "inventory-movement",
    category: "inventory",
    title: "حركة المخزون",
    englishTitle: "Inventory Movement",
    description: "حركات دخول وخروج وتعديل ورجوع المخزون.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Products", "Inventory Movements", "Warehouses"],
  },
  {
    id: "inventory-by-warehouse",
    category: "inventory",
    title: "حركة المخزون بحسب المستودع",
    englishTitle: "Inventory Movement by Warehouse",
    description: "حركات كل مستودع مع الرصيد والتكلفة.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Warehouses", "Inventory Movements"],
    segmentation: ["Warehouse"],
  },
  {
    id: "inventory-monthly-summary",
    category: "inventory",
    title: "الملخص الشهري للمخزون",
    englishTitle: "Monthly Inventory Summary",
    description: "رصيد أول المدة، الحركة، الرصيد الختامي، وتقييم المخزون شهرياً.",
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Inventory", "Costing", "Products"],
  },
];

const EN_DESCRIPTIONS: Record<string, string> = {
  "income-statement": "Company revenues, expenses, and net profit for the period.",
  "income-by-branch": "Same income statement with results split by branch.",
  "branch-performance": "Revenue, direct cost, margin, invoice count and average invoice per branch.",
  "project-profitability": "Contract value, billed, revenue, cost by source, margin, budget vs actual, % complete and retention per project.",
  "income-by-cost-center": "Revenue and expense analysis by cost center.",
  "income-by-project": "Profitability of each project from related sales, purchases, and expenses.",
  "cash-flow": "Summary of cash in and out from documents and bank accounts.",
  "cash-flow-indirect": "Starts from net profit then adjusts for receivables, inventory, and non-cash entries.",
  "balance-sheet": "Assets, liabilities, and equity from account balances.",
  "cash-forecast": "Forecast of cash from due invoices, expenses, and payments.",
  "management-pdf": "Management PDF pack: executive summary, profit, cash, tax, and operating metrics.",
  "consolidated-income": "Results of multiple companies or legal branches with intercompany eliminations.",
  "consolidated-cash-flow": "Consolidated cash flows for the group with subsidiary entities shown.",
  "consolidated-balance-sheet": "Consolidated financial position for the group or related companies.",
  "customer-balances": "Open customer balances and expected collection amounts.",
  "customer-statement": "Brief statement of customer activity: invoices, receipts, and credit notes.",
  "customer-statement-detail": "Detailed activity by lines, documents, payments, and running balance.",
  "ar-aging": "Split receivables by days overdue.",
  "ar-aging-detail": "Detailed aging by customer, invoice, and due date.",
  "sales-by-customer": "Sales per customer with invoice totals and collected amounts.",
  "sales-by-branch": "Sales analysis by branch.",
  "sales-by-project": "Project revenue from invoices and contracts.",
  "sales-by-product": "Best-selling products and services with quantities and margin.",
  "supplier-balances": "Open supplier balances and due payments.",
  "supplier-statement": "Brief statement of supplier activity: bills, payments, and supplier credits.",
  "supplier-statement-detail": "Detailed supplier activity by document lines, payments, and running balance.",
  "ap-aging": "Split payables by due date.",
  "ap-aging-detail": "Detailed aging by supplier, bill, and due date.",
  "bills-by-supplier": "Supplier bills and totals by party.",
  "bills-by-branch": "Distribution of purchase bills across branches.",
  "expenses-by-vendor": "Cash expense analysis by vendor or party.",
  "expenses-by-branch": "Distribution of expenses across company branches.",
  "purchases-by-product": "Product and service purchases with quantities and costs.",
  "employee-statement": "Employee activity: salaries, advances, claims, and amounts due.",
  "employee-statement-detail": "Detailed statement of salary, allowances, deductions, payments, and entries.",
  "forecast-cash": "Operational view of projected cash from collections, payments, and payroll.",
  "vat-summary": "Summary of output and input tax and net payable.",
  "taxes": "All applicable taxes by company country: VAT or Sales Tax.",
  "taxes-detail": "Tax details by document, party, rate, and branch.",
  "trial-balance": "Debit and credit balances per account with balance verification.",
  "account-statement": "Brief accounting statement with running balance.",
  "account-statement-detail": "Detailed statement of each entry, line, source, and attachment links.",
  "general-ledger": "General ledger for all accounts with debit, credit, and balance.",
  "audit-log": "Log of user changes, approvals, deletions, and accounting reversals.",
  "bank-reconciliation-report": "Reconciliation status between bank statement and system transactions.",
  "inventory-movement": "Inventory in, out, adjustment, and return movements.",
  "inventory-by-warehouse": "Movements per warehouse with balance and cost.",
  "inventory-monthly-summary": "Opening balance, movement, closing balance, and monthly inventory valuation.",
};

const statusMeta = (t: TFunc): Record<ReportStatus, { label: string; short: string; className: string; help: string }> => ({
  live: {
    label: t("يقرأ من البيانات الآن", "Live from data now"),
    short: t("مباشر", "Live"),
    className: "text-success",
    help: t("مرتبط ببيانات الشركة الحالية ويعرض أرقاماً فعلية عند توفرها.", "Linked to the current company data and shows real numbers when available."),
  },
  ready: {
    label: t("جاهز كقالب احترافي", "Ready as a professional template"),
    short: t("جاهز", "Ready"),
    className: "text-muted-foreground",
    help: t("موجود في النظام كتعريف تقرير مع مصادره ومخرجاته، وتظهر أرقامه عند اكتمال بياناته.", "Exists in the system as a report definition with its sources and outputs; numbers appear once its data is complete."),
  },
  needs_data: {
    label: t("يتطلب بيانات المجموعة", "Requires group data"),
    short: t("بيانات المجموعة", "Group data"),
    className: "text-warning",
    help: t("مخصص للشركات المتعددة أو البيانات المتقدمة، وليس مخفياً أو محجوباً بالباقة.", "Designed for multi-company or advanced data, not hidden or gated by the plan."),
  },
});

export function Reports() {
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ReportCategoryId | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.dashboard.summary();
        if (alive) setSummary(data);
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : t("تعذر تحميل التقارير", "Failed to load reports"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profile = useMemo(() => getCompanyProfile(summary, t), [summary, language]);
  const currency = summary?.org.baseCurrency || profile.currency;
  const catalog = useMemo(() => localizeCatalog(reportCatalog, profile), [profile]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((report) => {
      const inCategory = category === "all" || report.category === category;
      if (!inCategory) return false;
      if (!normalizedQuery) return true;
      const categoryTitle = categories.find((item) => item.id === report.category)?.title || "";
      return [report.title, report.englishTitle, report.description, categoryTitle, report.dataSources.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [catalog, category, query]);

  const counts = useMemo(() => summarizeReports(catalog), [catalog]);

  const sections = useMemo(
    () =>
      categories
        .map((item) => ({ category: item, reports: filteredReports.filter((report) => report.category === item.id) }))
        .filter((group) => group.reports.length > 0),
    [filteredReports],
  );

  // Band figures: the numeral carries the size, the currency stays a small quiet unit after it.
  const figures = [
    {
      key: "revenue",
      label: t("الإيرادات · الفترة الحالية", "Revenue · current period"),
      value: money(summary?.kpi.revenue, ""),
      unit: currency,
      hint: t("من الفواتير المعتمدة", "From issued invoices"),
    },
    {
      key: "cash",
      label: t("النقد المتاح", "Cash on hand"),
      value: money(summary?.kpi.cashOnHand, ""),
      unit: currency,
      hint: t("أرصدة الحسابات البنكية والنقدية", "Bank and cash account balances"),
    },
    {
      key: "ar",
      label: t("الذمم المدينة", "Accounts receivable"),
      value: money(summary?.kpi.accountsReceivable, ""),
      unit: currency,
      hint: t("مستحق على العملاء", "Owed by customers"),
    },
    {
      key: "vat",
      label: profile.taxLabel,
      value: money(summary?.kpi.vatNet, ""),
      unit: currency,
      hint: profile.taxSystem,
    },
  ];

  const exportCatalogCsv = () => {
    const header = "Category,Report,English Title,Status,Formats,Data Sources";
    const csv = [
      header,
      ...catalog.map((report) => {
        const categoryTitle = categories.find((item) => item.id === report.category)?.title || report.category;
        return [categoryTitle, report.title, report.englishTitle, statusMeta(t)[report.status].label, report.formats.join(" / "), report.dataSources.join(" / ")]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",");
      }),
    ].join("\n");
    downloadCsv(csv, "entix-reports-catalog.csv");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">{t("للمحاسب", "For the accountant")}</span>
          <h1 className="text-[28px] font-bold leading-[1.2] tracking-[-0.01em] text-foreground">{t("مركز التقارير", "Reports Center")}</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {t("إجمالي التقارير", "Total reports")} <span className="font-display text-sm tabular-nums text-foreground">{numberValue(counts.total)}</span>
            </span>
            <span>
              {t("مرتبطة ببيانات فعلية", "Linked to live data")} <span className="font-display text-sm tabular-nums text-foreground">{numberValue(counts.live)}</span>
            </span>
            <span>
              {t("تقارير جديدة", "New reports")} <span className="font-display text-sm tabular-nums text-foreground">{numberValue(counts.newReports)}</span>
            </span>
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2.5">
          <span className="inline-flex min-h-10 items-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground">
            {profile.standardLabel}
          </span>
          <Button variant="secondary" onClick={exportCatalogCsv}>
            <FileText className="me-2 h-4 w-4" strokeWidth={1.75} />{t("تصدير فهرس التقارير", "Export report index")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <div className="grid gap-6 rounded-lg border border-foreground bg-foreground px-6 py-[22px] text-background sm:grid-cols-2 xl:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.key} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs text-chart-3">{figure.label}</span>
            <span className="self-start font-display text-[40px] leading-none tabular-nums text-background" dir="ltr">
              {figure.value}
              {figure.unit && <small className="ms-1.5 align-baseline text-base font-normal text-chart-5">{figure.unit}</small>}
            </span>
            <span className="truncate text-xs text-chart-5">{figure.hint}</span>
          </div>
        ))}
      </div>

      <CoreStatementsBlock catalog={catalog} />

      <div className="flex flex-col gap-3">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("ابحث باسم التقرير، المصدر، الفرع، المشروع، الضريبة...", "Search by report name, source, branch, project, tax...")}
            className="h-11 w-full rounded-lg border border-border bg-card px-3.5 pe-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/10"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")} count={catalog.length}>
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            {t("كل التقارير", "All reports")}
          </FilterChip>
          {categories.map((item) => {
            const Icon = item.icon;
            const itemCount = catalog.filter((report) => report.category === item.id).length;
            return (
              <FilterChip key={item.id} active={category === item.id} onClick={() => setCategory(item.id)} count={itemCount}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {language === "en" ? item.englishTitle || item.title : item.title}
              </FilterChip>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
      ) : sections.length === 0 ? (
        <Empty text={t("لا يوجد تقرير مطابق للبحث الحالي", "No report matches the current search")} />
      ) : (
        <div className="space-y-[22px]">
          {sections.map((group) => (
            <section key={group.category.id} className="space-y-2.5">
              <span className="ledger-eyebrow block">
                {language === "en" ? group.category.englishTitle || group.category.title : group.category.title}
              </span>
              <ReportCards reports={group.reports} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-content-secondary hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
      <span className={`font-display text-xs tabular-nums ${active ? "text-background/70" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}

/**
 * The reports center is a directory of cards — an icon per report, its title
 * and one-line purpose, its status. Opening a report goes straight to the
 * report itself (numbers/equation live there), not to a preview pane
 * (2026-08-19 simplification wave).
 */
const CORE_STATEMENTS: Array<{ id: string; icon: ReportIcon }> = [
  { id: "income-statement", icon: TrendingUp },
  { id: "balance-sheet", icon: Scale },
  { id: "cash-flow", icon: Waves },
];

function CoreStatementsBlock({ catalog }: { catalog: ReportDefinition[] }) {
  const { language, t } = useLanguage();
  const core = CORE_STATEMENTS.map(({ id, icon }) => ({ def: catalog.find((r) => r.id === id), icon })).filter((x) => x.def);
  if (core.length === 0) return null;
  return (
    <section className="space-y-2.5">
      <h2 className="ledger-eyebrow block">{t("القوائم المالية الأساسية", "Core financial statements")}</h2>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {core.map(({ def, icon: Icon }) => (
          <ReportCard
            key={def!.id}
            id={def!.id}
            title={language === "en" ? def!.englishTitle || def!.title : def!.title}
            description={t(def!.description, EN_DESCRIPTIONS[def!.id] || def!.description)}
            icon={Icon}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * One report = one paper card: a 40px icon tile, the report's name with a
 * chevron toward the reading end, and one line of purpose. The status word and
 * the export formats stay as a quiet meta line so the card keeps the
 * reference's four-up rhythm instead of growing a boxed footer.
 */
function ReportCard({
  id,
  title,
  description,
  icon: Icon,
  badge,
  meta,
}: {
  id: string;
  title: string;
  description: string;
  icon: ReportIcon;
  badge?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Link
      to={`/app/reports/${id}`}
      className="ledger-hoverable group flex min-h-24 items-stretch gap-3.5 rounded-lg border border-border bg-card px-5 py-[18px] transition"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-lg bg-info-subtle">
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[15px] font-semibold leading-snug text-foreground">
            {title}
            {badge}
          </span>
          <ChevronLeft className="h-3.5 w-3.5 shrink-0 rotate-180 text-muted-foreground rtl:rotate-0" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="line-clamp-2 text-xs leading-[1.7] text-content-secondary">{description}</p>
        {meta}
      </div>
    </Link>
  );
}

function ReportCards({ reports }: { reports: ReportDefinition[] }) {
  const { language, t } = useLanguage();
  if (reports.length === 0) return <Empty text={t("لا يوجد تقرير مطابق للبحث الحالي", "No report matches the current search")} />;

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          id={report.id}
          icon={iconFor(report)}
          title={language === "en" ? report.englishTitle || report.title : report.title}
          description={t(report.description, EN_DESCRIPTIONS[report.id] || report.description)}
          badge={report.isNew ? (
            <span className="ms-2 inline-block whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 align-middle text-[10px] font-semibold text-background">{t("جديد", "New")}</span>
          ) : undefined}
          meta={(
            <span className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[11px] text-muted-foreground">
              <StatusBadge status={report.status} />
              <span className="font-code truncate">{report.formats.join(" · ")}</span>
            </span>
          )}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useLanguage();
  const meta = statusMeta(t)[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${meta.className}`} title={meta.label}>
      <span className={`ledger-dot${status === "ready" ? " hollow" : ""}`} />
      {meta.short}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-content-secondary">
      <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" strokeWidth={1.75} />
      {text}
    </div>
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function summarizeReports(catalog: ReportDefinition[]) {
  return catalog.reduce(
    (acc, report) => {
      acc.total += 1;
      if (report.status === "live") acc.live += 1;
      if (report.isNew) acc.newReports += 1;
      return acc;
    },
    { total: 0, live: 0, newReports: 0 },
  );
}

function getCompanyProfile(summary: DashboardSummary | null, t: TFunc) {
  const country = (summary?.org.country || "SA").toUpperCase();
  const isUs = country === "US" || country === "USA";
  return {
    country,
    countryLabel: isUs ? t("شركة أمريكية", "US Company") : t("شركة سعودية", "Saudi Company"),
    currency: isUs ? "USD" : "SAR",
    taxLabel: isUs ? t("Sales Tax الصافي", "Sales Tax Net") : t("VAT الصافي", "VAT Net"),
    taxSystem: isUs ? "Sales Tax / State Tax" : "VAT / ZATCA",
    standardLabel: isUs ? "US GAAP-ready naming" : "IFRS-oriented naming · accounting review required",
  };
}

function localizeCatalog(catalog: ReportDefinition[], profile: ReturnType<typeof getCompanyProfile>) {
  if (profile.country === "US" || profile.country === "USA") {
    return catalog.map((report) => {
      if (report.id === "balance-sheet") return { ...report, title: "قائمة المركز المالي / Balance Sheet" };
      if (report.id === "vat-summary") return { ...report, title: "Sales Tax Summary", englishTitle: "Sales Tax Summary" };
      if (report.id === "taxes") return { ...report, title: "الضرائب / Sales Tax", englishTitle: "Taxes / Sales Tax" };
      if (report.id === "taxes-detail") return { ...report, title: "الضرائب - مفصّل / Detailed Sales Tax" };
      return report;
    });
  }
  return catalog.map((report) => {
    if (report.id === "vat-summary") return { ...report, title: "ضريبة القيمة المضافة" };
    return report;
  });
}
