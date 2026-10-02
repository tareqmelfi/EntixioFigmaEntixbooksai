import { compareReport, type ComparisonMode } from '../lib/report-comparison';
import { ReportComparisonSelect } from '../components/report-comparison-select';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type ReportPayload } from '../lib/api';
import { readTabOrgId } from '../lib/tab-org-selection';
import { useLanguage } from '../components/LanguageContext';
import { Button } from '../components/ui/button';
import { DateInput } from '../components/date-input';
import { PageHeader } from '../components/product';
import { ReportBookOutput } from '../components/report-book-output';

const chapters = [
  ['income-statement', 'قائمة الدخل', 'Income statement'],
  ['balance-sheet', 'المركز المالي', 'Balance sheet'],
  ['cash-flow', 'التدفقات النقدية', 'Cash flow'],
  ['trial-balance', 'ميزان المراجعة', 'Trial balance'],
  ['project-profitability', 'ربحية المشاريع', 'Project profitability'],
] as const;

export function ManagementReportBook() {
  const { t, language } = useLanguage();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string[]>(chapters.slice(0, 4).map(c => c[0]));
  const [title, setTitle] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [comparison, setComparison] = useState<ComparisonMode>('previous_year');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [edition, setEdition] = useState<{ reports: ReportPayload[]; title: string; preparedBy: string; notes: string } | null>(null);
  const request = useRef(0);
  const invalidate = () => { request.current++; setEdition(null); setError(''); setBusy(false); };

  async function build() {
    const scope = readTabOrgId();
    const revision = ++request.current;
    setEdition(null); setError('');
    if (!scope || !from || !to || from > to || !selected.length) {
      setError(t('اختر الشركة والفترة الصحيحة وتقريرًا واحدًا على الأقل.', 'Select a company, a valid period and at least one report.'));
      return;
    }
    setBusy(true);
    try {
      const reports = await Promise.all(chapters.filter(c => selected.includes(c[0])).map(async ([id]) => {
        const report = await api.reports.get(id, { from, to, bilingual: 1 }, scope);
        if (report.org.id !== scope || report.id !== id) throw new Error('scope_mismatch');
        return compareReport(report, comparison, period => api.reports.get(id, { ...period, bilingual: 1 }, scope));
      }));
      if (revision !== request.current) return;
      if (readTabOrgId() !== scope) throw new Error('scope_changed');
      setEdition({ reports, title: title.trim() || t('التقرير المالي للإدارة', 'Management financial report'), preparedBy: preparedBy.trim(), notes: notes.trim() });
    } catch {
      if (revision === request.current) setError(t('تعذر تجهيز الملف كاملًا. تحقق من الشركة والاتصال ثم أعد المحاولة؛ لم يُصدّر ملف ناقص.', 'The complete report could not be prepared. Check the company and connection, then retry. No partial file was exported.'));
    } finally { if (revision === request.current) setBusy(false); }
  }

  return <div className="space-y-5">
    <PageHeader eyebrow={<Link to="/app/reports">{t('التقارير', 'Reports')}</Link>} title={t('ملف تقارير الإدارة', 'Management report book')}
      description={t('غلاف وفهرس وملاحظات تحليلية، ثم الجداول كاملة في ملف PDF واحد بهوية شركتك.', 'A company-branded PDF with a cover, contents, commentary and complete report tables.')} />
    <form className="rounded-xl border border-border bg-card p-5 space-y-4" onSubmit={e => { e.preventDefault(); void build(); }}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">{t('عنوان الملف', 'Report title')}<input className="w-full rounded-lg border border-border bg-background p-2" maxLength={120} value={title} placeholder={t('التقرير المالي للإدارة', 'Management financial report')} onChange={e => { invalidate(); setTitle(e.target.value); }} /></label>
        <label className="space-y-1 text-sm">{t('إعداد', 'Prepared by')}<input className="w-full rounded-lg border border-border bg-background p-2" maxLength={100} value={preparedBy} onChange={e => { invalidate(); setPreparedBy(e.target.value); }} /></label>
        <label className="space-y-1 text-sm">{t('من تاريخ', 'From date')}<DateInput value={from} onChange={value => { invalidate(); setFrom(value); }} /></label>
        <label className="space-y-1 text-sm">{t('إلى تاريخ', 'To date')}<DateInput value={to} onChange={value => { invalidate(); setTo(value); }} /></label>
      </div>
      <ReportComparisonSelect value={comparison} onChange={value => { invalidate(); setComparison(value); }} />
      <fieldset><legend className="mb-2 text-sm font-semibold">{t('فصول الملف', 'Report chapters')}</legend><div className="flex flex-wrap gap-x-6 gap-y-3">{chapters.map(([id, ar, en]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(id)} onChange={e => { invalidate(); setSelected(old => e.target.checked ? [...old, id] : old.filter(x => x !== id)); }} />{t(ar, en)}</label>)}</div></fieldset>
      <label className="block space-y-1 text-sm">{t('ملاحظات معدّ التقرير والتحليل (اختياري)', 'Author commentary and analysis (optional)')}
        <textarea rows={3} maxLength={6000} className="block w-full rounded-lg border border-border bg-background p-3" value={notes} onChange={e => { invalidate(); setNotes(e.target.value); }} placeholder={t('اكتب تفسير النتائج والتوصيات. ستظهر باسم ملاحظات معدّ التقرير.', 'Add your interpretation and recommendations. These are identified as author commentary.')} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{t('تُقرأ البيانات عند التجهيز. تبقى التقارير المنفردة متاحة في مركز التقارير.', 'Data is read when you prepare the book. Individual reports remain available in the reports center.')}</p><Button disabled={busy || !selected.length} type="submit">{busy ? t('جارٍ التجهيز…', 'Preparing…') : t('تجهيز الملف والمعاينة', 'Prepare report book')}</Button></div>
    </form>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {edition && <ReportBookOutput key={language} {...edition} />}
  </div>;
}
