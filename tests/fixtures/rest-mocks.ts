import type { Page } from '@playwright/test'
import { visualOrgId } from './visual-app'

/**
 * Realistic, deliberately LONG mock data for every /app page outside Sales &
 * Purchases (CEO 2026-09-08 · «راجع كل المربعات بلا استثناء»). Ids run to
 * 32 mono chars, names mix Arabic + Latin legal forms, amounts reach millions
 * with 3-decimal source precision, currencies are mixed.
 */
export const LONG_ID = 'ENTIX-FEE-txn_3U8oafB2CpMkgB7N1hKuhpUy'
export const LONG_NAME = 'AL-ASASYAH BASIC ELECTRONICS CO. LTD / الأساسية للإلكترونيات المحدودة'
export const LONG_NAME_2 = 'شركة مصنع الخليج العربي للصناعات البلاستيكية والتغليف المتقدم المحدودة — Gulf Advanced Plastics & Packaging Industries LLC'
export const LONG_EMAIL = 'accounts-payable.department@al-asasyah-basic-electronics-international.com.sa'
const BIG = 2163034.454
const D = (i: number) => `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}`

const contact = (i: number) => ({
  id: `c_${LONG_ID}_${i}`, orgId: visualOrgId, customCode: `CUST-${String(1000 + i)}-INTL-${LONG_ID.slice(-8)}`, shortCode: `AB${i}`,
  type: i % 3 === 0 ? 'BOTH' : i % 2 ? 'CUSTOMER' : 'SUPPLIER', isCustomer: i % 2 === 1 || i % 3 === 0, isSupplier: i % 2 === 0, isEmployee: i % 4 === 0, isShareholder: i % 5 === 0, isFreelancer: i % 6 === 0,
  entityKind: i % 2 ? 'COMPANY' : 'INDIVIDUAL', displayName: i % 2 ? LONG_NAME : `عبدالرحمن بن محمد بن عبدالعزيز آل سعود الدوسري ${i}`, legalName: LONG_NAME_2,
  email: LONG_EMAIL, phone: '+966 55 123 4567 ext. 4589', taxId: null, vatNumber: '310123456789003', crNumber: '1010123456', nationalId: '1098765432', leiCode: null,
  avatarUrl: null, isForeign: i % 7 === 0, withholdingTaxRate: null, defaultCurrency: i % 2 ? 'SAR' : 'USD', country: i % 2 ? 'SA' : 'US', city: 'Sheridan', region: 'WY',
  addressLine1: '30 N Gould St Ste R, Sheridan, WY 82801 — United States of America', tags: null, notes: null, isActive: true, createdAt: D(i), updatedAt: D(i),
})
export const contacts = Array.from({ length: 14 }, (_, i) => contact(i + 1))

const account = (i: number, type: string, code: string, name: string, nameAr: string, parentId: string | null = null) => ({
  id: `acc_${code}`, orgId: visualOrgId, code, name, nameAr, type, subtype: null, parentId, description: null, balance: (i % 2 ? 1 : -1) * BIG * (i + 1) / 3, isActive: true, allowPosting: true, isSystemAccount: false,
})
export const accounts = [
  account(1, 'ASSET', '10000', 'Current Assets — Cash, Banks & Receivables (consolidated)', 'الأصول المتداولة — النقد والبنوك والذمم المدينة (موحّد)'),
  account(2, 'ASSET', '11000', 'Accounts Receivable — Trade debtors, local & international', 'ذمم مدينة — عملاء محليون ودوليون', 'acc_10000'),
  account(3, 'ASSET', '11200', 'Bank — Saudi National Bank — SAR operating account SA44 8000 0000 6080 1016 7519', 'البنك الأهلي السعودي — حساب التشغيل بالريال', 'acc_10000'),
  account(4, 'LIABILITY', '20000', 'Current Liabilities', 'الالتزامات المتداولة'),
  account(5, 'LIABILITY', '21000', 'VAT Payable — Output tax collected on standard-rated sales (15%)', 'ضريبة القيمة المضافة المستحقة — ضريبة المخرجات', 'acc_20000'),
  account(6, 'EQUITY', '30000', 'Share Capital — issued & fully paid', 'رأس المال — المصدر والمدفوع بالكامل'),
  account(7, 'REVENUE', '40000', 'Sales Revenue — Consulting & professional services (export, zero-rated)', 'إيرادات المبيعات — استشارات وخدمات مهنية'),
  account(8, 'EXPENSE', '50000', 'Cost of Sales — Subcontractors, freelancers & direct labour', 'تكلفة المبيعات — مقاولون وفريلانسر وعمالة مباشرة'),
  account(9, 'EXPENSE', '67200', 'Subcontractor Fees', 'أتعاب مقاولين', 'acc_50000'),
]

export const journals = Array.from({ length: 12 }, (_, i) => ({
  id: `je_${LONG_ID}_${i}`, number: `JE-2026-${String(100000 + i)}-${LONG_ID.slice(-12)}`, date: D(i), branchId: null, projectId: null,
  description: i % 2 ? `Invoice ENTIX-INV-2026-000${i} · ${LONG_NAME} · monthly retainer + reimbursable expenses` : `قيد تسوية رواتب شهر ${i + 1} · GOSI · SANED · بدلات سكن ومواصلات · ${LONG_NAME_2}`,
  reference: i % 3 ? LONG_ID : null, status: i % 3 === 0 ? 'DRAFT' : 'POSTED', source: i % 4 === 0 ? 'manual' : i % 4 === 1 ? 'invoice' : i % 4 === 2 ? 'bill' : 'expense',
  totalDebit: BIG * (i + 1), totalCredit: BIG * (i + 1), lineCount: 2 + i, attachmentCount: i % 3,
  lines: [
    { id: `l1_${i}`, accountId: 'acc_11000', accountCode: '11000', accountName: 'Accounts Receivable — Trade debtors, local & international', accountType: 'ASSET', debit: BIG * (i + 1), credit: 0, description: LONG_NAME },
    { id: `l2_${i}`, accountId: 'acc_40000', accountCode: '40000', accountName: 'Sales Revenue — Consulting & professional services', accountType: 'REVENUE', debit: 0, credit: BIG * (i + 1), description: null },
  ],
  attachments: [],
}))

export const bankAccounts = Array.from({ length: 6 }, (_, i) => ({
  id: `ba_${LONG_ID}_${i}`, orgId: visualOrgId, name: i % 2 ? `حساب التشغيل الرئيسي — ${LONG_NAME}` : `Mercury Checking — ENSIDEX LLC operating account ${i}`,
  bankName: i % 2 ? 'البنك الأهلي السعودي — Saudi National Bank (SNB) — Riyadh Main Branch' : 'Mercury Technologies Inc. (Evolve Bank & Trust, Member FDIC)',
  country: i % 2 ? 'SA' : 'US', accountNumber: '000000060801016751948', iban: 'SA4480000000608010167519', swiftCode: 'NCBKSAJE', routingNumber: '084106768',
  currency: i % 3 === 0 ? 'USD' : i % 3 === 1 ? 'SAR' : 'EUR', balance: String(BIG * (i + 1)), isActive: true,
}))
export const vouchers = Array.from({ length: 8 }, (_, i) => ({
  id: `v_${LONG_ID}_${i}`, orgId: visualOrgId, type: i % 2 ? 'RECEIPT' : 'PAYMENT', number: `ENTIX-${i % 2 ? 'RCV' : 'PAY'}-2026-${String(100000 + i)}`, date: D(i),
  contactId: contacts[i].id, amount: String(BIG / (i + 1)), currency: i % 3 ? 'SAR' : 'USD', paymentMethod: 'BANK_TRANSFER', reference: LONG_ID, notes: `Wire ref ${LONG_ID} · settlement of ${LONG_NAME}`,
  invoiceId: i % 2 ? `inv_${i}` : null, billId: i % 2 ? null : `bill_${i}`, contact: { id: contacts[i].id, displayName: contacts[i].displayName },
}))

export const fiscalPeriods = Array.from({ length: 12 }, (_, i) => ({
  id: `fp_${i}`, periodNumber: i + 1, startDate: `2026-${String(i + 1).padStart(2, '0')}-01`, endDate: `2026-${String(i + 1).padStart(2, '0')}-28`,
  status: i < 4 ? 'CLOSED' : i < 7 ? 'LOCKED' : 'OPEN', netIncome: i < 7 ? (i % 2 ? 1 : -1) * BIG * (i + 1) : null,
}))

export const fixedAssets = Array.from({ length: 8 }, (_, i) => ({
  id: `fa_${LONG_ID}_${i}`, code: `FA-2026-${String(1000 + i)}-${LONG_ID.slice(-10)}`, name: i % 2 ? `خط إنتاج التغليف الآلي رقم ${i} — ${LONG_NAME_2}` : `Dell PowerEdge R760 rack server ×4 with 3-year ProSupport Plus · serial ${LONG_ID}`,
  category: i % 2 ? 'معدات ومكائن ثقيلة — قسم الإنتاج والتغليف' : 'IT hardware & data-centre infrastructure',
  accountId: 'acc_10000', depreciationExpenseAccountId: 'acc_50000', accumulatedDepreciationAccountId: 'acc_11000', acquisitionDate: D(i), acquisitionCost: BIG * (i + 1), salvageValue: 12345.678,
  usefulLifeYears: 5 + i, status: i % 4 === 3 ? 'DISPOSED' : 'ACTIVE', purchaseBillId: i % 2 ? 'bill_1' : null, purchaseExpenseId: null, notes: null, disposalDate: null, disposalAmount: null, disposalReason: null,
}))

export const wallets = Array.from({ length: 6 }, (_, i) => ({
  id: `iw_${LONG_ID}_${i}`, code: `IW-2026-${String(100 + i)}-${LONG_ID.slice(-10)}`, name: i % 2 ? `محفظة التداول الرئيسية — الأسهم السعودية والأمريكية ${i}` : `FTMO 200K Challenge Phase 2 — swing account ${LONG_ID}`,
  kind: i % 2 ? 'TRADING' : 'FUNDED_PROP', broker: 'Interactive Brokers LLC — IBKR Pro (margin) · account U${LONG_ID}', fundedProvider: 'FTMO s.r.o. — Prague · ' + LONG_ID,
  currency: i % 3 ? 'USD' : 'SAR', status: i % 5 === 4 ? 'CLOSED' : 'ACTIVE', openingBalance: BIG, fundedCapital: 200000, subscriptionFee: 1080, profitSplitPct: 80, accountId: 'acc_10000', notes: null,
  stats: { bookValue: BIG * (i + 1), realizedPnl: (i % 2 ? 1 : -1) * BIG / 7, txnCount: 120 + i },
  transactions: Array.from({ length: 6 }, (_, k) => ({ id: `wt_${i}_${k}`, kind: ['DEPOSIT', 'BUY', 'SELL', 'WITHDRAW', 'PROFIT', 'FEE'][k], symbol: 'AAPL', quantity: 1234.5678, price: 187.123, amount: BIG / (k + 1), realizedPnl: (k % 2 ? 1 : -1) * 12345.678, date: D(k), notes: LONG_ID, journalEntryId: `je_${k}` })),
  positions: [{ symbol: 'AAPL', qty: 1234.5678, cost: BIG, avgCost: 187.123 }, { symbol: '2222.SR', qty: 98765.4321, cost: BIG / 2, avgCost: 27.85 }],
}))
export const walletReport = { totals: { deposits: BIG, withdrawals: BIG / 3, realizedPnl: BIG / 7, fees: 12345.678, bookValue: BIG * 2 }, byMonth: Array.from({ length: 6 }, (_, i) => ({ month: `2026-0${i + 1}`, pnl: (i % 2 ? 1 : -1) * BIG / (i + 3) })) }

export const shareholders = Array.from({ length: 8 }, (_, i) => ({
  id: `sh_${LONG_ID}_${i}`, code: `SH-2026-${String(100 + i)}-${LONG_ID.slice(-10)}`, name: i % 2 ? LONG_NAME : `عبدالله بن عبدالعزيز بن محمد آل الشيخ العنقري ${i}`,
  nationalId: '1098765432109876', email: LONG_EMAIL, phone: '+966 55 123 4567', shareCount: 1234567 * (i + 1), avgCost: 12.345, notes: null, contactId: contacts[i].id,
  contact: { id: contacts[i].id, customCode: contacts[i].customCode, displayName: contacts[i].displayName },
  transactions: Array.from({ length: 5 }, (_, k) => ({ id: `st_${i}_${k}`, kind: ['ISSUE', 'BUYBACK', 'TRANSFER', 'RESELL', 'ISSUE'][k], from: LONG_NAME, to: LONG_NAME_2, shares: 12345 * (k + 1), pricePerShare: 12.345, amount: BIG / (k + 1), date: D(k), journalEntryId: `je_${k}` })),
}))
export const shareholderSummary = { issued: 98765432, treasury: 1234567, outstanding: 97530865 }

export const costCenters = Array.from({ length: 8 }, (_, i) => ({ id: `cc_${LONG_ID}_${i}`, code: `CC-${String(100 + i)}-${LONG_ID.slice(-14)}`, name: i % 2 ? `مركز تكلفة قسم الإنتاج والتغليف والتوزيع — الفرع الرئيسي بالمنطقة الشرقية ${i}` : `Cost centre — Cloud infrastructure, DevOps & 24/7 site reliability engineering ${i}` }))
export const projects = Array.from({ length: 8 }, (_, i) => ({
  id: `pr_${LONG_ID}_${i}`, code: `PRJ-2026-${String(1000 + i)}-${LONG_ID.slice(-12)}`, name: i % 2 ? `مشروع تنفيذ منصة المحاسبة السحابية لـ ${LONG_NAME}` : `ERP migration & ZATCA Phase 2 integration programme — ${LONG_NAME_2}`,
  startDate: D(i), endDate: D(i + 6), status: ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'][i % 4], budget: BIG, contractValue: BIG * 2, retentionPct: 10, percentComplete: 45.5, notes: null,
  engagements: [], workLogs: [],
}))
export const projectPerformance = { totals: { totalHours: 12345.5, billableHours: 9876.25, laborCost: BIG, paidOut: BIG / 2, outstanding: BIG / 3, margin: 23.45, budgetUsedPct: 67.8 }, contractors: [] }

export const contractors = Array.from({ length: 8 }, (_, i) => ({
  id: `ct_${LONG_ID}_${i}`, code: `CTR-2026-${String(100 + i)}-${LONG_ID.slice(-10)}`, name: i % 2 ? `محمد بن عبدالله بن سعود العتيبي — مطوّر واجهات أمامية ${i}` : `Jonathan Alexander Whitfield-Montgomery III — Senior Solutions Architect ${i}`,
  kind: ['FREELANCER', 'CONTRACTOR', 'AGENCY'][i % 3], specialty: 'Full-stack TypeScript · React · Hono · PostgreSQL · Kubernetes · ZATCA e-invoicing integrations',
  email: LONG_EMAIL, phone: '+966 55 123 4567', nationalId: '2098765432', hourlyRate: 350.5, dayRate: 2800, rateType: 'HOURLY', isActive: i % 6 !== 5, rating: 4.5, notes: null,
  stats: { totalHours: 1234.5 * (i + 1), avgRate: 350.5 + i, outstanding: i % 2 ? BIG / 9 : 0, projectsCount: 3 + i, totalPaid: BIG / 2 },
  engagements: [{ id: `eng_${i}`, projectId: projects[0].id, project: projects[0], role: 'Lead engineer', agreedRate: 350.5, rateType: 'HOURLY', status: 'ACTIVE' }],
  workLogs: Array.from({ length: 4 }, (_, k) => ({ id: `wl_${i}_${k}`, date: D(k), hours: 8.5, description: `Sprint ${k} · ${LONG_ID} · ledger posting engine + overflow audit`, billable: true, amount: 2979.25, project: projects[k % 2] })),
  payments: Array.from({ length: 3 }, (_, k) => ({ id: `cp_${i}_${k}`, date: D(k), amount: BIG / (k + 5), journalEntryId: `je_${k}`, project: projects[0] })),
}))
export const contractorPeers = { avgRate: 312.75, count: 14 }

export const branches = Array.from({ length: 5 }, (_, i) => ({
  id: `br_${LONG_ID}_${i}`, orgId: visualOrgId, name: i % 2 ? `الفرع الرئيسي — المنطقة الشرقية — الدمام — طريق الملك فهد ${i}` : `Eastern Province regional headquarters — Dammam — King Fahd Road ${i}`, nameAr: 'الفرع الرئيسي — المنطقة الشرقية',
  code: `BR-${String(100 + i)}-${LONG_ID.slice(-12)}`, address: '30 N Gould St Ste R, Sheridan, WY 82801 — United States of America · Building 7, Floor 12, Suite 1204', phone: '+1 (442) 444-4410',
  vatBranchNo: '310123456789003', warehouseId: `wh_1`, isHQ: i === 0, isActive: true, createdAt: D(i),
}))

export const products = Array.from({ length: 10 }, (_, i) => ({
  id: `pd_${LONG_ID}_${i}`, sku: `SKU-2026-${String(100000 + i)}-${LONG_ID.slice(-12)}`, name: i % 2 ? `Cloud accounting subscription — Enterprise tier — annual — up to 250 users — ${LONG_ID}` : `خدمة استشارات محاسبية وضريبية شاملة — باقة سنوية — ${LONG_NAME}`,
  nameAr: `خدمة استشارات محاسبية وضريبية شاملة — باقة سنوية — ${LONG_NAME} ${i}`, type: ['SERVICE', 'GOOD', 'INVENTORY'][i % 3], category: 'Subscriptions & professional services',
  unitPrice: BIG / (i + 1), costPrice: BIG / (i + 3), incomeAccountId: i % 3 ? 'acc_40000' : null, expenseAccountId: 'acc_50000', imageUrl: null, stockQty: i, reorderQty: 5, barcode: null,
}))
export const warehouses = Array.from({ length: 4 }, (_, i) => ({ id: `wh_${i}`, code: `WH-${String(100 + i)}-${LONG_ID.slice(-10)}`, name: i % 2 ? `مستودع الدمام الرئيسي — المنطقة الصناعية الثانية — ${LONG_NAME}` : `Dammam 2nd Industrial City — central distribution warehouse ${i}`, address: 'Building 7, Floor 12, Suite 1204 · 2nd Industrial City, Dammam 34326, Kingdom of Saudi Arabia', isPrimary: i === 0 }))
export const stock = products.map((p, i) => ({ id: `st_${i}`, productId: p.id, warehouseId: warehouses[i % 4].id, quantity: 12345.678 * (i + 1), averageCost: 987.654, lastCost: 999.999, updatedAt: D(i), warehouse: warehouses[i % 4] }))
export const movements = products.map((p, i) => ({ id: `mv_${i}`, productId: p.id, warehouseId: warehouses[i % 4].id, type: ['RECEIPT', 'ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'][i % 5], quantity: (i % 2 ? 1 : -1) * 1234.567 * (i + 1), unitCost: 987.654, occurredAt: D(i), notes: LONG_ID }))
export const reorder = products.slice(0, 4).map((p, i) => ({ product: p, onHand: 2 + i, reorderQty: 50, shortBy: 48 - i, unitCost: 987.654, suggestedQty: 100 }))
export const stockCounts = Array.from({ length: 6 }, (_, i) => ({
  id: `sc_${LONG_ID}_${i}`, number: `SC-2026-${String(1000 + i)}-${LONG_ID.slice(-12)}`, status: ['COUNTING', 'REVIEW', 'POSTED', 'CANCELLED'][i % 4], scope: i % 2 ? 'CATEGORY' : 'FULL', category: i % 2 ? 'Subscriptions & professional services — long category name' : null, blind: i % 2 === 0,
  snapshotAt: `2026-0${1 + (i % 8)}-1${i}T10:15:00Z`, postedAt: i % 4 === 2 ? `2026-0${1 + (i % 8)}-2${i % 8}T10:15:00Z` : null, notes: null, createdAt: D(i), warehouse: warehouses[i % 4], lineCount: 120 + i,
  lines: products.slice(0, 6).map((p, k) => ({ id: `scl_${k}`, productId: p.id, product: { id: p.id, sku: p.sku, name: p.name, nameAr: p.nameAr, category: p.category, imageUrl: null }, systemQty: 1234.5, countedQty: k % 2 ? 1230 : null, variance: k % 2 ? -4.5 : null, unitCost: 987.654, varianceValue: k % 2 ? -4444.443 : null, reason: k % 2 ? 'تالف أثناء النقل — damaged in transit' : null, countedAt: D(k) })),
  summary: { lines: 6, counted: 3, variances: 3, shortageValue: -13333.329, surplusValue: 2222.22 }, journal: { id: 'je_1', entryNumber: 'JE-2026-100001' },
}))
export const transfers = Array.from({ length: 6 }, (_, i) => ({
  id: `tr_${LONG_ID}_${i}`, number: `TR-2026-${String(1000 + i)}-${LONG_ID.slice(-12)}`, status: ['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'][i % 4], notes: `Driver Abdullah · truck 7845 KSA · ${LONG_ID}`, createdAt: `2026-0${1 + (i % 8)}-1${i}T10:15:00Z`, sentAt: i % 4 ? `2026-0${1 + (i % 8)}-1${i}T12:00:00Z` : null, receivedAt: i % 4 === 2 ? `2026-0${1 + (i % 8)}-1${i}T18:00:00Z` : null,
  fromWarehouse: warehouses[0], toWarehouse: warehouses[1], lines: 12 + i, qty: 1234.5 * (i + 1), value: BIG / (i + 1),
  fromWarehouseId: 'wh_0', toWarehouseId: 'wh_1', fromBranchId: branches[0].id, toBranchId: branches[1].id, fromBranch: branches[0], toBranch: branches[1], receivedByName: 'عبدالله المطيري — مشرف المستودع', cancelledAt: null,
  summary: { lines: 6, qty: 7407, value: BIG, receivedQty: 7400, shortfallValue: 6913.578 }, journal: { id: 'je_1', entryNumber: 'JE-2026-100001' },
}))
;(transfers as any[]).forEach((tr, i) => { tr.lines = i % 2 ? 6 : tr.lines })
export const transferDetail = { ...transfers[1], lines: products.slice(0, 6).map((p, k) => ({ id: `trl_${k}`, productId: p.id, qty: 1234.5, unitCost: 987.654, receivedQty: k % 2 ? 1230 : null, reason: k % 2 ? 'تالف أثناء النقل' : null, value: 1219258.863, shortfall: k % 2 ? 4444.443 : null, product: { id: p.id, sku: p.sku, name: p.name, nameAr: p.nameAr } })) }

export const employees = contacts.map((c, i) => ({ ...c, isEmployee: true, displayName: i % 2 ? `عبدالرحمن بن محمد بن عبدالعزيز آل سعود الدوسري ${i}` : `Jonathan Alexander Whitfield-Montgomery III ${i}` }))
export const payrollContracts = employees.slice(0, 8).map((e, i) => ({ id: `pc_${i}`, contactId: e.id, employeeName: e.displayName, basicSalary: 12345.678 * (i + 1), housingAllowance: 3086.42, transportAllowance: 1234.57, otherAllowances: 987.65, nationality: i % 2 ? 'SA' : 'US', gosiEligible: true, iban: 'SA4480000000608010167519', startDate: D(i) }))
export const payrollRuns = Array.from({ length: 6 }, (_, i) => ({
  id: `pay_${LONG_ID}_${i}`, runNumber: `PAY-2026-${String(10 + i)}-${LONG_ID.slice(-14)}`, period: `2026-0${i + 1}`, status: ['DRAFT', 'APPROVED', 'POSTED', 'PAID'][i % 4], currency: 'SAR', notes: null,
  grossSalary: BIG / 3, netSalary: BIG / 4, employeeGosi: 12345.678, employerGosi: 23456.789, org: { name: LONG_NAME, baseCurrency: 'SAR', logoUrl: null },
  lines: payrollContracts.map((c, k) => ({ id: `pl_${i}_${k}`, employee: { id: c.contactId, displayName: c.employeeName, nationalId: '1098765432' }, employeeName: c.employeeName, basicSalary: c.basicSalary, housingAllowance: c.housingAllowance, transportAllowance: c.transportAllowance, otherAllowances: c.otherAllowances, grossSalary: c.basicSalary + 5308.64, employeeGosi: 1234.567, totalDeductions: 1234.567, netSalary: c.basicSalary + 4074.073 })),
}))
export const payrollSettings = { employerId: '123456789', establishmentId: '987654321', bankCode: 'NCBKSAJE', gosiRateEmployee: 9.75, gosiRateEmployer: 11.75, sanedRate: 0.75 }

export const templates = Array.from({ length: 6 }, (_, i) => ({
  id: `tp_${LONG_ID}_${i}`, name: `قالب الفاتورة الضريبية الرسمي — ${LONG_NAME} — نسخة ${i}`, nameEn: `Official tax-invoice print template — ${LONG_NAME_2} — v${i}`, type: ['INVOICE', 'QUOTE', 'VOUCHER', 'CREDIT_NOTE'][i % 4], layout: ['classic', 'modern', 'minimal'][i % 3],
  isDefault: i === 0, primaryColor: '#1A1E48', accentColor: '#5875DB', showLogo: true, showStamp: true, showQr: true, showBank: true, footerText: LONG_NAME_2, updatedAt: D(i), createdAt: D(i),
}))

export const inbox = Array.from({ length: 8 }, (_, i) => ({
  id: `ib_${LONG_ID}_${i}`, from: `${LONG_NAME} <${LONG_EMAIL}>`, subject: i % 2 ? `فاتورة رقم ENTIX-INV-2026-${100000 + i} — ${LONG_NAME_2} — مستحقة خلال 30 يوماً` : `RE: FW: Invoice ${LONG_ID} attached — please process for payment before month-end close — ${LONG_NAME}`,
  status: ['RECEIVED', 'EXTRACTED', 'APPROVED', 'REJECTED', 'ERROR'][i % 5], attachmentCount: 1 + i, extractedKind: 'bill', extractedTotal: BIG / (i + 1), extractedCurrency: i % 2 ? 'SAR' : 'USD', createdAt: `2026-0${1 + (i % 8)}-1${i}T10:15:00Z`, processedAt: null, billId: i % 3 ? `bill_${i}` : null,
}))
export const conversations = Array.from({ length: 8 }, (_, i) => ({ id: `cv_${LONG_ID}_${i}`, title: i % 2 ? `تحليل الذمم المدينة المتأخرة لعميل ${LONG_NAME} وتوصيات التحصيل` : `Cash-flow forecast Q4 2026 — scenario analysis with ${LONG_ID}`, status: 'ACTIVE', lastMessageAt: D(i), createdAt: D(i), updatedAt: D(i), messageCount: 12 + i }))

export const contactSummary = (c: any) => ({
  contact: c,
  totals: { invoices: { count: 42, total: BIG * 4, paid: BIG * 3, outstanding: BIG }, bills: { count: 17, total: BIG * 2, paid: BIG, outstanding: BIG }, quotes: { count: 9, total: BIG }, receipts: { count: 31, total: BIG * 3 }, payments: { count: 12, total: BIG }, arOpen: BIG, apOpen: BIG / 2, balance: BIG / 2 },
  invoices: Array.from({ length: 6 }, (_, i) => ({ id: `inv_${i}`, invoiceNumber: `ENTIX-INV-2026-${String(100000 + i)}-${LONG_ID.slice(-8)}`, issueDate: D(i), dueDate: D(i + 1), total: String(BIG / (i + 1)), amountPaid: String(BIG / (i + 2)), status: ['PAID', 'SENT', 'OVERDUE', 'DRAFT'][i % 4], currency: i % 2 ? 'SAR' : 'USD' })),
  bills: Array.from({ length: 5 }, (_, i) => ({ id: `bill_${i}`, billNumber: `ENTIX-BILL-2026-${String(100000 + i)}-${LONG_ID.slice(-8)}`, issueDate: D(i), dueDate: D(i + 1), total: String(BIG / (i + 1)), amountPaid: '0', status: ['PAID', 'OPEN', 'OVERDUE'][i % 3], currency: 'SAR' })),
  quotes: Array.from({ length: 4 }, (_, i) => ({ id: `q_${i}`, quoteNumber: `ENTIX-QT-2026-${String(100000 + i)}`, issueDate: D(i), validUntil: D(i + 1), total: String(BIG / (i + 1)), status: ['DRAFT', 'SENT', 'ACCEPTED'][i % 3], currency: 'USD' })),
  vouchers: vouchers.slice(0, 5),
  expenses: Array.from({ length: 4 }, (_, i) => ({ id: `ex_${i}`, date: D(i), total: String(BIG / (i + 3)), category: 'Travel & subsistence — international', description: `Riyadh → Sheridan business trip · ${LONG_ID}`, currency: 'USD' })),
})

export const dashboardSummary = {
  org: { id: visualOrgId, name: LONG_NAME, baseCurrency: 'SAR', country: 'SA', industry: 'services' },
  kpi: { revenue: BIG * 6, purchases: BIG * 2, expenses: BIG, receipts: BIG * 5, payments: BIG * 3, vatOutput: BIG * 0.15, vatInput: BIG * 0.05, vatNet: BIG * 0.1, invoiceCount: 1234, overdueCount: 17, contactCount: 456, accountsReceivable: BIG * 2, accountsPayable: BIG, cashOnHand: BIG * 3 },
  monthlyTrend: Array.from({ length: 6 }, (_, i) => ({ month: `2026-0${i + 4}`, revenue: BIG * (i + 1), expenses: BIG * (i + 1) / 2 })),
  yearlyTrend: [{ year: 2024, revenue: BIG * 8, expenses: BIG * 5, net: BIG * 3 }, { year: 2025, revenue: BIG * 12, expenses: BIG * 9, net: BIG * 3 }, { year: 2026, revenue: BIG * 6, expenses: BIG * 7, net: -BIG }],
  cashFlowTrend: Array.from({ length: 6 }, (_, i) => ({ month: `2026-0${i + 4}`, in: BIG * (i + 1), out: BIG * (i + 1) / 2, net: BIG * (i + 1) / 2 })),
  profitLoss: Array.from({ length: 6 }, (_, i) => ({ month: `2026-0${i + 4}`, revenue: BIG * (i + 1), expenses: BIG * (i + 1) / 2, net: (i === 2 ? -1 : 1) * BIG * (i + 1) / 2 })),
  expenseBreakdown: [{ category: 'Subcontractors & freelancers — direct labour', total: BIG }, { category: 'Cloud infrastructure', total: BIG / 2 }, { category: 'Travel & subsistence — international', total: BIG / 3 }, { category: 'رواتب وأجور وبدلات', total: BIG / 4 }],
  incomeBreakdown: [{ category: 'Consulting & professional services — export (zero-rated)', code: '40000', total: BIG * 3 }, { category: 'اشتراكات المنصة السحابية — باقة المؤسسات', code: '41000', total: BIG * 2 }, { category: 'Implementation & onboarding', code: '42000', total: BIG }],
  overdueInvoices: Array.from({ length: 5 }, (_, i) => ({ id: `inv_${i}`, number: `ENTIX-INV-2026-${String(100000 + i)}-${LONG_ID.slice(-8)}`, contact: LONG_NAME, total: BIG, remaining: BIG / (i + 1), dueDate: D(i), daysOverdue: 30 + i * 17 })),
  overdueBills: Array.from({ length: 3 }, (_, i) => ({ id: `bill_${i}`, number: `ENTIX-BILL-2026-${String(100000 + i)}`, contact: LONG_NAME_2, total: BIG, remaining: BIG / (i + 2), dueDate: D(i), daysOverdue: 12 + i })),
  bankAccounts: bankAccounts.slice(0, 4).map((b) => ({ id: b.id, name: b.name, bankName: b.bankName, accountNumber: b.accountNumber, currency: b.currency, balance: Number(b.balance) })),
  periodCompare: { thisMonth: { revenue: BIG * 2, expenses: BIG, net: BIG }, lastMonth: { revenue: BIG, expenses: BIG / 2, net: BIG / 2 }, yearAgo: { revenue: BIG / 2, expenses: BIG / 3, net: BIG / 6 } },
}

const reportRow = (i: number, depth = 0) => ({ id: `r_${i}`, label: i % 2 ? `${LONG_NAME} — ذمم مدينة تجارية` : `Accounts Receivable — Trade debtors, local & international — ${LONG_ID}`, labelAr: 'ذمم مدينة — عملاء محليون ودوليون', code: `1${i}000`, depth, values: [BIG * (i + 1), BIG * i, (i % 2 ? 1 : -1) * BIG / 3], type: 'row' })
export const reportPayload = (id: string) => ({
  id, title: 'Balance Sheet', titleAr: 'قائمة المركز المالي', period: { from: '2026-01-01', to: '2026-09-08' }, currency: 'SAR', org: { name: LONG_NAME, legalName: LONG_NAME_2, vatNumber: '310123456789003' },
  columns: [{ key: 'current', label: 'Current period', labelAr: 'الفترة الحالية' }, { key: 'prior', label: 'Prior period', labelAr: 'الفترة السابقة' }, { key: 'delta', label: 'Change', labelAr: 'التغير' }],
  sections: [
    { id: 's1', title: 'Assets', titleAr: 'الأصول', rows: Array.from({ length: 6 }, (_, i) => reportRow(i, i % 3)), total: { label: 'Total assets', labelAr: 'إجمالي الأصول', values: [BIG * 21, BIG * 15, BIG * 6] } },
    { id: 's2', title: 'Liabilities & equity', titleAr: 'الالتزامات وحقوق الملكية', rows: Array.from({ length: 5 }, (_, i) => reportRow(i + 6, i % 2)), total: { label: 'Total liabilities & equity', labelAr: 'إجمالي الالتزامات وحقوق الملكية', values: [BIG * 21, BIG * 15, BIG * 6] } },
  ],
  totals: [{ label: 'Net', labelAr: 'الصافي', values: [0, 0, 0] }], generatedAt: '2026-09-08T10:00:00Z',
})

export const usSalesTax = {
  type: 'us-sales-tax', org: { name: LONG_NAME, legalName: LONG_NAME_2, state: 'WY', ein: '12-3456789', usFilingClass: 'llc-multi' }, period: { from: '2026-09-01', to: '2026-09-08' }, currency: 'USD',
  sales: { grossSales: BIG * 4, taxCollected: BIG * 0.06, exemptSales: BIG, taxableSales: BIG * 3, byState: [{ state: 'WY', base: BIG, tax: BIG * 0.04 }, { state: 'CA', base: BIG * 2, tax: BIG * 0.0725 }], byRate: [{ rate: 0.04, base: BIG, tax: BIG * 0.04 }, { rate: 0.0725, base: BIG * 2, tax: BIG * 0.145 }] },
  irsGuide: { form: '1065', title: 'U.S. Return of Partnership Income', titleAr: 'إقرار دخل الشراكة الأمريكي', notes: ['File by March 15 · Schedule K-1 to each member', 'State: Wyoming has no corporate income tax — annual report + license tax only'] }, hint: null,
}
export const saVat = {
  org: { id: visualOrgId, name: LONG_NAME, legalName: LONG_NAME_2, country: 'SA', baseCurrency: 'SAR', vatNumber: '310123456789003', vatPeriod: 'quarterly' }, period: { from: '2026-07-01', to: '2026-09-30' },
  vatDeclaration: {
    sales: { standardRated: { base: BIG * 4, vat: BIG * 0.6 }, citizens: { base: 0, vat: 0 }, zeroDomestic: { base: BIG, vat: 0 }, exports: { base: BIG * 2, vat: 0 }, zeroRated: { base: BIG * 3, vat: 0 }, exempt: { base: BIG / 2, vat: 0 }, nonTaxable: { base: BIG / 4, vat: 0 }, totalBase: BIG * 7.75, totalVat: BIG * 0.6 },
    purchases: { deductible: { base: BIG * 2, vat: BIG * 0.3 }, importCustoms: { base: BIG / 2, vat: BIG * 0.075 }, importRcm: { base: 0, vat: 0 }, zeroExempt: { base: BIG / 3, vat: 0 }, zeroRated: { base: 0, vat: 0 }, exempt: { base: 0, vat: 0 }, imports: { base: BIG / 2, vat: BIG * 0.075 }, totalBase: BIG * 2.83, totalVat: BIG * 0.375 },
    netVat: BIG * 0.225, payable: BIG * 0.225, refundable: 0,
  },
  breakdown: { grossRevenue: BIG * 7, taxAmount: BIG * 0.6, totalRevenueIncludingTax: BIG * 7.6, nonTaxRevenue: BIG / 4, expensesTotal: BIG * 2.8, expensesTax: BIG * 0.375 },
  withholding: { totalBase: BIG, totalWithholding: BIG * 0.15, rows: Array.from({ length: 4 }, (_, i) => ({ voucherId: `v_${i}`, voucherNumber: `ENTIX-PAY-2026-${100000 + i}-${LONG_ID.slice(-8)}`, date: D(i), contactName: LONG_NAME, country: 'US', transferType: 'SERVICE', base: BIG / (i + 1), rate: 15, withholding: BIG * 0.15 / (i + 1), note: LONG_ID })) },
  drafts: { count: 2, invoices: [{ id: 'inv_9', invoiceNumber: `ENTIX-INV-2026-100009-${LONG_ID.slice(-8)}`, issueDate: D(1), total: BIG, taxTotal: BIG * 0.15, contactName: LONG_NAME }], bills: [{ id: 'bill_9', billNumber: `ENTIX-BILL-2026-100009`, issueDate: D(2), total: BIG / 2, taxTotal: BIG * 0.075, contactName: LONG_NAME_2 }] },
}

/** Register mock routes AFTER prepareVisualApp so they take precedence. */
export async function mockRestApi(page: Page) {
  const json = (data: unknown) => ({ json: data as any })
  await page.route('https://api.entix.io/**', (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname
    const ok = (data: unknown) => route.fulfill(json(data))
    if (p === '/api/dashboard/summary') return ok(dashboardSummary)
    if (p === '/api/contacts') return ok({ items: url.searchParams.get('role') === 'employee' ? employees : contacts, total: contacts.length, page: 1, limit: 200 })
    if (/^\/api\/contacts\/[^/]+\/summary$/.test(p)) return ok(contactSummary(contacts[0]))
    if (/^\/api\/contacts\/[^/]+$/.test(p)) return ok(contacts[0])
    if (p === '/api/journals') return ok({ items: journals, total: 1234, limit: 200, offset: 0, hasMore: true })
    if (p === '/api/journals/coverage') return ok({ unposted: { invoices: 3, bills: 1, expenses: 0, receipts: 2, payments: 0 }, linked: false })
    if (/^\/api\/journals\/[^/]+$/.test(p)) return ok(journals[0])
    if (p === '/api/accounts') return ok({ items: accounts, total: accounts.length })
    if (p === '/api/accounts/ledger-mapping') return ok({ roles: [] })
    if (/^\/api\/accounts\/[^/]+\/transactions$/.test(p)) return ok({ account: accounts[1], total: 5, finalBalance: BIG, transactions: journals.slice(0, 5).map((j, i) => ({ id: j.id, date: j.date, journalNumber: j.number, description: j.description, lineDescription: LONG_NAME, debit: i % 2 ? BIG : 0, credit: i % 2 ? 0 : BIG, runningBalance: BIG * (i + 1) })) })
    if (p === '/api/tax-return/us-sales-tax') return ok(usSalesTax)
    if (p === '/api/tax-return/sa-vat') return ok(saVat)
    if (p === '/api/tax-return/vat-summary') return ok({ type: 'vat-summary', org: { name: LONG_NAME, country: 'AE', vatNumber: '100123456700003', vatPeriod: 'quarterly' }, period: { from: '2026-07-01', to: '2026-09-30' }, currency: 'AED', standardRate: 0.05, sales: { standardBase: BIG, standardVat: BIG * 0.05, zeroBase: BIG / 2, exportsBase: BIG / 3, exemptBase: 0, nonTaxBase: 0 }, purchases: { standardBase: BIG / 2, standardVat: BIG * 0.025, zeroExemptBase: 0 }, net: { due: BIG * 0.025 } })
    if (p === '/api/bank-accounts') return ok({ items: bankAccounts, total: bankAccounts.length, totalBalance: BIG * 21 })
    if (p === '/api/vouchers') return ok({ items: vouchers, total: vouchers.length })
    if (p === '/api/bank-import/profiles') return ok({ items: [] })
    if (p === '/api/fiscal-periods') return ok({ items: fiscalPeriods })
    if (p === '/api/fixed-assets') return ok({ items: fixedAssets, total: fixedAssets.length, totalCost: BIG * 36, netBookValue: BIG * 24, totalDepreciation: BIG * 12 })
    if (p === '/api/fixed-assets/next-code') return ok({ code: 'FA-0009' })
    if (/^\/api\/fixed-assets\/[^/]+$/.test(p)) return ok(fixedAssets[0])
    if (p === '/api/investments/wallets') return ok({ items: wallets, total: wallets.length })
    if (p === '/api/investments/wallets/next-code') return ok({ code: 'IW-0007' })
    if (/^\/api\/investments\/wallets\/[^/]+\/report$/.test(p)) return ok(walletReport)
    if (/^\/api\/investments\/wallets\/[^/]+$/.test(p)) return ok(wallets[0])
    if (p === '/api/investments/shareholders') return ok({ items: shareholders, total: shareholders.length, summary: shareholderSummary })
    if (p === '/api/investments/shareholders/next-code') return ok({ code: 'SH-0009' })
    if (/^\/api\/investments\/shareholders\/[^/]+$/.test(p)) return ok(shareholders[0])
    if (p === '/api/cost-centers') return ok({ items: costCenters, total: costCenters.length })
    if (/^\/api\/cost-centers\/[^/]+$/.test(p)) return ok(costCenters[0])
    if (p === '/api/projects') return ok({ items: projects, total: projects.length })
    if (/^\/api\/projects\/[^/]+$/.test(p)) return ok({ ...projects[0], engagements: contractors.slice(0, 2).map((c) => ({ id: `eng_${c.id}`, contractor: c, contractorId: c.id, role: 'Lead engineer', agreedRate: 350.5, rateType: 'HOURLY', status: 'ACTIVE' })), workLogs: contractors[0].workLogs.map((l) => ({ ...l, contractor: contractors[0] })) })
    if (/^\/api\/contractors\/projects\/[^/]+\/performance$/.test(p)) return ok(projectPerformance)
    if (p === '/api/contractors') return ok({ items: contractors, total: contractors.length, peers: contractorPeers })
    if (p === '/api/contractors/next-code') return ok({ code: 'CTR-0009' })
    if (p === '/api/contractors/work-logs') return ok({ items: contractors[0].workLogs, total: 4 })
    if (/^\/api\/contractors\/[^/]+$/.test(p)) return ok(contractors[0])
    if (p === '/api/branches') return ok({ items: branches, total: branches.length, defaultBranchId: branches[1].id })
    if (/^\/api\/branches\/[^/]+$/.test(p)) return ok(branches[0])
    if (p === '/api/products') return ok({ items: products, total: products.length, categories: [{ category: 'Subscriptions & professional services', count: 10 }] })
    if (/^\/api\/products\/[^/]+\/barcodes$/.test(p)) return ok({ items: [{ id: 'bc_1', productId: products[0].id, barcode: '6281234567890123', unitMultiplier: 12, label: 'كرتون 12 — carton of 12 units', createdAt: D(1) }] })
    if (/^\/api\/products\/[^/]+$/.test(p)) return ok(products[0])
    if (p === '/api/inventory/warehouses') return ok({ items: warehouses })
    if (p === '/api/inventory/stock') return ok({ items: stock })
    if (p === '/api/inventory/movements') return ok({ items: movements })
    if (p === '/api/inventory/reorder') return ok({ items: reorder, total: reorder.length })
    if (p === '/api/inventory/counts') return ok({ items: stockCounts })
    if (/^\/api\/inventory\/counts\/[^/]+$/.test(p)) return ok(stockCounts[0])
    if (p === '/api/inventory/transfers/docs') return ok({ items: transfers, total: transfers.length, inTransitValue: BIG * 2 })
    if (/^\/api\/inventory\/transfers\/docs\/[^/]+$/.test(p)) return ok(transferDetail)
    if (p === '/api/payroll/contracts') return ok({ items: payrollContracts, total: payrollContracts.length })
    if (p === '/api/payroll/runs') return ok({ items: payrollRuns, total: payrollRuns.length })
    if (/^\/api\/payroll\/runs\/[^/]+$/.test(p)) return ok(payrollRuns[1])
    if (p === '/api/payroll/settings') return ok(payrollSettings)
    if (p === '/api/document-templates') return ok({ items: templates, total: templates.length })
    if (/^\/api\/document-templates\/[^/]+$/.test(p)) return ok(templates[0])
    if (p === '/api/inbox') return ok({ items: inbox, total: inbox.length })
    if (p === '/api/agent/conversations') return ok({ items: conversations, total: conversations.length })
    if (/^\/api\/agent\/conversations\/[^/]+$/.test(p)) return ok({ ...conversations[0], messages: [] })
    if (/^\/api\/reports\/[^/]+$/.test(p)) return ok(reportPayload(p.split('/').pop()!))
    if (p === '/api/stripe/subscription') return ok({ plan: { id: 'pro', name: 'Professional', nameAr: 'الاحترافية', tier: 'pro', interval: 'year', price: 1188 }, status: 'active', currentPeriodEnd: '2027-09-08T00:00:00Z', cancelAtPeriodEnd: false, seats: 12 })
    if (p === '/api/stripe/plans') return ok({ plans: [] })
    if (p === '/api/support/config') return ok({ email: 'support@entix.io', whatsapp: null, hours: null })
    if (p === '/api/oauth/status') return ok({ providers: [] })
    if (p === '/api/partners/me') return ok(null)
    if (p === '/api/plaid/link-token') return ok({ linkToken: null, error: 'not_configured' })
    if (p === '/api/onboarding/status') return ok({ completed: false, completedAt: null, openingBalancesDone: false, openingAt: null, productsCount: 10, contactsCount: 14 })
    if (p === '/api/notifications') return ok({ items: [], count: 0 })
    if (p === '/api/notifications/count') return ok({ unread: 0 })
    return route.fallback()
  })
}
