import { displayLocale } from "../lib/number-display";
/**
 * Partners & Affiliates · لوحة برنامج الشركاء
 * Wired to /api/partners · person-scoped
 * Application intake and existing commission/payout records; activation is gated.
 */
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Building2, HandCoins, Loader2, Users2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { partnerApi } from "../lib/partner-api";
import { COUNTRIES } from "../lib/countries";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";
import { useAuthState } from "../components/use-auth-state";
import { trackPartnerEvent } from "../lib/consent-analytics";

const COMMISSION_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  pending: { ar: "قيد التعليق", en: "Pending", cls: "bg-warning/10 text-warning" },
  cleared: { ar: "جاهزة للسحب", en: "Cleared", cls: "bg-primary/10 text-primary" },
  paid: { ar: "مدفوعة", en: "Paid", cls: "bg-success/10 text-success" },
};

const money = (v: any, currency = "SAR") =>
  `${Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function Partners() {
  const { t, language } = useLanguage();
  const auth = useAuthState();
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [data, setData] = useState<{ partner: any; enrollment?: any; dashboard: any; clients: any[]; commissions: any[]; payouts: any[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [regForm, setRegForm] = useState({ name: auth.user?.name || "", phone: "", country: "", type: "FREELANCER" as "FREELANCER" | "FIRM" });

  const [countryInput, setCountryInput] = useState("");
  const [registrationError, setRegistrationError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const me = await partnerApi.me();
      setData(me);
      setRegistered(true);

    } catch (e: any) {
      if (e?.status === 404 && e?.code === "not_registered") {
        setRegistered(false);
      } else {
        setLoadError(true);
        push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
      }
    } finally {
      setLoading(false);
    }
  }, [push, language]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRegister = async () => {
    if (busy) return;
    setRegistrationError("");
    setBusy(true);
    try {
      await partnerApi.register({ name: regForm.name.trim(), phone: regForm.phone || undefined, type: regForm.type, country: regForm.country });
      trackPartnerEvent("partner_application_saved");
      push("success", t("تم حفظ طلب الشراكة للمراجعة", "Your partnership application is saved for review"));
      await refresh();
    } catch (e: any) {
      const message = e?.code === "email_verification_required"
        ? t("فعّل بريد حسابك من رسالة التحقق ثم أعد تقديم الطلب. لم يُحفظ الطلب بعد.", "Verify your account email using the verification message, then submit again. Your application has not been saved yet.")
        : humanizeError(e, language, { ar: "تعذر حفظ الطلب. حاول مرة أخرى؛ لن يتكرر طلبك.", en: "Could not save the application. Try again; your application will not be duplicated." });
      setRegistrationError(message);
      push("error", message);
    } finally {
      setBusy(false);
    }
  };

  const handlePayout = async () => {
    setBusy(true);
    try {
      // The server reserves exactly the cleared commissions it holds, per currency;
      // currencies are never mixed, so one request is raised for each.
      const currencies = Object.entries((data?.dashboard?.balancesByCurrency || {}) as Record<string, { cleared?: number }>)
        .filter(([, b]) => Number(b?.cleared || 0) > 0)
        .map(([currency]) => currency);
      for (const currency of currencies) {
        await partnerApi.requestPayout({ currency });
      }
      push("success", t("تم حفظ طلب الصرف للمراجعة", "Payout request saved for review"));
      await refresh();
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "تعذر طلب السحب", en: "Payout request failed" }));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) return <div role="alert" className="space-y-4 py-8">
    <ToastStack toasts={toasts} onDismiss={dismiss} />
    <p>{t("تعذر تحميل بيانات الشراكة. لم تتغير بياناتك.", "Unable to load your partnership. Your data has not changed.")}</p>
    <Button onClick={refresh}>{t("إعادة المحاولة", "Try again")}</Button>
  </div>;

  // ── Registration gate ────────────────────────────────────────────────────
  if (!registered) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <ToastStack toasts={toasts} onDismiss={dismiss} />
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <HandCoins className="h-5 w-5 text-primary" />
              {t("سجّل اهتمامك بالإحالات المدفوعة", "Register interest in paid referrals")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {t(
                "ابدأ باسمك وبلد إقامتك فقط. لا تحتاج شركة أو عدد متابعين أو بيانات بنكية. المسار المدفوع قيد التجهيز؛ تقديم الطلب لا يفعّل العمولة بعد.",
                "Start with your name and country of residence. No company, follower count or bank details required. Paid referrals are being prepared; applying does not activate commissions yet.",
              )}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="partner-name" className="text-xs text-foreground/80">{t("الاسم", "Name")}</Label>
              <Input id="partner-name" maxLength={160} value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} className="border-border" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-country">{t("بلد الإقامة", "Country of residence")}</Label>
              <Input id="partner-country" list="partner-countries" value={countryInput} maxLength={80} placeholder={t("ابحث باسم البلد أو أدخل رمزه", "Country name or two-letter code")}
                onChange={e => {
                  const input = e.target.value;
                  setCountryInput(input);
                  const normalized = input.trim().toLowerCase();
                  const match = COUNTRIES.find(c => [c.code, c.nameAr, c.nameEn].some(value => value.toLowerCase() === normalized));
                  setRegForm({ ...regForm, country: match?.code || (/^[a-z]{2}$/i.test(normalized) ? normalized.toUpperCase() : "") });
                }} />
              <datalist id="partner-countries">{COUNTRIES.map(c => <option key={c.code} value={language === 'ar' ? c.nameAr : c.nameEn}>{c.code}</option>)}</datalist>
              <p className="text-xs text-muted-foreground">{t("اختر اسم البلد، أو أدخل رمزه من حرفين إن لم يظهر. تُراجع أهلية البلد والاستلام قبل تفعيل العمولات.", "Choose a country name, or enter its two-letter code if it is not listed. Country and payout eligibility are reviewed before commissions are activated.")}</p>
            </div>
            <details className="space-y-4">
              <summary className="cursor-pointer text-sm font-medium">{t("تفاصيل إضافية · اختياري", "Additional details · optional")}</summary>
            <div className="space-y-1.5">
              <Label htmlFor="partner-phone" className="text-xs text-foreground/80">{t("الجوال · اختياري", "Phone · optional")}</Label>
              <Input id="partner-phone" maxLength={40} value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} dir="ltr" className="border-border font-english" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">{t("نوع الشريك", "Partner type")}</Label>
              <Select value={regForm.type} onValueChange={(v) => setRegForm({ ...regForm, type: v as "FREELANCER" | "FIRM" })}>
                <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREELANCER">{t("فرد / صانع محتوى", "Individual / creator")}</SelectItem>
                  <SelectItem value="FIRM">{t("شركة / وكالة", "Company / agency")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </details>
            {registrationError && <p role="alert" className="text-sm text-destructive">{registrationError}</p>}
            <Button onClick={handleRegister} disabled={busy || regForm.name.trim().length < 2 || !/^[A-Z]{2}$/.test(regForm.country)} className="w-full bg-primary hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حفظ طلب الانضمام", "Save application")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = data!.dashboard;
  // Balances are per currency and are NEVER summed (2026-09-08 audit finding:
  // SAR and USD commissions were being added into one meaningless number).
  const balances: [string, { earned: number; cleared: number; reserved: number; paid: number; clearedCount: number }][] =
    Object.entries(d.balancesByCurrency || {}) as any;
  const payoutCurrencies = balances.filter(([, b]) => (b?.cleared || 0) > 0).map(([currency]) => currency);
  const partner = data!.partner;


  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            {t("لوحة الشريك", "Partner Dashboard")}
            {partner?.isCertified && <BadgeCheck className="h-6 w-6 text-primary" />}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {partner?.name} · {partner?.type === "FIRM" ? t("شركة / وكالة", "Company / agency") : t("فرد / صانع محتوى", "Individual / creator")}
          </p>
        </div>
        <Button onClick={handlePayout} disabled={busy || !data?.enrollment?.payoutReady || payoutCurrencies.length === 0} className="bg-primary hover:bg-primary/90">
          <Wallet className="me-2 h-4 w-4" />
          {t("طلب سحب العمولات الجاهزة", "Request payout of cleared commissions")}
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 space-y-2" aria-label={t("حالة الشراكة", "Partnership status")}>
        <h2 className="font-semibold">{t("طلب محفوظ · التفعيل قيد المراجعة", "Application saved · activation under review")}</h2>
        <p className="text-sm text-muted-foreground">{t("يلزم اعتماد الاتفاقية والتحقق من الأهلية وحساب الاستلام. لا يوجد رابط إحالة مفعّل أو صرف تلقائي بعد. السجلات السابقة محفوظة وتُراجع وفق اتفاقياتها.", "An approved agreement, eligibility review and verified recipient account are required. Referral links and automatic payouts are not active yet. Existing records are retained for review under their agreements.")}</p>
        {data?.enrollment?.reference && <p className="text-sm break-all">{t("مرجع الطلب", "Application reference")}: <bdi>{data.enrollment.reference}</bdi></p>}
      </section>

      <section className="rounded-lg border border-border p-5 space-y-2">
        <h2 className="font-semibold">{t("خطوتك التالية", "Your next step")}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{t("طلبك محفوظ، ولا تحتاج إلى إرساله مرة أخرى. يمكنك مشاركة رابط الموقع العام الآن؛ ستظهر شروط الإحالات المدفوعة قبل قبولها. لن تُحتسب المشاركات السابقة بأثر رجعي.", "Your application is saved; you do not need to resubmit it. You can share the general website link now. Paid referral terms will be shown before you accept them. Earlier shares will not earn retroactive credit.")}</p>
      </section>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <Users2 className="h-8 w-8 text-primary" />
            <div>
              <div className="font-english text-2xl font-bold text-foreground">{d.activeClients}</div>
              <div className="text-xs text-muted-foreground">{t("عميل نشط", "Active clients")}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-start gap-3 p-4">
            <HandCoins className="mt-1 h-8 w-8 shrink-0 text-primary" />
            <div className="min-w-0">
              {balances.length === 0 && <div className="font-english text-2xl font-bold text-foreground">{t("لا يوجد رصيد بعد", "No balance yet")}</div>}
              {balances.map(([currency, b]) => (
                <div key={currency} className="font-english text-2xl font-bold text-foreground">{money(b.earned, currency)}</div>
              ))}
              <div className="text-xs text-muted-foreground">{t("عمولات مستحقة", "Earned (unpaid)")}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-start gap-3 p-4">
            <Wallet className="mt-1 h-8 w-8 shrink-0 text-success" />
            <div className="min-w-0">
              {balances.length === 0 && <div className="font-english text-2xl font-bold text-foreground">{t("لا يوجد رصيد بعد", "No balance yet")}</div>}
              {balances.map(([currency, b]) => (
                <div key={currency} className="font-english text-2xl font-bold text-foreground">{money(b.paid, currency)}</div>
              ))}
              <div className="text-xs text-muted-foreground">{t("عمولات مدفوعة", "Paid out")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Clients */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Building2 className="h-5 w-5 text-primary" />{t("عملائي", "My clients")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data!.clients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("لا توجد إحالات موثقة بعد", "No verified referrals yet")}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {data!.clients.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-english text-foreground/80" dir="ltr">{c.orgId}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${c.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {c.status === "active" ? t("نشط", "Active") : c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Commissions + payouts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">{t("سجل العمولات", "Commissions log")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data!.commissions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("لا عمولات بعد", "No commissions yet")}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {data!.commissions.map((c: any) => {
                  const st = COMMISSION_STATUS[c.status] || COMMISSION_STATUS.pending;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate text-foreground">{c.planName}</div>
                        <div className="font-english text-xs text-muted-foreground" dir="ltr">{String(c.earnedAt || "").slice(0, 10)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-english font-semibold text-foreground" dir="ltr">{money(c.amount, c.currency)}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${st.cls}`}>{language === "en" ? st.en : st.ar}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">{t("طلبات السحب", "Payout requests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data!.payouts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("لا توجد طلبات صرف مسجلة", "No payout requests recorded")}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {data!.payouts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-english text-xs text-muted-foreground" dir="ltr">{String(p.requestedAt || "").slice(0, 10)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-english font-semibold text-foreground" dir="ltr">{money(p.amount, p.currency)}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${p.status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                        {p.status === "paid" ? t("مدفوع", "Paid") : p.status === "pending" ? t("بانتظار المراجعة", "Pending review") : p.status === "rejected" ? t("مرفوض", "Rejected") : p.status === "failed" ? t("تعذر الصرف", "Failed") : p.status === "processing" ? t("قيد المعالجة", "Processing") : t("تحتاج مراجعة", "Needs review")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
