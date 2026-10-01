import type { ReportPayload } from '../lib/api';
import { reportEquationValues, reportSign } from '../lib/report-appearance';
import { displayLocale } from '../lib/number-display';
import { NumericText } from './bidi-text';

export function ReportEquation({ report, t }: { report: ReportPayload; t: (ar: string, en: string) => string }) {
  const values = reportEquationValues(report);
  if (!values) return null;
  const labels = [t('الإيرادات', 'Revenue'), t('المصروفات', 'Expenses'), t('صافي الربح / الخسارة', 'Net income / (loss)')];
  return <div className="report-equation" dir="ltr">
    {values.map((value, index) => <span className="report-equation-term" key={index}>
      {index > 0 && <b className="report-equation-operator">{index === 1 ? '−' : '='}</b>}
      <span>{labels[index]}</span>
      <NumericText className={index === 2 ? reportSign(value) : ''}>{value < 0 ? '(' : ''}{Math.abs(value).toLocaleString(displayLocale('en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{value < 0 ? ')' : ''} {report.currency}</NumericText>
    </span>)}
  </div>;
}
