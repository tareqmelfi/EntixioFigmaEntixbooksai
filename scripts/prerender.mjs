import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { preserveAppShell } from './app-shell.mjs'
import {
  PUBLIC_LOCALES, PUBLIC_MARKETS, PUBLIC_PAGES, SITE_ORIGIN,
  canonicalUrl, localeDirection, localizedPath, ogLocale,
} from '../src/app/public-site-manifest.ts'

const DIST = path.resolve('dist')
preserveAppShell(DIST)
const REQUESTED_PORT = Number(process.env.PRERENDER_PORT || 0)
const SOLUTION_ROUTES = new Set([
  '/solutions/accountants', '/solutions/small-business', '/solutions/enterprises',
  '/solutions/restaurants', '/solutions/ecommerce', '/solutions/contracting', '/solutions/freelancers', '/solutions/agencies',
])
const PLACEHOLDER_SIGNATURES = [/قريباً/i, /قريبًا/i, /coming soon/i]

// Baseline public artifacts remain available at their established unprefixed URLs.
// The localized manifest is additive and deliberately constrained to separated copy.
// Titles/descriptions match the rendered language of each document (legacy routes
// render English): unique, descriptive, brand-suffixed (Google SEO starter guide ·
// SEO-02 2026-10-11). Placeholder ("coming soon") routes are prerendered for a clean
// 200 but carry noindex and are excluded from the sitemap until real content ships.
const META = {
  '/': ['Entix Books · Arabic-first cloud accounting | ENTIX.IO', 'Arabic-first cloud accounting for Saudi and US businesses: quotes, invoices, receipts, automatic journal entries, POS and inventory. Start free, no card.'],
  '/features': ['Features — invoicing, expenses, banking, reports · Entix Books', 'Quotes to invoices to journal entries, OCR expenses, bank reconciliation, payroll, inventory, projects and financial reports — in Arabic and English.'],
  '/pricing': ['Pricing — start free, pay as you grow · Entix Books', 'Entix Books plans for Saudi and US businesses: a free starter plan, one free month on paid plans, no card required. Monthly or annual billing.'],
  '/referrals': ['Referral and partner program · Entix Books', 'Refer business owners to Entix Books: a discount for the new subscriber and a recurring commission for accredited partners and accountants.'],
  '/about': ['About Entix Books — bilingual cloud accounting by ENSIDEX LLC', 'Entix Books is bilingual Arabic/English cloud accounting for small and mid-sized businesses in Saudi Arabia and the US, built by ENSIDEX LLC, Wyoming.'],
  '/contact': ['Contact the Entix Books team · ENTIX.IO', 'Sales and product support for Entix Books: support@entix.io, the in-app support portal, privacy and legal contacts.'],
  '/blog': ['Blog · Entix Books', 'Accounting and product articles from the Entix Books team, in Arabic and English.'],
  '/docs': ['Documentation · Entix Books', 'Step-by-step guides for Entix Books in Arabic and English.'],
  '/help': ['Help center — invoicing, payments, reports · Entix Books', 'Answers about invoicing, payments and reports in Entix Books. ZATCA Phase 2 integration is under validation and not enabled for production reliance.'],
  '/videos': ['Video tutorials · Entix Books', 'Short video walkthroughs of Entix Books.'],
  '/glossary': ['Accounting glossary (Arabic / English) · Entix Books', 'Accounting terms explained simply in Arabic and English.'],
  '/case-studies': ['Customer stories · Entix Books', 'How businesses use Entix Books every day.'],
  '/changelog': ['Changelog · Entix Books', 'Latest features and fixes in Entix Books.'],
  '/careers': ['Careers · ENSIDEX', 'Join the team building Entix Books.'],
  '/team': ['Team · ENSIDEX', 'The people behind Entix Books.'],
  '/integration': ['Integrations and security — banks, payments, API · Entix Books', 'Bank feeds, Stripe payments, e-signature, API keys and security controls in Entix Books. ZATCA Phase 2 integration is under validation.'],
  '/privacy': ['Privacy Policy · ENTIX.IO', 'How ENTIX.IO handles account, organization, iOS app, upload, AI/OCR, retention, and deletion data.'],
  '/support/ios': ['iOS Support · ENTIX.IO', 'Official ENTIX.IO support for iPhone and iPad on iOS 17 or later, including sign-in, permissions, AI/OCR, privacy, and account deletion help.'],
  '/terms': ['Terms of Service · ENTIX.IO', 'Terms governing the use of the Entix Books platform by ENSIDEX LLC.'],
  '/refund': ['Refund policy · Entix Books', 'Refund terms for Entix Books subscriptions.'],
  '/sla': ['Service level agreement · Entix Books', 'Availability and support commitments for Entix Books.'],
  '/solutions/small-business': ['Accounting for Small Businesses · Entix Books', 'Run invoices, expenses, banking, and reports in one bilingual workspace, with Saudi and US market guidance.'],
  '/solutions/accountants': ['Accounting Workspace for Accountants · Entix Books', 'Review client documents, entries and controls, with Saudi VAT and US sales-tax reports, in one bilingual workspace. ZATCA Phase 2 is under validation.'],
  '/solutions/enterprises': ['Enterprise Accounting Controls · Entix Books', 'Organize branches, cost centers, user access, and exportable financial reports in a bilingual workspace.'],
  '/solutions/restaurants': ['Accounting for Restaurants and Cafés · Entix Books', 'Review restaurant sales, purchases, operating expenses, inventory movements, and financial reports.'],
  '/solutions/contracting': ["Contracting and engineering · Entix Books", "Track design and construction quotes, project progress, expenses and contractors in one workspace."],
  '/solutions/freelancers': ["Freelancers and consultants · Entix Books", "Organize service quotes, clients, projects and expenses, with Arabic or English documents and transaction currencies."],
  '/solutions/agencies': ["Agencies and services · Entix Books", "Connect campaign, design and development quotes with project delivery, tool and freelancer costs, and reports."],
  '/solutions/ecommerce': ['Accounting for Ecommerce · Entix Books', 'Organize store sales, payment fees, inventory, bank reconciliation, and profitability reporting.'],
  '/login': ['Sign in · Entix Books', 'Sign in to Entix Books — bilingual cloud accounting for invoices, expenses, banking and reports in Arabic and English.'],
  '/register': ['Create your account · Entix Books', 'Start your free month of Entix Books — no card required.'],
  '/forgot-password': ['Reset your password · Entix Books', 'Recover access to your Entix Books account.'],
  '/reset-password': ['Choose a new password · Entix Books', 'Set a new password for your Entix Books account.'],
}
// "Coming soon" documents: real 200 pages for visitors, but kept out of the index and
// the sitemap until they carry real content (thin-content rule). /roadmap and
// /partners are 308 redirects in nginx (they rendered /features and /referrals).
const PLACEHOLDER_ROUTES = new Set(['/blog', '/docs', '/videos', '/glossary', '/case-studies', '/changelog', '/careers', '/team', '/refund', '/sla'])

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon' }
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  let file = path.join(DIST, url === '/' ? 'index.html' : url)
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end() }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

let browser
let rendererOrigin
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(REQUESTED_PORT, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('prerender server did not expose a TCP port')
  rendererOrigin = `http://127.0.0.1:${address.port}`
  console.log(`prerender: serving dist/ on ${rendererOrigin}`)

  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  let renderedLegacy = 0
  const failures = []
  for (const [route, metadata] of Object.entries(META)) {
    if (route === '/') continue
    try {
      await renderLegacyRoute(route, metadata)
      renderedLegacy += 1
    } catch (error) {
      failures.push(`${route} (${String(error).slice(0, 120)})`)
    }
  }
  if (failures.length) throw new Error(`legacy prerender failures:\n${failures.join('\n')}`)

  await renderNeutralRoot()
  let renderedLocalized = 0
  for (const market of PUBLIC_MARKETS) {
    for (const locale of PUBLIC_LOCALES) {
      for (const definition of PUBLIC_PAGES) {
        await renderLocalizedRoute(market, locale, definition)
        renderedLocalized += 1
      }
    }
  }
  writeSitemap()
  writeEarlyHints()
  console.log(`prerender: ${renderedLegacy + 1}/${Object.keys(META).length} baseline routes and ${renderedLocalized} localized routes rendered`)
} finally {
  if (browser) await browser.close().catch(() => {})
  if (server.listening) await new Promise((resolve) => server.close(resolve))
}

async function withRendererPage(storage, render) {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1440, height: 900 })
    await page.evaluateOnNewDocument((values) => {
      localStorage.setItem('entix-language', values.locale)
      localStorage.setItem('entix-marketing-region', values.region)
      window.turnstile = {
        render: () => 'prerender-turnstile',
        reset: () => {},
        remove: () => {},
      }
    }, storage)
    return await render(page)
  } finally {
    if (!page.isClosed()) await page.close().catch(() => {})
  }
}

async function loadRoute(page, route) {
  try {
    await page.goto(`${rendererOrigin}${route}`, { waitUntil: 'networkidle0', timeout: 45000 })
  } catch {
    await page.goto(`${rendererOrigin}${route}`, { waitUntil: 'load', timeout: 45000 })
  }
  await page.waitForSelector('main, #root', { timeout: 10000 })
  await new Promise((resolve) => setTimeout(resolve, 1800))
}

async function renderLegacyRoute(route, [title, description]) {
  await withRendererPage({ locale: 'en', region: 'SA' }, async (page) => {
    await loadRoute(page, route)
    let html = await page.content()
    const canonical = `${SITE_ORIGIN}${route}`
    html = replaceRequired(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`, route, 'title')
    html = replaceRequiredMeta(html, 'name', 'description', description, route)
    html = replaceRequiredMeta(html, 'property', 'og:title', title, route)
    html = replaceRequiredMeta(html, 'property', 'og:description', description, route)
    html = replaceRequiredMeta(html, 'name', 'twitter:title', title, route)
    html = replaceRequiredMeta(html, 'name', 'twitter:description', description, route)
    html = upsertCanonical(html, canonical, route)
    html = upsertRequiredMeta(html, 'property', 'og:url', canonical, route)
    html = rewriteFontPreloads(html, /[\u0600-\u06ff]/.test(title) ? 'ar' : 'en')
    if (PLACEHOLDER_ROUTES.has(route)) html = insertHead(html, ['<meta name="robots" content="noindex, follow">'])
    await validateLegacyContent(page, route)
    writeArtifact(route, html)
    console.log(`  ✓ ${route} (${Math.round(html.length / 1024)}KB legacy)`)
  })
}

async function validateLegacyContent(page, route) {
  const main = await page.$eval('main', (element) => ({
    text: element.innerText.trim(),
    marker: element.getAttribute('data-page'),
    sections: element.querySelectorAll('section[data-section]').length,
  })).catch(async () => {
    const text = await page.$eval('#root', (root) => root.textContent?.trim() || '').catch(() => '')
    return text ? { text, marker: null, sections: 0 } : null
  })
  if (!main || main.text.length < 50) throw new Error('missing or empty primary content')
  if (!SOLUTION_ROUTES.has(route)) return
  const marker = `solutions-${route.split('/').pop()}`
  const placeholder = PLACEHOLDER_SIGNATURES.find((signature) => signature.test(main.text))
  if (main.marker !== marker) throw new Error(`missing marker ${marker}`)
  if (main.sections < 5) throw new Error(`${main.sections} substantive sections; need 5`)
  if (main.text.length < 500) throw new Error('insufficient main content density')
  if (placeholder) throw new Error('placeholder signature in main content')
}

async function renderNeutralRoot() {
  // Root = x-default en-US landing (2026-10-10). Rendered with the US region so
  // the document itself is the default-audience page — no client-side redirect.
  await withRendererPage({ locale: 'en', region: 'US' }, async (page) => {
    await loadRoute(page, '/')
    let html = cleanPublicSeo(await page.content())
    html = setHtmlLanguage(html, 'en', 'ltr')
    html = replaceTitle(html, 'Entix Books · Arabic-first cloud accounting | ENTIX.IO')
    html = replaceMeta(html, 'name', 'description', 'Arabic-first cloud accounting for Saudi and US businesses: quotes, invoices, receipts, automatic journal entries, POS and inventory. Start free, no card.')
    html = replaceMeta(html, 'property', 'og:title', 'Entix Books · Arabic-first cloud accounting')
    html = replaceMeta(html, 'property', 'og:description', 'Quotes → invoices → receipts → automatic journal entries · POS · inventory · projects. Built for Saudi Arabia and the United States. Start free — no card.')
    html = replaceMeta(html, 'name', 'twitter:title', 'Entix Books · Arabic-first cloud accounting')
    html = replaceMeta(html, 'name', 'twitter:description', 'Quotes → invoices → receipts → automatic journal entries · POS · inventory · projects. Built for Saudi Arabia and the United States. Start free — no card.')
    html = rewriteFontPreloads(html, 'en')
    const faq = await readFaq(page)
    html = insertHead(html, [
      `<link rel="canonical" href="${SITE_ORIGIN}/">`,
      ...alternateLinks(''),
      `<meta property="og:url" content="${SITE_ORIGIN}/">`,
      `<meta property="og:locale" content="en_US">`,
      `<script type="application/ld+json" data-public-seo>${jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'ENTIX.IO', alternateName: 'Entix Books', url: `${SITE_ORIGIN}/`, inLanguage: ['en', 'ar'], publisher: { '@id': `${SITE_ORIGIN}/#organization` } })}</script>`,
      `<script type="application/ld+json" data-public-seo>${jsonLd(organizationLd())}</script>`,
      `<script type="application/ld+json" data-public-seo>${jsonLd(softwareLd('en', 'us', `${SITE_ORIGIN}/`))}</script>`,
      ...(faq.length ? [`<script type="application/ld+json" data-public-seo>${jsonLd(faqLd(faq))}</script>`] : []),
    ])
    assertAbsent(html, /ZATCA|Saudi VAT|\bSAR\b/, '/', 'Saudi-only concepts on the en-US root')
    assertAbsent(html, /data-page="market-locale-chooser"/, '/', 'legacy chooser markup')
    fs.writeFileSync(path.join(DIST, 'index.html'), html)
    console.log("  ✓ / (root en-US landing · x-default)")
  })
}

async function renderLocalizedRoute(market, locale, definition) {
  const route = localizedPath(market, locale, definition.path)
  await withRendererPage({ locale, region: market === 'sa' ? 'SA' : 'US' }, async (page) => {
    await loadRoute(page, route)
    const title = definition.title[market][locale]
    const description = definition.description[market][locale]
    const canonical = canonicalUrl(market, locale, definition.path)
    let html = cleanPublicSeo(await page.content())
    html = setHtmlLanguage(html, locale, localeDirection(locale))
    html = rewriteFontPreloads(html, locale)
    html = replaceTitle(html, title)
    html = replaceMeta(html, 'name', 'description', description)
    html = replaceMeta(html, 'property', 'og:title', title)
    html = replaceMeta(html, 'property', 'og:description', description)
    html = replaceMeta(html, 'name', 'twitter:title', title)
    html = replaceMeta(html, 'name', 'twitter:description', description)
    const faq = await readFaq(page)
    html = insertHead(html, [
      `<link rel="canonical" href="${canonical}">`,
      ...alternateLinks(definition.path),
      `<meta property="og:url" content="${canonical}">`,
      `<meta property="og:locale" content="${ogLocale(market, locale)}">`,
      `<script type="application/ld+json" data-public-seo>${jsonLd(organizationLd())}</script>`,
      `<script type="application/ld+json" data-public-seo>${jsonLd({ ...softwareLd(locale, market, canonical), name: title, description })}</script>`,
      ...(faq.length ? [`<script type="application/ld+json" data-public-seo>${jsonLd(faqLd(faq))}</script>`] : []),
    ])
    if (market === 'us' && locale === 'en') {
      assertAbsent(html, /[\u0600-\u06ff]/, route, 'Arabic codepoints')
      assertAbsent(html, /\b(?:ZATCA|SAR|Saudi VAT|GOSI|Mudad|Mada)\b/i, route, 'Saudi-only concepts')
    }
    writeArtifact(route, html)
    console.log(`  ✓ ${route} (${Math.round(html.length / 1024)}KB localized)`)
  })
}

function writeArtifact(route, html) {
  const dir = path.join(DIST, route.replace(/^\//, ''))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

function cleanPublicSeo(html) {
  return html
    .replace(/<link\b(?=[^>]*\brel=["'](?:canonical|alternate)["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["'](?:og:url|og:locale)["'])[^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '')
}
function setHtmlLanguage(html, locale, dir) { return html.replace(/<html\b[^>]*>/i, `<html lang="${locale}" dir="${dir}">`) }
function replaceTitle(html, value) { return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(value)}</title>`) }
function metaPattern(attribute, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escaped}["'])[^>]*>`, 'i')
}
function replaceMeta(html, attribute, key, content) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`
  const pattern = metaPattern(attribute, key)
  return pattern.test(html) ? html.replace(pattern, tag) : insertHead(html, [tag])
}
function insertHead(html, tags) {
  if (!/<\/head>/i.test(html)) throw new Error('missing </head>')
  return html.replace(/<\/head>/i, `  ${tags.join('\n  ')}\n</head>`)
}
function alternateLinks(pagePath) {
  const tags = PUBLIC_MARKETS.flatMap((market) => PUBLIC_LOCALES.map((locale) =>
    `<link rel="alternate" hreflang="${locale}-${market.toUpperCase()}" href="${canonicalUrl(market, locale, pagePath)}">`,
  ))
  tags.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">`)
  return tags
}
// ── Sitemap · single source of truth (generated at build; overwrites the
// public/ fallback). Two blocks:
//   1. Localized canonical cluster — every indexable PUBLIC_PAGES page across
//      every market × locale, each carrying the full hreflang alternate set +
//      x-default (multi-region SEO; GSC "Discovered – currently not indexed"
//      on unprefixed URLs is avoided because canonicals self-reference).
//   2. Legacy unprefixed marketing pages from META — these still serve real
//      prerendered documents at their established URLs. Transactional and
//      private surfaces (/buy, /claim, /app, /portal, /print) are NEVER listed.
function hreflangCluster(pagePath) {
  const links = PUBLIC_MARKETS.flatMap((market) => PUBLIC_LOCALES.map((locale) =>
    `    <xhtml:link rel="alternate" hreflang="${locale}-${market.toUpperCase()}" href="${canonicalUrl(market, locale, pagePath)}" />`,
  ))
  // x-default is the root document for the landing cluster (matches the HTML
  // alternate set exactly — a sitemap/HTML x-default mismatch is a GSC error).
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pagePath ? canonicalUrl('us', 'en', pagePath) : `${SITE_ORIGIN}/`}" />`)
  return links
}
function writeSitemap() {
  // Computed at call time: top-level consts are not initialized yet when the
  // hoisted pipeline invokes this during early module evaluation (TDZ crash).
  const SITEMAP_LASTMOD = new Date().toISOString().slice(0, 10)
  const SITEMAP_LEGACY_EXCLUDE = new Set(['/forgot-password', '/reset-password', ...PLACEHOLDER_ROUTES])
  const LEGACY_PRIORITY = {
    '/features': ['weekly', '0.9'], '/pricing': ['weekly', '0.9'],
    '/solutions/small-business': ['monthly', '0.8'], '/solutions/accountants': ['monthly', '0.8'],
    '/solutions/enterprises': ['monthly', '0.8'], '/solutions/restaurants': ['monthly', '0.7'],
    '/solutions/ecommerce': ['monthly', '0.7'], '/solutions/contracting': ['monthly', '0.7'],
    '/solutions/freelancers': ['monthly', '0.7'], '/solutions/agencies': ['monthly', '0.7'],
    '/contact': ['monthly', '0.7'], '/integration': ['monthly', '0.6'], '/about': ['monthly', '0.6'],
    '/help': ['weekly', '0.6'], '/support/ios': ['monthly', '0.7'], '/register': ['yearly', '0.4'],
    '/privacy': ['yearly', '0.3'], '/terms': ['yearly', '0.3'], '/login': ['yearly', '0.2'],
  }
  const indexable = PUBLIC_PAGES.filter((page) => page.indexable)
  const localized = indexable.flatMap((page) =>
    PUBLIC_MARKETS.flatMap((market) => PUBLIC_LOCALES.filter((locale) => canonicalUrl(market, locale, page.path) !== `${SITE_ORIGIN}/`).map((locale) => [
      '  <url>', `    <loc>${canonicalUrl(market, locale, page.path)}</loc>`,
      ...hreflangCluster(page.path),
      `    <lastmod>${SITEMAP_LASTMOD}</lastmod>`,
      `    <changefreq>${page.changefreq}</changefreq>`, `    <priority>${page.priority}</priority>`, '  </url>',
    ].join('\n'))),
  )
  // Neutral root serves the chooser; it canonicals into the cluster above.
  const root = [
    '  <url>', `    <loc>${SITE_ORIGIN}/</loc>`, ...hreflangCluster(''),
    `    <lastmod>${SITEMAP_LASTMOD}</lastmod>`, '    <changefreq>weekly</changefreq>', '    <priority>1.0</priority>', '  </url>',
  ].join('\n')
  const legacy = Object.keys(META)
    .filter((route) => route !== '/' && !SITEMAP_LEGACY_EXCLUDE.has(route))
    .map((route) => {
      const [changefreq, priority] = LEGACY_PRIORITY[route] || ['monthly', '0.5']
      return [
        '  <url>', `    <loc>${SITE_ORIGIN}${route}</loc>`,
        `    <lastmod>${SITEMAP_LASTMOD}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`, '  </url>',
      ].join('\n')
    })
  // Static public documents that live in public/ (not prerendered routes).
  // /connect = "Connect Claude to Entix Books" (MCP connector guide · 2026-10-05).
  const staticDocs = [['/connect', 'monthly', '0.6'], ['/guides/zatca-onboarding-ar.html', 'monthly', '0.5']].map(([route, changefreq, priority]) => [
    '  <url>', `    <loc>${SITE_ORIGIN}${route}</loc>`,
    `    <lastmod>${SITEMAP_LASTMOD}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`, '  </url>',
  ].join('\n'))
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    root, ...localized, ...legacy, ...staticDocs, '</urlset>', '',
  ].join('\n'))
}
// ── Font preloads per locale (LCP · 2026-10-10) ───────────────────────────
// index.html preloads both scripts for the app shell. Public documents know
// their language at build time, so only the faces painted above the fold on
// that document are preloaded — an en-US visitor no longer downloads ~100KB of
// Arabic glyphs before first paint, and vice versa.
function fontPreloadsFor(locale) {
  // Inside the function on purpose: top-level consts are in TDZ when the hoisted
  // pipeline above runs (same reason writeSitemap computes its tables at call time).
  return locale === 'ar'
    ? ['IBMPlexSansArabic-400-arabic', 'IBMPlexSansArabic-600-arabic', 'IBMPlexSansArabic-700-arabic', 'IBMPlexSansArabic-400-latin']
    : ['IBMPlexSans-400-latin', 'InstrumentSerif-400i-latin', 'InstrumentSerif-400-latin']
}
function rewriteFontPreloads(html, locale) {
  const stripped = html.replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']font["'])[^>]*>\s*/gi, '')
  const tags = fontPreloadsFor(locale).map((name) =>
    `<link rel="preload" as="font" type="font/woff2" href="/fonts/${name}.woff2" crossorigin>`)
  // Keep them early in <head> (right after the viewport meta) so discovery is immediate.
  return stripped.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, `$1\n      ${tags.join('\n      ')}`)
}
// nginx `Link: rel=preload` header for the hashed stylesheet → Cloudflare Early
// Hints (103) lets the browser fetch the render-blocking CSS before the HTML
// body arrives (TTFB from the origin is ~1.4s for US visitors).
function writeEarlyHints() {
  const css = fs.readdirSync(path.join(DIST, 'assets')).filter((file) => /^index-[\w-]+\.css$/.test(file))
  if (css.length !== 1) throw new Error(`expected exactly one index-*.css in dist/assets, found ${css.length}`)
  const header = `add_header Link "</assets/${css[0]}>; rel=preload; as=style; crossorigin" always;\n`
  fs.writeFileSync(path.resolve('nginx-early-hints.conf'), header)
  console.log(`  ✓ early hints → /assets/${css[0]}`)
}
// ── Structured data (SEO-02 · 2026-10-11) ─────────────────────────────────
// One Organization entity (@id) referenced by every public document, a
// SoftwareApplication per market/locale with real offers, and FAQPage built
// from the landing's rendered FAQ so Google / AI answer engines can quote it.
// No sameAs yet: social profiles are added here once they exist (growth input 3).
function organizationLd() {
  return {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`,
    name: 'ENSIDEX LLC', alternateName: ['ENTIX.IO', 'Entix Books'], url: SITE_ORIGIN,
    logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/brand/EN-BRAND-LOGO-Wordmark-Light-BG.png` },
    brand: { '@type': 'Brand', name: 'Entix Books' },
    address: { '@type': 'PostalAddress', addressRegion: 'WY', addressCountry: 'US' },
    knowsLanguage: ['ar', 'en'],
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'support@entix.io', availableLanguage: ['ar', 'en'] }],
  }
}
function softwareLd(locale, market, url) {
  const sa = market === 'sa'
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Entix Books', alternateName: 'ENTIX.IO',
    url, applicationCategory: 'FinanceApplication', applicationSubCategory: 'Accounting software', operatingSystem: 'Web, iOS',
    inLanguage: locale, isAccessibleForFree: true, publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    areaServed: { '@type': 'Country', name: sa ? 'Saudi Arabia' : 'United States' },
    featureList: sa
      ? 'Quotes, invoices, receipts, automatic journal entries, expenses with OCR, bank reconciliation, inventory, POS, projects, payroll, VAT reports, Arabic and English documents'
      : 'Quotes, invoices, receipts, automatic journal entries, expenses with OCR, Stripe payments, Plaid bank feeds (beta), inventory, projects, sales-tax reports, Arabic and English documents',
    offers: { '@type': 'Offer', price: '0', priceCurrency: sa ? 'SAR' : 'USD', category: 'free', description: 'Starter plan — free, no card required' },
  }
}
function faqLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
}
async function readFaq(page) {
  return page.$$eval('[data-faq-item]', (nodes) => nodes.map((node) => ({
    q: node.querySelector('[data-faq-q]')?.textContent?.trim() || '',
    a: node.querySelector('[data-faq-a]')?.textContent?.trim() || '',
  })).filter((item) => item.q && item.a)).catch(() => [])
}
function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c') }
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') }
function assertAbsent(html, pattern, route, label) { if (pattern.test(html)) throw new Error(`${route}: forbidden ${label}`) }
function replaceRequired(html, pattern, replacement, route, label) {
  if (!pattern.test(html)) throw new Error(`${route}: missing required metadata ${label}`)
  return html.replace(pattern, replacement)
}
function replaceRequiredMeta(html, attribute, key, content, route) {
  return replaceRequired(html, metaPattern(attribute, key), `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`, route, key)
}
function upsertRequiredMeta(html, attribute, key, content, route) {
  const pattern = metaPattern(attribute, key)
  if (pattern.test(html)) return html.replace(pattern, `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`)
  if (!/<\/head>/i.test(html)) throw new Error(`${route}: missing head while inserting ${key}`)
  return html.replace(/<\/head>/i, `  <meta ${attribute}="${key}" content="${escapeHtml(content)}">\n</head>`)
}
function upsertCanonical(html, href, route) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\/?\s*>/i
  if (pattern.test(html)) return html.replace(pattern, `<link rel="canonical" href="${escapeHtml(href)}">`)
  if (!/<\/head>/i.test(html)) throw new Error(`${route}: missing head while inserting canonical`)
  return html.replace(/<\/head>/i, `  <link rel="canonical" href="${escapeHtml(href)}">\n</head>`)
}
