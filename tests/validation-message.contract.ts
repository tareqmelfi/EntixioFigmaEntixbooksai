import assert from 'node:assert/strict'
import { humanizeZodIssue, humanizeZodIssues } from '../src/app/lib/validation-message'
import { computeTotals } from '../src/app/components/items-table'

/**
 * BUG-01 contract (CEO 2026-09-14 · 9 عروض EDG حقيقية).
 *   1. A Zod issue reaches the user as a sentence naming the row as the SCREEN numbers it
 *      (1-based) and the field as the screen labels it — never `lines.8.unitPrice`.
 *   2. The form summary prices a document-level discount exactly as the server does.
 */

// ── 1 · the two issues actually returned by the API on 2026-09-14 ──
const neg = humanizeZodIssue({ path: ['lines', 8, 'unitPrice'], message: 'Number must be greater than or equal to 0' })
assert.equal(neg.ar, 'السطر 9 · سعر الوحدة: لا يمكن أن يكون بالسالب')
assert.equal(neg.en, 'line 9 · unit price: cannot be negative')

const qty = humanizeZodIssue({ path: ['lines', 8, 'quantity'], message: 'Number must be greater than 0' })
assert.equal(qty.ar, 'السطر 9 · الكمية: يجب أن يكون أكبر من صفر')

// zero-based index 0 must read as line 1, never line 0
assert.equal(humanizeZodIssue({ path: ['lines', 0, 'description'], message: 'Required' }).ar, 'السطر 1 · الوصف: مطلوب')

// a plain top-level field carries no row prefix
assert.equal(humanizeZodIssue({ path: ['contactId'], message: 'Required' }).ar, 'العميل: مطلوب')

// an unknown field keeps its own name rather than vanishing
assert.match(humanizeZodIssue({ path: ['weirdField'], message: 'Required' }).ar, /weirdField/)

// at most three issues, then a count — a toast has to stay readable
const many = humanizeZodIssues([
  { path: ['lines', 0, 'unitPrice'], message: 'Number must be greater than or equal to 0' },
  { path: ['lines', 1, 'unitPrice'], message: 'Number must be greater than or equal to 0' },
  { path: ['lines', 2, 'unitPrice'], message: 'Number must be greater than or equal to 0' },
  { path: ['lines', 3, 'unitPrice'], message: 'Number must be greater than or equal to 0' },
])
assert.match(many.ar, /\(و1 أخرى\)$/)
assert.equal(many.ar.split(' · ').length, 6) // 3 issues, each printed as «السطر N · الحقل»

// ── 2 · the summary must agree with the server ──
const line = (unitPrice: string, taxRate: number) => ({ description: 'x', quantity: '1', unitPrice, taxRate, taxInclusive: false }) as any

// verified live on api.entix.io: 4000 → −10% → 3600 net → 540 VAT → 4140
const pct = computeTotals([line('4000', 0.15)], { discountType: 'PERCENT', discountValue: 10 })
assert.equal(pct.discount, 400)
assert.equal(pct.subtotal, 3600)
assert.equal(Number(pct.total.toFixed(2)), 4140)

// verified live: a fixed 500 on the same document → 3500 net → 525 VAT → 4025
const fixed = computeTotals([line('1000', 0.15), line('3000', 0.15)], { discountType: 'FIXED', discountValue: 500 })
assert.equal(fixed.discount, 500)
assert.equal(fixed.subtotal, 3500)
assert.equal(Number(fixed.total.toFixed(2)), 4025)

// no discount → byte-identical to the old two-field result
const plain = computeTotals([line('4000', 0.15)])
assert.equal(plain.discount, 0)
assert.equal(plain.subtotal, 4000)
assert.equal(Number(plain.total.toFixed(2)), 4600)

// a fixed discount can never exceed the document, and a percentage never exceeds 100
assert.equal(computeTotals([line('100', 0)], { discountType: 'FIXED', discountValue: 999 }).total, 0)
assert.equal(computeTotals([line('100', 0)], { discountType: 'PERCENT', discountValue: 250 }).total, 0)

console.log('✓ validation-message + document discount contract')
