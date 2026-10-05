import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const country of ['US', 'SA', 'AE']) for (const lang of ['ar', 'en'] as const) test(`purchase tax fallback follows ${country} with unavailable catalogue (${lang})`, async ({ page }) => {
  await prepareVisualApp(page, lang);
  await page.route('**/orgs', r => r.fulfill({ json: [{ id: visualOrgId, country, baseCurrency: country === 'US' ? 'USD' : country === 'SA' ? 'SAR' : 'AED', role: 'OWNER' }] }));
  await page.route('**/api/bank-accounts*', r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/tax-rates*', r => r.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/app/purchases/records/new');
  const select = page.getByTestId('line-tax-0');
  await expect(select).toBeVisible();
  await expect.poll(() => select.locator('option').allTextContents()).toContain(lang === 'ar' ? 'بدون ضريبة' : 'No tax');
  const options = await select.locator('option').allTextContents();
  expect(options.some(s => s.includes('15%'))).toBe(country === 'SA');
  await page.getByLabel(lang === 'ar' ? 'سعر السطر' : 'Line price', { exact: true }).first().fill('100');
  await expect(page.getByTestId('line-tax-amount-0')).toHaveText(country === 'SA' ? '15.00' : '0.00');
});

for (const lang of ['ar', 'en'] as const) test(`US entry separates legacy VAT from configured sales tax without deleting rates (${lang})`, async ({ page }) => {
  await prepareVisualApp(page, lang);
  const rates = [
    { id: 'legacy-vat', name: 'VAT 15%', rate: '.15', type: 'STANDARD', isActive: true },
    { id: 'legacy-exempt', name: 'VAT Exempt', rate: '0', type: 'EXEMPT', isActive: true },
    { id: 'state', name: 'State sales tax', rate: '.06', type: 'STANDARD', isActive: true },
    { id: 'none', name: 'No tax', rate: '0', type: 'ZERO_RATED', isActive: true },
  ];
  let writes = 0;
  await page.route('**/api/tax-rates**', r => { if (r.request().method() !== 'GET') writes++; return r.fulfill({ json: { items: rates } }); });
  await page.route('**/api/bank-accounts*', r => r.fulfill({ json: { items: [] } }));
  await page.goto('/app/purchases/records/new');
  const select = page.getByTestId('line-tax-0');
  await expect(select.locator('option[value="state"]')).toHaveCount(1);
  await expect(select.locator('option[value="legacy-vat"]')).toHaveCount(0);
  await expect(page.getByText(lang === 'ar' ? 'ضريبة المبيعات' : 'Sales tax', { exact: true })).toBeVisible();
  await select.selectOption('state');
  await page.getByLabel(lang === 'ar' ? 'سعر السطر' : 'Line price', { exact: true }).first().fill('100');
  await expect(page.getByTestId('line-tax-amount-0')).toHaveText('6.00');
  await page.getByRole('button', { name: lang === 'ar' ? 'معدلات VAT أجنبية / قديمة · عرض للمراجعة' : 'Foreign / legacy VAT rates · review', exact: true }).click();
  await expect(select.locator('option[value="legacy-vat"]')).toHaveCount(1);
  expect(writes).toBe(0);
});
