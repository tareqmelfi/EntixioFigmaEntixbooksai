import { forwardRef } from "react";

/* ─── Types (shared) ─── */
export type TaxMode = "exclusive" | "inclusive";

export interface LineItem {
  id: string;
  product: string;
  description: string;
  qty: number;
  price: number;
  taxRate: number;
  taxMode: TaxMode;
}

export interface SOWItem {
  id: string;
  title: string;
  description: string;
}

export interface CoverPage {
  enabled: boolean;
  title: string;
  subtitle: string;
  intro: string;
  companyOverview: string;
}

export interface TechnicalProposal {
  enabled: boolean;
  projectOverview: string;
  methodology: string;
  timeline: string;
  deliverables: string;
  assumptions: string;
}

export interface QuoteData {
  id: string;
  client: string;
  clientAddress?: string;
  date: string;
  validUntil: string;
  items: LineItem[];
  sowItems: SOWItem[];
  coverPage: CoverPage;
  technicalProposal: TechnicalProposal;
  notes: string;
  terms: string;
  reference: string;
  status: string;
}

/* ─── Helpers ─── */
function calcLine(item: LineItem) {
  if (item.taxMode === "inclusive") {
    const totalWithTax = item.qty * item.price;
    const base = totalWithTax / (1 + item.taxRate / 100);
    const tax = totalWithTax - base;
    return { base, tax, total: totalWithTax };
  } else {
    const base = item.qty * item.price;
    const tax = base * (item.taxRate / 100);
    return { base, tax, total: base + tax };
  }
}

function calcTotals(items: LineItem[]) {
  let subtotal = 0, taxTotal = 0, grandTotal = 0;
  for (const item of items) {
    const c = calcLine(item);
    subtotal += c.base;
    taxTotal += c.tax;
    grandTotal += c.total;
  }
  return { subtotal, taxTotal, grandTotal };
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════
   Print Template
   ═══════════════════════════════════════ */

interface Props {
  quote: QuoteData;
}

export const QuotePrintTemplate = forwardRef<HTMLDivElement, Props>(({ quote }, ref) => {
  const q = quote;
  const totals = calcTotals(q.items);
  const hasCover = q.coverPage.enabled && (q.coverPage.title || q.coverPage.intro);
  const hasTech = q.technicalProposal.enabled && (q.technicalProposal.projectOverview || q.technicalProposal.methodology);
  const hasSOW = q.sowItems.length > 0;

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        background: "#FFFFFF",
        fontFamily: "'Noto Sans Arabic', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#1a1a1a",
        fontSize: "11px",
        lineHeight: "1.6",
      }}
    >
      {/* ═══════ COVER PAGE ═══════ */}
      {hasCover && (
        <div style={{ pageBreakAfter: "always", minHeight: "297mm", display: "flex", flexDirection: "column" }}>
          {/* Top bar */}
          <div style={{ background: "#0B1B49", height: "8px" }} />

          {/* Header */}
          <div style={{ padding: "40px 50px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "8px", background: "#1276E3",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: "14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                }}>EB</div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0B1B49" }}>Entix Books</div>
                  <div style={{ fontSize: "10px", color: "#6B7280" }}>نظام المحاسبة السحابي</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "left", fontSize: "10px", color: "#6B7280" }}>
              <div style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{q.date}</div>
              <div style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{q.id}</div>
            </div>
          </div>

          {/* Main cover content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 50px" }}>
            <div style={{ borderRight: "4px solid #1276E3", paddingRight: "24px", marginBottom: "40px" }}>
              <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#0B1B49", margin: "0 0 8px", lineHeight: 1.3 }}>
                {q.coverPage.title || "عرض سعر"}
              </h1>
              {q.coverPage.subtitle && (
                <p style={{ fontSize: "16px", color: "#179FC5", margin: "0 0 8px", fontWeight: 600 }}>{q.coverPage.subtitle}</p>
              )}
              <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>
                مقدّم إلى: <span style={{ color: "#0B1B49", fontWeight: 600 }}>{q.client}</span>
              </p>
            </div>

            {q.coverPage.intro && (
              <div style={{ background: "#F9FAFB", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
                <p style={{ fontSize: "13px", color: "#374151", margin: 0, lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.coverPage.intro}</p>
              </div>
            )}

            {q.coverPage.companyOverview && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", color: "#0B1B49", fontWeight: 700, marginBottom: "8px" }}>نبذة عن الشركة</h3>
                <p style={{ fontSize: "12px", color: "#374151", margin: 0, lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.coverPage.companyOverview}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "20px 50px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#9CA3AF" }}>
            <span>سري وخاص — لا يُوزّع بدون إذن مسبق</span>
            <span style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>www.entixbooks.com</span>
          </div>
        </div>
      )}

      {/* ═══════ TECHNICAL PROPOSAL PAGE ═══════ */}
      {hasTech && (
        <div style={{ pageBreakAfter: "always", minHeight: "297mm", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#0B1B49", height: "4px" }} />

          {/* Page header */}
          <div style={{ padding: "30px 50px 0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "6px", background: "#179FC5",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: "12px",
              }}>◆</div>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#0B1B49" }}>العرض الفني</span>
            </div>
            <span style={{ fontSize: "10px", color: "#9CA3AF", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{q.id}</span>
          </div>

          <div style={{ flex: 1, padding: "0 50px" }}>
            {q.technicalProposal.projectOverview && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#179FC5" }} />
                  <h3 style={{ fontSize: "14px", color: "#0B1B49", fontWeight: 700, margin: 0 }}>نظرة عامة على المشروع</h3>
                </div>
                <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 0 14px", lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.technicalProposal.projectOverview}</p>
              </div>
            )}

            {q.technicalProposal.methodology && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#179FC5" }} />
                  <h3 style={{ fontSize: "14px", color: "#0B1B49", fontWeight: 700, margin: 0 }}>المنهجية</h3>
                </div>
                <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 0 14px", lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.technicalProposal.methodology}</p>
              </div>
            )}

            {q.technicalProposal.timeline && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#179FC5" }} />
                  <h3 style={{ fontSize: "14px", color: "#0B1B49", fontWeight: 700, margin: 0 }}>الجدول الزمني</h3>
                </div>
                <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 0 14px", lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.technicalProposal.timeline}</p>
              </div>
            )}

            {q.technicalProposal.deliverables && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#179FC5" }} />
                  <h3 style={{ fontSize: "14px", color: "#0B1B49", fontWeight: 700, margin: 0 }}>المخرجات</h3>
                </div>
                <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 0 14px", lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.technicalProposal.deliverables}</p>
              </div>
            )}

            {q.technicalProposal.assumptions && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
                  <h3 style={{ fontSize: "14px", color: "#0B1B49", fontWeight: 700, margin: 0 }}>الافتراضات والمتطلبات المسبقة</h3>
                </div>
                <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 0 14px", lineHeight: 1.8, whiteSpace: "pre-line" }}>{q.technicalProposal.assumptions}</p>
              </div>
            )}
          </div>

          <div style={{ padding: "20px 50px", borderTop: "1px solid #E5E7EB", fontSize: "9px", color: "#9CA3AF", textAlign: "center" }}>
            العرض الفني — {q.client}
          </div>
        </div>
      )}

      {/* ═══════ SOW PAGE ═══════ */}
      {hasSOW && (
        <div style={{ pageBreakAfter: "always", minHeight: "297mm", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#0B1B49", height: "4px" }} />

          <div style={{ padding: "30px 50px 0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "6px", background: "#0B1B49",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: "12px",
              }}>☰</div>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#0B1B49" }}>نطاق العمل (SOW)</span>
            </div>
            <span style={{ fontSize: "10px", color: "#9CA3AF", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{q.id}</span>
          </div>

          <div style={{ flex: 1, padding: "0 50px" }}>
            {q.sowItems.map((s, i) => (
              <div key={s.id} style={{
                marginBottom: "16px", borderRadius: "10px", border: "1px solid #E5E7EB",
                overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "14px 18px", background: "#F9FAFB",
                }}>
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "50%", background: "#1276E3",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "11px", fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                    flexShrink: 0,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0B1B49" }}>{s.title}</span>
                </div>
                {s.description && (
                  <div style={{ padding: "12px 18px 14px", fontSize: "11px", color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>
                    {s.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "20px 50px", borderTop: "1px solid #E5E7EB", fontSize: "9px", color: "#9CA3AF", textAlign: "center" }}>
            نطاق العمل — {q.client}
          </div>
        </div>
      )}

      {/* ═══════ PRICING / ITEMS PAGE ═══════ */}
      <div style={{ minHeight: "297mm", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#0B1B49", height: "4px" }} />

        {/* Company + Client Header */}
        <div style={{ padding: "30px 50px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            {/* Company */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "6px", background: "#1276E3",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: "12px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                }}>EB</div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0B1B49" }}>Entix Books</div>
                  <div style={{ fontSize: "9px", color: "#6B7280" }}>شركة Entix Books العالمية</div>
                </div>
              </div>
              <div style={{ fontSize: "9px", color: "#6B7280", marginTop: "4px" }}>
                <div>الرياض، المملكة العربية السعودية</div>
                <div style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>info@entixbooks.com | +966 50 000 0000</div>
              </div>
            </div>

            {/* Quote title */}
            <div style={{ textAlign: "left" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0B1B49", margin: "0 0 4px" }}>عرض سعر</h2>
              <div style={{
                display: "inline-block", background: "#EFF6FF", color: "#1276E3",
                borderRadius: "6px", padding: "2px 10px", fontSize: "12px",
                fontWeight: 700, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
              }}>{q.id}</div>
            </div>
          </div>

          {/* Info Grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "16px", marginBottom: "28px",
          }}>
            {/* Client info */}
            <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>العميل</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0B1B49", marginBottom: "2px" }}>{q.client}</div>
              {q.clientAddress && <div style={{ fontSize: "10px", color: "#6B7280" }}>{q.clientAddress}</div>}
            </div>

            {/* Quote details */}
            <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>بيانات العرض</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "11px" }}>
                <span style={{ color: "#6B7280" }}>التاريخ:</span>
                <span style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: "#374151" }}>{q.date}</span>
                <span style={{ color: "#6B7280" }}>صالح حتى:</span>
                <span style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: "#374151" }}>{q.validUntil}</span>
                {q.reference && <>
                  <span style={{ color: "#6B7280" }}>المرجع:</span>
                  <span style={{ color: "#374151" }}>{q.reference}</span>
                </>}
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div style={{ flex: 1, padding: "0 50px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#0B1B49" }}>
                <th style={{ ...thStyle, borderRadius: "0 8px 0 0" }}>الصنف</th>
                <th style={thStyle}>الوصف</th>
                <th style={{ ...thStyle, width: "50px", textAlign: "center" }}>الكمية</th>
                <th style={{ ...thStyle, width: "90px", textAlign: "left" }}>السعر</th>
                <th style={{ ...thStyle, width: "55px", textAlign: "center" }}>الضريبة</th>
                <th style={{ ...thStyle, width: "60px", textAlign: "center" }}>النوع</th>
                <th style={{ ...thStyle, width: "100px", textAlign: "left", borderRadius: "8px 0 0 0" }}>المجموع</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((item, i) => {
                const c = calcLine(item);
                const isEven = i % 2 === 0;
                return (
                  <tr key={item.id} style={{ background: isEven ? "#FFFFFF" : "#F9FAFB" }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "#0B1B49" }}>{item.product}</span>
                    </td>
                    <td style={{ ...tdStyle, color: "#6B7280" }}>{item.description}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{item.qty}</td>
                    <td style={{ ...tdStyle, textAlign: "left", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{fmt(item.price)}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{item.taxRate}%</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        background: item.taxMode === "inclusive" ? "#DBEAFE" : "#FEF3C7",
                        color: item.taxMode === "inclusive" ? "#1E40AF" : "#92400E",
                        borderRadius: "4px", padding: "1px 6px", fontSize: "9px", fontWeight: 700,
                      }}>
                        {item.taxMode === "inclusive" ? "شامل" : "مضافة"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "left", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fontWeight: 700, color: "#0B1B49" }}>{fmt(c.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "20px" }}>
            <div style={{ width: "280px", background: "#F9FAFB", borderRadius: "10px", padding: "16px", border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
                <span style={{ color: "#6B7280" }}>المجموع الفرعي:</span>
                <span style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: "#374151" }}>{fmt(totals.subtotal)} SR</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "11px" }}>
                <span style={{ color: "#6B7280" }}>ضريبة القيمة المضافة:</span>
                <span style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: "#374151" }}>{fmt(totals.taxTotal)} SR</span>
              </div>
              <div style={{ borderTop: "2px solid #0B1B49", paddingTop: "10px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#0B1B49" }}>الإجمالي:</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#0B1B49", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>{fmt(totals.grandTotal)} SR</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div style={{ display: "grid", gridTemplateColumns: q.notes && q.terms ? "1fr 1fr" : "1fr", gap: "16px", marginTop: "28px" }}>
            {q.notes && (
              <div style={{ background: "#FFFBEB", borderRadius: "10px", padding: "14px", border: "1px solid #FDE68A" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400E", marginBottom: "6px" }}>ملاحظات</div>
                <p style={{ fontSize: "10px", color: "#374151", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{q.notes}</p>
              </div>
            )}
            {q.terms && (
              <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "14px", border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#0B1B49", marginBottom: "6px" }}>الشروط والأحكام</div>
                <p style={{ fontSize: "10px", color: "#374151", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{q.terms}</p>
              </div>
            )}
          </div>
        </div>

        {/* Signature area */}
        <div style={{ padding: "30px 50px 10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
            <div>
              <div style={{ fontSize: "10px", color: "#6B7280", marginBottom: "30px" }}>توقيع المُرسل</div>
              <div style={{ borderBottom: "1px solid #D1D5DB", width: "200px", marginBottom: "6px" }} />
              <div style={{ fontSize: "9px", color: "#9CA3AF" }}>الاسم: ________________</div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#6B7280", marginBottom: "30px" }}>توقيع العميل (القبول)</div>
              <div style={{ borderBottom: "1px solid #D1D5DB", width: "200px", marginBottom: "6px" }} />
              <div style={{ fontSize: "9px", color: "#9CA3AF" }}>الاسم: ________________</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 50px", borderTop: "1px solid #E5E7EB", marginTop: "20px",
          display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#9CA3AF",
        }}>
          <span>تم إنشاؤه بواسطة Entix Books — نظام المحاسبة السحابي</span>
          <span style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>www.entixbooks.com</span>
        </div>
      </div>
    </div>
  );
});

QuotePrintTemplate.displayName = "QuotePrintTemplate";

/* Shared styles */
const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "start",
  fontSize: "10px",
  fontWeight: 700,
  color: "#FFFFFF",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "11px",
  borderBottom: "1px solid #F3F4F6",
  color: "#374151",
};
