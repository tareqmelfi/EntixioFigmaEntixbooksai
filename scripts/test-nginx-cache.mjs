import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the actual production Nginx configuration, not Vite's dev server.
// All content is synthetic; no auth or production data is needed.
const root = mkdtempSync(join(tmpdir(), 'entix-cache-test-'));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const config = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')
  .match(/<<'NGINX'\n([\s\S]*?)\nNGINX/)[1];
const html = join(root, 'html');
const routes = ['/', '/login', '/register', '/forgot-password', '/reset-password',
  '/sa/ar', '/sa/en', '/us/ar', '/us/en', '/features', '/solutions/accountants', '/support/ios'];
for (const route of routes) {
  const dir = join(html, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Synthetic document</title>');
}
writeFileSync(join(html, 'app-shell.html'), '<!doctype html><title>Synthetic app</title>');
writeFileSync(join(html, 'sw.js'), '// synthetic worker');
mkdirSync(join(html, 'fonts'));
writeFileSync(join(html, 'fonts', 'synthetic.woff2'), 'synthetic font');
mkdirSync(join(html, 'assets'));
writeFileSync(join(html, 'assets/index-abc123.js'), '// synthetic hashed bundle');
// Early Hints snippet is generated per build by scripts/prerender.mjs; synthesize it here.
writeFileSync(join(root, 'early-hints.conf'), 'add_header Link "</assets/index-abc123.css>; rel=preload; as=style" always;\n');

async function withServer(conf, check) {
  writeFileSync(join(root, 'default.conf'), conf);
  let id;
  try {
    id = docker('run', '--rm', '-d', '-p', '127.0.0.1::80',
      '-v', `${join(root, 'default.conf')}:/etc/nginx/conf.d/default.conf:ro`,
      '-v', `${join(root, 'early-hints.conf')}:/etc/nginx/snippets/early-hints.conf:ro`,
      '-v', `${html}:/usr/share/nginx/html:ro`, 'nginx:1.27-alpine');
    docker('exec', id, 'nginx', '-t');
    const base = `http://${docker('port', id, '80/tcp')}`;
    for (let i = 0; ; i++) {
      try { await fetch(base); break; }
      catch (error) { if (i === 30) throw error; await new Promise(r => setTimeout(r, 100)); }
    }
    await check(base);
  } finally { if (id) docker('stop', id); }
}

try {
  // Reproduce the previous configuration: /login lacked any Cache-Control.
  const baseline = config.replace(/^  add_header Cache-Control "no-cache, no-store, must-revalidate" always;\n/m, '');
  assert.notEqual(config, baseline, 'server document-cache policy must exist');
  await withServer(baseline, async base => {
    const login = await fetch(`${base}/login`);
    assert.equal(login.headers.get('cache-control'), null);
    console.log('Baseline reproduced: /login has no cache policy');
  });
  await withServer(config, async base => {
    for (const route of [...routes, '/app', '/admin', '/admin/orgs', '/app/contacts', '/invite', '/welcome', '/sw.js']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('cache-control') || '', /no-store/, route);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
      assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN', route);
      if (route !== '/sw.js') assert.match(response.headers.get('link') || '', /rel=preload; as=style/, `${route} early-hints Link`);
    }
    const font = await fetch(`${base}/fonts/synthetic.woff2`);
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('access-control-allow-origin'), 'https://api.entix.io');
    assert.equal(font.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(`${base}/fonts/missing.woff2`)).status, 404);
    const asset = await fetch(`${base}/assets/index-abc123.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);
    assert.doesNotMatch(asset.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(`${base}/missing-page`)).status, 404);
    console.log('Passed: 20 document/worker routes, immutable asset, security headers, honest 404');
  });
} finally { rmSync(root, { recursive: true, force: true }); }
