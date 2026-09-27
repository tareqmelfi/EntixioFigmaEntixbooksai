import { expect, test } from '@playwright/test';
import { modules } from '../src/app/lib/feature-catalog';

for (const language of ['en', 'ar'] as const) {
  test(`capability directory, real gallery and industry pages · ${language}`, async ({ page }, testInfo) => {
    await page.addInitScript(locale => {
      localStorage.setItem('entix-language', locale);
      localStorage.setItem('entix-marketing-region', locale === 'ar' ? 'SA' : 'US');
      localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({v:1,choice:'essential',analytics:false,marketing:false,at:'2026-09-27T00:00:00Z'}));
    }, language);
    await page.route('https://api.entix.io/**', route => route.fulfill({status: 401,json:{error:'unauthenticated'}}));
    const crashes: string[] = [];
    page.on('pageerror', error => crashes.push(error.message));
    await page.goto('/features');
    const main = page.locator('main[data-page=features]');
    await expect(main).toBeVisible();
    await expect(main.locator('..')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    await expect(main.getByRole('status')).toContainText(String(modules.reduce((n,m) => n + m.features.length, 0)));
    const search = main.getByRole('textbox');
    await search.fill('Cash flow forecasting');
    await expect(main.locator('[data-feature-status=phase3]')).toBeVisible();
    await main.getByRole('combobox').selectOption('live');
    await expect(main.locator('[data-feature-status]')).toHaveCount(0);
    await search.fill('Project management');
    await expect(main.locator('[data-feature-status=live]')).toBeVisible();
    await search.fill('');
    await main.getByRole('combobox').selectOption('all');
    await expect(main).not.toContainText(/free month|30 full days|شهرك المجاني/);
    const gallery = main.getByTestId('product-gallery');
    for (const [id, name] of [['invoices',language === 'ar' ? 'الفواتير والتحصيل' : 'Invoices and collection'],['quotes',language === 'ar' ? 'عروض الأسعار' : 'Quotations'],['projects',language === 'ar' ? 'المشاريع' : 'Projects']]) {
      await gallery.getByRole('button', {name,exact:true}).click();
      const image = gallery.getByRole('img');
      await expect(image).toHaveAttribute('src', `/marketing/product/${id}-${language}.png`);
      await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    await page.screenshot({path:testInfo.outputPath(`features-${language}.png`),fullPage:true});
    for (const slug of ['contracting','freelancers','agencies']) {
      await page.goto(`/solutions/${slug}`);
      await expect(page.locator(`main[data-page=solutions-${slug}]`)).toBeVisible();
      await expect(page.getByRole('heading', {level:1})).toBeVisible();
      const image = page.getByTestId('product-gallery').getByRole('img');
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    expect(crashes).toEqual([]);
  });
}
