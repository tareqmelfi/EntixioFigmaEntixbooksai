import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { presentReport } from '../src/app/lib/report-presentation';
import { reportWorkbook } from '../src/app/lib/report-export';

const logo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" rx="8" fill="#0B1B49"/><text x="20" y="39" fill="white" font-family="Arial" font-size="25">DEMO</text></svg>');
const payload=()=>({id:'trial-balance',title:'ميزان المراجعة',englishTitle:'Trial balance',category:'accountant',status:'live',description:'',generatedAt:'2026-10-01T00:00:00Z',period:{from:'2026-01-01',to:'2026-09-30'},currency:'SAR',summary:{},org:{id:visualOrgId,name:'شركة الاختبار للتقارير',country:'SA',logoUrl:logo,printLogoUrl:logo,paymentSettings:{reports:{language:'ar',bilingual:false,density:'compact',primaryColor:'#124578'}}},sections:[{id:'accounts',title:'ميزان المراجعة␟Trial balance',columns:['label','type','opening','debit','credit','balance'].map(key=>({key,label:key})),rows:Array.from({length:20},(_,i)=>({id:`account-${i}`,label:`${1000+i} · ${i%2?'إيرادات الخدمات':'الحساب النقدي'} ${i}`,link:{type:'account',href:`/app/chart-of-accounts?account=account-${i}`,label:'Account'},values:{label:`${1000+i} · ${i%2?'إيرادات الخدمات':'الحساب النقدي'} ${i}`,type:i%2?'REVENUE':'ASSET',opening:i%2?-100:100,debit:i%2?0:125.25,credit:i%2?125.25:0,balance:i%2?-225.25:225.25}}))}]}) as any;

test('trial balance retains ledger values, separates signs, totals in cents and flags imbalance',async()=>{
 const raw=payload(),before=JSON.stringify(raw),view=presentReport(raw),rows=view.sections[0].rows;
 expect(JSON.stringify(raw)).toBe(before);
 expect(rows[0].values).toMatchObject({openingDebit:100,openingCredit:0,closingDebit:225.25,closingCredit:0});
 expect(rows[1].values).toMatchObject({openingDebit:0,openingCredit:100,closingDebit:0,closingCredit:225.25});
 expect(rows.at(-1)?.values).toMatchObject({openingDebit:1000,openingCredit:1000,debit:1252.50,credit:1252.50,closingDebit:2252.50,closingCredit:2252.50});
 expect(presentReport(view)).toEqual(view);expect(view.notices||[]).toHaveLength(0);
 raw.sections[0].rows[0].values.balance=226.25;expect(presentReport(raw).notices?.join('')).toContain('Debits and credits differ');
 raw.sections[0].rows[0].values.opening=null;expect(presentReport(raw).sections[0].rows.at(-1)?.values.openingDebit).toBeNull();
 const book=await reportWorkbook(view,'ar');const bytes=await book.xlsx.writeBuffer();const {default:Excel}=await import('exceljs');const copy=new Excel.Workbook();await copy.xlsx.load(bytes);
 const sheet=copy.worksheets[0];expect(sheet.getCell('C7').value).toBe(100);expect(sheet.getCell('H8').value).toBe(225.25);expect(sheet.getCell('H27').value).toBe(2252.5);expect(sheet.getCell('B7').value).toBe('الأصول');expect(sheet.views[0].rightToLeft).toBe(true);expect(sheet.pageSetup.printTitlesRow).toBe('1:6');expect(sheet.autoFilter).toBeTruthy();
});

test('dense trial balance, branded Excel and PDF share balances and filters',async({page},info)=>{
 test.setTimeout(120000);await prepareVisualApp(page,'ar');await page.setViewportSize({width:1680,height:1100});
 await page.route(`https://api.entix.io/orgs/${visualOrgId}`,r=>r.fulfill({json:payload().org}));
 await page.route('https://api.entix.io/api/reports/trial-balance*',r=>{
  const q=new URL(r.request().url()).searchParams;expect(q.get('from')).toBe('2026-01-01');expect(q.get('to')).toBe('2026-09-30');expect(q.get('branchId')).toBe('branch-test');return r.fulfill({json:payload()});
 });
 await page.goto('/app/reports/trial-balance?from=2026-01-01&to=2026-09-30&branchId=branch-test');
 const table=page.getByTestId('report-data-table');await expect(table.locator('tbody tr')).toHaveCount(21);
 await expect(table.getByRole('columnheader',{name:'افتتاحي مدين'})).toBeVisible();await expect(table.getByRole('columnheader',{name:'ختامي دائن'})).toBeVisible();
 expect(await table.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(29);
 await page.screenshot({path:info.outputPath('trial-balance-screen.png'),fullPage:true});
 await page.getByRole('button',{name:'تصدير التقرير',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Excel (.xlsx)',exact:true}).click();const xlsx=info.outputPath('trial-balance.xlsx');await(await pending).saveAs(xlsx);
 const {default:Excel}=await import('exceljs');const book=new Excel.Workbook();await book.xlsx.readFile(xlsx);const sheet=book.worksheets[0];expect(sheet.getImages()).toHaveLength(1);expect(sheet.getCell('H27').value).toBe(2252.5);expect(sheet.getCell('C7').type).toBe(Excel.ValueType.Number);expect(sheet.getRow(7).height).toBe(18);
 await page.getByRole('button',{name:'تنسيق وشعار التقرير',exact:true}).click();await expect(page).toHaveURL(/branchId=branch-test/);
 const output=page.getByTestId('report-output-pages');await expect(output).toHaveAttribute('data-ready','true');await expect(output.locator('tbody tr')).toHaveCount(21);await expect(output).toContainText('2,252.50');expect(await output.locator('.report-output-sheet').count()).toBe(1);await expect(output.locator('img').first()).toBeVisible();
 await output.locator('.report-output-sheet').first().screenshot({path:info.outputPath('trial-balance-pdf-preview.png')});
 const pdfPending=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();const pdf=info.outputPath('trial-balance.pdf');await(await pdfPending).saveAs(pdf);const pdfBytes=await readFile(pdf);expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-');expect((pdfBytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(1);
 await page.getByRole('combobox',{name:'الشعار',exact:true}).selectOption('none');const noLogoPending=page.waitForEvent('download');await page.getByRole('button',{name:'Excel (.xlsx)',exact:true}).click();const noLogo=info.outputPath('trial-balance-no-logo.xlsx');await(await noLogoPending).saveAs(noLogo);const plain=new Excel.Workbook();await plain.xlsx.readFile(noLogo);expect(plain.worksheets[0].getImages()).toHaveLength(0);
 await page.setViewportSize({width:390,height:844});await page.goto('/app/reports/trial-balance?from=2026-01-01&to=2026-09-30&branchId=branch-test');await expect(table).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

for (const language of ['ar', 'en']) {
 test(`compact ${language} report uses first-page branding and one-line numbered footers`, async ({page}, info) => {
  test.setTimeout(120000);
  await prepareVisualApp(page, language as 'ar' | 'en');
  const data = payload();
  Object.assign(data.org, {legalName:'Report Testing Company', vatNumber:'300000000000003', crNumber:'1010889599', addressLine:'7421 الطريق الدائري الشرقي الفرعي، حي الروضة، الرياض 13213', phone:'800-111-0110', email:'reports@example.test'});
  Object.assign(data.org.paymentSettings.reports, {language, footerNote:'ملاحظة محفوظة تظهر مرة واحدة كاملة في نهاية التقرير.'});
  data.notices = ['الأرصدة من القيود المرحلة فقط.␟Balances include posted entries only.'];
  data.sections[0].rows = Array.from({length:150}, (_,i) => {
   const row = payload().sections[0].rows[i % 20];
   const label = `${1000+i} · حساب معدات ومصاريف المشروع بمدينة الرياض ${i}␟Project equipment and expenses account ${i}`;
   return {...row,id:`account-${i}`,label,values:{...row.values,label}};
  });
  await page.route(`https://api.entix.io/orgs/${visualOrgId}`,r=>r.fulfill({json:data.org}));
  await page.route('https://api.entix.io/api/reports/trial-balance*',r=>r.fulfill({json:data}));
  await page.goto(`/print/report/trial-balance?orgId=${visualOrgId}`);
  const output=page.getByTestId('report-output-pages');
  await expect(output).toHaveAttribute('data-ready','true');
  const sheets=output.locator('.report-output-sheet');
  expect(await sheets.count()).toBeGreaterThan(2);
  await expect(output.locator('tbody tr')).toHaveCount(151);
  await expect(output.locator('h1')).toHaveCount(1);
  await expect(output.locator('.report-company')).toHaveCount(1);
  await expect(output.locator('.report-footer-note')).toHaveCount(1);
  const metrics=await sheets.evaluateAll(nodes=>nodes.map(sheet=>{
   const bounds=sheet.getBoundingClientRect(), table=sheet.querySelector('table')!.getBoundingClientRect();
   const title=sheet.querySelector('h1')?.getBoundingClientRect();
   const footer=sheet.querySelector('footer')!.getBoundingClientRect();
   const counter=sheet.querySelector('.report-page-counter')!.getBoundingClientRect();
   const body=sheet.querySelector('.report-page-body') as HTMLElement;
   return {tableTop:table.top-bounds.top, center:title ? (title.left+title.right-bounds.left-bounds.right)/2 : null,
    footerHeight:footer.height,counterTop:counter.top-footer.top,counterBottom:counter.bottom-footer.bottom,
    fits:body.scrollHeight<=body.clientHeight+1, overflow:Array.from(sheet.querySelectorAll('td,th')).some(cell=>cell.scrollWidth>cell.clientWidth+1),
    heads:sheet.querySelectorAll('thead').length, rowHeight:sheet.querySelector('tbody tr')!.getBoundingClientRect().height};
  }));
  expect(Math.abs(metrics[0].center!)).toBeLessThan(1);
  expect(metrics[0].tableTop).toBeLessThan(145);
  for (const [i,m] of metrics.entries()) {
   if(i>0) expect(m.tableTop).toBeLessThan(35);
   expect(m.footerHeight).toBeLessThan(21);expect(m.counterTop).toBeGreaterThanOrEqual(0);expect(m.counterBottom).toBeLessThanOrEqual(0);
   expect(m.fits).toBe(true);expect(m.overflow).toBe(false);expect(m.heads).toBe(1);expect(m.rowHeight).toBeLessThan(32);
  }
  for(const index of [0,1,(await sheets.count())-1]) await sheets.nth(index).screenshot({path:info.outputPath(`page-${index+1}.png`)});
  const pending=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();
  const path=info.outputPath(`compact-${language}.pdf`);await(await pending).saveAs(path);
  const bytes=await readFile(path);expect((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(await sheets.count());
 });
}
