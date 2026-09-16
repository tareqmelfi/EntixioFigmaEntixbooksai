import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, getOrgId, type HistoricalReportRecord } from '../lib/api';
import { parseHistoricalStatements, type HistoricalOrg, type HistoricalStatements } from '../lib/historical-statements';
import { displayDigits, displayLocale } from '../lib/number-display';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export function useHistoricalReports(org: HistoricalOrg | null) {
  const [record, setRecord] = useState<HistoricalReportRecord | null>(null);
  const [recordOrgId, setRecordOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [permissionOrgId, setPermissionOrgId] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);
  const generation = useRef(0);
  const orgRef = useRef(org); orgRef.current = org;
  const readRecord = (candidate: HistoricalReportRecord | null, entity: HistoricalOrg) => {
    if (candidate) {
      if (!candidate.id || !Number.isInteger(candidate.version) || candidate.scope !== 'unconsolidated') throw new Error('INVALID_RECORD');
      parseHistoricalStatements(JSON.stringify(candidate.payload), entity);
    }
    return candidate;
  };
  const refresh = useCallback(async () => {
    const entity = orgRef.current;
    if (!entity) return;
    const current = ++generation.current;
    setLoading(true); setError(false); setRecord(null); setRecordOrgId(null); setCanSave(false); setPermissionOrgId(null);
    try {
      const result = await api.historicalReports.latest();
      if (current !== generation.current) return;
      setRecord(readRecord(result.report, entity)); setRecordOrgId(entity.id);
    } catch {
      if (current === generation.current) setError(true);
    } finally {
      if (current === generation.current) setLoading(false);
    }
    try {
      const me = await api.me();
      if (current !== generation.current) return;
      const membership = (me.memberships || []).find((m: { org: { id: string }; role: string }) => m.org.id === entity.id);
      setCanSave(membership?.role === 'OWNER' || membership?.role === 'ADMIN'); setPermissionOrgId(entity.id);
    } catch { /* Unknown membership remains read-only; API remains the authority. */ }
  }, []);
  useEffect(() => {
    void refresh();
    return () => { generation.current++; };
  }, [org?.id, org?.crNumber, org?.country, org?.baseCurrency, refresh]);
  const visibleRecord = recordOrgId === org?.id ? record : null;
  async function save(payload: HistoricalStatements) {
    const entity = orgRef.current;
    if (!entity || !canSave || permissionOrgId !== entity.id || loading || error || getOrgId() !== entity.id) throw new Error('SAVE_UNAVAILABLE');
    if (payload.scope !== 'unconsolidated') throw new Error('SCOPE_UNAVAILABLE');
    const current = generation.current;
    const expectedId = visibleRecord?.id || null;
    const latest = readRecord((await api.historicalReports.latest()).report, entity);
    if (current !== generation.current || getOrgId() !== entity.id) throw new Error('COMPANY_CHANGED');
    if ((latest?.id || null) !== expectedId) throw new ApiError(409, 'historical_version_conflict');
    const saved = await api.historicalReports.create(payload, latest?.id);
    if (current !== generation.current || getOrgId() !== entity.id) throw new Error('COMPANY_CHANGED');
    // Deduplication may return an older immutable version. Never move the latest card backwards.
    const latestSaved = saved.duplicate ? readRecord((await api.historicalReports.latest()).report, entity) || saved.report : saved.report;
    if (current !== generation.current || getOrgId() !== entity.id) throw new Error('COMPANY_CHANGED');
    setRecord(readRecord(latestSaved, entity)); setRecordOrgId(entity.id);
    return { ...saved, report: latestSaved };
  }
  return { record: visibleRecord, loading, error, canSave: canSave && permissionOrgId === org?.id, refresh, save };
}
export type HistoricalAccess = ReturnType<typeof useHistoricalReports>;
export function HistoricalReportSummary({ access, onOpen }: { access: HistoricalAccess; onOpen: () => void }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const labels = { revenue: t('الإيرادات', 'Revenue'), netProfit: t('صافي الربح / الخسارة', 'Net profit / loss'), cash: t('النقد وما في حكمه', 'Cash and equivalents'), totalAssets: t('إجمالي الأصول', 'Total assets') };
  const latest = access.record?.payload.periods.filter(p => Object.values(p.metrics).some(m => m.value !== null)).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  return <Card className="bg-transparent"><CardContent className="px-4 py-3 space-y-2" data-testid="historical-summary">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t('مرجع القوائم المالية السابقة', 'Prior financial statements reference')}{latest ? ` — ${displayDigits(latest.endDate.slice(0,4))}` : ''}</h2><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?t('إخفاء الملخص','Hide summary'):t('توسيع الملخص','Expand summary')}</Button><Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={onOpen}>{t('عرض القوائم التاريخية', 'View historical statements')}</Button></div></div>
    {expanded && latest && !access.loading && !access.error && <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{(['revenue','netProfit','cash','totalAssets'] as const).map(key => {
      const metric = latest.metrics[key];
      const verified = metric.status === 'verified' && metric.value !== null;
      return <div key={key} className="min-w-0 border-s border-border ps-3"><dt className="text-xs text-muted-foreground">{labels[key]}</dt><dd className="mt-1 text-base font-semibold tabular-nums"><bdi>{verified ? metric.value!.toLocaleString(displayLocale('en-US'), {minimumFractionDigits:2,maximumFractionDigits:2}) : metric.value === null ? t('غير متوفر', 'Unavailable') : t('يحتاج مراجعة', 'Needs review')}</bdi></dd><p className="text-xs text-muted-foreground">{access.record!.payload.entity.currency} · {verified ? t('موثق في الملف', 'Verified in file') : metric.value === null ? t('غير متوفر', 'Unavailable') : t('يحتاج مراجعة', 'Needs review')}{metric.pdfPage ? ` · PDF ${metric.pdfPage}` : ''}</p></div>;
    })}</dl>}
    {access.loading ? <p className="text-sm text-muted-foreground">{t('جارٍ تحميل المرجع المحفوظ...', 'Loading saved reference...')}</p> : access.error ? <div role="alert" className="text-sm text-warning">{t('تعذر تحميل القوائم التاريخية المحفوظة. قد تكون الخدمة غير متاحة؛ هذه الحالة لا تعني أن الأرصدة صفر.', 'Saved historical statements could not be loaded. The service may be unavailable; this does not mean balances are zero.')} <button className="underline" onClick={() => void access.refresh()}>{t('إعادة المحاولة', 'Retry')}</button></div> : latest ? expanded ? <><p className="text-xs">{displayDigits(latest.label)} · <bdi>{latest.startDate} — {latest.endDate}</bdi></p><p className="text-sm text-muted-foreground">{t('قوائم غير موحدة، مرجع تاريخي محفوظ منفصل عن مؤشرات الفترة الحالية.', 'Unconsolidated statements, a saved historical reference separate from current-period indicators.')} {access.record?.payload.purpose === 'zakat' && t('الغرض: الزكاة.', 'Purpose: Zakat.')}</p></> : <p className="text-xs text-muted-foreground">{t('مرجع تاريخي مستقل عن أرصدة الفترة الحالية.', 'Historical reference, separate from current-period balances.')}</p> : <p className="text-sm text-muted-foreground">{t('لم تُحفظ قوائم تاريخية لهذه الشركة بعد.', 'No historical statements have been saved for this company yet.')}</p>}
  </CardContent></Card>;
}
