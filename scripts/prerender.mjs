import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import {
  PUBLIC_LOCALES, PUBLIC_MARKETS, PUBLIC_PAGES, SITE_ORIGIN,
  canonicalUrl, localeDirection, localizedPath, ogLocale,
} from '../src/app/public-site-manifest.ts'

const DIST = path.resolve('dist')
const REQUESTED_PORT = Number(process.env.PRERENDER_PORT || 0)
const SOLUTION_ROUTES = new Set([
  '/solutions/accountants', '/solutions/small-business', '/solutions/enterprises',
  '/solutions/restaurants', '/solutions/ecommerce',
])
const PLACEHOLDER_SIGNATURES = [/قريباً/i, /قريبًا/i, /coming soon/i]

// Baseline public artifacts remain available at their established unprefixed URLs.
// The localized manifest is additive and deliberately constrained to separated copy.
const META = {
  '/': ['Entix Books · محاسبة سحابية عربية — فواتير ومدفوعات', 'محاسبة سحابية عربية/إنجليزية للفواتير والمشتريات والمصروفات والتقارير. تكامل ZATCA Phase 2 قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.'],
  '/features': ['المميزات · Entix Books', 'قدرات Entix Books للفواتير وOCR والبنوك والرواتب والمخزون والتقارير. تكامل ZATCA Phase 2 قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.'],
  '/pricing': ['الأسعار · Entix Books', 'باقات Entix Books بالريال السعودي — جرّب مجاناً، وادفع عندما تنمو.'],
  '/referrals': ['برنامج الإحالة · Entix Books', 'أحِل أصحاب الأعمال إلى Entix Books: خصم للمشترك الجديد وعمولة 50% لك كمسوّق معتمد.'],
  '/about': ['من نحن · ENTIX.IO', 'ENSIDEX LLC · نبني أدوات مالية عربية أولاً للشركات الحديثة.'],
  '/contact': ['تواصل معنا · Entix Books', 'فريق Entix Books جاهز لمساعدتك — مبيعات ودعم.'],
  '/blog': ['المدونة · Entix Books', 'مقالات محاسبية وتقنية بالعربية والإنجليزية من فريق Entix.'],
  '/docs': ['التوثيق · Entix Books', 'أدلة استخدام Entix Books خطوة بخطوة بالعربية والإنجليزية.'],
  '/help': ['مركز المساعدة · Entix Books', 'إجابات عن الفوترة والمدفوعات والتقارير، مع توضيح أن تكامل ZATCA Phase 2 قيد التحقق وغير مفعّل للاعتماد الإنتاجي.'],
  '/videos': ['فيديوهات تعليمية · Entix Books', 'شروحات مرئية لاستخدام Entix Books.'],
  '/glossary': ['قاموس المصطلحات المحاسبية · Entix', 'مصطلحات محاسبية عربي/إنجليزي مشروحة ببساطة.'],
  '/case-studies': ['قصص نجاح العملاء · Entix Books', 'كيف تستخدم الشركات Entix Books يومياً.'],
  '/changelog': ['سجل التحديثات · Entix Books', 'آخر ميزات وإصلاحات Entix Books.'],
  '/roadmap': ['خارطة الطريق · Entix Books', 'ما الذي نبنيه الآن وما القادم في Entix Books.'],
  '/partners': ['الشركاء · ENTIX.IO', 'برنامج شركاء Entix للمحاسبين والمستشارين.'],
  '/careers': ['الوظائف · ENTIX.IO', 'انضم إلى فريق ENSIDEX.'],
  '/team': ['الفريق · ENTIX.IO', 'الأشخاص خلف Entix Books.'],
  '/integration': ['التكاملات · Entix Books', 'تكاملات البنوك والمدفوعات وأدوات الأعمال. تكامل ZATCA Phase 2 قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.'],
  '/privacy': ['Privacy Policy · ENTIX.IO', 'How ENTIX.IO handles account, organization, iOS app, upload, AI/OCR, retention, and deletion data.'],
  '/support/ios': ['iOS Support · ENTIX.IO', 'Official ENTIX.IO support for iPhone and iPad on iOS 17 or later, including sign-in, permissions, AI/OCR, privacy, and account deletion help.'],
  '/terms': ['الشروط والأحكام · Entix Books', 'شروط استخدام منصة Entix Books.'],
  '/refund': ['سياسة الاسترداد · Entix Books', 'سياسة استرداد اشتراكات Entix Books.'],
  '/sla': ['اتفاقية مستوى الخدمة · Entix Books', 'التزامات التوافر والدعم في Entix Books.'],
  '/solutions/small-business': ['Accounting for Small Businesses · Entix Books', 'Run invoices, expenses, banking, and reports in one bilingual workspace, with Saudi and US market guidance.'],
  '/solutions/accountants': ['Accounting Workspace for Accountants · Entix Books', 'Review client documents, entries, controls, and Saudi VAT or US sales-tax reports. ZATCA Phase 2 integration remains under validation and unavailable for production reliance.'],
  '/solutions/enterprises': ['Enterprise Accounting Controls · Entix Books', 'Organize branches, cost centers, user access, and exportable financial reports in a bilingual workspace.'],
  '/solutions/restaurants': ['Accounting for Restaurants and Cafés · Entix Books', 'Review restaurant sales, purchases, operating expenses, inventory movements, and financial reports.'],
  '/solutions/ecommerce': ['Accounting for Ecommerce · Entix Books', 'Organize store sales, payment fees, inventory, bank reconciliation, and profitability reporting.'],
  '/login': ['تسجيل الدخول · Entix Books', 'ادخل إلى حسابك في Entix Books.'],
  '/register': ['إنشاء حساب · Entix Books', 'ابدأ تجربتك المجانية في Entix Books.'],
  '/forgot-password': ['استعادة كلمة المرور · Entix Books', 'استعد الوصول إلى حسابك.'],
  '/reset-password': ['تعيين كلمة مرور جديدة · Entix Books', 'اختر كلمة مرور جديدة لحسابك.'],
}

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
  await withRendererPage({ locale: 'en', region: 'SA' }, async (page) => {
    await loadRoute(page, '/')
    let html = cleanPublicSeo(await page.content())
    html = setHtmlLanguage(html, 'en', 'ltr')
    html = replaceTitle(html, 'ENTIX.IO | Choose your market and language')
    html = replaceMeta(html, 'name', 'description', 'Choose your ENTIX.IO market and language.')
    html = replaceMeta(html, 'property', 'og:title', 'ENTIX.IO')
    html = replaceMeta(html, 'property', 'og:description', 'Choose your ENTIX.IO market and language.')
    html = replaceMeta(html, 'name', 'twitter:title', 'ENTIX.IO')
    html = replaceMeta(html, 'name', 'twitter:description', 'Choose your ENTIX.IO market and language.')
    html = insertHead(html, [
      `<link rel="canonical" href="${SITE_ORIGIN}/">`,
      `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">`,
      `<meta property="og:url" content="${SITE_ORIGIN}/">`,
      `<script type="application/ld+json" data-public-seo>${jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'ENTIX.IO', url: `${SITE_ORIGIN}/` })}</script>`,
    ])
    assertAbsent(html, /priceCurrency|ZATCA|Saudi VAT|SAR/, '/', 'market-specific root metadata')
    fs.writeFileSync(path.join(DIST, 'index.html'), html)
    console.log('  ✓ / (neutral chooser)')
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
    html = replaceTitle(html, title)
    html = replaceMeta(html, 'name', 'description', description)
    html = replaceMeta(html, 'property', 'og:title', title)
    html = replaceMeta(html, 'property', 'og:description', description)
    html = replaceMeta(html, 'name', 'twitter:title', title)
    html = replaceMeta(html, 'name', 'twitter:description', description)
    html = insertHead(html, [
      `<link rel="canonical" href="${canonical}">`,
      ...alternateLinks(definition.path),
      `<meta property="og:url" content="${canonical}">`,
      `<meta property="og:locale" content="${ogLocale(market, locale)}">`,
      `<script type="application/ld+json" data-public-seo>${jsonLd({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: title, description,
        applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: canonical,
        inLanguage: locale, areaServed: { '@type': 'Country', name: market === 'sa' ? 'Saudi Arabia' : 'United States' },
      })}</script>`,
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
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalUrl('us', 'en', pagePath)}" />`)
  return links
}
function writeSitemap() {
  // Computed at call time: top-level consts are not initialized yet when the
  // hoisted pipeline invokes this during early module evaluation (TDZ crash).
  const SITEMAP_LASTMOD = new Date().toISOString().slice(0, 10)
  const SITEMAP_LEGACY_EXCLUDE = new Set(['/forgot-password', '/reset-password'])
  const LEGACY_PRIORITY = {
    '/features': ['weekly', '0.9'], '/pricing': ['weekly', '0.9'],
    '/solutions/small-business': ['monthly', '0.8'], '/solutions/accountants': ['monthly', '0.8'],
    '/solutions/enterprises': ['monthly', '0.8'], '/solutions/restaurants': ['monthly', '0.7'],
    '/solutions/ecommerce': ['monthly', '0.7'], '/contact': ['monthly', '0.7'],
    '/integration': ['monthly', '0.6'], '/about': ['monthly', '0.6'], '/blog': ['weekly', '0.6'],
    '/case-studies': ['monthly', '0.6'], '/docs': ['weekly', '0.7'], '/help': ['weekly', '0.6'],
    '/support/ios': ['monthly', '0.7'], '/videos': ['monthly', '0.5'], '/glossary': ['monthly', '0.5'],
    '/partners': ['monthly', '0.5'], '/careers': ['monthly', '0.5'], '/changelog': ['weekly', '0.5'],
    '/roadmap': ['monthly', '0.5'], '/team': ['yearly', '0.4'], '/register': ['yearly', '0.4'],
    '/privacy': ['yearly', '0.3'], '/terms': ['yearly', '0.3'], '/refund': ['yearly', '0.3'],
    '/sla': ['yearly', '0.3'], '/login': ['yearly', '0.2'],
  }
  const indexable = PUBLIC_PAGES.filter((page) => page.indexable)
  const localized = indexable.flatMap((page) =>
    PUBLIC_MARKETS.flatMap((market) => PUBLIC_LOCALES.map((locale) => [
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
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    root, ...localized, ...legacy, '</urlset>', '',
  ].join('\n'))
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
