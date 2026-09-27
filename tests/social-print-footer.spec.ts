import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { renderDocument, sampleInput, partyFromOrg } from '../src/app/lib/document-render';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
const links = ['instagram','x','facebook','whatsapp','linkedin','youtube','tiktok'].map(platform=>({platform,url:`https://example.com/${platform}?utm_source=test`}));
for(const lang of ['ar','en'] as const) for(const placement of ['last','first','all','none'] as const) test(`social footer PDF pages, bounds and links ${lang} ${placement}`,async({page},info)=>{
  for(const kind of ['QUOTE','INVOICE'] as const){
    const base=sampleInput(kind,lang,{themePreset:'ink-white',headerStyle:'centered'});
    const rendered=renderDocument({...base,org:{...base.org,...partyFromOrg({name:'Synthetic company',socialLinks:links,brandTheme:{socialFooter:{pages:placement,size:'large',align:'center'}}})},fontBase:'/fonts'});
    await page.route('**/social-preview',r=>r.fulfill({contentType:'text/html',body:rendered.html}));
    await page.goto('/social-preview');await page.evaluate(()=>document.fonts.ready);
    const sheets=page.locator('.sheet');const count=await sheets.count();
    const expected=placement==='none'?0:placement==='all'?count:1;
    await expect(page.locator('.document-social-footer')).toHaveCount(expected);
    if(placement!=='none'){
      const index=placement==='last'?count-1:0;
      await expect(sheets.nth(index).locator('.document-social-footer a')).toHaveCount(7);
      await expect(sheets.nth(index).locator('.document-social-footer')).not.toContainText('utm_source');
      expect(await page.locator('.social-band').evaluateAll(bands=>bands.every(b=>{
        const r=b.getBoundingClientRect(),s=b.closest('.sheet')!.getBoundingClientRect(),f=b.closest('.sheet')!.querySelector('.ftr')?.getBoundingClientRect();
        return r.bottom<=s.bottom && r.left>=s.left && r.right<=s.right && (!f||r.bottom<=f.top);
      }))).toBe(true);
      await sheets.nth(index).screenshot({path:info.outputPath(`${kind}.png`)});
    }
    const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(count);
    expect((bytes.toString('latin1').match(/\/URI \(https:\/\/example.com\//g)||[]).length).toBe(expected*7);
  }
});
test('footer controls persist with social links and reload correctly',async({page})=>{
  await prepareVisualApp(page,'en');
  const org:any={id:visualOrgId,name:'Synthetic company',country:'US',baseCurrency:'USD',role:'OWNER',socialLinks:links,brandTheme:{socialFooter:{pages:'last',size:'small',align:'center'}}};
  let patch:any;
  await page.route('**/orgs',r=>r.fulfill({json:[org]}));
  await page.route(`**/orgs/${visualOrgId}`,async r=>{if(r.request().method()==='PATCH'){patch=r.request().postDataJSON();org.socialLinks=patch.socialLinks;org.brandTheme.socialFooter=patch.socialFooter;}return r.fulfill({json:org});});
  await page.goto('/app/settings?tab=branding');
  await page.getByTestId('social-footer-pages').selectOption('first');
  await page.getByTestId('social-footer-size').selectOption('large');
  await page.getByTestId('social-footer-align').selectOption('end');
  await page.getByTestId('social-label-0').fill('Our projects');
  await page.getByTestId('social-save').click();
  await expect.poll(()=>patch?.socialFooter).toEqual({pages:'first',size:'large',align:'end'});
  await page.reload();
  await expect(page.getByTestId('social-footer-pages')).toHaveValue('first');
  await expect(page.getByTestId('social-label-0')).toHaveValue('Our projects');
  await page.getByTestId('social-footer-pages').selectOption('none');
  await expect(page.getByTestId('social-footer-preview').locator('a')).toHaveCount(0);
});
test('saved credit note prints recorded amounts, all lines and linked footer',async({page},info)=>{
  await prepareVisualApp(page,'en');
  const org={id:visualOrgId,name:'Synthetic company',country:'US',baseCurrency:'USD',role:'OWNER',socialLinks:links};
  await page.route('**/orgs',r=>r.fulfill({json:[org]}));await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:org}));
  const note={id:'cn-test',orgId:visualOrgId,noteNumber:'CN-TEST',contactId:'contact-test',contact:{displayName:'Test customer'},status:'ISSUED',currency:'USD',issueDate:'2026-09-27',reason:'RETURN',subtotal:100,taxTotal:0,total:100,originalInvoice:{invoiceNumber:'INV-TEST'},lines:Array.from({length:40},(_,i)=>({id:`line-${i}`,description:`Saved line ${i}`,quantity:1,unitPrice:2.5,subtotal:2.5}))};
  await page.route('**/api/credit-notes?*',r=>r.fulfill({json:{items:[note]}}));
  await page.route('**/api/credit-notes/cn-test',r=>r.fulfill({json:note}));
  await page.goto('/app/credit-notes/cn-test');
  await page.getByRole('button',{name:'Print / PDF',exact:true}).click();
  const output=page.getByTestId('report-output-pages');await expect(output).toHaveAttribute('data-ready','true');
  await expect(output).toContainText('Credit note · CN-TEST');await expect(output).toContainText('INV-TEST');await expect(output).toContainText('100.00');
  expect(await output.locator('tbody tr').count()).toBe(47);
  const download=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();const path=info.outputPath('credit-note.pdf');await(await download).saveAs(path);
  expect(((await readFile(path)).toString('latin1').match(/\/URI \(https:\/\/example.com\//g)||[]).length).toBe(7);
});
