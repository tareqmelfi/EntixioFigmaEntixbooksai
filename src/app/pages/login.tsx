import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { Eye, EyeOff, ArrowRight, Shield, Zap, Cloud, Globe } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { isTurnstileRequired, Turnstile } from "../components/turnstile";
import { useLanguage } from "../components/LanguageContext";
import { EntixWordmark } from "../components/entix-brand";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage, t } = useLanguage();
  // Where the user was trying to go before being bounced to /login.
  // AuthGuard sets this via Navigate state · default to /app for fresh logins.
  const fromPath: string = (location.state as any)?.from || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  // Redirect if already logged in · respect fromPath · zero-org accounts go to
  // the /welcome chooser first (registration no longer creates a silent org).
  useEffect(() => {
    const dest = (s: { isAuthenticated: boolean; needsOnboarding?: boolean }) =>
      s.needsOnboarding && fromPath === "/app" ? "/welcome" : fromPath;
    const current = authStore.getState();
    if (!current.loading && current.isAuthenticated) navigate(dest(current), { replace: true });
    const unsub = authStore.subscribe(s => {
      if (!s.loading && s.isAuthenticated) navigate(dest(s), { replace: true });
    });
    return unsub;
  }, [navigate, fromPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTurnstileRequired && !captchaToken) return;
    setError(null);
    setVerifyNotice(null);
    setUnverifiedEmail(null);
    setLoading(true);
    const result = await authStore.login(email, password, captchaToken);
    if (result.success) {
      const s = authStore.getState();
      navigate(s.needsOnboarding && fromPath === "/app" ? "/welcome" : fromPath, { replace: true });
      return;
    }
    setLoading(false);

    setCaptchaToken(null);
    setCaptchaResetKey(key => key + 1);

    if (result.code === "EMAIL_NOT_VERIFIED") {
      setUnverifiedEmail(email.trim());
      setError(t("هذا البريد غير مُفعّل بعد. أعد إرسال رسالة التحقق.", "This email is not verified yet. Resend verification email."));
      return;
    }

    setError(result.error || t("حدث خطأ", "Something went wrong"));
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setVerifyNotice(null);
    setError(null);
    setVerifyLoading(true);
    const result = await authStore.resendVerificationEmail(unverifiedEmail, `https://entix.io/login`);
    setVerifyLoading(false);

    if (result.success) {
      setVerifyNotice(t("تم إرسال رابط التفعيل إلى بريدك.", "Verification email has been sent."));
      return;
    }

    setError(result.error || t("تعذر إرسال رسالة التحقق", "Could not send verification email"));
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const target = `https://entix.io${fromPath}`;
      const r = await authStore.loginWithGoogle(target);
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
      const target = `https://entix.io${fromPath}`;
      const r = await authStore.loginWithMicrosoft(target);
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
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const registered = params.get("registered") === "1";
    const emailParam = (params.get("email") || "").trim();
    if (params.get("deletion") === "scheduled") {
      // Post-deletion landing — the server revoked every session; without this
      // notice the user just saw a bare login page with zero explanation.
      setVerifyNotice(t(
        "تمت جدولة حذف حسابك. نأسف لرحيلك — لديك 30 يومًا للتراجع: سجّل الدخول مجددًا واختر «إلغاء الحذف واستعادة الحساب».",
        "Your account deletion is scheduled. Sorry to see you go — you have 30 days to change your mind: sign back in and choose “Cancel deletion and restore account”.",
      ));
      if (emailParam) setEmail(emailParam);
      return;
    }
    if (registered) {
      setVerifyNotice(t("تم إنشاء حسابك بنجاح. تحقق من بريدك الإلكتروني لتفعيل الحساب ثم سجّل الدخول.", "Your account was created. Check your email to verify it, then sign in."));
      if (emailParam) {
        setEmail(emailParam);
        setUnverifiedEmail(emailParam);
      }
    }
  }, [location.search, t]);

  useEffect(() => {
    authStore.getProviders().then(p => {
      setGoogleEnabled(p.google);
      setMicrosoftEnabled(p.microsoft);
    });
  }, []);

  return (
    <div className="h-screen flex overflow-hidden" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-background h-full overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" style={{ fontSize: "14px", fontWeight: 500 }}>
              <ArrowRight className="w-4 h-4" />
              {t("العودة للرئيسية", "Back home")}
            </Link>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-content-secondary transition-colors hover:border-foreground hover:text-foreground"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              <Globe className="h-4 w-4" strokeWidth={1.75} />
              {language === "ar" ? "EN" : "AR"}
            </button>
          </div>
          
          <div className="flex items-center mb-8">
            <EntixWordmark size={26} />
          </div>

          <h1 className="text-foreground mb-2 text-[30px] font-bold leading-tight">{t("تسجيل الدخول", "Sign in")}</h1>
          <p className="text-content-secondary mb-8" style={{ fontSize: "15px", lineHeight: 1.6 }}>{t("أدخل بياناتك للوصول إلى حسابك", "Enter your details to access your account.")}</p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-danger-subtle border border-danger-border text-danger px-4 py-3 rounded-md mb-3" style={{ fontSize: "14px" }}
            >
              {error}
            </motion.div>
          )}

          {verifyNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-success-subtle border border-success-border text-success px-4 py-3 rounded-md mb-3"
              style={{ fontSize: "14px" }}
            >
              {verifyNotice}
            </motion.div>
          )}

          {unverifiedEmail && (
            <div className="bg-warning-subtle border border-warning-border text-warning px-4 py-3 rounded-md mb-6" style={{ fontSize: "13px" }}>
              <div className="mb-2">{t("البريد غير مفعل بعد. افتح بريدك وفعّل الحساب، أو أعد إرسال رابط التفعيل.", "Email is not verified yet. Open your inbox and verify the account, or resend the verification link.")}</div>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={verifyLoading}
                className="text-primary hover:underline disabled:opacity-60"
                style={{ fontWeight: 600 }}
              >
                {verifyLoading ? t("جارٍ إرسال رابط التفعيل...", "Sending verification link...") : t("إعادة إرسال رابط التفعيل", "Resend verification link")}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>{t("البريد الإلكتروني", "Email")}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.sa"
                className="w-full h-11 px-4 rounded-md border border-border bg-card focus:border-foreground focus:ring-2 focus:ring-ring/20 outline-none transition-colors"
                style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-foreground" style={{ fontSize: "13px", fontWeight: 600 }}>{t("كلمة المرور", "Password")}</label>
                <Link to="/forgot-password" className="text-primary hover:underline" style={{ fontSize: "13px" }}>{t("نسيت كلمة المرور؟", "Forgot password?")}</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 pe-12 rounded-md border border-border bg-card focus:border-foreground focus:ring-2 focus:ring-ring/20 outline-none transition-colors"
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

            <Turnstile
              onVerify={setCaptchaToken}
              resetKey={captchaResetKey}
              language={language}
            />
            <button
              type="submit"
              disabled={loading || (isTurnstileRequired && !captchaToken)}
              className="w-full h-12 bg-foreground hover:bg-primary disabled:opacity-60 text-background rounded-full transition-colors cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  {t("جارٍ تسجيل الدخول...", "Signing in...")}
                </span>
              ) : t("تسجيل الدخول", "Sign in")}
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
            {/* Google OAuth · only when configured */}
            {googleEnabled && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || microsoftLoading}
              className="w-full h-12 bg-card border border-border hover:bg-surface-hover disabled:opacity-60 text-foreground rounded-full transition-colors flex items-center justify-center gap-3 cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {t("تسجيل الدخول عبر Google", "Sign in with Google")}
            </button>
            )}

            {/* Microsoft OAuth · only when configured */}
            {microsoftEnabled && (
            <button
              type="button"
              onClick={handleMicrosoft}
              disabled={microsoftLoading || googleLoading}
              className="w-full h-12 bg-card border border-border hover:bg-surface-hover disabled:opacity-60 text-foreground rounded-full transition-colors flex items-center justify-center gap-3 cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {microsoftLoading ? (
                <span className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                </svg>
              )}
              {t("تسجيل الدخول عبر Microsoft", "Sign in with Microsoft")}
            </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <span className="text-content-secondary" style={{ fontSize: "14px" }}>{t("ليس لديك حساب؟ ", "No account yet? ")}</span>
            <Link to="/register" className="text-primary hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>{t("إنشاء حساب جديد", "Create account")}</Link>
          </div>
        </motion.div>
      </div>

      {/* Left side - Brand */}
      <div className="hidden lg:flex flex-1 bg-foreground items-center justify-center p-12 relative overflow-hidden">
        <div className="max-w-md relative z-10 text-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-background mb-5" style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1.35 }}>{t("مرحباً بك في", "Welcome to")}<br /><span className="mt-3 inline-flex"><EntixWordmark size={30} light /></span></h2>
            <p className="text-background/70 mb-10" style={{ fontSize: "15px", lineHeight: 1.85 }}>
              {t(
                "نظام محاسبة سحابي للسوقين السعودي والأمريكي. تكامل ZATCA للمرحلة الثانية قيد التحقق الفني والتنظيمي وغير مفعّل للاعتماد الإنتاجي.",
                "A cloud accounting platform for Saudi and US businesses. ZATCA Phase 2 integration is under technical and regulatory validation and is not enabled for production reliance."
              )}
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="divide-y divide-background/15 border-y border-background/15">
            {[
              { icon: Shield, text: t("مفاتيح التكامل مشفّرة AES-256-GCM", "Integration keys AES-256-GCM encrypted") },
              { icon: Zap, text: t("أداء سريع وتجربة سلسة", "Fast and smooth experience") },
              { icon: Cloud, text: t("نسخ احتياطي يومي تلقائي", "Automatic daily backups") },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 py-4">
                <item.icon className="w-5 h-5 text-background/60 flex-shrink-0" strokeWidth={1.75} />
                <span className="text-background/80" style={{ fontSize: "14px" }}>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
