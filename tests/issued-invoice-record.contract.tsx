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
const accepted=render(invoice)
assert.match(accepted,/REPORTED/)
assert.match(accepted,/42000/)
assert.match(accepted,/200/)
assert.doesNotMatch(accepted,/<input|<textarea|<select/)
assert.doesNotMatch(accepted,/>إلغاء اعتماد<|>حفظ كمسودة<|>اعتماد<|>حذف</)
const pending=render({...invoice,zatcaDelivery:{state:'PENDING',customerReleaseReady:false,evidence:null}})
assert.match(pending,/disabled=""/)
assert.doesNotMatch(pending,/تم قبول الفاتورة لدى الهيئة|Invoice accepted by ZATCA/)
const rejected=render({...invoice,zatcaDelivery:{...invoice.zatcaDelivery,state:'REJECTED',customerReleaseReady:false,evidence:{...invoice.zatcaDelivery.evidence,state:'REJECTED',httpStatus:400,errors:['Invoice requires review'],warnings:['Check buyer data']}}})
assert.match(rejected,/Invoice requires review/)
assert.match(rejected,/Check buyer data/)
assert.doesNotMatch(rejected,/تم قبول الفاتورة لدى الهيئة|Invoice accepted by ZATCA/)
console.log('Issued invoice view: accepted, pending, rejected, account visibility and absence of editing controls verified.')
