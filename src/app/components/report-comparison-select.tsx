import type { ComparisonMode } from '../lib/report-comparison';
import { useLanguage } from './LanguageContext';
export function ReportComparisonSelect({ value, onChange, disabled }: { value: ComparisonMode; onChange: (mode: ComparisonMode) => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return <label className="space-y-1 text-sm"><span className="block font-semibold">{t('فترة المقارنة', 'Comparison period')}</span>
    <select aria-label={t('فترة المقارنة', 'Comparison period')} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={value} disabled={disabled} onChange={e => onChange(e.target.value as ComparisonMode)}>
      <option value="previous_year">{t('الفترة نفسها من السنة السابقة', 'Same period last year')}</option>
      <option value="previous_period">{t('الشهر السابق / الفترة السابقة', 'Previous month / period')}</option>
      <option value="none">{t('بدون مقارنة', 'No comparison')}</option>
    </select>
  </label>;
}
