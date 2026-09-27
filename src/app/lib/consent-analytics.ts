/** Load optional analytics only after consent and after the page has loaded. */
const MEASUREMENT_ID = 'G-MW0F9G62C5';
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};
let initialized = false;

export function setAnalyticsConsent(allowed: boolean) {
  const target = window as unknown as AnalyticsWindow;
  target[`ga-disable-${MEASUREMENT_ID}`] = !allowed;
  const load = () => {
    if (target[`ga-disable-${MEASUREMENT_ID}`] || initialized) return;
    initialized = true;
    target.dataLayer ||= [];
    target.gtag = function () { target.dataLayer!.push(arguments); };
    target.gtag('consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
    });
    target.gtag('js', new Date());
    target.gtag('config', MEASUREMENT_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement('script');
    script.async = true;
    script.dataset.entixAnalytics = 'true';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  };
  if (initialized) target.gtag?.('consent', 'update', { analytics_storage: allowed ? 'granted' : 'denied' });
  if (!allowed) return;
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load, { once: true });
}
