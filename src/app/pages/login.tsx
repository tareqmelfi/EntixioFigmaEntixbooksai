import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { Eye, EyeOff, ArrowRight, Shield, Zap, Cloud, Globe } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
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

  // Redirect if already logged in · respect fromPath
  useEffect(() => {
    if (authStore.getState().isAuthenticated) navigate(fromPath, { replace: true });
    const unsub = authStore.subscribe(s => { if (s.isAuthenticated) navigate(fromPath, { replace: true }); });
    return unsub;
  }, [navigate, fromPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await authStore.login(email, password);
    setLoading(false);
    if (result.success) navigate(fromPath, { replace: true });
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

  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    authStore.getProviders().then(p => setGoogleEnabled(p.google));
  }, []);

  return (
    <div className="min-h-screen flex" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#0B1A47] transition-colors" style={{ fontSize: "14px", fontWeight: 500 }}>
              <ArrowRight className="w-4 h-4" />
              {t("العودة للرئيسية", "Back home")}
            </Link>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[#6B7280] hover:border-[#1276E3]/30 hover:bg-[#F4FCFF]"
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              <Globe className="h-4 w-4" />
              {language === "ar" ? "English" : "العربية"}
            </button>
          </div>
          
          <div className="flex items-center mb-10">
            <EntixWordmark size={34} />
          </div>

          <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "30px", fontWeight: 700 }}>{t("تسجيل الدخول", "Sign in")}</h1>
          <p className="text-[#6B7280] mb-8" style={{ fontSize: "15px", lineHeight: 1.6 }}>{t("أدخل بياناتك للوصول إلى حسابك", "Enter your details to access your account.")}</p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6" style={{ fontSize: "14px" }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[#0B1A47] mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>{t("البريد الإلكتروني", "Email")}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.sa"
                className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#0B1A47]" style={{ fontSize: "14px", fontWeight: 500 }}>{t("كلمة المرور", "Password")}</label>
                <Link to="/forgot-password" className="text-[#1276E3] hover:underline" style={{ fontSize: "13px" }}>{t("نسيت كلمة المرور؟", "Forgot password?")}</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all pe-12"
                  style={{ fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1276E3] hover:bg-[#0B5FBF] disabled:opacity-60 text-white py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-[#1276E3]/25 cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("جارٍ تسجيل الدخول...", "Signing in...")}
                </span>
              ) : t("تسجيل الدخول", "Sign in")}
            </button>
          </form>

          {/* Divider · only when Google enabled */}
          {googleEnabled && (
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="text-[#9CA3AF]" style={{ fontSize: "12px" }}>{t("أو", "or")}</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>
          )}

          {/* Google OAuth · only when configured */}
          {googleEnabled && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full bg-white border border-[#E5E7EB] hover:border-[#1276E3] hover:bg-[#F9FAFB] disabled:opacity-60 text-[#0B1A47] py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
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
            {t("تسجيل الدخول عبر Google", "Sign in with Google")}
          </button>
          )}

          <div className="mt-6 text-center">
            <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>{t("ليس لديك حساب؟ ", "No account yet? ")}</span>
            <Link to="/register" className="text-[#1276E3] hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>{t("إنشاء حساب جديد", "Create account")}</Link>
          </div>
        </motion.div>
      </div>

      {/* Left side - Brand */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#0B1A47] via-[#0F2156] to-[#1A2D5C] items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-[#1276E3]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-56 h-56 bg-[#349FC4]/10 rounded-full blur-3xl" />
        
        <div className="text-center max-w-md relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-white mb-4" style={{ fontSize: "30px", fontWeight: 700, lineHeight: 1.3 }}>{t("مرحباً بك في", "Welcome to")}<br /><EntixWordmark size={39} light /></h2>
            <p className="text-[#94A3B8] mb-10" style={{ fontSize: "15px", lineHeight: 1.9 }}>
              {t(
                "نظام محاسبة سحابي متكامل يعمل أونلاين وأوفلاين. متوافق مع ZATCA ومصمم خصيصاً للسوق السعودي.",
                "A cloud accounting platform that works online and offline, with ZATCA-ready workflows for Saudi businesses."
              )}
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-3">
            {[
              { icon: Shield, text: t("تشفير AES-256 لحماية البيانات", "Encrypted data protection") },
              { icon: Zap, text: t("أداء سريع وتجربة سلسة", "Fast and smooth experience") },
              { icon: Cloud, text: t("مزامنة ذكية مع عمل أوفلاين", "Smart sync with offline work") },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <item.icon className="w-5 h-5 text-[#349FC4] flex-shrink-0" />
                <span className="text-[#CBD5E1]" style={{ fontSize: "14px" }}>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
