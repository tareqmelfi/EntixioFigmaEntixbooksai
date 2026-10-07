import { ReportCover } from './report-cover';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Download, Loader2, Printer } from 'lucide-react';
import type { ReportPayload, ReportPrintSettings } from '../lib/api';
import { attachReportSocialFooter, applySocialFooterPages, downloadReportPdf, paginateReport, reportPaperSize } from '../lib/report-pagination';
import { reportLayoutSettings } from '../lib/report-layout';
import { waitForPrintReady } from '../lib/print-image';
import { ReportDocument } from './report-document';
import { Button } from './ui/button';
import { useLanguage } from './LanguageContext';

/** One output engine for all report types and the live designer. */
export function ReportOutput({ report, settings: requestedSettings, autoPrint = false }: { report: ReportPayload; settings: ReportPrintSettings; autoPrint?: boolean }) {
  const settings = useMemo(() => reportLayoutSettings(report, requestedSettings), [report, requestedSettings]);
  const { t, language, numberingSystem } = useLanguage();
  const source = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const autoPrinted = useRef(false);
  const { width, height } = reportPaperSize(settings);
  const pageStyle = `@page { size: ${width}mm ${height}mm; margin: 0; }
    @media print { html,body { width:${width}mm!important; margin:0!important; padding:0!important; height:auto!important; overflow:visible!important; background:white!important; }
    .report-output-pages { display:block!important; margin:0!important; padding:0!important; width:${width}mm!important; }
    .report-output-sheet { break-after:page!important; page-break-after:always!important; margin:0!important; box-shadow:none!important; border:0!important; }
    .report-output-sheet:last-child { break-after:auto!important; page-break-after:auto!important; }
    .report-output-sheet * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print,.report-measure-source { display:none!important; } }`;
  const print = useReactToPrint({ contentRef: pages, documentTitle: `Entix-${report.id}-${report.period.to}`, pageStyle,
    onPrintError: () => setError(t('تعذرت نافذة الطباعة. نزّل PDF ثم اطبعه من قارئ الملفات.', 'Printing is unavailable. Download the PDF and print it from your PDF reader.')) });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setCount(0); setError('');
    const prepare = async () => {
      if (!source.current) return;
      await waitForPrintReady(6000, source.current);
      if (cancelled || !source.current || !pages.current) return;
      try {
        const article = source.current.querySelector<HTMLElement>('.entix-report-paper');
        if (!article) throw new Error('report_content_missing');
        attachReportSocialFooter(article, report.org, settings.language || language);
        await paginateReport(article, pages.current, settings, controller.signal);
        if (cancelled || !pages.current) return;
        for (const kind of ['front', 'back']) {
          const cover = source.current.querySelector<HTMLElement>(`[data-cover-kind="${kind}"]`);
          if (cover) { const clone = cover.cloneNode(true) as HTMLElement; attachReportSocialFooter(clone, report.org, settings.language || language); if (kind === 'front') pages.current.prepend(clone); else pages.current.append(clone); }
        }
        const sheets = Array.from(pages.current.querySelectorAll<HTMLElement>('.report-output-sheet'));
        const total = sheets.length;
        sheets.forEach((sheet, index) => { sheet.dataset.pageNumber = String(index + 1); const counter = sheet.querySelector('.report-page-counter'); if (counter) counter.textContent = `${index + 1} / ${total}`; });
        applySocialFooterPages(sheets);
        if (!cancelled) setCount(total);
      } catch {
        if (cancelled || !pages.current) return;
        pages.current.replaceChildren();
        setError(t('تعذر توزيع أحد البنود على الورق. جرّب الاتجاه العرضي أو خطًا أصغر في مصمم الطباعة.', 'A report row could not fit on the paper. Try landscape or a smaller font in the print designer.'));
      }
    };
    void prepare();
    return () => { cancelled = true; controller.abort(); };
  }, [report, settings, language, numberingSystem]);

  useEffect(() => {
    if (autoPrint && count && !autoPrinted.current) { autoPrinted.current = true; print(); }
  }, [autoPrint, count, print]);

  const download = async () => {
    if (!pages.current || !count || busy) return;
    setBusy(true); setError(''); setProgress('');
    try { await downloadReportPdf(pages.current, settings, `Entix-${report.id}-${report.period.to}`, (page, total) => setProgress(`${page} / ${total}`)); }
    catch { setError(t('تعذر تجهيز PDF. حاول مجددًا أو استخدم زر الطباعة.', 'PDF generation failed. Try again or use Print.')); }
    finally { setBusy(false); }
  };

  return <div className="report-output">
    <style>{pageStyle}</style>
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground" role="status">{count ? t(`${count} صفحة · ${settings.paper || 'A4'}`, `${count} pages · ${settings.paper || 'A4'}`) : error ? t('تعذر تجهيز الصفحات', 'Unable to prepare pages') : t('جارٍ تجهيز الصفحات…', 'Preparing pages…')}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={!count || busy} onClick={() => print()}><Printer className="me-2 h-4 w-4" />{t('طباعة', 'Print')}</Button>
        <Button disabled={!count || busy} onClick={download} data-testid="report-download-pdf">{busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}{busy ? t(`تجهيز PDF… ${progress}`, `Preparing PDF… ${progress}`) : t('تحميل PDF', 'Download PDF')}</Button>
      </div>
    </div>
    {error && <p role="alert" className="no-print mb-4 text-sm text-danger">{error}</p>}
    {(requestedSettings.orientation === "auto" || !requestedSettings.orientation) && settings.orientation === "landscape" && <p className="no-print mb-3 text-xs text-muted-foreground">{t('اتجاه عرضي تلقائي لقراءة الأعمدة بوضوح.', 'Landscape applied automatically to keep columns readable.')}</p>}
    <div ref={source} className="report-measure-source" aria-hidden="true" style={{ width: `${width}mm` }}>{settings.showCover && <ReportCover report={report} settings={settings} title={(settings.language || language) === 'ar' ? report.title : report.englishTitle} preparedBy={settings.preparedBy} />}
      {settings.showBackCover && <ReportCover kind="back" report={report} settings={settings} title={report.org.legalName || report.org.name} />}
      <ReportDocument report={report} settings={settings} mode="print" /></div>
    <div className="report-output-scroll"><div ref={pages} className="report-output-pages" data-testid="report-output-pages" data-ready={count > 0} /></div>
  </div>;
}
