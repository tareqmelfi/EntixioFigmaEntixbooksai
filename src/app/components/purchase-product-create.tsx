import { useEffect, useRef, useState } from 'react';
import { api, getOrgId } from '../lib/api';
import { humanizeError } from '../lib/error-messages';
import { displayName } from '../lib/display-name';
import { useLanguage } from './LanguageContext';
import { InlinePanel } from './inline-panel';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Account = { id: string; name: string; nameAr?: string; code: string; type: string; isActive?: boolean; allowPosting?: boolean };
export function PurchaseProductCreate({ query, scope, accounts, onCreated, onCancel }: {
  query: string; scope: string | null; accounts: Account[]; onCreated: (product: any) => void; onCancel: () => void;
}) {
  const { t, language } = useLanguage();
  const [form, setForm] = useState({ name: query, nameAr: '', sku: '', type: '', incomeAccountId: '', expenseAccountId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.scrollIntoView({ block: 'center' }); }, []);
  const available = accounts.filter(a => a.isActive !== false && a.allowPosting !== false);
  const income = available.filter(a => a.type === 'REVENUE' || a.type === 'INCOME');
  const expense = available.filter(a => a.type === 'EXPENSE' || a.type === 'ASSET');
  const cancel = () => { if (!saving.current) onCancel(); };
  const save = async () => {
    if (saving.current) return;
    if (!form.name.trim() || !form.type || (income.length && !form.incomeAccountId) || (expense.length && !form.expenseAccountId)) {
      setError(t('أكمل الاسم والنوع والحسابات المتاحة.', 'Complete the name, type and available accounts.')); return;
    }
    saving.current = true; setBusy(true); setError('');
    try {
      if (getOrgId() !== scope) throw new Error(t('تغيرت الشركة؛ افتح النموذج من جديد.', 'Company changed; reopen the form.'));
      const product = await api.products.create({ ...form, name: form.name.trim(), nameAr: form.nameAr.trim() || null,
        sku: form.sku.trim() || null, incomeAccountId: form.incomeAccountId || null, expenseAccountId: form.expenseAccountId || null });
      if (getOrgId() !== scope) throw new Error(t('تغيرت الشركة؛ افتح النموذج من جديد.', 'Company changed; reopen the form.'));
      if (!product?.id) throw new Error(t('لم يؤكد الخادم حفظ المنتج.', 'The server did not confirm a saved product.'));
      onCreated(product);
    } catch (e) { setError(humanizeError(e, language)); }
    finally { saving.current = false; setBusy(false); }
  };
  const accountField = (key: 'incomeAccountId' | 'expenseAccountId', label: string, options: Account[]) => options.length > 0 &&
    <label className="space-y-1 text-xs"><span>{label}</span><select aria-label={label} className="h-9 w-full rounded-md border border-border bg-transparent px-2" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
      <option value="">{t('اختر الحساب', 'Select account')}</option>{options.map(a => <option key={a.id} value={a.id}>{a.code} · {displayName(a, language)}</option>)}
    </select></label>;
  return <InlinePanel title={t('إنشاء منتج جديد', 'Create a new product')} onClose={cancel}
    description={t('سيُختار المنتج في البند. يبقى سعر الشراء والضريبة والوصف كما أدخلتها؛ يمكنك تعديل بيانات الكتالوج لاحقًا.', 'The product will be selected on the line. Your purchase price, tax and description stay unchanged; catalogue details can be edited later.')}
    footer={<div className="flex gap-2"><Button type="button" disabled={busy} onClick={save}>{t('حفظ واستخدام المنتج', 'Save and use product')}</Button><Button type="button" variant="outline" disabled={busy} onClick={cancel}>{t('إلغاء إنشاء المنتج', 'Cancel product creation')}</Button></div>}>
    {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
    <fieldset disabled={busy} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs"><span>{t('اسم المنتج', 'Product name')}</span><Input ref={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
      <label className="space-y-1 text-xs"><span>{t('الاسم بالعربية (اختياري)', 'Arabic name (optional)')}</span><Input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></label>
      <label className="space-y-1 text-xs"><span>{t('كود المنتج (اختياري)', 'SKU (optional)')}</span><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></label>
      <label className="space-y-1 text-xs"><span>{t('نوع المنتج', 'Product type')}</span><select aria-label={t("نوع المنتج", "Product type")} className="h-9 w-full rounded-md border border-border bg-transparent px-2" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
        <option value="">{t('اختر النوع', 'Select type')}</option>{[['SERVICE', t('خدمة', 'Service')], ['GOOD', t('سلعة', 'Good')], ['INVENTORY', t('مخزون', 'Inventory')], ['DIGITAL', t('منتج رقمي', 'Digital product')], ['SUBSCRIPTION', t('اشتراك', 'Subscription')], ['PACKAGE', t('باقة', 'Package')], ['BUNDLE', t('حزمة', 'Bundle')]].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      {accountField('incomeAccountId', t('حساب الإيراد', 'Income account'), income)}
      {accountField('expenseAccountId', t('حساب الشراء', 'Purchase account'), expense)}
    </fieldset>
  </InlinePanel>;
}
