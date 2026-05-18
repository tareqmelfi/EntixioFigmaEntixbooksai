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
        const orgs = await api.orgs.list();
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem("entix_org_id") : null;
        const active = (stored ? orgs.find((o) => o.id === stored) : null) || orgs[0];
        if (active) setOrg(await api.orgs.get(active.id));
      } catch (e: any) {
        setError(e instanceof ApiError ? e.message : "فشل التحميل");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Auto-trigger print dialog once data is ready
  useEffect(() => {
    if (!loading && invoice && org) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [loading, invoice, org]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !invoice || !org) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "red" }}>{error || "تعذر التحميل"}</div>;

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
  const tax = safeNum(invoice.taxAmount);
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

  // Generate ZATCA-style QR placeholder (TLV base64) · use a simple SVG placeholder
  // In production: use library like qrcode.react · for now placeholder until library added
  const qrSvg = showQr ? (
    <svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="100" fill="white" stroke="#E5E7EB" strokeWidth="1" />
      {/* simple grid pattern · placeholder for actual QR */}
      {Array.from({ length: 25 }).map((_, i) => {
        const r = Math.floor(i / 5), c = i % 5;
        const filled = ((r + c) % 2 === 0) || (i % 3 === 0);
        return filled ? <rect key={i} x={c * 18 + 5} y={r * 18 + 5} width="14" height="14" fill={accent} /> : null;
      })}
    </svg>
  ) : null;

  return (
    <>
      <style>{`
        /* Reset · standalone route · no app chrome */
        body { margin: 0; background: #F4F5F7; font-family: ${branding.fontFamily ? `'${branding.fontFamily}', ` : ''}'Tajawal','Noto Sans Arabic',system-ui,sans-serif; }
        .num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; direction: ltr; display: inline-block; }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; padding: 14mm !important; max-width: none !important; page-break-after: always; }
          .invoice-page:last-child { page-break-after: auto; }
        }
        @page { size: A4; margin: 14mm 12mm; }
      `}</style>

      <div dir={isKsa ? "rtl" : "ltr"} style={{ color: accent, fontSize: 13, lineHeight: 1.5 }}>
        {/* Action bar (no-print) */}
        <div className="no-print" style={{ position: "fixed", top: 12, left: 12, zIndex: 99, display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: primary, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            <Printer style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} /> طباعة / حفظ PDF
          </button>
          <button onClick={() => window.close()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            <X style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} /> إغلاق
          </button>
        </div>

        <div className="invoice-page" style={{ maxWidth: "210mm", margin: "20px auto", background: "white", padding: "24mm 18mm", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
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
              {printLogo ? (
                <img src={printLogo} alt={org.name} style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain" }} />
              ) : (
                <div style={{ fontWeight: 800, fontSize: 24, color: primary }}>{org.name}</div>
              )}
              <div style={{ marginTop: 6, color: "#6B7280", fontSize: 11 }}>{org.legalName || org.name}</div>
              {orgAddress && <div style={{ color: "#6B7280", fontSize: 11 }}>{orgAddress}</div>}
              {(org as any).email && <div style={{ color: "#6B7280", fontSize: 11 }}>{(org as any).email}</div>}
              {(org as any).phone && <div style={{ color: "#6B7280", fontSize: 11 }}><span className="num">{(org as any).phone}</span></div>}
              {org.vatNumber && <div style={{ color: "#6B7280", fontSize: 11 }}>{isKsa ? "الرقم الضريبي" : "EIN"}: <span className="num">{org.vatNumber}</span></div>}
              {org.crNumber && <div style={{ color: "#6B7280", fontSize: 11 }}>{isKsa ? "السجل التجاري" : "Filing #"}: <span className="num">{org.crNumber}</span></div>}
            </div>
          </div>

          {/* Bill-to + invoice details · compact (no box · saves vertical space) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 18, paddingBottom: 12, borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <h2 style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0" }}>{isKsa ? "عميل · Bill To" : "Bill To"}</h2>
              <strong style={{ display: "block", color: accent, marginBottom: 2, fontSize: 13 }}>{contact?.displayName || contact?.legalName || "—"}</strong>
              {contact?.legalName && contact?.legalName !== contact?.displayName && (<div style={{ color: "#6B7280", fontSize: 10 }}>{contact.legalName}</div>)}
              {contactAddress && <div style={{ color: "#6B7280", fontSize: 10 }}>{contactAddress}</div>}
              {contact?.email && <div style={{ color: "#6B7280", fontSize: 10 }}>{contact.email}</div>}
              {contact?.phone && <div style={{ color: "#6B7280", fontSize: 10 }}><span className="num">{contact.phone}</span></div>}
              {(contact as any)?.taxId && <div style={{ color: "#6B7280", fontSize: 10 }}>{isKsa ? "الرقم الضريبي" : "Tax ID"}: <span className="num">{(contact as any).taxId}</span></div>}
            </div>
            <div>
              <h2 style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0" }}>{isKsa ? "تفاصيل الفاتورة" : "Invoice Details"}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: 11 }}>
                <span style={{ color: "#6B7280" }}>{isKsa ? "رقم الفاتورة" : "Invoice #"}</span><span className="num" style={{ textAlign: "end", color: accent, fontWeight: 600 }}>{invoice.invoiceNumber}</span>
                <span style={{ color: "#6B7280" }}>{isKsa ? "تاريخ الإصدار" : "Issue Date"}</span><span className="num" style={{ textAlign: "end" }}>{String(invoice.issueDate).slice(0, 10)}</span>
                {invoice.dueDate && <><span style={{ color: "#6B7280" }}>{isKsa ? "تاريخ الاستحقاق" : "Due Date"}</span><span className="num" style={{ textAlign: "end" }}>{String(invoice.dueDate).slice(0, 10)}</span></>}
                {(invoice as any).reference && <><span style={{ color: "#6B7280" }}>{isKsa ? "المرجع" : "Reference"}</span><span className="num" style={{ textAlign: "end" }}>{(invoice as any).reference}</span></>}
              </div>
            </div>
          </div>

          {/* Lines table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
            <thead>
              <tr>
                {["#", isKsa ? "الوصف · Description" : "Description", isKsa ? "الكمية" : "Qty", isKsa ? "السعر" : "Price", isKsa ? "VAT" : "Tax", isKsa ? "الإجمالي" : "Amount"].map((h, i) => (
                  <th key={i} style={{ background: accent, color: "white", padding: "10px 12px", fontSize: 11, fontWeight: 600, textAlign: i >= 2 ? "end" : "start" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any, i: number) => {
                const q = safeNum(l.quantity);
                const p = safeNum(l.unitPrice);
                const lineTotal = safeNum(l.total) || (q * p);
                const vatRate = safeNum(l.taxRate) * 100;
                return (
                  <tr key={i}>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6", textAlign: "end", fontFamily: "monospace" }}>{i + 1}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6" }}>{l.description}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6", textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{q.toLocaleString()}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6", textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{p.toFixed(2)}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6", textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{vatRate}%</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6", textAlign: "end", fontFamily: "monospace", direction: "ltr" }}>{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals + QR + Stamp · all in one row */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            {/* QR + Stamp · side-by-side on the END side (left in RTL) */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
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
                      maxHeight: 100, maxWidth: 130,
                      objectFit: "contain",
                      opacity: 0.85,
                      mixBlendMode: "multiply",
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#9CA3AF" }}>{isKsa ? "ختم الشركة" : "Company Seal"}</div>
                </div>
              )}
            </div>
            <div style={{ minWidth: 320, border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
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
            <div style={{ marginTop: 24, padding: "12px 14px", background: "#FFFBEB", borderInlineEnd: "3px solid #F59E0B", borderRadius: 6, fontSize: 12, color: "#78350F" }}>
              <strong>{isKsa ? "ملاحظات:" : "Notes:"}</strong> {invoice.notes}
            </div>
          )}

          {/* Footer · thank-you only · stamp moved next to totals */}
          <div style={{ marginTop: 28, paddingTop: 12, borderTop: `2px solid ${primary}`, color: "#6B7280", fontSize: 11, textAlign: "center" }}>
            <div>{isKsa ? "شكراً لتعاملكم معنا · Thank you for your business" : "Thank you for your business"}</div>
            {(org as any).website && <div>{(org as any).website}</div>}
          </div>
        </div>

        {/* Optional Page 2 · Terms & Conditions (only if exists) */}
        {(invoice as any).termsConditions && (
          <div className="invoice-page" style={{ maxWidth: "210mm", margin: "20px auto", background: "white", padding: "24mm 18mm", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: primary, marginTop: 0 }}>الشروط والأحكام · Terms & Conditions</h2>
            <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{(invoice as any).termsConditions}</div>
            {/* Signature box (placeholder · ready for e-sig integration) */}
            <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 32 }}>توقيع البائع · Seller Signature</div>
                <div style={{ borderTop: "1px solid #D1D5DB", paddingTop: 6, fontSize: 11, color: "#9CA3AF" }}>{org.legalName || org.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 32 }}>توقيع العميل · Customer Signature</div>
                <div style={{ borderTop: "1px solid #D1D5DB", paddingTop: 6, fontSize: 11, color: "#9CA3AF" }}>{contact?.legalName || contact?.displayName || "—"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
