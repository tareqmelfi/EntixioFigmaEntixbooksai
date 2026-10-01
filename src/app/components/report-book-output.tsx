import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { ReportPayload, ReportPrintSettings } from '../lib/api';
import { attachReportSocialFooter, applySocialFooterPages, paginateReport, reportPaperSize, downloadReportPdf } from '../lib/report-pagination';
import { reportLayoutSettings } from '../lib/report-layout';
import { readTabOrgId } from '../lib/tab-org-selection';
import { waitForPrintReady } from '../lib/print-image';
import { ReportDocument } from './report-document';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import '../../styles/report-book.css';

export function ReportBookOutput({ reports, title, preparedBy, notes }: { reports: ReportPayload[]; title: string; preparedBy: string; notes: string }) {
  const { t, language, numberingSystem } = useLanguage();
  const source = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = reports[0];
  const paperLogo = first.org.printLogoUrl || first.org.logoUrl;
  const coverLogo = first.org.printLogoLightUrl || paperLogo;
  // Use the actual reverse artwork on dark grounds. Without it, lighten the
  // whole cover rather than putting the regular mark inside a white badge.
  const lightCover = Boolean(paperLogo && !first.org.printLogoLightUrl);
  const companyAddress = [first.org.addressLine, first.org.city, first.org.region, first.org.postalCode].filter(Boolean).join(' · ');
  const companyContact = [first.org.email, first.org.phone, first.org.website].filter(Boolean);
  const [orientation, setOrientation] = useState<NonNullable<ReportPrintSettings['orientation']>>('auto');
  const settings: ReportPrintSettings = useMemo(() => ({
    template: 'condensed', paper: first.org.paymentSettings?.reports?.paper || 'A4',
    orientation: orientation !== 'auto' ? orientation : reports.some(report => reportLayoutSettings<ReportPrintSettings>(report, { showNotes: true }).orientation === 'landscape') ? 'landscape' : 'portrait',
    language, bilingual: false, showNotes: true, density: 'standard', fontScale: 'normal',
    primaryColor: '#102d50', accentColor: '#008da6', showCompanyInfo: true, showFooter: true,
  }), [reports, language, orientation]);
  const { width, height } = reportPaperSize(settings);
  const heading = (report: ReportPayload) => language === 'en' ? report.englishTitle : report.title;
  const availability = (report: ReportPayload) => report.status === 'unavailable' || report.dataBasis?.status === 'unavailable'
    ? t('البيانات غير متاحة', 'Data unavailable') : report.status === 'empty' || report.dataBasis?.status === 'no_activity'
      ? t('لا توجد حركة للفترة', 'No activity in period') : t('بحسب البيانات المسجلة', 'Based on recorded data');
  const income = reports.find(report => report.id === 'income-statement' && report.status === 'live' && report.dataBasis?.status !== 'unavailable');
  const highlights = income?.sections.find(section => section.id === 'income-summary')?.rows.filter(row =>
    ['revenue', 'expenses', 'net-income'].includes(row.id) && typeof row.values.amount === 'number' && Number.isFinite(row.values.amount)) || [];
  const intro: ReportPayload = {
    ...first, id: 'book-contents', title: 'الفهرس ونطاق التقرير', englishTitle: 'Contents and report scope', summary: {}, notices: [],
    sections: [{ id: 'contents', title: 'فصول الملف␟Report chapters',
      columns: [{ key: 'label', label: 'التقرير␟Report' }, { key: 'basis', label: 'نطاق البيانات␟Data scope' }, { key: 'page', label: 'الصفحة␟Page', kind: 'number', align: 'end' }],
      rows: reports.map((report, i) => ({ id: report.id, label: heading(report), values: { label: `${String(i + 1).padStart(2, '0')} · ${heading(report)}`, basis: availability(report), page: '—' } })),
    }, ...(highlights.length ? [{ id: 'executive-summary', title: 'الملخص المالي␟Financial snapshot', description: 'المصدر: قائمة الدخل للفترة المختارة␟Source: income statement for the selected period',
      columns: [{ key: 'label', label: 'المؤشر␟Metric' }, { key: 'amount', label: 'القيمة␟Amount', kind: 'money' as const, align: 'end' as const }], rows: highlights,
    }] : []), { id: 'scope', title: 'عن هذا الملف␟About this report', columns: [{ key: 'label', label: 'النطاق والمنهجية␟Scope and method' }],
      rows: [{ id: 'scope', label: '', values: { label: t('تجميع للتقارير المختارة بجميع صفوفها كما أعادتها المنصة وقت التجهيز. نطاق التاريخ وطريقة الاحتساب والتنبيهات موضّحة في كل فصل. البيانات غير المتاحة لا تعني رصيدًا صفريًا.', 'This book includes every row returned by the selected reports at preparation time. Each chapter retains its dates, calculation basis and notices. Unavailable data does not mean a zero balance.') } }],
    }, ...(notes ? [{ id: 'commentary', title: 'ملاحظات معدّ التقرير␟Author commentary', description: preparedBy || undefined,
      columns: [{ key: 'label', label: 'التحليل والتوصيات المدخلة يدويًا␟Manually authored analysis and recommendations' }],
      rows: notes.split(/\n/).filter(line => line.trim()).flatMap((line, index) => {
        // Bound individual rows so long commentary can continue across physical pages.
        const parts = line.match(/[\s\S]{1,450}(?:\s|$)|[\s\S]{1,450}/g) || [line];
        return parts.map((part, partIndex) => ({ id: `note-${index}-${partIndex}`, label: '', values: { label: part } }));
      }),
    }] : [])],
  };
  const pageStyle = `@page { size:${width}mm ${height}mm; margin:0; }
    @media print { html,body { margin:0!important;padding:0!important; height:auto!important;overflow:visible!important; }
    .report-output-pages { display:block!important;margin:0!important;width:${width}mm!important; }
    .report-output-sheet { break-after:page!important;page-break-after:always!important;margin:0!important;border:0!important;box-shadow:none!important; }
    .report-output-sheet:last-child { break-after:auto!important;page-break-after:auto!important; }
    .report-output-sheet * { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }`;
  const print = useReactToPrint({ contentRef: pages, documentTitle: title, pageStyle,
    onBeforePrint: async () => { if (readTabOrgId() !== first.org.id) throw new Error('scope_changed'); },
    onPrintError: () => setError(t('تعذرت الطباعة. تحقق من الشركة المختارة وأعد تجهيز الملف.', 'Printing failed. Check the selected company and prepare the book again.')) });

  useEffect(() => {
    let cancelled = false;
    setCount(0); setError('');
    void (async () => {
      if (!source.current) return;
      await waitForPrintReady(6000, source.current);
      if (cancelled || !source.current || !pages.current) return;
      const target = pages.current;
      try {
        target.replaceChildren();
        const cover = source.current.querySelector('.report-book-cover')!.cloneNode(true) as HTMLElement;
        attachReportSocialFooter(cover, first.org, language);
        target.append(cover);
        const articles = source.current.querySelectorAll<HTMLElement>('.entix-report-paper');
        const buckets = Array.from(articles, original => {
          const article = original.cloneNode(true) as HTMLElement;
          article.classList.add('report-book-page');
          const footerTitle = article.querySelector(':scope > footer > span');
          if (footerTitle) footerTitle.textContent = `${title} · ${first.org.name}`;
          const bucket = document.createElement('div'); target.append(bucket);
          attachReportSocialFooter(article, first.org, language);
          paginateReport(article, bucket, settings);
          return bucket;
        });
        const introPages = buckets[0].childElementCount;
        let offset = 2 + introPages;
        // Contents row count is bounded by the five selectable chapters.
        const contentsRows = buckets[0].querySelectorAll('table:first-of-type tbody tr');
        reports.forEach((_, index) => {
          const row = contentsRows[index];
          row.lastElementChild!.textContent = String(offset);
          offset += buckets[index + 1].childElementCount;
        });
        for (const bucket of buckets) { bucket.replaceWith(...Array.from(bucket.children)); }
        const sheets = target.querySelectorAll<HTMLElement>('.report-output-sheet');
        sheets.forEach((sheet, index) => {
          sheet.dataset.pageNumber = String(index + 1);
          const counter = sheet.querySelector('.report-page-counter');
          if (counter) counter.textContent = `${index + 1} / ${sheets.length}`;
        });
        applySocialFooterPages(Array.from(sheets));
        setCount(sheets.length);
      } catch {
        target.replaceChildren();
        setError(t('تعذر توزيع المحتوى على الصفحات. اختصر الفقرة الطويلة أو جرّب عددًا أقل من الفصول.', 'The content could not fit the pages. Shorten long commentary or try fewer chapters.'));
      }
    })();
    return () => { cancelled = true; };
  }, [reports, settings, title, preparedBy, notes, language, numberingSystem]);

  async function download() {
    if (!pages.current || !count || busy) return;
    if (readTabOrgId() !== first.org.id) { setError(t('تغيّرت الشركة. أعد تجهيز الملف.', 'Company changed. Prepare the book again.')); return; }
    setBusy(true); setError('');
    try { await downloadReportPdf(pages.current, settings, `${title}-${first.period.to}`); }
    catch { setError(t('تعذر تحميل PDF. أعد المحاولة أو استخدم الطباعة.', 'PDF download failed. Retry or use Print.')); }
    finally { setBusy(false); }
  }

  return <div>
    <style>{pageStyle}</style>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{count ? t(`${count} صفحة · ${reports.length} فصول · ${settings.paper}`, `${count} pages · ${reports.length} chapters · ${settings.paper}`) : t('تجهيز الصفحات…', 'Preparing pages…')}</p><div className="flex gap-2"><label className="flex items-center gap-2 text-sm">{t("الاتجاه", "Orientation")}<select aria-label={t("الاتجاه", "Orientation")} value={orientation} onChange={event=>setOrientation(event.target.value as typeof orientation)} className="rounded-md border border-border bg-card px-2"><option value="auto">{t("تلقائي حسب التقرير", "Automatic for report")}</option><option value="portrait">{t("طولي", "Portrait")}</option><option value="landscape">{t("عرضي", "Landscape")}</option></select></label><Button variant="outline" disabled={!count || busy} onClick={() => print()}>{t('طباعة', 'Print')}</Button><Button data-testid="book-download" disabled={!count || busy} onClick={download}>{busy ? t('تجهيز PDF…', 'Preparing PDF…') : t('تحميل ملف PDF', 'Download PDF book')}</Button></div></div>
    {error && <p role="alert" className="mb-4 text-danger">{error}</p>}
    <div ref={source} className="report-measure-source" aria-hidden="true" style={{ width: `${width}mm` }}>
      <article className={`report-book-cover report-output-sheet${lightCover ? ' report-book-cover-light' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ width: `${width}mm`, height: `${height}mm` }}>
        <header dir="ltr">
          <div className="report-book-logo">{coverLogo && <img src={coverLogo} alt={first.org.name} />}</div>
          <div className="report-book-company" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <p className="report-book-company-name"><bdi>{first.org.legalName || first.org.name}</bdi></p>
            {companyAddress && <p><bdi>{companyAddress}</bdi></p>}
            {companyContact.length > 0 && <p>{companyContact.map((value, index) => <span key={index}>{index > 0 && ' · '}<bdi>{value}</bdi></span>)}</p>}
            {(first.org.vatNumber || first.org.crNumber) && <p>
              {first.org.vatNumber && <span>{first.org.country === 'US' ? 'EIN' : t('الرقم الضريبي', 'Tax ID')}: <bdi>{first.org.vatNumber}</bdi></span>}
              {first.org.vatNumber && first.org.crNumber && ' · '}
              {first.org.crNumber && <span>{first.org.country === 'US' ? 'State Filing #' : t('السجل التجاري', 'Registration')}: <bdi>{first.org.crNumber}</bdi></span>}
            </p>}
          </div>
        </header>
        <main><p className="report-book-kicker">{t('تقارير الإدارة', 'MANAGEMENT REPORTS')}</p><h1>{title}</h1><p className="report-book-period">{first.period.from ? <bdi>{first.period.from} — {first.period.to}</bdi> : <>{t('حتى', 'As of')} <bdi>{first.period.to}</bdi></>}</p><p>{t(`${reports.length} فصول · الجداول المالية والتفاصيل`, `${reports.length} chapters · Financial statements and detail`)}</p></main>
        <footer><div>{preparedBy && <p>{t('إعداد', 'Prepared by')}: {preparedBy}</p>}<p>{t('تاريخ التجهيز', 'Prepared on')}: <bdi>{first.generatedAt.slice(0, 10)}</bdi></p></div><span>Entix Books · entix.io</span></footer>
      </article>
      <ReportDocument report={intro} settings={settings} mode="print" />
      {reports.map((report, index) => <ReportDocument key={report.id} report={{ ...report,
        title: `${String(index + 1).padStart(2, '0')} · ${report.title}`, englishTitle: `${String(index + 1).padStart(2, '0')} · ${report.englishTitle}`,
        notices: report.status === 'live' && report.dataBasis?.status !== 'unavailable' && report.dataBasis?.status !== 'no_activity'
          ? report.notices : [...(report.notices || []), availability(report)],
      }} settings={settings} mode="print" />)}
    </div>
    <div className="report-output-scroll"><div className="report-output-pages" data-testid="report-book-pages" data-ready={count > 0} ref={pages} /></div>
  </div>;
}
