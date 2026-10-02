import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const invoice = { id: 'compact-invoice', invoiceNumber: 'SP-INV-2026032599', contactId: 'synthetic-contact', contact: { id: 'synthetic-contact', displayName: 'عميل الاختبار · Test customer' }, status: 'PAID', issueDate: '2026-09-01', dueDate: '2026-09-30', currency: 'SAR', total: 115, subtotal: 100, taxTotal: 15, amountPaid: 115, lines: [] };
async function invoiceFixture(page: Page, language: 'ar'|'en', country: 'SA'|'US') {
  await prepareVisualApp(page, language);
  await page.route('https://api.entix.io/orgs', r => r.fulfill({ json: [{ id: visualOrgId, name: 'Synthetic company', country, baseCurrency: country === 'SA' ? 'SAR' : 'USD' }] }));
  await page.route('https://api.entix.io/api/invoices*', r => r.fulfill({ json: { items: [invoice], total: 1 } }));
  await page.route('https://api.entix.io/api/invoices/compact-invoice', r => r.fulfill({ json: invoice }));
  await page.goto('/app/invoices');
  await expect(page.locator(':is(a, span):visible').filter({ hasText: invoice.invoiceNumber }).first()).toBeVisible();
}
for (const language of ['ar', 'en'] as const) for (const width of [390, 1280, 1920]) {
  test(`invoice status stays compact, regional and read-only ${language} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await invoiceFixture(page, language, 'SA');
    const writes: string[] = [];
    page.on('request', r => { if (r.url().startsWith('https://api.entix.io/') && !['GET','OPTIONS'].includes(r.method())) writes.push(r.url()); });
    const area = width < 768 ? page.locator('ul.md\\:hidden') : page.locator('.ledger-table');
    const status = area.locator('a[data-zatca-state="not_sent"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('href', '/app/invoices/compact-invoice');
    await expect(status).toHaveCSS('font-size', '10px');
    await expect(area.getByText(language === 'ar' ? 'صادرة · مدفوعة' : 'Issued · Paid', { exact: true })).toBeVisible();
    if (width >= 768) {
      const row = area.locator('tbody tr').first();
      await expect(row.locator('td').first().locator('[data-zatca-state]')).toHaveCount(0);
      await expect(row.locator('td').last().locator('[data-zatca-state]')).toBeVisible();
      expect((await row.boundingBox())!.height).toBeLessThanOrEqual(52);
    }
    await page.screenshot({ path: info.outputPath(`invoice-${language}-${width}.png`), fullPage: true });
    await status.click();
    await expect(page).toHaveURL(/\/app\/invoices\/compact-invoice$/);
    await expect(page.getByRole('heading', { name: language === 'ar' ? 'متابعة إرسال الفاتورة للهيئة' : 'ZATCA invoice delivery' })).toBeVisible();
    expect(writes).toEqual([]);
    await page.route('https://api.entix.io/orgs', r => r.fulfill({ json: [{ id: visualOrgId, name: 'US fixture', country: 'US', baseCurrency: 'USD' }] }));
    await page.goto('/app/invoices');
    await expect(page.locator(':is(a, span):visible').filter({ hasText: invoice.invoiceNumber }).first()).toBeVisible();
    await expect(page.locator('[data-zatca-state]:visible')).toHaveCount(0);
  });
}

const moneyColumns = [
  ['openingDebit', 'افتتاحي مدين␟Opening debit'], ['openingCredit', 'افتتاحي دائن␟Opening credit'],
  ['debit', 'حركة مدين␟Debit'], ['credit', 'حركة دائن␟Credit'],
  ['closingDebit', 'ختامي مدين␟Closing debit'], ['closingCredit', 'ختامي دائن␟Closing credit'],
];
for (const currency of ['SAR', 'USD']) for (const orientation of ['portrait', 'landscape']) {
  test(`report header currency shares the title line ${currency} ${orientation}`, async ({ page }, info) => {
    test.setTimeout(120000);
    await prepareVisualApp(page, 'ar');
    const org = { id: visualOrgId, name: 'شركة الاختبار', country: currency === 'SAR' ? 'SA' : 'US', paymentSettings: { reports: { bilingual: false, orientation, fontScale: 'compact' } } };
    const report = { id: 'trial-balance', title: 'ميزان المراجعة', englishTitle: 'Trial balance', status: 'live', generatedAt: '2026-10-01T12:00:00Z', period: { from: '2026-01-01', to: '2026-09-30' }, currency, org, summary: {}, sections: [{ id: 'balance', title: 'ميزان المراجعة', columns: [{ key: 'label', label: 'الحساب' }, { key: 'type', label: 'التصنيف' }, ...moneyColumns.map(([key,label]) => ({ key, label, kind: 'money' }))], rows: Array.from({ length: 100 }, (_, i) => ({ id: `row-${i}`, values: { label: `الحساب ${i+1}`, type: 'الأصول', ...Object.fromEntries(moneyColumns.map(([key]) => [key, i+1])) } })) }] };
    await page.route(`https://api.entix.io/orgs/${visualOrgId}`, r => r.fulfill({ json: org }));
    await page.route('https://api.entix.io/api/reports/trial-balance*', r => r.fulfill({ json: report }));
    await page.goto('/app/reports/trial-balance/print');
    const output = page.getByTestId('report-output-pages');
    // Allow the 100-row pagination pass to finish on loaded CI workers.
    // Geometry, overflow and repeated-header assertions below remain unchanged.
    await expect(output).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    expect(await output.locator('.report-output-sheet').count()).toBeGreaterThan(1);
    const metrics = await output.locator('.report-column-currency').evaluateAll(elements => elements.map(el => {
      const currency = el.getBoundingClientRect();
      const label = el.previousElementSibling!.getBoundingClientRect();
      const cell = el.closest('th')!;
      return { sameLine: Math.abs(currency.top - label.top) < 6, fits: cell.scrollWidth <= cell.clientWidth + 1, text: el.textContent };
    }));
    expect(metrics.length).toBeGreaterThan(6);
    expect(metrics.every(m => m.sameLine && m.fits && m.text?.includes(currency))).toBe(true);
    await page.screenshot({ path: info.outputPath(`report-${currency}-${orientation}.png`), fullPage: true });
    if (currency === 'SAR' && orientation === 'landscape') {
      const pending = page.waitForEvent('download');
      await page.getByTestId('report-download-pdf').click();
      await (await pending).saveAs(info.outputPath('compact-trial-balance.pdf'));
    }
  });
}
