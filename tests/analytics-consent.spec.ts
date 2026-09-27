import { expect, test } from '@playwright/test';

test('analytics makes no request before consent or with essential-only; acceptance loads once and withdrawal disables it', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.entix.io/**', route => route.fulfill({status:401,json:{}}));
  await page.route('https://www.googletagmanager.com/**', route => { requests++; return route.fulfill({contentType:'application/javascript',body:''}); });
  await page.goto('/us/en');
  await expect(page.getByRole('button',{name:'Essential only',exact:true})).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.reload();
  expect(requests).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('entix:cookie-preferences')));
  await page.getByRole('button',{name:'Accept all',exact:true}).click();
  await expect.poll(() => requests).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('entix:cookie-preferences')));
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  expect(await page.evaluate(() => (window as any)['ga-disable-G-MW0F9G62C5'])).toBe(true);
  await page.reload();
  expect(requests).toBe(1);
});
