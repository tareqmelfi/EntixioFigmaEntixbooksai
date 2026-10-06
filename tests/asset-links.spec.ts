import {test,expect} from '@playwright/test';
import {prepareVisualApp,visualOrgId} from './fixtures/visual-app';
for(const mobile of [false,true]) for(const lang of ['en','ar'] as const) test(`asset accounting, purchase link and identity persist (${lang}, ${mobile?'mobile':'desktop'})`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await prepareVisualApp(page,lang);
 const cost={id:'cost',code:'14210',name:'Computer Equipment',nameAr:'أجهزة الكمبيوتر',type:'ASSET',subtype:'fixed-computer',isActive:true,allowPosting:true};
 const expense={...cost,id:'expense',code:'72010',name:'Computer depreciation',nameAr:'إهلاك الكمبيوتر',type:'EXPENSE',subtype:'depreciation'};
 const accumulated={...cost,id:'accumulated',code:'14910',name:'Accumulated depreciation',nameAr:'مجمع الإهلاك',subtype:'contra-fixed'};
 let saved:any=null;let asset:any={id:'mac',code:'FC1212',name:'Apple Mac',acquisitionDate:'2026-05-05',acquisitionCost:1258,salvageValue:0,usefulLifeYears:5,status:'ACTIVE'};
 await page.route('**/api/accounts**',r=>r.fulfill({json:{items:[{...cost,id:'ar',name:'Customer AR',subtype:'receivable'}]}}));
 await page.route('**/api/fixed-assets**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/computer-accounts'))return r.fulfill({json:{cost,expense,accumulated}});
  if(path.endsWith('/next-code'))return r.fulfill({json:{code:'EN-00001'}});
  if(path.endsWith('/purchase-options'))return r.fulfill({json:{items:[{id:'bill1',kind:'bill',number:'B-100',vendor:'Apple Store',date:'2026-05-05',total:1258,currency:'USD',status:'PAID'}]}});
  if(r.request().method()==='PATCH'){saved=r.request().postDataJSON();asset={...asset,...saved};return r.fulfill({json:asset})}
  return r.fulfill({json:asset});
 });
 await page.goto('/app/assets/mac');
 await page.getByRole('button',{name:lang==='ar'?'تعديل':'Edit',exact:true}).click();
 await page.getByRole('button',{name:lang==='ar'?'تجهيز حسابات أجهزة الكمبيوتر':'Set up computer equipment accounts',exact:true}).click();
 await page.getByRole('button',{name:lang==='ar'?'تجهيز الحسابات واختيارها':'Set up and select accounts',exact:true}).click();
 await expect(page.getByRole('button',{name:lang==='ar'?'14210 · أجهزة الكمبيوتر':'14210 · Computer Equipment',exact:true})).toBeVisible();
 if(lang==='ar'){
  await page.getByRole('button',{name:'72010 · إهلاك الكمبيوتر',exact:true}).click();
  await page.getByPlaceholder('اختر حساب مصروف الإهلاك...', {exact:true}).fill('اهلاك');
  await page.getByText('72010 · إهلاك الكمبيوتر',{exact:true}).last().click();
 }
 await page.locator('#asset-photo').setInputFiles({name:'device.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jI1sAAAAASUVORK5CYII=','base64')});
 await page.locator('#asset-service-date').fill('06/05/2026');
 await page.getByTitle(lang==='ar'?'توليد تلقائي':'Auto-generate').click();
 await page.getByLabel(lang==='ar'?'الرقم التسلسلي للجهاز':'Device serial number').fill('MAC-TEST-1');
 await page.getByRole('button',{name:lang==='ar'?'اختر مستند الشراء':'Choose purchase document',exact:true}).click();
 await page.getByText('B-100 · Apple Store',{exact:true}).click();
 await page.screenshot({path:`/tmp/entix-asset-form-${lang}-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await page.getByRole('button',{name:lang==='ar'?'حفظ التغييرات':'Save changes',exact:true}).click();
 await expect.poll(()=>saved?.code).toBe('EN-00001');
 expect(saved.accountId).toBe('cost');expect(saved.depreciationExpenseAccountId).toBe('expense');expect(saved.accumulatedDepreciationAccountId).toBe('accumulated');expect(saved.purchaseBillId).toBe('bill1');expect(saved.purchaseExpenseId).toBeNull();expect(saved.serialNumber).toBe('MAC-TEST-1');expect(saved.inServiceDate).toBe('2026-05-06');expect(saved.imageData).toMatch(/^data:image\/png;base64,/);
 await expect(page.getByText('MAC-TEST-1',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:lang==='ar'?'مرتبط بفاتورة مشتريات · عرض':'Linked to a purchase bill · view',exact:true}).click();
 await expect(page).toHaveURL(/\/app\/purchases\/bills\/bill1/);
});

test('US tax guidance stays out of a Saudi asset form',async({page})=>{
 await prepareVisualApp(page,'en');
 await page.route('**/orgs',r=>r.fulfill({json:[{id:visualOrgId,name:'Saudi QA',country:'SA',baseCurrency:'SAR'}]}));
 await page.route('**/api/fixed-assets/**',r=>r.fulfill({json:r.request().url().includes('next-code')?{code:'EN-00001'}:{items:[]}}));
 await page.goto('/app/assets/new');
 await expect(page.getByText('Cost (SAR) *',{exact:true})).toBeVisible();
 await expect(page.getByText(/US MACRS/)).toHaveCount(0);
});
