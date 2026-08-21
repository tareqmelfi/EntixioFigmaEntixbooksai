/**
 * /welcome — first-run chooser (2026-08-21 registration redesign)
 *
 * Registration creates the PERSON only (name · email · password). The first
 * sign-in lands here: create your company (name + country) or open a demo
 * company (country) that expires and self-cleans in 14 days. Nothing silent,
 * nothing in the wrong jurisdiction — the account≠company rule made visible.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { authStore } from "../components/auth-store";
import { useLanguage } from "../components/LanguageContext";
import { Building2, Sparkles, Loader2 } from "lucide-react";
import { EntixWordmark } from "../components/entix-brand";

type Choice = "company" | "demo";

export function Welcome() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
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
    if (auth.loading) return;
    if (!auth.isAuthenticated) navigate("/login", { replace: true, state: { from: "/welcome" } });
    else if (auth.needsOnboarding === false) navigate("/app", { replace: true });
  }, [auth.loading, auth.isAuthenticated, auth.needsOnboarding, navigate]);

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
                className="w-full px-4 py-3 rounded-xl border border-border bg-muted/40 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/10 outline-none transition-all text-sm"
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
