import { expect, test } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { historicalFixture } from './historical-statements.contract';

for (const language of ['ar','en'] as const) test(`historical file preview is local and rejects another entity (${language})`, async ({page}) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort());
  await prepareVisualApp(page, language);
  await page.addInitScript(() => localStorage.setItem('entix-numbering-system','arab'));
  const writes: string[] = [];
  page.on('request', r => { if (['POST','PUT','PATCH','DELETE'].includes(r.method())) writes.push(r.url()); });
  await page.route('https://api.entix.io/api/dashboard/summary**', route => route.fulfill({ json: {
    org: { id: visualOrgId, name: 'Synthetic Test Company', country: 'US', baseCurrency: 'USD', crNumber: 'SYNTHETIC-001', fiscalYearStart:1, fiscalYearEnd:12 },
    kpi: { revenue:0, purchases:0, expenses:0, receipts:0, payments:0, vatOutput:0, vatInput:0, vatNet:0, invoiceCount:0, overdueCount:0, contactCount:0, accountsReceivable:0, accountsPayable:0, cashOnHand:0 },
    monthlyTrend:[], cashFlowTrend:[], profitLoss:[], expenseBreakdown:[], incomeBreakdown:[], overdueInvoices:[], bankAccounts:[], periodCompare: { thisMonth:{revenue:0,expenses:0,net:0}, lastMonth:{revenue:0,expenses:0,net:0}, yearAgo:{revenue:0,expenses:0,net:0} },
  } }));
  await page.goto('/app?__qa_auth=1');
  await page.getByRole('button', {name: language === 'ar' ? 'عرض القوائم التاريخية' : 'View historical statements',exact:true}).click();
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name:'history.json', mimeType:'application/json', buffer: Buffer.from(JSON.stringify(historicalFixture)) });
  await expect(page.getByText('synthetic-statements.pdf', {exact:true})).toBeVisible();
  await expect(page.getByText('Longer than a calendar year; growth percentages are not comparable.',{exact:true})).toBeVisible();
  await page.getByRole('combobox').selectOption('2021');
  await expect(page.getByText(language === 'ar' ? 'غير متوفر' : 'Unavailable',{exact:true}).first()).toBeVisible();
  await page.getByRole('combobox').selectOption('2022');
  await expect(page.locator('body')).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
  await page.screenshot({ path:`test-results/historical-preview-${language}.png`, fullPage:true });
  await input.setInputFiles({ name:'other.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify({...historicalFixture,entity:{...historicalFixture.entity,crNumber:'OTHER'}})) });
  await expect(page.getByRole('alert').filter({hasText:language==='ar'?'الملف لا يطابق':'does not match'})).toBeVisible();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toHaveCount(0);
  await input.setInputFiles({ name:'history.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(historicalFixture)) });
  await page.getByRole('button', {name:language==='ar'?'العودة إلى لوحة الدفاتر':'Return to ledger dashboard',exact:true}).click();
  await page.getByRole('button', {name:language==='ar'?'عرض القوائم التاريخية':'View historical statements',exact:true}).click();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('changing company clears the historical file without remounting', async ({page}) => {
  await page.goto('/tests/fixtures/historical-preview.html?language=en');
  await page.locator('input[type=file]').setInputFiles({ name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture)) });
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Switch preview company'}).click();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture)) });
  await expect(page.getByRole('alert')).toContainText('does not match');
});

test('optional private local-file preview', async ({page}) => {
  test.skip(!process.env.ENTIX_PRIVATE_HISTORY_FILE, 'Private source file is supplied locally, never committed.');
  const fs = await import('node:fs/promises');
  const raw = await fs.readFile(process.env.ENTIX_PRIVATE_HISTORY_FILE!, 'utf8');
  const data = JSON.parse(raw);
  await page.addInitScript(() => localStorage.setItem('entix-numbering-system','arab'));
  await page.goto(`/tests/fixtures/historical-preview.html?language=ar&cr=${encodeURIComponent(data.entity.crNumber)}&country=${encodeURIComponent(data.entity.countryCode)}&currency=${encodeURIComponent(data.entity.currency)}`);
  await page.locator('input[type=file]').setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(raw)});
  await expect(page.getByRole('combobox')).toHaveValue('2022');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
  await page.screenshot({path:'/tmp/entix-five-colors-ui-20260916/historical-five-colors-private-V04.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/entix-five-colors-ui-20260916/historical-five-colors-private-mobile-V04.png',fullPage:true});
});


test('Arabic history normalizes imported text and settings retire legacy arab digits', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('entix-numbering-system','arab'));
  await page.goto('/tests/fixtures/historical-preview.html?language=ar');
  const source = structuredClone(historicalFixture);
  source.warnings = ['سنة ٢٠٢٢ وقيمة ۱۲۳'];
  source.periods[0].label = 'سنة ٢٠٢٢';
  source.periods[0].metrics.revenue.printedPage = '٤';
  await page.locator('input[type=file]').setInputFiles({name:'digits.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await expect(page.getByText('سنة 2022 وقيمة 123',{exact:true})).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
});
