import { test, expect } from '@playwright/test';
import { renderDocument, sampleInput } from '../src/app/lib/document-render';

for (const lang of ['ar', 'en'] as const) test(`million-value quotation cells fit their columns (${lang})`, async ({ page }) => {
  const input = sampleInput('QUOTE', lang, { themePreset: 'ink-white', showTaxBreakdown: true });
  input.fontBase = 'http://localhost:' + (process.env.ENTIX_DEV_PORT || '5173') + '/fonts';
  input.org.vatNumber = '300000000000003';
  input.doc.lines = [{ ...input.doc.lines[0], description: 'B01-16 concrete works', quantity: 5125, unitPrice: 299, netAmount: 1532375, taxAmount: 229856.25, subtotal: 1762231.25, taxRate: .15, unit: 'm3' }];
  input.doc.subtotal = 1532375;
  input.doc.taxTotal = 229856.25;
  input.doc.total = 1762231.25;
  input.doc.taxBasis = 'exclusive';
  await page.setContent(renderDocument(input).html);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('table.items.tax-columns')).toContainText('1,762,231.25');
  const overflow = await page.locator('table.items td.n').evaluateAll(cells => cells.filter(cell => cell.scrollWidth > cell.clientWidth + 2).map(cell => cell.textContent));
  expect(overflow).toEqual([]);
});
