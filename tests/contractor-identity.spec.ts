import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

for (const language of ['ar', 'en'] as const) {
  test(`contractor reuses contact, accepts individual tax ID and links back (${language})`, async ({ page }) => {
    await prepareVisualApp(page, language);
    const contact = { id: 'person', displayName: 'Ahmed', country: 'SA', entityKind: 'INDIVIDUAL', isCustomer: true, isFreelancer: true, email: 'ahmed@example.com', taxId: '300000000000003' };
    await page.route('**/api/contacts**', r => r.fulfill({ json: { items: [contact], total: 1 } }));
    let saved: any;
    const writes: any[] = [];
    await page.route('**/api/contractors**', async r => {
      if (r.request().url().endsWith('/next-code')) return r.fulfill({ json: { code: 'CTR-001' } });
      if (r.request().method() === 'POST') {
        writes.push(r.request().postDataJSON());
        saved = { ...writes[0], id: 'profile', contact, isActive: true, stats: {}, peers: {} };
        return r.fulfill({ json: saved });
      }
      return r.fulfill({ json: saved || { items: [], total: 0 } });
    });
    await page.goto('/app/contractors/new?contactId=person');
    await expect(page.locator('input[value="Ahmed"]')).toBeVisible();
    const tax = page.getByLabel(language === 'ar' ? 'الرقم الضريبي (اختياري للفرد أو الشركة)' : 'Tax ID (optional for individuals and companies)');
    await tax.fill('٣٠٠٠٠٠٠٠٠٠٠٠٠٠٣');
    await expect(tax).toHaveValue('300 000 000 000 003');
    await page.getByRole('button', { name: language === 'ar' ? 'تسجيل المقاول' : 'Register contractor', exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].contactId).toBe('person');
    expect(writes[0].taxId).toBe('300 000 000 000 003');
    await expect(page).toHaveURL(/contractors\/profile$/);
    await expect(page.getByRole('link', { name: language === 'ar' ? 'فتح سجل الاتصال الموحد' : 'Open unified contact' })).toHaveAttribute('href', '/app/contacts/person');
    await page.screenshot({ path: `test-results/contractor-contact-${language}.png`, fullPage: true });
  });

  test(`Saudi individual contact exposes optional tax ID and multiple roles (${language})`, async ({ page }) => {
    await prepareVisualApp(page, language);
    let payload: any;
    await page.route('**/api/contacts**', r => {
      if (r.request().method() === 'POST') {
        payload = r.request().postDataJSON();
        return r.fulfill({ json: { ...payload, id: 'person', contractorShells: [{ id: 'profile' }] } });
      }
      if (r.request().url().includes('next-code')) return r.fulfill({ json: { customCode: 'CON-001' } });
      return r.fulfill({ json: { items: [], total: 0 } });
    });
    await page.route('**/api/contractors/profile', r => r.fulfill({ json: { id: 'profile', name: 'Ahmed', contactId: 'person', kind: 'FREELANCER', contact: { taxId: '300000000000003' }, stats: {}, peers: {} } }));
    await page.goto('/app/contacts?new=1');
    await page.getByRole('button', { name: language === 'ar' ? 'فرد شخص طبيعي' : 'Individual Natural person', exact: true }).click();
    await page.getByRole('button', { name: language === 'ar' ? 'التالي' : 'Next', exact: true }).click();
    await page.getByPlaceholder(language === 'ar' ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohammed').fill('Ahmed');
    await page.getByPlaceholder('300 XXX XXX XXX X 003').fill('300000000000003');
    await page.getByRole('button', { name: language === 'ar' ? 'التالي' : 'Next', exact: true }).click();
    await page.getByRole('button', { name: language === 'ar' ? 'فري لانسر / مقاول' : 'Freelancer / contractor', exact: true }).click();
    await page.getByRole('button', { name: language === 'ar' ? 'التالي' : 'Next', exact: true }).click();
    await page.getByRole('button', { name: language === 'ar' ? 'حفظ جهة الاتصال' : 'Save contact', exact: true }).click();
    await expect.poll(() => payload?.isFreelancer).toBe(true);
    expect(payload.isCustomer).toBe(true);
    expect(payload.entityKind).toBe('INDIVIDUAL');
    expect(payload.vatNumber).toBe('300 000 000 000 003');
    await expect(page).toHaveURL(/contractors\/profile$/);
  });
}
