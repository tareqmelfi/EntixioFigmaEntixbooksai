import assert from 'node:assert/strict'
import { renderDocument, sampleInput } from '../src/app/lib/document-render'

/**
 * INCLUSIVE DOCUMENT CONTRACT (CEO 2026-09-21).
 *
 * Measured against his own reference proposal, EDG-Q-2026-0013: six lines whose
 * prices already contain the tax add up to 1,800.00, a 300.00 document discount
 * comes off, and 1,500.00 is due with 195.65 of VAT contained in it.
 *
 * Entix printed that document three different ways at once — 230.00 on a 200.00
 * line, a 1,304.35 "net" step between a 1,800 list and a 1,500 total, and a
 * 495.65 discount. This locks the shape so none of them can come back.
 */
const qr = (s: string) => `<svg data-qr="${s.length}"></svg>`

const IDENTITY = { themePreset: 'ink-white', brandColor: '#0C79BC', terms: 'شرط', amountInWords: true }

function edgQuote() {
  const base = sampleInput('QUOTE', 'ar', IDENTITY)
  // Six inclusive lines · gross as typed, exactly the reference's figures.
  const raw: Array<[string, number, number]> = [
    ['تعديلات معمارية – الدور الأرضي والأول.', 1, 200],
    ['تصميم – حمام غرفة الماستر.', 1, 200],
    ['تصميم – المطبخ.', 1, 200],
    ['تصميم – الصالة.', 1, 200],
    ['حصر الكميات والمقايسة.', 1, 400],
    ['لقطات 3D توضيحية لكل تصميم.', 3, 200],
  ]
  const lines = raw.map(([description, quantity, unitPrice], i) => ({
    code: String(i + 1).padStart(2, '0'),
    description, quantity, unitPrice,
    // gross-as-typed, which is what an inclusive line stores
    subtotal: quantity * unitPrice,
    taxRate: 0.15,
  }))
  const listPrice = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) // 1800
  const total = 1500
  const taxTotal = Math.round((total - total / 1.15) * 100) / 100 // 195.65
  return {
    ...base,
    qr,
    doc: {
      ...base.doc,
      number: 'EDG-Q-2026-0013',
      lines,
      discountTotal: listPrice - total, // 300
      subtotal: Math.round((total - taxTotal) * 100) / 100, // 1304.35 net
      taxTotal,
      total,
      taxBasis: 'inclusive' as const,
      paymentPlan: null,
    },
  }
}

const out = renderDocument(edgQuote())
const html = out.html

// 1 · the four rows the reference prints, and only those
assert.ok(html.includes('1,800.00'), 'the listed total must appear')
assert.ok(html.includes('300.00'), 'the discount must appear')
assert.ok(html.includes('195.65'), 'the contained tax must appear')
assert.ok(html.includes('1,500.00'), 'the amount due must appear')
assert.ok(html.includes('(ضمن الإجمالي)'), 'the tax row must say it is contained')
assert.ok(!html.includes('الصافي'), 'an inclusive document has no «الصافي» step')
assert.ok(!html.includes('495.65'), 'the discount must not absorb the contained tax')

// 2 · a 200.00 inclusive line prints 200.00, never 230.00
assert.ok(!html.includes('230.00'), 'an inclusive line must not be grossed by the tax again')

// 3 · THE MONEY PAGE HOLDS. Six one-line items and their totals belong on one
// sheet, as they do in the reference. The engine prints «يتبع في الصفحة التالية»
// only when the item table had to break — so its absence is the real assertion,
// independent of how many CONTENT pages the template adds after it.
assert.ok(!html.includes('يتبع في الصفحة التالية'), 'six short lines must not break the item table across sheets')

// 4 · the exclusive document keeps its own shape
const ex = renderDocument({ ...edgQuote(), doc: { ...edgQuote().doc, taxBasis: 'exclusive' as const } })
assert.ok(ex.html.includes('المجموع الفرعي'), 'an exclusive document still opens on a subtotal')

console.log(`✓ inclusive totals contract · ${out.sheetCount} sheets`)
