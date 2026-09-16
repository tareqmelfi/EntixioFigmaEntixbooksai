import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { DashboardSummary, DashboardPeriodKey, DashboardOpenBalances } from '../lib/api';
import { displayDigits, displayLocale } from '../lib/number-display';
import { useLanguage } from './LanguageContext';
import { Card } from './ui/card';
import { DashboardFigures } from './dashboard-figures';

const BOX = 'gap-2.5 p-4 md:gap-3 md:px-5 md:py-[18px] xl:gap-4 xl:px-6 xl:py-[22px] min-w-0';
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-4)'];
const number = (value: number) => value.toLocaleString(displayLocale('en-US'), {minimumFractionDigits:2,maximumFractionDigits:2});
const date = (value?: string | null) => value ? displayDigits(value.slice(0,10)) : '—';
const scopedText = (text:string) => text.split(/(\d{4}-\d{2}-\d{2})/).map((part,index)=>/^\d{4}-\d{2}-\d{2}$/.test(part)?<bdi key={index}>{part}</bdi>:part);
const range = (from?: string | null, to?: string | null) => `${date(from)} — ${date(to)}`;
export function comparableGrowth(current: number | null, previous: number | null, comparable: boolean): number | null {
  if (!comparable || current === null || previous === null || previous === 0 || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return (current - previous) / Math.abs(previous) * 100;
}
export function financialReportHref(id: 'income-statement' | 'balance-sheet', from: string | null, to: string) {
  const query = new URLSearchParams({to});
  if (from) query.set('from',from);
  // The all-time income range must not silently fall back to the current year.
  if (!from && id === 'income-statement') query.set('allTime','1');
  return `/app/reports/${id}?${query}`;
}
/** Big ledger numeral: large integer part, small muted fraction. */
function Numeral({ value, fraction = true }: { value: number; fraction?: boolean }) {
  const abs = Math.abs(value);
  const int = Math.trunc(abs).toLocaleString(displayLocale(undefined), { maximumFractionDigits: 0 });
  const frac = displayDigits((abs - Math.trunc(abs)).toFixed(2).slice(1));
  return (
    <>
      {value < 0 ? "−" : ""}{int}
      {fraction && <small className="text-[0.45em] text-content-secondary">{frac}</small>}
    </>
  );
}

function ChartLegend({items}: {items:Array<{label:string;color:string}>}) {
  return <div className="flex flex-wrap gap-5 text-xs text-content-secondary">{items.map(item=><span key={item.label} className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5" style={{backgroundColor:item.color}}/>{item.label}</span>)}</div>;
}
function Panel({title,scope,children,testId}: {title:string;scope:string;children:ReactNode;testId?:string}) {
  return <Card className={BOX} data-testid={testId}><div><h2 className="text-[14px] font-semibold md:text-[15px] xl:text-[16px]">{title}</h2><p className="mt-1 text-xs text-content-secondary">{scopedText(scope)}</p></div>{children}</Card>;
}
function OpenBalances({data,title,scope,href}: {data?:DashboardOpenBalances;title:string;scope:string;href:string}) {
  const {t}=useLanguage();
  const money=(value:number,currency=data?.currency)=>`${number(value)} ${currency}`;
  return <Panel title={title} scope={scope} testId={href.includes('purchases')?'current-payables':'current-receivables'}>
    {!data ? <p className="text-sm text-content-secondary">{t('تفصيل الأرصدة الحالية غير متاح.', 'Current balance detail unavailable.')}</p> : <>
      <div className="flex flex-wrap justify-between gap-2"><Link to={href} className="text-2xl font-semibold tabular-nums"><bdi>{money(data.total)}</bdi></Link><span className="text-xs text-content-secondary">{data.count} {t('فاتورة قائمة', 'open invoices')}</span></div>
      <dl className="grid grid-cols-2 gap-3 text-xs">{([
        ['overdue',t('متأخر السداد', 'Overdue')],['dueToday',t('مستحق اليوم','Due today')],['notDue',t('لم يستحق بعد','Not yet due')],['noDueDate',t('بلا تاريخ استحقاق','No due date')]
      ] as const).map(([key,label])=><div key={key}><dt className="text-content-secondary">{label}</dt><dd className={`mt-1 tabular-nums ${key==='overdue'&&data[key]>0?'text-warning':''}`}><bdi>{money(data[key])}</bdi></dd></div>)}</dl>
      <p className="text-xs text-content-secondary">{t('المتبقي بعد الدفعات والإشعارات الدائنة المطبقة.', 'Remaining after applied payments and credits.')}</p>
      {data.byIssueYear.length>0&&<div className="overflow-x-auto"><table className="w-full text-xs"><caption className="py-2 text-start font-semibold">{t('المتبقي حاليًا حسب سنة إصدار الفاتورة', 'Current outstanding by invoice issue year')}</caption><thead><tr className="border-b border-border text-content-secondary"><th className="py-2 text-start">{t('سنة الإصدار','Issue year')}</th><th className="text-end">{t('المتبقي','Remaining')}</th><th className="text-end">{t('منه متأخر','Overdue portion')}</th></tr></thead><tbody>{data.byIssueYear.map(row=><tr key={row.year} className="border-b border-border"><td className="py-2">{displayDigits(String(row.year))}</td><td className="text-end tabular-nums">{number(row.total)}</td><td className="text-end tabular-nums">{number(row.overdue)}</td></tr>)}</tbody></table><p className="mt-2 text-xs text-content-secondary">{data.currency} · {t('ليست أرصدة إقفال السنوات.', 'These are not year-end balances.')}</p></div>}
      {data.byCurrency.filter(row=>row.currency!==data.currency).map(row=><p key={row.currency} className="text-xs">{t('عملة أخرى، خارج الإجمالي:', 'Other currency, excluded from total:')} <bdi>{money(row.total,row.currency)}</bdi> · {t('متأخر', 'overdue')} <bdi>{money(row.overdue,row.currency)}</bdi></p>)}
      {data.unallocatedCredits.length>0&&<div className="text-xs text-content-secondary">{t('أرصدة دائنة غير موزعة، لم تخصم من الفواتير:', 'Unallocated credits, not deducted from invoices:')}{data.unallocatedCredits.map(row=><p key={row.currency}><bdi>{money(row.amount,row.currency)}</bdi></p>)}</div>}
    </>}
  </Panel>;
}

export function DashboardFinancialOverview({data,period,onPeriodChange}: {data:DashboardSummary;period:DashboardPeriodKey;onPeriodChange:(value:DashboardPeriodKey)=>void}) {
  const {t,language}=useLanguage();
  const [chartGrouping,setChartGrouping]=useState<'months'|'years'>('months');
  const cur=data.org.baseCurrency;
  const money=(value:number,currency=cur)=>`${number(value)} ${currency}`;
  const noData=t('لا توجد بيانات مسجلة للفترة','No recorded data for this period');
  const unavailable=t('غير متاح','Unavailable');
  const p=data.period;
  const flowDates=p ? (p.fromDate ? `${t('من','From')} ${date(p.fromDate)} ${t('إلى','to')} ${date(p.toDate)}` : `${t('من أول حركة مسجلة','From first recorded activity')} — ${date(p.toDate)}`) : t('نطاق الفترة غير متاح؛ حدّث خدمة التقارير.','Period scope unavailable; update the reporting service.');
  const flowScope=`${flowDates} · ${cur} · ${p?.source==='ledger'?t('قيود مرحّلة','Posted journal entries'):p?.source==='documents'?t('مستندات مسجلة','Recorded documents'):unavailable}`;
  const currentScope=data.currentTotalsScope ? `${t('جميع السنوات · المتبقي الحالي حتى','All years · current remaining as of')} ${date(data.currentTotalsScope.asOfDate)}` : t('نطاق الأرصدة الحالية غير متاح','Current balance scope unavailable');
  const hasActivity=!!data.dataAvailability?.hasActivity;
  const missing=(...keys:string[])=>keys.some(key=>data.unavailableMetrics?.includes(key));
  const flowValue=(value:number,...keys:string[])=>!p || !hasActivity || missing(...keys) ? '—' : <Numeral value={value}/>;

  const flowReady=!!p&&hasActivity;
  const k=data.kpi;
  // API expenses already includes the complete P&L; gross purchases are a separate document statistic.
  const net=k.netIncome??k.revenue-k.expenses;
  const chartUnavailable=(rows:unknown[],...keys:string[])=>!flowReady||missing(...keys)||rows.some(row=>keys.some(key=>(row as {unavailableMetrics?:string[]}).unavailableMetrics?.includes(key)));
  const chartEmpty=<p className="py-12 text-center text-sm text-content-secondary">{hasActivity?unavailable:noData}</p>;
  // Trend ranges are independent of the KPI selector. Missing point data is a gap, never a reported zero.
  type TrendPoint = {from?:string|null;to?:string;fromDate?:string|null;toDate?:string;dataAvailability?:{hasActivity:boolean};unavailableMetrics?:string[]};
  const trendScope=(rows:TrendPoint[],source:'ledger'|'documents'|'vouchers')=>{
    const from=rows.map(row=>row.fromDate).filter(Boolean).sort()[0];
    const to=rows.map(row=>row.toDate).filter(Boolean).sort().slice(-1)[0];
    return `${t('من','From')} ${date(from)} ${t('إلى','to')} ${date(to)} · ${cur} · ${source==='vouchers'?t('سندات القبض والصرف','Receipt and payment vouchers'):source==='ledger'?t('قيود مرحّلة','Posted journal entries'):t('مستندات مسجلة','Recorded documents')} · ${t('مدى الرسم مستقل عن فترة المؤشرات','Chart range is independent of the KPI period')}`;
  };
  const pointValue=(point:TrendPoint,value:number,...keys:string[])=>point.dataAvailability?.hasActivity&&!keys.some(key=>point.unavailableMetrics?.includes(key))?value:null;
  const trendEmpty=<p className="py-12 text-center text-sm text-content-secondary">{t('لا تتوفر بيانات مسجلة قابلة للعرض ضمن مدى الرسم.','No displayable recorded data in the chart range.')}</p>;
  const tooltip={contentStyle:{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:12},formatter:(value:unknown)=>money(Number(value)),labelFormatter:(_label:unknown,payload:readonly any[])=>{const item=payload?.[0]?.payload;return item?.fromDate||item?.toDate?range(item.fromDate,item.toDate):displayDigits(String(_label));}};
  const rawPl=chartGrouping==='years'?(data.yearlyTrend||[]):data.profitLoss;
  const seriesRows=rawPl.map(row=>({...row,label:'year' in row?String(row.year):displayDigits(row.month),revenue:pointValue(row,row.revenue,'revenue'),net:pointValue(row,row.net,'net','netIncome','revenue','expenses')}));
  const monthlyRows=data.monthlyTrend.map(row=>({...row,revenue:pointValue(row,row.revenue,'revenue'),expenses:pointValue(row,row.expenses,'expenses')}));
  const cashRows=data.cashFlowTrend.map(row=>({...row,in:pointValue(row,row.in,'in','receipts'),out:pointValue(row,row.out,'out','payments')}));
  const usable=(rows:Array<Record<string,unknown>>,keys:string[])=>rows.some(row=>keys.some(key=>row[key]!==null&&row[key]!==undefined));
  const comparison=data.comparison;
  const comparisonRows=[['revenue',t('الإيرادات','Revenue')],['expenses',t('المصروفات','Expenses')],['net',t('صافي الدخل','Net income')]] as const;
  const currentCompare=data.periodCompare.thisMonth;
  const priorCompare=data.periodCompare.lastMonth;
  const yearCompare=data.periodCompare.yearAgo;
  const safeComparison=(point:typeof currentCompare|undefined,allowed:boolean|undefined)=>!!allowed&&!!point?.toDate&&!!point?.dataAvailability?.hasActivity&&!point?.unavailableMetrics?.length&&!!currentCompare.dataAvailability?.hasActivity&&!currentCompare.unavailableMetrics?.length;
  const compareLast=safeComparison(priorCompare,comparison?.lastMonthComparable??comparison?.comparable);
  const compareYear=safeComparison(yearCompare,comparison?.yearAgoComparable??comparison?.comparable);
  const incomeLink=p?financialReportHref('income-statement',p.fromDate,p.toDate):'/app/reports/income-statement';
  const chartDates=(rows:TrendPoint[])=>{const from=rows.map(row=>row.fromDate).filter(Boolean).sort()[0];const to=rows.map(row=>row.toDate).filter(Boolean).sort().slice(-1)[0];return `${date(from)} → ${date(to)}`;};
  const activity=[...data.overdueInvoices.slice(0,3).map(invoice=>({id:invoice.id,label:`${invoice.number} · ${invoice.contact}`,amount:invoice.remaining,currency:invoice.currency||cur,href:`/app/invoices/${invoice.id}`})),...data.bankAccounts.slice(0,2).map(bank=>({id:bank.id,label:bank.bankName||bank.name,amount:bank.balance,currency:bank.currency,href:`/app/bank-accounts/${bank.id}`}))].slice(0,5);
  const figures=[
    {key:'revenue',label:t('إجمالي الإيرادات','Total revenue'),labelShort:t('الإيرادات','Revenue'),value:flowValue(k.revenue,'revenue')},
    {key:'net',label:t('صافي الدخل','Net income'),value:flowValue(net,'netIncome','revenue','expenses'),negative:hasActivity&&net<0},
    {key:'expenses',label:t('المصروفات','Expenses'),value:flowValue(k.expenses,'expenses')},
    {key:'vat',label:t('صافي ضريبة مستندات الفترة','Net tax on period documents'),labelShort:t('صافي ضريبة الفترة','Net period tax'),value:flowValue(k.vatNet,'vatNet')}
  ];
  const comparisonContent=!compareLast&&!compareYear?<p className="py-4 text-xs text-content-secondary">{t('لا تتوفر فترات ذات بيانات قابلة للمقارنة.','No periods with comparable recorded data are available.')}</p>:<div className="overflow-x-auto"><table className="w-full min-w-[530px] text-xs"><thead><tr className="border-b border-border"><th className="py-2 text-start">{cur}</th>{[currentCompare,...(compareLast?[priorCompare]:[]),...(compareYear&&yearCompare?[yearCompare]:[])].map((point,index)=><th key={index} className="px-2 text-end"><bdi>{range(point.fromDate,point.toDate)}</bdi></th>)}</tr></thead><tbody>{comparisonRows.map(([key,label])=><tr key={key} className="border-b border-border"><th className="py-3 text-start font-normal">{label}</th><td className="text-end tabular-nums">{number(currentCompare[key])}</td>{[...(compareLast?[priorCompare]:[]),...(compareYear&&yearCompare?[yearCompare]:[])].map((point,index)=>{const growth=comparableGrowth(currentCompare[key],point[key],true);return <td key={index} className="px-2 text-end tabular-nums">{number(point[key])}<span className="ms-2 text-content-secondary">{growth===null?'—':`${growth>0?'+':''}${growth.toFixed(1)}%`}</span></td>})}</tr>)}</tbody></table></div>;
  return <>
    <div data-testid="flow-period" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2"><label htmlFor="dashboard-flow-period" className="text-content-secondary">{t('الفترة','Period')}</label><select id="dashboard-flow-period" aria-label={t('فترة الحركات','Activity period')} className="h-8 max-w-full rounded-full border border-border bg-card px-3 text-xs" value={period} onChange={event=>onPeriodChange(event.target.value as DashboardPeriodKey)}>{([
        ['fiscal_ytd',t('السنة المالية حتى اليوم','Fiscal year to date')],['previous_fiscal_year',t('السنة المالية السابقة','Previous fiscal year')],['month',t('الشهر الحالي حتى اليوم','Current month to date')],['previous_month',t('الشهر السابق','Previous month')],['all_time',t('كل الفترات','All time')]
      ] as const).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      <span className="text-content-secondary" data-testid="flow-dates">{scopedText(flowDates)} · {cur}</span>
    </div>
    <section data-testid="flow-kpis"><DashboardFigures items={figures}/><p className="mt-2 text-xs text-content-secondary" role="status">{!hasActivity?noData:missing('revenue','expenses','netIncome','vatNet')?t('بعض المؤشرات غير متاحة من البيانات المسجلة.','Some indicators are unavailable from the recorded data.'):t('بحسب البيانات المسجلة للفترة','Based on recorded data for the period')}</p></section>

    <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 lg:grid-cols-3" data-testid="dashboard-primary-row">
      <div className="min-w-0 lg:col-span-2"><Panel title={chartGrouping==='years'?t('الأرباح والخسائر · حسب السنة','Profit & Loss · by year'):t('الأرباح والخسائر · آخر 6 أشهر','Profit & Loss · last 6 months')} scope={chartDates(rawPl)} testId="flow-profit-loss">
        <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label={t('تجميع الرسم','Chart grouping')}><button className="rounded-full border border-border px-3 py-1" aria-pressed={chartGrouping==='months'} onClick={()=>setChartGrouping('months')}>{t('شهري','Monthly')}</button><button className="rounded-full border border-border px-3 py-1" aria-pressed={chartGrouping==='years'} onClick={()=>setChartGrouping('years')}>{t('سنوات ميلادية','Calendar years')}</button></div>
        <div dir="ltr" className="h-[120px] md:h-[150px] xl:h-[190px]">{!usable(seriesRows,['revenue','net'])?trendEmpty:<ResponsiveContainer width="100%" height="100%"><BarChart data={seriesRows} margin={{top:4,right:0,left:0,bottom:0}} barGap={4} barCategoryGap="26%"><CartesianGrid stroke="var(--surface-hover)" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}} tickLine={false} axisLine={{stroke:'var(--border)'}}/><Tooltip {...tooltip}/><Bar dataKey="revenue" name={t('الإيرادات','Revenue')} fill="var(--chart-5)" radius={[4,4,0,0]} maxBarSize={42}/><Bar dataKey="net" name={t('الربح','Profit')} fill="var(--chart-1)" radius={[4,4,0,0]} maxBarSize={42}>{seriesRows.map((row,index)=><Cell key={index} fill={row.net!==null&&row.net<0?'var(--danger)':'var(--chart-1)'}/>)}</Bar></BarChart></ResponsiveContainer>}</div>
        <ChartLegend items={[{label:t('الإيرادات','Revenue'),color:'var(--chart-5)'},{label:t('الربح','Profit'),color:'var(--chart-1)'},{label:t('خسارة','Loss'),color:'var(--danger)'}]}/>
      </Panel></div>
      <Panel title={t('متابعة الحسابات','Account follow-up')} scope={`${t('حتى','As of')} ${date(data.currentTotalsScope?.asOfDate)}`} testId="current-followup">
        {!activity.length?<div className="py-8 text-xs text-content-secondary">{t('لا توجد متابعة مسجلة بعد','No recorded items to follow up')}</div>:<div className="flex flex-col text-[13px]">{activity.map(row=><Link key={row.id} to={row.href} className="flex items-center justify-between gap-3 border-b border-border py-2.5"><span className="min-w-0 truncate">{displayDigits(row.label)}</span><span className="shrink-0 font-display text-base tabular-nums"><bdi>{money(row.amount,row.currency)}</bdi></span></Link>)}</div>}
      </Panel>
    </div>

    <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 lg:grid-cols-2" data-testid="dashboard-charts-row">
      <Panel title={t('تفصيل الإيرادات','Revenue Breakdown')} scope={`${t('حسابات الإيرادات · الفترة المختارة','Income accounts · selected period')} · ${p?chartDates([p]):'—'}`}>
        {chartUnavailable(data.incomeBreakdown,'revenue')||!data.incomeBreakdown.length?chartEmpty:<div dir="ltr"><ResponsiveContainer width="100%" height={230}><BarChart layout="vertical" data={data.incomeBreakdown.slice(0,6)}><CartesianGrid stroke="var(--surface-hover)" horizontal={false}/><XAxis type="number" tick={{fontSize:11}} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="category" orientation="right" width={110} tick={{fontSize:11}} tickLine={false} axisLine={false}/><Tooltip {...tooltip}/><Bar dataKey="total" name={t('الإيرادات','Revenue')} fill="var(--chart-1)" radius={[0,4,4,0]} maxBarSize={22}/></BarChart></ResponsiveContainer></div>}
      </Panel>
      <Panel title={t('الإيرادات مقابل المصروفات','Revenue vs Expenses')} scope={`${t('آخر 6 أشهر','Last 6 months')} · ${chartDates(data.monthlyTrend)}`}>
        {!usable(monthlyRows,['revenue','expenses'])?trendEmpty:<div dir="ltr"><ResponsiveContainer width="100%" height={230}><BarChart data={monthlyRows}><CartesianGrid stroke="var(--surface-hover)" vertical={false}/><XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/><YAxis orientation="right" tick={{fontSize:11}} tickLine={false} axisLine={false} width={44}/><Tooltip {...tooltip}/><Bar dataKey="revenue" name={t('الإيرادات','Revenue')} fill="var(--chart-5)" radius={[4,4,0,0]} maxBarSize={28}/><Bar dataKey="expenses" name={t('المصروفات','Expenses')} fill="var(--chart-1)" radius={[4,4,0,0]} maxBarSize={28}/></BarChart></ResponsiveContainer></div>}
        <ChartLegend items={[{label:t('الإيرادات','Revenue'),color:'var(--chart-5)'},{label:t('المصروفات','Expenses'),color:'var(--chart-1)'}]}/>
      </Panel>
      <Panel title={t('التدفق النقدي','Cash Flow')} scope={`${t('سندات القبض والصرف · آخر 6 أشهر','Receipt/payment vouchers · last 6 months')} · ${chartDates(data.cashFlowTrend)}`}>
        {!usable(cashRows,['in','out'])?trendEmpty:<div dir="ltr"><ResponsiveContainer width="100%" height={230}><LineChart data={cashRows}><CartesianGrid stroke="var(--surface-hover)" vertical={false}/><XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/><YAxis orientation="right" tick={{fontSize:11}} tickLine={false} axisLine={false} width={44}/><Tooltip {...tooltip}/><Line dataKey="in" name={t('تدفق داخل','Inflow')} stroke="var(--chart-1)" strokeWidth={2} dot={{r:3}}/><Line dataKey="out" name={t('تدفق خارج','Outflow')} stroke="var(--chart-2)" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>}
      </Panel>
      <Panel title={t('تصنيف المصروفات','Expense Breakdown')} scope={`${t('حسب الفئة · الفترة المختارة','By category · selected period')} · ${p?chartDates([p]):'—'}`}>
        {chartUnavailable(data.expenseBreakdown,'expenses')||!data.expenseBreakdown.length?chartEmpty:<div dir="ltr"><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.expenseBreakdown} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2} stroke="var(--card)">{data.expenseBreakdown.map((row,index)=><Cell key={row.category} fill={COLORS[index%COLORS.length]}/>)}</Pie><Tooltip {...tooltip}/><Legend wrapperStyle={{fontSize:11}} iconType="circle"/></PieChart></ResponsiveContainer></div>}
      </Panel>
    </div>

    <div className="grid grid-cols-1 gap-4 md:gap-[18px] xl:gap-6 lg:grid-cols-3" data-testid="dashboard-balances-row">
      <Panel title={t('الذمم المدينة والدائنة','Receivables & Payables')} scope={currentScope} testId="current-balances">
        {[{label:t('مستحق للشركة (AR)','Receivable (AR)'),balance:data.receivables,href:'/app/invoices'},{label:t('مستحق على الشركة (AP)','Payable (AP)'),balance:data.payables,href:'/app/purchases/bills'}].map(row=><Link key={row.href} to={row.href} className="ledger-hoverable block rounded-lg border border-border p-3"><span className="text-xs text-content-secondary">{row.label}</span><div className="mt-0.5 font-display text-lg tabular-nums"><bdi>{row.balance?money(row.balance.total):'—'}</bdi></div>{row.balance&&<p className="text-xs text-content-secondary">{t('منه متأخر','Overdue portion')}: <bdi>{money(row.balance.overdue)}</bdi></p>}</Link>)}
        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs"><span className="text-content-secondary">{t('صافي الذمم','Net balance')}</span><bdi>{data.receivables&&data.payables?money(data.receivables.total-data.payables.total):'—'}</bdi></div>
      </Panel>
      <Panel title={t('هذا الشهر مقابل الشهر الماضي','This month vs last month')} scope={t('حتى نفس اليوم من الشهر','Through the same day of the month')} testId="period-comparison">
        {!compareLast?<p className="py-4 text-xs text-content-secondary">{t('لا تتوفر فترات ذات بيانات قابلة للمقارنة.','No periods with comparable recorded data are available.')}</p>:comparisonRows.map(([key,label])=>{const growth=comparableGrowth(currentCompare[key],priorCompare[key],compareLast);return <div key={key} className="space-y-1 text-xs"><div className="flex justify-between gap-2"><span className="text-content-secondary">{label}</span><bdi>{number(currentCompare[key])}{growth!==null&&<span className="ms-2 text-content-secondary">{growth>0?'+':''}{growth.toFixed(1)}%</span>}</bdi></div><div className="h-1.5 rounded-full bg-surface-subtle"><div className="h-1.5 rounded-full bg-primary" style={{width:`${Math.abs(currentCompare[key])/(Math.abs(currentCompare[key])+Math.abs(priorCompare[key])||1)*100}%`}}/></div><p className="text-content-secondary"><bdi>{range(currentCompare.fromDate,currentCompare.toDate)}</bdi> / <bdi>{range(priorCompare.fromDate,priorCompare.toDate)}</bdi></p></div>})}
      </Panel>
      <Panel title={t('الحسابات البنكية','Bank accounts')} scope={`${t('الأرصدة المسجلة حتى','Recorded balances as of')} ${date(data.cash?.asOf)}`} testId="current-cash">
        <div className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-content-secondary">{t('إجمالي العملة الأساسية','Base-currency total')}</span><bdi>{data.cash?money(data.cash.baseCurrencyTotal,data.cash.baseCurrency):'—'}</bdi></div>
        {data.cash?.byCurrency.filter(row=>row.currency!==data.cash?.baseCurrency).map(row=><p key={row.currency} className="text-xs text-content-secondary">{t('خارج الإجمالي:','Excluded:')} <bdi>{money(row.balance,row.currency)}</bdi></p>)}
        {!data.bankAccounts.length?<p className="py-8 text-xs text-content-secondary">{t('لا توجد حسابات بنكية مسجلة.','No bank accounts recorded.')}</p>:data.bankAccounts.slice(0,4).map(bank=><Link key={bank.id} to={`/app/bank-accounts/${bank.id}`} className="ledger-hoverable block rounded-lg border border-border p-3"><span className="text-xs font-semibold">{displayDigits(bank.bankName||bank.name)} · {bank.currency}</span><p className="mt-1.5 font-display text-base tabular-nums"><bdi>{money(bank.balance,bank.currency)}</bdi></p></Link>)}
        <Link to="/app/bank-accounts" className="text-xs font-semibold text-primary">{t('إدارة ←','Manage ←')}</Link>
      </Panel>
    </div>

    <Panel title={t('الفواتير المتأخرة','Overdue Invoices')} scope={currentScope} testId="overdue-followup">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{[{title:t('متأخرة عليهم (AR)','Overdue to us (AR)'),items:data.overdueInvoices,base:'/app/invoices/'},{title:t('متأخرة علينا (AP)','Overdue by us (AP)'),items:data.overdueBills,base:'/app/purchases/bills/'}].map(group=><div key={group.base}><h3 className="mb-2 border-b border-foreground pb-1.5 text-xs text-content-secondary">{group.title}</h3>{!group.items?<p className="py-4 text-xs text-content-secondary">{unavailable}</p>:!group.items.length?<p className="py-4 text-xs text-content-secondary">{t('لا توجد متأخرات مسجلة.','No recorded overdue items.')}</p>:group.items.slice(0,3).map(item=><Link key={item.id} to={`${group.base}${item.id}`} className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-xs"><span className="min-w-0"><span className="font-code">{displayDigits(item.number)}</span> · {item.daysOverdue}{t('ي','d')}<span className="mt-0.5 block truncate text-content-secondary">{displayDigits(item.contact)}</span></span><bdi className="shrink-0 font-display text-sm">{money(item.remaining,item.currency||cur)}</bdi></Link>)}</div>)}</div>
    </Panel>
    <DashboardFigures items={[
      {key:'contacts',label:t('عدد العملاء/الموردين','Customers/Vendors count'),value:<Numeral value={k.contactCount} fraction={false}/>,hint:t('كل السجلات','All records')},
      {key:'overdue',label:t('فواتير متأخرة','Overdue invoices'),value:<Numeral value={k.overdueCount} fraction={false}/>,hint:t('جميع السنوات · حاليًا','All years · current')},
      {key:'receipts',label:t('إجمالي القبض','Total receipts'),value:flowValue(k.receipts,'receipts'),hint:t('الفترة المختارة','Selected period')},
      {key:'payments',label:t('إجمالي الصرف','Total payments'),value:flowValue(k.payments,'payments'),hint:t('الفترة المختارة','Selected period')}
    ]}/>

    <details className="rounded-lg border border-border px-4 py-3" data-testid="dashboard-details"><summary className="cursor-pointer text-xs font-semibold">{t('تفاصيل الفترة والذمم والتقارير','Period, balances and report details')}</summary><div className="mt-4 space-y-4">
      <p className="text-xs text-content-secondary">{scopedText(flowScope)}</p>
      {p&&<div className="flex flex-wrap gap-3 text-xs font-semibold text-primary"><Link to={incomeLink}>{t('قائمة دخل الفترة','Period income statement')}</Link><Link to={financialReportHref('balance-sheet',null,p.toDate)}>{t('المركز المالي في','Financial position at')} <bdi>{date(p.toDate)}</bdi></Link></div>}
      {!!data.limitations?.length&&<div className="text-xs text-content-secondary">{data.limitations.map((notice,index)=><p key={index}>{displayDigits(language==='ar'?notice.messageAr:notice.messageEn)}</p>)}</div>}
      <p className="text-xs text-content-secondary">{scopedText(trendScope(data.monthlyTrend,p?.source||'documents'))}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><OpenBalances data={data.receivables} title={t('مستحق للشركة — العملاء','Due to the company — customers')} scope={currentScope} href="/app/invoices"/><OpenBalances data={data.payables} title={t('مستحق على الشركة — الموردون','Due by the company — suppliers')} scope={currentScope} href="/app/purchases/bills"/></div>
      <Panel title={t('تفصيل المقارنة الشهرية والسنوية','Monthly and annual comparison detail')} scope={t('مقارنة مستقلة عن اختيار فترة الحركات','Comparison independent of selected activity period')} testId="comparison-details">{comparisonContent}</Panel>
    </div></details>
  </>;
}
