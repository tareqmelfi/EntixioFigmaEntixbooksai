import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const ids = ['income-statement', 'balance-sheet', 'cash-flow', 'trial-balance'];
async function setup(page: import('@playwright/test').Page, language: 'ar' | 'en') {
  await prepareVisualApp(page, language);
  await page.route('https://api.entix.io/api/reports/**', route => {
    expect(route.request().headers()['x-org-id']).toBe(visualOrgId);
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return route.fulfill({ json: {
      id, title: `التقرير ${id}`, englishTitle: `Report ${id}`, category: 'financial', status: 'live',
      generatedAt: '2026-09-27T17:00:00Z', period: { from: '2026-01-01', to: '2026-09-27' }, currency: 'USD', summary: {},
      org: { id: visualOrgId, name: 'شركة الاختبار', legalName: 'Report Test LLC', country: 'US', baseCurrency: 'USD' },
      notices: ['Synthetic test data'],
      sections: [{ id: `${id}-detail`, title: 'كامل التفاصيل␟Complete detail',
        columns: [{ key: 'label', label: 'الحساب␟Account' }, { key: 'amount', label: 'الرصيد␟Balance', kind: 'money', align: 'end' }],
        rows: Array.from({ length: 55 }, (_, i) => ({ id: `${id}-${i}`, label: `Account ${i}`, values: { label: `حساب ${i} لمشروع التصميم المعماري الداخلي␟Account ${i} interior design project`, amount: -1234.56 - i } })),
      }],
    } });
  });
  await page.goto('/app/reports/management-pdf');
}

for (const language of ['ar', 'en'] as const) {
  test(`management book preserves all chapters, page index and PDF (${language})`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await setup(page, language);
    await page.getByLabel(language === 'ar' ? 'إعداد' : 'Prepared by', { exact: true }).fill('Test Analyst');
    await page.locator('textarea').fill('Commentary by the author.\nملاحظات معد التقرير للاختبار فقط.');
    await page.getByRole('button', { name: language === 'ar' ? 'تجهيز الملف والمعاينة' : 'Prepare report book', exact: true }).click();
    const output = page.getByTestId('report-book-pages');
    await expect(output).toHaveAttribute('data-ready', 'true');
    const sheets = output.locator('.report-output-sheet');
    expect(await sheets.count()).toBeGreaterThan(6);
    await expect(sheets.first()).toContainText('Test Analyst');
    const tableRows = output.locator('tbody tr');
    await expect(tableRows).toHaveCount(4 * 55 + 4 + 1 + 2);
    const toc = await sheets.nth(1).locator('tbody').first().locator('tr').evaluateAll(rows => rows.map(row => Number(row.lastElementChild!.textContent)));
    expect(await sheets.nth(1).locator('thead').first().evaluate(head => head.getBoundingClientRect().height)).toBeLessThan(45);
    for (const [index, pageNumber] of toc.entries()) await expect(sheets.nth(pageNumber - 1).locator('h1')).toContainText(ids[index]);
    const layout = await sheets.locator('.report-page-body').evaluateAll(bodies => bodies.map(body => ({ fits: body.scrollHeight <= body.clientHeight + 1, overflow: Array.from(body.querySelectorAll('td')).some(cell => cell.scrollWidth > cell.clientWidth + 1) })));
    for (const item of layout) { expect(item.fits).toBe(true); expect(item.overflow).toBe(false); }
    await sheets.first().screenshot({ path: testInfo.outputPath('cover.png') });
    await sheets.nth(2).screenshot({ path: testInfo.outputPath('chapter.png') });
    await sheets.nth(1).screenshot({ path: testInfo.outputPath('contents.png') });
    const download = page.waitForEvent('download');
    await page.getByTestId('book-download').click();
    const filename = testInfo.outputPath('book.pdf');
    await (await download).saveAs(filename);
    const bytes = await readFile(filename);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(await sheets.count());
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.locator('textarea').fill('Changed commentary');
    await expect(output).toHaveCount(0);
  });
}

test('management book fails closed for wrong company or a failed chapter', async ({ page }) => {
  await setup(page, 'en');
  await page.route('https://api.entix.io/api/reports/balance-sheet*', route => route.fulfill({ status: 500, json: { error: 'test failure' } }));
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No partial file');
  await expect(page.getByTestId('book-download')).toHaveCount(0);
  await page.route('https://api.entix.io/api/reports/balance-sheet*', route => route.fulfill({ json: { id: 'balance-sheet', org: { id: 'other-company' } } }));
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No partial file');
  await expect(page.getByTestId('book-download')).toHaveCount(0);
});

test('unavailable reports are identified explicitly without invented balances', async ({ page }) => {
  await setup(page, 'en');
  await page.route('https://api.entix.io/api/reports/cash-flow*', route => route.fulfill({ json: {
    id: 'cash-flow', title: 'التدفقات النقدية', englishTitle: 'Cash flow', category: 'financial', status: 'unavailable',
    generatedAt: '2026-09-27T17:00:00Z', period: { from: '2026-01-01', to: '2026-09-27' }, currency: 'USD', summary: {},
    org: { id: visualOrgId, name: 'Report Test LLC', country: 'US' }, sections: [], notices: ['Source not available'],
  } }));
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  const output = page.getByTestId('report-book-pages');
  await expect(output).toHaveAttribute('data-ready', 'true');
  await expect(output).toContainText('Data unavailable');
  await expect(output).toContainText('Source not available');
  await expect(output).not.toContainText('0.00 USD');
});

test('long commentary and wide project tables remain complete on landscape pages', async ({ page }) => {
  await setup(page, 'en');
  await page.route('https://api.entix.io/api/reports/project-profitability*', route => route.fulfill({ json: {
    id: 'project-profitability', title: 'ربحية المشاريع', englishTitle: 'Project profitability', category: 'projects', status: 'live',
    generatedAt: '2026-09-27T17:00:00Z', period: { from: '2026-01-01', to: '2026-09-27' }, currency: 'USD', summary: {},
    org: { id: visualOrgId, name: 'Report Test LLC', country: 'US', paymentSettings: { reports: { paper: 'Letter' } } },
    sections: [{ id: 'projects', title: 'Projects', columns: [{ key: 'label', label: 'Project' }, ...Array.from({ length: 12 }, (_, i) => ({ key: `m${i}`, label: `Metric ${i}`, kind: 'money' }))],
      rows: [{ id: 'one', label: 'Project one', values: { label: 'Project one', ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i}`, 1000 + i])) } }],
    }],
  } }));
  for (const label of ['Income statement', 'Balance sheet', 'Cash flow', 'Trial balance']) await page.getByLabel(label, { exact: true }).uncheck();
  await page.getByLabel('Project profitability', { exact: true }).check();
  await page.locator('textarea').fill('A long author explanation of the results. '.repeat(120) + 'FINAL COMMENT');
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  const output = page.getByTestId('report-book-pages');
  await expect(output).toHaveAttribute('data-ready', 'true');
  await expect(output).toContainText('FINAL COMMENT');
  for (let i = 0; i < 12; i++) await expect(output).toContainText((1000 + i).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  const sheets = output.locator('.report-output-sheet');
  const dimensions = await sheets.first().boundingBox();
  expect(dimensions!.width).toBeGreaterThan(dimensions!.height);
  const fits = await output.locator('.report-page-body').evaluateAll(bodies => bodies.every(body => body.scrollHeight <= body.clientHeight + 1));
  expect(fits).toBe(true);
  const chapterPage = Number(await sheets.nth(1).locator('tbody').first().locator('tr').first().locator('td').last().textContent());
  await expect(sheets.nth(chapterPage - 1).locator('h1')).toContainText('Project profitability');
});

test('financial snapshot uses recorded income rows and export rejects a changed company', async ({ page }) => {
  await setup(page, 'en');
  await page.route('https://api.entix.io/api/reports/income-statement*', route => route.fulfill({ json: {
    id: 'income-statement', title: 'قائمة الدخل', englishTitle: 'Income statement', category: 'financial', status: 'live',
    generatedAt: '2026-09-27T17:00:00Z', period: { from: '2026-01-01', to: '2026-09-27' }, currency: 'USD', summary: {},
    org: { id: visualOrgId, name: 'Report Test LLC', country: 'US' },
    sections: [{ id: 'income-summary', title: 'Income summary', columns: [{ key: 'label', label: 'Metric' }, { key: 'amount', label: 'Amount', kind: 'money' }],
      rows: [['revenue', 'Revenue', 500], ['expenses', 'Expenses', 700], ['net-income', 'Net loss', -200]].map(([id, label, amount]) => ({ id, label, values: { label, amount } })),
    }],
  } }));
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  const output = page.getByTestId('report-book-pages');
  await expect(output).toHaveAttribute('data-ready', 'true');
  const intro = output.locator('.report-output-sheet').nth(1);
  await expect(intro).toContainText('Financial snapshot');
  await expect(intro).toContainText('-200.00 USD');
  await expect(intro).toContainText('Source: income statement');
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem('entix_tab_org_v1')!);
    sessionStorage.setItem('entix_tab_org_v1', JSON.stringify({ ...saved, orgId: 'another-company' }));
  });
  await page.getByTestId('book-download').click();
  await expect(page.getByRole('alert')).toContainText('Company changed');
});
