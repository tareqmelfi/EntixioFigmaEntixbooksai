/**
 * Proposal print view (SPEC-04) · /print/proposal/:id — org-side branded PDF
 * via browser print.
 *
 * 2026-09-08 · renders from the org's brand document template (cover → inner
 * pages → terms & conditions page · fixed A4 sheets) through the shared
 * document engine (src/app/lib/document-render.ts · same as the API render
 * route). ?lang=ar|en · ?templateId= · ?noprint=1 (QA) · ?embed=1 (pane).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Loader2, Printer, X } from "lucide-react";
import { api, Quote, Org, Contact, bootstrapOrgIdFromStorage, setOrgId } from "../lib/api";
import { BrandDocument, useBrandTemplate } from "../components/brand-document";
import { partyFromOrg, partyFromContact, docFromQuote, type RenderInput } from "../lib/document-render";
import { waitForPrintReady } from "../lib/print-image";

export function QuoteProposalPrint() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const langOverride = searchParams.get("lang");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noPrint = searchParams.get("noprint") === "1";
  const embed = searchParams.get("embed") === "1";
  const templateParam = searchParams.get("templateId");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        bootstrapOrgIdFromStorage();
        let q: Quote | null = null;
        try {
          q = await api.quotes.get(id);
        } catch {
          const meRes = await fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/me`, { credentials: "include" });
          const me = meRes.ok ? await meRes.json() : null;
          for (const m of me?.memberships || []) {
            if (!m?.org?.id) continue;
            // Preview frames share storage with the parent tab; lookup is temporary.
            setOrgId(m.org.id, false);
            try { q = await api.quotes.get(id); if (q) break; } catch { /* try next */ }
          }
        }
        if (!q) throw new Error("not_found");
        setQuote(q);
        try { setOrg(await api.orgs.get(q.orgId)); } catch { /* header degrades gracefully */ }
        if (q.contactId) { try { setContact(await api.contacts.get(q.contactId)); } catch { /* client block degrades */ } }
      } catch {
        setError("العرض غير متاح — تأكد من تسجيل الدخول");
      }
    })();
  }, [id]);

  const lang: "ar" | "en" = langOverride === "en" ? "en" : "ar";
  // Template: ?templateId= → quote.templateId → org default for QUOTE (BOTH counts)
  const { template, bank, ready } = useBrandTemplate("QUOTE", templateParam || quote?.templateId || null, !!quote);

  const input = useMemo<RenderInput | null>(() => {
    if (!quote || !ready) return null;
    return {
      lang,
      template,
      org: partyFromOrg(org),
      contact: partyFromContact(contact) || (quote.contact ? { name: quote.contact.displayName, email: quote.contact.email } : null),
      doc: docFromQuote(quote),
      bank,
      fontBase: "/fonts",
      embed: true,
    };
  }, [quote, ready, template, bank, org, contact, lang]);

  // PDF filename = document.title
  useEffect(() => { if (quote) document.title = `${quote.quoteNumber}${contact?.displayName ? " · " + contact.displayName : ""}`; }, [quote, contact]);

  // Auto-print once the sheets are on screen (fonts + images settled)
  useEffect(() => {
    if (!input || noPrint || embed) return;
    let cancelled = false;
    waitForPrintReady().then(() => { if (!cancelled) window.print(); });
    return () => { cancelled = true; };
  }, [input, noPrint, embed]);

  if (error) return <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>{error}</div>;
  if (!quote || !input) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#5875DB" }} /></div>;

  return (
    <div style={{ background: embed ? "#fff" : "#E9ECF1", minHeight: "100vh" }}>
      <style>{`
        @media print { .no-print { display: none !important; } html, body { background: #fff !important; } }
      `}</style>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#1A1E48", color: "#fff", padding: "9px 16px", display: embed ? "none" : "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{quote.quoteNumber} · {quote.title || ""}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#5875DB", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, cursor: "pointer" }}>
            <Printer style={{ width: 14, height: 14 }} /> طباعة / PDF
          </button>
          <button onClick={() => window.close()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </span>
      </div>
      <div className="edoc-shell" style={{ padding: embed ? 0 : "16px 0 32px" }}>
        <BrandDocument input={input} scaleToFit={embed} />
      </div>
    </div>
  );
}
