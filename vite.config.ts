import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// Stamps the current build time into index.html so the deployed bundle can
// always be verified against the source commit, instead of relying on a
// manually-edited, easily-forgotten meta tag.
function buildTimeStamp() {
  return {
    name: 'build-time-stamp',
    transformIndexHtml(html: string) {
      return html.replace(
        /<meta name="build-time" content="[^"]*" \/>/,
        `<meta name="build-time" content="${new Date().toISOString()}" />`,
      )
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    buildTimeStamp(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        // Vendor split (PERF-01/PERF-06): framework + motion load in parallel
        // with app code and stay long-cacheable across deploys, cutting the
        // parse cost of the critical entry on mobile.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
          if (/[\\/]node_modules[\\/](react-router|@remix-run)[\\/]/.test(id)) return 'vendor-router'
          if (/[\\/]node_modules[\\/](motion|framer-motion)[\\/]/.test(id)) return 'vendor-motion'
          return undefined
        },
      },
    },
  },
})
