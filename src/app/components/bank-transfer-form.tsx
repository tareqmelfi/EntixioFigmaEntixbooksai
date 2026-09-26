import { useState } from 'react';
import { api, BankAccount } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { useOrgRegion } from '../lib/use-org-region';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SearchableCombobox } from './searchable-combobox';
import { normalizeDigits } from '../lib/digits';

export function BankTransferForm({ accounts, onSaved }: { accounts: BankAccount[]; onSaved: () => void }) {
 const { t } = useLanguage(); const { currency } = useOrgRegion();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [fromId,setFrom]=useState(''),[toId,setTo]=useState(''),[sent,setSent]=useState(''),[received,setReceived]=useState(''),[base,setBase]=useState('');
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const from=accounts.find(a=>a.id===fromId),to=accounts.find(a=>a.id===toId);
 const nSent=Number(normalizeDigits(sent)),nReceived=Number(normalizeDigits(received));
 return <section className="rounded-xl border border-border p-4 space-y-3">
  <Button variant="outline" onClick={()=>setOpen(!open)} aria-expanded={open}>{t('تحويل بين حساباتي','Transfer between my accounts')}</Button>
  {open && <div className="space-y-3">
   <p className="text-sm text-muted-foreground">{t('أدخل المبلغ الخارج والمبلغ الذي وصل. يحسب السعر تلقائيًا ولا يُسجّل التحويل كمصروف أو إيراد.','Enter the amount sent and the amount received. The rate is calculated automatically; a transfer is not an expense or income.')}</p>
   <div className="grid gap-3 md:grid-cols-2">
    <div><label>{t('من الحساب','From account')}</label><SearchableCombobox value={fromId} onChange={setFrom} items={accounts.map(a=>({id:a.id,label:`${a.name} · ${a.currency}`}))} placeholder={t('حساب الإرسال','Sending account')}/></div>
    <div><label>{t('إلى الحساب','To account')}</label><SearchableCombobox value={toId} onChange={setTo} items={accounts.filter(a=>a.id!==fromId).map(a=>({id:a.id,label:`${a.name} · ${a.currency}`}))} placeholder={t('حساب الاستلام','Receiving account')}/></div>
    <label>{t('المبلغ الخارج','Amount sent')} {from?.currency}<Input aria-label="Amount sent" dir="ltr" inputMode="decimal" value={sent} onChange={e=>setSent(e.target.value)}/></label>
    <label>{t('المبلغ الواصل','Amount received')} {to?.currency}<Input aria-label="Amount received" dir="ltr" inputMode="decimal" value={received} onChange={e=>setReceived(e.target.value)}/></label>
    <label>{t('التاريخ','Date')}<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {from && to && from.currency!==currency && to.currency!==currency && <label>{t('القيمة بعملة الشركة','Value in company currency')} {currency}<Input dir="ltr" inputMode="decimal" value={base} onChange={e=>setBase(e.target.value)}/></label>}
   </div>
   {nSent>0 && nReceived>0 && <p dir="ltr">1 {from?.currency} = {(nReceived/nSent).toFixed(6)} {to?.currency}</p>}
   <details><summary className="text-sm cursor-pointer">{t('مقارنة بسعر مرجعي (للعرض فقط)','Compare with a reference rate (display only)')}</summary><TransferComparison sent={nSent} received={nReceived} from={from?.currency} to={to?.currency}/></details>
   {error && <p role="alert" className="text-danger">{error}</p>}
   <Button disabled={busy || !fromId || !toId || nSent<=0 || nReceived<=0} onClick={async()=>{
    setBusy(true);setError('');try{await api.bankAccounts.transfer({fromId,toId,sent:nSent,received:nReceived,date,requestId,...(base?{baseAmount:Number(normalizeDigits(base))}:{})});setOpen(false);setSent('');setReceived('');setRequestId(crypto.randomUUID());onSaved();}catch(e:any){setError(e.message);}finally{setBusy(false);}
   }}>{t('حفظ التحويل','Save transfer')}</Button>
  </div>}
 </section>;
}
function TransferComparison({sent,received,from,to}:{sent:number;received:number;from?:string;to?:string}) {
 const {t}=useLanguage();const [rate,setRate]=useState('');
 const reference=rate || (from==='USD'&&to==='SAR'?'3.75':from==='SAR'&&to==='USD'?String(1/3.75):'');
 return <div className="mt-2 space-y-2"><Input aria-label="Transfer reference rate" inputMode="decimal" value={reference} onChange={e=>setRate(normalizeDigits(e.target.value))}/>{Number(reference)>0 && <p>{t('الفرق عن المرجع','Difference from reference')}: {(received-sent*Number(reference)).toFixed(2)} {to}</p>}</div>;
}
