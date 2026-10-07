import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

for (const variant of [
  { template: 'condensed', language: 'ar', orientation: 'landscape', paper: 'A4' },
  { template: 'condensed', language: 'en', orientation: 'landscape', paper: 'Letter' },
  { template: 'classic', language: 'ar', orientation: 'landscape', paper: 'A4' },
  { template: 'classic', language: 'en', orientation: 'portrait', paper: 'Letter' },
]) test(`statement print fits dates and references without wasting rows (${Object.values(variant).join(' ')})`, async ({ page }, info) => {
  test.setTimeout(120000);
  await prepareVisualApp(page, variant.language as 'ar' | 'en');
  const org = { id: visualOrgId, name: 'Statement QA', country: 'US', baseCurrency: 'USD', paymentSettings: { reports: { ...variant, bilingual: false, logoSource: 'none' } } };
  const columns = [
    { key: 'date', label: 'التاريخ␟Date', kind: 'date' },
    { key: 'label', label: 'رقم القيد␟Entry number' },
    { key: 'description', label: 'الوصف␟Description' },
    { key: 'source', label: 'المصدر␟Source' },
    ...['debit', 'credit', 'balance'].map(key => ({ key, label: key, kind: 'money', align: 'end' })),
  ];
  const rows = Array.from({ length: 120 }, (_, i) => ({ id: `line-${i}`, values: {
    date: '2026-03-09', label: `JV-2026-${String(i).padStart(5, '0')}`,
    description: i % 10 ? 'IO AUTOPAY · سداد البطاقة الائتمانية␟IO AUTOPAY · Credit card payment' : 'تفاصيل عملية طويلة لاختبار ظهور الشرح بالكامل في الصفحة دون قص الكلمات أو إخفاء المعلومات المرتبطة بالعملية␟A longer transaction description that must wrap without clipping any words or losing information about this transaction',
    source: i % 3 ? '—' : 'فتح المستند␟Open document', debit: 1000.25, credit: 0, balance: 99999.75,
  } }));
  const report = { id: 'account-statement-detail', title: 'كشف حساب · 1010 · ميركوري', englishTitle: 'Account statement · 1010 · Mercury', org, account: { id: 'mercury', code: '1010', name: 'Mercury' }, currency: 'USD', period: { from: '2026-01-01', to: '2026-10-06' }, generatedAt: '2026-10-07T00:00:00Z', sections: [{ id: 'account-movements', title: '1010 · Mercury', columns, rows }], summary: {} };
  await page.route(`**/orgs/${visualOrgId}`, route => route.fulfill({ json: org }));
  await page.route('**/api/reports/account-statement-detail?*', route => route.fulfill({ json: report }));
  await page.goto(`/print/report/account-statement-detail?orgId=${visualOrgId}&accountId=mercury&detail=full`);
  const output = page.getByTestId('report-output-pages');
  await expect(output).toHaveAttribute('data-ready', 'true');
  // Explicit portrait mode may split columns into panels; every panel retains all rows.
  const panels = variant.orientation === 'portrait' ? 2 : 1;
  await expect(output.locator('tbody tr')).toHaveCount(120 * panels);
  for (const root of [page.locator('.report-measure-source'), output]) {
    const metrics = await root.locator('tbody tr').evaluateAll(rows => rows.map(row => {
      const date = row.querySelector('[data-column="date"]')!;
      const reference = row.querySelector('[data-column="label"]');
      const range = document.createRange(); range.selectNodeContents(date);
      // Nested inline boxes can have distinct tops; actual text must fit one line.
      const walker = document.createTreeWalker(date, NodeFilter.SHOW_TEXT);
      const textTops: number[] = []; let node;
      while ((node = walker.nextNode())) { range.selectNodeContents(node); textTops.push(...[...range.getClientRects()].map(r => Math.round(r.top))); }
      return { dateLines: new Set(textTops).size, dateWidth: date.getBoundingClientRect().width, referenceWidth: reference?.getBoundingClientRect().width, rowHeight: row.getBoundingClientRect().height, clips: [...row.children].some(c => c.scrollWidth > c.clientWidth + 1) };
    }));
    expect(metrics.every(m => m.dateLines === 1 && !m.clips)).toBe(true);
    if (variant.orientation === 'landscape') {
      expect(metrics.every(m => !m.referenceWidth || m.referenceWidth < 160)).toBe(true);
      expect(metrics.filter(m => m.rowHeight < 26).length).toBeGreaterThan(100);
    }
  }
  const sheets = output.locator('.report-output-sheet');
  const fits = await sheets.evaluateAll(pages => pages.every(p => { const body = p.querySelector('.report-page-body')!; return body.scrollHeight <= body.clientHeight + 1 && p.querySelector('tbody tr:last-child')!.getBoundingClientRect().bottom <= p.querySelector('.report-page-footer')!.getBoundingClientRect().top; }));
  expect(fits).toBe(true);
  if (variant.template === 'condensed') expect(await sheets.count()).toBeLessThanOrEqual(5);
  await sheets.first().screenshot({ path: info.outputPath('statement.png') });
  if (variant.template === 'condensed' && variant.language === 'ar') {
    const download = page.waitForEvent('download');
    await page.getByTestId('report-download-pdf').click();
    const path = info.outputPath('statement.pdf'); await (await download).saveAs(path);
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(await sheets.count());
  }
});
