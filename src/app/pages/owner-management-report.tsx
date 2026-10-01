import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type ReportPayload, type ReportPrintSettings } from '../lib/api';
import { readTabOrgId } from '../lib/tab-org-selection';
import { useLanguage } from '../components/LanguageContext';
import { Button } from '../components/ui/button';
import { DateInput } from '../components/date-input';
import { PageHeader } from '../components/product';
import { ReportBookOutput } from '../components/report-book-output';
import { OwnerReportChapter } from '../components/owner-report-chapter';
import { accountGroups, availableAccounts, breakEven, chapterDefinitions, dayBefore, emptyScenario, mappingError, metricDefinitions, metrics, one, ownerChapters, shiftYear, type AccountMapping, type FinancialPeriod, type OwnerAnalysis, type OwnerOptions, type OwnerVisual } from '../lib/owner-report';
import { exportReportExcel } from '../lib/report-export';

type Snapshot = { orgId: string; periods: FinancialPeriod[]; cash: ReportPayload; trial: ReportPayload };
const mappingKey=(orgId:string)=>`entix-owner-report-mapping-v1:${orgId}`;
function readMapping(orgId:string):AccountMapping { try { const raw=JSON.parse(localStorage.getItem(mappingKey(orgId))||'{}');return Object.fromEntries(accountGroups.filter(([id])=>Array.isArray(raw[id])&&raw[id].every((s:unknown)=>typeof s==='string')).map(([id])=>[id,raw[id]])); } catch {return {};} }
export function OwnerManagementReport() {
  const {t,language}=useLanguage();
  const [from,setFrom]=useState(`${new Date().getFullYear()}-01-01`),[to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [kind,setKind]=useState('general'),[years,setYears]=useState(3),[title,setTitle]=useState(''),[preparedBy,setPreparedBy]=useState('');
  const [selected,setSelected]=useState<OwnerVisual[]>(chapterDefinitions.map(([id])=>id));
  const [appendices,setAppendices]=useState(true);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[options,setOptions]=useState<OwnerOptions>({mapping:{},scenario:emptyScenario,notes:'',unitName:'',units:''});
  const [edition,setEdition]=useState<{analysis:OwnerAnalysis;title:string;preparedBy:string;selected:OwnerVisual[];appendices:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saveMessage,setSaveMessage]=useState('');
  const revision=useRef(0);
  const invalidate=()=>{revision.current++;setEdition(null);setError('');setBusy(false);setSnapshot(null);};
  async function load() {
    const scope=readTabOrgId(), version=++revision.current;setError('');setEdition(null);setSnapshot(null);setSaveMessage('');
    const days=(Date.parse(to)-Date.parse(from))/86400000;
    if(!scope||!Number.isFinite(days)||days<0||days>366||!from||!to){setError(t('اختر الشركة وفترة صحيحة لا تتجاوز سنة واحدة. المقارنات تضيف السنوات السابقة.', 'Choose a company and a valid period up to one year. Comparisons add prior years.'));return;}
    setBusy(true);
    try {
      const get=async(id:string,start:string,end:string)=>{const r=await api.reports.get(id,{from:start,to:end,bilingual:1},scope);if(r.org.id!==scope||r.id!==id||r.period.to!==end||(id==='income-statement'&&r.period.from!==start))throw new Error('scope_or_period_mismatch');return r;};
      const periods:FinancialPeriod[]=[];
      // Bound concurrency to three report reads. Never mix currencies or scopes.
      for(let i=0;i<years;i++){
        if(version!==revision.current||scope!==readTabOrgId())return;
        const start=shiftYear(from,-i),end=shiftYear(to,-i);
        const [income,balance,opening]=await Promise.all([get('income-statement',start,end),get('balance-sheet',start,end),get('balance-sheet',dayBefore(start),dayBefore(start))]);
        periods.push({income,balance,opening});
      }
      const [cash,trial]=await Promise.all([get('cash-flow',from,to),get('trial-balance',from,to)]);
      const reports=[...periods.flatMap(p=>[p.income,p.balance,p.opening]),cash,trial];
      if(reports.some(r=>r.currency!==periods[0].income.currency))throw new Error('currency_mismatch');
      if(version!==revision.current)return;
      if(scope!==readTabOrgId())throw new Error('scope_changed');
      setOptions(old=>({...old,mapping:readMapping(scope)}));
      setSnapshot({orgId:scope,periods,cash,trial});
    }catch{if(version===revision.current)setError(t('تعذر تحميل المجموعة كاملة للشركة والفترة. أعد المحاولة؛ لن يصدر تقرير من بيانات مختلطة أو ناقصة التحميل.', 'The complete company/period dataset could not load. Retry; no mixed or partially loaded report will be exported.'));}
    finally{if(version===revision.current)setBusy(false);}
  }
  function prepare(){
    setError('');setEdition(null);
    if(!snapshot||snapshot.orgId!==readTabOrgId()){setError(t('تغيّرت الشركة. أعد قراءة البيانات.', 'Company changed. Reload data.'));return;}
    if(!selected.length&&!appendices){setError(t('اختر فصلًا واحدًا على الأقل.', 'Select at least one chapter.'));return;}
    const problem=mappingError(options.mapping);
    if(problem){setError(one(problem,language));return;}
    for(const [key,,,type] of accountGroups){if(options.mapping[key]?.some(id=>!availableAccounts(snapshot.periods,type).some(r=>r.id===id))){setError(t('توجد حسابات محفوظة لم تظهر في بيانات الفترة. راجع تصنيف الحسابات واحفظه من جديد.', 'Some saved accounts are absent from this dataset. Review and save the account mapping again.'));return;}}
    const values=snapshot.periods.map(p=>metrics(p,options.mapping));
    const scenario=breakEven(options.scenario,values[0].revenue);
    if(Object.values(options.scenario).some(v=>v.trim())&&!scenario){setError(t('أكمل افتراضات التعادل: تكلفة ثابتة غير سالبة، تكلفة متغيرة من 0 إلى أقل من 100%، ربح مستهدف غير سالب، ومصدر الافتراضات.', 'Complete break-even assumptions: nonnegative fixed costs, variable costs from 0 to below 100%, nonnegative target profit, and an assumption source.'));return;}
    if(options.units.trim()&&(!options.unitName.trim()||!Number.isFinite(Number(options.units))||Number(options.units)<=0)){setError(t('اكتب اسم الوحدة وعددًا موجبًا.', 'Enter a unit label and a positive count.'));return;}
    setEdition({analysis:{periods:snapshot.periods,metrics:values,options,cash:snapshot.cash,breakEven:scenario},title:title.trim()||t(kind==='annual'?'التقرير السنوي للإدارة':'وضع الشركة المالي',kind==='annual'?'Annual management review':'Financial position of the company'),preparedBy,selected,appendices});
  }
  const modify=(patch:Partial<OwnerOptions>)=>{setEdition(null);setOptions(old=>({...old,...patch}));setSaveMessage('');setError('');};
  const control='block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';
  return <div className="space-y-5">
    <PageHeader eyebrow={<Link to="/app/reports">{t('التقارير','Reports')}</Link>} title={t('وضع الشركة المالي · التقرير البصري','Owner financial review · Visual report')} description={t('الأرقام والرسوم والمقارنات ونقطة التعادل، ثم القوائم كاملة بهوية الشركة.','Numbers, charts, comparisons and break-even, followed by complete company-branded statements.')}/>
    <form className="rounded-xl border border-border bg-card p-5 space-y-4" onSubmit={e=>{e.preventDefault();void load();}}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">{t('نوع التقرير','Report type')}<select className={control} value={kind} onChange={e=>{invalidate();setKind(e.target.value);if(e.target.value==='annual'){const year=Number(to.slice(0,4))-1;setFrom(`${year}-01-01`);setTo(`${year}-12-31`);}}}><option value="general">{t('عام · فترة مخصصة','General · custom period')}</option><option value="annual">{t('سنوي','Annual')}</option></select></label>
        <label className="text-sm">{t('من تاريخ','From date')}<DateInput value={from} onChange={v=>{invalidate();setFrom(v);setKind('general');}}/></label>
        <label className="text-sm">{t('إلى تاريخ','To date')}<DateInput value={to} onChange={v=>{invalidate();setTo(v);setKind('general');}}/></label>
        <label className="text-sm">{t('عدد الفترات المناظرة','Comparable periods')}<select className={control} value={years} onChange={e=>{invalidate();setYears(Number(e.target.value));}}>{[2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      </div>
      <Button type="submit" disabled={busy}>{busy?t('قراءة القوائم والمقارنات…','Reading statements and comparisons…'):t('قراءة بيانات الشركة','Load company data')}</Button>
    </form>
    {snapshot&&<div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold">{snapshot.periods[0].income.org.name} · {snapshot.periods[0].income.currency} · {from} — {to}</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t('عنوان التقرير','Report title')}<input className={control} maxLength={120} value={title} onChange={e=>{setEdition(null);setTitle(e.target.value);}}/></label><label className="text-sm">{t('إعداد','Prepared by')}<input className={control} maxLength={100} value={preparedBy} onChange={e=>{setEdition(null);setPreparedBy(e.target.value);}}/></label></div>
      <fieldset><legend className="text-sm font-semibold mb-2">{t('فصول التقرير','Report chapters')}</legend><div className="flex flex-wrap gap-4">{chapterDefinitions.map(([id,ar,en])=><label className="text-xs flex gap-2" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>{setEdition(null);setSelected(old=>e.target.checked?[...old,id]:old.filter(v=>v!==id));}}/>{t(ar,en)}</label>)}<label className="text-xs flex gap-2"><input type="checkbox" checked={appendices} onChange={e=>{setEdition(null);setAppendices(e.target.checked);}}/>{t('إرفاق القوائم الكاملة','Append complete statements')}</label></div></fieldset>
      <details className="rounded-lg border border-border p-3"><summary className="text-sm font-semibold cursor-pointer">{t('حسابات المؤشرات · اضبطها مرة لكل شركة','Indicator accounts · configure once per company')}</summary>
        <p className="my-3 text-xs text-muted-foreground">{t('التصنيف خاص بتحليل التقرير ولا يعدل شجرة الحسابات. أكد المجموعات غير الموجودة بدل تركها غير محددة.','These classifications only affect the report; they do not modify the ledger. Confirm empty groups explicitly instead of leaving them unconfigured.')}</p>
        <div className="grid gap-3 md:grid-cols-2">{accountGroups.map(([key,ar,en,type])=><fieldset key={key} className="border border-border rounded-lg p-3"><legend className="text-sm">{t(ar,en)}</legend><label className="text-xs flex gap-2"><input type="checkbox" checked={options.mapping[key]!==undefined} onChange={e=>{const mapping={...options.mapping};if(e.target.checked)mapping[key]=[];else delete mapping[key];modify({mapping});}}/>{t('تأكيد هذه المجموعة (يمكن تأكيد عدم وجود حسابات)','Confirm this group (can confirm no accounts)')}</label><div className="max-h-36 overflow-y-auto mt-2 space-y-1">{availableAccounts(snapshot.periods,type).map(row=><label key={row.id} className="text-xs flex gap-2 items-start"><input type="checkbox" disabled={options.mapping[key]===undefined} checked={options.mapping[key]?.includes(row.id)||false} onChange={e=>modify({mapping:{...options.mapping,[key]:e.target.checked?[...(options.mapping[key]||[]),row.id]:(options.mapping[key]||[]).filter(id=>id!==row.id)}})}/>{one(row.label,language)}</label>)}</div></fieldset>)}</div>
        <Button className="mt-3" variant="outline" onClick={()=>{const problem=mappingError(options.mapping);if(problem){setError(one(problem,language));return;}if(readTabOrgId()!==snapshot.orgId){setError(t('تغيّرت الشركة. أعد القراءة.','Company changed. Reload data.'));return;}try{localStorage.setItem(mappingKey(snapshot.orgId),JSON.stringify(options.mapping));setSaveMessage(t('حُفظ التصنيف لهذه الشركة على هذا المتصفح.','Mapping saved for this company on this browser.'));}catch{setError(t('تعذر حفظ التصنيف في المتصفح.','Could not save mapping in this browser.'));}}}>{t('حفظ تصنيف الشركة','Save company mapping')}</Button>{saveMessage&&<p role="status" className="text-xs mt-2">{saveMessage}</p>}
      </details>
      <details className="rounded-lg border border-border p-3"><summary className="text-sm font-semibold cursor-pointer">{t('افتراضات نقطة التعادل والمؤشرات التشغيلية','Break-even assumptions and operating metrics')}</summary><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
        {([['fixedCosts','التكلفة الثابتة للفترة','Period fixed costs'],['variablePercent','التكلفة المتغيرة % من الإيراد','Variable cost % of revenue'],['targetProfit','الربح المستهدف للفترة','Period target profit']] as const).map(([key,ar,en])=><label key={key} className="text-xs">{t(ar,en)}<input className={control} type="number" min="0" step="any" value={options.scenario[key]} onChange={e=>modify({scenario:{...options.scenario,[key]:e.target.value}})}/></label>)}
        <label className="text-xs sm:col-span-2 lg:col-span-3">{t('مصدر الافتراضات / مبررها','Assumption source / rationale')}<input className={control} maxLength={400} value={options.scenario.source} onChange={e=>modify({scenario:{...options.scenario,source:e.target.value}})}/></label>
        <label className="text-xs">{t('اسم الوحدة التشغيلية (اختياري)','Operating unit label (optional)')}<input className={control} maxLength={60} placeholder={t('مثل: موظف، فرع، سيارة','e.g. employee, branch, vehicle')} value={options.unitName} onChange={e=>modify({unitName:e.target.value})}/></label>
        <label className="text-xs">{t('عدد الوحدات المدخل يدويًا','Author-entered unit count')}<input className={control} type="number" min="0" step="any" value={options.units} onChange={e=>modify({units:e.target.value})}/></label>
      </div></details>
      <label className="block text-sm">{t('تفسير الإدارة والتوصيات','Management interpretation and recommendations')}<textarea className={control} rows={3} maxLength={6000} value={options.notes} onChange={e=>modify({notes:e.target.value})}/></label>
      <Button onClick={prepare}>{t('تجهيز التقرير البصري','Prepare visual report')}</Button>
    </div>}
    {error&&<p role="alert" className="text-danger">{error}</p>}
    {edition&&<OwnerEdition edition={edition} snapshot={snapshot!}/>}
  </div>;
}
function OwnerEdition({edition,snapshot}:{edition:{analysis:OwnerAnalysis;title:string;preparedBy:string;selected:OwnerVisual[];appendices:boolean};snapshot:Snapshot}){
  const {t,language}=useLanguage();const [error,setError]=useState('');
  const reports=useMemo(()=>[...ownerChapters(edition.analysis,edition.selected),...(edition.appendices?[snapshot.periods[0].income,snapshot.periods[0].balance,snapshot.cash,snapshot.trial]:[])],[edition,snapshot]);
  const render=useCallback((report:ReportPayload,settings:ReportPrintSettings)=>report.id.startsWith('owner-')?<OwnerReportChapter report={report} settings={settings} analysis={edition.analysis}/>:null,[edition.analysis]);
  async function excel(){
    if(readTabOrgId()!==snapshot.orgId){setError(t('تغيّرت الشركة. أعد قراءة البيانات.','Company changed. Reload data.'));return;}
    const base=snapshot.periods[0].income;
    const report:ReportPayload={...base,id:'owner-indicators',title:'مؤشرات التقرير الإداري',englishTitle:'Management report indicators',sections:[{id:'metrics',title:t('مقارنة المؤشرات','Metric comparison'),columns:[{key:'label',label:t('المؤشر','Metric')},...edition.analysis.periods.map((p,i)=>({key:String(i),label:`${p.income.period.from} — ${p.income.period.to}`,kind:'number' as const})),{key:'unit',label:t('الوحدة','Unit')},{key:'formula',label:t('المعادلة','Formula')}],rows:metricDefinitions.map(m=>({id:m.key,label:one(m.label,language),values:{label:one(m.label,language),...Object.fromEntries(edition.analysis.metrics.map((p,i)=>[String(i),p[m.key]])),unit:m.unit==='money'?base.currency:m.unit==='percent'?'%':m.unit==='times'?'×':t('أيام','days'),formula:one(m.formula,language)}}))}]};
    try{await exportReportExcel(report,language);}catch{setError(t('تعذر تصدير Excel.','Excel export failed.'));}
  }
  return <><Button variant="outline" onClick={()=>void excel()}>{t('Excel · المؤشرات والمقارنة','Excel · indicators and comparison')}</Button>{error&&<p role="alert">{error}</p>}<ReportBookOutput reports={reports} title={edition.title} preparedBy={edition.preparedBy} notes="" renderChapter={render} initialSettings={{orientation:'portrait',density:'compact',fontFamily:'plex',showNotes:true,showCover:true,showBackCover:true,showEquation:true}}/></>;
}
