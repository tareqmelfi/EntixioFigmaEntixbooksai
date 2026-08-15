/**
 * entix-books-web · Cloudflare Worker front door (PLT-01/03 · SEC-01/04 · REND-07)
 *
 * - /api/*, /me, /orgs*  → proxied to api.entix.io (same-origin convenience)
 * - static assets        → ASSETS binding (immutable, content-hashed)
 * - known SPA/marketing routes → index.html fallback
 * - anything else        → honest 404 (REND-07 · no fake-200)
 * - every response       → security headers (SEC-01)
 * - *.map                → blocked (SEC-04 · no public sourcemaps)
 */
const API_ORIGIN = 'https://api.entix.io'

const API_PATHS = (p) =>
  p.startsWith('/api/') || p === '/me' || p === '/orgs' || p.startsWith('/orgs/')

// SPA shell prefixes (app + auth + portal + print) and public marketing routes.
// Must stay in sync with src/app/routes.tsx public paths.
const SHELL_PREFIXES = ['/app', '/portal', '/print']
const MARKETING_ROUTES = new Set([
  '/', '/login', '/register', '/forgot-password', '/reset-password',
  '/features', '/integration', '/pricing', '/privacy', '/terms', '/blog',
  '/help', '/support/ios', '/docs', '/videos', '/about', '/team', '/careers', '/contact',
  '/partners', '/changelog', '/roadmap', '/case-studies', '/glossary',
  '/refund', '/sla',
  '/solutions/accountants', '/solutions/small-business', '/solutions/enterprises',
  '/solutions/restaurants', '/solutions/ecommerce',
])
const MARKETING_PREFIXES = ['/marketplace/']

// /print/* is embedded as the editor's side preview iframe. The primary blocker
// was frame-src omitting 'self' (fixed above). This frame-ancestors relaxation
// is defense-in-depth: entix.io and www.entix.io are distinct origins, so if the
// preview is ever loaded cross-origin (www↔apex), 'self' alone would block it.
// Allow both app origins to frame /print/* only · the rest of the app stays 'self'.
const PRINT_FRAME_ANCESTORS = "'self' https://entix.io https://www.entix.io"

function buildCsp(frameAncestors = "'self'") {
  return [
    "default-src 'self'",
    // GA4 inline bootstrap + gtag.js · react inline styles · Turnstile widget (SEC-03)
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.entix.io https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://fonts.googleapis.com https://fonts.gstatic.com https://challenges.cloudflare.com",
    // frame-src MUST include 'self' so the editor (/app/invoices) can embed the
    // same-origin /print/* preview iframe. When frame-src is present it overrides
    // default-src (no fallback), so omitting 'self' blocked the side preview.
    "frame-src 'self' https://challenges.cloudflare.com",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-frame-options': 'SAMEORIGIN',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'content-security-policy': buildCsp(),
}

// allowFraming=true expands frame-ancestors to PRINT_FRAME_ANCESTORS and drops
// X-Frame-Options (CSP governs; ALLOW-FROM is deprecated) · used for /print/*
// only so the editor's preview iframe can load after the www↔apex redirect.
function withSecurityHeaders(response, { isHtml = false, allowFraming = false } = {}) {
  const res = new Response(response.body, response)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v)
  if (allowFraming) {
    res.headers.set('content-security-policy', buildCsp(PRINT_FRAME_ANCESTORS))
    res.headers.delete('x-frame-options')
  }
  // HTML must revalidate every load so deploys take effect immediately;
  // content-hashed assets stay immutable (PUB-03 cache-busting by design)
  if (isHtml) res.headers.set('cache-control', 'no-cache, must-revalidate')
  return res
}

function isShellOrMarketing(pathname) {
  if (MARKETING_ROUTES.has(pathname)) return true
  if (SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  if (MARKETING_PREFIXES.some((p) => pathname.startsWith(p))) return true
  return false
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // SEC-01/PLT-05: force HTTPS at the edge (zone "Always Use HTTPS" is off and
    // the deploy token can't flip zone settings — enforce it here instead).
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      return Response.redirect(url.toString(), 301)
    }

    // API proxy (cookies/headers/body pass through untouched)
    if (API_PATHS(pathname)) {
      const target = new URL(pathname + url.search, API_ORIGIN)
      return fetch(new Request(target.toString(), request))
    }

    // SEC-04 · never serve sourcemaps publicly
    if (pathname.endsWith('.map')) return withSecurityHeaders(notFound())

    // Real static asset? (has a file extension) → ASSETS or honest 404
    const hasExtension = /\.[a-zA-Z0-9]{1,10}$/.test(pathname)
    if (hasExtension) {
      const res = await env.ASSETS.fetch(request)
      if (res.status === 404) return withSecurityHeaders(notFound())
      const secured = withSecurityHeaders(res)
      if (pathname.startsWith('/app-review-samples/')) {
        secured.headers.set('content-disposition', `attachment; filename="${pathname.split('/').pop()}"`)
        secured.headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
      }
      return secured
    }

    // Extensionless path:
    // 1) prerendered marketing/auth HTML is a REAL file (dist/<route>/index.html)
    //    → serve it directly (REND-01: content without executing JS).
    //    html_handling:"none" means directories don't auto-resolve, so we
    //    address the file explicitly.
    // 2) app shells (/app /portal /print) → SPA index.html fallback (ARC-04)
    // 3) anything else → honest 404 (REND-07)
    if (isShellOrMarketing(pathname)) {
      const isPrint = pathname.startsWith('/print')
      const target = pathname === '/' ? '/index.html' : `${pathname}/index.html`
      const real = await env.ASSETS.fetch(new Request(new URL(target, url), request))
      if (real.status !== 404) return withSecurityHeaders(real, { isHtml: true, allowFraming: isPrint })
      const shell = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
      return withSecurityHeaders(shell, { isHtml: true, allowFraming: isPrint })
    }
    return withSecurityHeaders(notFound())
  },
}
