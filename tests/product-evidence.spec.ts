import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import fs from 'node:fs/promises';

// Real application screens with synthetic data; never uses a customer's account.
for (const language of ['ar', 'en'] as const) {
  test(`capture product evidence (${language})`, async ({ page }) => {
    await prepareVisualApp(page, language);
    await page.clock.setFixedTime(new Date('2026-09-26T12:00:00Z'));
    await page.setViewportSize({ width: 1440, height: 1040 });
    const org = { id: visualOrgId, name: 'مساحة تجريبية · Demo workspace', country: 'US', baseCurrency: 'USD', fiscalYearStart: 1, fiscalYearEnd: 12 };
    await page.route('**/me', r => r.fulfill({ json: { locale: language, selectedOrgId: visualOrgId, defaultOrgId: visualOrgId, memberships: [{ role: 'OWNER', org }] } }));
    await page.route('**/orgs', r => r.fulfill({ json: [org] }));
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'demo', name: 'Demo', email: 'demo@example.test', createdAt: '2026-01-01T00:00:00Z' } } }));
    const clients = ['استوديو الأفق · Horizon Studio', 'متجر النخيل · Palm Store', 'حلول الأعمال · Business Services'];
    const invoices = ['PAID', 'SENT', 'DRAFT', 'OVERDUE'].map((status, i) => ({ id: `invoice-${i}`, orgId: visualOrgId, contactId: `client-${i % 3}`, invoiceNumber: `INV-2026-00${i+1}`, status, issueDate: '2026-09-01', dueDate: '2026-09-20', currency: 'USD', subtotal: String(1200+i*500), total: String(1200+i*500), taxTotal: '0', amountPaid: status==='PAID'?'1200':'0', contact: { id: `client-${i%3}`, displayName: clients[i%3] } }));
    await page.route('**/api/invoices?*', r => r.fulfill({ json: { items: invoices, total: invoices.length } }));
    await page.route('**/api/invoices', r => r.fulfill({ json: { items: invoices, total: invoices.length } }));
    const quotes = ['SENT','ACCEPTED','CONVERTED','REJECTED','DRAFT'].map((status,i) => ({ id:`quote-${i}`,orgId:visualOrgId,quoteNumber:`Q-2026-00${i+1}`,contactId:`client-${i%3}`,contact:{id:`client-${i%3}`,displayName:clients[i%3]},status,issueDate:'2026-09-01',validUntil:i===0?'2026-09-20':'2026-10-15',currency:'USD',total:String(2400+i*800),subtotal:String(2400+i*800),taxTotal:'0',discountTotal:'0',title:'خدمات المشروع · Project services',...(status==='CONVERTED'?{convertedInvoiceId:'invoice-0',convertedInvoice:{id:'invoice-0',invoiceNumber:'INV-2026-001',status:'PAID'}}:{}) }));
    await page.route('**/api/quotes/overview**',r=>r.fulfill({json:{items:quotes,nextCursor:null}}));
    const projects = ['تصميم متجر · Store design','خدمات تسويقية · Marketing services','تجهيز المكتب · Office fit-out'].map((name,i)=>({id:`project-${i}`,code:`PRJ-00${i+1}`,name,status:i===2?'COMPLETED':'ACTIVE',startDate:'2026-09-01',endDate:'2026-10-15',percentComplete:[65,40,100][i],budget:12000,contractValue:18000}));
    await page.route('**/api/projects',r=>r.fulfill({json:{items:projects}}));
    const output=process.env.ENTIX_EVIDENCE_DIR || 'test-results/product-evidence';
    await fs.mkdir(output,{recursive:true});
    for (const [name,url,heading] of [['invoices','/app/invoices',/Sales Invoices|الفواتير/],['quotes','/app/quotes',/Quotes|عروض الأسعار/],['projects','/app/projects',/Projects|المشاريع/]] as const) {
      await page.goto(url); await expect(page.getByRole('heading',{level:1,name:heading})).toBeVisible();
      await expect(page.locator('main')).toContainText(name==='invoices'?'INV-2026-001':name==='quotes'?'Q-2026-001':'PRJ-001');
      await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.screenshot({path:`${output}/${name}-${language}.png`,animations:'disabled'});
    }
  });
}
