import { Link } from 'react-router';
import { SharedNavbar } from '../components/shared-navbar';
import { SharedFooter } from '../components/shared-footer';
import { useLanguage } from '../components/LanguageContext';
import { useAuthState } from '../components/use-auth-state';
import { Partners } from './partners';
import { PartnerShare } from '../components/partner-share';
import { trackPartnerEvent } from '../lib/consent-analytics';

/** Shared public entry and authenticated, person-scoped partnership workspace. */
export function Referrals() {
  const { language, t } = useLanguage();
  const auth = useAuthState();
  return <div className="min-h-screen bg-background text-foreground" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <SharedNavbar />
    <main className="mx-auto max-w-6xl px-5 pt-32 pb-20">
      <header className="max-w-3xl mb-10">
        <p className="text-sm font-semibold text-primary mb-4">{t('برنامج شركاء Entix', 'Entix partner program')}</p>
        <h1 className={language === 'en' ? 'font-display text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl font-bold'}>{t('ابدأ برابط. وتدرّج معنا.', 'Start with a link. Grow with us.')}</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">{t('مشاركة بسيطة أولًا، ثم إحالات مدفوعة عند تفعيلها، وتعاون في المحتوى لمن يثبت ملاءمته. يمكنك البدء حتى لو لم تكن مؤثرًا أو صاحب جمهور كبير.', 'Simple sharing first, paid referrals when activated, and content collaborations after a good fit is proven. You can start without being an influencer or having a large audience.')}</p>
      </header>
      <div className="mb-10"><PartnerShare /></div>
      {auth.loading ? <p role="status">{t('جارٍ تحميل حسابك…', 'Loading your account…')}</p> : auth.isAuthenticated ? <Partners key={auth.user?.id} /> : <>
        <div className="grid gap-6 md:grid-cols-3 border-y border-foreground py-8">
          {[
            [t('01 · مشاركة بسيطة', '01 · Simple sharing'), t('انسخ رابط الموقع وشاركه. هذه البداية متاحة دون تسجيل، ولا تولد مكافأة عن النقرات أو وضع الرابط.', 'Copy and share the website link. This step needs no account and does not pay for clicks or posting the link.')],
            [t('02 · شريك إحالات', '02 · Referral partner'), t('سجّل اهتمامك مجانًا. عند تفعيل الإحالات تحصل على رابط خاص وعمولة تحددها اتفاقيتك على الاشتراكات المؤهلة، مع تدرج حسب العملاء الفعليين.', 'Register your interest for free. When referrals are activated, your agreement sets your personal link and commission on qualifying subscriptions, with progression based on real customers.')],
            [t('03 · تعاون في المحتوى', '03 · Content collaboration'), t('بعد إثبات ملاءمة الجمهور وجودة المحتوى نناقش رعاية بمقابل ونطاق واضحين. الرعاية اتفاق منفصل وليست مكافأة تلقائية على التسجيل.', 'After audience fit and content quality are proven, we can discuss a paid collaboration with a clear scope. Sponsorship is a separate agreement, not an automatic signup reward.')],
          ].map(([title, text]) => <section key={title}><h2 className="font-semibold mb-3">{title}</h2><p className="text-sm leading-7 text-muted-foreground">{text}</p></section>)}
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/register?flow=partner" onClick={() => trackPartnerEvent('partner_application_started')} className="rounded-full bg-primary px-6 py-3 text-primary-foreground font-semibold">{t('سجّل اهتمامك بالإحالات المدفوعة', 'Register interest in paid referrals')}</Link>
          <Link to="/login?flow=partner" className="rounded-full border border-foreground px-6 py-3 font-semibold">{t('دخول الشركاء', 'Partner sign in')}</Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{t('الإحالات المدفوعة قيد التجهيز. يمكنك حفظ طلبك الآن، لكن العمولات لا تبدأ قبل تفعيل رابطك واتفاقيتك. لا نطلب بطاقة أو بيانات بنكية للتقديم.', 'Paid referrals are being prepared. You can save your application now, but commissions only start after your link and agreement are activated. No payment card or bank details are needed to apply.')}</p>
      </>}
    </main>
    <SharedFooter />
  </div>;
}
