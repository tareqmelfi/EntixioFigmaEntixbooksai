/**
 * Voucher print view · branded receipt/payment voucher (UX-201)
 * Standalone route: /print/voucher/:id
 *
 * - No app chrome
 * - Auto print support
 * - Branded header (logo + legal details)
 * - Stamp + signature area
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { api, ApiError, Voucher, Org, Contact } from "../lib/api";
import qrcode from "qrcode-generator";
import { authStore } from "../components/auth-store";
import { Loader2, Printer, X } from "lucide-react";

const METHOD_LABELS: Record<Voucher["paymentMethod"], string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CARD: "بطاقة",
  STC_PAY: "STC Pay",
  MADA: "مدى",
  CHECK: "شيك",
  OTHER: "أخرى",
};

function safeNum(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function VoucherPrintView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [linkedInvoiceNumber, setLinkedInvoiceNumber] = useState<string | null>(null);
  const [linkedBillNumber, setLinkedBillNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const row = await api.vouchers.get(id);
        setVoucher(row);

        if (row.contactId) {
          const c = await api.contacts.get(row.contactId).catch(() => null);
          setContact(c);
        }
        if (row.invoiceId) {
          const inv = await api.invoices.get(row.invoiceId).catch(() => null);
          if (inv?.invoiceNumber) setLinkedInvoiceNumber(inv.invoiceNumber);
        }
        if (row.billId) {
          const b = await api.bills.get(row.billId).catch(() => null);
          const num = (b as any)?.billNumber || (b as any)?.number;
          if (num) setLinkedBillNumber(num);
        }

        const voucherOrgId = (row as any).orgId as string | undefined;
        if (voucherOrgId) {
          setOrg(await api.orgs.get(voucherOrgId));
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

  useEffect(() => {
    if (voucher) {
      document.title = `${voucher.number}${contact?.displayName ? " · " + contact.displayName : ""}`;
    }
  }, [voucher, contact]);

  const noPrint = searchParams.get("noprint") === "1";
  const embed = searchParams.get("embed") === "1";

  useEffect(() => {
    if (!loading && voucher && org && !noPrint) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [loading, voucher, org, noPrint]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !voucher || !org) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F7FB", padding: 24 }}>
        <div style={{ width: "min(420px,100%)", background: "white", border: "1px solid #E5EAF2", borderRadius: 10, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#0B1B49" }}>تعذّر تحميل السند</h1>
          <p style={{ margin: 0, color: "#607089" }}>{error || "هذا السند غير متاح"}</p>
        </div>
      </div>
    );
  }

  const isReceipt = voucher.type === "RECEIPT";
  const titleAr = isReceipt ? "سند قبض" : "سند صرف";
  const titleEn = isReceipt ? "Receipt Voucher" : "Payment Voucher";
  const partyLabelAr = isReceipt ? "استُلم من" : "صُرف لـ";

  const amount = safeNum(voucher.amount);
  const currency = voucher.currency || "SAR";

  const orgAddress = [
    (org as any).buildingNumber,
    (org as any).streetName,
    (org as any).district,
    (org as any).city,
    (org as any).region,
    (org as any).postalCode,
  ].filter(Boolean).join(" · ");

  const printLogo = (org as any).printLogoUrl || (org as any).logoUrl;
  const stampUrl = (org as any).stampUrl;

  const amountInWords = `${amount.toFixed(2)} ${currency === "SAR" ? "ريال سعودي" : currency} فقط لا غير`;

  // ── Electronic voucher: QR verification + issuer e-signature ──
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
  const sellerVat = (org as any).vatNumber || "";
  const qrPayload = tlvBase64([
    [1, org.name || ""],
    [2, sellerVat || "-"],
    [3, (() => { try { return new Date(voucher.date as any).toISOString(); } catch { return new Date().toISOString(); } })()],
    [4, amount.toFixed(2)],
    [5, voucher.number],
  ]);
  const qrSvg = (() => {
    const qr = qrcode(0, "M");
    qr.addData(qrPayload);
    qr.make();
    return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  })();

  const signatureUrl = (org as any).signatureUrl || ((org as any).brandingSettings || {}).signatureUrl || null;
  const issuerName = (voucher as any).createdByName || authStore.getState().user?.name || org.name;

  return (
    <>
      <style>{`
        body {
          margin: 0;
          background: #F4F5F7;
          font-family: 'Tajawal','Noto Sans Arabic',system-ui,sans-serif;
        }
        .num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; direction: ltr; display: inline-block; }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          html, body { width: 210mm; }
          .voucher-page {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 10mm 12mm 14mm !important;
            box-sizing: border-box !important;
          }
        }
        @page { size: A4; margin: 0; }
        ${embed ? ".voucher-page{ margin:8px auto !important; zoom:0.78; box-shadow:none !important; } body{ background:white; }" : ""}
      `}</style>

      <div dir="rtl" style={{ color: "#0B1B49", fontSize: 13, lineHeight: 1.5 }}>
        <div className="no-print" style={{ position: "fixed", top: 12, left: 12, zIndex: 99, display: embed ? "none" : "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1276E3", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            <Printer style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} />
            طباعة / حفظ PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 13 }}
          >
            <X style={{ display: "inline-block", verticalAlign: "middle", height: 14, width: 14, marginInlineEnd: 6 }} />
            إغلاق
          </button>
        </div>

        <div className="voucher-page" style={{ maxWidth: "210mm", margin: "20px auto", background: "white", padding: "10mm 14mm 14mm", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px 0", color: "#1276E3" }}>{titleAr}</h1>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{titleEn}</div>
            </div>

            <div style={{ textAlign: "end" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "start", paddingTop: 2 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#1276E3", lineHeight: 1.35 }}>{org.name}</div>
                  {org.legalName && org.legalName !== org.name && (
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#1276E3", direction: "ltr", textAlign: "right" }}>{org.legalName}</div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    {orgAddress && <div style={{ color: "#6B7280", fontSize: 10 }}>{orgAddress}</div>}
                    {org.vatNumber && <div style={{ color: "#6B7280", fontSize: 10 }}>الرقم الضريبي: <span className="num">{org.vatNumber}</span></div>}
                    {org.crNumber && <div style={{ color: "#6B7280", fontSize: 10 }}>السجل التجاري: <span className="num">{org.crNumber}</span></div>}
                  </div>
                </div>
                {printLogo ? (
                  <img src={printLogo} alt={org.name} style={{ maxHeight: 110, maxWidth: 220, objectFit: "contain", display: "block", borderRadius: 12 }} />
                ) : (
                  <div style={{ fontWeight: 800, fontSize: 24, color: "#1276E3" }}>{org.name}</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6", padding: "10px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, fontSize: 12 }}>
              <div><span style={{ color: "#6B7280" }}>رقم السند:</span> <strong className="num">{voucher.number}</strong></div>
              <div><span style={{ color: "#6B7280" }}>التاريخ:</span> <strong className="num">{String(voucher.date).slice(0, 10)}</strong></div>
              <div><span style={{ color: "#6B7280" }}>{partyLabelAr}:</span> <strong>{contact?.displayName || voucher.contact?.displayName || "—"}</strong></div>
              <div><span style={{ color: "#6B7280" }}>طريقة الدفع:</span> <strong>{METHOD_LABELS[voucher.paymentMethod]}</strong></div>
              {voucher.reference && <div><span style={{ color: "#6B7280" }}>المرجع:</span> <strong className="num">{voucher.reference}</strong></div>}
              {voucher.invoiceId && <div><span style={{ color: "#6B7280" }}>الفاتورة المرتبطة:</span> <strong className="num">{linkedInvoiceNumber || voucher.invoiceId}</strong></div>}
              {voucher.billId && <div><span style={{ color: "#6B7280" }}>سند المشتريات المرتبط:</span> <strong className="num">{linkedBillNumber || voucher.billId}</strong></div>}
            </div>
          </div>

          <div style={{ marginTop: 18, border: "2px solid #1276E3", borderRadius: 10, background: "#EFF8FF", padding: "16px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#6B7280" }}>المبلغ</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 800, color: "#1276E3", marginTop: 2 }}>{amount.toLocaleString()} {currency}</div>
            <div style={{ marginTop: 6, fontSize: 12 }}>{amountInWords}</div>
          </div>

          {voucher.notes && (
            <div style={{ marginTop: 16, padding: "12px 14px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}>
              <strong>ملاحظات:</strong> {voucher.notes}
            </div>
          )}

          {/* الإصدار الإلكتروني — توقيع صاحب الصلاحية (مرفوع من الإعدادات مثل الختم) أو الاسم */}
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {signatureUrl ? (
              <img src={signatureUrl} alt="توقيع" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
            ) : (
              <span style={{ fontFamily: "'Segoe Script','Traditional Arabic',cursive", fontSize: 20, color: "#0B1B49" }}>{issuerName}</span>
            )}
            <span style={{ color: "#6B7280", fontSize: 11 }}>· أُصدر إلكترونيًا</span>
          </div>

          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 110, height: 110, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div style={{ color: "#9CA3AF", fontSize: 10, marginTop: 4 }}>رمز التحقق الإلكتروني</div>
            </div>
            <div style={{ textAlign: "center" }}>
              {stampUrl ? (
                <img src={stampUrl} alt="stamp" style={{ maxHeight: 180, maxWidth: 180, objectFit: "contain", opacity: 0.88, mixBlendMode: "multiply" }} />
              ) : (
                <div style={{ color: "#9CA3AF", fontSize: 11 }}>ختم الشركة</div>
              )}
            </div>
            <div style={{ borderTop: "1px solid #9CA3AF", paddingTop: 8, textAlign: "center", color: "#6B7280", fontSize: 12 }}>
              توقيع المستلم
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
