import { Activity, FileText, Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  gridStyle, xAxisStyle, xAxisNumericStyle, yAxisStyle, yAxisCategoryStyle,
  tooltipStyle, formatSAR, chartColors
} from "../components/chart-styles";

// Custom legend rendered outside Recharts to avoid internal duplicate key bug
function ChartLegend({ items }: { items: { label: string; color: string; type?: "rect" | "line" }[] }) {
  return (
    <div className="flex justify-center gap-4 pt-2" style={{ fontFamily: "Noto Sans Arabic", fontSize: "11px", color: "#9CA3AF" }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.type === "line" ? (
            <span style={{ width: 16, height: 2, backgroundColor: item.color, display: "inline-block", borderRadius: 1 }} />
          ) : (
            <span style={{ width: 8, height: 8, backgroundColor: item.color, display: "inline-block", borderRadius: 1 }} />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// Mock data for charts
const cashFlowData = [
  { month: "أكتوبر", inflow: 210000, outflow: 180000 },
  { month: "نوفمبر", inflow: 240000, outflow: 200000 },
  { month: "ديسمبر", inflow: 300000, outflow: 220000 },
  { month: "يناير", inflow: 180000, outflow: 160000 },
  { month: "فبراير", inflow: 220000, outflow: 190000 },
  { month: "مارس", inflow: 285000, outflow: 205000 },
];

const revenueExpensesData = [
  { month: "أكتوبر", revenue: 250000, expenses: 180000 },
  { month: "نوفمبر", revenue: 280000, expenses: 200000 },
  { month: "ديسمبر", revenue: 310000, expenses: 220000 },
  { month: "يناير", revenue: 240000, expenses: 180000 },
  { month: "فبراير", revenue: 260000, expenses: 190000 },
  { month: "مارس", revenue: 295000, expenses: 205000 },
];

const profitLossData = [
  { month: "أكتوبر", profit: 70000, loss: 0 },
  { month: "نوفمبر", profit: 80000, loss: 0 },
  { month: "ديسمبر", profit: 90000, loss: 0 },
  { month: "يناير", profit: 60000, loss: 0 },
  { month: "فبراير", profit: 70000, loss: 0 },
  { month: "مارس", profit: 90000, loss: 0 },
];

const revenueBreakdownData = [
  { category: "فرع أ", value: 95000 },
  { category: "فرع ب", value: 85000 },
  { category: "مشروع ص", value: 75000 },
  { category: "مشروع س", value: 68000 },
  { category: "مركز تكلفة 1", value: 55000 },
  { category: "مركز تكلفة 2", value: 42000 },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة شاملة على أداءك المالي</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><DollarSign className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="flex items-baseline justify-center gap-1.5">
              <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>295,000.00</span>
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">إجمالي الإيرادات</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><Users className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>2,350</div>
            <p className="text-xs text-[#6B7280] mt-1">الاشتراكات</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><FileText className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>12,234</div>
            <p className="text-xs text-[#6B7280] mt-1">المبيعات</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] hover:shadow-md hover:border-[#1276E3]/30 transition-all cursor-pointer">
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#ECEEF5] p-2.5"><Activity className="h-5 w-5 text-[#0B1A47]" /></div></div>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>573</div>
            <p className="text-xs text-[#6B7280] mt-1">النشطون الآن</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Profit & Loss Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">الأرباح والخسائر</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>ملخص الأرباح والخسائر لآخر ٦ أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitLossData} accessibilityLayer={false}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} />
                <Bar dataKey="profit" fill={chartColors.navySoft} name="الأرباح" radius={[8, 8, 0, 0]} />
                <Bar dataKey="loss" fill={chartColors.tealSoft} name="الخسائر" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "الأرباح", color: chartColors.navy },
              { label: "الخسائر", color: chartColors.teal },
            ]} />
          </CardContent>
        </Card>

        {/* Revenue Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">تفصيل الإيرادات</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>توزيع الإيرادات حسب الفروع والمشاريع ومراكز التكلفة</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueBreakdownData} layout="vertical" accessibilityLayer={false}>
                <CartesianGrid {...gridStyle} />
                <XAxis type="number" {...xAxisNumericStyle} />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={100}
                  {...yAxisCategoryStyle}
                  orientation="right"
                />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} />
                <Bar dataKey="value" fill={chartColors.navySoft} name="القيمة" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">التدفق النقدي</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>تحليل التدفقات النقدية الداخلة والخارجة</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cashFlowData} accessibilityLayer={false}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} />
                <Line
                  type="monotone"
                  dataKey="inflow"
                  stroke={chartColors.navy}
                  strokeWidth={2}
                  name="التدفق الداخل"
                  dot={{ fill: chartColors.navy, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="outflow"
                  stroke={chartColors.teal}
                  strokeWidth={2}
                  name="التدفق الخارج"
                  dot={{ fill: chartColors.teal, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "التدفق الداخل", color: chartColors.navy, type: "line" },
              { label: "التدفق الخارج", color: chartColors.teal, type: "line" },
            ]} />
          </CardContent>
        </Card>

        {/* Revenue vs Expenses Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#0B1B49]">الإيرادات مقابل المصروفات</CardTitle>
            <CardDescription className="text-[#B0B7C3]" style={{ fontSize: "12px" }}>مقارنة الإيرادات بالمصروفات لآخر ٦ أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueExpensesData} accessibilityLayer={false}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} />
                <Bar dataKey="revenue" fill={chartColors.navySoft} name="الإيرادات" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" fill={chartColors.tealSoft} name="المصروفات" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "الإيرادات", color: chartColors.navy },
              { label: "المصروفات", color: chartColors.teal },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}