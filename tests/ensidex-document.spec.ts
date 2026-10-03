import { test, expect } from '@playwright/test';
import { renderDocument, sampleInput } from '../src/app/lib/document-render';
import { qrSvg } from '../src/app/components/brand-document';
import { resolveDocumentLanguage } from '../src/app/lib/document-language';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
const template = { themePreset: 'custom', theme: { navy: '#0C2F61', fill: '#CCDDEE' }, headerStyle: 'centered', docLang: 'en', amountInWords: false, coverTitleEn: 'Services', coverTitle: 'خدمات' };
function input(kind: 'QUOTE'|'INVOICE', lang: 'en'|'ar') {
 const base = sampleInput(kind,lang,template);
 return {...base,qr:qrSvg,org:{name:'ENSIDEX LLC',country:'US',email:'test@example.com'},contact:{name:'Synthetic client'},doc:{...base.doc,number:'EN-QTE-202609-0001',title:null,notes:null,currency:'USD',paymentLinkUrl:null,paymentPlan:null,discountTotal:0,subtotal:1200,taxTotal:0,total:1200,lines:[{description:'Annual subscription',quantity:1,unitPrice:1200,subtotal:1200}]},bank:{bankName:'Mercury Bank',name:'Mercury Checking',accountNumber:'12345678901234567890',routingNumber:'123456789',swiftCode:'SYNTHETIC',currency:'USD'}};
}
for (const lang of ['en','ar'] as const) for(const kind of ['QUOTE','INVOICE'] as const) test(`ENSIDEX ${kind} ${lang} totals, bank layout and printable pages`,async({page},info)=>{
 const out=renderDocument(input(kind,lang));
 await page.route('**/document-test',r=>r.fulfill({contentType:'text/html',body:out.html}));
 await page.goto('/document-test'); await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('.totals .r')).toHaveCount(1);
 await expect(page.locator('.totals .grand')).toContainText('1,200.00');
 const totalStyle=await page.locator('.totals .grand').evaluate(el=>({radius:getComputedStyle(el).borderRadius,border:getComputedStyle(el).borderTopWidth,background:getComputedStyle(el).backgroundColor}));
 expect(totalStyle).toEqual({radius:'0px',border:'0px',background:'rgb(246, 241, 232)'});
 await expect(page.locator('.edoc')).toHaveAttribute('dir',lang==='en'?'ltr':'rtl');
 await expect(page.locator('.edoc')).toContainText('123456789');
 if(lang==='en') expect(await page.locator('.edoc').innerText()).not.toMatch(/[\u0600-\u06ff]/);
 expect(await page.locator('.pgflow').evaluateAll(els=>els.every(el=>el.scrollHeight<=el.clientHeight+1))).toBe(true);
 if(kind==='QUOTE') {
  const bank=page.locator('.bankc2');
  expect(await bank.locator('.bd').evaluate(el=>el.clientWidth)).toBeGreaterThan(550);
  expect(await bank.locator('bdi').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().right<=el.closest('.bankc2')!.getBoundingClientRect().right))).toBe(true);
  await bank.locator('..').screenshot({path:info.outputPath('bank.png')});
 }
 const qr=page.locator('.qr svg').first();await expect(qr).toBeVisible();
 await qr.screenshot({path:info.outputPath('qr.png')});
 await page.locator('.sheet').filter({has:page.locator('.totals')}).screenshot({path:info.outputPath('pricing.png')});
 const pdf=await page.pdf({path:info.outputPath('document.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(out.sheetCount);
});
test('explicit language overrides template; saved preference and country defaults are respected',()=>{
 expect(resolveDocumentLanguage(null,null,null,{country:'US'})).toBe('en');
 expect(resolveDocumentLanguage(null,null,null,{country:'SA'})).toBe('ar');
 expect(resolveDocumentLanguage('ar',null,{docLang:'en'},{country:'US'})).toBe('ar');
 expect(resolveDocumentLanguage(null,{language:'ar'},{docLang:'en'},{country:'US'})).toBe('ar');
 expect(resolveDocumentLanguage(null,null,null,{country:'US',defaultInvoiceLanguage:'ar'})).toBe('ar');
});
test('proposal route defaults to English for US issuer and switches to Arabic explicitly',async({page})=>{
 await prepareVisualApp(page,'ar');
 const base=input('QUOTE','en');
 await page.route('**/api/quotes/quote-test',r=>r.fulfill({json:{...base.doc,id:'quote-test',orgId:visualOrgId,quoteNumber:'EN-QTE-202609-0001'}}));
 await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{...base.org,id:visualOrgId}}));
 await page.route('**/api/document-templates/defaults',r=>r.fulfill({json:{QUOTE:template}}));
 await page.route('**/api/document-templates/render/QUOTE/quote-test?**', r => r.fulfill({contentType:'text/html',body:renderDocument(input('QUOTE', new URL(r.request().url()).searchParams.get('lang') === 'ar' ? 'ar' : 'en')).html}));
 await page.goto('/print/proposal/quote-test?noprint=1');
 await expect(page.locator('.edoc')).toHaveAttribute('lang','en');
 await page.getByLabel('Document language').selectOption('ar');
 await expect(page.locator('.edoc')).toHaveAttribute('lang','ar');
});

test('station layout prints only saved payment terms',()=>{
 const base=input('QUOTE','en');
 const styled={...base,template:{...base.template,paymentPlanStyle:'stations'}};
 const without=renderDocument(styled);
 expect(without.body).not.toMatch(/Advance payment|On supply and installation|Payment plan/);
 const saved=renderDocument({...styled,doc:{...styled.doc,paymentPlan:[{label:'Full payment before activation',percent:100,net:0,tax:0,total:1200}]}});
 expect(saved.body).toContain('Full payment before activation');
 expect(saved.body).not.toContain('On supply and installation');
});
