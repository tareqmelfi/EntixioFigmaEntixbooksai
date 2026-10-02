import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
const fields = [
  ['addressLine', 'العنوان', 'Address'], ['buildingNumber', 'رقم المبنى', 'Building number'],
  ['streetName', 'الشارع', 'Street'], ['district', 'الحي', 'District'],
  ['city', 'المدينة', 'City'], ['region', 'المنطقة', 'Region'], ['postalCode', 'الرمز البريدي', 'Postal code'],
] as const;
export function BillingAddressPanel({ orgId }: { orgId: string }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Record<string,string>>({});
  const [ready,setReady] = useState(false); const [busy,setBusy] = useState(false);
  const [error,setError] = useState(''); const [saved,setSaved] = useState(false);
  useEffect(() => { let active=true; setReady(false); api.orgs.get(orgId).then(org => {
    if(active) { setForm(Object.fromEntries(fields.map(([key])=>[key,String((org as any)[key] || '')])));setReady(true); }
  }).catch(()=>active && setError(t('تعذر تحميل العنوان. أعد فتح الصفحة.', 'Could not load address. Reload the page.'))); return()=>{active=false}; },[orgId]);
  return <section className="border-t border-border pt-4 space-y-3" aria-label={t('عنوان الفوترة', 'Billing address')}>
    <h3 className="font-semibold">{t('عنوان الفوترة', 'Billing address')}</h3>
    <p className="text-xs text-muted-foreground">{t('أدخل العنوان المتحقق منه كما يظهر في مستندات المنشأة. عنوان المشتري يُعدّل من ملف العميل.', 'Enter the verified organization address. Edit the buyer address from their contact profile.')} <Link className="underline" to="/app/contacts">{t('جهات الاتصال', 'Contacts')}</Link></p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{fields.map(([key,ar,en])=><label key={key} className="space-y-1 text-xs">{t(ar,en)}<Input disabled={!ready || busy} value={form[key] || ''} onChange={e=>{setSaved(false);setForm({...form,[key]:e.target.value})}} /></label>)}</div>
    {error && <p role="alert" className="text-danger text-sm">{error}</p>}
    {saved && <p role="status" className="text-success text-sm">{t('حُفظ العنوان وتم التحقق منه.', 'Address saved and verified.')}</p>}
    <Button size="sm" variant="outline" disabled={!ready || busy} onClick={async()=>{
      setBusy(true);setError('');setSaved(false);
      try {const payload=Object.fromEntries(fields.map(([key])=>[key,form[key]?.trim() || null]));await api.orgs.update(orgId,payload);const read=await api.orgs.get(orgId);if(fields.some(([key])=>((read as any)[key] || null)!==payload[key]))throw Error('readback');setSaved(true);}
      catch {setError(t('لم يثبت حفظ العنوان. القيم باقية لإعادة المحاولة.', 'Address save could not be verified. Your input is retained.'));}
      finally {setBusy(false)}
    }}>{t('حفظ عنوان الفوترة', 'Save billing address')}</Button>
  </section>;
}
