import { test, expect, type Page } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';

async function setup(page: Page, lang: 'ar' | 'en', payment = false, blocker: string | null = null) {
  await prepareVisualApp(page,lang);
  const voucher = { id: 'synthetic-voucher', number: 'V-100', type: payment ? 'PAYMENT' : 'RECEIPT', date: '2026-10-04T00:00:00.000Z', amount: '100', currency: 'USD', paymentMethod: 'CASH', contactId: 'party', contact: { id: 'party', displayName: 'Synthetic party' }, invoiceId: payment ? null : 'invoice', billId: payment ? 'bill' : null };
  let deleted = false; const writes: any[] = [];
  await page.route('**/api/vouchers**',route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/correction-review')) return route.fulfill({ json: { voucher, reason: blocker, version: 'a'.repeat(64), linkedDocument: { id: payment ? 'bill' : 'invoice', type: payment ? 'bill' : 'invoice', number: 'DOC-100', paid: 100, total: 100 } } });
    if (path.endsWith('/correct')) { const body = route.request().postDataJSON(); writes.push(body); deleted = body.action === 'delete'; return route.fulfill({ json: { id: voucher.id, deleted } }); }
    if (path.endsWith('/attachments')) return route.fulfill({ json: { items: [] } });
    if (path.endsWith('/synthetic-voucher')) return route.fulfill({ json: voucher });
    return route.fulfill({ json: { items: deleted ? [] : [voucher], total: deleted ? 0 : 1, summary: { sumAmount: '100', avgAmount: '100' } } });
  });
  await page.route('**/api/payment-methods**',r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/bank-accounts**',r => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/contacts?**',r => r.fulfill({ json: { items: [voucher.contact] } }));
  await page.goto(`/app/${payment ? 'payments' : 'receipts'}`);
  await page.getByText('V-100',{ exact: true }).first().click();
  return { writes };
}

for (const lang of ['ar','en'] as const) for (const payment of [false,true]) test(`posted ${payment ? 'payment' : 'receipt'} edit and delete review ${lang}`,async ({ page },info) => {
  const f = await setup(page,lang,payment);
  await page.getByRole('button',{ name: lang === 'ar' ? 'تعديل' : 'Edit', exact: true }).click();
  await expect(page.getByRole('heading',{ name: lang === 'ar' ? 'تعديل السند أو حذفه' : 'Edit or delete voucher' })).toBeVisible();
  const save = page.getByRole('button',{ name: lang === 'ar' ? 'حفظ التصحيح' : 'Save correction',exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel(lang === 'ar' ? 'المبلغ' : 'Amount',{ exact: true }).fill('75');
  await expect(page.getByText(/75.00 USD/)).toBeVisible();
  await page.getByLabel(lang === 'ar' ? 'سبب التصحيح أو الحذف' : 'Reason for correction or deletion').fill('Synthetic correction');
  await page.getByLabel(lang === 'ar' ? 'اكتب رقم السند للتأكيد' : 'Type the voucher number to confirm').fill('V-100');
  await page.screenshot({ path: info.outputPath('correction.png'), fullPage: true });
  await save.click(); await expect.poll(() => f.writes.length).toBe(1);
  expect(f.writes[0]).toMatchObject({ action: 'edit', amount: 75, version: 'a'.repeat(64), confirmNumber: 'V-100' });
  await page.getByText('V-100',{exact:true}).first().click();
  await page.getByRole('button',{ name: lang === 'ar' ? 'حذف' : 'Delete',exact:true }).click();
  await expect(page.getByText(/0.00 USD/)).toBeVisible();
  await page.getByLabel(lang === 'ar' ? 'سبب التصحيح أو الحذف' : 'Reason for correction or deletion').fill('Synthetic deletion');
  await page.getByLabel(lang === 'ar' ? 'اكتب رقم السند للتأكيد' : 'Type the voucher number to confirm').fill('V-100');
  await page.getByRole('button',{ name: lang === 'ar' ? 'حذف نهائي وعكس السداد' : 'Delete permanently and reverse settlement',exact:true }).click();
  await expect.poll(() => f.writes.length).toBe(2); expect(f.writes[1].action).toBe('delete');
  await expect(page.getByText('V-100',{exact:true})).toHaveCount(0);
});

test('matched voucher explains required action and cannot submit',async ({ page }) => {
  const f = await setup(page,'en',false,'bank_match');
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Remove the match');
  await expect(page.getByRole('button',{name:'Save correction',exact:true})).toBeDisabled();
  expect(f.writes).toHaveLength(0);
});
