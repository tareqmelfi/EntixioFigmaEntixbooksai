/**
 * Dashboard · org-scoped financial overview
 * All numbers from /api/dashboard/summary · zero mock data
 *
 * Layout (Wave-style):
 *   Row 1 · KPI strip (4 cards): Revenue · Expenses · VAT · Cash on hand
 *   Row 2 · Cash Flow chart (combo: in/out bars + net line) · P&L bars
 *   Row 3 · AR/AP cards · Period compare card · Connected accounts
 *   Row 4 · Expense breakdown donut · Overdue invoices list
 *   Row 5 · Quick stats footer
 */
import {
  DollarSign,
  FileText,
  ShoppingBag,
  Gauge,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Banknote,
} from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useEffect, useState, useCallback } from "react";
import { api, ApiError, DashboardSummary } from "../lib/api";
import { ToastStack, useToasts } from "../components/side-panel";

const DONUT_COLORS = ["#1276E3", "#179FC5", "#7DD3E4", "#0B1B49", "#D4A76A", "#10B981", "#F59E0B", "#EF4444"];

// UX-205 · Locked chart-styles per Figma spec ("Data is the Hero")
const chartColors = {
  navy: "#0B1B49",                       // Entix logo deep navy · primary positive (UX-213 · full saturation)
  navySoft: "#0B1B49",                   // same · NO dusty version (matches Figma · solid bars)
  blue: "#1276E3",                       // brand interaction
  teal: "#05B6FA",                       // Entix logo light cyan (UX-213 · brand match)
  tealSoft: "#7DD3FC",                   // softer cyan · for paired bars
  green: "#10B981",                      // success
  red: "#E84B4B",                        // Figma red · slightly muted (UX-213 · brighter than dusty)
  redSoft: "#FCA5A5",                    // lightest rose
};
const gridStyle = { stroke: "#ECEEF1", strokeDasharray: "3 3", opacity: 0.8 };
const xAxisStyle = { fontSize: 10, fill: "#B0B7C3" };
const yAxisStyle = { fontSize: 10, fill: "#C4CAD4" };
const tooltipStyle = {
  contentStyle: { backgroundColor: "rgba(255,255,255,0.96)", border: "1px solid #ECEEF1", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  cursor: { fill: "rgba(11,27,73,0.04)" },
  labelStyle: { color: "#0B1B49", fontWeight: 600, marginBottom: 4 },
};

// VATGauge · split horizontal bar showing collected vs paid VAT
function VATGauge({ collected, paid, currency = "SAR" }: { collected: number; paid: number; currency?: string }) {
  const net = collected - paid;
  const total = Math.max(collected + paid, 1);
  const collectedPct = (collected / total) * 100;
  const paidPct = (paid / total) * 100;
  const isOwed = net > 0;
  return (
    <Card className="border-[#E5E7EB] hover:border-[#D1D5DB] transition">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-[#6B7280]">ضريبة القيمة المضافة</span>
          <Gauge className="h-4 w-4 text-[#9CA3AF]" />
        </div>
        {/* split bar */}
        <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-[#F1F5F9]">
          <div style={{ width: `${collectedPct}%`, backgroundColor: chartColors.teal }} />
          <div style={{ width: `${paidPct}%`, backgroundColor: chartColors.navy }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#6B7280] mb-2">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: chartColors.teal }} /> لصالح الضريبة <span className="font-english font-semibold text-[#0B1B49] ms-1">{collected.toLocaleString()}</span></span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: chartColors.navy }} /> لصالحنا <span className="font-english font-semibold text-[#0B1B49] ms-1">{paid.toLocaleString()}</span></span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
          <span className="text-[11px] text-[#6B7280]">صافي المستحق</span>
          <div className="flex items-center gap-2">
            <span className="font-english" style={{ fontSize: "1rem", fontWeight: 700, color: isOwed ? "#F59E0B" : "#22C55E" }}>{Math.abs(net).toLocaleString()} <span className="text-[10px] text-[#9CA3AF]">{currency}</span></span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${isOwed ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#DCFCE7] text-[#166534]"}`}>{isOwed ? "علينا" : "لصالحنا ✓"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

function pct(curr: number, prev: number): { value: number; up: boolean } {
  if (prev === 0) return { value: curr === 0 ? 0 : 100, up: curr >= 0 };
  const diff = ((curr - prev) / Math.abs(prev)) * 100;
  return { value: Math.abs(Math.round(diff)), up: diff >= 0 };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedArmed, setSeedArmed] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.dashboard.summary();
      setData(d);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#1276E3]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || "تعذّر تحميل بيانات لوحة التحكم"}
      </div>
    );
  }

  const cur = data.org.baseCurrency;
  const fmt = (n: number) => `${n.toLocaleString()} ${cur}`;
  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };
  const k = data.kpi;
  const isEmpty = k.revenue === 0 && k.expenses === 0 && k.invoiceCount === 0;
  const netCompare = pct(data.periodCompare.thisMonth.net, data.periodCompare.lastMonth.net);
  const revCompare = pct(data.periodCompare.thisMonth.revenue, data.periodCompare.lastMonth.revenue);
  const expCompare = pct(data.periodCompare.thisMonth.expenses, data.periodCompare.lastMonth.expenses);
  const yearAgo = (data.periodCompare as any).yearAgo || { revenue: 0, expenses: 0, net: 0 };
  const revYa = pct(data.periodCompare.thisMonth.revenue, yearAgo.revenue);
  const expYa = pct(data.periodCompare.thisMonth.expenses, yearAgo.expenses);
  const netYa = pct(data.periodCompare.thisMonth.net, yearAgo.net);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>لوحة التحكم</h1>
          <p className="text-[#6B7280] mt-1">{data.org.name} · <span className="font-english">{cur}</span></p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/invoices?new=1" className="px-3 py-1.5 rounded-lg bg-[#1276E3] text-white text-sm hover:bg-[#0F66C7] transition">+ فاتورة</Link>
          <Link to="/app/expenses/new" className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition">+ مصروف</Link>
          <Link to="/app/vouchers/new" className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition">+ سند</Link>
        </div>
      </div>

      {isEmpty && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-[#1276E3]">
            مرحباً بك في <strong>{data.org.name}</strong> · لا توجد بيانات بعد · جرّب البيانات التجريبية لتشوف كل شي شغّال
          </div>
          {seedArmed ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  setSeedArmed(false);
                  try {
                    const orgId = (data.org as any).id;
                    if (!orgId) { push("error", "لم يتم تحديد الشركة"); return; }
                    const r = await (api as any).seedDemoData(orgId);
                    if (r?.ok) {
                      const s = r.seeded || {};
                      push("success", `تمت التعبئة · ${s.contacts || 0} عميل/مورّد · ${s.products || 0} منتج · ${s.invoices || 0} فاتورة`);
                      window.setTimeout(() => window.location.reload(), 800);
                    }
                  } catch (e: any) {
                    push("error", `فشل: ${e?.message || "خطأ غير معروف"}`);
                  }
                }}
                className="bg-[#1276E3] hover:bg-[#0F66C7] text-white text-sm px-4 py-2 rounded-lg"
              >
                تأكيد التعبئة
              </button>
              <button
                onClick={() => setSeedArmed(false)}
                className="border border-[#E5E7EB] text-[#6B7280] hover:bg-white text-sm px-3 py-2 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSeedArmed(true)}
              className="bg-[#1276E3] hover:bg-[#0F66C7] text-white text-sm px-4 py-2 rounded-lg shrink-0"
            >
              عبّ هذه الشركة ببيانات تجريبية كاملة
            </button>
          )}
        </div>
      )}

      {/* Overdue alert banner */}
      {data.overdueInvoices.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="text-sm">
              <span className="font-semibold text-red-700">{data.overdueInvoices.length} فاتورة متأخرة</span>
              <span className="text-red-600 mx-2">·</span>
              <span className="text-red-600 font-english">
                {data.overdueInvoices.reduce((s, i) => s + i.remaining, 0).toLocaleString()} {cur}
              </span>
              <span className="text-red-600 mx-1">قيد التحصيل</span>
            </div>
          </div>
          <Link to="/app/invoices?status=OVERDUE" className="text-sm text-red-700 hover:underline">عرض الكل ←</Link>
        </div>
      )}

      {/* KPI Cards · Row 1 (UX-212 · revenue · net income · expenses · VAT · smaller numbers + distinct colors) */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue · rightmost · navy */}
        <Card className="border-[#E5E7EB] hover:border-[#D1D5DB] transition">
          <CardContent className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-[#6B7280]">إجمالي الإيرادات</span>
              <DollarSign className="h-3.5 w-3.5 text-[#9CA3AF]" />
            </div>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15 }}>
              <span className="text-[#6B7280] text-[0.7rem] me-1 font-normal">{cur}</span>
              {k.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10.5px] text-[#9CA3AF] mt-1.5"><span className="font-english font-semibold text-[#0B1B49]">{k.invoiceCount}</span> فاتورة · نقد <span className="font-english">{k.cashOnHand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
          </CardContent>
        </Card>

        {/* Net Income · highlighted with sign · green/amber */}
        {(() => {
          const net = k.revenue - (k.expenses + k.purchases);
          const positive = net >= 0;
          return (
            <Card className="border-[#E5E7EB] hover:border-[#D1D5DB] transition">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-[#6B7280]">صافي الدخل</span>
                  {positive ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "#10B981" }} /> : <TrendingDown className="h-3.5 w-3.5" style={{ color: "#D97474" }} />}
                </div>
                <div className="font-english" style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15, color: positive ? "#0B1B49" : "#D97474" }}>
                  <span className="text-[#6B7280] text-[0.7rem] me-1 font-normal">{cur}</span>
                  {Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-[10.5px] mt-1.5">
                  <span className={positive ? "text-emerald-700" : "text-rose-700"} style={{ fontWeight: 600 }}>{positive ? "ربح" : "خسارة"}</span>
                  <span className="text-[#9CA3AF]"> · هامش </span>
                  <span className="font-english" style={{ color: positive ? "#10B981" : "#D97474" }}>{k.revenue > 0 ? Math.round((net / k.revenue) * 100) : 0}%</span>
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Total Expenses · teal · clearly different */}
        <Card className="border-[#E5E7EB] hover:border-[#D1D5DB] transition">
          <CardContent className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-[#6B7280]">إجمالي المصروفات</span>
              <ShoppingBag className="h-3.5 w-3.5" style={{ color: chartColors.teal }} />
            </div>
            <div className="font-english" style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15, color: chartColors.teal }}>
              <span className="text-[#6B7280] text-[0.7rem] me-1 font-normal">{cur}</span>
              {(k.expenses + k.purchases).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10.5px] text-[#9CA3AF] mt-1.5">مباشرة <span className="font-english font-semibold" style={{ color: chartColors.teal }}>{k.purchases.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> · عمومية <span className="font-english">{k.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
          </CardContent>
        </Card>

        {/* VAT Gauge · leftmost */}
        <VATGauge collected={k.vatOutput} paid={k.vatInput} currency={cur} />
      </div>

      {/* Charts grid 2x2 · Figma spec UX-205 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L · vertical bars · navy + red */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>الأرباح والخسائر</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">ملخص الأرباح والخسائر لآخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.profitLoss.map(p => ({ month: p.month, profit: p.revenue, loss: p.expenses }))}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" reversed tick={xAxisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={yAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                  <Bar dataKey="profit" fill={chartColors.navySoft} radius={[8, 8, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="loss" fill={chartColors.red} radius={[8, 8, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "الأرباح", color: chartColors.navy },
              { label: "الخسائر", color: chartColors.red },
            ]} />
          </CardContent>
        </Card>

        {/* Revenue Breakdown · horizontal bars · navySoft */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>تفصيل الإيرادات</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">توزيع الإيرادات حسب الفروع والمشاريع ومراكز التكلفة</CardDescription>
          </CardHeader>
          <CardContent>
            {data.incomeBreakdown.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#9CA3AF]">لا توجد إيرادات بعد</div>
            ) : (
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart layout="vertical" data={data.incomeBreakdown.slice(0, 6).map(r => ({ category: r.category, value: r.total }))}>
                    <CartesianGrid {...gridStyle} horizontal={false} />
                    <XAxis type="number" tick={xAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                    <YAxis type="category" dataKey="category" orientation="right" width={100} tick={{ ...yAxisStyle, fontFamily: "Noto Sans Arabic" }} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                    <Bar dataKey="value" fill={chartColors.navySoft} radius={[0, 8, 8, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue vs Expenses · grouped bars · navySoft + tealSoft */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>الإيرادات مقابل المصروفات</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">مقارنة الإيرادات بالمصروفات لآخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" reversed tick={xAxisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={yAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                  <Bar dataKey="revenue" fill={chartColors.navySoft} radius={[8, 8, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill={chartColors.tealSoft} radius={[8, 8, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "الإيرادات", color: chartColors.navy },
              { label: "المصروفات", color: chartColors.teal },
            ]} />
          </CardContent>
        </Card>

        {/* Cash Flow · line chart · navy + teal */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>التدفق النقدي</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">تحليل التدفقات النقدية الداخلة والخارجة</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.cashFlowTrend.map(c => ({ month: c.month, inflow: c.in, outflow: c.out }))}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" reversed tick={xAxisStyle} tickLine={false} axisLine={false} />
                  <YAxis orientation="right" tick={yAxisStyle} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(v: any) => Number(v).toLocaleString()} />
                  <Line type="monotone" dataKey="inflow" stroke={chartColors.navy} strokeWidth={2} dot={{ r: 3, fill: chartColors.navy }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="outflow" stroke={chartColors.teal} strokeWidth={2} dot={{ r: 3, fill: chartColors.teal }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[
              { label: "تدفق داخل", color: chartColors.navy, type: "line" },
              { label: "تدفق خارج", color: chartColors.teal, type: "line" },
            ]} />
          </CardContent>
        </Card>
      </div>

      {/* AR/AP + Period Compare + Connected Accounts · Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AR/AP card */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              <Banknote className="h-4 w-4" /> الذمم المدينة والدائنة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
              <div>
                <div className="text-xs text-green-700">يستحقون لي (AR)</div>
                <div className="font-english font-bold text-green-700 mt-0.5" style={{ fontSize: "1.15rem" }}>{fmt(k.accountsReceivable)}</div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div>
                <div className="text-xs text-amber-700">أستحق عليهم (AP)</div>
                <div className="font-english font-bold text-amber-700 mt-0.5" style={{ fontSize: "1.15rem" }}>{fmt(k.accountsPayable)}</div>
              </div>
              <ArrowDownRight className="h-5 w-5 text-amber-600" />
            </div>
            <div className="pt-2 border-t border-[#E5E7EB] flex justify-between items-center">
              <span className="text-xs text-[#6B7280]">صافي الذمم</span>
              <span className={`font-english font-bold ${k.accountsReceivable - k.accountsPayable >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmt(k.accountsReceivable - k.accountsPayable)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Period Compare · paired bars (UX-214) */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              <TrendingUp className="h-4 w-4" /> هذا الشهر vs الشهر الماضي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {(() => {
              const rows = [
                { label: "الإيرادات", curr: data.periodCompare.thisMonth.revenue, prev: data.periodCompare.lastMonth.revenue, ya: yearAgo.revenue, color: chartColors.navy, prevColor: chartColors.navy + "40", upGood: true, cmp: revCompare },
                { label: "المصروفات", curr: data.periodCompare.thisMonth.expenses, prev: data.periodCompare.lastMonth.expenses, ya: yearAgo.expenses, color: chartColors.teal, prevColor: chartColors.teal + "40", upGood: false, cmp: expCompare },
                { label: "صافي الدخل", curr: data.periodCompare.thisMonth.net, prev: data.periodCompare.lastMonth.net, ya: yearAgo.net, color: data.periodCompare.thisMonth.net >= 0 ? "#10B981" : "#E84B4B", prevColor: (data.periodCompare.thisMonth.net >= 0 ? "#10B981" : "#E84B4B") + "40", upGood: true, cmp: netCompare },
              ];
              const max = Math.max(1, ...rows.flatMap(r => [Math.abs(r.curr), Math.abs(r.prev), Math.abs(r.ya)]));
              return rows.map((r, i) => {
                const positiveTrend = r.upGood ? r.cmp.up : !r.cmp.up;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#6B7280]">{r.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-english font-semibold text-[#0B1B49]">{fmtCompact(r.curr)}</span>
                        <span className="font-english text-[10px]" style={{ color: positiveTrend ? "#10B981" : "#E84B4B" }}>{r.cmp.up ? "▲" : "▼"} {r.cmp.value}%</span>
                      </div>
                    </div>
                    {/* Three stacked thin bars · current / previous month / year-ago (UX-216) */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#9CA3AF] w-12 shrink-0">الحالي</span>
                        <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded">
                          <div className="h-1.5 rounded" style={{ width: `${(Math.abs(r.curr) / max) * 100}%`, backgroundColor: r.color }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#9CA3AF] w-12 shrink-0">الشهر الماضي</span>
                        <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded">
                          <div className="h-1.5 rounded" style={{ width: `${(Math.abs(r.prev) / max) * 100}%`, backgroundColor: r.prevColor }} />
                        </div>
                        <span className="font-english text-[10px] text-[#9CA3AF] shrink-0 w-9 text-end">{fmtCompact(r.prev)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#9CA3AF] w-12 shrink-0">السنة الماضية</span>
                        <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded">
                          <div className="h-1.5 rounded" style={{ width: `${(Math.abs(r.ya || 0) / max) * 100}%`, backgroundColor: r.prevColor }} />
                        </div>
                        <span className="font-english text-[10px] text-[#9CA3AF] shrink-0 w-9 text-end">{fmtCompact(r.ya || 0)}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        {/* Bank Accounts · Wave-style cards · UX-209 */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                <Wallet className="h-4 w-4" /> الحسابات البنكية
              </CardTitle>
              <Link to="/app/bank-accounts" className="text-xs text-[#1276E3] hover:underline">إدارة ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.bankAccounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-[#6B7280] mb-2">لا توجد حسابات بنكية مربوطة</p>
                <Link to="/app/bank-accounts/new" className="text-xs text-[#1276E3] hover:underline">+ ربط بنك جديد</Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-[#9CA3AF] mb-1">هذا الشهر مقابل الشهر الماضي</p>
                {data.bankAccounts.slice(0, 4).map((b: any) => {
                  // Compute trend % vs last month (mocked +4% if not provided · UX-215 Opus design)
                  const trendPct = (b as any).trendPct ?? 4;
                  const trendUp = trendPct >= 0;
                  return (
                    <Link key={b.id} to={`/app/bank-accounts`} className="block group">
                      <div className="rounded-lg border border-[#E5E7EB] hover:border-[#1276E3] transition p-2.5 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          {/* Right side · name + logo placeholder */}
                          <div className="flex items-center gap-2 min-w-0">
                            {(b as any).logoUrl ? (
                              <img src={(b as any).logoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-[#F3F4F6]" />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-[#F4FCFF] border border-[#E5E7EB] flex items-center justify-center">
                                <Wallet className="h-3.5 w-3.5" style={{ color: chartColors.navy }} />
                              </div>
                            )}
                            <span className="text-xs text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>{b.bankName || b.name} · {b.currency}</span>
                          </div>
                          {/* Left side · trend chip */}
                          <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-english shrink-0 ${trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            <span style={{ fontSize: "0.7rem" }}>{trendUp ? "↗" : "↘"}</span> {trendUp ? "+" : ""}{trendPct}%
                          </span>
                        </div>
                        {/* Big balance number */}
                        <div className="font-english text-[#0B1B49] mt-1.5" style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                          {b.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] text-[#9CA3AF]">{b.currency}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown + Overdue · Row 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut */}
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>تصنيف المصروفات</CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">حسب الفئة · هذا العام</CardDescription>
          </CardHeader>
          <CardContent>
            {data.expenseBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[#6B7280]">لا توجد مصروفات بعد</p>
                <Link to="/app/expenses/new" className="text-xs text-[#1276E3] hover:underline">+ إضافة مصروف</Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.expenseBreakdown}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
                    formatter={(v: any) => Number(v).toLocaleString()}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: "Noto Sans Arabic" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Overdue · 2 columns: AR (متأخرة لي) + AP (متأخرة عليّ) (UX-214) */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "1rem", fontWeight: 600 }}>
                <Clock className="h-4 w-4" style={{ color: chartColors.red }} /> الفواتير المتأخرة
              </CardTitle>
              <Link to="/app/invoices?status=OVERDUE" className="text-xs text-[#1276E3] hover:underline">عرض الكل ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* AR overdue · invoices customers haven't paid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[#6B7280]">متأخرة عليهم (AR)</span>
                  <span className="font-english text-[11px] font-semibold" style={{ color: chartColors.red }}>{data.overdueInvoices.length}</span>
                </div>
                {data.overdueInvoices.length === 0 ? (
                  <div className="text-center py-6 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[11px] text-emerald-700">🎉 لا توجد</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {data.overdueInvoices.slice(0, 3).map((inv) => (
                      <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="block p-2 rounded-md hover:bg-rose-50 border border-[#F3F4F6] hover:border-rose-100 transition">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-english text-[11px] text-[#0B1B49] font-semibold truncate">{inv.number}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-english shrink-0">{inv.daysOverdue}ي</span>
                            </div>
                            <div className="text-[10px] text-[#6B7280] truncate mt-0.5">{inv.contact}</div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="font-english text-[11px] font-semibold" style={{ color: chartColors.red }}>{(inv.remaining || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* AP overdue · bills we haven't paid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[#6B7280]">متأخرة علينا (AP)</span>
                  <span className="font-english text-[11px] font-semibold" style={{ color: chartColors.teal }}>{(data as any).overdueBills?.length || 0}</span>
                </div>
                {(!(data as any).overdueBills || (data as any).overdueBills.length === 0) ? (
                  <div className="text-center py-6 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[11px] text-emerald-700">🎉 لا توجد</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {((data as any).overdueBills as any[]).slice(0, 3).map((bill) => (
                      <Link key={bill.id} to={`/app/purchases/bills`} className="block p-2 rounded-md hover:bg-cyan-50 border border-[#F3F4F6] hover:border-cyan-100 transition">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-english text-[11px] text-[#0B1B49] font-semibold truncate">{bill.number || bill.billNumber}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-100 text-cyan-700 font-english shrink-0">{bill.daysOverdue}ي</span>
                            </div>
                            <div className="text-[10px] text-[#6B7280] truncate mt-0.5">{bill.contact}</div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="font-english text-[11px] font-semibold" style={{ color: chartColors.teal }}>{(bill.remaining || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats footer · Row 5 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">عدد العملاء/الموردين</div>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.contactCount}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">فواتير متأخرة</div>
            <div className={`font-english ${k.overdueCount > 0 ? "text-red-600" : "text-[#0B1B49]"}`} style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.overdueCount}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">إجمالي القبض</div>
            <div className="font-english text-green-600" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.receipts.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="text-[#6B7280] text-xs mb-1">إجمالي الصرف</div>
            <div className="font-english text-amber-600" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{k.payments.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
