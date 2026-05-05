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
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useEffect, useState, useCallback } from "react";
import { api, ApiError, DashboardSummary } from "../lib/api";

const DONUT_COLORS = ["#1276E3", "#179FC5", "#7DD3E4", "#0B1B49", "#D4A76A", "#10B981", "#F59E0B", "#EF4444"];

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>لوحة التحكم</h1>
          <p className="text-[#6B7280] mt-1">{data.org.name} · <span className="font-english">{cur}</span></p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/sales/invoices/new" className="px-3 py-1.5 rounded-lg bg-[#1276E3] text-white text-sm hover:bg-[#0F66C7] transition">+ فاتورة</Link>
          <Link to="/app/expenses/new" className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition">+ مصروف</Link>
          <Link to="/app/vouchers/new" className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#F4FCFF] transition">+ سند</Link>
        </div>
      </div>

      {isEmpty && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#1276E3]">
          مرحباً بك في {data.org.name}! · لا توجد بيانات بعد · ابدأ بإنشاء فاتورة أو مصروف · أو اضغط <strong>المساعد الذكي</strong> ليساعدك
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
          <Link to="/app/sales/invoices?status=OVERDUE" className="text-sm text-red-700 hover:underline">عرض الكل ←</Link>
        </div>
      )}

      {/* KPI Cards · Row 1 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <DollarSign className="h-4 w-4" /> إجمالي الإيرادات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(k.revenue)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{k.invoiceCount}</span> فاتورة</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <ShoppingBag className="h-4 w-4" /> المشتريات + المصروفات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(k.purchases + k.expenses)}</div>
            <p className="text-xs text-[#6B7280] mt-1">مشتريات <span className="font-english">{k.purchases.toLocaleString()}</span> + مصروفات <span className="font-english">{k.expenses.toLocaleString()}</span></p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <Gauge className="h-4 w-4" /> ضريبة القيمة المضافة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(Math.abs(k.vatNet))}</div>
            <p className="text-xs mt-1">
              {k.vatNet >= 0 ? <span className="text-amber-600">علينا للهيئة</span> : <span className="text-green-600">لصالحنا (استرداد)</span>}
              {" · "}<span className="font-english">{k.vatOutput.toLocaleString()}</span> مخرجات / <span className="font-english">{k.vatInput.toLocaleString()}</span> مدخلات
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] bg-gradient-to-br from-[#F4FCFF] to-white">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-[#6B7280] text-sm">
              <Wallet className="h-4 w-4 text-[#1276E3]" /> النقد المتوفّر
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-english text-[#0B1B49]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{fmt(k.cashOnHand)}</div>
            <p className="text-xs text-[#6B7280] mt-1"><span className="font-english">{data.bankAccounts.length}</span> حساب بنكي مربوط</p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow combo + P&L · Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>التدفق النقدي</CardTitle>
                <CardDescription className="text-[#6B7280] text-xs">داخل · خارج · الصافي · آخر 6 أشهر</CardDescription>
              </div>
              <Link to="/app/reports/cash-flow" className="text-xs text-[#1276E3] hover:underline">التقرير الكامل ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.cashFlowTrend}>
                <defs>
                  <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1276E3" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1276E3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF1" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={fmtCompact} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
                  formatter={(v: any) => Number(v).toLocaleString()}
                />
                <Bar dataKey="in" fill="#10B981" radius={[3, 3, 0, 0]} barSize={18} />
                <Bar dataKey="out" fill="#EF4444" radius={[3, 3, 0, 0]} barSize={18} />
                <Area type="monotone" dataKey="net" stroke="#1276E3" strokeWidth={2.5} fill="url(#netGradient)" />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend items={[
              { label: "تدفق داخل", color: "#10B981" },
              { label: "تدفق خارج", color: "#EF4444" },
              { label: "صافي", color: "#1276E3", type: "line" },
            ]} />
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 600 }}>الأرباح والخسائر</CardTitle>
                <CardDescription className="text-[#6B7280] text-xs">الإيرادات vs المصروفات · صافي الدخل · آخر 6 أشهر</CardDescription>
              </div>
              <Link to="/app/reports/profit-loss" className="text-xs text-[#1276E3] hover:underline">التقرير الكامل ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.profitLoss}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF1" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={fmtCompact} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
                  formatter={(v: any) => Number(v).toLocaleString()}
                />
                <Bar dataKey="revenue" fill="#0B1B49" radius={[3, 3, 0, 0]} barSize={20} />
                <Bar dataKey="expenses" fill="#7DD3E4" radius={[3, 3, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="net" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend items={[
              { label: "الإيرادات", color: "#0B1B49" },
              { label: "المصروفات", color: "#7DD3E4" },
              { label: "صافي الدخل", color: "#10B981", type: "line" },
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
              <span className="text-xs text-[#6B7280]">صافي رأس المال العامل</span>
              <span className={`font-english font-bold ${k.accountsReceivable - k.accountsPayable >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmt(k.accountsReceivable - k.accountsPayable)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Period Compare */}
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              <TrendingUp className="h-4 w-4" /> هذا الشهر vs الشهر الماضي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">الإيرادات</span>
              <div className="flex items-center gap-2">
                <span className="font-english font-semibold">{fmtCompact(data.periodCompare.thisMonth.revenue)}</span>
                <span className={`text-xs ${revCompare.up ? "text-green-600" : "text-red-600"}`}>
                  {revCompare.up ? "▲" : "▼"} {revCompare.value}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">المصروفات</span>
              <div className="flex items-center gap-2">
                <span className="font-english font-semibold">{fmtCompact(data.periodCompare.thisMonth.expenses)}</span>
                <span className={`text-xs ${!expCompare.up ? "text-green-600" : "text-red-600"}`}>
                  {expCompare.up ? "▲" : "▼"} {expCompare.value}%
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
              <span className="text-sm text-[#0B1B49] font-semibold">صافي الدخل</span>
              <div className="flex items-center gap-2">
                <span className={`font-english font-bold ${data.periodCompare.thisMonth.net >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {fmtCompact(data.periodCompare.thisMonth.net)}
                </span>
                <span className={`text-xs ${netCompare.up ? "text-green-600" : "text-red-600"}`}>
                  {netCompare.up ? "▲" : "▼"} {netCompare.value}%
                </span>
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF] pt-1">الشهر الماضي: <span className="font-english">{fmtCompact(data.periodCompare.lastMonth.net)}</span> {cur}</p>
          </CardContent>
        </Card>

        {/* Connected accounts */}
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
                {data.bankAccounts.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-[#F3F4F6] last:border-0">
                    <div className="min-w-0">
                      <div className="text-[#0B1B49] truncate" style={{ fontWeight: 500 }}>{b.name}</div>
                      <div className="text-xs text-[#9CA3AF] font-english">{b.bankName || "—"} {b.accountNumber || ""}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-english font-semibold text-[#0B1B49]">{b.balance.toLocaleString()}</div>
                      <div className="text-xs text-[#9CA3AF] font-english">{b.currency}</div>
                    </div>
                  </div>
                ))}
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

        {/* Overdue list */}
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#0B1B49] flex items-center gap-2" style={{ fontSize: "1rem", fontWeight: 600 }}>
                <Clock className="h-4 w-4 text-red-500" /> فواتير متأخرة
              </CardTitle>
              <Link to="/app/sales/invoices?status=OVERDUE" className="text-xs text-[#1276E3] hover:underline">عرض الكل ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.overdueInvoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-green-600">🎉 لا توجد فواتير متأخرة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.overdueInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/app/sales/invoices/${inv.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-english text-sm text-[#0B1B49] font-semibold">{inv.number}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-english">
                          {inv.daysOverdue} يوم
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7280] truncate mt-0.5">{inv.contact}</div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="font-english font-semibold text-red-600">{inv.remaining.toLocaleString()}</div>
                      <div className="text-xs text-[#9CA3AF] font-english">{cur}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
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
    </div>
  );
}
