import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { FullPageForm } from './full-page-form';
import { ReportOutput } from './report-output';
import { normalizeReportSettings } from './report-document';
import { useLanguage } from './LanguageContext';
import { api, getOrgId, type Account, type JournalEntryRow, type Org } from '../lib/api';
import { assertJournalScope, downloadJournals, journalHeaders, journalMatrix, journalReport, loadAllJournals, readJournalFile, validateJournalImport, type JournalImport } from '../lib/journal-transfer';
import { humanizeError } from '../lib/error-messages';

export function JournalTransfer({ mode, status, selected, accounts, onClose }: { mode: 'print' | 'export' | 'import'; status?: 'POSTED' | 'DRAFT'; selected?: JournalEntryRow; accounts: Account[]; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [orgId] = useState(() => getOrgId());
  const [org, setOrg] = useState<Org>();
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [imports, setImports] = useState<JournalImport[]>([]);
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [progress, setProgress] = useState('');
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        if (!orgId) throw new Error('Select a company / اختر الشركة');
        assertJournalScope(orgId);
        const [company, rows] = await Promise.all([api.orgs.get(orgId), mode === 'import' ? Promise.resolve([]) : selected ? api.journals.get(selected.id).then(e => [e]) : loadAllJournals(orgId, status)]);
        assertJournalScope(orgId);
        if (alive.current) { setOrg(company); setEntries(rows); }
      } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (alive.current) setBusy(false); }
    })();
    return () => { alive.current = false; };
  }, []);
  const filtered = entries.filter(e => (!from || e.date.slice(0, 10) >= from) && (!to || e.date.slice(0, 10) <= to));
  const invalidRange = !!(from && to && from > to);
  async function run(action: () => Promise<void>) {
    if (lock.current || !orgId) return;
    lock.current = true; setBusy(true); setError('');
    try { assertJournalScope(orgId); await action(); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function read(file: File) {
    setImports([]);
    await run(async () => {
      const matrix = await readJournalFile(file); assertJournalScope(orgId!);
      const freshAccounts = await api.accounts.list(); assertJournalScope(orgId!);
      const preview = validateJournalImport(matrix, freshAccounts.items, orgId!);
      // An exported original is not a new manual journal; it must not be duplicated.
      for (const group of preview.filter(g => g.existingId && !g.error)) {
        assertJournalScope(orgId!);
        try { const existing = await api.journals.get(group.existingId!); assertJournalScope(orgId!); group.saved = existing.number; }
        catch { group.error = t('تعذر تأكيد القيد الأصلي؛ لن ينشأ بديل تلقائيًا.', 'Original entry could not be verified; no replacement will be created.'); }
      }
      assertJournalScope(orgId!); if (alive.current) setImports(preview);
    });
  }
  async function commit() {
    await run(async () => {
      const pending = imports.filter(g => !g.error && !g.saved);
      for (const [i, group] of pending.entries()) {
        if (!alive.current) break;
        assertJournalScope(orgId!); setProgress(`${i + 1} / ${pending.length}`);
        try {
          const saved = await api.journals.create(group.data); assertJournalScope(orgId!);
          group.saved = saved.number;
        } catch (e) {
          // Retain the exact import key for a safe retry after partial success or timeout.
          if (alive.current) setError(humanizeError(e, language, { ar: 'توقف الاستيراد. يمكنك إعادة المحاولة دون تكرار القيود المحفوظة.', en: 'Import stopped. Retry safely without duplicating saved entries.' }));
          break;
        }
        if (alive.current) setImports([...imports]);
      }
    });
  }
  const title = mode === 'import' ? t('استيراد قيود اليومية', 'Import journal entries') : mode === 'print' ? t('طباعة قيود اليومية', 'Print journal entries') : t('تصدير قيود اليومية', 'Export journal entries');
  const pending = imports.filter(g => !g.error && !g.saved).length;
  return <FullPageForm title={title} onClose={onClose} disableEscape={busy} footer={<div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={onClose}>{t('العودة للقيود', 'Back to journals')}</Button>{mode === 'import' && pending > 0 && <Button disabled={busy || imports.some(g => g.error)} onClick={commit}>{t(`استيراد ${pending} كمسودات`, `Import ${pending} as drafts`)}</Button>}</div>}>
    {error && <p role="alert" className="mb-4 text-danger">{error}</p>}
    {busy && <p role="status" className="mb-4 text-muted-foreground">{t('جارٍ التجهيز…', 'Preparing…')} {progress}</p>}
    {mode === 'import' ? <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('كل رمز EntryKey يمثل قيدًا متوازنًا. تُحفظ القيود كمسودات للمراجعة. إعادة الملف نفسه لا تكرر القيود؛ القيود الأصلية المصدّرة تُتجاوز. لا يشمل النقل المرفقات أو روابط المستندات.', 'Each EntryKey groups one balanced entry. Entries are saved as drafts for review. Repeating the file does not duplicate entries; exported originals are skipped. Attachments and source-document links are not transferred.')}</p>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || !org} onClick={() => run(() => downloadJournals([journalHeaders, ['IMPORT-001', new Date().toISOString().slice(0, 10), 'Example / مثال', '', accounts.find(a => a.isActive && a.allowPosting !== false)?.code || '11000', 100, 0], ['IMPORT-001', new Date().toISOString().slice(0, 10), 'Example / مثال', '', accounts.filter(a => a.isActive && a.allowPosting !== false)[1]?.code || '41000', 0, 100]], 'xlsx', 'Journal-import-template', orgId!))}>{t('تحميل نموذج Excel', 'Download Excel template')}</Button><label className="text-sm">{t('اختر XLSX أو CSV', 'Choose XLSX or CSV')}<input data-testid="journal-import-file" type="file" accept=".csv,.xlsx" disabled={busy || !org} className="block mt-2" onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} /></label></div>
      {!!imports.length && <><p role="status" className="text-sm">{t(`${imports.length} قيد · ${imports.filter(g => g.saved).length} محفوظ أو موجود · ${imports.filter(g => g.error).length} يحتاج تصحيحًا`, `${imports.length} entries · ${imports.filter(g => g.saved).length} saved or existing · ${imports.filter(g => g.error).length} need correction`)}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t('الرمز', 'Key')}</th><th>{t('التاريخ', 'Date')}</th><th>{t('الوصف', 'Description')}</th><th>{t('النتيجة', 'Result')}</th></tr></thead><tbody>{imports.map(g => <tr key={g.key} className="border-b border-border"><td className="p-2"><bdi>{g.key}</bdi></td><td className="p-2 whitespace-nowrap">{g.data.date}</td><td className="p-2">{g.data.description}</td><td className={`p-2 ${g.error ? 'text-danger' : ''}`}>{g.error || (g.saved ? `${t('محفوظ / موجود', 'Saved / existing')}: ${g.saved}` : t('جاهز كمسودة', 'Ready as draft'))}</td></tr>)}</tbody></table></div></>}
    </div> : org && <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm">{t('من', 'From')}<input aria-label="From" type="date" className="block rounded border border-border bg-card p-2" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm">{t('إلى', 'To')}<input aria-label="To" type="date" className="block rounded border border-border bg-card p-2" value={to} onChange={e => setTo(e.target.value)} /></label><span className="text-sm">{selected ? selected.number : status === 'POSTED' ? t('المرحّلة', 'Posted') : status === 'DRAFT' ? t('المسودات', 'Drafts') : t('جميع الحالات', 'All statuses')} · {filtered.length} {t('قيد', 'entries')}</span>
      {(['xlsx', 'csv'] as const).map(format => <Button key={format} variant="outline" disabled={busy || invalidRange || !filtered.length} onClick={() => run(() => downloadJournals(journalMatrix(filtered, orgId!), format, `Entix-journals-${new Date().toISOString().slice(0, 10)}`, orgId!))}>{format === 'xlsx' ? t('تحميل Excel', 'Download Excel') : t('تصدير CSV', 'Export CSV')}</Button>)}</div>
      {invalidRange ? <p role="alert" className="text-danger">{t('تاريخ البداية بعد النهاية', 'Start date is after end date')}</p> : mode === 'print' && !busy ? <ReportOutput report={journalReport(filtered, org, language, accounts)} settings={{ ...normalizeReportSettings(org.paymentSettings?.reports), language, orientation: 'landscape', template: 'condensed' }} /> : <p className="text-sm text-muted-foreground">{t('يشمل الملف جميع سطور القيود ضمن النطاق المختار، وليس الجزء المحمّل من القائمة فقط.', 'Includes all journal lines in the selected scope, not only the loaded part of the list.')}</p>}
    </div>}
  </FullPageForm>;
}
