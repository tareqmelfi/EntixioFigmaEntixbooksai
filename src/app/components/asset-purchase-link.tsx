import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { SearchableCombobox } from './searchable-combobox';

export function AssetPurchaseLink({ billId, expenseId, onChange }: {billId:string;expenseId:string;onChange:(bill:string,expense:string)=>void}) {
  const {t}=useLanguage();
  const [query,setQuery]=useState(''); const [items,setItems]=useState<any[]>([]); const [error,setError]=useState(false); const [loading,setLoading]=useState(false);
  useEffect(()=>{let active=true; const timer=setTimeout(()=>{setLoading(true);api.fixedAssets.purchaseOptions(query).then(d=>{if(active){setItems(d.items);setError(false)}}).catch(()=>{if(active)setError(true)}).finally(()=>{if(active)setLoading(false)})},250);return()=>{active=false;clearTimeout(timer)}},[query]);
  const value=billId ? `bill:${billId}` : expenseId ? `expense:${expenseId}` : '';
  const status=(value:string)=>({DRAFT:t('مسودة','Draft'),APPROVED:t('معتمدة','Approved'),PAID:t('مدفوعة','Paid'),PARTIALLY_PAID:t('مدفوعة جزئيًا','Partially paid'),OVERDUE:t('متأخرة','Overdue')}[value] || value);
  const options=items.map(p=>({id:`${p.kind}:${p.id}`,label:`${p.number} · ${p.vendor || ''}`,sublabel:`${p.supplierNumber || ''} · ${p.date.slice(0,10)} · ${p.total} ${p.currency} · ${status(p.status)}`}));
  if(value && !options.some(p=>p.id===value)) options.unshift({id:value,label:t('مستند الشراء المرتبط','Linked purchase document'),sublabel:''});
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">{t('فاتورة أو إيصال الشراء','Purchase invoice or receipt')}</h3>
    <Input aria-label={t('البحث عن مستند شراء','Search purchase documents')} placeholder={t('ابحث برقم الفاتورة أو المورد','Search invoice number or supplier')} value={query} onChange={e=>setQuery(e.target.value)} />
    <SearchableCombobox value={value} items={options} onChange={key=>{const [kind,id]=key.split(':');onChange(kind==='bill'?id:'',kind==='expense'?id:'')}} placeholder={t('اختر مستند الشراء','Choose purchase document')} />
    {loading && <p className="text-xs text-muted-foreground">{t('جار البحث…','Searching…')}</p>}
    {error && <p role="alert" className="text-sm text-danger">{t('تعذر تحميل المستندات. غيّر البحث للمحاولة مجددًا.','Could not load documents. Change the search to retry.')}</p>}
    {!loading && !error && !items.length && <p className="text-xs text-muted-foreground">{t('لا توجد مستندات مطابقة.','No matching documents.')}</p>}
    {value && <Button type="button" variant="ghost" onClick={()=>onChange('','')}>{t('إزالة الربط','Unlink document')}</Button>}
    <p className="text-xs text-muted-foreground leading-5">{t('هذا ربط مرجعي فقط؛ لا يغيّر التكلفة أو العملة ولا يكرر قيد الشراء. راجع أن بند الجهاز مسجل في حساب الأصل، وأن التكلفة هنا بعملة الشركة.','This reference link does not change cost or currency or duplicate the purchase entry. Check that the device line uses the asset account and this cost is in company currency.')}</p>
  </section>;
}
