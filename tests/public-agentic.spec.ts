import { expect, test } from '@playwright/test'
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'

test('agent directory links resolve to built public documents', async () => {
  const text = await readFile('dist/llms.txt', 'utf8')
  expect(text).toMatch(/^# Entix Books/m)
  const links = [...text.matchAll(/\[[^\]]+\]\((https:\/\/entix\.io[^)]+)\)/g)]
  expect(links.length).toBeGreaterThan(15)
  for (const [, link] of links) {
    const route = new URL(link).pathname
    expect(route).not.toMatch(/^\/(app|admin|print|portal)(\/|$)/)
    await access(path.join('dist', route.endsWith('.xml') ? route : `${route}/index.html`))
  }
})

test('stylesheet early hint uses the same CORS mode as the Vite document', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  const css = html.match(/<link rel="stylesheet" crossorigin(?:="")? href="([^"]+)"/)
  expect(css).not.toBeNull()
  const hint = await readFile('nginx-early-hints.conf', 'utf8')
  expect(hint).toContain(`<${css![1]}>; rel=preload; as=style; crossorigin`)
})

for (const locale of ['en', 'ar']) {
  test(`landing is readable and navigable with reduced motion in ${locale}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({ v: 1, choice: 'essential', analytics: false, marketing: false })))
    await page.route('https://api.entix.io/**', route => route.fulfill({ status: 401, json: {} }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(locale === 'ar' ? '/sa/ar' : '/us/en')
    const hero = page.locator('main section').first()
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(hero.getByRole('link', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in', exact: true })).toHaveAttribute('href', '/login')
    const question = page.locator('#faq button').first()
    const answer = page.locator(`#${await question.getAttribute('aria-controls')}`)
    await expect(answer).toBeHidden()
    await question.focus()
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await expect(answer).toBeVisible()
    expect(await answer.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true)
    await page.keyboard.press('Enter')
    await expect(answer).toBeHidden()
    await page.getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu', exact: true }).click()
    await expect(page.getByRole('button', { name: locale === 'ar' ? 'إغلاق القائمة' : 'Close menu', exact: true })).toHaveAttribute('aria-expanded', 'true')
  })
}


test('public bootstrap preconnect matches the credentialed session request', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  expect(html).toMatch(/rel="preconnect" href="https:\/\/api\.entix\.io" crossorigin="use-credentials"/)
})
