/**
 * Investment wallets list — محافظ التداول والمحافظ الممولة.
 * App-wide standard: rows open the FULL wallet page (/app/investments/:id).
 * New wallet → /app/investments/new
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Loader2, Plus, TrendingUp, Wallet, Landmark } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("محافظ الاستثمار", "Investment Wallets")}</h1>
          <p className="text-muted-foreground mt-1">{t("محافظ التداول بأموالك + المحافظ الممولة (رأس مال الشركة المموّلة) مع معالجة محاسبية كاملة", "Trading wallets with your money + funded wallets (the firm's capital) with full accounting treatment")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/investments/new")}><Plus className="me-2 h-4 w-4" />{t("محفظة جديدة", "New Wallet")}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("محافظ تداول", "Trading wallets")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{trading.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("محافظ ممولة", "Funded wallets")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{funded.length}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("القيمة الدفترية", "Book value")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{money(totalBook)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("الربح المحقق", "Realized P&L")}</div>
          <div className={`font-english ${totalRealized >= 0 ? "text-emerald-600" : "text-red-600"}`} style={{ fontSize: "1.5rem", fontWeight: 700 }} dir="ltr">{money(totalRealized)}</div>
        </CardContent></Card>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("المحافظ", "Wallets")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">{t("لا توجد محافظ بعد", "No wallets yet")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t("سجّل محفظة تداول (مثل دي تريد) أو محفظة ممولة بدفع اشتراكها — وكل حركة تنقيد تلقائياً في الدفاتر", "Register a trading wallet (like DTrade) or a funded wallet with its subscription — every movement posts to the books automatically")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المحفظة", "Wallet")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النوع", "Kind")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("القيمة الدفترية", "Book value")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الربح المحقق", "Realized P&L")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحركات", "Txns")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                  <th className="py-3 px-4 w-[50px]"></th>
                </tr></thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w.id} onClick={() => navigate(`/app/investments/${w.id}`)} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer">
                      <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 700 }} dir="ltr">{w.code}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{w.name}</div>
                        <div className="text-xs text-muted-foreground">{w.kind === "FUNDED_PROP" ? (w.fundedProvider || "—") : (w.broker || "—")} · {w.currency}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${w.kind === "FUNDED_PROP" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                          {w.kind === "FUNDED_PROP" ? <Landmark className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {w.kind === "FUNDED_PROP" ? t("ممولة", "Funded") : t("تداول", "Trading")}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-english text-foreground" style={{ fontWeight: 600 }} dir="ltr">{money(w.stats?.bookValue)}</td>
                      <td className={`py-3 px-4 font-english ${Number(w.stats?.realizedPnl || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`} dir="ltr">{money(w.stats?.realizedPnl)}</td>
                      <td className="py-3 px-4 font-english text-muted-foreground">{w.stats?.txnCount || 0}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${w.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {w.status === "ACTIVE" ? t("نشطة", "Active") : t("مغلقة", "Closed")}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
