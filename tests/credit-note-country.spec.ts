import { expect, test } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const country of ['US', 'SA', 'AE', '']) for (const lang of ['ar', 'en'] as const) {
  test(`new credit note line uses only its company's default (${country || 'unknown'}/${lang})`, async ({ page }) => {
    await prepareVisualApp(page, lang);
    await page.route('**/orgs', r => r.fulfill({ json: [{ id: visualOrgId, country, baseCurrency: 'USD', role: 'OWNER' }] }));
    await page.route('**/api/credit-notes**', r => r.fulfill({ json: { items: [] } }));
    await page.goto('/app/credit-notes');
    await page.getByRole('button', { name: lang === 'ar' ? 'إشعار دائن جديد' : 'New credit note', exact: true }).click();
    // A padded row exercises the table's new-line default, not an existing rate.
    await page.getByRole('textbox', { name: lang === 'ar' ? 'سعر السطر' : 'Line price', exact: true }).nth(1).fill('100');
    await expect(page.getByTestId('line-tax-amount-1')).toHaveText(country === 'SA' ? '15.00' : '0.00');
    await page.getByRole('textbox', { name: lang === 'ar' ? 'سعر السطر' : 'Line price', exact: true }).first().fill('100');
    await expect(page.getByTestId('line-tax-amount-0')).toHaveText(country === 'SA' ? '15.00' : '0.00');
  });
}

for (const rate of [0, .07, { rate: '.07', type: 'STANDARD' }]) {
  test(`credit note preserves a product's configured tax ${JSON.stringify(rate)}`, async ({ page }) => {
    await prepareVisualApp(page);
    await page.route('**/api/products**', r => r.fulfill({ json: { items: [{ id: 'synthetic-product', name: 'Synthetic rate product', unitPrice: '100', taxRate: rate }] } }));
    await page.route('**/api/credit-notes**', r => r.fulfill({ json: { items: [] } }));
    await page.goto('/app/credit-notes');
    await page.getByRole('button', { name: 'New credit note', exact: true }).click();
    const row = page.getByTestId('line-tax-0').locator('..').locator('..');
    await row.getByRole('button', { name: 'Product or service…', exact: true }).click();
    await page.getByRole('button', { name: /Synthetic rate product/ }).click();
    await expect(page.getByTestId('line-tax-amount-0')).toHaveText(rate === 0 ? '0.00' : '7.00');
  });
}

for (const rate of [.15, { id: 'historic-tax', rate: '.15', name: 'Historic foreign VAT' }]) {
  test(`US saved credit note retains its historical tax ${JSON.stringify(rate)}`, async ({ page }) => {
    await prepareVisualApp(page);
    await page.route('**/api/credit-notes/synthetic-note', r => r.fulfill({ json: {
      id: 'synthetic-note', noteNumber: 'SYNTHETIC-ONLY', status: 'DRAFT', contactId: 'synthetic-contact',
      currency: 'SAR', issueDate: '2026-08-02', lines: [{ id: 'historic-line', description: 'Historical foreign purchase', quantity: 1, unitPrice: 100, taxRate: rate }],
    } }));
    await page.goto('/app/credit-notes/synthetic-note');
    await expect(page.getByTestId('line-tax-amount-0')).toHaveText('15.00');
  });
}
