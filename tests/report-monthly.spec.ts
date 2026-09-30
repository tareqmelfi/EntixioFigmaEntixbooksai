import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {prepareVisualApp,visualOrgId} from './fixtures/visual-app';
import {monthlyReport,reportMonths} from '../src/app/lib/report-months';
import {reportWorkbook} from '../src/app/lib/report-export';
const payload=(from='2026-01-01',to='2026-02-28',amount=300)=>({id:'income-statement',title:'قائمة الدخل',englishTitle:'Income statement',description:'',category:'financial',status:'live',generatedAt:'2026-09-30T00:00:00Z',period:{from,to},currency:'SAR',org:{id:visualOrgId,name:'Synthetic Reports'},summary:{},dataBasis:{source:'ledger',status:'available',dateBasis:'period',from,to,postedEntriesOnly:true},sections:[{id:'income-summary',title:'الملخص␟Summary',columns:[{key:'label',label:'الحساب'},{key:'amount',label:'المبلغ',kind:'money'}],rows:[{id:'revenue',label:'الإيرادات␟Revenue',values:{label:'الإيرادات',amount}}]}]}) as any;
test('monthly boundaries, reconciliation and scope fail closed',async()=>{
 expect(reportMonths('2024-02-15','2024-03-10').map(p=>[p.from,p.to])).toEqual([['2024-02-15','2024-02-29'],['2024-03-01','2024-03-10']]);
 expect(()=>reportMonths('2026-02-30','2026-03-01')).toThrow();
 const load=async(p:any)=>payload(p.from,p.to,p.key==='2026-01'?100:200);
 const matrix=await monthlyReport(payload(),load);
 expect(matrix.sections[0].rows[0].values).toMatchObject({'2026-01':100,'2026-02':200,amount:300});
 await expect(monthlyReport(payload(),async p=>({...await load(p),org:{id:'wrong'}}))).rejects.toThrow('SCOPE');
 await expect(monthlyReport(payload(),async p=>payload(p.from,p.to,999))).rejects.toThrow('RECONCILIATION');
 await expect(monthlyReport(payload(),async()=>{throw new Error('offline')})).rejects.toThrow('offline');
 const book=await reportWorkbook(matrix,'ar');const buf=await book.xlsx.writeBuffer();const {default:Excel}=await import('exceljs');const reread=new Excel.Workbook();await reread.xlsx.load(buf);
 const sheet=reread.worksheets[0];expect(sheet.getRow(7).values).toEqual([undefined,'الإيرادات',100,200,300]);expect(sheet.views[0].rightToLeft).toBe(true);expect(sheet.pageSetup.orientation).toBe('landscape');
});
test('month matrix is compact, exports Excel and retains period in print',async({page},info)=>{
 await prepareVisualApp(page,'ar');
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,route=>route.fulfill({json:{...payload().org,paymentSettings:{reports:{language:'ar',bilingual:false}}}}));
 await page.route('https://api.entix.io/api/reports/income-statement*',route=>{const q=new URL(route.request().url()).searchParams;const from=q.get('from')||'2026-01-01',to=q.get('to')||'2026-02-28';return route.fulfill({json:payload(from,to,from.startsWith('2026-02')?200:to==='2026-01-31'?100:300)});});
 await page.goto('/app/reports/income-statement?from=2026-01-01&to=2026-02-28');
 await page.getByRole('button',{name:'الأشهر في أعمدة',exact:true}).click();
 const table=page.getByTestId('report-data-table');await expect(table.getByRole('cell',{name:'100.00',exact:true})).toBeVisible();await expect(table.getByRole('cell',{name:'200.00',exact:true})).toBeVisible();await expect(table.getByRole('cell',{name:'300.00',exact:true})).toBeVisible();
 expect(await table.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(40);
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Excel (.xlsx)',exact:true}).click();await(await pending).saveAs(info.outputPath('monthly.xlsx'));
 await page.screenshot({path:info.outputPath('monthly.png'),fullPage:true});
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();await page.getByRole('button',{name:'PDF / طباعة',exact:true}).click();await expect(page).toHaveURL(/groupBy=month/);
 const output=page.getByTestId('report-output-pages');await expect(output).toHaveAttribute('data-ready','true');
 for(const amount of ['100.00','200.00','300.00']) await expect(output).toContainText(amount);
 const pdfDownload=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();const pdf=info.outputPath('monthly.pdf');await(await pdfDownload).saveAs(pdf);expect((await readFile(pdf)).subarray(0,5).toString()).toBe('%PDF-');
 await page.getByRole('button',{name:'إعدادات الطباعة',exact:true}).click();await expect(output).toHaveAttribute('data-ready','true');await expect(output).toContainText('200.00');
});

test('a failed month removes stale data and disables export',async({page})=>{
 await prepareVisualApp(page,'ar');
 await page.route('https://api.entix.io/api/reports/income-statement*',route=>{
  const q=new URL(route.request().url()).searchParams;
  return q.get('from')==='2026-02-01'?route.fulfill({status:500,json:{error:'Synthetic failed month'}}):route.fulfill({json:payload(q.get('from')||undefined,q.get('to')||undefined,q.get('to')==='2026-01-31'?100:300)});
 });
 await page.goto('/app/reports/income-statement?from=2026-01-01&to=2026-02-28');
 await expect(page.getByTestId('report-data-table')).toBeVisible();
 await page.getByRole('button',{name:'الأشهر في أعمدة',exact:true}).click();
 await expect(page.getByTestId('report-data-table')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'تصدير التقرير',exact:true})).toBeDisabled();
});

test('month strip selects across years and every annual metric survives wide PDF',async({page},info)=>{
 test.setTimeout(120000);await prepareVisualApp(page,'ar');await page.setViewportSize({width:1680,height:1050});
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,route=>route.fulfill({json:{...payload().org,paymentSettings:{reports:{language:'ar',bilingual:false,density:'compact'}}}}));
 await page.route('https://api.entix.io/api/reports/income-statement*',route=>{
  const q=new URL(route.request().url()).searchParams;expect(route.request().headers()['x-org-id']).toBe(visualOrgId);
  expect(q.get('branchId')).toBe('synthetic-branch');expect(q.get('projectId')).toBe('synthetic-project');
  const from=q.get('from')||'2026-01-01',to=q.get('to')||'2026-12-31';const n=reportMonths(from,to).length;
  const r=payload(from,to,n*100);r.sections[0].rows=Array.from({length:30},(_,i)=>({id:`account-${i}`,label:`${4000+i} · حساب خدمات المشروع التجريبي ${i}`,values:{amount:(i+1)*100*n}}));return route.fulfill({json:r});
 });
 await page.goto('/app/reports/income-statement?from=2026-01-01&to=2026-12-31&groupBy=month&branchId=synthetic-branch&projectId=synthetic-project');
 const table=page.getByTestId('report-data-table');await expect(table.locator('tbody tr')).toHaveCount(30);
 expect(await table.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(40);
 await page.screenshot({path:info.outputPath('annual-matrix.png'),fullPage:true});
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();const excel=page.waitForEvent('download');await page.getByRole('button',{name:'Excel (.xlsx)',exact:true}).click();const excelPath=info.outputPath('annual-matrix.xlsx');await(await excel).saveAs(excelPath);
 const {default:Excel}=await import('exceljs');const workbook=new Excel.Workbook();await workbook.xlsx.readFile(excelPath);
 expect(workbook.worksheets[0].columnCount).toBe(14);expect(workbook.worksheets[0].getCell('N7').value).toBe(1200);
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();await page.getByRole('button',{name:'PDF / طباعة',exact:true}).click();
 const output=page.getByTestId('report-output-pages');await expect(output).toHaveAttribute('data-ready','true');
 // 12 months and total split into 3 panels, with all 30 identities repeated.
 await expect(output.locator('tbody tr')).toHaveCount(90);
 for(const sheet of await output.locator('.report-output-sheet').all()){
  expect(await sheet.evaluate(e=>{const b=e.querySelector('.report-page-body')!;return b.scrollHeight<=b.clientHeight+1})).toBe(true);
 }
 const pdf=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();await(await pdf).saveAs(info.outputPath('annual-matrix.pdf'));
 await page.goto('/app/reports/income-statement?from=2026-01-01&to=2026-12-31&branchId=synthetic-branch&projectId=synthetic-project');
 const strip=page.getByTestId('report-month-strip');await strip.getByRole('button',{name:'السنة السابقة'}).click();await strip.locator('[data-month="2025-12"]').click();await strip.getByRole('button',{name:'السنة التالية'}).click();await strip.locator('[data-month="2026-02"]').click();
 await expect(page).toHaveURL(/from=2025-12-01/);await expect(page).toHaveURL(/to=2026-02-28/);
});
