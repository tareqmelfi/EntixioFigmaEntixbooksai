import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import path from 'node:path'

const solutionRoutes = [
  'accountants',
  'small-business',
  'enterprises',
  'restaurants',
  'ecommerce',
] as const
const placeholderCopy = /قريباً|قريبًا|coming soon/i

async function setPreferences(page: import('@playwright/test').Page, language: 'en' | 'ar', region: 'SA' | 'US') {
  await page.addInitScript(({ language, region }) => {
    localStorage.setItem('entix-language', language)
    localStorage.setItem('entix-marketing-region', region)
  }, { language, region })
}

async function mainText(page: import('@playwright/test').Page) {
  return page.locator('main').innerText()
}

function parseRgb(value: string) {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${value}`)
  return channels
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = parseRgb(color).map((channel) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test.describe('/solutions/accountants', () => {
  test('is a substantial page with no placeholder copy and clear actions', async ({ page }) => {
    await setPreferences(page, 'en', 'SA')
    await page.goto('/solutions/accountants')

    const main = page.locator('main[data-page="solutions-accountants"]')
    await expect(main).toBeVisible()
    expect(await main.locator('section[data-section]').count()).toBeGreaterThanOrEqual(5)
    await expect(main).not.toContainText(placeholderCopy)
    await expect(main.getByRole('link', { name: /sign up|start free/i }).first()).toBeVisible()
    await expect(main.getByRole('link', { name: /accountant workflow|explore.*workflow/i }).first()).toBeVisible()
  })

  test('switches between complete English LTR and Arabic RTL content', async ({ page }) => {
    await setPreferences(page, 'en', 'SA')
    await page.goto('/solutions/accountants')

    const main = page.locator('main[data-page="solutions-accountants"]')
    await expect(main).toHaveAttribute('dir', 'ltr')
    await expect(main.getByRole('heading', { level: 1 })).toContainText(/account/i)
    await expect(main).toContainText(/client portfolio/i)

    await page.getByRole('navigation').getByRole('button', { name: /switch language to arabic/i }).click()
    await expect(main).toHaveAttribute('dir', 'rtl')
    await expect(main.getByRole('heading', { level: 1 })).toContainText(/المحاسب/)
    await expect(main).toContainText(/محفظة العملاء/)
  })

  test('keeps Saudi and US market content independent', async ({ page }) => {
    await setPreferences(page, 'en', 'SA')
    await page.goto('/solutions/accountants')

    const market = page.locator('[data-section="market-compliance"]')
    await expect(market).toContainText(/Saudi|ZATCA|VAT|compliance/i)

    const navbar = page.getByRole('navigation')
    await navbar.getByRole('button', { name: /select country/i }).click()
    await navbar.getByRole('option', { name: /United States/i }).click()
    await expect(market).toContainText(/United States/i)
    await expect(market).toContainText(/sales tax/i)
    await expect(market).toContainText(/1099/i)
    await expect(market).toContainText(/bank feeds/i)
    const usMainText = await mainText(page)
    expect(usMainText).not.toMatch(/Saudi|ZATCA|VAT|السعودية|سعودي|زاتكا|ضريبة القيمة المضافة/i)
  })

  test('uses accessible high-contrast text in the dark market section', async ({ page }) => {
    await setPreferences(page, 'en', 'SA')
    await page.goto('/solutions/accountants')

    const market = page.locator('[data-section="market-compliance"]')
    const sectionBackground = await market.evaluate((element) => getComputedStyle(element).backgroundColor)
    for (const selector of ['[data-heading-eyebrow]', '[data-heading-title]', '[data-heading-description]']) {
      const textColor = await market.locator(selector).evaluate((element) => getComputedStyle(element).color)
      const ratio = contrastRatio(textColor, sectionBackground)
      test.info().annotations.push({ type: 'contrast', description: `${selector}: ${ratio.toFixed(2)}:1` })
      expect(ratio, selector).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('does not overflow horizontally on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setPreferences(page, 'en', 'US')
    await page.goto('/solutions/accountants')
    await expect(page.locator('main[data-page="solutions-accountants"]')).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1)
  })
})

test('all five public solution routes are substantial and placeholder-free', async ({ page }) => {
  await setPreferences(page, 'en', 'SA')
  for (const slug of solutionRoutes) {
    await page.goto(`/solutions/${slug}`)
    const main = page.locator(`main[data-page="solutions-${slug}"]`)
    await expect(main, slug).toBeVisible()
    expect(await main.locator('section[data-section]').count(), slug).toBeGreaterThanOrEqual(5)
    expect(await mainText(page), slug).not.toMatch(placeholderCopy)
  }
})

test('solution source and production route gates reject placeholder implementations', async () => {
  const root = path.resolve(process.cwd())
  const [solutions, routes, audit, worker, dockerignore, workflow] = await Promise.all([
    readFile(path.join(root, 'src/app/pages/solutions.tsx'), 'utf8'),
    readFile(path.join(root, 'src/app/routes.tsx'), 'utf8'),
    readFile(path.join(root, 'scripts/qa-route-audit.mjs'), 'utf8'),
    readFile(path.join(root, 'worker.js'), 'utf8'),
    readFile(path.join(root, '.dockerignore'), 'utf8'),
    readFile(path.join(root, '.github/workflows/qa.yml'), 'utf8'),
  ])

  expect(solutions).not.toMatch(/PlaceholderPage|قريباً|قريبًا|Coming soon/i)
  for (const slug of solutionRoutes) {
    expect(routes).toContain(`/solutions/${slug}`)
    expect(audit).toContain(`/solutions/${slug}`)
    expect(worker).toContain(`/solutions/${slug}`)
    const marker = `solutions-${slug}`
    expect(solutions).toMatch(new RegExp(`(?:data-page=|pageMarker:)\\s*["'{]*${marker}`))
  }
  expect(audit).toMatch(/data-page|content density|substantive/i)
  expect(audit).toMatch(/PlaceholderPage|قريباً|قريبًا|Coming soon/i)
  expect(audit).not.toContain('slug === "accountants"')
  expect(audit).toMatch(/\/api\/auth\/get-session/)
  expect(audit).toMatch(/\/me/)
  expect(audit).not.toMatch(/target\.solutionSlug[\s\S]{0,120}429/)
  expect(worker).not.toMatch(/MARKETING_PREFIXES\s*=\s*\[[^\]]*['"]\/solutions\//s)

  expect(dockerignore).toMatch(/^\.env\.local$/m)
  expect(dockerignore).toMatch(/^\.env\.\*$/m)
  expect(dockerignore).toMatch(/^!\.env\.example$/m)
  expect(dockerignore).toMatch(/^\*\.pem$/m)
  expect(dockerignore).toMatch(/^\*\.key$/m)
  expect(dockerignore).toMatch(/^\*credentials\*$/m)

  expect(workflow).not.toContain('npm run qa:solutions')
  expect(workflow.match(/playwright test/g) ?? []).toHaveLength(3)
  expect(workflow).toContain('playwright test --reporter=list')
  expect(workflow).toContain('playwright test tests/visual-regression.spec.ts')
  expect(workflow).toContain('npm run test:visual-contracts')
  expect(workflow).toContain('npm run qa:visual-policy')
  expect(workflow).toContain('npm run qa:routes')
  expect(workflow).toContain("QA_ROUTE_SCOPE: 'solutions'")
})

test('scoped route audit starts and stops its Vite server promptly', async () => {
  test.setTimeout(70_000)
  const root = path.resolve(process.cwd())
  const port = '5198'
  const api = createServer((request, response) => {
    const cors = {
      'access-control-allow-origin': 'http://127.0.0.1:5198',
      'access-control-allow-credentials': 'true',
    }
    if (request.url === '/api/auth/get-session') {
      response.writeHead(429, { ...cors, 'content-type': 'application/json' }).end('{}')
      return
    }
    response.writeHead(404, cors).end('{}')
  })
  await new Promise<void>((resolve) => api.listen(5197, '127.0.0.1', resolve))
  const startedAt = Date.now()
  const child = spawn(process.execPath, [path.join(root, 'scripts/qa-route-audit.mjs')], {
    cwd: root,
    env: {
      ...process.env,
      VITE_API_URL: 'http://127.0.0.1:5197',
      QA_BASE_URL: `http://127.0.0.1:${port}`,
      QA_AUTO_START: '1',
      QA_BROWSER: '1',
      QA_ROUTE_SCOPE: 'solutions',
      QA_REPORT_DIR: path.join(root, 'test-results', 'route-audit-lifecycle'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`route audit did not exit within 60s\n${output}`))
    }, 60_000)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  }).finally(() => new Promise<void>((resolve) => api.close(() => resolve())))

  expect(exit, output).toEqual({ code: 0, signal: null })
  expect(output).toContain('Routes: 5/5 passed')
  expect(Date.now() - startedAt).toBeLessThan(60_000)
})
