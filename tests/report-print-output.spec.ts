import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { prepareVisualApp, visualOrgId } from './fixtures/visual-app'

const org = { id: visualOrgId, name: 'شركة اختبار التقارير', legalName: 'Report Testing Company', country: 'SA', baseCurrency: 'SAR', defaultInvoiceLanguage: 'ar', vatNumber: '300000000000003', paymentSettings: {} }
function payload(rows = 90, wide = false) {
  return { id: 'income-statement', title: 'قائمة الدخل', englishTitle: 'Income Statement', category: 'financial', status: 'live', generatedAt: '2026-09-17T10:00:00Z', period: { from: '2026-01-01', to: '2026-09-17' }, currency: 'SAR', org,
    sections: [{ id: 'income-summary', title: 'الإيرادات والمصروفات␟Revenue and expenses', columns: [{ key: 'label', label: 'البند␟Account' }, ...Array.from({length: wide ? 7 : 1}, (_, i) => ({ key: `amount${i}`, label: `الرصيد ${i}␟Balance ${i}`, kind: 'money', align: 'end' }))], rows: Array.from({ length: rows }, (_, i) => ({ id: `row-${i}`, label: `Account ${i}`, values: { label: `بند خدمات للمشروع ورقم الحساب ${i}␟Project service account ${i}`, ...Object.fromEntries(Array.from({length: wide ? 7 : 1}, (_, j) => [`amount${j}`, i % 2 ? -12345.67 : 98765.43])) } })) },
      { id: 'ledger-detail', title: 'تفصيل الحركات␟Transaction details', columns: [{key:'label', label:'الوصف␟Description'}], rows:[{id:'detail-1', values:{label:'تفصيل إضافي␟Additional detail'}}] }], summary: {} }
}
async function setup(page: any, settings: any, rows = 90, wide = false) {
  await prepareVisualApp(page, 'ar')
  await page.route('**/test-report-logo.svg', (route: any) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#5875DB"/><text x="10" y="27" font-size="20" fill="white">LOGO</text></svg>' }))
  await page.route('https://api.entix.io/api/reports/income-statement*', (route: any) => {
    expect(route.request().headers()['x-org-id']).toBe(visualOrgId)
    const data = payload(rows, wide)
    return route.fulfill({ json: {...data, org: {...data.org, logoUrl: '/test-report-logo.svg'}} })
  })
  await page.route(`https://api.entix.io/orgs/${visualOrgId}`, (route: any) => route.fulfill({ json: { ...org, paymentSettings: { reports: settings } } }))
}
for (const variant of [
  {template:'condensed', paper:'A4', orientation:'portrait', language:'ar'},
  {template:'classic', paper:'Letter', orientation:'landscape', language:'en'},
  {template:'condensed', paper:'A4', orientation:'landscape', language:'en', wide:true},
]) {
  test(`complete paginated PDF ${variant.template} ${variant.paper} ${variant.orientation}`, async ({ page }, testInfo) => {
    test.setTimeout(120000)
    await setup(page, { ...variant, bilingual:false, footerNote:'هذه البيانات لأغراض اختبار الطباعة — footer verification' }, 90, variant.wide)
    await page.goto(`/print/report/income-statement?orgId=${visualOrgId}&from=2026-01-01&to=2026-09-17&detail=summary`)
    const output = page.getByTestId('report-output-pages')
    await expect(output).toHaveAttribute('data-ready','true')
    const sheets = output.locator('.report-output-sheet')
    expect(await sheets.count()).toBeGreaterThan(1)
    await expect(output.locator('tbody tr')).toHaveCount(90)
    await expect(output).not.toContainText('Additional detail')
    const metrics = await sheets.evaluateAll((pages: Element[]) => pages.map(p => {
      const body = p.querySelector('.report-page-body') as HTMLElement
      const footer = p.querySelector('.report-page-footer') as HTMLElement
      const rows = Array.from(p.querySelectorAll('tbody tr'))
      return { fits: body.scrollHeight <= body.clientHeight + 1, bottom: rows.at(-1)?.getBoundingClientRect().bottom || 0, footer: footer.getBoundingClientRect().top, heads:p.querySelectorAll('thead').length }
    }))
    for(const m of metrics) { expect(m.fits).toBe(true); expect(m.bottom).toBeLessThanOrEqual(m.footer); expect(m.heads).toBeGreaterThan(0) }
    await expect(sheets.last().locator('.report-page-counter')).toHaveText(`${await sheets.count()} / ${await sheets.count()}`)
    await sheets.first().screenshot({ path: testInfo.outputPath('preview.png') })
    const download = page.waitForEvent('download')
    await page.getByTestId('report-download-pdf').click()
    const file = await download
    const filename = testInfo.outputPath('report.pdf')
    await file.saveAs(filename)
    const bytes = await readFile(filename)
    expect(bytes.subarray(0,5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(30000)
    // Each physical sheet is an independent PDF page, not one oversized screenshot.
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(await sheets.count())
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
test('designer prints from the same paginated content and applies document language', async ({page}) => {
  await setup(page, {template:'condensed', language:'en', bilingual:false}, 3)
  await page.goto(`/app/reports/income-statement/print?orgId=${visualOrgId}&detail=summary`)
  const output = page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready','true')
  await expect(output.locator('tbody tr')).toHaveCount(3)
  await expect(output).toContainText('report currency')
  await expect(output).not.toContainText('عملة التقرير')
  await expect(page.getByTestId('report-download-pdf')).toBeEnabled()
})
test('bilingual print labels retain a gap between Arabic and English', async ({page}, testInfo) => {
  await setup(page, {template:'condensed', language:'ar', bilingual:true}, 3)
  await page.goto(`/print/report/income-statement?orgId=${visualOrgId}&detail=summary`)
  const output = page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready','true')
  const gap = await output.locator('thead .report-bilingual').first().evaluate(label => {
    const [main, alternate] = Array.from(label.children).map(span => span.getBoundingClientRect())
    return Math.max(main.left - alternate.right, alternate.left - main.right)
  })
  expect(gap).toBeGreaterThanOrEqual(5)
  const download = page.waitForEvent('download')
  await page.getByTestId('report-download-pdf').click()
  await (await download).saveAs(testInfo.outputPath('bilingual.pdf'))
})
test('company mismatch fails closed without rendering or downloading another company', async ({page}) => {
  await setup(page, {}, 3)
  await page.route('https://api.entix.io/api/reports/income-statement*', route => route.fulfill({json: {...payload(3), org:{...org,id:'different-org'}}}))
  await page.goto(`/print/report/income-statement?orgId=${visualOrgId}`)
  await expect(page.locator('[data-render-error]')).toContainText('تغيّرت الشركة')
  await expect(page.getByTestId('report-download-pdf')).toHaveCount(0)
})

test('US tax report opens an isolated printable preview and downloads the same snapshot', async ({page}, testInfo) => {
  await prepareVisualApp(page, 'en')
  await page.route(`https://api.entix.io/orgs/${visualOrgId}`, route => route.fulfill({json:{...org,country:'US',baseCurrency:'USD'}}))
  await page.route('https://api.entix.io/api/tax-return/us-sales-tax*', route => route.fulfill({json:{type:'us-sales-tax',org:{name:org.name,legalName:org.legalName,state:'WY',ein:'TEST',usFilingClass:null},period:{from:'2026-01-01',to:'2026-09-17'},currency:'USD',sales:{grossSales:1000,taxCollected:100,taxableSales:1000,exemptSales:0,byState:[{state:'WY',base:1000,tax:100}],byRate:[]},irsGuide:null,hint:null}}))
  await page.goto('/app/taxes?from=2026-01-01&to=2026-09-17')
  await page.getByRole('button',{name:'Print / PDF',exact:true}).click()
  const output=page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready','true')
  await expect(output).toContainText('USD')
  await expect(output).toContainText('1,000.00')
  await expect(output).toContainText('WY')
  await expect(output).not.toContainText('Tax rates')
  const download=page.waitForEvent('download')
  await page.getByTestId('report-download-pdf').click()
  await (await download).saveAs(testInfo.outputPath('us-tax.pdf'))
  await page.getByRole('button',{name:'Back to tax return'}).click()
  await expect(page.getByRole('button',{name:'Print / PDF',exact:true})).toBeVisible()
})

test('Saudi VAT PDF retains tax lines, draft warning and saved withholding rows', async ({page}, testInfo) => {
  await prepareVisualApp(page,'ar')
  await page.route('https://api.entix.io/orgs', route=>route.fulfill({json:[org]}))
  await page.route(`https://api.entix.io/orgs/${visualOrgId}`, route=>route.fulfill({json:org}))
  const vat={base:100,vat:15},zero={base:0,vat:0}
  await page.route('https://api.entix.io/api/tax-return/sa-vat*', route=>route.fulfill({json:{org,period:{from:'2026-01-01',to:'2026-09-17'},vatDeclaration:{sales:{standardRated:vat,citizens:zero,zeroDomestic:zero,exports:zero,exempt:zero,nonTaxable:zero,totalBase:100,totalVat:15},purchases:{deductible:zero,importCustoms:zero,importRcm:zero,zeroExempt:zero,totalBase:0,totalVat:0},netVat:15,payable:15,refundable:0},withholding:{totalBase:200,totalWithholding:10,rows:[{voucherId:'v1',number:'PAY-1',date:'2026-09-17',beneficiary:'مورد خدمات',transferType:'SERVICE',currency:'SAR',baseAmount:200,rate:5,withholdingAmount:10}]},drafts:{count:1,invoices:[{id:'draft1',invoiceNumber:'DRAFT-1',issueDate:'2026-09-17',total:500,taxTotal:0}],bills:[]}}}))
  await page.goto('/app/taxes?from=2026-01-01&to=2026-09-17')
  await page.getByRole('button',{name:'طباعة / PDF',exact:true}).click()
  const output=page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready','true')
  await expect(output).toContainText('القيم المحفوظة')
  await expect(output).toContainText('PAY-1')
  await expect(output).toContainText('مسودة مستبعدة')
  await expect(output).not.toContainText('500.00')
  await output.locator('.report-output-sheet').first().screenshot({path:testInfo.outputPath('preview.png')})
  const download=page.waitForEvent('download')
  await page.getByTestId('report-download-pdf').click()
  await (await download).saveAs(testInfo.outputPath('sa-tax.pdf'))
})

test('native print receives only report pages in an isolated iframe, never the app shell', async ({page}) => {
  await setup(page, {template:'condensed',language:'ar'}, 30)
  await page.goto(`/app/reports/income-statement/print?orgId=${visualOrgId}&detail=summary`)
  const output=page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready','true')
  const pages=await output.locator('.report-output-sheet').count()
  // Headless browsers have no OS print dialog. Observe the document handed to print().
  await page.evaluate(() => {
    const observer=new MutationObserver(() => {
      const frame=document.getElementById('printWindow') as HTMLIFrameElement | null
      if(!frame?.contentWindow) return
      frame.contentWindow.print=()=>{
        const doc=frame.contentDocument!
        ;(window as any).__reportPrint={pages:doc.querySelectorAll('.report-output-sheet').length,rows:doc.querySelectorAll('tbody tr').length,hasShell:!!doc.querySelector('aside,nav,.report-designer-chrome'),width:doc.querySelector('.report-output-sheet')?.getBoundingClientRect().width}
      }
    })
    observer.observe(document.body,{childList:true})
  })
  await page.getByRole('button',{name:'طباعة',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as any).__reportPrint?.pages)).toBe(pages)
  const printed=await page.evaluate(()=>(window as any).__reportPrint)
  expect(printed.rows).toBe(30)
  expect(printed.hasShell).toBe(false)
  expect(printed.width).toBeGreaterThan(790)
})
