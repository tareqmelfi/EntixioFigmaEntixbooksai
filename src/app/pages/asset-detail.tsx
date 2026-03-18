import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  X, Edit2, Trash2, FileText, Link2, Printer, Download,
  Building2, Calendar, Tag, User, MapPin, Hash, Wrench,
  TrendingDown, DollarSign, Clock, ChevronDown, BarChart3,
  Receipt, FolderOpen, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  gridStyle, xAxisStyle, yAxisStyle, tooltipStyle, formatSARShort, chartColors
} from "../components/chart-styles";
import { assetsData, type Asset } from "./fixed-assets";

const CUR = "SR";

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    "نشط": "bg-[#ECEEF5] text-[#0B1A47] border-[#0B1A47]/20",
    "مُهلك بالكامل": "bg-[#F3F4F6] text-[#374151] border-[#9CA3AF]",
    "مُستبعد": "bg-[#E4F4F9] text-[#349FC4] border-[#349FC4]/20",
    "قيد الصيانة": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
  };
  return m[s] || "";
};

// Mock linked transactions
const getLinkedTransactions = (assetId: string) => [
  { id: "BILL-2024-012", type: "فاتورة شراء", date: "2024-01-15", amount: 45000, status: "مدفوعة", contact: "شركة الحلول التقنية" },
  { id: "JE-2024-045", type: "قيد إهلاك", date: "2024-06-30", amount: -3333, status: "مرحّل", contact: "—" },
  { id: "JE-2024-089", type: "قيد إهلاك", date: "2024-12-31", amount: -3333, status: "مرحّل", contact: "—" },
  { id: "JE-2025-012", type: "قيد إهلاك", date: "2025-06-30", amount: -3334, status: "مرحّل", contact: "—" },
  { id: "JE-2025-067", type: "قيد إهلاك", date: "2025-12-31", amount: -3333, status: "مرحّل", contact: "—" },
  { id: "MNT-2025-003", type: "أمر صيانة", date: "2025-09-15", amount: -1500, status: "مكتمل", contact: "شركة الصيانة المتقدمة" },
];

// Mock maintenance log
const getMaintenanceLog = (_assetId: string) => [
  { id: "MNT-001", date: "2025-09-15", type: "صيانة وقائية", description: "فحص شامل وتنظيف", cost: 1500, vendor: "شركة الصيانة المتقدمة", status: "مكتمل" },
  { id: "MNT-002", date: "2026-03-01", type: "صيانة تصحيحية", description: "استبدال مكونات", cost: 3200, vendor: "شركة الصيانة المتقدمة", status: "جاري" },
];

// Mock activity log
const getActivityLog = (_assetId: string) => [
  { id: "A-1", date: "2026-03-04 10:30", action: "تحديث بيانات", user: "محمد أحمد", details: "تم تحديث موقع الأصل" },
  { id: "A-2", date: "2026-02-28 14:15", action: "ترحيل إهلاك", user: "النظام", details: "تم ترحيل إهلاك الشهر — 3,333 SR" },
  { id: "A-3", date: "2025-12-31 23:59", action: "ترحيل إهلاك", user: "النظام", details: "ترحيل إهلاك نهاية السنة — 3,333 SR" },
  { id: "A-4", date: "2025-09-15 09:00", action: "أمر صيانة", user: "سارة العلي", details: "فتح أمر صيانة وقائية MNT-001" },
  { id: "A-5", date: "2024-01-15 11:00", action: "تسجيل أصل", user: "محمد أحمد", details: "تسجيل أصل جديد من فاتورة BILL-2024-012" },
];

type TabType = "depreciation" | "transactions" | "maintenance" | "activity";

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("depreciation");

  const asset = assetsData.find((a) => a.id === id);
  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Building2 className="h-12 w-12 text-[#D1D5DB]" />
        <p className="text-[#6B7280]">الأصل غير موجود</p>
        <Button variant="outline" onClick={() => navigate("/app/assets")}>العودة للقائمة</Button>
      </div>
    );
  }

  const a = asset;
  const yearlyDep = (a.cost - a.salvageValue) / a.usefulLife;
  const depPercentage = a.cost > 0 ? Math.round((a.accumulatedDep / a.cost) * 100) : 0;
  const remainingLife = Math.max(0, a.usefulLife - Math.round(a.accumulatedDep / yearlyDep));

  const schedule = Array.from({ length: a.usefulLife }, (_, i) => ({
    year: `السنة ${i + 1}`,
    yearNum: `${i + 1}`,
    dep: yearlyDep,
    accumulated: yearlyDep * (i + 1),
    bookValue: Math.max(a.cost - yearlyDep * (i + 1), a.salvageValue),
  }));

  const depChartData = schedule.map((s) => ({
    year: s.yearNum,
    bookValue: s.bookValue,
    depreciation: s.dep,
  }));

  const transactions = getLinkedTransactions(a.id);
  const maintenanceLog = getMaintenanceLog(a.id);
  const activityLog = getActivityLog(a.id);

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "depreciation", label: "جدول الإهلاك" },
    { key: "transactions", label: "الحركات المرتبطة", count: transactions.length },
    { key: "maintenance", label: "سجل الصيانة", count: maintenanceLog.length },
    { key: "activity", label: "سجل النشاط", count: activityLog.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/app/assets")} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-5 w-5" /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{a.name}</h1>
              <Badge className={`border ${statusBadge(a.status)}`} style={{ fontWeight: 600 }}>{a.status}</Badge>
            </div>
            <p className="text-[#6B7280] text-sm font-english mt-0.5">{a.id} — {a.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#E5E7EB] text-[#6B7280]"><Printer className="me-2 h-4 w-4" />طباعة</Button>
          <Button variant="outline" className="border-[#E5E7EB]"><Edit2 className="me-2 h-4 w-4" />تعديل</Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><DollarSign className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.75rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{a.cost.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">التكلفة الأصلية</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#E4F4F9] p-2.5"><TrendingDown className="h-5 w-5 text-[#349FC4]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.75rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#349FC4] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{a.accumulatedDep.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">الإهلاك المتراكم ({depPercentage}%)</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><Building2 className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div dir="ltr" className="flex items-baseline justify-center gap-1.5">
              <span className="text-[#6B7280] font-english" style={{ fontSize: "0.75rem", fontWeight: 500 }}>SAR</span>
              <span className="text-[#0B1A47] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{a.bookValue.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">القيمة الدفترية</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Clock className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{remainingLife}<span className="text-sm text-[#6B7280]" style={{ fontWeight: 400 }}> / {a.usefulLife}</span></div>
            <p className="text-xs text-[#6B7280] mt-1">سنوات متبقية</p>
          </CardContent>
        </Card>
      </div>

      {/* Depreciation Progress Bar */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>نسبة الإهلاك</span>
            <span className="text-sm font-english text-[#6B7280]" style={{ fontWeight: 600 }}>{depPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${depPercentage}%`, background: `linear-gradient(90deg, #0B1A47, #349FC4)` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-[#6B7280]">
            <span>القيمة الدفترية: <span dir="ltr" className="font-english">{CUR} {a.bookValue.toLocaleString()}</span></span>
            <span>القيمة التخريدية: <span dir="ltr" className="font-english">{CUR} {a.salvageValue.toLocaleString()}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Asset Details Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* General Info */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">معلومات الأصل</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">الفئة:</span> <span className="text-[#374151]">{a.category}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">تاريخ الشراء:</span> <span className="font-english text-[#374151]">{a.purchaseDate}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Hash className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">الرقم التسلسلي:</span> <span className="font-english text-[#374151]">{a.serialNumber || "—"}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">الموقع:</span> <span className="text-[#374151]">{a.location || "—"}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">العهدة / المسؤول:</span> <span className="text-[#374151]">{a.custodian || "—"}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Depreciation */}
        <Card className="border-[#E5E7EB]">
          <CardHeader><CardTitle className="text-[#0B1B49]">الإهلاك والربط المالي</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Wrench className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">طريقة الإهلاك:</span> <span className="text-[#374151]">{a.method}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">العمر الافتراضي:</span> <span className="font-english text-[#374151]">{a.usefulLife} سنوات</span></div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">الإهلاك السنوي:</span> <span dir="ltr" className="font-english text-[#349FC4]">{CUR} {yearlyDep.toLocaleString()}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Receipt className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">فاتورة الشراء:</span> <button className="text-[#1276E3] hover:underline font-english">{a.invoiceRef || "—"}</button></div>
              </div>
              <div className="flex items-start gap-3">
                <FolderOpen className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">المشروع:</span> <span className="text-[#374151]">{a.project || "—"}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
                <div><span className="text-[#6B7280]">المورد:</span> <button className="text-[#1276E3] hover:underline">{a.vendor || "—"}</button></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#1276E3] text-[#1276E3]"
                  : "border-transparent text-[#6B7280] hover:text-[#374151]"
              }`}
              style={{ fontWeight: activeTab === tab.key ? 600 : 400 }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ms-1.5 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-english" style={{ fontWeight: 600 }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "depreciation" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Schedule Table */}
          <Card className="border-[#E5E7EB]">
            <CardHeader><CardTitle className="text-[#0B1B49]">جدول الإهلاك التفصيلي</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "120px" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                      <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الفترة</th>
                      <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الإهلاك ({CUR})</th>
                      <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الإهلاك المتراكم</th>
                      <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>القيمة الدفترية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((r, i) => (
                      <tr key={i} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                        <td className="py-3 pe-3 text-sm">{r.year}</td>
                        <td className="py-3 pe-3">
                          <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm text-[#349FC4]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                            <span>{r.dep.toLocaleString()}</span>
                          </span>
                        </td>
                        <td className="py-3 pe-3">
                          <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm text-[#349FC4]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                            <span>{r.accumulated.toLocaleString()}</span>
                          </span>
                        </td>
                        <td className="py-3 pe-3">
                          <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm text-[#0B1A47]" style={{ fontVariantNumeric: "tabular-nums", fontWeight: r.bookValue <= a.salvageValue ? 700 : 500 }}>
                            <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                            <span>{r.bookValue.toLocaleString()}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Depreciation Chart */}
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-[#0B1B49]">منحنى الإهلاك</CardTitle>
              <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>القيمة الدفترية والإهلاك عبر السنوات</CardDescription>
            </CardHeader>
            <CardContent>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={depChartData}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="year" {...xAxisStyle} reversed />
                    <YAxis {...yAxisStyle} orientation="right" />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => formatSARShort(v)} />
                    <Bar dataKey="bookValue" fill={chartColors.navySoft} name="القيمة الدفترية" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="depreciation" fill={chartColors.tealSoft} name="الإهلاك" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "transactions" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">الحركات المرتبطة</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>فواتير الشراء وقيود الإهلاك وأوامر الصيانة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "700px", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "90px" }} />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المرجع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المبلغ ({CUR})</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الجهة</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                      <td className="py-3 pe-3">
                        <button className="font-english text-sm text-[#1276E3] hover:underline" style={{ fontWeight: 600 }}>{tx.id}</button>
                      </td>
                      <td className="py-3 pe-3 text-sm text-[#6B7280]">{tx.type}</td>
                      <td className="py-3 pe-3 font-english text-sm text-[#6B7280]">{tx.date}</td>
                      <td className="py-3 pe-3">
                        <span dir="ltr" className={`inline-flex items-baseline gap-0.5 font-english text-sm ${tx.amount >= 0 ? "text-[#0B1A47]" : "text-[#349FC4]"}`} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                          <span>{tx.amount < 0 ? "-" : ""}{Math.abs(tx.amount).toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="py-3 pe-3">
                        <span className="inline-flex rounded-md px-2 py-0.5 text-xs bg-[#F3F4F6] text-[#374151]" style={{ fontWeight: 600 }}>{tx.status}</span>
                      </td>
                      <td className="py-3 pe-3 text-sm text-[#374151]">{tx.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "maintenance" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#0B1B49]">سجل الصيانة</CardTitle>
                <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>عمليات الصيانة الوقائية والتصحيحية</CardDescription>
              </div>
              <Button variant="outline" className="border-[#E5E7EB]"><Wrench className="me-2 h-4 w-4" />أمر صيانة جديد</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: "700px", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "110px" }} />
                  <col />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "140px" }} />
                  <col style={{ width: "80px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المرجع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التاريخ</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>النوع</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الوصف</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>التكلفة ({CUR})</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>المورد</th>
                    <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceLog.map((m) => (
                    <tr key={m.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF]">
                      <td className="py-3 pe-3">
                        <span className="font-english text-sm text-[#1276E3]" style={{ fontWeight: 600 }}>{m.id}</span>
                      </td>
                      <td className="py-3 pe-3 font-english text-sm text-[#6B7280]">{m.date}</td>
                      <td className="py-3 pe-3 text-sm text-[#374151]">{m.type}</td>
                      <td className="py-3 pe-3 text-sm text-[#6B7280]">{m.description}</td>
                      <td className="py-3 pe-3">
                        <span dir="ltr" className="inline-flex items-baseline gap-0.5 font-english text-sm text-[#349FC4]" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          <span style={{ fontSize: "0.625rem" }}>{CUR}</span>
                          <span>{m.cost.toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="py-3 pe-3 text-sm text-[#374151]">{m.vendor}</td>
                      <td className="py-3 pe-3">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${m.status === "مكتمل" ? "bg-[#ECEEF5] text-[#0B1A47]" : "bg-[#FEF3C7] text-[#92400E]"}`} style={{ fontWeight: 600 }}>{m.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "activity" && (
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">سجل النشاط</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>جميع العمليات والتغييرات على هذا الأصل</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {activityLog.map((log, i) => (
                <div key={log.id} className={`flex gap-4 py-3 ${i < activityLog.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}>
                  <div className="shrink-0 mt-0.5">
                    <div className="h-8 w-8 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-[#1276E3]" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{log.action}</span>
                      <span className="text-xs text-[#9CA3AF] font-english">{log.date}</span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">{log.details}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-1">بواسطة: {log.user}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}