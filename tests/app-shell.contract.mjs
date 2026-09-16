import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { preserveAppShell } from '../scripts/app-shell.mjs'
import worker from '../worker.js'

test('private shell remains empty after the public root becomes a chooser', () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'entix-shell-'))
  try {
    const entry = '<html><head></head><body><div id="root"></div><script type="module" src="/assets/app-hash.js"></script></body></html>'
    fs.writeFileSync(path.join(dist, 'index.html'), entry)
    preserveAppShell(dist)
    fs.writeFileSync(path.join(dist, 'index.html'), '<main data-page="market-locale-chooser">Choose language</main>')
    const shell = fs.readFileSync(path.join(dist, 'app-shell.html'), 'utf8')
    assert.match(shell, /<div id="root"><\/div>/)
    assert.match(shell, /app-hash\.js/)
    assert.match(shell, /noindex, nofollow/)
    assert.doesNotMatch(shell, /chooser|Choose language/)
    assert.throws(() => preserveAppShell(dist), /fresh Vite build/)
  } finally { fs.rmSync(dist, { recursive: true, force: true }) }
})

test('all private deep links serve the clean shell; marketing retains its content', async () => {
  const requested = []
  const env = { ASSETS: { fetch: async request => {
    requested.push(new URL(request.url).pathname)
    return new Response('artifact', { headers: { 'content-type': 'text/html' } })
  } } }
  for (const route of ['/app/invoices', '/admin/companies', '/portal/client', '/print/invoice/123', '/invite/123', '/verify-email', '/welcome', '/buy', '/claim/123', '/q/123']) {
    const response = await worker.fetch(new Request(`https://entix.io${route}`), env)
    assert.equal(requested.at(-1), '/app-shell.html', route)
    assert.match(response.headers.get('cache-control'), /no-cache/)
  }
  for (const [route, artifact] of [['/', '/index.html'], ['/sa/ar', '/sa/ar/index.html'], ['/pricing', '/pricing/index.html']]) {
    await worker.fetch(new Request(`https://entix.io${route}`), env)
    assert.equal(requested.at(-1), artifact)
  }
  assert.equal((await worker.fetch(new Request('https://entix.io/app-imposter'), env)).status, 404)
})

test('production nginx routes private surfaces to the same shell', () => {
  const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')
  assert.match(dockerfile, /location ~ \^\/\(\?:app\|admin[^\n]+try_files \$uri \/app-shell\.html;/)
  assert.match(dockerfile, /location = \/ \{ try_files \/index\.html =404;/)
})
