import { useState } from 'react';
import { useLanguage } from './LanguageContext';

/** Captured from the real application with synthetic, non-customer records. */
export function ProductGallery({ initial = 'invoices' }: { initial?: 'invoices' | 'quotes' | 'projects' }) {
  const { language, t } = useLanguage();
  const [selected, setSelected] = useState(initial);
  const screens = [
    { id: 'invoices' as const, name: t('الفواتير والتحصيل', 'Invoices and collection'), caption: t('الحالات والمبالغ المستحقة والتحصيل في قائمة واحدة.', 'Statuses, outstanding amounts and collections in one list.') },
    { id: 'quotes' as const, name: t('عروض الأسعار', 'Quotations'), caption: t('تابع القبول والتأخير والتحويل، مع بقاء العروض في سجلها.', 'Track acceptance, expiry and conversion while retaining quotation history.') },
    { id: 'projects' as const, name: t('المشاريع', 'Projects'), caption: t('راجع التقدم والمواعيد والمبالغ المسجلة لكل مشروع.', 'Review progress, dates and recorded amounts for each project.') },
  ];
  // Public images have immutable caching; updated captures need a new URL.
  const imagePath = `/marketing/product/${selected}-${language}${selected === 'quotes' ? '-20260927' : ''}.png`;
  const current = screens.find(s => s.id === selected)!;
  return <div data-testid="product-gallery" className="mx-auto max-w-6xl">
    <div className="mb-6 flex flex-wrap justify-center gap-3" aria-label={t('اختر الشاشة', 'Choose a screen')}>
      {screens.map(screen => <button key={screen.id} type="button" aria-pressed={selected === screen.id} onClick={() => setSelected(screen.id)} className={`rounded-full border px-5 py-3 text-sm font-semibold ${selected === screen.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>{screen.name}</button>)}
    </div>
    <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <a href={imagePath} target="_blank" rel="noopener noreferrer" aria-label={t('افتح لقطة الشاشة بالحجم الكامل', 'Open full-size screenshot')}>
        <img src={imagePath} width="1440" height="1040" loading="lazy" alt={`${current.name} — ${t('واجهة ENTIX.IO الفعلية ببيانات تجريبية', 'Actual ENTIX.IO interface with demo data')}`} className="h-auto w-full" />
      </a>
      <figcaption className="border-t border-border p-5 text-sm leading-7 text-muted-foreground"><strong className="text-foreground">{current.caption}</strong><br />{t('لقطة من التطبيق الفعلي ببيانات تجريبية، وليست بيانات عملاء. اضغط لعرضها بالحجم الكامل.', 'Captured from the actual application using demo records, not customer data. Select the image to view full size.')}</figcaption>
    </figure>
  </div>;
}
