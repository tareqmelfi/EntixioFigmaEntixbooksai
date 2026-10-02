import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

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
});

test('draft invoice visibly differs from approved invoice on every sheet',async({page})=>{
  await prepareVisualApp(page,'ar');
  let status='DRAFT';
  await page.route('**/api/invoices/draft-label',r=>r.fulfill({json:{id:'draft-label',orgId:visualOrgId,invoiceNumber:'INV-DRAFT',status,issueDate:'2026-10-02',currency:'USD',total:100,subtotal:100,taxTotal:0,amountPaid:0,lines:[{description:'Synthetic service',quantity:1,unitPrice:100,subtotal:100}]}}));
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'Synthetic company',country:'US',baseCurrency:'USD'}}));
  await page.route('**/api/document-templates/defaults',r=>r.fulfill({json:{}}));
  await page.goto('/print/invoice/draft-label?lang=ar');await expect(page.locator('.draft-mark').first()).toContainText('مسودة');
  expect(await page.locator('.draft-mark').count()).toBe(await page.locator('.edoc .sheet').count());
  status='APPROVED';await page.reload();await expect(page.locator('.edoc')).toBeVisible();await expect(page.locator('.draft-mark')).toHaveCount(0);
});
