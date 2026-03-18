import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  FileText, TrendingUp, DollarSign, AlertCircle, Trophy, AlertTriangle,
  CreditCard, Plus, Search, Filter, Download, MoreVertical, Eye, Edit2, Trash2, Copy, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  gridStyle, xAxisStyle, yAxisStyle, tooltipStyle, chartColors, formatSAR
} from "../components/chart-styles";
import { contactLink } from "../components/contact-map";

const CUR = "SR";

const monthlyData = [
  { month: "أكتوبر", sales: 85000 },
  { month: "نوفمبر", sales: 92000 },
  { month: "ديسمبر", sales: 110000 },
  { month: "يناير", sales: 78000 },
  { month: "فبراير", sales: 95000 },
  { month: "مارس", sales: 121700 },
];

const statusData = [
  { name: "مدفوعة", value: 5, color: "#0B1A47" },
  { name: "مرسلة", value: 1, color: "#1276E3" },
  { name: "متأخرة", value: 1, color: "#349FC4" },
  { name: "مسودة", value: 1, color: "#9CA3AF" },
];

const recentInvoices = [
  { id: "INV-2026-001", customer: "شركة التقنية المتقدمة", date: "2026-03-01", amount: 15000, status: "مدفوعة" },
  { id: "INV-2026-002", customer: "مؤسسة الإبداع الرقمي", date: "2026-03-02", amount: 8500, status: "مرسلة" },
  { id: "INV-2026-003", customer: "شركة المستقبل للتجارة", date: "2026-03-03", amount: 22000, status: "مدفوعة" },
  { id: "INV-2026-004", customer: "مؤسسة النجاح للتطوير", date: "2026-02-20", amount: 12300, status: "متأخرة" },
  { id: "INV-2026-005", customer: "شركة الأمل للاستثمار", date: "2026-03-04", amount: 18700, status: "مسودة" },
];

const statusBadgeClass = (status: string) => {
  const map: Record<string, string> = {
    "مدفوعة": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20 hover:bg-[#D9DCE9]",
    "مرسلة": "bg-[#EFF6FF] text-[#1E40AF] border-[#1276E3]/20 hover:bg-[#DBEAFE]",
    "متأخرة": "bg-[#E4F4F9] text-[#2A7F9E] border-[#349FC4]/20 hover:bg-[#D0EDF4]",
    "مسودة": "bg-[#F3F4F6] text-[#374151] border-[#9CA3AF]/20 hover:bg-[#E5E7EB]",
  };
  return map[status] || "";
};

const statusFilterMap: Record<string, string> = {
  "مدفوعة": "paid", "مرسلة": "sent", "متأخرة": "overdue", "مسودة": "draft",
};

const filterOptions = [
  { label: "الكل", filter: "" },
  { label: "مسودات", filter: "draft" },
  { label: "مرسلة", filter: "sent" },
  { label: "مدفوعة", filter: "paid" },
  { label: "متأخرة", filter: "overdue" },
];

export function SalesDashboard() {
  const navigate = useNavigate();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
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

  const filteredInvoices = activeFilter
    ? recentInvoices.filter((inv) => statusFilterMap[inv.status] === activeFilter)
    : recentInvoices;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المبيعات</h1>
          <p className="text-[#6B7280] mt-1">نظرة شاملة على مبيعاتك وفواتيرك</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/invoices?create=true">
            <Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />فاتورة جديدة</Button>
          </Link>
          <Link to="/app/quotes">
            <Button variant="outline" className="border-[#1276E3] text-[#1276E3]"><Plus className="me-2 h-4 w-4" />عرض سعر</Button>
          </Link>
          <Link to="/app/receipts">
            <Button variant="outline" className="border-[#E5E7EB]"><Plus className="me-2 h-4 w-4" />سند قبض</Button>
          </Link>
          <Button variant="outline" className="border-[#E5E7EB]"><Download className="me-2 h-4 w-4" />تصدير</Button>
        </div>
      </div>

      {/* ── KPI Cards — Unified center-icon style ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي الفواتير */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => navigate("/app/invoices")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><FileText className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>8</div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الفواتير</p>
          </CardContent>
        </Card>

        {/* إجمالي المبالغ */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => navigate("/app/invoices")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><DollarSign className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>551,947</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي المبالغ</p>
          </CardContent>
        </Card>

        {/* المحصّل (إيراد = Navy) */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#0B1A47]/30 transition-all cursor-pointer" onClick={() => navigate("/app/invoices?status=paid")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><TrendingUp className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>306,947</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">المحصّل</p>
          </CardContent>
        </Card>

        {/* المتأخر (مصروف/خارج = Teal) */}
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#349FC4]/30 transition-all cursor-pointer" onClick={() => navigate("/app/invoices?status=overdue")}>
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><AlertCircle className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>90,000</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">المتأخر</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Insights ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => navigate(contactLink("شركة التقنية المتقدمة"))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#FEF3C7] p-2 shrink-0">
                <Trophy className="h-4 w-4 text-[#F59E0B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">أكبر عميل</p>
                <p className="text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>شركة التقنية المتقدمة</p>
              </div>
              <div className="text-end shrink-0">
                <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-[#0B1A47]" style={{ fontWeight: 700 }}>
                  <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                  <span>150,000</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => navigate(contactLink("مؤسسة النجاح للتطوير"))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#E4F4F9] p-2 shrink-0">
                <AlertTriangle className="h-4 w-4 text-[#349FC4]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">أكثر تأخر</p>
                <p className="text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>مؤسسة النجاح للتطوير</p>
              </div>
              <div className="text-end shrink-0">
                <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-[#349FC4]" style={{ fontWeight: 700 }}>
                  <span style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                  <span>90,000</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer" onClick={() => navigate(contactLink("شركة المستقبل للتجارة"))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#DBEAFE] p-2 shrink-0">
                <CreditCard className="h-4 w-4 text-[#1276E3]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280]">أكثر كريديت</p>
                <p className="text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>شركة المستقبل للتجارة</p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-[#0B1B49]" style={{ fontWeight: 700 }}>3 <span className="text-[#6B7280]" style={{ fontSize: "0.75rem", fontWeight: 500 }}>إشعارات</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Invoices Table ── */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">آخر الفواتير</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input placeholder="البحث في الفواتير..." className="w-64 ps-10 border-[#E5E7EB]" />
              </div>
              {/* Filter dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`rounded-lg border p-2 transition-colors relative ${activeFilter ? "bg-[#EFF6FF] border-[#1276E3] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"}`}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilter && (
                    <span className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-[#1276E3] text-white text-[10px] flex items-center justify-center font-english" style={{ fontWeight: 700 }}>1</span>
                  )}
                </button>
                {showFilterDropdown && (
                  <div className="absolute end-0 z-40 mt-1 w-44 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {filterOptions.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => { setActiveFilter(t.filter); setShowFilterDropdown(false); }}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${activeFilter === t.filter ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: activeFilter === t.filter ? 600 : 400 }}
                      >
                        {t.label}
                      </button>
                    ))}
                    {activeFilter && (
                      <>
                        <div className="border-t border-[#F3F4F6] my-1" />
                        <button onClick={() => { setActiveFilter(""); setShowFilterDropdown(false); }} className="w-full text-start px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30">
                          مسح الفلتر
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Active filter indicator */}
          {activeFilter && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-[#6B7280]">فلتر نشط:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                {filterOptions.find((t) => t.filter === activeFilter)?.label}
                <button onClick={() => setActiveFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "750px", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "130px" }} />
                <col />
                <col style={{ width: "110px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>رقم الفاتورة</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>العميل</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ ({CUR})</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>⋮</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-3">
                      <Link to="/app/invoices" className="font-english text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{inv.id}</Link>
                    </td>
                    <td className="py-3.5 pe-3">
                      <Link to={contactLink(inv.customer)} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{inv.customer}</Link>
                    </td>
                    <td className="py-3.5 pe-3"><span className="font-english text-sm text-[#6B7280]">{inv.date}</span></td>
                    <td className="py-3.5 pe-3">
                      <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.625rem", fontWeight: 500 }}>{CUR}</span>
                        <span className="text-[#374151]">{inv.amount.toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-3.5 pe-3">
                      <Link to={`/app/invoices?status=${statusFilterMap[inv.status] || ""}`}>
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs cursor-pointer border transition-colors ${statusBadgeClass(inv.status)}`} style={{ fontWeight: 600 }}>{inv.status}</span>
                      </Link>
                    </td>
                    <td className="py-3.5">
                      <div className="relative" ref={actionMenuId === inv.id ? actionMenuRef : undefined}>
                        <button
                          onClick={() => setActionMenuId(actionMenuId === inv.id ? null : inv.id)}
                          className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {actionMenuId === inv.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <Link to="/app/invoices" className="flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB]" onClick={() => setActionMenuId(null)}><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</Link>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start" onClick={() => setActionMenuId(null)}><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل</button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start" onClick={() => setActionMenuId(null)}><Copy className="h-3.5 w-3.5 text-[#6B7280]" />نسخ</button>
                            <div className="border-t border-[#F3F4F6] my-1" />
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start" onClick={() => setActionMenuId(null)}><Trash2 className="h-3.5 w-3.5" />حذف</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-center">
            <Link to="/app/invoices" className="text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض جميع الفواتير ←</Link>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">المبيعات الشهرية</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>آخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" {...xAxisStyle} reversed />
                  <YAxis {...yAxisStyle} orientation="right" />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => formatSAR(v)} />
                  <Bar dataKey="sales" fill={chartColors.navySoft} name="المبيعات" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">توزيع حالات الفواتير</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>حسب الحالة الحالية</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="value" label={({ name, value }) => `${name} (${value})`}
                    labelLine={{ stroke: "#D1D5DB", strokeWidth: 1 }}
                    style={{ fontSize: "11px", fontFamily: "Noto Sans Arabic", fill: "#9CA3AF" }}
                  >
                    {statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}