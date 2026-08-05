/**
 * Projects list — app-wide standard: rows open the FULL detail page
 * (/app/projects/:id) instead of a slide-over. New project → /app/projects/new.
 */
import { useEffect, useState, useCallback } from "react";
import { FolderKanban, Plus, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = { ACTIVE: { ar: "نشط", en: "Active" }, ON_HOLD: { ar: "متوقف", en: "On Hold" }, COMPLETED: { ar: "مكتمل", en: "Completed" }, CANCELLED: { ar: "ملغي", en: "Cancelled" } };
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700", ON_HOLD: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700", CANCELLED: "bg-gray-100 text-gray-500",
};

export function Projects() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.projects.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("المشاريع", "Projects")}</h1><p className="text-muted-foreground mt-1">{t("إدارة المشاريع وربطها بالفواتير والمصروفات", "Manage projects and link them to invoices and expenses")}</p></div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/app/projects/new")}><Plus className="me-2 h-4 w-4" />{t("مشروع جديد", "New Project")}</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("القائمة", "List")} · {items.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
           items.length === 0 ? <div className="py-12 text-center"><FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" /><p className="text-sm text-muted-foreground">{t("لا توجد مشاريع", "No projects")}</p></div> :
          (<table className="w-full"><thead><tr className="border-b border-border bg-muted text-xs text-muted-foreground">
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الرمز", "Code")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الاسم", "Name")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("البداية", "Start")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("النهاية", "End")}</th>
            <th className="py-3 px-4 text-start" style={{ fontWeight: 600 }}>{t("الحالة", "Status")}</th>
            <th className="py-3 px-4 w-[50px]"></th>
          </tr></thead><tbody>
            {items.map(p => (
              <tr key={p.id} onClick={() => navigate(`/app/projects/${p.id}`)} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer">
                <td className="py-3 px-4 font-english text-sm text-primary" style={{ fontWeight: 600 }}>{p.code}</td>
                <td className="py-3 px-4 text-sm text-foreground">{p.name}</td>
                <td className="py-3 px-4 font-english text-xs text-muted-foreground" dir="ltr">{p.startDate?.slice(0, 10) || "—"}</td>
                <td className="py-3 px-4 font-english text-xs text-muted-foreground" dir="ltr">{p.endDate?.slice(0, 10) || "—"}</td>
                <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[p.status] || ""}`}>{STATUS_LABELS[p.status] ? (language === "ar" ? STATUS_LABELS[p.status].ar : STATUS_LABELS[p.status].en) : p.status}</span></td>
                <td className="py-3 px-2 text-muted-foreground/50"><ChevronLeft className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody></table>)}
        </CardContent>
      </Card>
    </div>
  );
}
