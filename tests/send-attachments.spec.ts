import { writeFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
const invoice={id:'mail-invoice',orgId:visualOrgId,contactId:'mail-contact',invoiceNumber:'QA-MAIL-001',language:'en',status:'APPROVED',issueDate:'2026-08-02',dueDate:'2026-08-02',currency:'USD',exchangeRate:'1',subtotal:'163',taxTotal:'0',total:'163',amountPaid:'163',contact:{id:'mail-contact',displayName:'Synthetic customer',email:'client@example.invalid'},lines:[{id:'line',description:'Synthetic service',quantity:1,unitPrice:163,subtotal:163}],receipts:[{id:'mail-receipt',number:'QA-RCP-001',amount:'163',date:'2026-08-02',currency:'USD'}]};
async function setup(page:Page, failPdf=false){
  await prepareVisualApp(page,'en');const sent:any[]=[];
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'Synthetic Company',legalName:'Synthetic Company LLC',country:'US',baseCurrency:'USD',defaultInvoiceLanguage:'en'}}));
  await page.route('**/api/invoices/mail-invoice',r=>r.fulfill({json:invoice}));
  await page.route('**/api/contacts/mail-contact',r=>r.fulfill({json:invoice.contact}));
  await page.route('**/api/document-templates/resolve',r=>r.fulfill({json:{templateId:null}}));
  await page.route('**/api/vouchers/mail-receipt',r=>r.fulfill({json:{id:'mail-receipt',orgId:visualOrgId,number:'QA-RCP-001',type:'RECEIPT',date:'2026-08-02',amount:'163',currency:'USD',paymentMethod:'CASH'}}));
  await page.route('**/api/document-sends?**',r=>r.fulfill({json:{items:[]}}));
  await page.route('**/api/document-sends/attachment-options?**',r=>r.fulfill({json:{items:[{id:'support',filename:'supporting.pdf',sizeBytes:100,available:true},{id:'remote',filename:'remote-only.pdf',sizeBytes:100,available:false}]}}));
  await page.route('https://api.entix.io/api/document-sends',r=>{sent.push(r.request().postDataJSON());return r.fulfill({status:502,json:{error:'send_failed',message:'Synthetic delivery failure'}});});
  if(failPdf) await page.route('**/print/invoice/mail-invoice?**',r=>r.fulfill({contentType:'text/html',body:'<div data-document-ready="true">No document sheets</div>'}));
  await page.goto('/app/invoices/mail-invoice');await page.getByTestId('issued-invoice-send').click();
  await expect(page.getByLabel('supporting.pdf',{exact:false})).toBeVisible();return sent;
}
test('actual invoice and receipt PDF bytes plus selected files reach the delivery API; retry preserves payload',async({page},info)=>{
  test.setTimeout(120000);const sent=await setup(page);
  await page.getByTestId('send-include-receipts').check();
  await page.getByLabel('supporting.pdf',{exact:false}).check();
  await expect(page.getByLabel('remote-only.pdf',{exact:false})).toBeDisabled();
  await page.locator('#send-files').setInputFiles({name:'support.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic supporting file')});
  await page.getByTestId('send-compose-submit').click();
  await expect(page.getByText('Synthetic delivery failure').first()).toBeVisible({timeout:55000});
  expect(sent).toHaveLength(1);expect(sent[0].attachmentIds).toEqual(['support']);
  expect(sent[0].attachments.map((a:any)=>a.filename)).toEqual(['QA-MAIL-001-with-receipts.pdf','support.txt']);
  const pdf=Buffer.from(sent[0].attachments[0].content,'base64');expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBeGreaterThanOrEqual(2);
  await writeFile(info.outputPath('actual-email-attachment.pdf'),pdf);
  await info.attach('actual-email-attachment.pdf',{body:pdf,contentType:'application/pdf'});
  expect(Buffer.from(sent[0].attachments[1].content,'base64').toString()).toBe('Synthetic supporting file');
  await page.getByTestId('send-compose-submit').click();await expect.poll(()=>sent.length).toBe(2);
  expect(sent[1]).toEqual(sent[0]);
  await page.screenshot({path:info.outputPath('composer.png'),fullPage:true});
});
test('PDF failure blocks both sending and draft creation without clearing input',async({page})=>{
  const sent=await setup(page,true);
  for(const action of ['submit','draft']){
    await page.getByTestId(`send-compose-${action}`).click();
    await expect(page.getByText('Could not prepare attachments or send the message.',{exact:false}).first()).toBeVisible();
    expect(sent).toHaveLength(0);await expect(page.getByTestId('send-compose-to')).toHaveValue('client@example.invalid');
  }
});
