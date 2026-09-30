import { useState } from 'react';
import { PostingReview } from './posting-review';
import { Button } from './ui/button';
import { Link } from 'react-router';
import { useLanguage } from './LanguageContext';
import { displayLocale } from '../lib/number-display';

export interface PostingCoverage {
  basis: 'document_journal_links';
  status: 'needs_review' | 'no_missing_links';
  unlinkedCount: number;
  groups: Array<{kind:string;currency:string;count:number;net:number;tax:number;gross:number;draftCount:number;draftGross:number;unlinkedCount:number;unlinkedGross:number}>;
}

export function DashboardPostingCoverage({coverage,from,to,onPosted}: {coverage?:PostingCoverage;source?:string;from?:string|null;to?:string;onPosted?:()=>void}) {
  const {t}=useLanguage();
  const [review,setReview]=useState(false);
  if (!coverage) return null;
  const labels:Record<string,[string,string,string]>={
    invoice:['فواتير المبيعات','Sales invoices','/app/invoices'],
    bill:['فواتير المشتريات','Purchase bills','/app/purchases/bills'],
    expense:['المصروفات','Expenses','/app/expenses'],
    receipt:['سندات القبض','Receipt vouchers','/app/receipts'],
    payment:['سندات الصرف','Payment vouchers','/app/payments'],
    'credit-note':['الإشعارات الدائنة','Credit notes','/app/credit-notes'],
  };
  const amount=(value:number)=>value.toLocaleString(displayLocale('en-US'),{minimumFractionDigits:2,maximumFractionDigits:2});
  return <section data-testid="dashboard-posting-coverage" className="min-w-0 rounded-lg border border-border bg-card p-4">
    {coverage.unlinkedCount>0 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p role="status">{coverage.unlinkedCount} {t('مستندًا يحتاج استكمال قيده؛ الأرباح تعرض القيود المرحلة فقط.','documents need journal completion; profit includes posted journals only.')}</p>
      <Button size="sm" onClick={()=>setReview(v=>!v)}>{review?t('إغلاق المراجعة','Close review'):t('مراجعة واعتماد','Review and approve')}</Button>
    </div>}
    {review&&<PostingReview from={from} to={to} onPosted={onPosted}/>}
    <details className="mt-2"><summary className="cursor-pointer text-xs text-content-secondary">{t('تفاصيل المستندات والمسودات','Document and draft totals')}</summary>
    <h2 className="text-sm font-semibold">{t('المستندات المسجلة · الفترة المختارة','Recorded documents · selected period')}</h2>
    <p className="mt-1 text-xs text-content-secondary">{t('مجاميع تشغيلية حسب العملة، وليست صافي ربح. المسودات منفصلة وغير محتسبة. وجود رابط قيد لا يثبت اكتمال المطابقة.','Operational totals by currency, not net profit. Drafts are separate and excluded. A journal link alone does not certify reconciliation.')}</p>
    {!coverage.groups.length ? <p className="mt-3 text-xs">{t('لا توجد مستندات في الفترة المختارة.','No documents in the selected period.')}</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-xs">
      <thead><tr className="border-b border-border">{[t('النوع','Type'),t('العملة','Currency'),t('معتمدة','Approved'),t('قبل الضريبة','Before tax'),t('الضريبة','Tax'),t('الإجمالي المعتمد','Approved total'),t('بلا قيد مرتبط','No linked journal'),t('مسودات غير محتسبة','Excluded drafts')].map(label=><th key={label} className="px-2 py-2 text-start font-medium">{label}</th>)}</tr></thead>
      <tbody>{coverage.groups.map(row=>{const label=labels[row.kind];return <tr key={`${row.kind}-${row.currency}`} className="border-b border-border last:border-0">
        <td className="px-2 py-2 font-medium">{label?<Link className="text-primary underline" to={label[2]}>{t(label[0],label[1])}</Link>:row.kind}</td>
        <td className="px-2 py-2">{row.currency}</td><td className="px-2 py-2">{row.count}</td>
        {[row.net,row.tax,row.gross].map((value,index)=><td key={index} className="px-2 py-2 tabular-nums"><bdi>{amount(value)}</bdi></td>)}
        <td className={`px-2 py-2 ${row.unlinkedCount?'font-semibold text-warning':''}`}>{row.unlinkedCount}</td>
        <td className="px-2 py-2 text-content-secondary">{row.draftCount}{row.draftCount>0&&<> · <bdi>{amount(row.draftGross)} {row.currency}</bdi></>}</td>
      </tr>})}</tbody>
    </table></div>}
    </details>
  </section>;
}
