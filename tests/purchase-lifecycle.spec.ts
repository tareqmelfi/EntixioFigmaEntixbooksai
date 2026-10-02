import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

test('expense entry shows cross-purchase review inside the editor and offers linked bill payment', async ({ page }) => {
  await prepareVisualApp(page, 'ar');
  const writes: any[] = [];
  await page.route('**/api/expenses**', route => {
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ingestion: { outcome: 'SIMILARITY_REVIEW_REQUIRED', similarityReview: {
        crossPurchase: true, candidate: { entityType: 'Bill', id: 'existing-bill', status: 'RECEIVED' },
        tier: 'EXACT', matchedSignals: ['canonical_party', 'amount', 'currency'], differingSignals: [],
        decisionToken: 'synthetic-signed-review', allowedActions: ['CREATE_SEPARATE'],
      } } } });
    }
    return route.fulfill({ json: { items: [], summary: {}, total: 0 } });
  });
  await page.goto('/app/expenses/new');
  await page.getByPlaceholder('مثال: شركة الكهرباء').fill('Synthetic supplier');
  await page.getByPlaceholder('مثال: ضيافة ووجبات · فواتير خدمات').fill('Synthetic purchase');
  await page.getByPlaceholder('0.00', { exact: true }).first().fill('100');
  await page.getByRole('button', { name: 'حفظ كمسودة', exact: true }).click();
  const review = page.getByRole('region', { name: 'مراجعة تشابه المستندات' });
  await expect(review).toBeVisible();
  await expect(page.locator('[data-full-page-form]')).toContainText('مستند مشابه يحتاج مراجعة');
  await expect(review.getByRole('link', { name: 'فتح المستند الموجود' })).toHaveAttribute('href', '/app/purchases/bills/existing-bill');
  await expect(review.getByRole('link', { name: 'سداد الفاتورة الموجودة' })).toHaveAttribute('href', '/app/payments/new?billId=existing-bill');
  expect(writes).toHaveLength(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/entix-purchase-review-ar.png', fullPage: false });
  await review.getByRole('button', { name: 'مراجعة البيانات' }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByPlaceholder('مثال: شركة الكهرباء')).toHaveValue('Synthetic supplier');
  expect(writes).toHaveLength(1);
});

test('payment deep link prefills the bill, sends its currency, and retries with the same key', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  const bill = { id: 'bill-one', contactId: 'supplier-one', billNumber: 'BILL-ONE', currency: 'USD', total: 100, amountPaid: 40, status: 'PARTIAL', issueDate: '2026-09-15' };
  await page.route('**/api/bills**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/bill-one') ? bill : { items: [bill] } }));
  await page.route('**/api/contacts**', route => route.fulfill({ json: { items: [{ id: 'supplier-one', displayName: 'Synthetic supplier', isSupplier: true }] } }));
  const writes: any[] = [];
  await page.route('**/api/vouchers**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); writes.push(body);
      if (writes.length === 1) return route.fulfill({ status: 503, json: { error: 'temporary', message: 'Synthetic connection interruption; retry' } });
      return route.fulfill({ status: 200, json: { ...body, id: 'saved-payment', number: 'PAY-ONE' } });
    }
    return route.fulfill({ json: { items: [], summary: { sumAmount: '0', avgAmount: '0' } } });
  });
  await page.goto('/app/payments/new?billId=bill-one');
  await expect(page.getByRole('spinbutton').last()).toHaveValue('60');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].idempotencyKey).toBeTruthy();
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({ billId: 'bill-one', contactId: 'supplier-one', amount: 60, currency: 'USD' });
});
