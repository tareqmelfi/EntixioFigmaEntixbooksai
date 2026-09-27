import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Search, ArrowUpRight } from 'lucide-react';
import { SharedNavbar } from '../components/shared-navbar';
import { SharedFooter } from '../components/shared-footer';
import { ProductGallery } from '../components/product-gallery';
import { useLanguage } from '../components/LanguageContext';
import { useMarketingRegion } from '../components/marketing-region';
import { modules, type FeatureStatus } from '../lib/feature-catalog';

export function Features() {
  const { language, t } = useLanguage();
  const { isSA } = useMarketingRegion();
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState('all');
  const status: Record<FeatureStatus, { label: string; style: string }> = {
    live: { label: t('متاح', 'Available'), style: 'bg-success/10 text-success' },
    partial: { label: t('متاح جزئيًا', 'Partially available'), style: 'bg-warning/10 text-warning' },
    planned: { label: t('مخطط', 'Planned'), style: 'bg-muted text-muted-foreground' },
    phase2: { label: t('مرحلة مستقبلية', 'Future phase'), style: 'bg-muted text-muted-foreground' },
    phase3: { label: t('مرحلة مستقبلية', 'Future phase'), style: 'bg-muted text-muted-foreground' },
  };
  const filtered = useMemo(() => modules.map(module => ({ ...module, features: module.features.filter(feature => {
    const matches = `${feature.name} ${feature.nameEn ?? ''} ${feature.description} ${feature.descEn ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matches && (availability === 'all' || (availability === 'future' ? ['planned', 'phase2', 'phase3'].includes(feature.status) : feature.status === availability));
  }) })).filter(module => module.features.length), [query, availability]);
  const count = filtered.reduce((sum, module) => sum + module.features.length, 0);
  const industries = [
    ['contracting', 'المقاولات والهندسة', 'Contracting and engineering'],
    ['freelancers', 'المستقلون والاستشاريون', 'Freelancers and consultants'],
    ['agencies', 'الوكالات والخدمات', 'Agencies and services'],
    ['accountants', 'المحاسبون', 'Accountants'],
    ['restaurants', 'المطاعم والمقاهي', 'Restaurants and cafés'],
    ['ecommerce', 'التجارة الإلكترونية', 'Ecommerce'],
  ];
  return <div className="min-h-screen bg-card" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <SharedNavbar />
    <main data-page="features">
      <section className="bg-foreground px-5 pt-32 pb-20 text-primary-foreground">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-5 text-sm font-semibold text-primary-foreground/80">ENTIX.IO · {t('المزايا', 'Features')}</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">{t('من أول عرض إلى آخر دفعة.', 'From first quote to final payment.')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-primary-foreground/85">{t('الفواتير والمصروفات والمشاريع والتقارير في مساحة مترابطة. شاهد الواجهات الفعلية وتحقق من حالة كل ميزة قبل اختيار خطتك.', 'Invoices, expenses, projects and reports in a connected workspace. Explore the real interface and check each capability before choosing a plan.')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/pricing" className="rounded-full bg-card px-7 py-3.5 font-semibold text-foreground">{t('اختر خطتك', 'Choose your plan')}</Link>
            <a href="#capabilities" className="rounded-full border border-primary-foreground/40 px-7 py-3.5 font-semibold">{t('استعرض المزايا وحالتها', 'Explore capabilities and status')}</a>
          </div>
        </div>
      </section>
      <section className="bg-muted/30 px-5 py-16" aria-labelledby="product-heading">
        <h2 id="product-heading" className="mb-3 text-center text-3xl font-bold">{t('شاهد العمل داخل المنصة', 'See the work inside the platform')}</h2>
        <p className="mx-auto mb-8 max-w-2xl text-center leading-7 text-muted-foreground">{t('واجهة عربية وإنجليزية، من متابعة العروض إلى الفواتير والمشاريع.', 'Arabic and English interfaces, from quotation tracking to invoices and projects.')}</p>
        <ProductGallery />
      </section>
      <section id="capabilities" className="scroll-mt-24 px-5 py-16" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="capabilities-heading" className="text-3xl font-bold">{t('دليل المزايا وحالة توفرها', 'Capability directory and availability')}</h2>
          <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">{t('هذا الدليل وخارطة المزايا داخل المنصة يستخدمان المصدر نفسه. قد تتطلب الميزة خطة أو صلاحية أو ربط حساب. الميزات المخططة ليست ضمن الوظائف المتاحة حاليًا.', 'This directory and the in-app roadmap share one source. Features may require a plan, permission or account connection. Planned capabilities are not currently available functionality.')}</p>
          <div className="my-7 grid gap-4 sm:grid-cols-[1fr_240px]">
            <label className="flex items-center gap-3 rounded-xl border border-border px-4"><Search className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="sr-only">{t('ابحث عن ميزة', 'Search capabilities')}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('ابحث: فواتير، مشاريع، عملات…', 'Search: invoices, projects, currencies…')} className="min-w-0 flex-1 bg-transparent py-3 outline-none" /></label>
            <label><span className="sr-only">{t('حالة التوفر', 'Availability')}</span><select value={availability} onChange={event => setAvailability(event.target.value)} className="w-full rounded-xl border border-border bg-card px-4 py-3"><option value="all">{t('كل الحالات', 'All statuses')}</option><option value="live">{status.live.label}</option><option value="partial">{status.partial.label}</option><option value="future">{t('مخطط ومستقبلي', 'Planned and future')}</option></select></label>
          </div>
          <p role="status" className="mb-5 text-sm text-muted-foreground">{count} {t('ميزة', 'capabilities')}</p>
          <div className="space-y-4">{filtered.map(module => <details key={module.title} open={query.length > 0 || availability !== 'all' ? true : undefined} className="rounded-2xl border border-border bg-card p-5">
            <summary className="cursor-pointer text-lg font-semibold">{language === 'ar' ? module.title : module.titleEn || module.title} <span className="text-sm font-normal text-muted-foreground">({module.features.length})</span></summary>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{module.features.map(feature => <article key={feature.name} className="rounded-xl bg-muted/30 p-5" data-feature-status={feature.status}>
              <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{language === 'ar' ? feature.name : feature.nameEn || feature.name}</h3><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status[feature.status].style}`}>{status[feature.status].label}</span></div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{language === 'ar' ? feature.description : feature.descEn || feature.description}</p>
            </article>)}</div>
          </details>)}</div>
          {!count && <p className="py-8 text-muted-foreground">{t('لا توجد نتائج. جرّب كلمة أخرى أو غيّر الحالة.', 'No matches. Try another term or status.')}</p>}
          <aside className="mt-7 rounded-xl border border-border bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">{isSA ? t('السوق السعودي: راجع إعدادات الضريبة وحالة ربط منشأتك. وجود أدوات الفوترة لا يعني اعتمادًا عامًا من ZATCA؛ يلزم التحقق من جاهزية الربط قبل الاعتماد الإنتاجي.', 'Saudi market: review tax settings and your organization’s connection status. Invoicing tools do not imply blanket ZATCA approval; validate integration readiness before production reliance.') : t('السوق الأمريكي: تتوفر سجلات الفواتير والضرائب والتقارير؛ ربط البنوك والدفع يعتمد على حسابك والمزود، ولا يعني تقديم الإقرارات الضريبية تلقائيًا.', 'US market: invoice, tax and reporting records are available. Bank and payment connections depend on your account and provider; this does not imply automatic tax filing.')}</aside>
        </div>
      </section>
      <section className="bg-muted/30 px-5 py-16"><div className="mx-auto max-w-6xl"><h2 className="mb-7 text-3xl font-bold">{t('ابدأ من طبيعة عملك', 'Start with the way you work')}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{industries.map(([slug, ar, en]) => <Link key={slug} to={`/solutions/${slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-6 font-semibold">{t(ar, en)}<ArrowUpRight className="h-5 w-5 shrink-0" /></Link>)}</div></div></section>
      <section className="px-5 py-16 text-center"><h2 className="text-3xl font-bold">{t('اختر ما يناسب عملك', 'Choose what fits your business')}</h2><p className="mt-4 text-muted-foreground">{t('راجع الأسعار وحدود الخطة، أو ناقش متطلبات الربط مع فريقنا.', 'Review pricing and plan limits, or discuss integration needs with our team.')}</p><div className="mt-7 flex justify-center gap-4"><Link to="/pricing" className="rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground">{t('الأسعار', 'Pricing')}</Link><Link to="/contact" className="rounded-full border border-border px-7 py-3 font-semibold">{t('تواصل معنا', 'Contact us')}</Link></div></section>
    </main>
    <SharedFooter />
  </div>;
}
