/**
 * ProposalDoc (SPEC-04) · shared renderer for the standard proposal document.
 * Used by:
 *   - /print/proposal/:id  (org-side branded PDF via browser print)
 *   - /q/:token            (public accept page)
 * Pure render — no fetching. A4-friendly · RTL/LTR by lang · brand Navy/Blue.
 */
import { Quote } from "../lib/api";

export type ProposalOrg = { name: string; logoUrl?: string | null; legalName?: string | null; vatNumber?: string | null; crNumber?: string | null };

const NAVY = "#0B1B49";
const BLUE = "#1276E3";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(v: unknown): string {
  return num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function groupSections(lines: NonNullable<Quote["lines"]>) {
  const included = lines.filter((l) => l.included !== false);
  const optional = lines.filter((l) => l.included === false);
  const bySection = new Map<string, typeof included>();
  for (const l of included) {
    const key = l.sectionLabel || "";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(l);
  }
  return { sections: [...bySection.entries()], optional };
}

export function ProposalDoc({ quote, org, lang }: { quote: Quote; org: ProposalOrg | null; lang: "ar" | "en" }) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const lines = quote.lines || [];
  const { sections, optional } = groupSections(lines);
  const multiSection = sections.length > 1 || (sections.length === 1 && sections[0][0] !== "");

  const th: React.CSSProperties = { background: NAVY, color: "#fff", padding: "7px 10px", fontSize: 11, fontWeight: 700, textAlign: "start" };
  const td: React.CSSProperties = { padding: "6px 10px", fontSize: 11.5, borderBottom: "1px solid #E5EEF5", verticalAlign: "top" };

  const sectionTable = (label: string, rows: NonNullable<Quote["lines"]>, idx: number) => {
    const secTotal = rows.reduce((s, l) => s + num(l.subtotal), 0);
    return (
      <div key={`${label}-${idx}`} style={{ breakInside: "avoid-page", marginBottom: 14 }}>
        {label && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 6px" }}>
            <span style={{ background: BLUE, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{label}</span>
            <span style={{ flex: 1, height: 1, background: "#D6E4EE" }} />
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}>#</th>
              <th style={th}>{t("البند", "Description")}</th>
              <th style={{ ...th, width: 52 }}>{t("الوحدة", "Unit")}</th>
              <th style={{ ...th, width: 62 }}>{t("الكمية", "Qty")}</th>
              <th style={{ ...th, width: 82 }}>{t("سعر الوحدة", "Unit price")}</th>
              <th style={{ ...th, width: 92 }}>{t("الإجمالي", "Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (
              <tr key={l.id || i} style={{ background: i % 2 ? "#F7FBFE" : "#fff" }}>
                <td style={{ ...td, color: "#8CA0B3" }} className="num">{i + 1}</td>
                <td style={td}>{l.description}</td>
                <td style={td}>{l.unit || "—"}</td>
                <td style={td} className="num">{num(l.quantity).toLocaleString()}</td>
                <td style={td} className="num">{fmt(l.unitPrice)}</td>
                <td style={{ ...td, fontWeight: 600 }} className="num">{fmt(l.subtotal)}</td>
              </tr>
            ))}
            {multiSection && (
              <tr>
                <td colSpan={5} style={{ ...td, fontWeight: 700, color: NAVY, background: "#EAF4FC" }}>{t("إجمالي القسم", "Section total")}</td>
                <td style={{ ...td, fontWeight: 700, color: NAVY, background: "#EAF4FC" }} className="num">{fmt(secTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ color: "#1B2A41", fontFamily: lang === "ar" ? "'Noto Sans Arabic', 'Inter', sans-serif" : "'Inter', 'Noto Sans Arabic', sans-serif" }}>
      {/* ── Cover header ── */}
      <div style={{ borderBottom: `3px solid ${BLUE}`, paddingBottom: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt="" style={{ height: 46, maxWidth: 130, objectFit: "contain" }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: 10, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
                {(org?.name || "?").slice(0, 1)}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>{org?.name || ""}</div>
              {org?.vatNumber && <div style={{ fontSize: 9.5, color: "#6B7280" }}>{t("الرقم الضريبي", "VAT No.")}: <span className="num">{org.vatNumber}</span></div>}
              {org?.crNumber && <div style={{ fontSize: 9.5, color: "#6B7280" }}>{t("السجل التجاري", "C.R.")}: <span className="num">{org.crNumber}</span></div>}
            </div>
          </div>
          <div style={{ textAlign: "end" }}>
            <div style={{ color: BLUE, fontWeight: 800, fontSize: 20 }}>{t("عرض سعر", "PROPOSAL")}</div>
            <div className="num" style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{quote.quoteNumber}</div>
          </div>
        </div>
        {quote.title && <div style={{ marginTop: 10, fontSize: 17, fontWeight: 800, color: NAVY }}>{quote.title}</div>}
      </div>

      {/* ── Meta grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          [t("مقدَّم إلى", "Prepared for"), quote.contact?.displayName || "—"],
          [t("تاريخ العرض", "Issue date"), quote.issueDate?.slice(0, 10) || "—"],
          [t("صالح حتى", "Valid until"), quote.validUntil?.slice(0, 10) || "—"],
          [t("القيمة الإجمالية", "Total value"), `${fmt(quote.total)} ${quote.currency}`],
        ].map(([k, v]) => (
          <div key={k as string} style={{ background: "#F4FCFF", border: "1px solid #D6E4EE", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ fontSize: 9.5, color: "#6B7280", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }} className={k === t("القيمة الإجمالية", "Total value") ? "num" : undefined}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Sections ── */}
      {sections.map(([label, rows], i) => sectionTable(label || (multiSection ? t("بنود عامة", "General items") : ""), rows, i))}

      {/* ── Totals ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, breakInside: "avoid-page" }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", fontSize: 12 }}>
            <span style={{ color: "#6B7280" }}>{t("المجموع الفرعي", "Subtotal")}</span>
            <span className="num">{fmt(quote.subtotal)} {quote.currency}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", fontSize: 12 }}>
            <span style={{ color: "#6B7280" }}>{t("ضريبة القيمة المضافة", "VAT")}</span>
            <span className="num">{fmt(quote.taxTotal)} {quote.currency}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: NAVY, color: "#fff", borderRadius: 8, fontSize: 13.5, fontWeight: 800 }}>
            <span>{t("الإجمالي", "Total")}</span>
            <span className="num">{fmt(quote.total)} {quote.currency}</span>
          </div>
        </div>
      </div>

      {/* ── Optional items ── */}
      {optional.length > 0 && (
        <div style={{ marginBottom: 16, breakInside: "avoid-page" }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: NAVY, marginBottom: 6 }}>
            {t("أعمال إضافية اختيارية — غير مشمولة في الإجمالي أعلاه", "Optional additional works — not included in the total above")}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, background: "#5B6B7F" }}>{t("البند", "Description")}</th>
                <th style={{ ...th, background: "#5B6B7F", width: 52 }}>{t("الوحدة", "Unit")}</th>
                <th style={{ ...th, background: "#5B6B7F", width: 62 }}>{t("الكمية", "Qty")}</th>
                <th style={{ ...th, background: "#5B6B7F", width: 92 }}>{t("السعر", "Price")}</th>
              </tr>
            </thead>
            <tbody>
              {optional.map((l, i) => (
                <tr key={l.id || i}>
                  <td style={td}>{l.description}</td>
                  <td style={td}>{l.unit || "—"}</td>
                  <td style={td} className="num">{num(l.quantity).toLocaleString()}</td>
                  <td style={td} className="num">{fmt(l.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Terms ── */}
      {(quote.notes || quote.termsConditions) && (
        <div style={{ background: "#F7FBFE", border: "1px solid #D6E4EE", borderRadius: 10, padding: "10px 14px", marginBottom: 16, breakInside: "avoid-page" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: NAVY, marginBottom: 4 }}>{t("الشروط والملاحظات", "Terms & notes")}</div>
          {quote.notes && <div style={{ fontSize: 11.5, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{quote.notes}</div>}
          {quote.termsConditions && <div style={{ fontSize: 11.5, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#4A5A6E" }}>{quote.termsConditions}</div>}
        </div>
      )}
    </div>
  );
}
