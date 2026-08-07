/**
 * Partners & Affiliates · لوحة برنامج الشركاء
 * Wired to /api/partners · org-scoped
 * Points → certification (10 active clients) · commissions (pending → cleared → paid) · payouts
 */
import { useCallback, useEffect, useState } from "react";
import { Award, BadgeCheck, Building2, HandCoins, Loader2, Trophy, UserPlus, Users2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ToastStack, useToasts } from "../components/side-panel";
import { api } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { humanizeError } from "../lib/error-messages";

const CERTIFICATION_POINTS = 10;

const COMMISSION_TIERS = [
  { plan: { ar: "الأساسية (Starter)", en: "Starter" }, monthly: "10%", annual: "15%" },
  { plan: { ar: "المتقدمة (Advanced)", en: "Advanced" }, monthly: "15%", annual: "20%" },
  { plan: { ar: "الاحترافية (Premium)", en: "Premium" }, monthly: "35%", annual: "40%" },
];

const COMMISSION_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  pending: { ar: "قيد التعليق", en: "Pending", cls: "bg-amber-500/10 text-amber-600" },
  cleared: { ar: "جاهزة للسحب", en: "Cleared", cls: "bg-primary/10 text-primary" },
  paid: { ar: "مدفوعة", en: "Paid", cls: "bg-emerald-500/10 text-emerald-600" },
};

const money = (v: any, currency = "SAR") =>
  `${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function Partners() {
  const { t, language } = useLanguage();
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [data, setData] = useState<{ partner: any; dashboard: any; clients: any[]; commissions: any[]; payouts: any[] } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [regForm, setRegForm] = useState({ name: "", phone: "", type: "FREELANCER" as "FREELANCER" | "FIRM" });
  const [clientOrgId, setClientOrgId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.partners.me();
      setData(me);
      setRegistered(true);
      const board = await api.partners.leaderboard().catch(() => ({ partners: [] }));
      setLeaderboard(board.partners || []);
    } catch (e: any) {
      if (e?.status === 404 || /not_registered/.test(String(e?.message))) {
        setRegistered(false);
      } else {
        push("error", humanizeError(e, language, { ar: "فشل التحميل", en: "Failed to load" }));
      }
    } finally {
      setLoading(false);
    }
  }, [push, language]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRegister = async () => {
    setBusy(true);
    try {
      await api.partners.register({ name: regForm.name || undefined, phone: regForm.phone || undefined, type: regForm.type });
      push("success", t("تم تسجيلك في برنامج الشركاء", "You are registered as a partner"));
      await refresh();
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل التسجيل", en: "Registration failed" }));
    } finally {
      setBusy(false);
    }
  };

  const handleAddClient = async () => {
    if (!clientOrgId.trim()) return;
    setBusy(true);
    try {
      await api.partners.addClient(clientOrgId.trim());
      setClientOrgId("");
      push("success", t("تم ربط العميل بنجاح", "Client linked successfully"));
      await refresh();
    } catch (e: any) {
      push("error", humanizeError(e, language, { ar: "فشل ربط العميل", en: "Could not link the client" }));
    } finally {
      setBusy(false);
    }
  };

  const handlePayout = async () => {
    setBusy(true);
    try {
      await api.partners.requestPayout({});
      push("success", t("تم إرسال طلب السحب · يُراجَع خلال 30 يوماً", "Payout requested · reviewed within 30 days"));
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

  // ── Registration gate ────────────────────────────────────────────────────
  if (!registered) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <ToastStack toasts={toasts} onDismiss={dismiss} />
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <HandCoins className="h-5 w-5 text-primary" />
              {t("انضم إلى برنامج شركاء ENTIX", "Join the ENTIX Partner Program")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {t(
                "عمولة متكررة تصل إلى 40% لكل اشتراك عميل نشط · تدريب مجاني وشهادة شريك معتمد · دعم فني ذو أولوية.",
                "Up to 40% recurring commission per active client subscription · free training and certification · priority support.",
              )}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">{t("الاسم", "Name")}</Label>
              <Input value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} className="border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">{t("الجوال", "Phone")}</Label>
              <Input value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} dir="ltr" className="border-border font-english" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">{t("نوع الشريك", "Partner type")}</Label>
              <Select value={regForm.type} onValueChange={(v) => setRegForm({ ...regForm, type: v as "FREELANCER" | "FIRM" })}>
                <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREELANCER">{t("محاسب مستقل", "Freelance accountant")}</SelectItem>
                  <SelectItem value="FIRM">{t("مكتب / شركة محاسبة", "Accounting firm")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRegister} disabled={busy} className="w-full bg-primary hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("تسجيل كشريك", "Register as partner")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = data!.dashboard;
  const partner = data!.partner;
  const points = Number(partner?.points || 0);
  const pointsToCert = Math.max(0, CERTIFICATION_POINTS - points);

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
            {partner?.name} · {partner?.type === "FIRM" ? t("مكتب محاسبة", "Accounting firm") : t("محاسب مستقل", "Freelance accountant")}
          </p>
        </div>
        <Button onClick={handlePayout} disabled={busy || d.clearedCommissions === 0} className="bg-primary hover:bg-primary/90">
          <Wallet className="me-2 h-4 w-4" />
          {t("طلب سحب العمولات الجاهزة", "Request payout of cleared commissions")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <CardContent className="flex items-center gap-3 p-4">
            <HandCoins className="h-8 w-8 text-primary" />
            <div>
              <div className="font-english text-2xl font-bold text-foreground">{money(d.totalEarned)}</div>
              <div className="text-xs text-muted-foreground">{t("عمولات مستحقة", "Earned (unpaid)")}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-8 w-8 text-emerald-600" />
            <div>
              <div className="font-english text-2xl font-bold text-foreground">{money(d.totalPaid)}</div>
              <div className="text-xs text-muted-foreground">{t("عمولات مدفوعة", "Paid out")}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              <div>
                <div className="font-english text-2xl font-bold text-foreground">{points}</div>
                <div className="text-xs text-muted-foreground">{t("نقطة", "Points")}</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (points / CERTIFICATION_POINTS) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {partner?.isCertified
                ? t("شريك معتمد", "Certified partner")
                : t(`تبقّى ${pointsToCert} نقطة لتصبح شريكاً معتمداً`, `${pointsToCert} point(s) remaining to become certified`)}
            </p>
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
            <div className="flex gap-2">
              <Input
                value={clientOrgId}
                onChange={(e) => setClientOrgId(e.target.value)}
                placeholder={t("معرّف شركة العميل (Org ID)", "Client org ID")}
                dir="ltr"
                className="border-border font-english text-sm"
              />
              <Button onClick={handleAddClient} disabled={busy || !clientOrgId.trim()} variant="outline" className="shrink-0 border-primary text-primary hover:bg-primary/5">
                <UserPlus className="me-1 h-4 w-4" />{t("ربط", "Link")}
              </Button>
            </div>
            {data!.clients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("لا يوجد عملاء بعد · اربط أول عميل لكسب نقطة", "No clients yet · link your first client to earn a point")}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {data!.clients.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-english text-foreground/80" dir="ltr">{c.orgId}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${c.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {c.status === "active" ? t("نشط", "Active") : c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission tiers */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <HandCoins className="h-5 w-5 text-primary" />{t("شرائح العمولة", "Commission tiers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 text-start font-medium">{t("الخطة", "Plan")}</th>
                  <th className="py-2 text-start font-medium">{t("شهري", "Monthly")}</th>
                  <th className="py-2 text-start font-medium">{t("سنوي", "Annual")}</th>
                </tr>
              </thead>
              <tbody>
                {COMMISSION_TIERS.map((tier) => (
                  <tr key={tier.plan.en} className="border-b border-border/60 last:border-0">
                    <td className="py-2 text-foreground">{language === "en" ? tier.plan.en : tier.plan.ar}</td>
                    <td className="py-2 font-english font-semibold text-foreground" dir="ltr">{tier.monthly}</td>
                    <td className="py-2 font-english font-semibold text-primary" dir="ltr">{tier.annual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">{t("لا تُحتسب عمولة على الخطط المخفَّضة.", "No commission on discounted plans.")}</p>
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
              <p className="py-4 text-center text-sm text-muted-foreground">{t("لا طلبات سحب · تُصفّى العمولات بعد 30 يوماً", "No payouts · commissions clear after 30 days")}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {data!.payouts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-english text-xs text-muted-foreground" dir="ltr">{String(p.requestedAt || "").slice(0, 10)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-english font-semibold text-foreground" dir="ltr">{money(p.amount, p.currency)}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                        {p.status === "paid" ? t("مدفوع", "Paid") : t("قيد المعالجة", "Processing")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Trophy className="h-5 w-5 text-primary" />{t("أعلى الشركاء نقاطاً", "Top partners")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-lg border border-border">
              {leaderboard.slice(0, 10).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center font-english font-bold text-muted-foreground" dir="ltr">{i + 1}</span>
                    <span className="text-foreground">{p.name}</span>
                    {p.isCertified && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </div>
                  <span className="font-english font-semibold text-foreground" dir="ltr">{p.points} {t("نقطة", "pts")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
