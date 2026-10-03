import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

for (const language of ['ar', 'en'] as const) {
  test(`overdue chip and deep link include issued and partial unpaid invoices (${language})`, async ({ page }) => {
    await prepareVisualApp(page, language);
    await page.setViewportSize({ width: 1280, height: 950 });
    const rows = [
      ['issued', 'SENT', 0, '2020-01-01'], ['partial', 'PARTIAL', 40, '2020-01-01'],
      ['paid', 'PAID', 100, '2020-01-01'], ['draft', 'DRAFT', 0, '2020-01-01'],
      ['cancelled', 'CANCELLED', 0, '2020-01-01'], ['future', 'APPROVED', 0, '2099-01-01'],
      ['settled-issued', 'SENT', 100, '2020-01-01'],
    ].map(([id, status, amountPaid, dueDate]) => ({ id, status, amountPaid, dueDate, invoiceNumber: `AUDIT-${id}`, total: 100, currency: 'USD', issueDate: '2020-01-01', contactId: 'synthetic', contact: { id: 'synthetic', displayName: 'Synthetic buyer' }, lines: [] }));
    await page.route('**/api/invoices?*', r => r.fulfill({ json: { items: rows, total: rows.length } }));
    await page.goto('/app/invoices');
    const chip = page.getByRole('button', { name: language === 'ar' ? 'متأخرة 2' : 'Overdue 2', exact: true });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.locator('.ledger-table tbody tr')).toHaveCount(2);
    await expect(page.locator('.ledger-table')).toContainText('AUDIT-issued');
    await expect(page.locator('.ledger-table')).toContainText('AUDIT-partial');
    await page.goto('/app/invoices?status=OVERDUE');
    await expect(page.locator('.ledger-table tbody tr')).toHaveCount(2);
  });
}
