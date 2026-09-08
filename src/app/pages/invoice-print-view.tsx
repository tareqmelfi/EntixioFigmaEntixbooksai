import { EntixWordmark } from "../components/entix-brand";
import { getOrgId } from "../lib/api";
/**
 * Invoice print view · brand document template (UX-180 → 2026-09-08 redesign)
 * Standalone route: /print/invoice/:id
 *
 * - No app chrome (sidebar/header hidden)
 * - Auto-trigger window.print()
 * - ZATCA QR code (stored Phase-2 payload · else local TLV when a VAT number exists)
 * - Fixed A4 sheets from the org's brand template: cover → inner pages → terms page
 *   (shared engine src/app/lib/document-render.ts · same as the API render route)
 * - ?lang=ar|en · ?templateId= · ?noprint=1 · ?embed=1 (editor preview pane)
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { api, ApiError, Invoice, Org, Contact, bootstrapOrgIdFromStorage, setOrgId } from "../lib/api";
import { Loader2 } from "lucide-react";
import { downscaleDataUrl, waitForPrintReady } from "../lib/print-image";
import { BrandDocument, useBrandTemplate } from "../components/brand-document";
import { partyFromOrg, partyFromContact, docFromInvoice, type RenderInput } from "../lib/document-render";

function safeNum(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function InvoicePrintView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const langOverride = searchParams.get("lang"); // "ar" | "en" | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [org, setOrg] = useState<Org | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // This is a standalone route (outside AuthGuard — often inside the
        // editor's preview iframe with a fresh JS context where orgId is null).
        // Adopt the stored org id first, otherwise every call 400s with
        // "missing X-Org-Id header" and the pane shows "Invoice unavailable".
        bootstrapOrgIdFromStorage();
        let inv: Invoice | null = null;
        try {
          inv = await api.invoices.get(id);
        } catch {
          // The stored org may not be the invoice's org (e.g. shared print
          // link opened while another org is active). The server enforces
          // membership on every attempt, so walking the user's own
          // memberships is safe — non-member orgs just 403.
          const meRes = await fetch(`${import.meta.env.VITE_API_URL || "https://api.entix.io"}/me`, { credentials: "include" });
          const me = meRes.ok ? await meRes.json() : null;
          for (const m of me?.memberships || []) {
            if (!m?.org?.id) continue;
            setOrgId(m.org.id);
            try { inv = await api.invoices.get(id); if (inv) break; } catch { /* try next */ }
          }
        }
        if (!inv) throw new Error("not_found");
        if (inv.zatcaDelivery?.customerReleaseReady === false) throw new ApiError(409, "انتظر قبول الهيئة لهذه الفاتورة قبل تنزيلها أو إرسالها للمشتري. / Await authority confirmation before sharing this invoice.");
        setInvoice(inv);
        if (inv.contactId) {
          const c = await api.contacts.get(inv.contactId).catch(() => null);
          setContact(c);
        }
        const invoiceOrgId = (inv as any).orgId as string | undefined;
        if (invoiceOrgId) {
          setOrg(await api.orgs.get(invoiceOrgId));
        } else {
          const orgs = await api.orgs.list();
          const stored = getOrgId();
          const active = (stored ? orgs.find((o) => o.id === stored) : null);
          if (active) setOrg(await api.orgs.get(active.id));
        }
      } catch (e: any) {
        setError(e instanceof ApiError ? e.message : "فشل التحميل");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // PDF filename = document.title → "EN-INV-xxx · Customer" instead of the app name
  useEffect(() => {
    if (invoice) {
      document.title = `${invoice.invoiceNumber}${contact?.displayName ? " · " + contact.displayName : ""}`;
    }
  }, [invoice, contact]);

  // Auto-trigger print dialog once data is ready · suppress with ?noprint=1 (QA / link sharing)
  const noPrint = searchParams.get("noprint") === "1";
  // embed=1 → clean inline mirror (used by the app's preview pane)
  const embed = searchParams.get("embed") === "1";

  // Downscale branding images for print — full-source data URLs stalled Chrome's
  // print preview ("Saving…" until tab switch).
  const [printImages, setPrintImages] = useState<{ logo: string; stamp: string } | null>(null);
  // Brand template: ?templateId= → invoice.templateId → org default for INVOICE (BOTH counts)
  const templateParam = searchParams.get("templateId");
  const { template: docTpl, bank, ready: tplReady } = useBrandTemplate("INVOICE", templateParam || invoice?.templateId || null, !!invoice);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    (async () => {
      const logoSrc = (org as any).printLogoUrl || (org as any).logoUrl || "";
      const stampSrc = (org as any).stampUrl || "";
      const [logo, stamp] = await Promise.all([
        logoSrc ? downscaleDataUrl(logoSrc) : Promise.resolve(""),
        stampSrc ? downscaleDataUrl(stampSrc) : Promise.resolve(""),
      ]);
      if (!cancelled) setPrintImages({ logo, stamp });
    })();
    return () => { cancelled = true; };
  }, [org]);

  useEffect(() => {
    if (!loading && invoice && org && printImages && tplReady && !noPrint && !embed) {
      let cancelled = false;
      waitForPrintReady().then(() => { if (!cancelled) window.print(); });
      return () => { cancelled = true; };
    }
  }, [loading, invoice, org, printImages, tplReady]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !invoice || !org) {
    const isUnauthorized = String(error || "").toLowerCase().includes("unauthorized");
    const title = isUnauthorized ? "Sign in required" : "Invoice unavailable";
    const message = isUnauthorized
      ? "Please sign in to view or print this invoice."
      : "This invoice could not be loaded. It may have been moved, deleted, or you may not have access.";

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F4F7FB",
        color: "#1A1E48",
        // Arabic-first typography baseline for all invoice error/loading states.
        fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
        padding: 24,
      }}>
        <div style={{
          width: "min(440px, 100%)",
          background: "white",
          border: "1px solid #E5EAF2",
          borderRadius: 10,
          boxShadow: "0 12px 36px rgba(11,27,73,0.08)",
          padding: 28,
          textAlign: "center",
        }}>
          <div dir="ltr" lang="en" className="font-english" style={{ fontWeight: 900, fontSize: 24, letterSpacing: 0, marginBottom: 18 }}>
            <EntixWordmark size={24} />
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>{title}</h1>
          <p style={{ margin: "0 0 22px", color: "#607089", lineHeight: 1.6 }}>{message}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #D8E1EE", background: "white", color: "#1A1E48", fontWeight: 700, cursor: "pointer" }}
            >
              Go back
            </button>
            <a
              href="/login"
              target="_top"
              style={{ padding: "10px 16px", borderRadius: 8, background: "#5875DB", color: "white", textDecoration: "none", fontWeight: 800 }}
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Language: ?lang= override · else org.defaultInvoiceLanguage · else infer from country
  const orgDefaultLang = (org as any).defaultInvoiceLanguage as ("ar" | "en" | undefined);
  const inferredLang = (org.country || "SA") === "SA" ? "ar" : "en";
  const lang = (langOverride === "ar" || langOverride === "en") ? langOverride : (orgDefaultLang || inferredLang);

  const total = safeNum(invoice.total);

  // Print logo > avatar logo · so business has a clean PDF logo
  const printLogo = printImages?.logo || "";
  const stampUrl = printImages?.stamp || "";

  // Local TLV QR · tags 1-5 (seller · VAT no · timestamp · total · VAT) → base64 → QR
  const tlvBase64 = (fields: Array<[number, string]>): string => {
    const enc = new TextEncoder();
    const bytes: number[] = [];
    for (const [tag, value] of fields) {
      const v = enc.encode(value);
      bytes.push(tag, v.length, ...Array.from(v));
    }
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const sellerName = org.name || (org as any).legalName || ""; // Arabic registered name first (ZATCA TLV tag 1)
  const sellerVat = (org as any).vatNumber || "";
  const issuedAt = (() => { try { return new Date(invoice.issueDate as any).toISOString(); } catch { return new Date().toISOString(); } })();
  const vatAmount = safeNum((invoice as any).taxTotal);
  // Prefer any stored QR payload; otherwise generate a local TLV payload with core invoice data.
  // This local QR is not a ZATCA stamp and is not enabled for production reliance.
  // A tax-data QR requires a real VAT number — omit it when sellerVat is empty.
  const qrPayload = (invoice as any).zatcaQr
    || (sellerVat
      ? tlvBase64([[1, sellerName], [2, sellerVat], [3, issuedAt], [4, total.toFixed(2)], [5, vatAmount.toFixed(2)]])
      : null);

  const input: RenderInput = {
    lang,
    template: docTpl,
    org: { ...partyFromOrg(org), logoUrl: printLogo || null, stampUrl: stampUrl || null },
    contact: partyFromContact(contact),
    doc: docFromInvoice(invoice, qrPayload),
    bank,
    fontBase: "/fonts",
    actions: !embed,
    embed: true,
  };

  return (
    <>
      <style>{`
        /* Reset · standalone route · no app chrome */
        body { margin: 0; background: ${embed ? "#fff" : "#E9ECF1"}; }
        @media print { body { background: white !important; } .no-print { display: none !important; } }
      `}</style>
      <div className="edoc-shell" style={{ padding: embed ? 0 : "16px 0 32px" }}>
        <BrandDocument input={input} scaleToFit={embed} />
      </div>
    </>
  );
}
