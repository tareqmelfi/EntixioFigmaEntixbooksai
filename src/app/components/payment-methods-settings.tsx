import { humanizeError } from "../lib/error-messages";
import { useEffect, useRef, useState } from 'react';
import { api, getOrgId, type Account, type BankAccount, type BankAccountInput, type Org, type PaymentMethodConfig, type PaymentMethodInput, type PaymentMethodKind, type PaymentMethodSuggestion, type PaymentUsage, type SettlementKind } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { SearchableCombobox } from './searchable-combobox';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const inputClass = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm';
const newMethod = (): PaymentMethodInput => ({ code: '', nameAr: '', nameEn: '', kind: 'custom', settlementAccountId: '', appliesTo: ['receipt', 'payment'], isActive: true, sortOrder: 0 });

/** Company-owned catalogue. Suggestions never create methods or infer GL mappings. */
export function PaymentMethodsSettings({ org, inline, currency, onMethodSaved, onSettlementSaved }: {
  org: Org; inline?: boolean; currency?: string;
  onMethodSaved?: (method: PaymentMethodConfig) => void;
  onSettlementSaved?: (account: BankAccount) => void;
}) {
  const FormTag = inline ? 'div' : 'form';
  const { language, t } = useLanguage();
  const canManage = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(org.role || '');
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [settlements, setSettlements] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suggestions, setSuggestions] = useState<PaymentMethodSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [editing, setEditing] = useState<PaymentMethodConfig | null>(null);
  const [form, setForm] = useState<PaymentMethodInput | null>(null);
  const [settlementForm, setSettlementForm] = useState<BankAccountInput | null>(null);
  const [settlementId, setSettlementId] = useState('');
  const mounted = useRef(true);
  const current = () => mounted.current && getOrgId() === org.id;
  const load = async () => {
    setLoading(true);
    try {
      const [m, b, a, s] = await Promise.all([api.paymentMethods.list(), api.bankAccounts.list(), api.accounts.list(), api.paymentMethods.suggestions()]);
      if (!current()) return;
      setMethods(m.items); setSettlements(b.items); setAccounts(a.items); setSuggestions(s.items);
    } catch { if (current()) setError(t('تعذر تحميل طرق الدفع. أعد المحاولة.', 'Could not load payment methods. Retry.')); }
    finally { if (current()) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [org.id]);
  const methodKinds: [PaymentMethodKind, string][] = [['cash', t('نقد', 'Cash')], ['bank_transfer', t('تحويل بنكي', 'Bank transfer')], ['card', t('بطاقة', 'Card')], ['gateway', t('بوابة', 'Gateway')], ['wallet', t('محفظة', 'Wallet')], ['cheque', t('شيك', 'Cheque')], ['clearing', t('تسوية', 'Clearing')], ['custom', t('مخصصة', 'Custom')]];
  const settlementKinds: [SettlementKind, string][] = [['bank', t('بنك', 'Bank')], ['gateway', t('بوابة', 'Gateway')], ['cash_box', t('صندوق', 'Cash box')], ['card_issuer', t('بطاقة', 'Card')], ['clearing', t('تسوية', 'Clearing')]];
  const usageLabels: [PaymentUsage, string][] = [['receipt', t('القبض', 'Receipts')], ['payment', t('الصرف', 'Payments')]];
  const leafAccounts = accounts.filter(a => a.isActive && a.allowPosting === true && !accounts.some(child => child.parentId === a.id));
  const glItems = (type: Account['type']) => leafAccounts.filter(a => a.type === type).map(a => ({ id: a.id, label: `${a.code} · ${language === 'ar' ? a.nameAr || a.name : a.name}` }));
  const message = (e: unknown) => humanizeError(e, language, { ar: 'تعذر الحفظ. بقيت المدخلات كما هي.', en: 'Save failed. Your input has been kept.' });
  const edit = (method?: PaymentMethodConfig, suggestion?: PaymentMethodSuggestion) => {
    setEditing(method || null); setError(''); setSaved('');
    setForm(method ? { ...method, defaultFeePct: method.defaultFeePct == null ? null : Number(method.defaultFeePct), defaultFeeFixed: method.defaultFeeFixed == null ? null : Number(method.defaultFeeFixed) } : { ...newMethod(), ...suggestion });
  };
  const saveMethod = async (event: React.FormEvent) => {
    event.preventDefault(); event.stopPropagation();
    if (inline && Array.from(event.currentTarget.closest('[role="form"]')?.querySelectorAll<HTMLInputElement>('input,select') || []).some(el => !el.reportValidity())) return;
    if (busy || !canManage || !form || !current()) return;
    setBusy(true); setError(''); setSaved('');
    try {
      // Only writable fields are sent; an edit carries its original optimistic-lock version.
      const { code, nameAr, nameEn, kind, settlementAccountId, feeAccountId, defaultFeePct, defaultFeeFixed, feeCurrency, isActive, sortOrder, appliesTo, icon } = form;
      const data = { code, nameAr, nameEn, kind, settlementAccountId, feeAccountId, defaultFeePct, defaultFeeFixed, feeCurrency, isActive, sortOrder, appliesTo, icon };
      const result = editing ? await api.paymentMethods.update(editing.id, { ...data, expectedUpdatedAt: editing.updatedAt }) : await api.paymentMethods.create(data);
      if (!current()) return;
      setMethods(rows => [...rows.filter(row => row.id !== result.id), result].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      setForm(null); setEditing(null); setSaved(t('حُفظت طريقة الدفع.', 'Payment method saved.'));
      onMethodSaved?.(result);
    } catch (e) { if (current()) setError(message(e)); }
    finally { if (current()) setBusy(false); }
  };
  const saveSettlement = async (event: React.FormEvent) => {
    event.preventDefault(); event.stopPropagation();
    if (inline && Array.from(event.currentTarget.closest('[role="form"]')?.querySelectorAll<HTMLInputElement>('input,select') || []).some(el => !el.reportValidity())) return;
    if (busy || !canManage || !settlementForm || !current()) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const result = settlementId
        ? await api.bankAccounts.update(settlementId, { accountId: settlementForm.accountId })
        : await api.bankAccounts.create(settlementForm);
      if (!current()) return;
      setSettlements(rows => [...rows.filter(row => row.id !== result.id), result]);
      setSettlementForm(null); setSettlementId(''); setSaved(t('حُفظ حساب التسوية.', 'Settlement account saved.'));
      setForm(current => current ? { ...current, settlementAccountId: result.id, feeCurrency: result.currency } : current);
      onSettlementSaved?.(result);
    } catch (e) { if (current()) setError(message(e)); }
    finally { if (current()) setBusy(false); }
  };
  const selectedSettlement = settlements.find(s => s.id === form?.settlementAccountId);
  const expectedKind = form ? ({ cash: 'cash_box', bank_transfer: 'bank', gateway: 'gateway', clearing: 'clearing' } as Partial<Record<PaymentMethodKind, SettlementKind>>)[form.kind] : undefined;
  return <Card><CardHeader><CardTitle>{t('طرق الدفع وحسابات التسوية', 'Payment methods and settlement accounts')}</CardTitle>
    <p className="text-sm text-muted-foreground">{t('سمّ طريقة الدفع واربطها بحسابها مرة واحدة لاستخدامها في سندات القبض والصرف.', 'Name each payment method and link its account once for receipt and payment vouchers.')}</p>
  </CardHeader><CardContent className="space-y-4">
    {error && <div role="alert" className="text-sm text-destructive">{error}<Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setError(''); void load(); }}>{t('تحديث القائمة', 'Refresh list')}</Button></div>}
    {saved && <p role="status" className="text-sm">{saved}</p>}
    {loading ? <p>{t('جار التحميل…', 'Loading…')}</p> : <>
      <div className="divide-y divide-border">{(inline ? [] : methods).map(method => <div key={method.id} className="flex items-center justify-between gap-3 py-2 text-sm">
        <div>{language === 'ar' ? method.nameAr : method.nameEn} <span className="text-muted-foreground">· {settlements.find(s => s.id === method.settlementAccountId)?.name} · {method.isActive ? t('نشطة', 'Active') : t('معطلة', 'Inactive')}</span></div>
        {canManage && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => edit(method)}>{t('تعديل', 'Edit')} {language === 'ar' ? method.nameAr : method.nameEn}</Button>}
      </div>)}</div>
      {!methods.length && <p className="text-sm text-muted-foreground">{t('لم تُضف طرق دفع مخصصة بعد.', 'No custom payment methods yet.')}</p>}
      {canManage && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={busy} onClick={() => edit()}>{t('إضافة طريقة دفع', 'Add payment method')}</Button>
        {suggestions.filter(s => !methods.some(m => m.code === s.code)).map(s => <Button key={s.code} type="button" variant="outline" size="sm" disabled={busy} onClick={() => edit(undefined, s)}>{language === 'ar' ? s.nameAr : s.nameEn}</Button>)}
      </div>}
      {form && canManage && <FormTag role="form" onSubmit={inline ? undefined : saveMethod} onKeyDown={inline ? e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault(); } : undefined} className="rounded-lg border border-border p-4 space-y-3" aria-label={t('إعداد طريقة الدفع', 'Payment method setup')}><fieldset disabled={busy} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">{t('الرمز', 'Code')}<Input required pattern="[A-Za-z0-9_-]+" maxLength={60} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></label>
          <label className="text-sm">{t('الاسم بالعربية', 'Arabic name')}<Input required maxLength={160} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} /></label>
          <label className="text-sm">{t('الاسم بالإنجليزية', 'English name')}<Input required maxLength={160} value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">{t('نوع الطريقة', 'Method type')}<select aria-label={t('نوع الطريقة', 'Method type')} className={inputClass} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as PaymentMethodKind, settlementAccountId: '' })}>{methodKinds.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <div className="text-sm">{t('حساب التسوية', 'Settlement account')}<SearchableCombobox value={form.settlementAccountId} disabled={busy} onChange={id => setForm({ ...form, settlementAccountId: id, feeCurrency: settlements.find(s => s.id === id)?.currency })} placeholder={t('اختر حساب التسوية', 'Select settlement account')} items={settlements.filter(s => s.isActive && s.accountId && (!currency || s.currency === currency) && (!expectedKind || (s.kind || 'bank') === expectedKind)).map(s => ({ id: s.id, label: `${s.name} · ${s.currency}` }))} /></div></div>
        <div className="flex flex-wrap gap-4 text-sm">{usageLabels.map(([key, label]) => <label key={key}><input type="checkbox" checked={form.appliesTo.includes(key)} onChange={e => setForm({ ...form, appliesTo: e.target.checked ? [...form.appliesTo, key] : form.appliesTo.filter(v => v !== key) })} /> {label}</label>)}
          <label><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> {t('نشطة', 'Active')}</label>
          <label>{t('الترتيب', 'Order')}<Input type="number" min={0} max={100000} value={form.sortOrder || 0} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
        </div>
        <details><summary className="cursor-pointer text-sm">{t('حساب الرسوم وتقديرها', 'Fee account and estimates')}</summary><div className="grid gap-3 pt-3 md:grid-cols-3">
          <SearchableCombobox value={form.feeAccountId || ''} disabled={busy} onChange={id => setForm({ ...form, feeAccountId: id || null })} placeholder={t('حساب مصروف الرسوم', 'Fee expense account')} items={glItems('EXPENSE')} />
          <label className="text-sm">{t('نسبة تقديرية %', 'Estimated percentage %')}<Input type="number" min={0} max={99.9999} step="0.0001" value={form.defaultFeePct ?? ''} onChange={e => setForm({ ...form, defaultFeePct: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label className="text-sm">{t('رسم ثابت تقديري', 'Estimated fixed fee')} {selectedSettlement?.currency}<Input type="number" min={0} step="0.01" value={form.defaultFeeFixed ?? ''} onChange={e => setForm({ ...form, defaultFeeFixed: e.target.value === '' ? null : Number(e.target.value), feeCurrency: selectedSettlement?.currency || null })} /></label>
        </div><p className="text-xs text-muted-foreground mt-2">{t('هذه تقديرات محفوظة؛ لا تُنشئ قيد رسوم. تُسجّل الرسوم الفعلية من حركة موثقة.', 'These saved estimates do not post fees. Actual fees require verified transaction evidence.')}</p></details>
        <div className="flex gap-2"><Button type={inline ? "button" : "submit"} onClick={inline ? saveMethod : undefined} size="sm" disabled={!form.settlementAccountId || !form.appliesTo.length}>{busy ? t('جار الحفظ…', 'Saving…') : t('حفظ الطريقة', 'Save method')}</Button><Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>{t('إلغاء', 'Cancel')}</Button></div>
      </fieldset></FormTag>}
      <div className="border-t border-border pt-4 space-y-2"><h3 className="font-medium">{t('حسابات التسوية', 'Settlement accounts')}</h3>
        {(inline ? [] : settlements).map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1"><span>{s.name} · {s.currency} · {accounts.find(a => a.id === s.accountId)?.code || t('بلا ربط محاسبي', 'No ledger mapping')}</span>{canManage && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setSettlementId(s.id); setSettlementForm({ ...s, balance: undefined }); setError(''); }}>{t('ربط الحساب', 'Map account')} · {s.name}</Button>}</div>)}
        {canManage && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setSettlementId(''); setSettlementForm({ name: '', kind: expectedKind || 'bank', accountId: '', country: org.country || '', currency: currency || org.baseCurrency }); setError(''); }}>{t('إضافة حساب تسوية', 'Add settlement account')}</Button>}
      </div>
      {settlementForm && canManage && <FormTag role="form" onSubmit={inline ? undefined : saveSettlement} onKeyDown={inline ? e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault(); } : undefined} aria-label={t('إعداد حساب التسوية', 'Settlement account setup')} className="rounded-lg border border-border p-4 space-y-3"><fieldset disabled={busy} className="space-y-3">
        {!settlementId && <><div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">{t('اسم الحساب', 'Account name')}<Input required value={settlementForm.name} onChange={e => setSettlementForm({ ...settlementForm, name: e.target.value })} /></label>
          <label className="text-sm">{t('النوع', 'Type')}<select aria-label={t('النوع', 'Type')} className={inputClass} value={settlementForm.kind} onChange={e => setSettlementForm({ name: settlementForm.name, currency: settlementForm.currency, country: settlementForm.country, kind: e.target.value as SettlementKind, accountId: '' })}>{settlementKinds.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-sm">{t('العملة', 'Currency')}<Input required pattern="[A-Z]{3}" maxLength={3} value={settlementForm.currency} onChange={e => setSettlementForm({ ...settlementForm, currency: e.target.value.toUpperCase(), parentSettlementAccountId: null, accountId: '' })} /></label>
        </div>
        {settlementForm.kind === 'bank' && <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">{t('الدولة', 'Country')}<Input maxLength={2} required value={settlementForm.country || ''} onChange={e => setSettlementForm({ ...settlementForm, country: e.target.value.toUpperCase() })} /></label>
          <label className="text-sm">{t('رقم الحساب', 'Account number')}<Input value={settlementForm.accountNumber || ''} onChange={e => setSettlementForm({ ...settlementForm, accountNumber: e.target.value })} /></label>
          <label className="text-sm">{settlementForm.country === 'US' ? 'ABA routing' : 'IBAN'}<Input value={(settlementForm.country === 'US' ? settlementForm.routingNumber : settlementForm.iban) || ''} onChange={e => setSettlementForm({ ...settlementForm, [settlementForm.country === 'US' ? 'routingNumber' : 'iban']: e.target.value })} /></label>
        </div>}
        {settlementForm.kind === 'gateway' && <label className="block text-sm">{t('المزود', 'Provider')}<Input value={settlementForm.provider || ''} onChange={e => setSettlementForm({ ...settlementForm, provider: e.target.value })} /></label>}
        {settlementForm.kind === 'card_issuer' && <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">{t('آخر أربعة أرقام فقط', 'Last four digits only')}<Input maxLength={4} pattern="[0-9]{4}" value={settlementForm.last4 || ''} onChange={e => setSettlementForm({ ...settlementForm, last4: e.target.value })} /></label>
          <div className="text-sm">{t('بطاقة خصم: البنك المرتبط (اتركه فارغًا للائتمان)', 'Debit card: linked bank (leave empty for credit)')}<SearchableCombobox value={settlementForm.parentSettlementAccountId || ''} onChange={id => setSettlementForm({ ...settlementForm, parentSettlementAccountId: id || null, accountId: settlements.find(s => s.id === id)?.accountId || '' })} placeholder={t('اختر بنك البطاقة', 'Select card bank')} items={settlements.filter(s => (s.kind || 'bank') === 'bank' && s.isActive && s.accountId && s.currency === settlementForm.currency).map(s => ({ id: s.id, label: s.name }))} /></div>
        </div>}</>}
        <div className="text-sm">{t('الحساب المحاسبي', 'Ledger account')}<SearchableCombobox disabled={busy || !!settlementForm.parentSettlementAccountId} value={settlementForm.accountId || ''} onChange={id => setSettlementForm({ ...settlementForm, accountId: id })} placeholder={t('اختر حسابًا قابلًا للترحيل', 'Select a posting account')} items={glItems(settlementForm.kind === 'card_issuer' && !settlementForm.parentSettlementAccountId ? 'LIABILITY' : 'ASSET')} /></div>
        <div className="flex gap-2"><Button type={inline ? "button" : "submit"} onClick={inline ? saveSettlement : undefined} size="sm" disabled={!settlementForm.accountId}>{t('حفظ الحساب', 'Save account')}</Button><Button type="button" size="sm" variant="outline" onClick={() => setSettlementForm(null)}>{t('إلغاء', 'Cancel')}</Button></div>
      </fieldset></FormTag>}
    </>}
  </CardContent></Card>;
}
