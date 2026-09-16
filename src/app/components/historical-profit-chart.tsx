import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { HistoricalReportRecord } from '../lib/api';
import { displayDigits, displayLocale } from '../lib/number-display';
import { useLanguage } from './LanguageContext';

const amount = (value:number) => value.toLocaleString(displayLocale('en-US'),{minimumFractionDigits:2,maximumFractionDigits:2});
export function historicalProfitRows(record?:HistoricalReportRecord|null) {
  return (record?.payload.periods||[]).map(period=>({
    id:period.id,
    label:period.startDate.slice(0,4)===period.endDate.slice(0,4)?period.endDate.slice(0,4):`${period.startDate.slice(0,4)}–${period.endDate.slice(0,4)}`,
    from:period.startDate,to:period.endDate,
    revenue:period.metrics.revenue.status==='verified'?period.metrics.revenue.value:null,
    net:period.metrics.netProfit.status==='verified'?period.metrics.netProfit.value:null,
    revenueStatus:period.metrics.revenue.status,netStatus:period.metrics.netProfit.status,
    revenuePage:period.metrics.revenue.pdfPage,netPage:period.metrics.netProfit.pdfPage,
  })).sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to));
}
export function HistoricalProfitChart({record,loading,error,onOpen}: {record?:HistoricalReportRecord|null;loading?:boolean;error?:boolean;onOpen:()=>void}) {
  const {t}=useLanguage();
  const rows=historicalProfitRows(record);
  const plotted=rows.filter(row=>row.revenue!==null||row.net!==null);
  const missing=rows.filter(row=>row.revenue===null&&row.net===null);
  const currency=record?.payload.entity.currency||'';
  const displayValue=(value:number|null,status:string)=>value!==null?amount(value):status==='needs_review'?t('يحتاج مراجعة','Needs review'):t('غير متوفر','Unavailable');
  return <div data-testid="historical-profit-chart" className="space-y-2">
    {loading?<p className="py-8 text-center text-xs text-content-secondary">{t('جارٍ تحميل القوائم السابقة...','Loading prior statements...')}</p>:error?<p role="alert" className="py-8 text-center text-xs text-warning">{t('تعذر تحميل المرجع المحفوظ.','Could not load the saved reference.')}</p>:!record?<p className="py-8 text-center text-xs text-content-secondary">{t('لا توجد قوائم سابقة محفوظة لهذه الشركة.','No prior statements have been saved for this company.')}</p>:<>
      {plotted.length>0&&<div dir="ltr" className="h-[120px] md:h-[150px] xl:h-[190px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={plotted} margin={{top:6,right:0,left:0,bottom:0}} barGap={4} barCategoryGap="26%"><CartesianGrid stroke="var(--surface-hover)" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}} tickLine={false} axisLine={{stroke:'var(--border)'}}/><Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}} formatter={(value:unknown)=>`${amount(Number(value))} ${currency}`} labelFormatter={(_label,payload)=>{const row=payload?.[0]?.payload;return row?`${row.from} → ${row.to}`:'';}}/><Bar dataKey="revenue" name={t('الإيرادات','Revenue')} fill="var(--chart-5)" radius={[4,4,0,0]} maxBarSize={42} isAnimationActive={false}/><Bar dataKey="net" name={t('صافي الربح / الخسارة','Net profit / loss')} fill="var(--chart-1)" radius={[4,4,0,0]} maxBarSize={42} isAnimationActive={false}>{plotted.map(row=><Cell key={row.id} fill={row.net!==null&&row.net<0?'var(--danger)':'var(--chart-1)'}/>)}</Bar></BarChart></ResponsiveContainer></div>}
      <div className="overflow-x-auto"><table className="w-full text-[11px]" data-testid="historical-profit-values"><thead><tr className="border-b border-border text-content-secondary"><th className="py-1 text-start font-normal">{t('الفترة الفعلية','Actual period')}</th><th className="px-2 text-end font-normal">{t('الإيرادات','Revenue')}</th><th className="text-end font-normal">{t('صافي الربح / الخسارة','Net profit / loss')}</th></tr></thead><tbody>{plotted.map(row=><tr key={row.id} className="border-b border-border"><td className="py-1 text-start"><bdi>{row.from} — {row.to}</bdi></td><td className="px-2 text-end tabular-nums">{displayValue(row.revenue,row.revenueStatus)}</td><td className="text-end tabular-nums">{displayValue(row.net,row.netStatus)}</td></tr>)}</tbody></table></div>
      {missing.length>0&&<p className="text-[11px] text-content-secondary">{missing.map(row=>`${displayDigits(row.label)}: ${row.revenueStatus==='needs_review'||row.netStatus==='needs_review'?t('يحتاج مراجعة','Needs review'):t('غير متوفر','Unavailable')}`).join(' · ')}</p>}
      <p className="text-[11px] text-content-secondary">{currency} · {t('فترات القوائم كما وردت في المصدر؛ دون تقسيم سنوي أو نسب نمو.','Statement periods as reported; no annual splitting or growth rates.')}</p>
    </>}
    <button className="text-xs font-semibold text-primary hover:underline" onClick={onOpen}>{t('عرض القوائم ومصدر الأرقام','View statements and source')}</button>
  </div>;
}
