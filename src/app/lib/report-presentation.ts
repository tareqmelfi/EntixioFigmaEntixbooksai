import type { ReportPayload, ReportRow } from './api';

const accountTypes: Record<string, string> = {
  ASSET: 'الأصول␟Assets', LIABILITY: 'الالتزامات␟Liabilities', EQUITY: 'حقوق الملكية␟Equity',
  REVENUE: 'الإيرادات␟Revenue', EXPENSE: 'المصروفات␟Expenses',
};
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const side = (value: unknown, debit: boolean) => {
  const n = amount(value);
  return n === null ? null : Math.round(Math.max(debit ? n : -n, 0) * 100) / 100;
};

/** Presentation only: retain the posted-ledger balances, never infer missing postings. */
export function presentReport(report: ReportPayload): ReportPayload {
  if (report.id !== 'trial-balance') return report;
  const presented = { ...report, sections: report.sections.map(section => {
    if (section.id !== 'accounts' || section.columns.some(c => c.key === 'openingDebit')) return section;
    const rows: ReportRow[] = section.rows.map(row => ({ ...row, values: {
      ...row.values, label: row.values.label ?? row.label,
      type: accountTypes[String(row.values.type)] || row.values.type,
      openingDebit: side(row.values.opening, true), openingCredit: side(row.values.opening, false),
      closingDebit: side(row.values.balance, true), closingCredit: side(row.values.balance, false),
    } }));
    const keys = ['openingDebit', 'openingCredit', 'debit', 'credit', 'closingDebit', 'closingCredit'];
    const totals = Object.fromEntries(keys.map(key => [key, rows.every(r => amount(r.values[key]) !== null)
      ? Math.round(rows.reduce((sum, r) => sum + Math.round(Number(r.values[key]) * 100), 0)) / 100 : null]));
    if (rows.length) rows.push({ id: 'trial-balance-total', label: 'الإجمالي␟Total', values: { label: 'الإجمالي␟Total', type: '', ...totals } });
    return { ...section, columns: [
      { key: 'label', label: 'رقم الحساب · اسم الحساب␟Account code · name' },
      { key: 'type', label: 'التصنيف␟Classification' },
      ...[
        ['openingDebit', 'افتتاحي مدين␟Opening debit'], ['openingCredit', 'افتتاحي دائن␟Opening credit'],
        ['debit', 'حركة مدين␟Movement debit'], ['credit', 'حركة دائن␟Movement credit'],
        ['closingDebit', 'ختامي مدين␟Closing debit'], ['closingCredit', 'ختامي دائن␟Closing credit'],
      ].map(([key, label]) => ({ key, label, kind: 'money' as const, align: 'end' as const })),
    ], rows };
  }) };
  const totals = presented.sections.find(section => section.id === 'accounts')?.rows.find(row => row.id === 'trial-balance-total')?.values;
  if (totals && [['openingDebit','openingCredit'],['debit','credit'],['closingDebit','closingCredit']].some(([debit,credit]) =>
    amount(totals[debit]) !== null && amount(totals[credit]) !== null && Math.abs(Number(totals[debit])-Number(totals[credit])) > .005)) {
    presented.notices = [...new Set([...(report.notices || []), 'يوجد فرق بين المدين والدائن؛ راجع القيود والأرصدة الافتتاحية قبل اعتماد التقرير.␟Debits and credits differ; review journals and opening balances before relying on this report.'])];
  }
  return presented;
}
