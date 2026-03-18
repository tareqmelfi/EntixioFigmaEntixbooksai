import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  Package, Plus, Search, AlertTriangle, Warehouse, MoreVertical, Eye, Edit2,
  Copy, Trash2, Filter, ChevronDown, X, DollarSign, Layers, ArrowLeftRight,
  Download, CheckSquare, GitMerge
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

/* ════════════════════════════════════════════════════════
   CURRENCY
   ════════════════════════════════════════════════════════ */
const CUR = "SR";

/* ════════════════════════════════════════════════════════
   SHARED DATA (exported for product detail)
   ════════════════════════════════════════════════════════ */
export type ItemType = "منتج" | "خدمة" | "أصل";

export interface Product {
  sku: string;
  name: string;
  type: ItemType;
  category: string;
  warehouse: string;
  stock: number;
  reorderLevel: number;
  costPrice: number;
  sellPrice: number;
  status: string;
  description?: string;
  unit?: string;
  barcode?: string;
  taxRate?: number;
  supplier?: string;
}

export const productsData: Product[] = [
  { sku: "PRD-001", name: "لابتوب Dell Latitude 5540", type: "منتج", category: "إلكترونيات", warehouse: "المستودع الرئيسي", stock: 145, reorderLevel: 50, costPrice: 3800, sellPrice: 4500, status: "متاح", unit: "جهاز", barcode: "6281000001010", taxRate: 15, supplier: "شركة الحلول التقنية", description: "لابتوب تجاري بمعالج Intel Core i7 الجيل 13" },
  { sku: "PRD-002", name: "ورق طباعة A4 - 5 رزم", type: "منتج", category: "قرطاسية", warehouse: "المستودع الرئيسي", stock: 25, reorderLevel: 50, costPrice: 110, sellPrice: 150, status: "منخفض", unit: "حزمة", taxRate: 15, supplier: "مؤسسة التوريدات" },
  { sku: "PRD-003", name: "مكتب خشبي تنفيذي", type: "منتج", category: "أثاث", warehouse: "المستودع الفرعي", stock: 78, reorderLevel: 30, costPrice: 950, sellPrice: 1200, status: "متاح", unit: "قطعة", taxRate: 15 },
  { sku: "PRD-004", name: "ماوس لاسلكي Logitech", type: "منتج", category: "إكسسوارات", warehouse: "المستودع الرئيسي", stock: 0, reorderLevel: 20, costPrice: 55, sellPrice: 75, status: "نفذ", unit: "قطعة", taxRate: 15 },
  { sku: "PRD-005", name: "شاشة Samsung 27 بوصة", type: "منتج", category: "إلكترونيات", warehouse: "المستودع الفرعي", stock: 200, reorderLevel: 100, costPrice: 1100, sellPrice: 1350, status: "متاح", unit: "شاشة", taxRate: 15 },
  { sku: "PRD-006", name: "كرسي مكتبي دوار", type: "منتج", category: "أثاث", warehouse: "المستودع الرئيسي", stock: 12, reorderLevel: 15, costPrice: 680, sellPrice: 890, status: "منخفض", unit: "قطعة", taxRate: 15 },
  { sku: "PRD-007", name: "طابعة HP LaserJet Pro", type: "منتج", category: "إلكترونيات", warehouse: "المستودع الفرعي", stock: 34, reorderLevel: 10, costPrice: 1750, sellPrice: 2100, status: "متاح", unit: "جهاز", taxRate: 15 },
  { sku: "PRD-008", name: "حبر طابعة HP أسود", type: "منتج", category: "قرطاسية", warehouse: "المستودع الرئيسي", stock: 8, reorderLevel: 25, costPrice: 140, sellPrice: 185, status: "منخفض", unit: "علبة", taxRate: 15 },
  { sku: "SVC-001", name: "خدمة تركيب شبكات", type: "خدمة", category: "خدمات تقنية", warehouse: "—", stock: 0, reorderLevel: 0, costPrice: 0, sellPrice: 2500, status: "متاح", unit: "خدمة", taxRate: 15 },
  { sku: "SVC-002", name: "صيانة أجهزة حاسب", type: "خدمة", category: "خدمات تقنية", warehouse: "—", stock: 0, reorderLevel: 0, costPrice: 0, sellPrice: 800, status: "متاح", unit: "خدمة", taxRate: 15 },
  { sku: "SVC-003", name: "استشارات محاسبية", type: "خدمة", category: "خدمات مهنية", warehouse: "—", stock: 0, reorderLevel: 0, costPrice: 0, sellPrice: 5000, status: "متاح", unit: "ساعة", taxRate: 15 },
];

const statusStyle = (s: string) => {
  const m: Record<string, string> = {
    "متاح": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "منخفض": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
    "نفذ": "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]",
  };
  return m[s] || "";
};

const typeBadge = (t: ItemType) => {
  const m: Record<string, string> = {
    "منتج": "bg-[#EFF6FF] text-[#1276E3] border-[#1276E3]/20",
    "خدمة": "bg-[#F0FDF4] text-[#166534] border-[#22C55E]/20",
    "أصل": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
  };
  return m[t] || "";
};

/* ════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════ */
export function Inventory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(20);
  const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const statusFilterLabels: Record<string, string> = { "": "الكل", available: "متاح", low: "منخفض", out: "نفذ" };
  const typeFilterLabels: Record<string, string> = { "": "الكل", product: "منتج", service: "خدمة", asset: "أصل" };
  const statusToFilter: Record<string, string> = { "متاح": "available", "منخفض": "low", "نفذ": "out" };
  const typeToFilter: Record<string, string> = { "منتج": "product", "خدمة": "service", "أصل": "asset" };

  const filteredProducts = productsData.filter((p) => {
    const matchesSearch = p.name.includes(searchQuery) || p.sku.includes(searchQuery) || p.category.includes(searchQuery);
    const matchesStatus = !statusFilter || statusToFilter[p.status] === statusFilter;
    const matchesType = !typeFilter || typeToFilter[p.type] === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
  const displayedProducts = filteredProducts.slice(0, perPage);

  const activeFilterCount = (statusFilter ? 1 : 0) + (typeFilter ? 1 : 0);
  const allSelected = displayedProducts.length > 0 && displayedProducts.every((p) => selectedItems.has(p.sku));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(displayedProducts.map((p) => p.sku)));
    }
  };
  const toggleSelect = (sku: string) => {
    const next = new Set(selectedItems);
    next.has(sku) ? next.delete(sku) : next.add(sku);
    setSelectedItems(next);
  };

  /* ── Computed KPIs ── */
  const totalItems = productsData.length;
  const totalProducts = productsData.filter((p) => p.type === "منتج").length;
  const totalServices = productsData.filter((p) => p.type === "خدمة").length;
  const totalValue = productsData.reduce((sum, p) => sum + p.stock * p.costPrice, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المنتجات والخدمات</h1>
          <p className="text-[#6B7280] mt-1">إدارة المنتجات والخدمات والمخزون</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1276E3] hover:bg-[#1060C0]" onClick={() => {}}>
            <Plus className="me-2 h-4 w-4" />منتج جديد
          </Button>
          <Button variant="outline" className="border-[#1276E3] text-[#1276E3]" onClick={() => {}}>
            <Plus className="me-2 h-4 w-4" />خدمة جديدة
          </Button>
          <Button variant="outline" className="border-[#E5E7EB]">
            <Download className="me-2 h-4 w-4" />تصدير
          </Button>
        </div>
      </div>

      {/* ── KPI Cards — Unified center-icon style ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي العناصر */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => { setStatusFilter(""); setTypeFilter(""); }}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Package className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalItems}</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي العناصر</p>
          </CardContent>
        </Card>

        {/* قيمة المخزون */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#0B1A47]/30 transition-all cursor-pointer" onClick={() => setTypeFilter("product")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><DollarSign className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalValue.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">قيمة المخزون</p>
          </CardContent>
        </Card>

        {/* المنتجات */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => setTypeFilter("product")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Layers className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalProducts}</div>
            <p className="text-xs text-[#6B7280] mt-1">منتج</p>
          </CardContent>
        </Card>

        {/* الخدمات */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#349FC4]/30 transition-all cursor-pointer" onClick={() => setTypeFilter("service")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><ArrowLeftRight className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{totalServices}</div>
            <p className="text-xs text-[#6B7280] mt-1">خدمة</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Products Table ── */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">قائمة المنتجات والخدمات</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="بحث بالاسم أو الرمز..."
                  className="w-64 ps-10 border-[#E5E7EB]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {/* Filter dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`rounded-lg border p-2 transition-colors relative ${activeFilterCount ? "bg-[#EFF6FF] border-[#1276E3] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"}`}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-[#1276E3] text-white text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>{activeFilterCount}</span>
                  )}
                </button>
                {showFilterDropdown && (
                  <div className="absolute end-0 z-40 mt-1 w-52 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    <div className="px-3 py-1.5 text-[10px] text-[#9CA3AF] tracking-wider" style={{ fontWeight: 600 }}>الحالة</div>
                    {Object.entries(statusFilterLabels).map(([val, label]) => (
                      <button key={`s-${val}`} onClick={() => setStatusFilter(val)}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${statusFilter === val ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: statusFilter === val ? 600 : 400 }}>{label}</button>
                    ))}
                    <div className="border-t border-[#F3F4F6] my-1" />
                    <div className="px-3 py-1.5 text-[10px] text-[#9CA3AF] tracking-wider" style={{ fontWeight: 600 }}>النوع</div>
                    {Object.entries(typeFilterLabels).map(([val, label]) => (
                      <button key={`t-${val}`} onClick={() => setTypeFilter(val)}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${typeFilter === val ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: typeFilter === val ? 600 : 400 }}>{label}</button>
                    ))}
                    {activeFilterCount > 0 && (
                      <><div className="border-t border-[#F3F4F6] my-1" /><button onClick={() => { setStatusFilter(""); setTypeFilter(""); }} className="w-full text-start px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30">مسح جميع الفلاتر</button></>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Active filters */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-[#6B7280]">فلاتر نشطة:</span>
              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                  الحالة: {statusFilterLabels[statusFilter]}
                  <button onClick={() => setStatusFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                  النوع: {typeFilterLabels[typeFilter]}
                  <button onClick={() => setTypeFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}

          {/* Bulk actions bar */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-3 mb-3 rounded-lg bg-[#EFF6FF] border border-[#1276E3]/20 px-4 py-2">
              <span className="text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>
                <CheckSquare className="inline h-4 w-4 me-1" />{selectedItems.size} محدد
              </span>
              <div className="flex-1" />
              <button className="text-xs text-[#374151] hover:text-[#1276E3] flex items-center gap-1"><GitMerge className="h-3.5 w-3.5" /> دمج</button>
              <button className="text-xs text-[#374151] hover:text-[#1276E3] flex items-center gap-1"><Download className="h-3.5 w-3.5" /> تصدير</button>
              <button className="text-xs text-[#EF4444] hover:text-[#DC2626] flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> حذف</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "950px", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ width: "100px" }} />
                <col />
                <col style={{ width: "70px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-2 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded border-[#D1D5DB] text-[#1276E3] focus:ring-[#1276E3]" />
                  </th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الرمز</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الاسم</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التصنيف</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الكمية</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>سعر التكلفة</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>سعر البيع</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {displayedProducts.map((product) => (
                  <tr key={product.sku} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3 pe-2 text-center">
                      <input type="checkbox" checked={selectedItems.has(product.sku)} onChange={() => toggleSelect(product.sku)} className="rounded border-[#D1D5DB] text-[#1276E3] focus:ring-[#1276E3]" />
                    </td>
                    <td className="py-3 pe-3">
                      <Link to={`/products/${product.sku}`} className="font-english text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{product.sku}</Link>
                    </td>
                    <td className="py-3 pe-3">
                      <Link to={`/products/${product.sku}`} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{product.name}</Link>
                    </td>
                    <td className="py-3 pe-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] border ${typeBadge(product.type)}`} style={{ fontWeight: 600 }}>{product.type}</span>
                    </td>
                    <td className="py-3 pe-3">
                      <span className="text-sm text-[#6B7280]">{product.category}</span>
                    </td>
                    <td className="py-3 pe-3">
                      {product.type === "خدمة" ? (
                        <span className="text-sm text-[#9CA3AF]">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-english text-sm text-[#374151]" style={{ fontWeight: 500 }}>{product.stock}</span>
                          {product.stock <= product.reorderLevel && product.stock > 0 && (
                            <span className="inline-flex items-center text-[10px] text-[#F59E0B] bg-[#FEF3C7] rounded-full px-1 py-0.5" style={{ fontWeight: 600 }}>
                              <AlertTriangle className="h-2.5 w-2.5" />
                            </span>
                          )}
                          {product.stock === 0 && (
                            <span className="inline-flex items-center text-[10px] text-[#349FC4] bg-[#E4F4F9] rounded-full px-1 py-0.5" style={{ fontWeight: 600 }}>
                              <AlertTriangle className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pe-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                        <span className="text-[#374151]">{product.costPrice.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3 pe-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                        <span className="text-[#0B1A47]">{product.sellPrice.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3 pe-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs cursor-pointer border transition-colors ${statusStyle(product.status)}`} style={{ fontWeight: 600 }}
                        onClick={() => setStatusFilter(statusToFilter[product.status] || "")}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="relative" ref={actionMenuId === product.sku ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === product.sku ? null : product.sku)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {actionMenuId === product.sku && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <Link to={`/products/${product.sku}`} className="flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB]" onClick={() => setActionMenuId(null)}><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</Link>
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
              <p className="text-xs text-[#6B7280]">عرض <span className="font-english">{Math.min(perPage, filteredProducts.length)}</span> من <span className="font-english">{filteredProducts.length}</span> عنصر</p>
              <div className="relative">
                <button onClick={() => setShowPerPageDropdown(!showPerPageDropdown)} className="rounded-md border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1">
                  <span className="font-english">{perPage}</span> في الصفحة <ChevronDown className="h-3 w-3" />
                </button>
                {showPerPageDropdown && (
                  <div className="absolute bottom-full mb-1 start-0 z-40 w-32 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {[20, 50, 100, 200].map((n) => (
                      <button key={n} onClick={() => { setPerPage(n); setShowPerPageDropdown(false); }}
                        className={`w-full text-start px-3 py-1.5 text-sm font-english ${perPage === n ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: perPage === n ? 600 : 400 }}>{n} في الصفحة</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {filteredProducts.length > perPage && (
              <button onClick={() => setPerPage(filteredProducts.length)} className="text-xs text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض الكل</button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Warehouses ── */}
      <Card className="border-[#E5E7EB]" id="warehouses-section">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">المستودعات</CardTitle>
            <Button variant="outline" className="border-[#E5E7EB]"><Plus className="me-2 h-4 w-4" />مستودع جديد</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "المستودع الرئيسي", location: "الرياض - حي الملك فيصل", count: 847, color: "#1276E3" },
              { name: "المستودع الفرعي", location: "جدة - حي الحمراء", count: 400, color: "#349FC4" },
            ].map((w) => (
              <div key={w.name} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-4 cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[#EFF6FF] p-2.5"><Warehouse className="h-5 w-5" style={{ color: w.color }} /></div>
                  <div>
                    <div className="text-[#0B1B49]" style={{ fontWeight: 600 }}>{w.name}</div>
                    <div className="text-sm text-[#6B7280]">{w.location}</div>
                  </div>
                </div>
                <div className="text-start">
                  <div className="text-xs text-[#6B7280]">عدد المنتجات</div>
                  <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{w.count}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
