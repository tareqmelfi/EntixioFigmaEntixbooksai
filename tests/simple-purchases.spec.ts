import { expect,test } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
async function ready(page:any) {
 await prepareVisualApp(page,'ar');
 await page.route('**/api/expenses**',(r:any)=>r.fulfill({json:{items:[],summary:{sumTotal:0,avgTotal:0},total:0}}));
 await page.route('**/api/accounts',(r:any)=>r.fulfill({json:{items:[{id:'ai',code:'5031',name:'AI Credits',nameAr:'تكاليف أرصدة الذكاء الاصطناعي',type:'EXPENSE',isActive:true}]}}));
 await page.route('**/api/accounts/suggest',(r:any)=>r.fulfill({json:{accountId:'ai'}}));
 await page.route('**/api/bank-accounts',(r:any)=>r.fulfill({json:{items:[{id:'mercury',name:'Mercury',currency:'USD'},{id:'sar',name:'SAR bank',currency:'SAR'}],totalBalance:0}}));
 await page.route('**/api/branches**',(r:any)=>r.fulfill({json:{items:[]}}));
 await page.route('**/api/projects**',(r:any)=>r.fulfill({json:{items:[]}}));
}
test('USD company starts in USD; the paid purchase submits once with the right currency',async({page})=>{
 await ready(page);let submitted:any;
 await page.route('**/api/expenses',async r=>{if(r.request().method()==='POST'){submitted=r.request().postDataJSON();return r.fulfill({json:{id:'saved',...submitted,total:submitted.totalAmount}})}return r.fulfill({json:{items:[],summary:{sumTotal:0,avgTotal:0}}})});
 await page.goto('/app/expenses/new');
 await expect(page.getByRole('heading',{name:'مصروف جديد',exact:true})).toBeVisible();
 await page.getByPlaceholder(/ضيافة ووجبات/).fill('AI Credits');
 const amounts=page.locator('input[placeholder="0.00"]');await amounts.nth(0).fill('10.80');
 await expect(page.getByTestId('expense-header-account')).toContainText('5031');
 await expect(page.getByText('10.80 USD → 10.80 USD',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'إضافة بند',exact:true})).not.toBeVisible();
 await expect(page.getByRole('button',{name:'إضافة دفعة',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'حفظ',exact:true}).click();
 await expect.poll(()=>submitted?.currency).toBe('USD');expect(submitted.extractedJson.currencySettlement.actualPaidAmount).toBe(10.8);expect(submitted.extractedJson.currencySettlement.baseCurrency).toBe('USD');expect(submitted.paymentSplits[0].amount).toBe(10.8);
});
test('foreign card payment requests actual amount, not an invented 3.75 charge',async({page})=>{
 await ready(page);await page.goto('/app/expenses/new');await page.locator('input[placeholder="0.00"]').nth(0).fill('100');
 await page.getByText('دفعت بعملة أخرى؟',{exact:true}).click();
 await page.locator('details').filter({has:page.getByText('دفعت بعملة أخرى؟',{exact:true})}).getByRole('button',{name:'SAR',exact:true}).click();
 await expect(page.getByLabel('المبلغ المسحوب فعليًا (SAR)')).toHaveValue('');
 await page.getByLabel('المبلغ المسحوب فعليًا (SAR)').fill('389');
 await expect(page.getByText('100 USD → 389 SAR',{exact:true})).toBeVisible();
});
test('bank transfers show effective rate from actual sent and received amounts',async({page})=>{
 await ready(page);await page.goto('/app/bank-accounts');await page.getByRole('button',{name:'تحويل بين حساباتي',exact:true}).click();
 await page.getByRole('button',{name:'حساب الإرسال',exact:true}).click();await page.getByText('SAR bank · SAR',{exact:true}).click();
 await page.getByRole('button',{name:'حساب الاستلام',exact:true}).click();await page.getByText('Mercury · USD',{exact:true}).click();
 await page.getByLabel('Amount sent',{exact:true}).fill('100');await page.getByLabel('Amount received',{exact:true}).fill('37');await expect(page.getByText('1 SAR = 0.370000 USD',{exact:true})).toBeVisible();
});
test('OCR totals follow the actual USD items and remain editable through details', async ({page}) => {
 await ready(page);
 await page.addInitScript(() => sessionStorage.setItem('entix_ocr_prefill',JSON.stringify({issuer:{name:'OpenRouter, Inc',country:'US'},currency:'USD',documentNumber:'UJICI8VM-0003',totals:{subtotal:40.5,tax:0,total:40.5},lines:[{description:'OpenRouter Credits',quantity:1,unitPrice:10.8,taxRate:0,lineTotal:10.8}],confidence:.99})));
 await page.goto('/app/expenses?fromOcr=1');
 await expect(page.getByRole('heading',{name:'مصروف جديد',exact:true})).toBeVisible();
 await expect(page.locator('input[placeholder="0.00"]').nth(2)).toHaveValue('10.80');
 await expect(page.getByText('10.80 USD → 10.80 USD',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'الإجمالي محسوب من البنود · تعديل البنود',exact:true}).click();
 await expect(page.getByRole('heading',{name:'تقسيم البنود',exact:true})).toBeVisible();
 await page.screenshot({path:'/tmp/entix-purchase-details.png',fullPage:true});
});
test('simple expense fits a narrow screen without page overflow',async({page})=>{
 await ready(page);await page.setViewportSize({width:390,height:844});await page.goto('/app/expenses/new');
 await expect(page.getByRole('heading',{name:'مصروف جديد',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1)).toBe(true);
 await page.screenshot({path:'/tmp/entix-simple-expense-mobile.png',fullPage:true});
});
test('bank account includes a paid expense with its actual account currency',async({page})=>{
 await ready(page);
 await page.route('**/api/vouchers**',r=>r.fulfill({json:{items:[]}}));
 await page.route('**/api/bank-accounts/mercury/activity',r=>r.fulfill({json:{items:[{id:'openrouter',kind:'expense',type:'PAYMENT',number:'EXP-10',date:'2026-09-26',amount:10.8,currency:'USD',contact:{displayName:'OpenRouter, Inc'},detailPath:'/app/expenses/openrouter'}]}}));
 await page.goto('/app/bank-accounts/mercury');
 await expect(page.getByText('OpenRouter, Inc',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'EXP-10',exact:true})).toHaveAttribute('href','/app/expenses/openrouter');
 await expect(page.getByText('−10.80 USD',{exact:true})).toBeVisible();
});
