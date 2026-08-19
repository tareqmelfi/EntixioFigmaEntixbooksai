import assert from 'node:assert/strict'

/**
 * Report document chrome contract — user-approved reference: the Wave-style
 * Profit & Loss PDF (ENSIDEX LLC, 2026-08-15).
 *
 * Fixed physical layout (both languages):
 *   - client logo at the TOP RIGHT, title block at the TOP LEFT;
 *   - NO accounting-software branding anywhere in the document writing
 *     (no ENTIX name/logo in header or footer);
 *   - compact row density so large charts of accounts fit on fewer pages;
 *   - classic accounting ruling: column headers bordered top+bottom,
 *     totals bold with a top rule, no decorative gradient/chips.
 */

// Browser shims MUST land before importing the component chain —
// LanguageContext reads window/localStorage at module level.
const storage = new Map<string, string>()
const localStorageShim = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
}
;(globalThis as any).window = {
  location: { pathname: '/app/reports/income-statement', href: 'http://localhost/app/reports/income-statement' },
  addEventListener() {},
  removeEventListener() {},
  localStorage: localStorageShim,
}
;(globalThis as any).localStorage = localStorageShim
;(globalThis as any).history = { pushState() {}, replaceState() {}, back() {}, forward() {} }
;(globalThis as any).document = {
  documentElement: { setAttribute() {}, style: {} },
  body: { dir: '', style: {} },
}

const { createElement } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { LanguageProvider } = await import('../src/app/components/LanguageContext')
const { ReportDocument } = await import('../src/app/components/report-document')

const fixture: any = {
  id: 'income-statement',
  title: 'قائمة الدخل',
  englishTitle: 'Income Statement',
  description: 'إيرادات ومصاريف وصافي ربح الشركة خلال الفترة.',
  category: 'financial',
  status: 'live',
  generatedAt: '2026-08-17T10:00:00.000Z',
  period: { from: '2021-01-01', to: '2026-08-15' },
  currency: 'SAR',
  org: {
    id: 'org-1',
    name: 'مؤسسة دنيا الانتاج',
    legalName: 'مؤسسة دنيا الانتاج لتجهيز لوازم الدعاية والاعلان',
    country: 'SA',
    baseCurrency: 'SAR',
    vatNumber: '310122393500003',
    crNumber: '1010203040',
    logoUrl: 'https://cdn.example.com/dnya-logo.png',
    printLogoUrl: null,
    stampUrl: null,
    defaultInvoiceLanguage: 'ar',
    addressLine: 'حي العليا',
    city: 'الرياض',
    region: null,
    postalCode: null,
    email: 'info@dnya.sa',
    phone: null,
    website: null,
    paymentSettings: null,
  },
  summary: {},
  sections: [
    {
      id: 'income-ledger-detail',
      title: 'تفصيل قائمة الدخل حسب الحساب',
      columns: [
        { key: 'label', label: 'الحسابات' },
        { key: 'amount', label: 'Jan 01, 2021 to Aug 15, 2026', align: 'end', kind: 'money' },
      ],
      rows: [
        { id: 'rev-42000', label: '42000 · المبيعات', values: { label: '42000 · المبيعات', amount: 8463490 } },
        { id: 'exp-51100', label: '51100 · تكلفة الانتاج', values: { label: '51100 · تكلفة الانتاج', amount: 8094979 } },
      ],
    },
  ],
}

function render(lang: 'ar' | 'en') {
  storage.clear()
  storage.set('entix-language', lang)
  return renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReportDocument as any, { report: fixture, settings: null })),
  )
}

for (const lang of ['ar', 'en'] as const) {
  const html = render(lang)

  // 1 · no accounting-software branding anywhere in the writing
  assert.ok(!html.includes('ENTIX'), `${lang}: document must not carry the ENTIX brand`)

  // 2 · header is physically pinned: title block LEFT, client logo RIGHT
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] || ''
  assert.ok(header, `${lang}: header exists`)
  assert.ok(/dir="ltr"/.test(header), `${lang}: header row is physically LTR-pinned (title left, logo right) in both languages`)
  const titleIdx = header.search(/<h1/)
  const logoIdx = header.search(/<img/)
  assert.ok(titleIdx > -1 && logoIdx > -1 && titleIdx < logoIdx, `${lang}: title renders before (left of) the client logo`)

  // 3 · no decorative gradient and no "Live Report" chip
  assert.ok(!html.includes('linear-gradient'), `${lang}: no gradient header`)
  assert.ok(!html.includes('تقرير مباشر') && !html.includes('Live Report'), `${lang}: no software chip above the title`)

  // 4 · compact density is the default (rows pack tighter for big account lists)
  const padding = html.match(/--report-cell-padding:([^;"]+)/)?.[1] || ''
  const vertical = Number(padding.trim().split(' ')[0].replace('px', ''))
  assert.ok(vertical > 0 && vertical <= 6, `${lang}: default cell padding packs rows (got "${padding}")`)

  // 5 · classic accounting ruling on the column header (top + bottom borders)
  const theadRow = html.match(/<thead>[\s\S]*?<tr[^>]*>/)?.[0] || ''
  assert.ok(/border-top/.test(theadRow) && /border-bottom/.test(theadRow), `${lang}: column header row carries top+bottom rules`)

  // 6 · totals are bold and ruled from above
  assert.ok(/document-total-row|font-weight:700|font-bold/.test(html), `${lang}: total rows are visually weighted`)

  // 7 · footer keeps document identity (title · company · created · page) without software brand
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] || ''
  assert.ok(footer, `${lang}: footer exists`)
  assert.ok(footer.includes(lang === 'ar' ? 'قائمة الدخل' : 'Income Statement'), `${lang}: footer carries the report title`)
  assert.ok(footer.includes('دنيا'), `${lang}: footer carries the client name`)
  assert.ok(/Page/.test(footer), `${lang}: footer carries the page number`)

  // 8 · tax/registration meta is one compact line, not a three-box grid
  assert.ok(!/sm:grid-cols-3/.test(header), `${lang}: no three-box tax grid in the header`)
}

// ── 2026-08-19 density & direction wave (user review of the Arabic render) ──

// 9 · header follows the DOCUMENT language — Arabic report aligns text to the
// right with the logo on the left (no physical LTR pin), English keeps the
// Wave layout (title left, logo right). NumericText inside keeps its own
// LTR isolation — the contract targets the header CONTAINER only.
{
  const arHtml = render('ar')
  const headerTag = arHtml.match(/<header[^>]*>/)?.[0] || ''
  assert.ok(headerTag.startsWith('<header'), 'ar: header element exists')
  assert.ok(!/dir="ltr"/.test(headerTag), 'ar: header container is NOT LTR-pinned — Arabic text aligns right, logo left')
}

// 10 · no logo → no placeholder box at all (the blue initials square is gone)
{
  const noLogoFixture = { ...fixture, org: { ...fixture.org, logoUrl: null, printLogoUrl: null } }
  storage.clear()
  storage.set('entix-language', 'ar')
  const html = renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReportDocument as any, { report: noLogoFixture, settings: null })),
  )
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] || ''
  assert.ok(!/<img/.test(header), 'no <img> without a logo')
  assert.ok(!/text-white/.test(header), 'no initials placeholder box without a logo')
}

// 11 · the note column is OFF by default (custom print can opt in)
{
  const withNotes = {
    ...fixture,
    sections: [{
      ...fixture.sections[0],
      columns: [...fixture.sections[0].columns, { key: 'note', label: 'ملاحظة' }],
      rows: fixture.sections[0].rows.map((r: any) => ({ ...r, values: { ...r.values, note: 'ملاحظة طويلة' } })),
    }],
  }
  storage.clear(); storage.set('entix-language', 'ar')
  const defaultHtml = renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReportDocument as any, { report: withNotes, settings: null })),
  )
  assert.ok(!defaultHtml.includes('ملاحظة طويلة'), 'note column hidden by default')
  const optedHtml = renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReportDocument as any, { report: withNotes, settings: { showNotes: true } })),
  )
  assert.ok(optedHtml.includes('ملاحظة طويلة'), 'note column renders when showNotes=true')
}

// 12 · dense single-line rows: labels never wrap to a second line; zebra
// striping replaces per-row hairlines; minimal corner radius on the paper.
{
  const html = render('ar')
  assert.ok(/whitespace-nowrap/.test(html), 'row labels are single-line (nowrap)')
  assert.ok(/bg-slate-50/.test(html), 'zebra striping present')
  assert.ok(!/rounded-xl/.test(html.match(/<article[^>]*>/)?.[0] || ''), 'paper uses minimal rounding')
}

// 13 · income-statement shows the Wave-style equation strip (revenue −
// expenses = net) straight under the header.
{
  const withSummary = {
    ...fixture,
    id: 'income-statement',
    sections: [
      {
        id: 'income-summary', title: 'ملخص قائمة الدخل',
        columns: fixture.sections[0].columns,
        rows: [
          { id: 'revenue', label: 'الإيرادات', values: { amount: 12339.99 } },
          { id: 'expenses', label: 'المصروفات', values: { amount: 12273.31 } },
          { id: 'net-income', label: 'صافي الربح', values: { amount: 66.68 } },
        ],
      },
      fixture.sections[0],
    ],
  }
  storage.clear(); storage.set('entix-language', 'ar')
  const html = renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReportDocument as any, { report: withSummary, settings: null })),
  )
  const headerEnd = html.indexOf('</header>')
  const detailStart = html.indexOf('تفصيل قائمة الدخل حسب الحساب')
  const equationIdx = html.search(/report-equation/)
  assert.ok(equationIdx > -1 && equationIdx > headerEnd && detailStart > -1 && equationIdx < detailStart, 'equation strip sits between header and detail sections')
  assert.ok(/12,339\.99/.test(html) && /12,273\.31/.test(html), 'equation carries the revenue and expense numbers')
}

// 14 · multi-level account tree: a row with depth indents its label cell
// (paddingInlineStart scales with depth, up to 5 levels — Wave-style) while
// keeping the single-line density contract.
{
  const tree = {
    ...fixture,
    sections: [{
      ...fixture.sections[0],
      rows: [
        { id: 'root', label: 'الإيرادات', values: { label: 'الإيرادات', amount: 100 } },
        { id: 'lvl1', label: 'إيرادات الخدمات', values: { label: 'إيرادات الخدمات', amount: 60 }, depth: 1 },
        { id: 'lvl2', label: 'إيرادات الخدمات الحكومية', values: { label: 'إيرادات الخدمات الحكومية', amount: 40 }, depth: 2 },
        { id: 'lvl5', label: 'خدمة فرعية 1', values: { label: 'خدمة فرعية 1', amount: 5 }, depth: 5 },
      ],
    }],
  }
  storage.clear(); storage.set('entix-language', 'ar')
  const html = renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReportDocument as any, { report: tree, settings: null })),
  )
  assert.ok(/padding-inline-start:\s*28px/.test(html), 'depth 1 indents 28px')
  assert.ok(/padding-inline-start:\s*46px/.test(html), 'depth 2 indents 46px')
  assert.ok(/padding-inline-start:\s*100px/.test(html), 'depth 5 indents 100px (5-level cap respected)')
  assert.ok(/إيرادات الخدمات الحكومية/.test(html), 'nested row label renders')
}

console.log('report-document contract: all assertions passed')
