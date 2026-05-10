/**
 * Invoice print view · Wafeq-style branded template (UX-171)
 * Route: /app/invoices/:id/print-view
 *
 * - Fetches invoice + org via authenticated API
 * - Renders Tax Invoice template
 * - Auto-triggers window.print() once mounted
 * - "Close" button to return
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api, ApiError, Invoice, Org, Contact } from "../lib/api";
import { Loader2, Printer, X } from "lucide-react";

export function InvoicePrintView() {
  const { id } = useParams<{ id: string }>();
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
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, invoice, org]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#1276E3]" /></div>;
  if (error || !invoice || !org) return <div className="min-h-screen flex items-center justify-center text-red-600">{error || "تعذر التحميل"}</div>;

  const isKsa = (org.country || "SA") === "SA";
  const branding = (org as any).paymentSettings?.branding || {};
  const primary = branding.primaryColor || "#1276E3";
  const accent = branding.accentColor || "#0B1B49";
  const total = Number(invoice.total);
  const subtotal = Number(invoice.subtotal);
  const tax = Number(invoice.taxAmount);
  const paid = Number(invoice.amountPaid || 0);
  const due = total - paid;
  const currency = invoice.currency || "SAR";

  const orgAddress = [
    (org as any).buildingNumber, (org as any).streetName, (org as any).district,
    (org as any).city, (org as any).region, (org as any).postalCode,
  ].filter(Boolean).join(" · ");

  const contactAddress = contact ? [
    (contact as any).addressLine1, contact.city, contact.country,
  ].filter(Boolean).join(" · ") : "";

  return (
    <div dir="rtl" style={{ background: "#F4F5F7", minHeight: "100vh", fontFamily: "'Tajawal','Noto Sans Arabic',sans-serif", color: accent }}>
      {/* Action bar (no-print) */}
      <div className="no-print" style={{ position: "fixed", top: 12, left: 12, zIndex: 99, display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: primary, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
          <Printer style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} /> طباعة / حفظ PDF
        </button>
        <button onClick={() => window.close()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
          <X style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} /> إغلاق
        </button>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; padding: 14mm !important; max-width: none !important; }
        }
        .invoice-page { max-width: 210mm; margin: 20px auto; background: white; padding: 24mm 18mm; box-shadow: 0 1px 4px rgba(0,0,0,0.06); font-size: 13px; line-height: 1.5; }
        .num { font-family: 'Inter', monospace; direction: ltr; display: inline-block; }
      `}</style>

      <div className="invoice-page">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            {(org as any).logoUrl ? (
              <img src={(org as any).logoUrl} alt={org.name} style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain" }} />
            ) : (
              <div style={{ fontWeight: 800, fontSize: 24, color: primary }}>{org.name}</div>
            )}
            <div style={{ marginTop: 8, color: "#6B7280", fontSize: 11 }}>{org.legalName || org.name}</div>
            {orgAddress && <div style={{ color: "#6B7280", fontSize: 11 }}>{orgAddress}</div>}
            {(org as any).email && <div style={{ color: "#6B7280", fontSize: 11 }}>{(org as any).email} · {(org as any).phone || ""}</div>}
            {org.vatNumber && <div style={{ color: "#6B7280", fontSize: 11 }}>{isKsa ? "الرقم الضريبي" : "EIN"}: <span className="num">{org.vatNumber}</span></div>}
            {org.crNumber && <div style={{ color: "#6B7280", fontSize: 11 }}>{isKsa ? "السجل التجاري" : "Filing #"}: <span className="num">{org.crNumber}</span></div>}
          </div>
          <div style={{ textAlign: "end" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px 0", color: primary }}>{isKsa ? "فاتورة ضريبية" : "Invoice"}</h1>
            <div style={{ fontSize: 13, color: "#6B7280" }}>Tax Invoice</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "#F4FCFF", color: primary, border: `1px solid ${primary}33` }}>
                {String(invoice.status || "DRAFT").toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Bill-to + invoice details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px 0" }}>عميل · Bill To</h2>
            <strong style={{ display: "block", color: accent, marginBottom: 4, fontSize: 14 }}>{contact?.displayName || contact?.legalName || "—"}</strong>
            {contact?.legalName && contact?.legalName !== contact?.displayName && (<div style={{ color: "#6B7280", fontSize: 11 }}>{contact.legalName}</div>)}
            {contactAddress && <div style={{ color: "#6B7280", fontSize: 11, marginTop: 4 }}>{contactAddress}</div>}
            {contact?.email && <div style={{ color: "#6B7280", fontSize: 11 }}>{contact.email}</div>}
            {contact?.phone && <div style={{ color: "#6B7280", fontSize: 11 }}>{contact.phone}</div>}
            {(contact as any)?.taxId && <div style={{ color: "#6B7280", fontSize: 11 }}>{isKsa ? "الرقم الضريبي" : "Tax ID"}: <span className="num">{(contact as any).taxId}</span></div>}
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px 0" }}>تفاصيل الفاتورة</h2>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 13 }}>
              <span style={{ color: "#6B7280" }}>رقم الفاتورة</span><span className="num" style={{ textAlign: "end" }}>{invoice.invoiceNumber}</span>
              <span style={{ color: "#6B7280" }}>تاريخ الإصدار</span><span className="num" style={{ textAlign: "end" }}>{String(invoice.issueDate).slice(0, 10)}</span>
              {invoice.dueDate && <><span style={{ color: "#6B7280" }}>تاريخ الاستحقاق</span><span className="num" style={{ textAlign: "end" }}>{String(invoice.dueDate).slice(0, 10)}</span></>}
              {(invoice as any).reference && <><span style={{ color: "#6B7280" }}>المرجع</span><span className="num" style={{ textAlign: "end" }}>{(invoice as any).reference}</span></>}
            </div>
          </div>
        </div>

        {/* Lines table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
          <thead>
            <tr>
              {["#", "الوصف · Description", "الكمية", "السعر", "VAT", "الإجمالي"].map((h, i) => (
                <th key={i} style={{ background: accent, color: "white", padding: "10px 12px", fontSize: 11, fontWeight: 600, textAlign: i >= 2 ? "end" : "start" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(invoice.lines || []).map((l: any, i: number) => {
              const q = Number(l.quantity || 0);
              const p = Number(l.unitPrice || 0);
              const lineTotal = Number(l.total || (q * p));
              const vatRate = Number(l.taxRate || 0) * 100;
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

        {/* Totals */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-start" }}>
          <div style={{ minWidth: 280, border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>
              <span>المجموع الفرعي · Subtotal</span><span className="num">{subtotal.toFixed(2)} {currency}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>
              <span>VAT</span><span className="num">{tax.toFixed(2)} {currency}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 15, fontWeight: 700, background: accent, color: "white" }}>
              <span>الإجمالي · Total</span><span className="num">{total.toFixed(2)} {currency}</span>
            </div>
            {paid > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>
                  <span>المدفوع</span><span className="num">{paid.toFixed(2)} {currency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, background: "#FEF3C7", fontWeight: 700 }}>
                  <span>المستحق</span><span className="num">{due.toFixed(2)} {currency}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: 24, padding: "12px 14px", background: "#FFFBEB", borderInlineEnd: "3px solid #F59E0B", borderRadius: 6, fontSize: 12, color: "#78350F" }}>
            <strong>ملاحظات:</strong> {invoice.notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: `2px solid ${primary}`, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end" }}>
          <div style={{ color: "#6B7280", fontSize: 11 }}>
            <div>شكراً لتعاملكم معنا · Thank you for your business</div>
            {(org as any).website && <div>{(org as any).website}</div>}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {(org as any).stampUrl && <img src={(org as any).stampUrl} alt="ختم" style={{ maxHeight: 90, maxWidth: 160, objectFit: "contain", opacity: 0.9 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
