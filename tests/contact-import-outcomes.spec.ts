import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

test('61 contact rows remain reviewable and every row reaches the downloadable result', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  const rows = Array.from({ length: 61 }, (_, i) => ({ row: i + 2, displayName: `Synthetic person ${i + 1}`, entityKind: 'INDIVIDUAL',
    taxId: '00123456', note: i === 60 ? 'long note rejected' : 'source "quoted"', raw: [`Synthetic person ${i + 1}`, '00123456'],
    status: i === 60 ? 'conflict' : 'new', messages: i === 60 ? [{ ar: 'طول الملاحظة', en: 'Note exceeds maximum length' }] : [] }));
  const fields = ['displayName', 'taxId'].map((field, column) => ({ field, column, label: { ar: field, en: field }, confidence: 1, alternatives: [] }));
  let committed: any;
  await page.route('**/api/contacts/import/analyze', r => r.fulfill({ json: { ok: true, entity: 'contacts', format: 'csv', fileName: 'synthetic.csv',
    sheets: [{ name: 'Sheet1', score: 1, headerRow: 0, rowCount: 62 }], sheet: 'Sheet1', headerRow: 0, headers: ['Name', 'Tax ID'],
    mapping: { displayName: 0, taxId: 1 }, fields, rows, counts: { total: 61, new: 60, conflict: 1 }, warnings: [] } }));
  await page.route('**/api/contacts/import/commit', r => {
    committed = r.request().postDataJSON();
    return r.fulfill({ json: { ok: false, created: 60, updated: 0, skipped: 0, rejectedCount: 1, uniqueTargets: 60,
      message: { ar: 'نتيجة جزئية', en: 'Processed 61 rows' }, warnings: [],
      outcomes: rows.map((row, index) => ({ index, row: row.row, status: index === 60 ? 'rejected' : 'created',
        targetId: index === 60 ? undefined : `synthetic-${index}`, reason: index === 60 ? 'Note exceeds maximum length' : 'Committed and verified' })) } });
  });
  await page.goto('/app/contacts');
  await page.getByTestId('contacts-import').click();
  await page.getByTestId('import-paste').fill('Name,Tax ID\nSynthetic,00123456');
  await page.getByRole('button', { name: 'Analyse pasted text' }).click();
  await page.getByTestId('import-to-preview').click();
  await expect(page.getByTestId('import-preview-rows').locator('tbody tr')).toHaveCount(30);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByTestId('import-preview-rows').locator('bdi').filter({ hasText: /^Synthetic person 61$/ })).toBeVisible();
  await page.getByTestId('import-commit').click();
  await expect.poll(() => committed?.rows.length).toBe(61);
  await expect(page.getByText('Partial result — review the rows')).toBeVisible();
  await expect(page.getByTestId('import-row-outcomes').getByText('Note exceeds maximum length')).toBeVisible();
  await expect(page.getByText('Every row accounted for: 61')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download every row result' }).click();
  expect((await download).suggestedFilename()).toBe('entix-contact-import-results.xls');
});

test('typing a similar contractor offers the existing identity before saving', async ({ page }) => {
  await prepareVisualApp(page, 'en');
  const contact = { id: 'existing', displayName: 'Ahmed Abdullah', entityKind: 'INDIVIDUAL', email: 'synthetic@example.com', taxId: '00123456' };
  await page.route('**/api/contacts**', r => r.fulfill({ json: { items: [contact], total: 1 } }));
  await page.route('**/api/contractors/next-code', r => r.fulfill({ json: { code: 'SYN-1' } }));
  await page.goto('/app/contractors/new');
  await page.getByPlaceholder('Freelancer, contractor or agency name').fill('Ahmed');
  await expect(page.getByRole('button', { name: /Ahmed Abdullah.*synthetic@example.com/ })).toBeVisible();
  await page.getByRole('button', { name: /Ahmed Abdullah.*synthetic@example.com/ }).click();
  await expect(page.getByPlaceholder('Freelancer, contractor or agency name')).toHaveValue('Ahmed Abdullah');
  await expect(page.getByLabel('Tax ID (optional for individuals and companies)')).toHaveValue('00123456');
});
