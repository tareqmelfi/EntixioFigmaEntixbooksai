import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page) {
  const orgs = ['a', 'b'].map(id => ({ id: `tenant-${id}`, name: `Synthetic Company ${id.toUpperCase()}`, slug: `test-${id}`, role: 'OWNER', country: 'SA', baseCurrency: 'SAR', vatNumber: '310000000000003', zatcaEnabled: true, fiscalYearEnd: 12, industry: 'Test services', subscription: { status: 'ACTIVE', plan: { tier: 'PRO', name: 'Pro' } } }))
  const updates: any[] = []
  await page.addInitScript(() => { localStorage.setItem('entix-language', 'en'); if (!localStorage.getItem('entix_org_id')) localStorage.setItem('entix_org_id', 'tenant-a'); localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({ v: 1, choice: 'essential', analytics: false, marketing: false, at: '2026-09-06T00:00:00Z' })); })
  await page.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin === 'http://127.0.0.1:5279') return route.continue();
    if (url.hostname !== 'api.entix.io') return route.abort();
    const path = url.pathname; const tenant = req.headers()['x-org-id'] || 'tenant-a';
    if (path === '/api/auth/get-session') return route.fulfill({ json: { user: { id: 'test-user', email: 'test@example.test', name: 'Test Owner', createdAt: '2026-09-06T00:00:00Z' } } });
    if (path === '/me') return route.fulfill({ json: { selectedOrgId: tenant, defaultOrgId: tenant, memberships: orgs.map(org => ({ org, role: 'OWNER' })) } });
    if (path === '/orgs') return route.fulfill({ json: orgs });
    if (/^\/orgs\/[^/]+\/members$/.test(path)) return route.fulfill({ json: { members: [] } });
    if (/^\/orgs\/[^/]+$/.test(path) && req.method() === 'PATCH') { const data = req.postDataJSON(); updates.push(data); return route.fulfill({ json: { ...orgs.find(o => path.endsWith(o.id)), ...data } }); }
    if (path === '/api/vat-registration') {
      if (req.method() === 'PUT') { const data = req.postDataJSON(); updates.push({ tenant, registration: data }); return route.fulfill({ json: { registration: { ...data, revision: data.revision + 1 }, issuesCertificates: false } }); }
      return route.fulfill({ json: { registration: tenant === 'tenant-b' ? { revision: 2, status: 'DRAFT', path: 'EXISTING_CERTIFICATE', identityEvidence: 'company-b-evidence' } : null, issuesCertificates: false } });
    }
    if (path === '/api/zatca/onboarding/status') return route.fulfill({ json: { status: 'NONE', mode: 'simulation', vatConfigured: true, zatcaEnabled: true } });
    if (path === '/api/zatca/status') return route.fulfill({ json: { status: 'LOCAL_UNVERIFIED', ready: false, productionReady: false, enabled: true, mode: 'simulation', vatNumber: '310000000000003' } });
    if (path === '/api/notifications/count') return route.fulfill({ json: { unread: 0 } });
    if (path === '/api/onboarding/status') return route.fulfill({ json: { completed: true } });
    return route.fulfill({ json: { items: [], members: [] } });
  });
  return updates;
}

test('company save preserves activation; existing certificate workflow is separate and manually verified', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1800 });
  const updates = await setup(page);
  await page.goto('/app/settings?tab=company&__qa_auth=1');
  await page.getByRole('button', { name: /Save changes|Save company|Save$/i }).first().click();
  await expect.poll(() => updates.length).toBe(1);
  expect(updates[0]).not.toHaveProperty('zatcaEnabled');
  await page.goto('/app/settings?tab=zatca&__qa_auth=1');
  await expect(page.getByText('VAT registration and certificate', { exact: true })).toBeVisible();
  await expect(page.getByText(/A typed VAT number does not prove registration/)).toBeVisible();
  await expect(page.getByLabel('Certificate file SHA-256', { exact: true })).not.toBeVisible();
  await page.getByText('Advanced verification evidence — administrator', { exact: true }).click();
  await expect(page.getByLabel('Certificate file SHA-256', { exact: true })).toBeVisible();
  await page.getByText('Advanced verification evidence — administrator', { exact: true }).click();
  await page.getByLabel('Workflow', { exact: true }).selectOption('EXISTING_CERTIFICATE');
  await expect(page.getByLabel('Revenue evidence and period', { exact: true })).toHaveCount(0);
  await page.getByLabel('Entity identity / registry evidence', { exact: true }).fill('registry-source-a');
  await page.getByRole('button', { name: 'Save tracking', exact: true }).click();
  await expect.poll(() => updates.length).toBe(2);
  expect(updates[1].tenant).toBe('tenant-a');
  expect(updates[1].registration.status).toBe('DRAFT');
  await page.getByLabel('Evidence-supported status', { exact: true }).selectOption('CERTIFICATE_VERIFIED');
  await expect(page.getByRole('button', { name: 'Save tracking', exact: true })).toBeDisabled();
  await page.getByTestId('vat-registration-panel').screenshot({ path: '../../EN-TEC-IMG-01-Vat-Workflow-EN-V01.png' });
});

test('switching company reloads its evidence and clears unsaved CSR fields', async ({ page }) => {
  await setup(page);
  await page.goto('/app/settings?tab=zatca&__qa_auth=1');
  await page.getByLabel('Entity identity / registry evidence', { exact: true }).fill('unsaved-company-a');
  await page.getByLabel('Branch / VAT group member TIN', { exact: true }).fill('branch-a');
  // Switch through the product control: it persists company choice and reloads the app.
  await page.evaluate(() => { localStorage.setItem('entix_org_id', 'tenant-b'); localStorage.setItem('entix_org_explicit', String(Date.now())); });
  await page.reload();
  await expect(page.getByLabel('Entity identity / registry evidence', { exact: true })).toHaveValue('company-b-evidence');
  await expect(page.getByLabel('Branch / VAT group member TIN', { exact: true })).toHaveValue('');
});

test('a test-environment device certificate never displays a production connection claim', async ({ page }) => {
  await setup(page);
  await page.route('https://api.entix.io/api/zatca/onboarding/status', route => route.fulfill({ json: { status: 'PRODUCTION', mode: 'simulation', environmentVerified: true, productionReady: false, hasCsid: true, hasCertificate: true, vatConfigured: true } }));
  await page.goto('/app/settings?tab=zatca&__qa_auth=1');
  await expect(page.getByText('Device certificate stored · under validation').first()).toBeVisible();
  await expect(page.locator('[data-zatca-connection="connected"]')).toHaveCount(0);
  await expect(page.getByText('Production certificate active', { exact: true })).toHaveCount(0);
});
