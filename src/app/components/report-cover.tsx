import type { ReportPayload, ReportPrintSettings } from '../lib/api';
import { reportAppearance, reportTheme } from '../lib/report-appearance';
import { reportPaperSize } from '../lib/report-pagination';
import { useLanguage } from './LanguageContext';
import '../../styles/report-book.css';

export function ReportCover({ report, settings, title, subtitle, kind = 'front', preparedBy = '' }: { report: ReportPayload; settings: ReportPrintSettings; title: string; subtitle?: string; kind?: 'front' | 'back' | 'divider'; preparedBy?: string }) {
  const { t, language } = useLanguage();
  const dir = (settings.language || language) === 'ar' ? 'rtl' : 'ltr';
  const org = report.org;
  const paperLogo = settings.logoSource === 'none' ? null : settings.logoSource === 'main' ? org.logoUrl : org.printLogoUrl || org.logoUrl;
  const formal = settings.colorMode === 'plain' || settings.coverStyle === 'formal';
  // Never frame a regular logo with white on dark: fall back to a light page.
  const light = formal || settings.coverStyle === 'light' || Boolean(paperLogo && !org.printLogoLightUrl);
  const logo = light ? paperLogo : settings.logoSource === 'none' ? null : org.printLogoLightUrl || paperLogo;
  const { width, height } = reportPaperSize(settings);
  const address = [org.addressLine, org.city, org.region, org.postalCode].filter(Boolean).join(' · ');
  const contacts = [org.email, org.phone, org.website].filter(Boolean);
  return <article data-cover-kind={kind} className={`report-book-cover report-output-sheet ${reportTheme(formal ? { ...settings, colorMode: 'plain' } : settings)}${light ? ' report-book-cover-light' : ''}`} dir={dir} style={{ ...reportAppearance(settings), width: `${width}mm`, height: `${height}mm` }}>
    <header dir="ltr">
      <div className="report-book-logo">{logo && <img src={logo} alt={org.name} />}</div>
      <div className="report-book-company" dir={dir}>
        <p className="report-book-company-name"><bdi>{org.legalName || org.name}</bdi></p>
        {settings.showCompanyInfo !== false && <>{address && <p><bdi>{address}</bdi></p>}{contacts.length > 0 && <p>{contacts.map((v, i) => <span key={i}>{i > 0 && ' · '}<bdi>{v}</bdi></span>)}</p>}</>}
        {settings.showTaxInfo !== false && (org.vatNumber || org.crNumber) && <p>
          {org.vatNumber && <span>{org.country === 'US' ? 'EIN' : t('الرقم الضريبي', 'Tax ID')}: <bdi>{org.vatNumber}</bdi></span>}
          {org.vatNumber && org.crNumber && ' · '}
          {org.crNumber && <span>{org.country === 'US' ? 'State Filing #' : t('السجل التجاري', 'Registration')}: <bdi>{org.crNumber}</bdi></span>}
        </p>}
      </div>
    </header>
    <main><p className="report-book-kicker">{kind === 'back' ? t('نهاية التقرير', 'END OF REPORT') : kind === 'divider' ? t('فصل', 'CHAPTER') : t('تقارير الإدارة', 'MANAGEMENT REPORTS')}</p><h1>{title}</h1>
      <p className="report-book-period"><bdi>{report.period.from ? `${report.period.from} — ${report.period.to}` : `${t('حتى', 'As of')} ${report.period.to}`}</bdi></p>
      {subtitle && <p>{subtitle}</p>}
    </main>
    <footer><div>{preparedBy && <p>{t('إعداد', 'Prepared by')}: {preparedBy}</p>}<p>{t('تاريخ التجهيز', 'Prepared on')}: <bdi>{report.generatedAt.slice(0, 10)}</bdi></p></div><span className="report-page-counter" /></footer>
  </article>;
}
