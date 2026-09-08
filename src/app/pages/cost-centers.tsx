/**
 * Cost Centers list — app-wide standard: rows open the FULL detail page
 * (/app/cost-centers/:id) instead of a slide-over. New → /app/cost-centers/new.
 */
import { useEffect, useState, useCallback } from "react";
import { Target, Plus, Loader2, ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, PageHeader } from "../components/product";
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
      <PageHeader
        eyebrow={t("المحاسبة", "Accounting")}
        title={t("مراكز التكلفة", "Cost Centers")}
        description={t("تتبع المصاريف والإيرادات حسب مركز التكلفة", "Track expenses and revenue by cost center")}
        actions={<Button onClick={() => navigate("/app/cost-centers/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مركز جديد", "New Cost Center")}</Button>}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("القائمة", "List")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? (
          <EmptyState
            icon={<Target className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد مراكز تكلفة", "No cost centers")}
            action={<Button onClick={() => navigate("/app/cost-centers/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مركز جديد", "New Cost Center")}</Button>}
          />
         ) :
        (<div className="ledger-table overflow-x-auto">
          <table className="w-full min-w-[480px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "160px" }} />{/* الرمز · mono */}
              <col />{/* الاسم · flexible */}
              <col style={{ width: "44px" }} />
            </colgroup>
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
              <th className="py-3 px-4 text-start font-medium">{t("الرمز", "Code")}</th>
              <th className="py-3 px-4 text-start font-medium">{t("الاسم", "Name")}</th>
              <th className="py-3 px-4"></th>
            </tr></thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} onClick={() => navigate(`/app/cost-centers/${c.id}`)} className="border-b border-border hover:bg-surface-hover cursor-pointer" title={t("فتح مركز التكلفة", "Open cost center")}>
                  <td className="py-3 px-4"><Link to={`/app/cost-centers/${c.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={c.code}>{c.code}</Link></td>
                  <td className="py-3 px-4 text-sm text-foreground truncate" title={c.name}><bdi dir="auto">{c.name}</bdi></td>
                  <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4 ltr:rotate-180" strokeWidth={1.75} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>)}
      </section>
    </div>
  );
}
