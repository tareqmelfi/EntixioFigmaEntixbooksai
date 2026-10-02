import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { reportWorkbook } from '../src/app/lib/report-export';

const report: any = { id: 'income-statement', title: 'قائمة الدخل', englishTitle: 'Income statement', status: 'live', generatedAt: '2026-10-01T12:00:00Z', period: { from: '2026-01-01', to: '2026-10-01' }, currency: 'SAR', org: { id: visualOrgId, name: 'شركة اختبار', country: 'SA', paymentSettings: {} }, summary: {}, notices: ['بيانات اختبار فقط'], sections: [
  { id: 'income-summary', title: 'ملخص قائمة الدخل␟Income summary', columns: [{ key: 'label', label: 'البند␟Item' }, { key: 'amount', label: 'القيمة␟Amount', kind: 'money' }], rows: [['revenue', 'الإيرادات', 1000], ['expenses', 'المصروفات', 1200], ['net-income', 'صافي الخسارة', -200]].map(([id, label, amount]) => ({ id, label, values: { label, amount } })) },
] };
async function setup(page: any, settings: any = {}) {
  await prepareVisualApp(page, 'ar');
  await page.route('https://api.entix.io/api/reports/income-statement*', (route: any) => route.fulfill({ json: report }));
  await page.route(`https://api.entix.io/orgs/${visualOrgId}`, (route: any) => route.fulfill({ json: { ...report.org, paymentSettings: { reports: settings } } }));
  await page.goto(`/app/reports/income-statement/print?orgId=${visualOrgId}&comparison=none`);
  await expect(page.getByTestId('report-output-pages')).toHaveAttribute('data-ready', 'true');
}

test('designer applies font, equation, monochrome and paper choices to actual PDF pages', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await setup(page, { bilingual: false });
  const output = page.getByTestId('report-output-pages');
  await expect(output.locator('.report-equation')).toContainText('(200.00)');
  const rowValues = await output.locator('tbody').textContent();
  await page.getByLabel('خط التقرير', { exact: true }).selectOption('plex');
  await page.getByLabel('نمط الألوان', { exact: true }).selectOption('plain');
  await page.getByRole('combobox', { name: /^الورق/ }).selectOption('A3');
  await page.getByRole('combobox', { name: /^الاتجاه/ }).selectOption('landscape');
  await page.getByLabel('معادلة قائمة الدخل', { exact: true }).uncheck();
  await expect(output).toHaveAttribute('data-ready', 'true');
  await expect(output.locator('.report-equation')).toHaveCount(0);
  await expect(output.locator('tbody')).toHaveText(rowValues!);
  await expect(output.locator('.report-negative')).toHaveCSS('color', 'rgb(17, 17, 17)');
  await expect(output.locator('th').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(output.locator('article')).toHaveCSS('font-family', '"IBM Plex Sans Arabic", sans-serif, sans-serif');
  await expect(output.locator('tbody td bdi').first()).toHaveCSS('font-family', '"IBM Plex Sans Arabic", sans-serif, sans-serif');
  const box = await output.locator('article').boundingBox();
  expect(box!.width).toBeCloseTo(420 * 96 / 25.4, 0);
  expect(box!.height).toBeCloseTo(297 * 96 / 25.4, 0);
  const download = page.waitForEvent('download');
  await page.getByTestId('report-download-pdf').click();
  const file = testInfo.outputPath('formal-a3.pdf'); await (await download).saveAs(file);
  expect((await readFile(file)).subarray(0, 5).toString()).toBe('%PDF-');
});

test('Arabic equation amounts remain intact across fonts and compact portrait exports', async ({ page }) => {
  await setup(page, { bilingual: false, orientation: 'portrait', fontScale: 'compact' });
  const equation = page.getByTestId('report-output-pages').locator('.report-equation');
  for (const font of ['noto', 'plex', 'tajawal']) {
    await page.getByLabel('خط التقرير', { exact: true }).selectOption(font);
    await expect(equation.locator('.report-equation-term').first()).toHaveCSS('flex-wrap', 'nowrap');
    const geometry = await equation.evaluate(element => {
      const outer = element.getBoundingClientRect();
      return [...element.querySelectorAll('.numeric-text')].map(amount => {
        const box = amount.getBoundingClientRect();
        return box.top >= outer.top && box.bottom <= outer.bottom && box.left >= outer.left && box.right <= outer.right;
      });
    });
    expect(geometry).toEqual([true, true, true]);
  }
});

test('individual covers can be removed without losing data or page numbering', async ({ page }) => {
  await setup(page, { bilingual: false });
  const output = page.getByTestId('report-output-pages');
  await page.getByLabel('غلاف أمامي', { exact: true }).check();
  await page.getByLabel('غلاف أخير', { exact: true }).check();
  await page.getByLabel('تصميم الغلاف', { exact: true }).selectOption('formal');
  await expect(output).toHaveAttribute('data-ready', 'true');
  await expect(output.locator('.report-output-sheet')).toHaveCount(3);
  await expect(output.locator('[data-cover-kind=front]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(output.locator('[data-cover-kind=back] .report-page-counter')).toHaveText('3 / 3');
  await expect(output.locator('tbody tr')).toHaveCount(3);
  await page.getByLabel('غلاف أمامي', { exact: true }).uncheck();
  await page.getByLabel('غلاف أخير', { exact: true }).uncheck();
  await expect(output.locator('.report-output-sheet')).toHaveCount(1);
  await expect(output.locator('.report-page-counter')).toHaveText('1 / 1');
});

test('Excel preserves numeric cells and formal choices, A3 and the repeated header after equation', async () => {
  const book = await reportWorkbook(report, 'ar', { settings: { paper: 'A3', colorMode: 'plain', fontFamily: 'plex', showEquation: true } });
  const sheet = book.worksheets[0];
  expect(sheet.pageSetup.paperSize).toBe(8);
  expect(sheet.pageSetup.blackAndWhite).toBe(true);
  const rows: any[] = []; sheet.eachRow(row => rows.push(row));
  const negative = rows.find(row => row.getCell(2).value === -200)!;
  expect(negative.getCell(2).numFmt).not.toContain('[Red]');
  expect(negative.getCell(2).numFmt).toContain('(');
  expect(negative.font.name).toBe('IBM Plex Sans Arabic');
  const header = rows.find(row => row.getCell(1).value === 'البند')!;
  expect(sheet.pageSetup.printTitlesRow).toBe(`${header.number}:${header.number}`);
  expect(header.fill.fgColor.argb).toBe('FFFFFFFF');
  const reopened = new (book.constructor as any)(); await reopened.xlsx.load(await book.xlsx.writeBuffer());
  expect(reopened.worksheets[0].getCell(negative.number, 2).value).toBe(-200);
});
