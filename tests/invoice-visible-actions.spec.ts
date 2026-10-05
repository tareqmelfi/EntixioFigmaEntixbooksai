import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page: Page, lang: 'ar' | 'en' = 'en') {
  await prepareVisualApp(page, lang);
  const invoices = ['DRAFT', 'APPROVED', 'PAID', 'SIGNED'].map((status, i) => ({
    id: status, invoiceNumber: `TEST-${status}`, orgId: 'org-visual-system', contactId: 'buyer',
    status: status === 'SIGNED' ? 'APPROVED' : status, currency: 'USD', total: '100', subtotal: '100', taxTotal: '0',
    issueDate: '2016-08-02', dueDate: '2016-08-02', updatedAt: '2026-10-04T00:00:00.000Z',
    amountPaid: status === 'PAID' ? '100' : '0', contact: { id: 'buyer', displayName: `Customer ${i}` },
    lines: [{ id: `line-${i}`, description: 'Original service', quantity: 1, unitPrice: 100, subtotal: 100 }],
  }));
  const writes: string[] = [];
  let failVoid = true;
  const changed = new Set<string>();
  await page.route('**/api/invoices?*', route => route.fulfill({ json: { items: invoices, total: invoices.length } }));
  await page.route('**/api/invoices/*', route => {
    const id = route.request().url().split('/').at(-1)!;
    if (route.request().method() === 'DELETE') { writes.push(id); return route.fulfill({ status: 204 }); }
    const invoice = invoices.find(item => item.id === id);
    return invoice ? route.fulfill({ json: { ...invoice, ...(changed.has(id) ? { updatedAt: '2026-10-04T01:00:00.000Z' } : {}) } }) : route.fallback();
  });
  await page.route('**/api/invoices/*/amendment-policy', route => {
    const id = route.request().url().split('/').at(-2)!;
    return route.fulfill({ json: { canEditDraft: id === 'DRAFT', canAmend: ['APPROVED', 'PAID'].includes(id), canVoidAdmin: id === 'APPROVED',
      country: id === 'SIGNED' ? 'SA' : 'US', reason: id === 'SIGNED' ? 'zatca_record' : null,
      voidReason: id === 'PAID' ? 'receipts_exist' : id === 'SIGNED' ? 'zatca_record' : null } });
  });
  await page.route('**/api/invoices/*/deletion-policy', route => route.fulfill({ json: { canDeletePermanently: false, reason: 'role_required' } }));
  await page.route('**/api/invoices/*/void-admin', route => {
    const id = route.request().url().split('/').at(-2)!; writes.push(id);
    expect(route.request().postDataJSON()).toEqual({ reason: 'Duplicate synthetic invoice', expectedUpdatedAt: '2026-10-04T00:00:00.000Z' });
    if (failVoid) { failVoid = false; return route.fulfill({ status: 503, json: { error: 'temporary_failure' } }); }
    return route.fulfill({ json: { ...invoices[1], status: 'CANCELLED' } });
  });
  return { writes, changed };
}

for (const width of [390, 1400, 1920]) for (const lang of ['ar', 'en'] as const) {
  test(`selection and full editor are directly visible at ${width}px (${lang})`, async ({ page }) => {
    await setup(page, lang); await page.setViewportSize({ width, height: 1000 }); await page.goto('/app/invoices');
    const checkbox = page.getByRole('checkbox', { name: `${lang === 'ar' ? 'تحديد' : 'Select'} TEST-APPROVED`, exact: true });
    await expect(checkbox).toBeVisible(); await checkbox.check();
    await expect(page.getByRole('button', { name: /Edit selected in table|تعديل المحدد في جدول/ })).toBeEnabled();
    const row = width < 768 ? page.getByRole('listitem').filter({ hasText: 'TEST-APPROVED' }) : page.getByRole('row').filter({ hasText: 'TEST-APPROVED' });
    const edit = row.getByRole('button', { name: lang === 'ar' ? 'تعديل' : 'Edit', exact: true });
    await expect(edit).toBeInViewport();
    await expect(row.getByRole('button', { name: lang === 'ar' ? 'حذف / إلغاء' : 'Delete / void', exact: true })).toBeInViewport();
    await page.screenshot({ path: `/tmp/entix-visible-actions-${width}-${lang}.png`, fullPage: true });
    await edit.click();
    await expect(page.getByLabel(lang === 'ar' ? 'سعر الوحدة 1' : 'Unit price 1', { exact: true })).toHaveValue('100');
    await expect(page.getByRole('button', { name: lang === 'ar' ? 'حفظ التعديل' : 'Save amendment', exact: true })).toBeVisible();
  });
}

test('bulk removal reviews blockers, retains failed input, and retries only failed rows', async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto('/app/invoices'); await page.getByRole('checkbox', { name: 'Select visible', exact: true }).check();
  await page.getByRole('button', { name: 'Delete / void selected', exact: true }).click();
  await page.getByRole('radio', { name: 'Void and retain invoice', exact: true }).check();
  await expect(page.getByTestId('removal-PAID')).toContainText('Linked payments or settlements');
  await expect(page.getByTestId('removal-SIGNED')).toContainText('protected e-invoicing record');
  await expect(page.getByRole('button', { name: 'Void selected (2)', exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
  await page.getByLabel('Reason for deletion or voiding').fill('Duplicate synthetic invoice');
  await page.getByRole('button', { name: 'Void selected (2)', exact: true }).click();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.getByTestId('removal-DRAFT')).toContainText('Completed');
  await expect(page.getByTestId('removal-APPROVED').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Reason for deletion or voiding')).toHaveValue('Duplicate synthetic invoice');
  await page.getByRole('button', { name: 'Void selected (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.getByTestId('removal-APPROVED')).toContainText('Completed');
  expect(writes).toEqual(['DRAFT', 'APPROVED', 'APPROVED']);
  await expect(page.getByRole('button', { name: 'Void selected (0)', exact: true })).toBeDisabled();
});

test('filtering removes hidden selection and changed draft cannot be deleted', async ({ page }) => {
  const { writes, changed } = await setup(page);
  await page.goto('/app/invoices'); await page.getByRole('checkbox', { name: 'Select visible', exact: true }).check();
  await page.getByPlaceholder('Search by number or customer...').fill('TEST-DRAFT');
  await expect(page.getByRole('button', { name: 'Edit selected in table (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete / void selected', exact: true }).click();
  await page.getByRole('radio', { name: 'Void and retain invoice', exact: true }).check();
  await expect(page.getByTestId('removal-DRAFT')).toContainText('Delete draft');
  changed.add('DRAFT');
  await page.getByRole('button', { name: 'Void selected (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invoice or action access changed');
  expect(writes).toEqual([]);
});

test('failed permission check allows retry but no mutation', async ({ page }) => {
  const { writes } = await setup(page);
  await page.route('**/api/invoices/DRAFT/amendment-policy', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/app/invoices'); await page.getByRole('row').filter({ hasText: 'TEST-DRAFT' }).getByTestId('invoice-row-remove').click();
  await page.getByRole('radio', { name: 'Void and retain invoice', exact: true }).check();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Void selected (0)', exact: true })).toBeDisabled();
  await page.unroute('**/api/invoices/DRAFT/amendment-policy');
  await page.getByRole('button', { name: 'Recheck', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Void selected (1)', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
});


test('review links return to the selected invoice and double confirmation cannot duplicate deletion', async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto('/app/invoices');
  await page.getByRole('row').filter({ hasText: 'TEST-PAID' }).getByTestId('invoice-row-remove').click();
  await page.getByRole('radio', { name: 'Void and retain invoice', exact: true }).check();
  await page.getByRole('link', { name: 'Open invoice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Invoice TEST-PAID', exact: true })).toBeVisible();
  await page.goto('/app/invoices');
  await page.getByRole('row').filter({ hasText: 'TEST-DRAFT' }).getByTestId('invoice-row-remove').click();
  await page.getByRole('radio', { name: 'Void and retain invoice', exact: true }).check();
  await page.getByRole('button', { name: 'Void selected (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Yes', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByTestId('removal-DRAFT')).toContainText('Completed');
  expect(writes).toEqual(['DRAFT']);
});
