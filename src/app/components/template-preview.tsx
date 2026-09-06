import { displayLocale } from "../lib/number-display";
/**
 * Shared document-template catalogs + live preview renderer.
 * Used by the templates list (preview modal) and the full-page designer.
 */
import { FileText, FileSpreadsheet, Receipt, CreditCard, ScrollText } from "lucide-react";

export type DocType = "INVOICE" | "QUOTE" | "RECEIPT_VOUCHER" | "PAYMENT_VOUCHER" | "CREDIT_NOTE";
export type Layout = "classic" | "modern" | "minimal";

export const TYPE_META: Record<DocType, { ar: string; en: string; icon: React.ElementType; color: string; bg: string }> = {
  INVOICE: { ar: "فاتورة بيع", en: "Sales Invoice", icon: FileText, color: "#1A1E48", bg: "#ECEEF5" },
  QUOTE: { ar: "عرض سعر", en: "Quotation", icon: FileSpreadsheet, color: "#7C3AED", bg: "#F3E8FF" },
  RECEIPT_VOUCHER: { ar: "سند قبض", en: "Receipt Voucher", icon: Receipt, color: "#166534", bg: "#DCFCE7" },
  PAYMENT_VOUCHER: { ar: "سند صرف", en: "Payment Voucher", icon: CreditCard, color: "#8A5F14", bg: "#FEF3C7" },
  CREDIT_NOTE: { ar: "إشعار دائن", en: "Credit Note", icon: ScrollText, color: "#5875DB", bg: "#EFF6FF" },
};

export const LAYOUT_META: Record<Layout, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  classic: { ar: "كلاسيكي", en: "Classic", hintAr: "جدول مؤطر وترويسة تقليدية", hintEn: "Framed table, traditional header" },
  modern: { ar: "حديث", en: "Modern", hintAr: "ترويسة ملوّنة جريئة ومساحات واسعة", hintEn: "Bold colored header, airy spacing" },
  minimal: { ar: "مبسّط", en: "Minimal", hintAr: "نظيف وخفيف للمبيعات الصغيرة", hintEn: "Clean and light for small sales" },
};

/** Live preview · renders a sample document with the template config */
export function TemplatePreview({ tpl, language }: { tpl: any; language: string }) {
  const isAr = language === "ar";
  const meta = TYPE_META[tpl.type as DocType] || TYPE_META.INVOICE;
  const rows = [
    { desc: isAr ? "خدمات استشارية — مارس" : "Consulting services — March", qty: 2, price: 3500 },
    { desc: isAr ? "تصميم هوية فرعية" : "Sub-brand design", qty: 1, price: 4200 },
    { desc: isAr ? "دعم فني شهري" : "Monthly technical support", qty: 3, price: 750 },
  ];
  const subtotal = rows.reduce((s, r) => s + r.qty * r.price, 0);
  const tax = tpl.showTaxBreakdown ? subtotal * 0.15 : 0;
  const total = subtotal + tax;
  const money = (n: number) => n.toLocaleString(displayLocale("en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isModern = tpl.layout === "modern";
  const isMinimal = tpl.layout === "minimal";

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: "inherit" }}>
      {/* header */}
      <div className={isModern ? "px-6 py-5 text-primary-foreground" : "px-6 py-5 border-b"} style={isModern ? { background: `linear-gradient(135deg, ${tpl.primaryColor}, ${tpl.accentColor})` } : { borderColor: "#e5e7eb" }}>
        <div className="flex items-start justify-between">
          <div>
            {tpl.showLogo && (
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${isModern ? "bg-card/20 text-primary-foreground" : "text-primary-foreground"}`} style={!isModern ? { background: tpl.primaryColor } : {}}>EN</div>
            )}
            <div className={`text-base font-bold ${isModern ? "text-primary-foreground" : ""}`} style={!isModern ? { color: tpl.primaryColor } : {}}>{isAr ? "شركتي القابضة" : "My Holding Co."}</div>
            <div className={`text-[11px] ${isModern ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{isAr ? "الرياض · السعودية · ر.ض 300123456700003" : "Riyadh · KSA · VAT 300123456700003"}</div>
          </div>
          <div className="text-end">
            <div className={`text-lg font-bold ${isModern ? "text-primary-foreground" : ""}`} style={!isModern ? { color: tpl.accentColor } : {}}>{isAr ? meta.ar : meta.en}</div>
            <div className={`text-[11px] font-english ${isModern ? "text-primary-foreground/80" : "text-muted-foreground"}`} dir="ltr">INV-2026-0042 · 2026-03-15</div>
          </div>
        </div>
      </div>

      {/* parties */}
      {!isMinimal && (
        <div className="px-6 py-3 flex gap-6 text-[12px] border-b border-border">
          <div><span className="text-muted-foreground">{isAr ? "إلى:" : "To:"}</span> <span className="font-semibold text-foreground">{isAr ? "شركة العميل المتحد" : "United Client Co."}</span></div>
          <div><span className="text-muted-foreground">{isAr ? "الاستحقاق:" : "Due:"}</span> <span className="font-english" dir="ltr">2026-04-14</span></div>
        </div>
      )}

      {/* lines */}
      <div className="px-6 py-3">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: isMinimal ? "transparent" : `${tpl.primaryColor}0F` }} className={isMinimal ? "border-b-2" : ""}>
              <th className="py-1.5 px-2 text-start font-semibold" style={{ color: tpl.primaryColor }}>{isAr ? "البند" : "Item"}</th>
              <th className="py-1.5 px-2 text-end font-semibold font-english" style={{ color: tpl.primaryColor }}>{isAr ? "كمية" : "Qty"}</th>
              <th className="py-1.5 px-2 text-end font-semibold font-english" style={{ color: tpl.primaryColor }}>{isAr ? "سعر" : "Price"}</th>
              <th className="py-1.5 px-2 text-end font-semibold font-english" style={{ color: tpl.primaryColor }}>{isAr ? "إجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-1.5 px-2 text-foreground">{r.desc}</td>
                <td className="py-1.5 px-2 text-end font-english text-muted-foreground">{r.qty}</td>
                <td className="py-1.5 px-2 text-end font-english text-muted-foreground">{money(r.price)}</td>
                <td className="py-1.5 px-2 text-end font-english font-semibold text-foreground">{money(r.qty * r.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-3 flex justify-end">
          <div className="w-48 space-y-1 text-[12px]">
            <div className="flex justify-between text-muted-foreground"><span>{isAr ? "الإجمالي الفرعي" : "Subtotal"}</span><span className="font-english">{money(subtotal)}</span></div>
            {tpl.showTaxBreakdown && (
              <div className="flex justify-between text-muted-foreground"><span>{isAr ? "ض.ق.م (15%)" : "VAT (15%)"}</span><span className="font-english">{money(tax)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t font-bold" style={{ color: tpl.primaryColor }}>
              <span>{isAr ? "الإجمالي" : "Total"}</span><span className="font-english">{money(total)} {isAr ? "ر.س" : "SAR"}</span>
            </div>
          </div>
        </div>

        {/* terms */}
        {tpl.showTerms && tpl.terms && (
          <div className="mt-4 pt-3 border-t border-dashed text-[11px] text-muted-foreground leading-5">
            <span className="font-semibold" style={{ color: tpl.accentColor }}>{isAr ? "الشروط: " : "Terms: "}</span>{tpl.terms}
          </div>
        )}
      </div>
    </div>
  );
}
