import type { ReportPayload, ReportSection } from './api';
export type MonthWindow = { key: string; from: string; to: string; label: string };
export function reportMonths(from: string, to: string): MonthWindow[] {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(from) || !valid(to) || from > to) throw new Error('INVALID_REPORT_PERIOD');
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`), result: MonthWindow[] = [];
  while (cursor.toISOString().slice(0, 10) <= to) {
    if (result.length === 36) throw new Error('REPORT_MONTH_LIMIT');
    const first = cursor.toISOString().slice(0, 10);
    const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    result.push({ key: first.slice(0, 7), from: first < from ? from : first, to: last > to ? to : last,
      label: `${cursor.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric', calendar: 'gregory', numberingSystem: 'latn', timeZone: 'UTC' })}␟${cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}
/** Reuse report accounting, filters and company scope; never recalculate from invoice lists. */
export async function monthlyReport(base: ReportPayload, load: (period: MonthWindow) => Promise<ReportPayload>) {
  if (base.id !== 'income-statement' || !base.period.from) throw new Error('INVALID_REPORT_PERIOD');
  const periods = reportMonths(base.period.from, base.period.to);
  const reports: ReportPayload[] = [];
  // Bound server load. Any failed month rejects the entire matrix, never a partial export.
  for (let i = 0; i < periods.length; i += 3) reports.push(...await Promise.all(periods.slice(i, i + 3).map(load)));
  for (const [i, r] of reports.entries()) {
    if (r.id !== base.id || r.period.from !== periods[i].from || r.period.to !== periods[i].to) throw new Error('REPORT_PERIOD_CHANGED');
    if (r.org.id !== base.org.id || r.currency !== base.currency || r.dataBasis?.source !== base.dataBasis?.source) throw new Error('REPORT_SCOPE_CHANGED');
  }
  const sections: ReportSection[] = base.sections.map(s => {
    const rows = new Map(s.rows.map(r => [r.id, r]));
    for (const r of reports) for (const row of r.sections.find(p => p.id === s.id)?.rows || []) if (!rows.has(row.id)) rows.set(row.id, row);
    return { ...s, columns: [{ key: 'label', label: 'الحساب / البند␟Account / item' }, ...periods.map(p => ({ key: p.key, label: p.label, kind: 'money' as const, align: 'end' as const })), { key: 'amount', label: 'الإجمالي␟Total', kind: 'money' as const, align: 'end' as const }], rows: [...rows.values()].map(row => {
      const values = Object.fromEntries(periods.map((p, i) => {
        const r = reports[i], found = r.sections.find(x => x.id === s.id)?.rows.find(x => x.id === row.id);
        const raw = found?.values.amount;
        const value = typeof raw === 'number' ? raw : r.dataBasis?.status === 'no_activity' || (!found && r.dataBasis?.status === 'available') ? 0 : null;
        return [p.key, value];
      }));
      const total = s.rows.find(r => r.id === row.id)?.values.amount ?? null;
      const numbers = Object.values(values);
      if (typeof total === 'number' && numbers.every(v => typeof v === 'number') && Math.abs(numbers.reduce<number>((a, v) => a + Number(v), 0) - total) > 0.01 * (periods.length + 1)) throw new Error('REPORT_RECONCILIATION_FAILED');
      return { ...row, values: { label: row.label, ...values, amount: total } };
    }) };
  });
  return { ...base, comparePeriod: null, sections, notices: [...new Set([...(base.notices || []), ...reports.flatMap(r => r.notices || [])])] };
}
export function reportLabel(text: string, language: string) {
  const [ar, en] = text.split('␟'); return language === 'en' ? en || ar : ar || en;
}
