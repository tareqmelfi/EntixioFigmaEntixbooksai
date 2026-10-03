import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, getOrgId, type Invoice } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { FullPageForm } from './full-page-form';
import { Button } from './ui/button';
import { SearchableCombobox } from './searchable-combobox';
import { displayName } from '../lib/display-name';
import { parseDocumentDate } from '../lib/document-date';
import { normalizeDigits } from '../lib/digits';
import { humanizeError } from '../lib/error-messages';
import { useFormDraft } from '../lib/form-draft';

class GridValidationError extends Error {}

type Policy = { canEditDraft?: boolean; canAmend: boolean; canEditNotes?: boolean; canReclassify?: boolean; periodLocked?: boolean; reason?: string | null };
type Row = { original: Invoice; policy: Policy; value: any; error?: string; saved?: boolean };
const snapshot = (inv: Invoice) => ({ issueDate: inv.issueDate?.slice(0,10) || '', supplyDate: inv.supplyDate?.slice(0,10) || '', dueDate: inv.dueDate?.slice(0,10) || '', notes: inv.notes || '', termsConditions: inv.termsConditions || '', lines: (inv.lines || []).map((l:any) => ({ ...l, quantity: String(l.quantity), unitPrice: String(l.unitPrice), accountId: l.accountId || '' })) });
const changed = (r: Row) => JSON.stringify(r.value) !== JSON.stringify(snapshot(r.original));

/** One server transaction per invoice. Successful rows are not resent on retry. */
export function InvoiceGridEditor({ ids, accounts, onClose }: { ids: string[]; accounts: any[]; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadedAccounts, setLoadedAccounts] = useState(accounts);
  const orgId = getOrgId();
  useEffect(() => {
    let live = true; setError(''); setRows(null);
    Promise.all([api.accounts.list(), Promise.all(ids.map(async id => { const [original, policy] = await Promise.all([api.invoices.get(id), api.invoices.amendmentPolicy(id)]); return { original, policy, value: snapshot(original) }; }))])
      .then(([chart, values]) => { if (live && getOrgId() === orgId) { setLoadedAccounts(chart.items); setRows(values); } })
      .catch(e => { if (live) setError(humanizeError(e, language)); });
    return () => { live = false; };
  }, [ids, retry, orgId]);
  if (!rows) return <FullPageForm title={t('تعديل الفواتير', 'Edit invoices')} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>{t('رجوع','Back')}</Button>}>
    {error ? <div role="alert">{error}<Button onClick={() => setRetry(v=>v+1)}>{t('إعادة المحاولة','Retry')}</Button></div> : <p role="status">{t('تحميل الفواتير وصلاحيات التعديل…','Loading invoices and editing permissions…')}</p>}
  </FullPageForm>;
  return <Grid key={`${orgId}:${retry}`} initial={rows} accounts={loadedAccounts} onClose={onClose} orgId={orgId} />;
}

function Grid({ initial, accounts, onClose, orgId }: { initial: Row[]; accounts: any[]; onClose: () => void; orgId: string | null }) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [summary, setSummary] = useState('');
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState<'documents'|'lines'>('documents');
  const draft = useFormDraft({ key: `invoice-grid:${initial.map(r=>r.original.id).sort().join(',')}`, open: true, snapshot: { rows, reason }, restore: saved => { setRows(saved.rows); setReason(saved.reason || ''); } });
  const dirtyRows = rows.filter(changed);
  const editable = (r: Row) => !!(r.policy.canEditDraft || r.policy.canAmend);
  const update = (id: string, field: string, value: string, line?: number) => setRows(rs => rs.map(r => r.original.id !== id ? r : { ...r, saved: false, error: '', value: line === undefined ? { ...r.value, [field]: value } : { ...r.value, lines: r.value.lines.map((l:any,i:number) => i === line ? { ...l, [field]: value } : l) } }));
  const labels: Record<string,[string,string]> = { issueDate:['الإصدار','Issue date'], supplyDate:['التوريد','Supply date'], dueDate:['الاستحقاق','Due date'], notes:['الملاحظات','Notes'], termsConditions:['الشروط','Terms'], description:['الوصف','Description'], quantity:['الكمية','Quantity'], unitPrice:['السعر','Unit price'] };
  const documentFields = ['issueDate','supplyDate','dueDate','notes','termsConditions'];
  const lineFields = ['description','quantity','unitPrice'];
  const canField = (r: Row, f: string) => ['notes','termsConditions'].includes(f) ? !!r.policy.canEditNotes : editable(r);
  // Rectangular Excel paste follows visible columns and never writes a protected cell.
  const paste = (event: React.ClipboardEvent<HTMLInputElement>, ri: number, ci: number, line?: number) => {
    const text = event.clipboardData.getData('text/plain');
    if (!/[\t\n]/.test(text)) return;
    event.preventDefault();
    const matrix = text.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(x=>x.split('\t'));
    setRows(current => current.map((r, i) => {
      if (line === undefined) {
        const values = matrix[i-ri]; if (!values) return r;
        const value = { ...r.value };
        values.forEach((v,j) => { const f=documentFields[ci+j]; if (f && canField(r,f)) value[f]=v; });
        return { ...r, value, saved:false, error:'' };
      }
      if (i !== ri || !editable(r)) return r;
      return { ...r, saved:false, error:'', value:{ ...r.value, lines:r.value.lines.map((l:any,li:number) => { const values=matrix[li-line]; if(!values)return l; const next={...l}; values.forEach((v,j)=>{const f=lineFields[ci+j];if(f)next[f]=v;});return next; }) } };
    }));
  };
  const save = async () => {
    if (saving.current) return false;
    saving.current = true; setBusy(true); setSummary('');
    let failed=0, success=0;
    try {
      for (const r of rows.filter(changed)) {
        try {
          if (getOrgId() !== orgId) throw new GridValidationError(t('تغيرت الشركة؛ افتح الجدول من الشركة الصحيحة.','Company changed. Reopen the editor in the correct company.'));
          const original = r.original, v = r.value;
          const expectedUpdatedAt = original.updatedAt;
          if (!expectedUpdatedAt) throw new GridValidationError(t('أعد تحميل الفاتورة للحصول على نسختها الحالية.','Reload the invoice to get its current version.'));
          const accountsChanged = v.lines.filter((l:any) => l.accountId !== ((original.lines?.find(x=>x.id===l.id) as any)?.accountId || '')).map((l:any)=>({lineId:l.id,accountId:l.accountId}));
          const text = { notes:v.notes || null, termsConditions:v.termsConditions || null };
          const base = snapshot(original);
          const contentChanged = documentFields.slice(0,3).some(f=>v[f]!==base[f as keyof typeof base]) || v.lines.some((l:any,i:number)=>lineFields.some(f=>String(l[f])!==String(base.lines[i]?.[f])));
          let result:any;
          if (original.status === 'DRAFT' || contentChanged) {
            if (!editable(r)) throw new GridValidationError(t('هذه الحقول محمية؛ عدّل الملاحظات أو الحسابات المتاحة فقط.','These fields are protected. Edit only the available notes or accounts.'));
            const issueDate=parseDocumentDate(v.issueDate), dueDate=parseDocumentDate(v.dueDate), supplyDate=v.supplyDate.trim()?parseDocumentDate(v.supplyDate):null;
            if (!issueDate || !dueDate || (v.supplyDate.trim() && !supplyDate) || dueDate < issueDate) throw new GridValidationError(t('راجع تواريخ الإصدار والتوريد والاستحقاق؛ الاستحقاق لا يسبق الإصدار.','Review the dates; due date cannot precede issue date.'));
            const lines=v.lines.map((l:any)=>{ const quantity=Number(normalizeDigits(l.quantity)),unitPrice=Number(normalizeDigits(l.unitPrice)); if(!l.description.trim() || !Number.isFinite(quantity) || quantity<=0 || !Number.isFinite(unitPrice) || unitPrice<0)throw new GridValidationError(t('راجع وصف البنود والكمية والسعر.','Review line descriptions, quantities and prices.')); return {...l,quantity,unitPrice}; });
            const dates={issueDate,dueDate,supplyDate};
            if (original.status==='DRAFT') result=await api.invoices.update(original.id, { expectedUpdatedAt, ...dates,...text,lines:lines.map((l:any)=>({description:l.description,quantity:l.quantity,unitPrice:l.unitPrice,accountId:l.accountId||null,productId:l.productId||null,taxRateId:l.taxRateId||null,taxInclusive:!!l.taxInclusive,discount:Number(l.discount||0),recognitionStartDate:l.recognitionStartDate||null,recognitionMonths:l.recognitionMonths||null,deferredRevenueAccountId:l.deferredRevenueAccountId||null})) } as any);
            else result=await api.invoices.amend(original.id,{ expectedUpdatedAt, reason:reason.trim() || 'Edit invoice from the invoice table',...dates,...text,accounts:accountsChanged,lines:lines.map((l:any)=>({id:l.id,description:l.description,quantity:l.quantity,unitPrice:l.unitPrice})) } as any);
          } else {
            if (!r.policy.canEditNotes || (accountsChanged.length && !r.policy.canReclassify)) throw new GridValidationError(t('لا تملك صلاحية هذا التعديل.','This change is not permitted.'));
            const saved=await api.invoices.updateNotes(original.id,{expectedUpdatedAt,reason:reason.trim(),...text,accounts:accountsChanged} as any);
            result={...original,...saved,lines:v.lines};
          }
          // Retain tax/recognition metadata when the draft PATCH returns compact lines.
          result.lines=(result.lines||[]).map((l:any,i:number)=>({...r.value.lines[i],...l}));
          setRows(rs=>rs.map(x=>x.original.id===original.id?{...x,original:result,value:snapshot(result),saved:true,error:''}:x));
          success++;
        } catch(e) {
          failed++;
          const message=e instanceof GridValidationError ? e.message : humanizeError(e,language,{ar:'لم تُحفظ هذه الفاتورة؛ راجع الحقول وأعد المحاولة.',en:'This invoice was not saved. Review the fields and retry.'});
          setRows(rs=>rs.map(x=>x.original.id===r.original.id?{...x,error:message}:x));
        }
      }
      setSummary(t(`تم حفظ ${success} · لم تُحفظ ${failed}.`, `Saved ${success} · Not saved ${failed}.`));
      if (!failed) draft.clear();
      return failed===0;
    } finally { saving.current=false;setBusy(false); }
  };
  const cellClass='h-9 w-full min-w-24 rounded-sm border border-border/60 bg-card px-2 text-sm disabled:bg-muted/40 disabled:text-muted-foreground';
  const input = (r:Row, ri:number, field:string, ci:number, li?:number) => <input className={cellClass} aria-label={`${t(...labels[field])} ${r.original.invoiceNumber}${li===undefined?'':` ${li+1}`}`} value={li===undefined?r.value[field]:r.value.lines[li][field]} disabled={busy||!canField(r,field)} onChange={e=>update(r.original.id,field,e.target.value,li)} onPaste={e=>paste(e,ri,ci,li)} dir={field.includes('Date')||['quantity','unitPrice'].includes(field)?'ltr':undefined} />;
  return <FullPageForm title={t('تعديل الفواتير في جدول','Edit invoices in a table')} subtitle={t('تنقّل بـ Tab والصق خلايا Excel. تُحفظ كل فاتورة مستقلة، وتبقى التعديلات غير المحفوظة للمراجعة.','Use Tab and paste Excel cells. Each invoice saves independently; unsuccessful edits stay here for review.')} onClose={onClose} disableEscape={busy} draft={draft} onSaveBeforeLeave={save} footer={requestClose => <div className="flex gap-2 items-center"><Button disabled={busy||!dirtyRows.length} onClick={save}>{busy?t('جارٍ الحفظ…','Saving…'):t(`حفظ التعديلات (${dirtyRows.length})`,`Save changes (${dirtyRows.length})`)}</Button><Button variant="outline" disabled={busy} onClick={requestClose}>{t('رجوع للقائمة','Back to list')}</Button><span role="status" className="text-xs">{summary}</span></div>}>
    <div className="space-y-3">
      <div className="flex gap-2"><Button variant={tab==='documents'?'default':'outline'} onClick={()=>setTab('documents')}>{t('بيانات الفواتير','Invoice details')}</Button><Button variant={tab==='lines'?'default':'outline'} onClick={()=>setTab('lines')}>{t('البنود والحسابات','Lines and accounts')}</Button></div>
      {rows.map(r=><div key={r.original.id} className="text-xs flex flex-wrap gap-2" data-testid={`grid-status-${r.original.id}`}><bdi>{r.original.invoiceNumber}</bdi><span>{r.policy.canEditDraft?t('مسودة · التعديل الكامل متاح من محرر الفاتورة','Draft · full editing available in the invoice editor'):r.policy.canAmend?t('متاح تعديل التواريخ والبنود والملاحظات والحسابات','Dates, lines, notes and accounts can be edited'):t('تعديل محدود · الحقول المحمية معطلة','Limited editing · protected fields are disabled')}</span>{['zatca_record','saudi_issued_invoice'].includes(r.policy.reason||'')&&<span>{t('مرتبط بالفوترة الإلكترونية؛ أصل الفاتورة محمي.','Linked to e-invoicing; original invoice fields are protected.')}</span>}{r.policy.periodLocked&&<Link to="/app/fiscal-periods" className="text-primary underline">{t('الفترة مقفلة · فتح الفترات','Period locked · Open periods')}</Link>}{r.saved&&<span className="text-success">✓ {t('محفوظة','Saved')}</span>}{r.error&&<span role="alert" className="text-warning">{r.error}</span>}</div>)}
      <div className="overflow-x-auto border border-border rounded-lg">
      {tab==='documents'?<table className="w-full min-w-[1150px] text-sm"><thead><tr>{[t('الفاتورة / العميل','Invoice / customer'),...documentFields.map(f=>t(...labels[f]))].map(h=><th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>{rows.map((r,ri)=><tr key={r.original.id} className="border-t border-border"><td className="p-2 min-w-48"><bdi>{r.original.invoiceNumber}</bdi><div className="text-xs text-muted-foreground">{r.original.contact?.displayName} · {r.original.currency}</div></td>{documentFields.map((f,ci)=><td key={f} className="p-1 min-w-40">{input(r,ri,f,ci)}</td>)}</tr>)}</tbody></table>:<table className="w-full min-w-[1050px] text-sm"><thead><tr>{[t('الفاتورة','Invoice'),...lineFields.map(f=>t(...labels[f])),t('حساب الإيراد','Revenue account'),t('الضريبة والخصم','Tax and discount')].map(h=><th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>{rows.flatMap((r,ri)=>r.value.lines.map((l:any,li:number)=><tr key={`${r.original.id}:${l.id}`} className="border-t border-border"><td className="p-2"><bdi>{r.original.invoiceNumber}</bdi><div className="text-xs">{li+1} · {r.original.currency}</div></td>{lineFields.map((f,ci)=><td key={f} className={`p-1 ${f==='description'?'min-w-64':'w-28'}`}>{input(r,ri,f,ci,li)}</td>)}<td className="p-1 min-w-56"><SearchableCombobox value={l.accountId} disabled={busy||!(r.policy.canEditDraft||r.policy.canReclassify)} onChange={id=>update(r.original.id,'accountId',id,li)} items={accounts.filter(a=>a.isActive!==false&&a.allowPosting!==false&&['REVENUE','INCOME'].includes(a.type)).map(a=>({id:a.id,label:displayName(a,language),sublabel:a.code}))} placeholder={t('اختر حساب الإيراد','Choose revenue account')} /></td><td className="p-2 text-xs"><bdi>{Number(l.taxRate?.rate||0)*100}% · {Number(l.discount||0)} {r.original.currency}</bdi></td></tr>))}</tbody></table>}
      </div>
      <label className="block text-xs">{t('ملاحظة سجل التعديل — اختياري','Audit note — optional')}<input className={`${cellClass} mt-1 max-w-lg block`} value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>
      <p className="text-xs text-muted-foreground">{t('رقم الفاتورة والعميل والعملة والضريبة محفوظة في هذا الجدول. المسودة تقبل تعديلها كاملًا من محرر الفاتورة، ولا تحتاج سببًا.','Invoice number, customer, currency and tax are preserved in this table. Drafts allow full editing in the invoice editor without a reason.')}</p>
    </div>
  </FullPageForm>;
}
