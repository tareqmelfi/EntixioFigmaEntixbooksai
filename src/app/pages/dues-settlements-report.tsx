import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, type ReportPayload } from '../lib/api';
import { useLanguage } from '../components/LanguageContext';
import { PageHeader, InlineAlert } from '../components/product';
import { Button } from '../components/ui/button';
import { ReportDataTable } from '../components/report-data-table';
import { exportReportCsv } from '../lib/report-export';
import { reportLabel } from '../lib/report-months';

const views = ['all', 'receivable', 'payable', 'settled-sales', 'settled-purchases', 'settled-expenses'] as const;
export function DuesSettlementsReport() {
  const { t, language } = useLanguage(), navigate = useNavigate();
  const [query, setQuery] = useSearchParams();
  const view = views.includes(query.get('view') as typeof views[number]) ? query.get('view') || 'all' : 'all';
  const currency = query.get('currency') || '';
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true, busy = false;
    async function refresh() {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const data = await api.reports.get('dues-settlements', { bilingual: 1 });
        if (alive) { setReport(data); setError(''); }
      } catch { if (alive) setError(t('تعذر تحديث المستحقات. أعد المحاولة؛ لم نعرض أرصدة قديمة على أنها محدثة.', 'Could not refresh balances. Retry; stale balances are not displayed as current.')); }
      finally { busy = false; if (alive) setLoading(false); }
    }
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [version, language]);
  const labels = [t('الكل', 'All'), t('مستحق لي', 'Due to us'), t('مستحق عليّ', 'Due by us'), t('مبيعات مسددة', 'Settled sales'), t('مشتريات مسددة', 'Settled purchases'), t('مصروفات مدفوعة', 'Paid expenses')];
  const currencies = useMemo(() => [...new Set(report?.sections.flatMap(s => s.rows.map(r => String(r.values.currency || ''))).filter(Boolean))].sort(), [report]);
  const visible = useMemo(() => report ? { ...report, sections: report.sections.filter(s => view === 'all' || s.id === view || s.id === 'settlement-summary').map(s => ({ ...s, rows: s.rows.filter(r => (!currency || r.values.currency === currency) && (s.id !== 'settlement-summary' || view === 'all' || r.id.startsWith(`${view}-`))) })) } : null, [report, view, currency]);
  const choose = (key: string, value: string) => { const next = new URLSearchParams(query); if (value) next.set(key, value); else next.delete(key); setQuery(next, { replace: true }); };
  return <div className="space-y-3" data-testid="dues-settlements">
    <PageHeader title={t('المستحقات والتحصيل والسداد', 'Dues and Settlements')} eyebrow={<Link to="/app/reports">{t('التقارير', 'Reports')}</Link>} actions={<>
      <Button variant="outline" onClick={() => { setLoading(true); setVersion(v => v + 1); }}>{t('تحديث', 'Refresh')}</Button>
      <Button variant="outline" disabled={!visible || loading || !!error} onClick={() => visible && exportReportCsv(visible, language)}>CSV</Button>
      <Button variant="outline" disabled={!report || loading || !!error} onClick={() => navigate(`/print/report/dues-settlements?orgId=${encodeURIComponent(report!.org.id)}&allTime=1`)}>{t('طباعة التقرير الكامل', 'Print full report')}</Button>
    </>} />
    <p className="text-xs text-content-secondary">{t('تتحدث تلقائيًا بعد السداد أو إلغاء التسوية. تشمل كل السنوات؛ التصنيف الأصلي للبنود لا يتغير.', 'Updates automatically after payment or settlement reversal. Includes all years; original line classification is preserved.')}</p>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('تصفية المستحقات', 'Filter balances')}>
      {views.map((key, index) => <button key={key} type="button" aria-pressed={view === key} onClick={() => choose('view', key)} className="rounded-full border border-border/60 px-3 py-1 text-xs aria-pressed:bg-foreground aria-pressed:text-background">{labels[index]}</button>)}
      <select aria-label={t('العملة', 'Currency')} value={currency} onChange={e => choose('currency', e.target.value)} className="rounded border border-border bg-card px-2 py-1 text-xs"><option value="">{t('كل العملات · منفصلة', 'All currencies · separate')}</option>{currencies.map(c => <option key={c}>{c}</option>)}</select>
    </div>
    {error && <InlineAlert tone="critical">{error}</InlineAlert>}
    {loading ? <p role="status">{t('جاري تحميل المستحقات…', 'Loading balances…')}</p> : !error && visible && <>
      <p className="text-xs text-content-secondary" role="status">{t('آخر تحديث', 'Last updated')}: <bdi>{new Date(visible.generatedAt).toLocaleString(language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US')}</bdi> · {reportLabel(visible.description, language)}</p>
      <ReportDataTable report={visible} onRowClick={row => { if (row.link) navigate(row.link.href); }} />
    </>}
  </div>;
}
