import { expect, test } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'

test('owner can request attachment-only key without granting document posting scopes', async ({ page }) => {
  await prepareVisualApp(page, 'en')
  let payload: any
  await page.route('https://api.entix.io/api/api-keys', async route => {
    if (route.request().method() === 'POST') {
      payload = route.request().postDataJSON()
      return route.fulfill({ json: { key: 'synthetic-key-not-valid', apiKey: { name: payload.name } } })
    }
    return route.fulfill({ json: { keys: [] } })
  })
  await page.goto('/app/settings?tab=api-keys')
  await page.getByRole('button', { name: 'New key', exact: true }).click()
  await expect(page.getByText('Write: sales invoices', { exact: true })).toBeVisible()
  await expect(page.getByText('Write: purchase bills', { exact: true })).toBeVisible()
  await expect(page.getByText('Write: expenses', { exact: true })).toBeVisible()
  await page.getByPlaceholder('e.g. Claude · COA import').fill('Synthetic attachment importer')
  await page.getByRole('button', { name: /Append: attachments only write:attachments/ }).click()
  await page.getByRole('button', { name: 'Create key', exact: true }).click()
  await expect(page.getByText('synthetic-key-not-valid', { exact: true })).toBeVisible()
  expect(payload.scopes).toEqual(['read', 'write:attachments'])
})
