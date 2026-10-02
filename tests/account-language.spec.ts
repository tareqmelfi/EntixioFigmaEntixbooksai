import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const lang of ['ar', 'en'] as const) {
  test(`issued invoice account selection follows ${lang} interface`, async ({ page }) => {
    await prepareVisualApp(page, lang);
    const account = { id: 'general-revenue', code: '400', name: 'General revenue', nameAr: 'إيراد عام', type: 'REVENUE', isActive: true };
    const invoice = { id: 'language-invoice', orgId: visualOrgId, invoiceNumber: 'INV-LANGUAGE', status: 'APPROVED', contactId: 'buyer', issueDate: '2026-10-01', dueDate: '2026-10-30', currency: 'USD', total: 100, amountPaid: 0, lines: [{ id: 'line', description: 'Synthetic service', accountId: account.id, account, quantity: 1, unitPrice: 100, subtotal: 100 }] };
    await page.route('**/api/accounts', r => r.fulfill({ json: { items: [account] } }));
    await page.route('**/api/invoices?*', r => r.fulfill({ json: { items: [invoice] } }));
    await page.route('**/api/invoices/language-invoice', r => r.fulfill({ json: invoice }));
    await page.goto('/app/invoices/language-invoice');
    await page.getByTestId('invoice-reclassify').getByRole('button', { name: lang === 'ar' ? 'إعادة تصنيف' : 'Reclassify', exact: true }).click();
    const panel = page.getByTestId('invoice-reclassify-open');
    const expected = lang === 'ar' ? account.nameAr : account.name;
    await expect(panel.getByRole('button', { name: expected, exact: true })).toBeVisible();
    await panel.getByRole('button', { name: expected, exact: true }).click();
    await expect(page.getByRole('button', { name: `${expected} 400`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(lang === 'ar' ? account.name : account.nameAr) })).toHaveCount(0);
  });
}

for (const lang of ['ar', 'en'] as const) {
  test(`expense account details and selectors follow ${lang} interface`, async ({ page }) => {
    await prepareVisualApp(page, lang);
    const account = { id: 'cost', code: '500', name: 'General expense', nameAr: 'مصروف عام', type: 'EXPENSE', isActive: true };
    const expense = { id: 'language-expense', number: 'EXP-LANGUAGE', status: 'DRAFT', date: '2026-10-01', currency: 'USD', category: 'Synthetic purchase', amount: 100, total: 100, taxAmount: 0, paymentMethod: 'CASH', accountId: 'cost', lineItems: [{ description: 'Synthetic item', quantity: 1, unitPrice: 100, lineTotal: 100, accountId: 'cost', accountName: 'Stale saved label' }] };
    await page.route('**/api/accounts**', r => r.fulfill({ json: { items: [account] } }));
    await page.route('**/api/expenses**', r => r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/language-expense') ? expense : { items: [], summary: { sumTotal: '0', avgTotal: '0' } } }));
    await page.goto('/app/expenses/language-expense');
    const expected = `500 · ${lang === 'ar' ? account.nameAr : account.name}`;
    await expect(page.getByRole('cell', { name: expected, exact: true })).toBeVisible();
    await expect(page.getByText('Stale saved label', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: lang === 'ar' ? 'تعديل' : 'Edit', exact: true }).click();
    await expect(page.getByTestId('expense-header-account').getByRole('button', { name: expected, exact: true })).toBeVisible();
  });
  test(`purchase item account selector follows ${lang} interface`, async ({ page }) => {
    await prepareVisualApp(page, lang);
    const account = { id: 'cost', code: '500', name: 'General expense', nameAr: 'مصروف عام', type: 'EXPENSE', isActive: true };
    await page.route('**/api/accounts**', r => r.fulfill({ json: { items: [account] } }));
    await page.route('**/api/bills**', r => r.fulfill({ json: { items: [] } }));
    await page.goto('/app/purchases/bills?new=1');
    await page.getByTestId('line-account-0').getByRole('button').first().click();
    await expect(page.getByRole('button', { name: `${lang === 'ar' ? account.nameAr : account.name} 500`, exact: true })).toBeVisible();
  });
}
