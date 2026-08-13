import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = (file: string) => readFile(path.join(root, file), 'utf8')

test('organization creation never generates or sends a slug', async () => {
  const [switcher, api] = await Promise.all([
    source('src/app/components/org-switcher.tsx'),
    source('src/app/lib/api.ts'),
  ])

  expect(switcher).not.toMatch(/const slug\s*=\s*form\.name/)
  expect(switcher).not.toMatch(/slug:\s*slug\s*\+/)
  expect(api).not.toMatch(/export interface CreateOrgInput\s*\{[\s\S]*?\n\s*slug:\s*string/)
  expect(api).not.toMatch(/api\.orgs\.create\(\{[\s\S]*?slug:/)
})

test('organization form displays structured name errors inline', async () => {
  const [switcher, api] = await Promise.all([
    source('src/app/components/org-switcher.tsx'),
    source('src/app/lib/api.ts'),
  ])

  expect(api).toMatch(/fieldErrors\?:\s*Record<string,\s*string\[\]>/)
  expect(switcher).toMatch(/fieldErrors\.name/)
  expect(switcher).toMatch(/aria-invalid=\{!!fieldErrors\.name/)
})

test('existing-company demo controls and reset mode are removed', async () => {
  const [dashboard, settings, api] = await Promise.all([
    source('src/app/pages/dashboard.tsx'),
    source('src/app/pages/settings.tsx'),
    source('src/app/lib/api.ts'),
  ])

  expect(dashboard).not.toContain('seedDemoData')
  expect(dashboard).not.toContain('Seed with demo data')
  expect(settings).not.toContain('seedDemoData')
  expect(settings).not.toContain('Seed full demo data')
  expect(settings).not.toMatch(/runReset\("demo"\)/)
  expect(api).not.toContain('/seed-demo-data')
  expect(api).not.toMatch(/mode:\s*'blank'\s*\|\s*'demo'/)
})

test('explicit separate demo-company creation remains available', async () => {
  const [switcher, api] = await Promise.all([
    source('src/app/components/org-switcher.tsx'),
    source('src/app/lib/api.ts'),
  ])

  expect(switcher).toContain('Create temporary demo (30 days)')
  expect(switcher).toContain('seedDemo({ country: "SA" })')
  expect(api).toContain("'/orgs/_/seed-demo'")
})

test('report UI has no demo preview, status copy, query parsing, or request propagation', async () => {
  const [view, document, api] = await Promise.all([
    source('src/app/pages/report-view.tsx'),
    source('src/app/components/report-document.tsx'),
    source('src/app/lib/api.ts'),
  ])

  expect(view).not.toMatch(/searchParams\.get\(["']demo["']\)/)
  expect(view).not.toContain('Demo preview')
  expect(view).not.toContain('Demo Preview')
  expect(view).not.toContain('demo=1')
  expect(view).not.toMatch(/demo:\s*demo\s*\?/)
  expect(document).not.toContain('report.status === "demo"')
  expect(document).not.toContain('Demo Preview')
  expect(api).not.toMatch(/reports:\s*\{[\s\S]*?demo\?:\s*number/)
  expect(api).not.toContain("status: 'live' | 'demo' | 'empty'")
})

test('report print designer never parses or propagates demo=1', async () => {
  const designer = await source('src/app/pages/report-print-designer.tsx')

  expect(designer).not.toMatch(/searchParams\.get\(["']demo["']\)/)
  expect(designer).not.toContain('demo=1')
  expect(designer).not.toMatch(/demo:\s*demo\s*\?/)
  expect(designer).not.toMatch(/\[id,\s*from,\s*to,\s*demo\]/)
})

test('auth store classifies demos only by explicit expiry marker', async () => {
  const [authStore, api] = await Promise.all([
    source('src/app/components/auth-store.ts'),
    source('src/app/lib/api.ts'),
  ])

  expect(authStore).not.toMatch(/startsWith\(["']demo-["']\)/)
  expect(authStore).toMatch(/demoExpiresAt\s*!=\s*null/)
  expect(api).toMatch(/export interface Org\s*\{[\s\S]*?demoExpiresAt\?:\s*string\s*\|\s*null/)
  expect(api).toMatch(/memberships:[\s\S]*?org:[\s\S]*?demoExpiresAt\?:\s*string\s*\|\s*null/)
})

test('real demo-prefixed slug is production while explicit marker is demo', async () => {
  const authStore = await import('../src/app/components/auth-store') as any
  expect(typeof authStore.isDemoMembership).toBe('function')

  expect(authStore.isDemoMembership({
    org: { slug: 'demo-company-ab12cd34', demoExpiresAt: null },
  })).toBe(false)
  expect(authStore.isDemoMembership({
    org: { slug: 'production-name-ab12cd34', demoExpiresAt: '2026-09-12T00:00:00.000Z' },
  })).toBe(true)
})
