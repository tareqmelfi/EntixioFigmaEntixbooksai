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
  await expect(page.getByRole('button',{name:'Void invoice',exact:true})).toHaveCount(0);
});

for (const lang of ['ar', 'en'] as const) test(`invoice list exposes reviewed edit and void without mutating on click (${lang})`, async ({ page }) => {
  await prepareVisualApp(page, lang);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const inv: any = { id: 'list-edit', orgId: 'org-visual-system', contactId: 'c1', invoiceNumber: 'US-LIST-1', status: 'APPROVED', issueDate: '2026-09-01', dueDate: '2026-09-30', updatedAt: '2026-09-26T00:00:00.000Z', currency: 'USD', exchangeRate: '1', subtotal: '114', taxTotal: '0', total: '114', amountPaid: '0', contact: { id: 'c1', displayName: 'Synthetic Customer' }, lines: [{ id: 'l', description: 'Original service', quantity: 1, unitPrice: 114, subtotal: 114 }] };
  let writes = 0;
  await page.route('**/api/invoices?*', r => r.fulfill({ json: { items: [inv], total: 1 } }));
  await page.route('**/api/invoices/list-edit', r => r.fulfill({ json: inv }));
  await page.route('**/api/invoices/list-edit/amendment-policy', r => r.fulfill({ json: { canAmend: inv.status !== 'CANCELLED', canVoidAdmin: inv.status !== 'CANCELLED', country: 'US', reason: null } }));
  await page.route('**/api/invoices/list-edit/void-admin', r => {
    expect(r.request().postDataJSON()).toEqual({ reason: 'Duplicate test invoice', expectedUpdatedAt: '2026-09-26T00:00:00.000Z' });
    writes++; inv.status = 'CANCELLED'; inv.updatedAt = '2026-09-27T00:00:00.000Z';
    return r.fulfill({ json: inv });
  });
  await page.goto('/app/invoices');
  const preview = page.getByRole('complementary', { name: lang === 'ar' ? 'معاينة الفاتورة' : 'Invoice preview', exact: true });
  await preview.getByRole('button', { name: lang === 'ar' ? 'تعديل الفاتورة' : 'Edit invoice', exact: true }).click();
  await expect(page.getByLabel(lang === 'ar' ? 'سعر الوحدة 1' : 'Unit price 1', { exact: true })).toHaveValue('114');
  await expect(page.getByRole('button', { name: lang === 'ar' ? 'حفظ التعديل' : 'Save amendment', exact: true })).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: lang === 'ar' ? 'رجوع' : 'Back', exact: true }).click();
  await preview.getByRole('button', { name: lang === 'ar' ? 'إلغاء الفاتورة' : 'Void invoice', exact: true }).click();
  const confirm = page.getByRole('button', { name: lang === 'ar' ? 'تأكيد الإلغاء مع حفظ السجل' : 'Confirm void and retain history', exact: true });
  await expect(confirm).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: lang === 'ar' ? 'تراجع' : 'Keep invoice', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole('button', { name: lang === 'ar' ? 'إلغاء الفاتورة' : 'Void invoice', exact: true }).click();
  await page.getByLabel(lang === 'ar' ? 'سبب الإلغاء' : 'Reason for void', { exact: true }).fill('Duplicate test invoice');
  await confirm.click();
  await expect(page.getByRole('button', { name: lang === 'ar' ? 'إلغاء الفاتورة' : 'Void invoice', exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
  await page.getByRole('button', { name: lang === 'ar' ? 'رجوع' : 'Back', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'US-LIST-1' })).toContainText(lang === 'ar' ? 'ملغاة' : 'Cancelled');
  await expect(preview.getByRole('button', { name: lang === 'ar' ? 'تعديل الفاتورة' : 'Edit invoice', exact: true })).toHaveCount(0);
});

test('switching preview does not retain another invoice permission; failed checks stay closed', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  await page.setViewportSize({ width: 1920, height: 1080 });
  const row = (id: string) => ({ id, invoiceNumber: id, contactId: 'c1', status: 'APPROVED', issueDate: '2026-09-01', currency: 'USD', total: '100', amountPaid: '0', lines: [{ id: 'l', description: 'Service', quantity: 1, unitPrice: 100 }] });
  await page.route('**/api/invoices?*', r => r.fulfill({ json: { items: [row('Allowed'), row('Restricted'), row('Failed')], total: 3 } }));
  await page.route('**/api/invoices/*/amendment-policy', r => {
    if (r.request().url().includes('/Failed/')) return r.fulfill({ status: 503, json: { error: 'unavailable' } });
    const allowed = r.request().url().includes('/Allowed/');
    return r.fulfill({ json: { canAmend: allowed, canVoidAdmin: false, country: 'US', reason: allowed ? null : 'external_source' } });
  });
  await page.goto('/app/invoices');
  const preview = page.getByRole('complementary', { name: 'Invoice preview', exact: true });
  await expect(preview.getByRole('button', { name: 'Edit invoice', exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Void invoice', exact: true })).toHaveCount(0);
  await page.getByRole('row').filter({ hasText: 'Restricted' }).click();
  await expect(preview.getByRole('button', { name: 'Edit invoice', exact: true })).toHaveCount(0);
  await page.getByRole('row').filter({ hasText: 'Failed' }).click();
  await expect(preview.getByText('Could not check access. Open the invoice to retry.', { exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Edit invoice', exact: true })).toHaveCount(0);
});
