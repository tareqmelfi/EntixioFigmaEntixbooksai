import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { breakEven, comparison, dayBefore, mappingError, metrics, shiftYear, type FinancialPeriod } from '../src/app/lib/owner-report';
import type { ReportPayload } from '../src/app/lib/api';
const row=(id:string,amount:number)=>({id,label:id,values:{label:id,amount}});
const logo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="36"><text y="28" font-size="25" fill="white">TEST COMPANY</text></svg>');
function report(id:string,from:string,to:string):ReportPayload{
 const factor=Number(to.slice(0,4))===2026?1:.8;
 return {id,title:id,englishTitle:id,description:'',category:'financial',status:'live',dataBasis:{source:'ledger',status:'available',dateBasis:id==='income-statement'?'period':'as_of',from,to,postedEntriesOnly:true},generatedAt:'2026-10-01T17:00:00Z',period:{from,to},currency:'USD',summary:{revenue:999999},org:{id:visualOrgId,name:'شركة الاختبار',country:'US',baseCurrency:'USD',printLogoLightUrl:logo},sections:
 id==='income-statement'?[{id:'income-summary',title:'Income',columns:[],rows:[row('revenue',100000*factor),row('expenses',80000*factor),row('net-income',20000*factor)]},{id:'income-ledger-detail',title:'Account detail',columns:[{key:'label',label:'Account'},{key:'amount',label:'Amount',kind:'money'}],rows:[row('rev-sales',100000*factor),row('exp-cogs',40000*factor),row('exp-finance',10000*factor),row('exp-depreciation',5000*factor),row('exp-tax',2000*factor),row('exp-other',23000*factor)]}]:id==='balance-sheet'?[{id:'financial-position',title:'Financial position',columns:[],rows:[row('assets-total',100000*factor),row('liabilities-total',40000*factor),row('equity-total',60000*factor)]},{id:'position-assets-detail',title:'Assets',columns:[],rows:[row('bsa-cash',10000*factor),row('bsa-inventory',20000*factor),row('bsa-ar',30000*factor)]},{id:'position-liabilities-detail',title:'Liabilities',columns:[],rows:[row('bsl-current',20000*factor),row('bsl-debt',20000*factor)]}]:[{id:'other',title:'Detail',columns:[{key:'label',label:'Account'},{key:'amount',label:'Amount',kind:'money'}],rows:Array.from({length:20},(_,i)=>row(`row-${i}`,i))}],notices:['Synthetic test fixture']};
}
const p:FinancialPeriod={income:report('income-statement','2026-01-01','2026-10-01'),balance:report('balance-sheet','2026-01-01','2026-10-01'),opening:report('balance-sheet','2025-12-31','2025-12-31')};
const mapping={cogs:['exp-cogs'],finance:['exp-finance'],depreciation:['exp-depreciation'],tax:['exp-tax'],currentAssets:['bsa-cash','bsa-inventory','bsa-ar'],inventory:['bsa-inventory'],cash:['bsa-cash'],receivables:['bsa-ar'],currentLiabilities:['bsl-current'],debt:['bsl-debt']};
test('financial model uses ledger rows, averages and ratio units, never document summaries',()=>{
 const m=metrics(p,mapping); expect(m.revenue).toBe(100000);expect(m.gross).toBe(60000);expect(m.ebitda).toBe(37000);expect(m.currentRatio).toBe(3);expect(m.quickRatio).toBe(2);expect(m.cashRatio).toBe(.5);expect(m.roe).toBeCloseTo(20000/54000*100);expect(m.roa).toBeCloseTo(20000/90000*100);expect(m.balanceGap).toBe(0);
 expect(metrics(p,{}).ebitda).toBeNull();expect(metrics(p,{finance:[],tax:[],depreciation:[]}).ebitda).toBe(20000);
 const unavailable=structuredClone(p);unavailable.income.dataBasis!.status='unavailable';expect(metrics(unavailable,mapping).revenue).toBeNull();
 expect(comparison(100,-50).percent).toBeNull();expect(comparison(100,0).percent).toBeNull();expect(comparison(25,20,true).percent).toBe(5);
 expect(mappingError({...mapping,tax:['exp-finance']})).not.toBeNull();expect(mappingError({...mapping,currentAssets:[]})).not.toBeNull();
 expect(shiftYear('2024-02-29',-1)).toBe('2023-02-28');expect(dayBefore('2024-03-01')).toBe('2024-02-29');
});
test('break-even requires assumptions and uses contribution margin, not gross margin',()=>{
 const m=breakEven({fixedCosts:'20000',variablePercent:'40',targetProfit:'10000',source:'Reviewed cost schedule'},100000)!;
 expect(m.sales).toBeCloseTo(33333.3333);expect(m.targetSales).toBe(50000);expect(m.safety).toBeCloseTo(66.66667);
 for(const s of [{fixedCosts:'',variablePercent:'40',targetProfit:'',source:'x'},{fixedCosts:'20',variablePercent:'100',targetProfit:'',source:'x'},{fixedCosts:'20',variablePercent:'-1',targetProfit:'',source:'x'},{fixedCosts:'20',variablePercent:'40',targetProfit:'',source:''}])expect(breakEven(s,100)).toBeNull();
});
async function setup(page:import('@playwright/test').Page,language:'ar'|'en'){
 await prepareVisualApp(page,language);
 await page.route('https://api.entix.io/api/reports/**',route=>{expect(route.request().headers()['x-org-id']).toBe(visualOrgId);const u=new URL(route.request().url());return route.fulfill({json:report(u.pathname.split('/').at(-1)!,u.searchParams.get('from')!,u.searchParams.get('to')!)});});
 await page.addInitScript(({mapping,id})=>localStorage.setItem(`entix-owner-report-mapping-v1:${id}`,JSON.stringify(mapping)),{mapping,id:visualOrgId});
 await page.goto('/app/reports/owner-management');
 await page.getByRole('button',{name:language==='ar'?'قراءة بيانات الشركة':'Load company data',exact:true}).click();
 await expect(page.getByRole('button',{name:language==='ar'?'تجهيز التقرير البصري':'Prepare visual report',exact:true})).toBeVisible();
}
for(const language of ['ar','en'] as const)test(`visual financial report prints complete charts, tables and index (${language})`,async({page},testInfo)=>{
 test.setTimeout(180000);await setup(page,language);
 await page.getByText(language==='ar'?'افتراضات نقطة التعادل والمؤشرات التشغيلية':'Break-even assumptions and operating metrics',{exact:true}).click();
 await page.getByLabel(language==='ar'?'التكلفة الثابتة للفترة':'Period fixed costs',{exact:true}).fill('20000');
 await page.getByLabel(language==='ar'?'التكلفة المتغيرة % من الإيراد':'Variable cost % of revenue',{exact:true}).fill('40');
 await page.getByLabel(language==='ar'?'مصدر الافتراضات / مبررها':'Assumption source / rationale',{exact:true}).fill('Synthetic cost schedule');
 await page.getByRole('button',{name:language==='ar'?'تجهيز التقرير البصري':'Prepare visual report',exact:true}).click();
 const output=page.getByTestId('report-book-pages');await expect(output).toHaveAttribute('data-ready','true',{timeout:45000});
 await expect(output).not.toContainText('999,999');await expect(output).toContainText('37,000.00');await expect(output).toContainText('33,333.33');
 expect(await output.locator('.owner-report svg').count()).toBeGreaterThan(10);
 const toc=await output.locator('[data-section-id=contents] tbody tr').evaluateAll(rs=>rs.map(r=>Number(r.lastElementChild!.textContent)));
 expect(toc.length).toBe(13);
 for(const num of toc) await expect(output.locator('.report-output-sheet').nth(num-1).locator('h1')).toHaveCount(1);
 const fit=await output.locator('.report-page-body').evaluateAll(bs=>bs.every(b=>b.scrollHeight<=b.clientHeight+1));expect(fit).toBe(true);
 const overflow=await output.locator('.owner-table td').evaluateAll(cs=>cs.filter(c=>c.scrollWidth>c.clientWidth+2).length);expect(overflow).toBe(0);
 await output.locator('.owner-report').first().screenshot({path:testInfo.outputPath('summary.png')});
 await output.locator('.owner-report').nth(5).screenshot({path:testInfo.outputPath('breakeven.png')});
 if(language==='ar'){const download=page.waitForEvent('download');await page.getByTestId('book-download').click();await(await download).saveAs(testInfo.outputPath('visual-report.pdf'));}
 await page.getByLabel(language==='ar'?'الاتجاه':'Orientation',{exact:true}).selectOption('landscape');await expect(output).toHaveAttribute('data-ready','true',{timeout:45000});
 expect(await output.locator('.report-page-body').evaluateAll(bs=>bs.every(b=>b.scrollHeight<=b.clientHeight+1))).toBe(true);
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByLabel(language==='ar'?'عنوان التقرير':'Report title',{exact:true}).fill('Changed');await expect(output).toHaveCount(0);
});
test('failure or wrong period rejects the entire dataset and no mutation is sent',async({page})=>{
 await prepareVisualApp(page,'en');let mutations=0;page.on('request',r=>{if(r.url().includes('/api/reports/')&&r.method()!=='GET')mutations++;});
 await page.route('https://api.entix.io/api/reports/**',route=>route.fulfill({json:report('income-statement','2020-01-01','2020-12-31')}));
 await page.goto('/app/reports/owner-management');await page.getByRole('button',{name:'Load company data',exact:true}).click();await expect(page.getByRole('alert')).toContainText('partially loaded');await expect(page.getByTestId('book-download')).toHaveCount(0);expect(mutations).toBe(0);
});
