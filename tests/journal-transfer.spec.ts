import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const accounts = [{ id: 'cash', code: '1000', name: 'Cash', type: 'ASSET', isActive: true, allowPosting: true }, { id: 'revenue', code: '4000', name: 'Revenue', type: 'REVENUE', isActive: true, allowPosting: true }];
const entries = Array.from({length: 503}, (_, i) => ({ id: `entry-${i}`, number: `JV-${i}`, date: i ? '2026-10-06T00:00:00Z' : '2026-09-01T00:00:00Z', description: i ? 'Imported transaction' : '=Dangerous spreadsheet formula', reference: '', status: 'POSTED', source: 'manual', totalDebit: 10, totalCredit: 10, lineCount: 2, lines: accounts.map((a, n) => ({ accountId: a.id, accountCode: a.code, accountName: a.name, debit: n ? 0 : 10, credit: n ? 10 : 0, description: 'Line, with "quotes"' })) }));
async function setup(page: any) {
  await prepareVisualApp(page, 'en');
  await page.route(`**/orgs/${visualOrgId}`, (r: any) => r.fulfill({json:{id:visualOrgId,name:'Journal QA',baseCurrency:'USD',paymentSettings:{reports:{logoSource:'none'}}}}));
  await page.route('**/api/accounts', (r: any) => r.fulfill({json:{items:accounts}}));
  await page.route('**/api/journals**', (r: any) => {
    const u = new URL(r.request().url());
    if(u.pathname.endsWith('coverage'))return r.fulfill({json:{linked:true,unposted:{}}});
    if(u.pathname.includes('/entry-'))return r.fulfill({json:entries.find(e=>u.pathname.endsWith(e.id))});
    const offset=Number(u.searchParams.get('offset')||0), limit=Number(u.searchParams.get('limit')||200);
    return r.fulfill({json:{items:entries.slice(offset,offset+limit),total:entries.length,hasMore:offset+limit<entries.length}});
  });
  await page.goto('/app/journal-entries');
  await expect(page.getByRole('heading',{name:'Journal Entries',exact:true})).toBeVisible();
}
test('Excel and CSV export all 503 entries, preserve amounts and honor date scope', async({page})=>{
  await setup(page); await page.getByRole('button',{name:'Excel / Export',exact:true}).click();
  await expect(page.getByText('All statuses · 503 entries',{exact:true})).toBeVisible();
  const downloaded=page.waitForEvent('download'); await page.getByRole('button',{name:'Download Excel',exact:true}).click();
  const file=await downloaded;const book=new ExcelJS.Workbook();await book.xlsx.readFile((await file.path())!);
  const sheet=book.worksheets[0];expect(sheet.rowCount).toBe(1007);expect(sheet.getCell('C2').value).toBe('=Dangerous spreadsheet formula');expect(sheet.getCell('F2').value).toBe(10);expect(sheet.getCell('G3').value).toBe(10);
  await page.getByLabel('From',{exact:true}).fill('2026-09-01');await page.getByLabel('To',{exact:true}).fill('2026-09-30');
  const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const csv=await csvEvent;
  const fs=await import('node:fs/promises');const text=await fs.readFile((await csv.path())!,'utf8');expect(text).toContain("'=Dangerous");expect(text).not.toContain('JV-502');expect(text.split('\r\n')).toHaveLength(3);
});
test('full journal print preserves all sections beyond the loaded list',async({page})=>{
  // This checks complete output across API pages. Responsiveness is covered by
  // the dedicated heartbeat test; shared CI workers are not a timing benchmark.
  test.setTimeout(90000);
  await setup(page);await page.getByRole('button',{name:'Print / PDF',exact:true}).click();
  await expect(page.getByTestId('report-output-pages')).toHaveAttribute('data-ready','true',{timeout:60000});
  const output=page.getByTestId('report-output-pages');
  await expect(output.locator('tbody tr')).toHaveCount(1006);
  await expect(output).toContainText('JV-502');
});
test('selected journal prints only itself and can return to list',async({page})=>{
  await setup(page);await page.goto('/app/journal-entries?entryId=entry-2');
  await page.getByRole('button',{name:'Print / export this entry',exact:true}).click();
  await expect(page.getByTestId('report-output-pages')).toHaveAttribute('data-ready','true');
  const output=page.getByTestId('report-output-pages');await expect(output.locator('tbody tr')).toHaveCount(2);await expect(output).toContainText('JV-2');await expect(output).not.toContainText('JV-502');
  await page.getByRole('button',{name:'Back to journals',exact:true}).click();await expect(page.getByRole('heading',{name:'Journal Entries',exact:true})).toBeVisible();
});
test('import previews, rejects invalid lines and safely retries partially saved drafts',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'Import',exact:true}).click();
  const headers='EntryKey,Date,Description,Reference,AccountCode,Debit,Credit';
  const entry=(key:string,credit=10)=>`${key},2026-10-07,Import test,,1000,10,0\n${key},2026-10-07,Import test,,4000,0,${credit}`;
  const input=page.getByTestId('journal-import-file');
  await input.setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from(headers+'\n'+entry('BAD',9))});
  await expect(page.getByText('Unbalanced entry / القيد غير متوازن')).toBeVisible();await expect(page.getByRole('button',{name:/Import .* as drafts/})).toHaveCount(0);
  let attempts=0;const saved=new Map<string,string>();const keys:string[]=[];
  await page.route('**/api/journals',async r=>{
    if(r.request().method()!=='POST')return r.fallback();
    const body=r.request().postDataJSON();expect(body.postOnSave).toBe(false);keys.push(body.importKey);attempts++;
    const id=saved.get(body.importKey)||`saved-${body.importKey}`;saved.set(body.importKey,id);
    if(attempts===2)return r.fulfill({status:500,json:{error:'timeout_after_commit'}});
    return r.fulfill({json:{id,number:id,status:'DRAFT'}});
  });
  await input.setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from(headers+'\n'+entry('ONE')+'\n'+entry('TWO'))});
  await expect(page.getByRole('button',{name:'Import 2 as drafts',exact:true})).toBeEnabled();expect(attempts).toBe(0);
  await page.getByRole('button',{name:'Import 2 as drafts',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:'Import 1 as drafts',exact:true}).click();await expect(page.getByText('2 entries · 2 saved or existing · 0 need correction',{exact:true})).toBeVisible();
  expect(keys).toEqual(['ONE','TWO','TWO']);expect(saved.size).toBe(2);
});
