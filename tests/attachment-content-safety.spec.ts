import { expect, test, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function attachment(page: Page, file: Record<string, string>) {
  await prepareVisualApp(page, 'en');
  const expense = { id: 'safe-preview', number: 'EXP-SAFE', category: 'Synthetic', date: '2026-09-26', total: 1, amount: 1,
    subtotal: 1, taxAmount: 0, currency: 'USD', paymentMethod: 'CASH', vendorName: 'Synthetic', lineItems: [], paymentSplits: [] };
  await page.route('**/api/expenses**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/attachments') ? { items: [{ id: 'attachment-a', ...file }] }
      : path.endsWith('/safe-preview') ? expense : { items: [expense], total: 1, summary: { sumTotal: 1 } } });
  });
  await page.goto('/app/expenses/safe-preview');
}

for (const metadata of ['image/svg+xml', 'image/png']) test(`active SVG data stays download-only despite ${metadata} metadata`, async ({ page }) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="UNSAFE-SCRIPT"</script><text x="0" y="20">Synthetic SVG</text></svg>';
  await attachment(page, { filename: 'untrusted.svg', contentType: metadata, url: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
  await expect(page.getByText('This format cannot be previewed in the browser')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in new tab' })).toHaveCount(0);
  const link = page.locator('a[download="untrusted.svg"]');
  await expect(link).toBeVisible();
  const type = await link.evaluate(async el => (await fetch((el as HTMLAnchorElement).href)).headers.get('content-type'));
  expect(type).toBe('application/octet-stream');
  const pending = page.waitForEvent('download');
  await link.click(); expect((await pending).suggestedFilename()).toBe('untrusted.svg');
});
for (const url of ['javascript:alert(1)', 'blob:https://example.test/not-owned', 'file:///etc/passwd']) test(`persisted unsafe URL is rejected: ${url.split(':')[0]}`, async ({ page }) => {
  await attachment(page, { filename: 'untrusted.pdf', contentType: 'application/pdf', url });
  await expect(page.getByText('Could not prepare the attachment for preview')).toBeVisible();
  await expect(page.getByTestId('attachment-viewer')).toHaveCount(0);
});
