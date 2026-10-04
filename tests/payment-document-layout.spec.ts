import { test, expect } from '@playwright/test';
import { renderDocument, sampleInput, paymentUrl, type TemplateSpec } from '../src/app/lib/document-render';
import { qrSvg } from '../src/app/components/brand-document';

for (const lang of ['en', 'ar'] as const) for (const identity of [false, true]) {
  test(`long payment terms remain above footer · ${lang} · identity=${identity}`, async ({ page }, info) => {
    const sentence = lang === 'en' ? 'The client approves the scope and payment schedule in writing before work starts. ' : 'يعتمد العميل نطاق العمل وجدول الدفعات كتابة قبل بدء التنفيذ ويحفظ الطرفان نسخة من المستند. ';
    const terms = Array.from({ length: 12 }, (_, i) => `CLAUSE_${i} | ${sentence.repeat(5)}`).join('\n');
    const template: TemplateSpec = { coverStyle: 'NONE', terms, termsEn: terms, closingTerms: 'Saved closing clause.', closingTermsEn: 'Saved closing clause.', ...(identity ? { headerStyle: 'centered', outOfScope: sentence.repeat(35), outOfScopeEn: sentence.repeat(35) } : {}) };
    const input = sampleInput('INVOICE', lang, template, { name: 'Synthetic issuer', country: lang === 'en' ? 'US' : 'SA', address: 'Synthetic address', email: 'test@example.invalid' });
    input.doc.paymentLinkUrl = 'https://payments.example.com/checkout/synthetic';
    const output = renderDocument({ ...input, qr: qrSvg });
    await page.route('**/payment-document-test', r => r.fulfill({ contentType: 'text/html', body: output.html }));
    await page.goto('/payment-document-test');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.payment-card')).toHaveCount(1);
    await expect(page.locator('.bank')).toHaveCount(0);
    for (let i = 0; i < 12; i++) await expect(page.locator('.term-row').filter({ hasText: new RegExp(`CLAUSE_${i}[^0-9]`) }).first()).toBeVisible();
    const overflow = await page.locator('.sheet.light').evaluateAll(sheets => sheets.flatMap((sheet, index) => {
      const footer = sheet.querySelector('.ftr')!.getBoundingClientRect();
      return Array.from(sheet.querySelectorAll('.term-row, .payment-card, .tc tr')).filter(el => el.getBoundingClientRect().bottom > footer.top - 2).map(el => ({ page: index + 1, text: el.textContent?.slice(0, 60) }));
    }));
    expect(overflow).toEqual([]);
    const width = await page.locator('.payment-card').evaluate(el => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(650);
    const fragments = page.locator('.terms-flow .term-row');
    const rendered = await fragments.allTextContents();
    expect(rendered.join(' ').split(sentence.trim()).length).toBeGreaterThan(10);
    await page.locator('.sheet').filter({ has: page.locator('.payment-card') }).screenshot({ path: info.outputPath('payment-sheet.png') });
    const pdf = await page.pdf({ path: info.outputPath('payment-document.pdf'), preferCSSPageSize: true, printBackground: true });
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(output.sheetCount);
  });
}

test('template payment default, document override, and bank fallback', () => {
  const base = sampleInput('INVOICE', 'en', { paymentLinkUrl: 'https://payments.example.com/template' });
  expect(renderDocument(base).body).toContain('https://payments.example.com/template');
  expect(renderDocument({ ...base, doc: { ...base.doc, paymentLinkUrl: 'https://payments.example.com/document' } }).body).not.toContain('https://payments.example.com/template');
  const bank = renderDocument(sampleInput('INVOICE', 'en', {}));
  expect(bank.body).toContain('Bank transfer');
  expect(bank.body).not.toContain('buy.stripe.com');
  for (const value of ['javascript:alert(1)', 'data:image/png;base64,AA', 'https://user:password@example.com', 'https://example.com/\nlink']) expect(paymentUrl(value)).toBe('');
});

for (const kind of ['INVOICE', 'QUOTE'] as const) test(`single oversized clause preserves every word and footer · ${kind}`, async ({ page }) => {
  const text = Array.from({ length: 1800 }, (_, i) => `word${i}`).join(' ');
  const input = sampleInput(kind, 'en', { coverStyle: 'NONE', headerStyle: 'centered', termsEn: `Long clause | ${text}`, closingTermsEn: `Long closing | ${text}`, paymentLinkUrl: 'https://payments.example.com/long', sections: ['bank', 'terms', 'items', 'totals', 'header', 'closing'].map(id => ({ id: id as any, enabled: true })) });
  const output = renderDocument({ ...input, qr: qrSvg });
  await page.route('**/payment-document-test', r => r.fulfill({ contentType: 'text/html', body: output.html }));
  await page.goto('/payment-document-test');
  await page.evaluate(() => document.fonts.ready);
  const content = await page.locator('.terms-flow .term-row > span').allTextContents();
  expect(content.join('').trim()).toBe(text);
  if (kind === 'INVOICE') expect((await page.locator('.tc tbody tr td:last-child, .tc > tr td:last-child').allTextContents()).join('').trim()).toBe(text);
  expect(await page.locator('.sheet.light').evaluateAll(sheets => sheets.flatMap((s, i) => {
    const limit = s.querySelector('.ftr')!.getBoundingClientRect().top;
    return Array.from(s.querySelectorAll('.term-row,.payment-card,.tc tr')).filter(e => e.getBoundingClientRect().bottom >= limit - 2).map(() => i);
  }))).toEqual([]);
  expect(await page.locator('.payment-card').evaluate(el => !!(document.querySelector('.terms-flow:last-of-type')!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.locator('.payment-card')).toHaveCount(1);
});

const terms = [
'Acceptance | Signature, written approval or payment of the deposit constitutes acceptance of this document and the terms below.',
'Scope of work | Only the deliverables listed in the items table above are included. Additional work is quoted separately before it is started.',
'Fees and payment | Amounts are in US dollars. Invoices are due Net 30 from the invoice date unless the items table states a different schedule.',
'Change requests | Any change to scope, schedule or specification is priced and approved in writing before it is executed.',
'Intellectual property | On receipt of payment in full, the client owns the final deliverables produced for it. Pre-existing tools remain the property of the issuer.',
'Confidentiality | Each party keeps the other’s commercial and technical information confidential and uses it only for this engagement.',
'Late payment | Payment terms are agreed in the accepted proposal. Please contact the issuer before the due date if a payment needs review.'
].join('\n');
test('normal terms and payment share a sheet without footer collision', async ({page},info)=>{
 const input=sampleInput('INVOICE','en',{headerStyle:'centered',coverStyle:'NONE',termsEn:terms,outOfScopeEn:'Anything not listed in the items table; third-party licences, hosting and API usage; additional work requested outside the accepted scope.',sections:[{id:'closing',enabled:false}],paymentLinkUrl:'https://payments.example.com/checkout/preview'},{name:'Example Company',country:'US',address:'Company address',email:'accounts@example.invalid'});
 input.doc.paymentLinkUrl='https://payments.example.com/checkout/preview';
 const output=renderDocument({...input,qr:qrSvg});
 await page.route('**/payment-example',r=>r.fulfill({contentType:'text/html',body:output.html}));await page.goto('/payment-example');await page.evaluate(()=>document.fonts.ready);
 const termsSheet=page.locator('.sheet').filter({has:page.getByText('Payment terms',{exact:true})}).first();
 await termsSheet.screenshot({path:info.outputPath('compact-payment-layout.png')});
 const collisions = await page.locator('.sheet').evaluateAll(sheets => sheets.flatMap(sheet => Array.from(sheet.querySelectorAll('.cards,.term-row,.oos')).filter(el => el.getBoundingClientRect().bottom > sheet.querySelector('.ftr')!.getBoundingClientRect().top).map(el => el.className)));
 expect(collisions).toEqual([]);
 expect(output.sheetCount).toBe(2);
 await expect(termsSheet.locator('.payment-card')).toBeVisible();
 await page.pdf({path:info.outputPath('after.pdf'),preferCSSPageSize:true,printBackground:true});
});
