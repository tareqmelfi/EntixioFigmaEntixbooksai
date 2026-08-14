import { expect, test } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

type ClaimRule = { id: string; pattern: RegExp }

const excludedRuntimeFiles = new Set(['terms.tsx', 'privacy.tsx'])
const staticSources = ['scripts/prerender.mjs', 'index.html', 'worker.js', 'PROJECT_FEATURES.md'] as const
const allowedExactStatePhrases = new Set([
  'ZATCA Phase 2 — Under validation',
  'ZATCA Phase 2 — قيد التحقق',
  'CSID cryptographic stamp',
  'ختم CSID التشفيري',
  'LOCAL_UNVERIFIED',
  'zatca_pipeline_not_ready',
  'Credentials saved · clearance not enabled',
])

const forbiddenClaims: ClaimRule[] = [
  { id: 'ready-en', pattern: /ZATCA[- ]ready|ZATCA\s+ready/i },
  { id: 'ready-ar', pattern: /(?:جاهز(?:ة)?|جاهزية)\s*(?:لـ|ل)?\s*ZATCA|ZATCA\s*جاهز(?:ة)?/i },
  { id: 'phase2-compliant', pattern: /Phase\s*2\s*compliant|متوافق(?:ة)?\s+مع\s+المرحلة\s*(?:الثانية|2)/i },
  { id: 'zatca-compliant', pattern: /(?:ZATCA|ZATKA|زاتكا|هيئة الزكاة)[^\n"'`]{0,80}(?:compliant|متوافق(?:ة)?)|(?:compliant|متوافق(?:ة)?)[^\n"'`]{0,80}(?:ZATCA|ZATKA|زاتكا|هيئة الزكاة)/i },
  { id: 'clearance-enabled', pattern: /ready\s+to\s+clear|ZATCA\s+Phase\s*2\s+(?:enabled|مفع[ّ]?ل)/i },
  { id: 'operational-signature', pattern: /(?!(?:planned|not implemented|مخطط|غير منفذ)[^\n]{0,100})(?:digital signature|cryptographic stamp|ECDSA|توقيع رقمي|ختم رقمي|تشفير بـ\s*ECDSA)/i },
  { id: 'official-approved', pattern: /(?:(?:official|approved|compliant|معتمد(?:ة)?|رسمي(?:ة)?)\s+[^\n"'`]{0,80}(?:invoice|template|document|QR|فاتورة|قالب|مستند|رمز)[^\n"'`]{0,80}(?:ZATCA|ZATKA|زاتكا|هيئة الزكاة)|(?:ZATCA|ZATKA|زاتكا|هيئة الزكاة)[^\n"'`]{0,80}(?:invoice|template|document|QR|فاتورة|قالب|مستند|رمز)[^\n"'`]{0,80}(?:official|approved|compliant|معتمد(?:ة)?|رسمي(?:ة)?))/i },
  { id: 'approved-format', pattern: /(?:XML\/UBL\s*2\.1|PDF\/A-3)[^\n"'`]{0,100}(?:approved|معتمد)|(?:approved|معتمد)[^\n"'`]{0,100}(?:XML\/UBL\s*2\.1|PDF\/A-3)/i },
]

const mixedClaimRegression = 'ZATCA-ready — under technical and regulatory validation'

async function runtimeSources(root: string) {
  const appRoot = path.join(root, 'src/app')
  const files: string[] = []
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else if (/\.tsx?$/.test(entry.name) && !excludedRuntimeFiles.has(entry.name) && !/\.(?:test|spec|fixture)\.tsx?$/.test(entry.name)) {
        files.push(path.relative(root, absolute))
      }
    }
  }
  await walk(appRoot)
  const publicRoot = path.join(root, 'public')
  const walkPublic = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await walkPublic(absolute)
      else if (/\.(?:txt|html?|xml|json|md|js|mjs|svg)$/i.test(entry.name) && !/(?:terms|privacy)/i.test(entry.name)) files.push(path.relative(root, absolute))
    }
  }
  await walkPublic(publicRoot)
  return [...new Set([...files.sort(), ...staticSources])]
}

function staticTextParts(relativePath: string, source: string) {
  if (!/\.(?:tsx?|m?js)$/.test(relativePath)) return source.split('\n')
  const scriptKind = relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX
    : relativePath.endsWith('.ts') ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKind)
  const values: string[] = []

  const staticValue = (node: ts.Expression): string | null => {
    if (ts.isParenthesizedExpression(node)) return staticValue(node.expression)
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
      return staticValue(node.expression)
    }
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isTemplateExpression(node)) {
      let rendered = node.head.text
      for (const span of node.templateSpans) {
        const expression = staticValue(span.expression)
        if (expression === null) return null
        rendered += expression + span.literal.text
      }
      return rendered
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticValue(node.left)
      const right = staticValue(node.right)
      return left !== null && right !== null ? left + right : null
    }
    return null
  }

  const renderedJsxChildren = (children: readonly ts.JsxChild[]): string | null => {
    let rendered = ''
    let foundStatic = false
    for (const child of children) {
      if (ts.isJsxText(child)) {
        rendered += child.text
        foundStatic ||= child.text.length > 0
      } else if (ts.isJsxExpression(child)) {
        if (!child.expression) continue
        const value = staticValue(child.expression)
        if (value === null) return null
        rendered += value
        foundStatic = true
      } else if (ts.isJsxElement(child)) {
        const value = renderedJsxChildren(child.children)
        if (value === null) return null
        rendered += value
        foundStatic = true
      } else if (ts.isJsxFragment(child)) {
        const value = renderedJsxChildren(child.children)
        if (value === null) return null
        rendered += value
        foundStatic = true
      } else {
        return null
      }
    }
    return foundStatic ? rendered : null
  }

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const rendered = renderedJsxChildren(node.children)
      if (rendered?.trim()) values.push(rendered)
    }
    if (ts.isJsxText(node) && node.text.trim()) values.push(node.text)
    if (ts.isExpression(node)) {
      const value = staticValue(node)
      if (value !== null) values.push(value)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...new Set(values)]
}

const entityPattern = /(?:ZATCA|ZATKA|زاتكا|هيئة\s+الزكاة)/i
const subjectPattern = /(?:invoice|template|document|QR(?:\s*code)?|فاتور(?:ة|ات)|قالب|مستند|وثيقة|رمز(?:\s*QR)?|باركود)/i
const qualifierPattern = /(?:official|approved|certified|compliant|ready|رسمي(?:ة|اً|ا)?|معتمد(?:ة|اً|ا)?|اعتمد(?:ت|ها)?|تعتمد|مصدق(?:ة|اً|ا)?|متوافق(?:ة|اً|ا)?|جاهز(?:ة|اً|ا)?)/gi
const sentenceBoundaryPattern = /[.!?\n;؛]/

function isNegatedQualifier(value: string, qualifierStart: number) {
  const sentenceStart = Math.max(
    value.lastIndexOf('.', qualifierStart - 1), value.lastIndexOf('!', qualifierStart - 1),
    value.lastIndexOf('?', qualifierStart - 1), value.lastIndexOf('\n', qualifierStart - 1),
    value.lastIndexOf(';', qualifierStart - 1), value.lastIndexOf('؛', qualifierStart - 1),
  ) + 1
  const prefix = value.slice(sentenceStart, qualifierStart).slice(-48)
  return /\bnot\b[^.!?\n;؛]{0,40}$/i.test(prefix)
    || /(?:\bno\b|\bnever\b)[^.!?\n;؛]{0,32}$/i.test(prefix)
    || /(?:غير|ليس(?:ت)?|لم)\s*[^.!?\n;؛]{0,32}$/.test(prefix)
}

function claimMatchIsNegated(value: string, matchStart: number, matchText: string) {
  const qualifiers = new RegExp(qualifierPattern.source, 'gi')
  const matches = [...matchText.matchAll(qualifiers)]
  return matches.length > 0 && matches.every((match) => isNegatedQualifier(value, matchStart + (match.index ?? 0)))
}

function genericClaimMatches(value: string) {
  const failures: string[] = []
  qualifierPattern.lastIndex = 0
  for (const match of value.matchAll(qualifierPattern)) {
    const qualifierStart = match.index ?? 0
    const before = value.slice(0, qualifierStart)
    const after = value.slice(qualifierStart + match[0].length)
    const previousBoundary = Math.max(...['.', '!', '?', '\n', ';', '؛'].map((token) => before.lastIndexOf(token)))
    const nextOffsets = ['.', '!', '?', '\n', ';', '؛']
      .map((token) => after.indexOf(token))
      .filter((offset) => offset >= 0)
    const nextBoundary = nextOffsets.length ? Math.min(...nextOffsets) : after.length
    const sentence = value.slice(previousBoundary + 1, qualifierStart + match[0].length + nextBoundary)
    if (!sentenceBoundaryPattern.test(match[0]) && entityPattern.test(sentence) && subjectPattern.test(sentence) && !isNegatedQualifier(value, qualifierStart)) {
      failures.push(`claim-state: ${sentence.trim().slice(0, 180)}`)
    }
  }
  return failures
}

function claimFailures(relativePath: string, source: string) {
  const failures: string[] = []
  for (const value of staticTextParts(relativePath, source)) {
    if (allowedExactStatePhrases.has(value.trim())) continue
    for (const rule of forbiddenClaims) {
      const pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`)
      for (const match of value.matchAll(pattern)) {
        if (!claimMatchIsNegated(value, match.index ?? 0, match[0])) failures.push(`${relativePath}: ${rule.id}: ${value.slice(0, 180)}`)
      }
    }
    for (const failure of genericClaimMatches(value)) failures.push(`${relativePath}: ${failure}`)
  }
  return [...new Set(failures)]
}

test('mixed positive claim is rejected even when its disclaimer is on the same line', () => {
  expect(claimFailures('fixture.tsx', `const copy = "${mixedClaimRegression}"`)).toEqual([
    `fixture.tsx: ready-en: ${mixedClaimRegression}`,
  ])
})

test('direct JSX mixed claim is rejected', () => {
  expect(claimFailures('fixture.tsx', 'const view = <p>ZATCA-ready — under validation</p>')).toEqual([
    'fixture.tsx: ready-en: ZATCA-ready — under validation',
  ])
})

test('concatenated mixed claim is rejected', () => {
  expect(claimFailures('fixture.tsx', 'const copy = "ZATCA-" + "ready — under validation"')).toContain(
    'fixture.tsx: ready-en: ZATCA-ready — under validation',
  )
})

test('adjacent static JSX children are rendered together before claim scanning', () => {
  expect(claimFailures('fixture.tsx', "const view = <p>{'ZATCA-'}{'ready — under validation'}</p>")).toContain(
    'fixture.tsx: ready-en: ZATCA-ready — under validation',
  )
  expect(claimFailures('fixture.tsx', "const view = <p>{((`ZATCA-${'ready'}` + ' invoice'))}</p>")).toContainEqual(
    expect.stringContaining('ready-en'),
  )
})

test('official and compliance claim matrix is order-insensitive and negation-aware', () => {
  const positive = [
    'official ZATCA invoice',
    'approved ZATCA template',
    'certified ZATCA document',
    'compliant ZATCA invoice',
    'ready ZATCA invoice',
    'ZATCA official invoice',
    'ZATCA approved template',
    'ZATCA certified document',
    'ZATCA compliant invoice',
    'ZATCA invoice ready',
    'فاتورة زاتكا رسمية',
    'قالب زاتكا معتمد',
    'مستند زاتكا معتمد',
    'فاتورة متوافقة مع زاتكا',
    'فاتورة جاهزة لزاتكا',
    'زاتكا فاتورة رسمية',
    'زاتكا قالب معتمد',
    'هيئة الزكاة مستند معتمد',
  ]
  for (const claim of positive) {
    expect(claimFailures('fixture.tsx', `const copy = "${claim}"`), claim).not.toEqual([])
  }

  const negative = [
    'This ZATCA invoice is not official.',
    'This template is not approved by ZATCA.',
    'This document is not certified by ZATCA.',
    'This invoice is not compliant with ZATCA.',
    'This ZATCA invoice is not ready.',
    'This document is not ZATCA-stamped.',
    'لم تعتمد زاتكا هذه الفاتورة.',
    'هذا قالب زاتكا غير معتمد.',
    'هذا المستند غير معتمد من هيئة الزكاة.',
    'هذه الفاتورة غير متوافقة مع زاتكا.',
    'هذه الفاتورة غير جاهزة لزاتكا.',
  ]
  for (const claim of negative) {
    expect(claimFailures('fixture.tsx', `const copy = "${claim}"`), claim).toEqual([])
  }
})

test('QR claim subjects are order-insensitive and negation-aware', () => {
  const positive = [
    'official ZATCA QR',
    'ZATCA official QR',
    'QR approved by ZATCA',
    'رمز زاتكا معتمد',
  ]
  for (const claim of positive) {
    expect(claimFailures('fixture.tsx', `const copy = "${claim}"`), claim).not.toEqual([])
  }

  const negative = [
    'This QR is not ZATCA-stamped.',
    'QR غير معتمد من زاتكا',
  ]
  for (const claim of negative) {
    expect(claimFailures('fixture.tsx', `const copy = "${claim}"`), claim).toEqual([])
  }
})

test('all runtime and public sources reject unsupported ZATCA production claims', async () => {
  const root = path.resolve(process.cwd())
  const failures: string[] = []
  for (const relativePath of await runtimeSources(root)) {
    const source = await readFile(path.join(root, relativePath), 'utf8')
    failures.push(...claimFailures(relativePath, source))
  }
  expect(failures, failures.join('\n')).toEqual([])
})

test('roadmap marks unsupported ZATCA capabilities planned and not implemented', async () => {
  const source = await readFile(path.resolve('src/app/pages/feature-roadmap.tsx'), 'utf8')
  expect(source).not.toMatch(/Official invoice template|قالب فاتورة رسمي|Approved print template|قالب طباعة معتمد/i)
  for (const feature of ['128-bit UUID per invoice', 'Encrypted sequential linking (Sequential Hash)', 'QR code with 9 TLV elements', 'CSID cryptographic stamp', 'Non-resettable invoice counter', 'XML/UBL 2.1 + PDF/A-3 format', 'API integration with Fatoora platform', 'Phase 1 (Generation): QR for B2C', 'Phase 2 (Integration): API for B2B', 'Sandbox test environment']) {
    expect(source).toMatch(new RegExp(`nameEn: "${feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^\n]+status: "planned"`))
  }
  expect(source).toMatch(/Not implemented/i)
  expect(source).toMatch(/غير منفذ/)
})

test('claims freeze exposes the required non-production ZATCA states', async () => {
  const root = path.resolve(process.cwd())
  const [settings, invoicePrint, voucherPrint] = await Promise.all([
    readFile(path.join(root, 'src/app/pages/settings.tsx'), 'utf8'),
    readFile(path.join(root, 'src/app/pages/invoice-print-view.tsx'), 'utf8'),
    readFile(path.join(root, 'src/app/pages/voucher-print-view.tsx'), 'utf8'),
  ])
  expect(settings).toContain('LOCAL_UNVERIFIED')
  expect(settings).toContain('zatca_pipeline_not_ready')
  expect(settings).toContain('Credentials saved · clearance not enabled')
  expect(invoicePrint).toMatch(/QR contains core invoice data/i)
  expect(invoicePrint).toMatch(/not ZATCA-stamped/i)
  expect(voucherPrint).toMatch(/QR contains core invoice data/i)
  expect(voucherPrint).toMatch(/not ZATCA-stamped/i)
})

test('ZATCA plan comparison cells use neutral under-validation text instead of included ticks', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('entix-language', 'en'))
  await page.goto('/pricing')
  await page.getByRole('button', { name: /view detailed comparison/i }).click()
  const row = page.getByRole('row').filter({ hasText: 'ZATCA Phase 2 — Under validation' }).first()
  await expect(row).toBeVisible()
  await expect(row.getByText('Under validation', { exact: true })).toHaveCount(3)
  await expect(row.locator('[data-zatca-state="under-validation"]')).toHaveCount(3)
  await expect(row.locator('.text-green-500')).toHaveCount(0)

  const planStates = page.locator('[data-plan-zatca-state="under-validation"]')
  await expect(planStates).toHaveCount(2)
  await expect(planStates.locator('.text-green-500')).toHaveCount(0)
})


test('app header never infers a connected ZATCA state from Saudi country', async () => {
  const source = await readFile(path.resolve('src/app/components/app-header.tsx'), 'utf8')
  expect(source).not.toMatch(/(?:متصل|Connected|Manage connection|إدارة الربط)/)
  expect(source).toContain('ZATCA Phase 2 — Under validation')
  expect(source).toContain('ZATCA Phase 2 — قيد التحقق')
  expect(source).toMatch(/Review details|مراجعة التفاصيل/)
  expect(source).not.toMatch(/isSA[\s\S]{0,500}(?:connected|متصل)/i)
})

test('Gate 0 settings force ZATCA disabled in organization save payload', async () => {
  const source = await readFile(path.resolve('src/app/pages/settings.tsx'), 'utf8')
  expect(source).toMatch(/api\.orgs\.update\(org\.id,[\s\S]{0,700}zatcaEnabled:\s*false/)
  expect(source).not.toContain('zatcaEnabled: form.zatcaEnabled')
  expect(source).toMatch(/Gate 0|بوابة المرحلة صفر/)
})

test('landing and settings plan cards use neutral ZATCA validation states', async () => {
  const [landing, settings, pricing] = await Promise.all([
    readFile(path.resolve('src/app/pages/landing.tsx'), 'utf8'),
    readFile(path.resolve('src/app/pages/settings.tsx'), 'utf8'),
    readFile(path.resolve('src/app/pages/pricing-page.tsx'), 'utf8'),
  ])
  expect(landing).toContain('data-plan-zatca-state')
  expect(settings).toContain('data-plan-zatca-state')
  expect(settings).not.toMatch(/ZATCA Phase 2 (?:قيد التحقق|under validation)[^\n]+us: "✓"/i)
  expect(pricing).not.toMatch(/ZATCA Phase 2 (?:قيد التحقق|under validation)[^\n]+us: "✓"/i)
})
