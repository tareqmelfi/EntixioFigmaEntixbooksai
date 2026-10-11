import { useLanguage } from './LanguageContext';
import { unitLabel, type QuotePresentation } from '../lib/quote-document-fields';
import type { InvoiceLine } from './items-table';

export type QuoteEditorLine = InvoiceLine & { sectionLabel?: string | null; included?: boolean; isOptional?: boolean };
const fieldClass = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm';

export function QuoteLineUnits({ lines, onChange }: { lines: QuoteEditorLine[]; onChange: (lines: QuoteEditorLine[]) => void }) {
  const { t, language } = useLanguage();
  const move = (index: number, delta: number) => {
    const next = [...lines];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return <details className="rounded-lg border border-border p-3" data-testid="quote-line-units">
    <summary className="cursor-pointer font-semibold text-sm">{t('ترتيب البنود', 'Line order')}</summary>
    <p className="text-xs text-muted-foreground my-2">{t('اختر الوحدة بجانب الكمية في الجدول. ترتيب الصفوف هنا هو ترتيب الحفظ والطباعة.', 'Choose each unit beside its quantity in the table. This row order is used for saving and printing.')}</p>
    {lines.map((line, index) => <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-border py-2">
      <span className="truncate text-sm" title={line.description}>{index + 1}. {line.description || t('بند جديد', 'New item')}</span>
      <span className="text-sm text-muted-foreground">{unitLabel(line.unit,language)}</span>
      <div className="flex gap-1">
        <button type="button" className="rounded border border-border px-2 disabled:opacity-30" aria-label={t(`رفع البند ${index + 1}`,`Move line ${index + 1} up`)} disabled={index === 0} onClick={() => move(index,-1)}>↑</button>
        <button type="button" className="rounded border border-border px-2 disabled:opacity-30" aria-label={t(`خفض البند ${index + 1}`,`Move line ${index + 1} down`)} disabled={index === lines.length-1} onClick={() => move(index,1)}>↓</button>
      </div>
    </div>)}
  </details>;
}

export function QuoteDocumentOptions({ value, onChange, template, notes, onNotesChange }: { value: QuotePresentation; onChange: (value: QuotePresentation) => void; template?: Partial<QuotePresentation>; notes: string; onNotesChange: (notes: string) => void }) {
  const { t } = useLanguage();
  const textFields: Array<[keyof QuotePresentation,string,string]> = [
    ['signatoryName','اسم ممثل الشركة','Company representative'],
    ['signatoryTitleAr','المسمى الوظيفي بالعربية','Title in Arabic'],
    ['signatoryTitle','المسمى الوظيفي بالإنجليزية','Title in English'],
    ['clientRole','صفة العميل بالعربية','Client role in Arabic'],
    ['clientRoleEn','صفة العميل بالإنجليزية','Client role in English'],
  ];
  const facts = value.deliveryFacts ?? template?.deliveryFacts ?? [];
  const source = value.deliverySource || 'custom';
  return <details className="space-y-3 rounded-lg border border-border p-4" data-testid="quote-document-options">
    <summary className="cursor-pointer font-semibold">{t('مدة التنفيذ والتسليم والتوقيع · تعديل بيانات الطباعة','Delivery and signatures · edit printed details')}</summary>
    <label className="block text-sm">{t('مصدر بيانات صفحة التنفيذ','Delivery page source')}
      <select className={fieldClass} data-testid="quote-delivery-source" value={source} onChange={e => {
        const deliverySource = e.target.value as QuotePresentation['deliverySource'];
        onChange({...value,deliverySource,...(deliverySource === 'custom' ? {deliveryFacts:facts,deliveryNote:value.deliveryNote ?? template?.deliveryNote ?? ''} : {})});
      }}>
        <option value="quote_notes">{t('شروط ومدة التنفيذ المكتوبة في هذا العرض','Terms and delivery period in this quote')}</option>
        <option value="custom">{t('بيانات تنفيذ مخصصة لهذا العرض','Custom delivery details for this quote')}</option>
        <option value="template">{t('بيانات القالب الافتراضية','Template defaults')}</option>
      </select>
    </label>
    {source === 'quote_notes' ? <label className="block text-sm">{t('شروط ومدة التنفيذ · تظهر في صفحة التنفيذ مباشرة','Terms and delivery period · printed on the delivery page')}
      <textarea className={fieldClass} rows={3} data-testid="quote-delivery-notes-source" value={notes} onChange={e => onNotesChange(e.target.value)} />
      <span className="text-xs text-muted-foreground">{t('هذا هو نفس حقل شروط ومدة التنفيذ في العرض. لا تُضاف إليه مدد من القالب.', 'This is the quote’s terms and delivery field. Template delivery periods are not added.')}</span>
    </label> : source === 'template' ? <p className="text-sm text-muted-foreground">{t('ستُستخدم بيانات التنفيذ المحفوظة في القالب. اختر البيانات المخصصة لتعديلها لهذا العرض.', 'Uses the template’s saved delivery details. Choose custom details to edit them for this quote.')}</p> : <>
      {facts.map((fact,index) => <div key={index} className="flex gap-2">
        <input className={fieldClass} aria-label={t(`عنوان البيان ${index+1}`,`Detail label ${index+1}`)} maxLength={200} value={fact.label} onChange={e => onChange({...value,deliveryFacts:facts.map((f,i)=>i===index?{...f,label:e.target.value}:f)})} />
        <input className={fieldClass} aria-label={t(`قيمة البيان ${index+1}`,`Detail value ${index+1}`)} maxLength={1000} value={fact.value} onChange={e => onChange({...value,deliveryFacts:facts.map((f,i)=>i===index?{...f,value:e.target.value}:f)})} />
        <button type="button" onClick={() => onChange({...value,deliveryFacts:facts.filter((_,i)=>i!==index)})} aria-label={t('حذف البيان','Remove detail')}>×</button>
      </div>)}
      <button type="button" disabled={facts.length>=10} className="text-sm text-primary" onClick={() => onChange({...value,deliveryFacts:[...facts,{label:'',value:''}]})}>{t('+ إضافة بيان تنفيذ','+ Add delivery detail')}</button>
      <label className="block text-sm">{t('ملاحظات التنفيذ','Delivery notes')}<textarea className={fieldClass} rows={3} maxLength={4000} data-testid="quote-deliveryNote" value={value.deliveryNote ?? template?.deliveryNote ?? ''} onChange={e => onChange({...value,deliveryNote:e.target.value})} /></label>
    </>}
    <h3 className="font-semibold text-sm">{t('التوقيع وصفة العميل','Signature and client role')}</h3>
    <p className="text-xs text-muted-foreground">{t('تُحفظ التعديلات لهذا العرض. لتغيير المسمى الافتراضي للعروض الجديدة، عدّل قالب الشركة من صفحة القوالب.', 'Changes are saved for this quote. To change the default title for new quotes, edit the company template on the Templates page.')}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {textFields.map(([key,ar,en]) => <label key={key} className="space-y-1 text-sm">{t(ar,en)}
        <input className={fieldClass} data-testid={`quote-${key}`} maxLength={200} value={String(value[key] ?? template?.[key] ?? '')} onChange={e => onChange({...value,[key]:e.target.value})} />
      </label>)}
    </div>
  </details>;
}
