import { expect, test } from '@playwright/test'

test('semantic theme exposes the ENTIX visual contract without locale font shrinking', async ({ page }) => {
  await page.goto('/us/en')
  const english = await page.locator('html').evaluate((html) => {
    const style = getComputedStyle(html)
    return {
      brandBlue: style.getPropertyValue('--brand-blue-600').trim().toLowerCase(),
      primary: style.getPropertyValue('--primary').trim().toLowerCase(),
      canvas: style.getPropertyValue('--canvas').trim(),
      surface: style.getPropertyValue('--surface').trim(),
      success: style.getPropertyValue('--success').trim(),
      control: style.getPropertyValue('--control-md').trim(),
      pageTitle: style.getPropertyValue('--type-page').trim(),
      fontSize: style.fontSize,
    }
  })

  await page.goto('/sa/ar')
  const arabicFontSize = await page.locator('html').evaluate((html) => getComputedStyle(html).fontSize)

  // Ledger (2026-09): logo blue accent · AA-safe primary
  expect(english.brandBlue).toBe('#5875db')
  expect(english.primary).toBe('#4661c7')
  expect(english.canvas).toBeTruthy()
  expect(english.surface).toBeTruthy()
  expect(english.success).toBeTruthy()
  expect(english.control).toBe('36px')
  expect(english.pageTitle).toContain('clamp(')
  expect(arabicFontSize).toBe(english.fontSize)
})

test('light-only semantic controls do not partially switch with a dark OS preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/us/en')
  const styles = await page.evaluate(() => {
    const button = document.createElement('button')
    button.className = 'bg-surface text-foreground dark:bg-input/30'
    document.body.append(button)
    const style = getComputedStyle(button)
    const result = { background: style.backgroundColor, color: style.color }
    button.remove()
    return result
  })
  expect(styles.background).toBe('rgb(255, 253, 249)') // --surface = card on paper
  expect(styles.color).toBe('rgb(26, 30, 72)') // ink
})

test('Tailwind geometry aliases resolve to concrete radius and elevation values', async ({ page }) => {
  await page.goto('/us/en')
  const geometry = await page.evaluate(() => {
    const sample = document.createElement('div')
    sample.className = 'rounded-lg shadow-popover'
    document.body.append(sample)
    const style = getComputedStyle(sample)
    const result = { radius: style.borderRadius, shadow: style.boxShadow }
    sample.remove()
    return result
  })

  expect(geometry.radius).toBe('8px') // Ledger: one radius token
  expect(geometry.shadow).not.toBe('none')
  expect(geometry.shadow).toContain('rgba(26, 30, 72, 0.12)')
})
