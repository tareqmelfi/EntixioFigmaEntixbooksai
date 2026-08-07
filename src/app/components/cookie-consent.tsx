/**
 * CookieConsent · PDPL/GDPR-style cookie banner (UX-1: non-blocking, not a modal).
 * - Accept all · Essential only · Custom preferences (analytics / marketing toggles)
 * - Persisted in localStorage; footer "Cookie preferences" re-opens via custom event.
 * - Nothing tracks today without consent: session/auth cookies are essential-only.
 */
import { useEffect, useState } from "react";
import { Cookie, X, ShieldCheck, BarChart3, Megaphone } from "lucide-react";
import { useLanguage } from "./LanguageContext";

const STORAGE_KEY = "entix_cookie_consent_v1";

export interface CookieConsentState {
  v: 1;
  choice: "all" | "essential" | "custom";
  analytics: boolean;
  marketing: boolean;
  at: string;
}

export function readCookieConsent(): CookieConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== 1) return null;
    return parsed as CookieConsentState;
  } catch {
    return null;
  }
}

/** Gate for any future analytics/marketing loader — only true after explicit consent. */
export function hasTrackingConsent(kind: "analytics" | "marketing"): boolean {
  const c = readCookieConsent();
  if (!c) return false;
  if (c.choice === "all") return true;
  if (c.choice === "essential") return false;
  return kind === "analytics" ? c.analytics : c.marketing;
}

export function CookieConsent() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setVisible(readCookieConsent() === null);
    const reopen = () => { setCustomizing(true); setVisible(true); };
    window.addEventListener("entix:cookie-preferences", reopen);
    return () => window.removeEventListener("entix:cookie-preferences", reopen);
  }, []);

  const persist = (state: Omit<CookieConsentState, "v" | "at">) => {
    const full: CookieConsentState = { v: 1, at: new Date().toISOString(), ...state };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(full)); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent("entix:cookie-consent-changed", { detail: full }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] pointer-events-none px-3 pb-3 sm:px-6 sm:pb-5" dir={isAr ? "rtl" : "ltr"}>
      <div className="pointer-events-auto mx-auto max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-foreground/15 overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
              <Cookie className="w-5 h-5 text-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground mb-1" style={{ fontSize: "15px", fontWeight: 700 }}>
                {t("نحترم خصوصيتك", "We respect your privacy")}
              </h3>
              <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: 1.8 }}>
                {t(
                  "نستخدم ملفات ضرورية لتشغيل الموقع (تسجيل الدخول والأمان) — وهي تعمل دائمًا. وبموافقتك فقط نستخدم كوكيز تحليلية لتحسين التجربة. لا نبيع بياناتك أبدًا.",
                  "We use essential cookies to run the site (sign-in and security) — those always stay on. With your consent only, we use analytics cookies to improve the experience. We never sell your data."
                )}{" "}
                <a href="/privacy" className="text-primary hover:underline" style={{ fontWeight: 600 }}>
                  {t("سياسة الخصوصية", "Privacy policy")}
                </a>
              </p>
            </div>
            <button
              onClick={() => persist({ choice: "essential", analytics: false, marketing: false })}
              className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
              aria-label={t("إغلاق وقبول الضرورية فقط", "Close and keep essential only")}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {customizing && (
            <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-4">
              <PreferenceRow
                icon={<ShieldCheck className="w-4 h-4 text-green-500" />}
                title={t("ضرورية — تسجيل الدخول والأمان", "Essential — sign-in & security")}
                desc={t("مطلوبة لتشغيل الموقع ولا يمكن إيقافها", "Required for the site to work; cannot be disabled")}
                locked
                on
              />
              <PreferenceRow
                icon={<BarChart3 className="w-4 h-4 text-primary" />}
                title={t("تحليلية — قياس الاستخدام", "Analytics — usage measurement")}
                desc={t("تساعدنا نفهم أي الصفحات تُستخدم لنحسّنها", "Help us learn which pages are used so we can improve them")}
                on={analytics}
                onToggle={() => setAnalytics(!analytics)}
              />
              <PreferenceRow
                icon={<Megaphone className="w-4 h-4 text-amber-500" />}
                title={t("تسويقية — إعلانات مخصصة", "Marketing — tailored ads")}
                desc={t("لا نستخدمها حاليًا — ولو استخدمناها ستكون بموافقتك", "Not in use today — and only ever with your consent")}
                on={marketing}
                onToggle={() => setMarketing(!marketing)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <button
              onClick={() => persist({ choice: "all", analytics: true, marketing: true })}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-primary/20"
              style={{ fontSize: "14px", fontWeight: 700 }}
            >
              {t("قبول الكل", "Accept all")}
            </button>
            <button
              onClick={() => persist({ choice: "essential", analytics: false, marketing: false })}
              className="bg-gray-100 hover:bg-gray-200 text-foreground px-6 py-2.5 rounded-xl transition-all cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {t("الضرورية فقط", "Essential only")}
            </button>
            {customizing ? (
              <button
                onClick={() => persist({ choice: "custom", analytics, marketing })}
                className="border border-primary/40 text-primary hover:bg-primary/5 px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                style={{ fontSize: "14px", fontWeight: 600 }}
              >
                {t("حفظ التفضيلات", "Save preferences")}
              </button>
            ) : (
              <button
                onClick={() => setCustomizing(true)}
                className="text-muted-foreground hover:text-foreground hover:underline px-2 py-2.5 transition-colors cursor-pointer"
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                {t("تفضيلات الكوكيز", "Cookie preferences")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({ icon, title, desc, on, locked, onToggle }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  on: boolean;
  locked?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-3">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-foreground" style={{ fontSize: "13px", fontWeight: 600 }}>{title}</div>
        <div className="text-muted-foreground" style={{ fontSize: "12px", lineHeight: 1.6 }}>{desc}</div>
      </div>
      {locked ? (
        <span className="text-green-800 bg-green-100 rounded-full px-2.5 py-1 shrink-0" style={{ fontSize: "11px", fontWeight: 700 }}>
          {t("دائمًا", "Always on")}
        </span>
      ) : (
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={on}
          className={`w-10 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${on ? "bg-primary" : "bg-gray-300"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "start-5" : "start-1"}`} />
        </button>
      )}
    </div>
  );
}
