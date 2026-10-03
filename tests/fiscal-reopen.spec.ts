import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
test('accounting reopen has inline confirmation, persistent failure and safe retry',async({page})=>{
  await prepareVisualApp(page,'en');
  const period={id:'period-synthetic',fiscalYear:2016,periodNumber:8,startDate:'2016-08-01',endDate:'2016-08-31',status:'CLOSED',netIncome:100};
  let writes=0;
  await page.route('**/api/fiscal-periods?*',r=>r.fulfill({json:{items:[period]}}));
  await page.route('**/api/fiscal-periods/period-synthetic/unlock',r=>{writes++;if(writes===1)return r.fulfill({status:409,json:{error:'reopen_later_period_first'}});period.status='OPEN';return r.fulfill({json:{ok:true,reversalEntryId:'synthetic-reversal'}});});
  await page.goto('/app/fiscal-periods');await page.getByRole('button',{name:'Reopen',exact:true}).click();
  await expect(page.getByText('The closing entry will be reversed',{exact:false})).toBeVisible();expect(writes).toBe(0);
  await page.getByRole('button',{name:'Confirm reopen',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Reopen later accounting periods first.'})).toBeVisible();
  await page.getByRole('button',{name:'Confirm reopen',exact:true}).click();await expect(page.getByRole('button',{name:'Lock temporarily',exact:true})).toBeVisible();expect(writes).toBe(2);
});
