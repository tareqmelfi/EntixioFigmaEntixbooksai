import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { dashboardTotalsMatch } from '../src/app/lib/dashboard-totals-match';

const row = (kind: string, net: number) => ({kind, net, tax:0, gross:net, count:1, draft:false, currency:'USD', selected:true, trend:true, month:'2026-09'});
const point = {fromDate:'2026-09-01',toDate:'2026-09-30',dataAvailability:{hasActivity:true}};
const summary = () => ({
  org:{id:visualOrgId,name:'Synthetic Company',country:'US',baseCurrency:'USD'},
  period:{key:'fiscal_ytd',fromDate:'2026-01-01',toDate:'2026-09-30',source:'ledger'},
  dataAvailability:{hasActivity:true},unavailableMetrics:[],
  postingCoverage:{basis:'document_journal_links',status:'no_missing_links',unlinkedCount:0,groups:[]},
  savedActivity:{basis:'saved_documents',includesDrafts:true,rows:[row('invoice',1000),row('credit-note',100),row('bill',150),row('expense',60),row('supplier-credit',10)]},
  kpi:{revenue:900,expenses:200,netIncome:700,purchases:150,receipts:900,payments:200,vatNet:0,contactCount:2,overdueCount:0},
  monthlyTrend:[{month:'سبتمبر',...point,revenue:900,expenses:200}],
  profitLoss:[{month:'سبتمبر',...point,revenue:900,expenses:200,net:700}],
  cashFlowTrend:[],expenseBreakdown:[],incomeBreakdown:[],overdueInvoices:[],bankAccounts:[],
  periodCompare:{thisMonth:{},lastMonth:{},yearAgo:{}},
});

test('matching requires equal net sales and costs, posted links, no drafts and a comparable currency', () => {
  const data = summary();
  const matches = (value: unknown) => dashboardTotalsMatch(value as Parameters<typeof dashboardTotalsMatch>[0]);
  expect(matches(data)).toBe(true); // includes both purchase sources and their credit notes, once
  expect(matches({...data,kpi:{...data.kpi,revenue:900.01}})).toBe(false);
  expect(matches({...data,postingCoverage:{...data.postingCoverage,unlinkedCount:1}})).toBe(false);
  expect(matches({...data,postingCoverage:undefined})).toBe(false);
  expect(matches({...data,savedActivity:{...data.savedActivity,rows:[...data.savedActivity.rows,{...row('invoice',0),draft:true}]}})).toBe(false);
  expect(matches({...data,savedActivity:{...data.savedActivity,rows:[...data.savedActivity.rows,{...row('invoice',10),currency:'SAR'}]}})).toBe(false);
  expect(matches({...data,unavailableMetrics:['expenses']})).toBe(false);
  expect(matches({...data,savedActivity:{...data.savedActivity,rows:[]}})).toBe(false);
});

for (const language of ['ar','en'] as const) for (const width of [390,1440]) test(`compact dashboard controls and shared figures ${language} ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
  await prepareVisualApp(page,language);
  await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:summary()}));
  await page.goto('/app');
  const saved=page.getByRole('button',{name:language==='ar'?'المستندات المحفوظة':'Saved documents',exact:true});
  const ledger=page.getByRole('button',{name:language==='ar'?'الدفاتر المعتمدة':'Posted books',exact:true});
  await expect(saved).toBeVisible();
  const a=await saved.boundingBox(),b=await ledger.boundingBox();
  expect(Math.abs(a!.y-b!.y)).toBeLessThan(1);
  expect(a!.height).toBeLessThanOrEqual(28);
  const period=await page.getByLabel(language==='ar'?'فترة الحركات':'Activity period',{exact:true}).boundingBox();
  expect(period!.height).toBeLessThanOrEqual(28);
  const match=page.getByTestId('dashboard-match');
  await expect(match).toContainText(language==='ar'?'إجماليات الفترة متطابقة':'Period totals match');
  const savedFigure=page.getByTestId('saved-invoice').locator('[dir="ltr"]');
  const font=await savedFigure.evaluate(el=>getComputedStyle(el).fontFamily);
  await expect(page.getByTestId('saved-invoice')).toContainText('1,000.00');
  const savedChartHeight=await page.getByTestId('saved-monthly').locator('.recharts-wrapper').evaluate(el=>el.clientHeight);
  await page.screenshot({path:`/tmp/entix-compact-saved-${language}-${width}.png`});
  await ledger.click();
  await expect(page.getByTestId('flow-kpis').locator('[dir="ltr"]').first()).toHaveCSS('font-family',font);
  const ledgerChartHeight=await page.getByTestId('flow-profit-loss').locator('.recharts-wrapper').evaluate(el=>el.clientHeight);
  expect(savedChartHeight).toBe(ledgerChartHeight);
  await page.screenshot({path:`/tmp/entix-compact-ledger-${language}-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
