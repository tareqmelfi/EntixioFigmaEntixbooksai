import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type Account, type PostingReviewItem, type PostingReviewPreview } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { SearchableCombobox } from './searchable-combobox';
import { displayLocale } from '../lib/number-display';

export function PostingReview({from,to,onPosted}:{from?:string|null;to?:string;onPosted?:()=>void}) {
  const {t}=useLanguage();
  const [items,setItems]=useState<PostingReviewItem[]>([]),[accounts,setAccounts]=useState<Account[]>([]);
  const [offset,setOffset]=useState(0),[total,setTotal]=useState(0),[loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<PostingReviewItem|null>(null),[accountId,setAccountId]=useState('');
  const [preview,setPreview]=useState<PostingReviewPreview|null>(null),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const generation=useRef(0);
  const paths:Record<string,string>={invoice:'/app/invoices/',bill:'/app/purchases/bills/',expense:'/app/expenses/',receipt:'/app/receipts/',payment:'/app/payments/','credit-note':'/app/credit-notes/'};
  const types:Record<string,string>={invoice:t('فاتورة بيع','Sales invoice'),bill:t('فاتورة شراء','Purchase bill'),expense:t('مصروف','Expense'),receipt:t('سند قبض','Receipt'),payment:t('سند صرف','Payment'),'credit-note':t('إشعار دائن','Credit note')};
  const amount=(n:number)=>n.toLocaleString(displayLocale('en-US'),{minimumFractionDigits:2,maximumFractionDigits:2});
  useEffect(()=>{
    const current=++generation.current;setLoading(true);setError('');setSelected(null);setPreview(null);setConfirmed(false);
    Promise.all([api.postingReview.list(from?.slice(0,10),to?.slice(0,10),offset),api.accounts.list()]).then(([data,chart])=>{
      if(current!==generation.current)return;setItems(data.items);setTotal(data.total);setAccounts(chart.items);
    }).catch(e=>{if(current===generation.current)setError(t(e.messageAr||e.message,e.message)||t('تعذر تحميل المراجعة','Review could not be loaded'));}).finally(()=>{if(current===generation.current)setLoading(false)});
    return ()=>{generation.current++};
  },[from,to,offset]);
  const select=(item:PostingReviewItem)=>{generation.current++;setSelected(item);setAccountId('');setPreview(null);setConfirmed(false);setError('');setNotice('')};
  const review=async()=>{
    if(!selected)return;const current=++generation.current;setBusy(true);setError('');setPreview(null);setConfirmed(false);
    try{const result=await api.postingReview.preview(selected.kind,selected.id,accountId||undefined);if(current===generation.current)setPreview(result)}catch(e:any){if(current===generation.current)setError(t(e.messageAr||e.message,e.message))}finally{if(current===generation.current)setBusy(false)}
  };
  const approve=async()=>{
    if(!selected||!preview||!confirmed)return;setBusy(true);setError('');
    try{await api.postingReview.approve(selected.kind,selected.id,preview.reviewToken);setItems(old=>old.filter(x=>x.id!==selected.id));setTotal(n=>Math.max(0,n-1));setSelected(null);setPreview(null);setNotice(t('اكتمل الترحيل وتحديث الدفاتر.','Posting completed and ledger updated.'));onPosted?.();}
    catch(e:any){setError(t(e.messageAr||e.message,e.message));setPreview(null);setConfirmed(false)}finally{setBusy(false)}
  };
  return <div className="mt-3 border-t border-border pt-3" data-testid="posting-review">
    <p className="text-sm">{t('استكمال قيود المستندات المعتمدة فقط. الحساب المحفوظ أو حساب المنتج أولًا، ثم الافتراضي العام عند غياب التصنيف.','Recover journals for issued documents. Stored or product accounts take priority, followed by the general default when classification is missing.')}</p>
    {error&&<p role="alert" className="my-2 text-sm text-warning">{error} <Link to={selected?`${paths[selected.kind]}${selected.id}`:"/app/settings?tab=control-accounts"} className="underline">{selected?t('فتح المستند للتصحيح','Open document to correct'):t('إعدادات الحسابات','Account settings')}</Link></p>}
    {notice&&<p role="status" className="my-2 text-sm">{notice}</p>}
    {loading?<p role="status">{t('جارٍ التحميل…','Loading…')}</p>:<>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[t('المستند','Document'),t('التاريخ','Date'),t('المبلغ','Amount'),t('الإجراء','Action')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{items.map(item=><tr key={`${item.kind}-${item.id}`} className="border-t border-border">
        <td className="p-2"><Link className="text-primary underline" to={`${paths[item.kind]}${item.id}`}>{item.number}</Link><span className="ms-2 text-xs">{types[item.kind]}</span></td><td className="p-2">{item.date.slice(0,10)}</td><td className="p-2"><bdi>{amount(item.total)} {item.currency}</bdi></td>
        <td className="p-2">{['invoice','bill','expense','receipt','payment'].includes(item.kind)?<Button size="sm" variant="outline" disabled={busy} onClick={()=>select(item)}>{t('مراجعة واعتماد القيد','Review and approve journal')}</Button>:<Link className="underline text-primary" to={`${paths[item.kind]}${item.id}`}>{t('فتح السند ومطابقة قيده','Open document and reconcile journal')}</Link>}</td>
      </tr>)}</tbody></table></div>
      {!items.length&&<p>{t('لا توجد مستندات ناقصة الربط في هذه الصفحة.','No unlinked documents on this page.')}</p>}
      <div className="mt-2 flex gap-2 items-center"><Button size="sm" variant="outline" disabled={offset===0||busy} onClick={()=>setOffset(n=>Math.max(0,n-50))}>{t('السابق','Previous')}</Button><span>{offset+Math.min(1,items.length)}–{offset+items.length} / {total}</span><Button size="sm" variant="outline" disabled={offset+items.length>=total||busy} onClick={()=>setOffset(n=>n+50)}>{t('التالي','Next')}</Button></div>
    </>}
    {selected&&<section aria-label={t('معاينة القيد','Journal preview')} className="mt-4 rounded-lg border border-border p-4">
      <h3 className="font-semibold">{selected.number} · {t('معاينة القيد','Journal preview')}</h3>
      <p className="my-2 text-xs">{['receipt','payment'].includes(selected.kind)?t('تُستخدم طريقة السداد والبنك المسجلان وحساب الذمم. لا يُنشأ سداد جديد.','Uses the recorded payment method, bank and receivables/payables account. No new payment is created.'):t('الحساب للبنود غير المصنفة فقط؛ تبقى الحسابات المحفوظة وحسابات المنتجات. يمكن تركه لاستخدام حساب الشركة العام.','Account for unclassified lines only; stored and product accounts are retained. Leave empty to use the company general account.')}</p>
      {['invoice','bill','expense'].includes(selected.kind)&&<SearchableCombobox value={accountId} disabled={busy} onChange={id=>{setAccountId(id);setPreview(null);setConfirmed(false)}} items={accounts.filter(a=>a.isActive&&a.allowPosting!==false&&(selected.kind==='invoice'?a.type==='REVENUE':['EXPENSE','ASSET'].includes(a.type))).map(a=>({id:a.id,label:`${a.code} · ${a.nameAr||a.name}`}))} placeholder={t('حساب الشركة الافتراضي','Company default account')}/>}
      <div className="mt-2 flex gap-2"><Button disabled={busy} onClick={review}>{t('معاينة الحسابات والقيد','Preview accounts and journal')}</Button><Button variant="ghost" disabled={busy} onClick={()=>{setSelected(null);setPreview(null)}}>{t('إغلاق','Close')}</Button></div>
      {preview&&<><p className="mt-3 text-sm">{t('القيد المقترح بعملة الشركة','Proposed journal in company currency')} · {preview.currency}</p><table className="mt-2 w-full text-sm"><thead><tr><th className="p-2 text-start">{t('الحساب','Account')}</th><th>{t('مدين','Debit')}</th><th>{t('دائن','Credit')}</th></tr></thead><tbody>{preview.lines.map((l,i)=><tr key={i} className="border-t border-border"><td className="p-2">{l.accountCode} · {l.accountName}</td><td className="text-center">{amount(l.debit)}</td><td className="text-center">{amount(l.credit)}</td></tr>)}</tbody></table>
      <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>{t('راجعت الحسابات وتأكدت أن هذا الأثر غير مسجل بقيد يدوي أو افتتاحي سابق.','I reviewed the accounts and confirmed this effect is not already recorded in a manual or opening journal.')}</label>
      <Button className="mt-3" disabled={!confirmed||busy} onClick={approve}>{busy?t('جارٍ الاعتماد…','Approving…'):t('اعتماد وترحيل القيد','Approve and post journal')}</Button></>}
    </section>}
  </div>;
}
