/**
 * entix-books-web · Cloudflare Worker front door (PLT-01/03)
 * - /api/*, /me, /orgs*  → proxied to api.entix.io (same-origin convenience
 *   that Netlify's _redirects used to provide; CF blocks external rewrites,
 *   so the Worker does it properly with cookies + headers intact)
 * - everything else      → static assets (SPA fallback via not_found_handling)
 */
const API_ORIGIN = 'https://api.entix.io'

function isApiPath(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname === '/me' ||
    pathname === '/orgs' ||
    pathname.startsWith('/orgs/')
  )
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (isApiPath(url.pathname)) {
      const target = new URL(url.pathname + url.search, API_ORIGIN)
      // Pass the request through untouched (method, body, cookies, content-type)
      return fetch(new Request(target.toString(), request), {
        // api.entix.io is itself behind Cloudflare — keep the edge hot
        cf: { cacheEverything: false },
      })
    }
    return env.ASSETS.fetch(request)
  },
}
