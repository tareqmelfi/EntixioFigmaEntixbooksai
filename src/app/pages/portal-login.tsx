import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Mail, ArrowRight, Shield } from "lucide-react";
import { EntixWordmark } from "../components/entix-brand";

type Step = "email" | "otp";

export function PortalLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "otp" && countdown > 0) {
      const timer = setInterval(() => setCountdown((p) => { if (p <= 1) { setCanResend(true); return 0; } return p - 1; }), 1000);
      return () => clearInterval(timer);
    }
  }, [step, countdown]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) { setStep("otp"); setCountdown(60); setCanResend(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.every((d) => d)) navigate("/portal");
  };

  return (
    <div className="min-h-screen bg-[#F4FCFF] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl bg-white border border-[#E5E7EB] p-8" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="mt-2"><EntixWordmark size={22} /></h1>
            <p className="text-sm text-[#6B7280] mt-1">بوابة الأطراف</p>
          </div>

          {step === "email" && (
            <form onSubmit={handleEmailSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#374151] mb-1.5" style={{ fontWeight: 500 }}>البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                    <input
                      type="email"
                      dir="ltr"
                      className="w-full rounded-lg border border-[#E5E7EB] ps-10 pe-3 py-3 text-sm font-english text-[#374151] placeholder:text-[#9CA3AF] focus:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20"
                      placeholder="ahmed@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#1276E3] px-4 py-3.5 text-sm text-white hover:bg-[#1060C0] transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  إرسال رمز الدخول
                </button>
              </div>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit}>
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm text-[#6B7280]">
                    أرسلنا رمز من 6 أرقام إلى
                  </p>
                  <p className="text-sm text-[#0B1B49] font-english mt-0.5" style={{ fontWeight: 600 }}>{email}</p>
                </div>

                {/* OTP inputs */}
                <div dir="ltr" className="flex justify-center gap-2.5">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="h-12 w-12 rounded-lg border border-[#E5E7EB] text-center font-english text-[#0B1B49] focus:border-[#1276E3] focus:outline-none focus:ring-2 focus:ring-[#1276E3]/20"
                      style={{ fontSize: "1.5rem", fontWeight: 700 }}
                    />
                  ))}
                </div>

                {/* Resend */}
                <div className="text-center">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={() => { setCountdown(60); setCanResend(false); }}
                      className="text-xs text-[#1276E3] hover:underline"
                      style={{ fontWeight: 500 }}
                    >
                      أعد إرسال الرمز
                    </button>
                  ) : (
                    <p className="text-xs text-[#9CA3AF]">
                      ما وصلك الرمز؟ أعد الإرسال بعد <span className="font-english" style={{ fontWeight: 600 }}>{countdown}</span> ثانية
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!otp.every((d) => d)}
                  className="w-full rounded-lg bg-[#1276E3] px-4 py-3.5 text-sm text-white hover:bg-[#1060C0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  دخول
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-[#6B7280] hover:text-[#1276E3] transition-colors"
                >
                  <ArrowRight className="h-3 w-3" />
                  تغيير البريد الإلكتروني
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-2">
          <Shield className="h-3.5 w-3.5 text-[#9CA3AF]" />
          <span className="text-xs text-[#9CA3AF]">هذا الرابط آمن ومقدم من</span>
          <span className="text-xs text-[#9CA3AF] font-english" style={{ fontWeight: 600 }}>ENTIX.IO — entix.io</span>
        </div>
      </div>
    </div>
  );
}
