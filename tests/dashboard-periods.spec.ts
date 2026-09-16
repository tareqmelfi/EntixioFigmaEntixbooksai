import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { historicalFixture } from './historical-statements.contract';

const org={id:visualOrgId,name:'Synthetic Company',country:'US',baseCurrency:'USD',crNumber:'SYNTHETIC-001',fiscalYearStart:4,fiscalYearEnd:3};
const availability={source:'ledger',postedPnlLineCount:3,postedDocsCount:0,sourceActivityCount:3,hasActivity:true,coverage:'unknown'};
const dates:Record<string,[string|null,string]>={fiscal_ytd:['2026-04-01','2026-09-16'],previous_fiscal_year:['2025-04-01','2026-03-31'],month:['2026-09-01','2026-09-16'],previous_month:['2026-08-01','2026-08-31'],all_time:[null,'2026-09-16']};
const balance={currency:'USD',total:750,count:3,overdue:250,dueToday:100,notDue:400,noDueDate:0,byIssueYear:[{year:2023,total:250,count:1,overdue:250,dueToday:0,notDue:0,noDueDate:0},{year:2026,total:500,count:2,overdue:0,dueToday:100,notDue:400,noDueDate:0}],byCurrency:[{currency:'USD',total:750,count:3,overdue:250,dueToday:100,notDue:400,noDueDate:0},{currency:'EUR',total:70,count:1,overdue:70,dueToday:0,notDue:0,noDueDate:0}],unallocatedCredits:[{currency:'USD',amount:25,count:1}]};
function summary(key='fiscal_ytd') {
  const [fromDate,toDate]=dates[key];
  const period={key,from:fromDate?`${fromDate}T00:00:00Z`:null,to:`${toDate}T23:59:59.999Z`,fromDate,toDate,timeZone:'America/New_York',fiscalYearStart:4,isPartial:key==='fiscal_ytd'||key==='month',source:'ledger',basis:'accounting_date'};
  const revenue=key==='previous_fiscal_year'?1200:key==='month'?300:900;
  const point={from:'2026-04-01T00:00:00Z',to:'2026-09-16T23:59:59Z',fromDate:'2026-04-01',toDate:'2026-09-16',source:'ledger',dataAvailability:availability,unavailableMetrics:[]};
  return {org,period,dataAvailability:availability,limitations:[],unavailableMetrics:[],kpi:{revenue,purchases:0,expenses:200,netIncome:revenue-200,receipts:400,payments:100,vatOutput:45,vatInput:15,vatNet:30,invoiceCount:3,overdueCount:2,contactCount:4,accountsReceivable:750,accountsPayable:750,cashOnHand:500},monthlyTrend:[{month:'2026-09',revenue,expenses:200,...point}],yearlyTrend:[{year:2026,revenue,expenses:200,net:revenue-200,...point}],profitLoss:[{month:'2026-09',revenue,expenses:200,net:revenue-200,...point}],cashFlowTrend:[{month:'2026-09',in:400,out:100,net:300,...point}],expenseBreakdown:[{category:'Operating expenses',total:200,...point}],incomeBreakdown:[{category:'Service income',code:'4000',total:revenue,...point}],receivables:balance,payables:balance,currentTotalsScope:{basis:'current_open_balances',asOf:'2026-09-16T12:00:00Z',asOfDate:'2026-09-16',timeZone:'America/New_York',independentOfSelectedPeriod:true,issueYearBasis:'invoice_issue_date'},cash:{baseCurrency:'USD',baseCurrencyTotal:500,byCurrency:[{currency:'USD',balance:500,count:1},{currency:'EUR',balance:100,count:1}],asOf:'2026-09-16T12:00:00Z',scope:'all_active_current_bank_balances'},bankAccounts:[{id:'bank-usd',name:'USD bank',bankName:null,accountNumber:null,currency:'USD',balance:500},{id:'bank-eur',name:'EUR bank',bankName:null,accountNumber:null,currency:'EUR',balance:100}],overdueInvoices:[{id:'old-partial',number:'INV-2023',contact:'Synthetic customer',total:1000,remaining:250,dueDate:'2023-12-31',daysOverdue:990,currency:'USD'}],overdueBills:[{id:'bill-partial',number:'BILL-2023',contact:'Synthetic supplier',total:1000,remaining:250,dueDate:'2023-12-31',daysOverdue:990,currency:'USD'}],periodCompare:{thisMonth:{revenue:300,expenses:80,net:220,from:'2026-09-01T00:00:00Z',to:'2026-09-16T23:59:59Z',fromDate:'2026-09-01',toDate:'2026-09-16',dataAvailability:availability},lastMonth:{revenue:200,expenses:70,net:130,from:'2026-08-01T00:00:00Z',to:'2026-08-16T23:59:59Z',fromDate:'2026-08-01',toDate:'2026-08-16',dataAvailability:availability},yearAgo:{revenue:100,expenses:50,net:50,from:'2025-09-01T00:00:00Z',to:'2025-09-16T23:59:59Z',fromDate:'2025-09-01',toDate:'2025-09-16',dataAvailability:availability}},comparison:{basis:'matched_month_to_date',comparable:true,lastMonthComparable:true,yearAgoComparable:true,reason:null}};
}
const record=(payload=historicalFixture)=>({id:'synthetic-history',scope:'unconsolidated',version:1,periodStart:'2022-01-01',periodEnd:'2022-12-31',sourceSha256:payload.source.sha256,contentSha256:'b'.repeat(64),createdAt:'2026-09-16T00:00:00Z',supersedesId:null,payload});
async function setup(page:Page,transform:(data:ReturnType<typeof summary>)=>unknown=data=>data) {
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
  await prepareVisualApp(page,'ar');
  await page.addInitScript(()=>{localStorage.setItem('entix-numbering-system','arab');localStorage.setItem('entix-report-view-mode','summary');});
  const calls:string[]=[];
  await page.route('https://api.entix.io/api/dashboard/summary**',route=>{const key=new URL(route.request().url()).searchParams.get('period')||'fiscal_ytd';calls.push(key);return route.fulfill({json:transform(summary(key))});});
  await page.route('https://api.entix.io/me',route=>route.fulfill({json:{locale:'ar',selectedOrgId:visualOrgId,defaultOrgId:visualOrgId,memberships:[{org,role:'OWNER'}]}}));
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:record()}}));
  await page.goto('/app?__qa_auth=1');
  await expect(page.getByTestId('flow-period')).toBeVisible();
  return calls;
}

test('period selector changes flow and exact report dates; all-year partial balances remain unchanged; history is last and collapsed',async({page})=>{
  const calls=await setup(page);
  const select=page.getByLabel('فترة الحركات',{exact:true});
  await expect(select).toHaveValue('fiscal_ytd');
  await expect(page.getByTestId('flow-dates')).toContainText('من 2026-04-01 إلى 2026-09-16');
  await expect(page.getByTestId('current-receivables')).toContainText('750.00 USD');
  await expect(page.getByTestId('current-receivables')).toContainText('2023');
  await expect(page.getByTestId('overdue-followup')).toContainText('250.00 USD');
  await expect(page.getByTestId('overdue-followup')).not.toContainText('1,000.00');
  for(const key of ['month','previous_month','previous_fiscal_year','all_time']) {
    await select.selectOption(key);
    await expect(select).toHaveValue(key);
    await expect(page.getByTestId('flow-dates')).toContainText(dates[key][1]);
    await expect(page.getByTestId('current-receivables')).toContainText('750.00 USD');
    await expect(page.getByTestId('current-payables')).toContainText('750.00 USD');
  }
  expect(calls).toEqual(['fiscal_ytd','month','previous_month','previous_fiscal_year','all_time']);
  await page.getByTestId('dashboard-details').locator('summary').click();
  await expect(page.getByRole('link',{name:'قائمة دخل الفترة',exact:true})).toHaveAttribute('href','/app/reports/income-statement?to=2026-09-16&allTime=1');
  const card=page.getByTestId('historical-summary');
  await expect(card.getByRole('button',{name:'توسيع الملخص'})).toHaveAttribute('aria-expanded','false');
  await expect(card.locator('dl')).toHaveCount(0);
  expect(await card.evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('[data-testid="current-cash"]')!)&Node.DOCUMENT_POSITION_PRECEDING))).toBe(true);
  await expect(page.getByTestId('current-cash')).toContainText('500.00 USD');
  await expect(page.getByTestId('current-cash')).toContainText('100.00 EUR');
  await expect(page.getByTestId('current-cash')).not.toContainText('600.00 USD');
  await expect(page.getByTestId('current-cash')).not.toContainText('4%');
  await expect(page.locator('body')).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
});

test('empty current books show dashes, never imply actual financial zero or artificial growth',async({page})=>{
  await setup(page,data=>({...data,dataAvailability:{...availability,hasActivity:false,sourceActivityCount:0},comparison:{...data.comparison,comparable:false,lastMonthComparable:false,yearAgoComparable:false}}));
  await expect(page.getByTestId('flow-kpis')).toContainText('لا توجد بيانات مسجلة للفترة');
  await expect(page.getByTestId('flow-kpis')).not.toContainText('900.00');
  await expect(page.getByTestId('period-comparison')).toContainText('لا تتوفر فترات');
  await expect(page.getByTestId('period-comparison')).not.toContainText('0%');
});

test('foreign-currency unavailable movement is suppressed; unsupported comparisons never show growth',async({page})=>{
  await setup(page,data=>({...data,unavailableMetrics:['revenue','expenses','netIncome','purchases','receipts','payments','vatNet'],limitations:[{code:'foreign_currency',messageAr:'توجد مبالغ بعملة أجنبية دون تحويل.',messageEn:'Foreign currency amounts have no conversion.'}],comparison:{...data.comparison,comparable:false,lastMonthComparable:false,yearAgoComparable:false}}));
  await expect(page.getByTestId('flow-kpis')).not.toContainText('900.00');
  await expect(page.getByTestId('flow-kpis')).toContainText('غير متاح');
  // Independent trend remains visible when its own point is convertible.
  await expect(page.getByTestId('flow-profit-loss').locator('.recharts-wrapper')).toHaveCount(1);
  await expect(page.getByTestId('period-comparison')).not.toContainText('%');
});

test('matched comparisons use exact ranges, never invented percentage when previous value is zero',async({page})=>{
  await setup(page,data=>({...data,periodCompare:{...data.periodCompare,lastMonth:{...data.periodCompare.lastMonth,revenue:0}},comparison:{...data.comparison,yearAgoComparable:false}}));
  await page.getByTestId('dashboard-details').locator('summary').click();
  const comparison=page.getByTestId('comparison-details');
  await expect(comparison).toContainText('2026-08-01 — 2026-08-16');
  await expect(comparison).not.toContainText('2025-09-01');
  await expect(comparison.locator('tr').filter({hasText:'الإيرادات'})).not.toContainText('%');
});

test('COA older-page append keeps complete final balance and total; all entries posted scope',async({page})=>{
  await setup(page);
  await page.route('https://api.entix.io/api/accounts',route=>route.fulfill({json:{items:[{id:'synthetic-account',orgId:visualOrgId,code:'1010',name:'Bank',nameAr:'بنك',type:'ASSET',balance:600,isActive:true}],total:1}}));
  const calls:string[]=[];
  await page.route('https://api.entix.io/api/accounts/synthetic-account/transactions**',route=>{const cursor=new URL(route.request().url()).searchParams.get('cursor');calls.push(cursor||'first');return route.fulfill({json:{account:{id:'synthetic-account',code:'1010',name:'Bank',nameAr:'بنك',type:'ASSET'},transactions:[{id:cursor?'old':'new',journalNumber:cursor?'JE-2022':'JE-2026',date:cursor?'2022-12-31':'2026-09-16',description:'Synthetic entry',lineDescription:null,source:null,reference:null,debit:300,credit:0,runningBalance:cursor?300:600}],total:2,returned:1,finalBalance:600,openingBalance:cursor?0:300,nextCursor:cursor?null:'new',balanceScope:'all_posted_dates'}});});
  await page.goto('/app/chart-of-accounts?account=synthetic-account&__qa_auth=1');
  await expect(page.getByText('كل القيود المرحلة',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'تحميل الحركات الأقدم',exact:true}).click();
  await expect(page.getByText('JE-2022',{exact:true})).toBeVisible();
  await expect(page.getByText('JE-2026',{exact:true})).toBeVisible();
  await expect(page.getByText('الرصيد: 600.00',{exact:false})).toBeVisible();
  expect(calls).toEqual(['first','new']);
});

async function expandPreviewForFullPage(page:Page) {
  // Capture the complete nested scroll area; this style exists only in the isolated test tab.
  await page.evaluate(()=>{
    const scrolling=[...document.querySelectorAll<HTMLElement>('*')].filter(el=>el.scrollHeight>el.clientHeight+10&&/auto|scroll/.test(getComputedStyle(el).overflowY));
    for(const el of scrolling) {
      let current:HTMLElement|null=el;
      while(current) {current.style.height='auto';current.style.maxHeight='none';current.style.overflow='visible';current=current.parentElement;}
    }
  });
}

test('optional private full dashboard previews are local and never post to production',async({page})=>{
  test.skip(!process.env.ENTIX_PRIVATE_HISTORY_FILE,'Private source supplied locally only');
  const fs=await import('node:fs/promises');
  const payload=JSON.parse(await fs.readFile(process.env.ENTIX_PRIVATE_HISTORY_FILE!,'utf8'));
  const blankMonths=Array.from({length:6},(_,index)=>{
    const month=String(index+4).padStart(2,'0');
    const end=index===5?'2026-09-16':new Date(Date.UTC(2026,index+4,0)).toISOString().slice(0,10);
    return {month:`2026-${month}`,fromDate:`2026-${month}-01`,toDate:end,from:`2026-${month}-01T00:00:00Z`,to:`${end}T23:59:59.999Z`,source:'documents',dataAvailability:{...availability,hasActivity:false},revenue:0,expenses:0,net:0,in:0,out:0};
  });
  const privateOrg={...org,name:payload.entity.name,country:payload.entity.countryCode,baseCurrency:payload.entity.currency,crNumber:payload.entity.crNumber,fiscalYearStart:1,fiscalYearEnd:12};
  const emptyBalances={currency:payload.entity.currency,total:0,count:0,overdue:0,dueToday:0,notDue:0,noDueDate:0,byIssueYear:[],byCurrency:[],unallocatedCredits:[]};
  await setup(page,data=>({...data,org:privateOrg,kpi:{revenue:0,expenses:0,purchases:0,netIncome:0,receipts:0,payments:0,vatOutput:0,vatInput:0,vatNet:0,invoiceCount:0,overdueCount:0,contactCount:0,accountsReceivable:0,accountsPayable:0,cashOnHand:0},period:{...data.period,fromDate:'2026-01-01',from:'2026-01-01T00:00:00Z',source:'documents',fiscalYearStart:1},dataAvailability:{...availability,hasActivity:false,postedPnlLineCount:0,sourceActivityCount:0},monthlyTrend:blankMonths,yearlyTrend:[{...blankMonths[5],year:2026,fromDate:'2026-01-01'}],profitLoss:blankMonths,cashFlowTrend:blankMonths,expenseBreakdown:[],incomeBreakdown:[],receivables:emptyBalances,payables:emptyBalances,cash:{baseCurrency:payload.entity.currency,baseCurrencyTotal:0,byCurrency:[],asOf:data.currentTotalsScope.asOf,scope:"all_active_current_bank_balances"},bankAccounts:[],overdueInvoices:[],overdueBills:[],comparison:{...data.comparison,comparable:false,lastMonthComparable:false,yearAgoComparable:false}}));
  await page.route('https://api.entix.io/orgs',route=>route.fulfill({json:[privateOrg]}));
  await page.route('https://api.entix.io/me',route=>route.fulfill({json:{locale:'ar',selectedOrgId:visualOrgId,defaultOrgId:visualOrgId,memberships:[{org:privateOrg,role:'OWNER'}]}}));
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:record(payload)}}));
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST')writes.push(request.url());});
  await page.reload();
  await expect(page.getByTestId('historical-summary')).toContainText('2022');
  await page.evaluate(()=>{const banner=document.createElement('div');banner.textContent='معاينة محلية — القوائم القديمة من الملف؛ الدفاتر الحالية بلا بيانات متحققة — لم تُحفظ في الإنتاج';banner.style.cssText='padding:12px;background:#fff3cd;color:#664d03;text-align:center;position:relative;z-index:999';document.body.prepend(banner);});
  await expandPreviewForFullPage(page);
  await page.screenshot({path:'/tmp/entix-five-colors-ui-20260916/historical-five-colors-dashboard-V05.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByTestId('flow-period')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/entix-five-colors-ui-20260916/historical-five-colors-dashboard-mobile-V05.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1200});
  await page.getByTestId('historical-summary').getByRole('button',{name:'توسيع الملخص'}).click();
  const latest=payload.periods.find((p:any)=>p.id==='2022');
  for(const key of ['revenue','netProfit','cash','totalAssets']) await expect(page.getByTestId('historical-summary')).toContainText(latest.metrics[key].value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));
  await page.getByRole('button',{name:'عرض القوائم التاريخية',exact:true}).click();
  await expect(page.getByText(payload.source.fileName,{exact:true})).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
  await expandPreviewForFullPage(page);
  await page.screenshot({path:'/tmp/entix-five-colors-ui-20260916/historical-five-colors-saved-preview-V05.png',fullPage:true});
  expect(writes).toEqual([]);
});

test('report all-time link preserves scope, missing values, full detail default and refresh',async({page})=>{
  await setup(page);
  const calls:string[]=[];
  await page.route('https://api.entix.io/api/reports/income-statement**',route=>{
    calls.push(route.request().url());
    return route.fulfill({json:{id:'income-statement',title:'قائمة الدخل',englishTitle:'Income statement',description:'Synthetic report',category:'financial',status:'empty',generatedAt:'2026-09-16T12:00:00Z',period:{from:null,to:'2026-09-16',allTime:true},dataBasis:{source:'ledger',status:'no_activity',dateBasis:'period',from:null,to:'2026-09-16',postedEntriesOnly:true},currency:'USD',org,summary:{},notices:['لا توجد قيود دخل مرحلة.'],sections:[{id:'income-summary',title:'Summary',columns:[{key:'amount',label:'Amount',kind:'money'}],rows:[{id:'revenue',label:'Revenue',values:{amount:null}}]},{id:'income-detail',title:'Synthetic full detail',columns:[{key:'amount',label:'Amount',kind:'money'}],rows:[{id:'detail',label:'No recorded amount',values:{amount:null}}]}]}});
  });
  await page.getByLabel('فترة الحركات',{exact:true}).selectOption('all_time');
  await page.getByTestId('dashboard-details').locator('summary').click();
  await page.getByRole('link',{name:'قائمة دخل الفترة',exact:true}).click();
  await expect(page.getByText('Synthetic full detail',{exact:true})).toBeVisible();
  await expect(page.getByText('لا توجد بيانات مسجلة للفترة',{exact:true})).toBeVisible();
  await expect(page.locator('.entix-report-paper')).not.toContainText('0.00');
  await expect(page.locator('.entix-report-paper')).not.toContainText('1970');
  expect(calls[0]).toContain('allTime=1');
  expect(new URL(calls[0]).searchParams.has('from')).toBe(false);
  await page.getByRole('button',{name:'تحديث',exact:true}).click();
  await expect.poll(()=>calls.length).toBe(2);
});

test('deployed dashboard geometry stays in order and purchases never count twice',async({page})=>{
  await setup(page,data=>({...data,kpi:{...data.kpi,revenue:900,expenses:200,purchases:150,netIncome:undefined}}));
  const figures=page.getByTestId('flow-kpis');
  await expect(figures).toContainText('900.00');
  await expect(figures).toContainText('200.00');
  await expect(figures).toContainText('700.00');
  await expect(figures).not.toContainText('350.00');
  await expect(figures).not.toContainText('550.00');
  const pl=await page.getByTestId('flow-profit-loss').boundingBox();
  const followup=await page.getByTestId('current-followup').boundingBox();
  expect(Math.abs(pl!.y-followup!.y)).toBeLessThan(3);
  expect(pl!.width/followup!.width).toBeGreaterThan(1.9);
  const primary=await page.getByTestId('dashboard-primary-row').boundingBox();
  const charts=await page.getByTestId('dashboard-charts-row').boundingBox();
  const balances=await page.getByTestId('dashboard-balances-row').boundingBox();
  expect(primary!.y).toBeLessThan(charts!.y);expect(charts!.y).toBeLessThan(balances!.y);
  await expect(page.getByTestId('dashboard-details')).not.toHaveAttribute('open');
  const firstCardTitles=await page.getByTestId('dashboard-charts-row').locator('h2').allTextContents();
  expect(firstCardTitles).toEqual(['تفصيل الإيرادات','الإيرادات مقابل المصروفات','التدفق النقدي','تصنيف المصروفات']);
});

test('foreign in/out point aliases suppress cash chart values independently of current KPIs',async({page})=>{
  await setup(page,data=>({...data,cashFlowTrend:data.cashFlowTrend.map(point=>({...point,unavailableMetrics:['in','out','net']}))}));
  const cashCard=page.getByTestId('dashboard-charts-row').locator('[data-slot=card]').filter({has:page.getByRole('heading',{name:'التدفق النقدي',exact:true})});
  await expect(cashCard.locator('.recharts-wrapper')).toHaveCount(0);
  await expect(page.getByTestId('flow-kpis')).toContainText('900.00');
});

const noLedgerTrend=(data:ReturnType<typeof summary>)=>({...data,dataAvailability:{...availability,hasActivity:false},profitLoss:data.profitLoss.map(row=>({...row,dataAvailability:{...availability,hasActivity:false}})),yearlyTrend:data.yearlyTrend.map(row=>({...row,dataAvailability:{...availability,hasActivity:false}}))});

test('saved historical periods appear directly without mixing with empty current books or splitting long periods',async({page})=>{
  await setup(page,noLedgerTrend);
  const source=structuredClone(historicalFixture);
  source.periods[1].startDate='2020-09-06';source.periods[1].endDate='2021-12-31';
  source.periods[1].metrics.revenue={value:110,pdfPage:5,printedPage:'2',status:'verified'};
  source.periods[1].metrics.netProfit={value:15,pdfPage:5,printedPage:'2',status:'verified'};
  const missing=structuredClone(source.periods[1]);missing.id='2023';missing.label='2023';missing.startDate='2023-01-01';missing.endDate='2023-12-31';
  for(const metric of Object.values(missing.metrics)){metric.value=null;metric.status='unavailable';}
  source.periods.push(missing);
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:record(source)}}));
  await page.reload();
  const card=page.getByTestId('flow-profit-loss');
  await expect(card.getByRole('button',{name:'القوائم السابقة',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('.recharts-wrapper')).toHaveCount(1);
  const values=page.getByTestId('historical-profit-values');
  await expect(values).toContainText('2020-09-06');await expect(values).toContainText('2021-12-31');
  await expect(values).toContainText('110.00');await expect(values).toContainText('15.00');
  await expect(values).toContainText('25.00');await expect(values.locator('tbody tr')).toHaveCount(2);
  await expect(card).toContainText('2023: غير متوفر');await expect(card).not.toContainText('%');
  await expect(page.getByTestId('flow-kpis')).toContainText('لا توجد بيانات مسجلة للفترة');
  await expect(page.getByTestId('flow-kpis')).not.toContainText('110.00');
  await card.getByRole('button',{name:'سنوات ميلادية',exact:true}).click();
  await expect(page.getByTestId('historical-profit-chart')).toHaveCount(0);
  await card.getByRole('button',{name:'القوائم السابقة',exact:true}).click();
  await card.getByRole('button',{name:'عرض القوائم ومصدر الأرقام',exact:true}).click();
  await expect(page.getByText(source.source.fileName,{exact:true})).toBeVisible();
});

test('historical chart excludes unreviewed or null values and keeps missing years explicit',async({page})=>{
  await setup(page,noLedgerTrend);
  const source=structuredClone(historicalFixture);
  source.periods[0].metrics.revenue.value=999;source.periods[0].metrics.revenue.status='needs_review';
  source.periods[0].metrics.netProfit.value=null;source.periods[0].metrics.netProfit.status='unavailable';
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:record(source)}}));
  await page.reload();
  await page.getByTestId('flow-profit-loss').getByRole('button',{name:'القوائم السابقة',exact:true}).click();
  const chart=page.getByTestId('historical-profit-chart');
  await expect(chart.locator('.recharts-wrapper')).toHaveCount(0);
  await expect(chart).toContainText('2022: يحتاج مراجعة');
  await expect(chart).not.toContainText('999');await expect(chart).not.toContainText('0.00');
  await expect(chart).not.toContainText(/[\u0660-\u0669\u06f0-\u06f9]/);
});

test('historical mode has an honest empty state when no reference is saved',async({page})=>{
  await setup(page,noLedgerTrend);
  await page.route('https://api.entix.io/api/historical-reports/latest**',route=>route.fulfill({json:{report:null}}));
  await page.reload();
  const card=page.getByTestId('flow-profit-loss');
  await card.getByRole('button',{name:'القوائم السابقة',exact:true}).click();
  await expect(page.getByTestId('historical-profit-chart')).toContainText('لا توجد قوائم سابقة محفوظة');
  await expect(card.locator('.recharts-wrapper')).toHaveCount(0);
});
