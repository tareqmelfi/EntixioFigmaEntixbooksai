import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const ids = ['income-statement', 'balance-sheet', 'cash-flow', 'trial-balance'];
const darkLogo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text y="30" font-size="30" fill="white">TEST</text></svg>');
const paperLogo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text y="30" font-size="30" fill="navy">TEST</text></svg>');
async function setup(page: import('@playwright/test').Page, language: 'ar' | 'en', reverseLogo: string | null = darkLogo) {
  await prepareVisualApp(page, language);
  await page.route('https://api.entix.io/api/reports/**', route => {
    expect(route.request().headers()['x-org-id']).toBe(visualOrgId);
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return route.fulfill({ json: {
      id, title: `التقرير ${id}`, englishTitle: `Report ${id}`, category: 'financial', status: 'live',
      generatedAt: '2026-09-27T17:00:00Z', period: { from: '2026-01-01', to: '2026-09-27' }, currency: 'USD', summary: {},
      org: { id: visualOrgId, name: 'شركة الاختبار', legalName: 'Report Test LLC', country: 'US', baseCurrency: 'USD', printLogoUrl: paperLogo, printLogoLightUrl: reverseLogo, addressLine: '123 Example Street', email: 'reports@example.invalid', vatNumber: '12-3456789', socialLinks: [{ platform: 'instagram', url: 'https://example.com/social' }] },
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
    // Four full Arabic chapters require font readiness plus physical row measurement.
    // The pre-existing implementation exceeds 10s on slower CPUs; keep the bounded
    // preparation budget separate from normal UI assertions and verify every row below.
    await expect(output).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    const sheets = output.locator('.report-output-sheet');
    expect(await sheets.count()).toBeGreaterThan(6);
    await expect(sheets.first()).toContainText('Test Analyst');
    const cover = sheets.first();
    await expect(cover.locator('header img')).toHaveAttribute('src', darkLogo);
    await expect(cover.locator('.report-book-company')).toContainText('Report Test LLC');
    await expect(cover.locator('.report-book-company')).toContainText('123 Example Street');
    await expect(cover.locator('.report-book-company')).toContainText('reports@example.invalid');
    const logoBox = await cover.locator('header img').boundingBox();
    const companyBox = await cover.locator('.report-book-company').boundingBox();
    expect(logoBox!.x + logoBox!.width).toBeLessThan(companyBox!.x);
    await expect(cover.locator('header img')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(cover.locator('header img')).toHaveCSS('padding', '0px');
    await expect(cover).toHaveCSS('background-color', 'rgb(16, 45, 80)');
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
    expect((bytes.toString('latin1').match(/\/URI \(https:\/\/example.com\/social\)/g) || []).length).toBe(1);
    await expect(sheets.last().locator('.document-social-footer')).toBeVisible();
    await expect(sheets.first().locator('.document-social-footer')).toBeHidden();
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(await sheets.count());
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.locator('textarea').fill('Changed commentary');
    await expect(output).toHaveCount(0);
  });
}

test('a company without reverse artwork uses a light cover without a logo badge', async ({ page }) => {
  await setup(page, 'en', null);
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  const output = page.getByTestId('report-book-pages');
  await expect(output).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  const cover = output.locator('.report-book-cover');
  await expect(cover).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(cover.locator('header img')).toHaveAttribute('src', paperLogo);
  await expect(cover.locator('header img')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(cover.locator('.report-book-period')).toHaveCSS('color', 'rgb(0, 103, 121)');
});

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
  await page.getByLabel('Report title', { exact: true }).fill('Management financial review and project delivery performance for directors and shareholders across all operating divisions');
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
  await expect(intro).toContainText('(200.00)');
  await expect(intro).toContainText('(USD)');
  await expect(intro).toContainText('Source: income statement');
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem('entix_tab_org_v1')!);
    sessionStorage.setItem('entix_tab_org_v1', JSON.stringify({ ...saved, orgId: 'another-company' }));
  });
  await page.getByTestId('book-download').click();
  await expect(page.getByRole('alert')).toContainText('Company changed');
});


test('unrelated interface images do not block report book preparation', async ({ page }) => {
  await setup(page, 'en');
  await page.route('https://api.entix.io/api/reports/income-statement*', route => route.fulfill({ json: {
    id: 'income-statement', title: 'قائمة الدخل', englishTitle: 'Income statement', category: 'financial', status: 'live',
    generatedAt: '2026-09-28T00:00:00Z', period: { to: '2026-09-28' }, currency: 'USD', summary: {},
    org: { id: visualOrgId, name: 'Readiness Test LLC', country: 'US' }, sections: [], notices: [],
  } }));
  for (const label of ['Balance sheet', 'Cash flow', 'Trial balance']) await page.getByLabel(label, { exact: true }).uncheck();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.route('**/unrelated-avatar.png', () => { /* keep a non-report image pending */ });
  const requested = page.waitForRequest('**/unrelated-avatar.png');
  await page.evaluate(() => {
    const avatar = document.createElement('img');
    avatar.id = 'unrelated-avatar';
    avatar.src = '/unrelated-avatar.png';
    document.body.append(avatar);
  });
  await requested;
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  await expect(page.getByTestId('report-book-pages')).toHaveAttribute('data-ready', 'true', { timeout: 4000 });
  expect(await page.locator('#unrelated-avatar').evaluate((img: HTMLImageElement) => img.complete)).toBe(false);
  await expect(page.getByTestId('book-download')).toBeEnabled();
});


test('report book still waits for its own logo before preparing pages', async ({ page }) => {
  await setup(page, 'en');
  let releaseLogo!: () => void;
  const held = new Promise<void>(resolve => { releaseLogo = resolve; });
  await page.route('**/held-report-logo.svg', async route => {
    await held;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="navy"/></svg>' });
  });
  await page.route('https://api.entix.io/api/reports/income-statement*', route => route.fulfill({ json: {
    id: 'income-statement', title: 'قائمة الدخل', englishTitle: 'Income statement', category: 'financial', status: 'live',
    generatedAt: '2026-09-28T00:00:00Z', period: { to: '2026-09-28' }, currency: 'USD', summary: {},
    org: { id: visualOrgId, name: 'Readiness Test LLC', country: 'US', logoUrl: '/held-report-logo.svg' }, sections: [], notices: [],
  } }));
  for (const label of ['Balance sheet', 'Cash flow', 'Trial balance']) await page.getByLabel(label, { exact: true }).uncheck();
  const requested = page.waitForRequest('**/held-report-logo.svg');
  await page.getByRole('button', { name: 'Prepare report book', exact: true }).click();
  await requested;
  await expect(page.getByTestId('book-download')).toBeDisabled();
  await expect(page.getByTestId('report-book-pages')).toHaveAttribute('data-ready', 'false');
  releaseLogo();
  await expect(page.getByTestId('report-book-pages')).toHaveAttribute('data-ready', 'true');
  expect(await page.getByTestId('report-book-pages').locator('img').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(100);
});
