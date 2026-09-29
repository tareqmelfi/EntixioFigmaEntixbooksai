import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page: Page, lang: 'en'|'ar' = 'en') {
  await prepareVisualApp(page, lang);
  let fail = false;
  const writes: any[] = [];
  let saved: any = { id:'unsaved-quote', orgId:'org-visual-system', quoteNumber:'Q-EXIT-1', contactId:'client-1', contact:{id:'client-1',displayName:'Synthetic customer'}, status:'SENT', issueDate:'2026-09-29',validUntil:'2026-10-29',currency:'USD',title:'Synthetic quote',subtotal:15669.8,taxTotal:0,total:15669.8,discountTotal:0,lines:[{id:'line-1',description:'Synthetic item',quantity:20,unitPrice:783.49,subtotal:15669.8,taxInclusive:false,taxRate:null}] };
  await page.route('**/api/quotes**', r => {
    if (r.request().method() === 'PATCH') {
      writes.push(r.request().postDataJSON());
      if(fail) return r.fulfill({status:500,json:{error:'Synthetic save failure'}});
      const payload = r.request().postDataJSON();
      const total=payload.lines.reduce((s:number,l:any)=>s+l.quantity*l.unitPrice,0);
      saved={...saved,...payload,total,subtotal:total};
      return r.fulfill({json:saved});
    }
    return r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/unsaved-quote')?saved:{items:[saved],total:1,nextCursor:null}});
  });
  await page.route('**/api/contacts**',r=>r.fulfill({json:{items:[saved.contact],total:1}}));
  await page.route('**/api/document-templates**',r=>r.fulfill({json:{items:[],QUOTE:null,INVOICE:null}}));
  await page.route('**/api/branches**',r=>r.fulfill({json:{items:[]}}));
  await page.route('**/api/payment-plans**',r=>r.fulfill({json:{items:[]}}));
  await page.route('**/api/tax-rates**',r=>r.fulfill({json:{items:[]}}));
  return {writes,setFail:(v:boolean)=>{fail=v}};
}
async function edit(page:Page) {
  await page.getByTestId('quote-detail-edit').click();
  await expect(page.getByRole('textbox',{name:/Line price|سعر السطر/,exact:true}).first()).toHaveValue('783.49');
}
const price=(page:Page)=>page.getByRole('textbox',{name:/Line price|سعر السطر/,exact:true}).first();
const guard=(page:Page)=>page.getByTestId('unsaved-exit-guard');

for(const lang of ['en','ar'] as const) test(`cancel asks, stay preserves edits, discard reopens saved quote (${lang})`,async({page})=>{
  const state=await setup(page,lang);await page.goto('/app/quotes/unsaved-quote');await edit(page);
  await price(page).fill('10000');
  await page.getByRole('button',{name:lang==='en'?'Cancel':'إلغاء',exact:true}).click();
  await expect(guard(page)).toBeVisible();
  await guard(page).getByTestId('unsaved-stay').click();await expect(price(page)).toHaveValue('10000');
  await page.getByRole('button',{name:lang==='en'?'Cancel':'إلغاء',exact:true}).click();
  await guard(page).getByTestId('unsaved-discard').click();await edit(page);
  await page.getByRole('button',{name:lang==='en'?'Cancel':'إلغاء',exact:true}).click();
  await expect(guard(page)).toHaveCount(0);await edit(page);expect(state.writes).toHaveLength(0);
});

test('X and Escape use the same discard decision',async({page})=>{
  await setup(page);await page.goto('/app/quotes/unsaved-quote');await edit(page);await price(page).fill('10000');
  await page.getByRole('button',{name:'إغلاق وعودة للقائمة'}).click();await expect(guard(page)).toBeVisible();await guard(page).getByTestId('unsaved-stay').click();
  await page.keyboard.press('Escape');await expect(guard(page)).toBeVisible();await guard(page).getByTestId('unsaved-discard').click();await edit(page);
});

test('sidebar discard does not resurrect the draft during unmount',async({page})=>{
  const state=await setup(page);await page.goto('/app/quotes/unsaved-quote');await edit(page);await price(page).fill('10000');
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();await expect(guard(page)).toBeVisible();
  await expect(page).toHaveURL(/quotes\/unsaved-quote/);await guard(page).getByTestId('unsaved-discard').click();await expect(page).toHaveURL(/\/app$/);
  await page.goto('/app/quotes/unsaved-quote');await edit(page);expect(state.writes).toHaveLength(0);
});

test('browser Back asks before discarding and preserves its destination',async({page})=>{
  await setup(page);await page.goto('/app/quotes');await page.getByRole('link',{name:'Q-EXIT-1 Synthetic quote',exact:true}).click();await edit(page);await price(page).fill('10000');
  await page.goBack();await expect(guard(page)).toBeVisible();await guard(page).getByTestId('unsaved-stay').click();await expect(price(page)).toHaveValue('10000');
  await page.goBack();await expect(guard(page)).toBeVisible();await guard(page).getByTestId('unsaved-discard').click();await expect(page).toHaveURL(/\/app\/quotes$/);
  await page.getByRole('link',{name:'Q-EXIT-1 Synthetic quote',exact:true}).click();await edit(page);
});

test('failed save stays open; successful save-and-leave writes once and clears recovery',async({page})=>{
  const state=await setup(page);await page.goto('/app/quotes/unsaved-quote');await edit(page);await price(page).fill('10000');
  state.setFail(true);await page.getByRole('button',{name:'Cancel',exact:true}).click();await guard(page).getByTestId('unsaved-save').click();
  await expect(guard(page)).toBeVisible();await expect(price(page)).toHaveValue('10000');await expect(guard(page).getByRole('alert')).toBeVisible();
  state.setFail(false);await guard(page).getByTestId('unsaved-save').click();await expect(page.getByTestId('quote-detail-edit')).toBeVisible();
  await page.getByTestId('quote-detail-edit').click();await expect(price(page)).toHaveValue('10000');await expect(page.getByTestId('draft-recovery')).toHaveCount(0);expect(state.writes).toHaveLength(2);
});

test('reload warns and recovery is opt-in, never silently replacing saved prices',async({page})=>{
  const state=await setup(page);await page.goto('/app/quotes/unsaved-quote');await edit(page);await price(page).fill('10000');
  let warned=false;page.once('dialog',async d=>{warned=d.type()==='beforeunload';await d.accept()});await page.reload();expect(warned).toBe(true);
  await page.getByTestId('quote-detail-edit').click();await expect(page.getByTestId('draft-recovery')).toBeVisible();await expect(price(page)).toHaveValue('783.49');
  await page.getByTestId('draft-recover').click();await expect(price(page)).toHaveValue('10000');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await guard(page).getByTestId('unsaved-discard').click();await edit(page);expect(state.writes).toHaveLength(0);
});

test('save-and-leave follows the requested sidebar destination once',async({page})=>{
  const state=await setup(page);await page.goto('/app/quotes/unsaved-quote');await edit(page);await price(page).fill('10000');
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();await guard(page).getByTestId('unsaved-save').click();
  await expect(page).toHaveURL(/\/app$/);expect(state.writes).toHaveLength(1);
  await page.goto('/app/quotes/unsaved-quote');await page.getByTestId('quote-detail-edit').click();
  await expect(price(page)).toHaveValue('10000');await expect(page.getByTestId('draft-recovery')).toHaveCount(0);
});

test('discarding a recovery offer keeps the saved version on subsequent opens',async({page})=>{
  const state=await setup(page);await page.goto('/app/quotes/unsaved-quote');await edit(page);await price(page).fill('10000');
  page.once('dialog',d=>d.accept());await page.reload();await page.getByTestId('quote-detail-edit').click();
  await page.getByRole('button',{name:'Discard recovery copy and use saved version',exact:true}).click();
  await expect(price(page)).toHaveValue('783.49');await page.getByRole('button',{name:'Cancel',exact:true}).click();await edit(page);
  await expect(page.getByTestId('draft-recovery')).toHaveCount(0);expect(state.writes).toHaveLength(0);
});

test('same-URL Quotes sidebar navigation asks before leaving a new quote',async({page})=>{
  const state=await setup(page);await page.goto('/app/quotes');await page.getByRole('button',{name:'New quote',exact:true}).click();
  await price(page).fill('10000');await page.locator('nav').getByRole('link',{name:'Quotes',exact:true}).click();
  await expect(guard(page)).toBeVisible();await guard(page).getByTestId('unsaved-discard').click();
  await expect(page.getByRole('button',{name:'New quote',exact:true})).toBeVisible();expect(state.writes).toHaveLength(0);
});

test('Arabic mobile exit choices remain visible and usable',async({page},testInfo)=>{
  await setup(page,'ar');await page.setViewportSize({width:390,height:844});await page.goto('/app/quotes/unsaved-quote');await edit(page);
  await price(page).fill('10000');await page.getByRole('button',{name:'إلغاء',exact:true}).click();
  for(const choice of ['unsaved-save','unsaved-discard','unsaved-stay']) await expect(guard(page).getByTestId(choice)).toBeInViewport();
  await page.screenshot({path:testInfo.outputPath('mobile-exit.png')});
  await guard(page).getByTestId('unsaved-discard').click();await edit(page);
});
