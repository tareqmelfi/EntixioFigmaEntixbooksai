/**
 * /app/billing — subscription management (in-app, full page standard).
 * Current plan/status/trial · manage via Stripe portal · upgrade via checkout.
 * Checkout success/cancel land here (?success=true / ?canceled=true).
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  BadgeCheck, CreditCard, Crown, ExternalLink, Loader2, RefreshCw, Rocket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, { ar: string; en: string; bg: string }> = {
  TRIALING: { ar: "تجربة مجانية", en: "Free trial", bg: "bg-blue-100 text-blue-700" },
  ACTIVE: { ar: "نشط", en: "Active", bg: "bg-emerald-100 text-emerald-700" },
  PAST_DUE: { ar: "متأخر الدفع", en: "Past due", bg: "bg-amber-100 text-amber-700" },
  INCOMPLETE: { ar: "غير مكتمل", en: "Incomplete", bg: "bg-gray-100 text-gray-600" },
  CANCELED: { ar: "ملغي", en: "Canceled", bg: "bg-red-100 text-red-700" },
  EXPIRED: { ar: "منتهٍ", en: "Expired", bg: "bg-red-100 text-red-700" },
};

const money = (cents: number, currency = "sar") =>
  `${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency.toUpperCase() === "SAR" ? "ر.س" : currency.toUpperCase()}`;

export function Billing() {
  const { t } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [searchParams] = useSearchParams();
  const [sub, setSub] = useState<any | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"month" | "year">("month");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, p] = await Promise.all([
        api.stripe.subscription().catch(() => null),
        api.stripe.plans().catch(() => ({ plans: [] })),
      ]);
      setSub(s && !s.error ? s : null);
      setPlans(p.plans || []);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      push("success", t("تم الاشتراك بنجاح — يتم تفعيل حسابك خلال لحظات ✓", "Subscribed successfully — your account activates within moments ✓"), 7000);
      const timer = setTimeout(load, 4000);
      return () => clearTimeout(timer);
    }
    if (searchParams.get("canceled") === "true") {
      push("info", t("أُلغيت عملية الدفع — يمكنك الاشتراك في أي وقت", "Checkout canceled — you can subscribe anytime"), 5000);
    }
  }, [searchParams, load, push, t]);

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { url } = await api.stripe.customerPortal();
      window.location.href = url;
    } catch (e: any) {
      push("error", e instanceof ApiError && e.message === "no_stripe_customer" ? t("لا يوجد حساب دفع بعد — اشترك أولاً", "No billing account yet — subscribe first") : t("تعذر فتح بوابة الدفع", "Could not open the billing portal"));
      setBusy(null);
    }
  };

  const handleCheckout = async (priceId: string) => {
    setBusy(priceId);
    try {
      const { url } = await api.stripe.createCheckoutSession(
        priceId,
        `${window.location.origin}/app/billing?success=true`,
        `${window.location.origin}/app/billing?canceled=true`,
      );
      window.location.href = url;
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "";
      push("error", msg === "stripe_not_configured" ? t("الدفع غير مفعّل بعد — تواصل مع الدعم", "Payments not enabled yet — contact support") : t("تعذر بدء الدفع", "Could not start checkout"));
      setBusy(null);
    }
  };

  const status = sub?.status || "TRIALING";
  const statusMeta = STATUS_LABELS[status] || STATUS_LABELS.TRIALING;
  const daysLeft = sub?.trialEndsAt ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;
  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-GB") : null;
  const visiblePlans = plans.filter((p) => p.interval === cycle);
  const currentPriceId = sub?.plan?.stripePriceId;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الاشتراك والفوترة", "Subscription & Billing")}</h1>
        <p className="text-muted-foreground mt-1">{t("حالة اشتراكك · إدارة الدفع · الترقية بين الباقات", "Your subscription status · payment management · plan upgrades")}</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Current status */}
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3"><Crown className="h-6 w-6 text-primary" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                    {sub?.plan ? t(sub.plan.nameAr || sub.plan.name, sub.plan.name) : t("باقة التجربة", "Trial plan")}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusMeta.bg}`}>{t(statusMeta.ar, statusMeta.en)}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {status === "TRIALING" && daysLeft != null && t(`تبقى ${daysLeft} يوم على انتهاء التجربة`, `${daysLeft} days left in your trial`)}
                  {status === "ACTIVE" && periodEnd && t(`يتجدد في ${periodEnd}`, `Renews on ${periodEnd}`)}
                  {status === "PAST_DUE" && t("فشل آخر دفع — حدّث بطاقتك لتجنب الإيقاف", "Last payment failed — update your card to avoid suspension")}
                  {(status === "CANCELED" || status === "EXPIRED") && t("اشتراكك غير نشط — أعد الاشتراك لاستعادة كل المزايا", "Your subscription is inactive — resubscribe to restore everything")}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={load}><RefreshCw className="me-2 h-4 w-4" />{t("تحديث", "Refresh")}</Button>
              {sub?.stripeCustomerId && (
                <Button variant="outline" onClick={handlePortal} disabled={busy === "portal"}>
                  {busy === "portal" ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CreditCard className="me-2 h-4 w-4" />}
                  {t("إدارة الدفع والفواتير", "Manage payment & invoices")}
                  <ExternalLink className="ms-2 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      {visiblePlans.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-foreground" style={{ fontSize: "1.15rem", fontWeight: 700 }}>{t("الباقات", "Plans")}</h2>
            <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
              <button onClick={() => setCycle("month")} className={`rounded-md px-3 py-1.5 text-sm transition-colors ${cycle === "month" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: cycle === "month" ? 700 : 500 }}>{t("شهري", "Monthly")}</button>
              <button onClick={() => setCycle("year")} className={`rounded-md px-3 py-1.5 text-sm transition-colors ${cycle === "year" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: cycle === "year" ? 700 : 500 }}>{t("سنوي · وفّر", "Yearly · save")}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visiblePlans.map((p) => {
              const isCurrent = currentPriceId === p.stripePriceId && (status === "ACTIVE" || status === "TRIALING");
              const isPaid = p.price > 0;
              return (
                <Card key={p.id} className={`border-border ${p.tier === "professional" ? "ring-2 ring-primary/40" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground text-base">{t(p.nameAr || p.name, p.name)}</CardTitle>
                      {isCurrent && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><BadgeCheck className="h-3 w-3" />{t("باقتك", "Current")}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description || ""}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="font-english text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }} dir="ltr">
                      {money(p.price, p.currency)}
                      <span className="text-xs text-muted-foreground font-normal"> / {p.interval === "year" ? t("سنة", "year") : t("شهر", "month")}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-foreground/80">
                      {(Array.isArray(p.features) ? p.features : []).slice(0, 5).map((f: any, i: number) => (
                        <li key={i} className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />{typeof f === "string" ? f : (f.labelAr || f.label)}</li>
                      ))}
                    </ul>
                    {isPaid && (
                      <Button
                        onClick={() => handleCheckout(p.stripePriceId)}
                        disabled={busy === p.stripePriceId || isCurrent}
                        className={`w-full ${isCurrent ? "bg-muted text-muted-foreground" : "bg-primary hover:bg-primary/90"}`}
                      >
                        {busy === p.stripePriceId ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <><Rocket className="me-2 h-4 w-4" />{isCurrent ? t("باقتك الحالية", "Your current plan") : t("اشترك الآن", "Subscribe now")}</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center">{t("دفع آمن عبر Stripe · يمكنك الإلغاء في أي وقت من بوابة الدفع", "Secure payment via Stripe · cancel anytime from the billing portal")}</p>
        </>
      )}
    </div>
  );
}
