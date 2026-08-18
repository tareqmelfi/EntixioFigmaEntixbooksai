import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router";
import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardList,
  FileText,
  Filter,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
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
  icon: ComponentType<{ className?: string }>;
  accent: string;
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
  { id: "financial", title: "تقارير مالية", englishTitle: "Financial Reports", icon: BarChart3, accent: "bg-blue-50 text-blue-700 border-blue-100" },
  { id: "consolidated", title: "التقارير المالية الموحدة", englishTitle: "Consolidated Reports", icon: Building2, accent: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { id: "sales", title: "مبيعات", englishTitle: "Sales", icon: Users, accent: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { id: "purchases", title: "مشتريات", englishTitle: "Purchases", icon: Wallet, accent: "bg-amber-50 text-amber-700 border-amber-100" },
  { id: "payroll", title: "الرواتب", englishTitle: "Payroll", icon: ClipboardList, accent: "bg-sky-50 text-sky-700 border-sky-100" },
  { id: "forecast", title: "توقعات", englishTitle: "Forecasts", icon: TrendingUp, accent: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  { id: "tax", title: "تقارير الضرائب", englishTitle: "Tax Reports", icon: ShieldCheck, accent: "bg-rose-50 text-rose-700 border-rose-100" },
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

const statusMeta = (t: TFunc): Record<ReportStatus, { label: string; className: string; help: string }> => ({
  live: {
    label: t("يقرأ من البيانات الآن", "Live from data now"),
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    help: t("مرتبط ببيانات الشركة الحالية ويعرض أرقاماً فعلية عند توفرها.", "Linked to the current company data and shows real numbers when available."),
  },
  ready: {
    label: t("جاهز كقالب احترافي", "Ready as a professional template"),
    className: "border-blue-200 bg-blue-50 text-blue-700",
    help: t("موجود في النظام كتعريف تقرير مع مصادره ومخرجاته، وتظهر أرقامه عند اكتمال بياناته.", "Exists in the system as a report definition with its sources and outputs; numbers appear once its data is complete."),
  },
  needs_data: {
    label: t("يتطلب بيانات المجموعة", "Requires group data"),
    className: "border-amber-200 bg-amber-50 text-amber-700",
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("مركز التقارير", "Reports Center")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("كل التقارير المالية والتشغيلية موجودة بفهرس واحد، مع مصطلحات متوافقة مع ", "All financial and operational reports are in one index, with terminology aligned with ")}{profile.countryLabel}.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCatalogCsv}>
            <FileText className="me-2 h-4 w-4" />{t("تصدير فهرس التقارير", "Export report index")}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label={t("إجمالي التقارير", "Total reports")} value={numberValue(counts.total)} tone="info" />
        <Metric label={t("مرتبطة ببيانات فعلية", "Linked to live data")} value={numberValue(counts.live)} tone="good" />
        <Metric label={t("تقارير جديدة", "New reports")} value={numberValue(counts.newReports)} tone="warn" />
        <Metric label={profile.taxLabel} value={summary ? money(summary.kpi.vatNet, currency) : money(0, currency)} tone="info" />
      </div>

      <Card className="border-border bg-white">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,260px)_1fr]">
            <aside className="space-y-2">
              <button
                onClick={() => setCategory("all")}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm transition ${
                  category === "all" ? "border-primary bg-primary/5 text-foreground" : "border-border bg-white text-foreground/80 hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2"><Filter className="h-4 w-4" />{t("كل التقارير", "All reports")}</span>
                <span className="font-english text-xs">{catalog.length}</span>
              </button>
              {categories.map((item) => {
                const Icon = item.icon;
                const itemCount = catalog.filter((report) => report.category === item.id).length;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCategory(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm transition ${
                      category === item.id ? "border-primary bg-primary/5 text-foreground" : "border-border bg-white text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{language === "en" ? item.englishTitle || item.title : item.title}</span>
                    <span className="font-english text-xs">{itemCount}</span>
                  </button>
                );
              })}
            </aside>

            <section className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("ابحث باسم التقرير، المصدر، الفرع، المشروع، الضريبة...", "Search by report name, source, branch, project, tax...")}
                    className="h-11 w-full rounded-lg border border-border bg-white px-4 pe-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/10"
                  />
                </label>
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground/80">
                  <span className="font-semibold text-foreground">{profile.standardLabel}</span>
                  <span className="mx-2 text-muted-foreground">|</span>
                  <span>{profile.taxSystem}</span>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
              ) : (
                <ReportCards reports={filteredReports} />
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The reports center is a directory of cards — an icon per report, its title
 * and one-line purpose, its status. Opening a report goes straight to the
 * report itself (numbers/equation live there), not to a preview pane
 * (2026-08-19 simplification wave).
 */
function ReportCards({ reports }: { reports: ReportDefinition[] }) {
  const { language, t } = useLanguage();
  if (reports.length === 0) return <Empty text={t("لا يوجد تقرير مطابق للبحث الحالي", "No report matches the current search")} />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {reports.map((report) => {
        const category = categories.find((item) => item.id === report.category)!;
        const Icon = category.icon;
        return (
          <Link
            key={report.id}
            to={`/app/reports/${report.id}`}
            className="group rounded-lg border border-border bg-white p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-start gap-3">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${category.accent}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground group-hover:text-primary">{language === "en" ? report.englishTitle || report.title : report.title}</span>
                  {report.isNew && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">{t("جديد", "New")}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/70">{t(report.description, EN_DESCRIPTIONS[report.id] || report.description)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={report.status} />
                  {report.formats.map((format) => <span key={format} className="rounded border border-border bg-white px-2 py-0.5 text-[11px] text-muted-foreground">{format}</span>)}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
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
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground font-english">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useLanguage();
  const meta = statusMeta(t)[status];
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground"><BarChart3 className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" />{text}</div>;
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
