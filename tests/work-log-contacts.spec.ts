import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

/**
 * Work-log worker = ANY contact (user ask 2026-08-19: «المقاول مو شرط يكون
 * فري لانسر، قائمة الاتصال بها يفترض الكل» — screenshot showed an empty
 * مورد picker). The form must list every contact and POST contactId.
 */

const SUPPLIER = {
  id: 'con-1', orgId: 'vt-org', customCode: 'SUP-001', shortCode: 'SPKP',
  type: 'SUPPLIER', isSupplier: true, isCustomer: false, entityKind: 'COMPANY',
  displayName: 'شركة سبيك بروز', email: 'ops@speakpros.sa', phone: '+966500000000',
}

const CUSTOMER = {
  id: 'con-2', orgId: 'vt-org', customCode: 'CUS-001', shortCode: 'BDWH',
  type: 'CUSTOMER', isCustomer: true, isSupplier: false, entityKind: 'COMPANY',
  displayName: 'شركة ابداع بدون حدود', email: null, phone: null,
}

const PROJECT = { id: 'prj-1', code: 'PRJ-001', name: 'مشروع التحول الرقمي', status: 'ACTIVE' }

test('work-log form lists ALL contacts (not only contractors) and submits contactId', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.route('https://api.entix.io/api/contacts*', (route) =>
    route.fulfill({ json: { items: [SUPPLIER, CUSTOMER], total: 2, page: 1, limit: 500 } }),
  )
  await page.route('https://api.entix.io/api/projects*', (route) =>
    route.fulfill({ json: { items: [PROJECT], total: 1 } }),
  )
  await page.route('https://api.entix.io/api/contractors', (route) =>
    route.fulfill({ json: { items: [], total: 0, peers: {} } }),
  )

  let postedBody: any = null
  await page.route('https://api.entix.io/api/contractors/work-logs', async (route) => {
    postedBody = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { id: 'wl-1', ...postedBody, amount: 0 } })
  })

  await page.goto('/app/work-logs/new')

  // the picker is the contact list — NOT an empty contractor list
  await expect(page.getByText('جهة العمل (من قائمة الاتصال)')).toBeVisible()
  await page.getByText('اختر جهة الاتصال...').click()
  await expect(page.getByText('شركة سبيك بروز')).toBeVisible()
  await expect(page.getByText('شركة ابداع بدون حدود')).toBeVisible()
  await page.getByText('شركة سبيك بروز').click()

  // project + hours + submit → the POST carries contactId (shell resolved server-side)
  await page.getByText('اختر المشروع...').click()
  await page.getByText(/مشروع التحول الرقمي/).click()
  await page.locator('input[type="number"]').first().fill('4')
  await page.getByRole('button', { name: 'تسجيل الساعات' }).click()

  await expect.poll(() => postedBody).not.toBeNull()
  expect(postedBody.contactId).toBe('con-1')
  expect(postedBody.projectId).toBe('prj-1')
  expect(postedBody.hours).toBe(4)
})

test('inline contact create from the work-log form selects the new contact', async ({ page }) => {
  await prepareVisualApp(page, 'ar')
  await page.route('https://api.entix.io/api/contacts*', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      await route.fulfill({ status: 201, json: { id: 'con-new', orgId: 'vt-org', type: 'SUPPLIER', isSupplier: true, entityKind: 'COMPANY', ...body } })
    } else {
      await route.fulfill({ json: { items: [SUPPLIER], total: 1, page: 1, limit: 500 } })
    }
  })
  await page.route('https://api.entix.io/api/projects*', (route) =>
    route.fulfill({ json: { items: [PROJECT], total: 1 } }),
  )
  await page.route('https://api.entix.io/api/contractors', (route) =>
    route.fulfill({ json: { items: [], total: 0, peers: {} } }),
  )

  await page.goto('/app/work-logs/new')
  await page.getByPlaceholder('اسم جهة جديدة...').fill('مؤسسة الأفق للمقاولات')
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click()
  // the created contact is selected — combobox trigger shows its name
  await expect(page.getByRole('button', { name: 'مؤسسة الأفق للمقاولات' })).toBeVisible()
})
