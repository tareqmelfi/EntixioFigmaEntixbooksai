import type { ReportPayload, ReportPrintSettings } from './api';
import { reportLabel } from './report-months';
import { workbookLogo } from './report-logo';
const download = (blob: Blob, name: string) => { const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
const filename=(r:ReportPayload)=>`Entix-${r.id}-${r.period.from||'all'}-${r.period.to}`;
export function exportReportCsv(report:ReportPayload,language:string) {
 const rows:unknown[][]=[[report.org.name],[language==='en'?report.englishTitle:report.title],[report.period.from,report.period.to,report.currency],...(report.notices||[]).map(n=>[reportLabel(n,language)])];
 for(const section of report.sections){rows.push([reportLabel(section.title,language)],section.columns.map(c=>reportLabel(c.label,language)));for(const row of section.rows)rows.push(section.columns.map(c=>{const value=c.key==='label'?row.values.label??row.label??'':row.values[c.key]??'';return typeof value==='string'?reportLabel(value,language):value;}));}
 const escape=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return `"${s.replace(/"/g,'""')}"`;};
 download(new Blob(['\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),filename(report)+'.csv');
}
export async function reportWorkbook(report:ReportPayload,language:string, options: { settings?: ReportPrintSettings; logo?: {base64:string;width:number;height:number} } = {}) {
 const { default: ExcelJS }=await import('exceljs'); const book=new ExcelJS.Workbook();
 book.creator='Entix';book.created=new Date(report.generatedAt); const sheet=book.addWorksheet(language==='ar'?'التقرير':'Report',{views:[{rightToLeft:language==='ar',state:'frozen',ySplit:6,xSplit:1}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
 const count=Math.max(2,...report.sections.map(s=>s.columns.length));
 const logoRow=options.logo&&count<4?1:0;
 const primary=/^#[0-9a-f]{6}$/i.test(options.settings?.primaryColor||'')?'FF'+options.settings!.primaryColor!.slice(1).toUpperCase():'FF0B1B49';
 if(logoRow)sheet.addRow([]).height=42;
 const title=(text:string)=>{const row=sheet.addRow([]);const start=options.logo && count>=4 && row.number<=2?2:1;row.getCell(start).value=text;sheet.mergeCells(row.number,start,row.number,count);return row;};
 title(report.org.name).font={name:'Arial',size:13,bold:true,color:{argb:primary}};
 title(language==='ar'?report.title:report.englishTitle).font={name:'Arial',size:12,bold:true};
 title(`${report.period.from||''} — ${report.period.to} · ${report.currency}`);
 title(report.notices?.map(n=>reportLabel(n,language)).join(' · ')||'');
 sheet.getRow(4+logoRow).alignment={wrapText:true};sheet.getRow(4+logoRow).height=report.notices?.length?30:8;
 if(options.logo){
  const id=book.addImage({base64:options.logo.base64,extension:'png'});
  // Wide reports reserve the first header column; narrow reports place branding above the title.
  if(count>=4){sheet.getRow(1).height=26;sheet.getRow(2).height=26;}
  sheet.addImage(id,{tl:{col:0.1,row:0.1},ext:{width:options.logo.width,height:options.logo.height}});
 }
 for(const section of report.sections){
  const heading=title(reportLabel(section.title,language)); heading.font={name:'Arial',bold:true,color:{argb:primary}};heading.height=22;
  const header=sheet.addRow(section.columns.map(c=>reportLabel(c.label,language))); header.font={name:'Arial',bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:primary}};header.height=22;
  for(const source of section.rows){const row=sheet.addRow(section.columns.map(c=>{const value=c.key==='label'?source.values.label??source.label??'':source.values[c.key]??null;return typeof value==='string'?reportLabel(value,language):value;}));row.height=Math.max(options.settings?.density==='comfortable'?25:18,Math.ceil(String(row.getCell(1).value||'').length/48)*14);row.font={name:'Arial',size:10,bold:/summary$/.test(section.id)||/total|net-income/.test(source.id)};row.getCell(1).alignment={wrapText:true,indent:Math.min(source.depth||0,5),readingOrder:language==='ar'?'rtl':'ltr'};
   section.columns.forEach((c,i)=>{const cell=row.getCell(i+1);if(c.kind==='money'||c.kind==='number')cell.numFmt='#,##0.00;[Red](#,##0.00);0.00';cell.border={bottom:{style:'hair',color:{argb:'FFE3E6EB'}}};});
  }
 }
 sheet.getColumn(1).width=48;for(let i=2;i<=count;i++)sheet.getColumn(i).width=17;
 const firstHeader=options.logo&&count<4?7:6;
 sheet.views=[{rightToLeft:language==='ar',state:'frozen',ySplit:firstHeader,xSplit:1}];
 sheet.pageSetup.printTitlesRow=report.sections.length===1?`1:${firstHeader}`:`1:${4+logoRow}`;
 sheet.pageSetup.margins={left:0.25,right:0.25,top:0.35,bottom:0.4,header:0.15,footer:0.2};
 sheet.headerFooter.oddFooter=`&L${report.org.name.replace(/&/g,'&&')}&R${language==='ar'?'صفحة':'Page'} &P / &N`;
 if(report.sections.length===1&&report.sections[0].rows.length)sheet.autoFilter={from:{row:firstHeader,column:1},to:{row:sheet.rowCount-(report.sections[0].rows[report.sections[0].rows.length-1]?.id.endsWith('-total')?1:0),column:count}};
 if(options.settings?.preparedBy)sheet.addRow([`${language==='ar'?'أعد بواسطة':'Prepared by'}: ${options.settings.preparedBy}`]);
 if(options.settings?.footerNote){const note=title(options.settings.footerNote);note.alignment={wrapText:true};note.height=30;}
 sheet.pageSetup.printArea=`A1:${sheet.getColumn(count).letter}${sheet.rowCount}`;
 return book;
}
export async function exportReportExcel(report:ReportPayload,language:string,settings:ReportPrintSettings=report.org.paymentSettings?.reports||{}){
 const url=settings.logoSource==='none'?null:settings.logoSource==='main'?report.org.logoUrl:report.org.printLogoUrl||report.org.logoUrl;
 const logo=url?await workbookLogo(url):undefined;
 const book=await reportWorkbook(report,language,{settings,logo});const bytes=await book.xlsx.writeBuffer();download(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename(report)+'.xlsx');
}
