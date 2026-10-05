import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, type BankAccount, type PaymentMethodConfig, type Voucher } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { useOrgRegion } from '../lib/use-org-region';
import { SearchableCombobox } from './searchable-combobox';
import { Button } from './ui/button';

export type VoucherMethodSelection = { paymentMethod: Voucher['paymentMethod']; paymentMethodConfigId?: string | null; bankAccountId?: string | null };
export function voucherMethodLabel(voucher: Pick<Voucher, 'paymentMethod' | 'paymentMethodSnapshot'>, language: string, fallback: string) {
  return (language === 'ar' ? voucher.paymentMethodSnapshot?.nameAr : voucher.paymentMethodSnapshot?.nameEn) || fallback;
}
export function voucherMethodPayload(form: VoucherMethodSelection) {
  return {
    paymentMethod: form.paymentMethod,
    ...(form.paymentMethodConfigId ? { paymentMethodConfigId: form.paymentMethodConfigId } : {}),
    bankAccountId: form.bankAccountId || null,
  };
}
export function VoucherPaymentMethod({ value, onChange, usage, currency, saved }: {
  value: VoucherMethodSelection; onChange: (value: VoucherMethodSelection) => void;
  usage: 'receipt' | 'payment'; currency: string; saved?: Voucher | null;
}) {
  const { t, language } = useLanguage();
  const { country } = useOrgRegion();
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setFailed(false);
    Promise.all([api.paymentMethods.list({ active: true, appliesTo: usage }), api.bankAccounts.list()])
      .then(([m, b]) => { if (live) { setMethods(m.items); setAccounts(b.items); } })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [usage, retry]);
  const legacy = [
    { id: 'BANK_TRANSFER', label: t('تحويل بنكي', 'Bank transfer') }, { id: 'CASH', label: t('نقدًا', 'Cash') },
    { id: 'CARD', label: t('بطاقة', 'Card') }, { id: 'CHECK', label: t('شيك', 'Cheque') }, { id: 'OTHER', label: t('أخرى', 'Other') },
    ...(country === 'SA' ? [{ id: 'MADA', label: t('مدى', 'Mada') }, { id: 'STC_PAY', label: 'STC Pay' }] : []),
  ];
  const method = methods.find(m => m.id === value.paymentMethodConfigId);
  const selectedAccount = accounts.find(a => a.id === (method?.settlementAccountId || value.bankAccountId));
  const ready = accounts.filter(a => a.isActive && a.accountId && a.currency === currency && (value.paymentMethod === 'CASH' ? a.kind === 'cash_box' : a.kind !== 'cash_box'));
  if (saved) return <div className="text-sm">{t('طريقة الدفع', 'Payment method')}: {voucherMethodLabel(saved, language, legacy.find(l => l.id === saved.paymentMethod)?.label || saved.paymentMethod)}<p className="text-xs text-muted-foreground">{t('طريقة السند المحفوظ محفوظة مع قيده.', 'The saved voucher retains its payment method and journal.')}</p></div>;
  return <div className="space-y-2" aria-label={t('طريقة الدفع وحسابها', 'Payment method and account')}>
    <p className="text-xs">{t('طريقة الدفع', 'Payment method')} *</p>
    {failed ? <div role="alert" className="text-sm text-destructive">{t('تعذر تحميل طرق الدفع. أعد المحاولة قبل اختيار الطريقة.', 'Payment methods could not be loaded. Retry before selecting a method.')} <Button type="button" size="sm" variant="outline" onClick={() => setRetry(n => n + 1)}>{t('إعادة تحميل طرق الدفع', 'Retry payment methods')}</Button></div> : <SearchableCombobox
      disabled={loading} value={value.paymentMethodConfigId ? `method:${value.paymentMethodConfigId}` : value.paymentMethod}
      placeholder={loading ? t('جار التحميل…', 'Loading…') : t('اختر طريقة الدفع', 'Select payment method')}
      items={[...methods.filter(m => m.settlementAccount?.currency === currency).map(m => ({ id: `method:${m.id}`, label: language === 'ar' ? m.nameAr : m.nameEn, sublabel: m.settlementAccount?.name })), ...legacy]}
      onChange={id => {
        const config = methods.find(m => `method:${m.id}` === id);
        if (config) onChange({ paymentMethod: config.kind === 'cash' ? 'CASH' : config.kind === 'bank_transfer' ? 'BANK_TRANSFER' : config.kind === 'card' ? 'CARD' : config.kind === 'cheque' ? 'CHECK' : 'OTHER', paymentMethodConfigId: config.id, bankAccountId: config.settlementAccountId });
        else onChange({ paymentMethod: id as Voucher['paymentMethod'], paymentMethodConfigId: null, bankAccountId: null });
      }} />}
    {value.paymentMethodConfigId ? <p className="text-sm">{selectedAccount?.name || t('حساب الطريقة المحددة', 'Selected method account')} · {selectedAccount?.currency || currency}</p> : !failed && <>
      <p className="text-xs">{t('حساب التسوية', 'Settlement account')}</p>
      <SearchableCombobox disabled={loading} value={value.bankAccountId || ''} onChange={id => onChange({ ...value, bankAccountId: id || null })} placeholder={value.paymentMethod === 'CASH' ? t('الصندوق الافتراضي أو اختر صندوقًا', 'Default cash control or select a cash box') : t('اختر حساب التسوية', 'Select settlement account')} items={ready.map(a => ({ id: a.id, label: `${a.name} · ${a.currency}` }))} />
    </>}
    <Link to="/app/settings?tab=payments" className="text-xs text-primary underline">{t('إعداد طرق الدفع وربط الحسابات', 'Set up payment methods and account mappings')}</Link>
  </div>;
}
