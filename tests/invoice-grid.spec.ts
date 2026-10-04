import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page:any,lang:'ar'|'en') {
  await prepareVisualApp(page,lang);
  await page.setViewportSize({width:1400,height:1000});
  const invoice=(id:string,status='APPROVED')=>({id,orgId:'org-visual-system',contactId:'customer',invoiceNumber:id,status,issueDate:'2016-08-02',dueDate:'2016-08-02',supplyDate:null,updatedAt:'2026-10-02T00:00:00.000Z',currency:'USD',total:'100',subtotal:'100',amountPaid:status==='PAID'?'100':'0',notes:'Original note',termsConditions:'Keep terms',contact:{id:'customer',displayName:'Synthetic customer'},lines:[{id:id+'-line',description:'Original service',quantity:1,unitPrice:100,accountId:'rev',taxRateId:null,taxInclusive:false,discount:0}]});
  const items=[invoice('EDIT-1'),invoice('EDIT-2','PAID'),invoice('SIGNED')];
  await page.route('**/api/invoices?*',(r:any)=>r.fulfill({json:{items,total:items.length}}));
  await page.route('**/api/accounts',(r:any)=>r.fulfill({json:{items:[{id:'rev',name:'Revenue',nameAr:'إيراد عام',code:'4000',type:'REVENUE'},{id:'rev2',name:'Services',nameAr:'إيراد الخدمات',code:'4100',type:'REVENUE'}]}}));
  await page.route('**/api/invoices/*',(r:any)=>{const inv=items.find(i=>r.request().url().endsWith('/'+i.id));return inv?r.fulfill({json:inv}):r.fallback();});
  await page.route('**/api/invoices/*/amendment-policy',(r:any)=>r.fulfill({json:{canAmend:!r.request().url().includes('SIGNED'),canEditNotes:true,canReclassify:true,reason:r.request().url().includes('SIGNED')?'zatca_record':null,country:'US'}}));
  return items;
}
for(const lang of ['ar','en'] as const)test(`invoice spreadsheet selection, partial retry, protected fields and accounts (${lang})`,async({page})=>{
  const items=await setup(page,lang);const calls:string[]=[];let fail=true;
  await page.route('**/api/invoices/*/notes',r=>{
    const id=r.request().url().split('/').at(-2)!;calls.push(id);const data=r.request().postDataJSON();
    if(id==='EDIT-2'&&fail){fail=false;return r.fulfill({status:503,json:{error:'temporary_failure'}});}
    expect(data.expectedUpdatedAt).toBe('2026-10-02T00:00:00.000Z');expect(data.termsConditions).toBe('Keep terms');if(id==='SIGNED')expect(data.accounts).toEqual([{lineId:'SIGNED-line',accountId:'rev2'}]);
    const inv=items.find(i=>i.id===id)!;Object.assign(inv,{notes:data.notes,updatedAt:'2026-10-02T01:00:00.000Z'});
    return r.fulfill({json:{notes:data.notes,termsConditions:data.termsConditions,updatedAt:inv.updatedAt}});
  });
  await page.goto('/app/invoices');
  await page.getByRole('checkbox',{name:lang==='ar'?'تحديد الظاهر':'Select visible',exact:true}).check();
  await page.getByRole('button',{name:/Edit selected in table|تعديل المحدد في جدول/}).click();
  const note=(id:string)=>page.getByRole('textbox',{name:(lang==='ar'?'الملاحظات':'Notes')+' '+id,exact:true});
  await note('EDIT-1').fill('First corrected note');await note('EDIT-2').fill('Second corrected note');
  await expect(page.getByRole('textbox',{name:(lang==='ar'?'الإصدار':'Issue date')+' SIGNED',exact:true})).toBeDisabled();
  await expect(page.getByText(lang==='ar'?'مرتبط بالفوترة الإلكترونية؛ أصل الفاتورة محمي.':'Linked to e-invoicing; original invoice fields are protected.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Save changes|حفظ التعديلات/}).click();
  await expect(page.getByTestId('grid-status-EDIT-1')).toContainText(lang==='ar'?'محفوظة':'Saved');
  await expect(page.getByTestId('grid-status-EDIT-2').getByRole('alert')).toBeVisible();
  await expect(note('EDIT-2')).toHaveValue('Second corrected note');
  await page.getByRole('button',{name:/Save changes|حفظ التعديلات/}).click();
  await expect(page.getByRole('button',{name:/Save changes|حفظ التعديلات/})).toBeDisabled();
  expect(calls).toEqual(['EDIT-1','EDIT-2','EDIT-2']);
  await page.getByRole('button',{name:lang==='ar'?'البنود والحسابات':'Lines and accounts',exact:true}).click();
  await expect(page.getByRole('textbox',{name:(lang==='ar'?'السعر':'Unit price')+' SIGNED 1',exact:true})).toBeDisabled();
  await page.getByRole('row').filter({hasText:'SIGNED'}).getByRole('button',{name:lang==='ar'?'إيراد عام':'Revenue',exact:true}).click();
  await page.getByRole('button',{name:/Services|إيراد الخدمات/}).click();
  await page.getByRole('button',{name:/Save changes|حفظ التعديلات/}).click();
  await expect(page.getByTestId('grid-status-SIGNED')).toContainText(lang==='ar'?'محفوظة':'Saved');
  expect(calls).toEqual(['EDIT-1','EDIT-2','EDIT-2','SIGNED']);
  await page.screenshot({path:`/tmp/entix-grid-${lang}.png`,fullPage:true});
});

test('spreadsheet invalid historical dates retain input and no write',async({page})=>{
  await setup(page,'en');let writes=0;
  await page.route('**/api/invoices/EDIT-1/amend',r=>{writes++;return r.fulfill({status:409,json:{error:'stale_invoice'}});});
  await page.goto('/app/invoices');await page.getByRole('checkbox',{name:'Select EDIT-1',exact:true}).check();await page.getByRole('button',{name:/Edit selected in table/}).click();
  const issue=page.getByRole('textbox',{name:'Issue date EDIT-1',exact:true});
  await issue.fill('30/02/2016');await page.getByRole('button',{name:/Save changes/}).click();
  await expect(page.getByRole('alert')).toContainText('Review the dates');expect(writes).toBe(0);await expect(issue).toHaveValue('30/02/2016');
  await issue.fill('٢٩/٠٢/٢٠١٦');await page.getByRole('button',{name:/Save changes/}).click();
  await expect(page.getByRole('alert')).toBeVisible();expect(writes).toBe(1);await expect(issue).toHaveValue('٢٩/٠٢/٢٠١٦');
});

test('Excel paste updates the visible rectangle and cannot overwrite signed dates',async({page})=>{
  await setup(page,'en');await page.goto('/app/invoices');
  await page.getByRole('checkbox',{name:'Select visible',exact:true}).check();await page.getByRole('button',{name:/Edit selected in table/}).click();
  const first=page.getByRole('textbox',{name:'Issue date EDIT-1',exact:true});
  await first.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','2016-02-29\t2016-02-29\t2016-08-02\n2016-03-01\t2016-03-01\t2016-08-02\n2016-03-02\t2016-03-02\t2016-08-02');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  await expect(first).toHaveValue('2016-02-29');await expect(page.getByRole('textbox',{name:'Issue date EDIT-2',exact:true})).toHaveValue('2016-03-01');await expect(page.getByRole('textbox',{name:'Issue date SIGNED',exact:true})).toHaveValue('2016-08-02');
});

test('chart loading failure blocks editing and retry restores account choices',async({page})=>{
  await setup(page,'en');await page.goto('/app/invoices');
  await page.route('**/api/accounts',r=>r.fulfill({status:503,json:{error:'temporary_failure'}}));
  await page.getByRole('checkbox',{name:'Select EDIT-1',exact:true}).check();await page.getByRole('button',{name:/Edit selected in table/}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:/Save changes/})).toHaveCount(0);
  await page.unroute('**/api/accounts');await page.route('**/api/accounts',r=>r.fulfill({json:{items:[{id:'rev',name:'Revenue',code:'4000',type:'REVENUE'}]}}));
  await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('textbox',{name:'Issue date EDIT-1',exact:true})).toBeVisible();
});
