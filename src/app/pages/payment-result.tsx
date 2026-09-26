import { Link, useSearchParams } from 'react-router';
import { useLanguage } from '../components/LanguageContext';
export function PaymentResult() {
  const { t } = useLanguage(); const [params] = useSearchParams();
  const cancelled = params.get('status') === 'cancelled';
  return <main className="mx-auto max-w-lg space-y-6 px-6 py-20 text-center"><div dir="ltr" className="text-3xl font-bold">ENTIX<span className="text-primary">.IO</span></div><h1 className="text-2xl font-semibold">{cancelled ? t('لم يكتمل الدفع', 'Payment not completed') : t('شكرًا لك', 'Thank you')}</h1><p className="text-muted-foreground">{cancelled ? t('يمكنك العودة إلى رابط الفاتورة والمحاولة مجددًا.', 'You can return to the invoice link and try again.') : t('سيُحدّث سداد الفاتورة بعد وصول تأكيد Stripe. احتفظ بإيصال الدفع للرجوع إليه.', 'The invoice payment will update after Stripe confirms it. Keep your payment receipt for reference.')}</p><Link className="text-primary underline" to="/help">{t('المساعدة والدعم', 'Help and support')}</Link></main>;
}
