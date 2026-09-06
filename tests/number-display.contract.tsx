import assert from 'node:assert/strict'
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
  dispatchEvent() { return true },
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
const { MemoryRouter } = await import('react-router')
const { IssuedInvoiceRecord } = await import('../src/app/components/issued-invoice-record')
const invoice: any = { id:'synthetic',invoiceNumber:'REVIEW-1',status:'APPROVED',contact:{displayName:'Synthetic buyer'},issueDate:'2026-09-06',currency:'SAR',total:10,amountPaid:0,lines:[{description:'Synthetic service',quantity:1,unitPrice:8.7,account:{code:'42000',name:'Services',nameAr:'إيرادات الخدمات'}}],zatcaDelivery:{state:'REPORTED',customerReleaseReady:true,evidence:{state:'REPORTED',mode:'production',kind:'reporting',uuid:'fixture',attempts:1,httpStatus:200,updatedAt:'2026-09-06T10:49:42Z',errors:[],warnings:[]}} }
const render = (value: any) => renderToStaticMarkup(createElement(MemoryRouter,{},createElement(LanguageProvider,{},createElement(IssuedInvoiceRecord,{invoice:value,onClose(){},onPayment(){},async onRefresh(){}}))))

const { displayLocale, displayDigits, getNumberingSystem, setNumberingSystem, NUMBERING_STORAGE_KEY } = await import('../src/app/lib/number-display')
const { normalizeDigits } = await import('../src/app/lib/digits')
const { receiptQrSvg } = await import('../src/app/lib/pos-receipt')
const { ReportDocument } = await import('../src/app/components/report-document')
const snapshot = JSON.stringify(invoice)
assert.equal(getNumberingSystem(), 'latn')
for (const locale of [undefined, 'en-US', 'ar-SA', 'ar-EG', 'ar-SA-u-ca-gregory-nu-arab']) {
  const output = (1234.5).toLocaleString(displayLocale(locale), { minimumFractionDigits: 2 })
  assert.doesNotMatch(output, /[\u0660-\u0669\u06f0-\u06f9]/)
}
const stamp = new Date('2026-09-06T10:49:42Z')
const date = (system: 'latn' | 'arab') => stamp.toLocaleString(displayLocale('ar-SA-u-ca-gregory', system), {timeZone:'Asia/Riyadh'})
assert.doesNotMatch(date('latn'), /[\u0660-\u0669]/)
assert.match(date('latn'), /2026/)
assert.match(date('arab'), /٢٠٢٦/)
const sale:any={occurredAt:'2026-09-06T10:49:42Z',totals:{grand:10,vat:1.3}}
const store:any={name:'Synthetic store',vatNumber:'310000000000003',country:'SA'}
const qrBefore=receiptQrSvg(sale,store)
const report:any={id:'review',title:'تقرير',englishTitle:'Report',generatedAt:'2026-09-06T10:49:42Z',period:{from:'2026-09-01',to:'2026-09-06'},currency:'SAR',org:{name:'Synthetic',country:'SA'},summary:{},sections:[{id:'review',title:'المبالغ',columns:[{key:'amount',label:'المبلغ',kind:'money'}],rows:[{id:'line',values:{amount:1234.5}}]}]}
const renderReport=(template:string) => renderToStaticMarkup(createElement(LanguageProvider,{},createElement(ReportDocument,{report,settings:{template} as any})))
for(const lang of ['ar','en']) {
 storage.set('entix-language',lang)
 for(const system of ['latn','arab'] as const) {
  assert.equal(setNumberingSystem(system),true)
  assert.equal(getNumberingSystem(),system)
  const html=render(invoice)
  if(system==='latn') {assert.doesNotMatch(html,/[\u0660-\u0669]/);assert.match(html,/10\.00/)}
  else assert.match(html,/١٠/)
  assert.match(html,/REVIEW-1/)
  assert.match(html,/42000/)
  assert.doesNotMatch(html,/<input|<textarea/)
  for(const template of ['classic','condensed']) {
   const doc=renderReport(template)
   if(system==='latn') {assert.doesNotMatch(doc,/[\u0660-\u0669]/);assert.match(doc,/1,234\.50/)}
   else assert.match(doc,/١/)
  }
 }
}
assert.equal(receiptQrSvg(sale,store),qrBefore,'Changing visible digits must not change QR payload')
assert.equal(JSON.stringify(invoice),snapshot,'Rendering never changes the financial record')
assert.equal(normalizeDigits('١٠.٥۰'),'10.50')
assert.equal(displayDigits('10.00','arab'),'١٠.٠٠')
assert.equal(displayDigits('١٠.٠٠','latn'),'10.00')
storage.set(NUMBERING_STORAGE_KEY,'invalid')
assert.equal(getNumberingSystem(),'latn')
const originalGet=localStorageShim.getItem
localStorageShim.getItem=()=>{throw new Error('blocked')}
assert.equal(getNumberingSystem(),'latn')
localStorageShim.getItem=originalGet
console.log('Number display: both languages and preferences, default/invalid/blocked storage, invoice, classic/condensed reports, Gregorian/timezone preservation, unchanged QR and financial payload passed.')
