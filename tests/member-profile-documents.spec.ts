import { test, expect, type Page } from '@playwright/test';
import { renderDocument, sampleInput } from '../src/app/lib/document-render';
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app';

const org = { id: visualOrgId, name: 'Synthetic Company', legalName: 'Synthetic Company LLC', country: 'US', baseCurrency: 'USD', vatNumber: 'test-vat', zatcaEnabled: false, socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/example', label: 'Our team' }] };
async function prepare(page: Page, language: 'en'|'ar') {
  await prepareVisualApp(page, language);
  const user = { id: 'invited-member', name: 'Invited Member', email: 'member@example.invalid', bio: 'Existing bio', phone: '', image: '', emailVerified: true };
  await page.route('**/api/auth/get-session', r => r.fulfill({json:{user}}));
  await page.route('**/me', r => r.fulfill({json:{...user,locale:language,selectedOrgId:visualOrgId,memberships:[{role:'VIEWER',org}]}}));
  await page.route('**/orgs', r => r.fulfill({json:[org]}));
  await page.route(`**/orgs/${visualOrgId}`, r => r.fulfill({json:org}));
  await page.route('**/me/avatars', r=>r.fulfill({json:{url:'https://api.entix.io/me/avatars/synthetic-avatar'}}));
  const updates: any[] = [];
  await page.route('**/api/auth/update-user', async r => {const data = r.request().postDataJSON(); updates.push(data); Object.assign(user,data); await r.fulfill({json:{status:true}});});
  return {user, updates};
}
for (const language of ['en','ar'] as const) test(`invited member can manage own profile and security (${language})`, async ({page}) => {
  const {updates,user}=await prepare(page,language);
  await page.setViewportSize({width:language==='ar'?390:1440,height:1000});
  await page.goto('/app/settings?tab=account');
  await expect(page.locator('#profile-name')).toHaveValue('Invited Member');
  await page.locator('#profile-name').fill('Updated Member');
  await page.locator('#profile-bio').fill('My own bio');
  await page.locator('#profile-photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNAAAAABJRU5ErkJggg==','base64')});
  const scope=page.getByTestId('account-profile');
  await expect(scope.getByRole('img')).toBeVisible();
  await scope.getByRole('button',{name:language==='ar'?'حفظ الملف الشخصي':'Save profile',exact:true}).click();
  await expect(scope.getByRole('status')).toContainText(language==='ar'?'حُفظ':'saved');
  expect(updates[0]).toMatchObject({name:'Updated Member',bio:'My own bio'});
  expect(updates[0]).not.toHaveProperty('email'); expect(updates[0]).not.toHaveProperty('role');
  expect(user.image).toBe('https://api.entix.io/me/avatars/synthetic-avatar');
  expect(JSON.stringify(updates[0]).length).toBeLessThan(500);
  await scope.getByRole('button',{name:language==='ar'?'إزالة الصورة':'Remove photo'}).click();
  await scope.getByRole('button',{name:language==='ar'?'حفظ الملف الشخصي':'Save profile',exact:true}).click();
  await expect.poll(()=>updates.length).toBe(2); expect(updates[1].image).toBeNull();
  let emailBody:any;
  await page.route('**/api/auth/change-email',r=>{emailBody=r.request().postDataJSON();return r.fulfill({json:{status:true}})});
  await page.locator('#profile-email').fill('new@example.invalid');
  await scope.getByRole('button',{name:language==='ar'?'إرسال طلب تغيير البريد':'Request email change'}).click();
  await expect(scope.getByRole('status')).toContainText(language==='ar'?'التحقق':'verification');
  expect(emailBody.newEmail).toBe('new@example.invalid'); expect(user.email).toBe('member@example.invalid');
  let passwordBody:any;
  await page.route('**/api/auth/change-password',r=>{passwordBody=r.request().postDataJSON();return r.fulfill({json:{token:'synthetic'}})});
  await page.locator('#profile-current-password').fill('current-password');
  await page.locator('#profile-new-password').fill('new-password-123');
  await page.locator('#profile-confirm-password').fill('mismatch');
  await scope.getByRole('button',{name:language==='ar'?'تحديث كلمة المرور':'Update password'}).click();
  await expect(scope.getByRole('alert')).toContainText(language==='ar'?'غير متطابقتين':'do not match'); expect(passwordBody).toBeUndefined();
  await page.locator('#profile-confirm-password').fill('new-password-123');
  await scope.getByRole('button',{name:language==='ar'?'تحديث كلمة المرور':'Update password'}).click();
  await expect(page.locator('#profile-new-password')).toHaveValue(''); expect(passwordBody.revokeOtherSessions).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`/tmp/entix-profile-${language}.png`,fullPage:true});
});
test('failed profile load cannot overwrite existing details',async({page})=>{
  await prepare(page,'en'); let count=0;
  await page.route('**/me',async r=>{if(++count>1)return r.fulfill({status:500,json:{error:'unavailable'}});return r.fallback()});
  await page.goto('/app/settings?tab=account');
  await expect(page.getByRole('alert').filter({hasText:'Could not load your profile'})).toBeVisible();
  await expect(page.locator('#profile-name')).toHaveCount(0);
});
for(const language of ['en','ar'] as const) test(`vouchers keep recorded issuer and QR without recipient signature (${language})`,async({page})=>{
  await prepare(page,language);
  await page.route('**/api/vouchers/receipt-test',r=>r.fulfill({json:{id:'receipt-test',orgId:visualOrgId,type:'RECEIPT',number:'QA-RCP-1',date:'2026-09-27',amount:100,currency:'USD',paymentMethod:'BANK_TRANSFER',createdByName:'Recorded Issuer'}}));
  await page.goto(`/print/voucher/receipt-test?lang=${language}`);
  await expect(page.getByTestId('voucher-issuer')).toHaveText('Recorded Issuer');
  await expect(page.getByText(/Recipient signature|توقيع المستلم/)).toHaveCount(0);
  await expect(page.locator('article svg').first()).toBeVisible();
  await expect(page.getByTestId('voucher-social-links').getByRole('link')).toHaveAttribute('href','https://instagram.com/example');
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(1);
  expect(pdf.toString('latin1')).toContain('/URI (https://instagram.com/example)');
  await page.screenshot({path:`/tmp/entix-voucher-${language}.png`,fullPage:true});
});

for (const language of ['ar', 'en'] as const) test(`social links stay within printable quote pages (${language})`, async ({page}) => {
  const base = sampleInput('QUOTE', language, {themePreset:'ink-white', headerStyle:'centered'});
  const socialLinks = Array.from({length:10},(_,i)=>({platform:'linkedin',label:`فريق المشاريع والتصميم والتطوير ${i+1} Team`,url:`https://linkedin.com/company/${'long-name-'.repeat(25)}${i}`}));
  const result = renderDocument({...base,org:{...base.org,socialLinks},fontBase:'/fonts'});
  await page.route('**/profile-document-preview',r=>r.fulfill({contentType:'text/html',body:result.html}));
  await page.goto('/profile-document-preview');
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('a[href^="https://linkedin.com/company/"]')).toHaveCount(10);
  const overflow = await page.locator('.sheet').evaluateAll(sheets=>sheets.flatMap(sheet=>{
    const footer=sheet.querySelector('.ftr')?.getBoundingClientRect();
    return Array.from(sheet.querySelectorAll('a[href^="https://linkedin.com/company/"]')).filter(link=>footer && link.getBoundingClientRect().bottom>footer.top).map(link=>link.textContent);
  }));
  expect(overflow).toEqual([]);
  await page.locator('a[href^="https://linkedin.com/company/"]').last().scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/entix-social-document-${language}.png`});
});
