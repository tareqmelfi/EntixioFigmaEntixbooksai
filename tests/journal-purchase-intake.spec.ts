import { expect, test, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
const candidate = { id:'journal-review',number:'JE-REVIEW',date:'2026-09-15T00:00:00.000Z',description:'Synthetic supplier invoice',currency:'USD',subtotal:'100',taxTotal:'15',total:'115',branchId:null,projectId:null,fingerprint:'a'.repeat(64),eligible:true,lines:[{accountId:'expense',description:'Consulting',quantity:1,unitPrice:100}] };
const supplier = {id:'supplier',displayName:'Synthetic Supplier',type:'SUPPLIER',email:'supplier@example.invalid'};
async function prepare(page: Page, lang: 'ar'|'en', fail = false) {
  await prepareVisualApp(page,lang);
  const writes: any[] = [];
  await page.route('**/api/contacts**',r=>r.fulfill({json:{items:[supplier],total:1}}));
  await page.route('**/api/bills**',async r=>{
    const path=new URL(r.request().url()).pathname;
    if(r.request().method()==='POST') {writes.push(r.request().postDataJSON());return r.fulfill({status:fail?409:201,json:fail?{error:'journal_source_changed',message:'The journal changed; refresh and review.',messageAr:'تغير القيد؛ حدّث القائمة وراجع الربط.'}:{id:'linked-bill'}});}
    if(path==='/api/bills/linked-bill') return r.fulfill({json:{id:'linked-bill',billNumber:'PB-JE-REVIEW',status:'DUE',contactId:supplier.id,contact:supplier,issueDate:candidate.date,dueDate:'2026-10-15',currency:'USD',total:115,subtotal:100,taxTotal:15,amountPaid:0,lines:[{...candidate.lines[0],id:'line',subtotal:115,taxRate:{rate:0.15}}],meta:{sourceJournalId:candidate.id,sourceJournalNumber:candidate.number}}});
    return r.fulfill({json:{items:[],total:0,journalCandidates:{items:[candidate,{...candidate,id:'compound',number:'JE-CASH',eligible:false}],hasMore:false}}});
  });
  await page.route('**/api/journals**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/coverage') ? {linked:true,unposted:{invoices:0,bills:0,expenses:0,receipts:0,payments:0}} : {id:candidate.id,number:candidate.number,date:candidate.date,description:candidate.description,source:'api',status:'POSTED',totalDebit:115,totalCredit:115,lines:[],attachments:[],items:[],total:0}}));
  await page.goto('/app/purchases/bills?journalId=journal-review');
  return writes;
}
for(const lang of ['en','ar'] as const) test(`journal purchase review preserves source metadata and navigates to linked invoice (${lang})`,async({page})=>{
  const writes=await prepare(page,lang);
  const region=page.getByRole('region',{name:lang==='ar'?'قيود المشتريات غير المرتبطة':'Unlinked purchase journals'});
  await expect(region).toContainText('JE-REVIEW'); await expect(region).toContainText('JE-CASH'); expect(writes).toHaveLength(0);
  await region.getByRole('button',{name:lang==='ar'?'استكمال وربط الفاتورة':'Complete and link invoice'}).click();
  await region.getByRole('button',{name:lang==='ar'?'ابحث أو أنشئ موردًا':'Search or create a supplier'}).click();
  await page.getByRole('button',{name:'Synthetic Supplier supplier@example.invalid'}).click();
  await region.getByLabel(lang==='ar'?'رقم فاتورة المورد':'Supplier invoice number').fill('SUP-55');
  await region.getByLabel(lang==='ar'?'تاريخ الاستحقاق':'Due date').fill('2026-10-15');
  await region.getByLabel(lang==='ar'?'الضريبة % — بند 1':'Tax % — line 1').fill('15');
  await region.getByRole('checkbox').check();
  await page.screenshot({path:`/tmp/journal-link-review-${lang}.png`,fullPage:true});
  await region.getByRole('button',{name:lang==='ar'?'ربط بالقيد الموجود':'Link to existing journal'}).click();
  await expect(page).toHaveURL(/purchases\/bills\/linked-bill/);
  expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({sourceJournalId:candidate.id,sourceJournalFingerprint:candidate.fingerprint,status:'DUE',confirmUnpaidPurchase:true,supplierDocNumber:'SUP-55',currency:'USD',issueDate:candidate.date,lines:[{accountId:'expense',unitPrice:100,quantity:1,taxRate:0.15,taxInclusive:false}]});
  const backlink=page.getByRole('link',{name:'JE-REVIEW',exact:true});await expect(backlink).toBeVisible();await backlink.click();
  await expect(page).toHaveURL(/journal-entries\?entryId=journal-review/);
  await expect(page.getByRole('link',{name:lang==='ar'?'مراجعة وربط فاتورة مشتريات':'Review and link purchase invoice'})).toBeVisible();
});
test('a rejected link keeps review details and displays the server reason',async({page})=>{
  const writes=await prepare(page,'en',true);
  const region=page.getByRole('region',{name:'Unlinked purchase journals'});
  await region.getByRole('button',{name:'Complete and link invoice'}).click();
  await region.getByRole('button',{name:'Search or create a supplier'}).click();await page.getByRole('button',{name:'Synthetic Supplier supplier@example.invalid'}).click();
  await region.getByLabel('Supplier invoice number').fill('SUP-55');await region.getByLabel('Due date').fill('2026-10-15');await region.getByLabel('Tax % — line 1').fill('15');await region.getByRole('checkbox').check();
  await region.getByRole('button',{name:'Link to existing journal'}).click();await expect(region.getByRole('alert')).toContainText('The journal changed');await expect(region.getByLabel('Supplier invoice number')).toHaveValue('SUP-55');expect(writes).toHaveLength(1);
});
test('review fits mobile and viewing a source makes no writes',async({page})=>{
  const writes=await prepare(page,'ar');await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'قيود المشتريات غير المرتبطة'});await region.getByRole('button',{name:'استكمال وربط الفاتورة'}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(writes).toHaveLength(0);
});
