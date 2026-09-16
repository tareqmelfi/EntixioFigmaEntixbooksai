import { ApiError } from '../lib/api';
import type { HistoricalAccess } from './historical-reports-access';
import { useEffect, useMemo, useRef, useState } from 'react';
import { displayDigits, displayLocale } from '../lib/number-display';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Metric, MetricStrip, PageHeader } from './product';
import { HISTORICAL_MAX_BYTES, HISTORICAL_METRICS, historicalBalanceDifference, parseHistoricalStatements, type HistoricalMetric, type HistoricalMetricKey, type HistoricalOrg, type HistoricalStatements as StatementFile } from '../lib/historical-statements';

export function HistoricalStatements({ org, onClose, access }: { org: HistoricalOrg; onClose: () => void; access?: HistoricalAccess }) {
  const { t } = useLanguage();
  const [sourceFile, setFile] = useState<StatementFile | null>(null);
  // A presentation copy normalizes notes, labels and references; source bytes remain unchanged.
  const file = useMemo<StatementFile | null>(() => sourceFile ? {
    ...sourceFile,
    revision: displayDigits(sourceFile.revision), purpose: displayDigits(sourceFile.purpose),
    entity: { ...sourceFile.entity, name: displayDigits(sourceFile.entity.name) },
    source: { ...sourceFile.source, fileName: displayDigits(sourceFile.source.fileName), auditor: displayDigits(sourceFile.source.auditor), opinion: displayDigits(sourceFile.source.opinion), note: displayDigits(sourceFile.source.note) },
    warnings: sourceFile.warnings.map(warning => displayDigits(warning)),
    periods: sourceFile.periods.map(period => ({ ...period, label: displayDigits(period.label), comparabilityNote: displayDigits(period.comparabilityNote), metrics: Object.fromEntries(HISTORICAL_METRICS.map(key => [key, { ...period.metrics[key], printedPage: period.metrics[key].printedPage === null ? null : displayDigits(period.metrics[key].printedPage!) }])) as typeof period.metrics })),
  } : null, [sourceFile]);
  const [periodId, setPeriodId] = useState('');
  const [pastedData, setPastedData] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [draft, setDraft] = useState(false);
  const localDraft = useRef(false);
  const rawPayload = useRef<StatementFile | null>(null);
  const selectLatest = (next: StatementFile) => {
    const latest = [...next.periods].filter(p => Object.values(p.metrics).some(m => m.value !== null)).sort((a, b) => b.endDate.localeCompare(a.endDate))[0] || next.periods[0];
    setFile(next); setPeriodId(latest.id);
  };
  const request = useRef(0);
  useEffect(() => { request.current++; setFile(null); setPastedData(''); setPasteOpen(false); setPeriodId(''); setError(''); setSavedNotice(''); setSaving(false); localDraft.current = false; rawPayload.current = null; setDraft(false); return () => { request.current++; }; }, [org.id, org.crNumber, org.country, org.baseCurrency]);
  useEffect(() => {
    if (access?.record && !localDraft.current) {
      selectLatest(parseHistoricalStatements(JSON.stringify(access.record.payload), org));
      rawPayload.current = access.record.payload;
    }
  }, [access?.record, org.id]);
  async function saveFile() {
    if (!access || !rawPayload.current || saving) return;
    const current = request.current;
    setSaving(true); setError(''); setSavedNotice('');
    try {
      const result = await access.save(rawPayload.current);
      if (current !== request.current) return;
      localDraft.current = false; setDraft(false);
      selectLatest(parseHistoricalStatements(JSON.stringify(result.report.payload), org));
      rawPayload.current = result.report.payload;
      setSavedNotice(result.duplicate ? t('هذه النسخة محفوظة بالفعل؛ يُعرض أحدث مرجع للشركة.', 'This version is already saved; the latest company reference is shown.') : t('حُفظت نسخة جديدة للشركة دون تغيير الدفاتر.', 'A new company version was saved without changing the ledger.'));
    } catch (e) {
      if (current !== request.current) return;
      setError(e instanceof ApiError && e.status === 409 ? t('تغيّرت النسخة المحفوظة. حدّث المرجع وراجع النسخة الجديدة قبل إعادة الحفظ.', 'The saved version changed. Refresh the reference and review it before saving again.') : e instanceof ApiError && e.status === 422 ? t('رفض الخادم البيانات أو مطابقة الشركة. لم يُحفظ الملف؛ راجع المراجع والقيم والهوية.', 'The server rejected the data or company identity. The file was not saved; review references, values and identity.') : t('تعذر حفظ القوائم للشركة. لم يُؤكد الحفظ؛ تحقق من الصلاحية وإتاحة الخدمة ثم أعد المحاولة.', 'Company statements could not be saved. Saving was not confirmed; check permissions and service availability before retrying.'));
    } finally { if (current === request.current) setSaving(false); }
  }
  const labels: Record<HistoricalMetricKey, string> = {
    revenue: t('الإيرادات', 'Revenue'), grossProfit: t('مجمل الربح', 'Gross profit'), netProfit: t('صافي الربح / الخسارة', 'Net profit / loss'), cash: t('النقد وما في حكمه', 'Cash and equivalents'), totalAssets: t('إجمالي الأصول', 'Total assets'), totalLiabilities: t('إجمالي الالتزامات', 'Total liabilities'), totalEquity: t('إجمالي حقوق الملكية', 'Total equity'), operatingCashFlow: t('التدفق النقدي التشغيلي', 'Operating cash flow'), investingCashFlow: t('التدفق النقدي الاستثماري', 'Investing cash flow'), financingCashFlow: t('التدفق النقدي التمويلي', 'Financing cash flow'),
  };
  const amount = (m: HistoricalMetric) => m.value === null ? t('غير متوفر', 'Unavailable') : m.value.toLocaleString(displayLocale('en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const status = (m: HistoricalMetric) => m.status === 'verified' ? t('موثق في الملف', 'Verified in file') : m.status === 'needs_review' ? t('يحتاج مراجعة', 'Needs review') : t('غير متوفر', 'Unavailable');
  const reference = (m: HistoricalMetric) => [m.pdfPage ? `PDF ${m.pdfPage}` : '', m.printedPage ? `${t('صفحة', 'Page')} ${m.printedPage}` : ''].filter(Boolean).join(' · ') || '—';
  const selected = file?.periods.find(p => p.id === periodId) || file?.periods[0];
  async function loadFile(selectedFile?: File) {
    if (!selectedFile || saving) return;
    const current = ++request.current;
    setFile(null); setError(''); setSavedNotice(''); localDraft.current = true; setDraft(true); rawPayload.current = null;
    try {
      if (selectedFile.size > HISTORICAL_MAX_BYTES) throw new Error('FILE_TOO_LARGE');
      const raw = await selectedFile.text();
      if (current !== request.current) return;
      const next = parseHistoricalStatements(raw, org);
      rawPayload.current = JSON.parse(raw) as StatementFile;
      selectLatest(next);
    } catch (e) {
      if (current !== request.current) return;
      setError(e instanceof Error && e.message === 'ENTITY_MISMATCH'
        ? t('الملف لا يطابق سجل الشركة الحالية وبلدها وعملتها، أو أن سجلها غير مسجل في النظام.', 'The file does not match this company’s registry, country and currency, or its registry is missing.')
        : t('تعذر قراءة الملف. يلزم JSON بالإصدار المعتمد، لا يتجاوز 1 ميجابايت، بقيم وتواريخ ومراجع صحيحة.', 'Cannot read this file. Use the supported JSON version, at most 1 MB, with valid amounts, dates and references.'));
    }
  }
  return <div className="space-y-5" data-testid="historical-statements">
    <PageHeader title={t('القوائم التاريخية', 'Historical statements')} description={t('عرض تاريخي من ملف — لا يغيّر الدفاتر', 'Historical file view — does not change the ledger')} actions={<Button variant="outline" onClick={onClose}>{t('العودة إلى لوحة الدفاتر', 'Return to ledger dashboard')}</Button>} />
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">{access ? t('اختيار الملف يعرض معاينة فقط. زر الحفظ يحفظ نسخة تاريخية للشركة؛ تبقى النسخ السابقة محفوظة ولا تتغير الدفاتر. الأرقام بوحدات العملة كاملة.', 'Selecting a file only previews it. Save stores a company historical version, retaining earlier versions without changing the ledger. Amounts use whole currency units.') : t('يُقرأ الملف داخل هذا التبويب فقط، ولا يُرفع أو يُحفظ في النظام. يزول العرض عند إغلاقه أو تبديل الشركة. الأرقام بوحدات العملة كاملة.', 'The file is read only in this tab. It is not uploaded or saved in the system. Closing this view or switching company clears it. Amounts use whole currency units.')}</p>
      {access && <>
        <p className="text-sm text-muted-foreground">{access.loading ? t('جارٍ تحميل المرجع المحفوظ...', 'Loading saved reference...') : access.record ? `${t('النسخة المحفوظة', 'Saved version')}: ${access.record.version}` : access.error ? '' : t('لا توجد نسخة محفوظة بعد.', 'No saved version yet.')}</p>
        {access.error && <p role="alert" className="text-sm text-warning">{t('خدمة القوائم المحفوظة غير متاحة الآن. يمكنك معاينة ملف محلي، لكن الحفظ غير متاح.', 'Saved statements are unavailable. You can preview a local file, but saving is unavailable.')}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={access.loading || saving} onClick={() => { localDraft.current = false; rawPayload.current = null; setFile(null); setDraft(false); setError(''); setSavedNotice(''); void access.refresh(); }}>{t('تحديث المرجع المحفوظ', 'Refresh saved reference')}</Button>
          {access.canSave && <Button disabled={!sourceFile || !draft || saving || access.loading || access.error || sourceFile.scope !== 'unconsolidated'} onClick={() => void saveFile()}>{saving ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ القوائم للشركة', 'Save statements for company')}</Button>}
        </div>
        {sourceFile?.scope === 'consolidated' && <p className="text-sm text-warning">{t('هذا المسار يحفظ القوائم غير الموحدة فقط؛ القوائم الموحدة متاحة للمعاينة المحلية.', 'This workflow saves unconsolidated statements only; consolidated statements can be previewed locally.')}</p>}
        {!access.canSave && <p className="text-xs text-muted-foreground">{t('حفظ النسخ متاح للمالك أو المسؤول بصلاحية مؤكدة.', 'Saving versions requires a verified owner or administrator role.')}</p>}
      </>}
      <label className="block text-sm font-medium">{t('اختيار ملف القوائم التاريخية JSON', 'Choose historical statements JSON')}<input type="file" disabled={saving} accept=".json,application/json" className="mt-2 block max-w-full text-sm" onChange={e => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <div className="text-sm">
        <button type="button" aria-expanded={pasteOpen} className="cursor-pointer text-xs text-muted-foreground" onClick={() => setPasteOpen(open => !open)}>{t('لصق بيانات القوائم', 'Paste statement data')}</button>
        {pasteOpen && <>
        <label className="mt-3 block text-xs">{t('بيانات القوائم JSON', 'Statement JSON data')}<textarea aria-label={t('بيانات القوائم JSON', 'Statement JSON data')} value={pastedData} onChange={event => setPastedData(event.target.value)} disabled={saving} className="mt-2 block min-h-28 w-full rounded border border-border bg-background p-2 font-mono text-xs" dir="ltr" /></label>
        <Button size="sm" variant="outline" className="mt-2" disabled={saving || !pastedData.trim()} onClick={() => { void loadFile(new File([pastedData], 'historical-statements.json', { type: 'application/json' })); }}>{t('معاينة البيانات الملصقة', 'Preview pasted data')}</Button>
        </>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {savedNotice && <p role="status" className="text-sm text-success">{savedNotice}</p>}
    </CardContent></Card>
    {file && selected && <>
      <Card><CardContent className="p-4 space-y-2 text-sm">
        <h2 className="font-semibold">{file.entity.name} · {file.entity.crNumber} · {file.entity.currency} · {file.revision}</h2>
        <p>{t('النطاق', 'Scope')}: {file.scope === 'unconsolidated' ? t('غير موحدة', 'Unconsolidated') : t('موحدة', 'Consolidated')} · {t('الغرض', 'Purpose')}: {file.purpose === 'zakat' ? t('الزكاة', 'Zakat') : file.purpose}</p>
        <p className="break-words">{t('المصدر', 'Source')}: <bdi>{file.source.fileName}</bdi> · {file.source.auditor} · {file.source.reportDate}</p>
        <p>{t('رأي المراجع حسب الملف', 'Auditor opinion per file')}: {file.source.opinion === 'unmodified' ? t('غير معدل', 'Unmodified') : file.source.opinion}</p>
        <p>{file.source.note}</p>
        <p className="break-all text-xs text-muted-foreground" dir="ltr">SHA-256: {file.source.sha256}</p>
        <p className="text-xs text-muted-foreground">{t('حالة التوثيق وبصمة المصدر من بيانات الملف؛ لم تُجرَ مطابقة آلية مع نسخة PDF في هذا العرض.', 'Verification status and source hash are supplied by the file; this view does not automatically compare them to a PDF.')}</p>
        {file.warnings.map((warning, i) => <p key={i} className="text-warning">{warning}</p>)}
      </CardContent></Card>
      <label className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center">{t('الفترة', 'Period')}<select className="w-full min-w-0 max-w-full rounded border border-border bg-card p-2 sm:w-auto" value={selected.id} onChange={e => setPeriodId(e.target.value)}>{file.periods.map(p => <option key={p.id} value={p.id}>{p.label} · {p.startDate} — {p.endDate}</option>)}</select></label>
      <p className="text-sm text-muted-foreground">{selected.comparabilityNote}</p>
      <MetricStrip className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">{(['revenue', 'netProfit', 'cash', 'totalAssets'] as const).map(key => {
        const m = selected.metrics[key];
        return <Metric key={key} label={labels[key]} value={m.status === 'verified' ? amount(m) : m.status === 'needs_review' ? t('يحتاج مراجعة', 'Needs review') : t('غير متوفر', 'Unavailable')} hint={`${file.entity.currency} · ${reference(m)} · ${status(m)}`} />;
      })}</MetricStrip>
      {[selected].map(p => {
        const difference = historicalBalanceDifference(p);
        return <section key={p.id} className="space-y-2">
          <h2 className="font-semibold">{p.label} · <bdi>{p.startDate} — {p.endDate}</bdi></h2>
          {p.comparabilityNote && <p className="text-sm text-muted-foreground">{p.comparabilityNote}</p>}
          {difference !== null && Math.abs(difference) > 0.01 && <p role="alert" className="text-warning text-sm">{t('فرق معادلة الميزانية — يحتاج مراجعة', 'Balance sheet difference — needs review')}: {difference.toLocaleString(displayLocale('en-US'))} {file.entity.currency}</p>}
          <div className="overflow-x-auto rounded border border-border"><table className="w-full min-w-[600px] text-sm"><thead className="bg-muted"><tr>{[t('البند', 'Metric'), t('القيمة', 'Amount'), t('الحالة', 'Status'), t('مرجع المصدر', 'Source reference')].map(label => <th key={label} className="px-3 py-2 text-start">{label}</th>)}</tr></thead><tbody>{HISTORICAL_METRICS.map(key => {
            const m = p.metrics[key];
            return <tr key={key} className="border-t border-border"><td className="px-3 py-2">{labels[key]}</td><td className="px-3 py-2 tabular-nums"><bdi>{amount(m)}</bdi></td><td className={`px-3 py-2 ${m.status === 'needs_review' ? 'text-warning' : 'text-muted-foreground'}`}>{status(m)}</td><td className="px-3 py-2"><bdi>{reference(m)}</bdi></td></tr>;
          })}</tbody></table></div>
        </section>;
      })}
      <section className="space-y-2">
        <h2 className="font-semibold">{t('مقارنة الفترات حسب المصدر', 'Period comparison from source')}</h2>
        <p className="text-sm text-muted-foreground">{t('تُعرض المدد الفعلية دون احتساب نسب نمو بين فترات متفاوتة الطول.', 'Actual date ranges are shown without growth rates across unequal periods.')}</p>
        <div className="overflow-x-auto rounded border border-border"><table className="w-full min-w-[860px] text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2 text-start">{t('الفترة', 'Period')}</th>{(['revenue', 'netProfit', 'cash', 'totalAssets'] as const).map(key => <th key={key} className="px-3 py-2 text-start">{labels[key]}</th>)}</tr></thead><tbody>{file.periods.map(p => <tr key={p.id} className="border-t border-border"><td className="px-3 py-3"><b>{p.label}</b><div className="text-xs"><bdi>{p.startDate} — {p.endDate}</bdi></div><p className="text-xs text-muted-foreground max-w-[280px]">{p.comparabilityNote}</p></td>{(['revenue', 'netProfit', 'cash', 'totalAssets'] as const).map(key => <td key={key} className="px-3 py-3"><bdi className="tabular-nums">{amount(p.metrics[key])}</bdi><div className={`text-xs ${p.metrics[key].status === 'needs_review' ? 'text-warning' : 'text-muted-foreground'}`}>{status(p.metrics[key])} · {reference(p.metrics[key])}</div></td>)}</tr>)}</tbody></table></div>
      </section>
    </>}
  </div>;
}
