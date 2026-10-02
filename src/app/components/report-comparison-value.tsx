import { NumericText } from './bidi-text';
import type { ReportRow } from '../lib/api';
import { comparisonText, comparisonTone } from '../lib/report-comparison';
export function ReportComparisonValue({ row, column }: { row: ReportRow; column: string }) {
  return <NumericText className={comparisonTone(row, column)}>{comparisonText(row, column)}</NumericText>;
}
