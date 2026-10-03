import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

const row = (id: string, currency = 'USD', total = 100, amountPaid = 40) => ({ id, invoiceNumber: `METRIC-${id}`, status: 'PARTIAL', currency, total, amountPaid, issueDate: '2020-01-01', dueDate: '2020-02-01', contactId: 'synthetic', contact: { id: 'synthetic', displayName: 'Synthetic buyer' } });
for (const lang of ['ar', 'en'] as const) test(`invoice metrics include later pages and keep currencies separate (${lang})`, async ({ page }) => {
  await prepareVisualApp(page, lang);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route('**/api/invoices?*', route => {
    const second = new URL(route.request().url()).searchParams.get('page') === '2';
    return route.fulfill({ json: { items: second ? [row('later', 'SAR', 500, 100)] : Array.from({ length: 200 }, (_, i) => row(String(i))), total: 201 } });
  });
  await page.goto('/app/invoices');
  await expect(page.getByRole('button', { name: lang === 'ar' ? 'متأخرة 201' : 'Overdue 201', exact: true })).toBeVisible();
  await expect(page.getByTestId('invoice-metric-overdue')).toContainText('12,000.00');
  await expect(page.getByTestId('invoice-metric-overdue')).toContainText('400.00');
  await expect(page.getByTestId('invoice-metric-overdue')).toContainText('USD');
  await expect(page.getByTestId('invoice-metric-overdue')).toContainText('SAR');
  await expect(page.getByTestId('invoice-metric-collected')).toContainText('8,000.00');
  await expect(page.getByTestId('invoice-metric-collected')).toContainText('100.00');
  await expect(page.getByText(lang === 'ar' ? 'محصّلة هذا الشهر' : 'Collected this month', { exact: true })).toHaveCount(0);
  await expect(page.locator('.ledger-table')).toContainText('METRIC-later');
});
test('failed or repeated later invoice page never publishes partial totals', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  let fail = true;
  await page.route('**/api/invoices?*', route => {
    const second = new URL(route.request().url()).searchParams.get('page') === '2';
    if (second && fail) return route.fulfill({ status: 500, json: { error: 'synthetic failure' } });
    return route.fulfill({ json: { items: [row('first')], total: 2 } });
  });
  await page.goto('/app/invoices');
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load all invoices' })).toBeVisible();
  await expect(page.getByTestId('invoice-metric-collected')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load all invoices' })).toBeVisible();
  await expect(page.getByTestId('invoice-metric-collected')).toHaveCount(0);
});
