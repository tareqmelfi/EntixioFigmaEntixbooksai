import { expect, test, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
const expense = { id: 'return-test', number: 'EXP-RETURN-001', category: 'AI Credits', date: '2026-09-26', total: 10.8, subtotal: 10.8, taxAmount: 0, currency: 'USD', paymentMethod: 'CARD', vendorName: 'Supplier', lineItems: [], paymentSplits: [] };
async function ready(page: Page, lang: 'ar' | 'en' = 'ar') {
  await prepareVisualApp(page, lang);
  await page.route('**/api/expenses**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/attachments')) return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: path.endsWith('/return-test') ? expense : { items: [expense], summary: { sumTotal: 10.8 }, total: 1 } });
  });
  await page.route('**/api/accounts**', route => route.fulfill({ json: { items: [] } }));
}
function sidebarExpenses(page: Page, lang: 'ar' | 'en' = 'ar') {
  return page.locator('nav:visible').getByRole('link', { name: lang === 'ar' ? 'المصروفات' : 'Expenses', exact: true });
}
for (const lang of ['ar', 'en'] as const) {
  test(`sidebar returns directly from expense detail to list (${lang})`, async ({ page }) => {
    await ready(page, lang);
    await page.goto('/app/expenses/return-test');
    await expect(page.getByRole('heading', { name: /EXP-RETURN-001/ })).toBeVisible();
    await sidebarExpenses(page, lang).click();
    await expect(page).toHaveURL(/\/app\/expenses$/);
    await expect(page.getByRole('heading', { name: lang === 'ar' ? 'قائمة المصروفات' : 'Expenses List', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /EXP-RETURN-001/ })).toHaveCount(0);
    // Repeating the same section click still opens the list after reopening a record.
    await page.getByRole('link', { name: 'EXP-RETURN-001', exact: true }).click();
    await expect(page.getByRole('heading', { name: /EXP-RETURN-001/ })).toBeVisible();
    await sidebarExpenses(page, lang).click();
    await expect(page.getByRole('link', { name: 'EXP-RETURN-001', exact: true })).toBeVisible();
  });
}
test('same-URL sidebar click closes an inline editor and preserves its saved draft', async ({ page }) => {
  await ready(page);
  await page.goto('/app/expenses');
  await page.getByRole('button', { name: 'مصروف جديد', exact: true }).click();
  await page.getByPlaceholder(/ضيافة ووجبات/).fill('Draft to resume');
  await expect(page.getByText('مسودة محفوظة تلقائياً', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/expenses$/);
  await sidebarExpenses(page).click();
  await expect(page.getByRole('heading', { name: 'قائمة المصروفات', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'إكمال المسودة', exact: true }).click();
  await expect(page.getByPlaceholder(/ضيافة ووجبات/)).toHaveValue('Draft to resume');
});
test('sidebar search also returns to the current section list', async ({ page }) => {
  await ready(page);
  await page.goto('/app/expenses/return-test');
  await expect(page.getByRole('heading', { name: /EXP-RETURN-001/ })).toBeVisible();
  await page.getByPlaceholder('اذهب إلى صفحة...').first().fill('المصروفات');
  // Search results live before nav, distinct from the navigation link's button.
  await page.getByRole('button', { name: 'المصروفات', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'قائمة المصروفات', exact: true })).toBeVisible();
});
test('mobile section link returns to the list and closes the drawer', async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/expenses/return-test');
  await expect(page.getByRole('heading', { name: /EXP-RETURN-001/ })).toBeVisible();
  await page.getByRole('button', { name: 'القائمة', exact: true }).click();
  await sidebarExpenses(page).click();
  await expect(page.getByRole('heading', { name: 'قائمة المصروفات', exact: true })).toBeVisible();
  await expect(sidebarExpenses(page)).not.toBeInViewport();
});
test('other sidebar sections also reset inline state: bank transfer returns to bank accounts', async ({ page }) => {
  await ready(page);
  await page.goto('/app/bank-accounts');
  await page.getByRole('button', { name: 'تحويل بين حساباتي', exact: true }).click();
  await expect(page.getByLabel('Amount sent', { exact: true })).toBeVisible();
  await page.locator('nav:visible').getByRole('link', { name: 'الحسابات البنكية', exact: true }).click();
  await expect(page.getByLabel('Amount sent', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تحويل بين حساباتي', exact: true })).toBeVisible();
});
