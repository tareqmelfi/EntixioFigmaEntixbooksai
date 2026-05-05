import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Build hash · derived from git commit (short) or fallback to timestamp.
// Used by sw.js to version its caches so iPhone Safari can't serve stale builds.
function getBuildHash(): string {
  try {
    const sha = process.env.GITHUB_SHA || process.env.COMMIT_SHA
    if (sha) return sha.slice(0, 8)
    const head = fs.readFileSync(path.resolve(__dirname, '.git/HEAD'), 'utf-8').trim()
    if (head.startsWith('ref:')) {
      const ref = head.slice(5).trim()
      const refSha = fs.readFileSync(path.resolve(__dirname, '.git', ref), 'utf-8').trim()
      return refSha.slice(0, 8)
    }
    return head.slice(0, 8)
  } catch {
    return Date.now().toString(36)
  }
}

const BUILD_HASH = getBuildHash()

// Plugin: inject __BUILD_HASH__ into public/sw.js at build time
function swHashPlugin() {
  return {
    name: 'inject-sw-hash',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      try {
        const src = fs.readFileSync(swPath, 'utf-8')
        const out = src.replace(/__BUILD_HASH__/g, BUILD_HASH)
        fs.writeFileSync(swPath, out)
        console.log(`[sw] injected build hash: ${BUILD_HASH}`)
      } catch (e) {
        console.warn('[sw] could not inject hash · sw.js missing?', e)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    swHashPlugin(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
