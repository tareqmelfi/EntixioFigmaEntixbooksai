import type { ReportPayload, ReportRow, ReportSection } from './api';

export type Period = { from: string; to: string };
export type FinancialPeriod = { income: ReportPayload; balance: ReportPayload; opening: ReportPayload };
export const accountGroups = [
  ['cogs', 'تكلفة المبيعات', 'Cost of sales', 'expense'],
  ['finance', 'تكلفة التمويل', 'Finance expense', 'expense'],
  ['financeIncome', 'إيراد الفوائد والتمويل', 'Interest and financing income', 'revenue'],
  ['depreciation', 'الإهلاك والإطفاء', 'Depreciation and amortisation', 'expense'],
  ['tax', 'ضريبة الدخل والزكاة', 'Income tax and zakat', 'expense'],
  ['currentAssets', 'الأصول المتداولة', 'Current assets', 'asset'],
  ['inventory', 'المخزون والمصروفات المقدمة', 'Inventory and prepayments', 'asset'],
  ['cash', 'النقد وما يعادله', 'Cash and equivalents', 'asset'],
  ['receivables', 'الذمم التجارية المدينة', 'Trade receivables', 'asset'],
  ['currentLiabilities', 'الالتزامات المتداولة', 'Current liabilities', 'liability'],
  ['debt', 'ديون التمويل', 'Interest-bearing debt', 'liability'],
] as const;
export type Group = typeof accountGroups[number][0];
// An absent group is unreviewed; [] explicitly means the author confirmed none.
export type AccountMapping = Partial<Record<Group, string[]>>;
export type Scenario = { fixedCosts: string; variablePercent: string; targetProfit: string; source: string };
export type OwnerOptions = { mapping: AccountMapping; scenario: Scenario; notes: string; unitName: string; units: string };
export const emptyScenario: Scenario = { fixedCosts: '', variablePercent: '', targetProfit: '', source: '' };
export const bi = (ar: string, en: string) => `${ar}␟${en}`;
export const one = (value: string, lang: string) => { const [ar, en] = value.split('␟'); return lang === 'en' ? en || ar : ar; };
export const finite = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const valid = (r: ReportPayload) => r.status !== 'unavailable' && r.dataBasis?.source === 'ledger' && r.dataBasis.status !== 'unavailable';
export const rows = (r: ReportPayload, section: string) => valid(r) ? r.sections.find(s => s.id === section)?.rows || [] : [];
const rowAmount = (r: ReportPayload, section: string, id: string) => finite(rows(r, section).find(row => row.id === id)?.values.amount);
const calc = (a: number | null, b: number | null, op: (a: number, b: number) => number) => a === null || b === null ? null : finite(op(a, b));
export const ratio = (a: number | null, b: number | null, scale = 1) => a === null || b === null || b <= 0 ? null : finite(a / b * scale);
export const difference = (a: number | null, b: number | null) => calc(a, b, (x, y) => x - y);
const sum = (a: number | null, b: number | null) => calc(a, b, (x, y) => x + y);
export function comparison(current: number | null, prior: number | null, percentMetric = false) {
  const delta = difference(current, prior);
  return { delta, percent: percentMetric ? delta : prior === null || prior <= 0 ? null : ratio(delta, prior, 100) };
}
export function shiftYear(date: string, by: number) {
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year + by, month, 0)).getUTCDate();
  return `${year + by}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function dayBefore(date: string) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
export function mappingError(mapping: AccountMapping) {
  const expenses = ['cogs', 'finance', 'depreciation', 'tax'] as const;
  const ids = expenses.flatMap(k => mapping[k] || []);
  if (new Set(ids).size !== ids.length) return bi('اختر حساب المصروف في مجموعة واحدة فقط لمنع تكراره.', 'Assign each expense account to one group only to avoid double counting.');
  if (mapping.currentAssets && ['cash', 'inventory', 'receivables'].some(k => mapping[k as Group]?.some(id => !mapping.currentAssets!.includes(id)))) return bi('النقد والمخزون والذمم المختارة يجب أن تكون ضمن الأصول المتداولة المختارة.', 'Cash, inventory and receivables must be included in the selected current assets.');
  const liquid = ['cash', 'inventory', 'receivables'].flatMap(k => mapping[k as Group] || []);
  if (new Set(liquid).size !== liquid.length) return bi('لا تكرر حسابًا بين النقد والمخزون والذمم.', 'Do not repeat accounts across cash, inventory and receivables.');
  return null;
}
export function availableAccounts(periods: FinancialPeriod[], type: 'expense' | 'revenue' | 'asset' | 'liability') {
  const byId = new Map<string, ReportRow>();
  const income = type === 'expense' || type === 'revenue';
  for (const p of periods) for (const r of income ? [p.income] : [p.balance, p.opening]) {
    for (const row of rows(r, income ? 'income-ledger-detail' : `position-${type === 'asset' ? 'assets' : 'liabilities'}-detail`)) {
      if (!income || row.id.startsWith(type === 'expense' ? 'exp-' : 'rev-')) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}
function mapped(p: FinancialPeriod, group: Group, mapping: AccountMapping, opening = false) {
  if (!mapping[group]) return null;
  const type = accountGroups.find(g => g[0] === group)![3];
  const income = type === 'expense' || type === 'revenue';
  const report = income ? p.income : opening ? p.opening : p.balance;
  if (!valid(report)) return null;
  const sectionId = income ? 'income-ledger-detail' : `position-${type === 'asset' ? 'assets' : 'liabilities'}-detail`;
  const details = rows(report, sectionId);
  // Missing inactive accounts in a complete, available report have no balance.
  let total = 0;
  for (const id of mapping[group]!) {
    const row = details.find(r => r.id === id);
    if (row && finite(row.values.amount) === null) return null;
    total += row ? Number(row.values.amount) : 0;
  }
  return finite(total);
}
export function metrics(p: FinancialPeriod, mapping: AccountMapping) {
  const revenue = rowAmount(p.income, 'income-summary', 'revenue');
  const expenses = rowAmount(p.income, 'income-summary', 'expenses');
  const net = rowAmount(p.income, 'income-summary', 'net-income');
  const assets = rowAmount(p.balance, 'financial-position', 'assets-total');
  const liabilities = rowAmount(p.balance, 'financial-position', 'liabilities-total');
  const equity = rowAmount(p.balance, 'financial-position', 'equity-total');
  const startAssets = rowAmount(p.opening, 'financial-position', 'assets-total');
  const startEquity = rowAmount(p.opening, 'financial-position', 'equity-total');
  const cogs = mapped(p, 'cogs', mapping), finance = mapped(p, 'finance', mapping), tax = mapped(p, 'tax', mapping), depreciation = mapped(p, 'depreciation', mapping);
  const financeIncome = mapped(p, 'financeIncome', mapping);
  const ebit = difference(sum(sum(net, finance), tax), financeIncome), ebitda = sum(ebit, depreciation), gross = difference(revenue, cogs);
  const currentAssets = mapped(p, 'currentAssets', mapping), currentLiabilities = mapped(p, 'currentLiabilities', mapping);
  const inventory = mapped(p, 'inventory', mapping), cash = mapped(p, 'cash', mapping), debt = mapped(p, 'debt', mapping);
  const days = (Date.parse(p.income.period.to) - Date.parse(p.income.period.from!)) / 86400000 + 1;
  const averageAR = calc(mapped(p, 'receivables', mapping), mapped(p, 'receivables', mapping, true), (a, b) => (a + b) / 2);
  return { revenue, expenses, net, assets, liabilities, equity, cogs, finance, financeIncome, tax, depreciation, gross, ebit, ebitda, cash, debt, currentAssets, currentLiabilities,
    netMargin: ratio(net, revenue, 100), expenseRatio: ratio(expenses, revenue, 100), grossMargin: ratio(gross, revenue, 100), ebitdaMargin: ratio(ebitda, revenue, 100),
    currentRatio: ratio(currentAssets, currentLiabilities), quickRatio: ratio(difference(currentAssets, inventory), currentLiabilities), cashRatio: ratio(cash, currentLiabilities),
    workingCapital: difference(currentAssets, currentLiabilities), liabilitiesRatio: ratio(liabilities, assets, 100), debtEquity: ratio(debt, equity),
    roa: ratio(net, calc(assets, startAssets, (a, b) => (a + b) / 2), 100), roe: ratio(net, calc(equity, startEquity, (a, b) => (a + b) / 2), 100),
    interestCoverage: ratio(ebit, finance), netDebt: difference(debt, cash), debtEbitda: ratio(difference(debt, cash), ebitda),
    collectionDays: ratio(averageAR, revenue, days),
    balanceGap: difference(assets, sum(liabilities, equity)),
  };
}
export type Metrics = ReturnType<typeof metrics>;
export type MetricKey = keyof Metrics;
export const metricDefinitions: { key: MetricKey; label: string; unit: 'money' | 'percent' | 'times' | 'days'; formula: string; favorable?: 'up' | 'down' }[] = [
  { key: 'revenue', label: bi('الإيرادات','Revenue'), unit: 'money', formula: bi('قائمة الدخل · الإيرادات المسجلة','Income statement · recorded revenue'), favorable:'up' },
  { key: 'net', label: bi('صافي الربح / الخسارة','Net profit / loss'), unit:'money', formula: bi('الإيرادات − المصروفات','Revenue − expenses'), favorable:'up' },
  { key: 'netMargin', label:bi('هامش صافي الربح','Net margin'), unit:'percent', formula:bi('صافي الربح ÷ الإيرادات','Net profit ÷ revenue'), favorable:'up' },
  { key:'grossMargin',label:bi('هامش مجمل الربح','Gross margin'),unit:'percent',formula:bi('(الإيرادات − تكلفة المبيعات) ÷ الإيرادات','(Revenue − cost of sales) ÷ revenue'),favorable:'up' },
  { key:'ebitda',label:'EBITDA',unit:'money',formula:bi('صافي الربح + تكلفة التمويل − إيراد التمويل + ضريبة الدخل + الإهلاك؛ ليس نقدًا','Net profit + finance expense − financing income + income tax + depreciation; not cash flow'),favorable:'up' },
  { key:'ebitdaMargin',label:bi('هامش EBITDA','EBITDA margin'),unit:'percent',formula:bi('EBITDA ÷ الإيرادات','EBITDA ÷ revenue'),favorable:'up' },
  { key:'expenses',label:bi('المصروفات','Expenses'),unit:'money',formula:bi('قائمة الدخل · جميع المصروفات','Income statement · all expenses') },
  { key:'expenseRatio',label:bi('التكلفة لكل 100 إيراد','Cost per 100 revenue'),unit:'percent',formula:bi('المصروفات ÷ الإيرادات × 100','Expenses ÷ revenue × 100'),favorable:'down' },
  { key:'currentRatio',label:bi('نسبة التداول','Current ratio'),unit:'times',formula:bi('الأصول المتداولة ÷ الالتزامات المتداولة','Current assets ÷ current liabilities') },
  { key:'quickRatio',label:bi('السيولة السريعة','Quick ratio'),unit:'times',formula:bi('(الأصول المتداولة − المخزون والمقدمات) ÷ الالتزامات المتداولة','(Current assets − inventory and prepayments) ÷ current liabilities') },
  { key:'cashRatio',label:bi('نسبة النقد','Cash ratio'),unit:'times',formula:bi('النقد ÷ الالتزامات المتداولة','Cash ÷ current liabilities') },
  { key:'workingCapital',label:bi('رأس المال العامل','Working capital'),unit:'money',formula:bi('الأصول المتداولة − الالتزامات المتداولة','Current assets − current liabilities') },
  { key:'liabilitiesRatio',label:bi('الالتزامات إلى الأصول','Liabilities to assets'),unit:'percent',formula:bi('إجمالي الالتزامات ÷ إجمالي الأصول','Total liabilities ÷ total assets') },
  { key:'debtEquity',label:bi('ديون التمويل إلى الملكية','Financing debt to equity'),unit:'times',formula:bi('ديون التمويل ÷ حقوق الملكية','Interest-bearing debt ÷ equity') },
  { key:'interestCoverage',label:bi('تغطية تكلفة التمويل','Interest coverage'),unit:'times',formula:bi('EBIT ÷ تكلفة التمويل','EBIT ÷ finance expense'),favorable:'up' },
  { key:'debtEbitda',label:bi('صافي الدين / EBITDA للفترة','Net debt / period EBITDA'),unit:'times',formula:bi('(الديون − النقد) ÷ EBITDA؛ لا تُحوّل الفترات الجزئية إلى سنة','(Debt − cash) ÷ EBITDA; partial periods are not annualised') },
  { key:'roa',label:bi('العائد على الأصول للفترة','Period return on assets'),unit:'percent',formula:bi('صافي الربح ÷ متوسط أصول بداية ونهاية الفترة؛ غير سنوي','Net profit ÷ average opening and closing assets; not annualised') },
  { key:'roe',label:bi('العائد على الملكية للفترة','Period return on equity'),unit:'percent',formula:bi('صافي الربح ÷ متوسط حقوق الملكية؛ غير سنوي','Net profit ÷ average equity; not annualised') },
  { key:'collectionDays',label:bi('أيام الذمم / إجمالي الإيراد','Receivable days / total revenue'),unit:'days',formula:bi('متوسط الذمم التجارية ÷ إجمالي الإيراد × أيام الفترة؛ تقريبي دون فصل البيع الآجل','Average trade receivables ÷ total revenue × period days; proxy without credit sales split') },
];
export function breakEven(s: Scenario, revenue: number | null) {
  if (s.fixedCosts.trim() === '' || s.variablePercent.trim() === '' || !s.source.trim()) return null;
  const fixed = Number(s.fixedCosts), variable = Number(s.variablePercent), target = s.targetProfit.trim() === '' ? 0 : Number(s.targetProfit);
  if (![fixed, variable, target].every(Number.isFinite) || fixed < 0 || variable < 0 || variable >= 100 || target < 0) return null;
  const contribution = 1 - variable / 100, sales = fixed / contribution;
  return { fixed, variable, target, contribution, sales, targetSales: (fixed + target) / contribution,
    gap: revenue === null ? null : revenue - sales, safety: ratio(revenue === null ? null : revenue - sales, revenue, 100), source: s.source };
}
export type OwnerVisual = 'summary' | 'performance' | 'costs' | 'position' | 'ratios' | 'breakeven' | 'history' | 'method' | 'actions';
export const chapterDefinitions: [OwnerVisual, string, string][] = [
  ['summary','الخلاصة التنفيذية','Executive review'],['performance','الإيرادات والتكاليف والربح','Revenue, costs and profit'],
  ['costs','أين تذهب الإيرادات؟','Where does revenue go?'],['position','المركز المالي والسيولة','Financial position and liquidity'],
  ['ratios','لوحة المؤشرات والمقارنة','Ratios and comparison'],['breakeven','نقطة التعادل والسيناريوهات','Break-even and scenarios'],
  ['history','ملخص الفترات المقارنة','Comparable periods'],['method','المصادر ومنهجية الحساب','Sources and methodology'],['actions','ملاحظات الإدارة وخطة المتابعة','Management notes and follow-up'],
];
export type OwnerAnalysis = { periods: FinancialPeriod[]; metrics: Metrics[]; options: OwnerOptions; cash: ReportPayload; breakEven: ReturnType<typeof breakEven> };
export function ownerChapters(analysis: OwnerAnalysis, selected: OwnerVisual[]): ReportPayload[] {
  const base = analysis.periods[0].income;
  return chapterDefinitions.filter(([id]) => selected.includes(id)).map(([id,title,englishTitle]) => ({ ...base, id: `owner-${id}`, title, englishTitle, summary:{}, sections:[], notices:[] }));
}
export const section = (id: string, title: string, headers: string[], values: Array<Array<string | number | null>>): ReportSection => ({ id, title,
  columns: headers.map((label, i) => ({ key: String(i), label })), rows: values.map((v,i) => ({ id:`${id}-${i}`,label:String(v[0]),values:Object.fromEntries(v.map((value,k) => [String(k),value])) })) });
