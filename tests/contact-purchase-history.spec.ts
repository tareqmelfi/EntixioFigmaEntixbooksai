import {test,expect,type Page} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';
const contact={id:'crover-test',displayName:'CROVER COMPANY',isSupplier:true,type:'SUPPLIER',country:'SA'};
const zero={count:0,total:0,paid:0,outstanding:0};
function summary(currency='SAR',second=false) {
  const usd=currency==='USD';
  const items=usd?[{id:'usd',number:'EXP-USD',total:'25.00'}]:second?[{id:'older',number:'EXP-OLDER',total:'10.00'}]:[{id:'quick',number:'EXP-CROVER-01',documentNumber:'INV3/2026/22501',total:'34.51'}, {id:'bill',kind:'BILL',number:'BILL-CROVER',total:'100.00',status:'PARTIAL'}, {id:'draft',number:'EXP-DRAFT',total:'5.00',status:'DRAFT'}];
  return {contact,currency,baseCurrency:'SAR',currencyTotals:[{currency:'SAR'},{currency:'USD'}],totals:{invoices:zero,bills:{...zero,count:usd?0:1,total:usd?0:100,outstanding:usd?0:60},expenses:{count:usd?1:3,total:usd?25:49.51,draftCount:usd?0:1,draftTotal:usd?0:5},purchases:{count:usd?1:4,total:usd?25:149.51,draftCount:usd?0:1,draftTotal:usd?0:5},documentTotal:usd?25:149.51,quotes:zero,receipts:zero,payments:{count:1,total:40},arOpen:0,apOpen:usd?0:60,balance:usd?0:-60},invoices:[],bills:[],quotes:[],vouchers:[],expenses:[],purchases:{items:items.map(r=>({kind:'EXPENSE',date:'2026-09-01',status:'PAID',currency,category:'Fuel',matchedBy:'contactId',...r})),nextCursor:usd||second?null:'second'}};
}
async function setup(page:Page,language:'ar'|'en') {
  await prepareVisualApp(page,language);
  let nextAttempts=0;
  await page.route('**/api/contacts/crover-test/summary**',route=>{
    const url=new URL(route.request().url()),next=url.searchParams.has('purchaseCursor');
    if(next&&++nextAttempts===1)return route.fulfill({status:503,json:{error:'synthetic unavailable'}});
    return route.fulfill({json:summary(url.searchParams.get('currency')||'SAR',next)});
  });
}
for(const language of ['ar','en'] as const) test(`supplier overview and complete purchase history include quick expenses (${language})`,async({page})=>{
  await setup(page,language); const writes:string[]=[];page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','OPTIONS'].includes(r.method()))writes.push(r.url())});
  await page.goto('/app/contacts/crover-test');
  await expect(page.getByRole('heading',{name:'CROVER COMPANY',exact:true})).toBeVisible();
  const rows=page.getByTestId('contact-purchases');
  await expect(rows.getByRole('link').filter({hasText:'EXP-CROVER-01'})).toHaveAttribute('href','/app/expenses/quick');
  await expect(rows).toContainText('INV3/2026/22501');await expect(rows).toContainText('34.51 SAR');
  await expect(rows.getByRole('link').filter({hasText:'BILL-CROVER'})).toHaveAttribute('href','/app/purchases/bills/bill');
  await page.getByRole('button',{name:language==='ar'?'المعاملات':'Transactions',exact:true}).click();
  await expect(rows).toContainText('EXP-DRAFT');
  const more=page.getByRole('button',{name:language==='ar'?'عرض المزيد':'Load more',exact:true});
  await more.click();await expect(page.getByRole('alert')).toBeVisible();await expect(rows).toContainText('EXP-CROVER-01');
  await more.click();await expect(rows).toContainText('EXP-OLDER');await expect(more).toHaveCount(0);
  await expect(rows.getByRole('link')).toHaveCount(4);
  await page.getByRole('combobox',{name:language==='ar'?'العملة':'Currency',exact:true}).selectOption('USD');
  await expect(rows).toContainText('25.00 USD');await expect(rows).not.toContainText('EXP-CROVER-01');
  await expect(page.getByText('EXP-USD',{exact:true})).toBeVisible();expect(writes).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('expense-only supplier is visible and has no invented payable',async({page})=>{
  await setup(page,'ar');await page.route('**/api/contacts/crover-test/summary**',r=>r.fulfill({json:summary('USD')}));
  await page.goto('/app/contacts/crover-test');
  await expect(page.getByText('EXP-USD',{exact:true})).toBeVisible();await expect(page.getByText('متعادل',{exact:true})).toBeVisible();
  await expect(page.getByTestId('contact-purchases')).toContainText('25.00 USD');
  await page.screenshot({path:'/tmp/entix-contact-purchases-ar.png',fullPage:true});
});
test('switching contact resets the previous currency instead of hiding its purchases',async({page})=>{
  await setup(page,'en');
  await page.route('**/api/contacts/second-supplier/summary**',r=>r.fulfill({json:{...summary(new URL(r.request().url()).searchParams.get('currency')||'SAR'),contact:{...contact,id:'second-supplier',displayName:'Second supplier'}}}));
  await page.goto('/app/contacts/crover-test');
  await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('USD');
  await expect(page.getByText('EXP-USD',{exact:true})).toBeVisible();
  // Same mounted router view, as with browser history navigation between contacts.
  await page.evaluate(()=>{history.pushState({},'', '/app/contacts/second-supplier');window.dispatchEvent(new PopStateEvent('popstate'));});
  await expect(page.getByRole('heading',{name:'Second supplier',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Currency',exact:true})).toHaveValue('SAR');
  await expect(page.getByText('EXP-CROVER-01',{exact:true})).toBeVisible();
});
