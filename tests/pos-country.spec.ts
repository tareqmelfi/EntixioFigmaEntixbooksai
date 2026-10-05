import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const country of ['US', 'SA', 'AE', '']) for (const lang of ['ar', 'en'] as const) {
  test(`POS labels and missing-rate fallback follow ${country || 'unknown'} (${lang})`, async ({ page }) => {
    await prepareVisualApp(page, lang);
    let writes = 0;
    await page.route('**/orgs', r => r.fulfill({ json: [{ id: visualOrgId, country, baseCurrency: 'USD', role: 'OWNER' }] }));
    await page.route('**/api/pos/catalog', r => r.fulfill({ json: {
      items: [{ id: 'synthetic-item', name: 'Synthetic item', type: 'SERVICE', sku: 'COUNTRY-TEST', unitPrice: '115' }],
      store: { name: 'Synthetic store', country, baseCurrency: 'USD' },
    } }));
    await page.route('**/api/pos/shift/current', r => r.fulfill({ json: { shift: { id: 'synthetic-shift', openedAt: '2026-10-05T00:00:00Z', openingFloat: '0' } } }));
    await page.route('**/api/pos/sale', r => { writes++; return r.fulfill({ status: 500, json: { error: 'delivery_disabled' } }); });
    await page.goto('/app/pos');
    const label = country === 'SA' ? (lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT')
      : country === 'US' ? (lang === 'ar' ? 'ضريبة المبيعات' : 'Sales tax')
      : (lang === 'ar' ? 'الضريبة' : 'Tax');
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: lang === 'ar' ? 'مدى' : 'Mada', exact: true })).toHaveCount(country === 'SA' ? 1 : 0);
    const scan = page.getByPlaceholder(lang === 'ar' ? 'امسح الباركود أو اكتب اسم الصنف · 3* للكمية · Enter للدفع' : 'Scan barcode or type a product · 3* for quantity · Enter to pay', { exact: true });
    await scan.fill('COUNTRY-TEST'); await scan.press('Enter');
    await expect(page.getByText(label, { exact: true }).locator('..')).toContainText(country === 'SA' ? '15.00' : '0.00');
    if (country === 'US') await page.screenshot({ path: `/tmp/entix-pos-country-${lang}.png`, fullPage: true });
    const receipt = await page.evaluate(async ({ country, lang }) => {
      const { receiptHtml } = await import('/src/app/lib/pos-receipt.ts');
      return receiptHtml({ occurredAt: '2026-10-05T00:00:00Z', invoiceNumber: 'SYNTHETIC-1', lines: [],
        paymentMethod: 'MADA', totals: { net: 100, vat: 7, grand: 107, change: 0 }, amountTendered: 107,
      }, { country, name: 'Synthetic store', vatNumber: 'SYNTHETIC-TAX-ID' }, { lang, paper: '80', currency: 'USD' });
    }, { country, lang });
    expect(receipt).toContain(label);
    expect(receipt).toContain('7.00'); // Historical recorded tax remains unchanged.
    expect(receipt).toContain(lang === 'ar' ? 'مدى' : 'Mada'); // Historical method remains printable.
    if (country !== 'SA') expect(receipt).not.toContain('VAT');
    expect(writes).toBe(0);
  });
}

for (const itemRate of [null, { rate: '.07', type: 'STANDARD' }]) test(`US POS preserves configured ${itemRate ? 'item' : 'catalogue'} tax`, async ({ page }) => {
  await prepareVisualApp(page);
  await page.route('**/api/pos/catalog', r => r.fulfill({ json: {
    items: [{ id: 'configured-tax', name: 'Configured tax item', type: 'SERVICE', sku: 'RATE-TEST', unitPrice: itemRate ? '107' : '105', taxRate: itemRate }],
    orgVatRate: .05, store: { name: 'Synthetic US store', country: 'US', baseCurrency: 'USD' },
  } }));
  await page.route('**/api/pos/shift/current', r => r.fulfill({ json: { shift: { id: 'synthetic-shift', openedAt: '2026-10-05T00:00:00Z', openingFloat: '0' } } }));
  await page.goto('/app/pos');
  const scan = page.getByPlaceholder('Scan barcode or type a product · 3* for quantity · Enter to pay', { exact: true });
  await scan.fill('RATE-TEST'); await scan.press('Enter');
  await expect(page.getByText('Sales tax', { exact: true }).locator('..')).toContainText(itemRate ? '7.00' : '5.00');
});
