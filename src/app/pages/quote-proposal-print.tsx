import { loadQuotePresentation, QuoteDocument, type QuotePresentation } from "../components/quote-document";
/**
 * Proposal print view (SPEC-04) · /print/proposal/:id — org-side branded PDF
 * via browser print.
 *
 * 2026-09-08 · renders from the org's brand document template (cover → inner
 * pages → terms & conditions page · fixed A4 sheets) through the shared
 * document engine (src/app/lib/document-render.ts · same as the API render
 * route). ?lang=ar|en · ?templateId= · ?noprint=1 (QA) · ?embed=1 (pane).
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Loader2, Printer, X } from "lucide-react";
import { api, Quote, bootstrapOrgIdFromStorage } from "../lib/api";


import { waitForPrintReady } from "../lib/print-image";

export function QuoteProposalPrint() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const langOverride = searchParams.get("lang");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [presentation, setPresentation] = useState<QuotePresentation | null>(null);

  const [error, setError] = useState<string | null>(null);
  const noPrint = searchParams.get("noprint") === "1";
  const embed = searchParams.get("embed") === "1";
  const templateParam = searchParams.get("templateId");
  const requestedOrg = searchParams.get("orgId");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Pin both reads to the document company: auth refresh may select a
        // different tab company while the first request is in flight.
        let documentOrg = requestedOrg || bootstrapOrgIdFromStorage() || undefined;
        let q: Quote | null = null;
        try {
          q = await api.quotes.get(id, documentOrg);
        } catch (error) {
          if (requestedOrg) throw error;
          const meRes = await fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/me`, { credentials: "include" });
          const me = meRes.ok ? await meRes.json() : null;
          for (const m of me?.memberships || []) {
            if (!m?.org?.id) continue;
            try {
              q = await api.quotes.get(id, m.org.id);
              if (q) { documentOrg = m.org.id; break; }
            } catch { /* try next */ }
          }
        }
        if (!q) throw new Error("not_found");
        setQuote(q);
        setPresentation(await loadQuotePresentation(q.id, { orgId: q.orgId || documentOrg, templateId: templateParam, lang: langOverride === "ar" || langOverride === "en" ? langOverride : undefined }));
      } catch {
        setError("العرض غير متاح — تأكد من تسجيل الدخول");
      }
    })();
  }, [id, langOverride, templateParam, requestedOrg]);

  const lang = presentation?.lang || "ar";
  useEffect(() => { if (presentation) document.title = presentation.title; }, [presentation]);

  // Auto-print once the sheets are on screen (fonts + images settled)
  useEffect(() => {
    if (!presentation || noPrint || embed) return;
    let cancelled = false;
    waitForPrintReady().then(() => { if (!cancelled) window.print(); });
    return () => { cancelled = true; };
  }, [presentation, noPrint, embed]);

  if (error) return <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>{error}</div>;
  if (!quote || !presentation) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#5875DB" }} /></div>;

  return (
    <div style={{ background: embed ? "#fff" : "#E9ECF1", minHeight: "100vh" }}>
      <style>{`
        @media print { .no-print { display: none !important; } html, body { background: #fff !important; } }
      `}</style>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#1A1E48", color: "#fff", padding: "9px 16px", display: embed ? "none" : "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{quote.quoteNumber} · {quote.title || ""}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <select aria-label="Document language" value={lang} onChange={e => { const next = new URLSearchParams(searchParams); next.set('lang', e.target.value); next.set('noprint', '1'); setSearchParams(next); }} style={{ color: '#1A1E48', background: '#fff', borderRadius: 6, padding: 6 }}><option value="en">English</option><option value="ar">العربية</option></select>
          <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#5875DB", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, cursor: "pointer" }}>
            <Printer style={{ width: 14, height: 14 }} /> {lang === "ar" ? "طباعة / PDF" : "Print / PDF"}
          </button>
          <button onClick={() => window.close()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </span>
      </div>
      <div className="edoc-shell" data-document-ready={!!presentation} style={{ padding: embed ? 0 : "16px 0 32px" }}>
        <div style={{ maxWidth: 794, margin: "0 auto" }}><QuoteDocument presentation={presentation} /></div>
      </div>
    </div>
  );
}
