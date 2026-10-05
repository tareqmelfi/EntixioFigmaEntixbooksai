import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const country of ['US', 'SA', 'AE']) for (const lang of ['ar', 'en'] as const) {
  test(`expense form uses country-neutral purchase tax outside SA (${country}/${lang})`, async ({ page }) => {
    await prepareVisualApp(page, lang);
    await page.route('**/orgs', r => r.fulfill({ json: [{ id: visualOrgId, country, baseCurrency: 'USD', role: 'OWNER' }] }));
    await page.goto('/app/expenses/new');
    const label = country === 'SA' ? (lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT') : (lang === 'ar' ? 'الضريبة' : 'Tax');
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: lang === 'ar' ? 'مدى' : 'Mada', exact: true })).toHaveCount(country === 'SA' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'STC Pay', exact: true })).toHaveCount(country === 'SA' ? 1 : 0);
    await page.getByLabel(label, { exact: true }).fill('7.25');
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('7.25');
  });
}

for (const method of ['MADA', 'STC_PAY']) test(`US foreign receipt preserves extracted tax and historical ${method}`, async ({ page }) => {
  await prepareVisualApp(page);
  await page.addInitScript(({ method }) => sessionStorage.setItem('entix_ocr_prefill', JSON.stringify({
    issuer: { name: 'Synthetic Saudi supplier' }, currency: 'SAR', issueDate: '2026-08-02',
    totals: { subtotal: 100, tax: 15, total: 115 }, payments: [{ method, amount: 115, currency: 'SAR' }],
  })), { method });
  await page.goto('/app/expenses?fromOcr=1');
  await expect(page.getByLabel('Tax', { exact: true })).toHaveValue('15');
  await expect(page.getByRole('button', { name: method === 'MADA' ? 'Mada' : 'STC Pay', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Paid using more than one method', exact: true }).check();
  await expect(page.getByRole('button', { name: method === 'MADA' ? 'Mada' : 'STC Pay', exact: true })).toHaveCount(2);
  await expect(page.getByText('115 SAR → 115 SAR', { exact: true })).toBeVisible();
});

test('imported expense with no line tax shows the same zero rate used by its totals', async ({ page }) => {
  await prepareVisualApp(page);
  await page.addInitScript(() => sessionStorage.setItem('entix_ocr_prefill', JSON.stringify({
    issuer: { name: 'Synthetic supplier' }, currency: 'USD',
    lines: [{ description: 'Synthetic imported item', quantity: 1, unitPrice: 100 }],
  })));
  await page.goto('/app/expenses?fromOcr=1');
  await page.getByRole('button', { name: 'Item, project and asset details', exact: true }).click();
  await expect(page.getByLabel('Line tax rate 1', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Tax', { exact: true })).toHaveValue('0.00');
  await expect(page.getByTestId('expense-line-total-0')).toHaveText('100 USD');
});
