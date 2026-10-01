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
