import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
async function ready(page: Page, language: 'en' | 'ar' = 'en', products: any[] = []) {
  await prepareVisualApp(page, language);
  await page.route('**/api/bank-accounts', r => r.fulfill({json:{items:[]}}));
  await page.route('**/api/tax-rates', r => r.fulfill({json:{items:[]}}));
  await page.route('**/api/accounts/suggest', r => r.fulfill({json:{accountId:null}}));
  await page.route('**/api/accounts', r => r.fulfill({json:{items:[
    {id:'expense',code:'6100',name:'Purchases',nameAr:'مشتريات',type:'EXPENSE'},
    {id:'income',code:'4100',name:'Sales',nameAr:'مبيعات',type:'REVENUE'}]}}));
  await page.route('**/api/products', r => r.fulfill({json:{items:products}}));
  await page.goto('/app/purchases/records/new');
  await expect(page.getByRole('button',{name:language==='en'?'Save as payable':'حفظ كمستحق',exact:true})).toBeEnabled();
}
async function open(page: Page, ar = false, row = 0) {
  await page.getByRole('button',{name:ar?'منتج أو خدمة…':'Product or service…',exact:true}).nth(row).click();
  await page.getByPlaceholder(ar?'منتج أو خدمة…':'Product or service…',{exact:true}).fill('D7981LL/A');
  await page.getByRole('button',{name:/Create item.*D7981LL|إنشاء صنف.*D7981LL/}).click();
  await expect(page.getByLabel(ar?'اسم المنتج':'Product name',{exact:true})).toHaveValue('D7981LL/A');
}
async function complete(page: Page, ar = false) {
  await page.getByLabel(ar?'نوع المنتج':'Product type',{exact:true}).selectOption('DIGITAL');
  await page.getByLabel(ar?'حساب الإيراد':'Income account',{exact:true}).selectOption('income');
  await page.getByLabel(ar?'حساب الشراء':'Purchase account',{exact:true}).selectOption('expense');
  await page.getByLabel(ar?'كود المنتج (اختياري)':'SKU (optional)',{exact:true}).fill('D7981LL/A');
}
for (const ar of [false,true]) test(`create from empty catalogue and preserve source line (${ar?'AR':'EN'})`,async({page})=>{
  await ready(page,ar?'ar':'en'); let creates:any[]=[]; let submitted:any;
  await page.route('**/api/products', async r => {
    if(r.request().method()!=='POST') return r.fulfill({json:{items:[]}});
    creates.push(r.request().postDataJSON()); await new Promise(resolve=>setTimeout(resolve,100));
    return r.fulfill({json:{id:'new-product',...creates.at(-1),costPrice:0}});
  });
  await page.route('**/api/agent/extract-document',r=>r.fulfill({json:{kind:'bill',confidence:1,currency:'USD',documentNumber:'SOURCE',sourceFileHash:'a'.repeat(64),lines:[{description:'GIFT CODE ORIGINAL',quantity:2,unitPrice:75,taxRate:0}]}}));
  await page.locator('input[type="file"]').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
  await expect(page.getByPlaceholder(ar?'الوصف':'Description',{exact:true}).first()).toHaveValue('GIFT CODE ORIGINAL');
  await open(page,ar); await complete(page,ar);
  await page.getByRole('button',{name:ar?'حفظ واستخدام المنتج':'Save and use product',exact:true}).click();
  await expect(page.getByRole('heading',{name:ar?'إنشاء منتج جديد':'Create a new product'})).toHaveCount(0);
  expect(creates).toHaveLength(1); expect(creates[0]).toMatchObject({name:'D7981LL/A',sku:'D7981LL/A',type:'DIGITAL',expenseAccountId:'expense'});
  expect(creates[0]).not.toHaveProperty('taxRate');
  await expect(page.getByPlaceholder(ar?'الوصف':'Description',{exact:true}).first()).toHaveValue('GIFT CODE ORIGINAL');
  await expect(page.getByLabel(ar?'سعر السطر':'Line price',{exact:true}).first()).toHaveValue('75');
  await expect(page.getByText('source.pdf',{exact:true})).toBeVisible();
  await page.route('**/api/expenses',r=>{submitted=r.request().postDataJSON();return r.fulfill({json:{id:'synthetic-expense'}})});
  await page.getByRole('button',{name:ar?'مدفوع الآن':'Paid now',exact:true}).click();
  await page.getByRole('button',{name:ar?'حفظ كمسودة':'Save as draft',exact:true}).click();
  await expect.poll(()=>submitted?.lineItems?.[0]?.productId).toBe('new-product');
  expect(submitted).toMatchObject({sourceFileHash:'a'.repeat(64),attachments:[{name:'source.pdf'}],lineItems:[{quantity:2,unitPrice:75,taxRate:0,description:'GIFT CODE ORIGINAL'}]});
});
test('cancel creates nothing and blank placeholder can be promoted on retry',async({page})=>{
  await ready(page);let count=0;
  await page.route('**/api/products',r=>{count++;return r.fulfill({json:{id:'created',...r.request().postDataJSON()}})});
  await open(page,false,1);await page.getByRole('button',{name:'Cancel product creation',exact:true}).click();
  expect(count).toBe(0);await expect(page.getByPlaceholder('Description',{exact:true}).first()).toHaveValue('');
  await open(page,false,1);await complete(page);await page.getByRole('button',{name:'Save and use product',exact:true}).click();
  await expect(page.getByPlaceholder('Description',{exact:true}).nth(1)).toHaveValue('D7981LL/A');expect(count).toBe(1);
});
test('failed creation retains fields and allows retry',async({page})=>{
  await ready(page);let count=0;
  await page.route('**/api/products',r=>++count===1?r.fulfill({status:400,json:{error:'invalid_product'}}):r.fulfill({json:{id:'created',...r.request().postDataJSON()}}));
  await open(page);await complete(page);await page.getByRole('button',{name:'Save and use product',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('SKU (optional)',{exact:true})).toHaveValue('D7981LL/A');
  await page.getByRole('button',{name:'Save and use product',exact:true}).click();await expect(page.getByRole('heading',{name:'Create a new product'})).toHaveCount(0);expect(count).toBe(2);
});
test('existing SKU is searchable without a duplicate create option and respects zero purchase cost',async({page})=>{
  await ready(page,'en',[{id:'existing',name:'Apple digital item',nameAr:'منتج رقمي',sku:'D7981LL/A',costPrice:0,unitPrice:150}]);
  await page.getByRole('button',{name:'Product or service…',exact:true}).first().click();await page.getByPlaceholder('Product or service…',{exact:true}).fill('D7981LL/A');
  await expect(page.getByRole('button',{name:/Create item/})).toHaveCount(0);
  await page.getByRole('button',{name:/Apple digital item D7981LL/}).click();await expect(page.getByLabel('Line price',{exact:true}).first()).toHaveValue('0');
});
test('missing payment account result uses English in English interface',async({page})=>{
  await ready(page);
  await page.getByRole('button',{name:'Paid now',exact:true}).click();await page.getByLabel('Payment method',{exact:true}).selectOption('CARD');
  await page.getByRole('button',{name:'Paid from',exact:true}).click();await page.getByPlaceholder('Default payment account',{exact:true}).fill('missing');
  await expect(page.getByText('No results · try a different name',{exact:true})).toBeVisible();
});
test('repeated save submits once and the inline editor fits a narrow Arabic screen',async({page})=>{
  await ready(page,'ar');await page.setViewportSize({width:390,height:844});let count=0;let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve});
  await page.route('**/api/products',async r=>{count++;await pending;return r.fulfill({json:{id:'created',...r.request().postDataJSON()}})});
  await open(page,true);await complete(page,true);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:'/tmp/entix-inline-product-ar-mobile.png',fullPage:true});
  const save=page.getByRole('button',{name:'حفظ واستخدام المنتج',exact:true});
  await save.evaluate((button:HTMLButtonElement)=>{button.click();button.click()});
  await expect.poll(()=>count).toBe(1);await expect(save).toBeDisabled();
  release();await expect(page.getByRole('heading',{name:'إنشاء منتج جديد'})).toHaveCount(0);expect(count).toBe(1);
});
