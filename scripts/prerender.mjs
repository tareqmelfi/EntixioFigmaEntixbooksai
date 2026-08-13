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
const PORT = 4319

const META = {
  '/': ['Entix Books · محاسبة سحابية عربية — فواتير، زاتكا، مدفوعات', 'محاسبة سحابية عربية/إنجليزية: فواتير إلكترونية متوافقة مع زاتكا، عروض أسعار، سندات قبض وصرف، مشتريات، مصروفات بـ OCR، بوابة عملاء، تقارير، ومساعد ذكاء اصطناعي.'],
  '/features': ['المميزات · Entix Books', 'كل قدرات Entix Books: فوترة زاتكا، OCR للإيصالات، بنك وتسوية، رواتب، مخزون وأصول، تقارير لحظية، ومساعد AI.'],
  '/pricing': ['الأسعار · Entix Books', 'باقات Entix Books بالريال السعودي — جرّب مجاناً، وادفع عندما تنمو.'],
  '/referrals': ['برنامج الإحالة · Entix Books', 'أحِل أصحاب الأعمال إلى Entix Books: خصم للمشترك الجديد وعمولة 50% لك كمسوّق معتمد.'],
  '/about': ['من نحن · ENTIX.IO', 'ENSIDEX LLC · نبني أدوات مالية عربية أولاً للشركات الحديثة.'],
  '/contact': ['تواصل معنا · Entix Books', 'فريق Entix Books جاهز لمساعدتك — مبيعات ودعم.'],
  '/blog': ['المدونة · Entix Books', 'مقالات محاسبية وتقنية بالعربية والإنجليزية من فريق Entix.'],
  '/docs': ['التوثيق · Entix Books', 'أدلة استخدام Entix Books خطوة بخطوة بالعربية والإنجليزية.'],
  '/help': ['مركز المساعدة · Entix Books', 'إجابات سريعة عن الفوترة، زاتكا، المدفوعات، والتقارير.'],
  '/videos': ['فيديوهات تعليمية · Entix Books', 'شروحات مرئية لاستخدام Entix Books.'],
  '/glossary': ['قاموس المصطلحات المحاسبية · Entix', 'مصطلحات محاسبية عربي/إنجليزي مشروحة ببساطة.'],
  '/case-studies': ['قصص نجاح العملاء · Entix Books', 'كيف تستخدم الشركات Entix Books يومياً.'],
  '/changelog': ['سجل التحديثات · Entix Books', 'آخر ميزات وإصلاحات Entix Books.'],
  '/roadmap': ['خارطة الطريق · Entix Books', 'ما الذي نبنيه الآن وما القادم في Entix Books.'],
  '/partners': ['الشركاء · ENTIX.IO', 'برنامج شركاء Entix للمحاسبين والمستشارين.'],
  '/careers': ['الوظائف · ENTIX.IO', 'انضم إلى فريق ENSIDEX.'],
  '/team': ['الفريق · ENTIX.IO', 'الأشخاص خلف Entix Books.'],
  '/integration': ['التكاملات · Entix Books', 'تكاملات Entix Books: بنوك، زاتكا، مدفوعات، وأدوات أعمال.'],
  '/privacy': ['سياسة الخصوصية · Entix Books', 'كيف نحمي بياناتك في Entix Books.'],
  '/terms': ['الشروط والأحكام · Entix Books', 'شروط استخدام منصة Entix Books.'],
  '/refund': ['سياسة الاسترداد · Entix Books', 'سياسة استرداد اشتراكات Entix Books.'],
  '/sla': ['اتفاقية مستوى الخدمة · Entix Books', 'التزامات التوافر والدعم في Entix Books.'],
  '/solutions/small-business': ['للشركات الصغيرة · Entix Books', 'محاسبة بسيطة وقوية للشركات الصغيرة والناشئة.'],
  '/solutions/accountants': ['للمحاسبين · Entix Books', 'أدوات المحاسب المحترف: قيود، ميزان مراجعة، تقارير، وعملاء متعددون.'],
  '/solutions/enterprises': ['للمؤسسات · Entix Books', 'حوكمة، فروع، مراكز تكلفة، وصلاحيات دقيقة للمؤسسات.'],
  '/solutions/restaurants': ['للمطاعم · Entix Books', 'فوترة وتكاليف ورواتب للمطاعم والمقاهي.'],
  '/solutions/ecommerce': ['للتجارة الإلكترونية · Entix Books', 'محاسبة متكاملة لمتاجر التجارة الإلكترونية.'],
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

await new Promise((r) => server.listen(PORT, r))
console.log(`prerender: serving dist/ on :${PORT}`)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

let ok = 0, failed = []
for (const [route, [title, description]] of Object.entries(META)) {
  try {
    try {
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 45000 })
    } catch {
      // Pages with long-polling widgets (Turnstile on /login) never reach
      // networkidle0 — fall back to load + settle instead of failing the route.
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 45000 })
    }
    await new Promise((r) => setTimeout(r, 1800))
    let html = await page.content()
    // per-route SEO truth (REND-02)
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
    // sanity: the render must contain real content, not an empty root
    const bodyLen = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '').trim().length
    if (bodyLen < 50) { failed.push(`${route} (empty render)`); continue }
    const dir = route === '/' ? DIST : path.join(DIST, route.slice(1))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    ok++
    console.log(`  ✓ ${route} (${Math.round(html.length / 1024)}KB html)`)
  } catch (e) {
    failed.push(`${route} (${String(e).slice(0, 80)})`)
  }
}

await browser.close()
server.close()
console.log(`prerender: ${ok}/${Object.keys(META).length} routes rendered`)
if (failed.length) { console.log('FAILED:', failed); process.exit(1) }
