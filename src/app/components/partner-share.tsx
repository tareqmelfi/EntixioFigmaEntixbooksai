import { useId, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { trackPartnerEvent } from '../lib/consent-analytics';

// A public product link, deliberately not a personalized attribution code.
export const PARTNER_SHARE_URL = 'https://entix.io/';

export function PartnerShare() {
  const { t } = useLanguage();
  const id = useId();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PARTNER_SHARE_URL);
      setCopyState('copied');
      trackPartnerEvent('partner_link_copied');
    } catch {
      setCopyState('manual');
    }
  }
  return <section aria-labelledby={`${id}-title`} className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
    <p className="text-sm font-semibold text-primary">{t('متاح الآن · بدون تسجيل', 'Available now · no account needed')}</p>
    <h2 id={`${id}-title`} className="text-xl font-semibold">{t('ابدأ بمشاركة رابط الموقع', 'Start by sharing the website')}</h2>
    <p className="text-sm leading-7 text-muted-foreground">{t('تعرف صاحب مشروع قد يستفيد من Entix Books؟ شاركه الرابط في رسالة أو ضعه في وصف محتواك. لا تحتاج عدد متابعين أو التزامًا بالنشر.', 'Know a business owner who could use Entix Books? Share the link in a message or your content description. No follower count or posting commitment is required.')}</p>
    <label htmlFor={`${id}-link`} className="block text-sm font-medium">{t('رابط الموقع العام', 'Public website link')}</label>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input id={`${id}-link`} readOnly value={PARTNER_SHARE_URL} dir="ltr" className="min-w-0 flex-1" onFocus={event => event.currentTarget.select()} />
      <Button type="button" onClick={copyLink}><Copy className="size-4 me-2" />{t('نسخ الرابط', 'Copy link')}</Button>
      <a href={PARTNER_SHARE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground px-5 py-2 text-sm font-semibold"><ExternalLink className="size-4" />{t('افتح الموقع', 'Open website')}</a>
    </div>
    <p role="status" aria-live="polite" className="text-sm">{copyState === 'copied' ? t('تم نسخ رابط الموقع.', 'Website link copied.') : copyState === 'manual' ? t('تعذر النسخ التلقائي. حدّد الرابط أعلاه وانسخه يدويًا.', 'Automatic copy failed. Select the link above and copy it manually.') : ''}</p>
    <p className="text-sm leading-6 text-muted-foreground">{t('هذا رابط مشاركة عام؛ لا ينسب العملاء إليك ولا يحتسب عمولات. الإحالات المدفوعة تحتاج رابطك الخاص واتفاقيتك بعد تفعيل البرنامج.', 'This is a general sharing link; it does not attribute customers to you or earn commissions. Paid referrals require your own link and agreement once the program is activated.')}</p>
  </section>;
}
