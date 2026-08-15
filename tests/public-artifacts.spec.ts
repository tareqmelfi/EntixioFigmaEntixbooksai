import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC_LOCALES, PUBLIC_MARKETS, PUBLIC_PAGES, localizedPath } from '../src/app/public-site-manifest'

const dist = path.resolve('dist')
const artifact = (urlPath: string) => path.join(dist, urlPath.replace(/^\//, ''), 'index.html')
const LEGACY_PRERENDER_ROUTES = [
  '/', '/features', '/pricing', '/referrals', '/about', '/contact', '/blog', '/docs', '/help',
  '/videos', '/glossary', '/case-studies', '/changelog', '/roadmap', '/partners', '/careers', '/team',
  '/integration', '/privacy', '/support/ios', '/terms', '/refund', '/sla',
  '/solutions/small-business', '/solutions/accountants', '/solutions/enterprises',
  '/solutions/restaurants', '/solutions/ecommerce',
  '/login', '/register', '/forgot-password', '/reset-password',
] as const

for (const market of PUBLIC_MARKETS) {
  for (const locale of PUBLIC_LOCALES) {
    test(`raw artifacts are complete for ${market}/${locale}`, async () => {
      for (const page of PUBLIC_PAGES) {
        const route = localizedPath(market, locale, page.path)
        const html = await readFile(artifact(route), 'utf8')
        const canonical = `https://entix.io${route}`
        expect(html, route).toContain(`<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`)
        expect(html, route).toContain(`<link rel="canonical" href="${canonical}">`)
        expect(html, route).toContain(`<meta property="og:url" content="${canonical}">`)
        expect(html, route).toMatch(/<meta property="og:locale" content="(?:ar|en)_(?:SA|US)">/)
        expect(html, route).toContain('<meta name="twitter:card" content="summary_large_image">')
        expect(html, route).toContain('<script type="application/ld+json" data-public-seo>')
        expect(html.match(/rel="alternate" hreflang=/g), route).toHaveLength(5)
        expect(html, route).toContain('hreflang="x-default" href="https://entix.io/"')
      }
    })
  }
}

test('all supported legacy routes keep real prerendered artifacts instead of neutral-root shell substitution', async () => {
  const neutralRoot = await readFile(path.join(dist, 'index.html'), 'utf8')
  expect(LEGACY_PRERENDER_ROUTES).toHaveLength(32)

  for (const route of LEGACY_PRERENDER_ROUTES.filter((item) => item !== '/')) {
    const html = await readFile(artifact(route), 'utf8')
    expect(html, route).toContain(`<link rel="canonical" href="https://entix.io${route}">`)
    expect(html, route).not.toBe(neutralRoot)
    expect(html, route).not.toContain('data-page="market-locale-chooser"')
  }

  expect(await readFile(artifact('/solutions/accountants'), 'utf8')).toContain('data-page="solutions-accountants"')
  expect(await readFile(artifact('/support/ios'), 'utf8')).toContain('iOS Support · ENTIX.IO')
  expect(await readFile(artifact('/privacy'), 'utf8')).toContain('Privacy Policy · ENTIX.IO')
})

test('neutral root raw document has neutral metadata and x-default', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8')
  expect(html).toContain('<html lang="en" dir="ltr">')
  expect(html).toContain('<link rel="canonical" href="https://entix.io/">')
  expect(html).toContain('hreflang="x-default" href="https://entix.io/"')
  expect(html).not.toMatch(/priceCurrency|ZATCA|Saudi VAT|SAR/)
})

test('US English raw artifacts contain no Arabic codepoints or Saudi-only concepts', async () => {
  for (const page of PUBLIC_PAGES) {
    const route = localizedPath('us', 'en', page.path)
    const html = await readFile(artifact(route), 'utf8')
    expect(html, route).not.toMatch(/[\u0600-\u06ff]/)
    expect(html, route).not.toMatch(/\b(?:ZATCA|SAR|Saudi VAT|GOSI|Mudad|Mada)\b/i)
  }
})

test('generated sitemap contains only manifest indexable localized URLs', async () => {
  const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8')
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  const expected = PUBLIC_MARKETS.flatMap((market) => PUBLIC_LOCALES.flatMap((locale) =>
    PUBLIC_PAGES.filter((page) => page.indexable).map((page) => `https://entix.io${localizedPath(market, locale, page.path)}`),
  ))
  expect(locations).toEqual(expected)
  expect(sitemap).not.toContain('/marketplace/accountants')
})

test('production routing serves exact artifacts and rejects unsupported localized or public paths', async () => {
  const [dockerfile, worker, prerender] = await Promise.all([
    readFile(path.resolve('Dockerfile'), 'utf8'),
    readFile(path.resolve('worker.js'), 'utf8'),
    readFile(path.resolve('scripts/prerender.mjs'), 'utf8'),
  ])
  expect(dockerfile).toContain('location = /us/en { try_files /us/en/index.html =404; }')
  expect(dockerfile).toContain('absolute_redirect off;')
  expect(dockerfile).toContain('if ($host = "www.entix.io")')
  expect(dockerfile).toContain('return 308 https://entix.io$request_uri;')
  expect(dockerfile).toContain('location ~ ^/(features|pricing|referrals|about|contact|blog|docs|help|videos|glossary|case-studies|changelog|roadmap|partners|careers|team|integration|privacy|terms|refund|sla|login|register|forgot-password|reset-password)/$')
  expect(dockerfile).toContain('return 308 /$1$is_args$args;')
  expect(dockerfile).toContain('location ~ ^/(solutions/(?:small-business|accountants|enterprises|restaurants|ecommerce)|support/ios)/$')
  expect(dockerfile).toContain('location ~ ^/(?:sa|us)/(?:ar|en)(?:/|$) { return 404; }')
  expect(dockerfile).toContain('try_files $uri/index.html =404;')
  expect(dockerfile).toContain('location / { try_files $uri =404; }')
  expect(dockerfile).not.toContain('/marketplace/accountants')
  expect(worker).not.toContain("'/marketplace/accountants'")
  expect(prerender).toContain('const REQUESTED_PORT = Number(process.env.PRERENDER_PORT || 0)')
  expect(prerender).toContain("server.listen(REQUESTED_PORT, '127.0.0.1', resolve)")
  expect(prerender).toContain('async function withRendererPage')
  expect(prerender).toContain('const page = await browser.newPage()')
  expect(prerender).toMatch(/finally \{[\s\S]*?page\.close\(\)/)
})
