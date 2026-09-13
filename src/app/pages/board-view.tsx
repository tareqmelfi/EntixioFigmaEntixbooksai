/**
 * /app/boards/:sourceId · board view (SPEC-06 · M1)
 *
 * ENTIX COLOURS ONLY — brandTheme is never read here (it belongs to /b/:token).
 * Header · filters (query params) · KPI tiles · table | kanban · row split-view
 * (in-page pane on wide screens · SidePanel below) · invalid-rows banner ·
 * sharing card (create → URL shown once · revoke via InlineConfirm) · runs · pagination.
 * UX-1: no dialogs · toasts bottom-right.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { RefreshCw, ExternalLink, Download, Table2, Kanban, Loader2, Search, X, Link2, Copy, Check, Eye, Trash2, ChevronRight, ChevronLeft, History } from "lucide-react";
import { PageHeader, InlineAlert } from "../components/product";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { DateInput } from "../components/date-input";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";
import { useWideViewport } from "../lib/use-wide-viewport";
import { api, ApiError, type ExtSource, type ExtRowsResponse, type ExtRow, type ExtShare, type ExtSourceRun } from "../lib/api";
import { BoardKpis, BoardTable, BoardKanban, StatusPill, SourceStatusPill, relativeTime, fmtDateTime, fmtNumber, formatCell, fieldLabel, type BoardRow } from "../components/board-widgets";

const PAGE_SIZE = 50;

export function BoardView() {
  const { sourceId = "" } = useParams<{ sourceId: string }>();
  const { t, language } = useLanguage();
  const { currency } = useOrgRegion();
  const cur = currency || "SAR";
  const { toasts, push, dismiss } = useToasts();
  const wide = useWideViewport("(min-width: 1280px)");
  const [params, setParams] = useSearchParams();

  const view = params.get("view") === "kanban" ? "kanban" : "table";
  const status = params.get("status") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const q = params.get("q") || "";
  const invalidOnly = params.get("invalid") === "1";
  const page = Math.max(1, Number(params.get("page") || 1) || 1);

  const setParam = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") next.delete(k); else next.set(k, v); }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const [source, setSource] = useState<ExtSource | null>(null);
  const [data, setData] = useState<ExtRowsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<ExtRow | null>(null);
  const [searchText, setSearchText] = useState(q);

  // Sharing
  const [shares, setShares] = useState<ExtShare[]>([]);
  const [shareLabel, setShareLabel] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [creatingShare, setCreatingShare] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; token: string; label: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  // Runs
  const [runs, setRuns] = useState<ExtSourceRun[]>([]);
  const [showRuns, setShowRuns] = useState(false);

  const canManage = true; // the API enforces owner/admin on share/secret mutations · 403 surfaces as a toast

  const loadSource = useCallback(async () => {
    try {
      const { sources } = await api.extSources.list();
      setSource(sources.find((s) => s.id === sourceId) || null);
    } catch { /* the rows call reports the error */ }
  }, [sourceId]);

  const loadRows = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true); setError(null);
    try {
      const r = await api.extSources.rows(sourceId, {
        status: status || undefined, from: from || undefined, to: to || undefined, q: q || undefined,
        page: invalidOnly ? 1 : page, pageSize: invalidOnly ? 200 : PAGE_SIZE,
      });
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("تعذّر تحميل اللوحة", "Could not load the board"));
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, status, from, to, q, page, invalidOnly]);

  const loadShares = useCallback(async () => {
    try { setShares((await api.extSources.shares(sourceId)).shares); } catch { /* optional card */ }
  }, [sourceId]);
  const loadRuns = useCallback(async () => {
    try { setRuns((await api.extSources.runs(sourceId)).runs); } catch { /* optional */ }
  }, [sourceId]);

  useEffect(() => { void loadSource(); void loadShares(); void loadRuns(); }, [loadSource, loadShares, loadRuns]);
  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { setSearchText(q); }, [q]);

  const rows: BoardRow[] = useMemo(() => {
    const all = data?.rows || [];
    return invalidOnly ? all.filter((r) => !r.valid) : all;
  }, [data, invalidOnly]);

  const totalPages = data && !invalidOnly ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE))) : 1;

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await api.extSources.sync(sourceId);
      push("success", t(`تمت المزامنة · ${fmtNumber(r.run.rowsUpserted, language)} صف`, `Synced · ${fmtNumber(r.run.rowsUpserted, language)} rows`));
      await Promise.all([loadRows(), loadSource(), loadRuns()]);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      push("error", err?.code === "too_soon" ? t("مزامنة حديثة جدًا — انتظر قليلًا", "Synced very recently — wait a moment") : (err?.message || t("فشلت المزامنة", "Sync failed")));
    } finally { setSyncing(false); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.extSources.exportCsv(sourceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${(source?.name || "board").replace(/[^\w؀-ۿ-]+/g, "_")}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch { push("error", t("تعذر التصدير", "Export failed")); }
    finally { setExporting(false); }
  };

  const createShare = async () => {
    setCreatingShare(true);
    try {
      const r = await api.extSources.createShare(sourceId, { label: shareLabel.trim() || undefined, expiresAt: shareExpires ? new Date(shareExpires + "T23:59:59").toISOString() : undefined });
      const url = r.url || `${window.location.origin}/b/${r.token}`;
      setFresh({ url, token: r.token, label: r.share.label });
      setCopied(false); setShareLabel(""); setShareExpires("");
      push("success", t("أُنشئ رابط المشاركة · انسخه الآن", "Share link created · copy it now"));
      await loadShares();
    } catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذّر إنشاء الرابط", "Could not create the link")); }
    finally { setCreatingShare(false); }
  };
  const copyFresh = async () => {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { push("error", t("تعذّر النسخ", "Copy failed")); }
  };
  const revoke = async (id: string) => {
    setPendingRevoke(null);
    try { await api.extSources.revokeShare(sourceId, id); push("success", t("أُبطل الرابط", "Link revoked")); if (fresh && shares.find((s) => s.id === id)) setFresh(null); await loadShares(); }
    catch (e) { push("error", e instanceof ApiError ? e.message : t("تعذّر الإبطال", "Revoke failed")); }
  };
  const cancelRevoke = useCallback(() => setPendingRevoke(null), []);

  const sheetUrl = source ? `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}` : null;
  const template = data?.template || null;
  const statusOptions = data?.statusOptions || [];

  // ── Row detail (split-view) ─────────────────────────────────────────────────
  const detail = selected && template ? (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div dir="ltr" className={`font-code text-xs text-muted-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{t("صف", "Row")} #{selected.rowIndex} · {selected.rowKey}</div>
          {template.kanbanField && <div className="mt-1"><StatusPill value={selected.normalized[template.kanbanField]} options={statusOptions} lang={language} /></div>}
        </div>
        {selected.valid
          ? <span className="rounded-full border border-success-border bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">✓ {t("سليم", "Valid")}</span>
          : <span className="rounded-full border border-warning-border bg-warning-subtle px-2 py-0.5 text-[11px] font-semibold text-warning">⚠ {t("به مشاكل", "Has issues")}</span>}
      </div>
      {selected.errors.length > 0 && (
        <InlineAlert tone="warning" title={t("مشاكل الصف", "Row issues")}>
          <ul className="space-y-0.5 text-xs">{selected.errors.map((e, i) => <li key={i}>· {e}</li>)}</ul>
        </InlineAlert>
      )}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-2 py-1.5 text-start font-semibold">{t("الحقل", "Field")}</th>
            <th className="px-2 py-1.5 text-start font-semibold">{t("خام (الشيت)", "Raw (sheet)")}</th>
            <th className="px-2 py-1.5 text-start font-semibold">{t("مطبَّع", "Normalized")}</th>
          </tr></thead>
          <tbody>
            {template.fields.map((f) => {
              const header = source?.mapping?.[f.key] || null;
              const raw = header ? selected.data[header] : undefined;
              const num = f.type === "money" || f.type === "number";
              return (
                <tr key={f.key} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-2 py-1.5 font-medium text-foreground">{fieldLabel(f, language)}{header && <div dir="ltr" className={`font-code text-[10px] text-muted-foreground ${language === "ar" ? "text-right" : "text-left"}`}>{header}</div>}</td>
                  <td className="px-2 py-1.5 text-muted-foreground break-words"><bdi dir="auto">{raw === undefined || raw === "" ? "—" : String(raw)}</bdi></td>
                  <td className={`px-2 py-1.5 text-foreground break-words ${num ? "font-english tabular-nums" : ""}`}><span dir={num || f.type === "date" ? "ltr" : undefined}>{formatCell(f, selected.normalized[f.key], language, cur)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-muted-foreground">{t("آخر مزامنة للصف:", "Row synced:")} {fmtDateTime(selected.syncedAt, language)}</div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<Link to="/app/boards" className="text-[13px] hover:underline underline-offset-4">{t("لوحات المتابعة", "Pipeline boards")}</Link>}
        title={source?.name || t("لوحة", "Board")}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {source && <SourceStatusPill status={data?.status || source.status} lang={language} />}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" title={fmtDateTime(data?.lastSuccessAt || source?.lastSuccessAt, language)}>
              <RefreshCw className="h-3 w-3" /> {t("آخر مزامنة:", "Last sync:")} {relativeTime(data?.lastSyncAt || source?.lastSyncAt, language)}
            </span>
            {source && <span className="text-xs text-muted-foreground">{language === "ar" ? source.templateNameAr : source.templateNameEn}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" className="h-10 px-[14px] text-sm" onClick={syncNow} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="me-2 h-4 w-4" strokeWidth={1.75} />{t("مزامنة الآن", "Sync now")}</>}
            </Button>
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-[14px] text-sm text-foreground hover:bg-surface-hover">
                <ExternalLink className="me-2 h-4 w-4" strokeWidth={1.75} />{t("فتح الشيت", "Open the sheet")}
              </a>
            )}
            <Button variant="secondary" className="h-10 px-[14px] text-sm" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="me-2 h-4 w-4" strokeWidth={1.75} />CSV</>}
            </Button>
          </>
        }
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}
      {(data?.lastError || source?.lastError) && !error && (
        <InlineAlert tone="critical" title={t("آخر مزامنة فشلت", "The last sync failed")}><span className="text-xs">{data?.lastError || source?.lastError}</span></InlineAlert>
      )}

      {/* KPIs · Entix tokens */}
      {data && <BoardKpis kpis={data.kpis} lang={language} currency={cur} />}

      {/* Invalid rows banner */}
      {data && data.invalidCount > 0 && !invalidOnly && (
        <InlineAlert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>🟡 {t(`${fmtNumber(data.invalidCount, language)} صفوف بها مشاكل`, `${fmtNumber(data.invalidCount, language)} rows with issues`)}</span>
            <button type="button" onClick={() => setParam({ invalid: "1", view: "table" })} className="text-sm font-medium text-primary hover:underline underline-offset-4">{t("عرض", "Show")}</button>
          </div>
        </InlineAlert>
      )}
      {invalidOnly && (
        <InlineAlert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("تعرض الصفوف ذات المشاكل فقط", "Showing rows with issues only")}</span>
            <button type="button" onClick={() => setParam({ invalid: null })} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"><X className="h-3.5 w-3.5" />{t("إلغاء", "Clear")}</button>
          </div>
        </InlineAlert>
      )}

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("الحالة", "Status")}</Label>
          <select value={status} onChange={(e) => setParam({ status: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground">
            <option value="">{t("الكل", "All")}</option>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{language === "ar" ? o.labelAr : o.labelEn}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label className="text-xs">{t("من", "From")}</Label><DateInput value={from} onChange={(v) => setParam({ from: v || null })} inputClassName="h-9 w-[150px]" /></div>
        <div className="space-y-1"><Label className="text-xs">{t("إلى", "To")}</Label><DateInput value={to} onChange={(v) => setParam({ to: v || null })} inputClassName="h-9 w-[150px]" /></div>
        <form className="min-w-[200px] flex-1 space-y-1" onSubmit={(e) => { e.preventDefault(); setParam({ q: searchText.trim() || null }); }}>
          <Label className="text-xs">{t("بحث", "Search")}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t("رقم · جهة · مشروع…", "Number · party · project…")} className="h-9 ps-8 text-[13px]" />
          </div>
        </form>
        {(status || from || to || q) && (
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => { setSearchText(""); setParam({ status: null, from: null, to: null, q: null }); }}><X className="me-1 h-3.5 w-3.5" />{t("مسح", "Clear")}</Button>
        )}
        <div className="ms-auto inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label={t("طريقة العرض", "View")}>
          <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setParam({ view: null })} className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium ${view === "table" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}><Table2 className="h-3.5 w-3.5" />{t("جدول", "Table")}</button>
          <button type="button" role="tab" aria-selected={view === "kanban"} onClick={() => setParam({ view: "kanban", invalid: null })} className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium ${view === "kanban" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}><Kanban className="h-3.5 w-3.5" />{t("Kanban", "Kanban")}</button>
        </div>
      </div>

      {/* Content · split-view on wide screens */}
      <div className={wide && selected ? "grid grid-cols-[minmax(0,1fr)_minmax(380px,32%)] items-start gap-6" : ""}>
        <div className="min-w-0 space-y-4">
          {loading && !data ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
          ) : template ? (
            <div className={loading ? "opacity-60 transition-opacity" : ""}>
              {view === "table" ? (
                <BoardTable template={template} rows={rows} statusOptions={statusOptions} lang={language} currency={cur} onRowClick={(r) => setSelected(r as ExtRow)} selectedId={selected?.id} showErrors empty={t("لا صفوف تطابق المرشحات", "No rows match the filters")} />
              ) : (
                <BoardKanban template={template} rows={rows} statusOptions={statusOptions} lang={language} currency={cur} onRowClick={(r) => setSelected(r as ExtRow)} />
              )}
            </div>
          ) : null}

          {/* Pagination */}
          {data && !invalidOnly && totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{t(`${fmtNumber(data.total, language)} صف · صفحة ${fmtNumber(page, language)} من ${fmtNumber(totalPages, language)}`, `${fmtNumber(data.total, language)} rows · page ${fmtNumber(page, language)} of ${fmtNumber(totalPages, language)}`)}</span>
              <div className="inline-flex gap-1">
                <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>{language === "ar" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}{t("السابق", "Previous")}</Button>
                <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setParam({ page: String(page + 1) })}>{t("التالي", "Next")}{language === "ar" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
              </div>
            </div>
          )}
        </div>

        {wide && selected && (
          <aside className="sticky top-4 rounded-xl border border-border bg-card p-4" aria-label={t("تفاصيل الصف", "Row details")}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{t("تفاصيل الصف", "Row details")}</h2>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground" aria-label={t("إغلاق", "Close")}><X className="h-4 w-4" /></button>
            </div>
            {detail}
          </aside>
        )}
      </div>
      {!wide && (
        <SidePanel open={!!selected} onClose={() => setSelected(null)} title={t("تفاصيل الصف", "Row details")} width="md">
          {detail}
        </SidePanel>
      )}

      {/* Sharing card */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Link2 className="h-4 w-4" strokeWidth={1.75} />{t("المشاركة", "Sharing")}</h2>
            <p className="text-xs text-muted-foreground">{t("رابط عام للقراءة بهوية شركتك · بلا تسجيل دخول · يمكن إبطاله في أي وقت", "A public read-only link in your company identity · no login · revocable anytime")}</p>
          </div>
        </div>

        {fresh && (
          <InlineAlert tone="success" title={t("انسخ الرابط الآن — لن يظهر مرة أخرى", "Copy the link now — it will not be shown again")}>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code dir="ltr" className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2 py-1 font-code text-xs text-foreground text-left">{fresh.url}</code>
              <Button type="button" size="sm" variant="outline" onClick={copyFresh}>{copied ? <Check className="me-1 h-3.5 w-3.5 text-success" /> : <Copy className="me-1 h-3.5 w-3.5" />}{t("نسخ", "Copy")}</Button>
              <a href={`/b/${fresh.token}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs text-foreground hover:bg-surface-hover"><Eye className="me-1 h-3.5 w-3.5" />{t("معاينة كما يراها العميل", "Preview as the client sees it")}</a>
            </div>
          </InlineAlert>
        )}

        {canManage && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label htmlFor="share-label" className="text-xs">{t("تسمية (اختياري)", "Label (optional)")}</Label>
              <Input id="share-label" value={shareLabel} onChange={(e) => setShareLabel(e.target.value)} placeholder={t("مثال: عميل EDG · مارس", "e.g. EDG client · March")} className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("ينتهي في (اختياري)", "Expires on (optional)")}</Label>
              <DateInput value={shareExpires} onChange={setShareExpires} inputClassName="h-9 w-[150px]" />
            </div>
            <Button type="button" onClick={createShare} disabled={creatingShare} className="h-9">
              {creatingShare ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إنشاء رابط مشاركة", "Create share link")}</>}
            </Button>
          </div>
        )}

        {shares.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-3 py-2 text-start font-semibold">{t("التسمية", "Label")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("أُنشئ", "Created")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("ينتهي", "Expires")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("المشاهدات", "Views")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("الحالة", "Status")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("إجراءات", "Actions")}</th>
              </tr></thead>
              <tbody>
                {shares.map((s) => {
                  const expired = !!s.expiresAt && new Date(s.expiresAt).getTime() < Date.now();
                  const active = !s.revokedAt && !expired;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 text-foreground">{s.label || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDateTime(s.createdAt, language)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.expiresAt ? fmtDateTime(s.expiresAt, language) : t("بلا انتهاء", "Never")}</td>
                      <td className="px-3 py-2 text-end"><span dir="ltr" className="font-english tabular-nums">{fmtNumber(s.viewCount, language)}</span>{s.lastViewedAt && <div className="text-[10px] text-muted-foreground">{relativeTime(s.lastViewedAt, language)}</div>}</td>
                      <td className="px-3 py-2">
                        {active ? <span className="rounded-full border border-success-border bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">✓ {t("نشط", "Active")}</span>
                          : s.revokedAt ? <span className="rounded-full border border-danger-border bg-danger-subtle px-2 py-0.5 text-[11px] font-semibold text-danger">✕ {t("مُبطَل", "Revoked")}</span>
                          : <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">ⓘ {t("منتهي", "Expired")}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {active && canManage && (pendingRevoke === s.id
                          ? <InlineConfirm onConfirm={() => revoke(s.id)} onCancel={cancelRevoke} label={t("إبطال الرابط؟", "Revoke the link?")} />
                          : <button type="button" onClick={() => setPendingRevoke(s.id)} className="rounded-full p-1.5 text-danger hover:bg-surface-hover" title={t("إبطال", "Revoke")}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("لا روابط مشاركة بعد", "No share links yet")}</p>
        )}
      </section>

      {/* Runs · compact history */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <button type="button" onClick={() => setShowRuns((v) => !v)} className="flex w-full items-center justify-between gap-2 text-start">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4" strokeWidth={1.75} />{t("سجل المزامنة", "Sync history")} <span className="font-english text-xs text-muted-foreground">({fmtNumber(runs.length, language)})</span></span>
          <span className="text-xs text-muted-foreground">{showRuns ? t("إخفاء", "Hide") : t("عرض", "Show")}</span>
        </button>
        {showRuns && (
          runs.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{t("لا تشغيلات بعد", "No runs yet")}</p> : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="px-2 py-1.5 text-start font-semibold">{t("البداية", "Started")}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t("المُشغِّل", "Trigger")}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t("الحالة", "Status")}</th>
                  <th className="px-2 py-1.5 text-end font-semibold">{t("مقروءة", "Seen")}</th>
                  <th className="px-2 py-1.5 text-end font-semibold">{t("محدَّثة", "Upserted")}</th>
                  <th className="px-2 py-1.5 text-end font-semibold">{t("محذوفة", "Removed")}</th>
                  <th className="px-2 py-1.5 text-end font-semibold">{t("بها مشاكل", "Invalid")}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t("خطأ", "Error")}</th>
                </tr></thead>
                <tbody>
                  {runs.slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.startedAt, language)}</td>
                      <td className="px-2 py-1.5"><code className="font-code">{r.trigger}</code></td>
                      <td className="px-2 py-1.5">{r.status === "SUCCESS" ? <span className="text-success">✓ {t("نجح", "Success")}</span> : r.status === "FAILED" ? <span className="text-danger">✕ {t("فشل", "Failed")}</span> : r.status === "RUNNING" ? <span className="text-muted-foreground">… {t("يعمل", "Running")}</span> : <span className="text-warning">⚠ {r.status}</span>}</td>
                      <td className="px-2 py-1.5 text-end font-english tabular-nums">{fmtNumber(r.rowsSeen, language)}</td>
                      <td className="px-2 py-1.5 text-end font-english tabular-nums">{fmtNumber(r.rowsUpserted, language)}</td>
                      <td className="px-2 py-1.5 text-end font-english tabular-nums">{fmtNumber(r.rowsRemoved, language)}</td>
                      <td className="px-2 py-1.5 text-end font-english tabular-nums">{fmtNumber(r.rowsInvalid, language)}</td>
                      <td className="max-w-[240px] truncate px-2 py-1.5 text-danger" title={r.error || ""}>{r.error || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </div>
  );
}
