import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, type Contact } from '../lib/api';
import { humanizeError } from '../lib/error-messages';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SearchableCombobox } from './searchable-combobox';
import { StatusBadge } from './product';

type Candidate = {
  id: string; number: string; date: string; description: string; currency: string;
  branchId: string | null; projectId: string | null; subtotal: string; taxTotal: string; total: string;
  fingerprint: string; eligible: boolean;
  lines: { accountId: string; description: string; quantity: number; unitPrice: number }[];
};

/** Review existing ledger entries without creating or posting a second journal. */
export function JournalPurchaseIntake({ suppliers, onRegistered }: { suppliers: Contact[]; onRegistered: () => void }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const journalId = params.get('journalId') || undefined;
  const [items, setItems] = useState<Candidate[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [contactId, setContactId] = useState('');
  const [extraSuppliers, setExtraSuppliers] = useState<Contact[]>([]);
  const [supplierNumber, setSupplierNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [rates, setRates] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setSelected(null);
    try {
      const response = await api.bills.list({ includeJournalCandidates: '1', journalOffset: String(offset), journalId } as any) as any;
      setItems(response.journalCandidates?.items || []); setHasMore(response.journalCandidates?.hasMore || false);
    } catch (e) { setError(humanizeError(e, language)); }
    finally { setLoading(false); }
  }, [offset, journalId, language]);
  useEffect(() => { void load(); }, [load]);
  function review(item: Candidate) {
    setSelected(item); setContactId(''); setSupplierNumber(''); setDueDate(''); setConfirmed(false);
    setRates(item.lines.map(() => '')); setError(''); setDuplicateId(null);
  }
  async function register() {
    if (!selected || !contactId || !supplierNumber.trim() || !dueDate || !confirmed || rates.some(r => r === '' || !Number.isFinite(Number(r)) || Number(r) < 0 || Number(r) > 100)) return;
    setBusy(true); setError(''); setDuplicateId(null);
    try {
      const bill = await api.bills.create({
        sourceJournalId: selected.id, sourceJournalFingerprint: selected.fingerprint, confirmUnpaidPurchase: confirmed,
        contactId, supplierDocNumber: supplierNumber.trim(), issueDate: selected.date, dueDate,
        currency: selected.currency, exchangeRate: 1, status: 'DUE', branchId: selected.branchId, projectId: selected.projectId,
        lines: selected.lines.map((l, i) => ({ ...l, taxRate: Number(rates[i]) / 100, taxInclusive: false })),
      });
      onRegistered(); navigate(`/app/purchases/bills/${bill.id}`);
    } catch (e: any) { setError((language === 'ar' ? e.body?.messageAr : e.body?.message) || humanizeError(e, language)); if (e.body?.details?.id) setDuplicateId(e.body.details.id); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status" className="text-sm text-muted-foreground">{t('جارٍ فحص القيود غير المرتبطة…', 'Checking unlinked journals…')}</p>;
  if (!items.length && !error && !offset && !journalId) return null;
  return <section aria-label={t('قيود المشتريات غير المرتبطة', 'Unlinked purchase journals')} className="rounded-lg border border-border bg-card p-4 space-y-4 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1"><h2 className="text-section font-semibold">{t('قيود بانتظار استكمال فاتورة مشتريات', 'Journals awaiting purchase invoice details')}</h2>
        <p className="text-sm text-muted-foreground">{t('هذه قيود مرّحلة تؤثر في التقارير. أكمل بيانات الفاتورة لربطها بالمشتريات دون تكرار القيد أو المبلغ.', 'These posted journals already affect reports. Complete invoice details to link them to purchases without duplicating the journal or amount.')}</p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={load}>{t('تحديث القيود', 'Refresh journals')}</Button>
    </div>
    {error && <p role="alert" className="text-destructive text-sm">{error} {duplicateId && <Link className="underline" to={`/app/purchases/bills/${duplicateId}`}>{t('مراجعة الفاتورة الموجودة', 'Review existing invoice')}</Link>}</p>}
    {!selected ? <>
      {!items.length && <p className="text-sm">{t('لا يوجد قيد قابل للمراجعة هنا. قد يكون مرتبطًا بمستند، غير مرحّل، أو لا يحتوي حساب مشتريات أو أصل.', 'No journal to review here. It may already be linked, unposted, or have no purchase or asset account.')}</p>}
      <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1"><p className="text-sm font-medium break-words"><bdi>{item.number}</bdi> · {item.description}</p>
          <p className="text-xs text-muted-foreground"><bdi>{item.date.slice(0, 10)} · {item.currency} {Number(item.subtotal).toFixed(2)}</bdi> · {t('صافي البنود', 'Net lines')}</p>
          {!item.eligible && <p className="text-xs text-muted-foreground">{t('القيد النقدي أو المركب، أو حساب الموردين غير المعيّن، يحتاج مراجعة نوع المستند قبل الربط.', 'Cash or compound journals, or an unmapped payable account, require document-type review before linking.')}</p>}
        </div>
        <StatusBadge tone={item.eligible ? 'warning' : 'neutral'}>{item.eligible ? t('بانتظار بيانات الفاتورة', 'Awaiting invoice details') : t('يحتاج مراجعة', 'Needs review')}</StatusBadge>
        {item.eligible && <Button size="sm" variant="outline" onClick={() => review(item)}>{t('استكمال وربط الفاتورة', 'Complete and link invoice')}</Button>}
        <Link className="text-primary underline text-sm" to={`/app/journal-entries?entryId=${item.id}`}>{t('عرض القيد', 'View journal')}</Link>
      </li>)}</ul>
      <div className="flex flex-wrap gap-2">{offset > 0 && <Button variant="outline" size="sm" onClick={() => setOffset(Math.max(0, offset - 50))}>{t('الأحدث', 'Newer')}</Button>}{hasMore && <Button variant="outline" size="sm" onClick={() => setOffset(offset + 50)}>{t('الأقدم', 'Older')}</Button>}</div>
    </> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void register(); }}>
      <fieldset disabled={busy} className="space-y-4 min-w-0">
        <p className="text-sm font-medium"><bdi>{selected.number}</bdi> · <bdi>{selected.date.slice(0, 10)}</bdi> · {t('الإجمالي', 'Total')}: <bdi>{selected.currency} {Number(selected.total).toFixed(2)}</bdi></p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1"><p className="text-sm">{t('المورد', 'Supplier')}</p><SearchableCombobox value={contactId} onChange={setContactId} items={[...suppliers, ...extraSuppliers].map(c => ({id:c.id,label:c.displayName,sublabel:c.email || undefined}))}
            placeholder={t('ابحث أو أنشئ موردًا', 'Search or create a supplier')} createLabel={q=>t(`إنشاء مورد: ${q}`, `Create supplier: ${q}`)}
            onCreate={async name => { try { const c = await api.contacts.create({displayName:name,type:'SUPPLIER'}); setExtraSuppliers(prev=>[...prev,c]); return c.id; } catch(e) { setError(humanizeError(e,language)); throw e; } }} /></div>
          <label className="text-sm space-y-1 block">{t('رقم فاتورة المورد', 'Supplier invoice number')}<Input required value={supplierNumber} onChange={e=>setSupplierNumber(e.target.value)} /></label>
          <label className="text-sm space-y-1 block">{t('تاريخ الاستحقاق', 'Due date')}<Input required type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></label>
        </div>
        <p className="text-sm text-muted-foreground">{t('أدخل نسبة الضريبة لكل بند من الفاتورة الأصلية (صفر إذا لم توجد). يجب أن يطابق مجموع الضريبة القيد:', 'Enter each line’s tax percentage from the original invoice (zero if none). Total tax must match the journal:')} <bdi>{selected.currency} {Number(selected.taxTotal).toFixed(2)}</bdi></p>
        {selected.lines.map((line, i) => <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_140px] items-center gap-3 border-b border-border pb-3">
          <p className="text-sm break-words">{line.description}</p><bdi className="text-sm">{selected.currency} {line.unitPrice.toFixed(2)}</bdi>
          <label className="text-xs">{t(`الضريبة % — بند ${i+1}`, `Tax % — line ${i+1}`)}<Input type="number" required min="0" max="100" step="0.01" value={rates[i]} onChange={e=>setRates(prev=>prev.map((v,j)=>j===i?e.target.value:v))} /></label>
        </div>)}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />{t('راجعت المستند: هذه فاتورة مشتريات غير مسددة ولم تُسجّل كفاتورة أو مصروف آخر.', 'I reviewed the document: this is an unpaid purchase invoice not already recorded as another bill or expense.')}</label>
        <p className="text-xs text-muted-foreground">{t('يبقى القيد الأصلي ومرفقاته محفوظين. تسجّل الدفعات لاحقًا بسند صرف، وتُراجع بنود الأصول في قسم الأصول.', 'The original journal and its attachments remain available. Record later payments with payment vouchers; review asset lines in Assets.')}</p>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!contactId || !confirmed || busy}>{busy ? t('جارٍ الربط…', 'Linking…') : t('ربط بالقيد الموجود', 'Link to existing journal')}</Button><Button type="button" variant="outline" onClick={()=>{setSelected(null);setError('');}}>{t('إلغاء', 'Cancel')}</Button><Link className="self-center text-primary underline text-sm" to="/app/assets">{t('مراجعة الأصول', 'Review assets')}</Link></div>
      </fieldset>
    </form>}
  </section>;
}
