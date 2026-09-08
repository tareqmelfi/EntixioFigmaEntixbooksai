import { displayLocale } from "../lib/number-display";
/**
 * Investment wallets list — محافظ التداول والمحافظ الممولة.
 * App-wide standard: rows open the FULL wallet page (/app/investments/:id).
 * New wallet → /app/investments/new
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Loader2, Plus, TrendingUp, Wallet, Landmark } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, LedgerFigure, Metric, MetricStrip, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Investments() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.investments.listWallets()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const trading = items.filter((w) => w.kind === "TRADING");
  const funded = items.filter((w) => w.kind === "FUNDED_PROP");
  const totalBook = items.reduce((s, w) => s + Number(w.stats?.bookValue || 0), 0);
  const totalRealized = items.reduce((s, w) => s + Number(w.stats?.realizedPnl || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("الملاك والاستثمار", "Ownership & investment")}
        title={t("محافظ الاستثمار", "Investment Wallets")}
        description={t("محافظ التداول بأموالك + المحافظ الممولة (رأس مال الشركة المموّلة) مع معالجة محاسبية كاملة", "Trading wallets with your money + funded wallets (the firm's capital) with full accounting treatment")}
        actions={<Button onClick={() => navigate("/app/investments/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("محفظة جديدة", "New Wallet")}</Button>}
      />

      <MetricStrip>
        <Metric label={t("محافظ تداول", "Trading wallets")} value={String(trading.length)} />
        <Metric label={t("محافظ ممولة", "Funded wallets")} value={String(funded.length)} />
        <Metric label={t("القيمة الدفترية", "Book value")} value={<LedgerFigure value={totalBook} />} />
        <Metric label={t("الربح المحقق", "Realized P&L")} tone={totalRealized >= 0 ? "success" : "critical"} value={<LedgerFigure value={totalRealized} />} />
      </MetricStrip>

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("المحافظ", "Wallets")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد محافظ بعد", "No wallets yet")}
            description={t("سجّل محفظة تداول (مثل دي تريد) أو محفظة ممولة بدفع اشتراكها — وكل حركة تنقيد تلقائياً في الدفاتر", "Register a trading wallet (like DTrade) or a funded wallet with its subscription — every movement posts to the books automatically")}
            action={<Button onClick={() => navigate("/app/investments/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("محفظة جديدة", "New Wallet")}</Button>}
          />
        ) : (
          <div className="ledger-table overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "130px" }} />{/* الرمز · mono */}
                <col />{/* المحفظة · flexible */}
                <col style={{ width: "110px" }} />
                <col style={{ width: "160px" }} />
                <col style={{ width: "160px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "44px" }} />
              </colgroup>
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
                <th className="py-3 px-4 text-start font-medium">{t("الرمز", "Code")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("المحفظة", "Wallet")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("النوع", "Kind")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("القيمة الدفترية", "Book value")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("الربح المحقق", "Realized P&L")}</th>
                <th className="py-3 px-4 text-end font-medium">{t("الحركات", "Txns")}</th>
                <th className="py-3 px-4 text-start font-medium">{t("الحالة", "Status")}</th>
                <th className="py-3 px-4"></th>
              </tr></thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id} onClick={() => navigate(`/app/investments/${w.id}`)} className="border-b border-border hover:bg-surface-hover cursor-pointer" title={t("فتح المحفظة", "Open wallet")}>
                    <td className="py-3 px-4"><Link to={`/app/investments/${w.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={w.code}>{w.code}</Link></td>
                    <td className="py-3 px-4">
                      <div className="truncate text-sm text-foreground" style={{ fontWeight: 600 }} title={w.name}><bdi dir="auto">{w.name}</bdi></div>
                      <div className="truncate text-xs text-muted-foreground"><bdi dir="auto">{w.kind === "FUNDED_PROP" ? (w.fundedProvider || "—") : (w.broker || "—")}</bdi> · <span className="font-english">{w.currency}</span></div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge tone="info" icon={w.kind === "FUNDED_PROP" ? <Landmark className="h-3 w-3" strokeWidth={1.75} /> : <TrendingUp className="h-3 w-3" strokeWidth={1.75} />}>
                        {w.kind === "FUNDED_PROP" ? t("ممولة", "Funded") : t("تداول", "Trading")}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-end font-english text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }} dir="ltr">{money(w.stats?.bookValue)}</td>
                    <td className={`py-3 px-4 text-end font-english tabular-nums whitespace-nowrap ${Number(w.stats?.realizedPnl || 0) >= 0 ? "text-success" : "text-danger"}`} dir="ltr">{money(w.stats?.realizedPnl)}</td>
                    <td className="py-3 px-4 text-end font-english text-muted-foreground tabular-nums" dir="ltr">{w.stats?.txnCount || 0}</td>
                    <td className="py-3 px-4">
                      <StatusBadge tone={w.status === "ACTIVE" ? "success" : "neutral"}>
                        {w.status === "ACTIVE" ? t("نشطة", "Active") : t("مغلقة", "Closed")}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4 ltr:rotate-180" strokeWidth={1.75} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
