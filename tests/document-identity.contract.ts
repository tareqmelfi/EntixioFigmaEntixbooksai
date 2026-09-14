import assert from 'node:assert/strict'
import { renderDocument, sampleInput, tafqitSar, zatcaTlvBase64, resolveTheme, hasIdentity, DOC_THEME_PRESETS } from '../src/app/lib/document-render'

/**
 * Document identity contract (2026-09-14 · «هوية المستند»).
 *   1. REGRESSION LOCK · a template with no identity field renders the Ledger document of
 *      2026-09-08 byte for byte — null template, a legacy template, and a template that only
 *      carries themePreset:"ledger" / amountInWords:false must produce identical HTML.
 *   2. tafqitSar · Arabic counted-noun grammar · millions-capable · English fallback.
 *   3. zatcaTlvBase64 · matches the btoa/TextEncoder reference.
 *   4. ink-white preset · serial colour · centered header · hideProviderBranding → no provider text.
 */
const qr = (s: string) => `<svg data-qr="${s.length}"></svg>`
const legacy = { brandColor: '#1276E3', coverColor: '#0B1B49', coverStyle: 'LIGHT', terms: 'شرط أول\nشرط ثاني', closingTerms: 'القبول | نص', signatoryName: 'Tareq Melfi', stampUrl: 'data:image/png;base64,AAAA', footerText: 'foo', classification: 'سري' }

for (const kind of ['QUOTE', 'INVOICE'] as const) for (const lang of ['ar', 'en'] as const) {
  const base = renderDocument({ ...sampleInput(kind, lang, null), qr }).html
  const ledgerOnly = renderDocument({ ...sampleInput(kind, lang, { themePreset: 'ledger', amountInWords: false, headerStyle: 'bar', paymentPlanStyle: 'table', theme: null }), qr }).html
  assert.equal(ledgerOnly, base, `${kind}/${lang}: themePreset:"ledger" must be a no-op`)
  const leg = renderDocument({ ...sampleInput(kind, lang, legacy), qr }).html
  const legPlus = renderDocument({ ...sampleInput(kind, lang, { ...legacy, themePreset: 'ledger', closingFacts: [] }), qr }).html
  assert.equal(legPlus, leg, `${kind}/${lang}: empty identity fields must be a no-op on a legacy template`)
  assert.ok(!base.includes('class="edoc idn'), 'no identity root class without identity fields')
  assert.ok(!base.includes('.edoc.idn'), 'no identity stylesheet without identity fields')
}
assert.equal(hasIdentity({ themePreset: 'ledger' }), false)
assert.equal(hasIdentity({ outOfScope: 'x' }), true)

// tafqit
assert.equal(tafqitSar(6037.5, 'ar'), 'فقط ستة آلاف وسبعة وثلاثون ريالاً وخمسون هللة سعوديًا لا غير')
assert.ok(tafqitSar(1549234, 'ar').includes('مليون'))
assert.ok(tafqitSar(2000, 'ar').includes('ألفا ريال'))
assert.ok(tafqitSar(3000, 'ar').includes('ثلاثة آلاف'))
assert.ok(tafqitSar(11000, 'ar').includes('أحد عشر ألفًا'))
assert.ok(tafqitSar(2_000_000, 'ar').includes('مليونا ريال'))
assert.equal(tafqitSar(105.03, 'ar'), 'فقط مائة وخمسة ريالات وثلاثة هللات سعوديًا لا غير')
assert.equal(tafqitSar(6037.5, 'en'), 'Only Six thousand thirty-seven Saudi Riyals and fifty halalas')

// TLV
assert.equal(zatcaTlvBase64({ sellerName: 'Sample Seller', vatNumber: '311691775200003', timestampIso: '2026-09-07T00:00:00Z', total: 4485, vat: 585 }),
  'AQ1TYW1wbGUgU2VsbGVyAg8zMTE2OTE3NzUyMDAwMDMDFDIwMjYtMDktMDdUMDA6MDA6MDBaBAc0NDg1LjAwBQY1ODUuMDA=')

// presets
assert.equal(resolveTheme(null).ink, '#1A1E48')
assert.equal(resolveTheme({ brandColor: '#1276E3' }).steel, '#1276E3')
assert.equal(resolveTheme({ themePreset: 'ink-white' }).serial, '#ED1D24')
assert.equal(resolveTheme({ themePreset: 'custom', theme: { ...DOC_THEME_PRESETS['ink-white'], ink: 'bad' } }).ink, '#1A1E48', 'a bad hex falls back to the base preset')

// ink-white · full identity
const tpl = { themePreset: 'ink-white', headerStyle: 'centered', showQr: true, hideProviderBranding: true, paymentPlanStyle: 'stations', outOfScope: 'أعمال الكهرباء', closingFacts: [{ label: 'CR', value: '1' }], signatureUrl: 'data:image/png;base64,AAAA', bankLogoUrl: 'data:image/png;base64,AAAA', watermarkUrl: 'data:image/png;base64,AAAA' }
const inp = sampleInput('QUOTE', 'ar', tpl as any)
inp.doc.paymentPlan = [{ label: 'أ', percent: 50, net: 0, tax: 0, total: 1 }, { label: 'ب', percent: 50, net: 0, tax: 0, total: 1 }]
const out = renderDocument({ ...inp, qr })
assert.ok(out.body.startsWith('<div class="edoc idn hs"'))
assert.ok(out.css.includes('--serial:#ED1D24'))
assert.ok(out.body.includes('tile serial'), 'quote number carries the serial colour')
assert.ok(!out.body.includes('hdr-meta'), 'centered header has no meta block')
assert.ok(out.body.includes('class="tafqit"') && out.body.includes('سعوديًا لا غير'))
assert.ok(out.body.includes('nb oos') && out.body.includes('خارج نطاق هذا العرض'))
assert.ok(out.body.includes('class="stations"'))
assert.ok(out.body.includes('class="bankc"'))
assert.ok(out.body.includes('sheet dark closing'))
assert.ok(out.body.includes('class="wm"'))
assert.ok(out.body.includes('qr-data'), 'quote carries the TLV QR data list when showQr')
assert.ok(!/entix|ensidex/i.test(out.html), 'hideProviderBranding: no provider text anywhere in the HTML')
assert.ok(renderDocument({ ...sampleInput('QUOTE', 'ar', { themePreset: 'ink-white' }), qr }).css.includes("'Entix Doc Arabic'"), 'faces keep the provider name unless hidden')

console.log('document-identity contract: ok')
