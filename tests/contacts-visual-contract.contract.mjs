import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const contacts = await readFile(new URL('src/app/pages/contacts.tsx', root), 'utf8')
const detail = await readFile(new URL('src/app/pages/contact-detail.tsx', root), 'utf8')
const pages = [
  ['contacts.tsx', contacts],
  ['contact-detail.tsx', detail],
]

assert.match(contacts, /from ["']\.\.\/components\/product["']/)
assert.match(contacts, /<PageHeader\b/)
assert.match(contacts, /<MetricStrip\b/)
assert.match(contacts, /<Metric\b/)
assert.match(contacts, /<StatusBadge\b/)
assert.doesNotMatch(contacts, /\bKpiCard\b/)

assert.match(detail, /from ["']\.\.\/components\/product["']/)
assert.match(detail, /<PageHeader\b/)
assert.match(detail, /<MetricStrip\b/)
assert.match(detail, /<Metric\b/)
assert.match(detail, /<StatusBadge\b/)
assert.match(detail, /<SectionHeader\b/)
assert.doesNotMatch(detail, /\bStatusPill\b/)

// Existing contact and operations tables stay intact to preserve columns and row workflows.
assert.equal((contacts.match(/<table\b/g) || []).length, 1)
assert.equal((detail.match(/<table\b/g) || []).length, 3)

for (const [file, source] of pages) {
  assert.doesNotMatch(source, /<h1\b[^>]*style=\{\{[^}]*fontSize\s*:/, `${file} must use PageHeader typography`)
  assert.doesNotMatch(source, /\b(?:bg|text|border|hover:bg|hover:text)-(?:white|black|slate|gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|\/|\b)/, `${file} must use semantic color tokens`)
  assert.doesNotMatch(source, /\b(?:bg|text)-gradient-|\bfrom-[^\s"'`}]+|\bto-[^\s"'`}]+/, `${file} must not use gradients`)
  assert.doesNotMatch(source, /\brounded-(?:2xl|3xl)\b|\bshadow-(?:xl|2xl)\b/, `${file} must avoid oversized decoration`)
}

assert.match(contacts, /\btabular-nums\b/)
assert.match(detail, /\btabular-nums\b/)
assert.match(contacts, /dir=["']ltr["']/)
assert.match(detail, /dir=["']ltr["']/)

console.log('contacts visual contracts passed')
