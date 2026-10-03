import { expect, test, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
const bill = {id:'bill-one',billNumber:'BILL-ONE',status:'DUE',total:100,amountPaid:0,currency:'USD',issueDate:'2026-08-02',dueDate:'2026-09-02',contact:{displayName:'Supplier A'}};
const expense = {id:'expense-one',number:'EXP-ONE',status:'APPROVED',total:40,currency:'USD',date:'2026-08-01',vendorName:'Supplier A'};
async function ready(page: Page) {
 await prepareVisualApp(page,'ar');
 await page.route('**/api/bills?*',r=>r.fulfill({json:{items:[bill],total:1}}));
 await page.route('**/api/expenses?*',r=>r.fulfill({json:{items:[expense,{...expense,id:'draft',number:'EXP-DRAFT',status:'DRAFT',total:10}],total:2}}));
 await page.route('**/api/contacts?*',r=>r.fulfill({json:{items:[{id:'supplier',displayName:'Supplier A',type:'SUPPLIER'}],total:1}}));
 await page.route('**/api/accounts',r=>r.fulfill({json:{items:[{id:'cost',code:'6100',name:'Services',nameAr:'خدمات',type:'EXPENSE',isActive:true,allowPosting:true}]}}));
 await page.route('**/api/accounts/suggest',r=>r.fulfill({json:{accountId:'cost',code:'6100',name:'Services',nameAr:'خدمات'}}));
 await page.route('**/api/bank-accounts',r=>r.fulfill({json:{items:[{id:'usd-bank',name:'USD bank',currency:'USD',isActive:true},{id:'sar-bank',name:'SAR bank',currency:'SAR',isActive:true}]}}));
}
async function enter(page: Page) {
 await page.goto('/app/purchases/records/new');
 await expect(page.getByRole('button',{name:'حفظ كمستحق',exact:true})).toBeEnabled();
 await page.getByPlaceholder('الوصف',{exact:true}).first().fill('Service purchase');
 // Grid fields have accessible labels keyed by column and row.

}
test('one list combines original records, separates drafts and filters payment states',async({page})=>{
 await ready(page);await page.goto('/app/purchases/records');
 await expect(page.getByRole('link',{name:'BILL-ONE',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'EXP-ONE',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'EXP-ONE',exact:true})).toHaveAttribute('href',/expenses\/expense-one/);
 await page.getByRole('button',{name:'مدفوع',exact:true}).click();await expect(page.getByRole('link',{name:'EXP-ONE',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'BILL-ONE',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'EXP-DRAFT',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'غير مدفوع',exact:true}).click();await expect(page.getByRole('link',{name:'BILL-ONE',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'مسودة',exact:true}).click();await expect(page.getByRole('link',{name:'EXP-DRAFT',exact:true})).toBeVisible();
});
test('list loads later pages and never treats a failed source as zero',async({page})=>{
 await ready(page);let attempts=0;
 await page.route('**/api/bills?*',r=>{const p=new URL(r.request().url()).searchParams.get('page');return r.fulfill({json:{items:[p==='1'?bill:{...bill,id:'older',billNumber:'BILL-OLDER'}],total:2}})});
 await page.route('**/api/expenses?*',r=>++attempts===1?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{items:[expense],total:1}}));
 await page.goto('/app/purchases/records');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('لا توجد مستندات تطابق الفلاتر.')).toHaveCount(0);
 await page.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await expect(page.getByRole('link',{name:'BILL-OLDER',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'EXP-ONE',exact:true})).toBeVisible();
});
test('payment toggle preserves entered lines, accounts and supplier reference',async({page})=>{
 await ready(page);await enter(page);
 await page.getByLabel('رقم فاتورة المورد أو الإيصال',{exact:true}).fill('SUP-123');
 await page.getByRole('button',{name:'مدفوع الآن',exact:true}).click();await expect(page.getByRole('button',{name:'حفظ كمدفوع',exact:true})).toBeVisible();
 await expect(page.getByPlaceholder('الوصف',{exact:true}).first()).toHaveValue('Service purchase');await expect(page.getByLabel('رقم فاتورة المورد أو الإيصال',{exact:true})).toHaveValue('SUP-123');
 await page.getByRole('button',{name:'سأدفع لاحقًا',exact:true}).click();await expect(page.getByPlaceholder('الوصف',{exact:true}).first()).toHaveValue('Service purchase');
 await page.screenshot({path:'/tmp/unified-purchase-form.png',fullPage:true});
});
test('shared form is usable at narrow Arabic width',async({page})=>{
 await ready(page);await page.setViewportSize({width:390,height:844});await page.goto('/app/purchases/records/new');
 await expect(page.getByRole('heading',{name:'تسجيل شراء أو مصروف',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

test('paid purchase posts once to expense endpoint and preserves failure inputs', async ({page}) => {
 await ready(page); let writes:any[]=[];
 await page.route('**/api/expenses',r=>{writes.push(r.request().postDataJSON());return writes.length===1?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{id:'saved-expense'}})});
 await page.route('**/api/bills',r=>{throw new Error('Paid entry must not create a second bill')});
  await enter(page); await page.getByLabel('سعر السطر',{exact:true}).first().fill('100');
  await page.getByRole('button',{name:'مدفوع الآن',exact:true}).click();
  await expect(page.getByRole('button',{name:'خدمات · 6100',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'حفظ كمدفوع',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('سعر السطر',{exact:true}).first()).toHaveValue('100');
 await page.getByRole('button',{name:'حفظ كمدفوع',exact:true}).click();
 await expect(page).toHaveURL(/purchases\/records$/);
 expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
 expect(writes[1]).toMatchObject({status:'APPROVED',currency:'USD',totalAmount:100,paymentSplits:[{amount:100,currency:'USD'}],lineItems:[{unitPrice:100,quantity:1}]});
 expect(writes[1].extractedJson.currencySettlement).toMatchObject({version:2,sourceCurrency:'USD',actualPaidAmount:100,exchangeRate:1});
});
test('pay later submits only an unpaid bill; toggling does not leak payment details',async({page})=>{
 await ready(page); let submitted:any;
 await page.route('**/api/bills',r=>{submitted=r.request().postDataJSON();return r.fulfill({json:{id:'saved-bill'}})});
 await page.route('**/api/expenses',()=>{throw new Error('Pay later must not create an expense')});
 await enter(page); await page.getByLabel('سعر السطر',{exact:true}).first().fill('100');
 await page.getByRole('button',{name:'المورد *',exact:true}).click();await page.getByRole('button',{name:'Supplier A',exact:true}).click();
 await page.getByRole('button',{name:'مدفوع الآن',exact:true}).click();await page.getByRole('button',{name:'سأدفع لاحقًا',exact:true}).click();
 await page.getByRole('textbox',{name:'تاريخ الاستحقاق فتح التقويم',exact:true}).fill('01/11/2026');await page.getByRole('textbox',{name:'تاريخ الاستحقاق فتح التقويم',exact:true}).blur();
 await page.getByRole('button',{name:'حفظ كمستحق',exact:true}).click();
 await expect.poll(()=>submitted?.status).toBe('DUE');expect(submitted.paymentSplits).toEqual([]);expect(submitted.contactId).toBe('supplier');expect(submitted.lines[0]).toMatchObject({unitPrice:100,quantity:1});
});
test('saved paid draft remains unposted and retains its chosen account',async({page})=>{
 await ready(page);let submitted:any;await page.route('**/api/expenses',r=>{submitted=r.request().postDataJSON();return r.fulfill({json:{id:'draft'}})});
 await enter(page);await page.getByLabel('سعر السطر',{exact:true}).first().fill('25');await page.getByRole('button',{name:'مدفوع الآن',exact:true}).click();
 await expect(page.getByRole('button',{name:'خدمات · 6100',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'حفظ كمسودة',exact:true}).click();await expect.poll(()=>submitted?.status).toBe('DRAFT');expect(submitted.lineItems[0].accountId).toBe('cost');
});

test('extracted historical source survives reload with original attachment and currency',async({page})=>{
 await ready(page);
 await page.route('**/api/agent/extract-document',r=>r.fulfill({json:{kind:'bill',confidence:1,issueDate:'2016-08-02',dueDate:'2016-09-02',currency:'SAR',documentNumber:'SOURCE-2016',issuer:{name:'Supplier A'},sourceFileHash:'a'.repeat(64),lines:[{description:'Imported service',quantity:1,unitPrice:100,taxRate:0}]}}));
 await enter(page);
 await page.locator('input[type="file"]').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
 await expect(page.getByLabel('رقم فاتورة المورد أو الإيصال',{exact:true})).toHaveValue('SOURCE-2016');
 await expect(page.getByRole('textbox',{name:'تاريخ المستند فتح التقويم',exact:true})).toHaveValue('02/08/2016');
 await expect(page.getByLabel('العملة',{exact:true})).toHaveValue('SAR');
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('purchase:unified:new') && localStorage.getItem(k)?.includes('SOURCE-2016')))).toBe(true);
 // The IndexedDB transaction completes before navigation; no upload/ledger write occurs.
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const o=indexedDB.open('entix-purchase-draft-files',1);o.onsuccess=()=>{const db=o.result;const r=db.transaction('files').objectStore('files').getAll();r.onsuccess=()=>{resolve(r.result.some(v=>v.files?.some(f=>f.name==='source.pdf')));db.close()}}}))).toBe(true);
 await page.reload();
 await expect(page.getByRole('textbox',{name:'تاريخ المستند فتح التقويم',exact:true})).toHaveValue('02/08/2016');
 await expect(page.getByText('source.pdf',{exact:true})).toBeVisible();
 await expect(page.getByLabel('العملة',{exact:true})).toHaveValue('SAR');
 let submitted:any;await page.route('**/api/expenses',r=>{submitted=r.request().postDataJSON();return r.fulfill({json:{id:'imported'}})});
 await page.getByRole('button',{name:'مدفوع الآن',exact:true}).click();
 await page.getByRole('textbox',{name:/سعر التحويل/}).fill('0.26666667');
 await page.getByRole('button',{name:'حفظ كمدفوع',exact:true}).click();
 await expect.poll(()=>submitted?.vendorName).toBe('Supplier A');
 expect(submitted).toMatchObject({date:'2016-08-02',currency:'SAR',documentNumber:'SOURCE-2016',autoCreateSupplier:false,sourceFileHash:'a'.repeat(64),attachments:[{name:'source.pdf'}]});
});
test('foreign bank payment requires actual charge and retains source currency',async({page})=>{
 await ready(page);let submitted:any;await page.route('**/api/expenses',r=>{submitted=r.request().postDataJSON();return r.fulfill({json:{id:'fx-expense'}})});
 await enter(page);await page.getByLabel('سعر السطر',{exact:true}).first().fill('100');
 await page.getByRole('button',{name:'مدفوع الآن',exact:true}).click();
 await page.getByLabel('العملة',{exact:true}).selectOption('SAR');
 await page.getByLabel('طريقة الدفع',{exact:true}).selectOption('BANK_TRANSFER');
 await page.getByRole('button',{name:'دفعت من',exact:true}).click();await page.getByRole('button',{name:'USD bank · USD',exact:true}).click();
 await page.getByRole('button',{name:'حفظ كمدفوع',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();expect(submitted).toBeUndefined();
 await page.getByLabel('المبلغ المسحوب فعليًا (USD)',{exact:true}).fill('27');
 await page.getByRole('button',{name:'حفظ كمدفوع',exact:true}).click();
 await expect.poll(()=>submitted?.currency).toBe('SAR');expect(submitted.extractedJson.currencySettlement).toMatchObject({sourceCurrency:'SAR',actualPaidCurrency:'USD',actualPaidAmount:27,bankAccountId:'usd-bank',exchangeRate:.27});
 expect(submitted.paymentSplits).toEqual([{method:'BANK_TRANSFER',amount:27,currency:'USD',reference:null}]);
});

test('supplier picker includes contacts beyond the first page',async({page})=>{
 await ready(page);
 await page.route('**/api/contacts?*',r=>r.fulfill({json:{items:new URL(r.request().url()).searchParams.get('page')==='1'?[{id:'supplier',displayName:'Supplier A'}]:[{id:'older',displayName:'Older Supplier'}],total:2}}));
 await enter(page);await page.getByRole('button',{name:'المورد *',exact:true}).click();
 await expect(page.getByRole('button',{name:'Older Supplier',exact:true})).toBeVisible();
});

test('partial payment and linked duplicates never inflate approved totals',async({page})=>{
 await ready(page);await page.route('**/api/bills?*',r=>r.fulfill({json:{items:[{...bill,status:'PARTIAL',amountPaid:40}],total:1}}));
 await page.route('**/api/expenses?*',r=>r.fulfill({json:{items:[expense,{...expense,id:'duplicate',number:'EXP-DUP',duplicateOfId:'expense-one'}],total:2}}));
 await page.goto('/app/purchases/records');await page.getByRole('button',{name:'جزئي',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'BILL-ONE'})).toContainText('60.00 USD');
 await page.getByRole('button',{name:'مكرر مرتبط',exact:true}).click();await expect(page.getByRole('link',{name:'EXP-DUP',exact:true})).toBeVisible();
 await expect(page.getByText('الإجمالي المعتمد',{exact:false})).toHaveCount(0);
});
