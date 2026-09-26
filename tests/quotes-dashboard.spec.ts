import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

const quote = (id: string, status: string, extra: Record<string,unknown> = {}) => ({ id,orgId:'org-visual-system',quoteNumber:`Q-${id}`,contactId:'client-a',contact:{id:'client-a',displayName:'Alpha · الأفق'},status,issueDate:'2026-09-01',validUntil:'2026-10-01',currency:'USD',total:'100',subtotal:'100',taxTotal:'0',discountTotal:'0',title:'Project scope · نطاق المشروع',...extra });
const rows = [
  quote('draft','DRAFT'),
  quote('late','SENT',{validUntil:'2026-09-20',contactId:'client-b',contact:{id:'client-b',displayName:'Beta'}}),
  quote('viewed','VIEWED'),
  quote('accepted','ACCEPTED',{validUntil:'2026-09-01',projectId:'project-1',projects:[{id:'project-1',code:'P-1',name:'Renovation',status:'ACTIVE',percentComplete:'45',endDate:'2026-10-10'}]}),
  quote('invoiced','CONVERTED',{validUntil:'2026-09-01',currency:'SAR',convertedInvoiceId:'invoice-1',convertedInvoice:{id:'invoice-1',invoiceNumber:'INV-1',status:'PAID'}}),
  quote('declined','REJECTED',{validUntil:'2026-09-01',contactId:'client-b',contact:{id:'client-b',displayName:'Beta'}}),
  quote('today','SENT',{validUntil:'2026-09-26'}),
  quote('old-draft','DRAFT',{validUntil:'2026-09-01',contactId:'draft-c',contact:{id:'draft-c',displayName:'Draft customer'}}),
];
async function prepare(page: Page, language: 'ar'|'en', failSecond=false) {
  await prepareVisualApp(page,language);
  await page.clock.setFixedTime(new Date('2026-09-26T12:00:00Z'));
  await page.route('**/api/quotes/overview**',route=>{
    const second = new URL(route.request().url()).searchParams.has('after');
    if(second && failSecond) return route.fulfill({status:500,json:{error:'failed'}});
    return route.fulfill({json:{items:second?rows.slice(4):rows.slice(0,4),nextCursor:second?null:'first-page'}});
  });
  await page.route('**/api/quotes/draft',r=>r.fulfill({json:{...rows[0],lines:[]}}));
}
for(const lang of ['ar','en'] as const) test(`quote dashboard shows complete lifecycle and independent currencies (${lang})`,async({page})=>{
  await prepare(page,lang);await page.setViewportSize({width:1440,height:1000});await page.goto('/app/quotes');
  await expect(page.getByTestId('quote-metric-ALL')).toContainText('8');
  await expect(page.getByTestId('quote-metric-WAITING')).toContainText('2');
  await expect(page.getByTestId('quote-metric-EXPIRED')).toContainText('2');
  await expect(page.getByTestId('quote-currency-totals')).toContainText('700.00 USD');
  await expect(page.getByTestId('quote-currency-totals')).toContainText('100.00 SAR');
  await expect(page.getByTestId('quote-clients-accepted')).toContainText('Alpha');
  await expect(page.getByTestId('quote-clients-rejected')).toContainText('Beta');
  await expect(page.getByTestId('quote-clients-overdue')).toContainText('Beta');
  await expect(page.getByTestId('quote-clients-overdue')).not.toContainText('Draft customer');
  await expect(page.getByTestId('quote-date-late')).toHaveClass(/text-danger/);
  await expect(page.getByTestId('quote-date-accepted')).toHaveClass(/text-warning/);
  await expect(page.getByTestId('quote-date-invoiced')).not.toHaveClass(/text-danger/);
  await expect(page.getByTestId('quote-row-accepted').getByRole('link',{name:/P-1/})).toHaveAttribute('href','/app/projects/project-1');
  await expect(page.getByTestId('quote-group-converted').getByRole('link',{name:'INV-1'})).toHaveAttribute('href','/app/invoices/invoice-1');
  await page.screenshot({path:`/tmp/entix-quotes-dashboard-${lang}.png`,fullPage:true});
  await page.getByTestId('quote-metric-WAITING').click();
  await expect(page.getByTestId('quote-row-viewed')).toBeVisible();await expect(page.getByTestId('quote-row-today')).toBeVisible();await expect(page.getByTestId('quote-row-late')).toHaveCount(0);
  await page.getByTestId('quote-metric-CONVERTED').click();await expect(page.getByTestId('quote-row-invoiced')).toBeVisible();
  await page.getByTestId('quote-metric-ALL').click();await page.getByRole('link',{name:/Q-draft/}).click();await expect(page).toHaveURL(/\/app\/quotes\/draft$/);
  await expect(page.getByTestId('quote-detail-edit')).toBeVisible();
});
test('dashboard date/customer/search filters and mobile fit',async({page})=>{
  await prepare(page,'en');await page.setViewportSize({width:390,height:844});await page.goto('/app/quotes');
  await expect(page.getByTestId('quote-metric-ALL')).toContainText('8');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'/tmp/entix-quotes-dashboard-phone.png',fullPage:true});
  await page.getByTestId('quote-clients-rejected').getByRole('button',{name:/Beta/}).click();await expect(page.getByTestId('quote-row-declined')).toBeVisible();await expect(page.getByTestId('quote-row-late')).toHaveCount(0);
  await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Search quotes',{exact:true}).fill('q-invoiced');await expect(page.getByTestId('quote-row-invoiced')).toBeVisible();await expect(page.getByTestId('quote-row-accepted')).toHaveCount(0);
  await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Quote issue date · from').fill('2026-09-02');await expect(page.getByTestId('quote-metric-ALL')).toContainText('0');
});
test('failed subsequent page does not publish partial metrics',async({page})=>{
  await prepare(page,'en',true);await page.goto('/app/quotes');
  await expect(page.getByRole('alert').filter({hasText:'Could not load all quotes'})).toBeVisible();await expect(page.getByTestId('quote-metric-ALL')).toHaveCount(0);
});
test('more than 200 quotes remain counted and older converted quote remains accessible',async({page})=>{
  await prepareVisualApp(page,'en');
  await page.route('**/api/quotes/overview**',r=>r.fulfill({json:new URL(r.request().url()).searchParams.has('after') ? {items:[rows[4]],nextCursor:null} : {items:Array.from({length:200},(_,i)=>quote(`bulk-${i}`,'DRAFT')),nextCursor:'bulk-199'}}));
  await page.goto('/app/quotes');await expect(page.getByTestId('quote-metric-ALL')).toContainText('201');await expect(page.getByTestId('quote-row-invoiced')).toBeVisible();
});
