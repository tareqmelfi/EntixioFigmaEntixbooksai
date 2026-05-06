import { DollarSign, FileText, ShoppingBag, Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router";
import { useState, useMemo } from "react";
import {
  gridStyle, xAxisStyle, xAxisNumericStyle, yAxisStyle, yAxisCategoryStyle,
  tooltipStyle, formatSAR, chartColors, statusColors
} from "../components/chart-styles";

// Custom legend rendered outside Recharts
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

// Mock data
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
  { month: "أكتوبر", profit: 70000, loss: 12000 },
  { month: "نوفمبر", profit: 80000, loss: 5000 },
  { month: "ديسمبر", profit: 90000, loss: 18000 },
  { month: "يناير", profit: 60000, loss: 25000 },
  { month: "فبراير", profit: 70000, loss: 8000 },
  { month: "مارس", profit: 90000, loss: 3000 },
];

const revenueBreakdownData = [
  { category: "فرع أ", value: 95000 },
  { category: "فرع ب", value: 85000 },
  { category: "مشروع ص", value: 75000 },
  { category: "مشروع س", value: 68000 },
  { category: "مركز تكلفة 1", value: 55000 },
  { category: "مركز تكلفة 2", value: 42000 },
];

// VAT data
const vatCollected = 44250; // VAT on sales (لصالح الضريبة)
const vatPaid = 30750;      // VAT on purchases (لصالحنا)
const vatNet = vatCollected - vatPaid; // net payable to tax authority

function VATGauge() {
  const total = vatCollected + vatPaid;
  const ratio = vatPaid / total;
  const collectedRatio = vatCollected / total;
  
  // Severity based on net payable ratio
  const netRatio = vatNet / vatCollected;
  let severity: "normal" | "warning" | "danger" = "normal";
  if (netRatio > 0.5) severity = "danger";
  else if (netRatio > 0.3) severity = "warning";

  // Bar always uses brand colors (teal for tax side, navy for our side)
  const barColorTax = chartColors.teal;
  const barColorOurs = chartColors.navy;

  // Net amount uses status colors like invoice statuses
  const netStatus = severity === "danger"
    ? statusColors.red
    : severity === "warning"
    ? statusColors.amber
    : statusColors.green;

  // Very subtle glow — barely visible hint
  const glowStyle = severity === "danger"
    ? { boxShadow: `0 0 12px 2px rgba(239,68,68,0.06)` }
    : severity === "warning"
    ? { boxShadow: `0 0 10px 2px rgba(217,119,6,0.04)` }
    : {};

  // Net display: positive = علينا (we owe tax), negative = لصالحنا (tax owes us)
  const isWeOwe = vatNet > 0;
  const displayAmount = Math.abs(vatNet);
  const netLabel = isWeOwe ? "علينا" : "لصالحنا";

  return (
    <Card
      className="border-[#E5E7EB] transition-all duration-300 active:scale-[0.98]"
      style={glowStyle}
    >
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex justify-center mb-3">
          <div className="rounded-xl bg-[#EFF6FF] p-2.5">
            <Gauge className="h-5 w-5 text-[#1276E3]" />
          </div>
        </div>
        <p className="text-xs text-[#6B7280] text-center mb-3">ضريبة القيمة المضافة</p>
        
        {/* Gauge bar — teal (tax) + navy (ours), matching revenue/expenses palette */}
        <div className="flex rounded-full overflow-hidden h-3 mb-3" style={{ direction: "ltr" }}>
          <div
            className="transition-all duration-500"
            style={{ width: `${collectedRatio * 100}%`, backgroundColor: barColorTax }}
          />
          <div
            className="transition-all duration-500"
            style={{ width: `${ratio * 100}%`, backgroundColor: barColorOurs }}
          />
        </div>
        
        {/* Labels — swapped: لصالحنا right (matches teal bar start), لصالح الضريبة left (matches navy bar end) */}
        <div className="flex justify-between text-[11px]">
          <div className="text-center">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: barColorOurs }} />
              <span className="text-[#6B7280]">لصالحنا</span>
            </div>
            <span dir="ltr" className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>
              {vatPaid.toLocaleString()} SR
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: barColorTax }} />
              <span className="text-[#6B7280]">لصالح الضريبة</span>
            </div>
            <span dir="ltr" className="font-english text-[#0B1B49]" style={{ fontWeight: 600 }}>
              {vatCollected.toLocaleString()} SR
            </span>
          </div>
        </div>
        
        {/* Net — single row: label right, number center, badge left */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-[#6B7280]">صافي المستحق</span>
          <div dir="ltr" className="flex items-baseline gap-1">
            <span
              className="font-english"
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: isWeOwe ? "#F59E0B" : "#22C55E",
              }}
            >
              {isWeOwe ? "" : "-"}{displayAmount.toLocaleString()}
            </span>
            <span className="text-xs text-[#6B7280] font-english" style={{ fontWeight: 500 }}>SR</span>
          </div>
          {isWeOwe ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-2 py-0.5 text-[10px] text-[#991B1B]" style={{ fontWeight: 600 }}>علينا</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[10px] text-[#166534]" style={{ fontWeight: 600 }}>لصالحنا ✓</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [activeBar, setActiveBar] = useState<number | null>(null);

  const handleBarClick = (month: string) => {
    navigate("/app/reports");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة شاملة على أداءك المالي</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className="border-[#E5E7EB] transition-all duration-200 cursor-pointer active:scale-[0.98] hover:border-[#1276E3]/30"
          onDoubleClick={() => navigate("/app/reports")}
        >
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

        <Card
          className="border-[#E5E7EB] transition-all duration-200 cursor-pointer active:scale-[0.98] hover:border-[#1276E3]/30"
          onDoubleClick={() => navigate("/app/sales")}
        >
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><FileText className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="flex items-baseline justify-center gap-1.5">
              <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>184,500.00</span>
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">المبيعات</p>
          </CardContent>
        </Card>

        <Card
          className="border-[#E5E7EB] transition-all duration-200 cursor-pointer active:scale-[0.98] hover:border-[#1276E3]/30"
          onDoubleClick={() => navigate("/app/purchases")}
        >
          <CardContent className="pt-5 pb-4 px-5 text-center">
            <div className="flex justify-center mb-3"><div className="rounded-xl bg-[#EFF6FF] p-2.5"><ShoppingBag className="h-5 w-5 text-[#1276E3]" /></div></div>
            <div className="flex items-baseline justify-center gap-1.5">
              <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                <span className="text-[#6B7280] font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>SAR</span>
                <span className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>110,500.00</span>
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">المشتريات</p>
          </CardContent>
        </Card>

        <VATGauge />
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
              <BarChart data={profitLossData} style={{ cursor: "pointer" }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => formatSAR(value)}
                  cursor={false}
                />
                <Bar
                  dataKey="profit"
                  fill={chartColors.navySoft}
                  name="الأرباح"
                  radius={[8, 8, 0, 0]}
                  onClick={(data: any) => handleBarClick(data.month)}
                  onMouseEnter={(_, index) => setActiveBar(index)}
                  onMouseLeave={() => setActiveBar(null)}
                >
                  {profitLossData.map((_, index) => (
                    <Cell
                      key={`profit-${index}`}
                      fill={activeBar === index ? chartColors.navy : chartColors.navySoft}
                      style={{ transition: "all 0.2s ease", transform: activeBar === index ? "scaleY(1.02)" : "scaleY(1)", transformOrigin: "bottom" }}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="loss"
                  fill={chartColors.red}
                  name="الخسائر"
                  radius={[8, 8, 0, 0]}
                  onClick={(data: any) => handleBarClick(data.month)}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "الأرباح", color: chartColors.navy },
              { label: "الخسائر", color: chartColors.red },
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
              <BarChart data={revenueBreakdownData} layout="vertical">
                <CartesianGrid {...gridStyle} />
                <XAxis type="number" {...xAxisNumericStyle} />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={100}
                  {...yAxisCategoryStyle}
                  orientation="right"
                />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} cursor={false} />
                <Bar
                  dataKey="value"
                  fill={chartColors.navySoft}
                  name="القيمة"
                  radius={[0, 8, 8, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate("/app/reports")}
                />
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
              <LineChart data={cashFlowData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} cursor={false} />
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
              <BarChart data={revenueExpensesData} style={{ cursor: "pointer" }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} reversed />
                <YAxis {...yAxisStyle} orientation="right" />
                <Tooltip {...tooltipStyle} formatter={(value: number) => formatSAR(value)} cursor={false} />
                <Bar
                  dataKey="revenue"
                  fill={chartColors.navySoft}
                  name="الإيرادات"
                  radius={[8, 8, 0, 0]}
                  onClick={() => navigate("/app/reports")}
                />
                <Bar
                  dataKey="expenses"
                  fill={chartColors.tealSoft}
                  name="المصروفات"
                  radius={[8, 8, 0, 0]}
                  onClick={() => navigate("/app/reports")}
                />
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