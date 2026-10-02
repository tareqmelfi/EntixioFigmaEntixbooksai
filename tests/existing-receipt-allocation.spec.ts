import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { readFile } from 'node:fs/promises';

for (const language of ['ar','en'] as const) test(`receipt snapshot can be reviewed and explicitly downloaded; a failed refresh removes stale data (${language})`, async ({page},info) => {
  await prepareVisualApp(page,language);
  const invoice={id:'snapshot-invoice',orgId:visualOrgId,contactId:'buyer',invoiceNumber:'INV-SNAPSHOT',status:'APPROVED',issueDate:'2026-10-02',currency:'USD',total:100,amountPaid:0};
  const voucher={id:'snapshot-receipt',orgId:visualOrgId,contactId:'buyer',type:'RECEIPT',number:'R-SNAPSHOT',date:'2026-08-02',amount:100,currency:'USD',receiptAllocations:[]};
  const snapshot={organization:{id:visualOrgId},voucher,invoice,journals:[{id:'original-journal'}],capturedAt:'2026-10-02T10:00:00Z'};
  let fail=false;
  await page.route('**/api/invoices?*',r=>r.fulfill({json:{items:[invoice]}}));
  await page.route('**/api/vouchers?*',r=>r.fulfill({json:{items:[voucher],summary:{sumAmount:100,avgAmount:100}}}));
  await page.route('**/api/vouchers/snapshot-receipt',r=>r.fulfill({json:voucher}));
  await page.route('**/api/vouchers/snapshot-receipt/attachments',r=>r.fulfill({json:{items:[]}}));
  await page.route('**/api/vouchers/snapshot-receipt/allocation-preview?*',r=>fail ? r.fulfill({status:503,json:{error:'temporary_failure'}}) : r.fulfill({json:snapshot}));
  await page.goto('/app/receipts/snapshot-receipt');
  const panel=page.getByRole('region',{name:language==='ar'?'مطابقة قبض موجود':'Apply existing receipt'});
  await panel.getByRole('combobox').selectOption('snapshot-invoice');
  const fetch=panel.getByRole('button',{name:language==='ar'?'تنزيل سجل المطابقة':'Download allocation snapshot'});
  await fetch.click();
  const link=panel.getByRole('link',{name:language==='ar'?'حفظ ملف سجل المطابقة':'Save allocation snapshot file'});
  await expect(link).toBeVisible();
  await panel.locator('summary').click();
  await expect(panel.getByRole('textbox',{name:language==='ar'?'بيانات سجل المطابقة':'Allocation snapshot data'})).toHaveValue(JSON.stringify(snapshot,null,2));
  const download=page.waitForEvent('download');await link.click();
  const file=await download;const path=info.outputPath('receipt-snapshot.json');await file.saveAs(path);
  expect(JSON.parse(await readFile(path,'utf8'))).toEqual(snapshot);
  fail=true;await fetch.click();await expect(panel.getByRole('alert')).toBeVisible();await expect(link).toHaveCount(0);
  await expect(panel.getByRole('textbox',{name:language==='ar'?'بيانات سجل المطابقة':'Allocation snapshot data'})).toHaveCount(0);
});

test('existing receipt keeps its date, retains failed input, retries once and prints its allocation', async ({page},info) => {
  await prepareVisualApp(page,'en');
  const invoice:any={id:'allocation-invoice',orgId:visualOrgId,contactId:'buyer',invoiceNumber:'INV-EXISTING',status:'APPROVED',issueDate:'2026-10-02',currency:'USD',total:100,amountPaid:0};
  const voucher:any={id:'existing-receipt',orgId:visualOrgId,contactId:'buyer',contact:{id:'buyer',displayName:'Synthetic buyer'},type:'RECEIPT',number:'R-EXISTING',date:'2026-08-02',amount:100,currency:'USD',paymentMethod:'CASH',reference:'Keep reference',receiptAllocations:[]};
  const requests:any[]=[];
  await page.route('**/api/invoices?*',r=>r.fulfill({json:{items:[invoice]}}));
  await page.route('**/api/vouchers?*',r=>r.fulfill({json:{items:[voucher],summary:{sumAmount:100,avgAmount:100}}}));
  await page.route('**/api/vouchers/existing-receipt',r=>r.fulfill({json:voucher}));
  await page.route('**/api/vouchers/existing-receipt/attachments',r=>r.fulfill({json:{items:[]}}));
  await page.route('**/api/vouchers/existing-receipt/allocations',r=>{
    const body=r.request().postDataJSON();requests.push(body);
    if(requests.length===1)return r.fulfill({status:503,json:{error:'temporary_failure'}});
    const allocation={id:'allocation',...body,invoice:{invoiceNumber:invoice.invoiceNumber}};voucher.receiptAllocations=[allocation];invoice.amountPaid=100;invoice.status='PAID';
    return r.fulfill({status:201,json:{allocation}});
  });
  await page.goto('/app/receipts/existing-receipt');
  const panel=page.getByRole('region',{name:'Apply existing receipt'});
  await expect(panel).toContainText('2026-08-02');
  await panel.getByLabel('Allocation invoice').selectOption('allocation-invoice');
  await expect(panel.getByLabel('Allocation amount')).toHaveValue('100.00');
  await panel.getByRole('button',{name:'Apply existing balance',exact:true}).click();
  await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByLabel('Allocation amount')).toHaveValue('100.00');
  await panel.getByRole('button',{name:'Apply existing balance',exact:true}).click();
  await expect(panel.getByRole('status')).toContainText('saved and verified');
  expect(requests).toHaveLength(2);expect(requests[0].requestKey).toBe(requests[1].requestKey);expect(voucher.date).toBe('2026-08-02');expect(voucher.reference).toBe('Keep reference');
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'Synthetic company',country:'US',baseCurrency:'USD'}}));
  await page.goto('/print/voucher/existing-receipt?lang=en');
  await expect(page.locator('.voucher-document')).toContainText('INV-EXISTING');await expect(page.locator('.voucher-document')).toContainText('2026-08-02');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل PDF · Download PDF'}).click();await (await download).saveAs(info.outputPath('allocated-receipt.pdf'));
  const explicit=page.waitForEvent('download');await page.getByRole('link',{name:'حفظ ملف PDF · Save PDF file'}).click();await (await explicit).saveAs(info.outputPath('allocated-receipt-explicit.pdf'));
  expect((await readFile(info.outputPath('allocated-receipt-explicit.pdf'))).equals(await readFile(info.outputPath('allocated-receipt.pdf')))).toBe(true);
});

test('draft invoice visibly differs from approved invoice on every sheet',async({page},info)=>{
  await prepareVisualApp(page,'ar');
  let status='DRAFT';
  await page.route('**/api/invoices/draft-label',r=>r.fulfill({json:{id:'draft-label',orgId:visualOrgId,invoiceNumber:'INV-DRAFT',status,issueDate:'2026-10-02',currency:'USD',total:100,subtotal:100,taxTotal:0,amountPaid:0,lines:[{description:'Synthetic service',quantity:1,unitPrice:100,subtotal:100}]}}));
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'Synthetic company',country:'US',baseCurrency:'USD'}}));
  await page.route('**/api/document-templates/defaults',r=>r.fulfill({json:{}}));
  await page.goto('/print/invoice/draft-label?lang=ar');await expect(page.locator('.draft-mark').first()).toContainText('مسودة');
  expect(await page.locator('.draft-mark').count()).toBe(await page.locator('.edoc .sheet').count());
  status='APPROVED';await page.reload();await expect(page.locator('.edoc')).toBeVisible();await expect(page.locator('.draft-mark')).toHaveCount(0);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل PDF · Download PDF'}).click();await (await download).saveAs(info.outputPath('approved-invoice.pdf'));
  const explicit=page.waitForEvent('download');await page.getByRole('link',{name:'حفظ ملف PDF · Save PDF file'}).click();await (await explicit).saveAs(info.outputPath('approved-invoice-explicit.pdf'));
  expect((await readFile(info.outputPath('approved-invoice-explicit.pdf'))).equals(await readFile(info.outputPath('approved-invoice.pdf')))).toBe(true);
});
