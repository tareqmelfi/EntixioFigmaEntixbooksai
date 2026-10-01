import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
for (const lang of ['ar','en'] as const) test(`paid Saudi invoice notes save independently of financial lock (${lang})`, async ({page}) => {
  await prepareVisualApp(page,lang);
  const inv:any = {id:'notes-test',invoiceNumber:'TEST-PAID',status:'PAID',issueDate:'2026-09-22',currency:'SAR',total:'172500',amountPaid:'172500',taxTotal:'22500',updatedAt:'2026-10-01T00:00:00.000Z',notes:'هذه مسودة',termsConditions:'Draft terms',lines:[]};
  let writes=0, reads=0;
  await page.route('**/api/invoices/notes-test',r=>r.fulfill({json:inv}));
  await page.route('**/api/invoices/notes-test/amendment-policy',r=>r.fulfill({json:{canAmend:false,canVoidAdmin:false,reason:'saudi_issued_invoice',country:'SA'}}));
  await page.route('**/api/invoices/notes-test/notes',r=>{
    if(r.request().method()==='PATCH') {
      expect(r.request().postDataJSON()).toEqual({notes:'الخدمات مسددة بالكامل',termsConditions:null,reason:'تصحيح نص المسودة القديم',expectedUpdatedAt:'2026-10-01T00:00:00.000Z'});
      writes++;inv.notes='الخدمات مسددة بالكامل';inv.termsConditions=null;inv.updatedAt='2026-10-01T01:00:00.000Z';
    } else reads++;
    return r.fulfill({json:{notes:inv.notes,termsConditions:inv.termsConditions,updatedAt:inv.updatedAt,canEdit:true}});
  });
  await page.goto('/app/invoices/notes-test');
  await expect(page.getByRole('button',{name:lang==='ar'?'تعديل الفاتورة':'Edit invoice',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:lang==='ar'?'تعديل الملاحظات والشروط':'Edit notes and terms',exact:true}).click();
  const save=page.getByRole('button',{name:lang==='ar'?'حفظ الملاحظات':'Save notes',exact:true});await expect(save).toBeDisabled();
  await page.getByRole('textbox',{name:lang==='ar'?'ملاحظات الفاتورة':'Invoice notes',exact:true}).fill('الخدمات مسددة بالكامل');
  await page.getByRole('textbox',{name:lang==='ar'?'الشروط المطبوعة':'Printed terms',exact:true}).fill('');
  await page.getByRole('textbox',{name:lang==='ar'?'سبب تعديل النص — مطلوب':'Text change reason — required',exact:true}).fill('تصحيح نص المسودة القديم');
  await page.screenshot({path:`/tmp/entix-invoice-notes-20261001/notes-editor-${lang}.png`,fullPage:true});
  await save.click();await expect(page.getByText(lang==='ar'?'حُفظت الملاحظات وتم التحقق منها. أعد تنزيل الفاتورة للحصول على النص المحدّث.':'Notes saved and verified. Download the invoice again for the updated text.',{exact:true})).toBeVisible();
  expect(writes).toBe(1);expect(reads).toBeGreaterThan(1);expect(inv.status).toBe('PAID');expect(inv.amountPaid).toBe('172500');
});
test('viewer cannot edit and stale save keeps text for review',async({page})=>{
  await prepareVisualApp(page,'en');
  const inv={id:'notes-test',invoiceNumber:'TEST',status:'PAID',issueDate:'2026-09-22',currency:'SAR',total:'115',amountPaid:'115',lines:[]};
  await page.route('**/api/invoices/notes-test',r=>r.fulfill({json:inv}));
  let canEdit=false;
  await page.route('**/api/invoices/notes-test/notes',r=>r.request().method()==='PATCH'?r.fulfill({status:409,json:{error:'stale_invoice'}}):r.fulfill({json:{notes:'Draft',termsConditions:null,updatedAt:'2026-10-01T00:00:00.000Z',canEdit}}));
  await page.goto('/app/invoices/notes-test');await expect(page.getByRole('heading',{name:'Invoice notes and terms',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit notes and terms',exact:true})).toHaveCount(0);
  canEdit=true;await page.reload();await page.getByRole('button',{name:'Edit notes and terms',exact:true}).click();
  await page.getByRole('textbox',{name:'Invoice notes',exact:true}).fill('Correct text');await page.getByRole('textbox',{name:'Text change reason — required',exact:true}).fill('Correct stale wording');
  await page.getByRole('button',{name:'Save notes',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Invoice notes',exact:true})).toHaveValue('Correct text');await expect(page.getByRole('region',{name:'Invoice notes and terms',exact:true}).getByRole('alert')).toBeVisible();
});
