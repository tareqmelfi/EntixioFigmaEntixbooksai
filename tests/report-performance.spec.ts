import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
test('large reports prepare cooperatively and preserve all rows', async ({page})=>{
 await prepareVisualApp(page,'en');
 const org={id:visualOrgId,name:'Performance QA',country:'US',baseCurrency:'USD',paymentSettings:{reports:{template:'condensed',orientation:'landscape',language:'en',bilingual:false,logoSource:'none'}}};
 await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:org}));
 await page.route('**/api/reports/account-statement-detail?*',r=>r.fulfill({json:{id:'account-statement-detail',title:'كشف الحساب',englishTitle:'Account statement',org,account:{id:'test'},currency:'USD',period:{from:'2026-01-01',to:'2026-10-06'},generatedAt:'2026-10-07T00:00:00Z',summary:{},sections:[{id:'account-movements',title:'Test',columns:[{key:'date',label:'Date',kind:'date'},{key:'label',label:'Entry'},{key:'description',label:'Description'},{key:'debit',label:'Debit',kind:'money'},{key:'credit',label:'Credit',kind:'money'},{key:'balance',label:'Balance',kind:'money'}],rows:Array.from({length:1200},(_,i)=>({id:`row-${i}`,values:{date:'2026-10-06',label:`JV-2026-${i}`,description:'Ledger transaction description',debit:10,credit:0,balance:10*(i+1)}}))}]}}));
 await page.addInitScript(()=>{(window as any).__longTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())(window as any).__longTasks.push(e.duration)}).observe({entryTypes:['longtask']})});
 const start=Date.now();await page.goto(`/print/report/account-statement-detail?orgId=${visualOrgId}&accountId=test`);
 await expect(page.getByTestId('report-output-pages')).toHaveAttribute('data-ready','true');
 await expect(page.getByTestId('report-output-pages').locator('tbody tr')).toHaveCount(1200);
 const timings=await page.evaluate(()=>({maxTask:Math.max(0,...(window as any).__longTasks)}));console.log('report-performance',JSON.stringify({...timings,readyMs:Date.now()-start}));
 // Startup timing is diagnostic: shared CI load must not masquerade as a pagination regression.
 const cooperative = await page.evaluate(async () => {
   const modulePath = '/src/app/lib/report-pagination.ts';
   const {paginateReport} = await import(modulePath);
   const article = document.querySelector('.report-measure-source .entix-report-paper') as HTMLElement;
   const target = document.querySelector('[data-testid="report-output-pages"]') as HTMLElement;
   let beats = 0; const timer = setInterval(() => beats++, 0); const start = performance.now();
   try { await paginateReport(article,target,{paper:'A4',orientation:'landscape'}); return {beats,ms:performance.now()-start,rows:target.querySelectorAll('tbody tr').length}; }
   finally {clearInterval(timer);}
 });
 console.log('pagination-responsiveness',JSON.stringify(cooperative));
 expect(cooperative.beats).toBeGreaterThan(5); expect(cooperative.rows).toBe(1200);
});
