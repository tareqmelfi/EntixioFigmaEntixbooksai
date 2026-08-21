/**
 * InvoicePreviewPane · split-view preview that shows when a row is clicked.
 *
 * Product requirement UX request (Wafeq pattern):
 * - Click row in list → preview pane opens on the left (RTL: end side)
 * - List collapses to narrow column on the right
 * - Click X or click another row to switch
 *
 * Reusable for: Invoice · Quote · Bill (any document with lines + totals)
 *
 * Usage:
 *   <InvoicePreviewPane
 *     invoice={selectedInvoice}
 *     customer={customer}
 *     onClose={() => setSelectedId(null)}
 *     onSign={() => openSign(invoice)}
 *     onApprove={() => handleApprove(invoice)}
 *     onDelete={() => setPendingDelete(invoice.id)}
 *   />
 */
import { ReactNode } from "react";
import { X, FileSignature, Mail, Printer, Edit3, Trash2 } from "lucide-react";
import { useLanguage } from "./LanguageContext";

interface DocumentLike {
  id: string;
  /** Invoice / Quote / Bill number */
  number: string;
  status: string;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  total: string | number;
  amountPaid?: string | number;
  currency?: string;
  notes?: string | null;
  lines?: Array<{
    id?: string;
    description: string;
    quantity: number | string;
    unitPrice: number | string;
    total?: number | string;
  }>;
}

interface ContactLike {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
}

interface Props {
  doc: DocumentLike;
  customer?: ContactLike | null;
  /** Status label map · e.g. { DRAFT: "مسودة", SENT: "مرسلة" } */
  statusLabels?: Record<string, string>;
  /** Status color map · Tailwind class string */
  statusColors?: Record<string, string>;
  docTypeLabel?: string; // "فاتورة" | "عرض سعر" | "فاتورة شراء"
  onClose: () => void;
  onApprove?: () => void;
  onSign?: () => void;
  onRecordPayment?: () => void;
  onSendEmail?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Optional extra action slot in the toolbar */
  extraActions?: ReactNode;
}

export function InvoicePreviewPane({
  doc,
  customer,
  statusLabels = {},
  statusColors = {},
  docTypeLabel,
  onClose,
  onApprove,
  onSign,
  onRecordPayment,
  onSendEmail,
  onEdit,
  onDelete,
  extraActions,
}: Props) {
  const { t, language } = useLanguage();
  const total = Number(doc.total);
  const paid = Number(doc.amountPaid || 0);
  const outstanding = total - paid;
  const statusLabel = statusLabels[doc.status] || doc.status;
  const statusColor = statusColors[doc.status] || "bg-gray-100 text-gray-700";

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col h-[calc(100vh-10rem)]">
      {/* Header bar · sticky */}
      <div className="border-b border-border bg-white px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50"
            aria-label={t("إغلاق المعاينة", "Close preview")}
            title={t("إغلاق", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground truncate" style={{ fontSize: "1rem", fontWeight: 700 }}>
                {docTypeLabel || t("مستند", "Document")} <span className="font-english">{doc.number}</span>
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>{statusLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{customer?.displayName || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {extraActions}
          {onApprove && doc.status === "DRAFT" && (
            <button onClick={onApprove} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 border border-green-200" title={t("اعتماد", "Approve")}>
              ✓ {t("اعتماد", "Approve")}
            </button>
          )}
          {onRecordPayment && doc.status !== "PAID" && doc.status !== "CANCELLED" && (
            <button onClick={onRecordPayment} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1 border border-green-200" title={t("تسجيل دفعة على الفاتورة", "Record payment on invoice")}>
              💰 {t("دفعة", "Payment")}
            </button>
          )}
          {onSign && doc.status !== "DRAFT" && doc.status !== "PAID" && doc.status !== "CANCELLED" && doc.status !== "CONVERTED" && (
            <button onClick={onSign} className="rounded-md px-2 py-1 text-xs text-primary hover:bg-blue-50 flex items-center gap-1" title={t("إرسال للتوقيع", "Send for signature")}>
              <FileSignature className="h-3.5 w-3.5" /> {t("توقيع", "Sign")}
            </button>
          )}
          {onSendEmail && (
            <button onClick={onSendEmail} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50" title={t("إرسال بالبريد", "Send by email")}>
              <Mail className="h-4 w-4" />
            </button>
          )}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button onClick={() => window.open(`/print/invoice/${doc.id}?lang=ar&noprint=1`, '_blank', 'noopener,noreferrer')}
              className="px-2 py-1.5 text-muted-foreground hover:bg-muted/50 flex items-center gap-1 text-xs"
              title={t("طباعة بالعربي", "Print in Arabic")}>
              <Printer className="h-3.5 w-3.5" /> {t("عربي", "AR")}
            </button>
            <span className="w-px bg-muted" />
            <button onClick={() => window.open(`/print/invoice/${doc.id}?lang=en&noprint=1`, '_blank', 'noopener,noreferrer')}
              className="px-2 py-1.5 text-muted-foreground hover:bg-muted/50 flex items-center gap-1 text-xs font-english"
              title="Print in English">
              <Printer className="h-3.5 w-3.5" /> EN
            </button>
          </div>
          {onEdit && (
            <button onClick={onEdit} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50" title={t("تعديل", "Edit")}>
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title={t("حذف", "Delete")}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body · live mirror of the printable invoice (exact copy of what prints) */}
      <div className="flex-1 bg-primary/5">
        <iframe key={`${doc.id}-${language}`} src={`/print/invoice/${doc.id}?lang=${language}&noprint=1&embed=1`} title={t("معاينة الفاتورة", "Invoice preview")} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
      </div>
      <div className="hidden flex-1 overflow-y-auto p-6 bg-primary/5">
        <div className="bg-white rounded-lg border border-border p-6 max-w-3xl mx-auto">
          {/* Document head */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-border">
            <div>
              <h3 className="text-foreground" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                {docTypeLabel || t("مستند", "Document")} <span className="font-english">{doc.number}</span>
              </h3>
              {doc.issueDate && (
                <p className="text-xs text-muted-foreground mt-1">{t("تاريخ الإصدار:", "Issue date:")} <span className="font-english">{doc.issueDate.slice(0, 10)}</span></p>
              )}
              {doc.dueDate && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("تاريخ الاستحقاق:", "Due date:")} <span className="font-english">{doc.dueDate.slice(0, 10)}</span></p>
              )}
              {doc.validUntil && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("صالح حتى:", "Valid until:")} <span className="font-english">{doc.validUntil.slice(0, 10)}</span></p>
              )}
            </div>
            <div className="text-end">
              <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>{statusLabel}</span>
            </div>
          </div>

          {/* Customer block */}
          {customer && (
            <div className="mb-6 pb-4 border-b border-border">
              <p className="text-xs text-muted-foreground mb-1">{t("إلى:", "To:")}</p>
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{customer.displayName}</p>
              {customer.email && <p className="text-xs text-muted-foreground font-english mt-0.5">{customer.email}</p>}
              {customer.phone && <p className="text-xs text-muted-foreground font-english">{customer.phone}</p>}
              {customer.taxId && <p className="text-xs text-muted-foreground">{t("الرقم الضريبي:", "VAT No.:")} <span className="font-english">{customer.taxId}</span></p>}
              {customer.address && <p className="text-xs text-muted-foreground mt-0.5">{customer.address}</p>}
            </div>
          )}

          {/* Lines */}
          {doc.lines && doc.lines.length > 0 && (
            <table className="w-full mb-6">
              <thead>
                <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>{t("الوصف", "Description")}</th>
                  <th className="py-2 px-3 text-start w-20" style={{ fontWeight: 600 }}>{t("الكمية", "Qty")}</th>
                  <th className="py-2 px-3 text-start w-28" style={{ fontWeight: 600 }}>{t("السعر", "Price")}</th>
                  <th className="py-2 px-3 text-start w-28" style={{ fontWeight: 600 }}>{t("الإجمالي", "Total")}</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={l.id || i} className="border-b border-border/50">
                    <td className="py-2 px-3 text-sm text-foreground/80">{l.description}</td>
                    <td className="py-2 px-3 font-english text-sm text-foreground/80">{Number(l.quantity).toLocaleString()}</td>
                    <td className="py-2 px-3 font-english text-sm text-foreground/80">{Number(l.unitPrice).toFixed(2)}</td>
                    <td className="py-2 px-3 font-english text-sm text-foreground" style={{ fontWeight: 600 }}>
                      {(l.total !== undefined ? Number(l.total) : Number(l.quantity) * Number(l.unitPrice)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-full max-w-xs space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("الإجمالي:", "Total:")}</span>
                <span className="font-english text-foreground" style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {total.toLocaleString()} {doc.currency || "SAR"}
                </span>
              </div>
              {paid > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("المُحصَّل:", "Collected:")}</span>
                    <span className="font-english text-green-600" style={{ fontWeight: 600 }}>{paid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                    <span className="text-muted-foreground">{t("المتبقي:", "Outstanding:")}</span>
                    <span className="font-english text-amber-600" style={{ fontWeight: 600 }}>{outstanding.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {doc.notes && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">{t("ملاحظات:", "Notes:")}</p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
