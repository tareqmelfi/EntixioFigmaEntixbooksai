import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page: Page, lang: 'en' | 'ar' = 'en') {
  await prepareVisualApp(page, lang);
  await page.route('**/api/bank-accounts', r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/bills?*', r => r.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/api/expenses?*', r => r.fulfill({ json: { items: [], total: 0 } }));
  const writes: any[] = [];
  let fail = false;
  await page.route('**/api/expenses', r => {
    writes.push(r.request().postDataJSON());
    return r.fulfill(fail ? { status: 503, json: { error: 'Synthetic failure' } } : { json: { id: 'synthetic-draft' } });
  });
  await page.route('**/api/bills', r => {
    writes.push(r.request().postDataJSON());
    return r.fulfill({ json: { id: 'synthetic-bill' } });
  });
  await page.route('**/api/agent/extract-document', r => r.fulfill({ json: {
    kind: 'bill', confidence: 1, documentNumber: 'SYNTHETIC-SOURCE', currency: 'USD',
    lines: [{ description: 'Synthetic service', quantity: 1, unitPrice: 25, taxRate: 0 }],
  } }));
  return { writes, setFail: (v: boolean) => { fail = v; } };
}
const description = (page: Page) => page.getByPlaceholder(/^(Description|الوصف)$/).first();
const cancel = (page: Page) => page.getByRole('button', { name: /^(Cancel|إلغاء)$/ });
async function open(page: Page) {
  await page.goto('/app/purchases/records/new');
  await expect(page.getByRole('button', { name: /^(Save as payable|حفظ كمستحق)$/ })).toBeEnabled();
}
async function empty(page: Page) {
  await open(page);
  await expect(description(page)).toHaveValue('');
  await expect(page.getByText(/We restored an unsaved draft|استعدنا مسودة/)).toHaveCount(0);
  await expect(page.getByText('source.pdf', { exact: true })).toHaveCount(0);
}
for (const lang of ['en', 'ar'] as const) test(`cancel, stay, discard, reload and reopen (${lang})`, async ({ page }) => {
  const state = await setup(page, lang);
  if (lang === 'ar') await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await description(page).fill('Must not return after discard');
  await cancel(page).click();
  await expect(page.getByTestId('unsaved-exit-guard')).toBeVisible();
  await page.getByTestId('unsaved-stay').click();
  await expect(description(page)).toHaveValue('Must not return after discard');
  await cancel(page).click();
  await page.getByTestId('unsaved-discard').click();
  await expect(page).toHaveURL(/\/purchases\/records$/);
  await page.reload();
  await empty(page);
  expect(state.writes).toHaveLength(0);
});

test('discard clears imported files before reopening; start-fresh can cache new work', async ({ page }) => {
  await setup(page); await open(page);
  const upload = () => page.locator('input[type="file"]').setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') });
  await upload();
  await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
  page.once('dialog', d => d.accept()); await page.reload();
  await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard draft and start fresh', exact: true }).click();
  await expect(description(page)).toHaveValue('');
  await expect(page.getByText('source.pdf', { exact: true })).toHaveCount(0);
  await upload();
  await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق وعودة للقائمة' }).click();
  await page.getByTestId('unsaved-discard').click();
  await expect(page).toHaveURL(/\/purchases\/records$/);
  await empty(page);
});

test('sidebar navigation keeps its destination; failed save retains work and successful save creates a draft once', async ({ page }) => {
  const state = await setup(page); await open(page);
  await description(page).fill('Synthetic service');
  await page.getByLabel('Line price', { exact: true }).first().fill('25');
  await page.getByRole('button', { name: 'Paid now', exact: true }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByTestId('unsaved-exit-guard')).toBeVisible();
  state.setFail(true);
  await page.getByTestId('unsaved-save').click();
  await expect(page.getByTestId('unsaved-exit-guard').getByRole('alert')).toBeVisible();
  await expect(description(page)).toHaveValue('Synthetic service');
  state.setFail(false);
  await page.getByTestId('unsaved-save').click();
  await expect(page).toHaveURL(/\/app$/);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({ status: 'DRAFT', totalAmount: 25 });
  await empty(page);
});

test('Escape and browser Back use the discard guard without creating a document', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/app/purchases/records');
  await page.getByRole('link', { name: /Record a purchase|New purchase/ }).click();
  await expect(description(page)).toBeEditable();
  await description(page).fill('Back navigation');
  await description(page).blur();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('unsaved-exit-guard')).toBeVisible();
  await page.getByTestId('unsaved-stay').click();
  await page.goBack();
  await expect(page.getByTestId('unsaved-exit-guard')).toBeVisible();
  await page.getByTestId('unsaved-discard').click();
  await expect(page).toHaveURL(/\/purchases\/records$/);
  await empty(page);
  expect(state.writes).toHaveLength(0);
});

test('attachment-only discard waits for cache deletion and stays open if deletion fails', async ({ page }) => {
  const state = await setup(page);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) {
      if ((window as any).failDraftDelete && this.name === 'files') throw new Error('Synthetic cache failure');
      return original.call(this, key);
    };
  });
  await page.route('**/api/agent/extract-document', r => r.fulfill({ json: { kind: 'bill', confidence: 1, lines: [] } }));
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') });
  await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
  await expect(description(page)).toHaveValue('');
  await page.evaluate(() => { (window as any).failDraftDelete = true; });
  await cancel(page).click();
  await page.getByTestId('unsaved-discard').click();
  await expect(page.getByTestId('unsaved-exit-guard').getByRole('alert')).toContainText('Could not remove');
  await expect(page).toHaveURL(/\/records\/new$/);
  await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).failDraftDelete = false; });
  await page.getByTestId('unsaved-discard').click();
  await expect(page).toHaveURL(/\/purchases\/records$/);
  await empty(page);
  expect(state.writes).toHaveLength(0);
});
