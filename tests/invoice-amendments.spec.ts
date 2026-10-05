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
  await expect(page.getByText(reason==='external_source'?'Synchronized from an external source; correct the source and synchronize.':'This invoice has an e-invoicing record or the company has a verified Phase 2 connection; use the linked correction flow.',{exact:true})).toBeVisible();
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


test('linked credit note explains the restriction and opens the original correction', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  await page.route('**/api/invoices/credited', r => r.fulfill({ json: { id: 'credited', invoiceNumber: 'US-CREDITED', status: 'SENT', issueDate: '2026-09-01', currency: 'USD', total: '114', amountPaid: '0', lines: [] } }));
  await page.route('**/api/invoices/credited/amendment-policy', r => r.fulfill({ json: { canAmend: false, canVoidAdmin: false, reason: 'credit_note', voidReason: 'credit_note', country: 'US', relatedCreditNote: { id: 'cn-test', noteNumber: 'CN-TEST', status: 'ISSUED' } } }));
  await page.goto('/app/invoices/credited');
  await expect(page.getByText('This invoice has a linked credit note. Review it before amending or voiding to avoid a duplicate correction.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open credit note · CN-TEST' })).toHaveAttribute('href', '/app/credit-notes/cn-test');
  await expect(page.getByRole('button', { name: 'Edit invoice', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Void invoice', exact: true })).toHaveCount(0);
});

for (const lang of ['ar','en'] as const) test(`unconnected Saudi invoice corrects dates without losing notes or failed input (${lang})`, async ({page}) => {
  await prepareVisualApp(page,lang);
  const inv:any={id:'sa-date',orgId:'org-visual-system',contactId:'buyer',invoiceNumber:'EN-INV-202610020001',status:'APPROVED',issueDate:'2026-10-02',supplyDate:'2026-08-02',dueDate:'2026-10-02',updatedAt:'2026-10-02T01:00:00.000Z',currency:'SAR',total:'143750',subtotal:'125000',taxTotal:'18750',amountPaid:'0',notes:'Keep original service notes',termsConditions:'Keep original cash terms',lines:[{id:'line',description:'Synthetic service',quantity:1,unitPrice:125000,subtotal:143750}]};
  let attempts=0;
  await page.route('**/api/invoices/sa-date',r=>r.fulfill({json:inv}));
  await page.route('**/api/invoices/sa-date/amendment-policy',r=>r.fulfill({json:{canAmend:true,canVoidAdmin:false,country:'SA',reason:null}}));
  await page.route('**/api/invoices/sa-date/amend',r=>{
    const body=r.request().postDataJSON();attempts++;
    expect(body.issueDate).toBe('2026-08-02');expect(body.supplyDate).toBe('2026-08-02');expect(body.dueDate).toBe('2026-08-02');expect(body.notes).toBe(inv.notes);expect(body.termsConditions).toBe(inv.termsConditions);
    expect(body).not.toHaveProperty('invoiceNumber');expect(body).not.toHaveProperty('status');
    if(attempts===1)return r.fulfill({status:503,json:{error:'temporary_failure'}});
    Object.assign(inv,{issueDate:body.issueDate,supplyDate:body.supplyDate,dueDate:body.dueDate,updatedAt:'2026-10-02T02:00:00.000Z'});return r.fulfill({json:inv});
  });
  await page.goto('/app/invoices/sa-date');
  await page.getByRole('button',{name:lang==='ar'?'تعديل الفاتورة':'Edit invoice',exact:true}).click();
  const issue=page.getByLabel(lang==='ar'?'تاريخ الإصدار':'Issue date',{exact:true});
  await issue.fill('2026-08-02');
  await page.getByLabel(lang==='ar'?'تاريخ الاستحقاق':'Due date',{exact:true}).fill('2026-08-02');
  await page.getByLabel(lang==='ar'?'سبب التعديل — مطلوب':'Reason for amendment — required',{exact:true}).fill('Owner confirms original invoice date');
  const save=page.getByRole('button',{name:lang==='ar'?'حفظ التعديل':'Save amendment',exact:true});
  await save.click();await expect(page.getByRole('alert').filter({hasText:lang==='ar'?'تعذر حفظ التعديل':'Could not save amendment'})).toBeVisible();await expect(issue).toHaveValue('02/08/2026');
  await save.click();await expect(issue).toHaveCount(0);expect(attempts).toBe(2);expect(inv.invoiceNumber).toBe('EN-INV-202610020001');expect(inv.total).toBe('143750');
});

for (const lang of ['ar', 'en'] as const) test(`invoice document stays left of editor on desktop and stacks on mobile (${lang})`, async ({ page }, info) => {
  await prepareVisualApp(page, lang);
  const inv = { id: 'split', orgId: 'org-visual-system', invoiceNumber: 'SPLIT-1', status: 'APPROVED', currency: 'USD', total: 100, amountPaid: 0, issueDate: '2026-10-05', updatedAt: '2026-10-05T00:00:00Z', lines: [{ id: 'l', description: 'Synthetic service', quantity: 1, unitPrice: 100 }] };
  await page.route('**/orgs/org-visual-system', r => r.fulfill({ json: { id: 'org-visual-system', name: 'Synthetic US company', country: 'US', baseCurrency: 'USD' } }));
  await page.route('**/api/document-templates**', r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/invoices/split', r => r.fulfill({ json: inv }));
  await page.route('**/api/invoices/split/amendment-policy', r => r.fulfill({ json: { canAmend: true, country: 'US' } }));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/app/invoices/split');
  await page.getByRole('button', { name: lang === 'ar' ? 'تعديل الفاتورة' : 'Edit invoice', exact: true }).click();
  const doc = page.getByTestId('invoice-document-column'), editor = page.getByTestId('invoice-editor-column');
  await expect(doc.locator('iframe')).toBeVisible();
  await expect(page.frameLocator('iframe[title]').first().locator('[data-document-ready="true"]')).toBeVisible();
  for (const width of [1920, 1266, 1024]) {
    await page.setViewportSize({ width, height: 1080 });
    const d = (await doc.boundingBox())!, e = (await editor.boundingBox())!;
    expect(d.x + d.width, `document must stay left at ${width}px`).toBeLessThanOrEqual(e.x);
    expect(Math.abs(d.y - e.y)).toBeLessThan(50);
    expect(e.x + e.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`invoice-editor-${lang}-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const md = (await doc.boundingBox())!, me = (await editor.boundingBox())!;
  expect(md.y).toBeGreaterThan(me.y);
  expect(me.x + me.width).toBeLessThanOrEqual(391);
});
