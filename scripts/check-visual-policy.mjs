import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const exemptFiles = new Set([
  'src/app/components/invoice-print-template.tsx',
  'src/app/components/quote-print-template.tsx',
  'src/app/components/report-document.tsx',
  'src/app/pages/invoice-print-view.tsx',
  'src/app/pages/voucher-print-view.tsx',
])
const rules = [
  ['decorative-gradient', /\b(?:bg|text)-gradient-[\w-]+|\bfrom-[\w\[/.-]+\s+\bto-[\w\[/.-]+/g],
  ['oversized-radius', /\brounded-(?:2xl\b|3xl\b|\[(?:2[4-9]|[3-9]\d|\d{3,})px\])/g],
  ['oversized-shadow', /\bshadow-(?:xl\b|2xl\b|\[[^\]]*(?:2[4-9]|[3-9]\d|\d{3,})px[^\]]*\])/g],
  ['fixed-inline-title-size', /<h1\b[^>]*style=\{\{[^}]*fontSize\s*:/g],
  ['raw-color', /(?:#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})\b|\b(?:rgb|hsl)a?\s*\()/gi],
  ['named-palette-color', /(?:\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b|\b(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\b(?:bg|text|border|ring|fill|stroke)-\[(?:black|white|red|orange|yellow|green|blue|purple|pink|gray|grey)\]|(?:color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*["'](?:black|white|red|orange|yellow|green|blue|purple|pink|gray|grey)["'])/gi],
  ['raw-product-table', /<table\b/g],
]

function normalizedPath(file) {
  return file.replaceAll('\\', '/').replace(/^.*?(src\/)/, '$1')
}

export function findVisualPolicyViolations(file, source) {
  const normalized = normalizedPath(file)
  if (exemptFiles.has(normalized)) return []
  return rules.flatMap(([rule, pattern]) => {
    if (rule === 'raw-product-table' && normalized === 'src/app/components/ui/table.tsx') return []
    return Array.from(source.matchAll(pattern), match => ({
      file,
      rule,
      match: match[0],
      index: match.index ?? 0,
    }))
  })
}

async function main(files) {
  const violations = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    violations.push(...findVisualPolicyViolations(file, source))
  }
  if (!violations.length) return
  for (const violation of violations) {
    console.error(`${violation.file}: ${violation.rule}: ${violation.match}`)
  }
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2))
}
