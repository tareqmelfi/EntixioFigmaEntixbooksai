import type { ReportPayload, ReportRow } from '../lib/api';
import { reportLabel } from '../lib/report-months';
import { useLanguage } from './LanguageContext';
export function ReportDataTable({report,onRowClick}: {report:ReportPayload;onRowClick:(row:ReportRow)=>void}) {
 const {language,t}=useLanguage();
 return <div className="min-w-0 rounded-lg border border-border bg-card" data-testid="report-data-table">
  <div className="flex flex-wrap justify-between gap-2 border-b px-3 py-2 text-xs"><b>{report.org.name}</b><span>{report.period.from} — {report.period.to} · {report.currency}</span></div>
  {report.notices?.length ? <div className="border-b px-3 py-2 text-xs text-muted-foreground">{report.notices.map(n=>reportLabel(n,language)).join(' · ')}</div>:null}
  <div className="max-h-[72vh] overflow-auto">{report.sections.map(section=><table key={section.id} className="w-full border-collapse text-xs" style={{minWidth:section.columns.length>4?`${320+section.columns.length*105}px`:undefined}}>
   <caption className="bg-muted px-3 py-2 text-start font-bold">{reportLabel(section.title,language)}</caption>
   <thead className="sticky top-0 z-10 bg-card"><tr>{section.columns.map((c,i)=><th key={c.key} className={`border-b px-3 py-2 whitespace-nowrap ${i===0?'sticky start-0 z-20 bg-card text-start min-w-64 max-w-96':'text-end'}`}>{reportLabel(c.label,language)}</th>)}</tr></thead>
   <tbody>{section.rows.map(row=><tr key={row.id} className={`border-b border-border/50 hover:bg-muted/50 ${/summary$/.test(section.id)||/total|net-income/.test(row.id)?'font-semibold':''}`} >{section.columns.map((c,i)=>{
    const v=c.key==='label'?(row.values.label??row.label):row.values[c.key];
    const formatted=typeof v==='number'?v.toLocaleString('en-US',{minimumFractionDigits:c.kind==='money'?2:0,maximumFractionDigits:2}):v==null?'—':reportLabel(String(v),language);
    return <td key={c.key} className={`px-2 py-0.5 leading-5 ${i===0?'sticky start-0 bg-card text-start max-w-96':'text-end whitespace-nowrap tabular-nums'}`} style={i===0?{paddingInlineStart:12+(row.depth||0)*12}:undefined}>
     {i===0 && !/(^|-)total$/.test(row.id)?<button type="button" title={String(formatted)} className="block max-w-full truncate text-start font-medium hover:text-primary hover:underline" onClick={()=>onRowClick(row)}>{formatted}</button>:<bdi dir={typeof v==='number'?'ltr':'auto'}>{formatted}</bdi>}
    </td>;
   })}</tr>)}{!section.rows.length&&<tr><td colSpan={section.columns.length} className="p-3 text-muted-foreground">{t('لا توجد بيانات في الفترة','No records in this period')}</td></tr>}</tbody>
  </table>)}</div>
 </div>;
}
