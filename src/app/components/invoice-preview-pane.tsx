import { displayDigits } from "../lib/number-display";
/**
 * InvoicePreviewPane · the split-view paper document shown beside the invoice list.
 *
 * Reference: /home/claude/ref/Blue-InvoicesAR.png (panel column on the end side).
 * Anatomy · action bar (code · إرسال ink pill + PDF/تعديل outline pills) then a
 * paper card: eyebrow + big code + wordmark · من/إلى with VAT numbers in .font-code ·
 * line items on an ink rule · totals with a large grand total · QR + status line.
 *
 * UX-1 safe: this is a split view, never a dialog. Reusable for Invoice · Quote · Bill.
 */
import { ReactNode, useMemo } from "react";
import qrcode from "qrcode-generator";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { EntixWordmark } from "./entix-brand";
import { useLanguage } from "./LanguageContext";

export interface PreviewParty {
  name: string;
  vatNumber?: string | null;
}

export interface PreviewDocLine {
  id?: string;
  description: string;
  quantity?: number | string;
  unitPrice?: number | string;
  total?: number | string;
}

export interface PreviewDoc {
  id: string;
  /** Invoice / Quote / Bill number */
  number: string;
  status: string;
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string;
  subtotal?: number | string | null;
  taxTotal?: number | string | null;
  total: number | string;
  amountPaid?: number | string | null;
  /** ZATCA QR payload (base64 TLV) · rendered only when present */
  qr?: string | null;
  lines?: PreviewDocLine[];
}

interface Props {
  doc: PreviewDoc;
  seller?: PreviewParty | null;
  customer?: PreviewParty | null;
  /** "فاتورة ضريبية" · "عرض سعر" … */
  docTypeLabel?: string;
  /** Headline of the footer status line (e.g. "سُدّدت بالكامل") */
  statusLabel?: string;
  /** Second footer line · date · journal-entry reference */
  statusMeta?: string;
  /** Lines are being fetched lazily for the selected row */
  loading?: boolean;
  onSend?: () => void;
  onPdf?: () => void;
  onEdit?: () => void;
  editLabel?: string;
  /** Extra quiet actions appended to the action bar */
  extraActions?: ReactNode;
}

function num(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number | string | null | undefined) {
  return displayDigits(
    num(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
}

export function InvoicePreviewPane({
  doc,
  seller,
  customer,
  docTypeLabel,
  statusLabel,
  statusMeta,
  loading = false,
  onSend,
  onPdf,
  onEdit,
  editLabel,
  extraActions,
}: Props) {
  const { t } = useLanguage();
  const total = num(doc.total);
  const taxTotal = num(doc.taxTotal);
  const subtotal = doc.subtotal != null ? num(doc.subtotal) : total - taxTotal;
  const currency = doc.currency || "SAR";

  const qrHtml = useMemo(() => {
    if (!doc.qr) return null;
    try {
      const symbol = qrcode(0, "M");
      symbol.addData(doc.qr);
      symbol.make();
      return symbol.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
    } catch {
      return null;
    }
  }, [doc.qr]);

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar · code on the start edge, pills on the end edge */}
      <div className="flex items-center justify-between gap-2">
        <span dir="ltr" className="font-code text-[13px] font-semibold text-foreground">{doc.number}</span>
        <div className="flex items-center gap-2">
          {extraActions}
          {onEdit && (
            <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
              {editLabel || t("تعديل", "Edit")}
            </Button>
          )}
          {onPdf && (
            <Button type="button" size="sm" variant="secondary" onClick={onPdf}>
              <span className="font-english">PDF</span>
            </Button>
          )}
          {onSend && (
            <Button type="button" size="sm" onClick={onSend}>
              {t("إرسال", "Send")}
            </Button>
          )}
        </div>
      </div>

      {/* Paper card */}
      <div className="rounded-lg border border-border bg-card px-[26px] py-7 shadow-[var(--elevation-popover)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="ledger-eyebrow">{docTypeLabel || t("فاتورة ضريبية", "Tax invoice")}</span>
            <span dir="ltr" className="font-display text-[26px] leading-none text-foreground">{doc.number}</span>
          </div>
          <EntixWordmark size={13} className="shrink-0" />
        </div>

        <div className="mt-[18px] grid grid-cols-2 gap-3 text-xs text-content-secondary">
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-muted-foreground">{t("من", "From")}</span>
            <span className="truncate font-semibold text-foreground">{seller?.name || "—"}</span>
            {seller?.vatNumber && <span dir="ltr" className="font-code text-[11px]">VAT {seller.vatNumber}</span>}
          </div>
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-muted-foreground">{t("إلى", "To")}</span>
            <span className="truncate font-semibold text-foreground">{customer?.name || "—"}</span>
            {customer?.vatNumber && <span dir="ltr" className="font-code text-[11px]">VAT {customer.vatNumber}</span>}
          </div>
        </div>

        {/* Line items · ink rule on top, paper rule below */}
        <div className="mt-[18px] flex flex-col gap-2 border-t border-foreground border-b border-b-border py-2.5 text-xs">
          {loading ? (
            <div className="flex items-center gap-2 py-1 text-content-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              {t("جارٍ تحميل البنود…", "Loading line items…")}
            </div>
          ) : doc.lines && doc.lines.length ? (
            doc.lines.slice(0, 8).map((l, i) => (
              <div key={l.id || i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-foreground">{l.description || "—"}</span>
                <span dir="ltr" className="font-display shrink-0 text-[15px] leading-none text-foreground tabular-nums">
                  {money(l.total != null ? l.total : num(l.quantity) * num(l.unitPrice))}
                </span>
              </div>
            ))
          ) : (
            <div className="py-1 text-content-secondary">{t("لا توجد بنود", "No line items")}</div>
          )}
          {doc.lines && doc.lines.length > 8 && (
            <div className="text-muted-foreground">
              {t(`+ ${doc.lines.length - 8} بند إضافي`, `+ ${doc.lines.length - 8} more line(s)`)}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="mt-[18px] flex flex-col gap-1.5 text-xs text-content-secondary">
          <div className="flex items-baseline justify-between gap-3">
            <span>{t("الإجمالي قبل الضريبة", "Subtotal")}</span>
            <span dir="ltr" className="font-display text-[15px] leading-none text-foreground tabular-nums">{money(subtotal)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span>{t("ضريبة القيمة المضافة", "VAT")}</span>
            <span dir="ltr" className="font-display text-[15px] leading-none text-foreground tabular-nums">{money(taxTotal)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-foreground pt-2 font-semibold text-foreground">
            <span>{t("الإجمالي", "Total")}</span>
            <span dir="ltr" className="font-display text-[22px] leading-none tabular-nums">
              {money(total)} <span className="font-english text-xs font-normal text-muted-foreground">{currency}</span>
            </span>
          </div>
        </div>

        {/* QR (only when a payload exists) + status line */}
        {(qrHtml || statusLabel) && (
          <div className="mt-4 flex items-center justify-between gap-3 pt-1.5">
            {qrHtml ? (
              <span
                className="block h-14 w-14 shrink-0 opacity-80 [&_svg]:h-full [&_svg]:w-full"
                aria-label={t("رمز الاستجابة السريعة للفاتورة", "Invoice QR code")}
                dangerouslySetInnerHTML={{ __html: qrHtml }}
              />
            ) : <span />}
            {statusLabel && (
              <span className="text-end text-[11px] leading-4 text-muted-foreground">
                {statusLabel}
                {statusMeta && <><br /><span dir="ltr" className="font-code">{statusMeta}</span></>}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
