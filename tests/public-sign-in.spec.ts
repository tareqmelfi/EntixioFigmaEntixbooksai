import { expect, test, type Page } from '@playwright/test'

async function guest(page: Page, language: 'ar' | 'en') {
  await page.addInitScript((lang) => {
    localStorage.setItem('entix-language', lang)
    localStorage.setItem('entix-marketing-region', lang === 'ar' ? 'SA' : 'US')
  }, language)
  await page.route('https://api.entix.io/**', route => route.fulfill({ json: {} }))
}

for (const language of ['ar', 'en'] as const) {
  for (const width of [320, 390, 768, 1024, 1280, 1536]) {
    test(`sign-in is immediately reachable in ${language} at ${width}px`, async ({ page }, testInfo) => {
      await guest(page, language)
      await page.setViewportSize({ width, height: 844 })
      await page.goto(language === 'ar' ? '/sa/ar' : '/us/en')
      const nav = page.getByRole('navigation')
      const login = page.getByTestId(width < 1280 ? 'nav-sign-in-mobile' : 'nav-sign-in')
      await expect(login).toHaveText(language === 'ar' ? 'تسجيل الدخول' : 'Sign in')
      await expect(login).toBeInViewport()
      await expect(login).toHaveAttribute('href', '/login')
      await page.evaluate(() => document.fonts.ready)
      // The label must fit, have a touch target, and not overlap another header control.
      const geometry = await nav.evaluate(el => {
        const controls = [...el.querySelectorAll('a,button')].filter(e => e.getBoundingClientRect().width > 0)
        const rects = controls.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom } })
        return { width: window.innerWidth, rects }
      })
      for (const r of geometry.rects) {
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.right).toBeLessThanOrEqual(width)
      }
      for (let i = 0; i < geometry.rects.length; i++) {
        for (const b of geometry.rects.slice(i + 1)) {
          const a = geometry.rects[i]
          expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true)
        }
      }
      expect((await login.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      // First-visit cookie notice must not cover sign-in, nor may scrolling hide it.
      await login.click({ trial: true })
      if (width === 320 || width === 1536) await page.screenshot({ path: testInfo.outputPath(`sign-in-${language}-${width}.png`) })
      await page.evaluate(() => window.scrollTo(0, 1200))
      await expect(login).toBeInViewport()
      await login.click()
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('textbox', { name: language === 'ar' ? /البريد/ : /Email/ })).toBeVisible()
    })
  }

  test(`mobile sign-in remains reachable from public pages and an open menu (${language})`, async ({ page }) => {
    await guest(page, language)
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of ['/pricing', '/features', '/help']) {
      await page.goto(path)
      const login = page.getByTestId('nav-sign-in-mobile')
      await expect(login).toBeInViewport()
      await page.getByRole('button', { name: language === 'ar' ? 'فتح القائمة' : 'Open menu', exact: true }).click()
      await login.click()
      await expect(page).toHaveURL(/\/login$/)
    }
  })
}


test('connector guide exposes sign-in on a narrow phone', async ({ page }) => {
  await guest(page, 'ar')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/connect/index.html')
  const login = page.getByRole('navigation').getByRole('link', { name: 'تسجيل الدخول' })
  await expect(login).toBeInViewport()
  await login.click()
  await expect(page).toHaveURL(/\/login$/)
})


test('root entry offers direct sign-in before choosing a market', async ({ page }) => {
  await guest(page, 'en')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  const login = page.getByRole('link', { name: /تسجيل الدخول.*Sign in/ })
  await expect(login).toBeInViewport()
  await login.click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible()
})
