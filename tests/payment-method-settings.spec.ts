import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

async function setup(page: Page, language: 'en' | 'ar' = 'en', role = 'OWNER') {
  await prepareVisualApp(page, language);
  const org = { id: visualOrgId, name: 'Synthetic US company', country: 'US', baseCurrency: 'USD', role, zatcaEnabled: false };
  const accounts = [
    { id: 'parent', code: '10', name: 'Assets group', type: 'ASSET', isActive: true, allowPosting: true },
    { id: 'cash-gl', code: '1030', name: 'Cash ledger', nameAr: 'حساب الصندوق', type: 'ASSET', parentId: 'parent', isActive: true, allowPosting: true },
    { id: 'gateway-gl', code: '1041', name: 'Gateway ledger', nameAr: 'حساب البوابة', type: 'ASSET', isActive: true, allowPosting: true },
  ];
  const banks: any[] = [{ id: 'bank', name: 'Wise USD', currency: 'USD', kind: 'bank', isActive: true, accountId: null }, { id: 'cash', name: 'Petty cash', currency: 'USD', kind: 'cash_box', isActive: true, accountId: 'cash-gl' }];
  const methods: any[] = [];
  const bankWrites: any[] = [], methodWrites: any[] = [], voucherWrites: any[] = [];
  let rejectMethod = false, rejectVoucher = false;
  await page.route('**/orgs', r => r.fulfill({ json: [org] }));
  await page.route(`**/orgs/${visualOrgId}`, r => r.fulfill({ json: org }));
  await page.route('**/api/accounts', r => r.fulfill({ json: { items: accounts } }));
  await page.route('**/api/bank-accounts*', r => {
    if (r.request().method() === 'POST') { const body = r.request().postDataJSON(); bankWrites.push(body); const row = { ...body, id: 'new-gateway', isActive: true }; banks.push(row); return r.fulfill({ json: row }); }
    return r.fulfill({ json: { items: banks } });
  });
  await page.route('**/api/bank-accounts/bank', r => { const body = r.request().postDataJSON(); bankWrites.push(body); Object.assign(banks[0], body); return r.fulfill({ json: banks[0] }); });
  await page.route('**/api/payment-methods**', r => {
    expect(r.request().headers()['x-org-id']).toBe(visualOrgId);
    if (r.request().method() === 'GET') return r.fulfill({ json: { items: r.request().url().endsWith('/suggestions') ? [{ code: 'STRIPE', nameAr: 'سترايب', nameEn: 'Stripe', kind: 'gateway', appliesTo: ['receipt', 'payment'] }] : methods.map(m => ({ ...m, settlementAccount: banks.find(b => b.id === m.settlementAccountId) })) } });
    const body = r.request().postDataJSON(); methodWrites.push(body);
    if (rejectMethod) return r.fulfill({ status: 409, json: { error: 'payment_method_stale', message: 'Modified elsewhere. Refresh and retry.' } });
    const row = { ...body, id: 'custom-method', orgId: visualOrgId, updatedAt: '2026-10-05T00:00:00.000Z' }; methods.push(row); return r.fulfill({ json: row });
  });
  const invoice = { id: 'selected', orgId: visualOrgId, contactId: 'buyer', invoiceNumber: 'TEST-1', status: 'APPROVED', issueDate: '2026-08-02', dueDate: '2026-08-02', total: 163, amountPaid: 0, currency: 'USD', lines: [] };
  await page.route('**/api/invoices/selected', r => r.fulfill({ json: invoice }));
  await page.route('**/api/contacts*', r => r.fulfill({ json: { items: [{ id: 'buyer', displayName: 'Synthetic buyer' }] } }));
  await page.route('**/api/vouchers?*', r => r.fulfill({ json: { items: [], summary: { sumAmount: '0', avgAmount: '0' } } }));
  await page.route('**/api/vouchers', r => { const body = r.request().postDataJSON(); voucherWrites.push(body); return rejectVoucher ? r.fulfill({ status: 422, json: { error: 'fiscal_period_closed' } }) : r.fulfill({ json: { ...body, id: 'voucher', number: 'TEST-RECEIPT' } }); });
  return { banks, methods, bankWrites, methodWrites, voucherWrites, failMethod: () => { rejectMethod = true; }, failVoucher: () => { rejectVoucher = true; } };
}

test('US settlement setup maps an existing bank and creates a gateway without ABA; methods save only explicit mapping', async ({ page }, info) => {
  const f = await setup(page); await page.goto('/app/settings?tab=payments');
  await page.getByRole('button', { name: 'Map account · Wise USD' }).click();
  await page.getByRole('button', { name: 'Select a posting account' }).click();
  await expect(page.getByRole('button', { name: /Assets group/ })).toHaveCount(0);
  await page.getByRole('button', { name: '1030 · Cash ledger', exact: true }).click();
  await page.getByRole('button', { name: 'Save account', exact: true }).click();
  await expect.poll(() => f.bankWrites).toEqual([{ accountId: 'cash-gl' }]);
  await page.getByRole('button', { name: 'Add settlement account', exact: true }).click();
  const setupForm = page.getByRole('form', { name: 'Settlement account setup' });
  await setupForm.getByLabel('Account name', { exact: true }).fill('Stripe USD');
  await setupForm.getByLabel('Type', { exact: true }).selectOption('gateway');
  await expect(setupForm.getByText('ABA routing', { exact: true })).toHaveCount(0);
  await setupForm.getByRole('button', { name: 'Select a posting account' }).click();
  await page.getByRole('button', { name: '1041 · Gateway ledger', exact: true }).click();
  await setupForm.getByRole('button', { name: 'Save account', exact: true }).click();
  await expect.poll(() => f.bankWrites.length).toBe(2);
  expect(f.bankWrites[1]).toMatchObject({ kind: 'gateway', name: 'Stripe USD', accountId: 'gateway-gl', currency: 'USD' });
  expect(f.bankWrites[1]).not.toHaveProperty('routingNumber');
  await page.getByRole('button', { name: 'Stripe', exact: true }).click();
  const form = page.getByRole('form', { name: 'Payment method setup' });
  await expect(form.getByRole('button', { name: 'Save method', exact: true })).toBeDisabled();
  await form.getByRole('button', { name: 'Select settlement account', exact: true }).click();
  await page.getByRole('button', { name: 'Stripe USD · USD', exact: true }).click();
  await form.getByRole('button', { name: 'Save method', exact: true }).click();
  await expect(page.getByText('Payment method saved.', { exact: true })).toBeVisible();
  expect(f.methodWrites[0]).toMatchObject({ code: 'STRIPE', settlementAccountId: 'new-gateway', nameAr: 'سترايب', nameEn: 'Stripe' });
  await page.screenshot({ path: info.outputPath('payment-settings.png'), fullPage: true });
});

test('catalogue edit preserves input on conflict and carries version; viewers cannot mutate settings', async ({ page }) => {
  const f = await setup(page); f.methods.push({ id: 'method-1', code: 'CASH', nameAr: 'صندوق المكتب', nameEn: 'Office cash', kind: 'cash', settlementAccountId: 'cash', appliesTo: ['receipt'], isActive: true, updatedAt: '2026-10-04T00:00:00.000Z' });
  f.failMethod(); await page.goto('/app/settings?tab=payments');
  await page.getByRole('button', { name: 'Edit Office cash', exact: true }).click();
  await page.getByLabel('English name', { exact: true }).fill('Edited cash');
  await page.getByRole('button', { name: 'Save method', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This method changed elsewhere' })).toBeVisible();
  await expect(page.getByLabel('English name', { exact: true })).toHaveValue('Edited cash');
  expect(f.methodWrites[0].expectedUpdatedAt).toBe('2026-10-04T00:00:00.000Z');
});

test('viewer sees methods with no controls to create or edit', async ({ page }) => {
  await setup(page, 'en', 'VIEWER'); await page.goto('/app/settings?tab=payments');
  await expect(page.getByText('No custom payment methods yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add payment method', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add settlement account', exact: true })).toHaveCount(0);
});

for (const language of ['ar', 'en'] as const) test(`receipt uses named cash box and keeps date, selection and retry key on failure (${language})`, async ({ page }) => {
  const f = await setup(page, language); f.methods.push({ id: 'cash-method', code: 'CASH_DESK', nameAr: 'صندوق المكتب', nameEn: 'Office cash', kind: 'cash', settlementAccountId: 'cash', appliesTo: ['receipt'], isActive: true }); f.failVoucher();
  await page.goto('/app/receipts?new=1&invoiceId=selected');
  const section = page.locator('[aria-label="' + (language === 'ar' ? 'طريقة الدفع وحسابها' : 'Payment method and account') + '"]');
  await section.getByRole('button').first().click();
  await expect(page.getByRole('button', { name: /STC Pay|Mada/ })).toHaveCount(0);
  await page.getByRole('button', { name: language === 'ar' ? 'صندوق المكتب' : 'Office cash', exact: false }).click();
  const save = page.getByRole('button', { name: language === 'ar' ? 'حفظ' : 'Save', exact: true }); await save.click();
  await expect.poll(() => f.voucherWrites.length).toBe(1);
  expect(f.voucherWrites[0]).toMatchObject({ paymentMethodConfigId: 'cash-method', bankAccountId: 'cash', paymentMethod: 'CASH', amount: 163, date: '2026-08-02' });
  await expect(section).toContainText(language === 'ar' ? 'صندوق المكتب' : 'Office cash');
  await expect(save).toBeEnabled(); await save.click();
  await expect.poll(() => f.voucherWrites.length).toBe(2);
  expect(f.voucherWrites[0].idempotencyKey).toBe(f.voucherWrites[1].idempotencyKey);
});

test('standalone payment retains cash box and idempotency key after a failed save', async ({ page }) => {
  const f = await setup(page); f.methods.push({ id: 'cash-method', code: 'CASH_DESK', nameAr: 'صندوق المكتب', nameEn: 'Office cash', kind: 'cash', settlementAccountId: 'cash', appliesTo: ['payment'], isActive: true }); f.failVoucher();
  await page.goto('/app/payments?new=1&contactId=buyer');
  await page.locator('input[type="number"]').first().fill('20');
  const section = page.locator('[aria-label="Payment method and account"]');
  await section.getByRole('button').first().click();
  await page.getByRole('button', { name: 'Office cash', exact: false }).click();
  const save = page.getByRole('button', { name: 'Save', exact: true }); await save.click();
  await expect.poll(() => f.voucherWrites.length).toBe(1);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(f.voucherWrites[0]).toMatchObject({ type: 'PAYMENT', bankAccountId: 'cash', paymentMethodConfigId: 'cash-method', amount: 20 });
  await expect(save).toBeEnabled(); await save.click();
  await expect.poll(() => f.voucherWrites.length).toBe(2);
  expect(f.voucherWrites[0].idempotencyKey).toBeTruthy();
  expect(f.voucherWrites[1].idempotencyKey).toBe(f.voucherWrites[0].idempotencyKey);
});

for (const language of ['en', 'ar'] as const) test(`printed voucher preserves its saved custom method name (${language})`, async ({ page }) => {
  await setup(page, language);
  await page.route('**/api/vouchers/named-receipt', r => r.fulfill({ json: { id: 'named-receipt', orgId: visualOrgId, number: 'TEST-NAMED-RECEIPT', type: 'RECEIPT', currency: 'USD', date: '2026-08-02', amount: 163, paymentMethod: 'OTHER', paymentMethodSnapshot: { nameEn: 'Stripe USD settlement', nameAr: 'تسوية سترايب دولار' } } }));
  await page.goto(`/print/voucher/named-receipt?lang=${language}`);
  await expect(page.getByText(language === 'ar' ? 'تسوية سترايب دولار' : 'Stripe USD settlement', { exact: true })).toBeVisible();
});
