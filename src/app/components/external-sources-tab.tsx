/**
 * Settings → External sources (SPEC-06 · M1)
 *
 * Google Sheets linked to the company: name · template · last sync · status ·
 * rows · actions (open board · sync now · pause/resume · delete via InlineConfirm).
 * UX-1: no dialogs · toasts bottom-right · «ربط مصدر جديد» is a full page
 * (/app/settings/external-sources/new).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, RefreshCw, Pause, Play, Trash2, LayoutDashboard, Loader2, Copy, Check, Table2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { InlineConfirm } from "./side-panel";
import { InlineAlert } from "./product";
import { api, ApiError, type ExtSource } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { SourceStatusPill, relativeTime, fmtNumber } from "./board-widgets";

export function ExternalSourcesTab({ canManage, push }: { canManage: boolean; push: (kind: "success" | "error" | "info", msg: string) => void }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [sources, setSources] = useState<ExtSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceEmail, setServiceEmail] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [list, tpl] = await Promise.all([api.extSources.list(), api.extSources.templates().catch(() => null)]);
      setSources(list.sources);
      if (tpl) setServiceEmail(tpl.serviceAccountEmail);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : t("تعذّر تحميل المصادر", "Could not load sources"));
    } finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const copyEmail = async () => {
    if (!serviceEmail) return;
    try { await navigator.clipboard.writeText(serviceEmail); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { push("error", t("تعذّر النسخ", "Copy failed")); }
  };

  const syncNow = async (s: ExtSource) => {
    setBusyId(s.id);
    try {
      const r = await api.extSources.sync(s.id);
      push("success", t(`تمت المزامنة · ${fmtNumber(r.run.rowsUpserted, language)} صف`, `Synced · ${fmtNumber(r.run.rowsUpserted, language)} rows`));
      await load();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      push("error", err?.code === "too_soon" ? t("مزامنة حديثة جدًا — انتظر قليلًا", "Synced very recently — wait a moment") : (err?.message || t("فشلت المزامنة", "Sync failed")));
    } finally { setBusyId(null); }
  };

  const toggle = async (s: ExtSource) => {
    setBusyId(s.id);
    try {
      const next = s.status === "PAUSED" ? "ACTIVE" : "PAUSED";
      await api.extSources.update(s.id, { status: next });
      push("success", next === "PAUSED" ? t("تم إيقاف المزامنة مؤقتًا", "Sync paused") : t("استُؤنفت المزامنة", "Sync resumed"));
      await load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل التحديث", "Update failed")); }
    finally { setBusyId(null); }
  };

  const remove = async (s: ExtSource) => {
    setPendingDelete(null); setBusyId(s.id);
    try {
      await api.extSources.remove(s.id);
      push("success", t("تم حذف المصدر وصفوفه", "Source and its rows deleted"));
      await load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
    finally { setBusyId(null); }
  };

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground"><Table2 className="h-5 w-5" /> {t("المصادر الخارجية", "External sources")}</CardTitle>
          <CardDescription>{t("اربط Google Sheet تُحدّثه فرقك · يقرأه Entix Books ويحوّله إلى لوحة متابعة ومخرج مشترك بهوية شركتك", "Link a Google Sheet your team keeps · Entix Books reads it into a pipeline board and a branded shared page")}</CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => navigate("/app/settings/external-sources/new")} className="h-10 px-[18px] text-sm">
            <Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("ربط مصدر جديد", "Link a new source")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError && <InlineAlert tone="critical">{loadError}</InlineAlert>}

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : sources.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-10 text-center">
            <Table2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <h3 className="text-base font-semibold text-foreground">{t("لا توجد مصادر مرتبطة بعد", "No sources linked yet")}</h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              {t("سجل عروض الأسعار في Google Sheets؟ شارك الشيت مع حساب الخدمة أدناه (مشاهدة فقط)، ثم اربطه هنا — يظهر كلوحة KPIs + جدول + Kanban، ورابط عام بهوية شركتك لعملائك.",
                 "Keep your quotes register in Google Sheets? Share the sheet with the service account below (viewer), then link it here — it becomes a KPI board, table and kanban, plus a branded public link for your clients.")}
            </p>
            {serviceEmail && (
              <div className="mx-auto mt-4 flex max-w-md items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <code dir="ltr" className="min-w-0 flex-1 truncate font-code text-xs text-foreground text-left">{serviceEmail}</code>
                <button type="button" onClick={copyEmail} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground" title={t("نسخ", "Copy")}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
            {canManage && (
              <Button onClick={() => navigate("/app/settings/external-sources/new")} className="mt-4 h-10 px-[18px] text-sm">
                <Plus className="me-2 h-4 w-4" strokeWidth={1.75} />{t("ربط مصدر جديد", "Link a new source")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {serviceEmail && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{t("حساب الخدمة (شارك الشيت معه كمشاهد):", "Service account (share the sheet with it as viewer):")}</span>
                <code dir="ltr" className="font-code text-foreground">{serviceEmail}</code>
                <button type="button" onClick={copyEmail} className="rounded-md p-1 hover:bg-surface-hover hover:text-foreground" title={t("نسخ", "Copy")}>
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            {/* Phones · cards */}
            <ul className="md:hidden divide-y divide-border rounded-lg border border-border">
              {sources.map((s) => (
                <li key={s.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{language === "ar" ? s.templateNameAr : s.templateNameEn} · {fmtNumber(s.rowCount, language)} {t("صف", "rows")}</div>
                    </div>
                    <SourceStatusPill status={s.status} lang={language} />
                  </div>
                  <div className="text-xs text-muted-foreground">{t("آخر مزامنة:", "Last sync:")} {relativeTime(s.lastSyncAt, language)}</div>
                  <RowActions s={s} />
                </li>
              ))}
            </ul>
            {/* Desktop · table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="px-3 py-2 text-start font-semibold">{t("الاسم", "Name")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("القالب", "Template")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("آخر مزامنة", "Last sync")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("الحالة", "Status")}</th>
                    <th className="px-3 py-2 text-end font-semibold">{t("الصفوف", "Rows")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{s.name}</div>
                        <div dir="ltr" className={`font-code text-[11px] text-muted-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{s.sheetTitle}</div>
                      </td>
                      <td className="px-3 py-2 text-foreground">{language === "ar" ? s.templateNameAr : s.templateNameEn}</td>
                      <td className="px-3 py-2">
                        <div className="text-foreground">{relativeTime(s.lastSyncAt, language)}</div>
                        {s.lastError && <div className="max-w-[260px] truncate text-[11px] text-danger" title={s.lastError}>{s.lastError}</div>}
                        {!s.lastError && s.lastRun && s.lastRun.rowsInvalid > 0 && <div className="text-[11px] text-warning">⚠ {t(`${fmtNumber(s.lastRun.rowsInvalid, language)} صف بها مشاكل`, `${fmtNumber(s.lastRun.rowsInvalid, language)} rows with issues`)}</div>}
                      </td>
                      <td className="px-3 py-2"><SourceStatusPill status={s.status} lang={language} /></td>
                      <td className="px-3 py-2 text-end"><span dir="ltr" className="font-english tabular-nums">{fmtNumber(s.rowCount, language)}</span></td>
                      <td className="px-3 py-2"><RowActions s={s} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  function RowActions({ s }: { s: ExtSource }) {
    const busy = busyId === s.id;
    return (
      <div className="flex items-center gap-1 whitespace-nowrap">
        <button type="button" onClick={() => navigate(`/app/boards/${s.id}`)} className="rounded-full p-1.5 text-primary hover:bg-surface-hover" title={t("فتح اللوحة", "Open board")}><LayoutDashboard className="h-4 w-4" strokeWidth={1.75} /></button>
        <a href={`https://docs.google.com/spreadsheets/d/${s.spreadsheetId}`} target="_blank" rel="noreferrer" className="rounded-full p-1.5 text-content-secondary hover:bg-surface-hover" title={t("فتح الشيت", "Open the sheet")}><ExternalLink className="h-4 w-4" strokeWidth={1.75} /></a>
        <button type="button" disabled={busy} onClick={() => syncNow(s)} className="rounded-full p-1.5 text-content-secondary hover:bg-surface-hover disabled:opacity-50" title={t("مزامنة الآن", "Sync now")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
        </button>
        {canManage && (
          <button type="button" disabled={busy} onClick={() => toggle(s)} className="rounded-full p-1.5 text-content-secondary hover:bg-surface-hover disabled:opacity-50" title={s.status === "PAUSED" ? t("استئناف", "Resume") : t("إيقاف مؤقت", "Pause")}>
            {s.status === "PAUSED" ? <Play className="h-4 w-4" strokeWidth={1.75} /> : <Pause className="h-4 w-4" strokeWidth={1.75} />}
          </button>
        )}
        {canManage && (pendingDelete === s.id ? (
          <InlineConfirm onConfirm={() => remove(s)} onCancel={cancelDelete} label={t("حذف المصدر وكل صفوفه؟", "Delete the source and all its rows?")} />
        ) : (
          <button type="button" disabled={busy} onClick={() => setPendingDelete(s.id)} className="rounded-full p-1.5 text-danger hover:bg-surface-hover disabled:opacity-50" title={t("حذف", "Delete")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
        ))}
      </div>
    );
  }
}
