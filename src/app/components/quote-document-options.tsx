import { useLanguage } from './LanguageContext';
import { QUOTE_UNITS, unitLabel, type QuotePresentation } from '../lib/quote-document-fields';
import { SearchableCombobox } from './searchable-combobox';
import type { InvoiceLine } from './items-table';

export type QuoteEditorLine = InvoiceLine & { unit?: string | null; sectionLabel?: string | null; included?: boolean; isOptional?: boolean };
const fieldClass = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm';

export function QuoteLineUnits({ lines, onChange }: { lines: QuoteEditorLine[]; onChange: (lines: QuoteEditorLine[]) => void }) {
  const { t, language } = useLanguage();
  const move = (index: number, delta: number) => {
    const next = [...lines];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return <details open className="rounded-lg border border-border p-3" data-testid="quote-line-units">
    <summary className="cursor-pointer font-semibold text-sm">{t('الوحدات وترتيب البنود', 'Units and line order')}</summary>
    <p className="text-xs text-muted-foreground my-2">{t('تُحفظ الوحدة لكل بند وتظهر بلغة المستند. ترتيب الصفوف هنا هو ترتيب الحفظ والطباعة.', 'Each line retains its unit in the document language. This row order is used for saving and printing.')}</p>
    {lines.map((line, index) => <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-2 border-t border-border py-2">
      <span className="truncate text-sm col-span-2 sm:col-span-1" title={line.description}>{index + 1}. {line.description || t('بند جديد', 'New item')}</span>
      <SearchableCombobox value={line.unit || 'each'} onChange={unit => onChange(lines.map((l,i) => i === index ? {...l,unit} : l))}
        items={[...QUOTE_UNITS.map(u => ({ id:u.value,label:u[language] })), ...(line.unit && !QUOTE_UNITS.some(u => u.value === line.unit) ? [{id:line.unit,label:unitLabel(line.unit,language)}] : [])]}
        placeholder={t('الوحدة','Unit')} onCreate={async unit => unit} createLabel={unit => t(`استخدام «${unit}»`, `Use “${unit}”`)} />
      <div className="flex gap-1">
        <button type="button" className="rounded border border-border px-2 disabled:opacity-30" aria-label={t(`رفع البند ${index + 1}`,`Move line ${index + 1} up`)} disabled={index === 0} onClick={() => move(index,-1)}>↑</button>
        <button type="button" className="rounded border border-border px-2 disabled:opacity-30" aria-label={t(`خفض البند ${index + 1}`,`Move line ${index + 1} down`)} disabled={index === lines.length-1} onClick={() => move(index,1)}>↓</button>
      </div>
    </div>)}
  </details>;
}

export function QuoteDocumentOptions({ value, onChange, template }: { value: QuotePresentation; onChange: (value: QuotePresentation) => void; template?: Partial<QuotePresentation> }) {
  const { t } = useLanguage();
  const textFields: Array<[keyof QuotePresentation,string,string]> = [
    ['signatoryName','اسم ممثل الشركة','Company representative'],
    ['signatoryTitleAr','المسمى الوظيفي بالعربية','Title in Arabic'],
    ['signatoryTitle','المسمى الوظيفي بالإنجليزية','Title in English'],
    ['clientRole','صفة العميل بالعربية','Client role in Arabic'],
    ['clientRoleEn','صفة العميل بالإنجليزية','Client role in English'],
  ];
  const facts = value.deliveryFacts ?? template?.deliveryFacts ?? [];
  return <section className="space-y-3 rounded-lg border border-border p-4" data-testid="quote-document-options">
    <h2 className="font-semibold">{t('بيانات التنفيذ والتوقيع لهذا العرض','Delivery and signatures for this quote')}</h2>
    <p className="text-xs text-muted-foreground">{t('تبدأ بالقيم الموجودة في القالب، وتُحفظ تعديلاتك لهذا العرض وحده.', 'Starts with template values; your changes are saved for this quote.')}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {textFields.map(([key,ar,en]) => <label key={key} className="space-y-1 text-sm">{t(ar,en)}
        <input className={fieldClass} data-testid={`quote-${key}`} maxLength={200} value={String(value[key] ?? template?.[key] ?? '')} onChange={e => onChange({...value,[key]:e.target.value})} />
      </label>)}
    </div>
    <h3 className="text-sm font-semibold">{t('مدة التنفيذ وبيانات التسليم','Delivery period and details')}</h3>
    {facts.map((fact,index) => <div key={index} className="flex gap-2">
      <input className={fieldClass} aria-label={t(`عنوان البيان ${index+1}`,`Detail label ${index+1}`)} maxLength={200} value={fact.label} onChange={e => onChange({...value,deliveryFacts:facts.map((f,i)=>i===index?{...f,label:e.target.value}:f)})} />
      <input className={fieldClass} aria-label={t(`قيمة البيان ${index+1}`,`Detail value ${index+1}`)} maxLength={1000} value={fact.value} onChange={e => onChange({...value,deliveryFacts:facts.map((f,i)=>i===index?{...f,value:e.target.value}:f)})} />
      <button type="button" onClick={() => onChange({...value,deliveryFacts:facts.filter((_,i)=>i!==index)})} aria-label={t('حذف البيان','Remove detail')}>×</button>
    </div>)}
    <button type="button" disabled={facts.length>=10} className="text-sm text-primary" onClick={() => onChange({...value,deliveryFacts:[...facts,{label:'',value:''}]})}>{t('+ إضافة بيان تنفيذ','+ Add delivery detail')}</button>
    <label className="block text-sm">{t('ملاحظات التنفيذ','Delivery notes')}<textarea className={fieldClass} rows={3} maxLength={4000} data-testid="quote-deliveryNote" value={value.deliveryNote ?? template?.deliveryNote ?? ''} onChange={e => onChange({...value,deliveryNote:e.target.value})} /></label>
    <button type="button" className="text-sm text-primary" onClick={() => onChange({})}>{t('استخدام بيانات القالب مجددًا','Use template values again')}</button>
  </section>;
}
