import type { DashboardSummary } from './api';
import type { PostingCoverage } from '../components/dashboard-posting-coverage';

/** Aggregate comparison only: never certify reconciliation from a journal link. */
export function dashboardTotalsMatch(data: DashboardSummary & { postingCoverage?: PostingCoverage }): boolean {
  const coverage = data.postingCoverage;
  if (!data.savedActivity || data.period?.source !== 'ledger' || !data.dataAvailability?.hasActivity
    || data.unavailableMetrics?.length || coverage?.status !== 'no_missing_links' || coverage.unlinkedCount !== 0) return false;
  const kinds = ['invoice', 'credit-note', 'bill', 'expense', 'supplier-credit'];
  const rows = data.savedActivity.rows.filter(row => row.selected && kinds.includes(row.kind));
  if (!rows.some(row => row.count > 0) || rows.some(row => row.draft || row.currency !== data.org.baseCurrency || !Number.isFinite(row.net))) return false;
  if (coverage.groups.some(row => row.draftCount > 0 || row.unlinkedCount > 0)) return false;
  const sum = (kind: string) => rows.filter(row => row.kind === kind).reduce((total, row) => total + row.net, 0);
  const revenue = sum('invoice') - sum('credit-note');
  const costs = sum('bill') + sum('expense') - sum('supplier-credit');
  const equal = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.round(a * 100) === Math.round(b * 100);
  return equal(revenue, data.kpi.revenue) && equal(costs, data.kpi.expenses) && equal(revenue - costs, data.kpi.netIncome ?? data.kpi.revenue - data.kpi.expenses);
}
