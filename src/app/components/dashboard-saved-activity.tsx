import { useState } from 'react';
import { Link } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from './LanguageContext';
import { displayLocale } from '../lib/number-display';
import type { DashboardSummary } from '../lib/api';

const kinds = [
  ['invoice','فواتير المبيعات','Sales invoices','/app/invoices'],
  ['bill','فواتير المشتريات','Purchase bills','/app/purchases/bills'],
  ['expense','المصروفات','Expenses','/app/expenses'],
  ['credit-note','الإشعارات الدائنة','Credit notes','/app/credit-notes'],
  ['supplier-credit','إشعارات الموردين','Supplier credits','/app/purchases/supplier-credits'],
  ['receipt','سندات القبض','Receipt vouchers','/app/receipts'],
  ['payment','سندات الصرف','Payment vouchers','/app/payments'],
  ['journal','القيود — إجمالي المدين','Journals — total debits','/app/journal-entries'],
] as const;
const fmt = (n:number) => n.toLocaleString(displayLocale('en-US'),{minimumFractionDigits:2,maximumFractionDigits:2});
export function DashboardSavedActivity({data}:{data:DashboardSummary}) {
  const {t}=useLanguage();
  const rows=data.savedActivity!.rows;
  const currencies=[...new Set([data.org.baseCurrency,...rows.map(r=>r.currency)])];
  const [requestedCurrency,setCurrency]=useState(data.org.baseCurrency);
  const currency=currencies.includes(requestedCurrency)?requestedCurrency:data.org.baseCurrency;
  const selected=rows.filter(r=>r.selected&&r.currency===currency);
  const sum=(kind:string,draft?:boolean,key:'net'|'tax'|'gross'|'count'='net')=>selected.filter(r=>r.kind===kind&&(draft===undefined||r.draft===draft)).reduce((n,r)=>n+r[key],0);
  const months=data.monthlyTrend.map(r=>({month:(r.fromDate||r.from||'').slice(0,7),invoice:0,bill:0,expense:0}));
  for(const r of rows.filter(r=>r.trend&&r.currency===currency)) {
    const month=months.find(m=>m.month===r.month);
    if(month&&(r.kind==='invoice'||r.kind==='bill'||r.kind==='expense')) month[r.kind]+=r.net;
  }
  return <section data-testid="saved-activity" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">{t('حركة المستندات المحفوظة','Saved document activity')}</h2><p className="text-xs text-content-secondary mt-1">{t('تشمل المسودات فور الحفظ، حسب تاريخ المستند. المبالغ قبل الضريبة؛ الملغاة مستبعدة.','Includes drafts on save, by document date. Amounts exclude tax; cancelled documents excluded.')}</p></div>
      <label className="text-xs">{t('العملة','Currency')} <select aria-label={t('عملة الحركة','Activity currency')} className="rounded-full border border-border bg-card px-3 py-1" value={currency} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">{kinds.slice(0,3).map(([kind,ar,en,href])=><div key={kind} data-testid={`saved-${kind}`} className="rounded-xl border border-border bg-card p-4"><Link to={href} className="text-sm font-semibold">{t(ar,en)}</Link><p className="text-3xl font-display tabular-nums my-3"><bdi>{fmt(sum(kind))} <small className="text-xs">{currency}</small></bdi></p><p className="text-xs text-content-secondary">{sum(kind,undefined,'count')} {t('مستند · منها مسودات:','documents · drafts:')} <bdi>{fmt(sum(kind,true))}</bdi> ({sum(kind,true,'count')})</p></div>)}</div>
    <div className="rounded-xl border border-border bg-card p-4" data-testid="saved-monthly"><h3 className="text-sm font-semibold">{t('المبيعات والمشتريات والمصروفات · آخر 12 شهرًا','Sales, purchases and expenses · last 12 months')}</h3><p className="text-xs text-content-secondary my-2">{t('تشمل المسودات · كل مستند مرة واحدة · ليست قائمة أرباح وخسائر','Includes drafts · each document once · not a profit and loss statement')} · {currency}</p><div dir="ltr" className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={months}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} width={65}/><Tooltip formatter={(v:unknown)=>`${fmt(Number(v))} ${currency}`}/><Legend wrapperStyle={{fontSize:11}}/>{kinds.slice(0,3).map(([kind,ar,en],i)=><Bar key={kind} dataKey={kind} name={t(ar,en)} fill={['var(--chart-1)','var(--chart-2)','var(--chart-5)'][i]} maxBarSize={28}/>)}</BarChart></ResponsiveContainer></div></div>
    <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto"><table className="w-full min-w-[670px] text-xs" data-testid="saved-register"><caption className="text-start font-semibold pb-3">{t('كل المستندات · الفترة المختارة','All documents · selected period')} · {currency}</caption><thead><tr className="border-b border-border">{[t('النوع','Type'),t('العدد','Count'),t('قبل الضريبة','Before tax'),t('الضريبة','Tax'),t('الإجمالي','Total'),t('المسودات (ضمن الإجمالي)','Drafts (included)')].map(h=><th key={h} className="py-2 px-2 text-start">{h}</th>)}</tr></thead><tbody>{kinds.map(([kind,ar,en,href])=><tr key={kind} data-testid={`saved-row-${kind}`} className="border-b border-border"><th className="py-2 px-2 text-start font-normal"><Link className="text-primary" to={href}>{t(ar,en)}</Link></th><td className="px-2">{sum(kind,undefined,'count')}</td>{(['net','tax','gross'] as const).map(key=><td className="px-2 tabular-nums" key={key}><bdi>{fmt(sum(kind,undefined,key))}</bdi></td>)}<td className="px-2 tabular-nums"><bdi>{fmt(sum(kind,true,'gross'))}</bdi> ({sum(kind,true,'count')})</td></tr>)}</tbody></table><p className="mt-3 text-xs text-content-secondary">{t('الإشعارات والقبض والصرف والقيود معروضة مستقلة، ولا تضاف إلى المبيعات أو المشتريات أعلاه. راجع الدفاتر المعتمدة للأرباح والقوائم المالية.','Credits, receipts, payments and journals are shown separately and are not added to sales or purchases above. See posted books for profit and financial statements.')}</p></div>
  </section>;
}
