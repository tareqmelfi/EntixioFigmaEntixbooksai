import { test, expect, type Page } from '@playwright/test'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'
import { auditOverflow, AUDIT_WIDTHS } from './fixtures/overflow-audit'

/**
 * SPEC-05 §5 · the project page is the execution surface: the project NAME is the
 * page title with the CODE as a mono chip beside it, a figures strip, and the
 * tasks with their three pipeline colours (🟢 ≤80% · 🟡 80–100% · 🔴 over or late).
 *
 * Before this work `/api/projects/:id/tasks` 404'd and the page showed neither
 * tasks nor figures (CEO screenshot 2026-09-08).
 */

const PROJECT_ID = 'prj_3U8oafB2CpMkgB7N1hKuhpUy'

const project = {
  id: PROJECT_ID,
  code: 'EDG-PRJ-2026-0007',
  name: 'واجهة برج الأساسية التجاري · AL-ASASYAH COMMERCIAL TOWER FACADE',
  status: 'ACTIVE',
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  contractValue: '2163034.454',
  budget: '1480000.00',
  percentComplete: '35',
  clientContactId: 'contact-asasyah',
  clientName: 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة',
  notes: 'نطاق العمل: توريد وتركيب واجهة كلادينج ألمنيوم مركّب مع زجاج مزدوج عاكس · الاحتجاز 10% يُفرج عنه بعد سنة الضمان.',
}

const tasks = [
  {
    id: 'task-1', projectId: PROJECT_ID, itemNo: '1.01',
    title: 'أعمال الحفر والردم وتجهيز الموقع · EXCAVATION AND SITE PREPARATION WORKS',
    status: 'DONE', sortOrder: 0, plannedCost: '184500.00', plannedDays: 21,
    dueDate: '2026-04-01T00:00:00.000Z', progressPct: '100',
    actualCost: 121430.5, remainingCost: 63069.5, health: 'GREEN', costRatio: 0.66,
    overBudget: false, overdue: false, daysRemaining: 40, assigneeContact: null,
  },
  {
    id: 'task-2', projectId: PROJECT_ID, itemNo: '2.04',
    title: 'الهيكل الخرساني المسلح للأدوار المتكررة · REINFORCED CONCRETE SUPERSTRUCTURE',
    status: 'IN_PROGRESS', sortOrder: 1, plannedCost: '742800.00', plannedDays: 90,
    dueDate: '2026-09-30T00:00:00.000Z', progressPct: '62',
    actualCost: 631380.0, remainingCost: 111420.0, health: 'AMBER', costRatio: 0.85,
    overBudget: false, overdue: false, daysRemaining: 21, assigneeContact: null,
  },
  {
    id: 'task-3', projectId: PROJECT_ID, itemNo: '3.11',
    title: 'توريد وتركيب الكلادينج والزجاج العاكس · ALUMINIUM CLADDING AND GLAZING',
    status: 'BLOCKED', sortOrder: 2, plannedCost: '552700.00', plannedDays: 60,
    dueDate: '2026-08-15T00:00:00.000Z', progressPct: '18',
    actualCost: 608955.25, remainingCost: -56255.25, health: 'RED', costRatio: 1.1,
    overBudget: true, overdue: true, daysRemaining: -24, assigneeContact: null,
  },
]

const summary = {
  count: 3, plannedCost: 1480000, actualCost: 1361765.75, remainingCost: 118234.25,
  progressPct: 61.3, byHealth: { GREEN: 1, AMBER: 1, RED: 1 },
}

async function mockProject(page: Page) {
  await page.route(`https://api.entix.io/api/projects/${PROJECT_ID}/tasks**`, (route) =>
    route.fulfill({ json: { items: tasks, total: tasks.length, summary } }))
  await page.route(`https://api.entix.io/api/projects/${PROJECT_ID}/budget**`, (route) =>
    route.fulfill({ json: { id: 'budget-1', projectId: PROJECT_ID, status: 'APPROVED', costTotal: '1480000.00', lines: [] } }))
  await page.route(`https://api.entix.io/api/projects/${PROJECT_ID}/links**`, (route) =>
    route.fulfill({ json: { items: [], total: 0 } }))
  await page.route(`https://api.entix.io/api/projects/${PROJECT_ID}/linkable**`, (route) =>
    route.fulfill({ json: { items: [], contactId: null } }))
  await page.route(`https://api.entix.io/api/projects/${PROJECT_ID}`, (route) => route.fulfill({ json: project }))
  await page.route('https://api.entix.io/api/payment-plans**', (route) => route.fulfill({ json: { items: [], total: 0 } }))
  await page.route('https://api.entix.io/api/purchase-orders**', (route) => route.fulfill({ json: { items: [], total: 0 } }))
  await page.route('https://api.entix.io/api/contractors**', (route) => route.fulfill({ json: { items: [], total: 0 } }))
  await page.route('https://api.entix.io/api/tax-rates**', (route) => route.fulfill({ json: { items: [], total: 0, defaultId: null } }))
}

test.describe('project page · tasks and figures', () => {
  test('the NAME is the title, the CODE is a chip, and the figures strip is there', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockProject(page)
    await page.goto(`/app/projects/${PROJECT_ID}`)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('واجهة برج الأساسية')
    await expect(page.getByTestId('project-code-chip')).toHaveText('EDG-PRJ-2026-0007')

    const figures = page.getByTestId('project-figures')
    await expect(figures).toBeVisible()
    for (const label of ['قيمة العقد', 'الميزانية', 'التكلفة الفعلية', 'المتبقي', 'نسبة الإنجاز']) {
      await expect(figures.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test('every task carries its pipeline colour · 🟢 within · 🟡 near · 🔴 over or late', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockProject(page)
    await page.goto(`/app/projects/${PROJECT_ID}`)

    const section = page.getByTestId('project-tasks')
    await expect(section).toBeVisible()
    await expect(page.getByTestId('task-row-task-1')).toHaveAttribute('data-health', 'GREEN')
    await expect(page.getByTestId('task-row-task-2')).toHaveAttribute('data-health', 'AMBER')
    await expect(page.getByTestId('task-row-task-3')).toHaveAttribute('data-health', 'RED')
    // The actual cost is the aggregated figure, not a typed one.
    await expect(page.getByTestId('task-actual-task-3')).toHaveText('608,955.25')
    await expect(page.getByTestId('task-health-counts')).toBeVisible()
  })

  test('no sale price or margin appears anywhere on the execution surface', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await mockProject(page)
    await page.goto(`/app/projects/${PROJECT_ID}`)
    await expect(page.getByTestId('project-tasks')).toBeVisible()
    const text = (await page.getByTestId('project-tasks').innerText()) || ''
    for (const banned of ['هامش', 'الربح', 'سعر البيع']) {
      expect(text).not.toContain(banned)
    }
  })

  test('the projects list offers «إنشاء مشروع من ملف»', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await page.route('https://api.entix.io/api/projects**', (route) =>
      route.fulfill({ json: { items: [project], total: 1 } }))
    await page.goto('/app/projects')
    await expect(page.getByTestId('project-intake-open')).toBeVisible()
    await page.getByTestId('project-intake-open').click()
    await expect(page.getByTestId('intake-wizard-drop')).toBeVisible()
    await expect(page.getByTestId('intake-dropzone')).toBeVisible()
  })

  test('«المشاريع» is reachable from the sidebar', async ({ page }) => {
    await prepareVisualApp(page, 'ar')
    await page.goto('/app')
    const nav = page.locator('nav').first()
    const group = nav.getByRole('button', { name: 'المشاريع والتنفيذ' })
    await expect(group).toBeVisible()
    await group.click()
    await nav.getByRole('link', { name: 'المشاريع', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/projects$/)
  })
})

test.describe('project page · overflow audit', () => {
  for (const language of ['ar', 'en'] as const) {
    test(`no element spills its box at any width · ${language}`, async ({ page }) => {
      await prepareVisualApp(page, language)
      await mockProject(page)
      await page.goto(`/app/projects/${PROJECT_ID}`)
      await expect(page.getByTestId('project-tasks')).toBeVisible()
      for (const width of AUDIT_WIDTHS) {
        await page.setViewportSize({ width, height: 1000 })
        await page.waitForTimeout(250)
        const hits = await auditOverflow(page)
        expect(hits, `${language} @ ${width}: ${JSON.stringify(hits, null, 2)}`).toEqual([])
      }
    })
  }
})
