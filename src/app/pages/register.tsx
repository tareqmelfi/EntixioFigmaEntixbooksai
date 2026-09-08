import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Users, Globe, BarChart3 } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { isTurnstileRequired, Turnstile } from "../components/turnstile";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";
import { EntixWordmark } from "../components/entix-brand";
import { PublicLanguageToggle } from "../components/public-preference-selector";

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage, t } = useLanguage();
  const { isSA } = useMarketingRegion();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The org's jurisdiction is chosen HERE, at signup — it drives currency,
  // taxes, and which market the company belongs to from day one.
  const [country] = useState<"SA" | "US">(isSA ? "SA" : "US");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // After a verification-required signup the form swaps to this full panel —
  // no navigation, no cross-page handoff: the user cannot miss that they must
  // verify their email before signing in.
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  // Invite links (/invite/:token) bounce here with state.from — after signup
  // the invitee must land back on the invitation, not the bare app.
  const fromPath: string = (location.state as any)?.from || "/app";

  useEffect(() => {
    const dest = (st: { isAuthenticated: boolean; needsOnboarding?: boolean }) =>
      st.needsOnboarding ? "/welcome" : fromPath;
    const current = authStore.getState();
    if (!current.loading && current.isAuthenticated) navigate(dest(current));
    const unsub = authStore.subscribe(s => {
      if (!s.loading && s.isAuthenticated) navigate(dest(s));
    });
    return unsub;
  }, [navigate, fromPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTurnstileRequired && !captchaToken) return;
    setError(null);
    if (password.length < 8) {
      setError(t("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const result = await authStore.register(email, password, fullName, "", captchaToken, country);
    setLoading(false);
    if (result.success) {
      if (result.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setPendingVerificationEmail(email.trim());
        return;
      }
      navigate(fromPath === "/app" ? "/welcome" : fromPath, { replace: true });
      return;
    }
    setCaptchaToken(null);
    setCaptchaResetKey(key => key + 1);
    if (result.error?.includes('registration_disabled') || result.error?.includes('sign_up_disabled')) {
      setError(t("التسجيل مغلق حالياً — يرجى التواصل مع الدعم", "Registration is currently closed — please contact support"));
    } else {
      setError(result.error || t("حدث خطأ", "Something went wrong"));
    }
  };

  const handleResendLink = async () => {
    if (!pendingVerificationEmail || resendBusy) return;
    setResendBusy(true);
    setResendNotice(null);
    const r = await authStore.resendVerificationEmail(pendingVerificationEmail, "https://entix.io/login");
    setResendBusy(false);
    setResendNotice(
      r.success
        ? t("أعدنا إرسال رابط التفعيل — تحقق من بريدك (والبريد المزعج).", "We resent the verification link — check your inbox (and spam folder).")
        : r.error || t("تعذر إرسال الرابط الآن — حاول بعد قليل.", "Couldn't resend the link right now — try again shortly."),
    );
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const r = await authStore.loginWithGoogle();
      if (!r.success) {
        setError(r.error || t("تعذّر الاتصال بـGoogle", "Could not connect to Google"));
        setGoogleLoading(false);
      }
    } catch (e: any) {
      setError(e?.message || t("تعذّر الاتصال بـGoogle", "Could not connect to Google"));
      setGoogleLoading(false);
    }
  };

  const handleMicrosoft = async () => {
    setError(null);
    setMicrosoftLoading(true);
    try {
      const r = await authStore.loginWithMicrosoft();
      if (!r.success) {
        setError(r.error || t("تعذّر الاتصال بـMicrosoft", "Could not connect to Microsoft"));
        setMicrosoftLoading(false);
      }
    } catch (e: any) {
      setError(e?.message || t("تعذّر الاتصال بـMicrosoft", "Could not connect to Microsoft"));
      setMicrosoftLoading(false);
    }
  };

  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  useEffect(() => {
    authStore.getProviders().then(p => {
      setGoogleEnabled(p.google);
      setMicrosoftEnabled(p.microsoft);
    });
  }, []);

  return (
    <div className="h-screen grid lg:grid-cols-[560px_minmax(0,1fr)] overflow-hidden bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Form column · 560px at the 1440 artboard */}
      <div className="flex flex-col justify-between px-6 sm:px-10 lg:px-16 py-8 lg:py-10 bg-background h-full overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center hover:opacity-80 transition-opacity" aria-label="ENTIX.IO">
            <EntixWordmark size={22} />
          </Link>
          <div className="flex items-center gap-3">
            {/* Reachable at 390px without scrolling — the footer switch stays too. */}
            <PublicLanguageToggle />
            <Link to="/" className="hidden sm:inline-flex items-center gap-1.5 text-content-secondary hover:text-foreground transition-colors" style={{ fontSize: "13px", fontWeight: 500 }}>
              <ArrowRight className="w-4 h-4" />
              {t("العودة للرئيسية", "Back home")}
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-[400px] py-10"
        >

          {pendingVerificationEmail ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className="rounded-lg border border-success-border bg-success-subtle p-6"
              role="status"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success text-background shrink-0">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h1 className="text-foreground text-[22px] font-bold leading-tight">
                  {t("تم إنشاء حسابك بنجاح", "Your account was created")}
                </h1>
              </div>
              <p className="text-foreground mb-2" style={{ fontSize: "15px", lineHeight: 1.8 }}>
                {t("أرسلنا رابط التفعيل إلى", "We sent a verification link to")}{" "}
                <span className="font-semibold" dir="ltr">{pendingVerificationEmail}</span>
              </p>
              <p className="text-content-secondary mb-6" style={{ fontSize: "14px", lineHeight: 1.8 }}>
                {t(
                  "افتح بريدك واضغط «تأكيد البريد الإلكتروني»، وبعدها سجّل دخولك. لن تتمكن من الدخول قبل التفعيل.",
                  "Open your inbox and tap “Confirm email”, then sign in. You can't sign in before verifying.",
                )}
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => navigate("/login", { replace: true })}
                  className="w-full min-h-[48px] py-3.5 bg-[var(--brand-blue-600)] hover:opacity-90 text-primary-foreground rounded-full transition-opacity cursor-pointer"
                  style={{ fontSize: "15px", fontWeight: 600 }}
                >
                  {t("الانتقال لتسجيل الدخول", "Go to sign in")}
                </button>
                <button
                  type="button"
                  onClick={handleResendLink}
                  disabled={resendBusy}
                  className="w-full min-h-[44px] py-3 bg-card border border-border hover:bg-surface-hover text-foreground rounded-full transition-colors disabled:opacity-60 cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {resendBusy
                    ? t("جارٍ إعادة الإرسال...", "Resending...")
                    : t("لم يصلك البريد؟ أعد إرسال رابط التفعيل", "Didn't get it? Resend verification link")}
                </button>
                {resendNotice && (
                  <p className="text-content-secondary" style={{ fontSize: "13px" }}>{resendNotice}</p>
                )}
              </div>
            </motion.div>
          ) : (
          <>
          <h1 className={language === "en"
            ? "font-display font-normal m-0 mb-2 text-[36px] sm:text-[44px] leading-none text-foreground"
            : "font-bold m-0 mb-2 text-[28px] sm:text-[34px] leading-[1.25] text-foreground"}>{t("أنشئ حسابك.", "Create your account.")}</h1>
          <p className="text-content-secondary mb-8 m-0" style={{ fontSize: "15px", lineHeight: 1.5 }}>{t("ابدأ شهرك المجاني — لا حاجة لبطاقة ائتمان", "Start your free month — no credit card needed")}</p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-danger-subtle border border-danger-border text-danger px-4 py-3 rounded-md mb-6" style={{ fontSize: "14px" }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الاسم الأول", "First Name")}</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder={t("محمد", "John")}
                  className="w-full min-h-[44px] h-11 px-3.5 rounded-lg border border-border bg-card focus:border-foreground focus:ring-2 focus:ring-ring/20 outline-none transition-colors"
                  style={{ fontSize: "14px" }}
                  required
                />
              </div>
              <div>
                <label className="block text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>{t("الاسم الأخير", "Last Name")}</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={t("العلي", "Doe")}
                  className="w-full min-h-[44px] h-11 px-3.5 rounded-lg border border-border bg-card focus:border-foreground focus:ring-2 focus:ring-ring/20 outline-none transition-colors"
                  style={{ fontSize: "14px" }}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>{t("البريد الإلكتروني", "Email")}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.sa"
                className="w-full min-h-[44px] h-11 px-3.5 rounded-lg border border-border bg-card focus:border-foreground focus:ring-2 focus:ring-ring/20 outline-none transition-colors"
                style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                required
              />
            </div>
            <div>
              <label className="block text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>{t("كلمة المرور", "Password")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t("8 أحرف على الأقل", "At least 8 characters")}
                  className="w-full min-h-[44px] h-11 px-3.5 pe-12 rounded-lg border border-border bg-card focus:border-foreground focus:ring-2 focus:ring-ring/20 outline-none transition-colors"
                  style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-content-secondary hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* No country question at signup (user directive 2026-08-21):
                account ≠ company — one account can own companies in SA AND the
                US, and supporters join clients' orgs. Country is chosen at
                company creation; the first org silently follows the visitor's
                market (see the silent `country` state derived from region). */}

            <div className="flex items-start gap-2 pt-1">
              <input type="checkbox" id="terms" className="mt-1 accent-[var(--foreground)]" required />
              <label htmlFor="terms" className="text-content-secondary" style={{ fontSize: "13px", lineHeight: 1.6, fontWeight: 400 }}>
                {t("بإنشاء حساب فأنت توافق على", "By creating an account you agree to our")}{" "}
                <Link to="/terms" className="text-primary hover:underline">{t("الشروط والأحكام", "Terms")}</Link>
                {" "}{t("و", "and")}{" "}
                <Link to="/privacy" className="text-primary hover:underline">{t("سياسة الخصوصية", "Privacy Policy")}</Link>
              </label>
            </div>

            <Turnstile
              onVerify={setCaptchaToken}
              resetKey={captchaResetKey}
              language={language}
            />

            <button
              type="submit"
              disabled={loading || (isTurnstileRequired && !captchaToken)}
              className="w-full min-h-[48px] py-3.5 bg-[var(--brand-blue-600)] hover:opacity-90 disabled:opacity-60 text-primary-foreground rounded-full transition-opacity cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  {t("جارٍ إنشاء الحساب...", "Creating account...")}
                </span>
              ) : t("إنشاء حساب", "Create account")}
            </button>
          </form>

          {/* Divider · only when a social provider is enabled */}
          {(googleEnabled || microsoftEnabled) && (
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-content-secondary" style={{ fontSize: "12px" }}>{t("أو", "or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          )}

          {/* Social sign-in buttons */}
          <div className="space-y-3">
            {googleEnabled && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || microsoftLoading}
              className="w-full min-h-[44px] py-3 bg-card border border-border hover:bg-surface-hover disabled:opacity-60 text-foreground rounded-full transition-colors flex items-center justify-center gap-3 cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {t("التسجيل عبر Google", "Sign up with Google")}
            </button>
            )}

            {microsoftEnabled && (
            <button
              type="button"
              onClick={handleMicrosoft}
              disabled={microsoftLoading || googleLoading}
              className="w-full min-h-[44px] py-3 bg-card border border-border hover:bg-surface-hover disabled:opacity-60 text-foreground rounded-full transition-colors flex items-center justify-center gap-3 cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {microsoftLoading ? (
                <span className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                </svg>
              )}
              {t("التسجيل عبر Microsoft", "Sign up with Microsoft")}
            </button>
            )}
          </div>

          <div className="mt-6">
            <span className="text-content-secondary" style={{ fontSize: "14px" }}>{t("لديك حساب بالفعل؟ ", "Already have an account? ")}</span>
            <Link to="/login" className="text-primary hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>{t("تسجيل الدخول", "Sign in")}</Link>
          </div>
          </>
          )}
        </motion.div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-content-secondary" style={{ fontSize: "12px" }}>
          <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>&copy; 2026 ENSIDEX LLC &middot; Wyoming, United States. All rights reserved.</span>
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors cursor-pointer"
            style={{ fontSize: "12px", fontWeight: 600 }}
          >
            <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
            {language === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </div>

      {/* Ink panel · photograph, scrim, and what the free month includes */}
      <div className="hidden lg:block relative bg-foreground overflow-hidden">
        <img src="/marketing/hero-ledger.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--foreground) 10%, transparent), color-mix(in srgb, var(--foreground) 90%, transparent))" }} />
        <div className="absolute inset-x-16 bottom-14 flex flex-col gap-4 text-background">
          <p className={language === "en"
            ? "font-display font-normal m-0 text-[44px] leading-[1.05]"
            : "font-bold m-0 text-[32px] leading-[1.4]"}>
            {t("ابدأ بشهر مجاني كامل.", "Start with a full free month.")}
          </p>
          <div className="flex flex-col gap-3">
            {[
              { icon: CheckCircle2, ar: "شهر مجاني كامل — بدون بطاقة ائتمان", en: "Full free month — no credit card required" },
              { icon: Users, ar: "مصمم للسوقين السعودي والأمريكي", en: "Built for Saudi & US markets" },
              { icon: Globe, ar: "دعم عربي/إنجليزي مع عملات متعددة", en: "Bilingual AR/EN with multi-currency support" },
              { icon: BarChart3, ar: "تقارير ولوحات تحكم احترافية", en: "Professional reports and dashboards" },
            ].map(item => (
              <div key={item.en} className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4 text-background/70 flex-shrink-0" strokeWidth={1.75} />
                <span className="text-background/80" style={{ fontSize: "14px" }}>{t(item.ar, item.en)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
