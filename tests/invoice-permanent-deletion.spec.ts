import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page:Page,lang:'ar'|'en'='en') {
  await prepareVisualApp(page,lang);
  const invoices=['CANCELLED','DRAFT','APPROVED','PAID'].map(status=>({id:status,orgId:'org-visual-system',invoiceNumber:`DELETE-${status}`,status,contactId:'buyer',contact:{id:'buyer',displayName:'Synthetic buyer'},currency:'USD',total:'100',amountPaid:status==='PAID'?'100':'0',issueDate:'2016-08-02',dueDate:'2016-08-02',updatedAt:'2026-10-05T00:00:00.000Z',lines:[]}));
  const writes:any[]=[];const deleted=new Set<string>();let fail=false;
  await page.route('**/api/invoices?*',r=>r.fulfill({json:{items:invoices.filter(i=>!deleted.has(i.id)),total:invoices.length-deleted.size}}));
  await page.route('**/api/invoices/*',r=>{const id=r.request().url().split('/').at(-1)!;const inv=invoices.find(i=>i.id===id);return inv&&!deleted.has(id)?r.fulfill({json:inv}):r.fulfill({status:404,json:{error:'not_found'}})});
  await page.route('**/api/invoices/*/amendment-policy',r=>r.fulfill({json:{canVoidAdmin:false,canAmend:false,country:'US',reason:'invoice_state'}}));
  await page.route('**/api/invoices/*/deletion-policy',r=>{const id=r.request().url().split('/').at(-2)!;return r.fulfill({json:{canDeletePermanently:id!=='PAID',reason:id==='PAID'?'receipts_exist':null,expectedUpdatedAt:'2026-10-05T00:00:00.000Z',reversesLedger:id==='APPROVED'}})});
  await page.route('**/api/invoices/*/delete-permanently',r=>{const id=r.request().url().split('/').at(-2)!;writes.push({id,...r.request().postDataJSON()});if(fail){fail=false;return r.fulfill({status:503,json:{error:'temporary_failure'}})}deleted.add(id);return r.fulfill({json:{deleted:true,id}})});
  return {writes,deleted,setFailure:()=>{fail=true}};
}
for(const lang of ['ar','en'] as const) test(`cancelled invoice has real permanent deletion and disappears after reload (${lang})`,async({page})=>{
  const {writes}=await setup(page,lang);await page.goto('/app/invoices');
  await page.getByRole('row').filter({hasText:'DELETE-CANCELLED'}).getByTestId('invoice-row-remove').click();
  await expect(page.getByRole('radio',{name:lang==='ar'?'حذف نهائي':'Permanent deletion',exact:true})).toBeChecked();
  await expect(page.getByTestId('removal-CANCELLED')).toContainText(lang==='ar'?'حذف نهائي':'Permanent deletion');
  expect(writes).toHaveLength(0);
  await page.getByRole('button',{name:lang==='ar'?'حذف المحدد (1)':'Delete selected (1)',exact:true}).click();
  await expect(page.getByText(lang==='ar'?'حذف 1 فاتورة وأي إشعارات مرتبطة اخترتها صراحةً نهائيًا؟ لا يمكن التراجع.':'Permanently delete 1 invoice(s) and any explicitly selected linked credits? This cannot be undone.',{exact:true})).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole('button',{name:lang==='ar'?'نعم':'Yes',exact:true}).click();
  await expect(page.getByTestId('removal-CANCELLED')).toContainText(lang==='ar'?'تم الحذف النهائي':'Permanently deleted');
  expect(writes).toEqual([{id:'CANCELLED',expectedUpdatedAt:'2026-10-05T00:00:00.000Z',confirmInvoiceNumber:'DELETE-CANCELLED'}]);
  await page.getByRole('button',{name:lang==='ar'?'رجوع':'Back',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'DELETE-CANCELLED'})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('row').filter({hasText:'DELETE-CANCELLED'})).toHaveCount(0);
});
test('batch deletion retains failures, blocks paid invoice and retries only unfinished records',async({page})=>{
  const {writes,setFailure}=await setup(page);setFailure();await page.goto('/app/invoices');await page.getByRole('checkbox',{name:'Select visible',exact:true}).check();await page.getByRole('button',{name:'Delete / void selected',exact:true}).click();
  await expect(page.getByTestId('removal-PAID')).toContainText('Linked payments');
  await expect(page.getByTestId('removal-APPROVED')).toContainText('reversed');
  await page.getByRole('button',{name:'Delete selected (3)',exact:true}).click();await page.getByRole('button',{name:'Yes',exact:true}).click();
  await expect(page.getByTestId('removal-CANCELLED').getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('removal-DRAFT')).toContainText('Permanently deleted');
  await expect(page.getByTestId('removal-APPROVED')).toContainText('Permanently deleted');
  await page.getByRole('button',{name:'Delete selected (1)',exact:true}).click();await page.getByRole('button',{name:'Yes',exact:true}).click();
  await expect(page.getByTestId('removal-CANCELLED')).toContainText('Permanently deleted');
  expect(writes.map(x=>x.id)).toEqual(['CANCELLED','DRAFT','APPROVED','CANCELLED']);
});

for (const lang of ['ar','en'] as const) test(`linked credit deletion requires explicit consent and stale review sends no write (${lang})`,async({page})=>{
  const {writes}=await setup(page,lang);let stamp='2026-10-05T00:00:00.000Z';
  await page.route('**/api/invoices/APPROVED/deletion-policy',r=>r.fulfill({json:{canDeletePermanently:false,reason:'credit_note',reversesLedger:true,linkedCreditDeletion:{canDelete:true,reason:null,notes:[{id:'credit-1',noteNumber:'CN-SYNTHETIC',status:'ISSUED',total:'100',currency:'USD',expectedUpdatedAt:stamp}]}}}));
  await page.goto('/app/invoices');await page.getByRole('row').filter({hasText:'DELETE-APPROVED'}).getByTestId('invoice-row-remove').click();
  const row=page.getByTestId('removal-APPROVED');
  await expect(page.getByRole('button',{name:lang==='ar'?'حذف المحدد (0)':'Delete selected (0)',exact:true})).toBeDisabled();
  await expect(row.getByRole('link',{name:'CN-SYNTHETIC',exact:true})).toBeVisible();
  const consent=row.getByRole('checkbox');await expect(consent).not.toBeChecked();await consent.check();
  await page.getByLabel(lang==='ar'?'سبب الحذف أو الإلغاء':'Reason for deletion or voiding').fill('Remove synthetic test and correction');
  await page.screenshot({path:`/tmp/entix-linked-deletion-${lang}.png`,fullPage:true});
  stamp='2026-10-05T01:00:00.000Z';
  await page.getByRole('button',{name:lang==='ar'?'حذف المحدد (1)':'Delete selected (1)',exact:true}).click();
  await page.getByRole('button',{name:lang==='ar'?'نعم':'Yes',exact:true}).click();
  await expect(row.getByRole('alert')).toBeVisible();expect(writes).toHaveLength(0);
  await row.getByRole('button',{name:lang==='ar'?'إعادة التحقق':'Recheck',exact:true}).click();
  await expect(consent).not.toBeChecked();await consent.check();
  await page.getByRole('button',{name:lang==='ar'?'حذف المحدد (1)':'Delete selected (1)',exact:true}).click();
  await page.getByRole('button',{name:lang==='ar'?'نعم':'Yes',exact:true}).click();
  await expect(row).toContainText(lang==='ar'?'تم الحذف النهائي':'Permanently deleted');
  expect(writes[0].linkedCredits).toEqual([{id:'credit-1',expectedUpdatedAt:stamp}]);expect(writes).toHaveLength(1);
});
