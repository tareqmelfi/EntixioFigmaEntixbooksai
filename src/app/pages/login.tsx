import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { authStore } from "../components/auth-store";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    setTimeout(() => {
      const result = authStore.login(email, password);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.error || "حدث خطأ");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/landing" className="inline-flex items-center gap-1 text-[#6B7280] hover:text-[#0B1A47] mb-8 transition-colors" style={{ fontSize: "14px" }}>
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0B1A47] flex items-center justify-center">
              <span className="text-white" style={{ fontSize: "16px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
            </div>
            <span className="text-[#0B1A47]" style={{ fontSize: "22px", fontWeight: 700 }}>Entix Books</span>
          </div>

          <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "28px", fontWeight: 700 }}>تسجيل الدخول</h1>
          <p className="text-[#6B7280] mb-8" style={{ fontSize: "15px" }}>أدخل بياناتك للوصول إلى حسابك</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" style={{ fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[#0B1A47] mb-1.5" style={{ fontSize: "14px", fontWeight: 500 }}>البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.sa"
                className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/20 outline-none transition-all"
                style={{ fontSize: "14px", fontFamily: "Inter", direction: "ltr", textAlign: "right" }}
                required
              />
            </div>
            <div>
              <label className="block text-[#0B1A47] mb-1.5" style={{ fontSize: "14px", fontWeight: 500 }}>كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/20 outline-none transition-all pe-12"
                  style={{ fontSize: "14px", fontFamily: "Inter", direction: "ltr", textAlign: "right" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1276E3] hover:bg-[#0B5FBF] disabled:opacity-60 text-white py-3 rounded-lg transition-colors cursor-pointer"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>ليس لديك حساب؟ </span>
            <Link to="/register" className="text-[#1276E3] hover:underline" style={{ fontSize: "14px", fontWeight: 500 }}>إنشاء حساب جديد</Link>
          </div>

          {/* Demo credentials hint */}
          <div className="mt-8 bg-[#F0F7FF] border border-[#1276E3]/10 rounded-lg p-4">
            <p className="text-[#0B1A47] mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>بيانات الدخول التجريبية:</p>
            <div dir="ltr" className="space-y-1" style={{ fontSize: "13px", fontFamily: "Inter", color: "#6B7280" }}>
              <p>Email: tareq@fc.sa</p>
              <p>Password: Hh8787965</p>
            </div>
          </div>
        </div>
      </div>

      {/* Left side - Brand */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#0B1A47] to-[#1A2D5C] items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-8">
            <span className="text-white" style={{ fontSize: "32px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
          </div>
          <h2 className="text-white mb-4" style={{ fontSize: "28px", fontWeight: 700 }}>مرحباً بك في Entix Books</h2>
          <p className="text-[#94A3B8]" style={{ fontSize: "15px", lineHeight: 1.8 }}>
            نظام محاسبة سحابي متكامل يعمل أونلاين وأوفلاين.
            متوافق مع ZATCA ومصمم خصيصاً للسوق السعودي.
          </p>
        </div>
      </div>
    </div>
  );
}
