import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
const product = {id:'digital-1',name:'Digital service',nameAr:'خدمة رقمية',sku:'DIG-1',type:'DIGITAL',unitPrice:12,costPrice:4,incomeAccountId:'rev',expenseAccountId:'exp'};
for(const language of ['en','ar'] as const) test(`digital products register and export barcodes (${language})`,async({page})=>{
 await prepareVisualApp(page,language); const aliases:any[]=[];
 await page.route('**/api/products/digital-1',r=>r.fulfill({json:product}));
 await page.route('**/api/products/digital-1/barcodes',r=>{if(r.request().method()==='POST')aliases.push({id:'b1',...r.request().postDataJSON()});return r.fulfill({json:r.request().method()==='POST'?aliases.at(-1):{items:aliases}})});
 await page.setViewportSize({width:language==='ar'?390:1440,height:1000});
 await page.goto('/app/products/digital-1');
 await page.getByRole('button',{name:language==='ar'?'إنشاء وحفظ باركود داخلي':'Generate and save internal barcode',exact:true}).click();
 await expect.poll(()=>aliases.length).toBe(1);expect(aliases[0].barcode).toMatch(/^EN-[A-F0-9]{16}$/);expect(aliases[0].unitMultiplier).toBe(1);
 await expect(page.getByRole('img',{name:language==='ar'?`باركود ${aliases[0].barcode}`:`Barcode ${aliases[0].barcode}`,exact:true})).toBeVisible();
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:language==='ar'?'تنزيل الباركود للطباعة (SVG)':'Download barcode for printing (SVG)',exact:true}).last().click();
 expect((await downloaded).suggestedFilename()).toBe(`barcode-${aliases[0].barcode}.svg`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('invoice scanner resolves alias quantities and preserves zero-price empty row',async({page})=>{
 await prepareVisualApp(page);
 await page.route('**/api/products?**',r=>r.fulfill({json:{items:[product],total:1}}));
 await page.route('**/api/products/_/lookup?**',r=>r.fulfill({json:{product,unitMultiplier:6,via:'barcode'}}));
 await page.goto('/app/invoices?new=1');
 const scan=page.getByRole('textbox',{name:'Scan barcode or enter code',exact:true});
 await scan.fill('PACK-SIX');await scan.press('Enter');
 await expect(page.locator('textarea').first()).toHaveValue(/Digital service|خدمة رقمية/);
 await expect(page.getByRole('textbox',{name:'Line quantity',exact:true}).first()).toHaveValue('6');
 await page.route('**/api/products/_/lookup?**',r=>r.fulfill({status:404,json:{error:'not_found'}}));
 await scan.fill('UNKNOWN');await scan.press('Enter');
 await expect(page.getByRole('alert').filter({hasText:'Could not resolve code UNKNOWN'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Line quantity',exact:true}).first()).toHaveValue('6');
});
for(const kind of ['quotes','invoices'] as const) test(`existing ${kind} signing link opens without resending`,async({page})=>{
 await prepareVisualApp(page);
 const item={id:'doc-1',quoteNumber:'Q-1',invoiceNumber:'INV-1',status:'SENT',contactId:'c1',contact:{id:'c1',displayName:'QA',email:'qa@example.invalid'},currency:'USD',total:12,subtotal:12,taxTotal:0,issueDate:'2026-09-27',validUntil:'2026-10-27',dueDate:'2026-10-27',lines:[],amountPaid:0};
 await page.route(`**/api/${kind}**`,r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/doc-1')?item:{items:[item],total:1}}));
 let count=0;let sendCount=0;
 await page.route('**/api/sign/requests?**',r=>{const u=new URL(r.request().url());expect(u.searchParams.get('docId')).toBe('doc-1');expect(u.searchParams.get('docType')).toBe(kind==='quotes'?'QUOTE':'INVOICE');return r.fulfill({json:{items:[{id:'sr1',docId:'doc-1',createdAt:'2026-09-27',status:count++?'SIGNED':'SENT',docusealEmbedUrl:'https://sign.ensidex.com/s/synthetic-only',signedPdfUrl:'https://sign.ensidex.com/synthetic.pdf',auditTrailUrl:'https://sign.ensidex.com/audit.pdf'}]}})});
 await page.route('**/api/sign/**/send',r=>{sendCount++;return r.fulfill({status:500,json:{error:'must_not_send'}})});
 await page.goto(`/app/${kind}`);
 if(kind==='quotes') { await page.goto('/app/quotes/doc-1'); await page.getByTestId('quote-request-signature').click(); } else await page.getByTitle('Send for signing',{exact:true}).first().click();
 await expect(page.getByRole('link',{name:'Open signing link',exact:true})).toHaveAttribute('href','https://sign.ensidex.com/s/synthetic-only');
 await expect(page.getByRole('button',{name:kind==='quotes'?'Prepare signing link':'Send for signing',exact:true})).toBeDisabled();
 await page.getByRole('region',{name:'Signature tracking'}).getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(page.getByRole('link',{name:'Signed PDF',exact:true})).toHaveAttribute('href','https://sign.ensidex.com/synthetic.pdf');
 await expect(page.getByRole('link',{name:'Signing audit trail',exact:true})).toBeVisible();
 expect(sendCount).toBe(0);
});

for (const language of ['en','ar'] as const) test(`asset intake reviews the source before registering (${language})`, async({page})=>{
 await prepareVisualApp(page,language);
 const candidate={sourceKey:'journal:jl1',fingerprint:'a'.repeat(64),sourceKind:'journal',sourceId:'j1',sourceNumber:'JV-QA-1',sourceJournalId:'j1',name:'QA computer',accountId:'asset-account',acquisitionDate:'2026-09-27',acquisitionCost:language==='en'?'':'500',currency:'USD',baseCurrency:'USD',code:''};
 let payload:any=null; let reviewed=false;
 await page.route('**/api/fixed-assets**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/intake/register')){payload=route.request().postDataJSON();reviewed=true;return route.fulfill({status:201,json:{id:'qa-asset',...payload}})}
  if(path.endsWith('/intake'))return route.fulfill({json:{items:reviewed?[]:[candidate]}});
  if(path.endsWith('/next-code'))return route.fulfill({json:{code:'FA-QA-1'}});
  return route.fulfill({json:{items:[],totalCost:0,totalDepreciation:0,netBookValue:0}});
 });
 await page.route('**/api/accounts**',r=>r.fulfill({json:{items:[{id:'asset-account',type:'ASSET',code:'1400',name:'Equipment'}]}}));
 await page.goto('/app/assets');
 await page.getByRole('button',{name:language==='ar'?'مراجعة وتسجيل':'Review and register',exact:true}).click();
 const life=page.getByRole('spinbutton',{name:language==='ar'?'العمر الإنتاجي (سنوات)':'Useful life (years)',exact:true});
 await expect(life).toHaveValue('');
 if(language==='en'){await expect(page.getByLabel('Cost',{exact:false})).toHaveValue('');await page.getByLabel('Cost',{exact:false}).fill('500');}
 await life.fill('3');
 await page.getByRole('button',{name:language==='ar'?'تسجيل الأصل':'Register asset',exact:true}).click();
 await expect.poll(()=>payload).not.toBeNull();
 expect(payload.sourceKey).toBe(candidate.sourceKey);expect(payload.acquisitionCost).toBe(500);expect(payload.usefulLifeYears).toBe(3);
 await expect(page.getByRole('region',{name:language==='ar'?'أصول تحتاج تسجيلًا':'Assets awaiting registration'})).not.toContainText('QA computer');
});
