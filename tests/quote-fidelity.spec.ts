import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
for (const language of ['ar','en'] as const) test(`quote units, order and document overrides survive save/reopen (${language})`,async({page},testInfo)=>{
 await prepareVisualApp(page,language);
 let saved:any={id:'quote-proof',quoteNumber:'QA-PROOF',contactId:'proof-client',contact:{id:'proof-client',displayName:'Synthetic customer — اختبار',type:'CUSTOMER'},status:'DRAFT',issueDate:'2026-10-10',validUntil:'2026-11-10',currency:'SAR',subtotal:100.01,total:100.01,taxTotal:0,discountTotal:0,lines:[{id:'l1',description:'B01-01 First item',quantity:1,unitPrice:50.01,subtotal:50.01,unit:'m2',taxRate:0},{id:'l2',description:'B06-02 Second item',quantity:1,unitPrice:50,subtotal:50,unit:'lm',taxRate:0}]};
 const writes:any[]=[];
 await page.route('**/api/quotes**',r=>{
  if(r.request().method()==='PATCH') {const body=r.request().postDataJSON();writes.push(body);saved={...saved,...body};return r.fulfill({json:saved})}
  return r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/quote-proof')?saved:{items:[saved],total:1,nextCursor:null}})
 });
 await page.route('**/api/contacts**',r=>r.fulfill({json:{items:[saved.contact],total:1}}));
 await page.route('**/api/document-templates**',r=>r.fulfill({json:{items:[],QUOTE:null,INVOICE:null}}));
 for(const path of ['branches','payment-plans','tax-rates']) await page.route(`**/api/${path}**`,r=>r.fulfill({json:{items:[]}}));
 await page.goto('/app/quotes/quote-proof');await page.getByTestId('quote-detail-edit').click();
 await expect(page.getByTestId('quote-line-units')).toContainText(language==='ar'?'م²':'m²');
 await page.getByRole('button',{name:language==='ar'?'رفع البند 2':'Move line 2 up',exact:true}).click();
 await page.getByTestId('quote-signatoryTitle').fill('CEO');await page.getByTestId('quote-signatoryTitleAr').fill('المدير التنفيذي');
 await page.getByTestId('quote-clientRole').fill('عن المقاول الرئيسي');await page.getByTestId('quote-clientRoleEn').fill('MAIN CONTRACTOR');
 await page.getByRole('button',{name:language==='ar'?'+ إضافة بيان تنفيذ':'+ Add delivery detail',exact:true}).click();
 await page.getByRole('textbox',{name:language==='ar'?'عنوان البيان 1':'Detail label 1',exact:true}).fill(language==='ar'?'مدة التنفيذ':'Delivery period');
 await page.getByRole('textbox',{name:language==='ar'?'قيمة البيان 1':'Detail value 1',exact:true}).fill('90 days');
 await page.getByTestId('quote-deliveryNote').fill('Milestone payments as agreed');await page.getByTestId('quote-language').selectOption(language);
 await page.getByTestId('quote-document-options').screenshot({path:testInfo.outputPath(`options-${language}.png`)});
 await page.getByRole('button',{name:language==='ar'?'حفظ التعديلات':'Save changes',exact:true}).click();
 await expect(page.getByTestId('quote-detail-edit')).toBeVisible();expect(writes).toHaveLength(1);
 expect(writes[0].lines.map((l:any)=>l.description)).toEqual(['B06-02 Second item','B01-01 First item']);expect(writes[0].lines.map((l:any)=>l.unit)).toEqual(['lm','m2']);expect(writes[0].lines.map((l:any)=>l.sortOrder)).toEqual([0,1]);
 await page.reload();await page.getByTestId('quote-detail-edit').click();
 await expect(page.getByTestId('quote-signatoryTitle')).toHaveValue('CEO');await expect(page.getByTestId('quote-language')).toHaveValue(language);
 await expect(page.getByRole('textbox',{name:language==='ar'?'قيمة البيان 1':'Detail value 1',exact:true})).toHaveValue('90 days');
 await expect(page.getByTestId('quote-line-units')).toContainText(language==='ar'?'متر طولي':'Linear m');
});
