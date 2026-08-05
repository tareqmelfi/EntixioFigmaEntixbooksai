/**
 * Fixed Assets list — app-wide standard: rows open the FULL detail page
 * (/app/assets/:id) instead of a slide-over. New asset → /app/assets/new.
 */
import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError, Account } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function FixedAssets() {
  const [items, setItems] = useState<any[]>([]);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalCost: 0, netBookValue: 0, totalDepreciation: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.fixedAssets.list();
      setItems(d.items);
      setStats({ totalCost: d.totalCost, netBookValue: d.netBookValue, totalDepreciation: d.totalDepreciation });
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    api.accounts.list().then((d) => setAccounts(d.items)).catch(() => {});
  }, []);

  const formatMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const accountLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = accounts.find(x => x.id === id);
    return a ? `${a.code} · ${a.name}` : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الأصول الثابتة", "Fixed Assets")}</h1>
          <p className="text-muted-foreground mt-1">{t("تسجيل الأصول وربطها بالمشتريات والحسابات مع الإهلاك والإخراج التلقائي", "Register assets linked to purchases and accounts, with depreciation and auto-disposal")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/assets/new")}><Plus className="me-2 h-4 w-4" />{t("أصل جديد", "New Asset")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("إجمالي التكلفة", "Total Cost")}</div>
          <div className="font-english text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalCost.toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("الإهلاك المتراكم", "Accumulated Depreciation")}</div>
          <div className="font-english text-amber-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(stats.totalDepreciation).toLocaleString()}</div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-5">
          <div className="text-muted-foreground text-sm mb-1">{t("صافي القيمة الدفترية", "Net Book Value")}</div>
          <div className="font-english text-green-600" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{Math.round(stats.netBookValue).toLocaleString()}</div>
        </CardContent></Card>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("قائمة الأصول", "Assets List")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد أصول ثابتة", "No fixed assets")}</p><p className="text-xs text-muted-foreground/70 mt-1">{t("سجّل أصلاً يدوياً أو فعّل خيار الأصل في سطر فاتورة مشتريات ليُسجّل تلقائياً", "Register an asset manually, or flag a purchase bill line as an asset to register it automatically")}</p></div> :
          (<div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1000px] text-sm">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[280px]" />
                <col className="w-[140px]" />
                <col className="w-[200px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[50px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التصنيف", "Category")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("حساب الأصل", "Asset account")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("تاريخ الاقتناء", "Acquisition")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("التكلفة", "Cost")}</th>
                  <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(a => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/app/assets/${a.id}`)}
                    className="border-b border-border/50 hover:bg-primary/5 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <span className="max-w-full truncate font-english text-sm text-primary" style={{ fontWeight: 700 }}>{a.code}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="block max-w-full truncate text-sm text-foreground" title={a.name}>{a.name}</span>
                      {(a.purchaseBillId || a.purchaseExpenseId) && <span className="text-[10px] text-muted-foreground/70">{t("من المشتريات", "from purchases")}</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground/80 truncate">{a.category || "—"}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate" dir="ltr">{accountLabel(a.accountId)}</td>
                    <td className="py-3 px-4 font-english text-xs text-muted-foreground" dir="ltr">{a.acquisitionDate?.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-english text-sm text-foreground" style={{ fontWeight: 600 }} dir="ltr">{formatMoney(a.acquisitionCost)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {a.status === "ACTIVE" ? t("نشط", "Active") : a.status === "DISPOSED" ? t("مُخرج", "Disposed") : t("مشطوب", "Written off")}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)}
        </CardContent>
      </Card>
    </div>
  );
}
