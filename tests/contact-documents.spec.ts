import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function prepare(page: Page, language: 'ar'|'en') {
  await prepareVisualApp(page, language);
  const summary = { contact: { id:'contact-a',displayName:'Test contact',country:'US',defaultCurrency:'USD',isCustomer:true }, totals:{ invoices:{count:0,total:0},bills:{count:0,total:0},receipts:{count:0,total:0},payments:{count:0,total:0},balance:0,arOpen:0,apOpen:0 }, invoices:[],bills:[],quotes:[],vouchers:[],expenses:[] };
  await page.route('**/api/contacts/contact-a/summary',r=>r.fulfill({json:summary}));
  const files:any[]=[];
  let fail=false;
  await page.route('**/api/contacts/contact-a/attachments**',async r=>{
    const suffix=new URL(r.request().url()).pathname.split('/attachments')[1];
    if(r.request().method()==='POST') {
      const body=r.request().postDataJSON();
      if(fail) return r.fulfill({status:500,json:{error:'upload_failed'}});
      const file={id:`file-${files.length}`,filename:body.filename,contentType:body.contentType,sizeBytes:9,createdAt:'2026-09-26',url:`data:${body.contentType};base64,${body.data}`}; files.push(file);return r.fulfill({status:201,json:file});
    }
    if(r.request().method()==='DELETE'){files.splice(files.findIndex(f=>`/${f.id}`===suffix),1);return r.fulfill({status:204});}
    if(suffix) return r.fulfill({json:files.find(f=>`/${f.id}`===suffix)});
    return r.fulfill({json:{items:files.map(({url,...file})=>file)}});
  });
  return {setFailure:()=>{fail=true;}};
}
for(const language of ['ar','en'] as const) test(`contact documents: legacy link, upload, preview, reload, delete (${language})`,async({page})=>{
  await prepare(page,language);
  await page.goto('/app/files/upload?contactId=contact-a');
  await expect(page).toHaveURL(/\/app\/contacts\/contact-a\?tab=documents/);
  const section=page.getByTestId('contact-documents');
  await expect(section).toBeVisible();
  await section.locator('input[type=file]').setInputFiles([{name:'contract.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')},{name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('notes')}]);
  await expect(section.getByRole('button',{name:/contract.pdf/}).first()).toBeVisible();
  await page.reload();
  await section.getByRole('button',{name:/contract.pdf/}).first().click();
  await expect(section.locator('iframe')).toHaveAttribute('src',/blob:.*#navpanes=0&view=Fit/);
  await expect(section.getByRole('link',{name:language==='ar'?'تنزيل':'Download',exact:true})).toBeVisible();
  await section.getByRole('button',{name:`${language==='ar'?'حذف':'Delete'} contract.pdf`,exact:true}).click();
  await section.getByRole('button',{name:language==='ar'?'نعم':'Yes',exact:true}).click();
  await expect(section.getByRole('button',{name:/contract.pdf/})).toHaveCount(0);
  await expect(section.getByRole('button',{name:/notes.txt/}).first()).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('upload failure remains on the contact with an actionable message',async({page})=>{
  const fixture=await prepare(page,'en');fixture.setFailure();await page.goto('/app/contacts/contact-a?tab=documents');
  await page.getByTestId('contact-documents').locator('input[type=file]').setInputFiles({name:'failed.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')});
  await expect(page.getByRole('alert')).toContainText('Upload failed');await expect(page).toHaveURL(/contacts\/contact-a/);
});
for(const language of ['ar','en'] as const) test(`estimate action labels remain on one line (${language})`,async({page})=>{
  await prepareVisualApp(page,language);
  await page.route('**/api/estimates**',r=>r.fulfill({json:{items:[{id:'est-a',number:'EST-2026-01',title:'دراسة مشروع',status:'DRAFT',costTotal:'100',saleSubtotal:'120',marginPct:'16.67',createdAt:'2026-09-26',contact:{displayName:'Test'}}]}}));
  await page.goto('/app/estimates');
  for(const width of [1024,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    const edit=page.getByTestId('estimate-edit');await expect(edit).toBeVisible();
    const box=await edit.evaluate(el=>{const s=el.querySelector('span')!,td=el.closest('td')!,b=el.getBoundingClientRect(),c=td.getBoundingClientRect();return{height:s.getBoundingClientRect().height,line:parseFloat(getComputedStyle(s).lineHeight),fits:b.left>=c.left&&b.right<=c.right};});
    expect(box.height).toBeLessThanOrEqual(box.line+1);expect(box.fits).toBe(true);
  }
  await page.screenshot({path:`test-results/estimate-actions-${language}.png`,fullPage:true});
});
