import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const source = async (relativePath: string) => readFile(path.join(root, relativePath), 'utf8').catch(() => '')

test('global typography is script-aware without locale-wide font mutation', async () => {
  const css = await source('src/styles/index.css')
  const theme = await source('src/styles/theme.css')
  expect(css).toContain("--entix-font-ui: 'IBM Plex Sans', 'IBM Plex Sans Arabic'")
  expect(css).not.toMatch(/html\[dir=["']rtl["']\]\s+body\s+\*/)
  expect(`${css}\n${theme}`).not.toMatch(/\.font-english[^}]*direction:\s*ltr/s)
  expect(theme).not.toContain('th, td {\n    white-space: nowrap;')
})

test('BidiText exposes semantic Arabic detection and isolation contracts', async () => {
  const bidi = await source('src/app/components/bidi-text.tsx')
  expect(bidi).toMatch(/export function containsArabicScript/)
  expect(bidi).toMatch(/<bdi/)
  expect(bidi).toMatch(/dir="auto"/)
  expect(bidi).toMatch(/lang=\{hasArabic \? "ar" : undefined\}/)
  expect(bidi).toMatch(/unicodeBidi:\s*"plaintext"/)
  expect(bidi).toMatch(/unicodeBidi:\s*"isolate"/)
})

test('shared free-text controls default to auto direction but identifiers stay LTR', async () => {
  const input = await source('src/app/components/ui/input.tsx')
  const textarea = await source('src/app/components/ui/textarea.tsx')
  expect(input).toMatch(/isExplicitLtrInput/)
  expect(input).toMatch(/dir=\{resolvedDir\}/)
  expect(textarea).toMatch(/dir=\{dir \?\? "auto"\}/)
})

test('priority entity surfaces use the reusable bidi component', async () => {
  const paths = [
    'src/app/components/org-switcher.tsx',
    'src/app/components/app-header.tsx',
    'src/app/components/searchable-combobox.tsx',
    'src/app/components/contact-search-input.tsx',
    'src/app/pages/invoices.tsx',
    'src/app/pages/contacts.tsx',
  ]
  for (const relativePath of paths) {
    const file = await source(relativePath)
    expect(file, relativePath).toContain('BidiText')
  }
})

test('invoice customer names receive a stable, compact bidi-aware table column', async () => {
  const invoices = await source('src/app/pages/invoices.tsx')
  // The column model changed with the 2026-09-08 anti-overlap pass: the mono document
  // number takes a fixed width (it can run to 19 characters) and the customer name is the
  // flexible column with a floor, instead of the old percentage split. The contract is the
  // shape — fixed number column, flexible-with-minWidth name column — not the old literals.
  expect(invoices).toMatch(/<col style=\{\{ width: "200px" \}\}/)
  expect(invoices).toMatch(/<col style=\{\{ minWidth: "\d+px" \}\}/)
  // `compact` was replaced by explicit single-line truncation classes on the cell itself,
  // so the assertion is on the behaviour that matters: plaintext bidi + one clipped line.
  expect(invoices).toMatch(/<BidiText mode="plaintext"[^>]*text-ellipsis[^>]*whitespace-nowrap/)
  expect(invoices).toMatch(/className="invoice-customer-name/)
})

test('print documents share professional Arabic document contracts', async () => {
  const indexCss = await source('src/styles/index.css')
  const fontCss = await source('src/styles/fonts-selfhosted.css')
  const report = await source('src/app/components/report-document.tsx')
  const invoice = await source('src/app/pages/invoice-print-view.tsx')
  const engine = await source('src/app/lib/document-render.ts')
  const voucher = await source('src/app/pages/voucher-print-view.tsx')
  const printCss = await source('src/styles/print-documents.css')
  expect(indexCss).toContain("@import './print-documents.css'")
  expect(fontCss).toContain('url(/fonts/NotoSansArabic-400-arabic.woff2)')
  // 2026-09-08 · the invoice print view renders through the brand document engine
  // (fixed A4 sheets · self-hosted Noto Sans Arabic + Plus Jakarta Sans · bidi isolation)
  expect(invoice).toContain('BrandDocument')
  expect(invoice).toContain('docFromInvoice')
  expect(engine).toContain('NotoSansArabic-400-arabic.woff2')
  expect(engine).toContain('PlusJakartaSans-400-latin.woff2')
  expect(engine).toMatch(/@page\{size:A4;margin:0\}/)
  expect(engine).toMatch(/width:210mm;height:297mm/)
  expect(engine).toMatch(/break-after:page/)
  expect(engine).toMatch(/unicode-bidi:isolate/)
  expect(engine).toMatch(/font-variant-numeric:tabular-nums/)
  for (const [name, file] of Object.entries({ report, voucher })) {
    expect(file, name).toContain('document-paper')
    expect(file, name).toContain('document-title')
    expect(file, name).toContain('document-table')
    expect(file, name).toContain('document-keep-together')
    expect(file, name).toContain('BidiText')
    expect(file, name).toContain('NumericText')
  }
  expect(printCss).toContain("font-family: 'Plus Jakarta Sans', 'Noto Sans Arabic'")
  expect(printCss).toMatch(/\.document-paper\s+:lang\(ar\)/)
  expect(printCss).toMatch(/thead\s*\{\s*display:\s*table-header-group/)
  expect(printCss).toMatch(/break-inside:\s*avoid/)
  expect(printCss).toMatch(/font-size:\s*10pt/)
  expect(printCss).toMatch(/font-size:\s*18pt/)
  expect(printCss).toMatch(/@page\s*\{\s*size:\s*A4/)
  expect(printCss).not.toMatch(/#[0-9a-f]{6}[^\n]*(blue|green|amber|red)/i)
})

test('print identifiers are isolated LTR while arbitrary names and prose use auto direction', async () => {
  const report = await source('src/app/components/report-document.tsx')
  const engine = await source('src/app/lib/document-render.ts')
  const voucher = await source('src/app/pages/voucher-print-view.tsx')
  expect(report).toMatch(/<BidiText[^>]*mode="plaintext"/)
  expect(report).toMatch(/<NumericText[^>]*>\{report\.id\}<\/NumericText>/)
  // engine: names/prose → <bdi dir="auto"> · identifiers/amounts → <bdi dir="ltr" class="num">
  expect(engine).toMatch(/const bdi = .*<bdi dir="auto">/)
  expect(engine).toMatch(/const num = .*<bdi dir="ltr" class="num/)
  expect(engine).toMatch(/\$\{bdi\(clientName\)\}/)
  expect(engine).toMatch(/\$\{num\(doc\.number\)\}/)
  expect(voucher).toMatch(/<BidiText[^>]*>\{contact\?\.displayName/)
  expect(voucher).toMatch(/<NumericText[^>]*>\{voucher\.number\}<\/NumericText>/)
})

test('prerender isolates every route in a fresh page and closes it after use', async () => {
  const prerender = await source('scripts/prerender.mjs')
  expect(prerender).toContain('const REQUESTED_PORT = Number(process.env.PRERENDER_PORT || 0)')
  expect(prerender).toContain("server.listen(REQUESTED_PORT, '127.0.0.1', resolve)")
  expect(prerender).toMatch(/async function (?:createRendererPage|withRendererPage)/)
  expect(prerender).toContain('const page = await browser.newPage()')
  expect(prerender).toMatch(/finally \{[\s\S]*?!page\.isClosed\(\)[\s\S]*?page\.close\(\)/)
})
