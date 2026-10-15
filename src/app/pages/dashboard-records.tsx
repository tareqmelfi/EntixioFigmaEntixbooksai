import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, getOrgId } from '../lib/api';
import { useLanguage } from '../components/LanguageContext';
import { dashboardSourceHref, dashboardMetricNames, type DashboardRecords } from '../lib/dashboard-records';
import { displayLocale } from '../lib/number-display';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Button } from '../components/ui/button';

export function DashboardRecordsPage() {
  const {t,language}=useLanguage();
  const [params,setParams]=useSearchParams();
  const query=params.toString(), orgId=getOrgId();
  const [result,setResult]=useState<{key:string;data?:DashboardRecords;error?:boolean}>();
  const [retry,setRetry]=useState(0);
  const key=`${orgId}:${language}:${query}:${retry}`;
  useEffect(()=>{
    let active=true;
    api.dashboard.records(Object.fromEntries(new URLSearchParams(query))).then(data=>{if(active)setResult({key,data});}).catch(()=>{if(active)setResult({key,error:true});});
    return ()=>{active=false};
  },[key,query]);
  const data=result?.key===key?result.data:undefined, error=result?.key===key&&result.error;
  const metric=dashboardMetricNames[params.get('metric')||''];
  const statuses:Record<string,[string,string]>={DRAFT:['مسودة','Draft'],POSTED:['مرحّل','Posted'],RECORDED:['مسجل','Recorded'],APPROVED:['معتمد','Approved'],SENT:['مرسل','Sent'],ISSUED:['صادر','Issued'],PARTIAL:['مسدد جزئيًا','Partially paid'],PAID:['مسدد','Paid'],DUE:['مستحق','Due'],OVERDUE:['متأخر','Overdue'],APPLIED:['مطبق','Applied']};
  const money=(v:number)=>Number(v).toLocaleString(displayLocale(language==='ar'?'ar-SA':'en-US'),{minimumFractionDigits:2,maximumFractionDigits:4});
  const page=(offset:number)=>{const next=new URLSearchParams(params);next.set('offset',String(offset));setParams(next)};
  const basis=params.get('basis');
  return <main className="space-y-5" data-testid="dashboard-records">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><Link to="/app" className="text-xs text-primary">{t('لوحة التحكم','Dashboard')}</Link><h1 className="mt-2 text-2xl font-semibold">{metric?t(...metric):t('تفاصيل المؤشر','Metric details')}</h1><p className="mt-2 text-sm text-content-secondary">{basis==='ledger'?t('سطور القيود المرحّلة','Posted journal lines'):basis==='vouchers'?t('سندات القبض والصرف','Receipt and payment vouchers'):basis==='documents'?t('المستندات المعتمدة المكوّنة للنتيجة','Recorded documents contributing to the result'):t('المستندات المحفوظة','Saved documents')} · <bdi>{params.get('from')||t('من أول حركة','From first activity')} — {params.get('to')}</bdi> · {params.get('currency')}</p>
    <p className="mt-1 text-xs text-content-secondary">{params.get('state')==='draft'?t('المسودات فقط','Drafts only'):params.get('state')==='recorded'?t('دون المسودات','Excluding drafts'):basis==='saved'?t('يشمل المسودات؛ الملغاة مستبعدة','Includes drafts; cancelled documents excluded'):t('المسودات مستبعدة','Drafts excluded')}{params.get('account')&&<> · <bdi>{params.get('account')}</bdi></>}{params.get('exclude')&&<> · {t('الفئات الأخرى','Other categories')}</>}</p></div></header>
    {error?<div role="alert" className="space-y-3"><p>{t('تعذر تحميل التفاصيل. حاول مجددًا؛ لن نعرض قائمة لا تطابق المؤشر.','Could not load details. Please retry; an unrelated list will not be substituted.')}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>{t('إعادة المحاولة','Retry')}</Button></div>:!data?<p role="status">{t('جارٍ تحميل السجلات…','Loading records…')}</p>:<>
      <div className="flex flex-wrap justify-between gap-3 border-y border-foreground py-4"><span>{data.count} {t('سجل','records')}</span><span className={`font-display text-3xl ${data.total<0?'text-danger':'text-primary'}`} data-testid="records-total"><bdi>{money(data.total)} {data.scope.currency}</bdi></span></div>
      <p className="text-xs text-content-secondary">{t('الإجمالي لجميع السجلات المطابقة، وليس لهذه الصفحة فقط. اضغط رقم المستند لفتحه.','Total covers all matching records, not just this page. Select a document number to open it.')} {basis==='ledger'||basis==='documents'?t('المبلغ هو مساهمة السطر في المؤشر، بما فيها التسويات السالبة.','Amount is the row contribution to this metric, including negative adjustments.'):basis==='vouchers'?t('المبالغ المسجلة في السندات.','Amounts recorded on vouchers.'):params.get('measure')==='tax'?t('المبالغ الضريبية.','Tax amounts.'):params.get('measure')==='gross'?t('المبالغ الإجمالية.','Gross amounts.'):t('المبالغ قبل الضريبة؛ القيود تمثل إجمالي المدين.','Amounts exclude tax; journals represent total debits.')}</p>
      <div className="overflow-x-auto"><Table className="w-full text-sm"><TableHeader><TableRow className="border-b border-foreground">{[t('التاريخ','Date'),t('المستند','Document'),t('النوع','Type'),t('الحالة','Status'),t('التفصيل','Detail'),t('المبلغ','Amount')].map(label=><TableHead key={label} className="px-2 py-3 text-start">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map(row=><TableRow key={row.key} className="border-b border-border"><TableCell className="px-2 py-3 whitespace-nowrap"><bdi>{row.date.slice(0,10)}</bdi></TableCell><TableCell className="px-2 py-3">{dashboardSourceHref(row)?<Link className="text-primary underline-offset-4 hover:underline" to={dashboardSourceHref(row)!}><bdi>{row.number}</bdi></Link>:row.number}</TableCell><TableCell className="px-2 py-3">{row.kind==='journal'?t('قيد يومية','Journal entry'):dashboardMetricNames[row.kind]?t(...dashboardMetricNames[row.kind]):row.kind}</TableCell><TableCell className="px-2 py-3">{statuses[row.status]?t(...statuses[row.status]):row.status}</TableCell><TableCell className="max-w-sm break-words px-2 py-3"><bdi>{row.account}</bdi> {row.description}</TableCell><TableCell className={`px-2 py-3 tabular-nums whitespace-nowrap ${Number(row.amount)<0?'text-danger':'text-primary'}`}><bdi>{money(row.amount)} {row.currency}</bdi></TableCell></TableRow>)}</TableBody></Table></div>
      {!data.items.length&&<p>{t('لا توجد سجلات مطابقة ضمن هذه الصفحة.','No matching records on this page.')}</p>}
      <nav className="flex items-center gap-3" aria-label={t('صفحات السجلات','Record pages')}><Button variant="outline" disabled={!data.offset} onClick={()=>page(Math.max(0,data.offset-data.limit))}>{t('السابق','Previous')}</Button><span className="text-xs">{data.count?Math.min(data.offset+1,data.count):0}–{Math.min(data.offset+data.items.length,data.count)} / {data.count}</span><Button variant="outline" disabled={!data.hasMore} onClick={()=>page(data.offset+data.limit)}>{t('التالي','Next')}</Button></nav>
    </>}
  </main>;
}
