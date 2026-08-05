import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePlaidLink } from "react-plaid-link";
import { CreditCard, CheckCircle2, AlertTriangle, ArrowLeft, Landmark, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useLanguage } from "../components/LanguageContext";
import { api } from "../lib/api";

/**
 * Plaid bank linking — the real flow end to end:
 *   GET /api/plaid/link-token → Plaid Link modal → public_token
 *   → POST /api/plaid/exchange → internal BankAccounts created
 * When the server lacks PLAID_CLIENT_ID/PLAID_SECRET the page says so
 * honestly (with the exact env names) instead of failing silently.
 */
export function IntegrationsPlaid() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [linked, setLinked] = useState<{ institution: string; accountsCount: number } | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.plaid.linkToken().then((r) => {
      if (!alive) return;
      setLinkToken(r?.link_token || r?.linkToken || null);
      setLoading(false);
    }).catch((e: any) => {
      if (!alive) return;
      setConfigError(e?.message || "plaid_not_configured");
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => navigate("/app/integrations")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t("رجوع للتكاملات", "Back to Integrations")}
      </button>

      <div>
        <h1 className="text-foreground flex items-center gap-2" style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          <span className="rounded-xl bg-[#EFF6FF] p-2"><CreditCard className="h-5 w-5 text-primary" /></span>
          {t("الربط البنكي · Plaid", "Bank linking · Plaid")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("اربط حساباتك البنكية الأمريكية واستورد الحركات تلقائيًا", "Connect your US bank accounts and import transactions automatically")}</p>
      </div>

      {loading && (
        <Card className="border-border"><CardContent className="p-8 text-center text-muted-foreground text-sm">{t("يُجهَّز الربط الآمن…", "Preparing the secure link…")}</CardContent></Card>
      )}

      {!loading && configError && (
        <Card className="border-[#F59E0B]/40 bg-[#FFFBEB]">
          <CardHeader>
            <CardTitle className="text-[#92400E] flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />{t("مفاتيح Plaid غير مهيأة في الخادم", "Plaid keys are not configured on the server")}</CardTitle>
            <CardDescription>{t("التكامل جاهز بالكامل — ينقصه فقط اعتماد المورّد.", "The integration is fully built — it only needs the vendor credentials.")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[#92400E] space-y-2">
            <p>{t("لتفعيله: أنشئ حسابًا على dashboard.plaid.com ثم أضف هذه المتغيرات في بيئة الخادم (Coolify) وأعد النشر:", "To enable: create an account at dashboard.plaid.com, then add these variables to the server environment (Coolify) and redeploy:")}</p>
            <div className="rounded-lg bg-white/70 border border-[#F59E0B]/30 p-3 font-english text-xs space-y-1" dir="ltr">
              <div>PLAID_CLIENT_ID=…</div>
              <div>PLAID_SECRET=…</div>
              <div>PLAID_ENV=production</div>
            </div>
            <p className="text-xs">{t("بعدها يعمل هذا الزر مباشرة دون أي تغيير كود.", "After that, this connect button works immediately with no code change.")}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !configError && linkToken && !linked && (
        <PlaidConnectCard
          linkToken={linkToken}
          exchanging={exchanging}
          flowError={flowError}
          onExchange={async (publicToken: string, institutionId?: string, institutionName?: string) => {
            setExchanging(true);
            setFlowError(null);
            try {
              const r = await api.plaid.exchange({ publicToken, institutionId, institutionName });
              setLinked({ institution: r?.institution?.name || institutionName || "Bank", accountsCount: r?.accountsCount ?? (r?.bankAccounts?.length || 0) });
            } catch (e: any) {
              setFlowError(e?.message || "exchange_failed");
            } finally { setExchanging(false); }
          }}
        />
      )}

      {linked && (
        <Card className="border-[#16785A]/40 bg-[#F0FBF6]">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#16785A] p-2"><CheckCircle2 className="h-5 w-5 text-white" /></span>
              <div>
                <div className="text-foreground" style={{ fontWeight: 700 }}>{t("تم الربط بنجاح", "Bank linked successfully")}</div>
                <div className="text-sm text-muted-foreground">{t(`${linked.institution} · ${linked.accountsCount} حساب`, `${linked.institution} · ${linked.accountsCount} accounts`)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={() => navigate("/app/bank-accounts")}>
                <Landmark className="h-4 w-4 me-1" />{t("عرض الحسابات البنكية", "View bank accounts")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/app/bank-import")}>
                <RefreshCw className="h-4 w-4 me-1" />{t("مزامنة الحركات", "Sync transactions")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlaidConnectCard({
  linkToken, exchanging, flowError, onExchange,
}: {
  linkToken: string;
  exchanging: boolean;
  flowError: string | null;
  onExchange: (publicToken: string, institutionId?: string, institutionName?: string) => void;
}) {
  const { t } = useLanguage();
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      if (!public_token) return;
      onExchange(public_token, metadata?.institution?.institution_id ?? undefined, metadata?.institution?.name ?? undefined);
    },
  });

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-base">{t("ربط حساب بنكي", "Link a bank account")}</CardTitle>
        <CardDescription>{t("نافذة Plaid الآمنة تفتح — سجّل دخولك البنكي واختر الحسابات. لا نرى كلمة مرورك أبدًا.", "The secure Plaid window opens — sign in to your bank and pick accounts. We never see your password.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full bg-primary hover:bg-primary/90"
          disabled={!ready || exchanging}
          onClick={() => open()}
        >
          {exchanging ? t("يُربط…", "Linking…") : t("فتح الربط الآمن", "Open secure link")}
        </Button>
        {flowError && <p className="text-xs text-destructive">{flowError}</p>}
        <p className="text-xs text-muted-foreground/70">{t("يدعم أكثر من 12,000 بنكًا أمريكيًا · تشفير كامل عبر Plaid", "Supports 12,000+ US banks · fully encrypted via Plaid")}</p>
      </CardContent>
    </Card>
  );
}
