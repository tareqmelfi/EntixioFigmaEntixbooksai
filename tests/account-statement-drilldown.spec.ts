import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const org = { id: visualOrgId, name: 'Synthetic Company', country: 'US', baseCurrency: 'USD', paymentSettings: { reports: { logoSource: 'none', bilingual: false, language: 'en' } } };
const account = { id: 'mercury', code: '1010', name: 'Mercury', nameAr: 'ميركوري', type: 'ASSET', isActive: true, balance: 80 };
function statement(from = '2026-01-01', to = '2026-10-06', count = 2) {
  return { id: 'account-statement-detail', title: 'كشف حساب · 1010 · ميركوري', englishTitle: 'Account statement · 1010 · Mercury', description: '', category: 'accountant', status: 'live', generatedAt: '2026-10-06T00:00:00Z', account, org, currency: 'USD', period: { from, to }, summary: { opening: 10, debit: 100, credit: 30, balance: 80 }, sections: [{ id: 'account-movements', title: '1010 · Mercury', columns: ['date','label','description','source','debit','credit','balance'].map(key => ({ key, label: key, kind: ['debit','credit','balance'].includes(key) ? 'money' : 'text' })), rows: [
    { id: 'opening', label: 'Opening balance', values: { label: 'Opening balance', balance: 10 } },
    ...Array.from({ length: count }, (_, i) => ({ id: `line-${i}`, label: `JV-${i+1}`, values: { date: '2026-10-01', label: `JV-${i+1}`, description: 'Selected account movement', source: 'Open document', debit: i ? 0 : 100, credit: i ? 30 : 0, balance: i ? 80 : 110 }, link: { type: 'journal', href: '/app/journal-entries?entryId=entry-1', label: `JV-${i+1}` }, sourceLink: { type: 'invoice', href: '/app/invoices/source-invoice', label: 'Open document' } })),
    { id: 'account-total', label: 'Closing balance', values: { label: 'Closing balance', debit: 100, credit: 30, balance: 80 } },
  ] }] };
}
async function setup(page: Page, language: 'ar'|'en', count = 2) {
  await prepareVisualApp(page, language);
  const calls: URL[] = [];
  await page.route('**/api/accounts', r => r.fulfill({ json: { items: [account], total: 1 } }));
  await page.route(`**/orgs/${visualOrgId}`, r => r.fulfill({ json: org }));
  await page.route('**/api/reports/trial-balance?*', r => r.fulfill({ json: { ...statement(), id: 'trial-balance', title: 'ميزان المراجعة', englishTitle: 'Trial balance', sections: [{ id: 'accounts', title: 'Trial balance', columns: ['label','type','opening','debit','credit','balance'].map(key=>({key,label:key})), rows: [{ id: account.id, label: '1010 · Mercury', values: { label: '1010 · Mercury', type: 'ASSET', opening: 10, debit: 100, credit: 30, balance: 80 }, link: { type: 'account', href: '/app/chart-of-accounts?account=mercury', label: 'Mercury' } }] }] } }));
  await page.route('**/api/reports/account-statement-detail?*', r => {
    const url = new URL(r.request().url()); calls.push(url);
    if (url.searchParams.get('accountId') !== 'mercury') return r.fulfill({ status: 400, json: { error: 'missing_scope' } });
    return r.fulfill({ json: statement(url.searchParams.get('from') || '1970-01-01', url.searchParams.get('to') || '2026-10-06', count) });
  });
  await page.route('**/api/journals/entry-1', r=>r.fulfill({json:{id:'entry-1',number:'JV-1',date:'2026-10-01',description:'Selected movement',status:'POSTED',source:'manual',reference:null,lines:[],attachments:[],totalDebit:100,totalCredit:100}}));
  return calls;
}
for (const language of ['ar','en'] as const) test(`trial amounts open a full statement and preserve filters and return (${language})`, async ({page}, info) => {
  const calls = await setup(page, language);
  await page.goto('/app/reports/trial-balance?from=2026-01-01&to=2026-10-06&branchId=none&projectId=none');
  const table = page.getByTestId('report-data-table');
  await table.getByRole('button', { name: '80.00', exact: true }).click();
  await expect(page).toHaveURL(/account-statement-detail\?/);
  await expect(page.getByRole('heading', { name: language==='en'?'Account statement · 1010 · Mercury':'كشف حساب · 1010 · ميركوري' })).toBeVisible();
  expect(calls.at(-1)!.searchParams.get('branchId')).toBe('none');
  expect(calls.at(-1)!.searchParams.get('projectId')).toBe('none');
  await expect(table).toContainText('JV-2');
  await expect(page.getByText(language==='en'?'Row details':'تفاصيل الصف',{exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`statement-${language}.png`),fullPage:true});
  await table.getByRole('button',{name:'JV-1',exact:true}).click();
  await expect(page).toHaveURL(/journal-entries\?entryId=entry-1/);
  await expect(page.getByRole('button',{name:language==='en'?'Unpost & Edit':'إلغاء ترحيل وتعديل',exact:true})).toBeVisible();
  await page.getByRole('link',{name:language==='en'?'Back to account statement':'الرجوع لكشف الحساب'}).click();
  await expect(table).toContainText('JV-2');
  await page.getByLabel(language==='en'?'From date':'من تاريخ').fill('2026-02-01');
  await expect.poll(()=>calls.at(-1)?.searchParams.get('from')).toBe('2026-02-01');
  await expect(page).toHaveURL(/accountId=mercury/);
  await page.getByRole('button',{name:language==='en'?'Back to list':'الرجوع للقائمة'}).click();
  await expect(page).toHaveURL(/trial-balance\?from=2026-01-01/);
});

test('chart account balance and legacy links open complete all-time statement on phone', async ({page}) => {
  const calls = await setup(page, 'en', 505);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/chart-of-accounts');
  await page.getByRole('button',{name:'Mercury · Account statement',exact:true}).click();
  await expect(page.getByTestId('report-data-table')).toContainText('JV-505');
  expect(calls.at(-1)!.searchParams.get('allTime')).toBe('1');
  await expect(page.locator('aside').filter({hasText:'Row details'})).toHaveCount(0);
  const width = await page.evaluate(()=>({body:document.body.scrollWidth,screen:innerWidth}));
  expect(width.body).toBeLessThanOrEqual(width.screen+1);
  await page.goto('/app/chart-of-accounts?account=mercury');
  await expect(page).toHaveURL(/account-statement-detail.*accountId=mercury/);
  await expect(page.getByTestId('report-data-table')).toContainText('JV-505');
});

test('Excel and standalone PDF contain only selected account with exact date scope', async ({page},info) => {
  test.setTimeout(120000);
  const calls = await setup(page,'en');
  await page.goto('/app/reports/account-statement-detail?accountId=mercury&from=2026-01-01&to=2026-10-06&branchId=none&projectId=none');
  await expect(page.getByTestId('report-data-table')).toContainText('JV-2');
  await page.getByRole('button',{name:'Export report',exact:true}).click();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Excel (.xlsx)',exact:true}).click();
  const file=info.outputPath('mercury.xlsx'); await(await downloading).saveAs(file);
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(file);
  const text=JSON.stringify(book.worksheets[0].getSheetValues());
  expect(text).toContain('Account statement · 1010 · Mercury');
  expect(text).toContain('JV-1');expect(text).toContain('JV-2');expect(text).not.toContain('Trial balance');
  await page.getByRole('button',{name:'Export report',exact:true}).click();
  await page.getByRole('button',{name:'PDF / Print',exact:true}).click();
  await expect(page).toHaveURL(/\/print\/report\/account-statement-detail.*accountId=mercury/);
  const output=page.getByTestId('report-output-pages');
  await expect(output).toHaveAttribute('data-ready','true',{timeout:30000});
  await expect(output).toContainText('Account statement · 1010 · Mercury');
  await expect(output).toContainText('JV-2');await expect(output).not.toContainText('Trial balance');
  expect(calls.at(-1)!.searchParams.get('from')).toBe('2026-01-01');
  expect(calls.at(-1)!.searchParams.get('branchId')).toBe('none');
  const pdfPending=page.waitForEvent('download');await page.getByTestId('report-download-pdf').click();
  const pdf=info.outputPath('mercury.pdf');await(await pdfPending).saveAs(pdf);
  expect((await readFile(pdf)).subarray(0,5).toString()).toBe('%PDF-');
  await page.getByRole('button',{name:'Print settings',exact:true}).click();
  await expect(page).toHaveURL(/accountId=mercury/);
  await expect(page.getByTestId('report-output-pages')).toHaveAttribute('data-ready','true');
});

for (const path of ['/app/reports/account-statement-detail','/print/report/account-statement-detail']) test(`refuses an unscoped server response at ${path}`, async ({page})=>{
  await setup(page,'en');
  await page.route('**/api/reports/account-statement-detail?*',r=>r.fulfill({json:{...statement(),account:undefined}}));
  await page.goto(`${path}?accountId=mercury&orgId=${visualOrgId}`);
  await expect(page.getByText(/scope could not be verified|Could not verify the account for printing/)).toBeVisible();
  await expect(page.getByTestId('report-data-table')).toHaveCount(0);
  await expect(page.getByTestId('report-output-pages')).toHaveCount(0);
});
