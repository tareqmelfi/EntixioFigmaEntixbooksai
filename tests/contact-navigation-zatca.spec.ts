import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { invoiceZatcaState } from '../src/app/lib/invoice-zatca-state';

const contact = { id: 'contact-nav', displayName: 'Navigation Supplier', type: 'BOTH', isCustomer: true, isSupplier: true, country: 'US' };
const doc = { id: 'doc-nav', contactId: contact.id, contact, status: 'PAID', invoiceNumber: 'INV-NAV', billNumber: 'BILL-NAV', noteNumber: 'CN-NAV', creditNumber: 'SC-NAV', number: 'V-NAV', issueDate: '2026-09-01', dueDate: '2026-09-30', date: '2026-09-01', validUntil: '2026-09-30', currency: 'USD', total: 20, subtotal: 20, taxTotal: 0, amountPaid: 20, amount: 20, reason: 'RETURN', paymentMethod: 'CASH', lines: [], paymentSplits: [] };
async function fixture(page: Page, locale: 'ar'|'en' = 'en', sa = false) {
  await prepareVisualApp(page, locale);
  if (sa) await page.route('https://api.entix.io/orgs', r => r.fulfill({json: [{id:visualOrgId,name:'Saudi fixture',country:'SA',baseCurrency:'SAR'}]}));
  await page.route('https://api.entix.io/api/**', r => {
    const p = new URL(r.request().url()).pathname;
    if (p === '/api/quotes/overview') return r.fulfill({json:{items:[{...doc,quoteNumber:'Q-NAV',status:'DRAFT'}],nextCursor:null}});
    if (p === '/api/contacts') return r.fulfill({json:{items:[contact],total:1}});
    if (p === '/api/contacts/contact-nav/summary') return r.fulfill({json:{contact,totals:{invoices:{count:0,total:0,paid:0,outstanding:0},bills:{count:0,total:0,paid:0,outstanding:0},quotes:{count:0,total:0},receipts:{count:0,total:0},payments:{count:0,total:0},arOpen:0,apOpen:0,balance:0},invoices:[],bills:[],quotes:[],vouchers:[],expenses:[]}});
    if (p === '/api/contacts/contact-nav') return r.fulfill({json:contact});
    if (/^\/api\/(bills|invoices|credit-notes|supplier-credits|vouchers|quotes)$/.test(p)) return r.fulfill({json:{items:[{...doc,quoteNumber:'Q-NAV', status:p.endsWith('quotes')?'DRAFT':doc.status}],total:1,summary:{sumAmount:'20',avgAmount:'20'}}});
    if (/\/doc-nav$/.test(p)) return r.fulfill({json:doc});
    if (p === '/api/bank-accounts') return r.fulfill({json:{items:[],total:0}});
    return r.fallback();
  });
}
for (const locale of ['ar','en'] as const) for (const width of [390,1280]) {
  test(`contact names open contact profiles across documents ${locale} ${width}`, async ({page}) => {
    await page.setViewportSize({width,height:950}); await fixture(page,locale);
    const writes:string[]=[];page.on('request',r=>{if(r.url().startsWith('https://api.entix.io/api/') && r.method()!=='GET' && r.method()!=='OPTIONS')writes.push(r.url());});
    for (const path of ['/app/purchases/bills','/app/invoices','/app/credit-notes','/app/purchases/supplier-credits','/app/receipts','/app/payments','/app/quotes']) {
      await page.goto(path);
      const link=page.locator('a:visible').filter({hasText:contact.displayName}).first();
      await expect(link, path).toHaveAttribute('href','/app/contacts/contact-nav');
      await link.click(); await expect(page).toHaveURL(/\/app\/contacts\/contact-nav$/);
      await expect(page.getByRole('heading',{name:contact.displayName,exact:true})).toBeVisible();
    }
    expect(writes).toEqual([]);
  });
}
test('locked purchase bill keeps supplier profile accessible', async ({page}) => {
  await fixture(page);await page.goto('/app/purchases/bills');
  await page.getByText('BILL-NAV',{exact:true}).click();await expect(page).toHaveURL(/bills\/doc-nav$/);
  const link=page.getByRole('link',{name:contact.displayName}).first();await expect(link).toBeVisible();await link.click();await expect(page).toHaveURL(/contacts\/contact-nav$/);
});
test('authority acceptance is distinct from local approval, test mode and queue failures', () => {
  expect(invoiceZatcaState({})).toBe('not_sent');
  expect(invoiceZatcaState({zatcaStatus:'APPROVED'})).toBe('unverified');
  expect(invoiceZatcaState({zatcaStatus:'CLEARED'})).toBe('unverified');
  for(const [state,result] of [['ACCEPTED','accepted'],['REVIEW','review'],['RETRY','uncertain'],['PENDING','pending'],['SENDING','sending'],['REJECTED','rejected']] as const)
    expect(invoiceZatcaState({zatcaDelivery:{state,message:null}})).toBe(result);
  const evidence={state:'CLEARED',mode:'production',kind:'STANDARD',uuid:'test',attempts:1,httpStatus:200,updatedAt:'2026-09-01',errors:[],warnings:[]};
  expect(invoiceZatcaState({zatcaDelivery:{state:'ACCEPTED',message:null,evidence}})).toBe('accepted');
  expect(invoiceZatcaState({zatcaDelivery:{state:'ACCEPTED',message:null,evidence:{...evidence,mode:'simulation'}}})).toBe('test');
  expect(invoiceZatcaState({zatcaDelivery:{state:'REVIEW',message:null,evidence:{...evidence,state:'PENDING'}}})).toBe('review');
});
test('Saudi invoice list and issued record expose missing submission and real acceptance; US stays regional',async({page})=>{
  await fixture(page,'en',true);
  await page.goto('/app/invoices');
  await expect(page.getByRole('region',{name:'Sales invoice ZATCA status'})).toContainText('Not submitted to ZATCA');
  await expect(page.locator('[data-zatca-state="not_sent"]:visible').first()).toBeVisible();
  await page.getByText('INV-NAV',{exact:true}).first().click();
  await expect(page.locator('[data-zatca-state="not_sent"]:visible')).toBeVisible();
  await expect(page.getByRole('link',{name:contact.displayName}).first()).toBeVisible();
  await page.route(/https:\/\/api\.entix\.io\/api\/invoices(?:\?|$)/,r=>r.fulfill({json:{items:[{...doc,zatcaDelivery:{state:'ACCEPTED',message:null}}],total:1}}));
  await page.goto('/app/invoices');
  await expect(page.getByRole('region',{name:'Sales invoice ZATCA status'})).toContainText('Accepted by ZATCA');
  await page.route('https://api.entix.io/orgs',r=>r.fulfill({json:[{id:visualOrgId,name:'US fixture',country:'US',baseCurrency:'USD'}]}));
  await page.reload();await expect(page.getByText('INV-NAV',{exact:true}).first()).toBeVisible();
  await expect(page.locator('[data-zatca-state]:visible')).toHaveCount(0);
});
