import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
for(const kind of ['expenses','bills'] as const) test(`${kind}: paid document notes save independently of locked financials`,async({page})=>{
 await prepareVisualApp(page,'ar');
 const row:any={id:'note-doc',number:'EXP-NOTES',billNumber:'BILL-NOTES',status:'PAID',externalId:'stripe:synthetic',date:'2026-09-15',issueDate:'2026-09-15',currency:'USD',amount:100,subtotal:100,total:115,taxAmount:15,taxTotal:15,amountPaid:115,paymentMethod:'CASH',vendorName:'Synthetic supplier',category:'Services',lines:[],lineItems:[],attachments:[],paymentSplits:[],notes:'قبل التعديل',updatedAt:'2026-10-01T00:00:00.000Z'};
 const writes:any[]=[];
 await page.route(`**/api/${kind}**`,r=>{const path=new URL(r.request().url()).pathname;
   if(path.endsWith('/notes')){if(r.request().method()==='PATCH'){const body=r.request().postDataJSON();expect(Object.keys(body).sort()).toEqual(['expectedUpdatedAt','notes']);writes.push(body);row.notes=body.notes;row.updatedAt='2026-10-02T00:00:00.000Z'}return r.fulfill({json:{notes:row.notes,updatedAt:row.updatedAt,canEdit:true}})}
   expect(r.request().method()).toBe('GET');
   return r.fulfill({json:path.endsWith('/attachments')?{items:[]}:path.endsWith('/note-doc')?row:{items:[row],total:1,summary:{}}});
 });
 await page.goto(kind==='bills'?'/app/purchases/bills/note-doc':'/app/expenses/note-doc');
 const panel=page.getByRole('region',{name:'ملاحظات المستند',exact:true});await panel.getByRole('button',{name:'تعديل الملاحظات',exact:true}).click();
 await panel.getByRole('textbox',{name:'الملاحظات',exact:true}).fill('تمت مراجعة المرفقات');await panel.getByRole('button',{name:'حفظ الملاحظات',exact:true}).click();
 await expect(panel.getByRole('status')).toHaveText('حُفظت الملاحظات وتم التحقق منها.');expect(writes).toHaveLength(1);expect(row.total).toBe(115);expect(row.status).toBe('PAID');
 await expect(panel.getByText('تمت مراجعة المرفقات',{exact:true})).toBeVisible();
 await page.screenshot({path:`/tmp/entix-notes-${kind}.png`,fullPage:true});
});
