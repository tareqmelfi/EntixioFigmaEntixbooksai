/**
 * /app/boards · «لوحات المتابعة» (SPEC-06 · M1)
 *
 * One card per external source: name · template · KPI summary · last sync · status.
 * Empty state points to Settings → External sources. Entix tokens only (no brandTheme here).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LayoutDashboard, Loader2, Settings2, ArrowUpLeft } from "lucide-react";
import { PageHeader, EmptyState, InlineAlert } from "../components/product";
import { Button } from "../components/ui/button";
import { useLanguage } from "../components/LanguageContext";
import { useOrgRegion } from "../lib/use-org-region";
import { api, ApiError, type ExtSource, type ExtKpi } from "../lib/api";
import { SourceStatusPill, relativeTime, fmtMoney, fmtNumber, fmtPercent } from "../components/board-widgets";

type CardData = { source: ExtSource; kpis: ExtKpi[] | null; invalidCount: number };

export function Boards() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { currency } = useOrgRegion();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { sources } = await api.extSources.list();
        const base: CardData[] = sources.map((source) => ({ source, kpis: null, invalidCount: 0 }));
        if (alive) setCards(base);
        // KPI summary · page 1 with a tiny page size (kpis are computed over the whole source)
        const enriched = await Promise.all(base.map(async (c) => {
          try { const r = await api.extSources.rows(c.source.id, { page: 1, pageSize: 1 }); return { ...c, kpis: r.kpis, invalidCount: r.invalidCount }; }
          catch { return c; }
        }));
        if (alive) setCards(enriched);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : t("تعذّر تحميل اللوحات", "Could not load boards"));
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = currency || "SAR";
  const fmtKpi = (k: ExtKpi) => k.format === "money" ? fmtMoney(k.value, cur, language) : k.format === "percent" ? fmtPercent(k.value, language) : fmtNumber(k.value, language);

  return (
    <div className="space-y-6">
      <PageHeader
        className="[&_h1]:text-[24px] sm:[&_h1]:text-[28px] [&_h1]:leading-tight"
        eyebrow={<span className="text-[13px]">{t("التقارير", "Reports")}</span>}
        title={t("لوحات المتابعة", "Pipeline boards")}
        description={t("مصادر Google Sheets المرتبطة بشركتك · KPIs وجدول وKanban لكل مصدر", "Google Sheets linked to your company · KPIs, table and kanban per source")}
        actions={
          <Button variant="outline" className="h-10 px-[18px] text-sm" onClick={() => navigate("/app/settings?tab=external-sources")}>
            <Settings2 className="me-2 h-4 w-4" strokeWidth={1.75} />{t("إدارة المصادر", "Manage sources")}
          </Button>
        }
      />

      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      {loading && cards.length === 0 ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard className="h-8 w-8" strokeWidth={1.75} />}
          title={t("لا توجد لوحات بعد", "No boards yet")}
          description={t("اربط Google Sheet من الإعدادات → المصادر الخارجية، وستظهر هنا كلوحة متابعة جاهزة للمشاركة.", "Link a Google Sheet from Settings → External sources and it appears here as a shareable board.")}
          action={<Button onClick={() => navigate("/app/settings/external-sources/new")}>{t("ربط مصدر جديد", "Link a new source")}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ source: s, kpis, invalidCount }) => (
            <Link key={s.id} to={`/app/boards/${s.id}`} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
              <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground">{s.name}</h2>
                    <p className="text-xs text-muted-foreground">{language === "ar" ? s.templateNameAr : s.templateNameEn} · <span dir="ltr" className="font-english tabular-nums">{fmtNumber(s.rowCount, language)}</span> {t("صف", "rows")}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    <SourceStatusPill status={s.status} lang={language} />
                    <ArrowUpLeft className="h-3.5 w-3.5 text-primary/0 transition-colors group-hover:text-primary/70" aria-hidden />
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {kpis === null ? (
                    <div className="col-span-2 py-3 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : kpis.slice(0, 4).map((k) => (
                    <div key={k.key} className="min-w-0 rounded-lg bg-muted/50 px-3 py-2">
                      <div className="truncate text-[11px] text-muted-foreground">{language === "ar" ? k.labelAr : k.labelEn}</div>
                      <div dir="ltr" className={`truncate font-english text-[17px] font-bold tabular-nums text-foreground ${language === "ar" ? "text-right" : "text-left"}`} title={fmtKpi(k)}>{fmtKpi(k)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
                  <span>{t("آخر مزامنة:", "Last sync:")} {relativeTime(s.lastSyncAt, language)}</span>
                  {s.lastError ? <span className="text-danger">✕ {t("خطأ في المزامنة", "Sync error")}</span>
                    : invalidCount > 0 ? <span className="text-warning">⚠ {t(`${fmtNumber(invalidCount, language)} صفوف بها مشاكل`, `${fmtNumber(invalidCount, language)} rows with issues`)}</span>
                    : null}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
