import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.cwd())
const source = (file: string) => readFile(path.join(root, file), 'utf8')

test('organization contracts expose a nullable unified national number on read, create, and update', async () => {
  const api = await source('src/app/lib/api.ts')
  const orgContract = api.slice(api.indexOf('export interface Org {'), api.indexOf('export interface AuditLogItem'))
  const createContract = api.slice(api.indexOf('export interface CreateOrgInput {'), api.indexOf('export interface ReportColumn'))

  expect(orgContract).toContain('unifiedNationalNumber?: string | null')
  expect(createContract).toContain('unifiedNationalNumber?: string | null')
  expect(api).toContain('export type UpdateOrgInput')
  expect(api).toMatch(/update: \(id: string, data: UpdateOrgInput\)/)
})

test('unified national number input normalizes Arabic digits, limits length, and validates length only', async () => {
  const digitsSource = await source('src/app/lib/digits.ts')
  expect(digitsSource).toContain('export function normalizeUnifiedNationalNumber')
  expect(digitsSource).toContain('export function isValidUnifiedNationalNumber')
  expect(digitsSource).toContain('export function nullableUnifiedNationalNumber')

  const digits = await import('../src/app/lib/digits')
  expect(digits.normalizeUnifiedNationalNumber('٧٠٠١٢٣٤٥٦٧٨٩')).toBe('7001234567')
  expect(digits.normalizeUnifiedNationalNumber('۷۰۰۱۲۳۴۵۶۷')).toBe('7001234567')
  expect(digits.isValidUnifiedNationalNumber('')).toBe(true)
  expect(digits.isValidUnifiedNationalNumber('7001234567')).toBe(true)
  expect(digits.isValidUnifiedNationalNumber('8001234567')).toBe(true)
  expect(digits.isValidUnifiedNationalNumber('700123456')).toBe(false)
  expect(digits.isValidUnifiedNationalNumber('70012345678')).toBe(false)
  expect(digits.nullableUnifiedNationalNumber('70012345678')).toBe('70012345678')
  expect(digits.nullableUnifiedNationalNumber('')).toBeNull()
  expect(digits.nullableUnifiedNationalNumber(' ٧٠٠١٢٣٤٥٦٧ ')).toBe('7001234567')
})

test('Saudi organization creation shows unified number before VAT and optional CR and submits normalized data', async () => {
  const create = await source('src/app/components/org-switcher.tsx')
  const saSpec = create.slice(create.indexOf('SA: {'), create.indexOf('AE: {'))
  const unified = saSpec.indexOf('key: "unifiedNationalNumber"')
  const vat = saSpec.indexOf('key: "vatNumber"')
  const cr = saSpec.indexOf('key: "crNumber"')

  expect(unified).toBeGreaterThan(-1)
  expect(unified).toBeLessThan(vat)
  expect(vat).toBeLessThan(cr)
  expect(saSpec).toContain('الرقم الوطني الموحد للمنشأة (رقم 700)')
  expect(saSpec).toContain('Unified National Number')
  expect(saSpec).toContain('السجل التجاري (اختياري)')
  expect(saSpec).toContain('Commercial registration (optional)')
  expect(saSpec).toContain('10 أرقام · يبدأ عادةً بـ 7')
  expect(saSpec).toContain('10 digits · usually starts with 7')
  expect(create).toMatch(/normalizeUnifiedNationalNumber\(e\.target\.value\)/)
  expect(create).toMatch(/isValidUnifiedNationalNumber\(form\.unifiedNationalNumber\)/)
  expect(create).toMatch(/unifiedNationalNumber:\s*form\.country === "SA"\s*\? nullableUnifiedNationalNumber\(form\.unifiedNationalNumber\)\s*:\s*null/)
})

test('non-Saudi organization creation does not expose unified number as a local field', async () => {
  const create = await source('src/app/components/org-switcher.tsx')
  for (const [country, next] of [['AE', 'KW'], ['KW', 'QA'], ['QA', 'BH'], ['BH', 'OM'], ['OM', 'EG'], ['EG', 'US'], ['US', 'GB']] as const) {
    const spec = create.slice(create.indexOf(`${country}: {`), create.indexOf(`${next}: {`))
    expect(spec, country).not.toContain('unifiedNationalNumber')
  }
})

test('Settings round-trips null and keeps Saudi identifier order and validation', async () => {
  const settings = await source('src/app/pages/settings.tsx')
  const unifiedLabel = settings.indexOf('الرقم الوطني الموحد للمنشأة (رقم 700)')
  const vatLabel = settings.indexOf('الرقم الضريبي', unifiedLabel)
  const crLabel = settings.indexOf('السجل التجاري (اختياري)', vatLabel)

  expect(settings).toContain('unifiedNationalNumber: active.unifiedNationalNumber || ""')
  expect(settings).toMatch(/unifiedNationalNumber:\s*form\.country === "SA"\s*\? nullableUnifiedNationalNumber\(form\.unifiedNationalNumber\)\s*:\s*null/)
  expect(settings).toMatch(/form\.country === "SA"[\s\S]{0,1000}Unified National Number/)
  expect(settings).toMatch(/isValidUnifiedNationalNumber\(form\.unifiedNationalNumber\)/)
  expect(settings).toContain('unifiedNationalNumber: e.target.value === "SA" ? form.unifiedNationalNumber : ""')
  expect(unifiedLabel).toBeGreaterThan(-1)
  expect(unifiedLabel).toBeLessThan(vatLabel)
  expect(vatLabel).toBeLessThan(crLabel)
})

test('print and report documents display the Saudi unified number before VAT and CR', async () => {
  const [invoice, voucher, report] = await Promise.all([
    source('src/app/pages/invoice-print-view.tsx'),
    source('src/app/pages/voucher-print-view.tsx'),
    source('src/app/components/report-document.tsx'),
  ])

  for (const [name, document] of [['invoice', invoice], ['voucher', voucher]] as const) {
    const unified = document.indexOf('org.unifiedNationalNumber')
    const vat = document.indexOf('org.vatNumber', unified)
    const cr = document.indexOf('org.crNumber', vat)
    expect(unified, name).toBeGreaterThan(-1)
    expect(unified, name).toBeLessThan(vat)
    expect(vat, name).toBeLessThan(cr)
    expect(document).toMatch(/isKsa\s*&&\s*org\.unifiedNationalNumber/)
  }

  const reportUnified = report.indexOf('report.org.unifiedNationalNumber')
  const reportVat = report.indexOf('report.org.vatNumber', reportUnified)
  const reportCr = report.indexOf('report.org.crNumber', reportVat)
  expect(reportUnified).toBeGreaterThan(-1)
  expect(reportUnified).toBeLessThan(reportVat)
  expect(reportVat).toBeLessThan(reportCr)
  expect(report).toMatch(/report\.org\.country === "SA"\s*&&\s*report\.org\.unifiedNationalNumber/)

  const [api, taxes] = await Promise.all([
    source('src/app/lib/api.ts'),
    source('src/app/pages/taxes.tsx'),
  ])
  expect(api.slice(api.indexOf('export interface TaxReturnPayload'))).toContain('unifiedNationalNumber?: string | null')
  const taxUnified = taxes.indexOf('payload.org.unifiedNationalNumber')
  const taxVat = taxes.indexOf('payload.org.vatNumber', taxUnified)
  expect(taxUnified).toBeGreaterThan(-1)
  expect(taxUnified).toBeLessThan(taxVat)
})
