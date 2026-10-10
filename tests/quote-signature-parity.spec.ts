import { test, expect } from '@playwright/test';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';
import { renderDocument, sampleInput } from '../src/app/lib/document-render';
const token = 'a'.repeat(48);
const hash = 'b'.repeat(64);
const source = renderDocument({ ...sampleInput('QUOTE', 'ar'), actions: false, fontBase: '/fonts' });
const html = source.html.replace('</head>', `<meta name="entix-document-hash" content="${hash}"></head>`);
const quote = { id: 'synthetic-quote', orgId: visualOrgId, quoteNumber: 'Q-SYNTHETIC', status: 'DRAFT', contactId: 'c1', org: { name: 'Synthetic company' }, contact: { id: 'c1', displayName: 'Synthetic customer', email: 'synthetic@example.invalid' }, issueDate: '2026-10-01', validUntil: '2099-10-01', currency: 'SAR', total: 1200, subtotal: 1200, taxTotal: 0, lines: [] };
async function setup(page: any, signing: any = null) {
  await prepareVisualApp(page, 'ar');
  await page.route('**/api/q/**', (r: any) => new URL(r.request().url()).pathname.endsWith('/document') ? r.fulfill({ contentType: 'text/html', body: html }) : r.fulfill({ json: { ...quote, signing } }));
  await page.route('**/api/document-templates/render/QUOTE/**', (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/api/quotes/**', (r: any) => r.fulfill({ json: new URL(r.request().url()).pathname.endsWith('/synthetic-quote') ? quote : { items: [quote], total: 1 } }));
  await page.route('**/api/sign/requests?**', (r: any) => r.fulfill({ json: { items: [] } }));
}
test('public and print share every branded page and PDF page count, including mobile', async ({ page }, info) => {
  await setup(page);
  await page.goto('/print/proposal/synthetic-quote?noprint=1');
  await expect(page.locator('.sheet')).toHaveCount(source.sheetCount);
  const print = await page.locator('.edoc').innerHTML();
  await page.goto(`/q/${token}`);
  await expect(page.locator('.sheet')).toHaveCount(source.sheetCount);
  expect(await page.locator('.edoc').innerHTML()).toBe(print);
  await page.screenshot({ path: info.outputPath('public-desktop.png') });
  const pdf = await page.pdf({ path: info.outputPath('public.pdf'), preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(source.sheetCount);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('public-mobile.png') });
});
test('public invitation opens genuine signing and exposes signed PDF only after completion', async ({ page }) => {
  await setup(page, { status: 'PENDING', matches: true, expired: false, url: 'https://sign.ensidex.com/s/synthetic-only' });
  await page.goto(`/q/${token}`);
  await expect(page.getByRole('link', { name: 'مراجعة وتوقيع العرض' })).toHaveAttribute('href', 'https://sign.ensidex.com/s/synthetic-only');
  await expect(page.getByRole('button', { name: 'موافق على العرض', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'تحميل النسخة الموقعة PDF' })).toHaveCount(0);
  await setup(page, { status: 'SIGNED', matches: true, expired: false, url: null, signedPdfUrl: 'https://sign.ensidex.com/synthetic.pdf', auditTrailUrl: 'https://sign.ensidex.com/audit.pdf' });
  await page.reload();
  await expect(page.getByRole('link', { name: 'تحميل النسخة الموقعة PDF' })).toHaveAttribute('href', 'https://sign.ensidex.com/synthetic.pdf');
  await expect(page.getByRole('link', { name: 'سجل التوقيع' })).toBeVisible();
});
test('sender selects placement and no-email link; failure preserves form and duplicate submission is blocked', async ({ page }, info) => {
  await setup(page);
  let payload: any; let calls = 0; let active = false;
  await page.route('**/api/sign/requests?**', r => r.fulfill({ json: { items: active ? [{ id: 'request-1', status: 'PENDING', docusealEmbedUrl: 'https://sign.ensidex.com/s/synthetic-only' }] : [] } }));
  await page.route('**/api/sign/quotes/synthetic-quote/send', r => {
    payload = r.request().postDataJSON(); calls++;
    if (calls === 1) return r.fulfill({ status: 409, json: { error: 'document_changed', message: 'تغير العرض بعد المعاينة' } });
    active = true;
    return r.fulfill({ status: 201, json: { signatureRequest: { id: 'request-1' }, error: null } });
  });
  await page.goto('/app/quotes/synthetic-quote');
  await page.getByTestId('quote-request-signature').click();
  await expect(page.locator('.sheet')).toHaveCount(source.sheetCount);
  await page.getByPlaceholder('الاسم الكامل', { exact: true }).fill('Synthetic signer');
  await page.getByPlaceholder('signer@example.com').fill('synthetic@example.invalid');
  await page.getByLabel('صفحة التوقيع', { exact: true }).selectOption('2');
  await page.getByLabel('من اليسار %').fill('25');
  await page.getByLabel('من الأعلى %').fill('70');
  await page.getByRole('button', { name: 'تجهيز رابط التوقيع', exact: true }).click();
  await expect(page.getByText('تغير العرض بعد المعاينة؛ حدّث المعاينة ثم حدد مكان التوقيع مجددًا.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('signer@example.com')).toHaveValue('synthetic@example.invalid');
  expect(payload.sendEmail).toBe(false); expect(payload.snapshotHash).toBe(hash);
  expect(payload.signers[0].placement).toEqual({ page: 2, x: 0.25, y: 0.7, width: 0.32, height: 0.08 });
  await page.screenshot({ path: info.outputPath('placement.png') });
  await page.getByRole('button', { name: 'تجهيز رابط التوقيع', exact: true }).click();
  await expect(page.getByRole('link', { name: 'فتح رابط التوقيع' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تجهيز رابط التوقيع', exact: true })).toBeDisabled();
  expect(calls).toBe(2);
});

test('print link carries the quote company and avoids probing other memberships', async ({ page }) => {
  await setup(page);
  const quoteCompany = 'org-quote-owner';
  const requestedCompanies: string[] = [];
  await page.route('**/api/quotes**', route => {
    const detail = new URL(route.request().url()).pathname.endsWith('/synthetic-quote');
    if (detail) requestedCompanies.push(route.request().headers()['x-org-id']);
    const ownedQuote = { ...quote, orgId: quoteCompany };
    return route.fulfill({ json: detail ? ownedQuote : { items: [ownedQuote] } });
  });
  await page.goto('/app/quotes/synthetic-quote');
  const printLink = page.getByRole('link', { name: 'معاينة / طباعة العرض', exact: true });
  await expect(printLink).toHaveAttribute('href', '/print/proposal/synthetic-quote?orgId=org-quote-owner');
  const href = await printLink.getAttribute('href');
  requestedCompanies.length = 0;
  await page.goto(href + '&noprint=1');
  await expect(page.locator('.sheet')).toHaveCount(source.sheetCount);
  expect(requestedCompanies).toEqual([quoteCompany]);
});

test('print rendering stays with its quote while session refresh selects another company', async ({ page }) => {
  await setup(page);
  const owner = 'org-quote-owner';
  const scopes: string[] = [];
  let releaseSession!: () => void;
  const quoteStarted = new Promise<void>(resolve => { releaseSession = resolve; });
  await page.route('**/me', async route => {
    await quoteStarted;
    await route.fallback();
  });
  await page.route('**/api/quotes/synthetic-quote', async route => {
    scopes.push(route.request().headers()['x-org-id']);
    releaseSession();
    // Hold the quote until the real auth store finishes selecting the tab company.
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('entix_tab_org_v1') || 'null')?.orgId)).toBe(visualOrgId);
    await route.fulfill({ json: { ...quote, orgId: owner } });
  });
  await page.route('**/api/document-templates/render/QUOTE/**', route => {
    const scope = route.request().headers()['x-org-id'];
    scopes.push(scope);
    return scope === owner
      ? route.fulfill({ contentType: 'text/html', body: html })
      : route.fulfill({ status: 404, json: { error: 'not_found' } });
  });
  await page.goto('/print/proposal/synthetic-quote?orgId=org-quote-owner&noprint=1');
  await expect(page.locator('.sheet')).toHaveCount(source.sheetCount);
  expect(scopes).toEqual([owner, owner]);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('entix_tab_org_v1') || 'null')?.orgId)).toBe(visualOrgId);
});
