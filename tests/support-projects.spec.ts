import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
for(const lang of ['ar','en'] as const) test(`support saves a request, reads human replies and resolves it (${lang})`,async({page})=>{
 await prepareVisualApp(page,lang);let ticket:any=null;
 await page.route('**/api/public/support/portal**',async r=>{
  const method=r.request().method(),path=new URL(r.request().url()).pathname;
  if(method==='POST'&&path.endsWith('/portal')){const body=r.request().postDataJSON();ticket={id:'t1',subject:body.subject,status:'OPEN',updatedAt:new Date().toISOString(),messages:[{id:'m1',authorType:'CUSTOMER',body:body.body,createdAt:new Date().toISOString()},{id:'m2',authorType:'ADMIN',body:'We are reviewing your PDF report.',createdAt:new Date().toISOString()}]};return r.fulfill({json:{ticket}});}
  if(method==='PATCH'){ticket.status=r.request().postDataJSON().status;return r.fulfill({json:{ok:true}});}
  return r.fulfill({json:path.endsWith('/portal')?{items:ticket?[ticket]:[]}:{ticket}});
 });
 await page.goto('/app/help');
 await page.getByRole('button',{name:lang==='ar'?'محادثة جديدة':'New conversation',exact:true}).click();
 await page.getByLabel(lang==='ar'?'عنوان الطلب':'Subject',{exact:true}).fill('Report PDF');
 await page.getByLabel(lang==='ar'?'كيف نقدر نساعدك؟':'How can we help?',{exact:true}).fill('Cannot print');
 await page.getByRole('button',{name:lang==='ar'?'إرسال للدعم':'Send to support',exact:true}).click();
 await expect(page.getByText('We are reviewing your PDF report.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:lang==='ar'?'تم حل المشكلة':'Mark resolved',exact:true}).click();
 await expect(page.getByRole('button',{name:lang==='ar'?'إعادة فتح':'Reopen',exact:true})).toBeVisible();
 await page.screenshot({path:`/tmp/entix-support-${lang}.png`,fullPage:true});
});
test('projects dashboard shows due dates, elapsed time and actual completion',async({page})=>{
 await prepareVisualApp(page,'en');
 await page.route('**/api/projects',r=>r.fulfill({json:{items:[{id:'p1',code:'PRJ-001',name:'Engineering project',status:'ACTIVE',startDate:'2026-01-01',endDate:'2026-01-10',percentComplete:35},{id:'p2',code:'PRJ-002',name:'Completed job',status:'COMPLETED',percentComplete:100}]}}));
 await page.goto('/app/projects');await expect(page.getByText('35%',{exact:true})).toBeVisible();await expect(page.getByText(/days overdue/)).toBeVisible();await page.getByRole('combobox',{name:'Project status'}).selectOption('COMPLETED');await expect(page.getByText('Engineering project',{exact:true})).not.toBeVisible();await expect(page.getByText('Completed job',{exact:true})).toBeVisible();
});
test('support portal fits a small Arabic screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await prepareVisualApp(page,'ar');
 await page.route('**/api/public/support/portal',r=>r.fulfill({json:{items:[]}}));await page.goto('/app/help');
 await page.getByRole('button',{name:'محادثة جديدة',exact:true}).click();await expect(page.getByLabel('عنوان الطلب',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('issued invoices visibly prepare a payment link and include it when composing email',async({page})=>{
 await prepareVisualApp(page,'en');let prepared=0;
 const inv:any={id:'inv-payment',orgId:'org-visual-system',contactId:'c1',invoiceNumber:'INV-100',status:'APPROVED',issueDate:'2026-09-01',dueDate:'2026-09-30',currency:'USD',exchangeRate:'1',subtotal:'100',taxTotal:'0',total:'100',amountPaid:'0',contact:{id:'c1',displayName:'Customer',email:'customer@example.com'},lines:[{id:'l1',description:'Service',quantity:1,unitPrice:'100',subtotal:'100'}],paymentLinkUrl:null};
 await page.route('**/api/invoices/inv-payment',r=>r.fulfill({json:inv}));
 await page.route('**/api/document-sends?*',r=>r.fulfill({json:{items:[]}}));
 await page.route('**/api/payment-links/invoice/inv-payment',r=>{prepared++;inv.paymentLinkUrl='https://checkout.stripe.com/c/pay/cs_test_example';inv.paymentLinkProvider='stripe';return r.fulfill({json:{url:inv.paymentLinkUrl,id:'cs_test_example',provider:'stripe'}})});
 await page.goto('/app/invoices/inv-payment');await page.getByRole('button',{name:'Prepare / refresh payment link',exact:true}).click();
 await expect(page.getByRole('link',{name:/Open payment link/})).toHaveAttribute('href',inv.paymentLinkUrl);expect(prepared).toBe(1);
 await page.getByTestId('issued-invoice-send').click();await expect(page.getByText(/payment link is included/i)).toBeVisible();
});
