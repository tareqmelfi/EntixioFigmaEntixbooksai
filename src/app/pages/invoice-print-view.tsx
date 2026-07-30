/**
 * Invoice print view · Wafeq-style branded template (UX-180)
 * Standalone route: /print/invoice/:id
 *
 * - No app chrome (sidebar/header hidden)
 * - Auto-trigger window.print()
 * - ZATCA QR code (when zatcaEnabled)
 * - Multi-page support for long terms
 * - E-signature display (when present)
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { api, ApiError, Invoice, Org, Contact } from "../lib/api";
import { Loader2, Printer, X } from "lucide-react";
import qrcode from "qrcode-generator";

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
        const inv = await api.invoices.get(id);
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
          const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
          const active = (stored ? orgs.find((o) => o.id === stored) : null) || orgs[0];
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
  useEffect(() => {
    if (!loading && invoice && org && !noPrint) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [loading, invoice, org]);

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
        color: "#0B1B49",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
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
          <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: 0, marginBottom: 18 }}>
            ENTIX<span style={{ color: "#1276E3" }}>.IO</span>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>{title}</h1>
          <p style={{ margin: "0 0 22px", color: "#607089", lineHeight: 1.6 }}>{message}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #D8E1EE", background: "white", color: "#0B1B49", fontWeight: 700, cursor: "pointer" }}
            >
              Go back
            </button>
            <a
              href="/login"
              style={{ padding: "10px 16px", borderRadius: 8, background: "#1276E3", color: "white", textDecoration: "none", fontWeight: 800 }}
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
  const isKsa = lang === "ar"; // keep variable name for minimum-diff
  const branding = (org as any).paymentSettings?.branding || {};
  const primary = branding.primaryColor || "#1276E3";
  const accent = branding.accentColor || "#0B1B49";

  const total = safeNum(invoice.total);
  const subtotal = safeNum(invoice.subtotal);
  const tax = safeNum((invoice as any).taxTotal ?? (invoice as any).taxAmount);
  const paid = safeNum(invoice.amountPaid);
  const due = total - paid;
  const currency = invoice.currency || "SAR";
  const lines = (invoice.lines || []) as any[];

  const orgAddress = [
    (org as any).buildingNumber, (org as any).streetName, (org as any).district,
    (org as any).city, (org as any).region, (org as any).postalCode,
  ].filter(Boolean).join(" · ");

  const contactAddress = contact ? [
    (contact as any).addressLine1, contact.city, contact.country,
  ].filter(Boolean).join(" · ") : "";

  // Print logo > avatar logo · so business has a clean PDF logo
  const printLogo = (org as any).printLogoUrl || (org as any).logoUrl;
  const stampUrl = (org as any).stampUrl;
  // Show QR for all countries (not just KSA · UX-186)
  const showQr = true;

  // Real ZATCA Phase-1 QR · TLV tags 1-5 (seller · VAT no · timestamp · total · VAT) → base64 → QR
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
  const qrPayload = sellerVat
    ? tlvBase64([[1, sellerName], [2, sellerVat], [3, issuedAt], [4, total.toFixed(2)], [5, vatAmount.toFixed(2)]])
    : null;
  const qrSvg = showQr && qrPayload ? (() => {
    const qr = qrcode(0, "M");
    qr.addData(qrPayload);
    qr.make();
    return (
      <div
        style={{ width: 100, height: 100 }}
        dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true }) }}
      />
    );
  })() : null;

  return (
    <>
      <style>{`
        /* Reset · standalone route · no app chrome */
        body { margin: 0; background: #F4F5F7; font-family: ${branding.fontFamily ? `'${branding.fontFamily}', ` : ''}'Tajawal','Noto Sans Arabic',system-ui,sans-serif; }
        .num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; direction: ltr; display: inline-block; }
        .print-wrap-any { overflow-wrap: anywhere; word-break: break-word; }
        .print-table th, .print-table td { white-space: normal !important; vertical-align: top; }
        .totals-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
        .totals-media { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
        .totals-card { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; min-width: 280px; width: min(100%, 360px); flex: 1 1 320px; }
        @media (max-width: 900px) {
          .totals-card { min-width: 0; width: 100%; }
        }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          /* PR6 · root cause of the clipped total column: a hard 210mm body
             overflows any printable area once margins apply, and RTL overflow
             clips on the LEFT. Fluid width = always fits, descriptions wrap. */
          html, body { width: auto !important; max-width: 100% !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; padding: 0 0 8mm !important; width: auto !important; max-width: 100% !important; box-sizing: border-box !important; page-break-after: always; }
          .invoice-page:last-child { page-break-after: auto; }
        }
        @page { size: A4; margin: 10mm 12mm 12mm; }
        ${embed ? ".invoice-page{ margin: 8px auto !important; zoom: 0.78; box-shadow: none !important; } body{ background: white; }" : ""}
      `}</style>

      <div dir={isKsa ? "rtl" : "ltr"} style={{ color: accent, fontSize: 13, lineHeight: 1.5 }}>
        {/* Action bar (no-print) */}
        <div className="no-print" style={{ position: "fixed", top: 12, left: 12, zIndex: 99, display: embed ? "none" : "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: primary, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            <Printer style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} /> طباعة / حفظ PDF
          </button>
          <button onClick={() => window.close()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            <X style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} /> إغلاق
          </button>
        </div>

        <div className="invoice-page" style={{ maxWidth: "210mm", margin: "20px auto", background: "white", padding: "10mm 14mm 14mm", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {/* Header · logo + Tax Invoice title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px 0", color: primary }}>{isKsa ? "فاتورة ضريبية" : "Invoice"}</h1>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{isKsa ? "Tax Invoice" : "Sales Invoice"}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "#F4FCFF", color: primary, border: `1px solid ${primary}33` }}>
                  {String(invoice.status || "DRAFT").toUpperCase()}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              {/* Logo in the corner · company name (AR bold colored + EN) starts beside it */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "start", paddingTop: 2 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: primary, lineHeight: 1.35 }}>{org.name}</div>
                  {org.legalName && org.legalName !== org.name && (
                    <div style={{ fontWeight: 700, fontSize: 12, color: primary, direction: "ltr", textAlign: "right" }}>{org.legalName}</div>
                  )}
                  {/* Company details stacked directly under the name · Arabic lines RTL-aligned · Latin lines LTR */}
                  <div style={{ marginTop: 4 }}>
                    {orgAddress && <div style={{ color: "#6B7280", fontSize: 10 }}>{orgAddress}</div>}
                    {org.vatNumber && <div style={{ color: "#6B7280", fontSize: 10 }}>{isKsa ? "الرقم الضريبي" : "VAT No."}: <span className="num">{org.vatNumber}</span></div>}
                    {org.crNumber && <div style={{ color: "#6B7280", fontSize: 10 }}>{isKsa ? "السجل التجاري" : "C.R."}: <span className="num">{org.crNumber}</span></div>}
                  </div>
                </div>
                {printLogo ? (
                  <img
                    src={printLogo}
                    alt={org.name}
                    style={{ maxHeight: 110, maxWidth: 220, objectFit: "contain", display: "block", borderRadius: 12 }}
                  />
                ) : (
                  <div style={{ fontWeight: 800, fontSize: 24, color: primary }}>{org.name}</div>
                )}
              </div>
            </div>
          </div>

          {/* Bill-to + invoice details · compact (no box · saves vertical space) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 8, paddingBottom: 10, borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <h2 style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0" }}>{isKsa ? "عميل · Bill To" : "Bill To"}</h2>
              <strong className="print-wrap-any" style={{ display: "block", color: accent, marginBottom: 2, fontSize: 11.5, lineHeight: 1.4 }}>{contact?.displayName || contact?.legalName || "—"}</strong>

              {contact?.legalName && contact?.legalName !== contact?.displayName && (<div className="print-wrap-any" style={{ color: "#6B7280", fontSize: 9.5 }}>{contact.legalName}</div>)}
              {contactAddress && <div className="print-wrap-any" style={{ color: "#6B7280", fontSize: 9.5 }}>{contactAddress}</div>}
              {contact?.email && <div className="print-wrap-any" style={{ color: "#6B7280", fontSize: 9.5 }}>{contact.email}</div>}
              {contact?.phone && <div className="print-wrap-any" style={{ color: "#6B7280", fontSize: 9.5 }}><span className="num">{contact.phone}</span></div>}
              {((contact as any)?.vatNumber || (contact as any)?.taxId) && <div className="print-wrap-any" style={{ color: "#374151", fontSize: 10, fontWeight: 600 }}>{isKsa ? "الرقم الضريبي" : "VAT No."}: <span className="num">{(contact as any).vatNumber || (contact as any).taxId}</span></div>}
            </div>
            <div>
              <h2 style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0" }}>{isKsa ? "تفاصيل الفاتورة" : "Invoice Details"}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: 11 }}>
                <span style={{ color: "#6B7280" }}>{isKsa ? "رقم الفاتورة" : "Invoice #"}</span><span className="num print-wrap-any" style={{ textAlign: "end", color: accent, fontWeight: 600 }}>{invoice.invoiceNumber}</span>
                <span style={{ color: "#6B7280" }}>{isKsa ? "تاريخ الإصدار" : "Issue Date"}</span><span className="num print-wrap-any" style={{ textAlign: "end" }}>{String(invoice.issueDate).slice(0, 10)}</span>
                {invoice.dueDate && <><span style={{ color: "#6B7280" }}>{isKsa ? "تاريخ الاستحقاق" : "Due Date"}</span><span className="num print-wrap-any" style={{ textAlign: "end" }}>{String(invoice.dueDate).slice(0, 10)}</span></>}
                {(() => { const ref = (invoice as any).reference || (String((invoice as any).termsConditions || "").match(/^Ref:\s*(.+)/)?.[1] ?? null); return ref ? <><span style={{ color: "#6B7280" }}>{isKsa ? "المرجع" : "Reference"}</span><span className="num print-wrap-any" style={{ textAlign: "end" }}>{ref}</span></> : null; })()}
                {(contact as any)?.customCode && <><span style={{ color: "#6B7280" }}>{isKsa ? "رمز العميل" : "Customer Code"}</span><span className="num print-wrap-any" style={{ textAlign: "end", color: primary, fontWeight: 600 }}>{(contact as any).customCode}</span></>}
              </div>
            </div>
          </div>

          {/* Lines table */}
          <table className="print-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: 24, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "40%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                {["#", isKsa ? "الوصف · Description" : "Description", isKsa ? "الكمية" : "Qty", isKsa ? "السعر" : "Price", isKsa ? "الخاضع للضريبة" : "Taxable", isKsa ? "الضريبة 15%" : "VAT", isKsa ? "الإجمالي" : "Amount"].map((h, i) => (
                  <th key={i} style={{ background: accent, color: "white", padding: "6px 8px", fontSize: 10, fontWeight: 600, textAlign: i >= 2 ? "end" : "start" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any, i: number) => {
                const q = safeNum(l.quantity);
                const p = safeNum(l.unitPrice);
                // line.subtotal is stored tax-inclusive · l.taxRate may be a relation object {rate} or numeric
                const lineTotal = safeNum(l.subtotal) || safeNum(l.total) || (q * p);
                const base = q * p - safeNum(l.discount);
                // First description line = product name (bold) · remaining lines = details
                const descLines = String(l.description || "").split("\n");
                const descHead = descLines[0];
                const descRest = descLines.slice(1).join("\n");
                const cell = { padding: "5px 10px", borderBottom: "1px solid #F3F4F6", fontSize: 11 } as const;
                return (
                  <tr key={i}>
                    <td style={{ ...cell, textAlign: "end", fontFamily: "monospace" }}>{i + 1}</td>
                    <td style={cell}>
                      <div className="print-wrap-any" style={{ fontWeight: 700 }}>{descHead}</div>
                      {descRest && <div className="print-wrap-any" style={{ whiteSpace: "pre-wrap", color: "#6B7280", fontSize: 10, lineHeight: 1.45 }}>{descRest}</div>}
                    </td>
                    <td style={{ ...cell, textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{q.toLocaleString()}</td>
                    <td style={{ ...cell, textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{p.toFixed(2)}</td>
                    <td style={{ ...cell, textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{base.toFixed(2)}</td>
                    <td style={{ ...cell, textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{Math.max(lineTotal - base, 0).toFixed(2)}</td>
                    <td style={{ ...cell, textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals + QR + Stamp · all in one row */}
          <div className="totals-section" style={{ marginTop: 16 }}>
            {/* QR + Stamp · side-by-side on the END side (left in RTL) */}
            <div className="totals-media">
              {qrSvg && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {qrSvg}
                  <div style={{ fontSize: 9, color: "#9CA3AF" }}>{isKsa ? "QR للتحقق" : "Verify QR"}</div>
                </div>
              )}
              {stampUrl && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    transform: "rotate(-6deg)",
                    padding: 4,
                    background: "transparent",
                  }}>
                    <img src={stampUrl} alt={isKsa ? "ختم" : "Seal"} style={{
                      maxHeight: 180, maxWidth: 180,
                      objectFit: "contain",
                      opacity: 0.85,
                      mixBlendMode: "multiply",
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#9CA3AF" }}>{isKsa ? "ختم الشركة" : "Company Seal"}</div>
                </div>
              )}
            </div>
            <div className="totals-card">
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>
                <span>{isKsa ? "المجموع الفرعي · Subtotal" : "Subtotal"}</span><span className="num">{subtotal.toFixed(2)} {currency}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>
                <span>{isKsa ? "VAT (15%)" : "Sales Tax"}</span><span className="num">{tax.toFixed(2)} {currency}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", fontSize: 15, fontWeight: 700, background: accent, color: "white" }}>
                <span>{isKsa ? "الإجمالي · Total" : "Total"}</span><span className="num">{total.toFixed(2)} {currency}</span>
              </div>
              {paid > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>
                    <span>{isKsa ? "المدفوع" : "Paid"}</span><span className="num">{paid.toFixed(2)} {currency}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, background: "#FEF3C7", fontWeight: 700 }}>
                    <span>{isKsa ? "المستحق" : "Balance Due"}</span><span className="num">{due.toFixed(2)} {currency}</span>
                  </div>
                </>
              )}
            </div>
          </div>


          {/* Multi-currency note · if invoice currency differs from org base */}
          {currency !== org.baseCurrency && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#EFF6FF", borderRadius: 6, fontSize: 11, color: "#1E40AF", textAlign: "end" }}>
              💱 <strong>{isKsa ? "ملاحظة العملة" : "Currency Note"}:</strong>{" "}
              {isKsa
                ? `الفاتورة بعملة ${currency} · العملة الأساسية للشركة ${org.baseCurrency}`
                : `Invoice in ${currency} · Company base currency: ${org.baseCurrency}`}
            </div>
          )}

          {invoice.notes && (
            <div className="print-wrap-any" style={{ marginTop: 24, padding: "12px 14px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12, color: "#374151" }}>
              <strong>{isKsa ? "ملاحظات:" : "Notes:"}</strong> {invoice.notes}
            </div>
          )}

          {/* Terms & Conditions · inline (flows naturally · breaks to next page only when content overflows) */}
          {(() => {
            const raw = String((invoice as any).termsConditions || "").trim();
            const custom = raw && !/^Ref:\s*\S+$/.test(raw) ? raw : null;
            const defaultTerms = isKsa
              ? "1. تعتبر هذه الفاتورة مستنداً رسمياً صادراً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك للفوترة الإلكترونية.\n2. يستحق السداد وفق شروط الدفع الموضحة أعلاه، ولا تعتبر هذه الفاتورة سند قبض وإبراء ذمة إلا بعد سداد كامل المبلغ المستحق.\n3. يرجى إبلاغنا بأي ملاحظة على هذه الفاتورة خلال 7 أيام من تاريخ الإصدار، وبعدها تعتبر نهائية ومقبولة.\n4. تتم أي إرجاعات أو استبدالات وفق السياسة المتفق عليها وبالحالة الأصلية للأصناف."
              : "1. This invoice is an official document issued per ZATCA e-invoicing requirements.\n2. Payment is due per the terms stated above; this invoice is not a receipt until fully settled.\n3. Any objection must be raised within 7 days of the issue date, after which the invoice is final.\n4. Returns and exchanges follow the agreed policy and require items in original condition.";
            const terms = custom || defaultTerms;
            return (
              <div style={{ marginTop: 18 }}>
                <h2 style={{ fontSize: 11.5, fontWeight: 700, color: primary, margin: "0 0 5px" }}>{isKsa ? "الشروط والأحكام · Terms & Conditions" : "Terms & Conditions"}</h2>
                <div style={{ fontSize: 9, color: "#6B7280", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{terms}</div>
                {/* Signatures removed from default template · available on demand via the توقيع action (DocuSeal · sign.ensidex.com) */}
              </div>
            );
          })()}

          {/* Footer · thank-you only · stamp moved next to totals */}
          <div style={{ marginTop: 20, paddingTop: 10, borderTop: `2px solid ${primary}`, color: "#6B7280", fontSize: 10.5, textAlign: "center" }}>
            {/* Contact channels · moved from header to footer */}
            {((org as any).phone || (org as any).email || (org as any).website) && (
              <div style={{ marginBottom: 3, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                {(org as any).phone && <span className="num">{(org as any).phone}</span>}
                  {(org as any).email && <span className="print-wrap-any" style={{ direction: "ltr", display: "inline-block" }}>{(org as any).email}</span>}
                  {(org as any).website && <span className="print-wrap-any" style={{ direction: "ltr", display: "inline-block" }}>{(org as any).website}</span>}
              </div>
            )}
            <div>{isKsa ? "شكراً لتعاملكم معنا · Thank you for your business" : "Thank you for your business"}</div>
          </div>
        </div>
      </div>
    </>
  );
}
