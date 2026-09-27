import { useEffect, useMemo, useState } from 'react';
import { api, bootstrapOrgIdFromStorage, getOrgId, type ReportPayload } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { ReportOutput } from './report-output';
import { normalizeReportSettings } from './report-document';
import { Button } from './ui/button';

/** Read-only output of saved credit-note amounts, using the common paginated PDF engine. */
export function CreditNoteOutput({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    bootstrapOrgIdFromStorage();
    const orgId = getOrgId();
    setReport(null); setError('');
    void (async () => {
      try {
        if (!orgId) throw new Error('scope');
        const [note, org] = await Promise.all([api.creditNotes.get(id), api.orgs.get(orgId)]);
        if (cancelled) return;
        if (getOrgId() !== orgId || note.orgId !== orgId || org.id !== orgId) throw new Error('scope');
        const status: Record<string,string> = { DRAFT:t('مسودة','Draft'), ISSUED:t('صادر','Issued'), APPLIED:t('مطبّق','Applied'), CANCELLED:t('ملغى','Cancelled') };
        const reasons: Record<string,string> = { RETURN:t('إرجاع بضاعة','Goods return'), DISCOUNT:t('خصم تجاري','Trade discount'), PRICING_ERROR:t('تصحيح خطأ تسعير','Pricing correction'), QUALITY_ISSUE:t('مشكلة جودة','Quality issue'), OTHER:t('أخرى','Other') };
        setReport({ id:note.noteNumber, title:`إشعار دائن · ${note.noteNumber}`, englishTitle:`Credit note · ${note.noteNumber}`,
          description:[note.contact?.displayName, status[note.status] || note.status].filter(Boolean).join(' · '),
          category:'sales',status:'live',generatedAt:new Date().toISOString(),period:{from:null,to:note.issueDate.slice(0,10)},currency:note.currency,org,summary:{},
          sections:[{id:'identity',title:t('بيانات الإشعار','Credit note details'),columns:[{key:'label',label:t('البيان','Field')},{key:'detail',label:t('التفاصيل','Details')}],rows:[
            {id:'customer',label:'',values:{label:t('العميل','Customer'),detail:note.contact?.displayName||'—'}},
            {id:'tax',label:'',values:{label:t('الرقم الضريبي للعميل','Customer tax ID'),detail:note.contact?.vatNumber||'—'}},
            {id:'source',label:'',values:{label:t('الفاتورة الأصلية','Original invoice'),detail:note.originalInvoice?.invoiceNumber||'—'}},
            {id:'reason',label:'',values:{label:t('السبب','Reason'),detail:reasons[note.reason]||note.reason}},
          ]},{id:'lines',title:t('البنود','Line items'),columns:[{key:'label',label:t('الوصف','Description')},{key:'quantity',label:t('الكمية','Quantity'),kind:'number'},{key:'price',label:t('السعر','Price'),kind:'money'},{key:'amount',label:t('قبل الضريبة','Before tax'),kind:'money'}],rows:(note.lines||[]).map((line:any)=>({id:line.id,label:line.description,values:{label:line.description,quantity:Number(line.quantity),price:Number(line.unitPrice),amount:Number(line.subtotal)}}))},
          {id:'totals',title:t('الإجمالي','Totals'),columns:[{key:'label',label:t('البيان','Description')},{key:'amount',label:t('المبلغ','Amount'),kind:'money'}],rows:[
            {id:'subtotal',label:'',values:{label:t('قبل الضريبة','Before tax'),amount:Number(note.subtotal)}},
            {id:'tax',label:'',values:{label:t('الضريبة','Tax'),amount:Number(note.taxTotal)}},
            {id:'total',label:'',values:{label:t('الإجمالي','Total'),amount:Number(note.total)}},
          ]}],notices:note.notes?[note.notes]:[],
        });
      } catch { if (!cancelled) setError(t('تعذر تحميل الإشعار من الشركة المختارة. أعد فتحه وحاول مجددًا.','Could not load the saved credit note for this company. Reopen it and retry.')); }
    })();
    return () => { cancelled = true; };
  },[id,language]);
  const printSettings = useMemo(() => normalizeReportSettings({...(report?.org.paymentSettings?.reports||{}),language,bilingual:false}), [report, language]);
  return <div className="space-y-4"><Button variant="outline" onClick={onClose}>{t('الرجوع إلى الإشعار','Back to credit note')}</Button>{error?<p role="alert">{error}</p>:report?<ReportOutput report={report} settings={printSettings}/>:<p role="status">{t('تجهيز الإشعار…','Preparing credit note…')}</p>}</div>;
}
