import { useEffect, useState } from 'react';
import { api, type InboxMessageDetail } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

export function InboxReviewEditor({detail,onSaved,onDirty}:{detail:InboxMessageDetail;onSaved:()=>void;onDirty:(dirty:boolean)=>void}) {
  const {t}=useLanguage();
  const [notes,setNotes]=useState(detail.reviewNotes || '');
  const [editing,setEditing]=useState(false);
  const [ex,setEx]=useState<any>(()=>({issuer:{name:''},documentNumber:'',issueDate:new Date().toISOString().slice(0,10),currency:detail.extractedCurrency || '',...detail.extractedJson,lines:detail.extractedJson?.lines?.length ? detail.extractedJson.lines.map((l:any)=>({...l, unitPrice:(Number(l.unitPrice||0) - Number(l.discountAmount ?? l.discount ?? 0)/Number(l.quantity||1))/(l.taxInclusive ? 1+Number(l.taxRate||0) : 1), discountAmount:0, discount:0, taxInclusive:false})) : [{description:'',quantity:1,unitPrice:0,taxRate:0}]}));
  useEffect(()=>{onDirty(editing || notes !== (detail.reviewNotes || ''));},[editing,notes,detail.reviewNotes,onDirty]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const field=(label:string,value:string,change:(value:string)=>void,type='text')=><label className="space-y-1 text-xs">{label}<Input type={type} value={value??''} onChange={e=>change(e.target.value)} /></label>;
  const save=async()=>{
    setBusy(true);setError('');
    try {
      let extracted;
      if(editing){
        const lines=ex.lines.map((l:any)=>({...l,quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),taxRate:Number(l.taxRate||0), subtotal:Number(l.quantity)*Number(l.unitPrice), lineTotal:Number(l.quantity)*Number(l.unitPrice)*(1+Number(l.taxRate||0))}));
        const subtotal=lines.reduce((s:number,l:any)=>s+l.quantity*l.unitPrice,0),tax=lines.reduce((s:number,l:any)=>s+l.quantity*l.unitPrice*l.taxRate,0);
        extracted={...ex,issueDate:ex.issueDate?.slice(0,10),dueDate:ex.dueDate?.slice(0,10)||null,lines,totals:{subtotal,tax,total:Math.round((subtotal+tax)*100)/100}};
      }
      await api.inbox.review(detail.id,{notes,extracted});setEditing(false);onSaved();
    } catch {setError(t('تعذر الحفظ. تأكد من المورد والتاريخ والعملة والبنود.','Could not save. Check supplier, date, currency and lines.'));}
    finally{setBusy(false);}
  };
  return <section className="p-5 space-y-3" aria-label={t('مراجعة الرسالة','Message review')}>
    <label className="block text-sm">{t('ملاحظات المراجعة · تنتقل إلى المستند','Review notes · carried to the document')}<Textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2" /></label>
    {!editing && <Button variant="outline" onClick={()=>setEditing(true)}>{t('تعديل بيانات الفاتورة والبنود','Edit bill details and lines')}</Button>}
    {editing && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('هذه بيانات المسودة؛ نص الرسالة الأصلي محفوظ. أدخل أسعار البنود قبل الضريبة.','These are draft details; the original message is preserved. Enter line prices before tax.')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field(t('المورد','Supplier'),ex.issuer?.name,v=>setEx({...ex,issuer:{...ex.issuer,name:v}}))}
        {field(t('الرقم الضريبي للمورد','Supplier tax ID'),ex.issuer?.taxId,v=>setEx({...ex,issuer:{...ex.issuer,taxId:v}}))}
        {field(t('رقم المستند','Document number'),ex.documentNumber,v=>setEx({...ex,documentNumber:v}))}
        {field(t('تاريخ الإصدار','Issue date'),ex.issueDate,v=>setEx({...ex,issueDate:v}),'date')}
        {field(t('العملة مثل USD أو SAR','Currency e.g. USD or SAR'),ex.currency,v=>setEx({...ex,currency:v.toUpperCase()}))}
      </div>
      {ex.lines.map((l:any,i:number)=><div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded border border-border p-3">
        {field(t('الوصف','Description'),l.description,v=>setEx({...ex,lines:ex.lines.map((x:any,j:number)=>j===i?{...x,description:v}:x)}))}
        {field(t('الكمية','Quantity'),l.quantity,v=>setEx({...ex,lines:ex.lines.map((x:any,j:number)=>j===i?{...x,quantity:v}:x)}),'number')}
        {field(t('السعر قبل الضريبة','Price before tax'),l.unitPrice,v=>setEx({...ex,lines:ex.lines.map((x:any,j:number)=>j===i?{...x,unitPrice:v}:x)}),'number')}
        {field(t('الضريبة %','Tax %'),String(Number(l.taxRate||0)*100),v=>setEx({...ex,lines:ex.lines.map((x:any,j:number)=>j===i?{...x,taxRate:Number(v)/100}:x)}),'number')}
        <Button variant="ghost" onClick={()=>setEx({...ex,lines:ex.lines.filter((_:any,j:number)=>j!==i)})}>{t('إزالة البند','Remove line')}</Button>
      </div>)}
      <Button variant="outline" onClick={()=>setEx({...ex,lines:[...ex.lines,{description:'',quantity:1,unitPrice:0,taxRate:0}]})}>{t('إضافة بند','Add line')}</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div><Button disabled={busy} onClick={save}>{t('حفظ المراجعة','Save review')}</Button></div>
  </section>;
}
