import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Users, Globe, BarChart3, Shield } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { Turnstile } from "../components/turnstile";
import { useLanguage } from "../components/LanguageContext";
import { EntixWordmark } from "../components/entix-brand";

export function Register() {
  const navigate = useNavigate();
  const { language, toggleLanguage, t } = useLanguage();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  useEffect(() => {
    const current = authStore.getState();
    if (!current.loading && current.isAuthenticated) navigate("/app");
    const unsub = authStore.subscribe(s => {
      if (!s.loading && s.isAuthenticated) navigate("/app");
    });
    return unsub;
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const result = await authStore.register(email, password, fullName, "", captchaToken);
    setLoading(false);
    if (result.success) navigate("/app");
    else if (result.error?.includes('registration_disabled') || result.error?.includes('sign_up_disabled')) {
      setError(t("التسجيل مغلق حالياً — يرجى التواصل مع الدعم", "Registration is currently closed — please contact support"));
    }
    else setError(result.error || t("حدث خطأ", "Something went wrong"));
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
    <div className="min-h-screen flex" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-md py-8"
        >
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" style={{ fontSize: "14px", fontWeight: 500 }}>
              <ArrowRight className="w-4 h-4" />
              {t("العودة للرئيسية", "Back home")}
            </Link>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:border-[#1276E3]/30 hover:bg-primary/5"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              <Globe className="h-4 w-4" />
              {language === "ar" ? "English" : "العربية"}
            </button>
          </div>

          <div className="flex items-center mb-8">
            <EntixWordmark size={34} />
          </div>

          <h1 className="text-foreground mb-2" style={{ fontSize: "30px", fontWeight: 700 }}>{t("إنشاء حساب جديد", "Create your account")}</h1>
          <p className="text-muted-foreground mb-8" style={{ fontSize: "15px" }}>{t("ابدأ تجربتك المجانية — لا حاجة لبطاقة ائتمان", "Start your free trial — no credit card needed")}</p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6" style={{ fontSize: "14px" }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-foreground mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>{t("الاسم الأول", "First Name")}</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder={t("محمد", "John")}
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                  style={{ fontSize: "14px" }}
                  required
                />
              </div>
              <div>
                <label className="block text-foreground mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>{t("الاسم الأخير", "Last Name")}</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={t("العلي", "Doe")}
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                  style={{ fontSize: "14px" }}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-foreground mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>{t("البريد الإلكتروني", "Email")}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.sa"
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                required
              />
            </div>
            <div>
              <label className="block text-foreground mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>{t("كلمة المرور", "Password")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t("8 أحرف على الأقل", "At least 8 characters")}
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all pe-12"
                  style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input type="checkbox" id="terms" className="mt-1 accent-[#1276E3]" required />
              <label htmlFor="terms" className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: 1.6, fontWeight: 400 }}>
                {t("بإنشاء حساب فأنت توافق على", "By creating an account you agree to our")}{" "}
                <Link to="/terms" className="text-primary hover:underline">{t("الشروط والأحكام", "Terms")}</Link>
                {" "}{t("و", "and")}{" "}
                <Link to="/privacy" className="text-primary hover:underline">{t("سياسة الخصوصية", "Privacy Policy")}</Link>
              </label>
            </div>

            <Turnstile onVerify={setCaptchaToken} />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/80 disabled:opacity-60 text-white py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-[#1276E3]/25 cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("جارٍ إنشاء الحساب...", "Creating account...")}
                </span>
              ) : t("إنشاء حساب", "Create account")}
            </button>
          </form>

          {/* Divider · only when a social provider is enabled */}
          {(googleEnabled || microsoftEnabled) && (
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
            <span className="text-muted-foreground/60" style={{ fontSize: "12px" }}>{t("أو", "or")}</span>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>
          )}

          {/* Social sign-in buttons */}
          <div className="space-y-3">
            {googleEnabled && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || microsoftLoading}
              className="w-full bg-white border border-border hover:border-[#1276E3] hover:bg-muted disabled:opacity-60 text-foreground py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-[#1276E3]/30 border-t-[#1276E3] rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
              className="w-full bg-white border border-border hover:border-[#1276E3] hover:bg-muted disabled:opacity-60 text-foreground py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {microsoftLoading ? (
                <span className="w-5 h-5 border-2 border-[#1276E3]/30 border-t-[#1276E3] rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.4 24H0V12.6h11.4V24z" fill="#F25022"/>
                  <path d="M24 24H12.6V12.6H24V24z" fill="#7FBA00"/>
                  <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#00A4EF"/>
                  <path d="M24 11.4H12.6V0H24v11.4z" fill="#FFB900"/>
                </svg>
              )}
              {t("التسجيل عبر Microsoft", "Sign up with Microsoft")}
            </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <span className="text-muted-foreground" style={{ fontSize: "14px" }}>{t("لديك حساب بالفعل؟ ", "Already have an account? ")}</span>
            <Link to="/login" className="text-primary hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>{t("تسجيل الدخول", "Sign in")}</Link>
          </div>
        </motion.div>
      </div>

      {/* Left side - Brand */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#0B1B49] via-[#0F2156] to-[#1A2D5C] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-56 h-56 bg-[#349FC4]/10 rounded-full blur-3xl" />
        
        <div className="text-center max-w-md relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-white mb-4" style={{ fontSize: "30px", fontWeight: 700, lineHeight: 1.3 }}>
              {t("ابدأ رحلتك", "Start your")}<br />{t("المالية معنا", "financial journey")}
            </h2>
            <p className="text-[#94A3B8] mb-10" style={{ fontSize: "15px", lineHeight: 1.9 }}>
              {t(
                "انضم لآلاف الشركات التي تستخدم ENTIX.IO لإدارة حساباتها بكفاءة وأمان.",
                "Join thousands of companies using ENTIX.IO to manage their finances with confidence."
              )}
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-3">
            {[
              { icon: CheckCircle2, ar: "تجربة مجانية 14 يوم — بدون بطاقة ائتمان", en: "14-day free trial — no credit card required" },
              { icon: Users, ar: "أكثر من 2,500 شركة تثق بنا", en: "Trusted by 2,500+ companies" },
              { icon: Globe, ar: "دعم عربي/إنجليزي مع عملات متعددة", en: "Bilingual AR/EN with multi-currency support" },
              { icon: BarChart3, ar: "تقارير ولوحات تحكم احترافية", en: "Professional reports and dashboards" },
            ].map(item => (
              <div key={item.en} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <item.icon className="w-5 h-5 text-[#349FC4] flex-shrink-0" />
                <span className="text-[#CBD5E1]" style={{ fontSize: "14px" }}>{t(item.ar, item.en)}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
