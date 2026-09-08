/**
 * /welcome — first-run chooser (2026-08-21 registration redesign)
 *
 * Registration creates the PERSON only (name · email · password). The first
 * sign-in lands here: create your company (name + country) or open a demo
 * company (country) that expires and self-cleans in 14 days. Nothing silent,
 * nothing in the wrong jurisdiction — the account≠company rule made visible.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";
import { Building2, Sparkles, Loader2, BadgeCheck } from "lucide-react";
import { EntixWordmark } from "../components/entix-brand";
import { PublicLanguageToggle } from "../components/public-preference-selector";
import { api, type PublicCheckoutSession } from "../lib/api";

type Choice = "company" | "demo";

export function Welcome() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  // Pay-first landing: Stripe returns here as /welcome?session_id=cs_… after a
  // successful public checkout. The webhook has already created the account +
  // company + ACTIVE subscription from the email Stripe collected; all that is
  // left for the buyer is a password. Without the parameter this page keeps its
  // original first-run behaviour untouched.
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const paidFlow = sessionId.startsWith("cs_");
  const [checkout, setCheckout] = useState<PublicCheckoutSession | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [activating, setActivating] = useState(false);

  // Poll while the webhook lands — a paid customer must never see a dead end.
  useEffect(() => {
    if (!paidFlow) return;
    let stop = false;
    let attempts = 0;
    const tick = async () => {
      try {
        const data = await api.public.checkoutSession(sessionId);
        if (stop) return;
        setCheckout(data);
        setCheckoutError(null);
        if (data.accountReady) return;
      } catch (e: any) {
        if (stop) return;
        setCheckoutError(e?.message || "session_unavailable");
      }
      if (++attempts < 20 && !stop) setTimeout(tick, 3000);
    };
    void tick();
    return () => { stop = true; };
  }, [paidFlow, sessionId]);

  const activate = async () => {
    if (!checkout?.email || newPassword.length < 8) {
      setCheckoutError(t("كلمة المرور 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    setActivating(true);
    setCheckoutError(null);
    try {
      const res = await api.public.activate(sessionId, newPassword);
      if (res.needsLogin) {
        navigate("/login", { replace: true });
        return;
      }
      const login = await authStore.login(checkout.email, newPassword, null);
      if (login.success) navigate("/app", { replace: true });
      else navigate("/login", { replace: true });
    } catch (e: any) {
      setCheckoutError(e?.message || t("تعذّر إنشاء كلمة المرور — حاول مجددًا", "Could not set the password — try again"));
    } finally {
      setActivating(false);
    }
  };
  const [auth, setAuth] = useState(authStore.getState());
  const [choice, setChoice] = useState<Choice>("company");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState<"SA" | "US">(() => {
    // Pre-pick from the visitor's market — the chooser stays explicit.
    try { return localStorage.getItem("entix-marketing-region") === "us" ? "US" : "SA"; } catch { return "SA"; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => authStore.subscribe(setAuth), []);

  // Guards: signed-out → login · already has orgs → app.
  useEffect(() => {
    // The pay-first landing has no session yet — never bounce a paying customer
    // to /login before they have a password.
    if (paidFlow) return;
    if (auth.loading) return;
    if (!auth.isAuthenticated) navigate("/login", { replace: true, state: { from: "/welcome" } });
    else if (auth.needsOnboarding === false) navigate("/app", { replace: true });
  }, [paidFlow, auth.loading, auth.isAuthenticated, auth.needsOnboarding, navigate]);

  const handleStart = async () => {
    if (choice === "company" && !companyName.trim()) {
      setError(t("اكتب اسم شركتك أولًا", "Enter your company name first"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authStore.bootstrapOrg({
      mode: choice,
      country,
      companyName: choice === "company" ? companyName.trim() : undefined,
    });
    setBusy(false);
    if (res.ok) navigate("/app", { replace: true });
    else setError(t("تعذّر الإنشاء — حاول مجددًا", "Could not create it — try again"));
  };

  if (paidFlow) {
    const ready = Boolean(checkout?.accountReady);
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center p-6" dir={language === "ar" ? "rtl" : "ltr"} data-testid="welcome-paid">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <EntixWordmark size={30} />
            <PublicLanguageToggle />
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-raised p-7">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-subtle text-success shrink-0">
                <BadgeCheck className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground m-0" data-testid="welcome-paid-title">
                  {t("تم الدفع — أنشئ كلمة المرور", "Payment received — create your password")}
                </h1>
                {checkout?.planName && (
                  <p className="text-xs text-muted-foreground mt-0.5 m-0">
                    {t("اشتراكك مفعّل:", "Your subscription is active:")} <span dir="auto">{checkout.planName}</span>
                  </p>
                )}
              </div>
            </div>

            <label className="block text-foreground mb-1.5 text-sm font-medium" htmlFor="welcome-paid-email">
              {t("البريد الإلكتروني", "Email")}
            </label>
            <input
              id="welcome-paid-email"
              data-testid="welcome-paid-email"
              value={checkout?.email || ""}
              readOnly
              dir="ltr"
              aria-readonly="true"
              className="w-full px-4 py-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground mb-1"
            />
            <p className="text-[11px] text-muted-foreground mb-4">
              {t("هذا هو البريد الذي دفعت به — الفاتورة الرسمية وصلت إليه.", "This is the email you paid with — your official invoice was sent there.")}
            </p>

            {checkout?.needsLogin ? (
              <>
                <p className="text-sm text-foreground mb-4">
                  {t("عندك حساب بهذا البريد — أضفنا الاشتراك إليه. سجّل الدخول للمتابعة.", "You already have an account with this email — the subscription was attached to it. Sign in to continue.")}
                </p>
                <Link
                  to="/login"
                  data-testid="welcome-paid-login"
                  className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {t("تسجيل الدخول", "Sign in")}
                </Link>
              </>
            ) : (
              <>
                <label className="block text-foreground mb-1.5 text-sm font-medium" htmlFor="welcome-paid-password">
                  {t("كلمة المرور الجديدة", "New password")}
                </label>
                <input
                  id="welcome-paid-password"
                  data-testid="welcome-paid-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                  autoComplete="new-password"
                  placeholder={t("8 أحرف على الأقل", "At least 8 characters")}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-muted/40 focus:bg-card focus:border-primary outline-none transition-all text-sm mb-4"
                />
                {checkoutError && <p className="text-sm text-danger mb-3" role="alert">{checkoutError}</p>}
                <button
                  onClick={activate}
                  disabled={activating || !ready}
                  data-testid="welcome-paid-submit"
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {(activating || !ready) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {ready
                    ? t("أنشئ كلمة المرور وادخل", "Create password & enter")
                    : t("جارٍ تفعيل اشتراكك...", "Activating your subscription...")}
                </button>
              </>
            )}
            <p className="text-[11px] text-muted-foreground mt-4 text-center">
              {t("أرسلنا لك أيضًا رابط تعيين كلمة المرور على بريدك.", "We also emailed you a set-password link.")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cardCls = (active: boolean) =>
    `w-full text-start rounded-xl border-2 p-4 transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`;

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6"><EntixWordmark size={30} /></div>
        <div className="rounded-2xl border border-border bg-surface shadow-raised p-7">
          <h1 className="text-xl font-bold text-foreground text-center mb-1">
            {t("أهلًا بك! كيف تريد أن تبدأ؟", "Welcome! How do you want to start?")}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t("حسابك جاهز — الخطوة التالية تخص الشركة، وتقدر تغيّر كل شيء لاحقًا.", "Your account is ready — the next step is about your company, and you can change everything later.")}
          </p>

          <div className="space-y-3 mb-5">
            <button type="button" onClick={() => setChoice("company")} className={cardCls(choice === "company")}>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold text-foreground text-sm">{t("إنشاء شركتي", "Create my company")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("شركة حقيقية تبدأ من الصفر — بياناتك أنت فقط", "A real company starting from zero — your data only")}</div>
                </div>
              </div>
            </button>
            <button type="button" onClick={() => setChoice("demo")} className={cardCls(choice === "demo")}>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold text-foreground text-sm">{t("استكشاف شركة تجريبية", "Explore a demo company")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("بيانات جاهزة للتجربة — تُحذف تلقائيًا بعد 14 يومًا", "Ready sample data to explore — auto-deleted after 14 days")}</div>
                </div>
              </div>
            </button>
          </div>

          {choice === "company" && (
            <div className="mb-4">
              <label className="block text-foreground mb-1.5 text-sm font-medium">{t("اسم الشركة", "Company name")}</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t("مثال: شركة النخبة للتجارة", "e.g. Acme Trading LLC")}
                className="w-full px-4 py-3 rounded-xl border border-border bg-muted/40 focus:bg-card focus:border-primary focus:ring-2 focus:ring-ring/10 outline-none transition-all text-sm"
                autoFocus
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-foreground mb-1.5 text-sm font-medium">
              {choice === "demo" ? t("دولة الديمو", "Demo country") : t("دولة الشركة", "Company country")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { c: "SA" as const, flag: "🇸🇦", ar: "السعودية", en: "Saudi Arabia", subAr: "ريال · VAT 15%", subEn: "SAR · VAT 15%" },
                { c: "US" as const, flag: "🇺🇸", ar: "أمريكا", en: "United States", subAr: "دولار · Sales Tax", subEn: "USD · Sales tax" },
              ]).map((o) => (
                <button key={o.c} type="button" onClick={() => setCountry(o.c)}
                  className={`rounded-lg border-2 px-3 py-2.5 text-start transition ${country === o.c ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <span className="text-lg">{o.flag}</span>
                  <span className="block text-sm font-semibold text-foreground mt-0.5">{t(o.ar, o.en)}</span>
                  <span className="block text-[11px] text-muted-foreground">{t(o.subAr, o.subEn)}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-danger mb-3">{error}</p>}

          <button onClick={handleStart} disabled={busy}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {choice === "company" ? t("إنشاء الشركة والدخول", "Create company & enter") : t("فتح الديمو والدخول", "Open demo & enter")}
          </button>
        </div>
      </div>
    </div>
  );
}
