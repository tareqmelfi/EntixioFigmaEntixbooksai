import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, ArrowRight, Shield, Zap, Cloud } from "lucide-react";
import { motion } from "motion/react";
import { authStore } from "../components/auth-store";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (authStore.getState().isAuthenticated) navigate("/");
  }, [navigate]);

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
    }, 600);
  };

  return (
    <div className="min-h-screen flex" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Link to="/landing" className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#0B1A47] mb-10 transition-colors" style={{ fontSize: "14px", fontWeight: 500 }}>
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0B1A47] to-[#1A2D5C] flex items-center justify-center shadow-sm">
              <span className="text-white" style={{ fontSize: "17px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
            </div>
            <span className="text-[#0B1A47]" style={{ fontSize: "22px", fontWeight: 700 }}>Entix Books</span>
          </div>

          <h1 className="text-[#0B1A47] mb-2" style={{ fontSize: "30px", fontWeight: 700 }}>تسجيل الدخول</h1>
          <p className="text-[#6B7280] mb-8" style={{ fontSize: "15px", lineHeight: 1.6 }}>أدخل بياناتك للوصول إلى حسابك</p>

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
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.sa"
                className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all"
                style={{ fontSize: "14px", fontFamily: "Inter", direction: "ltr", textAlign: "right" }}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#0B1A47]" style={{ fontSize: "14px", fontWeight: 500 }}>كلمة المرور</label>
                <a href="#" className="text-[#1276E3] hover:underline" style={{ fontSize: "13px" }}>نسيت كلمة المرور؟</a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] focus:bg-white focus:border-[#1276E3] focus:ring-2 focus:ring-[#1276E3]/10 outline-none transition-all pe-12"
                  style={{ fontSize: "14px", fontFamily: "Inter", direction: "ltr", textAlign: "right" }}
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
                  جارٍ تسجيل الدخول...
                </span>
              ) : "تسجيل الدخول"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[#6B7280]" style={{ fontSize: "14px" }}>ليس لديك حساب؟ </span>
            <Link to="/register" className="text-[#1276E3] hover:underline" style={{ fontSize: "14px", fontWeight: 600 }}>إنشاء حساب جديد</Link>
          </div>

          {/* Demo credentials */}
          <div className="mt-8 bg-gradient-to-l from-[#F0F7FF] to-[#E8F4FD] border border-[#1276E3]/10 rounded-xl p-4">
            <p className="text-[#0B1A47] mb-2" style={{ fontSize: "13px", fontWeight: 600 }}>بيانات الدخول التجريبية:</p>
            <div dir="ltr" className="space-y-1" style={{ fontSize: "13px", fontFamily: "Inter", color: "#6B7280" }}>
              <p>Email: <span className="text-[#0B1A47]" style={{ fontWeight: 500 }}>tareq@fc.sa</span></p>
              <p>Password: <span className="text-[#0B1A47]" style={{ fontWeight: 500 }}>Hh8787965</span></p>
            </div>
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
            <div className="w-20 h-20 mx-auto rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8 border border-white/10">
              <span className="text-white" style={{ fontSize: "32px", fontWeight: 700, fontFamily: "Inter" }}>E</span>
            </div>
            <h2 className="text-white mb-4" style={{ fontSize: "30px", fontWeight: 700, lineHeight: 1.3 }}>مرحباً بك في<br />Entix Books</h2>
            <p className="text-[#94A3B8] mb-10" style={{ fontSize: "15px", lineHeight: 1.9 }}>
              نظام محاسبة سحابي متكامل يعمل أونلاين وأوفلاين.
              متوافق مع ZATCA ومصمم خصيصاً للسوق السعودي.
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-3">
            {[
              { icon: Shield, text: "تشفير AES-256 لحماية البيانات" },
              { icon: Zap, text: "أداء سريع وتجربة سلسة" },
              { icon: Cloud, text: "مزامنة ذكية مع عمل أوفلاين" },
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
