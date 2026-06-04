/**
 * Forgot Password · request a reset link via email.
 * Uses authStore.requestPasswordReset → better-auth /api/auth/forget-password.
 */
import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";
import { EntixWordmark } from "../components/entix-brand";
import { useLanguage } from "../components/LanguageContext";

export function ForgotPassword() {
  const { language, t } = useLanguage();
  const isArabic = language === "ar";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t("الرجاء إدخال البريد الإلكتروني", "Enter your email address"));
      return;
    }

    setLoading(true);
    const result = await authStore.requestPasswordReset(email.trim());
    setLoading(false);

    if (result.success) {
      setSent(true);
      return;
    }

    const resultError = result.error || "";
    const looksLikeConnectionIssue =
      resultError.includes("الاتصال") ||
      resultError.toLowerCase().includes("network") ||
      resultError.toLowerCase().includes("connect");

    // Privacy: don't reveal whether email exists · show success either way.
    if (looksLikeConnectionIssue) setError(resultError);
    else setSent(true);
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

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "22px", fontWeight: 700 }}>
              {t("تحقق من بريدك", "Check your email")}
            </h1>
            <p className="text-[#374151] mb-4" style={{ fontSize: "14px", lineHeight: 1.7 }}>
              {t("إذا كان", "If")} <span className="font-english">{email}</span>{" "}
              {t("مسجلاً عندنا، فسيصلك رابط لإعادة تعيين كلمة المرور خلال دقائق.", "is registered, a password reset link will arrive within a few minutes.")}
            </p>
            <p className="text-[#6B7280]" style={{ fontSize: "13px" }}>
              {t("لم يصلك الرابط؟ تحقق من البريد المزعج أو", "No email yet? Check spam or")}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-[#1276E3] hover:underline ms-1"
              >
                {t("جرّب مرة أخرى", "try again")}
              </button>.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "30px", fontWeight: 700 }}>
              {t("نسيت كلمة المرور؟", "Forgot your password?")}
            </h1>
            <p className="text-[#6B7280] mb-8" style={{ fontSize: "15px", lineHeight: 1.6 }}>
              {t("أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين.", "Enter your email and we will send a secure reset link.")}
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
                  {t("البريد الإلكتروني", "Email address")}
                </label>
                <div className="relative">
                  <Mail className={`absolute ${isArabic ? "end-4" : "start-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]`} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className={`w-full px-4 py-3.5 ${isArabic ? "pe-12" : "ps-12"} rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all`}
                    style={{
                      fontSize: "14px",
                      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                      direction: "ltr",
                      textAlign: "left",
                    }}
                    required
                    autoFocus
                  />
                </div>
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
                    {t("جارٍ الإرسال...", "Sending...")}
                  </span>
                ) : (
                  t("إرسال رابط الاسترداد", "Send reset link")
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>
                {t("تذكرت كلمة المرور؟ ", "Remember your password? ")}
              </span>
              <Link to="/login" className="text-[#1276E3] hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>
                {t("سجّل الدخول", "Sign in")}
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
