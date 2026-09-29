import { expect, test } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

for (const language of ['en', 'ar'] as const) {
  for (const status of [403, 413, 404, 500]) {
    test(`expense upload ${status} stays rejected without a fallback write (${language})`, async ({ page }) => {
      await prepareVisualApp(page, language);
      const expense = { id: 'upload-error', number: 'EXP-UPLOAD', category: 'Synthetic', date: '2026-09-29', total: 1,
        amount: 1, subtotal: 1, taxAmount: 0, currency: 'USD', paymentMethod: 'CASH', vendorName: 'Synthetic', lineItems: [], paymentSplits: [] };
      let patches = 0;
      let attempts = 0;
      const stored: any[] = [];
      await page.route('**/api/expenses**', async route => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        if (req.method() === 'PATCH') { patches++; return route.fulfill({ json: expense }); }
        if (path.endsWith('/attachments') && req.method() === 'POST') {
          attempts++;
          if (attempts === 1) return route.fulfill({ status, json: { error: { code: 'upload_rejected', message: 'Upload rejected for this test' }, messageAr: 'رفض رفع الملف في هذا الاختبار' } });
          stored.push({ id: 'file-ok', filename: 'retry.txt', contentType: 'text/plain', url: 'data:text/plain;base64,b2s=' });
          return route.fulfill({ json: stored[0] });
        }
        return route.fulfill({ json: path.endsWith('/attachments') ? { items: stored }
          : path.endsWith('/upload-error') ? expense : { items: [expense], total: 1, summary: { sumTotal: 1 } } });
      });
      await page.goto('/app/expenses/upload-error');
      const input = page.locator('input[type="file"]');
      await input.setInputFiles({ name: 'rejected.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic') });
      await expect.poll(() => attempts).toBe(1);
      await expect(page.getByRole('button', { name: language === 'ar' ? 'رفع مرفقات' : 'Upload attachments', exact: true })).toBeEnabled();
      expect(patches).toBe(0);
      await expect(page.getByText(status === 404
        ? /rejected.txt.*(Attachment upload is unavailable|خدمة رفع المرفقات غير متاحة)/
        : /rejected.txt.*(Upload rejected|رفض رفع)/)).toBeVisible();
      expect(patches).toBe(0);
      await expect(page.getByText(language === 'ar' ? 'تم رفع المرفق' : 'Attachment uploaded', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: language === 'ar' ? 'رفع مرفقات' : 'Upload attachments', exact: true })).toBeEnabled();
      await input.setInputFiles({ name: 'retry.txt', mimeType: 'text/plain', buffer: Buffer.from('ok') });
      await expect(page.getByText(language === 'ar' ? 'تم رفع المرفق' : 'Attachment uploaded', { exact: true })).toBeVisible();
      await expect(page.getByText('retry.txt', { exact: true }).first()).toBeVisible();
      expect(patches).toBe(0);
      expect(attempts).toBe(2);
    });
  }
}
