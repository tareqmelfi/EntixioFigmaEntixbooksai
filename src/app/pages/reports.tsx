import { useState } from "react";
import {
  BarChart3, FileText, Download, Filter, Search, Eye, X,
  DollarSign, TrendingUp, Building2, Landmark, CreditCard,
  Receipt, ShoppingCart, Package, Users, Calculator, Wallet,
  Shield, Clock, BookOpen, Layers, GitBranch, PieChart,
  FileSpreadsheet, ArrowUpDown, Printer, ChevronDown
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

/* ─── Types ─── */
interface Report {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  badge?: "جديد" | "موحد";
}

/* ─── All 42 Reports ─── */
const allReports: Report[] = [
  // ── التقارير المالية (9) ──
  { id: "income-statement", title: "قائمة الدخل", description: "تقرير شامل للإيرادات والمصروفات والأرباح", icon: FileText, category: "financial" },
  { id: "income-by-branch", title: "قائمة الدخل بحسب الفرع", description: "تحليل الربحية لكل فرع", icon: GitBranch, category: "financial" },
  { id: "income-by-cost-center", title: "قائمة الدخل بحسب مركز التكلفة", description: "تقرير الإيرادات حسب مراكز التكلفة", icon: PieChart, category: "financial" },
  { id: "income-by-project", title: "قائمة الدخل بحسب المشروع", description: "أداء كل مشروع منفصل", icon: Layers, category: "financial" },
  { id: "cash-flow", title: "التدفق النقدي", description: "حركة النقد الداخل والخارج", icon: TrendingUp, category: "financial", badge: "جديد" },
  { id: "cash-flow-indirect", title: "التدفقات النقدية - الطريقة غير المباشرة", description: "تدفق نقدي بالطريقة غير المباشرة", icon: DollarSign, category: "financial" },
  { id: "balance-sheet", title: "قائمة المركز المالي", description: "الأصول والخصوم وحقوق الملكية", icon: Landmark, category: "financial" },
  { id: "cash-forecast", title: "التوقعات النقدية", description: "توقعات السيولة النقدية المستقبلية", icon: TrendingUp, category: "financial" },
  { id: "management-reports", title: "تقارير الإدارة (PDF)", description: "تقارير تنفيذية شاملة", icon: FileSpreadsheet, category: "financial" },

  // ── تقارير موحدة (3) ──
  { id: "unified-balance-sheet", title: "قائمة المركز المالي الموحدة", description: "ميزانية موحدة", icon: Landmark, category: "unified", badge: "موحد" },
  { id: "unified-cash-flow", title: "التدفق النقدي الموحد", description: "تدفق نقدي موحد", icon: TrendingUp, category: "unified", badge: "موحد" },
  { id: "unified-income", title: "قائمة الدخل الموحدة", description: "قائمة دخل موحدة لجميع الشركات", icon: FileText, category: "unified", badge: "موحد" },

  // ── مبيعات (9) ──
  { id: "ar-aging", title: "تقادم الحسابات المدينة", description: "تحليل أعمار الديون", icon: Clock, category: "sales" },
  { id: "customer-statement", title: "كشف حساب عميل", description: "تفصيل حساب عميل محدد", icon: Users, category: "sales" },
  { id: "customer-balances", title: "ملخص أرصدة العملاء", description: "أرصدة جميع العملاء", icon: Users, category: "sales", badge: "جديد" },
  { id: "ar-aging-detail", title: "تقادم الحسابات المدينة - مفصل", description: "تقادم تفصيلي للمدينين", icon: Clock, category: "sales" },
  { id: "sales-by-customer", title: "المبيعات بحسب العميل", description: "تحليل مبيعات كل عميل", icon: Users, category: "sales" },
  { id: "sales-by-branch", title: "المبيعات بحسب الفرع", description: "أداء المبيعات لكل فرع", icon: Building2, category: "sales" },
  { id: "sales-by-project", title: "المبيعات بحسب المشروع", description: "مبيعات كل مشروع", icon: Layers, category: "sales" },
  { id: "sales-by-product", title: "المبيعات بحسب المنتج أو الخدمة", description: "أداء المنتجات والخدمات", icon: Package, category: "sales" },
  { id: "vendor-balances", title: "ملخص أرصدة الموردين", description: "أرصدة جميع الموردين", icon: ShoppingCart, category: "sales", badge: "جديد" },

  // ── مشتريات (8) ──
  { id: "ap-aging", title: "تقادم الحسابات الدائنة", description: "تحليل أعمار المستحقات", icon: Clock, category: "purchases" },
  { id: "vendor-statement", title: "كشف حساب مورد", description: "تفصيل حساب مورد محدد", icon: ShoppingCart, category: "purchases" },
  { id: "ap-aging-detail", title: "تقادم الحسابات الدائنة - مفصل", description: "تقادم تفصيلي للدائنين", icon: Clock, category: "purchases" },
  { id: "expenses-by-vendor", title: "المصروفات بحسب مورد", description: "تحليل مصروفات الموردين", icon: Receipt, category: "purchases" },
  { id: "bills-by-branch", title: "الفواتير بحسب الفرع", description: "فواتير كل فرع", icon: GitBranch, category: "purchases" },
  { id: "bills-by-vendor", title: "الفواتير بحسب المورد", description: "فواتير كل مورد", icon: ShoppingCart, category: "purchases" },
  { id: "purchases-by-product", title: "مشتريات بحسب المنتج أو الخدمة", description: "تحليل المشتريات حسب الصنف", icon: Package, category: "purchases" },
  { id: "expenses-by-branch", title: "المصروفات بحسب الفرع", description: "مصروفات كل فرع", icon: Building2, category: "purchases" },

  // ── ضرائب (3) ──
  { id: "taxes-summary", title: "الضرائب", description: "ملخص جميع الضرائب", icon: Calculator, category: "taxes" },
  { id: "vat-report", title: "ضريبة القيمة المضافة", description: "تقرير الضريبة المضافة (متوافق مع هيئة الزكاة)", icon: Shield, category: "taxes" },
  { id: "taxes-detail", title: "الضرائب - مفصل", description: "تقرير ضريبي تفصيلي", icon: Calculator, category: "taxes" },

  // ── للمحاسب (7) ──
  { id: "account-statement", title: "كشف الحساب", description: "كشف حساب مفصل", icon: BookOpen, category: "accountant" },
  { id: "trial-balance", title: "ميزان المراجعة", description: "ميزان المراجعة الشامل", icon: BarChart3, category: "accountant" },
  { id: "cash-projections", title: "التوقعات النقدية", description: "توقعات السيولة المستقبلية", icon: TrendingUp, category: "accountant" },
  { id: "bank-reconciliation", title: "تقرير تسوية مصرفية", description: "مطابقة الحسابات البنكية", icon: CreditCard, category: "accountant" },
  { id: "audit-log", title: "سجل التدقيق", description: "تتبع جميع التغييرات والعمليات", icon: Shield, category: "accountant" },
  { id: "general-ledger", title: "دفتر الأستاذ العام", description: "السجل المحاسبي الكامل", icon: BookOpen, category: "accountant" },
  { id: "employee-statement", title: "كشف حساب موظف", description: "تفصيل حساب موظف محدد", icon: Wallet, category: "accountant" },

  // ── مخزون (3) ──
  { id: "inventory-summary", title: "الملخص الشهري للمخزون", description: "ملخص شهري للمخزون", icon: Package, category: "inventory" },
  { id: "inventory-by-warehouse", title: "حركة المخزون بحسب المستودع", description: "تفصيل المخزون لكل مستودع", icon: Building2, category: "inventory" },
  { id: "inventory-movement", title: "حركة المخزون", description: "حركة دخول وخروج المخزون", icon: ArrowUpDown, category: "inventory" },
];

const categories = [
  { key: "all", label: "جميع التقارير" },
  { key: "financial", label: "تقارير مالية" },
  { key: "unified", label: "تقارير موحدة" },
  { key: "sales", label: "مبيعات" },
  { key: "purchases", label: "مشتريات" },
  { key: "taxes", label: "ضرائب" },
  { key: "accountant", label: "للمحاسب" },
  { key: "inventory", label: "مخزون" },
];

/* ─── Mock data generator for report viewer ─── */
function getMockData(reportId: string) {
  const commonHeaders = {
    "income-statement": { headers: ["البند", "المبلغ الحالي (SR)", "المبلغ السابق (SR)", "التغير %"], rows: [
      ["إيرادات المبيعات", "1,250,000", "1,100,000", "+13.6%"],
      ["تكلفة المبيعات", "(750,000)", "(680,000)", "+10.3%"],
      ["إجمالي الربح", "500,000", "420,000", "+19.0%"],
      ["المصاريف التشغيلية", "(280,000)", "(250,000)", "+12.0%"],
      ["صافي الربح التشغيلي", "220,000", "170,000", "+29.4%"],
      ["مصاريف أخرى", "(15,000)", "(12,000)", "+25.0%"],
      ["صافي الربح", "205,000", "158,000", "+29.7%"],
    ]},
    "trial-balance": { headers: ["رقم الحساب", "اسم الحساب", "مدين (SR)", "دائن (SR)", "الرصيد (SR)"], rows: [
      ["1101", "النقدية", "850,000", "620,000", "230,000"],
      ["1102", "البنك", "2,400,000", "1,950,000", "450,000"],
      ["1103", "الذمم المدينة", "580,000", "340,000", "240,000"],
      ["2101", "الذمم الدائنة", "120,000", "380,000", "(260,000)"],
      ["4001", "إيرادات المبيعات", "0", "1,250,000", "(1,250,000)"],
      ["5001", "تكلفة المبيعات", "750,000", "0", "750,000"],
      ["5002", "الرواتب", "180,000", "0", "180,000"],
      ["5003", "الإيجار", "45,000", "0", "45,000"],
    ]},
    "balance-sheet": { headers: ["البند", "المبلغ (SR)", "النسبة %"], rows: [
      ["الأصول المتداولة", "920,000", "58%"],
      ["  النقدية والبنك", "680,000", "43%"],
      ["  الذمم المدينة", "240,000", "15%"],
      ["الأصول الثابتة", "660,000", "42%"],
      ["إجمالي الأصول", "1,580,000", "100%"],
      ["الخصوم المتداولة", "310,000", "20%"],
      ["حقوق الملكية", "1,270,000", "80%"],
      ["إجمالي الخصوم وحقوق الملكية", "1,580,000", "100%"],
    ]},
    "cash-flow": { headers: ["البند", "التدفق الداخل (SR)", "التدفق الخارج (SR)", "الصافي (SR)"], rows: [
      ["الأنشطة التشغيلية", "1,250,000", "980,000", "270,000"],
      ["  تحصيل المبيعات", "1,180,000", "—", "1,180,000"],
      ["  إيرادات أخرى", "70,000", "—", "70,000"],
      ["  مدفوعات الموردين", "—", "650,000", "(650,000)"],
      ["  رواتب", "—", "180,000", "(180,000)"],
      ["الأنشطة الاستثمارية", "0", "120,000", "(120,000)"],
      ["الأنشطة التمويلية", "200,000", "50,000", "150,000"],
      ["صافي التدفق النقدي", "1,450,000", "1,150,000", "300,000"],
    ]},
    "vat-report": { headers: ["الفترة", "ضريبة المخرجات (SR)", "ضريبة المدخلات (SR)", "الضريبة المستحقة (SR)"], rows: [
      ["يناير 2026", "187,500", "112,500", "75,000"],
      ["فبراير 2026", "195,000", "118,000", "77,000"],
      ["مارس 2026", "210,000", "127,500", "82,500"],
      ["الإجمالي", "592,500", "358,000", "234,500"],
    ]},
    "ar-aging": { headers: ["العميل", "جاري (SR)", "1-30 يوم", "31-60 يوم", "61-90 يوم", "+90 يوم", "الإجمالي"], rows: [
      ["شركة التقنية المتقدمة", "45,000", "22,000", "0", "0", "0", "67,000"],
      ["مؤسسة الإبداع الرقمي", "30,000", "15,000", "8,500", "0", "0", "53,500"],
      ["شركة المستقبل للتجارة", "55,000", "0", "12,000", "7,000", "0", "74,000"],
      ["مؤسسة النجاح للتطوير", "0", "18,000", "12,300", "5,000", "3,200", "38,500"],
      ["الإجمالي", "130,000", "55,000", "32,800", "12,000", "3,200", "233,000"],
    ]},
    "sales-by-customer": { headers: ["العميل", "عدد الفواتير", "إجمالي المبيعات (SR)", "المدفوع (SR)", "المتبقي (SR)"], rows: [
      ["شركة التقنية المتقدمة", "12", "180,000", "135,000", "45,000"],
      ["مؤسسة الإبداع الرقمي", "8", "120,000", "90,000", "30,000"],
      ["شركة المستقبل للتجارة", "15", "250,000", "195,000", "55,000"],
      ["مؤسسة النجاح للتطوير", "6", "85,000", "46,500", "38,500"],
      ["شركة الأمل للاستثمار", "10", "165,000", "147,000", "18,000"],
      ["الإجمالي", "51", "800,000", "613,500", "186,500"],
    ]},
  };

  // Default generic data for reports without specific mock data
  const defaultData = { headers: ["البند", "القيمة (SR)", "النسبة %", "الحالة"], rows: [
    ["البند الأول", "125,000", "25%", "مكتمل"],
    ["البند الثاني", "98,500", "20%", "مكتمل"],
    ["البند الثالث", "87,200", "17%", "قيد المعالجة"],
    ["البند الرابع", "76,800", "15%", "مكتمل"],
    ["البند الخامس", "62,500", "13%", "معلق"],
    ["البند السادس", "50,000", "10%", "مكتمل"],
    ["الإجمالي", "500,000", "100%", "—"],
  ]};

  return (commonHeaders as any)[reportId] || defaultData;
}

/* ─── Main Component ─── */
export function Reports() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [editMode, setEditMode] = useState(false);

  const filteredReports = allReports.filter((r) => {
    const matchesCategory = activeCategory === "all" || r.category === activeCategory;
    const matchesSearch = r.title.includes(searchQuery) || r.description.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const stats = {
    total: allReports.length,
    financial: allReports.filter((r) => r.category === "financial").length,
    taxes: allReports.filter((r) => r.category === "taxes").length,
    newReports: allReports.filter((r) => r.badge === "جديد").length,
  };

  if (viewingReport) {
    return (
      <ReportViewer
        report={viewingReport}
        editMode={editMode}
        onToggleEdit={() => setEditMode(!editMode)}
        onBack={() => { setViewingReport(null); setEditMode(false); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>التقارير</h1>
          <p className="text-[#6B7280] mt-1">تقارير مالية ومحاسبية شاملة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-[#E5E7EB]">
            <Filter className="me-2 h-4 w-4" />
            تصفية
          </Button>
          <Button variant="outline" className="border-[#E5E7EB]">
            <Download className="me-2 h-4 w-4" />
            الفترة الزمنية
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <Input
          placeholder="البحث في التقارير..."
          className="ps-10 border-[#E5E7EB]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-3">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              activeCategory === cat.key
                ? "bg-[#1276E3] text-white"
                : "bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F4FCFF] hover:text-[#0B1B49]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Category Title */}
      {activeCategory !== "all" && (
        <div className="text-center">
          <h2 className="text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            {categories.find((c) => c.key === activeCategory)?.label}
          </h2>
          <p className="text-[#6B7280] text-sm mt-1">
            تقارير شاملة متوافقة مع المعايير السعودية ومتطلبات هيئة الزكاة والضريبة (ZATCA)
          </p>
        </div>
      )}

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onView={() => { setViewingReport(report); setEditMode(false); }}
            onExport={() => handleExport(report)}
          />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="py-12 text-center text-[#6B7280]">
          <BarChart3 className="mx-auto h-12 w-12 text-[#D1D5DB]" />
          <p className="mt-4">لا توجد تقارير تطابق البحث</p>
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <StatPill icon={FileText} label="إجمالي التقارير" value={stats.total} color="#1276E3" />
        <StatPill icon={BarChart3} label="تقارير مالية" value={stats.financial} color="#0B1B49" />
        <StatPill icon={Shield} label="تقارير ضريبية" value={stats.taxes} color="#0B1A47" />
        <StatPill icon={TrendingUp} label="تقارير جديدة" value={stats.newReports} color="#179FC5" />
      </div>

      {/* ZATCA Banner */}
      <div className="rounded-xl bg-gradient-to-l from-[#0B1B49] to-[#1276E3] p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/20 p-2">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p style={{ fontWeight: 600 }}>متوافق مع هيئة الزكاة والضريبة والجمارك (ZATCA)</p>
            <p className="text-sm text-white/80 mt-1">
              جميع التقارير الضريبية متوافقة مع متطلبات الفوترة الإلكترونية والمعايير السعودية. يتم تحديث التقارير تلقائياً وفقاً لأحدث اللوائح والتعليمات.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Report Card Component ─── */
function ReportCard({ report, onView, onExport }: { report: Report; onView: () => void; onExport: () => void }) {
  const Icon = report.icon;
  return (
    <Card className="border-[#E5E7EB] hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Top: icon + title + badge */}
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 rounded-full bg-[#1276E3]/10 p-2.5">
            <Icon className="h-5 w-5 text-[#1276E3]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[#0B1B49] truncate" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{report.title}</h3>
              {report.badge && (
                <Badge
                  className={`shrink-0 text-[10px] px-2 py-0.5 ${
                    report.badge === "جديد"
                      ? "bg-[#DBEAFE] text-[#1E40AF] border-0"
                      : "bg-[#FEF3C7] text-[#92400E] border-0"
                  }`}
                >
                  {report.badge}
                </Badge>
              )}
            </div>
            <p className="text-[#6B7280] text-xs mt-1 line-clamp-2">{report.description}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onView}
            className="flex-1 bg-[#1276E3] hover:bg-[#1060C0] text-white"
            size="sm"
          >
            <Eye className="me-1.5 h-3.5 w-3.5" />
            عرض
          </Button>
          <Button
            onClick={onExport}
            variant="outline"
            className="flex-1 border-[#1276E3] text-[#1276E3] hover:bg-[#1276E3]/5"
            size="sm"
          >
            <Download className="me-1.5 h-3.5 w-3.5" />
            تصدير
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Stat Pill ─── */
function StatPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg p-1.5" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <span className="text-sm text-[#6B7280]">{label}:</span>
      <span className="font-english text-sm" style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

/* ─── Report Viewer (full-page view) ─── */
function ReportViewer({
  report,
  editMode,
  onToggleEdit,
  onBack,
}: {
  report: Report;
  editMode: boolean;
  onToggleEdit: () => void;
  onBack: () => void;
}) {
  const Icon = report.icon;
  const data = getMockData(report.id);
  const [editedData, setEditedData] = useState<string[][]>(data.rows.map((r: string[]) => [...r]));
  const [dateRange, setDateRange] = useState("2026-01-01");
  const [dateRangeEnd, setDateRangeEnd] = useState("2026-03-31");

  const handleCellEdit = (rowIdx: number, colIdx: number, value: string) => {
    setEditedData((prev) => {
      const next = prev.map((r) => [...r]);
      next[rowIdx][colIdx] = value;
      return next;
    });
  };

  const handleExportCSV = () => {
    const csvContent = [data.headers.join(","), ...editedData.map((r: string[]) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0B1B49]"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#1276E3]/10 p-2.5">
              <Icon className="h-5 w-5 text-[#1276E3]" />
            </div>
            <div>
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{report.title}</h1>
              <p className="text-[#6B7280] text-sm">{report.description}</p>
            </div>
          </div>
          {report.badge && (
            <Badge className={
              report.badge === "جديد"
                ? "bg-[#DBEAFE] text-[#1E40AF] border-0"
                : "bg-[#FEF3C7] text-[#92400E] border-0"
            }>
              {report.badge}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onToggleEdit}
            className={editMode ? "border-[#F59E0B] text-[#F59E0B] bg-[#FEF3C7]" : "border-[#E5E7EB]"}
          >
            {editMode ? "إنهاء التعديل" : "تعديل"}
          </Button>
          <Button variant="outline" className="border-[#E5E7EB]" onClick={handlePrint}>
            <Printer className="me-2 h-4 w-4" />
            طباعة
          </Button>
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={handleExportCSV}>
            <Download className="me-2 h-4 w-4" />
            تصدير CSV
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#6B7280]">من:</label>
              <Input
                type="date"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-40 font-english border-[#E5E7EB]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#6B7280]">إلى:</label>
              <Input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="w-40 font-english border-[#E5E7EB]"
              />
            </div>
            <Button variant="outline" size="sm" className="border-[#E5E7EB]">
              تطبيق
            </Button>
            <div className="flex gap-1 ms-auto">
              {["اليوم", "هذا الأسبوع", "هذا الشهر", "هذا الربع", "هذه السنة"].map((label) => (
                <button
                  key={label}
                  className="rounded-md px-3 py-1.5 text-xs text-[#1276E3] hover:bg-[#1276E3]/10 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  {data.headers.map((h: string, i: number) => (
                    <TableHead key={i} className="text-[#6B7280] text-xs" style={{ fontWeight: 600 }}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedData.map((row: string[], ri: number) => {
                  const isTotal = row[0]?.includes("إجمالي") || row[0]?.includes("صافي");
                  return (
                    <TableRow
                      key={ri}
                      className={`hover:bg-[#F4FCFF] ${isTotal ? "bg-[#F9FAFB]" : ""}`}
                      style={isTotal ? { fontWeight: 600 } : {}}
                    >
                      {row.map((cell: string, ci: number) => (
                        <TableCell key={ci} className={ci > 0 ? "font-english" : ""}>
                          {editMode ? (
                            <input
                              value={cell}
                              onChange={(e) => handleCellEdit(ri, ci, e.target.value)}
                              className="w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm focus:border-[#1276E3] focus:outline-none"
                            />
                          ) : (
                            <span className={
                              cell.startsWith("+") ? "text-[#0B1A47]" :
                              cell.startsWith("(") || cell.startsWith("-") ? "text-[#349FC4]" : ""
                            }>
                              {cell}
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Report Info Footer */}
      <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
        <span>تم إنشاء التقرير: {new Date().toLocaleDateString("ar-SA")}</span>
        <span>الفترة: {dateRange} إلى {dateRangeEnd}</span>
        <span className="font-english">Entix Books &copy; 2026</span>
      </div>
    </div>
  );
}

/* ─── Helper ─── */
function handleExport(report: Report) {
  const data = getMockData(report.id);
  const csvContent = [data.headers.join(","), ...data.rows.map((r: string[]) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}