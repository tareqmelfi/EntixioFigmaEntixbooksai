import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
import { createHash } from 'node:crypto';

for (const language of ['ar', 'en'] as const) {
  test(`receipt over 10MB extracts, retries and saves its exact original (${language})`, async ({ page }) => {
    await prepareVisualApp(page, language);
    const original = Buffer.alloc(30 * 1024 * 1024, 32);
    original.write('%PDF-1.7 synthetic boundary test');
    const hash = createHash('sha256').update(original).digest('hex');
    let attempts = 0;
    let saves = 0;
    await page.route('**/api/agent/extract-document', async route => {
      const body = route.request().postDataJSON();
      expect(createHash('sha256').update(Buffer.from(body.fileBase64, 'base64')).digest('hex')).toBe(hash);
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'temporary_failure', message: 'Synthetic temporary failure' } });
      return route.fulfill({ json: { kind: 'expense', confidence: 0.99, issuer: { name: 'Synthetic receipt supplier' },
        currency: 'USD', issueDate: '2026-10-01', documentNumber: 'LARGE-TEST', sourceFileHash: hash,
        lines: [{ description: 'Synthetic service', quantity: 1, unitPrice: 50, lineTotal: 50, taxRate: 0 }],
        totals: { subtotal: 50, tax: 0, total: 50 }, warnings: [] } });
    });
    await page.route('**/api/expenses', async route => {
      const data = route.request().postDataJSON();
      expect(data.sourceFileHash).toBe(hash);
      expect(data.currency).toBe('USD');
      expect(data.totalAmount).toBe(50);
      expect(data.attachments).toHaveLength(1);
      expect(data.attachments[0].sizeBytes).toBe(original.length);
      expect(createHash('sha256').update(Buffer.from(data.attachments[0].base64, 'base64')).digest('hex')).toBe(hash);
      saves++;
      return route.fulfill({ status: 201, json: { id: 'synthetic', number: 'EXP-LARGE-TEST' } });
    });
    await page.goto('/app/scan-receipts');
    const input = page.locator('input[type="file"]');
    expect(await input.getAttribute('accept')).toBeNull();
    await input.setInputFiles({ name: 'large-receipt.pdf', mimeType: 'application/pdf', buffer: original });
    await expect(page.getByText('Synthetic temporary failure')).toBeVisible();
    expect(saves).toBe(0);
    await page.getByRole('button', { name: language === 'ar' ? 'إعادة المحاولة' : 'Retry extraction', exact: true }).click();
    await expect(page.getByText('Synthetic receipt supplier')).toBeVisible();
    await page.getByRole('button', { name: language === 'ar' ? 'تسجيل' : 'Record', exact: true }).click();
    await expect(page.getByText(/EXP-LARGE-TEST/)).toBeVisible();
    expect(attempts).toBe(2);
    expect(saves).toBe(1);
  });
}

test('clearing a large-file queue never extracts removed pending files', async ({ page }) => {
  await prepareVisualApp(page);
  let requests = 0;
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/agent/extract-document', async route => {
    requests++;
    await blocked;
    await route.fulfill({ status: 503, json: { error: 'synthetic_failure' } });
  });
  await page.goto('/app/scan-receipts');
  await page.locator('input[type="file"]').setInputFiles(Array.from({ length: 4 }, (_, i) => ({
    name: `receipt-${i}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Synthetic receipt'),
  })));
  await expect.poll(() => requests).toBe(2);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  release();
  await expect(page.getByText('receipt-2.txt')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(requests).toBe(2);
});
