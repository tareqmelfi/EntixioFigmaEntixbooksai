import fs from 'node:fs'
import path from 'node:path'

// Keep the unrendered Vite entry separate from the public root document.
// Private routes must never paint the marketing chooser while JS loads.
export function preserveAppShell(dist) {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  if (!/<div\s+id="root"\s*>\s*<\/div>/.test(html)) {
    throw new Error('App shell must be captured from a fresh Vite build before prerendering')
  }
  const shell = html.replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>')
  fs.writeFileSync(path.join(dist, 'app-shell.html'), shell)
}
