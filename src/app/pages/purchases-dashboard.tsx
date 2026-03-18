import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  FileText, TrendingUp, DollarSign, AlertCircle, Trophy, AlertTriangle,
  Building2, Plus, Search, Filter, Download, MoreVertical, Eye, Edit2, Trash2, Copy, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  gridStyle, xAxisStyle, yAxisStyle, tooltipStyle, formatSAR, chartColors
} from "../components/chart-styles";
import { contactLink } from "../components/contact-map";

const monthlyData = [
  { month: "أكتوبر", purchases: 65000 },
  { month: "نوفمبر", purchases: 72000 },
  { month: "ديسمبر", purchases: 88000 },
  { month: "يناير", purchases: 58000 },
  { month: "فبراير", purchases: 75000 },
  { month: "مارس", purchases: 82000 },
];

const vendorData = [
  { name: "شركة المواد الخام", value: 120000, color: "#0B1B49" },
  { name: "مؤسسة التوريدات", value: 85000, color: "#1276E3" },
  { name: "شركة الإمدادات", value: 65000, color: "#179FC5" },
  { name: "أخرى", value: 45000, color: "#E5E7EB" },
];

const recentBills = [
  { id: "BILL-2026-001", vendor: "شركة المواد الخام", date: "2026-03-01", amount: "45,000", status: "مدفوعة" },
  { id: "BILL-2026-002", vendor: "مؤسسة التوريدات", date: "2026-03-05", amount: "28,500", status: "مرسلة" },
  { id: "BILL-2026-003", vendor: "شركة الإمدادات", date: "2026-03-08", amount: "15,000", status: "مدفوعة" },
  { id: "BILL-2026-004", vendor: "مؤسسة الخدمات", date: "2026-02-25", amount: "22,000", status: "متأخرة" },
  { id: "BILL-2026-005", vendor: "شركة التجهيزات", date: "2026-03-10", amount: "18,500", status: "مسودة" },
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

const filterLabels: Record<string, string> = { "": "الكل", paid: "مدفوعة", sent: "مرسلة", overdue: "متأخرة", draft: "مسودات" };
const statusToFilter: Record<string, string> = { "مدفوعة": "paid", "مرسلة": "sent", "متأخرة": "overdue", "مسودة": "draft" };

export function PurchasesDashboard() {
  const navigate = useNavigate();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredBills = activeFilter
    ? recentBills.filter((b) => statusToFilter[b.status] === activeFilter)
    : recentBills;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>المشتريات</h1>
          <p className="text-[#6B7280] mt-1">نظرة شاملة على مشترياتك وفواتير الموردين</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/purchases/bills"><Button className="bg-[#1276E3] hover:bg-[#1060C0]"><Plus className="me-2 h-4 w-4" />فاتورة شراء جديدة</Button></Link>
          <Link to="/payments"><Button variant="outline" className="border-[#1276E3] text-[#1276E3]"><Plus className="me-2 h-4 w-4" />سند دفع</Button></Link>
          <Link to="/expenses"><Button variant="outline" className="border-[#E5E7EB]"><Plus className="me-2 h-4 w-4" />مصروف</Button></Link>
          <Button variant="outline" className="border-[#E5E7EB]"><Download className="me-2 h-4 w-4" />تصدير</Button>
        </div>
      </div>

      {/* ── KPI Cards — Assets style ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div onClick={() => navigate("/purchases/bills")} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardContent className="pt-5 pb-4 px-5 text-center">
              <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><FileText className="h-5 w-5 text-[#1276E3]" /></div></div>
              <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>5</div>
              <p className="text-xs text-[#6B7280] mt-1">إجمالي فواتير المشتريات</p>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => navigate("/purchases/bills")} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardContent className="pt-5 pb-4 px-5 text-center">
              <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><DollarSign className="h-5 w-5 text-[#1276E3]" /></div></div>
              <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>129,000.00</span>
              </span>
              <p className="text-xs text-[#6B7280] mt-1">إجمالي المبالغ</p>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => navigate("/purchases/bills?status=paid")} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#349FC4]/30 transition-all">
            <CardContent className="pt-5 pb-4 px-5 text-center">
              <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><TrendingUp className="h-5 w-5 text-[#349FC4]" /></div></div>
              <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
                <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                <span className="text-[#349FC4] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>60,000</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">المدفوع للموردين</p>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => navigate("/purchases/bills?status=overdue")} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#0B1A47]/30 transition-all">
            <CardContent className="pt-5 pb-4 px-5 text-center">
              <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><AlertCircle className="h-5 w-5 text-[#0B1A47]" /></div></div>
              <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
                <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>22,000</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">المستحق عليك</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Quick Insights — compact, no "عرض التفاصيل" ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div onClick={() => navigate(contactLink("شركة المواد الخام"))} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#FEF3C7] p-2 shrink-0"><Trophy className="h-4 w-4 text-[#F59E0B]" /></div>
                <div className="flex-1 min-w-0"><p className="text-xs text-[#6B7280]">أكبر مورد</p><p className="text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>شركة المواد الخام</p></div>
                <div className="text-end shrink-0"><p className="text-[#0B1B49] font-english" style={{ fontWeight: 700 }}><span dir="ltr" className="font-english">SAR 120,000</span></p></div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => navigate(contactLink("مؤسسة الخدمات"))} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#E4F4F9] p-2 shrink-0"><AlertTriangle className="h-4 w-4 text-[#349FC4]" /></div>
                <div className="flex-1 min-w-0"><p className="text-xs text-[#6B7280]">أكثر مورد تأخراً</p><p className="text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>مؤسسة الخدمات</p></div>
                <div className="text-end shrink-0"><p className="text-[#0B1B49] font-english" style={{ fontWeight: 700 }}><span dir="ltr" className="font-english">SAR 22,000</span></p></div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div onClick={() => navigate("/fixed-assets")} className="cursor-pointer">
          <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#DBEAFE] p-2 shrink-0"><Building2 className="h-4 w-4 text-[#1276E3]" /></div>
                <div className="flex-1 min-w-0"><p className="text-xs text-[#6B7280]">مشتريات أصول</p><p className="text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>قيد التصنيف</p></div>
                <div className="text-end shrink-0"><p className="text-[#0B1B49]" style={{ fontWeight: 700 }}>2 <span className="text-[#6B7280]" style={{ fontSize: "0.75rem", fontWeight: 500 }}>عنصر</span></p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Table — filter in dropdown, 3-dot menu ── */}
      <Card className="border-[#E5E7EB]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">آخر فواتير المشتريات</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input placeholder="البحث..." className="w-64 ps-10 border-[#E5E7EB]" /></div>
              <div className="relative">
                <button onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`rounded-lg border p-2 transition-colors ${activeFilter ? "bg-[#EFF6FF] border-[#1276E3] text-[#1276E3]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"}`}><Filter className="h-4 w-4" /></button>
                {showFilterDropdown && (
                  <div className="absolute end-0 z-40 mt-1 w-44 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                    {Object.entries(filterLabels).map(([val, label]) => (
                      <button key={val} onClick={() => { setActiveFilter(val); setShowFilterDropdown(false); }}
                        className={`w-full text-start px-3 py-2 text-sm transition-colors ${activeFilter === val ? "bg-[#EFF6FF] text-[#1276E3]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
                        style={{ fontWeight: activeFilter === val ? 600 : 400 }}>{label}</button>
                    ))}
                    {activeFilter && (<><div className="border-t border-[#F3F4F6] my-1" /><button onClick={() => { setActiveFilter(""); setShowFilterDropdown(false); }} className="w-full text-start px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30">مسح الفلتر</button></>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeFilter && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-[#6B7280]">فلتر نشط:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1276E3]" style={{ fontWeight: 600 }}>
                {filterLabels[activeFilter]}
                <button onClick={() => setActiveFilter("")} className="hover:text-[#EF4444]"><X className="h-3 w-3" /></button>
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "700px" }}>
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="pb-3 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "140px" }}>رقم الفاتورة</th>
                  <th className="pb-3 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "auto" }}>المورد</th>
                  <th className="pb-3 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>التاريخ</th>
                  <th className="pb-3 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "110px" }}>المبلغ (SAR)</th>
                  <th className="pb-3 pe-4 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "90px" }}>الحالة</th>
                  <th className="pb-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600, width: "60px" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b) => (
                  <tr key={b.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] transition-colors">
                    <td className="py-3.5 pe-4"><Link to="/purchases/bills" className="text-sm font-english text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{b.id}</Link></td>
                    <td className="py-3.5 pe-4"><Link to={contactLink(b.vendor)} className="text-sm text-[#374151] hover:text-[#1276E3] hover:underline transition-colors">{b.vendor}</Link></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#6B7280]">{b.date}</span></td>
                    <td className="py-3.5 pe-4"><span className="text-sm font-english text-[#374151]" style={{ fontWeight: 600 }}>{b.amount}</span></td>
                    <td className="py-3.5 pe-4"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs border transition-colors ${statusBadgeClass(b.status)}`} style={{ fontWeight: 600 }}>{b.status}</span></td>
                    <td className="py-3.5">
                      <div className="relative" ref={actionMenuId === b.id ? actionMenuRef : undefined}>
                        <button onClick={() => setActionMenuId(actionMenuId === b.id ? null : b.id)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"><MoreVertical className="h-4 w-4" /></button>
                        {actionMenuId === b.id && (
                          <div className="absolute end-0 z-40 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                            <Link to="/purchases/bills" className="flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB]" onClick={() => setActionMenuId(null)}><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</Link>
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
            <Link to="/purchases/bills" className="text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 500 }}>عرض جميع فواتير المشتريات ←</Link>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">المشتريات الشهرية</CardTitle>
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
                  <Bar dataKey="purchases" fill={chartColors.tealSoft} name="المشتريات" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">توزيع حسب المورد</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>حسب حجم المشتريات</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={vendorData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                    label={({ name }) => `${name}`} labelLine={{ stroke: "#D1D5DB", strokeWidth: 1 }}
                    style={{ fontSize: "11px", fontFamily: "Noto Sans Arabic", fill: "#9CA3AF" }}>
                    {vendorData.map((e, index) => (<Cell key={`cell-${index}`} fill={e.color} fillOpacity={0.85} />))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: number) => formatSAR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {/* -- removed: buttons moved to header like sales dashboard -- */}
    </div>
  );
}