import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, getOrgId, type PostingReviewItem, type PostingReviewPreview } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';

type Review = { item: PostingReviewItem; preview?: PostingReviewPreview; error?: string; posted?: string; selected: boolean };
const paths: Record<string,string> = {invoice:'/app/invoices/',bill:'/app/purchases/bills/',expense:'/app/expenses/',receipt:'/app/receipts/',payment:'/app/payments/','pos-payment':'/app/invoices/','credit-note':'/app/credit-notes/'};

/** Uses the same signed, transactional review as individual recovery. Never records a payment. */
export function BatchPostingReview({from,to,onClose,onPosted}:{from?:string|null;to?:string;onClose:()=>void;onPosted?:()=>void}) {
  const {t}=useLanguage();
  const [rows,setRows]=useState<Review[]>([]),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
  const [progress,setProgress]=useState('');
  const running=useRef(false),active=useRef(true),scope=useRef(getOrgId());
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
  const valid=()=>active.current&&getOrgId()===scope.current;
  const message=(e:any)=>t(e.messageAr||e.message||'تعذر استكمال المستند',e.body?.messageEn||e.body?.message||e.message||'Document could not be completed');
  const update=(next:Review[])=>{if(valid())setRows([...next])};
  const previewAll=async()=>{
    if(running.current||!valid())return;
    running.current=true;setBusy(true);setError('');setConfirmed(false);setRows([]);
    const result:Review[]=[];
    try {
      const items:PostingReviewItem[]=[],seen=new Set<string>();let offset=0;
      // Collect before posting: mutations must never shift pagination underneath the batch.
      while(valid()){
        const page=await api.postingReview.list(from?.slice(0,10),to?.slice(0,10),offset);
        if(!valid())return;
        for(const item of page.items){const key=`${item.kind}:${item.id}`;if(!seen.has(key)){seen.add(key);items.push(item)}}
        offset+=page.items.length;
        if(!page.items.length||offset>=page.total)break;
      }
      // Invoices precede receipts so subsequent review can resolve their dependencies.
      items.sort((a,b)=>Number(b.kind==='invoice')-Number(a.kind==='invoice'));
      for(const item of items){
        if(!valid())return;
        setProgress(`${t('معاينة','Preview')} ${result.length+1} / ${items.length}`);
        const row:Review={item,selected:false};
        try {
          if(!['invoice','bill','expense','receipt','payment','pos-payment'].includes(item.kind))throw new Error(t('راجع القيد من صفحة المستند.','Review the journal from the document page.'));
          row.preview=await api.postingReview.preview(item.kind,item.id);
        }catch(e){row.error=message(e)}
        result.push(row);update(result);
      }
    }catch(e){if(valid())setError(message(e))}
    finally{running.current=false;if(valid()){setBusy(false);setProgress('')}}
  };
  const approve=async()=>{
    if(running.current||!valid()||!confirmed)return;
    running.current=true;setBusy(true);setError('');setConfirmed(false);
    const next=rows.map(row=>({...row}));
    try{
      for(const row of next){
        if(!valid())return;
        if(!row.selected||!row.preview||row.posted)continue;
        setProgress(`${t('ترحيل','Posting')} ${row.item.number}`);
        try{
          const posted=await api.postingReview.approve(row.item.kind,row.item.id,row.preview.reviewToken);
          if(!posted.ok||!posted.journalId)throw new Error(t('لم يؤكد النظام حفظ القيد.','The system did not confirm journal persistence.'));
          row.posted=posted.journalId;row.error=undefined;
        }catch(e){row.error=message(e)}
        // Tokens are single-attempt in this UI, including unknown network outcomes.
        // Re-preview checks persisted journals before any retry.
        row.preview=undefined;row.selected=false;update(next);
      }
    }finally{running.current=false;if(valid()){setBusy(false);setProgress('')}}
  };
  const eligible=rows.filter(row=>row.preview&&!row.posted),selected=eligible.filter(row=>row.selected).length;
  const posted=rows.filter(row=>row.posted).length,blocked=rows.filter(row=>row.error).length;
  const amount=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return <section aria-label={t('مراجعة الترحيل الجماعي','Batch posting review')} className="mt-3 border-t border-border pt-3">
    <p className="text-sm">{t('تُراجع جميع المستندات المعتمدة في الفترة المختارة. اختر القيود بعد مطابقتها مع الدفاتر؛ تبقى التواريخ والمبالغ والسداد كما هي.','Review all issued documents in the selected period. Select journals after reconciling them with the ledger; dates, amounts and payments are retained.')}</p>
    <div className="my-3 flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={previewAll}>{t('معاينة جميع المستندات','Preview all documents')}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(posted)onPosted?.();else onClose()}}>{posted?t('تحديث الدفاتر','Refresh books'):t('رجوع','Back')}</Button>
    </div>
    {error&&<p role="alert">{error}</p>}
    <p role="status" className="my-2 text-sm">{progress||`${t('جاهز للمراجعة','Ready to review')}: ${eligible.length} · ${t('تم الترحيل','Posted')}: ${posted} · ${t('يحتاج تصحيحًا','Needs correction')}: ${blocked}`}</p>
    {!!eligible.length&&<label className="my-2 flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={selected===eligible.length} onChange={e=>{setConfirmed(false);setRows(old=>old.map(row=>({...row,selected:!!row.preview&&!row.posted&&e.target.checked})))}}/>{t('تحديد جميع القيود الجاهزة','Select all ready journals')}</label>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[t('اختيار','Select'),t('المستند','Document'),t('المبلغ','Amount'),t('القيد المقترح أو سبب التعذر','Proposed journal or issue')].map(title=><th key={title} className="p-2 text-start">{title}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={`${row.item.kind}:${row.item.id}`} className="border-t border-border">
      <td className="p-2"><input aria-label={`${t('اختيار','Select')} ${row.item.number}`} type="checkbox" checked={row.selected} disabled={busy||!row.preview||!!row.posted} onChange={e=>{setConfirmed(false);setRows(old=>old.map(r=>r===row?{...r,selected:e.target.checked}:r))}}/></td>
      <td className="p-2"><Link className="underline" to={`${paths[row.item.kind]}${row.item.documentId||row.item.id}`}>{row.item.number}</Link><div>{row.item.date.slice(0,10)}</div></td>
      <td className="p-2"><bdi>{amount(row.item.total)} {row.item.currency}</bdi></td>
      <td className="p-2">{row.posted?<span>{t('مرحّل','Posted')} · <bdi>{row.posted}</bdi></span>:row.error?<span className="text-warning">{row.error}</span>:row.preview?<><div>{t('عملة القيد','Journal currency')}: {row.preview.currency}</div>{row.preview.lines.map((line,i)=><div key={i}>{line.accountCode} · {line.accountName} · {t('مدين','Debit')} {amount(line.debit)} · {t('دائن','Credit')} {amount(line.credit)}</div>)}</>:null}</td>
    </tr>)}</tbody></table></div>
    {!!eligible.length&&<><label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy||!selected} onChange={e=>setConfirmed(e.target.checked)}/>{t('راجعت القيود المحددة وتأكدت أن أثرها غير مسجل بقيد يدوي أو افتتاحي سابق.','I reviewed the selected journals and confirmed their effect is not recorded in an existing manual or opening journal.')}</label>
      <Button disabled={busy||!confirmed||!selected} onClick={approve}>{t('ترحيل القيود المحددة','Post selected journals')} ({selected})</Button></>}
  </section>;
}
