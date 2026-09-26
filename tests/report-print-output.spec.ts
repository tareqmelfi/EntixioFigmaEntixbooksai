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
test('bilingual labels stack languages in source and paginated PDF', async ({page}, testInfo) => {
  await setup(page, {template:'condensed', language:'ar', bilingual:true}, 3)
  await page.goto(`/print/report/income-statement?orgId=${visualOrgId}&detail=summary`)
  const output = page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready','true')
  for (const container of [page.locator('.report-measure-source'), output]) {
    const labels = await container.locator('.report-bilingual').evaluateAll(labels => labels.map(label => {
      const [main, alternate] = Array.from(label.children).map(span => span.getBoundingClientRect())
      return !alternate || alternate.top >= main.bottom
    }))
    expect(labels.every(Boolean)).toBe(true)
  }
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

for (const template of ['condensed', 'classic']) {
  test(`13-column project report keeps names and every metric readable (${template})`, async ({ page }, testInfo) => {
    test.setTimeout(120000)
    await setup(page, { template, orientation: 'portrait', language: 'ar' }, 3)
    const projects = Array.from({ length: 18 }, (_, index) => ({
      id: `project-${index}`, label: `PRJ-${index}`,
      values: { label: `PRJ-${index} · تصميم وإعادة تأهيل المشروع المعماري الداخلي وتنفيذ الأعمال الإنشائية في حي الملك عبدالله بمدينة الرياض`,
        ...Object.fromEntries(Array.from({ length: 12 }, (_, metric) => [`metric${metric}`, 1234567.89 + metric])) },
    }))
    const columns = [{ key: 'label', label: 'المشروع␟Project' }, ...Array.from({ length: 12 }, (_, metric) => ({ key: `metric${metric}`, label: `مؤشر المشروع ${metric}␟Project metric ${metric}`, kind: 'money', align: 'end' }))]
    await page.route('https://api.entix.io/api/reports/project-profitability*', route => route.fulfill({ json: {
      ...payload(0), id: 'project-profitability', title: 'ربحية المشاريع', englishTitle: 'Project profitability',
      sections: [{ id: 'project-profitability', title: 'ربحية المشاريع␟Project profitability', description: 'إيرادات وتكلفة المشروع وصافي الربح␟Project revenue, cost and net profit', columns, rows: projects }],
    } }))
    await page.goto(`/print/report/project-profitability?orgId=${visualOrgId}`)
    const output = page.getByTestId('report-output-pages')
    await expect(output).toHaveAttribute('data-ready', 'true')
    const sheets = output.locator('.report-output-sheet')
    expect(await sheets.count()).toBeGreaterThan(1)
    await expect(output.locator('tbody tr')).toHaveCount(36)
    // Every identity repeats in both column panels, every metric remains once per project.
    await expect(output).toContainText('بمدينة الرياض')
    const metrics = await sheets.evaluateAll(elements => elements.map(sheet => {
      const box = sheet.getBoundingClientRect()
      const body = sheet.querySelector('.report-page-body') as HTMLElement
      return {
        landscape: box.width > box.height,
        fits: body.scrollHeight <= body.clientHeight + 1,
        headers: sheet.querySelectorAll('thead').length,
        widths: Array.from(sheet.querySelectorAll('tbody tr:first-child td:first-child'), cell => cell.getBoundingClientRect().width),
        overflow: Array.from(sheet.querySelectorAll('tbody td')).some(cell => cell.scrollWidth > cell.clientWidth + 1),
        numbersWrap: Array.from(sheet.querySelectorAll('.numeric-text')).some(span => getComputedStyle(span).whiteSpace !== 'nowrap'),
      }
    }))
    for (const metric of metrics) {
      expect(metric.landscape).toBe(true)
      expect(metric.fits).toBe(true)
      expect(metric.headers).toBeGreaterThan(0)
      expect(metric.overflow).toBe(false)
      for (const width of metric.widths) expect(width).toBeGreaterThan(230)
    }
    for (let metric = 0; metric < 12; metric++) {
      const amount = (1234567.89 + metric).toLocaleString('en-US', { minimumFractionDigits: 2 })
      expect(await output.locator('tbody .numeric-text').filter({ hasText: amount }).count()).toBe(18)
    }
    if (template === 'condensed') {
      for (const container of [page.locator('.report-measure-source'), output]) {
        const labels = await container.locator('.report-bilingual').evaluateAll(labels => labels.map(label => {
          const [main, alternate] = Array.from(label.children).map(span => span.getBoundingClientRect())
          return !alternate || alternate.top >= main.bottom
        }))
        expect(labels.every(Boolean)).toBe(true)
        const currencies = await container.locator('.report-column-currency').evaluateAll(elements => elements.map(element => {
          const range = document.createRange(); range.selectNodeContents(element)
          const boxes = Array.from(range.getClientRects())
          return { singleLine: boxes.length > 0 && Math.max(...boxes.map(box => box.top)) < Math.min(...boxes.map(box => box.bottom)), text: element.textContent, whiteSpace: getComputedStyle(element).whiteSpace }
        }))
        expect(currencies.length).toBeGreaterThan(0)
        for (const currency of currencies) { expect(currency.text).toBe('(SAR)'); expect(currency.singleLine).toBe(true); expect(currency.whiteSpace).toBe('nowrap') }
      }
    }
    await sheets.first().screenshot({ path: testInfo.outputPath('wide-preview.png') })
    const download = page.waitForEvent('download')
    await page.getByTestId('report-download-pdf').click()
    const path = testInfo.outputPath('project-profitability.pdf')
    await (await download).saveAs(path)
    const bytes = await readFile(path)
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(await sheets.count())
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('cash flow summary preserves its only detail section and empty data is explicit', async ({ page }) => {
  await setup(page, { template: 'condensed', language: 'ar' }, 3)
  await page.route('https://api.entix.io/api/reports/cash-flow-indirect*', route => route.fulfill({ json: {
    ...payload(0), id: 'cash-flow-indirect', title: 'التدفقات النقدية غير المباشرة',
    sections: [{ id: 'cash-flow-detail', title: 'التشغيل', columns: [{ key: 'label', label: 'البند' }, { key: 'amount', label: 'القيمة', kind: 'money' }], rows: [{ id: 'profit', label: 'صافي الربح', values: { label: 'صافي الربح', amount: 23456.78 } }] }],
  } }))
  await page.goto(`/print/report/cash-flow-indirect?orgId=${visualOrgId}&detail=summary`)
  const output = page.getByTestId('report-output-pages')
  await expect(output).toHaveAttribute('data-ready', 'true')
  await expect(output).toContainText('23,456.78')
  await page.route('https://api.entix.io/api/reports/cash-flow-indirect*', route => route.fulfill({ json: { ...payload(0), id: 'cash-flow-indirect', sections: [] } }))
  await page.reload()
  await expect(output).toHaveAttribute('data-ready', 'true')
  await expect(output).toContainText('لا تتوفر بيانات لهذا التقرير خلال الفترة المحددة.')
})

for (const template of ['condensed', 'classic']) {
  test(`compact report columns use spare space for full project names (${template})`, async ({ page }, testInfo) => {
    await setup(page, { template, language: 'ar', orientation: 'landscape' }, 0)
    const name = 'تصميم-واعادة-تعد · تصميم واعادة تعديل التصميم المعماري الداخلي'
    const columns = [{ key: 'label', label: 'المشروع␟Project' },
      ...['التكلفة␟Cost', 'الهامش␟Margin', 'الهامش %␟Margin %', 'الميزانية␟Budget', 'الفرق␟Variance', 'الاحتجاز␟Retention']
        .map((label, i) => ({ key: `metric${i}`, label, kind: i === 2 ? 'number' : 'money', align: 'end' }))]
    await page.route('https://api.entix.io/api/reports/project-profitability*', route => route.fulfill({ json: {
      ...payload(0), id: 'project-profitability', title: 'ربحية المشاريع', englishTitle: 'Project profitability',
      sections: [{ id: 'project-profitability', title: 'ربحية المشاريع␟Project profitability', columns,
        rows: [name, 'PRJ-002 · ترميم سقف جبس ومعالجة أثر تسريب — مكتب شركة الفن الأبيض',
          'PRJ-EDG-Q-2026-0013 · مشروع عرض EDG-Q-2026-0013'].map((label, i) => ({ id: `project-${i}`, label,
          values: { label, metric0: 0, metric1: 400, metric2: 100, metric3: 90000, metric4: 31092.26, metric5: 0 } })) }],
    } }))
    await page.goto(`/print/report/project-profitability?orgId=${visualOrgId}`)
    const output = page.getByTestId('report-output-pages')
    await expect(output).toHaveAttribute('data-ready', 'true')
    const layout = await output.locator('tbody tr').first().evaluate(row => {
      const cells = Array.from(row.querySelectorAll('td'))
      const label = cells[0].querySelector('bdi')!
      const range = document.createRange(); range.selectNodeContents(label)
      const lines = new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top)))
      return { lines: lines.size, height: row.getBoundingClientRect().height,
        widths: cells.map(cell => cell.getBoundingClientRect().width),
        overflow: cells.some(cell => cell.scrollWidth > cell.clientWidth + 1) }
    })
    expect(layout.lines).toBe(1)
    expect(layout.height).toBeLessThan(29)
    expect(layout.widths[0]).toBeGreaterThan(450)
    expect(Math.max(...layout.widths.slice(1))).toBeLessThan(130)
    expect(layout.overflow).toBe(false)
    await expect(output).toContainText(name)
    await output.locator('.report-output-sheet').screenshot({ path: testInfo.outputPath('compact-projects.png') })
    const download = page.waitForEvent('download')
    await page.getByTestId('report-download-pdf').click()
    await (await download).saveAs(testInfo.outputPath('compact-projects.pdf'))
  })
}
