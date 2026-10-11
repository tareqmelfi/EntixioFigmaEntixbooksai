import { useLanguage } from './LanguageContext';
import { SearchableCombobox } from './searchable-combobox';
import { QUOTE_UNITS, unitLabel } from '../lib/quote-document-fields';

/** The unit belongs to each line; custom industry units remain literal. */
export function LineUnitPicker({ value, onChange, disabled, testId }: { value?: string | null; onChange: (unit: string) => void; disabled?: boolean; testId?: string }) {
  const { t, language } = useLanguage();
  const unit = value || 'each';
  return <div className="min-w-0 w-full" data-testid={testId}>
    <SearchableCombobox value={unit} onChange={onChange} disabled={disabled}
      items={[...QUOTE_UNITS.map(u => ({ id: u.value, label: u[language], sublabel: u[language === 'ar' ? 'en' : 'ar'] })),
        ...(!QUOTE_UNITS.some(u => u.value === unit) ? [{ id: unit, label: unitLabel(unit, language) }] : [])]}
      placeholder={t('الوحدة', 'Unit')} onCreate={async text => text.trim()}
      createLabel={text => t(`+ وحدة مخصصة «${text}»`, `+ Custom unit “${text}”`)}
      borderless buttonClassName="min-h-8 h-auto py-1 px-1 text-[13px] rounded-md" menuMinWidth={220} />
  </div>;
}
