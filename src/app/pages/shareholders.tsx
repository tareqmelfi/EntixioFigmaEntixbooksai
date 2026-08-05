/**
 * Shareholders register — سجل المساهمين للشركات المساهمة.
 * Rows open the shareholder page (/app/shareholders/:id).
 * New shareholder → /app/shareholders/new · New share move → /app/share-transactions/new
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Loader2, Plus, Repeat2, Users2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const num = (v: any) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const money = (v: any) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Shareholders() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.investments.listShareholders();
      setItems(d.items);
      setSummary(d.summary);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const totalShares = items.reduce((s, x) => s + Number(x.shareCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("سجل المساهمين", "Shareholders Register")}</h1>
          <p className="text-muted-foreground mt-1">{t("الإصدار · أسهم الخزينة · التنازل بين المساهمين — بمعالجة محاسبية كاملة لحقوق الملكية", "Issuance · treasury shares · transfers between shareholders — full equity accounting treatment")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/app/share-transactions/new")}><Repeat2 className="me-2 h-4 w-4" />{t("حركة أسهم", "Share transaction")}</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/shareholders/new")}><Plus className="me-2 h-4 w-4" />{t("مساهم جديد", "New shareholder")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("الأسهم المصدرة", "Issued shares")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{num(summary?.issued)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("أسهم الخزينة", "Treasury shares")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{num(summary?.treasury)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("الأسهم القائمة", "Outstanding shares")}</div>
          <div className="font-english text-emerald-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{num(summary?.outstanding)}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("المساهمون", "Shareholders")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{items.length}</div>
        </CardContent></Card>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("السجل", "Register")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? (
            <div className="py-12 text-center">
              <Users2 className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">{t("لا يوجد مساهمون بعد", "No shareholders yet")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t("سجّل المساهمين ثم وثّق الإصدار وشراء/بيع أسهم الشركة والتنازلات بينهم", "Register shareholders, then record issuance, company share buy/sell and transfers")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("المساهم", "Shareholder")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الأسهم", "Shares")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النسبة %", "Stake %")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("متوسط التكلفة", "Avg cost")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("إجمالي الاستثمار", "Total invested")}</th>
                  <th className="py-3 px-4 w-[50px]"></th>
                </tr></thead>
                <tbody>
                  {items.map((s) => {
                    const shares = Number(s.shareCount || 0);
                    const pct = totalShares > 0 ? (shares / totalShares) * 100 : 0;
                    return (
                      <tr key={s.id} onClick={() => navigate(`/app/shareholders/${s.id}`)} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer">
                        <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 700 }} dir="ltr">{s.code}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-foreground" style={{ fontWeight: 600 }}>{s.name}</div>
                          <div className="text-xs text-muted-foreground font-english">{s.nationalId || s.email || ""}</div>
                        </td>
                        <td className="py-3 px-4 font-english text-foreground" style={{ fontWeight: 600 }} dir="ltr">{num(shares)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="font-english text-xs text-muted-foreground" dir="ltr">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-english text-muted-foreground" dir="ltr">{s.avgCost != null ? money(s.avgCost) : "—"}</td>
                        <td className="py-3 px-4 font-english text-foreground" dir="ltr">{s.avgCost != null ? money(shares * Number(s.avgCost)) : "—"}</td>
                        <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
