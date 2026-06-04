/**
 * Reset Password · accepts a token from the email link, sets new password.
 * URL: /reset-password?token=...
 */
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { EntixWordmark } from "../components/entix-brand";
import { useLanguage } from "../components/LanguageContext";

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { language, t } = useLanguage();
  const isArabic = language === "ar";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t("الرابط غير صحيح أو منتهي الصلاحية · الرجاء طلب رابط جديد.", "This reset link is invalid or expired. Please request a new one."));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 8) {
      setError(t("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }

    if (password !== confirm) {
      setError(t("كلمتا المرور غير متطابقتين", "Passwords do not match"));
      return;
    }

    setLoading(true);
    const result = await authStore.resetPassword(token, password);
    setLoading(false);

    if (result.success) {
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } else {
      setError(result.error || t("تعذّر تعيين كلمة المرور · الرابط قد يكون منتهي الصلاحية", "Could not reset the password. The link may be expired."));
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-8 bg-white"
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        fontFamily: isArabic ? "var(--entix-font-ar)" : "var(--entix-font-en)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#0B1A47] mb-10 transition-colors"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          <BackIcon className="w-4 h-4" />
          {t("العودة لتسجيل الدخول", "Back to sign in")}
        </Link>

        <div className="flex items-center mb-10">
          <EntixWordmark size={27} />
        </div>

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "22px", fontWeight: 700 }}>
              {t("تم بنجاح", "Password updated")}
            </h1>
            <p className="text-[#374151] mb-2" style={{ fontSize: "14px", lineHeight: 1.7 }}>
              {t("تم تعيين كلمة المرور الجديدة. سيتم تحويلك لصفحة تسجيل الدخول...", "Your new password has been saved. Redirecting to sign in...")}
            </p>
          </div>
        ) : !token ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
            <h1 className="text-[#0B1A47] mb-2 text-center" style={{ fontSize: "20px", fontWeight: 700 }}>
              {t("رابط غير صالح", "Invalid link")}
            </h1>
            <p className="text-[#374151] text-center mb-4" style={{ fontSize: "14px", lineHeight: 1.7 }}>
              {t("الرابط منتهي الصلاحية أو تم استخدامه. الرجاء طلب رابط استرداد جديد.", "This link has expired or was already used. Request a new reset link.")}
            </p>
            <div className="text-center">
              <Link to="/forgot-password" className="text-[#1276E3] hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>
                {t("طلب رابط جديد", "Request a new link")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "30px", fontWeight: 700 }}>
              {t("إعادة تعيين كلمة المرور", "Reset your password")}
            </h1>
            <p className="text-[#6B7280] mb-8" style={{ fontSize: "15px", lineHeight: 1.6 }}>
              {t("اختر كلمة مرور جديدة قوية لحسابك.", "Choose a new secure password for your account.")}
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6"
                style={{ fontSize: "14px" }}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[#0B1A47] mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>
                  {t("كلمة المرور الجديدة", "New password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    className={`w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all ${isArabic ? "pe-12" : "ps-12"}`}
                    style={{
                      fontSize: "14px",
                      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                      direction: "ltr",
                      textAlign: "left",
                    }}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${isArabic ? "left-3.5" : "right-3.5"} top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]`}
                    aria-label={showPassword ? t("إخفاء كلمة المرور", "Hide password") : t("إظهار كلمة المرور", "Show password")}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[#9CA3AF] mt-1.5" style={{ fontSize: "12px" }}>
                  {t("على الأقل 8 أحرف", "At least 8 characters")}
                </p>
              </div>

              <div>
                <label className="block text-[#0B1A47] mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>
                  {t("تأكيد كلمة المرور", "Confirm password")}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                  style={{
                    fontSize: "14px",
                    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                    direction: "ltr",
                    textAlign: "left",
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1276E3] hover:bg-[#0B5FBF] disabled:opacity-60 text-white py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-[#1276E3]/25"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("جارٍ الحفظ...", "Saving...")}
                  </span>
                ) : (
                  t("تعيين كلمة المرور", "Update password")
                )}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
