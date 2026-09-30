import type { ReportPayload } from './api';
import { reportLabel } from './report-months';
const download = (blob: Blob, name: string) => { const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
const filename=(r:ReportPayload)=>`Entix-${r.id}-${r.period.from||'all'}-${r.period.to}`;
export function exportReportCsv(report:ReportPayload,language:string) {
 const rows:unknown[][]=[[report.org.name],[language==='en'?report.englishTitle:report.title],[report.period.from,report.period.to,report.currency],...(report.notices||[]).map(n=>[reportLabel(n,language)])];
 for(const section of report.sections){rows.push([reportLabel(section.title,language)],section.columns.map(c=>reportLabel(c.label,language)));for(const row of section.rows)rows.push(section.columns.map(c=>c.key==='label'?reportLabel(String(row.values.label??row.label??''),language):row.values[c.key]??''));}
 const escape=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return `"${s.replace(/"/g,'""')}"`;};
 download(new Blob(['\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),filename(report)+'.csv');
}
export async function reportWorkbook(report:ReportPayload,language:string) {
 const { default: ExcelJS }=await import('exceljs'); const book=new ExcelJS.Workbook();
 book.creator='Entix';book.created=new Date(report.generatedAt); const sheet=book.addWorksheet(language==='ar'?'التقرير':'Report',{views:[{rightToLeft:language==='ar',state:'frozen',ySplit:6,xSplit:1}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
 const count=Math.max(2,...report.sections.map(s=>s.columns.length));
 const title=(text:string)=>{const row=sheet.addRow([text]);sheet.mergeCells(row.number,1,row.number,count);return row;};
 title(report.org.name).font={name:'Arial',size:13,bold:true,color:{argb:'FF0B1B49'}};
 title(language==='ar'?report.title:report.englishTitle).font={name:'Arial',size:12,bold:true};
 title(`${report.period.from||''} — ${report.period.to} · ${report.currency}`);
 title(report.notices?.map(n=>reportLabel(n,language)).join(' · ')||'');
 sheet.getRow(4).alignment={wrapText:true};sheet.getRow(4).height=30;
 for(const section of report.sections){
  const heading=title(reportLabel(section.title,language)); heading.font={name:'Arial',bold:true,color:{argb:'FF0B1B49'}};heading.height=22;
  const header=sheet.addRow(section.columns.map(c=>reportLabel(c.label,language))); header.font={name:'Arial',bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B1B49'}};header.height=22;
  for(const source of section.rows){const row=sheet.addRow(section.columns.map(c=>c.key==='label'?reportLabel(String(source.values.label??source.label??''),language):source.values[c.key]??null));row.height=Math.max(20,Math.ceil(String(row.getCell(1).value||'').length/48)*14);row.font={name:'Arial',size:10,bold:/summary$/.test(section.id)||/total|net-income/.test(source.id)};row.getCell(1).alignment={wrapText:true,indent:Math.min(source.depth||0,5),readingOrder:language==='ar'?'rtl':'ltr'};
   section.columns.forEach((c,i)=>{const cell=row.getCell(i+1);if(c.kind==='money'||c.kind==='number')cell.numFmt='#,##0.00;[Red](#,##0.00);0.00';cell.border={bottom:{style:'hair',color:{argb:'FFE3E6EB'}}};});
  }
 }
 sheet.getColumn(1).width=48;for(let i=2;i<=count;i++)sheet.getColumn(i).width=17;
 sheet.pageSetup.printTitlesRow='1:4';sheet.pageSetup.printArea=`A1:${sheet.getColumn(count).letter}${sheet.rowCount}`;
 return book;
}
export async function exportReportExcel(report:ReportPayload,language:string){const book=await reportWorkbook(report,language);const bytes=await book.xlsx.writeBuffer();download(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename(report)+'.xlsx');}
