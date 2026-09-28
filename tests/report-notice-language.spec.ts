import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const language of ['ar', 'en'] as const) for (const template of ['classic', 'condensed']) {
  test(`report source notices use document language in preview and PDF (${template}, ${language})`, async ({ page }, testInfo) => {
    await prepareVisualApp(page, language);
    const org = { id: visualOrgId, name: 'Synthetic report company', country: 'SA', baseCurrency: 'SAR', paymentSettings: { reports: { language, template, bilingual: false } } };
    await page.route(`https://api.entix.io/orgs/${visualOrgId}`, route => route.fulfill({ json: org }));
    await page.route('https://api.entix.io/api/reports/income-statement*', route => route.fulfill({ json: {
      id: 'income-statement', title: 'قائمة الدخل', englishTitle: 'Income statement', category: 'financial', status: 'live',
      generatedAt: '2026-09-28T00:00:00Z', period: { from: '2026-01-01', to: '2026-09-28' }, currency: 'SAR', org, summary: {},
      notices: ['مصدر البيانات: قيود مرحلة␟Data source: posted journal entries', 'Synthetic warning retained', '␟Available translation'],
      sections: [{ id: 'detail', title: 'بيانات اصطناعية␟Synthetic data', columns: [{ key: 'label', label: 'الحساب␟Account' }, { key: 'amount', label: 'المبلغ␟Amount', kind: 'money' }],
        rows: [{ id: 'one', values: { label: 'خدمات␟Services', amount: 1234.56 } }] }],
    } }));
    await page.goto(`/print/report/income-statement?orgId=${visualOrgId}`);
    const output = page.getByTestId('report-output-pages');
    await expect(output).toHaveAttribute('data-ready', 'true');
    await expect(output).toContainText(language === 'ar' ? 'مصدر البيانات: قيود مرحلة' : 'Data source: posted journal entries');
    await expect(output).not.toContainText(language === 'ar' ? 'Data source: posted journal entries' : 'مصدر البيانات: قيود مرحلة');
    await expect(output).not.toContainText('␟');
    await expect(output).toContainText('Synthetic warning retained');
    await expect(output).toContainText('Available translation');
    await expect(output).toContainText('1,234.56');
    await output.screenshot({ path: testInfo.outputPath('notices-preview.png') });
    const download = page.waitForEvent('download');
    await page.getByTestId('report-download-pdf').click();
    const file = testInfo.outputPath('notices.pdf');
    await (await download).saveAs(file);
    expect((await readFile(file)).subarray(0, 5).toString()).toBe('%PDF-');
  });
}
