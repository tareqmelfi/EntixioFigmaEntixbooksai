import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

const product = { id: 'bilingual-item', sku: 'TEST-BILINGUAL', name: 'Workflow mapping', nameAr: 'تخطيط سير العمل', type: 'SERVICE', unitPrice: 120 };
async function products(page: import('@playwright/test').Page, locale: 'ar' | 'en') {
  await prepareVisualApp(page, locale);
  await page.route('**/api/products', r => r.fulfill({ json: { items: [product] } }));
}

test('explicit language survives failed preference save, reload and stale second tab', async ({ page, context }) => {
  await products(page, 'ar');
  await page.route('**/me/preferences', r => r.fulfill({ status: 503, json: { error: 'unavailable' } }));
  const other = await context.newPage();
  await products(other, 'ar');
  await other.goto('/app/products');
  await expect(other.locator('html')).toHaveAttribute('lang', 'ar');
  await page.goto('/app/products');
  await page.getByRole('button', { name: 'تغيير اللغة إلى الإنجليزية' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(other.locator('html')).toHaveAttribute('lang', 'en');
  await other.reload();
  await expect(other.getByRole('heading', { name: 'Products & Services' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Products & Services' })).toBeVisible();
  // A public URL remains Arabic without changing this user's app preference.
  await other.goto('/sa/ar');
  await expect(other.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Products & Services' })).toBeVisible();
});

for (const locale of ['en', 'ar'] as const) {
  test(`product list uses saved ${locale} name and switches immediately`, async ({ page }) => {
    await products(page, locale);
    await page.goto('/app/products');
    await expect(page.getByRole('link', { name: locale === 'en' ? product.name : product.nameAr, exact: true })).toBeVisible();
    await page.getByRole('button', { name: locale === 'en' ? 'Switch language to Arabic' : 'تغيير اللغة إلى الإنجليزية' }).first().click();
    await expect(page.getByRole('link', { name: locale === 'en' ? product.nameAr : product.name, exact: true })).toBeVisible();
  });
}

for (const locale of ['en', 'ar'] as const) {
  test(`product detail and linked accounts follow ${locale} without resetting edits`, async ({ page }) => {
    await products(page, locale);
    const income = { id: 'revenue', code: '4000', name: 'Services revenue', nameAr: 'إيراد الخدمات', type: 'REVENUE' };
    const expense = { id: 'cost', code: '5000', name: 'Service costs', nameAr: 'تكلفة الخدمات', type: 'EXPENSE' };
    await page.route('**/api/accounts', r => r.fulfill({ json: { items: [income, expense] } }));
    await page.route('**/api/products/bilingual-item', r => r.fulfill({ json: { ...product, incomeAccountId: income.id, expenseAccountId: expense.id } }));
    await page.goto('/app/products/bilingual-item');
    await expect(page.getByRole('heading', { name: locale === 'en' ? product.name : product.nameAr, exact: true })).toBeVisible();
    await expect(page.getByTestId('product-income-account').getByRole('button', { name: `4000 · ${locale === 'en' ? income.name : income.nameAr}`, exact: true })).toBeVisible();
    const sku = page.locator('input[value="TEST-BILINGUAL"]');
    await sku.fill('UNSAVED-SKU');
    await page.getByRole('button', { name: locale === 'en' ? 'Switch language to Arabic' : 'تغيير اللغة إلى الإنجليزية' }).first().click();
    await expect(page.getByRole('heading', { name: locale === 'en' ? product.nameAr : product.name, exact: true })).toBeVisible();
    await expect(page.getByTestId('product-income-account').getByRole('button', { name: `4000 · ${locale === 'en' ? income.nameAr : income.name}`, exact: true })).toBeVisible();
    await expect(page.locator('input[value="UNSAVED-SKU"]')).toHaveValue('UNSAVED-SKU');
  });
}

test('an older tab can save the next choice even when its cached account locale matches', async ({ page, context }) => {
  const writes: string[] = [];
  for (const tab of [page, await context.newPage()]) {
    await products(tab, 'ar');
    await tab.route('**/me/preferences', r => {
      writes.push(r.request().postDataJSON().locale);
      return r.fulfill({ json: { locale: writes.at(-1) } });
    });
    await tab.goto('/app/products');
    await expect(tab.getByRole('heading', { name: 'المنتجات والخدمات' })).toBeVisible();
  }
  const other = context.pages()[1];
  await page.getByRole('button', { name: 'تغيير اللغة إلى الإنجليزية' }).first().click();
  await expect(other.getByRole('heading', { name: 'Products & Services' })).toBeVisible();
  await expect.poll(() => writes).toEqual(['en']);
  await other.getByRole('button', { name: 'Switch language to Arabic' }).first().click();
  await expect(page.getByRole('heading', { name: 'المنتجات والخدمات' })).toBeVisible();
  await expect.poll(() => writes).toEqual(['en', 'ar']);
});

test('explicit choice belongs to the verified user, not another account on the device', async ({ page }) => {
  await products(page, 'ar');
  await page.addInitScript(() => localStorage.setItem('entix-app-language:someone-else', 'en'));
  await page.goto('/app/products');
  await expect(page.getByRole('heading', { name: 'المنتجات والخدمات' })).toBeVisible();
});
