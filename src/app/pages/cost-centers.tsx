/**
 * Cost Centers list — app-wide standard: rows open the FULL detail page
 * (/app/cost-centers/:id) instead of a slide-over. New → /app/cost-centers/new.
 */
import { useEffect, useState, useCallback } from "react";
import { Target, Plus, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function CostCenters() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.costCenters.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("مراكز التكلفة", "Cost Centers")}</h1><p className="text-muted-foreground mt-1">{t("تتبع المصاريف والإيرادات حسب مركز التكلفة", "Track expenses and revenue by cost center")}</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/cost-centers/new")}><Plus className="me-2 h-4 w-4" />{t("مركز جديد", "New Cost Center")}</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("القائمة", "List")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><Target className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد مراكز تكلفة", "No cost centers")}</p></div> :
          (<table className="w-full"><thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
            <th className="py-3 px-4 w-[50px]"></th>
          </tr></thead><tbody>
            {items.map(c => (
              <tr key={c.id} onClick={() => navigate(`/app/cost-centers/${c.id}`)} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer">
                <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{c.code}</td>
                <td className="py-3 px-4 text-sm text-foreground">{c.name}</td>
                <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody></table>)}
        </CardContent>
      </Card>
    </div>
  );
}
