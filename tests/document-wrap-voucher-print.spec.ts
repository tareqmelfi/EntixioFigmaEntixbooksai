import { test, expect } from '@playwright/test';
import { renderDocument, sampleInput } from '../src/app/lib/document-render';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const lang of ['en','ar'] as const) test(`closing facts wrap inside cards · ${lang}`, async ({ page }, info) => {
  const input = sampleInput('INVOICE', lang, { themePreset:'custom', theme:{navy:'#191d48'}, headerStyle:'centered', closingFacts:[{label:'Entity',value:'ENSIDEX LLC · Wyoming, United States'}, {label:'Address',value:'30 N GOULD ST STE R, SHERIDAN, WY 82801, UNITED STATES'}] });
  const output = renderDocument(input);
  await page.route('**/wrap-test', r => r.fulfill({contentType:'text/html',body:output.html}));
  await page.goto('/wrap-test'); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.cl .cards3')).toBeVisible();
  for (const media of ['screen','print'] as const) {
    await page.emulateMedia({media});
    expect(await page.locator('.cl .cd .v').evaluateAll(values => values.every(el => {
      const b=el.getBoundingClientRect(); const range=document.createRange(); range.selectNodeContents(el);
      return Array.from(range.getClientRects()).every(r => r.left>=b.left-1 && r.right<=b.right+1);
    }))).toBe(true);
  }
  await page.locator('.sheet').last().screenshot({path:info.outputPath('closing.png')});
  const pdf=await page.pdf({path:info.outputPath('invoice.pdf'),preferCSSPageSize:true,printBackground:true});
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(output.sheetCount);
});

for (const lang of ['en','ar'] as const) test(`voucher screen and native A4 print preserve all fields · ${lang}`, async ({ page }, info) => {
  await prepareVisualApp(page,'ar'); // Arabic app hosting either document language reproduces the RTL clipping.
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:'Synthetic Company',legalName:'Synthetic Company LLC',country:'US',baseCurrency:'USD',address:'30 N Gould St Ste R, Sheridan, Wyoming, United States',defaultInvoiceLanguage:lang}}));
  await page.route('**/api/vouchers/qa-voucher',r=>r.fulfill({json:{id:'qa-voucher',orgId:visualOrgId,number:'QA-RCP-202610-0001',type:'RECEIPT',date:'2026-08-02',amount:'163',currency:'USD',paymentMethod:'CASH',notes:'Synthetic receipt print test'}}));
  await page.goto(`/print/voucher/qa-voucher?noprint=1&lang=${lang}`);
  await expect(page.locator('[data-document-ready="true"]')).toBeVisible();
  const screen = await page.locator('.voucher-page').boundingBox();
  await page.emulateMedia({media:'print'});
  const paper=await page.locator('.voucher-page').boundingBox();
  expect(paper!.x).toBeGreaterThanOrEqual(0); expect(paper!.x).toBeLessThan(1);
  expect(paper!.width).toBeCloseTo(screen!.width,0);
  expect(await page.locator('.voucher-page').evaluate(el=>{
    const box=el.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(el);
    return Array.from(range.getClientRects()).filter(r=>r.width&&r.height).every(r=>r.left>=box.left-1&&r.right<=box.right+1&&r.bottom<=box.bottom+1);
  })).toBe(true);
  await page.locator('.voucher-page').screenshot({path:info.outputPath('voucher.png')});
  const pdf=await page.pdf({path:info.outputPath('voucher.pdf'),preferCSSPageSize:true,printBackground:true});
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(1);
  await expect(page.locator('.voucher-page')).toContainText('QA-RCP-202610-0001');
});
