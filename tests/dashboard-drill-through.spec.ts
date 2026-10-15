import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
const point={fromDate:'2026-09-01',toDate:'2026-09-30',dataAvailability:{hasActivity:true},month:'Sep'};
const saved=(kind:string,draft=false)=>({kind,net:draft?40:100,tax:0,gross:draft?40:100,count:1,draft,currency:'USD',selected:true,trend:true,month:'2026-09'});
const data={org:{id:visualOrgId,name:'Synthetic',country:'US',baseCurrency:'USD'},period:{fromDate:'2026-01-01',toDate:'2026-09-30',source:'ledger'},dataAvailability:{hasActivity:true},unavailableMetrics:[],
 kpi:{revenue:100,expenses:20,netIncome:80,receipts:100,payments:20,contactCount:1,overdueCount:0,vatNet:0},
 monthlyTrend:[{...point,revenue:100,expenses:20}],profitLoss:[{...point,revenue:100,net:80}],yearlyTrend:[{...point,fromDate:'2026-01-01',year:2026,revenue:100,net:80}],cashFlowTrend:[{...point,in:100,out:20}],
 incomeBreakdown:[{category:'Sales',code:'4000',total:100}],expenseBreakdown:[{category:'Travel',code:'5000',total:15},{category:'Other',code:'_other_',total:5}],overdueInvoices:[],bankAccounts:[],periodCompare:{thisMonth:{},lastMonth:{}},
 savedActivity:{rows:[saved('invoice'),saved('invoice',true),saved('bill'),saved('expense'),saved('journal',true)]},postingCoverage:{status:'needs_review',unlinkedCount:0,groups:[]}};
for(const language of ['ar','en'] as const)for(const width of [390,1440])test(`drill-through matches scope and is keyboard reachable ${language} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
 await prepareVisualApp(page,language);
 await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:data}));
 const calls:URL[]=[];
 await page.route('https://api.entix.io/api/dashboard/records**',route=>{
  const url=new URL(route.request().url());calls.push(url);expect(route.request().headers()['x-org-id']).toBe(visualOrgId);
  const offset=Number(url.searchParams.get('offset')||0);
  return route.fulfill({json:{scope:Object.fromEntries(url.searchParams),items:[{key:'line-'+offset,id:'journal-one',kind:'journal',number:'JV-SYNTHETIC',date:'2026-09-03',status:'POSTED',currency:'USD',account:'4000',description:'Synthetic detail',amount:offset?1:99}],count:51,total:100,offset,limit:50,hasMore:!offset}})
 });
 await page.goto('/app');
 const revenue=page.getByTestId('overview-revenue').getByRole('link').last();
 await expect(revenue).toHaveAttribute('href',/basis=ledger&metric=revenue&from=2026-01-01&to=2026-09-30&currency=USD/);
 await revenue.focus();await page.keyboard.press('Enter');
 await expect(page.getByTestId('records-total')).toContainText('100.00 USD');
 await expect(page.getByRole('link',{name:'JV-SYNTHETIC'})).toHaveAttribute('href','/app/journal-entries?entryId=journal-one');
 await page.getByRole('button',{name:language==='ar'?'التالي':'Next',exact:true}).click();
 await expect(page.getByTestId('records-total')).toContainText('100.00 USD');
 await expect.poll(()=>calls.at(-1)!.searchParams.get('offset')).toBe('50');
 await page.reload();await expect(page.getByTestId('records-total')).toBeVisible();
 expect(calls.at(-1)!.searchParams.get('from')).toBe('2026-01-01');
 await page.screenshot({path:`/tmp/dashboard-records-${language}-${width}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/app');
 const drafts=page.getByTestId('dashboard-draft-links');await expect(drafts).toBeVisible();await expect(drafts.getByRole('link').first()).toHaveAttribute('href',/state=draft/);
 const pl=page.getByTestId('flow-profit-loss');await pl.getByText(language==='ar'?'عرض سجلات الرسم':'View chart records',{exact:true}).click();
 await expect(pl.getByRole('link').first()).toHaveAttribute('href',/from=2026-09-01&to=2026-09-30/);
 await pl.getByRole('link').first().click();await expect(page.getByTestId('records-total')).toBeVisible();expect(calls.at(-1)!.searchParams.get('from')).toBe('2026-09-01');
 await page.goto('/app');
 await expect(page.getByTestId('expense-breakdown').getByRole('link',{name:'Travel'})).toHaveAttribute('href',/account=5000/);
 await expect(page.getByTestId('expense-breakdown').getByRole('link',{name:'Other'})).toHaveAttribute('href',/exclude=%5B%225000%22%5D/);
 await page.getByTestId('dashboard-documents').locator('summary').first().click();
 await expect(page.getByTestId('saved-row-journal').getByRole('link').last()).toHaveAttribute('href',/metric=journal&state=draft&measure=gross/);
 const savedChart=page.getByTestId('saved-monthly');await expect(savedChart.locator('path[fill-opacity="0.35"]').first()).toBeVisible();
 await page.screenshot({path:`/tmp/dashboard-drills-${language}-${width}.png`});
});
test('chart mouse clicks use the selected bar and service failures never expose stale totals',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());await prepareVisualApp(page,'en');
 await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:data}));
 await page.route('https://api.entix.io/api/dashboard/records**',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
 await page.goto('/app');await page.getByTestId('flow-profit-loss').locator('.recharts-bar-rectangle').first().click();
 await expect(page).toHaveURL(/metric=revenue&from=2026-09-01&to=2026-09-30/);await expect(page.getByRole('alert').filter({hasText:'Could not load details'})).toBeVisible();await expect(page.getByTestId('records-total')).toHaveCount(0);
});
test('cash dots, pie slices, draft segments and calendar years retain their exact scope',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());await prepareVisualApp(page,'en');
 await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:data}));
 await page.route('https://api.entix.io/api/dashboard/records**',route=>route.fulfill({json:{scope:{currency:'USD'},items:[],total:0,count:0,offset:0,limit:50,hasMore:false}}));
 await page.goto('/app');await page.getByTestId('cash-flow').locator('.recharts-line-dot').first().click();await expect(page).toHaveURL(/basis=vouchers&metric=receipt&from=2026-09-01&to=2026-09-30/);
 await page.goto('/app');const slice=page.getByTestId('expense-breakdown').locator('.recharts-pie-sector path').first();await expect(slice).toBeVisible();const bounds=await slice.boundingBox();expect(bounds).not.toBeNull();await slice.click({position:{x:bounds!.width-10,y:bounds!.height/2-10}});await expect(page).toHaveURL(/metric=expenses.*account=5000/);
 await page.goto('/app');await page.getByTestId('dashboard-documents').locator('summary').first().click();await page.getByTestId('saved-monthly').locator('path[fill-opacity="0.35"]').first().click();await expect(page).toHaveURL(/basis=saved&metric=invoice&state=draft&measure=net&currency=USD&from=2026-09-01&to=2026-09-30/);
 await page.goto('/app');await page.getByRole('button',{name:'Calendar years',exact:true}).click();await page.getByTestId('flow-profit-loss').locator('.recharts-bar-rectangle').first().click();await expect(page).toHaveURL(/from=2026-01-01&to=2026-09-30/);
});
