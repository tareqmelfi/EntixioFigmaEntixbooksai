import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

test('draft receipt asks for explicit approval, then safely retries payment with the same key', async ({page}) => {
  await prepareVisualApp(page,'en');
  const inv:any={id:'approval-test',orgId:visualOrgId,contactId:'buyer',invoiceNumber:'EN-INV-202610020001',status:'DRAFT',issueDate:'2026-10-01',dueDate:'2026-10-30',currency:'USD',total:100,amountPaid:0,lines:[]};
  const events:string[]=[];const keys:string[]=[];
  await page.route('**/api/contacts*',r=>r.fulfill({json:{items:[{id:'buyer',displayName:'Synthetic buyer'}]}}));
  await page.route('**/api/invoices?*',r=>r.fulfill({json:{items:[inv]}}));
  await page.route('**/api/invoices/approval-test',r=>{
    if(r.request().method()==='PATCH') {expect(r.request().postDataJSON()).toEqual({status:'APPROVED'});inv.status='APPROVED';events.push('approve');}
    return r.fulfill({json:inv});
  });
  await page.route('**/api/vouchers',r=>{
    const body=r.request().postDataJSON();events.push('receipt');keys.push(body.idempotencyKey);expect(inv.status).toBe('APPROVED');expect(body.currency).toBe('USD');
    return keys.length===1?r.fulfill({status:503,json:{error:'temporary_failure'}}):r.fulfill({json:{id:'receipt',number:'R-0001',...body}});
  });
  await page.route('**/api/vouchers?*',r=>r.fulfill({json:{items:[],summary:{sumAmount:'0',avgAmount:'0'}}}));
  await page.goto('/app/receipts?new=1&contactId=buyer&invoiceId=approval-test&amount=100');
  const save=page.getByRole('button',{name:'Save',exact:true});await save.click();
  await expect(page.getByRole('button',{name:'Approve and continue',exact:true})).toBeVisible();expect(events).toEqual([]);
  await page.getByRole('button',{name:'Approve and continue',exact:true}).click();
  await expect.poll(()=>events.length).toBe(2);await expect(save).toBeEnabled();
  await save.click();await expect.poll(()=>events.length).toBe(3);expect(events).toEqual(['approve','receipt','receipt']);expect(keys[0]).toBeTruthy();expect(keys[1]).toBe(keys[0]);
});

test('paid invoice preview opens without print dialog and downloads a real PDF with settlement',async({page},info)=>{
  await prepareVisualApp(page,'ar');
  await page.addInitScript(()=>{(window as any).printCalls=0;window.print=()=>{(window as any).printCalls++}});
  const inv={id:'paid-print',orgId:visualOrgId,invoiceNumber:'EN-INV-202610020002',status:'PAID',issueDate:'2026-10-01',dueDate:'2026-10-30',currency:'USD',total:100,subtotal:100,taxTotal:0,amountPaid:100,receipts:[{number:'R-0001',date:'2026-10-02',amount:100,currency:'USD'}],lines:[{description:'خدمات الاختبار',quantity:1,unitPrice:100,subtotal:100}]};
  await page.route('**/api/invoices/paid-print',r=>r.fulfill({json:inv}));
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'شركة اختبار',country:'US',baseCurrency:'USD'}}));
  await page.route('**/api/document-templates/defaults',r=>r.fulfill({json:{}}));
  await page.goto('/print/invoice/paid-print?lang=ar');
  await expect(page.locator('.totals')).toContainText('مدفوعة بالكامل');await expect(page.locator('.totals')).toContainText('R-0001');
  expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل PDF · Download PDF'}).click();
  const file=await download;await file.saveAs(info.outputPath('paid-invoice.pdf'));
  const fs=await import('node:fs/promises');const bytes=await fs.readFile(info.outputPath('paid-invoice.pdf'));expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.length).toBeGreaterThan(10000);
  await page.screenshot({path:info.outputPath('paid-invoice.png'),fullPage:true});
});

test('receipt PDF is available without VAT or QR and never auto-prints', async ({page},info)=>{
  await prepareVisualApp(page,'ar');
  await page.addInitScript(()=>{(window as any).printCalls=0;window.print=()=>{(window as any).printCalls++}});
  await page.route('**/api/vouchers/receipt-pdf',r=>r.fulfill({json:{id:'receipt-pdf',orgId:visualOrgId,number:'R-0001',type:'RECEIPT',date:'2026-10-02',currency:'USD',amount:100,paymentMethod:'CASH'}}));
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'شركة اختبار',country:'US',baseCurrency:'USD'}}));
  await page.goto('/print/voucher/receipt-pdf?lang=ar');
  const button=page.getByRole('button',{name:'تنزيل PDF · Download PDF'}); await expect(button).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
  const download=page.waitForEvent('download');await button.click();const file=await download;await file.saveAs(info.outputPath('receipt.pdf'));
});
