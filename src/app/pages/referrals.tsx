import { Link } from 'react-router';
import { SharedNavbar } from '../components/shared-navbar';
import { SharedFooter } from '../components/shared-footer';
import { useLanguage } from '../components/LanguageContext';
import { useAuthState } from '../components/use-auth-state';
import { Partners } from './partners';

/** Shared public entry and authenticated, person-scoped partnership workspace. */
export function Referrals() {
  const { language, t } = useLanguage();
  const auth = useAuthState();
  return <div className="min-h-screen bg-background text-foreground" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <SharedNavbar />
    <main className="mx-auto max-w-6xl px-5 pt-32 pb-20">
      <header className="max-w-3xl mb-10">
        <p className="text-sm font-semibold text-primary mb-4">{t('برنامج شركاء Entix', 'Entix partner program')}</p>
        <h1 className={language === 'en' ? 'font-display text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl font-bold'}>{t('شراكة واضحة، من البداية.', 'A clear partnership, from the start.')}</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">{t('للمسوّقين وصنّاع المحتوى والوكالات. قدّم طلب الشراكة من حسابك، ثم تُراجع الاتفاقية والأهلية قبل تفعيل الإحالات والعمولات.', 'For marketers, creators and agencies. Apply from your account; agreement and eligibility review come before activating referrals and commissions.')}</p>
      </header>
      {auth.loading ? <p role="status">{t('جارٍ تحميل حسابك…', 'Loading your account…')}</p> : auth.isAuthenticated ? <Partners key={auth.user?.id} /> : <>
        <div className="grid gap-6 md:grid-cols-3 border-y border-foreground py-8">
          {[
            [t('01 · طلب الشراكة', '01 · Application'), t('حساب شخصي وبريد مُفعّل. لا تحتاج إلى إنشاء شركة أو شراء اشتراك محاسبي.', 'A personal account and verified email. No accounting company or subscription required.')],
            [t('02 · الاتفاقية والأهلية', '02 · Agreement and eligibility'), t('تُحدد النسبة والمدة وآلية الاستحقاق في اتفاقيتك. تُراجع الإقامة والهوية والقيود ذات الصلة قبل القبول.', 'Your agreement sets the rate, duration and earning conditions. Residence, identity and relevant restrictions are reviewed before approval.')],
            [t('03 · التفعيل والصرف', '03 · Activation and payouts'), t('تفعيل التتبع والصرف ينتظر اكتمال الربط والتحقق. تقديم الطلب لا ينشئ رابط إحالة نشطًا ولا يثبت أهلية مزوّد دفع.', 'Tracking and payouts await completed integration and verification. Applying does not create an active referral link or establish payout-provider eligibility.')],
          ].map(([title, text]) => <section key={title}><h2 className="font-semibold mb-3">{title}</h2><p className="text-sm leading-7 text-muted-foreground">{text}</p></section>)}
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/register?flow=partner" className="rounded-full bg-primary px-6 py-3 text-primary-foreground font-semibold">{t('إنشاء حساب شريك', 'Create a partner account')}</Link>
          <Link to="/login?flow=partner" className="rounded-full border border-foreground px-6 py-3 font-semibold">{t('دخول الشركاء', 'Partner sign in')}</Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{t('حفظ الطلب متاح؛ الربط التلقائي للتوقيع والتتبع والصرف ما زال قيد الإعداد. لا نطلب بياناتك البنكية هنا.', 'Applications can be saved; automatic signing, attribution and payout integration are still being prepared. Bank details are not collected here.')}</p>
      </>}
    </main>
    <SharedFooter />
  </div>;
}
