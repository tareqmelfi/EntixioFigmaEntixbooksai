/**
 * Branches list — app-wide standard: rows open the FULL detail page
 * (/app/branches/:id) instead of a slide-over. New → /app/branches/new.
 */
import { useEffect, useState, useCallback } from "react";
import { GitBranch, Plus, Loader2, ChevronLeft, Star } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, PageHeader, StatusBadge } from "../components/product";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

export function Branches() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await api.branches.list(); setItems(r.items); setDefaultBranchId(r.defaultBranchId ?? null); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("المحاسبة", "Accounting")}
        title={t("الفروع", "Branches")}
        description={t("إدارة فروع الشركة", "Manage company branches")}
        actions={<Button onClick={() => navigate("/app/branches/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("فرع جديد", "New Branch")}</Button>}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("قائمة الفروع", "Branches list")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد فروع", "No branches")}
            action={<Button onClick={() => navigate("/app/branches/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("فرع جديد", "New Branch")}</Button>}
          />
         ) :
        (<div className="ledger-table overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col />{/* الاسم · flexible */}
              <col style={{ width: "150px" }} />{/* الرمز · mono */}
              <col style={{ width: "34%" }} />
              <col style={{ width: "44px" }} />
            </colgroup>
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-foreground">
              <th className="py-3 px-4 text-start font-medium">{t("الاسم", "Name")}</th>
              <th className="py-3 px-4 text-start font-medium">{t("الرمز", "Code")}</th>
              <th className="py-3 px-4 text-start font-medium">{t("العنوان", "Address")}</th>
              <th className="py-3 px-4"></th>
            </tr></thead>
            <tbody>
              {items.map(b => (
                <tr key={b.id} onClick={() => navigate(`/app/branches/${b.id}`)} className="border-b border-border hover:bg-surface-hover cursor-pointer" title={t("فتح الفرع", "Open branch")}>
                  <td className="py-3 px-4 text-sm text-foreground" style={{ fontWeight: 500 }}>
                    <span className="flex min-w-0 items-center gap-2">
                      <Link to={`/app/branches/${b.id}`} onClick={(e) => e.stopPropagation()} className="min-w-0 truncate hover:underline underline-offset-4" title={b.name}><bdi dir="auto">{b.name}</bdi></Link>
                      {b.isHQ ? <StatusBadge tone="info" className="shrink-0">{t("المركز الرئيسي", "HQ")}</StatusBadge> : null}
                      {defaultBranchId === b.id ? <span className="shrink-0" title={t("فرعي الافتراضي", "My default branch")}><Star className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} /></span> : null}
                    </span>
                    {b.nameAr ? <div className="truncate text-xs text-muted-foreground" title={b.nameAr}><bdi dir="auto">{b.nameAr}</bdi></div> : null}
                  </td>
                  <td className="py-3 px-4 font-code text-sm text-muted-foreground truncate" dir="ltr">{b.code || "—"}</td>
                  <td className="py-3 px-4 text-sm text-foreground/80 truncate" title={b.address || ""}><bdi dir="auto">{b.address || "—"}</bdi></td>
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
