import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page: Page, language: 'ar' | 'en' = 'en', issueDate = '2025-02-05') {
  await prepareVisualApp(page, language);
  const invoice = { id: 'selected', contactId: 'buyer', contact: { id: 'buyer', displayName: 'Selected buyer' }, invoiceNumber: 'INV-SELECTED', issueDate, currency: 'USD', total: 100, amountPaid: 20, status: 'APPROVED', lines: [{ description: 'Selected service', quantity: 2 }] };
  const writes: any[] = []; let lists = 0;
  await page.route('**/api/contacts?*', r => r.fulfill({ json: { items: [{ id: 'buyer', displayName: 'Selected buyer' }] } }));
  await page.route('**/api/invoices/selected', r => r.fulfill({ json: invoice }));
  await page.route('**/api/invoices?*', r => { lists++; return r.fulfill({ json: { items: [invoice,
    { ...invoice, id: 'other', invoiceNumber: 'INV-OTHER' },
    { ...invoice, id: 'wrong', contactId: 'wrong-buyer', invoiceNumber: 'INV-WRONG' },
    { ...invoice, id: 'paid', invoiceNumber: 'INV-PAID', amountPaid: 100, status: 'PAID' },
    { ...invoice, id: 'currency', invoiceNumber: 'INV-CURRENCY', currency: 'SAR' },
    { ...invoice, id: 'cancelled', invoiceNumber: 'INV-CANCELLED', status: 'CANCELLED' },
  ] } }); });
  await page.route('**/api/vouchers?*', r => r.fulfill({ json: { items: [{ id: 'old', number: 'UNRELATED-RECEIPT', date: '2026-01-01', amount: 900, currency: 'USD', paymentMethod: 'CASH' }], summary: {} } }));
  await page.route('**/api/vouchers', r => { const body = r.request().postDataJSON(); writes.push(body); return r.fulfill({ json: { ...body, id: 'created', number: 'R-NEW' } }); });
  return { invoice, writes, lists: () => lists };
}

for (const lang of ['ar', 'en'] as const) test(`invoice payment replaces the ledger and uses authoritative invoice context (${lang})`, async ({ page }, info) => {
  const f = await setup(page, lang);
  await page.goto('/app/receipts?new=1&invoiceId=selected&contactId=wrong&amount=999&date=2026-10-01');
  await expect(page.getByRole('region', { name: lang === 'ar' ? 'الفاتورة المحددة' : 'Selected invoice' })).toContainText('INV-SELECTED');
  await expect(page.getByText('UNRELATED-RECEIPT', { exact: true })).toHaveCount(0);
  await expect(page.getByText('INV-OTHER', { exact: true })).toHaveCount(0);
  expect(f.lists()).toBe(0);
  const date = page.getByLabel(lang === 'ar' ? 'تاريخ الدفعة' : 'Payment date', { exact: false });
  await expect(date).toHaveValue('05/02/2025');
  await page.getByRole('button', { name: lang === 'ar' ? 'اليوم' : 'Today', exact: true }).click();
  await expect(date).not.toHaveValue('05/02/2025');
  await page.getByRole('button', { name: lang === 'ar' ? 'بتاريخ الفاتورة' : 'Use invoice date', exact: true }).click();
  await expect(date).toHaveValue('05/02/2025');
  const amount = page.getByLabel(lang === 'ar' ? 'مبلغ الدفعة' : 'Payment amount', { exact: false });
  await expect(amount).toHaveValue('80.00'); await amount.fill('30');
  await page.screenshot({ path: info.outputPath(`focused-${lang}.png`), fullPage: true });
  await page.getByRole('button', { name: lang === 'ar' ? 'حفظ' : 'Save', exact: true }).click();
  await expect.poll(() => f.writes.length).toBe(1);
  expect(f.writes[0]).toMatchObject({ invoiceId: 'selected', contactId: 'buyer', currency: 'USD', amount: 30, date: '2025-02-05' });
});

test('other invoices require opt-in and exclude unrelated, paid, cancelled and different currencies', async ({ page }) => {
  const f = await setup(page); await page.goto('/app/receipts?new=1&invoiceId=selected');
  await expect(page.getByLabel('Payment amount')).toHaveValue('80.00');
  await page.getByRole('button', { name: 'Allocate to other invoices for this customer' }).click();
  await expect(page.getByText('INV-OTHER', { exact: true })).toBeVisible(); expect(f.lists()).toBe(1);
  for (const number of ['INV-WRONG','INV-PAID','INV-CURRENCY','INV-CANCELLED']) await expect(page.getByText(number, { exact: true })).toHaveCount(0);
  await page.getByLabel('Amount INV-OTHER', { exact: true }).fill('10');
  await page.getByLabel('Amount INV-SELECTED', { exact: true }).fill('');
  await page.getByLabel('Amount INV-OTHER', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Allocate an amount to at least one invoice, or use the selected invoice only.')).toBeVisible(); expect(f.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Use selected invoice only' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => f.writes.length).toBe(1); expect(f.writes[0]).toMatchObject({ invoiceId: 'selected', amount: 80 });
});

test('missing invoice cannot fall back to an unrelated customer receipt', async ({ page }) => {
  const f = await setup(page);
  await page.route('**/api/invoices/selected', r => r.fulfill({ status: 404, json: { error: 'not_found' } }));
  await page.goto('/app/receipts?new=1&invoiceId=selected&contactId=wrong&amount=999');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled(); expect(f.writes).toHaveLength(0);
});

for (const lang of ['ar', 'en'] as const) test(`ten-year-old receipt accepts typed dates and rejects impossible dates (${lang})`, async ({ page }) => {
  const f = await setup(page, lang, '2016-02-01');
  await page.goto('/app/receipts?new=1&invoiceId=selected');
  const date = page.getByLabel(lang === 'ar' ? 'تاريخ الدفعة' : 'Payment date', { exact: false });
  await expect(date).toHaveValue('01/02/2016');
  await date.fill('30/02/2016'); await date.press('Tab');
  await expect(page.getByTestId('date-invalid')).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await date.fill(lang === 'ar' ? '٢٩/٠٢/٢٠١٦' : '29/02/2016'); await date.press('Tab');
  await expect(date).toHaveValue('29/02/2016');
  await expect(page.getByTestId('date-invalid')).toHaveCount(0);
  await page.getByRole('button', { name: lang === 'ar' ? 'حفظ' : 'Save', exact: true }).click();
  await expect.poll(() => f.writes.length).toBe(1);
  expect(f.writes[0]).toMatchObject({ invoiceId: 'selected', date: '2016-02-29', amount: 80 });
});
