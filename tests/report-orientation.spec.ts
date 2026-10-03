import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {prepareVisualApp,visualOrgId} from './fixtures/visual-app';
import {reportLayoutSettings,reportLayoutSections} from '../src/app/lib/report-layout';
import {reportWorkbook} from '../src/app/lib/report-export';

const sample=(id='sales-by-customer')=>({id,title:'تقرير الاختبار',englishTitle:'Test report',category:'financial',status:'live',generatedAt:'2026-10-01T00:00:00Z',period:{from:'2026-01-01',to:'2026-09-30'},currency:'USD',summary:{},org:{id:visualOrgId,name:'Synthetic Orientation LLC',country:'US'},sections:[{id:'detail',title:'تفاصيل␟Details',columns:[{key:'label',label:'الاسم␟Name'},...Array.from({length:8},(_,i)=>({key:`metric${i}`,label:`Amount ${i}`,kind:'money'}))],rows:[{id:'one',values:{label:'Complete source row',...Object.fromEntries(Array.from({length:8},(_,i)=>[`metric${i}`,100+i]))}}]}]}) as any;

test('all report families preserve explicit orientation and every metric',async()=>{
 for(const id of ['trial-balance','income-statement','balance-sheet','cash-flow','sales-by-customer','expenses-by-vendor','inventory-movement','taxes','general-ledger']){
  const report=sample(id);
  for(const orientation of ['portrait','landscape'] as const){
   expect(reportLayoutSettings(report,{orientation}).orientation).toBe(orientation);
   const panels=reportLayoutSections(report,{orientation});
   expect(panels.flatMap(p=>p.columns.filter(c=>c.key!=='label').map(c=>c.key))).toEqual(report.sections[0].columns.slice(1).map((c:any)=>c.key));
   expect(panels.every(p=>p.rows===report.sections[0].rows)).toBe(true);
   const book=await reportWorkbook(report,'en',{settings:{orientation}});
   expect(book.worksheets[0].pageSetup.orientation).toBe(orientation);
   expect(book.worksheets[0].getCell('I7').value).toBe(107);
  }
  expect(reportLayoutSettings(report,{orientation:'auto'}).orientation).toBe('landscape');
 }
});

test('designer switches wide report orientation in PDF and Excel without losing amounts',async({page},info)=>{
 test.setTimeout(120000);await prepareVisualApp(page,'en');
 const report=sample();
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,r=>r.fulfill({json:report.org}));
 await page.route('https://api.entix.io/api/reports/sales-by-customer*',r=>r.fulfill({json:report}));
 await page.goto('/app/reports/sales-by-customer/print');
 for(const orientation of ['portrait','landscape'] as const){
  await page.getByRole('combobox',{name:'Orientation',exact:true}).selectOption(orientation);
  const output=page.getByTestId('report-output-pages');await expect(output).toHaveAttribute('data-ready','true');
  for(let i=0;i<8;i++)await expect(output).toContainText(`${100+i}.00`);
  const sizes=await output.locator('.report-output-sheet').evaluateAll(sheets=>sheets.map(s=>({w:s.getBoundingClientRect().width,h:s.getBoundingClientRect().height,overflow:Array.from(s.querySelectorAll('td,th')).some(c=>c.scrollWidth>c.clientWidth+1)})));
  expect(sizes.every(s=>(s.w>s.h)===(orientation==='landscape')&&!s.overflow)).toBe(true);
  const pending=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();const path=info.outputPath(`${orientation}.pdf`);await(await pending).saveAs(path);
  const bytes=await readFile(path);const box=bytes.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);expect(box).toBeTruthy();expect(Number(box![1])>Number(box![2])).toBe(orientation==='landscape');
  const excel=page.waitForEvent('download');await page.getByRole('button',{name:'Excel (.xlsx)',exact:true}).click();const xlsx=info.outputPath(`${orientation}.xlsx`);await(await excel).saveAs(xlsx);
  const {default:Excel}=await import('exceljs');const book=new Excel.Workbook();await book.xlsx.readFile(xlsx);expect(book.worksheets[0].pageSetup.orientation).toBe(orientation);expect(book.worksheets[0].getCell('I7').value).toBe(107);
 }
});

test('cash flow catalog link opens its report and export controls',async({page})=>{
 await prepareVisualApp(page,'en');const data=sample('cash-flow');data.englishTitle='Cash flow';
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,r=>r.fulfill({json:data.org}));
 await page.route('https://api.entix.io/api/reports/cash-flow*',r=>r.fulfill({json:data}));
 await page.goto('/app/reports/cash-flow?from=2026-01-01&to=2026-09-30');
 await expect(page.getByTestId('report-data-table')).toBeVisible();
 await page.getByRole('button',{name:'Report design & logo',exact:true}).click();
 await expect(page).toHaveURL(/cash-flow\/print.*from=2026-01-01/);
 await expect(page.getByTestId('report-download-pdf')).toBeEnabled();
});

for (const template of ['condensed', 'classic']) test(`split settlement print retains each row currency in every panel (${template})`,async({page})=>{
 await prepareVisualApp(page,'en');
 const report=sample('dues-settlements');
 report.sections[0].columns.splice(1,0,{key:'currency',label:'Currency'});
 report.sections[0].columns[2]={key:'paid',label:'Collected / paid',kind:'number'};
 report.sections[0].rows=['SAR','USD'].map((currency,index)=>({id:currency,values:{label:`Invoice ${currency}`,currency,paid:100+index,...Object.fromEntries(Array.from({length:7},(_,i)=>[`metric${i+1}`,101+i+index]))}}));
 for (const orientation of ['portrait','landscape'] as const) {
  const panels=reportLayoutSections(report,{orientation});
  expect(panels.length).toBeGreaterThan(1);
  expect(panels.every(p=>p.columns.some(c=>c.key==='currency'))).toBe(true);
  expect(panels.flatMap(p=>p.columns.filter(c=>c.key!=='label'&&c.key!=='currency').map(c=>c.key))).toEqual(['paid',...Array.from({length:7},(_,i)=>`metric${i+1}`)]);
 }
 const settings={template,orientation:'landscape',language:'en',bilingual:false};
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,r=>r.fulfill({json:{...report.org,paymentSettings:{reports:settings}}}));
 await page.route('https://api.entix.io/api/reports/dues-settlements*',r=>r.fulfill({json:report}));
 await page.goto(`/print/report/dues-settlements?orgId=${visualOrgId}&allTime=1`);
 const output=page.getByTestId('report-output-pages');
 await expect(output).toHaveAttribute('data-ready','true');
 const tables=output.locator('table');
 expect(await tables.count()).toBeGreaterThan(1);
 for(const table of await tables.all()){
  await expect(table.locator('thead')).toContainText('Currency');
  await expect(table.locator('thead')).not.toContainText('(USD)');
  await expect(table.locator('tbody tr').filter({hasText:'Invoice SAR'}).locator('td').filter({hasText:/^SAR$/})).toHaveCount(1);
  await expect(table.locator('tbody tr').filter({hasText:'Invoice USD'}).locator('td').filter({hasText:/^USD$/})).toHaveCount(1);
 }
});
