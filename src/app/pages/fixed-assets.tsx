import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Building2, Plus, Search, Filter, Eye, Edit2, X, DollarSign,
  TrendingDown, Package, AlertTriangle, Wrench, MoreVertical, Trash2, Copy,
  ChevronDown, ChevronLeft, ChevronRight, Download, GitMerge, CheckSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  gridStyle, xAxisStyle, yAxisStyle, tooltipStyle, formatSARShort, chartColors
} from "../components/chart-styles";

// ── Currency ──
const CUR = "SR";

export interface Asset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  cost: number;
  accumulatedDep: number;
  bookValue: number;
  status: string;
  method: string;
  usefulLife: number;
  salvageValue: number;
  location?: string;
  serialNumber?: string;
  vendor?: string;
  invoiceRef?: string;
  project?: string;
  custodian?: string;
}

export const assetsData: Asset[] = [
  { id: "AST-001", name: "سيرفر Dell PowerEdge", category: "أجهزة حاسب", purchaseDate: "2024-01-15", cost: 45000, accumulatedDep: 15000, bookValue: 30000, status: "نشط", method: "قسط ثابت", usefulLife: 5, salvageValue: 5000, location: "المكتب الرئيسي - غرفة السيرفرات", serialNumber: "DPE-2024-78543", vendor: "شركة الحلول التقنية", invoiceRef: "BILL-2024-012", project: "البنية التحتية IT", custodian: "قسم تقنية المعلومات" },
  { id: "AST-002", name: "سيارة تويوتا كامري", category: "مركبات", purchaseDate: "2023-06-01", cost: 120000, accumulatedDep: 40000, bookValue: 80000, status: "نشط", method: "قسط ثابت", usefulLife: 5, salvageValue: 20000, location: "موقف الشركة", serialNumber: "VIN-JTD-9837421", vendor: "عبداللطيف جميل", invoiceRef: "BILL-2023-045", project: "—", custodian: "أحمد محمد العلي" },
  { id: "AST-003", name: "أثاث مكتبي كامل", category: "أثاث", purchaseDate: "2023-01-10", cost: 35000, accumulatedDep: 17500, bookValue: 17500, status: "نشط", method: "قسط ثابت", usefulLife: 7, salvageValue: 0, location: "الطابق الثالث", serialNumber: "—", vendor: "أثاث المكاتب الحديثة", invoiceRef: "BILL-2023-008", project: "تجهيز المكتب الجديد", custodian: "قسم الإدارة" },
  { id: "AST-004", name: "برنامج ERP", category: "برمجيات", purchaseDate: "2024-03-01", cost: 80000, accumulatedDep: 16000, bookValue: 64000, status: "نشط", method: "قسط ثابت", usefulLife: 5, salvageValue: 0, location: "سحابي", serialNumber: "LIC-ERP-2024-001", vendor: "Oracle SAP", invoiceRef: "BILL-2024-022", project: "التحول الرقمي", custodian: "قسم تقنية المعلومات" },
  { id: "AST-005", name: "طابعة HP LaserJet", category: "أجهزة حاسب", purchaseDate: "2022-06-15", cost: 8000, accumulatedDep: 8000, bookValue: 0, status: "مُهلك بالكامل", method: "قسط ثابت", usefulLife: 3, salvageValue: 0, location: "الطابق الثاني", serialNumber: "HP-LJ-2022-4521", vendor: "جرير", invoiceRef: "BILL-2022-031", project: "—", custodian: "قسم الإدارة" },
  { id: "AST-006", name: "تحسينات المكتب", category: "تحسينات مستأجرة", purchaseDate: "2023-09-01", cost: 55000, accumulatedDep: 11000, bookValue: 44000, status: "نشط", method: "قسط ثابت", usefulLife: 10, salvageValue: 5000, location: "المكتب الرئيسي", serialNumber: "—", vendor: "المقاولات المتحدة", invoiceRef: "BILL-2023-067", project: "تجهيز المكتب الجديد", custodian: "قسم الإدارة" },
  { id: "AST-007", name: "مولد كهربائي", category: "معدات", purchaseDate: "2024-06-01", cost: 25000, accumulatedDep: 5000, bookValue: 20000, status: "قيد الصيانة", method: "قسط ثابت", usefulLife: 10, salvageValue: 2000, location: "المبنى الخلفي", serialNumber: "GEN-CAT-2024-112", vendor: "شركة الطاقة", invoiceRef: "BILL-2024-041", project: "البنية التحتية", custodian: "قسم الصيانة" },
];

const categoryData = [
  { name: "أجهزة حاسب", value: 53000, color: "#0B1B49" },
  { name: "مركبات", value: 120000, color: "#1276E3" },
  { name: "أثاث", value: 35000, color: "#179FC5" },
  { name: "برمجيات", value: 80000, color: "#349FC4" },
  { name: "معدات", value: 25000, color: "#F59E0B" },
  { name: "تحسينات", value: 55000, color: "#6B7280" },
];

const depSchedule = [
  { year: "2023", depreciation: 28500 },
  { year: "2024", depreciation: 52000 },
  { year: "2025", depreciation: 52000 },
  { year: "2026", depreciation: 52000 },
  { year: "2027", depreciation: 42500 },
];

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    "نشط": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "مُهلك بالكامل": "bg-[#F3F4F6] text-[#374151] border-[#9CA3AF]",
    "مُستبعد": "bg-[#E4F4F9] text-[#349FC4] border-[#349FC4]/20",
    "قيد الصيانة": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
  };
  return m[s] || "";
};

const categories = ["أجهزة حاسب", "مركبات", "أثاث", "برمجيات", "معدات", "تحسينات مستأجرة", "مباني"];
const statuses = ["نشط", "مُهلك بالكامل", "مُستبعد", "قيد الصيانة"];

export function FixedAssets() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [perPage, setPerPage] = useState(20);
  const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const actionMenuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const totalCost = assetsData.reduce((s, a) => s + a.cost, 0);
  const totalDep = assetsData.reduce((s, a) => s + a.accumulatedDep, 0);
  const totalBookValue = assetsData.reduce((s, a) => s + a.bookValue, 0);

  const filtered = assetsData.filter((a) => {
    const matchCat = !categoryFilter || a.category === categoryFilter;
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchSearch = !searchQuery || a.name.includes(searchQuery) || a.id.includes(searchQuery);
    return matchCat && matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const displayed = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const allSelected = displayed.length > 0 && displayed.every((a) => selectedIds.has(a.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayed.map((a) => a.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const activeFilterCount = (categoryFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الأصول الثابتة</h1>
          <p className="text-[#6B7280] mt-1">إدارة الأصول والإهلاك</p>
        </div>
        <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />تسجيل أصل جديد</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Package className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{assetsData.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الأصول</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><DollarSign className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي التكلفة</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#349FC4]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><TrendingDown className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">الإهلاك المتراكم</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#0B1A47]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><Building2 className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalBookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">صافي القيمة الدفترية</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards - DON'T MODIFY */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#F59E0B] bg-[#FEF3C7]/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0" />
            <div>
              <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>أصول مُهلكة بالكامل</p>
              <p className="text-xs text-[#6B7280]">{assetsData.filter((a) => a.status === "مُهلك بالكامل").length} أصل يحتاج مراجعة</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#1276E3] bg-[#EFF6FF]/30">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-[#1276E3] shrink-0" />
            <div>
              <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>إهلاك الشهر الحالي المعلق</p>
              <p className="text-xs text-[#6B7280] font-english">4,333 SR</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#EF4444] bg-[#FEE2E2]/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Wrench className="h-5 w-5 text-[#EF4444] shrink-0" />
            <div>
              <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>قيد الصيانة</p>
              <p className="text-xs text-[#6B7280]">{assetsData.filter((a) => a.status === "قيد الصيانة").length} أصل</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة الأصول</CardTitle>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="بحث في الأصول..."
                  className="w-64 ps-10 border-[#E5E7EB]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {/* Filter dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`rounded-lg border p-2 transition-colors relative ${activeFilterCount > 0 ? "bg-[#EFF6FF] border-[#1276E3] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"}`}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-[#1276E3] text-white text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>{activeFilterCount}</span>
                  )}
                </button>
                {showFilterDropdown && (
                  <div className="absolute end-0 z-40 mt-1 w-56 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {/* Category section */}
                    <p className="px-3 py-1.5 text-[10px] text-[#9CA3AF] uppercase tracking-wider" style={{ fontWeight: 700 }}>الفئة</p>
                    {categories.map((c) => (
                      <button key={c} onClick={() => { setCategoryFilter(categoryFilter === c ? "" : c); }}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${categoryFilter === c ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: categoryFilter === c ? 600 : 400 }}>{c}</button>
                    ))}
                    <div className="border-t border-[#F3F4F6] my-1" />
                    {/* Status section */}
                    <p className="px-3 py-1.5 text-[10px] text-[#9CA3AF] uppercase tracking-wider" style={{ fontWeight: 700 }}>الحالة</p>
                    {statuses.map((s) => (
                      <button key={s} onClick={() => { setStatusFilter(statusFilter === s ? "" : s); }}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${statusFilter === s ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: statusFilter === s ? 600 : 400 }}>{s}</button>
                    ))}
                    {activeFilterCount > 0 && (
                      <>
                        <div className="border-t border-[#F3F4F6] my-1" />
                        <button onClick={() => { setCategoryFilter(""); setStatusFilter(""); setShowFilterDropdown(false); }}
                          className="w-full text-start px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30">مسح جميع الفلاتر</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk selection bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 rounded-lg bg-[#EFF6FF] px-4 py-2.5 border border-[#1276E3]/20">
              <CheckSquare className="h-4 w-4 text-[#1276E3]" />
              <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{selectedIds.size} محدد</span>
              <div className="flex-1" />
              <div className="relative">
                <button onClick={() => setShowBulkMenu(!showBulkMenu)} className="rounded-md bg-white border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#374151] hover:bg-[#F3F4F6] flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                  إجراءات جماعية <ChevronDown className="h-3 w-3" />
                </button>
                {showBulkMenu && (
                  <div className="absolute end-0 z-40 mt-1 w-40 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    <button onClick={() => setShowBulkMenu(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Download className="h-3.5 w-3.5 text-[#6B7280]" />تصدير</button>
                    <button onClick={() => setShowBulkMenu(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><GitMerge className="h-3.5 w-3.5 text-[#6B7280]" />دمج</button>
                    <div className="border-t border-[#F3F4F6] my-1" />
                    <button onClick={() => { setShowBulkMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start"><Trash2 className="h-3.5 w-3.5" />حذف المحدد</button>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="rounded-md p-1 text-[#6B7280] hover:bg-white"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Active filters */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-[#6B7280]">فلتر نشط:</span>
              {categoryFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                  {categoryFilter}
                  <button onClick={() => setCategoryFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                  {statusFilter}
                  <button onClick={() => setStatusFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "950px", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ width: "100px" }} />
                <col />
                <col style={{ width: "110px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-[#D1D5DB] accent-[#1276E3]" />
                  </th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم الأصل</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>اسم الأصل</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الفئة</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>تاريخ الشراء</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التكلفة ({CUR})</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الإهلاك المتراكم</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>القيمة الدفترية</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((a) => (
                  <tr key={a.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-2">
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleOne(a.id)}
                        className="h-3.5 w-3.5 rounded border-[#D1D5DB] accent-[#1276E3]" />
                    </td>
                    <td className="py-3.5 pe-3">
                      <button
                        onClick={() => navigate(`/assets/${a.id}`)}
                        className="font-english text-sm text-[#1276E3] hover:underline cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        {a.id}
                      </button>
                    </td>
                    <td className="py-3.5 pe-3">
                      <button
                        onClick={() => navigate(`/assets/${a.id}`)}
                        className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline cursor-pointer text-start"
                      >
                        {a.name}
                      </button>
                    </td>
                    <td className="py-3.5 pe-3">
                      <span className="text-sm text-[#6B7280]">{a.category}</span>
                    </td>
                    <td className="py-3.5 pe-3">
                      <span className="font-english text-sm text-[#6B7280]">{a.purchaseDate}</span>
                    </td>
                    <td className="py-3.5 pe-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                        <span className="text-[#374151]">{a.cost.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3.5 pe-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm text-[#349FC4]" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                        <span>{a.accumulatedDep.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3.5 pe-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm text-[#0B1A47]" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                        <span>{a.bookValue.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3.5 pe-3">
                      <span className={`inline-flex rounded-md px-2.5 py-1 text-xs border transition-colors ${statusBadge(a.status)}`} style={{ fontWeight: 600 }}
                        onClick={() => setStatusFilter(a.status)}>
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="relative" ref={actionMenuId === a.id ? actionMenuRef : undefined}>
                        <button
                          onClick={() => setActionMenuId(actionMenuId === a.id ? null : a.id)}
                          className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {actionMenuId === a.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <button onClick={() => { navigate(`/assets/${a.id}`); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Copy className="h-3.5 w-3.5 text-[#6B7280]" />نسخ</button>
                            <div className="border-t border-[#F3F4F6] my-1" />
                            <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start"><Trash2 className="h-3.5 w-3.5" />حذف</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6] mt-2">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#6B7280]">عرض <span className="font-english">{Math.min(perPage, filtered.length)}</span> من <span className="font-english">{filtered.length}</span> أصل</p>
              <div className="relative">
                <button onClick={() => setShowPerPageDropdown(!showPerPageDropdown)} className="rounded-md border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1">
                  <span className="font-english">{perPage}</span> في الصفحة <ChevronDown className="h-3 w-3" />
                </button>
                {showPerPageDropdown && (
                  <div className="absolute bottom-full mb-1 start-0 z-40 w-32 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {[20, 50, 100, 200].map((n) => (
                      <button key={n} onClick={() => { setPerPage(n); setShowPerPageDropdown(false); setCurrentPage(1); }}
                        className={`w-full text-start px-3 py-1.5 text-sm font-english ${perPage === n ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: perPage === n ? 600 : 400 }}>{n} في الصفحة</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="rounded-md border border-[#E5E7EB] p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                <span className="px-3 text-xs text-[#6B7280] font-english">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="rounded-md border border-[#E5E7EB] p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">توزيع الأصول حسب الفئة</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>حسب نوع الأصل</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name }) => name}
                  labelLine={{ stroke: "#D1D5DB", strokeWidth: 1 }}
                  style={{ fontSize: "11px", fontFamily: "Noto Sans Arabic", fill: "#9CA3AF" }}
                >
                  {categoryData.map((e, index) => (<Cell key={`cell-${index}`} fill={e.color} fillOpacity={0.85} />))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v: number) => formatSARShort(v)} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">جدول الإهلاك السنوي</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>الإهلاك المتوقع للسنوات القادمة</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={depSchedule}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="year" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip {...tooltipStyle} formatter={(v: number) => formatSARShort(v)} />
                <Bar dataKey="depreciation" fill={chartColors.tealSoft} name="الإهلاك" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}