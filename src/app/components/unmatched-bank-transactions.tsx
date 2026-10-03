import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { SectionHeader } from './product';
import { SearchableCombobox } from './searchable-combobox';
import { api, getOrgId } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { displayLocale } from '../lib/number-display';
import { displayName } from '../lib/display-name';
import { humanizeError } from '../lib/error-messages';
import { normalizeDigits } from '../lib/digits';

type Tx={id:string;date:string;description:string;amount:number;currency:string;reference:string|null;status:string};
type Mode='document'|'account'|'transfer';
export function UnmatchedBankTransactions({bankAccountId,onChanged}:{bankAccountId:string;onChanged?:()=>void}) {
 const {t,language}=useLanguage();const [rows,setRows]=useState<Tx[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const revision=useRef(0);
 const refresh=useCallback(async()=>{const n=++revision.current;setLoading(true);setError('');try{const d=await api.bankImport.transactions({bankAccountId,status:'UNMATCHED',limit:200});if(n===revision.current)setRows(d.transactions||[]);}catch(e){if(n===revision.current)setError(humanizeError(e,language));}finally{if(n===revision.current)setLoading(false);}},[bankAccountId,language]);
 useEffect(()=>{setRows([]);refresh();return()=>{revision.current++;};},[refresh]);
 if(!loading&&!rows.length&&!error)return null;
 return <section className="space-y-3" data-testid="unmatched-bank-transactions">
  <SectionHeader title={<>{t('حركات بانتظار المراجعة','Transactions to review')} · {rows.length}</>} actions={<Button size="sm" variant="outline" onClick={refresh}>{t('تحديث','Refresh')}</Button>}/>
  <p className="text-xs text-muted-foreground">{t('طابق مع قيد أو فاتورة، أو اختر حسابًا لإنشاء قيد. الاقتراحات لا تُحفظ حتى تؤكدها.','Match an existing entry or invoice, or choose an account to post a new entry. Suggestions are saved only after your confirmation.')}</p>
  {error&&<p role="alert" className="text-warning">{error}</p>}
  {loading?<Loader2 className="h-5 w-5 animate-spin"/>:<div className="ledger-table overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr>{[t('التاريخ','Date'),t('البيان','Description'),t('المبلغ','Amount'),t('المطابقة أو الحساب','Match or account'),t('إجراء','Action')].map(h=><th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>
   {rows.map(tx=><ReviewRow key={`${bankAccountId}:${tx.id}`} tx={tx} onSaved={()=>{setRows(rs=>rs.filter(r=>r.id!==tx.id));onChanged?.();}}/>)}
  </tbody></table></div>}
  <p className="text-xs text-muted-foreground">{t('المعروض حتى 200 حركة. عند حفظ تصنيف مع تفعيل «تذكّر اختياري» يُقترح الحساب نفسه للوصف والاتجاه المطابقين؛ وما لا يُعرف يبقى فارغًا.','Up to 200 movements are shown. Remembering a classification suggests the same account for the matching description and direction; unknown movements stay blank.')}</p>
 </section>;
}
function ReviewRow({tx,onSaved}:{tx:Tx;onSaved:()=>void}) {
 const {t,language}=useLanguage();const orgId=useRef(getOrgId());const element=useRef<HTMLTableRowElement>(null),saving=useRef(false),loadingRef=useRef(false),mounted=useRef(true);
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [mode,setMode]=useState<Mode>('document'),[choice,setChoice]=useState(''),[learn,setLearn]=useState(true),[base,setBase]=useState(''),[counterpart,setCounterpart]=useState('');
 const load=async()=>{if(loadingRef.current)return;loadingRef.current=true;setLoading(true);setError('');try{const d:any=await api.bankImport.suggestions(tx.id);if(!mounted.current||orgId.current!==getOrgId())return;setData(d);if(d.match?.id){setMode(d.match.type==='account'?'account':d.match.type==='transfer'?'transfer':'document');setChoice(['account','transfer'].includes(d.match.type)?d.match.id:`${d.match.type}:${d.match.id}`);}}catch(e){if(mounted.current)setError(humanizeError(e,language));}finally{loadingRef.current=false;if(mounted.current)setLoading(false);}};
 useEffect(()=>{mounted.current=true;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'200px'});if(element.current)observer.observe(element.current);return()=>{mounted.current=false;observer.disconnect();};},[]);
 const accounts=(data?.accounts||[]).filter((a:any)=>!(data?.banks||[]).some((b:any)=>b.accountId===a.id));
 const docs=data?.options||[];const bank=(data?.banks||[]).find((b:any)=>b.id===choice);
 const chosen=mode==='document'?docs.find((o:any)=>`${o.kind}:${o.id}`===choice):mode==='account'?accounts.find((a:any)=>a.id===choice):bank;
 const foreign=!!data&&tx.currency!==data.baseCurrency;
 const creates=mode!=='document'||chosen?.kind!=='journal';
 const items=mode==='account'?accounts.map((a:any)=>({id:a.id,label:displayName(a,language),sublabel:a.code})):mode==='transfer'?(data?.banks||[]).map((b:any)=>({id:b.id,label:`${b.name} · ${b.currency}`})):docs.map((o:any)=>({id:`${o.kind}:${o.id}`,label:`${o.score>=65?'★ ':''}${o.label} · ${o.contactName||t(o.kind==='journal'?'قيد مسجّل':'فاتورة',o.kind==='journal'?'Posted entry':'Invoice')}`,sublabel:`${Number(o.outstanding).toLocaleString(displayLocale(),{minimumFractionDigits:2,maximumFractionDigits:2})} ${tx.currency} · ${String(o.date).slice(0,10)}`}));
 const act=async(ignore=false)=>{
  if(saving.current||orgId.current!==getOrgId())return;saving.current=true;setBusy(true);setError('');
  try{const action=ignore?'ignore':mode==='account'?'categorize':mode==='transfer'?'transfer':chosen.kind==='journal'?'link_journal':chosen.kind==='invoice'?'settle_invoice':'settle_bill';
   await api.bankImport.match(tx.id,{action,targetId:ignore?undefined:mode==='account'?undefined:chosen.id,accountId:mode==='account'?choice:undefined,learn, ...(base?{baseAmount:Number(normalizeDigits(base))}:{}),...(counterpart?{counterpartAmount:Number(normalizeDigits(counterpart))}:{})} as any);if(mounted.current)onSaved();
  }catch(e){if(mounted.current)setError(humanizeError(e,language));}finally{saving.current=false;if(mounted.current)setBusy(false);}
 };
 return <tr ref={element} className="border-t border-border/60 align-top" data-testid={`bank-review-${tx.id}`}>
  <td className="p-2 whitespace-nowrap"><bdi>{tx.date.slice(0,10)}</bdi></td>
  <td className="p-2 max-w-64"><p className="break-words">{tx.description}</p>{tx.reference&&<small className="text-muted-foreground">{tx.reference}</small>}</td>
  <td className={`p-2 whitespace-nowrap tabular-nums ${tx.amount>=0?'text-success':'text-warning'}`}><bdi>{tx.amount>0?'+':''}{tx.amount.toLocaleString(displayLocale(),{minimumFractionDigits:2,maximumFractionDigits:2})} {tx.currency}</bdi></td>
  <td className="p-2 min-w-80 space-y-2">
   {loading?<span className="text-xs">{t('جارٍ اقتراح المطابقات…','Loading suggestions…')}</span>:!data?<Button size="sm" variant="outline" onClick={load}>{t('إعادة تحميل الخيارات','Reload choices')}</Button>:<>
    <select aria-label={t('طريقة المعالجة','Treatment')} className="h-8 rounded border border-border bg-card text-xs px-2" value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as Mode);setChoice('');setError('');}}><option value="document">{t('فاتورة أو قيد موجود','Invoice or existing entry')}</option><option value="account">{t('حساب محاسبي','Ledger account')}</option><option value="transfer">{t('تحويل بين حساباتي','Transfer between my accounts')}</option></select>
    <SearchableCombobox value={choice} onChange={setChoice} items={items} disabled={busy} placeholder={t('اختر…','Choose…')}/>
    {chosen&&<p className="text-xs text-muted-foreground">{mode==='document'&&chosen.kind==='journal'?t('مطابقة فقط · لن يُنشأ قيد أو مبلغ إضافي.','Match only · no additional entry or amount.'):mode==='account'?t(tx.amount>0?'مدين: البنك · دائن: الحساب المختار. ينشئ قيدًا جديدًا.':'مدين: الحساب المختار · دائن: البنك. ينشئ قيدًا جديدًا.',tx.amount>0?'Debit bank · credit selected account. Creates a new entry.':'Debit selected account · credit bank. Creates a new entry.'):mode==='transfer'?t('ينشئ تحويلًا بين البنكين؛ عند وصول الحركة الأخرى طابقها بالقيد الموجود.','Creates a transfer between both banks; match the other statement movement to the existing entry.'):t('ينشئ سند سداد وقيده ويربطه بالفاتورة.','Creates a settlement voucher and journal linked to the invoice.')}</p>}
    {mode!=='document'&&<label className="flex gap-2 text-xs"><input type="checkbox" checked={learn} onChange={e=>setLearn(e.target.checked)} disabled={busy}/>{t('تذكّر اختياري','Remember my choice')}</label>}
    {creates&&foreign&&mode!=='document'&&<label className="block text-xs">{t('القيمة بعملة الشركة','Value in company currency')} ({data.baseCurrency})<input aria-label="Base amount" inputMode="decimal" className="block h-8 border border-border rounded bg-card px-2" value={base} onChange={e=>setBase(e.target.value)} disabled={busy}/></label>}
    {mode==='transfer'&&bank&&bank.currency!==tx.currency&&<label className="block text-xs">{t('مبلغ الحساب الآخر','Other account amount')} ({bank.currency})<input aria-label="Other account amount" inputMode="decimal" className="block h-8 border border-border rounded bg-card px-2" value={counterpart} onChange={e=>setCounterpart(e.target.value)} disabled={busy}/></label>}
   </>}
   {error&&<p role="alert" className="text-xs text-warning">{error}</p>}
   {error&&<Link to="/app/fiscal-periods" className="text-xs underline">{t('الفترات المالية','Fiscal periods')}</Link>}
  </td>
  <td className="p-2 space-y-2"><Button size="sm" disabled={busy||!chosen||loading} onClick={()=>act()}>{busy?<Loader2 className="h-3 w-3 animate-spin"/>:t('تأكيد','Confirm')}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>act(true)}>{t('تجاهل','Ignore')}</Button></td>
 </tr>;
}
