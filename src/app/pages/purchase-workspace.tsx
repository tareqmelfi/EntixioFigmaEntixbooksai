import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLanguage } from '../components/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageHeader, LedgerFigure } from '../components/product';
import { loadPurchaseWorkspace, type PurchaseRow } from '../lib/purchase-workspace';
import { humanizeError } from '../lib/error-messages';

export function PurchaseWorkspace() {
  const { t, language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [shown, setShown] = useState(50);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    loadPurchaseWorkspace().then(result => { if (active) setRows(result); })
      .catch(e => { if (active) setError(humanizeError(e, language)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, language]);
  const filters = [['ALL', t('الكل', 'All')], ['PAID', t('مدفوع', 'Paid')], ['UNPAID', t('غير مدفوع', 'Unpaid')], ['PARTIAL', t('جزئي', 'Partial')], ['DRAFT', t('مسودة', 'Draft')], ['CANCELLED', t('ملغى', 'Cancelled')], ['DUPLICATE', t('مكرر مرتبط', 'Linked duplicate')]];
  const status = params.get('status') || 'ALL', kind = params.get('kind') || 'ALL', query = params.get('q') || '', currency = params.get('currency') || '';
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setParams(next, { replace: true }); setShown(50); };
  const filtered = rows.filter(r => (status === 'ALL' || r.status === status) && (kind === 'ALL' || r.kind === kind) && (!currency || r.currency === currency) && `${r.number} ${r.reference} ${r.supplier}`.toLowerCase().includes(query.toLowerCase()));
  const totals = new Map<string, { total: number; remaining: number }>();
  filtered.filter(r => !['DRAFT', 'CANCELLED', 'DUPLICATE'].includes(r.status)).forEach(r => { const v = totals.get(r.currency) || { total: 0, remaining: 0 }; v.total += r.total; v.remaining += r.remaining; totals.set(r.currency, v); });
  return <div className="space-y-4">
    <PageHeader title={t('المشتريات والمصروفات', 'Purchases & expenses')} description={t('كل ما تشتريه في مكان واحد، مع حالة الدفع وحساب كل بند.', 'Everything you buy in one place, with payment status and an account for each line.')} actions={<Button asChild><Link to="/app/purchases/records/new">{t('تسجيل جديد', 'New purchase')}</Link></Button>} />
    <div className="flex flex-wrap gap-2" aria-label={t('حالة الدفع', 'Payment status')}>{filters.map(([key, label]) => <Button key={key} variant={status === key ? 'default' : 'outline'} size="sm" aria-pressed={status === key} onClick={() => change('status', key)}>{label}</Button>)}</div>
    <div className="flex flex-wrap items-center gap-3">
      <Input className="max-w-sm" aria-label={t('بحث في المشتريات والمصروفات', 'Search purchases and expenses')} placeholder={t('المورد أو رقم المستند…', 'Supplier or document number…')} value={query} onChange={e => change('q', e.target.value)} />
      <label className="text-sm">{t('النوع', 'Type')} <select className="rounded-md border border-border bg-transparent p-2" value={kind} onChange={e => change('kind', e.target.value)}><option value="ALL">{t('كل الأنواع', 'All types')}</option><option value="BILL">{t('فاتورة شراء', 'Purchase bill')}</option><option value="EXPENSE">{t('مصروف', 'Expense')}</option></select></label>
      <label className="text-sm">{t('العملة', 'Currency')} <select className="rounded-md border border-border bg-transparent p-2" value={currency} onChange={e => change('currency', e.target.value)}><option value="">{t('كل العملات', 'All currencies')}</option>{[...new Set(rows.map(r => r.currency))].sort().map(c => <option key={c}>{c}</option>)}</select></label>
      <Button size="sm" variant="ghost" onClick={() => setRevision(v => v + 1)}>{t('تحديث', 'Refresh')}</Button>
    </div>
    {loading ? <p role="status">{t('تحميل المشتريات والمصروفات…', 'Loading purchases and expenses…')}</p> : error ? <div role="alert" className="rounded-lg border border-border p-4"><p>{t('تعذر تحميل القائمة كاملة.', 'Could not load the complete list.')} {error}</p><Button variant="outline" onClick={() => setRevision(v => v + 1)}>{t('إعادة المحاولة', 'Retry')}</Button></div> : <>
      <div className="flex flex-wrap gap-6 border-y border-border py-3"><span>{filtered.length} {t('مستند', 'documents')}</span>{[...totals].map(([c, v]) => <div key={c} className="text-sm"><span>{t('الإجمالي المعتمد', 'Approved total')} · <LedgerFigure value={v.total} currency={c} /></span><span className="ms-4">{t('المتبقي', 'Remaining')} · <bdi>{v.remaining.toFixed(2)} {c}</bdi></span></div>)}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-start text-sm"><thead><tr className="border-b border-border">{[t('الرقم', 'Number'), t('المورد', 'Supplier'), t('التاريخ', 'Date'), t('النوع', 'Type'), t('الإجمالي', 'Total'), t('المتبقي', 'Remaining'), t('حالة الدفع', 'Payment status')].map(h => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead><tbody>{filtered.slice(0, shown).map(r => <tr key={`${r.kind}:${r.id}`} className="border-b border-border hover:bg-surface-hover"><td className="px-3 py-3"><Link className="text-primary underline" to={`${r.path}?returnTo=${encodeURIComponent('/app/purchases/records?' + params.toString())}`}><bdi>{r.number || r.reference || '—'}</bdi></Link></td><td className="px-3">{r.supplier || '—'}</td><td className="px-3"><bdi>{r.date}</bdi></td><td className="px-3">{r.kind === 'BILL' ? t('فاتورة شراء', 'Purchase bill') : t('مصروف', 'Expense')}</td><td className="px-3"><bdi>{r.total.toFixed(2)} {r.currency}</bdi></td><td className="px-3"><bdi>{['DRAFT', 'CANCELLED', 'DUPLICATE'].includes(r.status) ? '—' : `${r.remaining.toFixed(2)} ${r.currency}`}</bdi></td><td className="px-3">{filters.find(([key]) => key === r.status)?.[1]}</td></tr>)}</tbody></table></div>
      {filtered.length === 0 && <p className="py-8 text-center">{t('لا توجد مستندات تطابق الفلاتر.', 'No documents match these filters.')}</p>}
      {filtered.length > shown && <Button variant="outline" onClick={() => setShown(v => v + 50)}>{t('عرض المزيد', 'Show more')}</Button>}
    </>}
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('أدوات إضافية ومسودات سابقة', 'Additional tools and previous drafts')}</summary><div className="mt-2 flex flex-wrap gap-4"><Link className="underline" to="/app/expenses">{t('تعديل المصروفات جماعيًا واستعادة المسودات السابقة', 'Bulk expense editing and previous draft recovery')}</Link><Link className="underline" to="/app/purchases/bills">{t('مراجعة قيود الشراء السابقة', 'Review historical purchase journals')}</Link></div></details>
  </div>;
}
