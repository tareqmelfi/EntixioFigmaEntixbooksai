/**
 * /b/:token · public board (SPEC-06 · M1) — OUTSIDE the app layout.
 * No sidebar · no header · no session. Token only.
 *
 * This is the ONE place the company's `brandTheme` is applied: injected as CSS
 * variables on the page root (--bt-primary --bt-secondary --bt-fill --bt-ink --bt-logo),
 * falling back to Entix defaults when the org has no theme. Semantic status colours
 * stay fixed (good ✓ · attention ⚠ · blocking ✕ · neutral ⓘ).
 *
 * PDF path for M1 = the browser print dialog (window.print) with an A4 print
 * stylesheet: controls hidden · table header repeated · colours preserved.
 * Language follows org.defaultInvoiceLanguage (ar → RTL · en → LTR).
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router";
import { Loader2, Printer, Table2, Kanban, XCircle } from "lucide-react";
import { api, ApiError, type PublicBoardPayload } from "../lib/api";
import { BoardKpis, BoardTable, BoardKanban, brandVars, tr, fmtDateTime, fmtNumber, type BoardLang } from "../components/board-widgets";

const PRINT_CSS = `
.public-board { min-height: 100vh; background: var(--bt-fill, #F4FCFF); color: var(--bt-ink, #0B1B49); }
.public-board .pb-head { background: var(--bt-primary, #0B1B49); color: #fff; }
.public-board .pb-link { color: var(--bt-secondary, #1276E3); }
.public-board .pb-btn { border: 1px solid var(--bt-secondary, #1276E3); color: var(--bt-secondary, #1276E3); background: #fff; }
.public-board .pb-btn[aria-pressed="true"] { background: var(--bt-secondary, #1276E3); color: #fff; }
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; }
  .public-board { background: #fff !important; min-height: auto; }
  .public-board .pb-controls, .public-board .board-cards { display: none !important; }
  .public-board .board-table { display: block !important; overflow: visible !important; border: 0 !important; }
  .public-board .board-table table { min-width: 0 !important; width: 100% !important; font-size: 10.5px; }
  .public-board .board-table thead { display: table-header-group; }
  .public-board .board-table tr { break-inside: avoid; page-break-inside: avoid; }
  .public-board .board-kanban { overflow: visible !important; }
  .public-board .board-kanban > div { min-width: 0 !important; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important; }
  .public-board .board-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .public-board * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .public-board .pb-head { padding: 8px 0 !important; }
}
`;

export function PublicBoard() {
  const { token = "" } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<PublicBoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [status, setStatus] = useState("");

  const lang: BoardLang = payload?.org.defaultInvoiceLanguage === "en" ? "en" : "ar";
  const t = tr(lang);
  const currency = (payload?.org.baseCurrency || "SAR").toUpperCase();

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      setLoading(true); setNotFound(false); setError(null);
      try {
        const p = await api.extSources.publicBoard(token);
        if (!alive) return;
        setPayload(p);
        try { document.title = `${p.source.name} · ${p.org.name}`; } catch { /* ignore */ }
      } catch (e) {
        if (!alive) return;
        const err = e instanceof ApiError ? e : null;
        if (err && (err.status === 404 || err.status === 410 || err.status === 403)) setNotFound(true);
        else setError(err?.message || "network_error");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token]);

  const rows = useMemo(() => {
    if (!payload) return [];
    const kf = payload.template.kanbanField;
    if (!status || !kf) return payload.rows;
    if (status === "__other") { const known = new Set(payload.statusOptions.map((o) => o.value)); return payload.rows.filter((r) => { const v = r.normalized[kf]; return v == null || v === "" || !known.has(String(v)); }); }
    return payload.rows.filter((r) => String(r.normalized[kf] ?? "") === status);
  }, [payload, status]);

  const rootStyle = useMemo(() => (payload ? brandVars(payload.org.brandTheme) : brandVars(null)) as CSSProperties, [payload]);
  const logo = payload?.org.brandTheme?.logoUrl || payload?.org.logoUrl || null;

  if (loading) {
    return <div dir="rtl" className="flex min-h-screen items-center justify-center" style={{ background: "#F4FCFF" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#1276E3" }} /></div>;
  }
  if (notFound || error || !payload) {
    const ar = !payload || payload.org.defaultInvoiceLanguage !== "en";
    return (
      <div dir={ar ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center p-6" style={{ background: "#F4FCFF" }}>
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "#D6E4EE" }}>
          <XCircle className="mx-auto mb-3 h-10 w-10" style={{ color: "#E84B4B" }} />
          <h1 className="text-lg font-bold" style={{ color: "#0B1B49" }}>{notFound ? (ar ? "هذا الرابط لم يعد متاحًا" : "This link is no longer available") : (ar ? "تعذّر تحميل اللوحة" : "Could not load the board")}</h1>
          <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>{notFound ? (ar ? "ربما أُبطل الرابط أو انتهت صلاحيته — اطلب رابطًا جديدًا من الجهة التي شاركته معك." : "The link may have been revoked or expired — ask the company that shared it for a new one.") : (ar ? "حاول مجددًا بعد قليل." : "Please try again in a moment.")}</p>
          <p className="mt-6 text-[11px]" style={{ color: "#9CA3AF" }}>{ar ? "مُشغَّل بواسطة Entix Books" : "Powered by Entix Books"}</p>
        </div>
      </div>
    );
  }

  const { org, source, template, kpis, statusOptions } = payload;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="public-board" style={rootStyle} lang={lang}>
      <style>{PRINT_CSS}</style>

      {/* Header · company identity */}
      <header className="pb-head">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {logo ? <img src={logo} alt={org.name} className="h-10 w-auto max-w-[160px] object-contain" /> : null}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold opacity-90">{org.name}</div>
              <h1 className="truncate text-lg font-bold leading-tight sm:text-xl">{source.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{t("آخر تحديث:", "Last updated:")} <span dir="ltr" className="font-english tabular-nums">{fmtDateTime(source.lastSuccessAt, lang)}</span></span>
            <button type="button" onClick={() => window.print()} className="pb-controls inline-flex h-8 items-center gap-1.5 rounded-md bg-white/15 px-3 text-xs font-medium hover:bg-white/25">
              <Printer className="h-3.5 w-3.5" />{t("طباعة / PDF", "Print / PDF")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        <BoardKpis kpis={kpis} lang={lang} currency={currency} brand />

        {/* Light controls · hidden on print */}
        <div className="pb-controls flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={status === ""} onClick={() => setStatus("")} className="pb-btn h-8 rounded-full px-3 text-xs font-medium">{t("الكل", "All")} <span dir="ltr" className="font-english tabular-nums opacity-80">({fmtNumber(payload.rows.length, lang)})</span></button>
            {template.kanbanField && statusOptions.map((o) => (
              <button key={o.value} type="button" aria-pressed={status === o.value} onClick={() => setStatus(status === o.value ? "" : o.value)} className="pb-btn h-8 rounded-full px-3 text-xs font-medium">{lang === "ar" ? o.labelAr : o.labelEn}</button>
            ))}
          </div>
          <div className="inline-flex gap-1">
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} className="pb-btn inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"><Table2 className="h-3.5 w-3.5" />{t("جدول", "Table")}</button>
            {template.kanbanField && <button type="button" aria-pressed={view === "kanban"} onClick={() => setView("kanban")} className="pb-btn inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"><Kanban className="h-3.5 w-3.5" />Kanban</button>}
          </div>
        </div>

        {view === "table" || !template.kanbanField ? (
          <BoardTable template={template} rows={rows} statusOptions={statusOptions} lang={lang} currency={currency} brand empty={t("لا صفوف", "No rows")} />
        ) : (
          <BoardKanban template={template} rows={rows} statusOptions={statusOptions} lang={lang} currency={currency} brand />
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-[11px] opacity-60 sm:px-6">
        {t("مُشغَّل بواسطة Entix Books", "Powered by Entix Books")} · <a className="pb-link" href="https://entix.io" target="_blank" rel="noreferrer">entix.io</a>
      </footer>
    </div>
  );
}
