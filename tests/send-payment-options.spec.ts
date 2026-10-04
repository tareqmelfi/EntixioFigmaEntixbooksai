import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const invoice = { id: 'pay-invoice', orgId: visualOrgId, contactId: 'contact-pay', invoiceNumber: 'SYNTHETIC-001', status: 'APPROVED', issueDate: '2026-10-01', dueDate: '2026-10-31', currency: 'USD', exchangeRate: '1', subtotal: '100', taxTotal: '0', discountTotal: '0', total: '100', amountPaid: '0', templateId: 'pay-template', paymentLinkUrl: null, contact: { id: 'contact-pay', displayName: 'Synthetic customer', email: 'synthetic@example.invalid' }, lines: [{ id: 'line-pay', description: 'Synthetic service', quantity: 1, unitPrice: 100, subtotal: 100 }] };
const templateUrl = 'https://payments.example.com/default';
async function setup(page: Page, lang: 'en' | 'ar' = 'en', options: { savedLink?: string; failDefault?: boolean; delayDefault?: () => Promise<void> } = {}) {
  await prepareVisualApp(page, lang);
  const sent: any[] = [];
  let creates = 0;
  await page.route('https://api.entix.io/api/invoices/pay-invoice', r => r.fulfill({ json: { ...invoice, language: lang, paymentLinkUrl: options.savedLink || null } }));
  await page.route('**/api/document-sends?**', r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/document-templates/resolve', async r => {
    if (options.delayDefault) await options.delayDefault();
    return r.fulfill(options.failDefault ? { status: 503, json: { error: 'unavailable' } } : { json: { templateId: 'pay-template', reason: 'explicit' } });
  });
  await page.route('**/api/document-templates/pay-template', r => r.fulfill({ json: { id: 'pay-template', paymentLinkUrl: templateUrl } }));
  await page.route('**/api/payment-links/invoice/pay-invoice', r => { creates++; return r.fulfill({ json: { url: 'https://payments.example.com/generated', provider: 'stripe', id: 'synthetic-session' } }); });
  await page.route('https://api.entix.io/api/document-sends', r => { sent.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: false, message: 'Synthetic delivery failure', send: { id: 'synthetic-failed', status: 'FAILED' } } }); });
  await page.goto('/app/invoices/pay-invoice');
  await page.getByTestId('issued-invoice-send').click();
  await expect(page.getByTestId('send-payment-options')).toBeVisible();
  await page.getByTestId('send-include-pdf').uncheck(); // These tests isolate payment text; PDF delivery has its own end-to-end tests.
  return { sent, get creates() { return creates; } };
}
for (const lang of ['en', 'ar'] as const) test(`payment choice is visible in actual message and survives failure · ${lang}`, async ({ page }, info) => {
  const calls = await setup(page, lang);
  await expect(page.getByTestId('send-payment-url')).toHaveValue(templateUrl);
  await expect(page.getByTestId('send-compose-body')).toHaveValue(new RegExp(templateUrl));
  expect(calls.creates).toBe(0); expect(calls.sent).toHaveLength(0);
  await page.getByTestId('send-payment-url').fill('javascript:alert(1)');
  await page.getByTestId('send-compose-submit').click();
  expect(calls.sent).toHaveLength(0);
  await page.getByTestId('send-payment-url').fill('https://payments.example.com/custom?invoice=1&currency=USD');
  await page.getByTestId('send-compose-submit').click();
  await expect(page.getByText('Synthetic delivery failure').first()).toBeVisible();
  expect(calls.sent[0].body).toContain('https://payments.example.com/custom?invoice=1&currency=USD');
  expect(calls.sent[0].body).not.toContain(templateUrl);
  await expect(page.getByTestId('send-payment-url')).toHaveValue('https://payments.example.com/custom?invoice=1&currency=USD');
  await page.getByTestId('send-payment-include').uncheck();
  await expect(page.getByTestId('send-compose-body')).not.toHaveValue(/https:\/\/payments/);
  await page.getByTestId('send-payment-default').click();
  await expect(page.getByTestId('send-compose-body')).toHaveValue(new RegExp(templateUrl));
  await page.getByTestId('send-payment-default').click();
  expect((await page.getByTestId('send-compose-body').inputValue()).split(templateUrl)).toHaveLength(2);
  await page.screenshot({ path: info.outputPath('payment-composer.png'), fullPage: true });
});
test('invoice link takes precedence; gateway link is prepared only on explicit click', async ({ page }) => {
  const calls = await setup(page, 'en', { savedLink: 'https://payments.example.com/invoice' });
  await expect(page.getByTestId('send-payment-url')).toHaveValue('https://payments.example.com/invoice');
  expect(calls.creates).toBe(0);
  await page.getByTestId('send-payment-online').click();
  await expect(page.getByTestId('send-payment-url')).toHaveValue('https://payments.example.com/generated');
  expect(calls.creates).toBe(1); expect(calls.sent).toHaveLength(0);
});
test('late default cannot replace user-entered URL', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>(r => { release = r; });
  await setup(page, 'en', { delayDefault: () => wait });
  await page.getByTestId('send-payment-include').check();
  await page.getByTestId('send-payment-url').fill('https://payments.example.com/mine');
  release();
  await expect(page.getByTestId('send-payment-default')).toBeVisible();
  await expect(page.getByTestId('send-payment-url')).toHaveValue('https://payments.example.com/mine');
});
test('failed default fetch leaves manual link and no-link message available', async ({ page }) => {
  const calls = await setup(page, 'en', { failDefault: true });
  await expect(page.getByRole('alert')).toContainText('Could not load');
  await page.getByTestId('send-payment-include').check();
  await page.getByTestId('send-payment-url').fill('https://payments.example.com/manual');
  await page.getByTestId('send-compose-draft').click();
  expect(calls.sent[0].action).toBe('draft');
  expect(calls.sent[0].body).toContain('https://payments.example.com/manual');
});

test('template designer saves and reloads the optional default URL', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  let saved: any = { id: 'pay-template', name: 'Synthetic payment template', type: 'INVOICE', kind: 'INVOICE', coverStyle: 'NONE', paymentLinkUrl: null };
  await page.route('**/api/document-templates/pay-template', r => {
    if (r.request().method() === 'PATCH') saved = { ...saved, ...r.request().postDataJSON() };
    return r.fulfill({ json: saved });
  });
  await page.goto('/app/templates/pay-template');
  await page.getByTestId('template-payment-link').fill(templateUrl);
  await page.getByTestId('template-save').click();
  await expect.poll(() => saved.paymentLinkUrl).toBe(templateUrl);
  await expect(page).toHaveURL(/\/app\/templates$/);
  await page.goto('/app/templates/pay-template');
  await expect(page.getByTestId('template-payment-link')).toHaveValue(templateUrl);
  await page.getByTestId('template-payment-link').fill('');
  await page.getByTestId('template-save').click();
  await expect.poll(() => saved.paymentLinkUrl).toBe(null);
});
