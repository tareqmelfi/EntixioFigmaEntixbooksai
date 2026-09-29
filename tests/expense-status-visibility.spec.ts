import { expect, test } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

for (const lang of ['ar', 'en'] as const) test(`expense status is explicit, filterable and preserved in details (${lang})`, async ({ page }) => {
  await prepareVisualApp(page, lang);
  const items = ['DRAFT', 'APPROVED', 'PAID', undefined, 'UNRECOGNIZED'].map((status, i) => ({
    id: `state-${i}`, number: `EXP-STATE-${i}`, status, category: 'Synthetic', vendorName: `Supplier ${i}`,
    date: '2026-09-29', currency: 'USD', total: 10, subtotal: 10, taxAmount: 0, amount: 10,
    paymentMethod: 'CASH', lineItems: [], paymentSplits: [],
  }));
  let mutations = 0;
  await page.route('**/api/expenses**', route => {
    if (route.request().method() !== 'GET') mutations++;
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/attachments') ? { items: [] }
      : items.find(e => path.endsWith(`/${e.id}`)) || { items, total: items.length, summary: { sumTotal: 50 } } });
  });
  await page.goto('/app/expenses');
  const table = page.getByRole('table');
  const names = lang === 'ar' ? ['مسودة', 'معتمد', 'مدفوع', 'غير محدد'] : ['Draft', 'Approved', 'Paid', 'Unspecified'];
  await expect(table.getByRole('columnheader', { name: lang === 'ar' ? 'الحالة' : 'Status', exact: true })).toBeVisible();
  for (let i = 0; i < 5; i++) await expect(table.getByRole('row').filter({ hasText: `EXP-STATE-${i}` })).toContainText(names[Math.min(i, 3)]);
  await page.screenshot({ path: `/tmp/entix-expense-status-${lang}.png`, fullPage: true });
  const group = page.getByRole('group', { name: lang === 'ar' ? 'تصفية حسب حالة المصروف' : 'Filter by expense status' });
  await group.getByRole('button', { name: `${names[0]} 1`, exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('EXP-STATE-0');
  const search = page.getByRole('searchbox');
  await search.fill('Supplier 1');
  await expect(table).toContainText(lang === 'ar' ? 'لا توجد مصروفات تطابق' : 'No expenses match');
  await search.clear();
  await group.getByRole('button', { name: `${names[3]} 2`, exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await group.getByRole('button', { name: `${names[2]} 1`, exact: true }).click();
  await table.getByRole('link', { name: 'EXP-STATE-2', exact: true }).click();
  await expect(page.getByRole('main').getByText(names[2], { exact: true })).toBeVisible();
  expect(mutations).toBe(0);
});

test('expense list stays within the mobile viewport with a horizontally scrollable status column', async ({ page }) => {
  await prepareVisualApp(page, 'ar');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/expenses**', route => route.fulfill({ json: { items: [], total: 0, summary: { sumTotal: 0 } } }));
  await page.goto('/app/expenses');
  await expect(page.getByRole('group', { name: 'تصفية حسب حالة المصروف' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
