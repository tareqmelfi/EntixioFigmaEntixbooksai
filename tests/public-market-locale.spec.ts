import { expect, test, type Page } from '@playwright/test'
import {
  localizedPath,
  parsePublicPath,
  PUBLIC_LOCALES,
  PUBLIC_MARKETS,
  PUBLIC_PAGES,
} from '../src/app/public-site-manifest'

async function expectLocaleState(page: Page, market: 'SA' | 'US', locale: 'ar' | 'en') {
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect.poll(() => page.evaluate(() => ({
    language: localStorage.getItem('entix-language'),
    market: localStorage.getItem('entix-marketing-region'),
  }))).toEqual({ language: locale, market })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({
    v: 1, choice: 'essential', analytics: false, marketing: false, at: '2026-08-15T00:00:00.000Z',
  })))
})

test('manifest produces the complete deterministic market and locale matrix', () => {
  expect(PUBLIC_MARKETS).toEqual(['sa', 'us'])
  expect(PUBLIC_LOCALES).toEqual(['ar', 'en'])
  expect(PUBLIC_PAGES.map((page) => page.path)).toEqual([''])
  expect(parsePublicPath('/us/en/pricing')).toBeNull()

  for (const market of PUBLIC_MARKETS) {
    for (const locale of PUBLIC_LOCALES) {
      for (const page of PUBLIC_PAGES) {
        const path = localizedPath(market, locale, page.path)
        expect(parsePublicPath(path)).toEqual({ market, locale, pagePath: page.path })
        expect(path.endsWith('/') && path !== '/').toBe(false)
      }
    }
  }
})

test('neutral root is a chooser and does not silently select stored preferences', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'ar')
    localStorage.setItem('entix-marketing-region', 'SA')
  })
  await page.goto('/')

  await expect(page.locator('main[data-page="market-locale-chooser"]')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('link', { name: /United States.*English/i })).toHaveAttribute('href', '/us/en')
})

test('explicit URL wins synchronously over localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'ar')
    localStorage.setItem('entix-marketing-region', 'SA')
  })
  await page.goto('/us/en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  const navbar = page.getByRole('navigation')
  await expect(navbar.getByRole('button', { name: /select country/i })).toContainText('United States')
  await expect(navbar.getByRole('button', { name: /switch language to arabic/i })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('entix-language'))).toBe('en')
  expect(await page.evaluate(() => localStorage.getItem('entix-marketing-region'))).toBe('US')
})

test('navbar selectors preserve the current page and change one dimension', async ({ page }) => {
  await page.goto('/us/en?source=test')

  const navbar = page.getByRole('navigation')
  await navbar.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/us\/ar\?source=test$/)

  await navbar.getByRole('button', { name: /اختيار الدولة|select country/i }).click()
  await navbar.getByRole('option', { name: /السعودية|Saudi Arabia/i }).click()
  await expect(page).toHaveURL(/\/sa\/ar\?source=test$/)
})

test('browser back and forward keep URL, language, and market synchronized', async ({ page }) => {
  await page.goto('/us/en')
  const navbar = page.getByRole('navigation')
  await navbar.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/us\/ar$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

  await page.goBack()
  await expect(page).toHaveURL(/\/us\/en$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(navbar.getByRole('button', { name: /select country/i })).toContainText('United States')

  await navbar.getByRole('button', { name: /select country/i }).click()
  await navbar.getByRole('option', { name: /Saudi Arabia/i }).click()
  await expect(page).toHaveURL(/\/sa\/en$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/us\/en$/)
  await expect(navbar.getByRole('button', { name: /select country/i })).toContainText('United States')
})

test('US English rendered document contains no Arabic or Saudi-only concepts', async ({ page }) => {
  for (const publicPage of PUBLIC_PAGES) {
    const route = localizedPath('us', 'en', publicPage.path)
    await page.goto(route)
    const documentText = await page.locator('html').innerText()
    expect(documentText, route).not.toMatch(/[\u0600-\u06ff]/)
    expect(documentText, route).not.toMatch(/\b(?:ZATCA|SAR|Saudi VAT|GOSI|Mudad|Mada)\b/i)
    await expect(page.locator('body')).toContainText(/Plaid.*Beta|Beta.*Plaid/i)
  }
})

test('canonical US English is applied before the first rendered frame despite Arabic Saudi storage', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'ar')
    localStorage.setItem('entix-marketing-region', 'SA')
    localStorage.setItem('entix_cookie_consent_v1', JSON.stringify({ v: 1, choice: 'essential' }))
    const mismatches: string[] = []
    const observe = () => {
      if (!document.body) return requestAnimationFrame(observe)
      new MutationObserver(() => {
        if (document.querySelector('#root')?.childElementCount
          && (document.documentElement.lang !== 'en' || document.documentElement.dir !== 'ltr')) {
          mismatches.push(`${document.documentElement.lang}:${document.documentElement.dir}`)
        }
      }).observe(document.querySelector('#root')!, { attributes: true, childList: true, subtree: true })
    }
    observe()
    ;(window as Window & { __localeMismatches?: string[] }).__localeMismatches = mismatches
  })

  await page.goto('/us/en')
  await expectLocaleState(page, 'US', 'en')
  expect(await page.evaluate(() => (window as Window & { __localeMismatches?: string[] }).__localeMismatches)).toEqual([])
  await context.close()
})

for (const route of ['/sa/ar', '/sa/en', '/us/ar', '/us/en'] as const) {
  test(`${route} beats opposite stored market and locale`, async ({ page }) => {
    const parsed = parsePublicPath(route)!
    await page.addInitScript(({ locale, market }) => {
      localStorage.setItem('entix-language', locale === 'ar' ? 'en' : 'ar')
      localStorage.setItem('entix-marketing-region', market === 'sa' ? 'US' : 'SA')
    }, parsed)

    await page.goto(route)
    await expectLocaleState(page, parsed.market === 'sa' ? 'SA' : 'US', parsed.locale)
  })
}

test('React Router navigation plus back and forward never expose route and context mismatches', async ({ page }) => {
  await page.goto('/us/en')
  await page.evaluate(() => {
    const mismatches: string[] = []
    const sample = () => {
      const match = location.pathname.match(/^\/(sa|us)\/(ar|en)$/)
      if (!match) return
      const expectedMarket = match[1].toUpperCase()
      if (document.documentElement.lang !== match[2]
        || document.documentElement.dir !== (match[2] === 'ar' ? 'rtl' : 'ltr')
        || localStorage.getItem('entix-language') !== match[2]
        || localStorage.getItem('entix-marketing-region') !== expectedMarket) {
        mismatches.push(`${location.pathname}:${document.documentElement.lang}:${localStorage.getItem('entix-marketing-region')}`)
      }
    }
    new MutationObserver(sample).observe(document, { attributes: true, childList: true, subtree: true })
    window.addEventListener('popstate', () => queueMicrotask(sample))
    ;(window as Window & { __routeContextMismatches?: string[] }).__routeContextMismatches = mismatches
  })

  const navbar = page.getByRole('navigation')
  await navbar.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/us\/ar$/)
  await expectLocaleState(page, 'US', 'ar')
  await page.goBack()
  await expectLocaleState(page, 'US', 'en')
  await page.goForward()
  await expectLocaleState(page, 'US', 'ar')
  expect(await page.evaluate(() => (window as Window & { __routeContextMismatches?: string[] }).__routeContextMismatches)).toEqual([])
})

test('footer selector preserves query and hash while changing locale then market', async ({ page }) => {
  await page.goto('/us/en?source=test#pricing')
  const footer = page.locator('footer')

  await footer.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/us\/ar\?source=test#pricing$/)
  await expectLocaleState(page, 'US', 'ar')

  await footer.getByRole('button', { name: /اختيار الدولة|select country/i }).click()
  await footer.getByRole('option', { name: /السعودية|Saudi Arabia/i }).click()
  await expect(page).toHaveURL(/\/sa\/ar\?source=test#pricing$/)
  await expectLocaleState(page, 'SA', 'ar')
})

test('footer selector on an unprefixed legacy page changes context and storage without changing URL', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'en')
    localStorage.setItem('entix-marketing-region', 'US')
  })
  await page.goto('/privacy?source=test#rights')
  const footer = page.locator('footer')

  await footer.getByRole('button', { name: /switch language to arabic/i }).click()
  await expect(page).toHaveURL(/\/privacy\?source=test#rights$/)
  await footer.getByRole('button', { name: /اختيار الدولة|select country/i }).click()
  await footer.getByRole('option', { name: /السعودية|Saudi Arabia/i }).click()
  await expect(page).toHaveURL(/\/privacy\?source=test#rights$/)
  await expectLocaleState(page, 'SA', 'ar')
})

test('navbar footer and chat never emit unsupported prefixed links', async ({ page }) => {
  await page.goto('/us/en')
  await page.getByRole('button', { name: /assistant chat/i }).click()
  const hrefs = await page.locator('nav a[href], footer a[href]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
  )

  for (const href of hrefs) {
    const pathname = new URL(href, 'https://entix.io').pathname
    if (/^\/(?:sa|us)\/(?:ar|en)(?:\/|$)/.test(pathname)) {
      expect(parsePublicPath(pathname), href).not.toBeNull()
    }
  }
})

test('public legacy pages ignore account locale and never write an account preference', async ({ page }) => {
  let meReads = 0
  let localeWrites = 0
  await page.addInitScript(() => localStorage.setItem('entix-language', 'en'))
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') return route.fulfill({ json: { user: {
      id: 'locale-user', email: 'locale@example.com', name: 'Locale User', createdAt: '2026-08-15T00:00:00.000Z',
    } } })
    if (pathname === '/me') {
      meReads += 1
      return route.fulfill({ json: { id: 'locale-user', locale: 'ar', memberships: [] } })
    }
    if (pathname === '/me/preferences') {
      if (route.request().postDataJSON()?.locale) localeWrites += 1
      return route.fulfill({ json: {} })
    }
    if (pathname === '/me/bootstrap') return route.fulfill({ status: 503, json: {} })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/privacy')
  await expect.poll(() => meReads).toBeGreaterThan(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  expect(await page.evaluate(() => localStorage.getItem('entix-language'))).toBe('en')
  expect(localeWrites).toBe(0)
})

test('protected shell applies account Arabic before its first frame without duplicate me requests', async ({ page }) => {
  let meReads = 0
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'en')
    localStorage.setItem('entix_org_id', 'locale-org')
    const wrongFrames: string[] = []
    const observer = new MutationObserver(() => {
      const shell = document.querySelector('#root > div[dir]')
      if (shell && shell.getAttribute('dir') !== 'rtl') wrongFrames.push(shell.getAttribute('dir') || 'missing')
    })
    observer.observe(document, { childList: true, subtree: true, attributes: true })
    ;(window as Window & { __wrongProtectedLocaleFrames?: string[] }).__wrongProtectedLocaleFrames = wrongFrames
  })
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') return route.fulfill({ json: { user: {
      id: 'locale-user', email: 'locale@example.com', name: 'Locale User', createdAt: '2026-08-15T00:00:00.000Z',
    } } })
    if (pathname === '/me') {
      meReads += 1
      return route.fulfill({ json: {
        locale: 'ar', selectedOrgId: 'locale-org', defaultOrgId: 'locale-org',
        memberships: [{ role: 'OWNER', createdAt: '2026-08-15T00:00:00.000Z', org: { id: 'locale-org', name: 'Locale Org', country: 'US' } }],
      } })
    }
    if (pathname === '/api/notifications') return route.fulfill({ json: { items: [], count: 0 } })
    if (pathname === '/api/notifications/count') return route.fulfill({ json: { unread: 0 } })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/app')
  await expect(page.locator('#root > div[dir="rtl"]')).toBeVisible()
  expect(meReads).toBe(1)
  expect(await page.evaluate(() => (window as Window & { __wrongProtectedLocaleFrames?: string[] }).__wrongProtectedLocaleFrames)).toEqual([])
})

test('client navigation from canonical login to app applies account locale before the protected shell frame', async ({ page }) => {
  let meReads = 0
  let releaseSession = () => {}
  const sessionGate = new Promise<void>(resolve => { releaseSession = resolve })

  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'en')
    localStorage.setItem('entix-marketing-region', 'US')
    localStorage.setItem('entix_org_id', 'locale-org')
    const wrongFrames: string[] = []
    new MutationObserver(() => {
      const shell = document.querySelector('#root > div[class~="h-dvh"][dir]')
      if (shell && (shell.getAttribute('dir') !== 'rtl'
        || document.documentElement.lang !== 'ar'
        || document.documentElement.dir !== 'rtl')) {
        wrongFrames.push(`${shell.getAttribute('dir')}:${document.documentElement.lang}:${document.documentElement.dir}`)
      }
    }).observe(document, { childList: true, subtree: true, attributes: true })
    ;(window as Window & { __wrongClientNavigationLocaleFrames?: string[] }).__wrongClientNavigationLocaleFrames = wrongFrames
  })
  await page.route('https://api.entix.io/**', async route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') {
      await sessionGate
      return route.fulfill({ json: { user: {
        id: 'locale-user', email: 'locale@example.com', name: 'Locale User', createdAt: '2026-08-15T00:00:00.000Z',
      } } })
    }
    if (pathname === '/me') {
      meReads += 1
      return route.fulfill({ json: {
        locale: 'ar', selectedOrgId: 'locale-org', defaultOrgId: 'locale-org',
        memberships: [{ role: 'OWNER', createdAt: '2026-08-15T00:00:00.000Z', org: { id: 'locale-org', name: 'Locale Org', country: 'US' } }],
      } })
    }
    if (pathname === '/auth-providers') return route.fulfill({ json: { emailPassword: true, google: false, microsoft: false } })
    if (pathname === '/api/notifications') return route.fulfill({ json: { items: [], count: 0 } })
    if (pathname === '/api/notifications/count') return route.fulfill({ json: { unread: 0 } })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/us/en')
  await expectLocaleState(page, 'US', 'en')
  await page.getByRole('navigation').getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  releaseSession()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.locator('#root > div[class~="h-dvh"][dir="rtl"]')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('entix-language'))).toBe('ar')
  await page.waitForTimeout(250)
  expect(meReads).toBe(1)
  expect(await page.evaluate(() => (window as Window & { __wrongClientNavigationLocaleFrames?: string[] }).__wrongClientNavigationLocaleFrames)).toEqual([])
})

test('authenticated explicit English selection writes once and reloads in English', async ({ context, page }) => {
  let accountLocale: 'ar' | 'en' = 'ar'
  const localeWrites: unknown[] = []
  await page.addInitScript(() => {
    localStorage.setItem('entix-language', 'ar')
    localStorage.setItem('entix_org_id', 'locale-org')
  })
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') return route.fulfill({ json: { user: {
      id: 'locale-user', email: 'locale@example.com', name: 'Locale User', createdAt: '2026-08-15T00:00:00.000Z',
    } } })
    if (pathname === '/me') return route.fulfill({ json: {
      locale: accountLocale, selectedOrgId: 'locale-org', defaultOrgId: 'locale-org',
      memberships: [{ role: 'OWNER', createdAt: '2026-08-15T00:00:00.000Z', org: { id: 'locale-org', name: 'Locale Org', country: 'US' } }],
    } })
    if (pathname === '/me/preferences') {
      const body = route.request().postDataJSON()
      if (body?.locale) {
        localeWrites.push(body)
        accountLocale = body.locale
      }
      return route.fulfill({ json: { locale: accountLocale } })
    }
    if (pathname === '/api/notifications') return route.fulfill({ json: { items: [], count: 0 } })
    if (pathname === '/api/notifications/count') return route.fulfill({ json: { unread: 0 } })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/app')
  const languageButton = page.locator('header').getByRole('button', { name: /تغيير اللغة إلى الإنجليزية/ })
  await languageButton.click()
  await expect(page.locator('#root > div[dir="ltr"]')).toBeVisible()
  await expect.poll(() => localeWrites.length).toBe(1)
  expect(localeWrites).toEqual([{ locale: 'en' }])

  await page.reload()
  await expect(page.locator('#root > div[dir="ltr"]')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('entix-language'))).toBe('en')
  expect(localeWrites).toHaveLength(1)
})

test('visiting an authenticated canonical URL does not write its locale to the account', async ({ page }) => {
  let meReads = 0
  let localeWrites = 0
  await page.addInitScript(() => localStorage.setItem('entix-language', 'ar'))
  await page.route('https://api.entix.io/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/auth/get-session') return route.fulfill({ json: { user: { id: 'canonical-user' } } })
    if (pathname === '/me') {
      meReads += 1
      return route.fulfill({ json: { locale: 'ar', memberships: [] } })
    }
    if (pathname === '/me/preferences') {
      if (route.request().postDataJSON()?.locale) localeWrites += 1
      return route.fulfill({ json: {} })
    }
    if (pathname === '/me/bootstrap') return route.fulfill({ status: 503, json: {} })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/us/en')
  await expect.poll(() => meReads).toBeGreaterThan(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(localeWrites).toBe(0)
})

for (const placement of ['navbar', 'footer'] as const) {
  test(`${placement} country selector supports keyboard selection, Escape, and outside close`, async ({ page }) => {
    await page.goto('/us/en')
    const scope = placement === 'navbar' ? page.getByRole('navigation') : page.locator('footer')
    const trigger = scope.getByRole('button', { name: /select country/i })
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')

    await trigger.focus()
    await trigger.press('ArrowDown')
    const listbox = scope.getByRole('listbox', { name: /select country/i })
    await expect(listbox).toBeVisible()
    await expect(listbox.getByRole('option', { name: /United States/i })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(listbox.getByRole('option', { name: /Saudi Arabia/i })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(listbox).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.press('Enter')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/sa\/en$/)

    await trigger.click()
    await expect(scope.getByRole('listbox', { name: /select country/i })).toBeVisible()
    await page.mouse.click(5, 200)
    await expect(scope.getByRole('listbox', { name: /select country/i })).toBeHidden()
  })
}
