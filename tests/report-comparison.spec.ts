import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { compareReport, comparisonPeriod, comparisonTone, comparisonMode } from '../src/app/lib/report-comparison';
import { reportWorkbook } from '../src/app/lib/report-export';
import type { ReportPayload } from '../src/app/lib/api';

function payload(from = '2026-09-01', to = '2026-09-30', previous = false): ReportPayload {
 const row = (id:string, label:string, amount:number) => ({id,label,values:{label,amount,note:'من دفتر الأستاذ␟From ledger'}});
 const columns = [{key:'label',label:'البند␟Item'},{key:'amount',label:'القيمة␟Amount',kind:'money' as const,align:'end' as const},{key:'note',label:'ملاحظة␟Note'}];
 return {id:'income-statement',title:'قائمة الدخل',englishTitle:'Income statement',description:'',category:'financial',status:'live',generatedAt:'2026-10-02T00:00:00Z',period:{from,to},currency:'USD',org:{id:visualOrgId,name:'شركة اختبار التقارير',country:'SA',paymentSettings:{reports:{language:'ar',bilingual:false}}} as any,summary:{},dataBasis:{source:'ledger',status:'available',dateBasis:'period',from,to,postedEntriesOnly:true},sections:[
  {id:'income-summary',title:'ملخص قائمة الدخل␟Income summary',columns,rows:[row('revenue','الإيرادات␟Revenue',previous?1000:1500),row('expenses','المصروفات␟Expenses',previous?400:600),row('net-income','صافي الربح␟Net income',previous?600:900)]},
  {id:'income-ledger-detail',title:'حسب الحساب␟By account',columns,rows:[row('rev-4100','إيراد الخدمات␟Service revenue',previous?1000:1500),row('exp-6100','مصروف الخدمات␟Service expense',previous?300:600),...(previous?[row('exp-6200','مصروف توقف␟Discontinued expense',100)]:[])]},
 ]};
}
test('calendar comparisons preserve complete months, years and custom ranges',()=>{
 expect(comparisonMode(null,'income-statement','2026-09-01','2026-09-30')).toBe('previous_period');
 expect(comparisonMode(null,'income-statement','2026-01-01','2026-09-30')).toBe('previous_year');
 expect(comparisonPeriod('2026-03-01','2026-03-31','previous_period')).toEqual({from:'2026-02-01',to:'2026-02-28'});
 expect(comparisonPeriod('2024-03-01','2024-03-31','previous_period')).toEqual({from:'2024-02-01',to:'2024-02-29'});
 expect(comparisonPeriod('2024-02-01','2024-02-29','previous_year')).toEqual({from:'2023-02-01',to:'2023-02-28'});
 expect(comparisonPeriod('2026-01-01','2026-12-31','previous_period')).toEqual({from:'2025-01-01',to:'2025-12-31'});
 expect(comparisonPeriod('2026-09-10','2026-09-19','previous_period')).toEqual({from:'2026-08-31',to:'2026-09-09'});
 expect(comparisonPeriod('2025-02-01','2025-02-28','previous_year')).toEqual({from:'2024-02-01',to:'2024-02-29'});
 expect(()=>comparisonPeriod('2026-02-30','2026-03-31','previous_year')).toThrow();
});
test('numeric comparison includes prior-only accounts and semantic expense colors in Excel',async()=>{
 const report=await compareReport(payload(),'previous_year',async p=>payload(p.from,p.to,true));
 const [revenue,expense]=report.sections[0].rows;
 expect(revenue.values).toMatchObject({amount:1500,priorAmount:1000,comparisonDelta:500,comparisonPercent:.5});
 expect(comparisonTone(revenue,'comparisonDelta')).toBe('report-positive');
 expect(comparisonTone(expense,'comparisonDelta')).toBe('report-negative');
 expect(report.sections[1].rows.at(-1)!.values).toMatchObject({amount:0,priorAmount:100,comparisonDelta:-100,comparisonPercent:-1});
 expect(report.sections[0].columns.map(c=>c.key)).not.toContain('note');
 const book=await reportWorkbook(report,'ar');const bytes=await book.xlsx.writeBuffer();const {default:Excel}=await import('exceljs');const reloaded=new Excel.Workbook();await reloaded.xlsx.load(bytes);
 const sheet=reloaded.worksheets[0];let revenueRow=0,expenseRow=0;sheet.eachRow(row=>{if(row.getCell(1).value==='الإيرادات')revenueRow=row.number;if(row.getCell(1).value==='المصروفات')expenseRow=row.number;});
 expect(sheet.getCell(`E${revenueRow}`).value).toBe(.5);expect(sheet.getCell(`E${revenueRow}`).numFmt).toContain('%');
 expect(sheet.getCell(`D${expenseRow}`).font.color?.argb).toBe('FFA32D2D');
 expect(sheet.getCell(`D${revenueRow}`).font.color?.argb).toBe('FF16624B');
 const mono=await reportWorkbook(report,'ar',{settings:{colorMode:'plain'}});expect(mono.worksheets[0].getCell(`D${expenseRow}`).font.color?.argb).toBe('FF111111');
});
test('missing history, invalid scope, failed request and zero or negative baseline never invent growth',async()=>{
 for(const baseline of [0,-200]){
  const report=await compareReport(payload(),'previous_year',async p=>{const r=payload(p.from,p.to,true);r.sections[0].rows[0].values.amount=baseline;return r;});
  expect(report.sections[0].rows[0].values.comparisonPercent).toBeNull();expect(report.sections[0].rows[0].values.comparisonDelta).toBe(1500-baseline);
 }
 const empty=await compareReport(payload(),'previous_year',async p=>({...payload(p.from,p.to),status:'empty',dataBasis:{...payload().dataBasis!,status:'no_activity'},sections:[]}));
 expect(empty.sections[0].rows[0].values).toMatchObject({priorAmount:null,comparisonDelta:null,comparisonPercent:null});
 await expect(compareReport(payload(),'previous_year',async p=>({...payload(p.from,p.to),currency:'SAR'}))).rejects.toThrow('SCOPE');
 await expect(compareReport(payload(),'previous_year',async()=>payload())).rejects.toThrow('PERIOD');
 await expect(compareReport(payload(),'previous_year',async()=>{throw Error('offline')})).rejects.toThrow('offline');
});
async function setup(page:import('@playwright/test').Page,orientation='portrait',filtered=false){
 await prepareVisualApp(page,'ar');
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,r=>r.fulfill({json:{...payload().org,paymentSettings:{reports:{language:'ar',bilingual:false,orientation}}}}));
 await page.route('https://api.entix.io/api/reports/income-statement*',r=>{
  expect(r.request().headers()['x-org-id']).toBe(visualOrgId);const q=new URL(r.request().url()).searchParams;
  for(const [key,value] of [['branchId','test-branch'],['projectId','test-project'],['contactId','test-contact']]) if(filtered)expect(q.get(key)).toBe(value);
  const from=q.get('from')||'2026-09-01',to=q.get('to')||'2026-09-30';
  return r.fulfill({json:payload(from,to,from<'2026-09-01')});
 });
}
for(const orientation of ['portrait','landscape'])test(`comparison survives Arabic PDF, designer and monochrome (${orientation})`,async({page},info)=>{
 test.setTimeout(120000);await setup(page,orientation,true);
 await page.goto('/app/reports/income-statement?from=2026-09-01&to=2026-09-30&comparison=previous_year&branchId=test-branch&projectId=test-project&contactId=test-contact');
 const table=page.getByTestId('report-data-table');await expect(table).toContainText('↑ +50.0%');await expect(table).toContainText('2025-09-01');
 await expect(table.getByRole('columnheader',{name:'ملاحظة',exact:true})).toHaveCount(0);
 await expect(table.locator('tbody tr').nth(1).locator('td').nth(3).locator('bdi')).toHaveCSS('color','rgb(163, 45, 45)');
 await page.getByLabel('فترة المقارنة',{exact:true}).selectOption('previous_period');await expect(table).toContainText('2026-08-01');
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();
 const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();
 const csvPath=info.outputPath('comparison.csv');await(await csvDownload).saveAs(csvPath);expect(await readFile(csvPath,'utf8')).toContain('"الإيرادات","1500","1000","500","50"');
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();await page.getByRole('button',{name:'PDF / طباعة',exact:true}).click();
 await expect(page).toHaveURL(/comparison=previous_period/);
 const out=page.getByTestId('report-output-pages');await expect(out).toHaveAttribute('data-ready','true');await expect(out).toContainText('↑ +50.0%');await expect(out).toContainText('2026-08-01');
 expect(await out.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(30);
 await expect(out.locator('.report-negative').first()).toHaveCSS('white-space','nowrap');
 for(const sheet of await out.locator('.report-output-sheet').all())expect(await sheet.evaluate(e=>{const b=e.querySelector('.report-page-body')!;return b.scrollHeight<=b.clientHeight+1&&b.scrollWidth<=b.clientWidth+1})).toBe(true);
 await out.screenshot({path:info.outputPath(`comparison-${orientation}.png`)});
 const dl=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();const file=info.outputPath(`comparison-${orientation}.pdf`);await(await dl).saveAs(file);expect((await readFile(file)).subarray(0,5).toString()).toBe('%PDF-');
 await page.getByRole('button',{name:'إعدادات الطباعة',exact:true}).click();await expect(out).toHaveAttribute('data-ready','true');
 await page.getByLabel('نمط الألوان',{exact:true}).selectOption('plain');await expect(out).toHaveAttribute('data-ready','true');
 await expect(out.locator('.report-negative').first()).toHaveCSS('color','rgb(17, 17, 17)');
});
test('report book defaults to comparison and removes stale edition on period change',async({page})=>{
 await setup(page);await page.goto('/app/reports/management-pdf');
 for(const name of ['المركز المالي','التدفقات النقدية','ميزان المراجعة'])await page.getByLabel(name,{exact:true}).uncheck();
 await page.getByRole('button',{name:'تجهيز الملف والمعاينة',exact:true}).click();
 const output=page.getByTestId('report-book-pages');await expect(output).toHaveAttribute('data-ready','true');await expect(output).toContainText('التغيّر');
 await page.getByLabel('فترة المقارنة',{exact:true}).selectOption('previous_period');await expect(output).toHaveCount(0);
});
test('failed prior period hides stale results and disables all exports',async({page})=>{
 await setup(page);await page.goto('/app/reports/income-statement?from=2026-09-01&to=2026-09-30&comparison=previous_year&branchId=test-branch&projectId=test-project&contactId=test-contact');await expect(page.getByTestId('report-data-table')).toBeVisible();
 await page.route('https://api.entix.io/api/reports/income-statement*',r=>r.fulfill({status:500,json:{error:'Synthetic comparison unavailable'}}));
 await page.getByLabel('فترة المقارنة',{exact:true}).selectOption('previous_period');
 await expect(page.getByTestId('report-data-table')).toHaveCount(0);await expect(page.getByRole('button',{name:'تصدير التقرير',exact:true})).toBeDisabled();
});
