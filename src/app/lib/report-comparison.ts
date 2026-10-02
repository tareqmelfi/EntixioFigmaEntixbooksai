import type { ReportPayload, ReportRow } from './api';

export type ComparisonMode = 'previous_period' | 'previous_year' | 'none';
export type ComparisonPeriod = { from: string; to: string };
export function comparisonMode(value: string | null, id: string, from?: string, to?: string): ComparisonMode {
  if (id !== 'income-statement') return 'none';
  if (!value && from && to && from.slice(0, 7) === to.slice(0, 7)) return 'previous_period';
  return value === 'none' || value === 'previous_period' ? value : 'previous_year';
}
const iso = (date: Date) => date.toISOString().slice(0, 10);
const date = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || iso(parsed) !== value) throw new Error('INVALID_COMPARISON_PERIOD');
  return parsed;
};
const shiftMonths = (value: Date, months: number) => {
  const first = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(value.getUTCDate(), last));
  return first;
};
/** Full calendar months compare to preceding full months; other ranges use equal days.
 * A year-to-date report never silently compares nine months to just one month. */
export function comparisonPeriod(from: string, to: string, mode: Exclude<ComparisonMode, 'none'>): ComparisonPeriod {
  const start = date(from), end = date(to);
  if (start > end) throw new Error('INVALID_COMPARISON_PERIOD');
  if (mode === 'previous_year') {
    const priorEnd = shiftMonths(end, -12);
    if (start.getUTCDate() === 1 && end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()) priorEnd.setUTCMonth(priorEnd.getUTCMonth() + 1, 0);
    return { from: iso(shiftMonths(start, -12)), to: iso(priorEnd) };
  }
  const priorTo = new Date(start.getTime() - 86400000);
  const fullMonths = start.getUTCDate() === 1 && end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
  return { from: iso(fullMonths ? shiftMonths(start, -months) : new Date(priorTo.getTime() - (end.getTime() - start.getTime()))), to: iso(priorTo) };
}

/** Only income statements currently expose consistent historical amount rows.
 * In particular, cash-flow's current bank balance must NOT be compared as historical cash. */
export async function compareReport(base: ReportPayload, mode: ComparisonMode, load: (period: ComparisonPeriod) => Promise<ReportPayload>): Promise<ReportPayload> {
  if (mode === 'none' || base.id !== 'income-statement' || base.period.allTime || !base.period.from || !base.sections.some(s => s.columns.some(c => c.key === 'amount'))) return base;
  const period = comparisonPeriod(base.period.from, base.period.to, mode);
  const prior = await load(period);
  if (prior.id !== base.id || prior.org.id !== base.org.id || prior.currency !== base.currency || prior.dataBasis?.source !== base.dataBasis?.source) throw new Error('COMPARISON_SCOPE_CHANGED');
  if (prior.period.from !== period.from || prior.period.to !== period.to || prior.period.allTime) throw new Error('COMPARISON_PERIOD_CHANGED');
  const numeric = (report: ReportPayload, row?: ReportRow) => {
    if (report.status === 'unavailable' || report.dataBasis?.status === 'unavailable' || report.dataBasis?.status === 'no_activity') return null;
    const raw = row?.values.amount;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    // An absent ledger account in an otherwise available report is zero recorded
    // movement. No recorded activity for the WHOLE period is not proof of zero.
    return !row && report.dataBasis?.status === 'available' ? 0 : null;
  };
  const sectionIds = [...new Set([...base.sections, ...prior.sections].map(s => s.id))];
  const sections = sectionIds.map(id => {
    const current = base.sections.find(s => s.id === id), previous = prior.sections.find(s => s.id === id), section = current || previous!;
    if (!section.columns.some(c => c.key === 'amount')) return section;
    const rows = new Map([...(current?.rows || []), ...(previous?.rows || [])].map(r => [r.id, r]));
    return { ...section, columns: [
      ...section.columns.filter(c => !['note', 'priorAmount', 'comparisonDelta', 'comparisonPercent'].includes(c.key)).map(c => c.key === 'amount' ? { ...c, label: 'الفترة الحالية␟Current period' } : c),
      { key: 'priorAmount', label: 'الفترة السابقة␟Prior period', kind: 'money' as const, align: 'end' as const },
      { key: 'comparisonDelta', label: 'الفرق␟Change', kind: 'money' as const, align: 'end' as const },
      { key: 'comparisonPercent', label: 'التغيّر %␟Change %', kind: 'number' as const, align: 'end' as const },
    ], rows: [...rows.values()].map(row => {
      const currentRow = current?.rows.find(r => r.id === row.id), previousRow = previous?.rows.find(r => r.id === row.id);
      const amount = numeric(base, currentRow), priorAmount = numeric(prior, previousRow);
      const delta = amount !== null && priorAmount !== null ? Math.round((amount - priorAmount) * 100) / 100 : null;
      // A zero/negative baseline cannot communicate an ordinary growth rate.
      // Preserve the actual monetary change and show a dash instead of infinity.
      const percent = delta !== null && priorAmount! > 0 && amount! >= 0 ? delta / priorAmount! : null;
      const source = currentRow || row;
      return { ...source, values: { ...source.values, label: source.values.label || source.label, amount, priorAmount, comparisonDelta: delta, comparisonPercent: percent } };
    }) };
  });
  return { ...base, comparePeriod: period, sections, notices: [...(base.notices || []),
    `المقارنة: ${period.from} → ${period.to}. الأخضر تحسّن والأحمر تراجع؛ زيادة المصروفات تراجع. النسبة غير متاحة عند غياب البيانات أو أساس صفري/سالب أو التحول إلى خسارة.␟Comparison: ${period.from} → ${period.to}. Green is favorable, red unfavorable; higher expenses are unfavorable. Percent is unavailable for missing data, zero/negative baselines or a change to loss.`,
    ...(prior.notices || []).filter(n => !(base.notices || []).includes(n)).map(n => { const [ar, en] = n.split('␟'); return `الفترة السابقة: ${ar}␟Prior period: ${en || ar}`; }),
  ] };
}

export const isComparisonValue = (row: ReportRow, key: string) => 'comparisonDelta' in row.values && ['amount', 'priorAmount', 'comparisonDelta', 'comparisonPercent'].includes(key);
export function comparisonTone(row: ReportRow, key: string) {
  if (!isComparisonValue(row, key) || !['comparisonDelta', 'comparisonPercent'].includes(key)) return 'report-zero';
  const delta = row.values.comparisonDelta;
  if (typeof delta !== 'number' || delta === 0) return 'report-zero';
  const expense = row.id === 'expenses' || row.id.startsWith('exp-');
  const income = row.id === 'revenue' || row.id === 'net-income' || row.id.startsWith('rev-');
  if (!expense && !income) return 'report-zero';
  return (expense ? delta < 0 : delta > 0) ? 'report-positive' : 'report-negative';
}
export function comparisonText(row: ReportRow, key: string) {
  const value = row.values[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const change = key === 'comparisonDelta' || key === 'comparisonPercent';
  const percent = key === 'comparisonPercent';
  const formatted = Math.abs(value * (percent ? 100 : 1)).toLocaleString('en-US', { minimumFractionDigits: percent ? 1 : 2, maximumFractionDigits: percent ? 1 : 2 });
  return `${change ? value > 0 ? '↑ +' : value < 0 ? '↓ −' : '= ' : value < 0 ? '−' : ''}${formatted}${percent ? '%' : ''}`;
}
