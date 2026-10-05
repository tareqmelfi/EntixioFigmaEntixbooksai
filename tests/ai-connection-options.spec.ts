import { test, expect } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

for (const language of ['ar', 'en'] as const) {
  for (const width of [390, 1440]) {
    test(`AI connection setup is clear and does not change billing: ${language} ${width}`, async ({ page }) => {
      await prepareVisualApp(page, language)
      await page.setViewportSize({ width, height: 1000 })
      const writes: string[] = []
      await page.route('**/api/ai-billing**', async route => {
        if (route.request().method() !== 'GET') writes.push(route.request().method())
        await route.fulfill({ json: { mode: 'BYOK', byokProvider: 'openrouter', byokKeyHint: null,
          monthlyAllocation: 5, creditBalance: 0, spentThisPeriod: 0,
          requestLimit: 1000, requestsThisPeriod: 4, disabled: false, percentUsed: 0 } })
      })
      await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true, value: { writeText: async (url: string) => {
          if (url !== 'https://api.entix.io/mcp') throw new Error('Unexpected destination')
        } },
      }))
      await page.goto('/app/settings?tab=ai')
      const section = page.locator('section[aria-labelledby="ai-connections-title"]')
      await section.getByRole('button', { name: /ChatGPT/ }).click()
      await expect(section.getByRole('button', { name: /ChatGPT/ })).toHaveAttribute('aria-expanded', 'true')
      await expect(section.getByRole('link', { name: /ChatGPT/ })).toHaveAttribute('href', 'https://chatgpt.com/')
      await expect(section.getByRole('link', { name: /دليل الربط|Connection guide/ })).toHaveAttribute('href', '/connect#chatgpt')
      await section.getByRole('button', { name: /نسخ عنوان|Copy connection/ }).click()
      await expect(section.getByRole('status')).toHaveText(language === 'ar' ? 'تم نسخ العنوان' : 'URL copied')
      await section.getByRole('button', { name: /Claude/ }).click()
      await expect(section.getByRole('status')).toBeEmpty()
      await expect(section.getByRole('link', { name: /Claude/ })).toHaveAttribute('href', 'https://claude.ai/')
      await expect(section.getByRole('link', { name: /دليل الربط|Connection guide/ })).toHaveAttribute('href', '/connect#claude-ai')
      await section.locator('summary').click()
      await expect(section).toContainText(language === 'ar' ? 'الربط المباشر غير مفعّل' : 'direct plan usage is not enabled')
      await expect(page.getByText(language === 'ar' ? 'الباقة الحالية: مفتاحي الخاص (BYOK)' : 'Current plan: Bring Your Own Key (BYOK)', { exact: true })).toBeVisible()
      await expect(section.locator('input')).toHaveCount(0)
      await expect(section.getByRole('link', { name: /إدارة صلاحيات|Manage and revoke/ })).toHaveAttribute('href', '/app/settings?tab=api-keys')
      // The new section must fit even if unrelated legacy billing controls overflow.
      expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await section.screenshot({ path: `/tmp/entix-ai-options-${language}-${width}.png` })
      await section.getByRole('button', { name: /Claude/ }).click()
      await expect(page.locator('#ai-connector-setup')).toHaveCount(0)
      expect(writes).toEqual([])
    })
  }
}

test('setup remains accessible when billing is unavailable and clipboard failure is explicit', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  await page.route('**/api/ai-billing**', route => route.fulfill({ status: 503, json: { error: 'temporarily_unavailable' } }))
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new Error('denied') } },
  }))
  await page.goto('/app/settings?tab=ai')
  const section = page.locator('section[aria-labelledby="ai-connections-title"]')
  await section.getByRole('button', { name: 'Set up ChatGPT' }).click()
  await section.getByRole('button', { name: 'Copy connection URL' }).click()
  await expect(section.getByRole('status')).toContainText('Copy failed')
  await expect(section.locator('code')).toHaveText('https://api.entix.io/mcp')
  await expect(section).not.toContainText('Connected successfully')
})

test('ChatGPT guide is reachable with OAuth steps and the plan-usage limitation', async ({ page }) => {
  await page.goto('/connect/index.html#chatgpt')
  await expect(page.locator('#chatgpt')).toBeVisible()
  await expect(page.locator('#chatgpt')).toContainText('OAuth')
  await expect(page.locator('#chatgpt')).toContainText('read-only')
  await page.getByText('هل أستخدم اشتراكي لتشغيل مساعد Entix داخل المنصة؟', { exact: true }).click()
  await expect(page.getByText('The connector runs in ChatGPT or Claude.', { exact: false })).toBeVisible()
})
