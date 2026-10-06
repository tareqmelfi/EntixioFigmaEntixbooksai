import type { ReportPayload } from './api';
import { reportMonths } from './report-months';

/** A number's source period can differ from the report's current period. */
export function reportDrilldownRange(report: ReportPayload, column?: string) {
  if (column === 'priorAmount' && report.comparePeriod) return report.comparePeriod;
  if (column && /^\d{4}-\d{2}$/.test(column) && report.period.from) {
    const month = reportMonths(report.period.from, report.period.to).find(period => period.key === column);
    if (month) return { from: month.from, to: month.to };
  }
  if (column && ['opening','openingDebit','openingCredit'].includes(column) && report.period.from) {
    const previous = new Date(`${report.period.from}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return { from: null, to: previous.toISOString().slice(0,10) };
  }
  return report.period;
}
