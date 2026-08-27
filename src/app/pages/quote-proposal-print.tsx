/**
 * Proposal print view (SPEC-04) · /print/proposal/:id — org-side branded PDF
 * via browser print. Same renderer as the public /q page (ProposalDoc).
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Loader2, Printer, X } from "lucide-react";
import { api, Quote, Org, bootstrapOrgIdFromStorage, setOrgId } from "../lib/api";
import { ProposalDoc } from "../components/proposal-doc";

export function QuoteProposalPrint() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const langOverride = searchParams.get("lang");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            setOrgId(m.org.id);
            try { q = await api.quotes.get(id); if (q) break; } catch { /* try next */ }
          }
        }
        if (!q) throw new Error("not_found");
        setQuote(q);
        try { setOrg(await api.orgs.get(q.orgId)); } catch { /* header degrades gracefully */ }
        setTimeout(() => window.print(), 600);
      } catch {
        setError("العرض غير متاح — تأكد من تسجيل الدخول");
      }
    })();
  }, [id]);

  if (error) return <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>{error}</div>;
  if (!quote) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#1276E3" }} /></div>;

  const lang: "ar" | "en" = langOverride === "en" ? "en" : "ar";

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        .num { font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: embed; }
        @media print { .no-print { display: none !important; } @page { size: A4; margin: 12mm; } }
      `}</style>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#0B1B49", color: "#fff", padding: "9px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{quote.quoteNumber} · {quote.title || ""}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1276E3", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, cursor: "pointer" }}>
            <Printer style={{ width: 14, height: 14 }} /> طباعة / PDF
          </button>
          <button onClick={() => window.close()} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </span>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "22px 20px" }}>
        <ProposalDoc quote={quote} org={org ? { name: org.name, logoUrl: (org as any).printLogoUrl || org.logoUrl, legalName: org.legalName, vatNumber: org.vatNumber, crNumber: org.crNumber } : null} lang={lang} />
        {/* Acceptance block (print) */}
        <div style={{ marginTop: 22, border: "1px solid #D6E4EE", borderRadius: 10, padding: "12px 16px", breakInside: "avoid-page" }} dir={lang === "ar" ? "rtl" : "ltr"}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0B1B49", marginBottom: 10 }}>{lang === "ar" ? "إقرار القبول" : "Acceptance"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, fontSize: 11.5, color: "#4A5A6E" }}>
            <div>{lang === "ar" ? "الاسم:" : "Name:"} ______________________</div>
            <div>{lang === "ar" ? "التوقيع:" : "Signature:"} ______________________</div>
            <div>{lang === "ar" ? "التاريخ:" : "Date:"} ______________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
