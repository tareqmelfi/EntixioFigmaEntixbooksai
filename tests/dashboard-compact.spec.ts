import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { dashboardTotalsMatch } from '../src/app/lib/dashboard-totals-match';

const row = (kind: string, net: number) => ({kind, net, tax:0, gross:net, count:1, draft:false, currency:'USD', selected:true, trend:true, month:'2026-09'});
const point = {fromDate:'2026-09-01',toDate:'2026-09-30',dataAvailability:{hasActivity:true}};
const balance = {currency:'USD',total:1250,count:3,overdue:250,dueToday:0,notDue:1000,noDueDate:0,byIssueYear:[],byCurrency:[],unallocatedCredits:[]};
const summary = () => ({
  receivables:balance,payables:{...balance,total:400,overdue:0},
  currentTotalsScope:{asOfDate:'2026-09-30'},
  cash:{baseCurrency:'USD',baseCurrencyTotal:3200,byCurrency:[],asOf:'2026-09-30'},
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

for (const country of ['US','SA']) for (const language of ['ar','en'] as const) for (const width of [390,1440]) test(`compact dashboard controls and shared figures ${country} ${language} ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
  await prepareVisualApp(page,language);
  const currency=country==='SA'?'SAR':'USD';
  const data=summary();
  await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:{...data,org:{...data.org,country,baseCurrency:currency},receivables:{...data.receivables,currency},payables:{...data.payables,currency},cash:{...data.cash,baseCurrency:currency},savedActivity:{...data.savedActivity,rows:data.savedActivity.rows.map(row=>({...row,currency}))}}}));
  await page.goto('/app');
  await expect(page.getByRole('group',{name:language==='ar'?'مصدر لوحة التحكم':'Dashboard basis'})).toHaveCount(0);
  await expect(page.getByTestId('dashboard-current-summary')).toBeVisible();
  await expect(page.getByTestId('overview-receivables')).toContainText(`1,250.00 ${currency}`);
  await expect(page.getByTestId('overview-payables')).toContainText(`400.00 ${currency}`);
  await expect(page.getByTestId('overview-cash')).toContainText(`3,200.00 ${currency}`);
  await expect(page.getByTestId('flow-kpis')).toBeVisible();
  await expect(page.getByTestId('dashboard-documents')).not.toHaveAttribute('open');
  await expect(page.getByTestId('dashboard-analysis')).not.toHaveAttribute('open');
  await expect(page.getByTestId('saved-register')).not.toBeVisible();
  await page.screenshot({path:`/tmp/entix-unified-${country}-${language}-${width}.png`});
  const disclosure=page.getByTestId('dashboard-documents').locator('summary').first();
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('saved-register')).toBeVisible();
  const period=await page.getByLabel(language==='ar'?'فترة الحركات':'Activity period',{exact:true}).boundingBox();
  expect(period!.height).toBeLessThanOrEqual(28);
  const match=page.getByTestId('dashboard-match');
  await expect(match).toContainText(language==='ar'?'إجماليات الفترة متطابقة':'Period totals match');
  const savedFigure=page.getByTestId('saved-invoice').locator('[dir="ltr"]');
  const font=await savedFigure.evaluate(el=>getComputedStyle(el).fontFamily);
  const currentFigure=page.getByTestId('overview-receivables').locator('[dir="ltr"]');
  await expect(currentFigure).toHaveCSS('font-family',font);
  await expect(currentFigure.getByRole('link')).toHaveCSS('font-family',font);
  await expect(currentFigure).toHaveCSS('font-size',await savedFigure.evaluate(el=>getComputedStyle(el).fontSize));
  await expect(page.getByTestId('overview-receivables')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.getByTestId('saved-invoice')).toContainText('1,000.00');
  const savedChartHeight=await page.getByTestId('saved-monthly').locator('.recharts-wrapper').evaluate(el=>el.clientHeight);
  await page.screenshot({path:`/tmp/entix-compact-saved-${country}-${language}-${width}.png`});
  await expect(page.getByTestId('flow-kpis').locator('[dir="ltr"]').first()).toHaveCSS('font-family',font);
  const ledgerChartHeight=await page.getByTestId('flow-profit-loss').locator('.recharts-wrapper').evaluate(el=>el.clientHeight);
  expect(ledgerChartHeight).toBeGreaterThan(savedChartHeight);
  await expect(page.getByTestId("cash-flow")).toBeVisible();
  await expect(page.getByTestId("expense-breakdown")).toBeVisible();
  const metricsBox=await page.getByTestId("dashboard-current-summary").boundingBox();
  const toolbarBox=await page.getByTestId("dashboard-toolbar").boundingBox();
  expect(toolbarBox!.y).toBeGreaterThanOrEqual(metricsBox!.y+metricsBox!.height);
  const chartsBox=await page.getByTestId("dashboard-charts-row").boundingBox();
  const followupBox=await page.getByTestId("current-followup").boundingBox();
  expect(followupBox!.y).toBeGreaterThanOrEqual(chartsBox!.y+chartsBox!.height);
  await page.screenshot({path:`/tmp/entix-compact-ledger-${country}-${language}-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for (const language of ['ar','en'] as const) test(`six figures wrap with available width and preserve signed amounts ${language}`,async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
  await prepareVisualApp(page,language);
  const data=summary();
  await page.route('https://api.entix.io/api/dashboard/summary**',route=>route.fulfill({json:{...data,cash:{...data.cash,baseCurrencyTotal:-3200},kpi:{...data.kpi,netIncome:-700,expenses:0},expenseBreakdown:[{category:'A long expense category that must wrap instead of overlapping another category',total:200},{category:'Refund adjustment',total:-20}],incomeBreakdown:[{category:'Long income category with full descriptive text that should remain readable',total:900}],cashFlowTrend:[{month:'Sep',...point,in:900,out:200}]}}));
  const ids=['overview-receivables','overview-payables','overview-cash','overview-revenue','overview-net','overview-expenses'];
  for(const width of [390,768,1440,1920,2560]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/app');
    await expect(page.getByTestId('overview-net')).toContainText('−700.00');
    const boxes=await Promise.all(ids.map(id=>page.getByTestId(id).boundingBox()));
    const rowCount=new Set(boxes.map(box=>Math.round(box!.y))).size;
    expect(rowCount).toBe(width>=1920?1:width===1440?2:3);
    const negative=page.getByTestId('overview-net').locator('[dir="ltr"]');
    const positive=page.getByTestId('overview-revenue').locator('[dir="ltr"]');
    await expect(negative).toHaveCSS('color','rgb(158, 59, 46)');
    await expect(positive).toHaveCSS('color','rgb(70, 97, 199)');
    await expect(negative.locator('small')).toHaveCSS('color',await negative.evaluate(el=>getComputedStyle(el).color));
    expect(await page.getByTestId('overview-expenses').locator('[dir="ltr"]').evaluate(el=>getComputedStyle(el).color)).not.toBe(await positive.evaluate(el=>getComputedStyle(el).color));
    await expect(page.getByTestId('expense-breakdown').getByText('Refund adjustment')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/tmp/entix-insights-${language}-${width}.png`,fullPage:true});
  }
});
