import assert from 'node:assert/strict'
import { findVisualPolicyViolations } from '../scripts/check-visual-policy.mjs'

const clean = `
  <section className="rounded-lg border bg-surface text-foreground shadow-raised">
    <DataTable rows={rows} />
  </section>
`
assert.deepEqual(findVisualPolicyViolations('src/app/components/product/example.tsx', clean), [])

const invalid = `
  <div className="bg-gradient-to-r rounded-3xl shadow-2xl bg-[#123456]">
    <h1 style={{ fontSize: '1.75rem' }}>Title</h1>
    <table><tbody /></table>
  </div>
`
const rules = findVisualPolicyViolations('src/app/pages/example.tsx', invalid).map(({ rule }) => rule)
assert.deepEqual(rules.sort(), [
  'decorative-gradient',
  'fixed-inline-title-size',
  'oversized-radius',
  'oversized-shadow',
  'raw-color',
  'raw-product-table',
].sort())

const print = `<div style={{ color: '#112233' }}><table /></div>`
assert.deepEqual(findVisualPolicyViolations('src/app/components/invoice-print-template.tsx', print), [])

const misleadingNames = ['chart-card.tsx', 'logo-button.tsx', 'document-builder.tsx']
for (const file of misleadingNames) {
  assert.ok(findVisualPolicyViolations(`src/app/components/${file}`, invalid).length > 0, file)
}
const arbitrary = `<div className="rounded-[32px] shadow-[0_24px_80px_black] text-[#123456]" />`
const arbitraryRules = findVisualPolicyViolations('src/app/pages/arbitrary.tsx', arbitrary).map(({ rule }) => rule)
assert.ok(arbitraryRules.includes('oversized-radius'))
assert.ok(arbitraryRules.includes('oversized-shadow'))
assert.ok(arbitraryRules.includes('raw-color'))

for (const [source, expectedRule] of [
  ['<div className="bg-red-500" />', 'named-palette-color'],
  ['<span className="text-[red]" />', 'named-palette-color'],
  ['<div style={{ color: "red" }} />', 'named-palette-color'],
  ['<div className="bg-white text-black" />', 'named-palette-color'],
  ['<svg style={{ fill: "red", stroke: "black" }} />', 'named-palette-color'],
  ['<div style={{ background: "white" }} />', 'named-palette-color'],
]) {
  assert.ok(findVisualPolicyViolations('src/app/pages/palette.tsx', source).some(({ rule }) => rule === expectedRule), source)
}

console.log('visual policy contracts passed')
