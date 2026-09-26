import {test,expect,type Page} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';

async function setup(page:Page,language:'ar'|'en') {
  await prepareVisualApp(page,language);
  const ex={issuer:{name:'OpenRouter, Inc'},documentNumber:'1658-1021',issueDate:'2026-09-26',currency:'USD',lines:[{description:'AI credits',quantity:1,unitPrice:10.8,taxRate:0}],totals:{subtotal:10.8,tax:0,total:10.8}};
  let mail:any={id:'mail-a',subject:'Forwarded receipt',fromAddress:'vendor@example.com',toAddress:'bills@example.com',from:'vendor@example.com',createdAt:'2026-09-26',status:'REJECTED',billId:null,expenseId:null,bodyHtml:'<meta http-equiv="refresh" content="0;url=https://bad.example"><p>OpenRouter receipt USD 10.80</p><script>parent.alert(1)</script><img src="https://bad.example/pixel"><a href="https://bad.example">Payment link</a>',bodyText:'Receipt USD 10.80',attachments:[{id:'file-a',filename:'receipt.pdf',contentType:'application/pdf',sizeBytes:9}],extractedJson:ex,reviewNotes:'',rejectionReason:null};
  const writes:any[]=[];
  await page.route('**/api/inbox**',async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path==='/api/inbox/status')return r.fulfill({json:{address:'bills@example.com',configured:true}});
    if(path.endsWith('/duplicate-check'))return r.fulfill({json:{possibleDuplicate:false}});
    if(path.endsWith('/attachments/file-a'))return r.fulfill({json:{name:'receipt.pdf',type:'application/pdf',url:'data:application/pdf;base64,JVBERi10ZXN0'}});
    if(path.endsWith('/source'))return r.fulfill({json:{notes:mail.reviewNotes,files:[{name:'receipt.pdf',contentType:'application/pdf',base64:'JVBERi10ZXN0',sizeBytes:9},{name:'email-mail-a.txt',contentType:'text/plain',base64:'UmVjZWlwdA==',sizeBytes:7}]}});
    if(path.endsWith('/reopen')){mail.status='EXTRACTED';return r.fulfill({json:{ok:true}});}
    if(path.endsWith('/review')){const b=r.request().postDataJSON();writes.push(b);mail={...mail,reviewNotes:b.notes,extractedJson:b.extracted||mail.extractedJson};return r.fulfill({json:{ok:true}});}
    if(path.endsWith('/mail-a'))return r.fulfill({json:mail});
    return r.fulfill({json:{items:[mail]}});
  });
  const expenses:any[]=[];
  await page.route('**/api/expenses**',r=>{if(r.request().method()==='POST'){expenses.push(r.request().postDataJSON());return r.fulfill({json:{id:'expense-a',...expenses[0]}})}return r.fulfill({json:{items:[],summary:{sumTotal:0,avgTotal:0},total:0}})});
  return {writes,expenses};
}
for(const language of ['ar','en'] as const)test(`read rejected email, reopen, review and carry source to expense (${language})`,async({page})=>{
  const {writes,expenses}=await setup(page,language);
  await page.goto('/app/inbox');
  await page.getByRole('button',{name:/vendor@example.com/}).click();
  await expect(page).toHaveURL(/message=mail-a/);
  const frame=page.frameLocator(`iframe[title="${language==='ar'?'محتوى البريد':'Email content'}"]`);
  await expect(frame.getByText('OpenRouter receipt USD 10.80')).toBeVisible();
  await expect(frame.locator('script,meta[http-equiv=refresh],a[href]')).toHaveCount(0);
  await page.getByRole('button',{name:/receipt.pdf/}).click();
  await expect(page.locator('iframe[src^="blob:"]')).toHaveCount(1);
  await expect(page.getByText(language==='ar'?/لم يُسجّل سبب/:/No reason was recorded/)).toBeVisible();
  await page.getByRole('button',{name:language==='ar'?'إعادة فتح للمراجعة':'Reopen for review'}).click();
  await expect(page.getByRole('button',{name:language==='ar'?'إعادة فتح للمراجعة':'Reopen for review'})).toHaveCount(0);
  const review=page.getByRole('region',{name:language==='ar'?'مراجعة الرسالة':'Message review'});
  await review.locator('textarea').fill('Confirmed by accounts');
  await expect(page.getByRole('button',{name:language==='ar'?'تحويل إلى مصروف':'Create expense',exact:true})).toBeDisabled();
  await review.getByRole('button',{name:language==='ar'?'تعديل بيانات الفاتورة والبنود':'Edit bill details and lines'}).click();
  await review.getByLabel(language==='ar'?'المورد':'Supplier', {exact:true}).fill('OpenRouter');
  await review.getByRole('button',{name:language==='ar'?'حفظ المراجعة':'Save review'}).click();
  await expect.poll(()=>writes.length).toBe(1);expect(writes[0].notes).toBe('Confirmed by accounts');expect(writes[0].extracted.issuer.name).toBe('OpenRouter');
  await page.screenshot({path:`test-results/inbox-review-${language}.png`,fullPage:true});
  await page.getByRole('button',{name:language==='ar'?'تحويل إلى مصروف':'Create expense',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/expenses\/new/);
  await expect(page.getByText('receipt.pdf',{exact:true}).first()).toBeVisible();

  await expect(page.locator('input[value="OpenRouter"]')).toBeVisible();
  await page.getByRole('button',{name:language==='ar'?'حفظ كمسودة':'Save as draft',exact:true}).click();
  await expect.poll(()=>expenses.length).toBe(1);
  expect(expenses[0].attachments.map((f:any)=>f.name)).toEqual(['receipt.pdf','email-mail-a.txt']);
  expect(expenses[0].notes).toBe('Confirmed by accounts');
  expect(expenses[0].extractedJson.__fromInbox).toBe('mail-a');
  expect(expenses[0].currency).toBe('USD');
  expect(expenses[0].totalAmount).toBe(10.8);
});
