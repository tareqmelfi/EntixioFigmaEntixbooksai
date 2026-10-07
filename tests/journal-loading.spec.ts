import {test, expect} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';
const row = {id:'one',number:'JV-LOAD-1',date:'2026-10-07',description:'Loading recovery',status:'POSTED',source:'manual',totalDebit:12,totalCredit:12,lineCount:2,lines:[]};
async function setup(page: any) {
  await prepareVisualApp(page,'en');
  await page.route('**/api/journals**', (r:any) => r.fulfill({json: new URL(r.request().url()).pathname.endsWith('/coverage') ? {linked:true,unposted:{}} : {items:[row],total:1,hasMore:false}}));
}
test('journal rows do not wait for an unavailable account picker',async({page})=>{
  await setup(page);
  await page.route('**/api/accounts',()=>{});
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('button',{name:'JV-LOAD-1',exact:true})).toBeVisible({timeout:5000});
});
test('failed journals show retry instead of an empty ledger, then recover',async({page})=>{
  await setup(page); let fail=true;
  await page.route('**/api/journals?*',r=>fail?r.fulfill({status:503,json:{error:'database_unavailable'}}):r.fulfill({json:{items:[row],total:1,hasMore:false}}));
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('button',{name:'Retry loading entries',exact:true})).toBeVisible();
  await expect(page.getByText('No manual entries yet')).toHaveCount(0);
  fail=false; await page.getByRole('button',{name:'Retry loading entries',exact:true}).click();
  await expect(page.getByRole('button',{name:'JV-LOAD-1',exact:true})).toBeVisible();
});
test('a stalled journal request stops loading and can be retried',async({page})=>{
  await setup(page); let stall=true;
  await page.route('**/api/journals?*',r=>stall?undefined:r.fulfill({json:{items:[row],total:1,hasMore:false}}));
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('button',{name:'Retry loading entries',exact:true})).toBeVisible({timeout:26000});
  await expect(page.getByText('The request took too long', {exact:false})).toBeVisible();
  stall=false; await page.getByRole('button',{name:'Retry loading entries',exact:true}).click();
  await expect(page.getByRole('button',{name:'JV-LOAD-1',exact:true})).toBeVisible();
});
test('company name does not wait for a second preferences request',async({page})=>{
  await setup(page);let meCalls=0;
  await page.route('**/me',r=>++meCalls===1?r.fallback():undefined);
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('button',{name:/Visual Test Company US · USD/})).toBeVisible({timeout:5000});
});
test('timed out company list releases its shared request so retry can recover',async({page})=>{
  await setup(page);let stall=true;
  await page.route('**/orgs',r=>stall?undefined:r.fallback());
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('button',{name:'JV-LOAD-1',exact:true})).toBeVisible();
  const retry=page.getByRole('button',{name:'Companies could not load · retry',exact:true});
  await expect(retry).toBeVisible({timeout:26000});
  stall=false;await retry.click();
  await expect(page.getByRole('button',{name:/Visual Test Company US · USD/})).toBeVisible();
});
test('changing status cannot be overwritten by an older list request',async({page})=>{
  await setup(page);let oldRequest:any;
  await page.route('**/api/journals?*',async r=>{
    const status=new URL(r.request().url()).searchParams.get('status');
    if(!status){oldRequest=r;return;}
    await r.fulfill({json:{items:[{...row,id:'draft',number:'JV-DRAFT',status:'DRAFT'}],total:1,hasMore:false}});
  });
  await page.goto('/app/journal-entries');
  await expect.poll(()=>!!oldRequest).toBe(true);
  await page.getByRole('button',{name:'Draft',exact:true}).click();
  await expect(page.getByRole('button',{name:'JV-DRAFT',exact:true})).toBeVisible();
  await oldRequest.fulfill({json:{items:[row],total:1,hasMore:false}}).catch(()=>{});
  await expect(page.getByRole('button',{name:'JV-LOAD-1',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'JV-DRAFT',exact:true})).toBeVisible();
});
test('account failure leaves reading available and import unlocks after retry',async({page})=>{
  await setup(page);let fail=true;
  await page.route('**/api/accounts',r=>fail?r.fulfill({status:503,json:{error:'database_unavailable'}}):r.fulfill({json:{items:[]}}));
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('button',{name:'JV-LOAD-1',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Import',exact:true})).toBeDisabled();
  fail=false;await page.getByRole('button',{name:'Retry account choices',exact:true}).click();
  await expect(page.getByRole('button',{name:'Import',exact:true})).toBeEnabled();
});
