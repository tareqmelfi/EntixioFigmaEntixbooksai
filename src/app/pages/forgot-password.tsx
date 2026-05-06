/**
 * Forgot Password · request a reset link via email.
 * Uses authStore.requestPasswordReset → better-auth /api/auth/forget-password.
 */
import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("الرجاء إدخال البريد الإلكتروني");
      return;
    }
    setLoading(true);
    const r = await authStore.requestPasswordReset(email.trim());
    setLoading(false);
    if (r.success) setSent(true);
    // Privacy: don't reveal whether email exists · show success either way
    else if (r.error?.includes("الاتصال")) setError(r.error);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-8 bg-white" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#0B1A47] mb-10 transition-colors" style={{ fontSize: "14px", fontWeight: 500 }}>
          <ArrowRight className="w-4 h-4" />
          العودة لتسجيل الدخول
        </Link>

        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0B1A47] to-[#1A2D5C] flex items-center justify-center shadow-sm">
            <span className="text-white" style={{ fontSize: "17px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
          </div>
          <span className="text-[#0B1A47]" style={{ fontSize: "22px", fontWeight: 700 }}>Entix Books</span>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "22px", fontWeight: 700 }}>تحقق من بريدك</h1>
            <p className="text-[#374151] mb-4" style={{ fontSize: "14px", lineHeight: 1.7 }}>
              إذا كان <span className="font-english">{email}</span> مسجلاً عندنا، فسيصلك رابط لإعادة تعيين كلمة المرور خلال دقائق.
            </p>
            <p className="text-[#6B7280]" style={{ fontSize: "13px" }}>
              لم يصلك الرابط؟ تحقق من البريد المزعج أو
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-[#1276E3] hover:underline ms-1"
              >جرّب مرة أخرى</button>.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "30px", fontWeight: 700 }}>نسيت كلمة المرور؟</h1>
            <p className="text-[#6B7280] mb-8" style={{ fontSize: "15px", lineHeight: 1.6 }}>
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين.
            </p>

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
                <label className="block text-[#0B1A47] mb-2" style={{ fontSize: "14px", fontWeight: 500 }}>البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@company.sa"
                    className="w-full px-4 py-3.5 pe-12 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                    style={{ fontSize: "14px", fontFamily: "Inter", direction: "ltr", textAlign: "right" }}
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
                    جارٍ الإرسال...
                  </span>
                ) : "إرسال رابط الاسترداد"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>تذكرت كلمة المرور؟ </span>
              <Link to="/login" className="text-[#1276E3] hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>سجّل الدخول</Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
