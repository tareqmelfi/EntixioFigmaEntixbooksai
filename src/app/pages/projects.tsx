/**
 * Projects list — app-wide standard: rows open the FULL detail page
 * (/app/projects/:id) instead of a slide-over. New project → /app/projects/new.
 */
import { useEffect, useState, useCallback } from "react";
import { FolderKanban, Plus, Loader2, ChevronLeft, FileUp } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EmptyState, InlineAlert, PageHeader, StatusBadge } from "../components/product";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";
import { ProjectIntakeWizard } from "../components/project-intake-wizard";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = { ACTIVE: { ar: "نشط", en: "Active" }, ON_HOLD: { ar: "متوقف", en: "On Hold" }, COMPLETED: { ar: "مكتمل", en: "Completed" }, CANCELLED: { ar: "ملغي", en: "Cancelled" } };
const STATUS_TONES: Record<string, "success" | "warning" | "info" | "neutral"> = {
  ACTIVE: "success", ON_HOLD: "warning", COMPLETED: "info", CANCELLED: "neutral",
};

export function Projects() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // «إنشاء مشروع من ملف» · same wizard shape as the smart import (UX-1 · full page, no dialog)
  const [intakeOpen, setIntakeOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await api.projects.list()).items); }
    catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (intakeOpen) {
    return (
      <ProjectIntakeWizard
        onClose={() => { setIntakeOpen(false); refresh(); }}
        onCreated={(projectId) => navigate(`/app/projects/${projectId}`)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("المشاريع والتنفيذ", "Projects & delivery")}
        title={t("المشاريع", "Projects")}
        description={t("إدارة المشاريع وربطها بالفواتير والمصروفات", "Manage projects and link them to invoices and expenses")}
        actions={<>
          <Button variant="outline" onClick={() => setIntakeOpen(true)} data-testid="project-intake-open">
            <FileUp className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إنشاء مشروع من ملف", "Create from a file")}
          </Button>
          <Button onClick={() => navigate("/app/projects/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مشروع جديد", "New Project")}</Button>
        </>}
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <section className="space-y-3">
        <h2 className="text-section font-semibold text-foreground">{t("القائمة", "List")} · <span className="font-english tabular-nums">{items.length}</span></h2>
        {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> :
         items.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-10 w-10" strokeWidth={1.5} />}
            title={t("لا توجد مشاريع", "No projects")}
            action={<Button onClick={() => navigate("/app/projects/new")}><Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مشروع جديد", "New Project")}</Button>}
          />
         ) :
        (<div className="ledger-table overflow-x-auto">
          <Table className="min-w-[760px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "150px" }} />{/* الرمز · mono */}
              <col />{/* الاسم · flexible */}
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "44px" }} />
            </colgroup>
            <TableHeader><TableRow>
              <TableHead className="text-start">{t("الرمز", "Code")}</TableHead>
              <TableHead className="text-start">{t("الاسم", "Name")}</TableHead>
              <TableHead className="text-start">{t("البداية", "Start")}</TableHead>
              <TableHead className="text-start">{t("النهاية", "End")}</TableHead>
              <TableHead className="text-start">{t("الحالة", "Status")}</TableHead>
              <TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id} onClick={() => navigate(`/app/projects/${p.id}`)} className="cursor-pointer" title={t("فتح المشروع", "Open project")}>
                  <TableCell><Link to={`/app/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-full truncate font-code text-sm font-semibold text-foreground hover:underline underline-offset-4" dir="ltr" title={p.code}>{p.code}</Link></TableCell>
                  <TableCell className="truncate text-sm text-foreground" title={p.name}><bdi dir="auto">{p.name}</bdi></TableCell>
                  <TableCell className="whitespace-nowrap font-english text-xs tabular-nums text-muted-foreground" dir="ltr">{p.startDate?.slice(0, 10) || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-english text-xs tabular-nums text-muted-foreground" dir="ltr">{p.endDate?.slice(0, 10) || "—"}</TableCell>
                  <TableCell><StatusBadge tone={STATUS_TONES[p.status] || "neutral"}>{STATUS_LABELS[p.status] ? (language === "ar" ? STATUS_LABELS[p.status].ar : STATUS_LABELS[p.status].en) : p.status}</StatusBadge></TableCell>
                  <TableCell className="text-muted-foreground"><ChevronLeft className="h-4 w-4 ltr:rotate-180" strokeWidth={1.75} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>)}
      </section>
    </div>
  );
}
