import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Landmark,
  Loader2,
  Package,
  Printer,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, type DashboardSummary } from "../lib/api";

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
  icon: ComponentType<{ className?: string }>;
  accent: string;
};

type PreviewRow = {
  label: string;
  value: string;
  note: string;
};

const money = (value: string | number | null | undefined, currency = "SAR") => {
  const formatted = Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
};

const numberValue = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US");

const categories: CategoryDefinition[] = [
  { id: "financial", title: "تقارير مالية", englishTitle: "Financial", icon: BarChart3, accent: "bg-blue-50 text-blue-700 border-blue-100" },
  { id: "consolidated", title: "التقارير المالية الموحدة", englishTitle: "Consolidated", icon: Building2, accent: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { id: "sales", title: "مبيعات", englishTitle: "Sales", icon: Users, accent: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { id: "purchases", title: "مشتريات", englishTitle: "Purchases", icon: Wallet, accent: "bg-amber-50 text-amber-700 border-amber-100" },
  { id: "payroll", title: "الرواتب", englishTitle: "Payroll", icon: ClipboardList, accent: "bg-sky-50 text-sky-700 border-sky-100" },
  { id: "forecast", title: "توقعات", englishTitle: "Forecasts", icon: TrendingUp, accent: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  { id: "tax", title: "تقارير الضرائب", englishTitle: "Tax", icon: ShieldCheck, accent: "bg-rose-50 text-rose-700 border-rose-100" },
  { id: "accountant", title: "للمحاسب", englishTitle: "Accountant", icon: Calculator, accent: "bg-slate-50 text-slate-700 border-slate-200" },
  { id: "inventory", title: "مخزون", englishTitle: "Inventory", icon: Package, accent: "bg-teal-50 text-teal-700 border-teal-100" },
];

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
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Branches", "Invoices", "Bills", "Journal Entries"],
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
    status: "ready",
    formats: ["PDF", "CSV", "Excel"],
    dataSources: ["Projects", "Invoices", "Bills", "Expenses"],
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
    status: "ready",
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
    status: "ready",
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
    status: "ready",
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
    status: "ready",
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
    ksaTerm: "VAT / ZATCA-ready",
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

const statusMeta: Record<ReportStatus, { label: string; className: string; help: string }> = {
  live: {
    label: "يقرأ من البيانات الآن",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    help: "مرتبط ببيانات الشركة الحالية ويعرض أرقاماً فعلية عند توفرها.",
  },
  ready: {
    label: "جاهز كقالب احترافي",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    help: "موجود في النظام كتعريف تقرير مع مصادره ومخرجاته، وتظهر أرقامه عند اكتمال بياناته.",
  },
  needs_data: {
    label: "يتطلب بيانات المجموعة",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    help: "مخصص للشركات المتعددة أو البيانات المتقدمة، وليس مخفياً أو محجوباً بالباقة.",
  },
};

export function Reports() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ReportCategoryId | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(() => {
    if (typeof window !== "undefined" && window.location.pathname.includes("cash-flow")) return "cash-flow";
    if (typeof window !== "undefined" && window.location.pathname.includes("profit-loss")) return "income-statement";
    return "income-statement";
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.dashboard.summary();
        if (alive) setSummary(data);
      } catch (e: any) {
        if (alive) setError(e instanceof ApiError ? e.message : "تعذر تحميل التقارير");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const profile = useMemo(() => getCompanyProfile(summary), [summary]);
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

  const selectedReport = catalog.find((report) => report.id === selectedReportId) || filteredReports[0] || catalog[0];
  const selectedRows = useMemo(() => buildPreviewRows(selectedReport, summary, currency, profile), [selectedReport, summary, currency, profile]);
  const counts = useMemo(() => summarizeReports(catalog), [catalog]);

  const exportSelectedCsv = () => {
    const header = "Report,Category,Line,Value,Note";
    const categoryTitle = categories.find((item) => item.id === selectedReport.category)?.title || selectedReport.category;
    const csv = [
      header,
      ...selectedRows.map((row) =>
        [selectedReport.title, categoryTitle, row.label, row.value, row.note]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    downloadCsv(csv, `entix-${selectedReport.id}.csv`);
  };

  const exportCatalogCsv = () => {
    const header = "Category,Report,English Title,Status,Formats,Data Sources";
    const csv = [
      header,
      ...catalog.map((report) => {
        const categoryTitle = categories.find((item) => item.id === report.category)?.title || report.category;
        return [categoryTitle, report.title, report.englishTitle, statusMeta[report.status].label, report.formats.join(" / "), report.dataSources.join(" / ")]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",");
      }),
    ].join("\n");
    downloadCsv(csv, "entix-reports-catalog.csv");
  };

  const printSelectedReport = () => {
    navigate(`/app/reports/${selectedReport.id}/print`);
  };

  const selectCategory = (nextCategory: ReportCategoryId | "all") => {
    setCategory(nextCategory);
    const first = catalog.find((report) => nextCategory === "all" || report.category === nextCategory);
    if (first) setSelectedReportId(first.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>مركز التقارير</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            كل التقارير المالية والتشغيلية موجودة بفهرس واحد، مع مصطلحات متوافقة مع {profile.countryLabel}.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCatalogCsv}>
            <FileText className="me-2 h-4 w-4" />تصدير فهرس التقارير
          </Button>
          <Button variant="outline" onClick={printSelectedReport} disabled={!selectedReport}>
            <Printer className="me-2 h-4 w-4" />PDF / طباعة
          </Button>
          <Button variant="outline" onClick={exportSelectedCsv} disabled={!selectedReport}>
            <Download className="me-2 h-4 w-4" />تصدير التقرير المحدد
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="إجمالي التقارير" value={numberValue(counts.total)} tone="info" />
        <Metric label="مرتبطة ببيانات فعلية" value={numberValue(counts.live)} tone="good" />
        <Metric label="تقارير جديدة" value={numberValue(counts.newReports)} tone="warn" />
        <Metric label={profile.taxLabel} value={summary ? money(summary.kpi.vatNet, currency) : money(0, currency)} tone="info" />
      </div>

      <Card className="border-[#E5E7EB] bg-white">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,260px)_1fr]">
            <aside className="space-y-2">
              <button
                onClick={() => selectCategory("all")}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm transition ${
                  category === "all" ? "border-[#1276E3] bg-[#EAF4FF] text-[#0B1B49]" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
              >
                <span className="flex items-center gap-2"><Filter className="h-4 w-4" />كل التقارير</span>
                <span className="font-english text-xs">{catalog.length}</span>
              </button>
              {categories.map((item) => {
                const Icon = item.icon;
                const itemCount = catalog.filter((report) => report.category === item.id).length;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectCategory(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm transition ${
                      category === item.id ? "border-[#1276E3] bg-[#EAF4FF] text-[#0B1B49]" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{item.title}</span>
                    <span className="font-english text-xs">{itemCount}</span>
                  </button>
                );
              })}
            </aside>

            <section className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ابحث باسم التقرير، المصدر، الفرع، المشروع، الضريبة..."
                    className="h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-4 pe-10 text-sm outline-none focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10"
                  />
                </label>
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs text-[#374151]">
                  <span className="font-semibold text-[#0B1B49]">{profile.standardLabel}</span>
                  <span className="mx-2 text-[#CBD5E1]">|</span>
                  <span>{profile.taxSystem}</span>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1276E3]" /></div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
                  <ReportList
                    reports={filteredReports}
                    selectedReportId={selectedReport.id}
                    onSelect={(id) => {
                      setSelectedReportId(id);
                      navigate(`/app/reports/${id}`);
                    }}
                  />
                  <ReportPreview
                    report={selectedReport}
                    rows={selectedRows}
                    summary={summary}
                    currency={currency}
                    profile={profile}
                    onExport={exportSelectedCsv}
                    onPrint={printSelectedReport}
                  />
                </div>
              )}
            </section>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 xl:grid-cols-2">
          <OperationalChart title="قائمة الدخل - آخر 6 أشهر" rows={summary.profitLoss.map((r) => ({ label: r.month, a: r.revenue, b: r.expenses, c: r.net }))} currency={currency} />
          <OperationalChart title="التدفق النقدي - آخر 6 أشهر" rows={summary.cashFlowTrend.map((r) => ({ label: r.month, a: r.in, b: r.out, c: r.net }))} currency={currency} cashMode />
        </div>
      )}
    </div>
  );
}

function ReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: ReportDefinition[];
  selectedReportId: string;
  onSelect: (id: string) => void;
}) {
  if (reports.length === 0) return <Empty text="لا يوجد تقرير مطابق للبحث الحالي" />;

  return (
    <div className="max-h-[680px] space-y-2 overflow-y-auto pe-1">
      {reports.map((report) => {
        const category = categories.find((item) => item.id === report.category)!;
        const selected = selectedReportId === report.id;
        return (
          <button
            key={report.id}
            onClick={() => onSelect(report.id)}
            className={`w-full rounded-lg border p-3 text-start transition ${
              selected ? "border-[#1276E3] bg-[#F7FBFF] shadow-sm" : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:bg-[#F9FAFB]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#0B1B49]">{report.title}</span>
                  {report.isNew && <span className="rounded-full bg-[#1276E3] px-2 py-0.5 text-[11px] font-semibold text-white">جديد</span>}
                </div>
                <div className="mt-1 text-xs text-[#6B7280] font-english">{report.englishTitle}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#4B5563]">{report.description}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${category.accent}`}>{category.title}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              {report.formats.map((format) => <span key={format} className="rounded border border-[#E5E7EB] bg-white px-2 py-0.5 text-[11px] text-[#6B7280]">{format}</span>)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ReportPreview({
  report,
  rows,
  summary,
  currency,
  profile,
  onExport,
  onPrint,
}: {
  report: ReportDefinition;
  rows: PreviewRow[];
  summary: DashboardSummary | null;
  currency: string;
  profile: ReturnType<typeof getCompanyProfile>;
  onExport: () => void;
  onPrint: () => void;
}) {
  const category = categories.find((item) => item.id === report.category)!;
  const Icon = category.icon;
  const status = statusMeta[report.status];

  return (
    <Card className="entix-report-print border-[#E5E7EB]">
      <CardHeader className="border-b border-[#EEF2F7]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${category.accent}`}>
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle className="text-[#0B1B49]">{report.title}</CardTitle>
              {report.isNew && <span className="rounded-full bg-[#1276E3] px-2 py-0.5 text-[11px] font-semibold text-white">جديد</span>}
            </div>
            <div className="mt-1 text-xs text-[#6B7280] font-english">{report.englishTitle}</div>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={onPrint}>
              <Printer className="me-2 h-4 w-4" />PDF
            </Button>
            <Button variant="outline" onClick={onExport}>
              <Download className="me-2 h-4 w-4" />CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            <span className="rounded-full border border-[#E5E7EB] bg-white px-2 py-1 text-xs text-[#374151]">{profile.countryLabel}</span>
            <span className="rounded-full border border-[#E5E7EB] bg-white px-2 py-1 text-xs text-[#374151]">{report.ksaTerm || report.usTerm || profile.standardLabel}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#374151]">{report.description}</p>
          <p className="mt-2 text-xs leading-5 text-[#6B7280]">{status.help}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MiniFact label="الشركة" value={summary?.org.name || "الشركة الحالية"} />
          <MiniFact label="العملة" value={currency} />
          <MiniFact label="النظام الضريبي" value={profile.taxSystem} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0B1B49]">معاينة التقرير</h3>
            <span className="text-xs text-[#6B7280]">الأرقام تعرض من البيانات المتاحة الآن</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <th className="px-4 py-3 text-start">البند</th>
                  <th className="px-4 py-3 text-start">القيمة</th>
                  <th className="px-4 py-3 text-start">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.label}-${row.note}`} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-4 py-3 text-sm font-medium text-[#0B1B49]">{row.label}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#0B1B49] font-english">{row.value}</td>
                    <td className="px-4 py-3 text-xs leading-5 text-[#6B7280]">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock title="مصادر البيانات" icon={<Landmark className="h-4 w-4" />}>
            {report.dataSources.join(" · ")}
          </InfoBlock>
          <InfoBlock title="المخرجات" icon={<Printer className="h-4 w-4" />}>
            {report.formats.join(" · ")}
          </InfoBlock>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "info" }) {
  const colors =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "bad"
        ? "border-red-200 bg-red-50"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50"
          : "border-blue-100 bg-blue-50";
  return (
    <div className={`rounded-lg border px-4 py-3 ${colors}`}>
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0B1B49] font-english">{value}</div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
      <div className="text-[11px] text-[#6B7280]">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[#0B1B49]">{value}</div>
    </div>
  );
}

function InfoBlock({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#0B1B49]">{icon}{title}</div>
      <div className="text-xs leading-5 text-[#6B7280]">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const meta = statusMeta[status];
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>;
}

function OperationalChart({
  title,
  rows,
  currency,
  cashMode = false,
}: {
  title: string;
  rows: Array<{ label: string; a: number; b: number; c: number }>;
  currency: string;
  cashMode?: boolean;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.a), Math.abs(row.b), Math.abs(row.c)]));
  if (rows.length === 0) return <Empty text="لا توجد بيانات كافية لهذا التقرير" />;
  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-3 md:grid-cols-[130px_1fr_160px] md:items-center">
              <div className="text-sm font-medium text-[#0B1B49]">{row.label}</div>
              <div className="space-y-1.5">
                <Bar label={cashMode ? "داخل" : "إيراد"} value={row.a} max={max} color="#1276E3" />
                <Bar label={cashMode ? "خارج" : "مصروف"} value={row.b} max={max} color="#EF4444" />
              </div>
              <div className={`text-sm font-semibold font-english ${row.c >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {row.c >= 0 ? <TrendingUp className="me-1 inline h-4 w-4" /> : <TrendingDown className="me-1 inline h-4 w-4" />}
                {money(row.c, currency)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr_120px] items-center gap-2 text-xs">
      <span className="text-[#6B7280]">{label}</span>
      <div className="h-2 rounded bg-[#EEF2F7]">
        <div className="h-2 rounded" style={{ width: `${Math.min(100, (Math.abs(value) / max) * 100)}%`, background: color }} />
      </div>
      <span className="text-end font-english text-[#374151]">{money(value, "")}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-[#6B7280]"><BarChart3 className="mx-auto mb-3 h-9 w-9 text-[#9CA3AF]" />{text}</div>;
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

function getCompanyProfile(summary: DashboardSummary | null) {
  const country = (summary?.org.country || "SA").toUpperCase();
  const isUs = country === "US" || country === "USA";
  return {
    country,
    countryLabel: isUs ? "شركة أمريكية" : "شركة سعودية",
    currency: isUs ? "USD" : "SAR",
    taxLabel: isUs ? "Sales Tax الصافي" : "VAT الصافي",
    taxSystem: isUs ? "Sales Tax / State Tax" : "VAT / ZATCA",
    standardLabel: isUs ? "US GAAP-ready naming" : "IFRS + ZATCA-ready naming",
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

function buildPreviewRows(
  report: ReportDefinition,
  summary: DashboardSummary | null,
  currency: string,
  profile: ReturnType<typeof getCompanyProfile>,
): PreviewRow[] {
  if (!summary) {
    return [
      { label: "حالة البيانات", value: "لم يتم التحميل", note: "سيظهر التقرير بعد تحميل بيانات الشركة." },
      { label: "مصادر التقرير", value: report.dataSources.length.toString(), note: report.dataSources.join(" · ") },
    ];
  }

  const totalExpense = summary.kpi.purchases + summary.kpi.expenses;
  const netIncome = summary.kpi.revenue - totalExpense;
  const equityEstimate = summary.kpi.cashOnHand + summary.kpi.accountsReceivable - summary.kpi.accountsPayable - Math.max(summary.kpi.vatNet, 0);

  if (report.category === "financial" || report.category === "consolidated") {
    if (report.id.includes("cash")) {
      const lastCash = summary.cashFlowTrend[summary.cashFlowTrend.length - 1];
      return [
        { label: "النقد الداخل", value: money(lastCash?.in || summary.kpi.receipts, currency), note: "من سندات القبض والحركات النقدية." },
        { label: "النقد الخارج", value: money(lastCash?.out || summary.kpi.payments, currency), note: "من سندات الدفع والمصروفات." },
        { label: "الصافي", value: money(lastCash?.net || summary.kpi.receipts - summary.kpi.payments, currency), note: report.id.includes("indirect") ? "الطريقة غير المباشرة تحتاج أرصدة افتتاحية وإقفال الفترة." : "تدفق مباشر من البيانات الحالية." },
      ];
    }
    if (report.id.includes("balance")) {
      return [
        { label: "النقد والبنوك", value: money(summary.kpi.cashOnHand, currency), note: "من الحسابات البنكية والنقدية." },
        { label: "الذمم المدينة", value: money(summary.kpi.accountsReceivable, currency), note: "فواتير العملاء غير المحصلة." },
        { label: "الذمم الدائنة", value: money(summary.kpi.accountsPayable, currency), note: "فواتير الموردين غير المدفوعة." },
        { label: "حقوق الملكية المقدرة", value: money(equityEstimate, currency), note: "تقدير سريع؛ التقرير الكامل يعتمد على كل أرصدة دليل الحسابات." },
      ];
    }
    return [
      { label: "الإيرادات", value: money(summary.kpi.revenue, currency), note: "من الفواتير وقيود الإيراد." },
      { label: "المشتريات والمصروفات", value: money(totalExpense, currency), note: "من فواتير الموردين والمصروفات والقيود." },
      { label: "صافي الربح", value: money(netIncome, currency), note: report.segmentation ? `يمكن تقسيمه حسب ${report.segmentation.join(" / ")}.` : "قابل للتصدير PDF وCSV وExcel." },
    ];
  }

  if (report.category === "sales") {
    return [
      { label: "إجمالي المبيعات", value: money(summary.kpi.revenue, currency), note: "من الفواتير المعتمدة وقيود الإيراد." },
      { label: "الذمم المدينة", value: money(summary.kpi.accountsReceivable, currency), note: "الرصيد المفتوح على العملاء." },
      { label: "عدد الفواتير", value: numberValue(summary.kpi.invoiceCount), note: "عدد فواتير المبيعات في الشركة." },
      { label: "فواتير متأخرة", value: numberValue(summary.kpi.overdueCount), note: report.id.includes("aging") ? "تستخدم لتقادم الحسابات المدينة." : "تنبيه تحصيل." },
    ];
  }

  if (report.category === "purchases") {
    return [
      { label: "إجمالي المشتريات", value: money(summary.kpi.purchases, currency), note: "من فواتير الموردين." },
      { label: "إجمالي المصروفات", value: money(summary.kpi.expenses, currency), note: "من المصروفات النقدية والمرفقات المقروءة OCR." },
      { label: "الذمم الدائنة", value: money(summary.kpi.accountsPayable, currency), note: "رصيد الموردين المفتوح." },
      { label: "مدفوعات", value: money(summary.kpi.payments, currency), note: "سندات الدفع والحركات النقدية." },
    ];
  }

  if (report.category === "tax") {
    return [
      { label: profile.country === "US" ? "Sales Tax Output" : "VAT مخرجات", value: money(summary.kpi.vatOutput, currency), note: "ضريبة المبيعات أو الفواتير الصادرة." },
      { label: profile.country === "US" ? "Tax Input / Credits" : "VAT مدخلات", value: money(summary.kpi.vatInput, currency), note: "ضريبة مشتريات ومصروفات قابلة للمراجعة." },
      { label: "الصافي", value: money(summary.kpi.vatNet, currency), note: profile.taxSystem },
    ];
  }

  if (report.category === "accountant") {
    return [
      { label: "الحسابات", value: "دليل الحسابات", note: "التقرير يعتمد على القيود المرحلة وأرصدة الحسابات." },
      { label: "النقد", value: money(summary.kpi.cashOnHand, currency), note: "نقطة تحقق سريعة من أرصدة البنوك." },
      { label: "سجل التدقيق", value: report.id === "audit-log" ? "متاح" : "مرتبط", note: "يسجل الاعتماد والحذف والعكس وتعديل البيانات الحساسة." },
    ];
  }

  if (report.category === "payroll") {
    return [
      { label: "مصدر التقرير", value: "Payroll Runs", note: "يظهر تفصيلاً عند حفظ مسيرات الرواتب." },
      { label: "الربط المحاسبي", value: "Journal Entries", note: "يجب ترحيل قيد الرواتب ليظهر في التقارير المالية." },
      { label: "الامتثال", value: profile.country === "US" ? "Payroll / Tax" : "GOSI / WPS", note: "المسمى يتغير حسب بلد الشركة." },
    ];
  }

  if (report.category === "inventory") {
    return [
      { label: "مصدر التقرير", value: "Inventory Movements", note: "دخول، خروج، تعديل، وإرجاع للمخزون." },
      { label: "التقسيم", value: report.segmentation?.join(" / ") || "Product", note: "يدعم المستودعات والمنتجات والخدمات." },
      { label: "التكلفة", value: "Inventory Costing", note: "جاهز للربط مع تقييم المخزون عند اكتمال الحركات." },
    ];
  }

  return [
    { label: "مصدر التقرير", value: report.dataSources[0] || "Data", note: report.description },
    { label: "المخرجات", value: report.formats.join(" / "), note: "التقرير موجود ضمن الفهرس ولا توجد رسالة حجب باقة." },
  ];
}
