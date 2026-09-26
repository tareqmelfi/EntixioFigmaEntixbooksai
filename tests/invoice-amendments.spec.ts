import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
for (const lang of ['ar','en'] as const) test(`US paid invoice can be amended with a reason and retained receipt (${lang})`, async ({ page }) => {
  await prepareVisualApp(page, lang);
  let amendments = 0;
  const inv: any = { id:'amend-test', orgId:'org-visual-system', contactId:'c1', invoiceNumber:'US-1', status:'PAID', issueDate:'2026-09-01', dueDate:'2026-09-30', updatedAt:'2026-09-26T00:00:00.000Z', currency:'USD', exchangeRate:'1', subtotal:'100', taxTotal:'0', total:'100', amountPaid:'100', notes:'', contact:{id:'c1',displayName:'Customer'}, lines:[{id:'l',description:'Original service',quantity:1,unitPrice:100,subtotal:100}] };
  await page.route('**/api/invoices/amend-test', r => r.fulfill({json:inv}));
  await page.route('**/api/invoices/amend-test/amendment-policy', r=>r.fulfill({json:{canAmend:true,canVoidAdmin:false,country:'US',reason:null}}));
  await page.route('**/api/invoices/amend-test/amend', r=> { const body=r.request().postDataJSON(); expect(body.reason).toBe('Correct approved scope'); expect(body.expectedUpdatedAt).toBe('2026-09-26T00:00:00.000Z'); expect(body.lines[0].unitPrice).toBe(120); inv.total='120'; inv.status='PARTIAL'; inv.updatedAt='2026-09-26T01:00:00.000Z'; amendments++; return r.fulfill({json:inv}); });
  await page.goto('/app/invoices/amend-test');
  await page.getByRole('button',{name:lang==='ar'?'تعديل الفاتورة':'Edit invoice',exact:true}).click();
  const save=page.getByRole('button',{name:lang==='ar'?'حفظ التعديل':'Save amendment',exact:true});
  await expect(save).toBeDisabled();
  await page.getByLabel(lang==='ar'?'سعر الوحدة 1':'Unit price 1',{exact:true}).fill('120');
  await page.getByLabel(lang==='ar'?'سبب التعديل — مطلوب':'Reason for amendment — required',{exact:true}).fill('Correct approved scope');
  await save.click();
  await expect(page.getByRole('button',{name:lang==='ar'?'تعديل الفاتورة':'Edit invoice',exact:true})).toBeVisible();
  expect(amendments).toBe(1); expect(inv.amountPaid).toBe('100');
  await page.screenshot({path:`/tmp/entix-amendment-${lang}.png`,fullPage:true});
});
for (const reason of ['saudi_issued_invoice','external_source']) test(`protected invoice shows its real restriction: ${reason}`, async({page})=>{
  await prepareVisualApp(page,'en');
  await page.route('**/api/invoices/protected',r=>r.fulfill({json:{id:'protected',invoiceNumber:'SAFE-1',status:'APPROVED',issueDate:'2026-09-01',dueDate:'2026-09-30',currency:'SAR',total:'100',amountPaid:'0',lines:[]}}));
  await page.route('**/api/invoices/protected/amendment-policy',r=>r.fulfill({json:{canAmend:false,reason,country:reason==='external_source'?'US':'SA'}}));
  await page.goto('/app/invoices/protected');
  await expect(page.getByText(reason==='external_source'?'Synchronized from an external source; correct the source and synchronize.':'Issued Saudi e-invoice: use a linked correction note, including before Phase 2 connection.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit invoice',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Administrative void',exact:true})).toHaveCount(0);
});
