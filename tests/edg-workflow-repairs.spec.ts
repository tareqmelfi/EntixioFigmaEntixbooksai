import { expect, test, type Page } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'
import { renderDocument, sampleInput } from '../src/app/lib/document-render'

const quote = {
  id: 'quote-edg', quoteNumber: 'Q-EDG-01', contactId: 'contact-edg', status: 'DRAFT',
  issueDate: '2026-09-01', validUntil: '2020-09-20', currency: 'USD',
  subtotal: 100, total: 100, taxTotal: 0,
  contact: { id: 'contact-edg', displayName: 'EDG Test', email: 'customer@example.test', type: 'CUSTOMER' },
  lines: [{ id: 'line-1', description: 'Consulting', quantity: 1, unitPrice: 100, total: 100, taxRate: 0 }],
}

async function quotesFixture(page: Page, language: 'en' | 'ar' = 'en') {
  await prepareVisualApp(page, language)
  await page.route('**/api/document-templates/render/QUOTE/**', r => r.fulfill({ contentType: 'text/html', body: renderDocument({ ...sampleInput('QUOTE', language), actions: false }).html.replace('</head>', `<meta name="entix-document-hash" content="${'b'.repeat(64)}"></head>`) }))
  await page.route('https://api.entix.io/api/contacts**', r => r.fulfill({ json: { items: [quote.contact] } }))
  await page.route('https://api.entix.io/api/payment-plans/templates', r => r.fulfill({ json: { items: [] } }))
  await page.route('https://api.entix.io/api/quotes**', r => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/attachments')) return r.fulfill({ json: { items: [] } })
    if (path === '/api/quotes' || path === '/api/quotes/overview') return r.fulfill({ json: { items: [quote, { ...quote, id: 'converted', status: 'CONVERTED' }, { ...quote, id: 'accepted', status: 'ACCEPTED' }] } })
    return r.fulfill({ json: quote })
  })
}

test('accept link never sends email, leaves draft status, and provides copy fallback', async ({ page }) => {
  await quotesFixture(page)
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied') } } }))
  const posts: string[] = []
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).hostname === 'api.entix.io') posts.push(new URL(r.url()).pathname) })
  await page.route('https://api.entix.io/api/quotes/quote-edg/send', r => { expect(r.request().postDataJSON()).toEqual({ email: false }); return r.fulfill({ json: { token: 'test-token', url: 'https://entix.io/q/test-token', emailed: false } }) })
  await page.goto('/app/quotes/quote-edg')
  await page.getByTestId('quote-accept-link').click()
  await expect(page.getByTestId('quote-accept-link-result').getByRole('textbox')).toHaveValue('https://entix.io/q/test-token')
  await expect(page.getByTestId('quote-accept-link-result')).toContainText('no email sent')
  expect(posts).toEqual(['/api/quotes/quote-edg/send'])
  await expect(page.getByText('Draft', { exact: true }).last()).toBeVisible()
})

test('accepted metric retains converted quotes and draft expiry is visible', async ({ page }) => {
  await quotesFixture(page)
  await page.goto('/app/quotes')
  await expect(page.getByTestId('quote-metric-ACCEPTED')).toContainText('1')
  await expect(page.getByTestId('quote-metric-CONVERTED')).toContainText('1')
  await expect(page.getByTestId('quote-group-converted')).toBeVisible()
  await expect(page.getByTestId('quote-date-quote-edg')).toHaveClass(/text-danger/)
})

test('full preview stays in the same tab, returning and saving preserves the quote', async ({ page, context }) => {
  await quotesFixture(page)
  let updates = 0
  await page.route('https://api.entix.io/api/quotes/quote-edg', async r => {
    if (r.request().method() === 'PATCH') updates++
    await r.fulfill({ json: quote })
  })
  await page.route('**/print/proposal/quote-edg?**', r => r.fulfill({ contentType: 'text/html', body: '<html><body>Proposal preview ready</body></html>' }))
  await page.goto('/app/quotes/quote-edg')
  await page.getByTestId('quote-detail-edit').click()
  await page.getByTestId('quote-full-preview').click()
  await expect(page.getByTestId('quote-preview-frame')).toBeVisible()
  await expect(page.frameLocator('[data-testid="quote-preview-frame"]').getByText('Proposal preview ready')).toBeVisible()
  expect(context.pages()).toHaveLength(1)
  await page.getByTestId('quote-preview-back').click()
  await page.getByTestId('quote-full-preview').click()
  await expect(page.getByTestId('quote-preview-frame')).toBeVisible()
  expect(updates).toBe(2)
  expect(context.pages()).toHaveLength(1)
})

test('previewing a new quote twice creates only one draft', async ({ page }) => {
  await quotesFixture(page)
  let creates = 0
  let updates = 0
  await page.route('https://api.entix.io/api/quotes', r => {
    if (r.request().method() === 'POST') { creates++; return r.fulfill({ json: quote }) }
    return r.fulfill({ json: { items: [] } })
  })
  await page.route('https://api.entix.io/api/quotes/quote-edg', r => {
    if (r.request().method() === 'PATCH') updates++
    return r.fulfill({ json: quote })
  })
  await page.route('**/print/proposal/quote-edg?**', r => r.fulfill({ contentType: 'text/html', body: '<html><body>Preview</body></html>' }))
  await page.goto('/app/quotes?new=1&contactId=contact-edg')
  await page.getByPlaceholder('Description', { exact: true }).first().fill('Consulting')
  await page.locator('input[inputmode="decimal"]').nth(1).fill('100')
  await page.getByTestId('quote-full-preview').click()
  await expect(page.getByTestId('quote-preview-frame')).toBeVisible()
  await page.getByTestId('quote-preview-back').click()
  await page.getByTestId('quote-full-preview').click()
  await expect(page.getByTestId('quote-preview-frame')).toBeVisible()
  expect(creates).toBe(1)
  expect(updates).toBe(1)
})

const entry = {
  id: 'journal-edg', number: 'JV-EDG-01', date: '2026-09-26', description: 'Upload audit',
  source: 'manual', status: 'DRAFT', totalDebit: 10, totalCredit: 10, lineCount: 2,
  lines: [{ accountCode: '51060', accountName: 'Expense', debit: 10, credit: 0 }, { accountCode: '11000', accountName: 'Cash', debit: 0, credit: 10 }], attachments: [],
}
async function journalFixture(page: Page) {
  await prepareVisualApp(page, 'en')
  await page.route('https://api.entix.io/api/journals?**', r => r.fulfill({ json: { items: [entry], total: 1 } }))
  await page.route('https://api.entix.io/api/journals/journal-edg', r => r.fulfill({ json: entry }))
  await page.goto('/app/journal-entries')
  await page.getByText('JV-EDG-01').click()
}

test('failed PDF upload shows error without a success toast', async ({ page }) => {
  await journalFixture(page)
  await page.route('https://api.entix.io/api/journals/journal-edg/attachments', r => r.fulfill({ status: 500, json: { error: 'upload_failed' } }))
  await page.locator('input[type=file]').setInputFiles({ name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') })
  await expect(page.getByText(/evidence.pdf —/)).toBeVisible()
  await expect(page.getByText('Attachment uploaded', { exact: true })).toHaveCount(0)
  await expect(page.getByText('No attachments', { exact: true })).toBeVisible()
})

test('mixed upload reports only successful files and keeps their attachment', async ({ page }) => {
  await journalFixture(page)
  await page.route('https://api.entix.io/api/journals/journal-edg/attachments', r => {
    const body = r.request().postDataJSON()
    if (body.filename === 'bad.pdf') return r.fulfill({ status: 500, json: { error: 'upload_failed' } })
    return r.fulfill({ json: { id: 'attachment-good', ...body, url: 'data:application/pdf;base64,JVBERg==' } })
  })
  await page.locator('input[type=file]').setInputFiles([
    { name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') },
    { name: 'good.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') },
  ])
  await expect(page.getByText('1 of 2 files uploaded — retry the failed files', { exact: true })).toBeVisible()
  await expect(page.getByText('good.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('2 files uploaded', { exact: true })).toHaveCount(0)
})


test('closed-period posting failure stays draft and explains the protection', async ({ page }) => {
  await journalFixture(page)
  await page.route('https://api.entix.io/api/journals/journal-edg/post', r => r.fulfill({ status: 409, json: { error: 'period_locked' } }))
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText(/The fiscal period is closed · contact your accounting administrator/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeVisible()
  await expect(page.getByText('Entry posted · it will reflect on the dashboard', { exact: true })).toHaveCount(0)
})

for (const timezoneId of ['America/Los_Angeles', 'Asia/Riyadh']) {
  test(`bank accounting date is readable and unchanged in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId })
    const page = await context.newPage()
    await prepareVisualApp(page, 'ar')
    await page.route('https://api.entix.io/api/bank-accounts', r => r.fulfill({ json: { items: [{ id: 'bank-edg', name: 'Bank EDG', bankName: 'Test Bank', currency: 'SAR', balance: 460 }], totalBalance: 460 } }))
    await page.route('https://api.entix.io/api/vouchers?**', r => r.fulfill({ json: { items: [{ id: 'receipt-edg', number: 'R-01', date: '2026-09-21T00:00:00.000Z', type: 'RECEIPT', amount: 460, currency: 'SAR' }] } }))
    await page.goto(`http://localhost:${process.env.ENTIX_DEV_PORT || '5173'}/app/bank-accounts/bank-edg`)
    const date = page.getByTestId('bank-transaction-date')
    await expect(date).toHaveText('2026-09-21')
    await expect(date).toHaveAttribute('datetime', '2026-09-21')
    const fits = await date.evaluate(el => { const cell = el.closest('td')!; return el.getBoundingClientRect().width + 32 <= cell.getBoundingClientRect().width })
    expect(fits).toBe(true)
    await context.close()
  })
}

for (const response of [
  { status: 429, json: { message: 'RATE_LIMITED' }, expected: 'Too many requests. Wait a little before trying again.' },
  { status: 403, json: { message: 'captcha_required' }, expected: 'The request was not accepted. Check your email and complete the security check, then try again.' },
  { status: 200, json: { status: false }, expected: 'Could not request a reset link right now. Retry or contact support.' },
  { status: 200, json: { status: true }, expected: 'Check your email' },
]) {
  test(`password recovery reports ${response.status}/${response.json.status ?? 'rejected'} truthfully`, async ({ page }) => {
    await prepareVisualApp(page, 'en')
    await page.addInitScript(() => {
      window.turnstile = { render: (_el, opts) => { setTimeout(() => (opts.callback as Function)('test-token'), 0); return 'mock' }, reset: () => {}, remove: () => {} }
    })
    await page.route('https://api.entix.io/api/auth/get-session', r => r.fulfill({ json: null }))
    await page.route('https://api.entix.io/api/auth/request-password-reset', r => r.fulfill({ status: response.status, json: response.json }))
    await page.goto('/forgot-password')
    await page.getByPlaceholder('you@company.com').fill('nobody@example.test')
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
    await expect(page.getByText(response.expected, { exact: true })).toBeVisible()
    if (response.json.status !== true) await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
  })
}


test('ambiguous signature delivery explains support review without success', async ({ page }) => {
  await quotesFixture(page)
  await page.route('https://api.entix.io/api/sign/requests?**', r => r.fulfill({ json: { items: [] } }))
  await page.route('https://api.entix.io/api/sign/quotes/quote-edg/send', r => r.fulfill({ status: 502, json: { error: 'signature_delivery_unknown' } }))
  await page.goto('/app/quotes/quote-edg')
  await page.getByTestId('quote-request-signature').click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Send for signing', exact: true }).click()
  await expect(page.getByText(/Signature delivery could not be confirmed · ask support to review its status before resending to avoid duplicates/)).toBeVisible()
  await expect(page.getByText(/Quote sent for signing to/)).toHaveCount(0)
})

for (const language of ['en', 'ar'] as const) {
  test(`quote actions distinguish email, approval and signature without sending (${language})`, async ({ page }) => {
    await quotesFixture(page, language)
    const posts: string[] = []
    page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).hostname === 'api.entix.io') posts.push(new URL(r.url()).pathname) })
    await page.route('**/api/sign/requests?**', r => r.fulfill({ json: { items: [] } }))
    await page.goto('/app/quotes/quote-edg')
    const actions = page.getByTestId('quote-workflow-actions')
    await expect(actions.getByRole('button', { name: language === 'ar' ? 'نسخ رابط موافقة العميل' : 'Copy customer approval link', exact: true })).toBeVisible()
    await expect(actions).toContainText(language === 'ar' ? 'الموافقة تنشئ مشروعًا' : 'Approval creates a project')
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await actions.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    await actions.screenshot({ path: `test-results/quote-actions-${language}.png` })
    await page.getByRole('button', { name: language === 'ar' ? 'إرسال' : 'Send', exact: true }).first().click()
    await expect(page.getByTestId('send-compose-to')).toHaveValue('customer@example.test')
    await expect(page.getByTestId('send-compose-submit')).toBeVisible()
    expect(posts).toEqual([])
    await page.goto('/app/quotes/quote-edg')
    await page.getByTestId('quote-request-signature').click()
    await expect(page.getByRole('button', { name: language === 'ar' ? 'تجهيز رابط التوقيع' : 'Prepare signing link', exact: true })).toBeEnabled()
    await expect(page.getByTestId('send-compose-submit')).toHaveCount(0)
    expect(posts).toEqual([])
  })
}
