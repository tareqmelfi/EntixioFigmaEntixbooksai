import { expect, test } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

test('batch recovery paginates, preserves partial failures and cannot retry an uncertain posting without preview',async({page})=>{
  await prepareVisualApp(page,'en');
  await page.route('**/api/dashboard/summary**',route=>route.fulfill({json:{
    org:{id:visualOrgId,baseCurrency:'USD'},period:{fromDate:'2026-01-01',toDate:'2026-10-03',source:'ledger'},
    kpi:{revenue:0,expenses:0,netIncome:0},postingCoverage:{unlinkedCount:3,groups:[]},monthlyTrend:[],profitLoss:[],cashFlowTrend:[],expenseBreakdown:[],incomeBreakdown:[],bankAccounts:[],overdueInvoices:[],periodCompare:{thisMonth:{},lastMonth:{},yearAgo:{}}
  }}));
  const item=(id:string)=>({id,kind:'invoice',number:id,date:'2026-01-01',currency:'USD',total:100,status:'PAID'});
  const approvals:string[]=[],pages:string[]=[];
  await page.route('**/api/posting-review**',async route=>{
    const url=new URL(route.request().url()),parts=url.pathname.split('/'),id=parts[4];
    if(parts.length===3){pages.push(url.searchParams.get('offset')||'0');return route.fulfill({json:{total:3,items:url.searchParams.get('offset')==='2'?[item('C')]:[item('A'),item('B')]}})}
    if(parts[5]==='preview'){
      if(id==='B')return route.fulfill({status:409,json:{error:'existing_journal_review',message:'Existing journal needs reconciliation'}});
      return route.fulfill({json:{reviewToken:`signed-${id}`,currency:'USD',lines:[{accountCode:'1100',accountName:'Accounts receivable',debit:100,credit:0},{accountCode:'4000',accountName:'Sales',debit:0,credit:100}]}});
    }
    approvals.push(id);
    expect(route.request().postDataJSON()).toEqual({reviewToken:`signed-${id}`,confirmedNoPriorPosting:true});
    expect(route.request().headers()['x-org-id']).toBe(visualOrgId);
    if(id==='C')return route.fulfill({status:409,json:{error:'review_changed',message:'Document changed; preview again'}});
    return route.fulfill({json:{ok:true,journalId:`journal-${id}`}});
  });
  await page.goto('/app');
  await page.getByRole('button',{name:'Review and approve',exact:true}).click();
  await page.getByRole('button',{name:'Batch review all documents',exact:true}).click();
  const panel=page.getByRole('region',{name:'Batch posting review'});
  await panel.getByRole('button',{name:'Preview all documents',exact:true}).click();
  await expect(panel.getByRole('status')).toContainText('Ready to review: 2');
  expect(pages).toContain('2');
  await expect(panel.getByText('Existing journal needs reconciliation')).toBeVisible();
  await expect(panel.getByRole('checkbox',{name:'Select B',exact:true})).toBeDisabled();
  await panel.getByRole('checkbox',{name:'Select all ready journals',exact:true}).check();
  await expect(panel.getByRole('button',{name:'Post selected journals (2)',exact:true})).toBeDisabled();
  await panel.getByRole('checkbox',{name:'I reviewed the selected journals',exact:false}).check();
  await panel.getByRole('button',{name:'Post selected journals (2)',exact:true}).click();
  await expect(panel.getByRole('status')).toContainText('Posted: 1');
  await expect(panel.getByText('Document changed; preview again')).toBeVisible();
  await expect(panel.getByText('Posted · journal-A')).toBeVisible();
  await expect(panel.getByRole('checkbox',{name:'Select C',exact:true})).toBeDisabled();
  await expect(panel.getByRole('button',{name:/Post selected journals/})).toHaveCount(0);
  expect(approvals).toEqual(['A','C']);
});

test('leaving a batch during preview stops subsequent work and never posts',async({page})=>{
  await prepareVisualApp(page,'en');
  await page.route('**/api/dashboard/summary**',route=>route.fulfill({json:{org:{id:visualOrgId,baseCurrency:'USD'},kpi:{},period:{source:'ledger'},postingCoverage:{unlinkedCount:2,groups:[]},profitLoss:[],monthlyTrend:[],cashFlowTrend:[],expenseBreakdown:[],incomeBreakdown:[],bankAccounts:[],overdueInvoices:[],periodCompare:{thisMonth:{},lastMonth:{},yearAgo:{}}}}));
  let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let previews=0,posts=0;
  await page.route('**/api/posting-review**',async route=>{
    if(route.request().url().includes('/preview')){previews++;await held;return route.fulfill({json:{reviewToken:'signed',currency:'USD',lines:[]}})}
    if(route.request().url().includes('/approve')){posts++;return route.fulfill({json:{ok:true,journalId:'unexpected'}})}
    return route.fulfill({json:{total:2,items:['A','B'].map(id=>({id,kind:'invoice',number:id,date:'2026-01-01',total:100,currency:'USD',status:'PAID'}))}});
  });
  await page.goto('/app');await page.getByRole('button',{name:'Review and approve',exact:true}).click();await page.getByRole('button',{name:'Batch review all documents',exact:true}).click();await page.getByRole('button',{name:'Preview all documents',exact:true}).click();
  await expect.poll(()=>previews).toBe(1);
  await page.getByRole('button',{name:'Close review',exact:true}).click();release();
  await expect(page.getByRole('region',{name:'Batch posting review'})).toHaveCount(0);
  await page.getByRole('button',{name:'Review and approve',exact:true}).click();
  await expect(page.getByRole('button',{name:'Batch review all documents',exact:true})).toBeVisible();
  expect(previews).toBe(1);expect(posts).toBe(0);
});
