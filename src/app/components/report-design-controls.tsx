import type { ReportPrintSettings } from '../lib/api';
import { useLanguage } from './LanguageContext';

/** Shared output choices; these affect presentation only, never accounting data. */
export function ReportDesignControls({ settings, onChange, book = false }: { settings: ReportPrintSettings; onChange: (patch: ReportPrintSettings) => void; book?: boolean }) {
  const { t } = useLanguage();
  const select = (key: keyof ReportPrintSettings, label: string, options: [string, string][], fallback: string) => <label className="block text-sm space-y-1">
    <span>{label}</span><select aria-label={label} className="block w-full rounded-md border border-border bg-card p-2" value={String(settings[key] ?? fallback)} onChange={e => onChange({ [key]: e.target.value })}>
      {options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
    </select></label>;
  const toggle = (key: keyof ReportPrintSettings, label: string, fallback: boolean) => <label className="flex items-center justify-between gap-3 text-sm">
    <span>{label}</span><input type="checkbox" checked={Boolean(settings[key] ?? fallback)} onChange={e => onChange({ [key]: e.target.checked })} />
  </label>;
  return <div className="report-design-controls space-y-3">
    {select('fontFamily', t('خط التقرير', 'Report font'), [['noto', 'Noto Sans Arabic'], ['plex', 'IBM Plex Sans Arabic'], ['tajawal', 'Tajawal · تجوّل']], 'noto')}
    {select('colorMode', t('نمط الألوان', 'Color mode'), [['color', t('ملوّن · أقسام متدرجة', 'Color · section hierarchy')], ['grayscale', t('درجات رمادية', 'Grayscale')], ['plain', t('رسمي · أبيض وأسود دون تعبئة', 'Formal · black and white without fills')]], 'color')}
    {toggle('showEquation', t('معادلة قائمة الدخل', 'Income statement equation'), true)}
    {toggle('colorValues', t('تمييز الموجب والسالب بالألوان', 'Color positive and negative values'), true)}
    {book && <>
      <div className="grid grid-cols-2 gap-3">{(['primaryColor', 'accentColor'] as const).map(key => <label key={key} className="text-sm space-y-1"><span>{key === 'primaryColor' ? t('لون الشركة الرئيسي', 'Company primary color') : t('لون الرسوم', 'Chart accent color')}</span><input type="color" className="block h-9 w-full rounded border border-border" value={settings[key] || (key === 'primaryColor' ? '#102d50' : '#008da6')} onChange={event => onChange({ [key]: event.target.value })} /></label>)}</div>
      {select('paper', t('الورق', 'Paper'), ['A4', 'A3', 'Letter', 'Legal'].map(p => [p, p]), 'A4')}
      {select('fontScale', t('حجم الخط', 'Font size'), [['compact', t('صغير', 'Small')], ['normal', t('عادي', 'Normal')], ['large', t('كبير', 'Large')]], 'normal')}
      {select('density', t('كثافة الجدول', 'Table density'), [['compact', t('مضغوط', 'Compact')], ['standard', t('قياسي', 'Standard')], ['comfortable', t('مريح', 'Comfortable')]], 'standard')}
    </>}
    <p className="text-xs text-muted-foreground">{t('الأغلفة والفواصل لملفات PDF والطباعة', 'Covers and dividers apply to PDF and printing')}</p>
    {toggle('showCover', t('غلاف أمامي', 'Front cover'), book)}
    {toggle('showBackCover', t('غلاف أخير', 'Back cover'), false)}
    {(settings.showCover || settings.showBackCover || settings.showSectionDividers) && select('coverStyle', t('تصميم الغلاف', 'Cover design'), [['dark', t('داكن · بشعار مناسب للخلفية', 'Dark · reverse logo')], ['light', t('فاتح', 'Light')], ['formal', t('رسمي بدون خلفية ملونة', 'Formal · no colored background')]], 'dark')}
    {book && toggle('showSectionDividers', t('صفحات فاصلة بين الفصول', 'Chapter divider pages'), false)}
  </div>;
}
