/**
 * scripts/prerender.mjs · REND-01/02 + ARC-03
 * After `vite build`: serves dist/, crawls marketing/auth routes with
 * puppeteer, writes real per-route HTML files (dist/<route>/index.html)
 * with per-route <title> + <meta description> injected.
 * App shell /app stays CSR (ARC-04) — it is NOT in this list.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const DIST = path.resolve('dist')
const REQUESTED_PORT = Number(process.env.PRERENDER_PORT || 0)
const SITE_ORIGIN = 'https://entix.io'
const SOLUTION_ROUTES = new Set([
  '/solutions/accountants', '/solutions/small-business', '/solutions/enterprises',
  '/solutions/restaurants', '/solutions/ecommerce',
])
const PLACEHOLDER_SIGNATURES = [/قريباً/i, /قريبًا/i, /coming soon/i]

// Prerender is deliberately deterministic: LanguageContext and MarketingRegion
// default to English + Saudi Arabia when storage is empty.

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
  '/marketplace/accountants': ['سوق المحاسبين · Entix', 'اعثر على محاسب معتمد يعمل على Entix Books.'],
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
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA fallback for the renderer itself
    file = path.join(DIST, 'index.html')
  }
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(REQUESTED_PORT, '127.0.0.1', resolve)
})
const address = server.address()
if (!address || typeof address === 'string') throw new Error('prerender server did not expose a TCP port')
const rendererOrigin = `http://127.0.0.1:${address.port}`
console.log(`prerender: serving dist/ on ${rendererOrigin}`)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})
async function createRendererPage() {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('entix-language', 'en')
    localStorage.setItem('entix-marketing-region', 'SA')
  })
  return page
}

let ok = 0, failed = []
for (const [route, [title, description]] of Object.entries(META)) {
  let page
  try {
    page = await createRendererPage()
    try {
      await page.goto(`${rendererOrigin}${route}`, { waitUntil: 'networkidle0', timeout: 45000 })
    } catch {
      // Pages with long-polling widgets (Turnstile on /login) never reach
      // networkidle0 — fall back to load + settle instead of failing the route.
      await page.goto(`${rendererOrigin}${route}`, { waitUntil: 'load', timeout: 45000 })
    }
    await new Promise((r) => setTimeout(r, 1800))
    let html = await page.content()
    const canonical = `${SITE_ORIGIN}${route === '/' ? '' : route}`
    // Per-route SEO truth (REND-02). Match both self-closing and HTML-style tags,
    // fail loudly if a required tag disappeared, and keep canonical/social fields aligned.
    html = replaceRequired(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`, route, 'title')
    html = replaceRequiredMeta(html, 'name', 'description', description, route)
    html = replaceRequiredMeta(html, 'property', 'og:title', title, route)
    html = replaceRequiredMeta(html, 'property', 'og:description', description, route)
    html = replaceRequiredMeta(html, 'name', 'twitter:title', title, route)
    html = replaceRequiredMeta(html, 'name', 'twitter:description', description, route)
    html = upsertCanonical(html, canonical, route)
    html = upsertRequiredMeta(html, 'property', 'og:url', canonical, route)

    // Validate route content inside main, not footer/legal copy shared by every page.
    const mainContent = await page.$eval('main', (main) => ({
      text: main.innerText.trim(),
      marker: main.getAttribute('data-page'),
      sections: main.querySelectorAll('section[data-section]').length,
    })).catch(async () => {
      const rootText = await page.$eval('#root', (root) => root.textContent?.trim() || '').catch(() => '')
      return rootText ? { text: rootText, marker: null, sections: 0 } : null
    })
    if (!mainContent || mainContent.text.length < 50) { failed.push(`${route} (missing or empty primary content)`); continue }
    if (SOLUTION_ROUTES.has(route)) {
      const expectedMarker = `solutions-${route.split('/').pop()}`
      const placeholder = PLACEHOLDER_SIGNATURES.find((signature) => signature.test(mainContent.text))
      if (mainContent.marker !== expectedMarker) { failed.push(`${route} (missing marker ${expectedMarker})`); continue }
      if (mainContent.sections < 5) { failed.push(`${route} (${mainContent.sections} substantive sections; need 5)`); continue }
      if (mainContent.text.length < 500) { failed.push(`${route} (insufficient main content density)`); continue }
      if (placeholder) { failed.push(`${route} (placeholder signature in main content)`); continue }
    }
    const dir = route === '/' ? DIST : path.join(DIST, route.slice(1))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    ok++
    console.log(`  ✓ ${route} (${Math.round(html.length / 1024)}KB html)`)
  } catch (e) {
    failed.push(`${route} (${String(e).slice(0, 80)})`)
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {})
  }
}

await browser.close()
server.close()
console.log(`prerender: ${ok}/${Object.keys(META).length} routes rendered`)
if (failed.length) { console.log('FAILED:', failed); process.exit(1) }

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function replaceRequired(html, pattern, replacement, route, label) {
  if (!pattern.test(html)) throw new Error(`${route}: missing required metadata ${label}`)
  return html.replace(pattern, replacement)
}

function metaPattern(attribute, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escaped}["'])[^>]*\\/?\\s*>`, 'i')
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
  const canonicalPattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\/?\s*>/i
  if (canonicalPattern.test(html)) return html.replace(canonicalPattern, `<link rel="canonical" href="${escapeHtml(href)}">`)
  if (!/<\/head>/i.test(html)) throw new Error(`${route}: missing head while inserting canonical`)
  return html.replace(/<\/head>/i, `  <link rel="canonical" href="${escapeHtml(href)}">\n</head>`)
}
