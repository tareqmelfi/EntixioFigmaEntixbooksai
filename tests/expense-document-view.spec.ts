import { expect, test, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { prepareVisualApp } from './fixtures/visual-app';

const pdf = new jsPDF();
pdf.text('Receipt - AI Credits', 20, 25);
pdf.text('Total paid: USD 10.80', 20, 265);
pdf.addPage();
pdf.text('Supporting document - page 2', 20, 25);
const pdfUrl = pdf.output('datauristring');
const expense = {
  id: 'receipt-view', number: 'EXP-VIEW-001', category: 'AI Credits',
  date: '2026-09-26', total: 10.8, subtotal: 10.8, amount: 10.8, taxAmount: 0,
  currency: 'USD', paymentMethod: 'CARD', vendorName: 'OpenRouter, Inc',
  documentNumber: 'RECEIPT-001', lineItems: [], paymentSplits: [],
};
async function ready(page: Page, lang: 'ar' | 'en' = 'ar') {
  await prepareVisualApp(page, lang);
  await page.route('**/api/expenses**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/attachments')) return route.fulfill({ json: { items: [
      { id: 'pdf', filename: 'receipt.pdf', contentType: 'application/octet-stream', url: pdfUrl },
      { id: 'image', filename: 'receipt.png', contentType: 'image/png', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
    ] } });
    return route.fulfill({ json: path.endsWith('/receipt-view') ? expense : { items: [expense], summary: { sumTotal: 10.8 }, total: 1 } });
  });
  await page.goto('/app/expenses/receipt-view');
  await expect(page.getByTestId('attachment-viewer')).toBeVisible();
}
for (const lang of ['ar', 'en'] as const) {
  test(`expense receipt fills available width, with fullscreen and working download (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ready(page, lang);
    const viewer = page.getByTestId('attachment-viewer');
    await viewer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000); // Let the browser PDF plug-in paint for the visual artifact.
    await page.screenshot({ path: `/tmp/entix-receipt-initial-${lang}.png` });
    const box = await viewer.boundingBox();
    const panel = await page.getByRole('complementary', { name: lang === 'ar' ? 'مرفقات المصروف' : 'Expense attachments' }).boundingBox();
    expect(box!.width).toBeGreaterThan(panel!.width * .9);
    const frame = viewer.locator('iframe');
    await expect(frame).toHaveAttribute('src', /#navpanes=0&view=Fit$/);
    await viewer.getByRole('button', { name: lang === 'ar' ? 'تكبير لعرض المستند' : 'Fit document width', exact: true }).click();
    await expect(frame).toHaveAttribute('src', /#navpanes=0&view=FitH$/);
    await viewer.getByRole('button', { name: lang === 'ar' ? 'عرض الصفحة كاملة' : 'Show whole page', exact: true }).click();
    await expect(frame).toHaveAttribute('src', /#navpanes=0&view=Fit$/);
    // Real PDF bytes remain available, including the second page; extension-based PDFs work too.
    const downloadPromise = page.waitForEvent('download');
    await viewer.getByRole('link', { name: lang === 'ar' ? 'تنزيل' : 'Download', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('receipt.pdf');
    expect(await download.failure()).toBeNull();
    await viewer.getByRole('button', { name: lang === 'ar' ? 'ملء الشاشة' : 'Full screen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('data-testid'))).toBe('attachment-viewer');
    const full = await viewer.boundingBox();
    expect(full!.width).toBe(1440);
    expect(full!.height).toBe(1000);
    await page.waitForTimeout(700); // PDF plug-in repaints after viewport resize.
    await page.screenshot({ path: `/tmp/entix-receipt-fullscreen-${lang}.png` });
    await expect(viewer.getByRole('link', { name: lang === 'ar' ? 'فتح في تبويب جديد' : 'Open in new tab' })).toHaveAttribute('target', '_blank');
    await viewer.getByRole('button', { name: lang === 'ar' ? 'إنهاء ملء الشاشة' : 'Exit full screen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await page.getByRole('button', { name: 'receipt.png', exact: true }).click();
    await expect(viewer.getByRole('img', { name: 'receipt.png' })).toBeVisible();
    await page.getByRole('button', { name: 'receipt.pdf', exact: true }).click();
    await expect(frame).toBeVisible();
    await page.screenshot({ path: `/tmp/entix-receipt-wide-${lang}.png`, fullPage: true });
  });
}
test('receipt stays inside a phone viewport and fullscreen rejection offers a usable alternative', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const viewer = page.getByTestId('attachment-viewer');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await viewer.evaluate(el => { el.requestFullscreen = () => Promise.reject(new Error('Not supported')); });
  await viewer.getByRole('button', { name: 'ملء الشاشة', exact: true }).click();
  await expect(viewer.getByRole('status')).toContainText('تبويب جديد');
  await expect(viewer.getByRole('link', { name: 'فتح في تبويب جديد' })).toBeVisible();
  await page.screenshot({ path: '/tmp/entix-receipt-mobile.png', fullPage: true });
});
