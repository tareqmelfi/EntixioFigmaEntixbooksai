import { test, expect } from '@playwright/test';
import { docFromQuote, docFromInvoice, renderDocument, sampleInput } from '../src/app/lib/document-render';
import { qrSvg } from '../src/app/components/brand-document';

// Synthetic copy of the reported eight-line arithmetic, never a production write.
const prices = [783.49, 74.20, 314.82, 93.28, 47.70, 185.50, 3.18, 20.29];
const quantities = [20, 50, 35, 100, 30, 5, 100, 50];
const storedGross = [18020.27, 4266.50, 12671.51, 10727.20, 1645.65, 1066.63, 365.70, 1166.68];
const descriptions = ['فريون R410A من هانيويل – صناعة أمريكية', 'كشاف LED بيضاوي جداري، 30 واط 240 فولت، إضاءة نهارية', 'سخان مياه كهربائي رأسي من الخزف السعودي، 1200 واط، 50 لتر', 'شطاف صحي يدوي من Grohe، مصنوع من بلاستيك ABS', 'معجون للحديد – Permatex', 'شريط إضاءة LED قوي، 50 متر، 10 واط، 3000K، مع لاصق قوي', 'وصلة شريط إضاءة – خط واحد', 'مكثف كهربائي 45 ميكروفاراد – كوري'];
const saved = { quoteNumber: 'SYNTHETIC-PDF-0001', invoiceNumber: 'SYNTHETIC-INV-0001', issueDate: '2026-09-29', currency: 'SAR', title: 'توريد مواد بناء وأدوات كهربائية وصحية', subtotal: 43417.50, taxTotal: 6512.63, total: 49930.13, discountTotal: 0,
  lines: prices.map((unitPrice, i) => ({ description: descriptions[i], quantity: quantities[i], unitPrice, taxRate: { rate: '0.15' }, taxInclusive: false, subtotal: storedGross[i] })) };

for (const lang of ['ar', 'en'] as const) test(`PDF has reconciled net, VAT and gross columns and keeps quote totals with the eight items (${lang})`, async ({ page }, info) => {
  const base = sampleInput('QUOTE', lang, { themePreset: 'ink-white', headerStyle: 'centered', showQr: true, amountInWords: true, coverStyle: 'NONE' });
  const out = renderDocument({ ...base, qr: qrSvg, doc: { ...docFromQuote(saved), qrPayload: 'SYNTHETIC' }, org: { name: 'Synthetic Company', country: 'SA', vatNumber: '300000000000003', socialLinks: [{ platform: 'other', url: 'https://example.com' }], socialFooter: { pages: 'last', size: 'small', align: 'center' } } });
  await page.route('**/pdf-parity-test', r => r.fulfill({ contentType: 'text/html', body: out.html }));
  await page.goto('/pdf-parity-test'); await page.evaluate(() => document.fonts.ready);
  const table = page.locator('table.items').first();
  await expect(table.locator('thead th')).toHaveCount(7);
  const first = table.locator('tr').nth(1);
  for (const amount of ['783.49', '15,669.80', '2,350.47', '18,020.27']) await expect(first).toContainText(amount);
  await expect(page.locator('[data-line-rounding]')).toContainText('-0.01');
  const pricingSheet = page.locator('.sheet').filter({ has: table });
  await expect(pricingSheet.locator('.totals .grand')).toContainText('49,930.13');
  await expect(pricingSheet).toHaveAttribute('data-doc-page-check', /\/238$/);
  await expect(pricingSheet.locator('.social-band')).toHaveCount(0);
  await expect(page.locator('.sheet').last().locator('.social-band')).toHaveCount(1);
  // Check actual geometry, including children hidden by the fixed sheet's overflow.
  const violations = await page.locator('.pgflow').evaluateAll(flows => flows.flatMap(flow => {
    const bounds = flow.getBoundingClientRect();
    return Array.from(flow.querySelectorAll('td, th, .totals, .qrc')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > bounds.bottom + 2 || r.right > bounds.right + 2 || r.left < bounds.left - 2;
    }).map(el => el.textContent?.slice(0, 80));
  }));
  expect(violations).toEqual([]);
  await pricingSheet.screenshot({ path: info.outputPath('pricing.png') });
  const pdf = await page.pdf({ path: info.outputPath('document.pdf'), preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(out.sheetCount);
});

for (const kind of ['QUOTE', 'INVOICE'] as const) test(`${kind} mixed tax and long descriptions paginate without clipping or changing the saved total`, async ({ page }) => {
  const lines = Array.from({ length: 40 }, (_, i) => ({ description: `${i + 1}: أعمال توريد وتركيب حسب المواصفات المعتمدة\nSupply and installation including all required accessories, connections and detailed handover documentation.`, quantity: 1, unitPrice: i % 2 ? 115 : 100, taxRate: { rate: '.15' }, taxInclusive: Boolean(i % 2), subtotal: 115 }));
  const adapt = kind === 'QUOTE' ? docFromQuote : docFromInvoice;
  const doc = adapt({ ...saved, lines, subtotal: 4000, taxTotal: 600, total: 4600 });
  const base = sampleInput(kind, 'ar', { themePreset: 'ink-white', headerStyle: 'centered', coverStyle: 'NONE' });
  const out = renderDocument({ ...base, doc });
  await page.route('**/pdf-long-test', r => r.fulfill({ contentType: 'text/html', body: out.html }));
  await page.goto('/pdf-long-test'); await page.evaluate(() => document.fonts.ready);
  expect(doc.taxBasis).toBe('mixed');
  await expect(page.locator('table.items tbody tr')).toHaveCount(40);
  expect(await page.locator('table.items').count()).toBeGreaterThan(1);
  await expect(page.locator('.totals .grand')).toContainText('4,600.00');
  await expect(page.locator('.totals .disc')).toHaveCount(0);
  const clipped = await page.locator('.sheet').evaluateAll(sheets => sheets.flatMap(sheet => {
    const flow = sheet.querySelector('.pgflow') || sheet;
    const bounds = flow.getBoundingClientRect();
    const footer = sheet.querySelector('.ftr')?.getBoundingClientRect();
    return Array.from(flow.querySelectorAll('td, th, .totals')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > Math.min(bounds.bottom, footer?.top ?? bounds.bottom) + 1 || r.right > bounds.right + 1 || r.left < bounds.left - 1;
    }).map(el => el.textContent?.slice(0, 80));
  }));
  expect(clipped).toEqual([]);
});

test('zero-tax and optional lines do not invent tax or document rounding', () => {
  const doc = docFromQuote({ ...saved, subtotal: 100, taxTotal: 0, total: 100, lines: [
    { description: 'Included', quantity: 1, unitPrice: 100, subtotal: 100, taxRate: 0 },
    { description: 'Optional', quantity: 1, unitPrice: 200, subtotal: 230, taxRate: '.15', included: false },
  ] });
  expect(doc.lines[0]).toMatchObject({ netAmount: 100, taxAmount: 0, subtotal: 100 });
  expect(doc.lines[1]).toMatchObject({ netAmount: 200, taxAmount: 30, included: false });
  expect(renderDocument({ ...sampleInput('QUOTE', 'en', null), doc }).body).not.toContain('data-line-rounding');
});

for (const adapt of [docFromQuote, docFromInvoice]) test(`saved ${adapt.name} preserves tax basis and discount in print amounts`, () => {
  for (const inclusive of [false, true]) {
    const gross = inclusive ? 10000 : 11500;
    const doc = adapt({ ...saved, lines: [{ quantity: 1, unitPrice: 10500, discount: 500, taxInclusive: inclusive, taxRate: { rate: '0.15', isInclusive: !inclusive }, subtotal: gross }] });
    expect(doc.lines[0]).toMatchObject({ unitPrice: 10500, subtotal: gross, netAmount: inclusive ? 8695.65 : 10000, taxAmount: inclusive ? 1304.35 : 1500, taxInclusive: inclusive });
    expect(doc.taxBasis).toBe(inclusive ? 'inclusive' : 'exclusive');
  }
});
