import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, getOrgId, type Contact } from '../lib/api';
import { useLanguage } from '../components/LanguageContext';
import { useOrgRegion } from '../lib/use-org-region';
import { FullPageForm } from '../components/full-page-form';
import { useFormDraft } from '../lib/form-draft';
import { ItemsTable, newLine, computeTotals, normalizeTaxRate, type InvoiceLine, type ProductOption, type TaxMode } from '../components/items-table';
import { SearchableCombobox } from '../components/searchable-combobox';
import { DocumentDropZone } from '../components/document-dropzone';
import { BranchField } from '../components/branch-field';
import { ProjectField } from '../components/project-field';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DateInput } from '../components/date-input';
import { displayName } from '../lib/display-name';
import { normalizeDigits } from '../lib/digits';
import { settlePurchase } from '../lib/purchase-settlement';
import { humanizeError } from '../lib/error-messages';
import { getSimilarityReview, buildDuplicateDecision, type SimilarityReview } from '../lib/similarity-review';
import { SimilarityReviewDialog } from '../components/similarity-review-dialog';
import { PurchaseProductCreate } from '../components/purchase-product-create';
import { usePurchaseDraftFiles } from '../lib/purchase-draft-files';

export function PurchaseEntry() {
  const { t, language } = useLanguage();
  const region = useOrgRegion();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scope] = useState(getOrgId);
  const [form, setForm] = useState({ paid: params.get('paid') === '1', contactId: params.get('contactId') || '',
    date: new Date().toISOString().slice(0, 10), dueDate: '', reference: '', currency: '', exchangeRate: '', sourceFileHash: '', extractedSupplier: '',
    method: 'CASH', bankId: '', actualPaidAmount: '', notes: '', branchId: null as string | null, projectId: null as string | null });
  const [lines, setLines] = useState<InvoiceLine[]>([newLine(0)]);
  const [taxMode, setTaxMode] = useState<TaxMode>('all-exclusive');
  const fileDraft = usePurchaseDraftFiles(scope);
  const { files, setFiles } = fileDraft;
  const taxInitialized = useRef(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productRequest, setProductRequest] = useState<{ query: string; resolve: (p: ProductOption) => void; reject: () => void } | null>(null);
  const productOption = (p: any): ProductOption => ({ id: p.id, name: displayName(p, language), sku: p.sku,
    unitPrice: Number(p.costPrice ?? p.buyPrice ?? p.unitPrice ?? 0),
    taxRate: normalizeTaxRate(p.taxRate, region.isSA ? .15 : 0).rate, accountId: p.expenseAccountId });
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ review: SimilarityReview; payload: any; paid: boolean } | null>(null);
  const draft = useFormDraft({ key: 'purchase:unified:new', open: true,
    snapshot: { form, lines, taxMode }, restore: s => { setForm(s.form); setLines(s.lines); setTaxMode(s.taxMode); } });
  useEffect(() => {
    if (region.loading || taxInitialized.current) return;
    taxInitialized.current = true;
    setLines(current => current.map(l => !l.description && !Number(l.unitPrice) ? { ...l, taxRate: region.isSA ? .15 : 0 } : l));
  }, [region.loading, region.isSA]);
  useEffect(() => { if (region.currency) setForm(f => f.currency ? f : { ...f, currency: region.currency }); }, [region.currency]);
  useEffect(() => {
    let active = true; setLoading(true); setLoadError('');
    const suppliers = async () => {
      const items: Contact[] = [];
      for (let page = 1; ; page++) {
        if (!active || scope !== getOrgId()) throw new Error('Company changed');
        const next = await api.contacts.list({ page, limit: 200 });
        const known = new Set(items.map(c => c.id));
        const fresh = next.items.filter(c => !known.has(c.id));
        items.push(...fresh);
        if (items.length >= next.total) return { items };
        if (!fresh.length) throw new Error('Supplier list incomplete');
      }
    };
    Promise.all([suppliers(), api.accounts.list(), api.products.list(), api.bankAccounts.list()]).then(([c, a, p, b]) => {
      if (!active || scope !== getOrgId()) return;
      setContacts(c.items); setAccounts(a.items); setProducts(p.items); setBanks(b.items);
    }).catch(e => { if (active) setLoadError(humanizeError(e, language)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, language, scope]);
  const close = () => { if (!productRequest) navigate('/app/purchases/records'); };
  const totals = computeTotals(lines.filter(l => l.description.trim()));
  const bank = banks.find(b => b.id === form.bankId);
  const paymentCurrency = bank?.currency || form.currency;
  const foreignPayment = paymentCurrency !== form.currency;
  const needsRate = form.currency !== region.currency && (!form.paid || paymentCurrency !== region.currency);
  const settlement = settlePurchase({ sourceCurrency: form.currency, baseCurrency: region.currency, actualPaidCurrency: paymentCurrency,
    sourceTotal: totals.total, actualPaidAmount: foreignPayment ? Number(normalizeDigits(form.actualPaidAmount)) : totals.total,
    exchangeRate: Number(normalizeDigits(form.exchangeRate)), treatment: 'MERGE_INTO_EXPENSE' });
  const submitPayload = async (payload: any, paid: boolean) => {
    if (getOrgId() !== scope) throw new Error(t('تغيرت الشركة؛ افتح النموذج من جديد.', 'Company changed; reopen the form.'));
    const saved = paid ? await api.expenses.create(payload) : await api.bills.create(payload);
    const next = getSimilarityReview(saved);
    if (next) { setReview({ review: next, payload, paid }); return; }
    if (!saved?.id) throw new Error(t('لم يؤكد الخادم حفظ المستند.', 'The server did not confirm a saved document.'));
    draft.clear(); fileDraft.clear(); navigate('/app/purchases/records');
  };
  const save = async (asDraft: boolean) => {
    if (saving.current) return;
    setError('');
    const valid = lines.filter(l => l.description.trim());
    if (lines.some(l => !l.description.trim() && Number(normalizeDigits(l.unitPrice)) !== 0) || !valid.length || totals.total <= 0 || valid.some(l => Number(normalizeDigits(l.quantity)) <= 0 || Number(normalizeDigits(l.unitPrice)) < 0)) { setError(t('أدخل وصفًا وكمية وسعرًا صحيحًا للبنود.', 'Enter a description, quantity and price for each line.')); return; }
    if (!form.paid && !form.contactId) { setError(t('اختر المورد للمبلغ المستحق.', 'Select the supplier for the payable.')); return; }
    if (!form.date || (!form.paid && !form.dueDate)) { setError(t('حدد تاريخ المستند والاستحقاق عند الدفع لاحقًا.', 'Set the document date and the due date when paying later.')); return; }
    if (needsRate && !asDraft && !(Number(normalizeDigits(form.exchangeRate)) > 0)) { setError(t('أدخل سعر التحويل إلى عملة الشركة.', 'Enter the rate to company currency.')); return; }
    if (form.paid && foreignPayment && !(Number(normalizeDigits(form.actualPaidAmount)) > 0)) { setError(t('أدخل المبلغ المسحوب فعليًا بعملة الدفع.', 'Enter the actual amount charged in the payment currency.')); return; }
    const supplier = contacts.find(c => c.id === form.contactId);
    const common = { contactId: form.contactId || null, currency: form.currency, notes: form.notes || null,
      branchId: form.branchId, projectId: form.projectId, attachments: files, sourceFileHash: form.sourceFileHash || undefined };
    // Normalize the discounted grid price once. Both persistence routes receive
    // net prices, so inclusive tax and discounts cannot be applied twice.
    const normalized = valid.map(l => {
      const quantity = Number(normalizeDigits(l.quantity));
      const net = computeTotals([l]).subtotal;
      return { description: l.description, quantity, unitPrice: Math.round(net / quantity * 100000000) / 100000000,
        taxRate: l.taxRate, taxInclusive: false, accountId: l.accountId || null,
        productId: l.productId || null, taxRateId: l.taxRateId || null, isAsset: !!l.isAsset,
        assetAccountId: l.isAsset ? l.accountId || null : null };
    });
    const payload = form.paid ? { ...common, date: form.date, status: asDraft ? 'DRAFT' : 'APPROVED',
      category: t('مصروف عام', 'General expense'), vendorName: supplier?.displayName || form.extractedSupplier || null,
      documentNumber: form.reference || null, reference: form.reference || null,
      description: valid.map(l => l.description).join(' · '), amount: totals.subtotal, subtotal: totals.subtotal,
      taxAmount: totals.tax, totalAmount: totals.total, paymentMethod: form.method,
      lineItems: normalized, autoCreateSupplier: false,
      paymentSplits: [{ method: form.method, amount: settlement.actualPaidAmount || totals.total, currency: paymentCurrency, reference: form.reference || null }],
      extractedJson: { currencySettlement: { ...settlement, version: 2, bankAccountId: form.bankId || null } },
    } : { ...common, issueDate: form.date, dueDate: form.dueDate,
      status: asDraft ? 'DRAFT' : 'DUE', supplierDocNumber: form.reference || null,
      exchangeRate: form.currency === region.currency ? 1 : Number(normalizeDigits(form.exchangeRate)) || undefined,
      lines: normalized, paymentSplits: [] };
    saving.current = true; setBusy(true);
    try { await submitPayload(payload, form.paid); } catch (e) { setError(humanizeError(e, language)); }
    finally { saving.current = false; setBusy(false); }
  };
  const field = (label: string, key: 'reference' | 'dueDate' | 'date' | 'exchangeRate' | 'actualPaidAmount', type = 'text') => <label className="block space-y-1 text-xs"><span>{label}</span>{type === 'date' ? <DateInput value={form[key]} onChange={v => setForm(f => ({ ...f, [key]: v }))} /> : <Input aria-label={label} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />}</label>;
  return <><FullPageForm title={t('تسجيل شراء أو مصروف', 'Record a purchase or expense')} subtitle={t('أدخل البنود ثم اختر هل دفعت الآن أو ستدفع لاحقًا.', 'Enter the items and choose whether you paid now or will pay later.')} onClose={close} draft={{ ...draft, discard: () => { draft.discard(); setFiles([]); } }} disableEscape={busy || !!productRequest} footer={<div className="flex flex-wrap gap-2"><Button disabled={busy || !!productRequest || loading || !fileDraft.ready || !!loadError || !region.currency} onClick={() => save(false)}>{form.paid ? t('حفظ كمدفوع', 'Save as paid') : t('حفظ كمستحق', 'Save as payable')}</Button><Button variant="outline" disabled={busy || !!productRequest || loading || !fileDraft.ready || !!loadError || !region.currency} onClick={() => save(true)}>{t('حفظ كمسودة', 'Save as draft')}</Button><Button variant="ghost" onClick={close} disabled={busy || !!productRequest}>{t('إلغاء', 'Cancel')}</Button></div>}>
    <div className="space-y-4">
      {loadError && <div role="alert">{loadError} <Button variant="outline" onClick={() => setRevision(v => v + 1)}>{t('إعادة المحاولة', 'Retry')}</Button></div>}
      {error && <p role="alert" className="rounded-lg border border-danger p-3 text-danger">{error}</p>}
      {fileDraft.failed && <p role="alert" className="text-danger text-sm">{t('تعذّر حفظ نسخة المرفقات على هذا الجهاز. احفظ المستند قبل إغلاق الصفحة.', 'Could not cache attachments on this device. Save the document before leaving.')}</p>}
      {loading && <p role="status">{t('تحميل الموردين والحسابات…', 'Loading suppliers and accounts…')}</p>}
      {productRequest && <PurchaseProductCreate query={productRequest.query} scope={scope} accounts={accounts}
        onCancel={() => { productRequest.reject(); setProductRequest(null); }}
        onCreated={p => { setProducts(current => [...current.filter(item => item.id !== p.id), p]); productRequest.resolve(productOption(p)); setProductRequest(null); }} />}
      <fieldset disabled={busy || !!productRequest || loading || !fileDraft.ready} className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('موعد الدفع', 'Payment timing')}><Button type="button" variant={form.paid ? 'default' : 'outline'} aria-pressed={form.paid} onClick={() => setForm(f => ({ ...f, paid: true }))}>{t('مدفوع الآن', 'Paid now')}</Button><Button type="button" variant={!form.paid ? 'default' : 'outline'} aria-pressed={!form.paid} onClick={() => setForm(f => ({ ...f, paid: false }))}>{t('سأدفع لاحقًا', 'Pay later')}</Button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1 text-xs"><span>{t('المورد', 'Supplier')}{form.paid ? t(' (اختياري)', ' (optional)') : ' *'}</span><SearchableCombobox value={form.contactId} onChange={id => setForm(f => ({ ...f, contactId: id }))} items={contacts.map(c => ({ id: c.id, label: c.displayName }))} placeholder={t('اختر المورد', 'Select supplier')} onCreate={async name => { const c = await api.contacts.create({ displayName: name, type: 'SUPPLIER' }); setContacts(v => [...v, c]); setForm(f => ({ ...f, contactId: c.id })); return c.id; }} /></label>
          {field(t('تاريخ المستند', 'Document date'), 'date', 'date')}
          {!form.paid && field(t('تاريخ الاستحقاق', 'Due date'), 'dueDate', 'date')}
          {field(t('رقم فاتورة المورد أو الإيصال', 'Supplier invoice or receipt number'), 'reference')}
          <label className="block space-y-1 text-xs"><span>{t('العملة', 'Currency')}</span><select aria-label={t('العملة', 'Currency')} className="h-9 w-full rounded-md border border-border bg-transparent px-2" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value, actualPaidAmount: '' }))}>{[...new Set([region.currency, form.currency, 'SAR', 'USD', 'EUR', 'GBP', 'AED'])].filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        {form.extractedSupplier && <p className="text-xs text-muted-foreground">{t('المورد في المستند:', 'Supplier on document:')} {form.extractedSupplier} · {t('راجع المورد المختار أو أنشئه من حقل المورد.', 'Review the selected supplier or create one in the supplier field.')}</p>}
        {needsRate && field(`${t('سعر التحويل', 'Exchange rate')} · 1 ${form.currency} = ${region.currency}`, 'exchangeRate')}
        <ItemsTable lines={lines} setLines={setLines} mode={taxMode} onModeChange={setTaxMode} direction="purchases" minRows={2} currency={form.currency} defaultTaxRate={region.isSA ? .15 : 0} contactId={form.contactId || null}
          defaultAccountLabel={t('مصروف عام / افتراضي الشركة', 'General expense / company default')}
          accounts={accounts.filter(a => a.isActive !== false && a.allowPosting !== false).map(a => ({ ...a, name: displayName(a, language) }))}
          products={products.map(productOption)} preserveLineOnProductCreate
          onCreateProduct={query => new Promise((resolve, reject) => setProductRequest({ query, resolve, reject }))} />
        {form.paid && <section className="rounded-lg border border-border p-3 space-y-3"><h2 className="text-sm font-semibold">{t('تفاصيل الدفع', 'Payment details')}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-xs"><span>{t('طريقة الدفع', 'Payment method')}</span><select aria-label={t('طريقة الدفع', 'Payment method')} className="h-9 w-full rounded-md border border-border bg-transparent px-2" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value, bankId: '', actualPaidAmount: '' }))}>{[['CASH', t('نقدًا', 'Cash')], ['BANK_TRANSFER', t('تحويل بنكي', 'Bank transfer')], ['CARD', t('بطاقة', 'Card')], ['CHECK', t('شيك', 'Check')], ['OTHER', t('أخرى', 'Other')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {form.method !== 'CASH' && <label className="space-y-1 text-xs"><span>{t('دفعت من', 'Paid from')}</span><SearchableCombobox value={form.bankId} onChange={id => setForm(f => ({ ...f, bankId: id, actualPaidAmount: '' }))} items={banks.filter(b => b.isActive !== false).map(b => ({ id: b.id, label: `${b.name} · ${b.currency}` }))} placeholder={t('حساب الدفع الافتراضي', 'Default payment account')} /></label>}
          {foreignPayment && field(`${t('المبلغ المسحوب فعليًا', 'Actual amount charged')} (${paymentCurrency})`, 'actualPaidAmount')}
        </div><p className="text-sm"><bdi>{totals.total.toFixed(2)} {form.currency}</bdi>{foreignPayment && <> → <bdi>{settlement.actualPaidAmount.toFixed(2)} {paymentCurrency}</bdi></>}</p></section>}
        <DocumentDropZone compact target="bill-lines" currency={form.currency} defaultTaxRate={region.isSA ? .15 : 0} onExtracted={data => {
          if (data.lines?.length) setLines(data.lines.map(l => ({ ...newLine(normalizeTaxRate(l.taxRate, 0).rate, !!l.taxInclusive), description: l.description || '', quantity: String(l.quantity ?? 1), unitPrice: String(l.unitPrice ?? 0) })));
          setForm(f => ({ ...f, reference: data.documentNumber || f.reference, dueDate: data.dueDate || f.dueDate,
            date: data.issueDate || f.date, currency: data.currency?.toUpperCase() || f.currency,
            sourceFileHash: data.sourceFileHash || '', extractedSupplier: data.issuer?.name || data.issuer?.legalName || '' }));
          if (data.sourceFile) setFiles(v => [...v.filter(f => f.name !== data.sourceFile!.name), data.sourceFile!]);
        }} onError={setError} />
        {files.length > 0 && <ul className="space-y-1 text-xs">{files.map((f, i) => <li key={i} className="flex items-center gap-2"><span>{f.name}</span><Button size="sm" variant="ghost" onClick={() => setFiles(v => v.filter((_, n) => n !== i))}>{t('إزالة', 'Remove')}</Button></li>)}</ul>}
        <details className="space-y-3"><summary className="cursor-pointer text-sm">{t('ملاحظات وفرع ومشروع', 'Notes, branch and project')}</summary><label className="block text-xs">{t('ملاحظات', 'Notes')}<textarea className="w-full rounded-md border border-border p-2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></label><BranchField value={form.branchId} onChange={branchId => setForm(f => ({ ...f, branchId }))} /><ProjectField value={form.projectId} onChange={projectId => setForm(f => ({ ...f, projectId }))} /></details>
        <div className="border-t border-border pt-3 text-sm">{t('قبل الضريبة', 'Before tax')}: <bdi>{totals.subtotal.toFixed(2)} {form.currency}</bdi> · {t('الضريبة', 'Tax')}: <bdi>{totals.tax.toFixed(2)} {form.currency}</bdi> · <strong>{t('الإجمالي', 'Total')}: <bdi>{totals.total.toFixed(2)} {form.currency}</bdi></strong></div>
      </fieldset>
    </div>
  </FullPageForm>{review && <SimilarityReviewDialog review={review.review} busy={busy} onCancel={() => setReview(null)} onChoose={async action => {
    if (saving.current) return; saving.current = true; setBusy(true);
    try { await submitPayload({ ...review.payload, duplicateDecision: buildDuplicateDecision(review.review, action) }, review.paid); }
    catch (e) { setError(humanizeError(e, language)); setReview(null); }
    finally { saving.current = false; setBusy(false); }
  }} />}</>;
}
