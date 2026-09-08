import { displayLocale } from "../lib/number-display";
import { getOrgId } from "../lib/api";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { InlineAlert, PageHeader } from "../components/product";
import { ToastStack, useToasts } from "../components/side-panel";
import { api, ApiError, type PlatformInvoice, type BillingParty } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, { ar: string; en: string; bg: string }> = {
  TRIALING: { ar: "تجربة مجانية", en: "Free trial", bg: "bg-info-subtle text-info" },
  ACTIVE: { ar: "نشط", en: "Active", bg: "bg-success-subtle text-success" },
  PAST_DUE: { ar: "متأخر الدفع", en: "Past due", bg: "bg-warning-subtle text-warning" },
  INCOMPLETE: { ar: "غير مكتمل", en: "Incomplete", bg: "bg-surface-hover text-muted-foreground" },
  CANCELED: { ar: "ملغي", en: "Canceled", bg: "bg-danger-subtle text-danger" },
  EXPIRED: { ar: "منتهٍ", en: "Expired", bg: "bg-danger-subtle text-danger" },
};

const money = (cents: number, currency = "sar", isEn = false) =>
  `${(cents / 100).toLocaleString(displayLocale("en-US"), { maximumFractionDigits: 0 })} ${currency.toUpperCase() === "SAR" ? (isEn ? "SAR" : "ر.س") : currency.toUpperCase()}`;

export function Billing() {
  const { t, language } = useLanguage();
  const isEn = language === "en";
  const { toasts, push, dismiss } = useToasts();
  const [searchParams] = useSearchParams();
  const [sub, setSub] = useState<any | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"month" | "year">("year");
  // Plan currency follows the org's country (US → USD · everyone else → SAR),
  // unless the active subscription already carries a currency.
  const [planCurrency, setPlanCurrency] = useState<"sar" | "usd">("sar");
  const [tab, setTab] = useState<"subscription" | "invoices">("subscription");
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [invoiceParties, setInvoiceParties] = useState<{ seller: BillingParty | null; buyer: BillingParty | null }>({ seller: null, buyer: null });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, p, orgs, inv] = await Promise.all([
        api.stripe.subscription().catch(() => null),
        api.stripe.plans().catch(() => ({ plans: [] })),
        api.orgs.list().catch(() => []),
        // Official platform invoices — never blocks the page if it fails.
        api.stripe.invoices().catch(() => ({ invoices: [] as PlatformInvoice[], seller: null, buyer: null })),
      ]);
      setInvoices(inv.invoices || []);
      setInvoiceParties({ seller: inv.seller || null, buyer: inv.buyer || null });
      const active = s && !s.error ? s : null;
      setSub(active);
      setPlans(p.plans || []);
      if (active?.plan?.currency) {
        setPlanCurrency(String(active.plan.currency).toLowerCase() === "usd" ? "usd" : "sar");
      } else {
        const storedId = getOrgId();
        const org = (storedId ? (orgs as any[]).find((o) => o.id === storedId) : null);
        setPlanCurrency(org?.country === "US" ? "usd" : "sar");
      }
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
  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString(displayLocale("en-GB")) : null;
  const visiblePlans = plans.filter(
    (p) => p.interval === cycle && String(p.currency || "sar").toLowerCase() === planCurrency,
  );
  const currentPriceId = sub?.plan?.stripePriceId;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow={t("الإعدادات", "Settings")}
        title={t("الاشتراك والفوترة", "Subscription & Billing")}
        description={t("حالة اشتراكك · إدارة الدفع · الترقية بين الباقات", "Your subscription status · payment management · plan upgrades")}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      {/* Subscription · Invoices — the official tax invoice for every payment
          lives here (CEO 2026-09-08), beside Stripe's own PDF. */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit" role="tablist">
        {([
          { id: "subscription" as const, ar: "الاشتراك", en: "Subscription" },
          { id: "invoices" as const, ar: "الفواتير", en: "Invoices" },
        ]).map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            data-testid={`billing-tab-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
            style={{ fontWeight: tab === item.id ? 700 : 500 }}
          >
            {t(item.ar, item.en)}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        <div className="space-y-4" data-testid="billing-invoices">
          {/* Company + VAT data — read from settings, never invented. */}
          <Card className="border-border">
            <CardContent className="p-5 grid gap-4 sm:grid-cols-2">
              {([
                { label: t("الجهة المُصدِّرة", "Issued by"), party: invoiceParties.seller },
                { label: t("بيانات منشأتك", "Your company"), party: invoiceParties.buyer },
              ]).map((block) => (
                <div key={block.label}>
                  <div className="text-xs text-muted-foreground mb-1">{block.label}</div>
                  <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                    <bdi dir="auto">{block.party?.legalName || block.party?.name || "—"}</bdi>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("الرقم الضريبي", "VAT no.")}{" "}
                    {block.party?.vatNumber
                      ? <span className="font-code" dir="ltr">{block.party.vatNumber}</span>
                      : <span className="ph text-warning" data-placeholder="vatNumber">{t("غير مُسجَّل في الإعدادات", "Not set in settings")}</span>}
                  </div>
                  {block.party?.crNumber && (
                    <div className="text-xs text-muted-foreground">
                      {t("السجل التجاري", "CR")} <span className="font-code" dir="ltr">{block.party.crNumber}</span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {invoices.length === 0 ? (
            <InlineAlert tone="info">
              {t("لا توجد فواتير اشتراك بعد — تظهر هنا فور اكتمال أول عملية دفع.", "No subscription invoices yet — they appear here as soon as your first payment completes.")}
            </InlineAlert>
          ) : (
            <div className="ledger-table overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start p-3 text-xs text-muted-foreground">{t("رقم الفاتورة", "Invoice no.")}</TableHead>
                    <TableHead className="text-start p-3 text-xs text-muted-foreground">{t("التاريخ", "Date")}</TableHead>
                    <TableHead className="text-end p-3 text-xs text-muted-foreground">{t("المبلغ", "Amount")}</TableHead>
                    <TableHead className="text-start p-3 text-xs text-muted-foreground">{t("الحالة", "Status")}</TableHead>
                    <TableHead className="text-end p-3 text-xs text-muted-foreground">{t("المستندات", "Documents")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} data-testid="billing-invoice-row">
                      <TableCell className="p-3 text-sm font-code text-foreground" dir="ltr">{inv.number || inv.stripeInvoiceId}</TableCell>
                      <TableCell className="p-3 text-sm text-muted-foreground" dir="ltr">{new Date(inv.issuedAt).toLocaleDateString(displayLocale("en-GB"))}</TableCell>
                      <TableCell className="p-3 text-sm text-end font-english text-foreground" dir="ltr">
                        {(inv.totalMinor / 100).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inv.currency}
                      </TableCell>
                      <TableCell className="p-3 text-sm">
                        <span className={inv.remainingMinor === 0 ? "text-success" : "text-warning"}>
                          {inv.remainingMinor === 0 ? t("مدفوعة", "Paid") : t("مستحقة", "Due")}
                        </span>
                      </TableCell>
                      <TableCell className="p-3 text-end whitespace-nowrap">
                        <a
                          href={api.stripe.invoiceDocumentUrl(inv.id, isEn ? "en" : "ar")}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="billing-invoice-document"
                          className="text-primary hover:underline text-xs"
                        >
                          {t("الفاتورة الرسمية", "Official invoice")}
                        </a>
                        {inv.invoicePdfUrl && (
                          <>
                            <span className="text-muted-foreground mx-2">·</span>
                            <a href={inv.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                              {t("تحميل PDF", "Download PDF")}
                            </a>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {tab === "subscription" && (<>
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
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg bg-muted/50 p-1" title={t("عملة الدفع", "Billing currency")}>
                {(["sar", "usd"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setPlanCurrency(c)}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${planCurrency === c ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                    style={{ fontWeight: planCurrency === c ? 700 : 500 }}
                  >
                    {c === "sar" ? t("ر.س", "SAR") : "$ USD"}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                <button onClick={() => setCycle("month")} className={`rounded-md px-3 py-1.5 text-sm transition-colors ${cycle === "month" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: cycle === "month" ? 700 : 500 }}>{t("شهري", "Monthly")}</button>
                <button onClick={() => setCycle("year")} className={`rounded-md px-3 py-1.5 text-sm transition-colors ${cycle === "year" ? "bg-success text-primary-foreground shadow-sm" : "text-success bg-success-subtle hover:bg-success-subtle border border-success-border/60"}`} style={{ fontWeight: 700 }}>
                  {t("سنوي · وفّر", "Yearly · save")}
                  {cycle === "year" && <span className="ms-1 text-[10px] opacity-90">{planCurrency === "usd" ? t("حتى $118", "up to $118") : t("حتى 598 ر.س", "up to 598 SAR")}</span>}
                </button>
              </div>
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
                      {isCurrent && <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success-subtle px-2 py-0.5 rounded-full"><BadgeCheck className="h-3 w-3" />{t("باقتك", "Current")}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description || ""}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="font-english text-foreground" style={{ fontSize: "1.6rem", fontWeight: 700 }} dir="ltr">
                      {money(p.price, p.currency, isEn)}
                      <span className="text-xs text-muted-foreground font-normal"> / {p.interval === "year" ? t("سنة", "year") : t("شهر", "month")}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-foreground/80">
                      {(Array.isArray(p.features) ? p.features : []).slice(0, 5).map((f: any, i: number) => (
                        <li key={i} className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-success shrink-0" />{typeof f === "string" ? f : (isEn ? (f.labelEn || f.label) : f.label)}</li>
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
      </>)}
    </div>
  );
}
