import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('connect guide uses the current Ledger palette and self-hosted fonts', async ({ page }) => {
  await page.goto('/connect/index.html#claude-ai')
  const theme = await readFile('src/styles/theme.css', 'utf8')
  const canvas = theme.match(/--neutral-50:\s*(#[\da-f]+)/i)![1]
  const ink = theme.match(/--brand-navy-950:\s*(#[\da-f]+)/i)![1]
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe(canvas)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim())).toBe(ink)
  await expect(page.getByRole('heading', { name: 'الربط من claude.ai Add as a custom connector' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'ENTIX.IO' })).toHaveCount(1)
  await expect(page.locator('link[href*="fonts.googleapis.com"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('in one minute')
  await expect(page.locator('body')).toContainText('Customize → Connectors')
})

for (const width of [390, 768, 1440]) {
  test(`connect guide stays readable at ${width}px and advanced instructions open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/connect/index.html')
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByText('للمطورين: Claude Code وواجهة MCP', { exact: true }).click()
    await expect(page.getByText('claude mcp add --transport http', { exact: false })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/entix-connect-${width}.png`, fullPage: true })
  })
}

test('copy confirms only after success and shows a usable failure message', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { if (value !== 'https://api.entix.io/mcp') throw new Error('wrong URL') } }, configurable: true }))
  await page.goto('/connect/index.html')
  await page.getByRole('button', { name: 'نسخ العنوان' }).click()
  await expect(page.getByRole('status')).toHaveText('تم نسخ العنوان')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied') } }, configurable: true }))
  await page.getByRole('button', { name: 'نسخ العنوان' }).click()
  await expect(page.getByRole('status')).toContainText('تعذر النسخ تلقائيًا')
  await expect(page.locator('#mcp-url')).toHaveText('https://api.entix.io/mcp')
})
