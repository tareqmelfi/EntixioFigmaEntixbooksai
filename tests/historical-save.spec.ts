import { expect, test, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { historicalFixture } from './historical-statements.contract';

const org = {id:visualOrgId,name:'Synthetic Test Company',country:'US',baseCurrency:'USD',crNumber:'SYNTHETIC-001',fiscalYearStart:1,fiscalYearEnd:12,role:'OWNER'};
const record = (payload = historicalFixture, version=1) => ({id:`r${version}`,scope:'unconsolidated',version,periodStart:'2022-01-01',periodEnd:'2022-12-31',contentSha256:'b'.repeat(64),sourceSha256:'a'.repeat(64),createdAt:'2026-09-16T00:00:00Z',supersedesId:version>1?`r${version-1}`:null,payload});
async function setup(page:Page,role='OWNER',failure: 'none'|'unavailable'|'conflict'|'stale'='none') {
  // No production connection is allowed by this test. Every API reply is synthetic.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
  await prepareVisualApp(page,'ar');
  await page.addInitScript(()=>localStorage.setItem('entix-numbering-system','arab'));
  await page.route('https://api.entix.io/me',route=>route.fulfill({json:{locale:'ar',selectedOrgId:visualOrgId,defaultOrgId:visualOrgId,memberships:[{org,role}]}}));
  await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:{org,kpi:{revenue:0,purchases:0,expenses:0,receipts:0,payments:0,vatOutput:0,vatInput:0,vatNet:0,invoiceCount:0,overdueCount:0,contactCount:0,accountsReceivable:0,accountsPayable:0,cashOnHand:0},monthlyTrend:[],cashFlowTrend:[],profitLoss:[],expenseBreakdown:[],incomeBreakdown:[],overdueInvoices:[],bankAccounts:[],periodCompare:{thisMonth:{revenue:0,expenses:0,net:0},lastMonth:{revenue:0,expenses:0,net:0},yearAgo:{revenue:0,expenses:0,net:0}}}}));
  let latestReads=0;
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>{
    latestReads++;
    if(failure==='unavailable') return route.fulfill({status:503,json:{error:'historical_reports_unavailable'}});
    return route.fulfill({json:{report:record(historicalFixture,failure==='stale'&&latestReads>1?2:1)}});
  });
  const posted: unknown[]=[];
  await page.route('https://api.entix.io/api/historical-reports',route=>{
    const body=route.request().postDataJSON();posted.push(body);
    if(failure==='conflict') return route.fulfill({status:409,json:{error:'historical_version_conflict'}});
    return route.fulfill({status:201,json:{report:record(body.payload,2),duplicate:false}});
  });
  await page.goto('/app?__qa_auth=1');
  return posted;
}

test('saved snapshot opens separately; explicit save preserves raw IDs/text and supersedes prior version',async({page})=>{
  const posted=await setup(page);
  await expect(page.getByTestId('historical-summary')).toContainText('2022');
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toBeVisible();
  const raw=structuredClone(historicalFixture);
  raw.revision='V02';raw.periods[0].id='فترة-٢٠٢٢';raw.periods[0].label='سنة ٢٠٢٢';raw.warnings=['المصدر ۱۲۳'];raw.periods[0].metrics.revenue.value=26;
  await page.locator('input[type=file]').setInputFiles({name:'correction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  await expect(page.getByRole('combobox')).toHaveValue('فترة-٢٠٢٢');
  await expect(page.getByText('المصدر 123',{exact:true})).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
  expect(posted).toEqual([]);
  await page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('حُفظت نسخة جديدة');
  expect(posted).toEqual([{payload:raw,supersedesId:'r1'}]);
  await page.getByRole('button',{name:'العودة إلى لوحة الدفاتر',exact:true}).click();
  await expect(page.getByTestId('historical-summary')).toContainText('2022');
});

test('VIEWER membership cannot save even if summary org claims OWNER',async({page})=>{
  const posted=await setup(page,'VIEWER');
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture))});
  await expect(page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true})).toHaveCount(0);
  expect(posted).toEqual([]);
});

for(const conflict of ['conflict','stale'] as const) test(`concurrent correction requires refresh instead of overwrite (${conflict})`,async({page})=>{
  const posted=await setup(page,'OWNER',conflict);
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture))});
  await page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('تغيّرت النسخة المحفوظة');
  expect(posted.length).toBe(conflict==='conflict'?1:0);
});

test('unavailable API is visible and never presented as an empty saved history',async({page})=>{
  const posted=await setup(page,'OWNER','unavailable');
  await expect(page.getByTestId('historical-summary').getByRole('alert')).toContainText('تعذر تحميل');
  await expect(page.getByTestId('historical-summary')).not.toContainText('لم تُحفظ قوائم');
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture))});
  await expect(page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true})).toBeDisabled();
  expect(posted).toEqual([]);
});

test('refresh with unchanged ID restores the saved view',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'تحديث المرجع المحفوظ',exact:true}).click();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toBeVisible();
});

test('file replacement is disabled while saving and reenabled after completion',async({page})=>{
  await setup(page);
  let release!:()=>void;
  const ready=new Promise<void>(resolve=>release=resolve);
  await page.route('https://api.entix.io/api/historical-reports',async route=>{
    const body=route.request().postDataJSON();await ready;
    await route.fulfill({status:201,json:{report:record(body.payload,2),duplicate:false}});
  });
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  const input=page.locator('input[type=file]');
  await input.setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture))});
  await page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true}).click();
  await expect(input).toBeDisabled();
  release();
  await expect(input).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('حُفظت نسخة جديدة');
});

test('duplicate older content does not replace the latest company reference',async({page})=>{
  await setup(page);
  const newest=structuredClone(historicalFixture);newest.revision='V02';newest.source.fileName='latest-reference.pdf';
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:record(newest,2)}}));
  await page.route('https://api.entix.io/api/historical-reports',route=>route.fulfill({status:200,json:{report:record(historicalFixture,1),duplicate:true}}));
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await page.getByRole('button',{name:'تحديث المرجع المحفوظ',exact:true}).click();
  await expect(page.getByText('latest-reference.pdf',{exact:true})).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(historicalFixture))});
  await page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('محفوظة بالفعل');
  await expect(page.getByText('latest-reference.pdf',{exact:true})).toBeVisible();
  await expect(page.getByText('النسخة المحفوظة: 2',{exact:true})).toBeVisible();
});

test('dashboard historical figures show known values and label unavailable or unreviewed metrics',async({page})=>{
  await setup(page);
  const source=structuredClone(historicalFixture);
  source.periods[0].metrics.netProfit.status='needs_review';
  source.periods[0].metrics.cash.value=null;source.periods[0].metrics.cash.status='unavailable';
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:record(source)}}));
  await page.reload();
  const card=page.getByTestId('historical-summary');
  await expect(card).not.toContainText('25.00');
  await card.getByRole('button',{name:'توسيع الملخص',exact:true}).click();
  await expect(card).toContainText('25.00');
  await expect(card).toContainText('100.00');
  await expect(card).toContainText('يحتاج مراجعة');
  await expect(card).toContainText('غير متوفر');
  await expect(card).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
});


test('pasted history validates identity and requires explicit save without changing payload',async({page})=>{
  const posted=await setup(page);
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await page.getByText('لصق بيانات القوائم',{exact:true}).click();
  const input=page.getByLabel('بيانات القوائم JSON',{exact:true});
  const wrong=structuredClone(historicalFixture);wrong.entity.crNumber='WRONG-COMPANY';
  await input.fill(JSON.stringify(wrong));
  await page.getByRole('button',{name:'معاينة البيانات الملصقة',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('لا يطابق سجل الشركة');
  await expect(page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true})).toBeDisabled();
  await input.fill(JSON.stringify(historicalFixture));
  await page.getByRole('button',{name:'معاينة البيانات الملصقة',exact:true}).click();
  await expect(page.getByText('synthetic-statements.pdf',{exact:true})).toBeVisible();
  expect(posted).toEqual([]);
  await page.getByRole('button',{name:'حفظ القوائم للشركة',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('حُفظت نسخة جديدة');
  expect(posted).toEqual([{payload:historicalFixture,supersedesId:'r1'}]);
});
