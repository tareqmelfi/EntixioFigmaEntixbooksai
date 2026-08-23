/**
 * /buy · pay-first guest checkout (owner directive 2026-08-22).
 *
 * A visitor picks a plan on /pricing and lands here WITHOUT an account:
 * confirm plan → enter email → Stripe checkout. The webhook creates the
 * account + company + ACTIVE subscription after payment and emails the
 * set-password claim link. No card, no account, no trial window — pay first.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { useMarketingRegion } from "../components/marketing-region";
import { SharedNavbar } from "../components/shared-navbar";
import { SharedFooter } from "../components/shared-footer";

interface PublicPlan {
  stripePriceId: string;
  tier: string;
  interval: string;
  currency: string;
  price: number;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  features?: Array<{ key: string; label: string; labelEn?: string }> | null;
}

export function BuyPage() {
  const { t, language } = useLanguage();
  const { isSA } = useMarketingRegion();
  const isAr = language !== "en";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tier = params.get("tier") || "professional";
  const interval = params.get("interval") === "month" ? "month" : "year";
  const currency = (params.get("currency") || (isSA ? "sar" : "usd")).toLowerCase();

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (api as any).request || null;
    fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/api/stripe/public-plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, []);

  const plan = useMemo(
    () => plans.find((p) => p.tier === tier && p.interval === interval && String(p.currency).toLowerCase() === currency),
    [plans, tier, interval, currency],
  );

  const pay = async () => {
    if (!plan) return;
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError(t("أدخل بريدًا صحيحًا — رابط التفعيل يصلك عليه بعد الدفع", "Enter a valid email — your activation link arrives there after payment"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/api/stripe/public-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.stripePriceId, email: clean, country: isSA ? "SA" : "US", locale: isAr ? "ar" : "en" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "checkout_failed");
      window.location.href = data.url;
    } catch (e: any) {
      setError(t("تعذّر فتح صفحة الدفع — حاول مرة أخرى أو راسل support@entix.io", "Could not open secure checkout — try again or email support@entix.io"));
      setBusy(false);
    }
  };

  const priceFmt = (cents: number, cur: string) =>
    `${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur.toUpperCase() === "SAR" ? t("ر.س", "SAR") : "USD"}`;

  return (
    <div className="min-h-screen bg-background">
      <SharedNavbar />
      <main className="max-w-xl mx-auto px-4 py-12">
        <button onClick={() => navigate("/pricing")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> {t("عودة للباقات", "Back to plans")}
        </button>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 800 }}>
          {t("أكمل الدفع — حسابك يُنشأ بعده مباشرة", "Complete payment — your account is created right after")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("الدفع مباشر والتفعيل فوري: بعد الدفع يصلك بريد لتعيين كلمة المرور وتدخل شركتك الجديدة.", "Pay first, activate instantly: after payment you get an email to set your password and enter your new company.")}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          {plan ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-foreground" style={{ fontWeight: 700 }}>{isAr ? plan.nameAr || plan.name : plan.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {interval === "year" ? t("سنوي", "Yearly") : t("شهري", "Monthly")} · {currency.toUpperCase()}
                  </div>
                </div>
                <div className="text-foreground font-english" style={{ fontSize: "1.5rem", fontWeight: 800 }}>
                  {priceFmt(plan.price, plan.currency)}<span className="text-xs text-muted-foreground font-normal">/{interval === "year" ? t("سنة", "yr") : t("شهر", "mo")}</span>
                </div>
              </div>
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                  {plan.features.map((f) => (
                    <li key={f.key} className="text-sm text-foreground/80 flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      {isAr ? f.label : f.labelEn || f.label}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("جارٍ تحميل الباقة...", "Loading plan...")}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <label className="text-xs text-muted-foreground">{t("البريد الإلكتروني (يُستخدم للفاتورة وتفعيل الحساب)", "Email (used for the receipt and account activation)")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              dir="ltr"
              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm font-english"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={pay}
              disabled={busy || !plan}
              className="w-full rounded-xl bg-primary py-3 text-white hover:bg-primary/90 disabled:opacity-60 transition"
              style={{ fontWeight: 700 }}
            >
              {busy ? t("جارٍ تحويلك إلى الدفع الآمن...", "Taking you to secure checkout...") : t("ادفع الآن عبر Stripe الآمنة", "Pay now via secure Stripe")}
            </button>
            <p className="text-[11px] text-muted-foreground/70 text-center">
              {t("لا تُحفظ بيانات البطاقة لدينا · إلغاء في أي وقت من بوابة الفوترة", "Card details are never stored with us · cancel anytime from the billing portal")}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("عندك حساب؟", "Have an account?")}{" "}
          <a href="/login" className="text-primary hover:underline">{t("سجّل الدخول واشترك من صفحة الفوترة", "Sign in and subscribe from billing")}</a>
        </p>
      </main>
      <SharedFooter />
    </div>
  );
}
