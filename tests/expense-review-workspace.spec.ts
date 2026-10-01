import { expect, test, type Page, type Locator } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

const items = ['DRAFT', 'PAID'].map((status, i) => ({ id: `review-${i}`, number: `EXP-REVIEW-${i}`, status,
  updatedAt: '2026-10-01T00:00:00.000Z', category: 'Fuel', vendorName: 'Synthetic supplier',
  date: '2026-09-15', currency: 'SAR', amount: 100, subtotal: 100, total: 115, taxAmount: 15,
  paymentMethod: 'CASH', accountId: 'cost', attachmentCount: 2,
  lineItems: [{ description: 'Synthetic fuel', quantity: 1, unitPrice: 100, taxRate: .15, lineTotal: 115, accountId: 'cost' }], paymentSplits: [],
}));
async function setup(page: Page, lang: 'ar' | 'en' = 'ar') {
  await prepareVisualApp(page, lang);
  await page.goto('/');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 700; c.height = 1900; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0,0,700,1900); x.strokeStyle = '#112f52'; x.lineWidth = 15; x.strokeRect(10,10,680,1880); x.fillStyle = '#112f52'; x.font = '32px sans-serif'; x.fillText('SYNTHETIC RECEIPT', 60, 90); for(let i=0;i<22;i++) x.fillText(`Receipt item ${i+1}`,60,180+i*60); x.fillText('END OF RECEIPT — SAR 115',60,1820); return c.toDataURL(); });
  const attachments = ['receipt.png', 'support.png'].map((filename, i) => ({ id: `a-${i}`, filename, contentType: 'image/png', url: png }));
  const requests: Array<{ id: string; body: any }> = [];
  await page.route('**/api/accounts**', route => route.fulfill({ json: { items: [{ id: 'cost', code: '500', name: 'Fuel', nameAr: 'وقود', type: 'EXPENSE' }, { id: 'new-cost', code: '510', name: 'Meals', nameAr: 'وجبات', type: 'EXPENSE' }], total: 2 } }));
  await page.route('**/api/expenses**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/review')) {
      const id = path.split('/').at(-2)!; const body = route.request().postDataJSON(); requests.push({ id, body });
      if (id === 'review-1') return route.fulfill({ status: 409, json: { error: 'expense_changed_retry', messageAr: 'تغير المصروف؛ أعد فتحه.', message: 'Expense changed; reopen.' } });
      return route.fulfill({ json: { ...items[0], ...body } });
    }
    return route.fulfill({ json: path.endsWith('/attachments') ? { items: attachments } : items.find(e => path.endsWith(`/${e.id}`)) || { items, total: 2, summary: { sumTotal: 230 } } });
  });
  return requests;
}
async function aligned(table: Locator, heading: string, rtl: boolean) {
  await expect(table.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
  await expect(table.locator('tbody tr').first().locator('span[dir=ltr]').first()).toBeVisible();
  const index = await table.locator('thead th').evaluateAll((heads, text) => heads.findIndex(h => h.textContent?.trim() === text), heading);
  expect(index).toBeGreaterThan(-1);
  const edges = await table.evaluate((node, { index, rtl }) => {
    const th = node.querySelectorAll('thead th')[index]; const td = node.querySelectorAll('tbody tr')[0].children[index];
    const range = document.createRange(); range.selectNodeContents(th); const a = range.getBoundingClientRect();
    const value = td.querySelector('span')!; range.selectNodeContents(value); const b = range.getBoundingClientRect();
    return { a: rtl ? a.right : a.left, b: rtl ? b.right : b.left };
  }, { index, rtl });
  expect(Math.abs(edges.a - edges.b)).toBeLessThan(2);
}
for (const lang of ['ar', 'en'] as const) test(`split receipt fits whole page and monetary column edges match (${lang})`, async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 }); await setup(page, lang);
  await page.goto('/app/expenses/review-1');
  const viewer = page.getByTestId('attachment-viewer'); const image = viewer.locator('img');
  await expect(image).toBeVisible(); await expect(image).toHaveCSS('object-fit', 'contain');
  const fields = page.getByTestId('expense-review-workspace').locator(':scope > div').last();
  const a = (await viewer.boundingBox())!, b = (await fields.boundingBox())!;
  expect(a.height).toBeLessThan(700); expect(Math.abs(a.y-b.y)).toBeLessThan(150);
  expect(lang === 'ar' ? a.x < b.x : a.x > b.x).toBe(true);
  for(const table of await page.getByRole('table').all()) {
    const head = table.getByRole('columnheader', { name: lang === 'ar' ? 'المبلغ' : 'Amount', exact: true });
    if(await head.count()) await aligned(table, lang === 'ar' ? 'المبلغ' : 'Amount', lang === 'ar');
    else await aligned(table, lang === 'ar' ? 'السعر' : 'Price', lang === 'ar');
  }
  await viewer.getByRole('button', { name: lang === 'ar' ? 'تكبير لعرض المستند' : 'Fit document width', exact: true }).click();
  expect(await image.evaluate(e => e.clientHeight > e.parentElement!.clientHeight)).toBe(true);
  await page.getByRole('button', { name: 'support.png', exact: true }).click();
  await expect(viewer.locator('img')).toHaveCSS('object-fit', 'contain');
  await page.screenshot({ path: `/tmp/entix-expense-review-${lang}.png`, fullPage: true });
  await page.goto('/app/expenses'); await aligned(page.getByRole('table'), lang === 'ar' ? 'المبلغ' : 'Amount', lang === 'ar');
});
test('bulk review keeps records scoped, reports partial failure and does not approve or delete paid records', async ({ page }) => {
  const requests = await setup(page); await page.goto('/app/expenses');
  await page.getByRole('checkbox', { name: 'تحديد المعروض', exact: true }).check();
  await expect(page.getByRole('button', { name: 'حذف المسودات المحددة' })).toBeDisabled();
  await page.getByRole('button', { name: 'تغيير الحساب / التصنيف' }).click();
  const form = page.getByRole('region', { name: 'تعديل الحساب والتصنيف' });
  await form.getByTitle('إبقاء الحساب الحالي', { exact: true }).click();
  await page.getByText('510 · وجبات', { exact: true }).click();
  await form.getByLabel('التصنيف الجديد (اختياري)', { exact: true }).fill('مراجعة المورد');
  await form.getByLabel('سبب التعديل').fill('تصحيح التصنيف حسب المستند');
  await form.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(form).toContainText('تم الحفظ'); await expect(form).toContainText('تغير المصروف');
  expect(requests.map(r => r.id)).toEqual(['review-0', 'review-1']);
  for(const r of requests) { expect(r.body.expectedUpdatedAt).toBe(items[0].updatedAt); expect(r.body.category).toBe('مراجعة المورد'); expect(r.body.accountId).toBe('new-cost'); expect(r.body.status).toBeUndefined(); expect(r.body.amount).toBeUndefined(); }
  await expect(form.getByRole('button', { name: 'حفظ التعديل' })).toBeDisabled();
  await form.getByRole('button', { name: 'إغلاق' }).click();
  await page.getByRole('searchbox').fill('EXP-REVIEW-0');
  await expect(page.getByRole('button', { name: 'تغيير الحساب / التصنيف' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'تحديد EXP-REVIEW-0', exact: true })).not.toBeChecked();
});
test('paid edit opens inline review and draft edit retains every stored attachment', async ({ page }) => {
  await setup(page); await page.goto('/app/expenses');
  await page.getByRole('row').filter({ hasText: 'EXP-REVIEW-1' }).getByRole('button', { name: 'تعديل', exact: true }).click();
  await expect(page.getByRole('region', { name: 'تعديل الحساب والتصنيف' })).toBeVisible();
  await page.goto('/app/expenses/review-0');
  await expect(page.getByRole('button', { name: 'support.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'تعديل', exact: true }).click();
  await expect(page.getByText('receipt.png', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('support.png', { exact: true }).first()).toBeVisible();
  const receipt = page.getByRole('img', { name: 'receipt.png', exact: true });
  await expect(receipt).toHaveCSS('object-fit', 'contain');
  const bounds = (await receipt.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThan(page.viewportSize()!.height - 60);
  await page.screenshot({ path: '/tmp/entix-expense-editor-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

test('server throttling resumes a review without duplicating its accepted change', async ({ page }) => {
  const requests = await setup(page); let reads = 0, writes = 0;
  await page.route('**/api/expenses/review-0', route => ++reads === 1 ? route.fulfill({ status: 429, headers: { 'Retry-After': '1', 'Access-Control-Expose-Headers': 'Retry-After' }, json: { error: 'rate_limit' } }) : route.fallback());
  await page.route('**/api/expenses/review-0/review', route => ++writes === 1 ? route.fulfill({ status: 429, headers: { 'Retry-After': '1', 'Access-Control-Expose-Headers': 'Retry-After' }, json: { error: 'rate_limit' } }) : route.fallback());
  await page.goto('/app/expenses');
  await page.getByRole('checkbox', { name: 'تحديد EXP-REVIEW-0', exact: true }).check();
  await page.getByRole('button', { name: 'تغيير الحساب / التصنيف' }).click();
  const form = page.getByRole('region', { name: 'تعديل الحساب والتصنيف' });
  await expect(form).toContainText('مهلة مؤقتة');
  await form.getByLabel('سبب التعديل').fill('تصحيح التصنيف');
  await form.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(form).toContainText('تم الحفظ');
  expect(reads).toBe(2); expect(writes).toBe(2); expect(requests).toHaveLength(1);
});
