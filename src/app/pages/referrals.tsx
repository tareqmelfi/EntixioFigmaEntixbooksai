/**
 * Referrals · marketing page for the ENTIX.IO referral program
 * Invitee gets a discount code · referrer earns 50% commission (approved-marketer agreement)
 * Code generator is client-side for now; payout onboarding via support until the referrals API ships.
 */
import { useState } from "react";
import { Link } from "react-router";
import { Gift, Users, Copy, CheckCircle2, ArrowLeft, Wallet, Share2, BadgePercent, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";
import { useLanguage } from "../components/LanguageContext";

function makeCode(seed: string): string {
  const clean = seed.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PARTNER";
  let hash = 0;
  const s = seed.trim() + Date.now().toString(36);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return `ENTIX-${clean}-${hash.toString(36).toUpperCase().slice(0, 4).padStart(4, "0")}`;
}

export function Referrals() {
  const { language, t } = useLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = () => {
    if (!name.trim()) return;
    setCode(makeCode(name));
    setCopied(false);
  };

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* clipboard denied */ }
  };

  const steps = [
    { icon: Share2, title: t("شارك كودك", "Share your code"), desc: t("أنشئ كود الإحالة الخاص بك وأرسله لأصحاب الأعمال — أو شارك رابط التسجيل مع الكود.", "Create your referral code and send it to business owners — or share the signup link with the code.") },
    { icon: BadgePercent, title: t("يحصلون على خصم", "They get a discount"), desc: t("كل مشترك جديد يستخدم كودك يحصل على خصم على اشتراكه الأول — بالإضافة لشهره المجاني.", "Every new subscriber using your code gets a discount on their first subscription — on top of the free month.") },
    { icon: Wallet, title: t("تكسب عمولة 50%", "You earn 50%"), desc: t("تحصل على عمولة 50% من أول اشتراك مدفوع لكل شركة تنضم بكودك — تُحوَّل لك كمسوّق معتمد.", "You earn 50% of the first paid subscription of every company joining with your code — paid to you as an approved marketer.") },
  ];

  return (
    <div className="min-h-screen bg-white" dir={language === "ar" ? "rtl" : "ltr"}>
      <SharedNavbar />

      <main>
        {/* Hero */}
        <section className="pt-28 sm:pt-32 pb-14 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 bg-primary text-white px-4 py-1.5 rounded-full mb-5" style={{ fontSize: "13px", fontWeight: 700 }}>
              <Gift className="w-4 h-4" />
              {t("برنامج الإحالة", "Referral program")}
            </span>
            <h1 className="text-foreground mb-4" style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, lineHeight: 1.25 }}>
              {t("زد دخلك 50% مع كل شركة تُحيلها", "Earn 50% for every company you refer")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: "16px", lineHeight: 1.9 }}>
              {t(
                "أحِل أصحاب الأعمال إلى ENTIX.IO: هم يحصلون على خصم وشهر مجاني، وأنت تحصل على عمولة 50% من أول اشتراك مدفوع — بعقد مسوّق معتمد وآلية دفع موثّقة.",
                "Refer business owners to ENTIX.IO: they get a discount plus a free month, and you earn 50% of their first paid subscription — under an approved-marketer agreement with a documented payout process."
              )}
            </p>
          </motion.div>
        </section>

        {/* Steps */}
        <section className="pb-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:border-primary/20 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-primary/5 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-muted-foreground mb-1" style={{ fontSize: "12px", fontWeight: 700 }}>{i + 1}</div>
                <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 700 }}>{s.title}</h3>
                <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: 1.8 }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Code generator */}
        <section className="pb-14 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-2xl mx-auto rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 sm:p-10"
          >
            <h2 className="text-foreground text-center mb-2" style={{ fontSize: "clamp(19px, 3vw, 24px)", fontWeight: 800 }}>
              {t("أنشئ كود الإحالة الخاص بك", "Generate your referral code")}
            </h2>
            <p className="text-muted-foreground text-center mb-6" style={{ fontSize: "14px" }}>
              {t("اكتب اسمك أو اسم شركتك — وسيظهر كودك فوراً لمشاركته", "Enter your name or company name — your code appears instantly, ready to share")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("مثال: طارق أو شركة الأفق", "e.g. Tareq or Horizon Co.")}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors"
                style={{ fontSize: "15px" }}
                onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
              />
              <button
                onClick={generate}
                disabled={!name.trim()}
                className="bg-primary hover:bg-primary/80 disabled:opacity-50 text-white px-7 py-3 rounded-xl transition-all cursor-pointer"
                style={{ fontSize: "14px", fontWeight: 700 }}
              >
                {t("أنشئ الكود", "Generate code")}
              </button>
            </div>
            {code && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
                <div className="flex items-center gap-2 bg-white border border-primary/30 rounded-xl px-4 py-3">
                  <code className="flex-1 text-primary font-bold tracking-wide" style={{ fontSize: "16px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, monospace" }} dir="ltr">
                    {code}
                  </code>
                  <button
                    onClick={copy}
                    className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    style={{ fontSize: "13px", fontWeight: 600 }}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? t("تم النسخ", "Copied") : t("نسخ", "Copy")}
                  </button>
                </div>
                <p className="text-muted-foreground mt-3 text-center" style={{ fontSize: "12px", lineHeight: 1.8 }}>
                  {t(
                    "لتفعيل الكود رسمياً وبدء تتبع عمولاتك، راسلنا على support@entix.io بكودك — سنرسل لك عقد المسوّق المعتمد ورابط التتبع الخاص بك.",
                    "To officially activate your code and start tracking your commissions, email support@entix.io with your code — we will send your approved-marketer agreement and tracking link."
                  )}
                </p>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Terms */}
        <section className="pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto bg-muted/40 rounded-2xl border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="text-foreground" style={{ fontSize: "16px", fontWeight: 700 }}>{t("شروط البرنامج باختصار", "Program terms in brief")}</h3>
            </div>
            <ul className="space-y-2.5">
              {[
                t("العمولة 50% من أول اشتراك مدفوع فقط (وليست من التجديدات).", "Commission is 50% of the first paid subscription only (not renewals)."),
                t("خصم المشترك الجديد يُطبَّق على أول فاتورة — ويحتفظ بشهره المجاني.", "The new subscriber's discount applies to their first invoice — and they keep their free month."),
                t("الدفع يتم شهرياً بعد تجاوز فترة الاسترجاع، بإثباتات موثّقة.", "Payouts run monthly after the refund window, with documented statements."),
                t("يلزم توقيع عقد المسوّق المعتمد قبل أول تحويل.", "An approved-marketer agreement is signed before the first payout."),
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-muted-foreground" style={{ fontSize: "13px", lineHeight: 1.8 }}>
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-gradient-to-br from-foreground to-primary rounded-3xl p-10 sm:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-56 h-56 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10">
                <Users className="w-8 h-8 text-white/80 mx-auto mb-4" />
                <h2 className="text-white mb-3" style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800 }}>
                  {t("جاهز تبدأ تكسب معنا؟", "Ready to start earning with us?")}
                </h2>
                <p className="text-white/70 mb-7" style={{ fontSize: "15px" }}>
                  {t("أنشئ كودك اليوم وشاركه — أو سجّل حسابك المجاني أولاً لتجربة المنصة بنفسك.", "Generate your code today and share it — or create your free account first to try the platform yourself.")}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    to="/register"
                    className="bg-white hover:bg-gray-50 text-foreground px-8 py-3.5 rounded-xl transition-all hover:shadow-xl flex items-center gap-2"
                    style={{ fontSize: "15px", fontWeight: 700 }}
                  >
                    {t("سجّل مجاناً", "Sign up free")}
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                  <a
                    href="mailto:support@entix.io?subject=Referral%20Program"
                    className="border border-white/20 hover:border-white/40 text-white px-8 py-3.5 rounded-xl transition-all"
                    style={{ fontSize: "15px", fontWeight: 500 }}
                  >
                    {t("تواصل معنا", "Contact us")}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
