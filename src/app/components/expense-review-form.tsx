import { useEffect, useState } from 'react';
import { getOrgId, type Expense } from '../lib/api';
import { loadExpenseReviews, saveExpenseReview, type ReviewExpense } from '../lib/expense-review';
import { humanizeError } from '../lib/error-messages';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SearchableCombobox } from './searchable-combobox';

type Result = { id: string; number: string; error?: string };
export function ExpenseReviewForm({ ids, accounts, onSaved, onClose }: {
  ids: string[]; accounts: Array<{ id: string; type: string; code: string; name: string; nameAr?: string; isActive?: boolean; allowPosting?: boolean }>;
  onSaved: (expense: Expense) => void; onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const [records, setRecords] = useState<ReviewExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [scope] = useState(getOrgId);
  useEffect(() => {
    let active = true;
    loadExpenseReviews(ids, seconds => { if (active) setWaiting(seconds); }).then(rows => {
      if (!active) return;
      setRecords(rows as ReviewExpense[]);
      if (rows.length === 1) { setCategory(rows[0].category); setNotes(rows[0].notes || ''); }
    }).catch(e => { if (active) setError(humanizeError(e, language)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ids.join('|')]);
  const save = async () => {
    setBusy(true); setError('');
    for (const record of records) {
      if (results.some(r => r.id === record.id && !r.error)) continue;
      if (getOrgId() !== scope) { setError(t('تغيرت الشركة؛ افتح المراجعة من جديد.', 'Company changed; reopen the review.')); break; }
      try {
        const saved = await saveExpenseReview(record.id, { expectedUpdatedAt: record.updatedAt,
          ...(accountId ? { accountId } : {}), ...(category.trim() ? { category: category.trim() } : {}),
          ...(records.length === 1 ? { notes } : {}), reason: reason.trim() }, setWaiting);
        onSaved(saved);
        setResults(previous => [...previous.filter(r => r.id !== record.id), { id: record.id, number: record.number }]);
      } catch (e) {
        setResults(previous => [...previous.filter(r => r.id !== record.id), { id: record.id, number: record.number, error: humanizeError(e, language) }]);
      }
    }
    setBusy(false);
  };
  return <section aria-label={t('تعديل الحساب والتصنيف', 'Edit account and category')} className="space-y-3 rounded-lg border border-primary/30 bg-card p-4">
    <h2 className="font-semibold">{t('تعديل الحساب والتصنيف', 'Edit account and category')} · {ids.length}</h2>
    <p className="text-xs text-content-secondary">{t('الحساب المختار يطبق على جميع بنود المصروف. للمعتمد يُسجل قيد تصحيح متوازن مع بقاء مبلغ الدفع والضريبة والحالة. المسودة تبقى مسودة.', 'The selected account applies to every expense item. Posted records receive a balanced correction; payment, tax and status stay intact. Drafts stay drafts.')}</p>
    {loading ? <p role="status">{t('تحميل السجلات للمراجعة…', 'Loading records for review…')}</p> : <>
      <div className="max-h-28 overflow-auto text-xs font-code" dir="ltr">{records.map(r => <div key={r.id}>{r.number}</div>)}</div>
      <fieldset disabled={busy || results.length > 0} className="space-y-3"><label className="block space-y-1 text-sm"><span>{t('الحساب الجديد (اختياري)', 'New account (optional)')}</span>
        <SearchableCombobox value={accountId} onChange={setAccountId} items={accounts.filter(a => a.type === 'EXPENSE' && a.isActive !== false && a.allowPosting !== false).map(a => ({ id: a.id, label: `${a.code} · ${language === 'ar' ? a.nameAr || a.name : a.name}` }))} placeholder={t('إبقاء الحساب الحالي', 'Keep current account')} />
      </label>
      <label className="block space-y-1 text-sm"><span>{t('التصنيف الجديد (اختياري)', 'New category (optional)')}</span><Input value={category} onChange={e => setCategory(e.target.value)} /></label>
      {records.length === 1 && <label className="block space-y-1 text-sm"><span>{t('ملاحظات', 'Notes')}</span><textarea className="w-full rounded-md border border-border p-2" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>}
      <label className="block space-y-1 text-sm"><span>{t('سبب التعديل', 'Reason for change')}</span><Input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label></fieldset>
    </>}
    {waiting > 0 && <p role="status" className="text-sm text-content-secondary">{t("مهلة مؤقتة من الخادم؛ تستكمل العملية تلقائيًا خلال", "Server rate limit; automatically resuming within")} {waiting} {t("ثانية", "seconds")}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {results.length > 0 && <ul aria-live="polite" className="space-y-1 text-sm">{results.map(r => <li key={r.id} className={r.error ? 'text-danger' : 'text-success'}><bdi>{r.number}</bdi>: {r.error || t('تم الحفظ', 'Saved')}</li>)}</ul>}
    <div className="flex gap-2"><Button disabled={busy || loading || records.length !== ids.length || reason.trim().length < 3 || (records.length > 1 && !accountId && !category.trim()) || results.length > 0} onClick={save}>{busy ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ التعديل', 'Save changes')}</Button><Button variant="outline" disabled={busy} onClick={onClose}>{t('إغلاق', 'Close')}</Button></div>
  </section>;
}
